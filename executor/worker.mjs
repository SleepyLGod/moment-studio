/** A single own-account Cron Worker wakes the existing Sites task runner. */
const SITE_ORIGIN='https://moment-studio-sleepylgod-demo.von-lu-cuhk.chatgpt.site';
const IMAGE_MODEL='@cf/black-forest-labs/flux-2-klein-4b';
function imageBytes(value){if(typeof value!=='string'||value.length>4*1024*1024)throw new Error('Invalid image bytes.');const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
async function edit(task,env){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(task.jobId)||typeof task.leaseToken!=='string'||task.leaseToken.length>100||task.model!==IMAGE_MODEL||typeof task.prompt!=='string'||task.prompt.length>1800||!Array.isArray(task.images)||task.images.length<1||task.images.length>2)throw new Error('Site returned an invalid image task.');
  let output,errorCode;
  try{
    if(!env.AI)throw new Error('Workers AI is not bound.');
    if(![task.width,task.height].every(n=>Number.isInteger(n)&&n>=256&&n<=2048&&n%16===0))throw new Error('Invalid output dimensions.');
    const form=new FormData();form.set('prompt',task.prompt);form.set('width',String(task.width));form.set('height',String(task.height));form.set('seed','42');
    task.images.forEach((image,index)=>{if(!['image/jpeg','image/png','image/webp'].includes(image.mime))throw new Error('Invalid input MIME.');form.set('input_image_'+index,new Blob([imageBytes(image.base64)],{type:image.mime}),'input-'+index);});
    const serialized=new Response(form),result=await env.AI.run(IMAGE_MODEL,{multipart:{body:serialized.body,contentType:serialized.headers.get('content-type')}});
    output=imageBytes(result.image);if(output.length<8)throw new Error('Empty image output.');
  }catch(error){errorCode=/neurons|free.*(quota|limit)|quota.*exceed/i.test(String(error?.message))?'FREE_QUOTA_EXCEEDED':'RESULT_UNKNOWN';}
  const headers={'OAI-Sites-Authorization':'Bearer '+env.MOMENT_SITE_ACCESS_TOKEN,'x-moment-executor-key':env.MOMENT_EXECUTOR_KEY,'x-job-lease':task.leaseToken,'content-type':errorCode?'application/json':'application/octet-stream'};
  const body=errorCode?JSON.stringify({errorCode}):output;
  // Delivery may repeat with the same lease and bytes. The model call never does.
  let response;
  for(let attempt=0;attempt<2;attempt++){
    try{response=await fetch(SITE_ORIGIN+'/api/internal/jobs/'+task.jobId+'/result',{method:'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});if(response.ok)return await response.json();if(response.status<500)break;}
    catch(error){if(attempt===1)throw error;}
  }
  throw new Error('Result storage did not confirm completion: '+response?.status);
}
function configured(env){return typeof env.MOMENT_EXECUTOR_KEY==='string'&&env.MOMENT_EXECUTOR_KEY.length>0&&typeof env.MOMENT_SITE_ACCESS_TOKEN==='string'&&env.MOMENT_SITE_ACCESS_TOKEN.length>0;}
async function wake(env){
  if(!configured(env))throw new Error('Executor is not configured.');
  // This platform token must only be sent to its originating Site.
  const response=await fetch(SITE_ORIGIN+'/api/internal/jobs/run',{method:'POST',headers:{'content-type':'application/json','OAI-Sites-Authorization':'Bearer '+env.MOMENT_SITE_ACCESS_TOKEN,'x-moment-executor-key':env.MOMENT_EXECUTOR_KEY},body:'{}',signal:AbortSignal.timeout(40000),redirect:'manual'});
  if(!response.ok)throw new Error('Site task runner returned HTTP '+response.status);
  const result=await response.json();
  if(result.editTask)return edit(result.editTask,env);
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
