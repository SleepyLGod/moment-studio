import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../server/api.ts';
import {environment} from './support.mjs';

const owner={userId:'owner-a',email:'owner@example.test'};
function api(env,path,body,user=owner,headers={}){
  return handleApi(new Request('https://moment.test/api'+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)}),env,user);
}
test('an owned analysis request is persisted as a job, with duplicate submissions returning the same job',async()=>{
  const env=environment();
  env.NVIDIA_API_KEY='test-only';env.MOMENT_EXECUTOR_KEY='test-executor-key';env.MOMENT_BACKGROUND_ENABLED='true';
  await handleApi(new Request('https://moment.test/api/me'),env,owner);
  const photo={id:'coffee',name:'Coffee',src:'/photos/1060.jpg',kind:'photo',category:'日常',style:'original'};
  assert.equal((await handleApi(new Request('https://moment.test/api/photos/coffee',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(photo)}),env,owner)).status,200);
  const first=await api(env,'/jobs',{kind:'analyze',photoIds:['coffee']});
  assert.equal(first.status,202,await first.clone().text());
  const created=await first.json();assert.equal(created.jobs.length,1);assert.equal(created.jobs[0].state,'queued');
  const repeated=await (await api(env,'/jobs',{kind:'analyze',photoIds:['coffee']})).json();
  assert.equal(repeated.jobs[0].id,created.jobs[0].id);
});
test('task advancement has separate service authorization and can never bootstrap an owner',async()=>{
  const env=environment();env.MOMENT_EXECUTOR_KEY='test-executor-key';
  assert.equal((await api(env,'/internal/jobs/run',{},null)).status,401);
  assert.equal((await api(env,'/internal/jobs/run',{},null,{'x-moment-executor-key':'wrong'})).status,401);
  const valid=await api(env,'/internal/jobs/run',{},null,{'x-moment-executor-key':'test-executor-key'});
  assert.equal(valid.status,503,await valid.clone().text());
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM library_owner').get().n,0);
});

async function uploadedJob(env){
  env.NVIDIA_API_KEY='test-only';env.MOMENT_EXECUTOR_KEY='test-executor-key';env.MOMENT_BACKGROUND_ENABLED='true';
  const jpeg=new Uint8Array(await (await import('node:fs/promises')).readFile(new URL('../public/photos/1060.jpg',import.meta.url)));
  await api(env,'/uploads',{id:'original',name:'coffee.jpg',mime:'image/jpeg',size:jpeg.length,purpose:'original'});
  await handleApi(new Request('https://moment.test/api/uploads/original/body',{method:'PUT',body:jpeg}),env,owner);
  await api(env,'/uploads/original/complete',{});
  const photo={id:'coffee',name:'Coffee',src:'/api/files/original',kind:'photo',category:'日常',manualTags:['mine'],style:'original'};
  await handleApi(new Request('https://moment.test/api/photos/coffee',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(photo)}),env,owner);
  return (await (await api(env,'/jobs',{kind:'analyze',photoIds:['coffee']})).json()).jobs[0];
}
function run(env){return api(env,'/internal/jobs/run',{},null,{'x-moment-executor-key':'test-executor-key'});}
const modelReply=()=>Response.json({choices:[{message:{content:JSON.stringify({tags:['咖啡','手冲'],caption:'手冲咖啡'})},finish_reason:'stop'}]});

