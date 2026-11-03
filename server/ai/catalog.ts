import type {GalleryEnv} from '../api.ts';
import {boundedBytes,fail,json} from '../http.ts';
import {ANALYSIS_MODEL} from './nvidia.ts';

// Register a profile only after its image request/response contract is verified.
const profiles=[{id:ANALYSIS_MODEL,label:'Nemotron VL'}];
type AIState={catalogIds?:string[];checkedAt?:string;lastSuccessfulModelId?:string;lastSuccessAt?:string};
const refreshing=new WeakMap<D1Database,Map<string,Promise<ReturnType<typeof summary>>>>();

/** Prefer a validated previous success only while it remains eligible. */
export function selectModel(eligible:readonly string[],previous:string|null|undefined):string|null{
  return previous&&eligible.includes(previous)?previous:eligible[0]||null;
}
async function state(env:GalleryEnv,ownerId:string):Promise<AIState>{
  const row=await env.DB.prepare('SELECT ai_state FROM library_owner WHERE id=1 AND user_id=?').bind(ownerId).first<{ai_state:string}>();
  return row?JSON.parse(row.ai_state):{};
}
function summary(value:AIState){
  const candidates=profiles.filter(profile=>value.catalogIds?.includes(profile.id));
  const selectedModelId=selectModel(candidates.map(p=>p.id),value.lastSuccessfulModelId);
  return {candidates,selectedModelId,selectionReason:selectedModelId?(selectedModelId===value.lastSuccessfulModelId?'last-success':'supported-default'):'none',checkedAt:value.checkedAt||null,lastSuccessfulModelId:value.lastSuccessfulModelId||null,lastSuccessAt:value.lastSuccessAt||null};
}
export async function models(env:GalleryEnv,ownerId:string){return summary(await state(env,ownerId));}

/** Refresh metadata only: this never sends photos or probes inference endpoints. */
export async function refreshModels(env:GalleryEnv,ownerId:string){
  if(!env.NVIDIA_API_KEY)fail(503,'The NVIDIA analyzer is not configured.');
  let active=refreshing.get(env.DB);if(!active){active=new Map();refreshing.set(env.DB,active);}
  const existing=active.get(ownerId);if(existing)return existing;
  const pending=(async()=>{
    let ids:string[];
    try{
      const response=await fetch('https://integrate.api.nvidia.com/v1/models',{headers:{authorization:'Bearer '+env.NVIDIA_API_KEY},redirect:'manual',signal:AbortSignal.timeout(10000)});
      if(response.status!==200)throw new Error('Directory request failed');
      const data=JSON.parse(new TextDecoder().decode(await boundedBytes(response.body,512*1024)));
      if(!Array.isArray(data.data)||data.data.length>2048||!data.data.every((entry:unknown)=>entry&&typeof entry==='object'&&'id' in entry&&typeof entry.id==='string'&&entry.id.length>0&&entry.id.length<=256))throw new Error('Invalid directory');
      ids=profiles.filter(profile=>data.data.some((entry:{id:string})=>entry.id===profile.id)).map(profile=>profile.id);
    }catch{fail(503,'Could not refresh NVIDIA models. The previous catalog was kept.');}
    // json_set preserves a success arriving while the directory request is open.
    await env.DB.prepare("UPDATE library_owner SET ai_state=json_set(ai_state,'$.catalogIds',json(?),'$.checkedAt',?) WHERE id=1 AND user_id=?").bind(JSON.stringify(ids),new Date().toISOString(),ownerId).run();
    return models(env,ownerId);
  })();
  active.set(ownerId,pending);
  try{return await pending;}finally{active.delete(ownerId);}
}

export async function handleModels(request:Request,env:GalleryEnv,ownerId:string):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(path==='/api/ai/models'&&request.method==='GET')return json(await models(env,ownerId));
  if(path==='/api/ai/models/refresh'&&request.method==='POST')return json(await refreshModels(env,ownerId));
  return null;
}
