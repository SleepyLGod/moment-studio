import test from 'node:test';
import assert from 'node:assert/strict';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
import {timeline} from '../src/services/organization.js';

const owner={userId:'owner-a',email:'owner@example.test'};
const bytes=new Uint8Array(32);new DataView(bytes.buffer).setUint32(0,32);bytes.set(new TextEncoder().encode('ftypheic'),4);bytes.set(new TextEncoder().encode('mif1heic'),16);
function api(env,path,method='GET',data,user=owner){return handleApi(new Request('https://moment.test/api'+path,{method,...(data===undefined?{}:{headers:data instanceof Uint8Array?{}:{'content-type':'application/json'},body:data instanceof Uint8Array?data:JSON.stringify(data)})}),env,user);}

test('HEIC original upload is private and byte-exact; non-original HEIC and sequence containers are rejected',async()=>{
  const env=environment();
  const start={id:'heic-test',name:'sample.HEIC',mime:'image/heic',size:bytes.length,purpose:'original'};
  let r=await api(env,'/uploads','POST',start);assert.equal(r.status,200,await r.clone().text());
  assert.equal((await api(env,'/uploads/heic-test/complete','POST',{})).status,409);
  assert.equal((await api(env,'/uploads/heic-test/body','PUT',bytes)).status,200);
  assert.equal((await api(env,'/uploads/heic-test/complete','POST',{})).status,200);
  assert.equal((await api(env,'/photos/heic-test','PUT',{id:'heic-test',name:'sample',src:'/api/files/heic-test',originalMime:'image/heic',kind:'photo'})).status,400,'HEIC requires a web-compatible preview');
  r=await api(env,'/files/heic-test?download=1');assert.equal(r.headers.get('content-type'),'image/heic');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);
  assert.equal((await api(env,'/files/heic-test','GET',undefined,null)).status,401);
  assert.equal((await api(env,'/files/heic-test','GET',undefined,{userId:'other',email:'other@test'})).status,403);
  for(const purpose of ['preview','reference','rendered','generation'])assert.equal((await api(env,'/uploads','POST',{...start,id:purpose,purpose})).status,400);
  const sequence=bytes.slice();sequence.set(new TextEncoder().encode('hevc'),8);
  await api(env,'/uploads','POST',{...start,id:'sequence'});
  assert.equal((await api(env,'/uploads/sequence/body','PUT',sequence)).status,400);
  await api(env,'/uploads','POST',{...start,id:'spoof'});
  assert.equal((await api(env,'/uploads/spoof/body','PUT',new Uint8Array(bytes.length))).status,400);
});

test('capture-local dates keep their local calendar day through server save and unrelated edits',async()=>{
  const env=environment(),photo={id:'local-time',name:'iPhone sample',src:'/photos/1015.jpg',kind:'photo',capturedLocal:'2019-08-21T23:57:23',date:'2026-11-03',dateSource:'file-modified'};
  let response=await api(env,'/photos/local-time','PUT',photo);assert.equal(response.status,200);
  let saved=(await response.json()).item;assert.equal(saved.timelineDay,'2019-08-21');assert.equal(saved.dateSource,'captured-local');
  saved=(await (await api(env,'/photos/local-time','PUT',{...saved,category:'旅行'})).json()).item;
  assert.equal(saved.timelineDay,'2019-08-21');assert.equal(saved.dateSource,'captured-local');
  assert.equal(timeline({capturedLocal:'2019-02-30T23:57:23',date:'2026-11-03'}).source,'record-date');
  assert.equal(timeline({capturedLocal:'2019-08-21T25:57:23',date:'2026-11-03'}).source,'record-date');
  assert.equal(timeline({capturedAt:'2019-08-21T23:57:23-07:00'}).day,'2019-08-22');
});
