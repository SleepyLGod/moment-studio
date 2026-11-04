import test from 'node:test';
import assert from 'node:assert/strict';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';

const owner = {userId:'owner',email:'owner@test'};
const src = id => '/api/files/'+id;
const key = id => 'owners/owner/'+id;
const request = (env,path,method='GET',data,user=owner) => handleApi(new Request('https://moment.test/api'+path,{
  method,headers:{'content-type':'application/json'},
  ...(data===undefined?{}:{body:JSON.stringify(data)}),
}),env,user);
const photo = (env,id,data={}) => request(env,'/photos/'+id,'PUT',{id,name:id,src:src(id),...data});
const trash = (env,id) => request(env,'/photos/trash','POST',{ids:[id]});
const impact = async (env,id) => {
  const response = await request(env,'/photos/'+id+'/purge');
  assert.equal(response.status,200,await response.clone().text());
  return response.json();
};
const purge = (env,id,review) => request(env,'/photos/'+id+'/purge','POST',{confirmed:true,token:review.token});

async function setup(...ids) {
  const env = environment();
  env.BUCKET.delete = async keys => {
    for (const object of Array.isArray(keys)?keys:[keys]) env.objects.delete(object);
  };
  for (const id of ids) {
    env.sql.prepare("INSERT INTO files VALUES (?,'owner',?,'image/jpeg',3,?,'original','ready',0)").run(id,id,key(id));
    await env.BUCKET.put(key(id),new Uint8Array([1,2,3]));
  }
  return env;
}

test('permanent deletion is owner-scoped and blocked by albums, generations and collages, including restorable children',async()=>{
  const env = await setup('p','render');
  assert.equal((await photo(env,'p')).status,200);
  assert.equal((await photo(env,'g',{src:src('p'),generationSrc:src('render'),parentPhotoId:'p',kind:'generation'})).status,200);
  assert.equal((await photo(env,'c',{src:'/photos/1060.jpg',sourcePhotoIds:['p'],kind:'collage'})).status,200);
  await request(env,'/albums/a','PUT',{id:'a',title:'Manual album',note:'',photoIds:['p']});
  assert.equal((await request(env,'/photos/p/purge')).status,404);
  await trash(env,'p');
  await trash(env,'g');
  assert.equal((await request(env,'/photos/p/purge','GET',undefined,null)).status,401);
  assert.equal((await request(env,'/photos/p/purge','GET',undefined,{userId:'other',email:'other@test'})).status,403);
  const review = await impact(env,'p');
  assert.deepEqual(review.links.map(({id,kind,trashed})=>[id,kind,trashed]),[['a','album',0],['c','collage',0],['g','generation',1]]);
  assert.equal((await purge(env,'p',review)).status,409);
  assert.deepEqual(env.sql.prepare("SELECT data FROM albums WHERE id='a'").get().data,JSON.stringify({id:'a',title:'Manual album',note:'',photoIds:['p']}));
  assert.ok(env.objects.has(key('p')));
});

test('purging a creation removes its exclusive result and preserves shared originals and previews',async()=>{
  const env = await setup('p','preview','render');
  await photo(env,'p',{thumbnailSrc:src('preview')});
  await photo(env,'g',{src:src('p'),thumbnailSrc:src('preview'),renderedSrc:src('render'),generationSrc:src('render'),parentPhotoId:'p',kind:'generation'});
  await trash(env,'g');
  const review = await impact(env,'g');
  assert.equal(review.filesToDelete,1);
  assert.equal(review.filesToKeep,2);
  assert.equal((await request(env,'/photos/g/purge','POST',{token:review.token})).status,400);
  const deleted = await purge(env,'g',review);
  assert.equal(deleted.status,200,await deleted.clone().text());
  assert.equal(env.objects.has(key('render')),false);
  assert.ok(env.objects.has(key('p')));
  assert.ok(env.objects.has(key('preview')));
  assert.equal((await request(env,'/files/render')).status,404);
  assert.equal((await request(env,'/photos?trash=true')).status,200);
  assert.deepEqual((await (await request(env,'/photos?trash=true')).json()).items,[]);
  assert.equal((await purge(env,'g',review)).status,200);
  assert.equal((await photo(env,'g',{src:src('p')})).status,409,'a stale client cannot recreate a purged photo');
});