test('the executor persists validated tags and task success together while preserving manual data and original bytes',{timeout:2500},async t=>{
  const env=environment(),job=await uploadedJob(env);let calls=0;const original=new Uint8Array(await (await handleApi(new Request('https://moment.test/api/files/original'),env,owner)).arrayBuffer());
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');const payload=JSON.parse(options.body);assert.equal(payload.model,'nvidia/nemotron-3.5-super-vl-120b-a12b');assert.ok(payload.messages[0].content[0].image_url.url.startsWith('data:image/jpeg;base64,'));return modelReply();});
  const r=await run(env);assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).processed,1);assert.equal(calls,1);
  const stored=env.sql.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);assert.equal(stored.state,'succeeded');
  const photo=JSON.parse(env.sql.prepare('SELECT data FROM photos WHERE id=?').get('coffee').data);
  assert.deepEqual(photo.aiTags,['咖啡','手冲']);assert.deepEqual(photo.manualTags,['mine']);assert.equal(photo.category,'日常');assert.equal(photo.src,'/api/files/original');assert.deepEqual(new Uint8Array(await (await handleApi(new Request('https://moment.test/api/files/original'),env,owner)).arrayBuffer()),original);
  assert.equal((await (await run(env)).json()).processed,0);assert.equal(calls,1);
});
test('overlapping executor requests cannot run the same model task twice',{timeout:2500},async t=>{
  const env=environment();await uploadedJob(env);let release,started;const pending=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;started();await pending;return modelReply();});
  const first=run(env);await ready;
  assert.equal((await (await run(env)).json()).processed,0);release();assert.equal((await (await first).json()).processed,1);assert.equal(calls,1);
});
test('a stale execution token cannot write tags or complete another execution',{timeout:2500},async t=>{
  const env=environment(),job=await uploadedJob(env);let release,started;const pending=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
  t.mock.method(globalThis,'fetch',async()=>{started();await pending;return modelReply();});
  const first=run(env);await ready;env.sql.prepare("UPDATE jobs SET lease_token='new-execution',lease_until=? WHERE id=?").run(Date.now()+60000,job.id);release();await first;
  assert.equal(env.sql.prepare('SELECT state FROM jobs WHERE id=?').get(job.id).state,'running');
  assert.equal(JSON.parse(env.sql.prepare('SELECT data FROM photos WHERE id=?').get('coffee').data).aiTags,undefined);
});
test('rate limits defer the same task, and HTTP 200 with empty output is a failed task',{timeout:2500},async t=>{
  const env=environment(),job=await uploadedJob(env);let calls=0;
  const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('{}',{status:429,headers:{'retry-after':'60'}});});
  await run(env);let row=env.sql.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);assert.equal(row.state,'queued');assert.ok(row.next_run_at>Date.now());assert.equal(row.error_code,'RATE_LIMITED');
  await run(env);assert.equal(calls,1);
  env.sql.prepare('UPDATE jobs SET next_run_at=0 WHERE id=?').run(job.id);mock.mock.mockImplementation(async()=>Response.json({choices:[{message:{content:null}}]}));
  await run(env);row=env.sql.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);assert.equal(row.state,'failed');assert.equal(row.error_code,'INVALID_OUTPUT');
});

test('an expired final attempt becomes failed instead of remaining running forever',async t=>{
  const env=environment(),job=await uploadedJob(env);
  env.sql.prepare("UPDATE jobs SET state='running',attempts=3,lease_token='lost',lease_until=0 WHERE id=?").run(job.id);
  t.mock.method(globalThis,'fetch',async()=>assert.fail('Exhausted work must not reach the provider'));
  await run(env);
  const row=env.sql.prepare('SELECT state,error_code FROM jobs WHERE id=?').get(job.id);
  assert.equal(row.state,'failed');assert.equal(row.error_code,'RETRY_EXHAUSTED');
});
test('the gallery rejects background work until the executor is explicitly enabled',async()=>{
  const env=environment();env.NVIDIA_API_KEY='test-only';env.MOMENT_EXECUTOR_KEY='test-executor-key';
  const response=await api(env,'/jobs',{kind:'analyze',photoIds:['coffee']});
  assert.equal(response.status,503);assert.equal(env.sql.prepare('SELECT count(*) AS n FROM jobs').get().n,0);
});

test('an interrupted analysis with an expired lease can be claimed and completed by the next tick',async t=>{
  const env=environment(),job=await uploadedJob(env);
  env.sql.prepare("UPDATE jobs SET state='running',attempts=1,lease_token='lost',lease_until=0 WHERE id=?").run(job.id);
  t.mock.method(globalThis,'fetch',async()=>modelReply());
  assert.equal((await (await run(env)).json()).processed,1);
  const row=env.sql.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);
  assert.equal(row.state,'succeeded');assert.equal(row.attempts,2);assert.equal(row.lease_token,null);
});
