import test from 'node:test';
import assert from 'node:assert/strict';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
const owner={userId:'owner',email:'owner@test'};
async function call(env,path,method='GET',data,user=owner){return handleApi(new Request('https://moment.test/api'+path,{method,headers:{'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env,user);}
test('trash is reversible, owner-scoped, hides active reads and preserves albums/files',async()=>{
 const env=environment();await call(env,'/photos/p','PUT',{id:'p',name:'Public coffee',src:'/photos/1060.jpg',category:'日常',kind:'photo',date:'2026-11-03'});await call(env,'/albums/a','PUT',{id:'a',title:'Manual',note:'',photoIds:['p']});const album=env.sql.prepare('SELECT * FROM albums').get();
 assert.equal((await call(env,'/photos/trash','POST',{ids:['p']},null)).status,401);
 assert.equal((await call(env,'/photos/trash','POST',{ids:['p']},{userId:'other',email:'x@test'})).status,403);
 const result=await call(env,'/photos/trash','POST',{ids:['p']});assert.equal(result.status,200,await result.clone().text());
 assert.equal((await (await call(env,'/photos')).json()).total,0);assert.equal((await call(env,'/photos/p')).status,404);assert.deepEqual((await (await call(env,'/photos/resolve','POST',{ids:['p']})).json()).items,[]);
 assert.equal((await (await call(env,'/photos/months')).json()).months.length,0);assert.equal((await (await call(env,'/groups')).json()).groups.length,0);
 assert.equal((await (await call(env,'/photos?trash=true')).json()).items[0].id,'p');assert.deepEqual(env.sql.prepare('SELECT * FROM albums').get(),album);
 assert.equal((await call(env,'/photos/p','PUT',{id:'p',name:'stale',src:'/photos/1060.jpg'})).status,409);
 assert.equal((await call(env,'/photos/restore','POST',{ids:['p']})).status,200);assert.equal((await (await call(env,'/photos')).json()).total,1);assert.deepEqual(env.sql.prepare('SELECT * FROM albums').get(),album);
 assert.equal((await call(env,'/photos/restore','POST',{ids:['p']})).status,200);
});
test('trash cancels pending jobs and rejects a mixed missing batch without partial changes',async()=>{
 const env=environment();await call(env,'/photos/p','PUT',{id:'p',name:'Coffee',src:'/photos/1060.jpg'});
 env.sql.prepare("INSERT INTO jobs(id,owner_id,work_key,kind,photo_id,input,model_id,state,next_run_at,created_at,updated_at) VALUES ('j','owner','key','edit','p','{}','model','running',0,0,0)").run();
 assert.equal((await call(env,'/photos/trash','POST',{ids:['p','missing']})).status,404);assert.equal((await (await call(env,'/photos')).json()).total,1);
 await call(env,'/photos/trash','POST',{ids:['p']});assert.equal(env.sql.prepare('SELECT state FROM jobs').get().state,'cancelled');
});
