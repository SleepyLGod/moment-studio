import React, {useEffect, useMemo, useState} from 'react';
import {Check, ChevronDown, Columns3, Download, Folder, Grid2X2, Grid3X3, Info, Loader2, PanelsTopLeft, Shuffle, SlidersHorizontal} from 'lucide-react';
import {Button, PhotoCard, SelectionDock} from './components';
import {CATEGORIES, categoryLabel, photoCount, photoSrc} from './data';
import {downloadFile, renderCollage} from './imaging';

export function Library({photos,albums,tab,setTab,selected,selecting,setSelecting,onToggle,onPreview,onClear,filter,setFilter,onOrganize,onAlbum,onCollage,onLab,onOpenAlbum,onInfo,hasMore,onLoadMore,loading}) {
  const visible=photos.filter(p=>filter==='all'||p.category===filter);
  return <>
    <div className="section-title"><h1>Library</h1><span className="title-meta">{photoCount(photos.length)}</span></div>
    <div className="library-controls">
      <div className="text-tabs" role="tablist" aria-label="Library view">
        <button role="tab" className={tab==='photos'?'active':''} aria-selected={tab==='photos'} onClick={()=>setTab('photos')}>Photos</button>
        <button role="tab" className={tab==='albums'?'active':''} aria-selected={tab==='albums'} onClick={()=>setTab('albums')}>Albums</button>
      </div>
      {tab==='photos'?<div className="library-actions">
        <select aria-label="Photo category" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All</option>{CATEGORIES.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
        <button className="text-button" onClick={()=>{if(selecting){onClear();setSelecting(false);}else setSelecting(true);}}>{selecting?'Done':'Select'}</button>
      </div>:<div className="library-actions"><button className="text-button" onClick={onOrganize}>Group</button><button className="text-button" onClick={()=>onAlbum(true)}>New album</button></div>}
    </div>
    {tab==='photos'?<>
      <div className="photo-grid">{visible.map(p=><PhotoCard key={p.id} photo={p} selected={selected.has(p.id)} selecting={selecting} onToggle={onToggle} onPreview={onPreview}/>)}</div>
      {hasMore&&<div className="pagination"><Button disabled={loading} onClick={onLoadMore}>{loading?'Loading…':'Load more'}</Button></div>}
      {!visible.length&&<div className="empty-state"><Folder size={30}/><h2>No photos here</h2><Button onClick={()=>setFilter('all')}>View all photos</Button></div>}
    </>:<div className="album-grid">{albums.map(a=>{
      const items=a.photoIds.map(id=>photos.find(p=>p.id===id)).filter(Boolean);
      return <button key={a.id} className="album-card" onClick={()=>onOpenAlbum(a.id)}>
        <div className="album-cover">{items.slice(0,3).map((p,i)=><img key={p.id} className={'cover-'+i} src={photoSrc(p)} alt={p.name}/>)}{!items.length&&<Folder size={28}/>}</div>
        <div className="album-caption"><h2>{a.title||'Untitled album'}</h2><span>{photoCount(items.length)}</span></div>
      </button>;
    })}</div>}
    <footer className="workspace-footer"><button onClick={onInfo}>Demo <Info size={16}/></button></footer>
    <SelectionDock count={selected.size} onClear={onClear} onOrganize={onOrganize} onAlbum={()=>onAlbum(false)} onCollage={onCollage} onLab={onLab}/>
  </>;
}

export function PhotoPicker({photos,onClose,onConfirm,initial=[]}) {
  const [selected,setSelected]=useState(()=>new Set(initial));
  function toggle(id){setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});}
  return <div className="picker-content">
    <p className="muted small">{selected.size} selected</p>
    <div className="picker-grid">{photos.map(p=><button key={p.id} className={selected.has(p.id)?'chosen':''} aria-label={'Select '+p.name} aria-pressed={selected.has(p.id)} onClick={()=>toggle(p.id)}><img src={photoSrc(p)} alt={p.name}/><span>{selected.has(p.id)&&<Check size={15}/>}</span></button>)}</div>
    <footer className="modal-footer"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!selected.size} onClick={()=>onConfirm([...selected])}>Use {selected.size} photos</Button></footer>
  </div>;
}

