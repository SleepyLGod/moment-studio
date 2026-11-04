import {authorize,type GalleryEnv,type Identity} from './api.ts';
import {ApiError,boundedBytes,json} from './http.ts';
import {claimPublicProof,proofStatus,savePublicProof,publicSampleImage} from './cloud-proof.ts';
import {CallbackError,eventConnection,handleEventMethod,publicEventDefinition,recordEventSetup,STYLE_EVENT,PUBLIC_EVENT,styleEventDefinition} from './cloud-events.ts';

import {claimSubscriptionEdit,finishSubscriptionEdit,subscriptionEditStatus} from './subscription-edits.ts';

const empty={type:'object',properties:{},additionalProperties:false};
const jobInput={type:'object',properties:{jobId:{type:'string'}},required:['jobId'],additionalProperties:false};
const tools=[
  {name:'style_cloud_connection',description:'Read the OpenAI Style Lab listener status, expiry and last renewal. Never returns secrets.',inputSchema:empty,annotations:{readOnlyHint:true}},
  {name:'claim_style_edit',description:'Claim exactly the Style Lab job ID in a style_edit.queued event. Returns its prompt, lease and owner-selected preview image blocks. If claimed is false, stop. Use native OpenAI subscription image editing; no API or external runner.',inputSchema:jobInput},
  {name:'finish_style_edit',description:'Complete the claimed Style Lab job with actual JPEG bytes and SHA-256, or report an explicit failure. The generated image is saved separately in the private library; originals and albums are untouched.',inputSchema:{type:'object',properties:{jobId:{type:'string'},leaseToken:{type:'string'},jpegBase64:{type:'string'},sha256:{type:'string'},errorCode:{enum:['RESULT_UNKNOWN','SUBSCRIPTION_LIMIT','EDIT_REJECTED','INPUT_UNAVAILABLE']}},required:['jobId','leaseToken'],additionalProperties:false}},
  {name:'style_edit_status',description:'Check a Style Lab job by exact ID and reconcile expired execution before confirming result storage. Does not return input images.',inputSchema:jobInput},
  {name:'public_cloud_connection',description:'Read whether the single OpenAI cloud event listener is connected. Never returns callback URLs or signing secrets.',inputSchema:empty,annotations:{readOnlyHint:true}},
  {name:'public_sample_image',description:'Read the fixed bundled public coffee sample as an image content block, with its SHA-256. Does not accept or expose private photo IDs. Use this exact image for event-triggered edits.',inputSchema:empty,annotations:{readOnlyHint:true}},
  {name:'public_sample_status',description:'Read the single public-coffee subscription cloud validation task. Does not expose private photos or albums.',inputSchema:empty,annotations:{readOnlyHint:true}},
  {name:'claim_public_sample',description:'Claim the queued public coffee sample exactly once for native image editing in an OpenAI cloud task. Never use paid APIs or another runner. If claimed=false, do not generate again.',inputSchema:empty},
  {name:'save_public_sample_result',description:'Save the actual JPEG result from the claimed OpenAI cloud task into the private Sites gallery. Original sample and manual albums are preserved. Pass real file bytes directly from the cloud runtime, not handwritten base64.',inputSchema:{type:'object',properties:{jobId:{type:'string'},leaseToken:{type:'string'},jpegBase64:{type:'string'},sha256:{type:'string'},cloudTaskUrl:{type:'string'}},required:['jobId','leaseToken','jpegBase64','sha256','cloudTaskUrl'],additionalProperties:false}},
];
/** Sites authenticates the MCP caller; all tool execution also checks library ownership. */
export async function handleMcp(request:Request,env:GalleryEnv,identity:Identity|null){
  let id:unknown=null,method='';
  try{
    const bytes=await boundedBytes(request.body,3*1024*1024),rpc=JSON.parse(new TextDecoder().decode(bytes));id=rpc.id??null;
    if(rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')throw new ApiError(400,'Invalid JSON-RPC request.');
    method=rpc.method;let result:unknown;
    if(method.startsWith('events/')){
      const target=rpc.params?.delivery?.url;
      console.info(JSON.stringify({component:'moment-events',method,phase:'received',callbackOrigin:typeof target==='string'&&URL.canParse(target)?new URL(target).origin:undefined}));
    }
    if(rpc.method==='server/discover')result={resultType:'complete',supportedVersions:['2026-07-28'],serverInfo:{name:'Moment public cloud proof',version:'1.1.0'},capabilities:{tools:{},events:{}}};
    else if(rpc.method==='initialize')result={protocolVersion:'2025-03-26',serverInfo:{name:'Moment public cloud proof',version:'1.1.0'},capabilities:{tools:{},events:{}}};
    else if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
    else if(rpc.method==='tools/list')result={tools};
    else if(rpc.method==='events/list')result={events:[publicEventDefinition,styleEventDefinition]};
    else if(['events/subscribe','events/unsubscribe'].includes(rpc.method)){
      const user=await authorize(env,identity),event=rpc.params?.name===STYLE_EVENT?STYLE_EVENT:PUBLIC_EVENT;await recordEventSetup(env,user.userId,method,'received',undefined,event);
      try{result=await handleEventMethod(env,user.userId,rpc.method,rpc.params||{});}
      catch(error){await recordEventSetup(env,user.userId,method,'failed',error,event);throw error;}
      await recordEventSetup(env,user.userId,method,'configured',undefined,event);
      console.info(JSON.stringify({component:'moment-events',method,phase:'configured'}));
    }
    else if(rpc.method==='ping')result={};
    else if(rpc.method==='tools/call'){
      const user=await authorize(env,identity),name=rpc.params?.name,args=rpc.params?.arguments||{};
      let value;
      if(name==='public_sample_image')return json({jsonrpc:'2.0',id,result:await publicSampleImage(env)});
      if(name==='public_cloud_connection')value=await eventConnection(env,user.userId);
      else if(name==='style_cloud_connection')value=await eventConnection(env,user.userId,STYLE_EVENT);
      else if(name==='claim_style_edit')return json({jsonrpc:'2.0',id,result:await claimSubscriptionEdit(env,user.userId,args.jobId)});
      else if(name==='finish_style_edit')value=await finishSubscriptionEdit(env,user.userId,args);
      else if(name==='style_edit_status')value=await subscriptionEditStatus(env,user.userId,args.jobId);
      else if(name==='public_sample_status')value=await proofStatus(env,user.userId);
      else if(name==='claim_public_sample')value=await claimPublicProof(env,user.userId);
      else if(name==='save_public_sample_result')value=await savePublicProof(env,user.userId,args);
      else throw new ApiError(404,'Unknown tool.');
      result={content:[{type:'text',text:JSON.stringify(value)}]};
    }else return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found.'}});
    return json({jsonrpc:'2.0',id,result});
  }catch(error){
    if(method.startsWith('events/'))console.error(JSON.stringify({component:'moment-events',method,phase:'failed',reason:error instanceof CallbackError?error.reason:error instanceof ApiError?error.message:'internal_error',...(error instanceof CallbackError&&error.origin?{callbackOrigin:error.origin}:{})}));
    if(error instanceof CallbackError)return json({jsonrpc:'2.0',id,error:{code:-32015,message:error.message,data:{reason:error.reason,...(error.origin?{origin:error.origin}:{})}}});
    const message=error instanceof ApiError?error.message:error instanceof SyntaxError?'Invalid JSON.':'Cloud proof request failed.';
    if(method.startsWith('events/'))return json({jsonrpc:'2.0',id,error:{code:-32602,message}});
    return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:message}],isError:true}});
  }
}
