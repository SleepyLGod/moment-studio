'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {CheckCircle2, Loader2} from 'lucide-react';
import {AlbumDetail, AlbumDialog, Header, InfoDialog, Modal, NoticeContext, OrganizeDialog, PhotoPreview, UploadDialog} from './components';
import {CollageView, Library, PhotoPicker} from './views';
import {categoryLabel, freshState, assetUrl} from './data';
import {StyleLab} from './StyleLab';
import {makeSampleDerivative, recipeSignature, sampleFor} from './recipes';
import {persistState, readSavedState} from './storage';
import {renderStyle} from './imaging';
import {createCloudLibrary} from './services/cloud';

export default function App({mode="demo"}) {
  const cloud=mode==='cloud';
  const client=useMemo(()=>cloud?createCloudLibrary():null,[cloud]);
  const [state,setState]=useState(()=>cloud?{photos:[],albums:[],savedStyles:[]}:freshState());
  const stateRef=useRef(state),queue=useRef(Promise.resolve()),collageSave=useRef(null);
  const [ready,setReady]=useState(false),[bootError,setBootError]=useState(null),[hasMore,setHasMore]=useState(false);
  const [view,setView]=useState('library'),[tab,setTab]=useState('photos'),[filter,setFilter]=useState('all');
  const [selected,setSelected]=useState(()=>new Set()),[selecting,setSelecting]=useState(false);
  const [modal,setModal]=useState(null),[preview,setPreview]=useState(null),[albumId,setAlbumId]=useState(null);
  const [notice,setNotice]=useState(''),[saveProblem,setSaveProblem]=useState(false),[credits,setCredits]=useState([]);
  const [busy,setBusy]=useState(false),[pickerNext,setPickerNext]=useState(null);
  const toast=useCallback(message=>setNotice(message),[]);
  function change(update){const next=typeof update==='function'?update(stateRef.current):update;stateRef.current=next;setState(next);}
  function upsert(key,item){change(s=>({...s,[key]:s[key].some(p=>p.id===item.id)?s[key].map(p=>p.id===item.id?item:p):[item,...s[key]]}));}
  function execute(work){
    const operation=queue.current.then(async()=>{setBusy(true);try{const result=await work();setSaveProblem(false);return result;}catch(error){setSaveProblem(true);toast(error.message);return null;}finally{setBusy(false);}});
    queue.current=operation;return operation;
  }
  useEffect(()=>{
    let live=true;
    (cloud?client.load():readSavedState()).then(saved=>{if(live){if(saved)change({...saved,savedStyles:saved.savedStyles||[]});setHasMore(client?.hasMore()||false);setReady(true);}})
      .catch(error=>{if(live)setBootError(error);});
    fetch(assetUrl('/photos/credits.json')).then(r=>{if(!r.ok)throw new Error('Photo credits could not load.');return r.json();}).then(rows=>{if(live)setCredits(rows.filter(c=>String(c.id)!=='1015'));}).catch(error=>{if(live)toast(error.message);});
    return ()=>{live=false;};
  },[client,cloud]);
  useEffect(()=>{if(!ready||cloud)return;persistState(state).then(()=>setSaveProblem(false)).catch(()=>setSaveProblem(true));},[state,ready,cloud]);
  useEffect(()=>{if(modal||preview||albumId)setNotice('');},[modal,preview,albumId]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4600);return ()=>clearTimeout(timer);},[notice]);
  const photos=state.photos;
  const chosen=useMemo(()=>photos.filter(p=>selected.has(p.id)),[photos,selected]);
  const examples=useMemo(()=>{const found=['1015','1043','1011'].map(id=>photos.find(p=>p.id===id)).filter(Boolean);return found.length?found:photos.slice(0,3);},[photos]);
  const workPhotos=chosen.length?chosen:examples;
  const labPhotos=chosen.length?chosen:['1015','1067','1060'].map(id=>photos.find(p=>p.id===id)).filter(Boolean);
  function clear(){setSelected(new Set());}
  function toggle(id){setSelecting(true);setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});}
  async function savePhoto(photo){return cloud?client.savePhoto(photo):photo;}
  async function saveAlbumRecord(album){return cloud?client.saveAlbum(album):album;}
  function importPhotos(items){return execute(async()=>{
    const saved=[];for(const photo of items){const item=await savePhoto(photo);upsert('photos',item);saved.push(item);}
    setSelected(new Set(saved.map(p=>p.id)));setSelecting(true);setFilter('all');setTab('photos');setView('library');toast(saved.length+' photos imported');return saved;
  });}
  function assignCategory(category,ids=[...selected]){return execute(async()=>{
    for(const id of ids){const photo=stateRef.current.photos.find(p=>p.id===id);if(photo)upsert('photos',await savePhoto({...photo,category}));}
    toast(ids.length+' photos moved to '+categoryLabel(category));return true;
  });}
  function saveOrganize(groups){return execute(async()=>{
    for(const group of groups){
      for(const id of group.photoIds){const photo=stateRef.current.photos.find(p=>p.id===id);if(photo)upsert('photos',await savePhoto({...photo,category:group.category}));}
      upsert('albums',await saveAlbumRecord({id:group.albumId||(group.albumId=crypto.randomUUID()),title:group.title.trim(),note:'',photoIds:group.photoIds}));
    }
    clear();setSelecting(false);setTab('albums');setView('library');toast(groups.length+' albums created');return true;
  });}
  function openAlbum(){if(!chosen.length){setPickerNext('album');setModal('picker');}else setModal('album');}
  function chooseForEditor(next=null){setPickerNext(next);setModal('picker');}
  function confirmPicker(ids){setSelected(new Set(ids));setSelecting(true);if(pickerNext==='album')setModal('album');else{if(pickerNext)setView(pickerNext);setModal(null);}setPickerNext(null);}
  function saveAlbum({target,title,note,id}){return execute(async()=>{
    const ids=[...selected];if(!ids.length)throw new Error('Select photos first');
    const original=stateRef.current.albums.find(a=>a.id===target);
    const album=target==='new'?{id:id||crypto.randomUUID(),title,note,photoIds:ids}:{...original,photoIds:[...new Set([...original.photoIds,...ids])]};
    upsert('albums',await saveAlbumRecord(album));setTab('albums');setView('library');clear();setSelecting(false);toast(target==='new'?'Album saved':'Photos added');return true;
  });}
  function updateAlbum(album){return execute(async()=>{const current=stateRef.current.albums.find(a=>a.id===album.id);const saved=await saveAlbumRecord({...album,revision:current?.revision});upsert('albums',saved);return saved;});}
  function openAlbumDetail(id){return execute(async()=>{
    const album=stateRef.current.albums.find(a=>a.id===id);
    if(cloud)for(const photoId of album.photoIds)if(!stateRef.current.photos.some(p=>p.id===photoId))upsert('photos',await client.photo(photoId));
    setAlbumId(id);return true;
  });}
  function loadMore(){return execute(async()=>{const items=await client.more();change(s=>({...s,photos:[...s.photos,...items.filter(p=>!s.photos.some(old=>old.id===p.id))]}));setHasMore(client.hasMore());return true;});}
  function apply(style,ids){return execute(async()=>{
    let count=0;for(const id of ids){const photo=stateRef.current.photos.find(p=>p.id===id);if(photo){upsert('photos',await savePhoto(await renderStyle(photo,style)));count++;}}
    toast('Tone applied to '+count+' photos');return true;
  });}
  function saveStyle(recipe){return execute(async()=>{const saved=cloud?await client.saveStyle(recipe):recipe;upsert('savedStyles',saved);toast('Style saved');return saved;});}
  function saveStyleResults(recipe,items){return execute(async()=>{
    const signature=recipeSignature(recipe);
    const candidates=items.filter(p=>sampleFor(p,recipe)&&!stateRef.current.photos.some(existing=>existing.parentPhotoId===p.id&&existing.recipeSignature===signature));
    if(!candidates.length){toast('These samples are already in your library.');return 0;}
    for(const photo of candidates){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(photo.id+'|'+signature));const id='generation-'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');const result=makeSampleDerivative(photo,{...recipe,name:recipe.name||'My style'},id,new Date().toISOString().slice(0,10));upsert('photos',await savePhoto(result));}
    toast(candidates.length+' images saved. Originals kept.');return candidates.length;
  });}
  function saveCollage(src,title){return execute(async()=>{
    if(collageSave.current?.src!==src||collageSave.current?.title!==title)collageSave.current={src,title,id:crypto.randomUUID()};
    const item=await savePhoto({id:collageSave.current.id,name:title.trim()||'My collage',src,style:'original',date:new Date().toISOString().slice(0,10),category:'创作',kind:'collage',sourcePhotoIds:workPhotos.map(p=>p.id)});
    upsert('photos',item);setSelected(new Set([item.id]));setSelecting(true);setTab('photos');setFilter('all');setView('library');toast('Collage saved to library');return true;
  });}
  if(bootError)return <div className="boot"><p>{bootError.message}</p>{bootError.status===401?<a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>:<button onClick={()=>location.reload()}>Try again</button>}</div>;
  if(!ready)return <div className="boot"><Loader2 size={23} className="spinning"/><span>Opening your library…</span></div>;
  return <NoticeContext.Provider value={notice}>
    <a href="#workspace" className="skip-link">Skip to content</a>
    <Header view={view} onView={setView} onUpload={()=>setModal('upload')}/>
    <main aria-busy={busy} id="workspace" className={'workspace view-'+view}>
      {saveProblem&&<p className="save-warning" role="status">Changes were not confirmed. Check your connection, then reload before retrying.</p>}
      {view==='library'&&<Library photos={photos} albums={state.albums} tab={tab} setTab={setTab} selected={selected} selecting={selecting} setSelecting={setSelecting} onToggle={toggle} onPreview={setPreview} onClear={clear} filter={filter} setFilter={setFilter} onOrganize={()=>setModal('organize')} onAlbum={openAlbum} onCollage={()=>setView('collage')} onLab={()=>setView('lab')} onOpenAlbum={openAlbumDetail} hasMore={hasMore} onLoadMore={loadMore} loading={busy} onInfo={()=>setModal('info')}/>}
      {view==='lab'&&<StyleLab photos={labPhotos} isExample={!chosen.length} onChoose={()=>chooseForEditor('lab')} savedStyles={state.savedStyles||[]} onSaveStyle={saveStyle} onSaveResults={saveStyleResults} onApply={apply} busy={busy} toast={toast}/>}
      {view==='collage'&&<CollageView photos={workPhotos} isExample={!chosen.length} onChoose={()=>chooseForEditor('collage')} onSave={saveCollage} toast={toast} busy={busy}/>}
    </main>
    {notice&&!modal&&!preview&&!albumId&&<div className="toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
    {modal==='upload'&&<UploadDialog cloud={cloud} onClose={()=>setModal(null)} onImport={importPhotos} toast={toast}/>}
    {modal==='organize'&&<OrganizeDialog photos={chosen.length?chosen:photos} onClose={()=>setModal(null)} onSave={saveOrganize} onAssign={assignCategory}/>}
    {modal==='album'&&<AlbumDialog albums={state.albums} count={chosen.length} onClose={()=>setModal(null)} onSave={saveAlbum}/>}
    {modal==='picker'&&<Modal title="Choose photos" className="picker-modal" onClose={()=>setModal(null)}><PhotoPicker photos={photos} initial={selected.size?[...selected]:(pickerNext==='lab'?labPhotos:workPhotos).map(p=>p.id)} onClose={()=>setModal(null)} onConfirm={confirmPicker}/></Modal>}
    {modal==='info'&&<InfoDialog cloud={cloud} credits={credits} onClose={()=>setModal(null)}/>}
    {preview&&<PhotoPreview photo={photos.find(p=>p.id===preview.id)||preview} onClose={()=>setPreview(null)}/>}
    {albumId&&state.albums.some(a=>a.id===albumId)&&<AlbumDetail album={state.albums.find(a=>a.id===albumId)} photos={photos} onClose={()=>setAlbumId(null)} onUpdate={updateAlbum} toast={toast}/>}
  </NoticeContext.Provider>;
}
