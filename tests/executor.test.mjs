import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../executor/worker.mjs';
const env={MOMENT_EXECUTOR_KEY:'test-executor-key',MOMENT_SITE_ACCESS_TOKEN:'test-platform-token'};
test('executor manual invocation is protected and forwards credentials only to the fixed Site',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(url,'https://moment-studio-sleepylgod-demo.von-lu-cuhk.chatgpt.site/api/internal/jobs/run');assert.equal(options.headers['x-moment-executor-key'],env.MOMENT_EXECUTOR_KEY);assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer '+env.MOMENT_SITE_ACCESS_TOKEN);return Response.json({processed:1});});
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
