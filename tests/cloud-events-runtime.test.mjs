import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {Miniflare} from 'miniflare';

test('the real Workers runtime verifies a signed callback without following redirects',async()=>{
 const root=fileURLToPath(new URL('../server/',import.meta.url));
 let calls=0;
 const outboundService=async request=>{
  assert.equal(new URL(request.url).origin,'https://chatgpt.com');
  if(new URL(request.url).pathname==='/redirect-callback')return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/never-follow'}});
  calls++;return Response.json({challenge:(await request.json()).challenge});
 };
 const entry=`import {handleEventMethod} from './cloud-events.ts';
 export default {async fetch(request){
  const DB={prepare(){return {bind(){return {first:async()=>null,run:async()=>({meta:{changes:1}})}}}}};
  try{return Response.json(await handleEventMethod({DB},'runtime-owner','events/subscribe',{name:'public_sample.queued',arguments:{},delivery:{mode:'webhook',url:'https://chatgpt.com'+new URL(request.url).pathname,secret:'whsec_'+btoa('a'.repeat(32))}}));}
  catch(error){return Response.json({reason:error.reason||error.message},{status:400});}
 }};`;
 const modules=[{type:'ESModule',path:root+'runtime-entry.mjs',contents:entry},...['cloud-events.ts','http.ts','image-integrity.ts'].map(name=>({type:'ESModule',path:root+name,contents:stripTypeScriptTypes(readFileSync(root+name,'utf8'))}))];
 const worker=new Miniflare({modulesRoot:root,modules,compatibilityDate:'2026-05-15',outboundService});
 try{
  const response=await worker.dispatchFetch('https://runtime.test/runtime-callback');const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.match(result.id,/^moment-/);assert.equal(calls,1);
  const redirect=await worker.dispatchFetch('https://runtime.test/redirect-callback');assert.equal(redirect.status,400);assert.equal((await redirect.json()).reason,'http_302');
 }finally{await worker.dispose();}
});
