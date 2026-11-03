import type {GalleryEnv,Identity} from './api.ts';
import {body,fail,identifier,json} from './http.ts';

import {analyze,AnalysisError,RULE_VERSION} from './ai/nvidia.ts';
import {models,refreshModels} from './ai/catalog.ts';
import {claimEdit,createEditJobs,presentEdit} from './edit-jobs.ts';
import {executorOwner} from './executor-auth.ts';
type JobRow={id:string;owner_id:string;photo_id:string;kind:string;input:string;model_id:string;state:string;result:string|null;error_code:string|null;lease_token:string|null;lease_until:number|null;attempts:number;};
function present(row:JobRow){return row.kind==='edit'?presentEdit(row):{id:row.id,photoId:row.photo_id,kind:'analyze',state:row.state,result:row.result?JSON.parse(row.result):null,errorCode:row.error_code};}

/** Gallery-owner routes create/read tasks, but cannot impersonate the executor. */
export async function handleJobs(request:Request,env:GalleryEnv,user:Identity):Promise<Response|null>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/jobs')return null;
  if(request.method==='GET'){
    if(url.searchParams.get('kind')==='edit'&&!url.searchParams.get('ids')){const rows=await env.DB.prepare("SELECT * FROM jobs WHERE owner_id=? AND kind='edit' AND (state IN ('queued','running','unknown') OR id IN (SELECT id FROM jobs WHERE owner_id=? AND kind='edit' ORDER BY created_at DESC,id DESC LIMIT 20)) ORDER BY created_at DESC,id DESC").bind(user.userId,user.userId).all<JobRow>();return json({jobs:rows.results.map(present)});}
    const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean).map(identifier);
    if(!ids.length||ids.length>20)fail(400,'Read up to 20 task IDs.');
    const rows=await env.DB.prepare(`SELECT * FROM jobs WHERE owner_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(user.userId,...ids).all<JobRow>();
    return json({jobs:rows.results.map(present)});
  }
  if(request.method!=='POST')fail(405,'Use GET or POST.');
  const data=await body(request);
  if(data.kind==='edit')return createEditJobs(env,user,data);
  if(!env.NVIDIA_API_KEY||!env.MOMENT_EXECUTOR_KEY||env.MOMENT_BACKGROUND_ENABLED!=='true')fail(503,'Background analysis is not configured.');
  if(data.kind!=='analyze')fail(400,'Only photo analysis is available.');
  if(!Array.isArray(data.photoIds)||!data.photoIds.length||data.photoIds.length>20)fail(400,'Select 1 to 20 photos.');
  const ids=[...new Set(data.photoIds.map(identifier))],rows=[];
  for(const id of ids){
    const photo=await env.DB.prepare('SELECT data FROM photos WHERE id=? AND owner_id=?').bind(id,user.userId).first<{data:string}>();
    if(!photo)fail(404,'Photo not found.');
    const input=JSON.parse(photo.data);
    if((input.kind||'photo')!=='photo')fail(400,'Select original photos for analysis.');
    rows.push({id,input:{originalSrc:input.src,previewSrc:input.thumbnailSrc||input.src}});
  }
  const keys=rows.map(p=>[p.id,p.input.originalSrc,RULE_VERSION].join('|'));
  const previous=(await env.DB.prepare(`SELECT * FROM jobs WHERE owner_id=? AND work_key IN (${keys.map(()=>'?').join(',')})`).bind(user.userId,...keys).all<JobRow>()).results;
  if(previous.length===rows.length)return json({jobs:previous.map(present)},202);
  let catalog=await models(env,user.userId);if(!catalog.checkedAt)catalog=await refreshModels(env,user.userId);
  const modelId=catalog.selectedModelId;if(!modelId)fail(503,'No compatible NVIDIA model is available. Refresh models before retrying.');
  const now=Date.now(),statements=[];
  for(const photo of rows)statements.push(env.DB.prepare("INSERT OR IGNORE INTO jobs (id,owner_id,work_key,kind,photo_id,input,model_id,state,next_run_at,created_at,updated_at) VALUES (?,?,?,'analyze',?,?,?,'queued',?,?,?)").bind(crypto.randomUUID(),user.userId,[photo.id,photo.input.originalSrc,RULE_VERSION].join('|'),photo.id,JSON.stringify(photo.input),modelId,now,now,now));
  await env.DB.batch(statements);
  const selected=await env.DB.prepare(`SELECT * FROM jobs WHERE owner_id=? AND work_key IN (${rows.map(()=>'?').join(',')})`).bind(user.userId,...rows.map(p=>[p.id,p.input.originalSrc,RULE_VERSION].join('|'))).all<JobRow>();
  return json({jobs:selected.results.map(present)},202);
}

/** Platform service access is not visitor identity. This narrow endpoint uses its own key. */
export async function runInternalJobs(request:Request,env:GalleryEnv):Promise<Response>{
  const owner=await executorOwner(request,env),editTask=await claimEdit(env,owner);
  if(editTask)return json({processed:0,editTask});
  if(env.MOMENT_IMAGE_EDIT_ENABLED==='true'&&!env.NVIDIA_API_KEY)return json({processed:0});
  if(!env.NVIDIA_API_KEY)fail(503,'The analyzer is not configured.');
  return json(await runDue(env,owner));
}

async function inputBytes(env:GalleryEnv,job:JobRow){
  const input=JSON.parse(job.input) as {originalSrc:string;previewSrc:string};
  const match=/^\/api\/files\/([a-zA-Z0-9_-]{1,100})$/.exec(input.previewSrc);
  if(match){
    const row=await env.DB.prepare("SELECT object_key,mime,size FROM files WHERE id=? AND owner_id=? AND status='ready'").bind(match[1],job.owner_id).first<{object_key:string;mime:string;size:number}>();
    if(!row||row.size>2*1024*1024)throw new AnalysisError('INPUT_UNAVAILABLE');
    const object=await env.BUCKET.get(row.object_key);if(!object)throw new AnalysisError('INPUT_UNAVAILABLE');
    return {bytes:new Uint8Array(await object.arrayBuffer()),mime:row.mime};
  }
  if(/^\/photos\/(?:\d+\.jpg|fjord-demo\.png)$/.test(input.previewSrc)&&env.ASSETS){
    const response=await env.ASSETS.fetch(new Request('https://assets.invalid'+input.previewSrc));
    if(!response.ok)throw new AnalysisError('INPUT_UNAVAILABLE');
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>2*1024*1024)throw new AnalysisError('INPUT_UNAVAILABLE');
    return {bytes,mime:response.headers.get('content-type')||'image/jpeg'};
  }
  throw new AnalysisError('UPLOAD_EXAMPLE_FIRST');
}

/** One bounded step per tick. An expired execution cannot commit after another claim. */
async function runDue(env:GalleryEnv,ownerId:string){
  const now=Date.now(),token=crypto.randomUUID();
  await env.DB.prepare("UPDATE jobs SET state='failed',error_code='RETRY_EXHAUSTED',lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND kind='analyze' AND state='running' AND lease_until<=? AND attempts>=3").bind(now,ownerId,now).run();
  const job=await env.DB.prepare("UPDATE jobs SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=(SELECT id FROM jobs WHERE owner_id=? AND kind='analyze' AND attempts<3 AND ((state='queued' AND next_run_at<=?) OR (state='running' AND lease_until<=?)) ORDER BY next_run_at,created_at LIMIT 1) RETURNING *").bind(token,now+60000,now,ownerId,now,now).first<JobRow>();
  if(!job)return {processed:0};
  try{
    const input=await inputBytes(env,job);
    const result=await analyze(input.bytes,input.mime,env.NVIDIA_API_KEY!,job.model_id);
    const finished=Date.now(),snapshot=JSON.parse(job.input) as {originalSrc:string};
    const analysis={jobId:job.id,modelId:job.model_id,ruleVersion:RULE_VERSION,caption:result.caption,analyzedAt:new Date(finished).toISOString()};
    // Both updates use the same fencing conditions in one transaction. json_set
    // changes only AI-owned fields, preserving concurrent manual metadata edits.
    const photo=env.DB.prepare("UPDATE photos SET data=json_set(data,'$.aiTags',json(?),'$.analysis',json(?)),revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND json_extract(data,'$.src')=? AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND state='running' AND lease_token=? AND lease_until>=?)").bind(JSON.stringify(result.tags),JSON.stringify(analysis),finished,job.photo_id,ownerId,snapshot.originalSrc,job.id,token,finished);
    const done=env.DB.prepare("UPDATE jobs SET state='succeeded',result=?,error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND state='running' AND lease_token=? AND lease_until>=? AND EXISTS(SELECT 1 FROM photos WHERE id=? AND owner_id=? AND json_extract(data,'$.src')=?)").bind(JSON.stringify(result),finished,job.id,token,finished,job.photo_id,ownerId,snapshot.originalSrc);
    const preference=env.DB.prepare("UPDATE library_owner SET ai_state=json_set(ai_state,'$.lastSuccessfulModelId',?,'$.lastSuccessAt',?) WHERE id=1 AND user_id=? AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND state='succeeded' AND updated_at=?)").bind(job.model_id,new Date(finished).toISOString(),ownerId,job.id,finished);
    const committed=await env.DB.batch([photo,done,preference]);
    return {processed:committed[1].meta.changes===1?1:0};
  }catch(error){
    if(!(error instanceof AnalysisError))throw error;
    const finished=Date.now(),retry=error.retryAfterMs>0&&job.attempts<3;
    const state=error.code==='RESULT_UNKNOWN'?'unknown':retry?'queued':'failed';
    const result=await env.DB.prepare("UPDATE jobs SET state=?,error_code=?,next_run_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND state='running' AND lease_token=? AND lease_until>=?").bind(state,error.code,finished+(retry?error.retryAfterMs:0),finished,job.id,token,finished).run();
    return {processed:result.meta.changes===1?1:0,...(state==='failed'?{failed:1}:{})};
  }
}
