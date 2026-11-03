import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
const owner={userId:'owner-a',email:'owner@test'};
const jpeg=new Uint8Array(readFileSync(new URL('../public/photos/1060.jpg',import.meta.url)));
function api(env,path,method='GET',data,user=owner,headers={}){return handleApi(new Request('https://moment.test/api'+path,{method,headers:{...(data instanceof Uint8Array?{'content-type':'image/jpeg'}:data?{'content-type':'application/json'}:{}),...headers},...(data===undefined?{}:{body:data instanceof Uint8Array?data:JSON.stringify(data)})}),env,user);}
async function setup(){const env=environment();env.MOMENT_EXECUTOR_KEY='test-key';env.MOMENT_BACKGROUND_ENABLED='true';env.MOMENT_IMAGE_EDIT_ENABLED='true';await api(env,'/photos/coffee','PUT',{id:'coffee',name:'Coffee',src:'/photos/1060.jpg',kind:'photo',category:'日常'});env.ASSETS={fetch:async()=>new Response(jpeg,{headers:{'content-type':'image/jpeg'}})};return env;}
const recipe={name:'Paper',prompt:'Make layered paper',preserve:true,reference:null};
const command={kind:'edit',photoIds:['coffee'],recipe,requestId:'same-request'};
const runner={'x-moment-executor-key':'test-key'};

