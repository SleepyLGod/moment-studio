import {boundedBytes} from '../http.ts';
export const ANALYSIS_MODEL='nvidia/nemotron-3.5-super-vl-120b-a12b';
export const RULE_VERSION='photo-tags-v1';
export type Analysis={tags:string[];caption:string};
export class AnalysisError extends Error {
  code:string;
  retryAfterMs:number;
  constructor(code:string,retryAfterMs=0){super(code);this.code=code;this.retryAfterMs=retryAfterMs;}
}
function base64(bytes:Uint8Array){let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);}
/** Concrete, live-verified NVIDIA request profile; never returns HTTP-only success. */
export async function analyze(image:Uint8Array,mime:string,key:string,model=ANALYSIS_MODEL):Promise<Analysis>{
  if(model!==ANALYSIS_MODEL)throw new AnalysisError('MODEL_UNAVAILABLE');
  let response:Response;
  try{
    response=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:[{type:'image_url',image_url:{url:'data:'+mime+';base64,'+base64(image)}},{type:'text',text:'Describe only clearly visible objects. Return JSON only with up to 3 short Chinese tags and a Chinese caption under 30 characters: {"tags":[],"caption":""}. Do not infer location or identity.'}]}],max_tokens:512,temperature:0,stream:false,chat_template_kwargs:{enable_thinking:false}}),signal:AbortSignal.timeout(25000)});
  }catch{throw new AnalysisError('PROVIDER_UNREACHABLE',60000);}
  if(response.status===429){const seconds=Number(response.headers.get('retry-after'));throw new AnalysisError('RATE_LIMITED',Number.isFinite(seconds)&&seconds>0?Math.min(seconds*1000,3600000):60000);}
  if(response.status>=500)throw new AnalysisError('PROVIDER_UNAVAILABLE',60000);
  if(response.status===401||response.status===403)throw new AnalysisError('PROVIDER_AUTH');
  if(response.status===404)throw new AnalysisError('MODEL_UNAVAILABLE');
  if(response.status===202)throw new AnalysisError('RESULT_UNKNOWN');
  if(response.status!==200)throw new AnalysisError('PROVIDER_REJECTED');
  let result:Analysis;
  try{
    const data=JSON.parse(new TextDecoder().decode(await boundedBytes(response.body,64*1024))) as {choices?:{message?:{content?:string}}[]};
    const content=data.choices?.[0]?.message?.content;
    if(typeof content!=='string'||content.length>4096)throw new Error('Invalid output');
    const parsed=JSON.parse(content);
    if(!Array.isArray(parsed.tags)||parsed.tags.length>3||!parsed.tags.every((tag:unknown)=>typeof tag==='string'&&tag.trim().length>0&&tag.length<=20)||typeof parsed.caption!=='string'||!parsed.caption.trim()||parsed.caption.length>30)throw new Error('Invalid output');
    result={tags:[...new Set<string>(parsed.tags.map((tag:string)=>tag.trim()))],caption:parsed.caption.trim()};
  }catch{throw new AnalysisError('INVALID_OUTPUT');}
  return result;
}
