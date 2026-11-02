import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
import {createCloudLibrary} from '../src/services/cloud.js';
import {SEED_PHOTOS} from '../src/data.js';
import {makeSampleDerivative,LAB_RECIPES} from '../src/recipes.js';

const owner={userId:'owner-a',email:'owner@example.test'};
const jpg=readFileSync(new URL('../public/photos/1060.jpg',import.meta.url));
const jpegData='data:image/jpeg;base64,'+jpg.toString('base64');
function connect(t){
  const env=environment(),native=globalThis.fetch;let failAfter=null;
  globalThis.fetch=async(input,options={})=>{
    if(String(input).startsWith('/api/')){
      const response=await handleApi(new Request('https://moment.test'+input,options),env,owner);
      if(failAfter?.(input,options,response)){failAfter=null;throw new TypeError('Response lost after commit');}return response;
    }
    if(String(input).startsWith('/styles/'))return new Response(readFileSync(new URL('../public'+input,import.meta.url)),{headers:{'content-type':'image/png'}});
    return native(input,options);
  };
  t.after(()=>{globalThis.fetch=native;});
  return {env,client:createCloudLibrary(),loseReply:predicate=>{failAfter=predicate;}};
}
test('a saved sample can receive a JPEG tone and retain its original generated PNG',async t=>{
  const {client}=connect(t);await client.load();
  const generated=makeSampleDerivative(SEED_PHOTOS[0],LAB_RECIPES[0],crypto.randomUUID(),'2026-11-03');
  const saved=await client.savePhoto(generated);
  const toned=await client.savePhoto({...saved,renderedSrc:jpegData,style:'film'});
  assert.equal(toned.style,'film');assert.equal(toned.generationSrc,saved.generationSrc);assert.notEqual(toned.renderedSrc,saved.renderedSrc);
});
test('an observed stale object cannot borrow a newer revision from an unrelated read',async t=>{
  const {client}=connect(t),initial=await client.load(),stale=initial.photos[0];
  const other=createCloudLibrary();await other.load();await other.savePhoto({...stale,name:'Changed elsewhere'});
  const latest=await client.photo(stale.id);assert.equal(latest.name,'Changed elsewhere');
  await assert.rejects(client.savePhoto({...stale,category:'旅行'}),/changed|Reload/);
  const saved=await client.savePhoto({...latest,category:'旅行'});assert.equal(saved.name,'Changed elsewhere');
});
test('category queries and example/cover resolution work beyond the first 50 photos',async t=>{
  const {client}=connect(t);await client.load();
  for(let i=0;i<51;i++)await client.savePhoto({id:'new-'+i,name:'New '+i,src:'/photos/1060.jpg',kind:'photo',category:'城市'});
  const reader=createCloudLibrary(),loaded=await reader.load();
  for(const id of ['1015','1067','1060','1043','1011'])assert.ok(loaded.photos.some(p=>p.id===id),'required example '+id);
  const older=await reader.photo('1015');await reader.savePhoto({...older,name:'Renamed older photo'});assert.equal(reader.count(),63);
  const natural=await reader.filter('自然');assert.ok(natural.length>0);assert.ok(natural.every(p=>p.category==='自然'));
});
test('a lost Style save reply can be retried with the entire original pending payload',async t=>{
  const {client,loseReply}=connect(t);await client.load();
  const {prepareStyleSave}=await import('../src/services/operations.js');
  const pending=prepareStyleSave({prompt:'Paper sculpture',preserve:true},'My style',null,null);
  loseReply((path,options,response)=>path.startsWith('/api/styles/')&&options.method==='PUT'&&response.ok);
  await assert.rejects(client.saveStyle(pending),/Response lost/);
  const retry=prepareStyleSave({prompt:'Paper sculpture',preserve:true},'My style',null,pending);
  assert.equal(retry.createdAt,pending.createdAt);assert.equal(retry.id,pending.id);
  const saved=await client.saveStyle(retry);assert.equal(saved.id,pending.id);
});
test('an interrupted sample batch retries the same records without duplicates',async t=>{
  const {client,loseReply}=connect(t);await client.load();
  const {prepareSampleBatch}=await import('../src/services/operations.js');const batch=prepareSampleBatch(null);
  let committed=0;loseReply((path,options,response)=>path.startsWith('/api/photos/')&&options.method==='PUT'&&response.ok&&++committed===2);
  await assert.rejects((async()=>{for(const photo of batch)await client.savePhoto(photo);})(),/Response lost/);
  const retry=prepareSampleBatch(batch);assert.deepEqual(retry.map(p=>p.id),batch.map(p=>p.id));
  for(const photo of retry)await client.savePhoto(photo);
  const state=await client.load(false);assert.equal(state.photos.filter(p=>p.id.startsWith('sample-')).length,4);
});
test('collage provenance contains only the ordered photos used by the chosen layout',async t=>{
  const {client}=connect(t);await client.load();
  const {collageInputs}=await import('../src/services/operations.js');const selected=SEED_PHOTOS.slice(0,9),used=collageInputs(selected,'editorial',5);
  assert.deepEqual(used.map(p=>p.id),selected.slice(5,8).map(p=>p.id));
  const saved=await client.savePhoto({id:crypto.randomUUID(),name:'A collage',src:jpegData,kind:'collage',sourcePhotoIds:used.map(p=>p.id)});
  assert.deepEqual((await client.photo(saved.id)).sourcePhotoIds,used.map(p=>p.id));
});
