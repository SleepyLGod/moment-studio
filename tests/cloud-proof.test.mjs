import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
import {handleMcp} from '../server/mcp.ts';
const owner={userId:'owner',email:'owner@test'};
const api=(env,method='GET',user=owner,origin='https://moment.test')=>handleApi(new Request('https://moment.test/api/cloud-proof',{method,headers:{origin}}),env,user);
async function tool(env,name,args={},user=owner){const response=await handleMcp(new Request('https://moment.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),env,user);const result=(await response.json()).result;return result.isError?{error:result.content[0].text}:JSON.parse(result.content[0].text);}
async function setup(){const env=environment();await handleApi(new Request('https://moment.test/api/bootstrap',{method:'POST'}),env,owner);return env;}
const bytes=readFileSync(new URL('./fixtures/style-edit/result-512.jpg',import.meta.url));
const output={jpegBase64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),cloudTaskUrl:'https://chatgpt.com/local/test-cloud-task'};
test('public proof queues once, claims once, verifies bytes and saves without changing originals or albums',async()=>{
 const env=await setup(),before=env.sql.prepare('SELECT * FROM photos').all(),albums=env.sql.prepare('SELECT * FROM albums').all();
 assert.equal((await api(env,'POST',null)).status,401);assert.equal((await api(env,'POST',{userId:'other',email:'other@test'})).status,403);assert.equal((await api(env,'POST',owner,'https://evil.test')).status,403);
 const first=await api(env,'POST');assert.equal(first.status,202);const job=(await first.json()).job;assert.equal((await (await api(env,'POST')).json()).job.id,job.id);
 assert.ok((await tool(env,'claim_public_sample',{},null)).error);assert.ok((await tool(env,'claim_public_sample',{}, {userId:'other',email:'other@test'})).error);
 const claim=await tool(env,'claim_public_sample');assert.equal(claim.claimed,true);assert.equal(claim.repositorySource,'public/photos/1060.jpg');assert.equal((await tool(env,'claim_public_sample')).claimed,false);
 const data={...output,jobId:job.id,leaseToken:claim.leaseToken};
 assert.ok((await tool(env,'save_public_sample_result',{...data,leaseToken:'wrong'})).error);
 assert.ok((await tool(env,'save_public_sample_result',{...data,sha256:'wrong'})).error);assert.equal(env.objects.size,0);
 const result=await tool(env,'save_public_sample_result',data);assert.equal(result.sha256,output.sha256);assert.equal(result.width,512);assert.equal((await tool(env,'save_public_sample_result',data)).photoId,result.photoId);
 assert.ok((await tool(env,'save_public_sample_result',{...data,cloudTaskUrl:'https://chatgpt.com/local/another-task'})).error);
 assert.equal(env.objects.size,1);assert.equal(env.sql.prepare('SELECT count(*) n FROM files').get().n,1);
 assert.equal((await tool(env,'public_sample_status')).state,'succeeded');
 assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),albums);
 for(const original of before)assert.deepEqual(env.sql.prepare('SELECT * FROM photos WHERE id=?').get(original.id),original);
 const photo=JSON.parse(env.sql.prepare('SELECT data FROM photos WHERE id=?').get(result.photoId).data);assert.equal(photo.parentPhotoId,'1060');assert.equal(photo.src,'/photos/1060.jpg');
 const downloaded=await handleApi(new Request('https://moment.test'+result.src),env,owner);assert.equal(downloaded.status,200);assert.equal(createHash('sha256').update(new Uint8Array(await downloaded.arrayBuffer())).digest('hex'),output.sha256);
 assert.equal((await handleApi(new Request('https://moment.test'+result.src),env,null)).status,401);
});
test('expired or removed public sources cannot commit and do not silently rerun',async()=>{
 for(const change of ['expire','trash']){
  const env=await setup();const job=(await (await api(env,'POST')).json()).job,claim=await tool(env,'claim_public_sample');
  if(change==='expire')env.sql.prepare('UPDATE jobs SET lease_until=0').run();else env.sql.prepare("UPDATE photos SET deleted_at=1 WHERE id='1060'").run();
  assert.ok((await tool(env,'save_public_sample_result',{...output,jobId:job.id,leaseToken:claim.leaseToken})).error);assert.equal(env.objects.size,0);assert.equal((await tool(env,'claim_public_sample')).claimed,false);
  if(change==='expire')assert.equal((await tool(env,'public_sample_status')).state,'unknown','expired executions must not remain apparently running');
 }
});
