import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';

const owner={userId:'owner-a',email:'owner@example.test'};
function request(env,path,method='GET',body,user=owner,headers={}){
  const options={method,headers:{...headers}};
  if(body!==undefined){options.body=body instanceof Uint8Array?body:JSON.stringify(body);if(!(body instanceof Uint8Array))options.headers['content-type']='application/json';}
  return handleApi(new Request('https://moment.test/api'+path,options),env,user);
}
const jpeg=new Uint8Array(readFileSync(new URL('../public/photos/1060.jpg',import.meta.url)));
async function file(env,id=crypto.randomUUID()){
  let r=await request(env,'/uploads','POST',{id,name:'coffee.jpg',mime:'image/jpeg',size:jpeg.length,purpose:'original'});assert.equal(r.status,200,await r.clone().text());
  r=await request(env,'/uploads/'+id+'/body','PUT',jpeg,{...owner},{'content-type':'image/jpeg'});assert.equal(r.status,200,await r.clone().text());
  r=await request(env,'/uploads/'+id+'/complete','POST',{});assert.equal(r.status,200,await r.clone().text());return (await r.json()).file;
}
test('anonymous access and forged browser identity headers cannot read or write',async()=>{
  const env=environment();for(const [path,method,body] of [['/photos','GET'],['/uploads','POST',{}],['/files/random','GET']])assert.equal((await request(env,path,method,body,null,{'oai-authenticated-user-id':'owner-a'})).status,401);
});
test('upload is private, incomplete uploads stay invisible, retries are idempotent and bytes survive reads',async()=>{
  const env=environment(),id=crypto.randomUUID();
  const start={id,name:'coffee.jpg',mime:'image/jpeg',size:jpeg.length,purpose:'original'};
  assert.equal((await request(env,'/uploads','POST',start)).status,200);
  assert.equal((await request(env,'/uploads/'+id+'/complete','POST',{})).status,409);
  assert.equal((await request(env,'/files/'+id)).status,404);
  assert.equal((await (await request(env,'/photos')).json()).items.length,0);
  const uploaded=await file(env,id);assert.equal(uploaded.src,'/api/files/'+id);
  const downloaded=await request(env,'/files/'+id+'?download=1');assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),jpeg);
  const photo={id:crypto.randomUUID(),name:'Coffee',src:uploaded.src,kind:'photo',category:'日常',date:'2026-11-02',style:'original'};
  for(let n=0;n<2;n++)assert.equal((await request(env,'/photos/'+photo.id,'PUT',photo)).status,200);
  assert.equal((await (await request(env,'/photos')).json()).items.length,1);
  assert.equal((await request(env,'/photos', 'GET',undefined,{userId:'other',email:'other@example.test'})).status,403);
  assert.equal((await request(env,'/files/'+id, 'GET',undefined,{userId:'other',email:'other@example.test'})).status,403);
});
test('rejects oversized, false type, wrong length, changed retry and cross-origin writes',async()=>{
  const env=environment(),id=crypto.randomUUID(),start={id,name:'x.jpg',mime:'image/jpeg',size:jpeg.length,purpose:'original'};
  assert.equal((await request(env,'/uploads','POST',{...start,size:12*1024*1024+1})).status,413);
  assert.equal((await request(env,'/uploads','POST',{...start,mime:'image/svg+xml'})).status,400);
  assert.equal((await request(env,'/uploads','POST',start,owner,{origin:'https://attacker.test'})).status,403);
  await request(env,'/uploads','POST',start);
  assert.equal((await request(env,'/uploads','POST',{...start,size:100})).status,409);
  assert.equal((await request(env,'/uploads/'+id+'/body','PUT',new Uint8Array(20))).status,400);
  const html=new TextEncoder().encode('<html>not a photo</html>');
  const bad=crypto.randomUUID();await request(env,'/uploads','POST',{...start,id:bad,size:html.length});
  assert.equal((await request(env,'/uploads/'+bad+'/body','PUT',html)).status,400);
});
test('albums, categories and styles persist as separate resources; originals cannot be replaced',async()=>{
  const env=environment(),uploaded=await file(env),id=crypto.randomUUID();
  const photo={id,name:'Coffee',src:uploaded.src,kind:'photo',category:'日常',style:'original'};
  let r=await request(env,'/photos/'+id,'PUT',photo);const saved=(await r.json()).item;
  r=await request(env,'/photos/'+id,'PUT',{...saved,category:'旅行'});assert.equal(r.status,200);
  assert.equal((await (await request(env,'/photos')).json()).items[0].category,'旅行');
  assert.equal((await request(env,'/photos/'+id,'PUT',{...saved,src:'/photos/1015.jpg'})).status,409);
  const album={id:crypto.randomUUID(),title:'Trip',note:'A note',photoIds:[id]};
  assert.equal((await request(env,'/albums/'+album.id,'PUT',album)).status,200);
  assert.deepEqual((await (await request(env,'/albums')).json()).items[0].photoIds,[id]);
  assert.equal((await request(env,'/albums/'+album.id,'PUT',{...album,photoIds:['unknown']})).status,400);
  const style={id:crypto.randomUUID(),name:'My style',prompt:'Paper sculpture',preserve:true,reference:{name:'Ref',src:uploaded.src}};
  assert.equal((await request(env,'/styles/'+style.id,'PUT',style)).status,200);
  assert.equal((await (await request(env,'/styles')).json()).items[0].prompt,style.prompt);
  assert.equal((await request(env,'/styles/'+crypto.randomUUID(),'PUT',{...style,id:crypto.randomUUID(),reference:{src:'data:image/png;base64,abc'}})).status,400);
});
test('pagination is stable, and foreign file references or colliding ids cannot expose another owner',async()=>{
  const env=environment();await request(env,'/me');
  for(let i=0;i<4;i++)await request(env,'/photos/p'+i,'PUT',{id:'p'+i,name:'Photo '+i,src:'/photos/1060.jpg',kind:'photo'});
  const first=await (await request(env,'/photos?limit=2')).json();assert.equal(first.items.length,2);assert.ok(first.nextCursor);
  const second=await (await request(env,'/photos?limit=2&cursor='+encodeURIComponent(first.nextCursor))).json();assert.equal(second.items.length,2);assert.equal(new Set([...first.items,...second.items].map(p=>p.id)).size,4);
  assert.equal((await request(env,'/photos/bad','PUT',{id:'bad',src:'/api/files/not-owned',name:'bad'})).status,400);
  assert.equal((await request(env,'/photos/bad','PUT',{id:'bad',src:'https://attacker.test/a.jpg',name:'bad'})).status,400);
});
test('storage errors are failures, not saved photos',async()=>{
  const env=environment(),id=crypto.randomUUID();await request(env,'/uploads','POST',{id,name:'coffee',mime:'image/jpeg',size:jpeg.length});
  env.BUCKET.put=async()=>{throw new Error('storage unavailable');};
  assert.equal((await request(env,'/uploads/'+id+'/body','PUT',jpeg)).status,503);
  assert.equal((await request(env,'/uploads/'+id+'/complete','POST',{})).status,409);
});
test('sample initialization is atomic and idempotent; stale writes cannot overwrite a newer edit',async()=>{
  const env=environment();
  for(let n=0;n<2;n++)assert.equal((await request(env,'/bootstrap','POST',{})).status,200);
  const list=await (await request(env,'/photos')).json();assert.equal(list.items.length,12);
  const original=list.items[0];
  const first=await request(env,'/photos/'+original.id,'PUT',{...original,name:'New title'});assert.equal(first.status,200);
  assert.equal((await request(env,'/photos/'+original.id,'PUT',{...original,name:'Stale title'})).status,409);
  const {revision,...withoutRevision}=original;
  assert.equal((await request(env,'/photos/'+original.id,'PUT',{...withoutRevision,name:'No revision'})).status,409);
  const style={id:crypto.randomUUID(),name:'Data',prompt:'A metadata: inspired print',preserve:true};
  assert.equal((await request(env,'/styles/'+style.id,'PUT',style)).status,200);
});
