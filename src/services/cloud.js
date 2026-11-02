/** A resource client: no cloud records or image bytes are persisted in browser storage. */
export function createCloudLibrary(){
  const revisions=new Map();let cursor=null;
  async function request(path,options={}){
    const response=await fetch('/api'+path,{...options,credentials:'same-origin',headers:{...(options.body&&typeof options.body==='string'?{'content-type':'application/json'}:{}),...options.headers}});
    const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
    if(!response.ok){const error=new Error(data.error||'Cloud request failed.');error.status=response.status;throw error;}return data;
  }
  function remember(table,items){for(const item of items)revisions.set(table+'/'+item.id,item.revision);return items;}
  async function put(table,item){
    const revision=revisions.get(table+'/'+item.id)??item.revision;
    const result=await request('/'+table+'/'+encodeURIComponent(item.id),{method:'PUT',body:JSON.stringify({...item,...(revision===undefined?{}:{revision})})});
    remember(table,[result.item]);return result.item;
  }
  async function list(table,next=null){
    const result=await request('/'+table+'?limit=50'+(next?'&cursor='+encodeURIComponent(next):''));remember(table,result.items);return result;
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
    return upload(await response.blob(),name,purpose,id);
  }
  async function savePhoto(photo){
    const data={...photo};delete data.file;delete data.previewBlob;
    if(photo.file){
      data.src=await upload(photo.file,photo.file.name,'original',photo.id+'-original');
      if(photo.previewBlob)data.thumbnailSrc=await upload(photo.previewBlob,'preview.jpg','preview',photo.id+'-preview');
    }else data.src=await materialize(photo.src,photo.name+'.jpg','original',photo.id+'-original');
    if(photo.renderedSrc)data.renderedSrc=await materialize(photo.renderedSrc,photo.name+'.jpg','rendered',photo.generationSource==='pregenerated-demo'?photo.id+'-result':undefined,photo.generationSource==='pregenerated-demo'&&photo.renderedSrc.startsWith('/styles/'));
    if(photo.generationSrc)data.generationSrc=photo.generationSrc===photo.renderedSrc?data.renderedSrc:await materialize(photo.generationSrc,photo.name+'.jpg','generation',undefined,photo.generationSource==='pregenerated-demo'&&photo.generationSrc.startsWith('/styles/'));
    if(photo.recipe?.reference?.src)data.recipe={...photo.recipe,reference:{...photo.recipe.reference,src:await materialize(photo.recipe.reference.src,photo.recipe.reference.name||'reference.jpg','reference')}};
    return put('photos',data);
  }
  return {
    async load(seed=true){
      const me=await request('/me');if(seed&&!me.initialized)await request('/bootstrap',{method:'POST',body:'{}'});
      const photos=await list('photos');
      cursor=photos.nextCursor;return {photos:photos.items,albums:await all('albums'),savedStyles:await all('styles')};
    },
    hasMore:()=>Boolean(cursor),
    async more(){if(!cursor)return [];const page=await list('photos',cursor);cursor=page.nextCursor;return page.items;},
    async photo(id){const result=await request('/photos/'+encodeURIComponent(id));remember('photos',[result.item]);return result.item;},
    savePhoto,
    saveAlbum:album=>put('albums',album),
    async saveStyle(style){const data={...style};if(style.reference?.src)data.reference={...style.reference,src:await materialize(style.reference.src,style.reference.name||'reference.jpg','reference',style.id+'-reference')};return put('styles',data);},
  };
}
