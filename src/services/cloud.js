/** A resource client: no cloud records or image bytes are persisted in browser storage. */
export function createCloudLibrary(){
  let cursor=null,category='all',month='all',visible=new Set(),total=0,analysisEnabled=false,imageEditEnabled=false;
  const scope=()=>'?category='+encodeURIComponent(category)+'&month='+encodeURIComponent(month);
  async function request(path,options={}){
    const response=await fetch('/api'+path,{...options,credentials:'same-origin',headers:{...(options.body&&typeof options.body==='string'?{'content-type':'application/json'}:{}),...options.headers}});
    const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
    if(!response.ok){const error=new Error(data.error||'Cloud request failed.');error.status=response.status;throw error;}return data;
  }
  async function put(table,item){
    const {_order,...data}=item;
    const result=await request('/'+table+'/'+encodeURIComponent(item.id)+(table==='photos'?scope():''),{method:'PUT',body:JSON.stringify(data)});
    if(table==='photos'){
      if((category==='all'||result.item.category===category)&&(month==='all'||result.item.timelineDay?.startsWith(month)))visible.add(item.id);else visible.delete(item.id);
      total=result.total;
    }
    return result.item;
  }
  async function list(table,next=null){
    const page=await request('/'+table+(table==='photos'?scope()+'&':'?')+'limit=50'+(next?'&cursor='+encodeURIComponent(next):''));
    if(table==='photos'){if(!next)visible=new Set();for(const item of page.items)visible.add(item.id);total=page.total;}
    return page;
  }
  async function all(table){let items=[],next=null;do{const page=await list(table,next);items.push(...page.items);next=page.nextCursor;}while(next);return items;}
  async function upload(blob,name,purpose,id=crypto.randomUUID()){
    if(blob.size>12*1024*1024)throw new Error('Use images up to 12 MiB.');
    await request('/uploads',{method:'POST',body:JSON.stringify({id,name,mime:blob.type,size:blob.size,purpose})});
    await request('/uploads/'+id+'/body',{method:'PUT',body:blob,headers:{'content-type':blob.type}});
    return (await request('/uploads/'+id+'/complete',{method:'POST',body:'{}'})).file.src;
  }
  async function materialize(src,name,purpose,id,copySample=false){
    if(!src)return src;
    if(!src.startsWith('data:')&&!src.startsWith('blob:')&&!copySample)return src;
    const response=await fetch(src);if(!response.ok)throw new Error('Could not read image bytes.');
    const blob=await response.blob();
    if(purpose==='rendered'||purpose==='generation')name=name.replace(/\.(?:jpg|jpeg|png|webp)$/i,'')+'.'+({'image/png':'png','image/webp':'webp'}[blob.type]||'jpg');
    if(!id){
      const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
      const content=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      const operation=await crypto.subtle.digest('SHA-256',new TextEncoder().encode([name,purpose,blob.type,content].join('|')));
      id='image-'+Array.from(new Uint8Array(operation),x=>x.toString(16).padStart(2,'0')).join('');
    }
    return upload(blob,name,purpose,id);
  }
  async function savePhoto(photo){
    const data={...photo};delete data.file;delete data.previewBlob;
    if(photo.file){
      data.src=await upload(photo.file,photo.file.name,'original',photo.id+'-original');
      if(photo.previewBlob)data.thumbnailSrc=await upload(photo.previewBlob,'preview.jpg','preview',photo.id+'-preview');
    }else data.src=await materialize(photo.src,photo.name+'.jpg','original',photo.id+'-original');
    if(photo.renderedSrc)data.renderedSrc=await materialize(photo.renderedSrc,photo.name+'.jpg','rendered',undefined,photo.generationSource==='pregenerated-demo'&&photo.renderedSrc.startsWith('/styles/'));
    if(photo.generationSrc)data.generationSrc=photo.generationSrc===photo.renderedSrc?data.renderedSrc:await materialize(photo.generationSrc,photo.name+'.jpg','generation',undefined,photo.generationSource==='pregenerated-demo'&&photo.generationSrc.startsWith('/styles/'));
    if(photo.recipe?.reference?.src)data.recipe={...photo.recipe,reference:{...photo.recipe.reference,src:await materialize(photo.recipe.reference.src,photo.recipe.reference.name||'reference.jpg','reference')}};
    return put('photos',data);
  }
  async function resolve(ids){const items=[];for(let i=0;i<ids.length;i+=50){const page=await request('/photos/resolve',{method:'POST',body:JSON.stringify({ids:ids.slice(i,i+50)})});items.push(...page.items);}return items;}
  return {
    async load(seed=true){
      const me=await request('/me');analysisEnabled=me.features?.analysis===true;imageEditEnabled=me.features?.imageEdit===true;if(seed&&!me.initialized)await request('/bootstrap',{method:'POST',body:'{}'});
      const photos=await list('photos');
      const albums=await all('albums');
      const related=[...new Set([...albums.flatMap(a=>a.photoIds.slice(0,3)),'1015','1067','1060','1043','1011'])].filter(id=>!photos.items.some(p=>p.id===id));
      const extras=await resolve(related);
      cursor=photos.nextCursor;return {photos:[...photos.items,...extras],albums,savedStyles:await all('styles')};
    },
    canAnalyze:()=>analysisEnabled,
    canGenerate:()=>imageEditEnabled,
    editJobs:()=>request('/jobs?kind=edit').then(data=>data.jobs),
    async generate(photoIds,recipe,requestId){const draft={...recipe};if(recipe.reference?.src)draft.reference={...recipe.reference,src:await materialize(recipe.reference.src,recipe.reference.name||'reference.jpg','reference')};return (await request('/jobs',{method:'POST',body:JSON.stringify({kind:'edit',photoIds,recipe:draft,requestId})})).jobs;},
    models:()=>request('/ai/models'),
    refreshModels:()=>request('/ai/models/refresh',{method:'POST',body:'{}'}),
    months:(category='all',next=null)=>request('/photos/months?category='+encodeURIComponent(category)+(next?'&cursor='+encodeURIComponent(next):'')),
    groups:()=>request('/groups'),
    async analyze(photoIds){return (await request('/jobs',{method:'POST',body:JSON.stringify({kind:'analyze',photoIds})})).jobs;},
    async jobs(ids){return (await request('/jobs?ids='+encodeURIComponent(ids.join(',')))).jobs;},
    hasMore:()=>Boolean(cursor),
    visibleIds:()=>visible,
    count:()=>total,
    async more(){if(!cursor)return [];const page=await list('photos',cursor);cursor=page.nextCursor;return page.items;},
    async filter(next,nextMonth='all'){const previous=[category,month];category=next;month=nextMonth;try{const page=await list('photos');cursor=page.nextCursor;return page.items;}catch(error){[category,month]=previous;throw error;}},
    async photo(id){return (await request('/photos/'+encodeURIComponent(id))).item;},
    resolve,
    savePhoto,
    saveAlbum:album=>put('albums',album),
    async saveStyle(style){const data={...style};if(style.reference?.src)data.reference={...style.reference,src:await materialize(style.reference.src,style.reference.name||'reference.jpg','reference',style.id+'-reference')};return put('styles',data);},
  };
}
