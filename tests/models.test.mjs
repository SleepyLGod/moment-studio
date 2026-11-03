import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';

const owner={userId:'owner-a',email:'owner@example.test'};
const model='nvidia/nemotron-3.5-super-vl-120b-a12b';
const directory=(ids=[model])=>Response.json({object:'list',data:ids.map(id=>({id,object:'model',owned_by:'system'}))});
function request(env,path,method='GET',data,user=owner){return handleApi(new Request('https://moment.test/api'+path,{method,...(data?{headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{})}),env,user);}
function configured(){const env=environment();env.NVIDIA_API_KEY='test-key';env.MOMENT_EXECUTOR_KEY='test-runner';env.MOMENT_BACKGROUND_ENABLED='true';return env;}

test('model refresh is owner-only, bounded to compatible profiles, and concurrent refresh shares one directory read',async t=>{
  const env=configured();await request(env,'/me');let calls=0,release;
  const pending=new Promise(resolve=>release=resolve);
  t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://integrate.api.nvidia.com/v1/models');assert.equal(options.redirect,'manual');calls++;await pending;return directory(['meta/llama-3.2-11b-vision-instruct',model]);});
  assert.equal((await request(env,'/ai/models/refresh','POST',{},null)).status,401);
  assert.equal((await request(env,'/ai/models/refresh','POST',{}, {userId:'other',email:'other@example.test'})).status,403);
  const a=request(env,'/ai/models/refresh','POST',{}),b=request(env,'/ai/models/refresh','POST',{});release();
  const responses=await Promise.all([a,b]);for(const response of responses){assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.deepEqual(data.candidates.map(x=>x.id),[model]);assert.equal(data.selectedModelId,model);assert.equal(data.selectionReason,'supported-default');assert.equal(data.lastSuccessfulModelId,null);}
  assert.equal(calls,1);
  const read=await (await request(env,'/ai/models')).json();assert.equal(read.selectedModelId,model);assert.ok(read.checkedAt);assert.ok(!JSON.stringify(read).includes('test-key'));
});

test('failed or malformed directory refresh never overwrites the last successful catalog',async t=>{
  const env=configured();let reply=()=>directory();
  t.mock.method(globalThis,'fetch',async()=>reply());
  assert.equal((await request(env,'/ai/models/refresh','POST',{})).status,200);
  const before=await (await request(env,'/ai/models')).json();
  for(const invalid of [()=>new Response('{}',{status:429}),()=>Response.json({data:[{}]}),()=>new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}})]){
    reply=invalid;const failure=await request(env,'/ai/models/refresh','POST',{});assert.equal(failure.status,503);
    const after=await (await request(env,'/ai/models')).json();assert.deepEqual(after,before);
  }
});

test('selection prefers eligible last success, and never uses a removed or unknown candidate',async()=>{
  const {selectModel}=await import('../server/ai/catalog.ts');
  assert.equal(selectModel(['first','previous'],'previous'),'previous');
  assert.equal(selectModel(['first','previous'],'missing'),'first');
  assert.equal(selectModel([],'previous'),null);
});

test('jobs freeze the selected model and only a fenced saved result changes last success',async t=>{
  const env=configured();let ids=[model],valid=true;
  t.mock.method(globalThis,'fetch',async(url)=>String(url).endsWith('/models')?directory(ids):Response.json({choices:[{message:{content:valid?JSON.stringify({tags:['咖啡'],caption:'一杯咖啡'}):null}}]}));
  await request(env,'/ai/models/refresh','POST',{});
  const bytes=readFileSync(new URL('../public/photos/1060.jpg',import.meta.url));
  await request(env,'/uploads','POST',{id:'model-test',name:'Coffee.jpg',mime:'image/jpeg',size:bytes.length,purpose:'original'});
  await handleApi(new Request('https://moment.test/api/uploads/model-test/body',{method:'PUT',body:bytes}),env,owner);
  await request(env,'/uploads/model-test/complete','POST',{});
  await request(env,'/photos/coffee','PUT',{id:'coffee',name:'Coffee',src:'/api/files/model-test',kind:'photo'});
  const created=await (await request(env,'/jobs','POST',{kind:'analyze',photoIds:['coffee']})).json();assert.equal(created.jobs.length,1);
  ids=[];await request(env,'/ai/models/refresh','POST',{});
  assert.equal((await (await request(env,'/ai/models')).json()).selectedModelId,null);
  const run=await handleApi(new Request('https://moment.test/api/internal/jobs/run',{method:'POST',headers:{'x-moment-executor-key':'test-runner'}}),env,null);assert.equal(run.status,200);assert.equal((await run.json()).processed,1);
  const row=env.sql.prepare('SELECT * FROM jobs').get();assert.equal(row.model_id,model);assert.equal(row.state,'succeeded');
  let status=await (await request(env,'/ai/models')).json();assert.equal(status.lastSuccessfulModelId,model);assert.equal(status.selectedModelId,null);
  ids=[model];await request(env,'/ai/models/refresh','POST',{});status=await (await request(env,'/ai/models')).json();assert.equal(status.selectionReason,'last-success');
  // Invalid output on another original must not advance lastSuccessAt.
  await request(env,'/photos/second','PUT',{id:'second',name:'Second',src:'/api/files/model-test',kind:'photo'});
  await request(env,'/jobs','POST',{kind:'analyze',photoIds:['second']});valid=false;
  await handleApi(new Request('https://moment.test/api/internal/jobs/run',{method:'POST',headers:{'x-moment-executor-key':'test-runner'}}),env,null);
  assert.equal((await (await request(env,'/ai/models')).json()).lastSuccessAt,status.lastSuccessAt);
});

test('an empty compatible catalog rejects new work instead of queueing an unavailable model',async t=>{
  const env=configured();t.mock.method(globalThis,'fetch',async()=>directory([]));
  await request(env,'/ai/models/refresh','POST',{});
  await request(env,'/photos/coffee','PUT',{id:'coffee',name:'Coffee',src:'/photos/1060.jpg'});
  const response=await request(env,'/jobs','POST',{kind:'analyze',photoIds:['coffee']});assert.equal(response.status,503);assert.equal(env.sql.prepare('SELECT count(*) AS n FROM jobs').get().n,0);
});
test('the migration remembers a prior hosted success, excluding newer failed tasks',()=>{
  const sql=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>/^000[0-3]_.*\.sql$/.test(name)).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  sql.exec("INSERT INTO library_owner (id,user_id) VALUES (1,'owner-a')");
  const insert=sql.prepare('INSERT INTO jobs (id,owner_id,work_key,kind,photo_id,input,model_id,state,next_run_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  insert.run('good','owner-a','a','analyze','coffee','{}',model,'succeeded',0,0,1793692701020);
  insert.run('bad','owner-a','b','analyze','other','{}','unavailable','failed',0,0,1793692801020);
  sql.exec(readFileSync(new URL('../drizzle/0004_dazzling_pride.sql',import.meta.url),'utf8'));
  const saved=JSON.parse(sql.prepare('SELECT ai_state FROM library_owner').get().ai_state);
  assert.equal(saved.lastSuccessfulModelId,model);assert.equal(saved.lastSuccessAt,'2026-11-03T07:58:21.020Z');
});
