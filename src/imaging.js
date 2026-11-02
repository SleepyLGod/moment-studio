import {photoSrc,styleFor} from './data';
export function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片未能加载，请重试'));image.src=src;});}
export async function renderStyle(photo,styleId){
 if(styleId==='original')return {...photo,style:'original',renderedSrc:undefined};
 const image=await loadImage(photo.src);const canvas=document.createElement('canvas');const scale=Math.min(1,1200/image.naturalWidth,1200/image.naturalHeight);canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
 const ctx=canvas.getContext('2d');ctx.filter=styleFor(styleId).filter;ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.filter='none';
 if(styleId==='soft'){const frame=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<frame.data.length;i+=4){for(let c=0;c<3;c++)frame.data[i+c]=Math.min(255,Math.round(frame.data[i+c]/24)*24+3);}ctx.putImageData(frame,0,0);}
 return {...photo,style:styleId,renderedSrc:canvas.toDataURL('image/jpeg',.91)};
}
function cover(ctx,image,x,y,w,h){const r=Math.max(w/image.naturalWidth,h/image.naturalHeight);const sw=w/r,sh=h/r;ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h);}
export async function renderCollage(photos,{layout='editorial',gap=18,title='',background='#f7f4ed'}={}){
 if(!photos.length)return null;
 const canvas=document.createElement('canvas');canvas.width=layout==='strip'?1800:1600;canvas.height=layout==='strip'?850:layout==='nine'?1600:1200;const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
 const margin=48;const bottom=title?112:margin;const x=margin,y=margin,w=canvas.width-margin*2,h=canvas.height-margin-bottom;const items=photos.slice(0,layout==='nine'?9:layout==='strip'?6:layout==='editorial'?3:4);const images=await Promise.all(items.map(p=>loadImage(photoSrc(p))));const cells=[];
 if(layout==='editorial'&&items.length>=3){cells.push([x,y,(w-gap)*.64,h],[x+(w-gap)*.64+gap,y,(w-gap)*.36,(h-gap)/2],[x+(w-gap)*.64+gap,y+(h+gap)/2,(w-gap)*.36,(h-gap)/2]);}
 else{const cols=layout==='strip'?items.length:layout==='nine'?3:Math.min(2,items.length);const rows=Math.ceil(items.length/cols);const cw=(w-gap*(cols-1))/cols,ch=(h-gap*(rows-1))/rows;items.forEach((_,i)=>cells.push([x+(i%cols)*(cw+gap),y+Math.floor(i/cols)*(ch+gap),cw,ch]));}
 images.forEach((image,i)=>cover(ctx,image,...cells[i]));
 if(title){ctx.fillStyle=background==='#22262d'?'#ffffff':'#2e3036';ctx.font='500 32px -apple-system, BlinkMacSystemFont, sans-serif';ctx.textBaseline='middle';ctx.fillText(title.slice(0,40),margin,canvas.height-55,canvas.width-margin*2);}
 return canvas.toDataURL('image/jpeg',.94);
}
export function downloadFile(content,filename,type){
 let blob;
 if(typeof content==='string'&&content.startsWith('data:')){const [header,encoded]=content.split(',');const binary=atob(encoded);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));blob=new Blob([bytes],{type:header.match(/^data:([^;]+)/)?.[1]||'application/octet-stream'});}
 else blob=new Blob([content],{type});
 const href=URL.createObjectURL(blob);const link=document.createElement('a');link.href=href;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);
}
export function escapeHtml(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export async function exportAlbum(album,photos){const entries=await Promise.all(photos.map(async p=>{const image=await loadImage(photoSrc(p));const c=document.createElement('canvas');const scale=Math.min(1,1400/image.naturalWidth);c.width=image.naturalWidth*scale;c.height=image.naturalHeight*scale;c.getContext('2d').drawImage(image,0,0,c.width,c.height);return {name:p.name,src:c.toDataURL('image/jpeg',.9)};}));const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(album.title)}</title><style>body{margin:0;background:#faf9f6;color:#262930;font:16px/1.8 -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1050px;margin:auto;padding:64px 24px}h1{font-size:40px;line-height:1.2}p{white-space:pre-wrap;color:#69717b}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}figure{margin:0}img{width:100%;display:block}figcaption{font-size:13px;color:#69717b;margin-top:8px}@media(max-width:600px){.grid{grid-template-columns:1fr}}</style><main><h1>${escapeHtml(album.title)}</h1><p>${escapeHtml(album.note||'')}</p><div class="grid">${entries.map(p=>`<figure><img src="${p.src}" alt="${escapeHtml(p.name)}"><figcaption>${escapeHtml(p.name)}</figcaption></figure>`).join('')}</div><p>片刻 · 照片画册</p></main></html>`;downloadFile(html,`${album.title}.html`,'text/html;charset=utf-8');}
