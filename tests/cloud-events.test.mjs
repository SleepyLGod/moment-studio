import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
import {handleMcp} from '../server/mcp.ts';
const owner={userId:'owner',email:'owner@test'},secret='whsec_'+btoa('a'.repeat(32));
const params={name:'public_sample.queued',arguments:{},delivery:{mode:'webhook',url:'https://chatgpt.com/test-callback',secret}};
async function rpc(env,method,parameters={},user=owner){return (await handleMcp(new Request('https://moment.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:parameters})}),env,user)).json();}
async function api(env,method='POST'){return handleApi(new Request('https://moment.test/api/cloud-proof',{method}),env,owner);}
async function setup(){const env=environment();await handleApi(new Request('https://moment.test/api/bootstrap',{method:'POST'}),env,owner);return env;}
async function withFetch(handler,run){const original=globalThis.fetch;globalThis.fetch=handler;try{await run();}finally{globalThis.fetch=original;}}
function verifySignature(options){const h=options.headers;const signed=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(h['webhook-id']+'.'+h['webhook-timestamp']+'.'+options.body).digest('base64');assert.ok(h['webhook-signature'].split(' ').includes('v1,'+signed));assert.equal(options.redirect,'error');}
test('MCP events are discovered; owner-only subscriptions verify signed challenges and renew idempotently',async()=>{
 const env=await setup();let calls=0;
 await withFetch(async(url,options)=>{calls++;verifySignature(options);assert.equal(url,params.delivery.url);const body=JSON.parse(options.body);assert.equal(body.type,'verification');return Response.json({challenge:body.challenge});},async()=>{
  assert.deepEqual((await rpc(env,'server/discover')).result.capabilities.events,{});assert.equal((await rpc(env,'events/list')).result.events[0].name,params.name);
  assert.ok((await rpc(env,'events/subscribe',params,null)).error);assert.ok((await rpc(env,'events/subscribe',params,{userId:'other',email:'other@test'})).error);
  const first=await rpc(env,'events/subscribe',params);assert.ok(first.result?.id,JSON.stringify(first));assert.equal((await rpc(env,'events/subscribe',params)).result.id,first.result.id);assert.equal(calls,1,'cached challenge for the same identity/url/secret');
  assert.equal(env.sql.prepare('SELECT count(*) n FROM cloud_event_subscriptions').get().n,1);
  assert.ok((await rpc(env,'events/subscribe',{...params,delivery:{...params.delivery,url:'https://chatgpt.com/another-callback'}})).error,'one active cloud listener per owner');
  assert.deepEqual((await rpc(env,'events/unsubscribe',params)).result,{});assert.deepEqual((await rpc(env,'events/unsubscribe',params)).result,{});assert.equal((await api(env)).status,503);assert.equal(env.sql.prepare('SELECT count(*) n FROM jobs').get().n,0);
 });
});
test('callback origins, redirects, malformed secrets and incorrect challenges fail closed',async()=>{
 const env=await setup();let calls=0;
 await withFetch(async()=>{calls++;return Response.json({challenge:'wrong'});},async()=>{
  for(const url of ['http://chatgpt.com/a','https://chatgpt.com.evil.test/a','https://127.0.0.1/a','https://chatgpt.com:444/a','https://user:pass@chatgpt.com/a','https://chatgpt.com/a#fragment'])assert.equal((await rpc(env,'events/subscribe',{...params,delivery:{...params.delivery,url}})).error.code,-32015);
  assert.equal(calls,0);
  assert.ok((await rpc(env,'events/subscribe',{...params,delivery:{...params.delivery,secret:'whsec_bad'}})).error);assert.equal(calls,0);
  assert.equal((await rpc(env,'events/subscribe',params)).error.data.reason,'challenge_failed');assert.equal(env.sql.prepare('SELECT count(*) n FROM cloud_event_subscriptions').get().n,0);
 });
 await withFetch(async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}}),async()=>{assert.equal((await rpc(env,'events/subscribe',params)).error.data.reason,'http_302');});
});
test('button awaits event delivery; retries reuse one event and one job, without modifying albums',async()=>{
 const env=await setup(),albums=env.sql.prepare('SELECT * FROM albums').all(),deliveries=[];let failDelivery=true;
 await withFetch(async(url,options)=>{verifySignature(options);const payload=JSON.parse(options.body);if(payload.type==='verification')return Response.json({challenge:payload.challenge});deliveries.push(payload);return new Response(null,{status:failDelivery?413:202});},async()=>{
  await rpc(env,'events/subscribe',params);
  const first=await api(env),a=await first.json();assert.equal(first.status,202);assert.equal(a.job.delivery.accepted,false);assert.equal(a.job.state,'queued');
  failDelivery=false;const b=await (await api(env)).json();assert.equal(b.job.id,a.job.id);assert.equal(b.job.delivery.accepted,true);assert.equal(deliveries.length,2);assert.deepEqual(deliveries[0],deliveries[1]);
  await api(env);assert.equal(deliveries.length,2,'accepted events are not resent');assert.equal(env.sql.prepare('SELECT count(*) n FROM jobs').get().n,1);assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),albums);
  const claim=(await rpc(env,'tools/call',{name:'claim_public_sample',arguments:{}})).result;assert.equal(JSON.parse(claim.content[0].text).claimed,true);assert.equal(JSON.parse((await rpc(env,'tools/call',{name:'claim_public_sample',arguments:{}})).result.content[0].text).claimed,false);
 });
});
test('event source image is fixed and checksum-verified; no private photo selector exists',async()=>{
 const env=await setup(),bytes=readFileSync(new URL('../public/photos/1060.jpg',import.meta.url));env.ASSETS={fetch:async()=>new Response(bytes)};
 const result=(await rpc(env,'tools/call',{name:'public_sample_image',arguments:{}})).result;assert.equal(result.content[1].type,'image');assert.deepEqual(Buffer.from(result.content[1].data,'base64'),bytes);
 env.ASSETS={fetch:async()=>new Response('wrong')};assert.equal((await rpc(env,'tools/call',{name:'public_sample_image',arguments:{}})).result.isError,true);
});