test('image edits are owner-only, idempotent per request and preserve originals/manual albums',async()=>{
 const env=await setup();await api(env,'/albums/mine','PUT',{id:'mine',title:'Mine',note:'',photoIds:['coffee']});const albums=env.sql.prepare('SELECT * FROM albums').all(),before=env.sql.prepare('SELECT * FROM photos').all();
 assert.equal((await api(env,'/jobs','POST',command,null)).status,401);
 assert.equal((await api(env,'/jobs','POST',command,{userId:'other',email:'other@test'})).status,403);
 const response=await api(env,'/jobs','POST',command);assert.equal(response.status,202,await response.clone().text());const job=(await response.json()).jobs[0];
 assert.equal(job.kind,'edit');assert.equal((await (await api(env,'/jobs','POST',command)).json()).jobs[0].id,job.id);
 assert.equal((await api(env,'/jobs','POST',{...command,recipe:{...recipe,prompt:'Changed'}})).status,409);
 assert.deepEqual(env.sql.prepare('SELECT * FROM photos').all(),before);assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),albums);
 const claim=await api(env,'/internal/jobs/run','POST',{},null,runner);assert.equal(claim.status,200,await claim.clone().text());const task=(await claim.json()).editTask;
 assert.equal(task.jobId,job.id);assert.equal(task.images[0].mime,'image/jpeg');assert.equal((await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask,undefined);
 const path='/internal/jobs/'+job.id+'/result';
 assert.equal((await api(env,path,'POST',new Uint8Array([255,216,255]),null,{...runner,'x-job-lease':task.leaseToken})).status,400,'truncated image headers are not valid results');
 assert.equal((await api(env,path,'POST',jpeg,null,{...runner,'x-job-lease':'wrong'})).status,409);
 const completed=await api(env,path,'POST',jpeg,null,{...runner,'x-job-lease':task.leaseToken});assert.equal(completed.status,200,await completed.clone().text());
 assert.equal((await api(env,path,'POST',jpeg,null,{...runner,'x-job-lease':task.leaseToken})).status,200);
 const stored=env.sql.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);assert.equal(stored.state,'succeeded');const result=JSON.parse(stored.result);
 const derivative=(await (await api(env,'/photos/'+result.photoId)).json()).item;assert.equal(derivative.parentPhotoId,'coffee');assert.equal(derivative.src,'/photos/1060.jpg');assert.equal(derivative.kind,'generation');assert.equal(derivative.generationSource,'cloudflare-ai');
 assert.equal(env.sql.prepare('SELECT count(*) AS n FROM files').get().n,1,'the small generation is its own preview');
 assert.deepEqual(env.sql.prepare('SELECT * FROM photos WHERE id=?').all('coffee'),before);assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),albums);
 assert.equal((await api(env,result.src.replace('/api',''),'GET',undefined,null)).status,401);
});
test('expired image executions become unknown rather than invoking a second generation',async()=>{
 const env=await setup(),job=(await (await api(env,'/jobs','POST',command)).json()).jobs[0];
 const task=(await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask;
 env.sql.prepare('UPDATE jobs SET lease_until=0 WHERE id=?').run(job.id);
 assert.equal((await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask,undefined);
 assert.equal(env.sql.prepare('SELECT state FROM jobs WHERE id=?').get(job.id).state,'unknown');
 assert.equal((await api(env,'/internal/jobs/'+job.id+'/result','POST',jpeg,null,{...runner,'x-job-lease':task.leaseToken})).status,409);
});
test('free-only editing must be explicitly enabled and validates commands before queueing',async()=>{
 const env=await setup();env.MOMENT_IMAGE_EDIT_ENABLED='false';assert.equal((await api(env,'/jobs','POST',command)).status,503);
 env.MOMENT_IMAGE_EDIT_ENABLED='true';
 for(const data of [{...command,requestId:''},{...command,photoIds:['coffee','coffee']},{...command,recipe:{...recipe,prompt:''}}])assert.equal((await api(env,'/jobs','POST',data)).status,400);
 assert.equal(env.sql.prepare('SELECT count(*) AS n FROM jobs').get().n,0);
});
test('references from another owner never reach the executor',async()=>{
 const env=await setup();env.sql.prepare("INSERT INTO files(id,owner_id,name,mime,size,object_key,purpose,status,created_at) VALUES ('foreign','other','ref','image/jpeg',10,'other/key','reference','ready',0)").run();
 const job=(await (await api(env,'/jobs','POST',{...command,recipe:{...recipe,reference:{src:'/api/files/foreign',name:'ref'}}})).json()).jobs[0];
 assert.equal((await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask,undefined);
 assert.equal(env.sql.prepare('SELECT error_code FROM jobs WHERE id=?').get(job.id).error_code,'INPUT_UNAVAILABLE');
 assert.equal(env.objects.size,0);
});
test('quota failures and ambiguous results persist without modifying the source or retrying inference',async()=>{
 for(const errorCode of ['FREE_QUOTA_EXCEEDED','RESULT_UNKNOWN']){
  const env=await setup(),job=(await (await api(env,'/jobs','POST',command)).json()).jobs[0],task=(await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask;
  const result=await api(env,'/internal/jobs/'+job.id+'/result','POST',{errorCode},null,{...runner,'x-job-lease':task.leaseToken});assert.equal(result.status,200);
  assert.equal(env.sql.prepare('SELECT state FROM jobs WHERE id=?').get(job.id).state,errorCode==='RESULT_UNKNOWN'?'unknown':'failed');
  assert.equal((await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask,undefined);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM photos').get().n,1);assert.equal(env.objects.size,0);
 }
});

test('a lease that expires during object storage cannot publish a completed edit',async()=>{
 const env=await setup(),job=(await (await api(env,'/jobs','POST',command)).json()).jobs[0],task=(await (await api(env,'/internal/jobs/run','POST',{},null,runner)).json()).editTask;
 const realNow=Date.now, start=realNow();env.sql.prepare('UPDATE jobs SET lease_until=? WHERE id=?').run(start+1000,job.id);
 const put=env.BUCKET.put;env.BUCKET.put=async(...args)=>{const value=await put(...args);Date.now=()=>start+2000;return value;};
 try{assert.equal((await api(env,'/internal/jobs/'+job.id+'/result','POST',jpeg,null,{...runner,'x-job-lease':task.leaseToken})).status,409);assert.equal(env.sql.prepare('SELECT count(*) AS n FROM photos').get().n,1);}finally{Date.now=realNow;}
});
