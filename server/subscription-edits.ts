import type {GalleryEnv} from './api.ts';
import {deliverEvent,STYLE_EVENT,SUBSCRIPTION_MODEL} from './cloud-events.ts';
import {commitEdit,imageInput,presentEdit,type EditRow} from './edit-jobs.ts';
import {ApiError,fail,identifier} from './http.ts';
import {digest,jpegDimensions} from './image-integrity.ts';

const query="SELECT * FROM jobs WHERE id=? AND owner_id=? AND kind='edit' AND model_id=?";
const lookup=(env:GalleryEnv,owner:string,id:string)=>env.DB.prepare(query).bind(id,owner,SUBSCRIPTION_MODEL).first<EditRow>();
const hour=60*60*1000;

export async function expireSubscriptionEdits(env:GalleryEnv,owner:string){
  const now=Date.now();
  await env.DB.prepare("UPDATE jobs SET state='unknown',error_code='RESULT_UNKNOWN',lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND kind='edit' AND model_id=? AND ((state='running' AND lease_until<=?) OR (state='queued' AND json_extract(input,'$.delivery.accepted')=1 AND json_extract(input,'$.delivery.at')<=?))").bind(now,owner,SUBSCRIPTION_MODEL,now,now-15*60*1000).run();
}
export async function subscriptionEditStatus(env:GalleryEnv,owner:string,jobId:unknown){
  const job=await lookup(env,owner,identifier(jobId));if(!job)fail(404,'Style Lab job not found.');
  const {id,state,result,errorCode}=presentEdit(job);
  return {id,state,result,errorCode};
}
export async function retrySubscriptionDelivery(env:GalleryEnv,owner:string,jobId:unknown){
  const id=identifier(jobId),row=await lookup(env,owner,id);if(!row)fail(404,'Style Lab job not found.');
  if(row.state==='queued'&&!JSON.parse(row.input).delivery?.accepted)await deliverEvent(env,owner,id,STYLE_EVENT);
  return presentEdit((await lookup(env,owner,id))!);
}
async function failClaim(env:GalleryEnv,owner:string,id:string,lease:string,code:string){
  const now=Date.now(),state=code==='RESULT_UNKNOWN'?'unknown':'failed';
  const written=await env.DB.prepare("UPDATE jobs SET state=?,error_code=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND owner_id=? AND kind='edit' AND model_id=? AND state='running' AND lease_token=? AND lease_until>=?").bind(state,code,now,id,owner,SUBSCRIPTION_MODEL,lease,now).run();
  if(written.meta.changes!==1)fail(409,'This Style Lab lease is no longer valid.');
  return {state,errorCode:code};
}

/** A claim reads only previews explicitly selected in this job, under the same owner. */
export async function claimSubscriptionEdit(env:GalleryEnv,owner:string,jobId:unknown){
  const id=identifier(jobId),now=Date.now(),lease=crypto.randomUUID();
  await expireSubscriptionEdits(env,owner);
  const row=await env.DB.prepare("UPDATE jobs SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=? AND owner_id=? AND kind='edit' AND model_id=? AND state='queued' AND json_extract(input,'$.delivery.state') IS NOT NULL AND EXISTS(SELECT 1 FROM photos WHERE photos.id=jobs.photo_id AND photos.owner_id=jobs.owner_id AND deleted_at IS NULL AND json_extract(photos.data,'$.src')=json_extract(jobs.input,'$.originalSrc')) RETURNING *").bind(lease,now+hour,now,id,owner,SUBSCRIPTION_MODEL).first<EditRow>();
  if(!row)return {content:[{type:'text',text:JSON.stringify({claimed:false})}]};
  const input=JSON.parse(row.input);
  try{
    const source=await imageInput(env,owner,input.previewSrc),reference=input.recipe.reference?await imageInput(env,owner,input.recipe.reference.src):null;
    const inputs=reference?[source,reference]:[source];
    const images=await Promise.all(inputs.map(async (item,index)=>({role:index===0?'source':'style-reference',mime:item.mime,sha256:await digest(Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0)))})));
    return {content:[
      {type:'text',text:JSON.stringify({claimed:true,jobId:id,leaseToken:lease,prompt:input.recipe.prompt,preserveComposition:input.recipe.preserve,images})},
      ...inputs.map(item=>({type:'image',mimeType:item.mime,data:item.base64})),
    ]};
  }catch(error){
    const failure=await failClaim(env,owner,id,lease,error instanceof ApiError&&error.status<500?'INPUT_UNAVAILABLE':'RESULT_UNKNOWN');
    return {content:[{type:'text',text:JSON.stringify({claimed:false,...failure})}]};
  }
}

/** Only the current lease can write a result or report a terminal failure. */
export async function finishSubscriptionEdit(env:GalleryEnv,owner:string,data:Record<string,unknown>){
  const id=identifier(data.jobId),lease=identifier(data.leaseToken),job=await lookup(env,owner,id);
  if(!job)fail(404,'Style Lab job not found.');
  if(job.state!=='succeeded'&&(job.state!=='running'||job.lease_token!==lease||!job.lease_until||job.lease_until<Date.now()))fail(409,'This Style Lab lease is no longer valid.');
  if(data.errorCode!==undefined){
    if(data.jpegBase64!==undefined||data.sha256!==undefined||job.state==='succeeded'||!['RESULT_UNKNOWN','SUBSCRIPTION_LIMIT','EDIT_REJECTED','INPUT_UNAVAILABLE'].includes(String(data.errorCode)))fail(400,'Invalid cloud failure report.');
    return failClaim(env,owner,id,lease,String(data.errorCode));
  }
  const raw=data.jpegBase64;
  if(typeof raw!=='string'||raw.length>2796204||!raw.length||raw.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)||typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256))fail(400,'Provide a JPEG up to 2 MiB and its SHA-256.');
  let decoded:string;try{decoded=atob(raw);}catch{fail(400,'Invalid base64 image.');}
  const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0)),dimensions=jpegDimensions(bytes);
  if(bytes.length>2*1024*1024||!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>4096||dimensions.height>4096)fail(400,'Invalid JPEG result.');
  return commitEdit(env,job,lease,bytes,dimensions,data.sha256);
}
