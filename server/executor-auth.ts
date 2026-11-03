import type {GalleryEnv} from './api.ts';
import {fail} from './http.ts';
/** Service identity is deliberately separate from the browser owner's identity. */
export async function executorOwner(request:Request,env:GalleryEnv){
  if(request.method!=='POST')fail(405,'Use POST.');
  const supplied=request.headers.get('x-moment-executor-key');
  if(!env.MOMENT_EXECUTOR_KEY||!supplied||supplied.length>256)fail(401,'Executor authorization required.');
  const hashes=await Promise.all([supplied,env.MOMENT_EXECUTOR_KEY].map(value=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
  let difference=0;const a=new Uint8Array(hashes[0]),b=new Uint8Array(hashes[1]);for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  if(difference)fail(401,'Executor authorization required.');
  const owner=await env.DB.prepare('SELECT user_id FROM library_owner WHERE id=1').first<{user_id:string}>();
  if(!owner)fail(503,'The library owner must initialize the library first.');return owner.user_id;
}
