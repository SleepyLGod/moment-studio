/** A single own-account Cron Worker wakes the existing Sites task runner. */
const SITE_ORIGIN='https://moment-studio-sleepylgod-demo.von-lu-cuhk.chatgpt.site';
function configured(env){return typeof env.MOMENT_EXECUTOR_KEY==='string'&&env.MOMENT_EXECUTOR_KEY.length>0&&typeof env.MOMENT_SITE_ACCESS_TOKEN==='string'&&env.MOMENT_SITE_ACCESS_TOKEN.length>0;}
async function wake(env){
  if(!configured(env))throw new Error('Executor is not configured.');
  // This platform token must only be sent to its originating Site.
  const response=await fetch(SITE_ORIGIN+'/api/internal/jobs/run',{method:'POST',headers:{'content-type':'application/json','OAI-Sites-Authorization':'Bearer '+env.MOMENT_SITE_ACCESS_TOKEN,'x-moment-executor-key':env.MOMENT_EXECUTOR_KEY},body:'{}',signal:AbortSignal.timeout(40000),redirect:'error'});
  if(!response.ok)throw new Error('Site task runner returned HTTP '+response.status);
  const result=await response.json();
  if(!Number.isSafeInteger(result.processed)||result.processed<0||result.processed>1)throw new Error('Site returned an invalid task result.');
  return {processed:result.processed,...(result.failed?{failed:result.failed}:{})};
}
export default {
  async scheduled(event,env){
    const result=await wake(env);
    console.log(JSON.stringify({trigger:'scheduled',scheduledTime:event.scheduledTime,cron:event.cron,...result}));
  },
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname!=='/run'||request.method!=='POST')return new Response('Not found',{status:404});
    if(!configured(env))return Response.json({error:'Executor is not configured.'},{status:503});
    if(request.headers.get('authorization')!=='Bearer '+env.MOMENT_EXECUTOR_KEY)return Response.json({error:'Executor authorization required.'},{status:401});
    try{return Response.json(await wake(env));}
    catch{return Response.json({error:'The Site runner did not confirm completion.'},{status:503});}
  },
};
