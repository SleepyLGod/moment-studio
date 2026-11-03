import React, {useEffect, useMemo, useState} from 'react';
import {CalendarDays, Check, ChevronDown, Columns3, Download, Folder, Grid2X2, Grid3X3, Info, Loader2, PanelsTopLeft, RefreshCw, Shuffle, SlidersHorizontal, Sparkles, X} from 'lucide-react';
import {Button, PhotoCard, SelectionDock} from './components';
import {CATEGORIES, categoryLabel, photoCount, photoSrc} from './data';
import {collageInputs} from './services/operations';
import {downloadFile, renderCollage} from './imaging';
import {monthTitle,photoDay} from './services/organization';

export function Library({photos,albums,tab,setTab,selected,selecting,setSelecting,onToggle,onPreview,onClear,filter,setFilter,onOrganize,onAlbum,onCollage,onLab,onOpenAlbum,onInfo,hasMore,onLoadMore,loading,visibleIds,photoTotal,onAnalyze,analyzing,modelCatalog,modelRefreshing,modelError,onRefreshModels,month,months,recent,onMonth,hasMoreMonths,onMoreMonths,onOpenGroup,collectionLoading,collectionError,onRefreshCollections,trashPhotos=[],trashMore=false,onMoreTrash,onTrash,onRestore}) {
  const visible=tab==='trash'?trashPhotos:photos.filter(p=>(!visibleIds||visibleIds.has(p.id))&&(filter==='all'||p.category===filter)&&(month==='all'||photoDay(p).startsWith(month)));
  const collectionTab=tab==='months'||tab==='recent';
  const currentModel=modelCatalog?.candidates.find(model=>model.id===modelCatalog.selectedModelId);
  const collectionMeta=tab==='months'?months.length+' months':tab==='recent'?recent.groups.length+' groups':tab==='trash'?photoCount(trashPhotos.length):tab==='albums'?albums.length+' albums':photoCount(photoTotal??visible.length);
  return <>
    <div className="section-title"><h1>Library</h1><span className="title-meta">{collectionMeta}</span>
      {onAnalyze&&<div className={'model-status '+(modelError?'has-error':'')} aria-label="AI model" title={modelError||((modelCatalog?.selectionReason==='last-success'?'Reusing last successful model':'Verified compatible profile')+' · '+(modelCatalog?.selectedModelId||'No compatible model')+' · Catalog: '+(modelCatalog?.checkedAt||'not refreshed'))}>
        <Sparkles size={14}/><span role="status">{modelRefreshing?'Refreshing…':modelError?'Refresh failed':currentModel?.label||'No model'}</span>
        <button className="icon-button" aria-label="Refresh AI models" onClick={onRefreshModels} disabled={modelRefreshing}><RefreshCw size={15} className={modelRefreshing?'spinning':''}/></button>
      </div>}
    </div>
    <div className="library-controls">
      <div className="text-tabs" role="tablist" aria-label="Library view">
        {[['photos','Photos'],['months','Months'],['recent','Recent'],['albums','Albums'],['trash','Trash']].map(([key,label])=><button key={key} role="tab" className={tab===key?'active':''} aria-selected={tab===key} onClick={()=>setTab(key)}>{label}</button>)}
      </div>
      {tab==='photos'||tab==='months'||tab==='trash'?<div className="library-actions">
        <select disabled={tab==='trash'} aria-label="Photo category" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All</option>{CATEGORIES.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
        {(tab==='photos'||tab==='trash')&&<button className="text-button" onClick={()=>{if(selecting){onClear();setSelecting(false);}else setSelecting(true);}}>{selecting?'Done':'Select'}</button>}
      </div>:tab==='recent'?<div className="library-actions recent-actions"><span>{recent.truncated?'Latest 300':'Last 30 days'}</span><button className="icon-button" aria-label="Refresh recent groups" onClick={onRefreshCollections} disabled={collectionLoading}><RefreshCw size={17} className={collectionLoading?'spinning':''}/></button></div>:<div className="library-actions"><button className="text-button" onClick={onOrganize}>Group</button><button className="text-button" onClick={()=>onAlbum(true)}>New album</button></div>}
    </div>
    {(tab==='photos'||tab==='trash')?<>
      {tab!=='trash'&&month!=='all'&&<button className="month-filter" onClick={()=>onMonth('all')} aria-label="Clear month filter"><CalendarDays size={16}/>{monthTitle(month)}<X size={14}/></button>}
      <div className="photo-grid">{visible.map(p=><PhotoCard key={p.id} photo={p} selected={selected.has(p.id)} selecting={selecting} onToggle={onToggle} onPreview={onPreview}/>)}</div>
      {(tab==='trash'?trashMore:hasMore)&&<div className="pagination"><Button disabled={loading} onClick={tab==='trash'?onMoreTrash:onLoadMore}>{loading?'Loading…':'Load more'}</Button></div>}
      {!visible.length&&<div className="empty-state"><Folder size={30}/><h2>{tab==='trash'?'Trash is empty':'No photos here'}</h2>{tab!=='trash'&&<Button onClick={()=>setFilter('all')}>View all photos</Button>}</div>}
    </>:collectionTab?<>
      {collectionError?<div className="empty-state" role="status"><p>{collectionError}</p><Button onClick={onRefreshCollections}>Try again</Button></div>:collectionLoading?<div className="collection-loading" role="status"><Loader2 size={21} className="spinning"/><span>Loading…</span></div>:tab==='months'?<>
        <div className="month-grid">{months.map(row=>{const cover=photos.find(photo=>photo.id===row.coverId);return <button className="month-card" key={row.month} onClick={()=>onMonth(row.month)} aria-label={'Open '+monthTitle(row.month)}>
          <div className="month-cover">{cover?<img src={photoSrc(cover)} alt=""/>:<CalendarDays size={30}/>}<span>{row.month.slice(5)}</span></div>
          <div className="album-caption"><h2>{monthTitle(row.month)}</h2><span>{row.count}</span></div>
        </button>;})}</div>
        {hasMoreMonths&&<div className="pagination"><Button disabled={loading} onClick={onMoreMonths}>More months</Button></div>}
        {!months.length&&<div className="empty-state"><CalendarDays size={30}/><h2>No photos yet</h2></div>}
      </>:<>
        <div className="album-grid recent-grid">{recent.groups.map(group=>{const members=group.photoIds.map(id=>photos.find(photo=>photo.id===id)).filter(Boolean);return <button key={group.id} className="album-card" onClick={()=>onOpenGroup(group)} aria-label={'Open group '+group.title+' '+group.day}>
          <div className="album-cover">{members.slice(0,3).map((photo,index)=><img key={photo.id} className={'cover-'+index} src={photoSrc(photo)} alt=""/>)}</div>
          <div className="album-caption"><h2>{group.title}</h2><span>{group.photoIds.length}</span></div><div className="group-meta"><time>{group.day}</time><span>{group.basis==='ai-tags'?'AI tags':'Date'}</span></div>
        </button>;})}</div>
        {!recent.groups.length&&<div className="empty-state"><Sparkles size={30}/><h2>No groups yet</h2><p>Photos from the last 30 days appear here.</p></div>}
      </>}
    </>:<div className="album-grid">{albums.map(a=>{
      const items=a.photoIds.map(id=>photos.find(p=>p.id===id)).filter(Boolean);
      return <button key={a.id} className="album-card" onClick={()=>onOpenAlbum(a.id)}>
        <div className="album-cover">{items.slice(0,3).map((p,i)=><img key={p.id} className={'cover-'+i} src={photoSrc(p)} alt={p.name}/>)}{!items.length&&<Folder size={28}/>}</div>
        <div className="album-caption"><h2>{a.title||'Untitled album'}</h2><span>{photoCount(a.photoIds.length)}</span></div>
      </button>;
    })}</div>}
    <footer className="workspace-footer"><button onClick={onInfo}>Demo <Info size={16}/></button></footer>
    <SelectionDock count={selected.size} onClear={onClear} onOrganize={onOrganize} onAlbum={()=>onAlbum(false)} onCollage={onCollage} onLab={onLab} onAnalyze={onAnalyze} analyzing={analyzing} onTrash={onTrash} onRestore={onRestore} trashed={tab==='trash'}/>
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

export function CollageView({photos,isExample,onChoose,onSave,toast,busy=false}) {
  const [layout,setLayout]=useState(()=>photos.length<=3?'editorial':photos.length<=4?'grid':'nine');
  const [gap,setGap]=useState(14),[title,setTitle]=useState('Mountains & water'),[background,setBackground]=useState('#f7f4ed');
  const [advanced,setAdvanced]=useState(false),[offset,setOffset]=useState(0),[result,setResult]=useState(null),[rendering,setRendering]=useState(false);
  const signature=photos.map(p=>p.id+':'+p.style).join('|');
  const used=useMemo(()=>collageInputs(photos,layout,offset),[signature,layout,offset]);
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
      <div className="collage-actions"><Button variant="primary" disabled={!result||rendering||busy} onClick={()=>onSave(result,title,used.map(p=>p.id))}>{busy?'Saving…':'Save collage'}</Button><Button icon={Download} disabled={!result||rendering} onClick={()=>{downloadFile(result,(title||'Moment collage')+'.jpg');toast('Download started');}}>Download</Button></div>
    </div>
    {photos.length>used.length&&<p className="editor-note">{used.length} / {photoCount(photos.length)} used in this layout.</p>}
    {advanced&&<section className="collage-adjustments" aria-label="Collage settings">
      <label className="field">Spacing <span className="muted">{gap}px</span><input type="range" min="0" max="48" value={gap} onChange={e=>setGap(Number(e.target.value))}/></label>
      <label className="field">Background<select value={background} onChange={e=>setBackground(e.target.value)}><option value="#f7f4ed">Paper</option><option value="#ffffff">White</option><option value="#22262d">Charcoal</option></select></label>
      <label className="field">Caption<input value={title} maxLength={40} placeholder="Optional" onChange={e=>setTitle(e.target.value)}/></label>
    </section>}

  </>;
}
