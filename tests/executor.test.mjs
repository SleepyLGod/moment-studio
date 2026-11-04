import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../executor/worker.mjs';
import {readFileSync} from 'node:fs';
const siteOrigin='https://moment.example.chatgpt.site';
const env={MOMENT_SITE_ORIGIN:siteOrigin,MOMENT_EXECUTOR_KEY:'test-executor-key',MOMENT_SITE_ACCESS_TOKEN:'test-platform-token'};
test('image execution uses the fixed model once and retries only result delivery',async t=>{
  const jpeg=readFileSync(new URL('../public/photos/1060.jpg',import.meta.url));let inference=0,delivery=0;
  const imageEnv={...env,AI:{run:async(model,payload)=>{inference++;assert.equal(model,'@cf/black-forest-labs/flux-2-klein-4b');assert.ok(payload.multipart.body);const form=await new Response(payload.multipart.body,{headers:{'content-type':payload.multipart.contentType}}).formData();assert.equal(form.get('width'),'1440');assert.equal(form.get('height'),'1120');return {image:jpeg.toString('base64')};}}};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.ok(url.startsWith(siteOrigin+'/api/internal/jobs/'));assert.equal(options.redirect,'manual');
    if(url.endsWith('/run'))return Response.json({processed:0,editTask:{jobId:'job-1',leaseToken:'lease-1',model:'@cf/black-forest-labs/flux-2-klein-4b',prompt:'Paper',images:[{mime:'image/jpeg',base64:jpeg.toString('base64')}],width:1440,height:1120,seed:42}});
    delivery++;assert.equal(options.headers['x-job-lease'],'lease-1');assert.deepEqual(new Uint8Array(options.body),new Uint8Array(jpeg));
    return delivery===1?new Response('{}',{status:503}):Response.json({processed:1,result:{photoId:'output'}});
  });
  const result=await worker.fetch(new Request('https://executor.test/run',{method:'POST',headers:{authorization:'Bearer '+env.MOMENT_EXECUTOR_KEY}}),imageEnv);
  assert.equal(result.status,200);assert.equal((await result.json()).processed,1);assert.equal(inference,1);assert.equal(delivery,2);
});
test('executor manual invocation is protected and forwards credentials only to the fixed Site',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(url,siteOrigin+'/api/internal/jobs/run');assert.equal(options.headers['x-moment-executor-key'],env.MOMENT_EXECUTOR_KEY);assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer '+env.MOMENT_SITE_ACCESS_TOKEN);return Response.json({processed:1});});
  assert.equal((await worker.fetch(new Request('https://executor.test/run',{method:'POST'}),env)).status,401);assert.equal(calls,0);
  const result=await worker.fetch(new Request('https://executor.test/run',{method:'POST',headers:{authorization:'Bearer '+env.MOMENT_EXECUTOR_KEY}}),env);
  assert.equal(result.status,200);assert.equal((await result.json()).processed,1);assert.equal(calls,1);
});
test('scheduled execution is awaited, and failures propagate rather than appearing successful',async t=>{
  let done=false;const mock=t.mock.method(globalThis,'fetch',async()=>{await Promise.resolve();done=true;return Response.json({processed:0});});
  await worker.scheduled({scheduledTime:123,cron:'* * * * *'},env);assert.equal(done,true);
  mock.mock.mockImplementation(async()=>new Response('{}',{status:503}));
  await assert.rejects(worker.scheduled({scheduledTime:124,cron:'* * * * *'},env),/503/);
});
test('missing deployment secrets fail closed without contacting any upstream',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{assert.fail('No network request without credentials');});
  await assert.rejects(worker.scheduled({scheduledTime:123,cron:'* * * * *'},{}),/not configured/);
  assert.equal((await worker.fetch(new Request('https://executor.test/run',{method:'POST',headers:{authorization:'Bearer undefined'}}),{})).status,503);
});
test('Workers-compatible manual redirects are rejected without following a new origin',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/'}});});
  await assert.rejects(worker.scheduled({scheduledTime:125,cron:'* * * * *'},env),/302/);
  assert.equal(calls,1);
});
test('invalid configured origins never receive the Site credentials',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{assert.fail('No network request to an invalid origin');});
  for(const origin of [undefined,'http://moment.example.chatgpt.site','https://untrusted.invalid',
    siteOrigin+'/api','https://other.invalid@moment.example.chatgpt.site',siteOrigin+':8443']){
    await assert.rejects(worker.scheduled({scheduledTime:126,cron:'* * * * *'},
      {...env,MOMENT_SITE_ORIGIN:origin}),/MOMENT_SITE_ORIGIN/);
  }
});
