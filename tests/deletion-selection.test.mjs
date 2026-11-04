import assert from 'node:assert/strict';
import test from 'node:test';
import {deleteReviewedPhotos,reviewDeletion} from '../src/services/deletion.js';

const photo = id => ({id,name:id});
const impact = (id, links=[]) => ({id,links,token:'review-'+id,filesToDelete:1});
const album = {kind:'album',id:'a1',name:'Holiday'};

test('batch purges only reviewed eligible photos and keeps per-photo reasons', async ()=>{
  const calls = [];
  const client = {
    async deletionImpact(id) {
      if (id === 'unreachable') throw new Error('Review failed');
      return impact(id,id === 'linked'?[album]:[]);
    },
    async purgePhoto(id,token) {
      calls.push([id,token]);
      return {id,deleted:true};
    },
  };
  const selected = ['free','linked','unreachable','also-free'].map(photo);
  const result = await deleteReviewedPhotos(client,await reviewDeletion(client,selected));
  assert.deepEqual(calls,[['free','review-free'],['also-free','review-also-free']]);
  assert.deepEqual(result.removed,['free','also-free']);
  assert.deepEqual(result.kept.map(row=>row.photo.id),['linked','unreachable']);
  assert.deepEqual(result.kept[0].impact.links,[album]);
  assert.equal(result.kept[1].problem,'Review failed');
});

test('batch continues after a stale impact and reconciles an uncertain successful deletion', async ()=>{
  const attempted = new Set();
  const client = {
    async deletionImpact(id) {
      if (id === 'lost-response' && attempted.has(id)) return {id,deleted:true};
      return impact(id,id === 'changed' && attempted.has(id)?[album]:[]);
    },
    async purgePhoto(id) {
      attempted.add(id);
      if (id === 'changed') throw new Error('The impact changed. Review it again.');
      if (id === 'lost-response') throw new Error('Connection lost');
      return {id,deleted:true};
    },
  };
  const reviews = await reviewDeletion(client,['changed','lost-response','next'].map(photo));
  const result = await deleteReviewedPhotos(client,reviews);
  assert.deepEqual([...attempted],['changed','lost-response','next']);
  assert.deepEqual(result.removed,['lost-response','next']);
  assert.equal(result.kept[0].problem,'The impact changed. Review it again.');
  assert.deepEqual(result.kept[0].impact.links,[album]);
});
