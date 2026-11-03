import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, Check, Download, ImagePlus, Loader2, FolderPlus, Tags, Trash2, Undo2, Upload, X} from 'lucide-react';
import {CATEGORIES, categoryLabel, photoCount, UPLOAD_SAMPLES, photoSrc, styleFor, assetUrl} from './data';
import {prepareSampleBatch} from './services/operations';
import {exportAlbum} from './imaging';
import {photoDay} from './services/organization';
import {canChoosePhoto,preparePhoto} from './services/import-photo';

export const NoticeContext=createContext('');

export function Button({icon: Icon, children, variant='', className='', ...props}) {
  return <button className={'button '+variant+' '+className} {...props}>{Icon && <Icon size={17} aria-hidden="true"/>}{children}</button>;
}
export function IconButton({icon: Icon, label, ...props}) {
  return <button className="icon-button" aria-label={label} title={label} {...props}><Icon size={19} aria-hidden="true"/></button>;
}
export function Modal({title, children, onClose, className=''}) {
  const ref=useRef(null);
  const notice=useContext(NoticeContext);
  useEffect(()=>{ref.current.showModal(); return ()=>ref.current?.close();},[]);
  return <dialog ref={ref} className={'modal '+className} aria-label={title}
    onCancel={e=>{e.preventDefault();onClose();}}
    onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header className="modal-header"><h2>{title}</h2><IconButton icon={X} label="Close" onClick={onClose}/></header>{notice&&<p className="modal-notice" role="status">{notice}</p>}{children}
  </dialog>;
}
export function Header({view,onView,onUpload}) {
  return <header className="topbar">
    <button className="brand" onClick={()=>onView('library')} aria-label="Moment home">moment</button>
    <nav aria-label="Main navigation">{[['library','Library'],['collage','Collage'],['lab','Style Lab']].map(([key,label])=>
      <button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>onView(key)}>{label}</button>)}</nav>
    <Button icon={Upload} onClick={onUpload}>Upload</Button>
  </header>;
}
export function PhotoCard({photo,selected,selecting,onToggle,onPreview}) {
  return <article className={'photo-card '+(selected?'selected ':'')+(selecting?'selecting':'')}>
    <button className="photo-image" aria-label={(selecting?'Toggle selection ':'Preview ')+photo.name} onClick={()=>selecting?onToggle(photo.id):onPreview(photo)}>
      <img src={assetUrl(photo.renderedSrc||photo.thumbnailSrc||photo.src)} alt={photo.name} loading="lazy" draggable="false"/>
    </button>
    <button className="photo-check" aria-label={(selected?'Deselect ':'Select ')+photo.name} aria-pressed={selected} onClick={()=>onToggle(photo.id)}>
      {selected && <Check size={16} aria-hidden="true"/>}
    </button>
  </article>;
}
export function SelectionDock({count,onClear,onOrganize,onAlbum,onCollage,onLab,onAnalyze,analyzing,onTrash,onRestore,trashed=false}) {
  if(!count)return null;
  return <div className="selection-dock" aria-label="Selection actions">
    <span>{count} selected</span><div className="dock-divider"/>
    {trashed?<button onClick={onRestore}><Undo2 size={16}/>Restore</button>:<><button onClick={onOrganize}><Tags size={16}/>Organize</button><button onClick={onAlbum}><FolderPlus size={16}/>Album</button>
    <button onClick={onCollage}>Collage</button><button onClick={onLab}>Style Lab</button>
    {onAnalyze&&<button onClick={onAnalyze} disabled={analyzing||count>20}>{analyzing?'Analyzing…':'AI tags'}</button>}{onTrash&&<button onClick={onTrash}><Trash2 size={16}/>Trash</button>}</>}
    <IconButton icon={X} label="Clear selection" onClick={onClear}/>
  </div>;
}
export function UploadDialog({cloud=false,onClose,onImport,toast}) {
  const [files,setFiles]=useState([]),[drag,setDrag]=useState(false),[busy,setBusy]=useState(false);
  const input=useRef(null),prepared=useRef(null),sampleBatch=useRef(null),inflight=useRef(false);
  function choose(list) {
    if(inflight.current)return;
    prepared.current=null;
    const good=[...list].filter(canChoosePhoto);
    if(good.length!==list.length)toast('Use HEIC, JPG, PNG or WebP files up to 12 MiB.');
    if(good.length>20)toast('Choose up to 20 photos at a time.');
    setFiles(good.slice(0,20));
  }
  async function submit() {
    if(inflight.current)return;inflight.current=true;setBusy(true);
    try {
      if(!prepared.current){
        const photos=[];
        for(const file of files){
          const record=await preparePhoto(file,{cloud});
          photos.push(record);
        }
        prepared.current=photos;
      }
      if(await onImport(prepared.current))onClose();
    } catch(error){toast(error.message);} finally{inflight.current=false;setBusy(false);}
  }
  async function samples() {
    if(inflight.current)return;inflight.current=true;setBusy(true);
    sampleBatch.current=prepareSampleBatch(sampleBatch.current);
    try{if(await onImport(sampleBatch.current))onClose();}finally{inflight.current=false;setBusy(false);}
  }
  return <Modal title="Upload photos" onClose={onClose} className="upload-modal">
    <div className={'dropzone '+(drag?'dragging':'')} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files);}}>
      <ImagePlus size={33} strokeWidth={1.3}/><h3>{files.length?files.length+' selected':'Drop your photos here'}</h3>
      <p>HEIC / JPG / PNG / WebP · up to 12 MiB each</p>
      <Button disabled={busy} onClick={()=>input.current.click()}>Browse files</Button>
      <input disabled={busy} ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple aria-label="Choose files to upload" className="file-input" onChange={e=>choose(e.target.files)}/>
      {!!files.length&&<div className="file-list">{files.map(f=><span key={f.name+f.size}>{f.name}</span>)}</div>}
    </div>
    <p className="muted small local-note">{cloud?'Saved to your private library.':'Stored in this browser.'}</p>
    <footer className="modal-footer"><button className="text-button" disabled={busy} onClick={samples}>Try 4 samples</button><Button variant="primary" disabled={!files.length||busy} icon={busy?Loader2:Upload} onClick={submit}>{busy?'Reading…':'Import'}</Button></footer>
  </Modal>;
}
const GROUP_TITLES={'旅行':'Mountains & sea','自然':'Into nature','城市':'City walks','日常':'Everyday light','人像':'People & places','创作':'New perspectives','待分类':'Unsorted'};
export function OrganizeDialog({photos,onClose,onSave,onAssign}) {
  const [mode,setMode]=useState('suggested');
  const [category,setCategory]=useState('旅行');
  const [groups,setGroups]=useState(()=>{
    const buckets=new Map();
    photos.forEach(p=>{const key=p.category&&p.category!=='待分类'?p.category:(p.demoCategory||'待分类');if(!buckets.has(key))buckets.set(key,{id:key,category:key,title:GROUP_TITLES[key]||key,photoIds:[]});buckets.get(key).photoIds.push(p.id);});
    return [...buckets.values()];
  });
  function movePhoto(id,target) {
    setGroups(current=>current.map(g=>({...g,photoIds:g.id===target?[...g.photoIds.filter(i=>i!==id),id]:g.photoIds.filter(i=>i!==id)})));
  }
  const nonempty=groups.filter(g=>g.photoIds.length);
  return <Modal title={'Organize '+photos.length+' photos'} onClose={onClose} className="organize-modal">
    <div className="text-tabs" role="tablist" aria-label="Organize mode">
      <button role="tab" aria-selected={mode==='suggested'} className={mode==='suggested'?'active':''} onClick={()=>setMode('suggested')}>By tags</button>
      <button role="tab" aria-selected={mode==='manual'} className={mode==='manual'?'active':''} onClick={()=>setMode('manual')}>Manual</button>
    </div>
    {mode==='suggested'?<>

      <div className="suggestion-groups">{groups.map(g=><section key={g.id} className="suggestion-group">
        <input aria-label={'Album name '+categoryLabel(g.category)} className="group-name" value={g.title} maxLength={48} onChange={e=>setGroups(gs=>gs.map(item=>item.id===g.id?{...item,title:e.target.value}:item))}/>
        <span className="muted small">{photoCount(g.photoIds.length)}</span>
        <div className="group-photos">{g.photoIds.map(id=>{const p=photos.find(photo=>photo.id===id);return <div key={id}><img src={photoSrc(p)} alt={p.name}/><select aria-label={'Group '+p.name} value={g.id} onChange={e=>movePhoto(id,e.target.value)}>{groups.map(target=><option key={target.id} value={target.id}>{target.title||'Untitled'}</option>)}</select></div>;})}</div>
        {!g.photoIds.length&&<p className="empty-group">Empty group</p>}
      </section>)}</div>
      <footer className="modal-footer"><span className="muted small">{nonempty.length} albums</span><Button variant="primary" disabled={!nonempty.length||nonempty.some(g=>!g.title.trim())} onClick={async()=>{if(await onSave(nonempty))onClose();}}>Create albums</Button></footer>
    </>:<>

      <div className="category-options">{CATEGORIES.filter(c=>c!=='待分类').map(c=><button aria-pressed={category===c} className={category===c?'chosen':''} key={c} onClick={()=>setCategory(c)}>{categoryLabel(c)}{category===c&&<Check size={15}/>}</button>)}</div>
      <footer className="modal-footer"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={async()=>{if(await onAssign(category,photos.map(p=>p.id)))onClose();}}>Apply category</Button></footer>
    </>}
  </Modal>;
}
export function AlbumDialog({albums,onClose,onSave}) {
  const [target,setTarget]=useState('new'),[title,setTitle]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
  const saveId=useRef(crypto.randomUUID());
  return <Modal title={'Add to album'} onClose={onClose}>
    <label className="field">Album<select value={target} onChange={e=>setTarget(e.target.value)}><option value="new">New album</option>{albums.map(a=><option key={a.id} value={a.id}>{a.title||'Untitled album'}</option>)}</select></label>
    {target==='new'&&<><label className="field">Album name<input value={title} maxLength={48} placeholder="Untitled album" onChange={e=>setTitle(e.target.value)}/></label><details className="optional-note"><summary>Add a note</summary><label className="field"><span className="sr-only">Note</span><textarea value={note} maxLength={400} onChange={e=>setNote(e.target.value)} placeholder="Add a note…"/></label></details></>}

    <footer className="modal-footer"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving||(target==='new'&&!title.trim())} onClick={async()=>{setSaving(true);try{if(await onSave({id:saveId.current,target,title:title.trim(),note}))onClose();}finally{setSaving(false);}}}>Save album</Button></footer>
  </Modal>;
}
export function PhotoPreview({photo,onClose,onTrash,onRestore}) {
  const [original,setOriginal]=useState(false);
  return <Modal title={photo.name} onClose={onClose} className="photo-modal">
    <img className="detail-photo" src={original?photoSrc({...photo,renderedSrc:null}):photoSrc(photo)} alt={photo.name+(original?' original preview':'')}/>
    <a className="button" href={assetUrl(photo.src)+(photo.src.startsWith('/api/files/')?'?download=1':'')} download={photo.originalMime==='image/heic'?photo.name+'.heic':photo.name}><Download size={17}/>Download original</a>
    {photo.aiTags?.length>0&&<div className="photo-tags" aria-label="AI tags">{photo.aiTags.map(tag=><span key={tag}>{tag}</span>)}</div>}
    <p className="photo-date" title={photo.metadataWarning||(photo.dateSource==='captured-local'?'Photo local time; timezone unknown':'Library calendar: Asia/Hong_Kong')}>{photoDay(photo)} · {{captured:'capture date','captured-local':'capture date · timezone unknown','file-modified':'file date',imported:'import date','record-date':'saved date'}[photo.dateSource]||'saved date'}{photo.metadataWarning?' · Metadata unavailable':''}</p>
    {(photo.trashedAt?onRestore:onTrash)&&<Button icon={photo.trashedAt?Undo2:Trash2} onClick={()=>photo.trashedAt?onRestore([photo.id]):onTrash([photo.id])}>{photo.trashedAt?'Restore':'Move to Trash'}</Button>}
    <div className="preview-caption"><span className="muted">{categoryLabel(photo.category)} · {original||photo.style==='original'?'Original':(photo.style==='generated'?photo.recipeName:(photo.recipeName?photo.recipeName+' · ':'')+styleFor(photo.style).name)}</span>{photo.generationSource==='pregenerated-demo'&&<span>Sample</span>}{photo.generationSource==='cloudflare-ai'&&<a className="button" href={assetUrl(photo.generationSrc)+'?download=1'} download>Download result</a>}{photo.style!=='original'&&<Button onClick={()=>setOriginal(v=>!v)}>{original?'View edit':'View original'}</Button>}</div>
  </Modal>;
}
export function RecentGroupDetail({group,photos,onClose,onPreview,onSelect}){
  const members=group.photoIds.map(id=>photos.find(photo=>photo.id===id)).filter(Boolean);
  return <Modal title={group.title} className="recent-detail" onClose={onClose}>
    <div className="recent-detail-meta"><span>{group.day} · {group.basis==='ai-tags'?'AI tags':'Same day'}</span><span>{photoCount(members.length)}</span></div>
    <div className="photo-grid">{members.map(photo=><button className="recent-photo" key={photo.id} aria-label={'Preview '+photo.name} onClick={()=>onPreview(photo)}><img src={photoSrc(photo)} alt={photo.name}/></button>)}</div>
    <footer className="modal-footer"><Button onClick={()=>onSelect(group.photoIds)}>Select photos</Button></footer>
  </Modal>;
}
export function AlbumDetail({album,photos,onClose,onUpdate,toast}) {
  const [editing,setEditing]=useState(false),[exporting,setExporting]=useState(false),[working,setWorking]=useState(false);
  const [draft,setDraft]=useState({title:album.title,note:album.note});
  useEffect(()=>{if(!editing)setDraft({title:album.title,note:album.note});},[album,editing]);
  const ordered=album.photoIds.map(id=>photos.find(p=>p.id===id)).filter(Boolean);
  async function update(next){if(working)return null;setWorking(true);try{return await onUpdate(next);}finally{setWorking(false);}}
  function move(id,step){const ids=[...album.photoIds],i=ids.indexOf(id),j=i+step;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];return update({...album,photoIds:ids});}
  return <Modal title={album.title||'Untitled album'} onClose={onClose} className="album-detail">
    <div className="album-tools"><span className="muted">{photoCount(ordered.length)}</span><div><button disabled={working||(editing&&!draft.title.trim())} className="text-button" onClick={async()=>{if(!editing)setEditing(true);else if(await update({...album,...draft}))setEditing(false);}}>{working?'Saving…':editing?'Save changes':'Edit'}</button><Button disabled={exporting||!ordered.length} icon={Download} onClick={async()=>{setExporting(true);try{await exportAlbum(album,ordered);toast('Download started');}catch(e){toast(e.message);}finally{setExporting(false);}}}>Export</Button></div></div>
    {editing?<div className="album-edit-fields"><label className="field">Album name<input value={draft.title} maxLength={48} onChange={e=>setDraft(d=>({...d,title:e.target.value}))}/></label><label className="field">Note<textarea value={draft.note} maxLength={400} onChange={e=>setDraft(d=>({...d,note:e.target.value}))}/></label></div>:album.note&&<p className="album-note">{album.note}</p>}
    <div className={'album-story-grid '+(editing?'editing':'')}>{ordered.map((p,i)=><figure key={p.id}><img src={photoSrc(p)} alt={p.name}/>{editing&&<figcaption><span>{p.name}</span><div><IconButton icon={ArrowUp} label={'Move up '+p.name} disabled={working||!i} onClick={()=>move(p.id,-1)}/><IconButton icon={ArrowDown} label={'Move down '+p.name} disabled={working||i===ordered.length-1} onClick={()=>move(p.id,1)}/><IconButton icon={X} disabled={working} label={'Remove '+p.name+' from album'} onClick={()=>update({...album,photoIds:album.photoIds.filter(id=>id!==p.id)})}/></div></figcaption>}</figure>)}</div>
    {!ordered.length&&<p className="muted empty-group">No photos in this album.</p>}
  </Modal>;
}
export function InfoDialog({onClose,credits,cloud=false}) {
  return <Modal title={cloud?"About your library":"About this demo"} onClose={onClose}>
    <div className="info-copy"><p>{cloud?"Photos, albums and styles are saved to your private library.":"Photos, albums and styles stay in this browser."}</p><p>Grouping uses existing tags. Collages are rendered locally. AI style images are pre-generated samples; live generation is not connected.</p><details><summary>Photo credits</summary><p>The fjord and style samples were AI-generated. Other demo photos come from Lorem Picsum / Unsplash.</p><ul>{credits.map(c=><li key={c.id}><a href={c.url} target="_blank" rel="noreferrer">{c.author} · {c.id}</a></li>)}</ul></details></div>
  </Modal>;
}
