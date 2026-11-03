'use client';
import {useEffect,useState,useRef} from 'react';
type Job={id:string;state:string;prompt:string;delivery:{accepted:boolean;state:string}|null;result:{src:string;sha256:string;cloudTaskUrl:string;width:number;height:number;bytes:number}|null;};
export default function CloudProof(){
  const [job,setJob]=useState<Job|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[connected,setConnected]=useState(false),sending=useRef(false);
  async function load(method='GET'){
    try{const response=await fetch('/api/cloud-proof',{method});const data=await response.json() as {job:Job|null;connection:{ready:boolean};error?:string};if(!response.ok)throw new Error(data.error||'Cloud request failed.');setJob(data.job);setConnected(data.connection.ready);setError('');}catch(e){setError(e instanceof Error?e.message:'Cloud request failed.');}finally{setLoaded(true);}
  }
  useEffect(()=>{load();const interval=setInterval(()=>{if(!sending.current)load();},5000);return ()=>clearInterval(interval);},[]);
  async function queue(){if(sending.current)return;sending.current=true;setBusy(true);await load('POST');setBusy(false);sending.current=false;}
  const imageStyle={width:'100%',aspectRatio:'9 / 7',objectFit:'contain' as const,background:'#ede9df',borderRadius:12};
  return <main style={{maxWidth:1080,margin:'64px auto',padding:'0 28px'}}>
    <a href="/">← Library</a><h1 style={{marginTop:32}}>OpenAI cloud proof</h1>
    <p>One public coffee sample. Native subscription image editing. Saved back to this private library.</p>
    <p><strong>{!loaded?'Loading…':job?.state||'Ready'}</strong> · {connected?'OpenAI cloud connected':'Cloud listener not connected'}</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:24,margin:'28px 0'}}>
      <figure style={{margin:0}}><img src="/photos/1060.jpg" alt="Original public coffee sample" style={imageStyle}/><figcaption>Original · public sample</figcaption></figure>
      <figure style={{margin:0}}>{job?.result?<img src={job.result.src} alt="OpenAI cloud edited coffee result" style={imageStyle}/>:<div style={{...imageStyle,display:'grid',placeItems:'center'}}>Awaiting cloud result</div>}<figcaption>Layered paper · OpenAI subscription</figcaption></figure>
    </div>
    {(!job||(job.state==='queued'&&job.delivery?.state==='failed'))&&<button disabled={!loaded||busy||!connected} onClick={queue}>{busy?'Sending…':job?'Retry delivery':'Generate public sample'}</button>}
    {job?.state==='queued'&&<p>{job.delivery?.accepted?'Event delivered · Waiting for OpenAI cloud':job.delivery?.state==='failed'?'Delivery failed · Retry the same task':'Sending event…'}</p>}
    {job?.state==='running'&&<p>Creating in OpenAI cloud · You can close this page</p>}
    {job?.state==='unknown'&&<p>Result unknown · No automatic re-generation</p>}
    {error&&<p role="alert">{error}</p>}
    {job?.result&&<><p>{job.result.width} × {job.result.height} · {Math.round(job.result.bytes/1024)} KB · Saved in library</p><p><a href={job.result.src+'?download=1'}>Download result</a> · <a href={job.result.cloudTaskUrl}>OpenAI cloud task</a></p><code style={{overflowWrap:'anywhere'}}>SHA-256 {job.result.sha256}</code></>}
  </main>;
}
