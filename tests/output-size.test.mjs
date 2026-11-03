import test from 'node:test';import assert from 'node:assert/strict';
import {photoDimensions,validateOutputSize,fitOutputSize,editSignature} from '../src/services/output-size.js';
test('original dimensions use upright full resolution, never the small preview',()=>{
 assert.deepEqual(photoDimensions({width:4032,height:3024,orientation:6,previewWidth:576,previewHeight:768}),{width:3024,height:4032});
 assert.deepEqual(photoDimensions({uprightWidth:900,uprightHeight:700,width:700,height:900}),{width:900,height:700});
});
test('output requests stay explicit; unsupported originals cannot silently shrink or become square',()=>{
 assert.deepEqual(validateOutputSize({width:1440,height:1120}),{width:1440,height:1120});
 assert.throws(()=>validateOutputSize({width:4032,height:3024}),/2048/);assert.throws(()=>validateOutputSize({width:900,height:700}),/16/);
 assert.deepEqual(fitOutputSize({width:900,height:700},2048),{width:2016,height:1568});
 assert.notEqual(editSignature({prompt:'p',preserve:true},{mode:'custom',width:512,height:512}),editSignature({prompt:'p',preserve:true},{mode:'custom',width:1440,height:1120}));
});
