import type {GalleryEnv} from './api.ts';
import {boundedBytes,fail} from './http.ts';
import {digest} from './image-integrity.ts';

export const PUBLIC_EVENT='public_sample.queued';
export const publicEventDefinition={name:PUBLIC_EVENT,description:'The owner clicked Generate for the bundled public coffee sample. No private photos or albums are included.',delivery:['webhook'],inputSchema:{type:'object',properties:{},additionalProperties:false},payloadSchema:{type:'object',properties:{jobId:{type:'string'},photoId:{type:'string'}},required:['jobId','photoId'],additionalProperties:false}};
type Subscription={owner_id:string;id:string;callback_url:string;secret:string;previous_secret:string|null;rotate_until:number|null;expires_at:number;verified_at:number;active:number;};
// This integration targets OpenAI only. No caller-selected hosts, subdomains,
// IP literals, ports or redirects are accepted, including during verification.
const CALLBACK_HOSTS=new Set(['chatgpt.com','chat.openai.com','api.openai.com']);
const encoder=new TextEncoder();
export class CallbackError extends Error {reason:string;origin?:string;constructor(reason:string,origin?:string){super('OpenAI callback verification failed.');this.reason=reason;this.origin=origin;}}
function callbackUrl(value:unknown){
  let url:URL;try{url=new URL(String(value));}catch{throw new CallbackError('invalid_url');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!CALLBACK_HOSTS.has(url.hostname))throw new CallbackError('origin_not_allowed',url.origin);
  return url.href;
}
function signingKey(value:unknown){
  if(typeof value!=='string'||!value.startsWith('whsec_'))fail(400,'Invalid event signing secret.');
  let decoded:string;try{decoded=atob(value.slice(6).replace(/-/g,'+').replace(/_/g,'/'));}catch{fail(400,'Invalid event signing secret.');}
  if(decoded.length<24||decoded.length>64)fail(400,'Invalid event signing secret.');return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
async function signature(secret:string,id:string,timestamp:string,body:string){
  const key=await crypto.subtle.importKey('raw',signingKey(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(id+'.'+timestamp+'.'+body)));
  return 'v1,'+btoa(String.fromCharCode(...bytes));
}
async function signedPost(sub:Subscription,id:string,body:string){
  const timestamp=String(Math.floor(Date.now()/1000)),signatures=[await signature(sub.secret,id,timestamp,body)];
  if(sub.previous_secret&&sub.rotate_until&&sub.rotate_until>Date.now())signatures.push(await signature(sub.previous_secret,id,timestamp,body));
  return fetch(callbackUrl(sub.callback_url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(7000),headers:{'content-type':'application/json','webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':signatures.join(' '),'X-MCP-Subscription-Id':sub.id},body});
}
async function subscription(env:GalleryEnv,owner:string){return env.DB.prepare('SELECT * FROM cloud_event_subscriptions WHERE owner_id=?').bind(owner).first<Subscription>();}
export async function eventConnection(env:GalleryEnv,owner:string){const sub=await subscription(env,owner);return {ready:Boolean(sub?.active&&sub.expires_at>Date.now()),expiresAt:sub?.active?sub.expires_at:null};}
/** Only the authenticated gallery owner can configure this single hosted listener. */
export async function handleEventMethod(env:GalleryEnv,owner:string,method:string,params:Record<string,any>){
  if(params.name!==PUBLIC_EVENT||!params.arguments||typeof params.arguments!=='object'||Array.isArray(params.arguments)||Object.keys(params.arguments).length)fail(400,'Invalid public sample event or filters.');
  if(params.delivery?.mode!=='webhook')fail(400,'Only webhook delivery is supported.');
  const url=callbackUrl(params.delivery.url),id='moment-'+await digest(encoder.encode(owner+'\n'+PUBLIC_EVENT+'\n'+url)),now=Date.now(),current=await subscription(env,owner);
  if(method==='events/unsubscribe'){
    await env.DB.prepare('UPDATE cloud_event_subscriptions SET active=0,updated_at=? WHERE owner_id=? AND id=?').bind(now,owner,id).run();return {};
  }
  if(current?.active&&current.expires_at>now&&current.id!==id)fail(409,'Another OpenAI cloud listener is already connected. Stop it before replacing it.');
  const secret=params.delivery.secret;signingKey(secret);
  if(params.ttlMs!==undefined&&params.ttlMs!==null&&(!Number.isSafeInteger(params.ttlMs)||params.ttlMs<=0))fail(400,'Invalid subscription lifetime.');
  const expires=now+Math.min(params.ttlMs??86400000,86400000),changed=current?.secret!==secret;
  const same=current?.id===id;
  const candidate:Subscription={owner_id:owner,id,callback_url:url,secret,previous_secret:same?(changed?current.secret:current.previous_secret):null,rotate_until:same?(changed?now+300000:current.rotate_until):null,expires_at:expires,verified_at:current?.verified_at||0,active:1};
  if(!current||current.id!==id||changed||current.verified_at<now-300000){
    const challenge=crypto.randomUUID();let response:Response;
    try{response=await signedPost(candidate,'verify-'+crypto.randomUUID(),JSON.stringify({type:'verification',challenge}));}catch{throw new CallbackError('timeout_or_transport');}
    if(!response.ok)throw new CallbackError('http_'+response.status);
    let received:unknown;try{received=JSON.parse(new TextDecoder().decode(await boundedBytes(response.body,2048))).challenge;}catch{throw new CallbackError('challenge_failed');}
    if(typeof received!=='string'||received.length!==challenge.length)throw new CallbackError('challenge_failed');
    let difference=0;for(let i=0;i<challenge.length;i++)difference|=challenge.charCodeAt(i)^received.charCodeAt(i);if(difference)throw new CallbackError('challenge_failed');
    candidate.verified_at=now;
  }
  const saved=await env.DB.prepare('INSERT INTO cloud_event_subscriptions(owner_id,id,callback_url,secret,previous_secret,rotate_until,expires_at,verified_at,active,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?) ON CONFLICT(owner_id) DO UPDATE SET id=excluded.id,callback_url=excluded.callback_url,secret=excluded.secret,previous_secret=excluded.previous_secret,rotate_until=excluded.rotate_until,expires_at=excluded.expires_at,verified_at=excluded.verified_at,active=1,updated_at=excluded.updated_at WHERE cloud_event_subscriptions.id=excluded.id OR cloud_event_subscriptions.active=0 OR cloud_event_subscriptions.expires_at<=?').bind(owner,id,url,secret,candidate.previous_secret,candidate.rotate_until,expires,candidate.verified_at,now,now).run();
  if(saved.meta.changes!==1)fail(409,'Another OpenAI listener connected concurrently.');
  return {id,refreshBefore:new Date(expires).toISOString(),cursor:null,truncated:false};
}
/** Await bounded signed delivery in the button request; never rely on waitUntil. */
export async function deliverPublicEvent(env:GalleryEnv,owner:string,jobId:string){
  const now=Date.now(),sub=await subscription(env,owner),principal=await env.DB.prepare('SELECT user_id FROM library_owner WHERE id=1').first<{user_id:string}>();
  if(principal?.user_id!==owner||!sub?.active||sub.expires_at<=now)fail(503,'Connect the OpenAI cloud listener first.');
  const acquired=await env.DB.prepare("UPDATE jobs SET input=json_set(input,'$.delivery',json(?)),updated_at=? WHERE id=? AND owner_id=? AND kind='subscription-proof' AND state='queued' AND coalesce(json_extract(input,'$.delivery.accepted'),0)=0 AND coalesce(json_extract(input,'$.delivery.leaseUntil'),0)<=?").bind(JSON.stringify({accepted:false,state:'sending',leaseUntil:now+30000}),now,jobId,owner,now).run();
  if(acquired.meta.changes!==1)return;
  const task=await env.DB.prepare('SELECT created_at FROM jobs WHERE id=? AND owner_id=?').bind(jobId,owner).first<{created_at:number}>();
  const body=JSON.stringify({eventId:'moment-job-'+jobId,name:PUBLIC_EVENT,timestamp:new Date(task!.created_at).toISOString(),data:{jobId,photoId:'1060'},cursor:null});
  let status:number|null=null,accepted=false;
  for(let attempt=0;attempt<3;attempt++){
    const current=await subscription(env,owner);if(!current?.active||current.id!==sub.id||current.expires_at<=Date.now()){status=410;break;}
    try{const response=await signedPost(sub,'moment-job-'+jobId,body);status=response.status;accepted=response.ok;await response.body?.cancel();}catch{status=null;}
    if(accepted||(status!==null&&status<500&&status!==429))break;
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,attempt===0?300:900));
  }
  await env.DB.prepare("UPDATE jobs SET input=json_set(input,'$.delivery',json(?)),updated_at=? WHERE id=? AND owner_id=? AND kind='subscription-proof'").bind(JSON.stringify({accepted,state:accepted?'accepted':'failed',httpStatus:status,eventId:'moment-job-'+jobId,at:Date.now()}),Date.now(),jobId,owner).run();
}