const LAYOUT_MAX={editorial:3,grid:4,nine:9,strip:6};
export function CollageView({photos,isExample,onChoose,onSave,toast,busy=false}) {
  const [layout,setLayout]=useState(()=>photos.length<=3?'editorial':photos.length<=4?'grid':'nine');
  const [gap,setGap]=useState(14),[title,setTitle]=useState('Mountains & water'),[background,setBackground]=useState('#f7f4ed');
  const [advanced,setAdvanced]=useState(false),[offset,setOffset]=useState(0),[result,setResult]=useState(null),[rendering,setRendering]=useState(false);
  const signature=photos.map(p=>p.id+':'+p.style).join('|');
  const ordered=useMemo(()=>photos.length?[...photos.slice(offset%photos.length),...photos.slice(0,offset%photos.length)]:[],[signature,offset]);
  const used=ordered.slice(0,LAYOUT_MAX[layout]);
  useEffect(()=>{
    let live=true;setRendering(true);
    renderCollage(used,{layout,gap,title,background}).then(value=>{if(live)setResult(value);}).catch(error=>{if(live){setResult(null);toast(error.message);}}).finally(()=>{if(live)setRendering(false);});
    return ()=>{live=false;};
  },[signature,layout,gap,title,background,offset]);
  return <>
    <div className="section-title"><h1>Collage</h1><span className="title-meta">{photoCount(photos.length)}</span><button className="text-button title-action" onClick={onChoose}>Choose photos</button></div>
    <div className="collage-stage">{result?<img src={result} alt="Collage preview"/>:<div className="empty-state"><Loader2 size={24}/><p>{photos.length?'Arranging…':'Choose photos'}</p></div>}{rendering&&result&&<span className="rendering-status"><Loader2 size={15}/>Updating…</span>}</div>
    <div className="collage-toolbar">
      <div className="layout-options" role="group" aria-label="Collage layout"><span className="sr-only">Layout</span>{[['editorial','Editorial',PanelsTopLeft],['grid','Grid',Grid2X2],['strip','Strip',Columns3],...(photos.length>4?[['nine','Nine',Grid3X3]]:[])].map(([id,label,Icon])=><button title={label} aria-label={label} key={id} aria-pressed={layout===id} className={layout===id?'active':''} onClick={()=>setLayout(id)}><Icon size={23}/></button>)}</div>
      <button title="Shuffle" aria-label="Shuffle" className="text-button shuffle-action" onClick={()=>setOffset(o=>o+1)} disabled={photos.length<2}><Shuffle size={18}/></button>
      <button className="text-button" aria-expanded={advanced} onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={17}/> <span>Adjust</span> <ChevronDown size={14} className={advanced?'rotated':''}/></button>
      <div className="collage-actions"><Button variant="primary" disabled={!result||rendering||busy} onClick={()=>onSave(result,title)}>{busy?'Saving…':'Save collage'}</Button><Button icon={Download} disabled={!result||rendering} onClick={()=>{downloadFile(result,(title||'Moment collage')+'.jpg');toast('Download started');}}>Download</Button></div>
    </div>
    {photos.length>used.length&&<p className="editor-note">{used.length} / {photoCount(photos.length)} used in this layout.</p>}
    {advanced&&<section className="collage-adjustments" aria-label="Collage settings">
      <label className="field">Spacing <span className="muted">{gap}px</span><input type="range" min="0" max="48" value={gap} onChange={e=>setGap(Number(e.target.value))}/></label>
      <label className="field">Background<select value={background} onChange={e=>setBackground(e.target.value)}><option value="#f7f4ed">Paper</option><option value="#ffffff">White</option><option value="#22262d">Charcoal</option></select></label>
      <label className="field">Caption<input value={title} maxLength={40} placeholder="Optional" onChange={e=>setTitle(e.target.value)}/></label>
    </section>}

  </>;
}