test('a link created after review blocks the reservation before touching storage',async()=>{
  const env = await setup('p');
  await photo(env,'p');
  await trash(env,'p');
  const review = await impact(env,'p');
  const batch = env.DB.batch;
  env.DB.batch = async statements => {
    env.DB.batch = batch;
    env.sql.prepare("INSERT INTO albums VALUES ('late','owner',?,1,0,0)").run(JSON.stringify({title:'New album link',photoIds:['p']}));
    return batch(statements);
  };
  assert.equal((await purge(env,'p',review)).status,409);
  assert.equal((await impact(env,'p')).links[0].name,'New album link');
  assert.ok(env.objects.has(key('p')));
});

test('shared recipe covers remain available and an interrupted purge can be finished safely',async()=>{
  const env = await setup('p','cover','q');
  await photo(env,'p',{renderedSrc:src('cover')});
  await photo(env,'q');
  await request(env,'/styles/style','PUT',{id:'style',name:'Preset',prompt:'Draw it',cover:src('cover')});
  await trash(env,'p');
  await trash(env,'q');
  const review = await impact(env,'p');
  assert.equal(review.filesToKeep,1);
  const remove = env.BUCKET.delete;
  env.BUCKET.delete = async()=>{throw new Error('fixture storage temporarily unavailable');};
  assert.equal((await purge(env,'p',review)).status,503);
  assert.equal((await impact(env,'p')).pending,true);
  assert.equal((await request(env,'/photos/restore','POST',{ids:['p','q']})).status,409);
  assert.equal((await (await request(env,'/photos?trash=true')).json()).items.length,2,'a mixed restore is atomic');
  assert.equal((await request(env,'/uploads/p/complete','POST',{})).status,410);
  env.BUCKET.delete = remove;
  assert.equal((await purge(env,'p',await impact(env,'p'))).status,200);
  assert.equal(env.objects.has(key('p')),false);
  assert.equal((await request(env,'/files/cover')).status,200);
});

test('a stale file writer cannot recreate bytes after a purge',async()=>{
  const {putGalleryFile} = await import('../server/photo-purge.ts');
  const env = await setup('p');
  await photo(env,'p');
  await trash(env,'p');
  const review = await impact(env,'p');
  const put = env.BUCKET.put;
  env.BUCKET.put = async (...args)=>{
    env.BUCKET.put = put;
    assert.equal((await purge(env,'p',review)).status,200);
    return put(...args);
  };
  await assert.rejects(putGalleryFile(env,'owner','p',key('p'),new Uint8Array([1,2,3]),'image/jpeg'),{status:410});
  assert.equal(env.objects.has(key('p')),false);
});

test('a record write validated before a purge cannot add a dangling reference afterward',async()=>{
  const env = await setup('p');
  await photo(env,'p');
  const prepare = env.DB.prepare;
  env.DB.prepare = query => {
    const statement = prepare(query);
    if (!query.startsWith('INSERT OR IGNORE INTO albums')) return statement;
    return {bind:(...args)=>{
      const bound = statement.bind(...args);
      return {run:async()=>{
        env.DB.prepare = prepare;
        await trash(env,'p');
        assert.equal((await purge(env,'p',await impact(env,'p'))).status,200);
        return bound.run();
      }};
    }};
  };
  assert.equal((await request(env,'/albums/late','PUT',{id:'late',title:'Late link',note:'',photoIds:['p']})).status,409);
  assert.equal(env.sql.prepare("SELECT count(*) AS n FROM albums WHERE id='late'").get().n,0);
});
