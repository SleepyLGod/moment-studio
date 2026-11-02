import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CheckCircle2, Loader2} from 'lucide-react';
import {AlbumDetail, AlbumDialog, Header, InfoDialog, Modal, NoticeContext, OrganizeDialog, PhotoPreview, UploadDialog} from './components';
import {CollageView, Library, PhotoPicker} from './views';
import {categoryLabel, freshState} from './data';
import {StyleLab} from './StyleLab';
import {makeSampleDerivative, recipeSignature, sampleFor} from './recipes';
import {persistState, readSavedState} from './storage';
import {renderStyle} from './imaging';
import './styles.css';

function App() {
  const [state,setState]=useState(freshState),[ready,setReady]=useState(false);
  const [view,setView]=useState('library'),[tab,setTab]=useState('photos'),[filter,setFilter]=useState('all');
  const [selected,setSelected]=useState(()=>new Set()),[selecting,setSelecting]=useState(false);
  const [modal,setModal]=useState(null),[preview,setPreview]=useState(null),[albumId,setAlbumId]=useState(null);
  const [notice,setNotice]=useState(''),[saveProblem,setSaveProblem]=useState(false),[credits,setCredits]=useState([]);
  const [busy,setBusy]=useState(false),[pickerNext,setPickerNext]=useState(null);
  const stateQueue=useRef(Promise.resolve());
  const toast=useCallback(message=>setNotice(message),[]);
  useEffect(()=>{
    let live=true;
    readSavedState().then(saved=>{if(live&&Array.isArray(saved?.photos)&&Array.isArray(saved?.albums))setState({...saved,savedStyles:Array.isArray(saved.savedStyles)?saved.savedStyles:[]});})
      .catch(()=>{if(live)setSaveProblem(true);}).finally(()=>{if(live)setReady(true);});
    fetch('/photos/credits.json').then(r=>{if(!r.ok)throw new Error('Photo credits could not load.');return r.json();}).then(rows=>setCredits(rows.filter(c=>String(c.id)!=='1015'))).catch(error=>toast(error.message));
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(!ready)return;
    stateQueue.current=stateQueue.current.catch(()=>{}).then(()=>persistState(state)).then(()=>setSaveProblem(false)).catch(()=>setSaveProblem(true));
  },[state,ready]);
  useEffect(()=>{if(modal||preview||albumId)setNotice('');},[modal,preview,albumId]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4600);return ()=>clearTimeout(timer);},[notice]);
  const photos=state.photos;
  const chosen=useMemo(()=>photos.filter(p=>selected.has(p.id)),[photos,selected]);
  const examples=useMemo(()=>{
    const found=['1015','1043','1011'].map(id=>photos.find(p=>p.id===id)).filter(Boolean);
    return found.length?found:photos.slice(0,3);
  },[photos]);
  const workPhotos=chosen.length?chosen:examples;
  const labPhotos=chosen.length?chosen:['1015','1067','1060'].map(id=>photos.find(p=>p.id===id)).filter(Boolean);
  function clear(){setSelected(new Set());}
  function toggle(id) {
    setSelecting(true);
    setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});
  }
  function importPhotos(items) {
    setState(s=>({...s,photos:[...items,...s.photos]}));
    setSelected(new Set(items.map(p=>p.id)));setSelecting(true);setFilter('all');setTab('photos');setView('library');
    toast(items.length+' photos imported');
  }
  function assignCategory(category,ids=[...selected]) {
    const idSet=new Set(ids);
    setState(s=>({...s,photos:s.photos.map(p=>idSet.has(p.id)?{...p,category}:p)}));
    toast(ids.length+' photos moved to '+categoryLabel(category));
  }
  function saveOrganize(groups) {
    const byPhoto=new Map(groups.flatMap(g=>g.photoIds.map(id=>[id,g.category])));
    setState(s=>({...s,
      photos:s.photos.map(p=>byPhoto.has(p.id)?{...p,category:byPhoto.get(p.id)}:p),
      albums:[...groups.map(g=>({id:crypto.randomUUID(),title:g.title.trim(),note:'',photoIds:g.photoIds})),...s.albums]
    }));
    clear();setSelecting(false);setTab('albums');setView('library');toast(groups.length+' albums created');
  }
  function openAlbum() {
    if(!chosen.length){setPickerNext('album');setModal('picker');}
    else setModal('album');
  }
  function chooseForEditor(next=null){setPickerNext(next);setModal('picker');}
  function confirmPicker(ids) {
    setSelected(new Set(ids));setSelecting(true);
    if(pickerNext==='album')setModal('album');
    else {if(pickerNext)setView(pickerNext);setModal(null);}
    setPickerNext(null);
  }
  function saveAlbum({target,title,note}) {
    const ids=[...selected];if(!ids.length){toast('Select photos first');return;}
    setState(s=>({...s,albums:target==='new'?[{id:crypto.randomUUID(),title,note,photoIds:ids},...s.albums]:s.albums.map(a=>a.id===target?{...a,photoIds:[...new Set([...a.photoIds,...ids])]}:a)}));
    setTab('albums');setView('library');clear();setSelecting(false);toast(target==='new'?'Album saved':'Photos added');
  }
  async function apply(style,ids) {
    if(busy)return;
    setBusy(true);
    try{
      const rendered=[];
      for(const id of ids){const photo=photos.find(p=>p.id===id);if(photo){rendered.push(await renderStyle(photo,style));}}
      const byId=new Map(rendered.map(p=>[p.id,p]));
      setState(s=>({...s,photos:s.photos.map(p=>byId.get(p.id)||p)}));
      toast('Tone applied to '+rendered.length+' photos');
    }catch(error){toast(error.message);}finally{setBusy(false);}
  }
  function saveStyle(recipe) {
    setState(s=>({...s,savedStyles:[recipe,...(s.savedStyles||[])]}));
    toast('Style saved');
  }
  function saveStyleResults(recipe,items) {
    const signature=recipeSignature(recipe);
    const candidates=items.filter(p=>sampleFor(p,recipe)&&!photos.some(existing=>existing.parentPhotoId===p.id&&existing.recipeSignature===signature));
    if(!candidates.length){toast('These samples are already in your library.');return 0;}
    const rendered=candidates.map(p=>makeSampleDerivative(p,{...recipe,name:recipe.name||'My style'},crypto.randomUUID(),new Date().toISOString().slice(0,10)));
    setState(s=>({...s,photos:[...rendered,...s.photos]}));
    toast(rendered.length+' images saved. Originals kept.');
    return rendered.length;
  }
  function saveCollage(src,title) {
    const id=crypto.randomUUID();
    setState(s=>({...s,photos:[{id,name:title.trim()||'My collage',src,style:'original',date:new Date().toISOString().slice(0,10),category:'创作',kind:'collage'},...s.photos]}));
    setSelected(new Set([id]));setSelecting(true);setTab('photos');setFilter('all');setView('library');
    toast('Collage saved to library');
  }
  if(!ready)return <div className="boot"><Loader2 size={23} className="spinning"/><span>Opening your library…</span></div>;
  return <NoticeContext.Provider value={notice}>
    <a href="#workspace" className="skip-link">Skip to content</a>
    <Header view={view} onView={setView} onUpload={()=>setModal('upload')}/>
    <main id="workspace" className={'workspace view-'+view}>
      {saveProblem&&<p className="save-warning" role="status">Could not save in this browser. Keep this tab open and try again.</p>}
      {view==='library'&&<Library photos={photos} albums={state.albums} tab={tab} setTab={setTab} selected={selected} selecting={selecting} setSelecting={setSelecting} onToggle={toggle} onPreview={setPreview} onClear={clear} filter={filter} setFilter={setFilter} onOrganize={()=>setModal('organize')} onAlbum={openAlbum} onCollage={()=>setView('collage')} onLab={()=>setView('lab')} onOpenAlbum={setAlbumId} onInfo={()=>setModal('info')}/>}
      {view==='lab'&&<StyleLab photos={labPhotos} isExample={!chosen.length} onChoose={()=>chooseForEditor('lab')} savedStyles={state.savedStyles||[]} onSaveStyle={saveStyle} onSaveResults={saveStyleResults} onApply={apply} busy={busy} toast={toast}/>}
      {view==='collage'&&<CollageView photos={workPhotos} isExample={!chosen.length} onChoose={()=>chooseForEditor('collage')} onSave={saveCollage} toast={toast}/>}
    </main>
    {notice&&!modal&&!preview&&!albumId&&<div className="toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
    {modal==='upload'&&<UploadDialog onClose={()=>setModal(null)} onImport={importPhotos} toast={toast}/>}
    {modal==='organize'&&<OrganizeDialog photos={chosen.length?chosen:photos} onClose={()=>setModal(null)} onSave={saveOrganize} onAssign={assignCategory}/>}
    {modal==='album'&&<AlbumDialog albums={state.albums} count={chosen.length} onClose={()=>setModal(null)} onSave={saveAlbum}/>}
    {modal==='picker'&&<Modal title="Choose photos" className="picker-modal" onClose={()=>setModal(null)}><PhotoPicker photos={photos} initial={selected.size?[...selected]:(pickerNext==='lab'?labPhotos:workPhotos).map(p=>p.id)} onClose={()=>setModal(null)} onConfirm={confirmPicker}/></Modal>}
    {modal==='info'&&<InfoDialog credits={credits} onClose={()=>setModal(null)}/>}
    {preview&&<PhotoPreview photo={photos.find(p=>p.id===preview.id)||preview} onClose={()=>setPreview(null)}/>}
    {albumId&&state.albums.some(a=>a.id===albumId)&&<AlbumDetail album={state.albums.find(a=>a.id===albumId)} photos={photos} onClose={()=>setAlbumId(null)} onUpdate={album=>setState(s=>({...s,albums:s.albums.map(a=>a.id===albumId?album:a)}))} toast={toast}/>}
  </NoticeContext.Provider>;
}
createRoot(document.getElementById('root')).render(<App/>);
