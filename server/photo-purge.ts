import type {GalleryEnv} from './api.ts';
import {body, fail, identifier, json} from './http.ts';

type PhotoRow = {id:string; data:string; revision:number};
type PurgeRow = {file_ids:string; completed_at:number|null};
type Link = {id:string; name:string; kind:string; trashed:0|1};

// The same dependency test drives the review and the atomic reservation.
const linkedRecords = `
  SELECT albums.id, json_extract(albums.data,'$.title') AS name, 'album' AS kind, 0 AS trashed
  FROM albums
  WHERE albums.owner_id=target.owner_id
    AND EXISTS (SELECT 1 FROM json_each(albums.data,'$.photoIds') WHERE value=target.id)
  UNION ALL
  SELECT other.id, json_extract(other.data,'$.name'), coalesce(json_extract(other.data,'$.kind'),'photo'), other.deleted_at IS NOT NULL
  FROM photos AS other
  WHERE other.owner_id=target.owner_id AND other.id<>target.id
    AND NOT EXISTS (SELECT 1 FROM photo_purges WHERE photo_id=other.id AND owner_id=other.owner_id)
    AND (
      json_extract(other.data,'$.parentPhotoId')=target.id
      OR EXISTS (SELECT 1 FROM json_each(other.data,'$.sourcePhotoIds') WHERE value=target.id)
      OR (
        coalesce(json_extract(target.data,'$.kind'),'photo')='photo'
        AND json_extract(target.data,'$.src') GLOB '/api/files/*'
        AND (
          json_extract(other.data,'$.src')=json_extract(target.data,'$.src')
          OR json_extract(other.data,'$.thumbnailSrc')=json_extract(target.data,'$.src')
          OR json_extract(other.data,'$.renderedSrc')=json_extract(target.data,'$.src')
          OR json_extract(other.data,'$.generationSrc')=json_extract(target.data,'$.src')
        )
      )
    )
`;
const targetFiles = `
  files.owner_id=target.owner_id AND files.status='ready'
  AND '/api/files/'||files.id IN (
    json_extract(target.data,'$.src'), json_extract(target.data,'$.thumbnailSrc'),
    json_extract(target.data,'$.renderedSrc'), json_extract(target.data,'$.generationSrc'),
    json_extract(target.data,'$.recipe.reference.src')
  )
`;
const reclaimableFiles = `SELECT json_group_array(id) FROM (
  SELECT files.id FROM files
  WHERE ${targetFiles}
    AND NOT EXISTS (
      SELECT 1 FROM photos AS other, json_tree(other.data) AS field
      WHERE other.owner_id=target.owner_id AND other.id<>target.id
        AND field.atom='/api/files/'||files.id
        AND NOT EXISTS (SELECT 1 FROM photo_purges WHERE photo_id=other.id AND owner_id=other.owner_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM styles, json_tree(styles.data) AS field
      WHERE styles.owner_id=target.owner_id AND field.atom='/api/files/'||files.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM jobs, json_tree(jobs.input) AS field
      WHERE jobs.owner_id=target.owner_id AND jobs.photo_id<>target.id
        AND jobs.state IN ('queued','running','unknown') AND field.atom='/api/files/'||files.id
    )
  ORDER BY files.id
)`;

// Fence record writes whose earlier validation raced with a purge reservation.
export const purgeWriteFence = `
  NOT EXISTS (
    SELECT 1 FROM json_tree(?) AS field JOIN files
      ON field.atom='/api/files/'||files.id
    WHERE files.owner_id=? AND files.status IN ('purging','purged')
  )
  AND NOT EXISTS (
    SELECT 1 FROM json_tree(?) AS field JOIN photo_purges ON field.atom=photo_purges.photo_id
    WHERE photo_purges.owner_id=? AND (
      field.path IN ('$.photoIds','$.sourcePhotoIds')
      OR (field.path='$' AND (field.key='parentPhotoId' OR (field.key='id' AND ?='photos')))
    )
  )
`;
export const purgeWriteArgs = (raw:string, owner:string, table:string) => [raw,owner,raw,owner,table];

/** Prevent stale uploads and duplicate result deliveries from restoring reserved bytes. */
export async function putGalleryFile(env:GalleryEnv, owner:string, id:string, key:string, bytes:Uint8Array, mime:string) {
  const isReserved = () => env.DB.prepare("SELECT 1 FROM files WHERE owner_id=? AND id=? AND status IN ('purging','purged')")
    .bind(owner,id).first();
  if (await isReserved()) fail(410,'This file was permanently deleted.');
  const written = await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime},onlyIf:{etagDoesNotMatch:'*'}});
  if (written && await isReserved()) {
    await env.BUCKET.delete(key);
    fail(410,'This file was permanently deleted.');
  }
}

