import {digest as sha256,jpegDimensions as jpegSize} from './image-integrity.ts';
import type {GalleryEnv} from './api.ts';
import {boundedBytes,fail,identifier,json} from './http.ts';
import {eventConnection,deliverPublicEvent} from './cloud-events.ts';
import {calendarDay} from '../src/services/organization.js';

// A bounded experiment, deliberately separate from production edit/analyze jobs.
const KIND='subscription-proof', WORK_KEY='subscription-public-coffee-event-v1';
export const PUBLIC_SAMPLE={photoId:'1060',src:'/photos/1060.jpg',sha256:'82586f13e519cddd91b3b9a3790d088127e3b22cb882feef8c56ca639d7be6d2',prompt:'Restyle this coffee photograph as a tactile layered-paper illustration. Keep the recognizable coffee cup, latte art, table and viewpoint. Use warm cream paper, soft shadows and restrained ochre accents. Produce an edited image, not a description.'};
type ProofRow={id:string;owner_id:string;photo_id:string;state:string;input:string;lease_token:string|null;lease_until:number|null;result:string|null;error_code:string|null;};
async function row(env:GalleryEnv,owner:string){return env.DB.prepare('SELECT * FROM jobs WHERE owner_id=? AND work_key=? AND kind=?').bind(owner,WORK_KEY,KIND).first<ProofRow>();}
function present(value:ProofRow|null){return value?{id:value.id,state:value.state,source:PUBLIC_SAMPLE.src,prompt:PUBLIC_SAMPLE.prompt,delivery:JSON.parse(value.input).delivery||null,result:value.result?JSON.parse(value.result):null,errorCode:value.error_code}:null;}
export async function proofStatus(env:GalleryEnv,owner:string){
  const now=Date.now();
  await env.DB.prepare("UPDATE jobs SET state='unknown',error_code='RESULT_UNKNOWN',lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND work_key=? AND kind=? AND state='running' AND lease_until<=?").bind(now,owner,WORK_KEY,KIND,now).run();
  return present(await row(env,owner));
}
export async function handleCloudProof(request:Request,env:GalleryEnv,owner:string):Promise<Response|null>{
  if(new URL(request.url).pathname!=='/api/cloud-proof')return null;
  if(request.method==='POST'){
    if(!(await eventConnection(env,owner)).ready)fail(503,'Connect the OpenAI cloud listener first.');
    const source=await env.DB.prepare('SELECT data FROM photos WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(PUBLIC_SAMPLE.photoId,owner).first<{data:string}>();
    if(!source||JSON.parse(source.data).src!==PUBLIC_SAMPLE.src)fail(409,'The bundled public coffee sample must be in the library.');
    const now=Date.now();
    await env.DB.prepare("INSERT OR IGNORE INTO jobs(id,owner_id,work_key,kind,photo_id,input,model_id,state,next_run_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',?,?,?)").bind(crypto.randomUUID(),owner,WORK_KEY,KIND,PUBLIC_SAMPLE.photoId,JSON.stringify(PUBLIC_SAMPLE),'openai-subscription-cloud',now,now,now).run();
    const task=await row(env,owner);if(task?.state==='queued')await deliverPublicEvent(env,owner,task.id);
    return json({job:await proofStatus(env,owner),connection:await eventConnection(env,owner)},202);
  }
  if(request.method!=='GET')fail(405,'Use GET or POST.');
  return json({job:await proofStatus(env,owner),connection:await eventConnection(env,owner)});
}
/** One claim only: refreshes and uncertain executions never launch another image edit. */
export async function claimPublicProof(env:GalleryEnv,owner:string){
  const token=crypto.randomUUID(),now=Date.now();
  const claimed=await env.DB.prepare("UPDATE jobs SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE owner_id=? AND work_key=? AND kind=? AND state='queued' RETURNING *").bind(token,now+60*60*1000,now,owner,WORK_KEY,KIND).first<ProofRow>();
  if(!claimed)return {claimed:false,job:await proofStatus(env,owner)};
  return {claimed:true,jobId:claimed.id,leaseToken:token,...PUBLIC_SAMPLE,repositorySource:'public/photos/1060.jpg',imageTool:'public_sample_image',instruction:'Use the native subscription image generation tool in your OpenAI cloud environment. Read public_sample_image for the exact source bytes if no repository is present; verify source SHA-256. No API keys, paid APIs, local Mac or other cloud runners. Save the actual image with save_public_sample_result; never fabricate image bytes or success.'};
}
/** The event runner receives this bundled public image only, never a private file ID. */
export async function publicSampleImage(env:GalleryEnv){
  if(!env.ASSETS)fail(503,'Bundled public image unavailable.');
  const response=await env.ASSETS.fetch(new Request('https://assets.invalid'+PUBLIC_SAMPLE.src));if(!response.ok)fail(503,'Bundled public image unavailable.');
  const bytes=await boundedBytes(response.body,128*1024);if(await sha256(bytes)!==PUBLIC_SAMPLE.sha256)fail(409,'The public source checksum changed.');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {content:[{type:'text',text:JSON.stringify({sha256:PUBLIC_SAMPLE.sha256,bytes:bytes.length})},{type:'image',mimeType:'image/jpeg',data:btoa(binary)}]};
}
/** Accept one real JPEG from the authenticated owner's cloud task, preserving the source. */
export async function savePublicProof(env:GalleryEnv,owner:string,data:Record<string,unknown>){
  const id=identifier(data.jobId),lease=identifier(data.leaseToken),taskUrl=String(data.cloudTaskUrl||'');
  if(!/^https:\/\/chatgpt\.com\/(?:local|c)\/[a-zA-Z0-9-]+(?:\?hostId=local)?$/.test(taskUrl))fail(400,'Include the OpenAI cloud task URL for provenance.');
  if(typeof data.jpegBase64!=='string'||data.jpegBase64.length>2800000||!data.jpegBase64.length||data.jpegBase64.length%4!==0||/[^A-Za-z0-9+/=]/.test(data.jpegBase64))fail(400,'Provide a base64 JPEG up to 2 MiB.');
  let decoded:string;try{decoded=atob(data.jpegBase64);}catch{fail(400,'Invalid base64 image.');}const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));if(bytes.length>2*1024*1024)fail(413,'Result exceeds 2 MiB.');
  const dimensions=jpegSize(bytes);if(!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>4096||dimensions.height>4096)fail(400,'Invalid JPEG result.');
  const sha=await sha256(bytes);if(sha!==data.sha256)fail(400,'Result checksum mismatch.');
  const task=await row(env,owner);if(!task||task.id!==id)fail(404,'Public sample task not found.');
  if(task.state==='succeeded'){const result=JSON.parse(task.result!);if(result.sha256!==sha||result.cloudTaskUrl!==taskUrl)fail(409,'This task already saved another result.');return result;}
  if(task.state!=='running'||task.lease_token!==lease||!task.lease_until||task.lease_until<Date.now())fail(409,'The cloud task lease is invalid or expired.');
  const source=await env.DB.prepare('SELECT data FROM photos WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(PUBLIC_SAMPLE.photoId,owner).first<{data:string}>();
  if(!source||JSON.parse(source.data).src!==PUBLIC_SAMPLE.src)fail(409,'The original public sample is no longer available.');
  const fileId='subscription-'+id,key='owners/'+owner+'/'+fileId;
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'},onlyIf:{etagDoesNotMatch:'*'}});
  const stored=await env.BUCKET.get(key);if(!stored||await sha256(new Uint8Array(await stored.arrayBuffer()))!==sha)fail(409,'Stored result checksum mismatch.');
  const now=Date.now(),src='/api/files/'+fileId,result={photoId:fileId,src,sha256:sha,cloudTaskUrl:taskUrl,...dimensions,bytes:bytes.length};
  const photo={id:fileId,name:'Coffee · OpenAI cloud proof',kind:'generation',category:'创作',style:'generated',date:calendarDay(now),src:PUBLIC_SAMPLE.src,renderedSrc:src,generationSrc:src,parentPhotoId:PUBLIC_SAMPLE.photoId,recipeName:'Layered paper',recipe:{name:'Layered paper',prompt:PUBLIC_SAMPLE.prompt,preserve:true,reference:null},generationSource:'openai-subscription',generation:{provider:'openai-subscription-cloud',jobId:id,...result}};
  const fence="EXISTS(SELECT 1 FROM jobs WHERE id=? AND owner_id=? AND state='running' AND lease_token=? AND lease_until>=?) AND EXISTS(SELECT 1 FROM photos WHERE id=? AND owner_id=? AND deleted_at IS NULL AND json_extract(data,'$.src')=?)",args=[id,owner,lease,now,PUBLIC_SAMPLE.photoId,owner,PUBLIC_SAMPLE.src];
  const statements=[
    env.DB.prepare(`INSERT OR IGNORE INTO files(id,owner_id,name,mime,size,object_key,purpose,status,created_at) SELECT ?,?,?,'image/jpeg',?,?,'generation','ready',? WHERE ${fence}`).bind(fileId,owner,'coffee-openai-cloud.jpg',bytes.length,key,now,...args),
    env.DB.prepare(`INSERT OR IGNORE INTO photos(id,owner_id,data,revision,created_at,updated_at,timeline_day,date_source) SELECT ?,?,?,1,?,?,?,'record-date' WHERE ${fence}`).bind(fileId,owner,JSON.stringify(photo),now,now,photo.date,...args),
    env.DB.prepare(`UPDATE jobs SET state='succeeded',result=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND ${fence}`).bind(JSON.stringify(result),now,id,...args),
  ];
  const committed=await env.DB.batch(statements);if(committed[2].meta.changes!==1)fail(409,'The result was not committed.');return result;
}
