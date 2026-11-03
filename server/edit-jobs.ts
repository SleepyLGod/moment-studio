import type {GalleryEnv,Identity} from './api.ts';
import {body,boundedBytes,fail,identifier,json} from './http.ts';
import {executorOwner} from './executor-auth.ts';
import {photoMime} from '../src/services/photo-format.js';
import {calendarDay} from '../src/services/organization.js';
import {recipeSignature} from '../src/recipes.js';
export const EDIT_MODEL='@cf/black-forest-labs/flux-2-klein-4b';
type EditRow={id:string;owner_id:string;photo_id:string;input:string;state:string;result:string|null;error_code:string|null;lease_token:string|null;lease_until:number|null;};
const enabled=(env:GalleryEnv)=>env.MOMENT_IMAGE_EDIT_ENABLED==='true'&&env.MOMENT_BACKGROUND_ENABLED==='true'&&Boolean(env.MOMENT_EXECUTOR_KEY);
export function presentEdit(row:EditRow){const input=JSON.parse(row.input);return {id:row.id,photoId:row.photo_id,kind:'edit',state:row.state,result:row.result?JSON.parse(row.result):null,errorCode:row.error_code,recipe:input.recipe,recipeSignature:input.recipeSignature};}
async function digest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function base64(bytes:Uint8Array){let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);}
function jpegDimensions(bytes:Uint8Array){
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=2;
  while(offset+4<bytes.length){if(bytes[offset++]!==255)return null;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)return null;
    const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)return null;
    if([192,193,194].includes(marker)&&length>=8)return {height:view.getUint16(offset+3),width:view.getUint16(offset+5)};offset+=length;
  }return null;
}
async function imageInput(env:GalleryEnv,owner:string,src:string){
  const id=/^\/api\/files\/([a-zA-Z0-9_-]{1,100})$/.exec(src)?.[1];
  if(id){const row=await env.DB.prepare("SELECT object_key,mime,size FROM files WHERE id=? AND owner_id=? AND status='ready'").bind(id,owner).first<{object_key:string;mime:string;size:number}>();
    if(!row||row.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(row.mime))fail(400,'Use a web-compatible preview or reference up to 2 MiB.');
    const object=await env.BUCKET.get(row.object_key);if(!object)fail(400,'The image is unavailable.');return {mime:row.mime,base64:base64(await boundedBytes(object.body,2*1024*1024))};}
  if(/^\/photos\/(?:\d+\.jpg|fjord-demo\.png)$/.test(src)&&env.ASSETS){const response=await env.ASSETS.fetch(new Request('https://assets.invalid'+src));if(!response.ok)fail(400,'The sample image is unavailable.');const bytes=await boundedBytes(response.body,2*1024*1024),mime=photoMime(bytes);if(!mime||mime==='image/heic')fail(400,'Invalid sample image.');return {mime,base64:base64(bytes)};}
  fail(400,'Use an owned photo or bundled sample.');
}
export async function createEditJobs(env:GalleryEnv,user:Identity,data:Record<string,any>){
  if(!enabled(env))fail(503,'Live image editing is not enabled.');
  if(!Array.isArray(data.photoIds)||!data.photoIds.length||data.photoIds.length>20||new Set(data.photoIds).size!==data.photoIds.length)fail(400,'Select 1 to 20 original photos.');
  const requestId=identifier(data.requestId),raw=data.recipe;
  if(!raw||typeof raw.prompt!=='string'||!raw.prompt.trim()||raw.prompt.length>1500||typeof raw.preserve!=='boolean')fail(400,'Enter a prompt up to 1500 characters.');
  if(raw.reference&&(typeof raw.reference.src!=='string'||typeof raw.reference.name!=='string'||raw.reference.name.length>200))fail(400,'Invalid style reference.');
  const recipe={name:typeof raw.name==='string'?raw.name.trim().slice(0,40)||'Custom style':'Custom style',prompt:raw.prompt.trim(),preserve:raw.preserve,reference:raw.reference?{src:raw.reference.src,name:raw.reference.name}:null};
  const now=Date.now(),values:{id:string;workKey:string;input:Record<string,any>;previous:EditRow|null}[]=[];
  for(const id of data.photoIds.map(identifier)){
    const photo=await env.DB.prepare('SELECT data FROM photos WHERE id=? AND owner_id=?').bind(id,user.userId).first<{data:string}>();if(!photo)fail(404,'Photo not found.');
    const source=JSON.parse(photo.data);if((source.kind||'photo')!=='photo')fail(400,'Select original photos for image editing.');
    const input={originalSrc:source.src,previewSrc:source.thumbnailSrc||source.src,sourceName:source.name,originalMime:source.originalMime||null,thumbnailSrc:source.thumbnailSrc||null,recipe,recipeSignature:recipeSignature(recipe)};
    const workKey='edit|'+requestId+'|'+id;
    const previous=await env.DB.prepare('SELECT * FROM jobs WHERE owner_id=? AND work_key=?').bind(user.userId,workKey).first<EditRow>();
    if(previous&&previous.input!==JSON.stringify(input))fail(409,'This request ID already describes another edit.');
    values.push({id,workKey,input,previous});
  }
  const inserts=values.filter(v=>!v.previous).map(v=>env.DB.prepare("INSERT OR IGNORE INTO jobs(id,owner_id,work_key,kind,photo_id,input,model_id,state,next_run_at,created_at,updated_at) VALUES (?,?,?,'edit',?,?,?,'queued',?,?,?)").bind(crypto.randomUUID(),user.userId,v.workKey,v.id,JSON.stringify(v.input),EDIT_MODEL,now,now,now));if(inserts.length)await env.DB.batch(inserts);
  const rows=(await env.DB.prepare(`SELECT * FROM jobs WHERE owner_id=? AND work_key IN (${values.map(()=>'?').join(',')})`).bind(user.userId,...values.map(v=>v.workKey)).all<EditRow>()).results;
  if(rows.some(row=>row.input!==JSON.stringify(values.find(v=>v.id===row.photo_id)!.input)))fail(409,'This request ID already describes another edit.');
  return json({jobs:rows.map(presentEdit)},202);
}
export async function claimEdit(env:GalleryEnv,owner:string){
  if(!enabled(env))return null;const now=Date.now(),lease=crypto.randomUUID();
  await env.DB.prepare("UPDATE jobs SET state='unknown',error_code='RESULT_UNKNOWN',lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND kind='edit' AND state='running' AND lease_until<=?").bind(now,owner,now).run();
  const row=await env.DB.prepare("UPDATE jobs SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=(SELECT id FROM jobs WHERE owner_id=? AND kind='edit' AND state='queued' AND next_run_at<=? ORDER BY created_at,id LIMIT 1) RETURNING *").bind(lease,now+180000,now,owner,now).first<EditRow>();if(!row)return null;
  try{const input=JSON.parse(row.input),images=[await imageInput(env,owner,input.previewSrc)];if(input.recipe.reference)images.push(await imageInput(env,owner,input.recipe.reference.src));
    return {jobId:row.id,leaseToken:lease,model:EDIT_MODEL,prompt:input.recipe.prompt+(input.recipe.preserve?' Preserve the composition, subjects and viewpoint of image 0.':'')+(images.length>1?' Use image 1 as a style reference only.':''),images,width:512,height:512,seed:42};
  }catch(error){await env.DB.prepare("UPDATE jobs SET state='failed',error_code='INPUT_UNAVAILABLE',lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(Date.now(),row.id,lease).run();return null;}
}
/** The generated 512px file is already a preview; no extra intermediate is stored. */
export async function finishEditJob(request:Request,env:GalleryEnv,id:string){
  const owner=await executorOwner(request,env),lease=request.headers.get('x-job-lease');
  const row=await env.DB.prepare("SELECT * FROM jobs WHERE id=? AND owner_id=? AND kind='edit'").bind(identifier(id),owner).first<EditRow>();if(!row)fail(404,'Task not found.');
  if(!lease)fail(401,'A task lease is required.');
  if(row.state==='succeeded')return json({processed:1,result:JSON.parse(row.result!)});
  if(row.state!=='running'||row.lease_token!==lease||!row.lease_until||row.lease_until<Date.now())fail(409,'This task lease has expired.');
  if((request.headers.get('content-type')||'').startsWith('application/json')){
    const data=await body(request),code=['FREE_QUOTA_EXCEEDED','PROVIDER_REJECTED','INVALID_OUTPUT','RESULT_UNKNOWN'].includes(data.errorCode)?data.errorCode:'RESULT_UNKNOWN';
    await env.DB.prepare("UPDATE jobs SET state=?,error_code=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND state='running' AND lease_token=? AND lease_until>=?").bind(code==='RESULT_UNKNOWN'?'unknown':'failed',code,Date.now(),id,lease,Date.now()).run();return json({processed:1,failed:1});
  }
  const bytes=await boundedBytes(request.body,3*1024*1024),mime=photoMime(bytes),dimensions=jpegDimensions(bytes);if(mime!=='image/jpeg'||!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>2048||dimensions.height>2048)fail(400,'The model did not return a valid JPEG result.');
  const sha=await digest(bytes),fileId='edit-'+row.id,objectKey='owners/'+owner+'/'+fileId,input=JSON.parse(row.input),now=Date.now();
  const source=await env.DB.prepare('SELECT data FROM photos WHERE id=? AND owner_id=?').bind(row.photo_id,owner).first<{data:string}>();if(!source||JSON.parse(source.data).src!==input.originalSrc)fail(409,'The original source changed.');
  await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime},onlyIf:{etagDoesNotMatch:'*'}});
  const stored=await env.BUCKET.get(objectKey);if(!stored||await digest(new Uint8Array(await stored.arrayBuffer()))!==sha)fail(409,'This result file already contains different bytes.');
  const src='/api/files/'+fileId,photoId=fileId;
  const photo={id:photoId,name:(input.sourceName+' · '+input.recipe.name).slice(0,200),src:input.originalSrc,originalMime:input.originalMime,thumbnailSrc:input.thumbnailSrc,renderedSrc:src,generationSrc:src,parentPhotoId:row.photo_id,kind:'generation',style:'generated',category:'创作',date:calendarDay(now),recipeName:input.recipe.name,recipe:input.recipe,recipeSignature:input.recipeSignature,generationSource:'cloudflare-ai',generation:{provider:'cloudflare',model:EDIT_MODEL,jobId:id,sha256:sha,...dimensions}};
  const fence="EXISTS(SELECT 1 FROM jobs WHERE id=? AND state='running' AND lease_token=? AND lease_until>=?)",args=[id,lease,Date.now()];
  const file=env.DB.prepare(`INSERT OR IGNORE INTO files(id,owner_id,name,mime,size,object_key,purpose,status,created_at) SELECT ?,?,?,?,?,?,'generation','ready',? WHERE ${fence}`).bind(fileId,owner,input.recipe.name+'.jpg',mime,bytes.length,objectKey,now,...args);
  const record=env.DB.prepare(`INSERT OR IGNORE INTO photos(id,owner_id,data,revision,created_at,updated_at,timeline_day,date_source) SELECT ?,?,?,1,?,?,?,'record-date' WHERE ${fence}`).bind(photoId,owner,JSON.stringify(photo),now,now,photo.date,...args);
  const result={photoId,src,sha256:sha};
  const done=env.DB.prepare(`UPDATE jobs SET state='succeeded',result=?,error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND state='running' AND lease_token=? AND lease_until>=? AND EXISTS(SELECT 1 FROM photos WHERE id=? AND owner_id=?)`).bind(JSON.stringify(result),now,id,lease,args[2],photoId,owner);
  const committed=await env.DB.batch([file,record,done]);if(committed[2].meta.changes!==1)fail(409,'This result was not committed because its lease expired.');return json({processed:1,result});
}
