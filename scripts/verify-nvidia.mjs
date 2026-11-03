/** Opt-in live NVIDIA readiness probe. Only bundled example photos may be sent. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
const options={};
for(let i=0;i<args.length;i++){
  const key=args[i];
  if(key==='--infer')options.infer=true;
  else if(['--sample','--preferred','--out'].includes(key)&&args[i+1]&&!args[i+1].startsWith('--'))options[key.slice(2)]=args[++i];
  else throw new Error('Use --infer, --sample coffee|city, --preferred MODEL_ID, --out PATH.');
}
const key=process.env.NVIDIA_API_KEY;
if(!key)throw new Error('Set NVIDIA_API_KEY in the process environment; never pass it on the command line.');
const origin='https://integrate.api.nvidia.com/v1';
// Explicit capabilities and request profiles; the model list alone does not supply these.
const profiles=new Map([
  ['nvidia/nemotron-3.5-super-vl-120b-a12b',{chat_template_kwargs:{enable_thinking:false}}],
  ['meta/llama-3.2-11b-vision-instruct',{}],
  ['google/gemma-3-4b-it',{}],
]);
if(options.sample&&!['coffee','city'].includes(options.sample))throw new Error('Only coffee or city bundled samples are allowed.');
if(options.preferred&&!profiles.has(options.preferred))throw new Error('Preferred model must have a registered request profile.');
if(!options.infer&&(options.sample||options.preferred))throw new Error('Use --infer explicitly with sample/model options.');
const report={checkedAt:new Date().toISOString(),scope:'local live-provider probe, not a hosted Sites test'};
async function call(path,body){
  const start=Date.now();
  try{
    const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
    const text=await response.text();let data;
    try{data=JSON.parse(text);}catch{data=null;}
    return {status:response.status,elapsedMs:Date.now()-start,requestId:response.headers.get('nvcf-reqid')||response.headers.get('x-request-id'),data};
  }catch(error){return {status:null,elapsedMs:Date.now()-start,error:error.name};}
}
const listed=await call('/models');
const ids=Array.isArray(listed.data?.data)?listed.data.data.map(x=>x.id).filter(x=>typeof x==='string').sort():[];
report.catalog={status:listed.status,elapsedMs:listed.elapsedMs,count:ids.length,sha256:createHash('sha256').update(JSON.stringify(ids)).digest('hex'),registeredCandidates:[...profiles.keys()].filter(id=>ids.includes(id)),error:listed.error};
if(listed.status!==200||!ids.length)process.exitCode=1;
else if(options.infer){
  const sample=options.sample||'coffee';
  const preferred=options.preferred;
  const model=preferred&&ids.includes(preferred)?preferred:report.catalog.registeredCandidates[0];
  if(!model)throw new Error('No registered vision candidate is listed.');
  const photo=sample==='coffee'?'1060.jpg':'1067.jpg';
  const bytes=await readFile(fileURLToPath(new URL('../public/photos/'+photo,import.meta.url)));
  const result=await call('/chat/completions',{model,messages:[{role:'user',content:[{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+bytes.toString('base64')}},{type:'text',text:'Describe only clearly visible objects. Return JSON only with up to 3 short Chinese tags and a Chinese caption under 30 characters: {"tags":[],"caption":""}. Do not infer location or identity.'}]}],max_tokens:512,temperature:0,stream:false,...profiles.get(model)});
  let analysis=null;
  try{
    const content=result.data?.choices?.[0]?.message?.content;
    const parsed=typeof content==='string'?JSON.parse(content):null;
    if(parsed&&Array.isArray(parsed.tags)&&parsed.tags.length<=3&&parsed.tags.every(x=>typeof x==='string'&&x.length>0&&x.length<=20)&&typeof parsed.caption==='string'&&parsed.caption.length>0&&parsed.caption.length<=30)analysis={tags:parsed.tags,caption:parsed.caption};
  }catch{analysis=null;}
  report.inference={model,preferredReused:Boolean(preferred&&model===preferred),sample:'public/photos/'+photo,imageSha256:createHash('sha256').update(bytes).digest('hex'),status:result.status,elapsedMs:result.elapsedMs,requestId:result.requestId,finishReason:result.data?.choices?.[0]?.finish_reason,analysis,error:result.error||(!analysis?(result.status===202?'pending_protocol_not_verified':result.status===404?'upstream_not_found':'invalid_or_failed_response'):undefined)};
  if(!analysis||result.status!==200)process.exitCode=1;
}
if(options.out)await writeFile(options.out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
