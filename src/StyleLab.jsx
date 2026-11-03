import {readPhotoSize,validateOutputSize,fitOutputSize,editSignature} from './services/output-size';
import React, {useEffect, useRef, useState} from 'react';
import {Bookmark, Check, ChevronsLeftRight, ImagePlus, Info, Layers, X} from 'lucide-react';
import {Button, Modal} from './components';
import {prepareStyleSave} from './services/operations';
import {STYLES, photoCount, assetUrl,originalDisplaySrc} from './data';
import {matchingRecipe, recipeSignature, sampleFor, LAB_RECIPES as STYLE_RECIPES} from './recipes';

export function StyleLab({photos,isExample,onChoose,savedStyles,onSaveStyle,onSaveResults,onApply,onGenerate,onOpenEdit,editJobs=[],editProblem='',busy,toast}) {
  const [draft,setDraft]=useState(()=>({...STYLE_RECIPES[0]}));
  const [displayed,setDisplayed]=useState(()=>({...STYLE_RECIPES[0]}));
  const [activeId,setActiveId]=useState(null),[split,setSplit]=useState(38);
  const [dialog,setDialog]=useState(null),[styleName,setStyleName]=useState('');
  const [saving,setSaving]=useState(false),pendingStyle=useRef(null);
  const [imageError,setImageError]=useState(false),[imageReady,setImageReady]=useState(false);
  const [basic,setBasic]=useState('film'),[imageAttempt,setImageAttempt]=useState(0);
  const referenceInput=useRef(null);
  const [output,setOutput]=useState({mode:'original'}),[sourceSize,setSourceSize]=useState(null),[sizeError,setSizeError]=useState('');
  const photo=photos.find(p=>p.id===activeId)||photos[0];
  const live=Boolean(onGenerate),job=live?editJobs.find(item=>item.photoId===photo?.id&&item.recipeSignature===editSignature(draft,output)):null;
  let outputProblem=output.mode==='original'?sizeError:'';if(live&&!outputProblem)try{validateOutputSize(output.mode==='original'?sourceSize:output);}catch(error){outputProblem=error.message;}
  useEffect(()=>{let active=true;setSourceSize(null);setSizeError('');if(photo)readPhotoSize(photo).then(size=>{if(active)setSourceSize(size);}).catch(error=>{if(active)setSizeError(error.message);});return ()=>{active=false;};},[photo?.id,photo?.src]);
  const pending=job&&['queued','running','unknown'].includes(job.state);
  const unchanged=recipeSignature(draft)===recipeSignature(displayed);
  const result=live?(job?.state==='succeeded'?job.result.src:null):(unchanged?sampleFor(photo,displayed):null);
  const eligible=sampleFor(photo,draft);
  const recipe=matchingRecipe(draft);
  const reusable=photos.filter(p=>live?(p.kind||'photo')==='photo':sampleFor(p,draft));
  const batchPending=live&&reusable.some(photo=>editJobs.some(item=>item.photoId===photo.id&&item.recipeSignature===editSignature(draft,output)&&['queued','running','unknown'].includes(item.state)));
  const title=draft.name||recipe?.name||'Custom style';
  useEffect(()=>{setImageError(false);setImageReady(false);},[result,imageAttempt]);
  useEffect(()=>{if(dialog)toast('');if(dialog!=='save')pendingStyle.current=null;},[dialog,toast]);
  function loadStyle(item) {
    setDraft({...item});setDisplayed({...item});setSplit(38);
  }
  function preview() {
    if(live){void generate([photo.id]);return;}
    if(!eligible){toast('No sample for this input. Save the style to generate later.');return;}
    setDisplayed({...draft});setSplit(38);setImageError(false);setImageAttempt(n=>n+1);
    toast('Sample loaded');
  }
  async function generate(ids){const signature=recipeSignature(draft);setDisplayed({...draft});const jobs=await onGenerate(draft,ids,output);if(jobs?.[0])setDraft(current=>recipeSignature(current)===signature?{...current,reference:jobs[0].recipe.reference}:current);}
  async function addReference(file) {
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('Use a JPG, PNG or WebP under 5 MB.');return;}
    try {
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});let src;const canvas=document.createElement('canvas');
      try{const scale=Math.min(1,480/bitmap.width,480/bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);src=canvas.toDataURL('image/jpeg',.85);}finally{bitmap.close();canvas.width=1;canvas.height=1;}
      setDraft(d=>({...d,reference:{name:file.name,src}}));
    }catch(error){toast(error.message);}
  }
  async function saveStyle(e) {
    e.preventDefault();
    if(!styleName.trim()||!draft.prompt.trim())return;
    if(saving)return;setSaving(true);
    const saved=prepareStyleSave(draft,styleName,result&&imageReady&&!imageError?result:null,pendingStyle.current);pendingStyle.current=saved;
    try{const confirmed=await onSaveStyle(saved);if(confirmed){setDraft(confirmed);setDisplayed(confirmed);setDialog(null);pendingStyle.current=null;}}finally{setSaving(false);}
  }
  async function saveResults(items) {
    if(saving||busy)return;setSaving(true);
    const count=await onSaveResults(draft,items);setSaving(false);
    if(count)setDialog(null);
  }
  return <>
    <div className="section-title"><h1>Style Lab</h1><button className="demo-info" onClick={()=>setDialog('info')} aria-label={live?'About live image editing':'About demo mode'}>{live?'Live AI':'Demo'} <Info size={14}/></button><button className="text-button title-action" onClick={()=>{toast('');onChoose();}}>Choose photos</button></div>
    {photo?<>
      <div className={'comparison prompt-comparison '+(!result?'no-result':'')} style={sourceSize?{aspectRatio:sourceSize.width+'/'+sourceSize.height,width:'min(100%, '+(68*sourceSize.width/sourceSize.height)+'vh)',marginInline:'auto'}:undefined}>
        <img src={assetUrl(originalDisplaySrc(photo))} alt={photo.name+' original'}/>
        {result&&!imageError&&<div className="comparison-overlay" style={{clipPath:'inset(0 0 0 '+split+'%)'}}><img key={result+imageAttempt} src={assetUrl(result)} alt={title+(live?' AI result':' sample')} onLoad={()=>setImageReady(true)} onError={()=>setImageError(true)}/></div>}
        <span className="comparison-label label-original">Original</span>
        {result&&!imageError?<>
          <span className="comparison-label label-style">{imageReady?'Preview':'Loading…'}</span>
          <div className="comparison-line" style={{left:split+'%'}}><span><ChevronsLeftRight size={19}/></span></div>
          <input type="range" min="0" max="100" step="1" aria-label={live?"Compare original and result":"Compare original and sample"} value={split} onChange={e=>setSplit(Number(e.target.value))}/>
        </>:<div className="pending-result" role="status"><span>{imageError?'Image unavailable':job?.state==='queued'?'Queued':job?.state==='running'?'Generating…':job?.state==='unknown'?'Result unknown':job?.state==='failed'?'Could not generate':'Not generated'}</span><p>{imageError?'Try loading the preview again.':editProblem||((job?.state==='failed'||job?.state==='unknown')?(job.errorCode==='FREE_QUOTA_EXCEEDED'?'Daily free quota used. Try tomorrow.':job.state==='unknown'?'Not retried automatically.':job.errorCode):live?'Enter a prompt to create a new image.':'Save this style to try later.')}</p></div>}
      </div>
      <div className="source-strip"><div className="source-photos" role="group" aria-label="Selected photos">{photos.map(p=><button key={p.id} aria-label={'Use '+p.name} aria-pressed={p.id===photo.id} onClick={()=>setActiveId(p.id)}><img src={assetUrl(originalDisplaySrc(p))} alt=""/>{p.id===photo.id&&<span><Check size={12}/></span>}</button>)}</div><span className="source-count">{photoCount(photos.length)}</span></div>
      <div className="prompt-editor">
        <label htmlFor="creative-prompt" className="prompt-label sr-only">Describe a new look</label>
        <div className="prompt-main">
          <textarea id="creative-prompt" value={draft.prompt} maxLength={1500} rows={2} aria-describedby="prompt-status" onChange={e=>setDraft(d=>({...d,prompt:e.target.value}))}/>
          <div className="prompt-options"><label className="preserve-option"><input type="checkbox" checked={draft.preserve} onChange={e=>setDraft(d=>({...d,preserve:e.target.checked}))}/>Keep composition</label><details className="reference-details"><summary><ImagePlus size={16}/>Reference{draft.reference?' · added':''}</summary><div className="reference-content"><p>Saved with your style.</p><input ref={referenceInput} type="file" className="file-input" accept="image/jpeg,image/png,image/webp" onChange={e=>{addReference(e.target.files[0]);e.target.value='';}}/>{draft.reference?<div className="reference-selected"><img src={draft.reference.src} alt="Style reference"/><span>{draft.reference.name}</span><button aria-label="Remove reference" onClick={()=>setDraft(d=>({...d,reference:null}))}><X size={17}/></button></div>:<Button onClick={()=>referenceInput.current.click()}>Add reference</Button>}<span className="muted small">JPG / PNG / WebP，up to 5 MB</span></div></details></div>
        </div>
        <div className="prompt-actions"><Button variant="primary" disabled={!draft.prompt.trim()||(live&&(busy||pending||Boolean(outputProblem)||(photo?.kind||'photo')!=='photo'))} onClick={preview}>{live?(pending?'In progress':'Generate'):eligible?'Preview':'View status'}</Button><Button icon={Bookmark} aria-label="Save style" title="Save style" className="bookmark-action" disabled={!draft.prompt.trim()} onClick={()=>{setStyleName(recipe?draft.name:'Untitled style');setDialog('save');}}><span className="sr-only">Save style</span></Button></div>
      </div>
      <p id="prompt-status" className="prompt-status sr-only" role="status">{imageError?'Image unavailable. Please try again.':live?(result?'Image saved.':pending?'Generation in progress.':'Ready to generate.'):result?'Sample ready.':eligible?'Preview available.':'No sample for this input.'}</p>
      {live&&<div className="output-controls" aria-label="Output dimensions"><label>Size<select aria-label="Output size mode" value={output.mode} onChange={e=>setOutput(e.target.value==='original'?{mode:'original'}:{mode:'custom',width:sourceSize?.width||'',height:sourceSize?.height||''})}><option value="original">Original{sourceSize?' · '+sourceSize.width+' × '+sourceSize.height:''}</option><option value="custom">Custom</option></select></label>{output.mode==='custom'&&<div className="dimension-inputs"><input aria-label="Output width" type="number" min="256" max="2048" step="16" value={output.width} onChange={e=>setOutput(current=>({...current,width:e.target.value===''?'':Number(e.target.value)}))}/><span>×</span><input aria-label="Output height" type="number" min="256" max="2048" step="16" value={output.height} onChange={e=>setOutput(current=>({...current,height:e.target.value===''?'':Number(e.target.value)}))}/></div>}<div className="size-presets">{[1024,2048].map(max=><button key={max} className="text-button" disabled={!sourceSize} onClick={()=>{try{setOutput({mode:'custom',...fitOutputSize(sourceSize,max)});}catch(error){toast(error.message);}}}>{max===1024?'1K':'2K'} · match ratio</button>)}</div>{outputProblem&&<p className="size-error" role="status">{outputProblem}</p>}</div>}
      <section className="styles-library" aria-labelledby="my-styles-title">
        <div className="styles-heading"><h2 id="my-styles-title">Styles</h2><button className="text-button" disabled={!reusable.length||reusable.length>20||!draft.prompt.trim()||(live&&(busy||batchPending||Boolean(outputProblem)))} onClick={()=>live?generate(reusable.map(p=>p.id)):setDialog('batch')}><Layers size={16}/>Apply to {photos.length}</button></div>
        <div className="recipe-grid">{[...STYLE_RECIPES,...savedStyles].map(item=>{
          const builtin=STYLE_RECIPES.some(s=>s.id===item.id);
          const cover=builtin?'/styles/'+item.id+'-fjord.png':item.cover;
          return <button key={item.id} className={'recipe-card '+(item.id===draft.id&&recipeSignature(item)===recipeSignature(draft)?'active':'')} aria-pressed={item.id===draft.id&&recipeSignature(item)===recipeSignature(draft)} onClick={()=>loadStyle(item)}>{cover?<img src={assetUrl(cover)} alt={item.name+' preview'}/>:<div className="recipe-placeholder"><Bookmark size={22}/><span>Draft</span></div>}<span className="recipe-info"><strong>{item.name}</strong><small>{builtin?'':item.cover?'Saved':'Draft'}</small></span></button>;
        })}</div>
      </section>
      {live&&editJobs.length>0&&<section className="styles-library" aria-label="Recent image edits"><div className="styles-heading"><h2>Recent</h2></div><div className="recipe-grid">{editJobs.slice(0,4).map(item=><button key={item.id} className="recipe-card" onClick={()=>{loadStyle(item.recipe);setOutput(item.outputChoice||{mode:'custom',width:512,height:512});setActiveId(item.photoId);void onOpenEdit(item);}}>{item.state==='succeeded'?<img src={assetUrl(item.result.src)} alt={item.recipe.name+' result'}/>:<div className="recipe-placeholder"><Layers size={22}/></div>}<span className="recipe-info"><strong>{item.recipe.name}</strong><small>{{queued:'Queued',running:'Generating…',succeeded:'Saved',failed:'Failed',unknown:'Result unknown',cancelled:'Cancelled'}[item.state]}</small></span></button>)}</div></section>}
      <div className="lab-secondary"><details className="basic-colors"><summary>Tone</summary><div className="basic-controls"><div role="group" aria-label="Tone">{STYLES.map(s=><button aria-pressed={basic===s.id} className={basic===s.id?'active':''} key={s.id} onClick={()=>setBasic(s.id)}>{{original:'Original',film:'Film',mono:'Mono',soft:'Soft'}[s.id]}</button>)}</div><Button disabled={busy} onClick={()=>onApply(basic,photos.map(p=>p.id))}>{busy?'Applying…':'Apply tone'}</Button><p>Color adjustments only.</p></div></details>{!live&&<button className="text-button" disabled={!result||!imageReady||imageError||saving||busy} onClick={()=>saveResults([photo])}>Save image</button>}</div>
    </>:<div className="empty-state"><h2>Choose a photo</h2><Button onClick={onChoose}>Choose photos</Button></div>}
    {dialog==='info'&&<Modal title={live?'Live image editing':'Demo mode'} onClose={()=>setDialog(null)}><p className="info-copy">{live?'FLUX.2 Klein 4B. Output dimensions are chosen explicitly; unsupported original sizes are not resized automatically. Results are saved as new images. Originals stay untouched. Background tasks continue when this page is closed.':'These images were generated in advance. Three photos, three styles. Custom prompts and references can be saved, but live generation is not connected.'}</p></Modal>}
    {dialog==='save'&&<Modal title="Save style" onClose={()=>setDialog(null)} className="save-style-modal"><form onSubmit={saveStyle}><label className="field">Style name<input autoFocus value={styleName} maxLength={40} onChange={e=>{setStyleName(e.target.value);pendingStyle.current=null;}} required/></label><div className="recipe-summary"><p>{draft.prompt}</p><span>{draft.preserve?'Keep composition':'Free composition'}{draft.reference?' · Reference attached':''}</span><small>{result?'Recipe and preview will be saved.':'Recipe only. Image not generated.'}</small></div><footer className="modal-footer"><Button type="button" onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={!styleName.trim()||saving}>Save style</Button></footer></form></Modal>}
    {dialog==='batch'&&<Modal title="Apply style" onClose={()=>setDialog(null)} className="batch-style-modal"><p className="batch-description">{title} · {reusable.length} of {photos.length} samples available.</p><div className="batch-list">{photos.map(p=>{const src=sampleFor(p,draft);return <div key={p.id}><img src={assetUrl(originalDisplaySrc(p))} alt={p.name}/><span>{p.name}<small>{src?'Sample ready':'No sample'}</small></span>{src?<img src={assetUrl(src)} alt={p.name+' sample'}/>:<span className="batch-unavailable">Draft</span>}</div>;})}</div><p className="muted small">Available for the three demo photos. Originals stay untouched.</p><footer className="modal-footer"><Button onClick={()=>setDialog(null)}>Cancel</Button><Button variant="primary" disabled={!reusable.length||saving||busy} onClick={()=>saveResults(reusable)}>Save {reusable.length} images</Button></footer></Modal>}
  </>;
}
