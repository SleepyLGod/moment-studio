import {authorize,type GalleryEnv,type Identity} from './api.ts';
import {ApiError,boundedBytes,json} from './http.ts';
import {claimPublicProof,proofStatus,savePublicProof} from './cloud-proof.ts';

const empty={type:'object',properties:{},additionalProperties:false};
const tools=[
  {name:'public_sample_status',description:'Read the single public-coffee subscription cloud validation task. Does not expose private photos or albums.',inputSchema:empty,annotations:{readOnlyHint:true}},
  {name:'claim_public_sample',description:'Claim the queued public coffee sample exactly once for native image editing in an OpenAI cloud task. Never use paid APIs or another runner. If claimed=false, do not generate again.',inputSchema:empty},
  {name:'save_public_sample_result',description:'Save the actual JPEG result from the claimed OpenAI cloud task into the private Sites gallery. Original sample and manual albums are preserved. Pass real file bytes directly from the cloud runtime, not handwritten base64.',inputSchema:{type:'object',properties:{jobId:{type:'string'},leaseToken:{type:'string'},jpegBase64:{type:'string'},sha256:{type:'string'},cloudTaskUrl:{type:'string'}},required:['jobId','leaseToken','jpegBase64','sha256','cloudTaskUrl'],additionalProperties:false}},
];
/** Sites authenticates the MCP caller; all tool execution also checks library ownership. */
export async function handleMcp(request:Request,env:GalleryEnv,identity:Identity|null){
  let id:unknown=null;
  try{
    const bytes=await boundedBytes(request.body,3*1024*1024),rpc=JSON.parse(new TextDecoder().decode(bytes));id=rpc.id??null;
    if(rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')throw new ApiError(400,'Invalid JSON-RPC request.');
    let result:unknown;
    if(rpc.method==='server/discover')result={supportedVersions:['2026-07-28'],serverInfo:{name:'Moment public cloud proof',version:'1.0.0'},capabilities:{tools:{}}};
    else if(rpc.method==='initialize')result={protocolVersion:'2025-03-26',serverInfo:{name:'Moment public cloud proof',version:'1.0.0'},capabilities:{tools:{}}};
    else if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
    else if(rpc.method==='tools/list')result={tools};
    else if(rpc.method==='ping')result={};
    else if(rpc.method==='tools/call'){
      const user=await authorize(env,identity),name=rpc.params?.name,args=rpc.params?.arguments||{};
      let value;
      if(name==='public_sample_status')value=await proofStatus(env,user.userId);
      else if(name==='claim_public_sample')value=await claimPublicProof(env,user.userId);
      else if(name==='save_public_sample_result')value=await savePublicProof(env,user.userId,args);
      else throw new ApiError(404,'Unknown tool.');
      result={content:[{type:'text',text:JSON.stringify(value)}]};
    }else return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found.'}});
    return json({jsonrpc:'2.0',id,result});
  }catch(error){
    const message=error instanceof ApiError?error.message:error instanceof SyntaxError?'Invalid JSON.':'Cloud proof request failed.';
    return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:message}],isError:true}});
  }
}
