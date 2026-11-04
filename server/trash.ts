import type {GalleryEnv,Identity} from './api.ts';
import {body,fail,identifier,json} from './http.ts';
/** Reversible removal; original bytes and album membership remain intact. */
export async function handleTrash(request:Request,env:GalleryEnv,user:Identity):Promise<Response|null>{
 const action=new URL(request.url).pathname;if(!['/api/photos/trash','/api/photos/restore'].includes(action)||request.method!=='POST')return null;
 const data=await body(request);if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>100||new Set(data.ids).size!==data.ids.length)fail(400,'Select 1 to 100 photos.');
 const ids=data.ids.map(identifier),slots=ids.map(()=>'?').join(',');
 const found=await env.DB.prepare(`SELECT id FROM photos WHERE owner_id=? AND id IN (${slots}) `).bind(user.userId,...ids).all<{id:string}>();if(found.results.length!==ids.length)fail(404,'A photo was not found.');
 const trash=action.endsWith('/trash'),now=Date.now();
 const notPurging = 'NOT EXISTS (SELECT 1 FROM photo_purges WHERE owner_id=? AND photo_id IN (SELECT value FROM json_each(?)))';
 const purgeArgs = [user.userId,JSON.stringify(ids)];
 const photo=env.DB.prepare(`UPDATE photos SET deleted_at=?,revision=revision+1,updated_at=? WHERE owner_id=? AND id IN (${slots}) AND deleted_at IS ${trash?'NULL':'NOT NULL'} AND ${notPurging}`).bind(trash?now:null,now,user.userId,...ids,...purgeArgs);
 const statements=[photo];if(trash)statements.push(env.DB.prepare(`UPDATE jobs SET state='cancelled',error_code='PHOTO_TRASHED',lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND photo_id IN (${slots}) AND state IN ('queued','running','unknown') AND ${notPurging}`).bind(now,user.userId,...ids,...purgeArgs));
 const results=await env.DB.batch(statements);
 if(results[0].meta.changes!==ids.length){
   const pending=await env.DB.prepare(`SELECT 1 FROM photo_purges WHERE owner_id=? AND photo_id IN (${slots})`).bind(user.userId,...ids).first();
   if(pending)fail(409,'A photo is being permanently deleted.');
 }
 return json({ids,trashed:trash});
}

/** Retire stale queued rows before claiming; Trash itself cancels current rows atomically. */
export async function cancelInactiveJobs(env:GalleryEnv,owner:string,kind:'edit'|'analyze'){
 await env.DB.prepare("UPDATE jobs SET state='cancelled',error_code='PHOTO_TRASHED',lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner_id=? AND kind=? AND state IN ('queued','running','unknown') AND NOT EXISTS(SELECT 1 FROM photos WHERE photos.id=jobs.photo_id AND photos.owner_id=jobs.owner_id AND deleted_at IS NULL)").bind(Date.now(),owner,kind).run();
}
