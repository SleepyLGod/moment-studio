'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {CheckCircle2, Loader2} from 'lucide-react';
import {AlbumDetail, AlbumDialog, Header, InfoDialog, Modal, NoticeContext, OrganizeDialog, PhotoPreview, RecentGroupDetail, UploadDialog} from './components';
import {CollageView, Library, PhotoPicker} from './views';
import {categoryLabel, freshState, assetUrl} from './data';
import {DeletePhotosDialog, SettingsDialog, readGridSize, writeGridSize} from './gallery-dialogs';
import {StyleLab} from './StyleLab';
import {makeSampleDerivative, recipeSignature, sampleFor} from './recipes';
import {persistState, readSavedState} from './storage';
import {renderStyle} from './imaging';
import {changePhotoScope,mergePhotos} from './services/operations';
import {createCloudLibrary} from './services/cloud';
import {editSignature} from './services/output-size';
import {calendarDay,recentGroups,monthGroups} from './services/organization';

export default function App({mode="demo"}) {
  const cloud=mode==='cloud';
  const client=useMemo(()=>cloud?createCloudLibrary():null,[cloud]);
  const [state,setState]=useState(()=>cloud?{photos:[],albums:[],savedStyles:[]}:freshState());
  const stateRef=useRef(state),queue=useRef(Promise.resolve()),collageSave=useRef(null);
  const [ready,setReady]=useState(false),[bootError,setBootError]=useState(null),[hasMore,setHasMore]=useState(false);
  const [view,setView]=useState('library'),[tab,setTab]=useState('photos'),[filter,setFilter]=useState('all');
  const [gridSize,setGridSize] = useState('medium');
  const [deletion,setDeletion] = useState(null);
  useEffect(()=>setGridSize(readGridSize()),[]);

  function changeGridSize(size) {
    setGridSize(size);
    writeGridSize(size);
  }

  const [selected,setSelected]=useState(()=>new Set()),[selecting,setSelecting]=useState(false);
  const [modal,setModal]=useState(null),[preview,setPreview]=useState(null),[albumId,setAlbumId]=useState(null);
  const [notice,setNotice]=useState(''),[saveProblem,setSaveProblem]=useState(false),[credits,setCredits]=useState([]);
  const [busy,setBusy]=useState(false),[pickerNext,setPickerNext]=useState(null);
  const [analysisJobs,setAnalysisJobs]=useState([]),[analysisProblem,setAnalysisProblem]=useState('');
  const [trashPhotos,setTrashPhotos]=useState([]),[trashCursor,setTrashCursor]=useState(null),[trashError,setTrashError]=useState('');
  const [editJobs,setEditJobs]=useState([]),[editProblem,setEditProblem]=useState(''),[styleConnection,setStyleConnection]=useState(null);const generationRequests=useRef(new Map());
  const [modelCatalog,setModelCatalog]=useState(null),[modelRefreshing,setModelRefreshing]=useState(false),[modelError,setModelError]=useState('');
  const [month,setMonth]=useState('all'),[monthRows,setMonthRows]=useState([]),[monthCursor,setMonthCursor]=useState(null);
  const filterScope=useRef({category:'all',month:'all'});
  const [recent,setRecent]=useState({groups:[],days:30,truncated:false}),[recentGroup,setRecentGroup]=useState(null);
  const [collectionLoading,setCollectionLoading]=useState(false),[collectionError,setCollectionError]=useState(''),[collectionRefresh,setCollectionRefresh]=useState(0),[libraryRevision,setLibraryRevision]=useState(0);
  const toast=useCallback(message=>setNotice(message),[]);
  function change(update){const next=typeof update==='function'?update(stateRef.current):update;stateRef.current=next;setState(next);}
  function upsert(key,item){change(s=>({...s,[key]:s[key].some(p=>p.id===item.id)?s[key].map(p=>p.id===item.id?item:p):[item,...s[key]]}));if(key==='photos')setLibraryRevision(n=>n+1);}
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
  const refreshModelCatalog=useCallback(async()=>{
    if(!cloud||!client.canAnalyze())return;
    setModelRefreshing(true);setModelError('');
    try{setModelCatalog(await client.models());setModelCatalog(await client.refreshModels());}
    catch(error){setModelError(error.message);}
    finally{setModelRefreshing(false);}
  },[client,cloud]);
  useEffect(()=>{
    if(!ready||!client?.canGenerate())return;
    let live=true,timer;
    const pending=editJobs.some(job=>job.state==='running'||(job.state==='queued'&&job.delivery?.state!=='failed'));
    async function refresh(){try{
      const {jobs,connection}=await client.editJobs();if(!live)return;
      const missing=jobs.filter(job=>job.state==='succeeded'&&job.result?.photoId&&!stateRef.current.photos.some(photo=>photo.id===job.result.photoId)).map(job=>job.result.photoId);
      if(missing.length)await execute(async()=>{if(!live)return;const items=await client.resolve(missing),scope=filterScope.current,page=await client.filter(scope.category,scope.month);if(!live)return;change(s=>({...s,photos:mergePhotos(s.photos,[...items,...page])}));setHasMore(client.hasMore());setLibraryRevision(n=>n+1);});
      if(!live)return;setEditProblem('');setEditJobs(jobs);setStyleConnection(connection);
    }catch(error){if(live)setEditProblem(error.message);}
    finally{if(live)timer=setTimeout(refresh,pending?3000:30000);}}
    if(view==='lab'||pending){if(pending)timer=setTimeout(refresh,2500);else void refresh();}
    return ()=>{live=false;clearTimeout(timer);};
  },[ready,client,view,editJobs.some(job=>job.state==='running'||(job.state==='queued'&&job.delivery?.state!=='failed'))]);
  useEffect(()=>{if(ready)void refreshModelCatalog();},[ready,refreshModelCatalog]);
  useEffect(()=>{
    if(!ready||view!=='library'||!['months','recent'].includes(tab))return;
    let live=true;setCollectionLoading(true);setCollectionError('');
    async function load(){
      try{
        if(tab==='months'){
          let page;
          if(cloud)page=await client.months(filter);
          else page={months:monthGroups(stateRef.current.photos,filter),nextCursor:null};
          const missing=cloud?await client.resolve(page.months.map(m=>m.coverId).filter(id=>!stateRef.current.photos.some(p=>p.id===id))):[];
          if(!live)return;change(s=>({...s,photos:mergePhotos(s.photos,missing)}));setMonthRows(page.months);setMonthCursor(page.nextCursor);
        }else{
          const page=cloud?await client.groups():{groups:recentGroups(stateRef.current.photos),days:30,truncated:false};
          const covers=[...new Set(page.groups.flatMap(group=>group.photoIds.slice(0,3)))].filter(id=>!stateRef.current.photos.some(p=>p.id===id));
          const missing=cloud?await client.resolve(covers):[];
          if(!live)return;change(s=>({...s,photos:mergePhotos(s.photos,missing)}));setRecent(page);
        }
      }catch(error){if(live)setCollectionError(error.message);}
      finally{if(live)setCollectionLoading(false);}
    }
    void load();return ()=>{live=false;};
  },[ready,view,tab,filter,libraryRevision,collectionRefresh,client,cloud]);
  useEffect(()=>{if(modal||preview||albumId||recentGroup)setNotice('');},[modal,preview,albumId,recentGroup]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4600);return ()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    if(!cloud||!analysisJobs.length)return;
    let live=true,timer;
    async function refresh(){
      try{
        const current=await client.jobs(analysisJobs.map(job=>job.id));
        if(!live)return;
        if(current.length!==analysisJobs.length)throw new Error('Some analysis tasks could not be read.');
        const active=current.some(job=>['queued','running'].includes(job.state));
        setAnalysisProblem('');
        if(active){timer=setTimeout(refresh,2500);return;}
        const changed=await client.resolve(current.filter(job=>job.state==='succeeded').map(job=>job.photoId));
        if(!live)return;
        change(s=>({...s,photos:mergePhotos(s.photos,changed)}));
        const failed=current.filter(job=>job.state!=='succeeded');
        try{const catalog=await client.models();if(live)setModelCatalog(catalog);}catch(error){if(live)setModelError(error.message);}
        if(!live)return;setAnalysisJobs([]);setLibraryRevision(n=>n+1);toast(failed.length?failed.length+' analysis tasks did not complete ('+[...new Set(failed.map(job=>job.errorCode))].join(', ')+').':'Tags saved.');
      }catch(error){if(live){setAnalysisProblem(error.message);timer=setTimeout(refresh,10000);}}
    }
    timer=setTimeout(refresh,1500);
    return ()=>{live=false;clearTimeout(timer);};
  },[analysisJobs,client,cloud,toast]);
  function analyzeSelected(){return execute(async()=>{
    const ids=[...selected];if(!ids.length||ids.length>20)throw new Error('Select 1 to 20 original photos.');
    const jobs=await client.analyze(ids);setAnalysisJobs(jobs);setAnalysisProblem('');return true;
  });}
  function generateStyle(recipe,ids,output){return execute(async()=>{
    const key=JSON.stringify([ids,editSignature(recipe,output)]);if(!generationRequests.current.has(key))generationRequests.current.set(key,crypto.randomUUID());
    const jobs=await client.generate(ids,recipe,generationRequests.current.get(key),output);
    generationRequests.current.delete(key);
    setEditJobs(current=>[...jobs,...current.filter(job=>!jobs.some(item=>item.id===job.id))]);setEditProblem('');toast(jobs.some(job=>job.delivery?.state==='failed')?'Delivery needs a retry':jobs.length===1?'Edit queued':jobs.length+' edits queued');return jobs;
  });}
  function retryStyle(job){return execute(async()=>{
    const response=await client.retryEdit(job.id);
    setStyleConnection(response.connection);setEditJobs(current=>current.map(item=>item.id===job.id?response.job:item));
    setEditProblem('');return response.job;
  });}
  function openEditJob(job){return execute(async()=>{const items=await client.resolve([job.photoId]);if(!items.length)throw new Error('The source photo is in Trash. Restore it first.');change(s=>({...s,photos:mergePhotos(s.photos,items)}));setSelected(new Set([job.photoId]));setSelecting(true);setView('lab');return true;});}
  const photos=state.photos.filter(photo=>!photo.trashedAt);
  const chosen=useMemo(()=>photos.filter(p=>selected.has(p.id)),[photos,selected]);
  const examples=useMemo(()=>{const found=['1015','1043','1011'].map(id=>photos.find(p=>p.id===id)).filter(Boolean);return found.length?found:photos.slice(0,3);},[photos]);
  const workPhotos=chosen.length?chosen:examples;
  const liveStyle = Boolean(client?.canGenerate());
  const labPhotos = liveStyle
    ? chosen.filter(photo => (photo.kind || 'photo') === 'photo')
    : chosen.length ? chosen : ['1015','1067','1060'].map(id=>photos.find(p=>p.id===id)).filter(Boolean);
  const liveStylePicker = pickerNext === 'lab' && liveStyle;
  useEffect(()=>{if(tab!=='trash')return;let live=true;setSelected(new Set());setSelecting(false);setTrashError('');
    (cloud?client.trashPage():Promise.resolve({items:stateRef.current.photos.filter(p=>p.trashedAt),nextCursor:null})).then(page=>{if(live){setTrashPhotos(page.items);setTrashCursor(page.nextCursor);}}).catch(error=>{if(live)setTrashError(error.message);});return ()=>{live=false;};},[tab,client,cloud]);
  function moreTrash(){return execute(async()=>{const page=await client.trashPage(trashCursor);setTrashPhotos(current=>mergePhotos(current,page.items));setTrashCursor(page.nextCursor);return true;});}
  function moveTrash(ids=[...selected]){return execute(async()=>{
    if(!ids.length||ids.length>100)throw new Error('Select 1 to 100 photos.');
    if(cloud)await client.trash(ids);const now=Date.now();change(s=>({...s,photos:s.photos.map(p=>ids.includes(p.id)?{...p,trashedAt:now}:p)}));
    if(cloud){const scope=filterScope.current,page=await client.filter(scope.category,scope.month);change(s=>({...s,photos:mergePhotos(s.photos,page)}));setHasMore(client.hasMore());}
    clear();setSelecting(false);setPreview(null);setLibraryRevision(n=>n+1);toast('Moved to Trash');return true;
  });}
  function restorePhotos(ids=[...selected]){return execute(async()=>{
    if(!ids.length||ids.length>100)throw new Error('Select 1 to 100 photos.');
    if(cloud){await client.restore(ids);const items=await client.resolve(ids);change(s=>({...s,photos:mergePhotos(s.photos,items)}));const scope=filterScope.current;await client.filter(scope.category,scope.month);setHasMore(client.hasMore());}
    else change(s=>({...s,photos:s.photos.map(p=>ids.includes(p.id)?{...p,trashedAt:null}:p)}));
    setTrashPhotos(current=>current.filter(p=>!ids.includes(p.id)));clear();setSelecting(false);setPreview(null);setLibraryRevision(n=>n+1);toast('Photos restored');return true;
  });}
  function clear(){setSelected(new Set());}
  function toggle(id){setSelecting(true);setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});}
  async function savePhoto(photo){return cloud?client.savePhoto(photo):photo;}
  async function saveAlbumRecord(album){return cloud?client.saveAlbum(album):album;}
  function importPhotos(items){return execute(async()=>{
    const saved=[];for(const photo of items){const item=await savePhoto(photo);upsert('photos',item);saved.push(item);}
    setSelected(new Set(saved.map(p=>p.id)));setSelecting(true);if(cloud){const page=await client.filter('all');change(s=>({...s,photos:mergePhotos(s.photos,page)}));setHasMore(client.hasMore());}filterScope.current={category:'all',month:'all'};setFilter('all');setMonth('all');setTab('photos');setView('library');toast(saved.length+' photos imported');return saved;
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
  function updateAlbum(album){return execute(async()=>{const saved=await saveAlbumRecord(album);upsert('albums',saved);return saved;});}
  function openAlbumDetail(id){return execute(async()=>{
    const album=stateRef.current.albums.find(a=>a.id===id);
    if(cloud){const missing=album.photoIds.filter(id=>!stateRef.current.photos.some(p=>p.id===id));const related=await client.resolve(missing);change(s=>({...s,photos:mergePhotos(s.photos,related)}));}
    setAlbumId(id);return true;
  });}
  function applyPhotoScope(next,items){if(cloud){change(s=>({...s,photos:mergePhotos(s.photos,items)}));setHasMore(client.hasMore());}setFilter(next.category);setMonth(next.month);}
  function chooseCategory(value){
    return changePhotoScope(execute,client,filterScope,{category:value},(next,items)=>{
      applyPhotoScope(next,items);
      clear();
    });
  }
  function chooseMonth(value){return changePhotoScope(execute,client,filterScope,{month:value},(next,items)=>{applyPhotoScope(next,items);setTab('photos');clear();setSelecting(false);});}
  function moreMonths(){return execute(async()=>{
    if(!monthCursor)return true;const page=await client.months(filter,monthCursor),covers=await client.resolve(page.months.map(m=>m.coverId));change(s=>({...s,photos:mergePhotos(s.photos,covers)}));setMonthRows(rows=>[...rows,...page.months]);setMonthCursor(page.nextCursor);return true;
  });}
  function openRecentGroup(group){return execute(async()=>{
    if(cloud){const items=await client.resolve(group.photoIds);change(s=>({...s,photos:mergePhotos(s.photos,items)}));}
    setRecentGroup(group);return true;
  });}
  function loadMore(){return execute(async()=>{const items=await client.more();change(s=>({...s,photos:mergePhotos(s.photos,items)}));setHasMore(client.hasMore());return true;});}
  function apply(style,ids){return execute(async()=>{
    let count=0;for(const id of ids){const photo=stateRef.current.photos.find(p=>p.id===id);if(photo){upsert('photos',await savePhoto(await renderStyle(photo,style)));count++;}}
    toast('Tone applied to '+count+' photos');return true;
  });}
  function saveStyle(recipe){return execute(async()=>{const saved=cloud?await client.saveStyle(recipe):recipe;upsert('savedStyles',saved);toast('Style saved');return saved;});}
  function saveStyleResults(recipe,items){return execute(async()=>{
    const signature=recipeSignature(recipe);
    const candidates=items.filter(p=>sampleFor(p,recipe)&&!stateRef.current.photos.some(existing=>existing.parentPhotoId===p.id&&existing.recipeSignature===signature));
    if(!candidates.length){toast('These samples are already in your library.');return 0;}
    for(const photo of candidates){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(photo.id+'|'+signature));const id='generation-'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');const result=makeSampleDerivative(photo,{...recipe,name:recipe.name||'My style'},id,calendarDay(Date.now()));upsert('photos',await savePhoto(result));}
    toast(candidates.length+' images saved. Originals kept.');return candidates.length;
  });}
  function saveCollage(src,title,sourcePhotoIds){return execute(async()=>{
    if(collageSave.current?.src!==src||collageSave.current?.title!==title)collageSave.current={src,title,id:crypto.randomUUID()};
    const item=await savePhoto({id:collageSave.current.id,name:title.trim()||'My collage',src,style:'original',date:calendarDay(Date.now()),category:'创作',kind:'collage',sourcePhotoIds});
    upsert('photos',item);setSelected(new Set([item.id]));setSelecting(true);setTab('photos');if(cloud){const page=await client.filter('all');change(s=>({...s,photos:mergePhotos(s.photos,page)}));setHasMore(client.hasMore());}filterScope.current={category:'all',month:'all'};setFilter('all');setMonth('all');setView('library');toast('Collage saved to library');return true;
  });}
  if(bootError)return <div className="boot"><p>{bootError.message}</p>{bootError.status===401?<a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>:<button onClick={()=>location.reload()}>Try again</button>}</div>;
  if(!ready)return <div className="boot"><Loader2 size={23} className="spinning"/><span>Opening your library…</span></div>;
  return <NoticeContext.Provider value={notice}>
    <a href="#workspace" className="skip-link">Skip to content</a>
    <Header view={view} onView={setView} onUpload={()=>setModal('upload')} onSettings={()=>setModal('settings')}/>
    <main aria-busy={busy} id="workspace" className={'workspace view-'+view} data-grid-size={gridSize}>
      {saveProblem&&<p className="save-warning" role="status">Changes were not confirmed. Check your connection, then reload before retrying.</p>}
      {view==='library'&&<Library photos={photos} albums={state.albums} tab={tab} setTab={value=>{clear();setSelecting(false);setTab(value);}} selected={selected} selecting={selecting} setSelecting={setSelecting} onToggle={toggle} onPreview={setPreview} onClear={clear} onSelectAll={ids=>setSelected(new Set(ids))} filter={filter} setFilter={chooseCategory} visibleIds={client?.visibleIds()} photoTotal={client?.count()} onOrganize={()=>setModal('organize')} onAlbum={openAlbum} onCollage={()=>setView('collage')} onLab={()=>setView('lab')} onOpenAlbum={openAlbumDetail} hasMore={hasMore} onLoadMore={loadMore} loading={busy} onInfo={()=>setModal('info')} onAnalyze={client?.canAnalyze()?analyzeSelected:undefined} analyzing={Boolean(analysisJobs.length)||modelRefreshing||!modelCatalog?.selectedModelId}
        modelCatalog={modelCatalog} modelRefreshing={modelRefreshing} modelError={modelError} onRefreshModels={refreshModelCatalog}
        month={month} months={monthRows} onMonth={chooseMonth} hasMoreMonths={Boolean(monthCursor)} onMoreMonths={moreMonths}
        recent={recent} onOpenGroup={openRecentGroup} collectionLoading={collectionLoading} collectionError={collectionError} onRefreshCollections={()=>setCollectionRefresh(n=>n+1)} trashPhotos={trashPhotos} trashMore={Boolean(trashCursor)} onMoreTrash={moreTrash} onTrash={moveTrash} onRestore={restorePhotos} onDelete={cloud?()=>setDeletion(trashPhotos.filter(photo=>selected.has(photo.id))):undefined}/>}
      {view==='library'&&tab==='trash'&&trashError&&<p role="alert">{trashError}</p>}
      {view==='lab'&&<StyleLab photos={labPhotos} isExample={!chosen.length} onChoose={()=>chooseForEditor('lab')} savedStyles={state.savedStyles||[]} onSaveStyle={saveStyle} onSaveResults={saveStyleResults} onApply={apply} onGenerate={client?.canGenerate()?generateStyle:undefined} onOpenEdit={openEditJob} onRetry={retryStyle} connection={styleConnection} editJobs={editJobs} editProblem={editProblem} busy={busy} toast={toast}/>}
      {view==='collage'&&<CollageView photos={workPhotos} isExample={!chosen.length} onChoose={()=>chooseForEditor('collage')} onSave={saveCollage} toast={toast} busy={busy}/>}
    </main>
    {analysisJobs.length>0&&<div className="analysis-progress" role="status"><Loader2 size={15} className="spinning"/>{analysisProblem?'Could not refresh status. Retrying…':'Analyzing '+analysisJobs.length+' photos…'}{analysisProblem&&<button className="text-button" onClick={()=>location.reload()}>Reload</button>}</div>}
    {notice&&!modal&&!preview&&!albumId&&<div className="toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
    {modal==='upload'&&<UploadDialog cloud={cloud} onClose={()=>setModal(null)} onImport={importPhotos} toast={toast}/>}
    {modal==='organize'&&<OrganizeDialog photos={chosen.length?chosen:photos} onClose={()=>setModal(null)} onSave={saveOrganize} onAssign={assignCategory}/>}
    {modal==='album'&&<AlbumDialog albums={state.albums} count={chosen.length} onClose={()=>setModal(null)} onSave={saveAlbum}/>}
    {modal==='picker'&&<Modal title="Choose photos" className="picker-modal" onClose={()=>setModal(null)}><PhotoPicker photos={liveStylePicker?photos.filter(photo=>(photo.kind||'photo')==='photo'):photos} limit={liveStylePicker?4:undefined}
      initial={liveStylePicker?labPhotos.map(photo=>photo.id):selected.size?[...selected]:(pickerNext==='lab'?labPhotos:workPhotos).map(p=>p.id)} onClose={()=>setModal(null)} onConfirm={confirmPicker}/></Modal>}
    {modal==='info'&&<InfoDialog cloud={cloud} credits={credits} onClose={()=>setModal(null)}/>}
    {modal==='settings'&&<SettingsDialog size={gridSize} onSize={changeGridSize} client={client} onClose={()=>setModal(null)}/>}
    {deletion&&<DeletePhotosDialog photos={deletion} client={client} onClose={()=>setDeletion(null)} onDeleted={ids=>{
      if (!ids.length) return;
      const removed = new Set(ids);
      setTrashPhotos(current=>current.filter(photo=>!removed.has(photo.id)));
      change(current=>({...current,photos:current.photos.filter(photo=>!removed.has(photo.id))}));
      setSelected(current=>new Set([...current].filter(id=>!removed.has(id))));
      setEditJobs(current=>current.filter(job=>!removed.has(job.photoId)&&!removed.has(job.result?.photoId)));
      setLibraryRevision(revision=>revision+1);
    }}/>}
    {preview&&<PhotoPreview photo={photos.find(p=>p.id===preview.id)||preview} onClose={()=>setPreview(null)} onTrash={moveTrash} onRestore={restorePhotos}
      onDelete={cloud?photo=>{setPreview(null);setDeletion([photo]);}:undefined}/>}
    {recentGroup&&<RecentGroupDetail group={recentGroup} photos={photos} onClose={()=>setRecentGroup(null)} onPreview={photo=>{setRecentGroup(null);setPreview(photo);}} onSelect={ids=>{setSelected(new Set(ids));setSelecting(true);setRecentGroup(null);}}/>}
    {albumId&&state.albums.some(a=>a.id===albumId)&&<AlbumDetail album={state.albums.find(a=>a.id===albumId)} photos={photos} onClose={()=>setAlbumId(null)} onUpdate={updateAlbum} toast={toast}/>}
  </NoticeContext.Provider>;
}
