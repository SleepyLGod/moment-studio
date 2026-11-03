import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {photoMime} from '../src/services/photo-format.js';
import {canChoosePhoto} from '../src/services/import-photo.js';
import {photoSrc,originalDisplaySrc} from '../src/data.js';

test('real still HEICs and JPEG are detected by bytes; incomplete/generic/sequence boxes are rejected',()=>{
  for(const name of ['iphone-exifr.heic','exifreader-test.heic'])assert.equal(photoMime(new Uint8Array(readFileSync(new URL('./fixtures/import/'+name,import.meta.url))).subarray(0,512)),'image/heic');
  assert.equal(photoMime(new Uint8Array(readFileSync(new URL('./fixtures/import/portrait-orientation-6.jpg',import.meta.url)))),'image/jpeg');
  for(const value of [new Uint8Array(),new TextEncoder().encode('ftypheic'),new TextEncoder().encode('<html>photo</html>')])assert.equal(photoMime(value),null);
  const bytes=new Uint8Array(32);new DataView(bytes.buffer).setUint32(0,32);bytes.set(new TextEncoder().encode('ftypmif1'),4);
  assert.equal(photoMime(bytes),null);bytes.set(new TextEncoder().encode('heic'),16);assert.equal(photoMime(bytes),'image/heic');
  bytes.set(new TextEncoder().encode('hevc'),8);assert.equal(photoMime(bytes),null);
  new DataView(bytes.buffer).setUint32(0,400);assert.equal(photoMime(bytes),null);
});
test('HEIC selection accepts empty browser MIME while display uses upright preview and download keeps original',()=>{
  assert.equal(canChoosePhoto({name:'IMG.HEIC',type:'',size:123}),true);
  assert.equal(canChoosePhoto({name:'IMG.HEIC',type:'image/heic',size:12*1024*1024+1}),false);
  const photo={originalMime:'image/heic',src:'/api/files/original',thumbnailSrc:'/api/files/preview'};
  assert.equal(originalDisplaySrc(photo),'/api/files/preview');assert.equal(photoSrc(photo),'/api/files/preview');
  assert.equal(photoSrc({...photo,renderedSrc:'/api/files/edit'}),'/api/files/edit');assert.equal(photo.src,'/api/files/original');
});
