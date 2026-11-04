import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
import {handleMcp} from '../server/mcp.ts';

const owner={userId:'owner',email:'owner@test'},other={userId:'other',email:'other@test'};
const source=readFileSync(new URL('../public/photos/1060.jpg',import.meta.url));
const output=readFileSync(new URL('./fixtures/style-edit/result-512.jpg',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const secret='whsec_'+btoa('a'.repeat(32)),newSecret='whsec_'+btoa('b'.repeat(32));
const params={name:'style_edit.queued',arguments:{},delivery:{mode:'webhook',url:'https://connectors.api.openai.com/style-test',secret}};
const recipe={name:'Paper night',prompt:'Turn the photo into a layered blue paper print.',preserve:true,reference:null};
const command={kind:'edit',provider:'openai-subscription',photoIds:['private-coffee'],recipe,output:{mode:'native'},requestId:'first-edit'};
async function rpc(env,method,parameters,user=owner){return (await handleMcp(new Request('https://moment.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:parameters})}),env,user)).json();}
const tool=(env,name,args={},user=owner)=>rpc(env,'tools/call',{name,arguments:args},user).then(r=>r.result);
const read=r=>JSON.parse(r.content[0].text);
function api(env,path,method='GET',data,user=owner,headers={}){return handleApi(new Request('https://moment.test/api'+path,{method,headers:{...(data instanceof Uint8Array?{'content-type':'image/jpeg'}:data?{'content-type':'application/json'}:{}),...headers},...(data===undefined?{}:{body:data instanceof Uint8Array?data:JSON.stringify(data)})}),env,user);}
async function setup(){
 const env=environment();
 for(const [id,purpose] of [['input-original','original'],['input-preview','preview']]){
  assert.equal((await api(env,'/uploads','POST',{id,name:id+'.jpg',mime:'image/jpeg',size:source.length,purpose})).status,200);
  assert.equal((await api(env,'/uploads/'+id+'/body','PUT',source)).status,200);
  assert.equal((await api(env,'/uploads/'+id+'/complete','POST',{})).status,200);
 }
 assert.ok((await api(env,'/photos/private-coffee','PUT',{id:'private-coffee',name:'Imported test',src:'/api/files/input-original',thumbnailSrc:'/api/files/input-preview',category:'日常',kind:'photo'})).ok);
 assert.ok((await api(env,'/albums/untouched','PUT',{id:'untouched',title:'Manual album',note:'Keep',photoIds:['private-coffee']})).ok);
 return env;
}
function signed(options,key){const h=options.headers;return 'v1,'+createHmac('sha256',Buffer.from(key.slice(6),'base64')).update(h['webhook-id']+'.'+h['webhook-timestamp']+'.'+options.body).digest('base64');}
async function callback(run,delivery=()=>new Response(null,{status:200})){
 const old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);return body.type==='verification'?Response.json({challenge:body.challenge}):delivery(body,options,url);};
 try{await run();}finally{globalThis.fetch=old;}
}
test('owner-uploaded photo, custom prompt, saved style reuse, one native claim and immutable albums',async()=>{
 const env=await setup(),albums=env.sql.prepare('SELECT * FROM albums').all(),original=env.sql.prepare("SELECT * FROM photos WHERE id='private-coffee'").get(),events=[];
 assert.equal((await api(env,'/jobs','POST',command)).status,503);
 await callback(async()=>{
  const connection=await rpc(env,'events/subscribe',params);assert.ok(connection.result?.id,JSON.stringify(connection));
  const created=await api(env,'/jobs','POST',command);assert.equal(created.status,202,await created.clone().text());const job=(await created.json()).jobs[0];
  assert.deepEqual(events[0].data,{jobId:job.id});assert.equal(job.delivery.accepted,true);
  assert.equal((await (await api(env,'/jobs','POST',command)).json()).jobs[0].id,job.id);assert.equal(events.length,1);
  assert.equal((await tool(env,'claim_style_edit',{jobId:job.id},other)).isError,true);
  env.MOMENT_EXECUTOR_KEY='test';env.MOMENT_IMAGE_EDIT_ENABLED=env.MOMENT_BACKGROUND_ENABLED='true';
  const runner=await api(env,'/internal/jobs/run','POST',{},null,{'x-moment-executor-key':'test'});assert.equal((await runner.json()).editTask,undefined,'legacy executor cannot claim subscription jobs');
  const claimed=await tool(env,'claim_style_edit',{jobId:job.id}),claim=read(claimed);assert.equal(claim.claimed,true);assert.equal(claim.prompt,recipe.prompt);assert.deepEqual(Buffer.from(claimed.content[1].data,'base64'),source);assert.equal(claim.images[0].sha256,sha(source));
  assert.equal(read(await tool(env,'claim_style_edit',{jobId:job.id})).claimed,false);
  const result={jobId:job.id,leaseToken:claim.leaseToken,jpegBase64:output.toString('base64'),sha256:sha(output)};
  assert.equal((await tool(env,'finish_style_edit',{...result,leaseToken:'wrong'})).isError,true);
  assert.equal((await tool(env,'finish_style_edit',{...result,sha256:'a'.repeat(64)})).isError,true);
  const stored=read(await tool(env,'finish_style_edit',result));assert.equal(stored.sha256,sha(output));assert.deepEqual(read(await tool(env,'finish_style_edit',result)),stored);
  assert.deepEqual(Buffer.from(await (await api(env,stored.src.slice(4))).arrayBuffer()),output);
  assert.equal((await api(env,stored.src.slice(4),'GET',undefined,other)).status,403);
  const style=(await (await api(env,'/styles/paper-night','PUT',{...recipe,id:'paper-night',cover:stored.src})).json()).item;
  assert.ok((await api(env,'/photos/another','PUT',{id:'another',name:'Other source',src:'/api/files/input-original',thumbnailSrc:'/api/files/input-preview'})).ok);
  const reuse=(await (await api(env,'/jobs','POST',{...command,photoIds:['another'],recipe:style,requestId:'reuse-edit'})).json()).jobs[0];
  assert.equal(read(await tool(env,'claim_style_edit',{jobId:reuse.id})).prompt,recipe.prompt);
  assert.deepEqual(env.sql.prepare("SELECT * FROM photos WHERE id='private-coffee'").get(),original);
  assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),albums);
 },(event)=>{events.push(event);return new Response(null,{status:200});});
});

test('style subscription renews the same identity, rotates signatures and keeps proof independent',async()=>{
 const env=await setup(),clock=Date.now,start=clock();
 try{Date.now=()=>start;await callback(async()=>{
  const proof=await rpc(env,'events/subscribe',{...params,name:'public_sample.queued'});assert.ok(proof.result.id);
  const first=(await rpc(env,'events/subscribe',{...params,ttlMs:60000})).result;assert.equal(Date.parse(first.refreshBefore),start+60000);
  Date.now=()=>start+59000;
  const updated=(await rpc(env,'events/subscribe',{...params,ttlMs:120000,delivery:{...params.delivery,secret:newSecret}})).result;
  assert.equal(first.id,updated.id);assert.equal(Date.parse(updated.refreshBefore),start+179000);
  Date.now=()=>start+61000;
  const state=read(await tool(env,'style_cloud_connection'));assert.equal(state.ready,true);assert.equal(state.renewedAt,start+59000);
  assert.equal((await api(env,'/jobs','POST',command)).status,202);
  await rpc(env,'events/unsubscribe',params);
  assert.equal(read(await tool(env,'style_cloud_connection')).ready,false);
  assert.equal(read(await tool(env,'public_cloud_connection')).ready,true);
 },(event,options)=>{assert.equal(event.name,params.name);assert.deepEqual(options.headers['webhook-signature'].split(' '),[signed(options,newSecret),signed(options,secret)]);return new Response(null,{status:200});});}
 finally{Date.now=clock;}
});

test('uncertain executions never rerun; an unaccepted webhook retries the same event',async()=>{
 const env=await setup(),events=[];
 await callback(async()=>{
  await rpc(env,'events/subscribe',params);
  const job=(await (await api(env,'/jobs','POST',command)).json()).jobs[0];assert.equal(job.delivery.state,'failed');
  const retry=(await (await api(env,'/jobs','POST',{kind:'retry-subscription-edit',jobId:job.id})).json()).job;
  assert.equal(retry.id,job.id);assert.equal(retry.delivery.accepted,true);assert.deepEqual(events[0],events[1]);
  const claim=read(await tool(env,'claim_style_edit',{jobId:job.id}));
  const failed=read(await tool(env,'finish_style_edit',{jobId:job.id,leaseToken:claim.leaseToken,errorCode:'RESULT_UNKNOWN'}));
  assert.equal(failed.state,'unknown');assert.equal(read(await tool(env,'claim_style_edit',{jobId:job.id})).claimed,false);
  assert.equal((await api(env,'/jobs','POST',{...command,requestId:'different'})).status,409);
  assert.equal(env.sql.prepare('SELECT count(*) n FROM photos').get().n,1);
 },event=>{events.push(event);return new Response(null,{status:events.length===1?413:200});});
});
