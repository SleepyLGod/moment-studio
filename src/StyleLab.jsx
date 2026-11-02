import React, {useEffect, useRef, useState} from 'react';
import {Bookmark, Check, ChevronsLeftRight, ImagePlus, Info, Layers, X} from 'lucide-react';
import {Button, Modal} from './components';
import {STYLES, photoCount} from './data';
import {matchingRecipe, recipeSignature, sampleFor, LAB_RECIPES as STYLE_RECIPES} from './recipes';

export function StyleLab({photos,isExample,onChoose,savedStyles,onSaveStyle,onSaveResults,onApply,busy,toast}) {
  const [draft,setDraft]=useState(()=>({...STYLE_RECIPES[0]}));
  const [displayed,setDisplayed]=useState(()=>({...STYLE_RECIPES[0]}));
  const [activeId,setActiveId]=useState(null),[split,setSplit]=useState(38);
  const [dialog,setDialog]=useState(null),[styleName,setStyleName]=useState('');
  const [imageError,setImageError]=useState(false),[imageReady,setImageReady]=useState(false);
  const [basic,setBasic]=useState('film'),[imageAttempt,setImageAttempt]=useState(0);
  const referenceInput=useRef(null);
  const photo=photos.find(p=>p.id===activeId)||photos[0];
  const unchanged=recipeSignature(draft)===recipeSignature(displayed);
  const result=unchanged?sampleFor(photo,displayed):null;
  const eligible=sampleFor(photo,draft);
  const recipe=matchingRecipe(draft);
  const reusable=photos.filter(p=>sampleFor(p,draft));
  const title=draft.name||recipe?.name||'Custom style';
  useEffect(()=>{setImageError(false);setImageReady(false);},[result,imageAttempt]);
  useEffect(()=>{if(dialog)toast('');},[dialog,toast]);
  function loadStyle(item) {
    setDraft({...item});setDisplayed({...item});setSplit(38);
  }
  function preview() {
    if(!eligible){toast('No sample for this input. Save the style to generate later.');return;}
    setDisplayed({...draft});setSplit(38);setImageError(false);setImageAttempt(n=>n+1);
    toast('Sample loaded');
  }
  async function addReference(file) {
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('Use a JPG, PNG or WebP under 5 MB.');return;}
    try {
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the reference. Please try again.'));reader.readAsDataURL(file);});
      setDraft(d=>({...d,reference:{name:file.name,src}}));
    }catch(error){toast(error.message);}
  }
  function saveStyle(e) {
    e.preventDefault();
    if(!styleName.trim()||!draft.prompt.trim())return;
    const saved={...draft,id:crypto.randomUUID(),name:styleName.trim(),cover:result&&imageReady&&!imageError?result:null,createdAt:new Date().toISOString()};
    onSaveStyle(saved);setDraft(saved);setDisplayed(saved);
    setDialog(null);
  }
  function saveResults(items) {
    const count=onSaveResults(draft,items);
    if(count)setDialog(null);
  }
  return <>
    <div className="section-title"><h1>Style Lab</h1><button className="demo-info" onClick={()=>setDialog('info')} aria-label="About demo mode">Demo <Info size={14}/></button><button className="text-button title-action" onClick={()=>{toast('');onChoose();}}>Choose photos</button></div>
    {photo?<>
      <div className={'comparison prompt-comparison '+(!result?'no-result':'')}>
        <img src={photo.src} alt={photo.name+' original'}/>
        {result&&!imageError&&<div className="comparison-overlay" style={{clipPath:'inset(0 0 0 '+split+'%)'}}><img key={result+imageAttempt} src={result} alt={title+' sample'} onLoad={()=>setImageReady(true)} onError={()=>setImageError(true)}/></div>}
        <span className="comparison-label label-original">Original</span>
        {result&&!imageError?<>
          <span className="comparison-label label-style">{imageReady?'Preview':'Loading…'}</span>
          <div className="comparison-line" style={{left:split+'%'}}><span><ChevronsLeftRight size={19}/></span></div>
          <input type="range" min="0" max="100" step="1" aria-label="Compare original and sample" value={split} onChange={e=>setSplit(Number(e.target.value))}/>
        </>:<div className="pending-result" role="status"><span>{imageError?'Image unavailable':'Not generated'}</span><p>{imageError?'Try loading the preview again.':'Save this style to try later.'}</p></div>}
      </div>
      <div className="source-strip"><div className="source-photos" role="group" aria-label="Selected photos">{photos.map(p=><button key={p.id} aria-label={'Use '+p.name} aria-pressed={p.id===photo.id} onClick={()=>setActiveId(p.id)}><img src={p.src} alt=""/>{p.id===photo.id&&<span><Check size={12}/></span>}</button>)}</div><span className="source-count">{photoCount(photos.length)}</span></div>
      <div className="prompt-editor">
        <label htmlFor="creative-prompt" className="prompt-label sr-only">Describe a new look</label>
        <div className="prompt-main">
          <textarea id="creative-prompt" value={draft.prompt} maxLength={1500} rows={2} aria-describedby="prompt-status" onChange={e=>setDraft(d=>({...d,prompt:e.target.value}))}/>
          <div className="prompt-options"><label className="preserve-option"><input type="checkbox" checked={draft.preserve} onChange={e=>setDraft(d=>({...d,preserve:e.target.checked}))}/>Keep composition</label><details className="reference-details"><summary><ImagePlus size={16}/>Reference{draft.reference?' · added':''}</summary><div className="reference-content"><p>Saved with your style.</p><input ref={referenceInput} type="file" className="file-input" accept="image/jpeg,image/png,image/webp" onChange={e=>{addReference(e.target.files[0]);e.target.value='';}}/>{draft.reference?<div className="reference-selected"><img src={draft.reference.src} alt="Style reference"/><span>{draft.reference.name}</span><button aria-label="Remove reference" onClick={()=>setDraft(d=>({...d,reference:null}))}><X size={17}/></button></div>:<Button onClick={()=>referenceInput.current.click()}>Add reference</Button>}<span className="muted small">JPG / PNG / WebP，up to 5 MB</span></div></details></div>
        </div>
        <div className="prompt-actions"><Button variant="primary" disabled={!draft.prompt.trim()} onClick={preview}>{eligible?'Preview':'View status'}</Button><Button icon={Bookmark} aria-label="Save style" title="Save style" className="bookmark-action" disabled={!draft.prompt.trim()} onClick={()=>{setStyleName(recipe?draft.name:'Untitled style');setDialog('save');}}><span className="sr-only">Save style</span></Button></div>
      </div>
      <p id="prompt-status" className="prompt-status sr-only" role="status">{imageError?'Image unavailable. Please try again.':result?'Sample ready.':eligible?'Preview available.':'No sample for this input.'}</p>
      <section className="styles-library" aria-labelledby="my-styles-title">
        <div className="styles-heading"><h2 id="my-styles-title">Styles</h2><button className="text-button" disabled={!reusable.length||!draft.prompt.trim()} onClick={()=>setDialog('batch')}><Layers size={16}/>Apply to {photos.length}</button></div>
        <div className="recipe-grid">{[...STYLE_RECIPES,...savedStyles].map(item=>{
          const builtin=STYLE_RECIPES.some(s=>s.id===item.id);
          const cover=builtin?'/styles/'+item.id+'-fjord.png':item.cover;
          return <button key={item.id} className={'recipe-card '+(item.id===draft.id&&recipeSignature(item)===recipeSignature(draft)?'active':'')} aria-pressed={item.id===draft.id&&recipeSignature(item)===recipeSignature(draft)} onClick={()=>loadStyle(item)}>{cover?<img src={cover} alt={item.name+' preview'}/>:<div className="recipe-placeholder"><Bookmark size={22}/><span>Draft</span></div>}<span className="recipe-info"><strong>{item.name}</strong><small>{builtin?'':item.cover?'Saved':'Draft'}</small></span></button>;
        })}</div>
      </section>
      <div className="lab-secondary"><details className="basic-colors"><summary>Tone</summary><div className="basic-controls"><div role="group" aria-label="Tone">{STYLES.map(s=><button aria-pressed={basic===s.id} className={basic===s.id?'active':''} key={s.id} onClick={()=>setBasic(s.id)}>{{original:'Original',film:'Film',mono:'Mono',soft:'Soft'}[s.id]}</button>)}</div><Button disabled={busy} onClick={()=>onApply(basic,photos.map(p=>p.id))}>{busy?'Applying…':'Apply tone'}</Button><p>Color adjustments only.</p></div></details><button className="text-button" disabled={!result||!imageReady||imageError} onClick={()=>saveResults([photo])}>Save image</button></div>
    </>:<div className="empty-state"><h2>Choose a photo</h2><Button onClick={onChoose}>Choose photos</Button></div>}
    {dialog==='info'&&<Modal title="Demo mode" onClose={()=>setDialog(null)}><p className="info-copy">These images were generated in advance. Three photos, three styles. Custom prompts and references can be saved, but live generation is not connected.</p></Modal>}
    {dialog==='save'&&<Modal title="Save style" onClose={()=>setDialog(null)} className="save-style-modal"><form onSubmit={saveStyle}><label className="field">Style name<input autoFocus value={styleName} maxLength={40} onChange={e=>setStyleName(e.target.value)} required/></label><div className="recipe-summary"><p>{draft.prompt}</p><span>{draft.preserve?'Keep composition':'Free composition'}{draft.reference?' · Reference attached':''}</span><small>{result?'Recipe and preview will be saved.':'Recipe only. Image not generated.'}</small></div><footer className="modal-footer"><Button type="button" onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={!styleName.trim()}>Save style</Button></footer></form></Modal>}
    {dialog==='batch'&&<Modal title="Apply style" onClose={()=>setDialog(null)} className="batch-style-modal"><p className="batch-description">{title} · {reusable.length} of {photos.length} samples available.</p><div className="batch-list">{photos.map(p=>{const src=sampleFor(p,draft);return <div key={p.id}><img src={p.src} alt={p.name}/><span>{p.name}<small>{src?'Sample ready':'No sample'}</small></span>{src?<img src={src} alt={p.name+' sample'}/>:<span className="batch-unavailable">Draft</span>}</div>;})}</div><p className="muted small">Available for the three demo photos. Originals stay untouched.</p><footer className="modal-footer"><Button onClick={()=>setDialog(null)}>Cancel</Button><Button variant="primary" disabled={!reusable.length} onClick={()=>saveResults(reusable)}>Save {reusable.length} images</Button></footer></Modal>}
  </>;
}
