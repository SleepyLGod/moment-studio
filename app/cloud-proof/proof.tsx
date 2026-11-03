'use client';
import {useEffect,useState} from 'react';
type Job={id:string;state:string;prompt:string;result:{src:string;sha256:string;cloudTaskUrl:string;width:number;height:number;bytes:number}|null;};
export default function CloudProof(){
  const [job,setJob]=useState<Job|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(method='GET'){
    try{const response=await fetch('/api/cloud-proof',{method});const data=await response.json() as {job:Job|null;error?:string};if(!response.ok)throw new Error(data.error||'Cloud request failed.');setJob(data.job);setError('');}catch(e){setError(e instanceof Error?e.message:'Cloud request failed.');}
  }
  useEffect(()=>{load();const interval=setInterval(()=>load(),5000);return ()=>clearInterval(interval);},[]);
  async function queue(){setBusy(true);await load('POST');setBusy(false);}
  const imageStyle={width:'100%',aspectRatio:'9 / 7',objectFit:'contain' as const,background:'#ede9df',borderRadius:12};
  return <main style={{maxWidth:1080,margin:'64px auto',padding:'0 28px'}}>
    <a href="/">← Library</a><h1 style={{marginTop:32}}>OpenAI cloud proof</h1>
    <p>One public coffee sample. Native subscription image editing. Saved back to this private library.</p>
    <p><strong>{job?.state||'Not queued'}</strong> · {job?.id||'No task yet'}</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:24,margin:'28px 0'}}>
      <figure style={{margin:0}}><img src="/photos/1060.jpg" alt="Original public coffee sample" style={imageStyle}/><figcaption>Original · public sample</figcaption></figure>
      <figure style={{margin:0}}>{job?.result?<img src={job.result.src} alt="OpenAI cloud edited coffee result" style={imageStyle}/>:<div style={{...imageStyle,display:'grid',placeItems:'center'}}>Awaiting cloud result</div>}<figcaption>Layered paper · OpenAI subscription</figcaption></figure>
    </div>
    {!job&&<button disabled={busy} onClick={queue}>{busy?'Queuing…':'Queue public sample'}</button>}
    {job&&!job.result&&<p>This validation page queues the sample. The OpenAI cloud task must claim it; an automatic website trigger is not yet connected.</p>}
    {error&&<p role="alert">{error}</p>}
    {job?.result&&<><p>{job.result.width} × {job.result.height} · {Math.round(job.result.bytes/1024)} KB · Saved in library</p><p><a href={job.result.src+'?download=1'}>Download result</a> · <a href={job.result.cloudTaskUrl}>OpenAI cloud task</a></p><code style={{overflowWrap:'anywhere'}}>SHA-256 {job.result.sha256}</code></>}
  </main>;
}
