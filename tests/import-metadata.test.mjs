import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('real iPhone HEIC capture time remains unzoned and GPS is excluded',async()=>{
  const {captureMetadata}=await import('../src/services/import-metadata.js');
  const data=await captureMetadata(readFileSync(new URL('./fixtures/import/iphone-exifr.heic',import.meta.url)),Date.parse('2026-11-03T12:00:00Z'));
  assert.equal(data.capturedLocal,'2019-08-21T10:57:23');assert.equal(data.dateSource,'captured-local');assert.equal(data.date,'2019-08-21');assert.equal(data.capturedAt,undefined);
  assert.equal(data.width,4032);assert.equal(data.height,3024);assert.equal(data.orientation,1);
  assert.ok(Object.keys(data).every(key=>!key.toLowerCase().includes('gps')));
});
test('missing capture date uses file date and preserves the real orientation',async()=>{
  const {captureMetadata}=await import('../src/services/import-metadata.js');
  const data=await captureMetadata(readFileSync(new URL('./fixtures/import/portrait-orientation-6.jpg',import.meta.url)),Date.parse('2026-11-03T18:00:00Z'));
  assert.equal(data.orientation,6);assert.equal(data.date,'2026-11-04');assert.equal(data.dateSource,'file-modified');assert.equal(data.capturedLocal,undefined);
});
test('EXIF offsets are validated, malformed time does not become capture success',async()=>{
  const {captureFields}=await import('../src/services/import-metadata.js');
  const modified=Date.parse('2026-11-03T12:00:00Z');
  const zoned=captureFields({DateTimeOriginal:'2019:08:21 23:57:23',OffsetTimeOriginal:'-07:00'},modified);
  assert.equal(zoned.capturedAt,'2019-08-21T23:57:23-07:00');assert.equal(zoned.date,'2019-08-22');assert.equal(zoned.dateSource,'captured');
  const unknown=captureFields({DateTimeOriginal:'2019:08:21 23:57:23',OffsetTimeOriginal:'+99:99'},modified);
  assert.equal(unknown.capturedAt,undefined);assert.equal(unknown.date,'2019-08-21');assert.equal(unknown.dateSource,'captured-local');
  for(const value of ['2019:02:30 12:00:00','2019:08:21 24:00:00','bad'])assert.equal(captureFields({DateTimeOriginal:value},modified).dateSource,'file-modified');
  assert.equal(captureFields({DateTimeDigitized:'2019:08:21 12:00:00'},modified).dateSource,'file-modified');
});
