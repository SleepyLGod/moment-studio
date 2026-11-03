import {freshState,CATEGORIES} from '../src/data.js';
import {ApiError,fail,json,identifier,body,boundedBytes,privateHeaders as headers} from './http.ts';
import {handleJobs,runInternalJobs} from './jobs.ts';
import {handleModels} from './ai/catalog.ts';
import {handleLibraryViews,photoScope,presentPhoto} from './library.ts';
import {timeline} from '../src/services/organization.js';
import {photoMime} from '../src/services/photo-format.js';
import {finishEditJob} from './edit-jobs.ts';
export interface GalleryEnv { DB: D1Database; BUCKET: R2Bucket; NVIDIA_API_KEY?: string; MOMENT_EXECUTOR_KEY?: string; MOMENT_BACKGROUND_ENABLED?: string; MOMENT_IMAGE_EDIT_ENABLED?:string; ASSETS?: Fetcher; }
export interface Identity { userId: string; email: string; }
type RecordData = Record<string, any>;
type FileRow = {id:string;owner_id:string;name:string;mime:string;size:number;object_key:string;purpose:string;status:string;};
type DataRow = {id:string;owner_id:string;data:string;revision:number;created_at:number;};
const MAX_FILE = 12 * 1024 * 1024;
const MIME = new Set(['image/jpeg','image/png','image/webp','image/heic']);
const TABLES = new Set(['photos','albums','styles']);
async function fileRow(env:GalleryEnv,user:string,id:string){return env.DB.prepare('SELECT * FROM files WHERE id=? AND owner_id=?').bind(id,user).first<FileRow>();}
async function record(env:GalleryEnv,table:string,user:string,id:string){return env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND owner_id=?`).bind(id,user).first<DataRow>();}
function item(row:DataRow){return presentPhoto(row);}
async function authorize(env:GalleryEnv,user:Identity|null){
  if(!user?.userId||!user.email)fail(401,'Sign in to open your library.');
  if(!env.DB||!env.BUCKET)fail(503,'Cloud storage is not configured.');
  let owner=await env.DB.prepare('SELECT user_id FROM library_owner WHERE id=1').first<{user_id:string}>();
  if(!owner){
    // The existing Site is owner-private. Only a platform-authenticated owner can bootstrap it.
    await env.DB.prepare('INSERT OR IGNORE INTO library_owner (id,user_id) VALUES (1,?)').bind(user.userId).run();
    owner=await env.DB.prepare('SELECT user_id FROM library_owner WHERE id=1').first<{user_id:string}>();
  }
  if(owner?.user_id!==user.userId)fail(403,'This library is private to its owner.');return user;
}
async function validateSource(env:GalleryEnv,user:string,src:unknown){
  if(typeof src!=='string')fail(400,'An image source is required.');
  if(/^\/photos\/(?:\d+\.jpg|fjord-demo\.png)$/.test(src)||/^\/styles\/(?:paper|clay|comic)-(?:fjord|city|coffee)\.png$/.test(src))return;
  const match=/^\/api\/files\/([a-zA-Z0-9_-]{1,100})$/.exec(src);
  if(!match)fail(400,'Use an uploaded image or a bundled sample.');
  const row=await fileRow(env,user,match[1]);if(!row||row.status!=='ready')fail(400,'Image upload is not complete.');
}
async function validateRecord(env:GalleryEnv,table:string,user:string,data:RecordData){
  // Prevent accidental base64 blobs or arbitrary external URLs in persistent metadata.
  const raw=JSON.stringify(data);if(raw.length>48*1024||/"(?:src|renderedSrc|generationSrc|thumbnailSrc|cover)":"(?:data:|blob:)/.test(raw))fail(400,'Upload image files separately from metadata.');
  if(table==='photos'){
    if(typeof data.name!=='string'||!data.name.trim()||data.name.length>200)fail(400,'A photo name is required.');
    if(!['photo','collage','generation'].includes(data.kind||'photo'))fail(400,'Invalid photo kind.');
    for(const field of ['src','renderedSrc','generationSrc','thumbnailSrc'])if(data[field])await validateSource(env,user,data[field]);
    if(!data.src)fail(400,'An original image is required.');
    const originalId=/^\/api\/files\/([a-zA-Z0-9_-]{1,100})$/.exec(data.src)?.[1];
    if(originalId&&(await fileRow(env,user,originalId))?.mime==='image/heic'){
      const previewId=typeof data.thumbnailSrc==='string'?/^\/api\/files\/([a-zA-Z0-9_-]{1,100})$/.exec(data.thumbnailSrc)?.[1]:null;
      const preview=previewId?await fileRow(env,user,previewId):null;
      if(data.originalMime!=='image/heic'||!preview||preview.status!=='ready'||preview.purpose!=='preview'||preview.mime==='image/heic')fail(400,'A HEIC photo requires its web-compatible preview.');
    }
    if(data.parentPhotoId&&!await record(env,'photos',user,identifier(data.parentPhotoId)))fail(400,'Original photo was not found.');
    if(data.sourcePhotoIds){if(!Array.isArray(data.sourcePhotoIds)||data.sourcePhotoIds.length>20)fail(400,'Invalid collage sources.');for(const id of data.sourcePhotoIds)if(!await record(env,'photos',user,identifier(id)))fail(400,'A collage source was not found.');}
    if(data.recipe?.reference?.src)await validateSource(env,user,data.recipe.reference.src);
  }else if(table==='albums'){
    if(typeof data.title!=='string'||!data.title.trim()||data.title.length>48||typeof data.note!=='string'||data.note.length>400)fail(400,'Invalid album title or note.');
    if(!Array.isArray(data.photoIds)||data.photoIds.length>500||new Set(data.photoIds).size!==data.photoIds.length)fail(400,'Invalid album selection.');
    for(const id of data.photoIds)if(!await record(env,'photos',user,identifier(id)))fail(400,'An album photo was not found.');
  }else{
    if(typeof data.name!=='string'||!data.name.trim()||data.name.length>40||typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>8000)fail(400,'A style name and prompt are required.');
    if(data.reference?.src)await validateSource(env,user,data.reference.src);
    if(data.cover)await validateSource(env,user,data.cover);
  }
}

/** Handle authenticated gallery requests. Identity is supplied only by Sites' server helper. */
export async function handleApi(request:Request,env:GalleryEnv,identity:Identity|null):Promise<Response>{
  try{
    if(new URL(request.url).pathname==='/api/internal/jobs/run')return await runInternalJobs(request,env);
    const editResult=/^\/api\/internal\/jobs\/([a-zA-Z0-9_-]{1,100})\/result$/.exec(new URL(request.url).pathname);if(editResult)return await finishEditJob(request,env,editResult[1]);
    const user=await authorize(env,identity),url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=request.method;
    if(!['GET','HEAD'].includes(method)){
      const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'Cross-origin writes are not allowed.');
    }
    const modelResponse=await handleModels(request,env,user.userId);if(modelResponse)return modelResponse;
    const collectionResponse=await handleLibraryViews(request,env,user.userId);if(collectionResponse)return collectionResponse;
    const jobResponse=await handleJobs(request,env,user);if(jobResponse)return jobResponse;
    if(path[0]==='me'&&method==='GET'){
      const row=await env.DB.prepare('SELECT initialized FROM library_owner WHERE id=1').first<{initialized:number}>();
      return json({user:{id:user.userId,email:user.email},storage:'cloud',initialized:Boolean(row?.initialized),features:{analysis:Boolean(env.NVIDIA_API_KEY&&env.MOMENT_EXECUTOR_KEY&&env.MOMENT_BACKGROUND_ENABLED==='true'),imageEdit:Boolean(env.MOMENT_EXECUTOR_KEY&&env.MOMENT_BACKGROUND_ENABLED==='true'&&env.MOMENT_IMAGE_EDIT_ENABLED==='true')}});
    }
    if(path[0]==='bootstrap'&&path.length===1&&method==='POST'){
      const row=await env.DB.prepare('SELECT initialized FROM library_owner WHERE id=1').first<{initialized:number}>();
      if(!row?.initialized){
        const initial=freshState(),now=Date.now(),statements:D1PreparedStatement[]=[];
        for(const [table,values] of [['photos',initial.photos],['albums',initial.albums]] as const)for(const value of values){
          const date=timeline(value,now);
          statements.push(env.DB.prepare(`INSERT OR IGNORE INTO ${table} (id,owner_id,data,revision,created_at,updated_at${table==='photos'?',timeline_day,date_source':''}) VALUES (?,?,?,1,?,?${table==='photos'?',?,?':''})`).bind(value.id,user.userId,JSON.stringify(value),now,now,...(table==='photos'?[date.day,date.source]:[])));
        }
        statements.push(env.DB.prepare('UPDATE library_owner SET initialized=1 WHERE id=1 AND user_id=?').bind(user.userId));
        await env.DB.batch(statements);
      }
      return json({initialized:true});
    }
    if(path[0]==='uploads'&&path.length===1&&method==='POST'){
      const data=await body(request),id=identifier(data.id),size=Number(data.size),mime=String(data.mime),purpose=String(data.purpose||'original');
      if(!Number.isSafeInteger(size)||size<=0)fail(400,'Invalid file size.');if(size>MAX_FILE)fail(413,'Use files up to 12 MiB.');
      if(!MIME.has(mime)||!['original','preview','rendered','reference','generation'].includes(purpose)||(mime==='image/heic'&&purpose!=='original'))fail(400,'Use JPG, PNG, WebP or a HEIC original.');
      if(typeof data.name!=='string'||!data.name.trim()||data.name.length>200)fail(400,'Invalid file name.');
      const existing=await fileRow(env,user.userId,id);
      if(existing){if(existing.size!==size||existing.mime!==mime||existing.purpose!==purpose||existing.name!==data.name)fail(409,'This upload ID already describes another file.');return json({upload:{id,status:existing.status}});}
      await env.DB.prepare('INSERT INTO files (id,owner_id,name,mime,size,object_key,purpose,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user.userId,data.name,mime,size,`owners/${user.userId}/${id}`,purpose,'pending',Date.now()).run();
      return json({upload:{id,status:'pending'}});
    }
    if(path[0]==='uploads'&&path.length===3){
      const id=identifier(path[1]),row=await fileRow(env,user.userId,id);if(!row)fail(404,'Upload not found.');
      if(path[2]==='body'&&method==='PUT'){
        if(row.status==='ready')return json({uploaded:true});
        const bytes=await boundedBytes(request.body,Math.min(row.size,MAX_FILE));
        if(bytes.byteLength!==row.size||photoMime(bytes)!==row.mime)fail(400,'File contents do not match the upload.');
        // R2 create-only write prevents concurrent retries replacing the first accepted original.
        await env.BUCKET.put(row.object_key,bytes,{httpMetadata:{contentType:row.mime},onlyIf:{etagDoesNotMatch:'*'}});
        const stored=await env.BUCKET.head(row.object_key);if(!stored||stored.size!==row.size)fail(503,'Upload could not be verified.');
        return json({uploaded:true});
      }
      if(path[2]==='complete'&&method==='POST'){
        const stored=await env.BUCKET.head(row.object_key);if(!stored||stored.size!==row.size)fail(409,'Upload is not complete.');
        await env.DB.prepare("UPDATE files SET status='ready' WHERE id=? AND owner_id=?").bind(id,user.userId).run();
        return json({file:{id,src:'/api/files/'+id,mime:row.mime,size:row.size,name:row.name}});
      }
    }
    if(path[0]==='files'&&path.length===2&&['GET','HEAD'].includes(method)){
      const row=await fileRow(env,user.userId,identifier(path[1]));if(!row||row.status!=='ready')fail(404,'File not found.');
      const object=await env.BUCKET.get(row.object_key);if(!object)fail(404,'File not found.');
      return new Response(method==='HEAD'?null:object.body,{headers:{...headers,'content-type':row.mime,'content-length':String(row.size),'content-disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(row.name)}`}});
    }
    const table=path[0];
    if(table==='photos'&&path[1]==='resolve'&&path.length===2&&method==='POST'){
      const data=await body(request);if(!Array.isArray(data.ids)||data.ids.length>50)fail(400,'Resolve up to 50 photos at a time.');
      const ids=data.ids.map(identifier);if(!ids.length)return json({items:[]});
      const rows=await env.DB.prepare(`SELECT * FROM photos WHERE owner_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(user.userId,...ids).all<DataRow>();
      return json({items:rows.results.map(item)});
    }
    if(TABLES.has(table)&&path.length===1&&method==='GET'){
      const n=Number(url.searchParams.get('limit')||50);if(!Number.isSafeInteger(n)||n<1||n>100)fail(400,'Invalid page size.');
      let cursor:[number,string]|null=null;const raw=url.searchParams.get('cursor');
      if(raw){try{cursor=JSON.parse(raw);}catch{fail(400,'Invalid cursor.');}if(!Array.isArray(cursor)||cursor.length!==2||!Number.isSafeInteger(cursor[0])||typeof cursor[1]!=='string')fail(400,'Invalid cursor.');}
      let conditions=['owner_id=?'],args:(string|number)[]=[user.userId];
      const category=url.searchParams.get('category');
      if(table==='photos')({conditions,args}=photoScope(user.userId,category,url.searchParams.get('month')));
      else if(category&&category!=='all')fail(400,'Invalid photo category.');
      const total=(await env.DB.prepare(`SELECT count(*) AS total FROM ${table} WHERE ${conditions.join(' AND ')}`).bind(...args).first<{total:number}>())?.total||0;
      if(cursor){conditions.push('(created_at<? OR (created_at=? AND id<?))');args.push(cursor[0],cursor[0],cursor[1]);}
      args.push(n+1);
      const query=env.DB.prepare(`SELECT * FROM ${table} WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...args);
      const rows=(await query.all<DataRow>()).results,more=rows.length>n,items=rows.slice(0,n),last=items.at(-1);
      return json({items:items.map(item),total,nextCursor:more&&last?JSON.stringify([last.created_at,last.id]):null});
    }
    if(TABLES.has(table)&&path.length===2){
      const id=identifier(path[1]),existing=await record(env,table,user.userId,id);
      if(method==='GET'){if(!existing)fail(404,'Record not found.');return json({item:item(existing)});}
      if(method==='PUT'){
        const scope=table==='photos'?photoScope(user.userId,url.searchParams.get('category'),url.searchParams.get('month')):null;
        const data=await body(request);if(data.id!==id)fail(400,'Record ID does not match.');await validateRecord(env,table,user.userId,data);
        if(existing&&table==='photos'&&data.src!==JSON.parse(existing.data).src)fail(409,'The original image cannot be replaced.');
        const {revision:ignored,_order:ignoredOrder,timelineDay:ignoredDay,dateSource:ignoredSource,...values}=data;const now=Date.now(),raw=JSON.stringify(values),date=timeline(data,existing?.created_at||now);
        if(existing&&existing.data!==raw&&data.revision!==existing.revision)fail(409,'This item changed in another session. Reload before saving.');
        if(existing){
          if(existing.data!==raw){const changed=await env.DB.prepare(`UPDATE ${table} SET data=?,revision=revision+1,updated_at=?${table==='photos'?',timeline_day=?,date_source=?':''} WHERE id=? AND owner_id=? AND revision=?`).bind(raw,now,...(table==='photos'?[date.day,date.source]:[]),id,user.userId,existing.revision).run();if(!changed.meta.changes)fail(409,'This item changed. Reload before saving.');}
        }else{
          await env.DB.prepare(`INSERT OR IGNORE INTO ${table} (id,owner_id,data,revision,created_at,updated_at${table==='photos'?',timeline_day,date_source':''}) VALUES (?,?,?,1,?,?${table==='photos'?',?,?':''})`).bind(id,user.userId,raw,now,now,...(table==='photos'?[date.day,date.source]:[])).run();
          const stored=await record(env,table,user.userId,id);if(!stored||stored.data!==raw)fail(409,'This identifier already belongs to another record.');
        }
        const total=scope?(await env.DB.prepare(`SELECT count(*) AS total FROM photos WHERE ${scope.conditions.join(' AND ')}`).bind(...scope.args).first<{total:number}>())?.total:undefined;
        return json({item:item((await record(env,table,user.userId,id))!),...(total===undefined?{}:{total})});
      }
    }
    return json({error:'Not found.'},404);
  }catch(error){
    if(error instanceof ApiError)return json({error:error.message},error.status);
    console.error('Gallery request failed:',error instanceof Error?error.message:'Unknown storage error');
    return json({error:'Cloud storage is unavailable. Your changes were not confirmed. Try again.'},503);
  }
}