export async function handlePhotoPurge(request:Request, env:GalleryEnv, owner:string):Promise<Response|null> {
  const match = /^\/api\/photos\/([a-zA-Z0-9_-]{1,100})\/purge$/.exec(new URL(request.url).pathname);
  if (!match) return null;
  const id = identifier(match[1]);
  if (!['GET','POST'].includes(request.method)) fail(405,'Use GET or POST.');
  const pending = () => env.DB.prepare('SELECT file_ids,completed_at FROM photo_purges WHERE owner_id=? AND photo_id=?')
    .bind(owner,id).first<PurgeRow>();
  let purge = await pending();
  if (purge?.completed_at) return json({id,deleted:true});

  const review = await env.DB.prepare(`SELECT target.id,target.data,target.revision,
    (${reclaimableFiles}) AS file_ids,
    (SELECT count(*) FROM files WHERE ${targetFiles}) AS file_count,
    (SELECT json_group_array(json_object('id',id,'name',name,'kind',kind,'trashed',trashed))
       FROM (SELECT * FROM (${linkedRecords}) ORDER BY kind,name,id LIMIT 51)) AS links
    FROM photos AS target WHERE target.owner_id=? AND target.id=? AND target.deleted_at IS NOT NULL`)
    .bind(owner,id).first<PhotoRow & {file_ids:string; file_count:number; links:string}>();
  if (!review) {
    if ((await pending())?.completed_at) return json({id,deleted:true});
    fail(404,'This photo is not in Trash.');
  }
  const name = JSON.parse(review.data).name;
  const files = JSON.parse(purge?.file_ids ?? review.file_ids) as string[];
  const links = JSON.parse(review.links) as Link[];
  if (request.method==='GET') return json({
    id,name,links:links.slice(0,50),moreLinks:links.length>50,
    filesToDelete:files.length,filesToKeep:purge?0:review.file_count-files.length,
    token:JSON.stringify([review.revision,files]),pending:Boolean(purge),
  });

  const command = await body(request);
  if (command.confirmed!==true) fail(400,'Confirm permanent deletion after reviewing the impact.');
  if (!purge) {
    if (links.length) fail(409,'This photo is still used by an album or another photo.');
    if (command.token!==JSON.stringify([review.revision,files])) fail(409,'The impact changed. Review it again.');
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO photo_purges(photo_id,owner_id,file_ids)
        SELECT target.id,target.owner_id,? FROM photos AS target
        WHERE target.owner_id=? AND target.id=? AND target.deleted_at IS NOT NULL
          AND target.revision=? AND (${reclaimableFiles})=?
          AND NOT EXISTS (${linkedRecords})`)
        .bind(review.file_ids,owner,id,review.revision,review.file_ids),
      env.DB.prepare(`UPDATE files SET status='purging' WHERE owner_id=? AND status='ready'
        AND id IN (SELECT value FROM photo_purges, json_each(file_ids)
          WHERE photo_purges.owner_id=? AND photo_id=? AND completed_at IS NULL)`).bind(owner,owner,id),
    ]);
    purge = await pending();
    if (!purge) fail(409,'The impact changed. Review it again.');
    if (purge.completed_at) return json({id,deleted:true});
  }

  const reserved = await env.DB.prepare(`SELECT object_key FROM files WHERE owner_id=? AND status='purging'
    AND id IN (SELECT value FROM json_each(?))`).bind(owner,purge.file_ids).all<{object_key:string}>();
  const keys = reserved.results.map(row=>row.object_key);
  if (keys.length) await env.BUCKET.delete(keys);
  await env.DB.batch([
    env.DB.prepare("UPDATE files SET status='purged',name='',size=0,object_key='' WHERE owner_id=? AND status='purging' AND id IN (SELECT value FROM json_each(?))")
      .bind(owner,purge.file_ids),
    env.DB.prepare("DELETE FROM jobs WHERE owner_id=? AND (photo_id=? OR json_extract(result,'$.photoId')=?)")
      .bind(owner,id,id),
    env.DB.prepare('DELETE FROM photos WHERE owner_id=? AND id=? AND deleted_at IS NOT NULL').bind(owner,id),
    env.DB.prepare("UPDATE photo_purges SET completed_at=?,file_ids='[]' WHERE owner_id=? AND photo_id=? AND completed_at IS NULL")
      .bind(Date.now(),owner,id),
  ]);
  return json({id,deleted:true});
}
