import {photoMime} from './photo-format.js';
import {captureMetadata} from './import-metadata.js';

export const MAX_PHOTO_BYTES=12*1024*1024;
export function canChoosePhoto(file){return file.size>0&&file.size<=MAX_PHOTO_BYTES&&(/^(?:image\/(?:jpeg|png|webp|heic|heif))$/.test(file.type)||/\.(?:heic|heif)$/i.test(file.name));}
function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the photo.'));reader.readAsDataURL(blob);});}
async function decode(blob,mime){
  try{return await createImageBitmap(blob,{imageOrientation:'from-image'});}
  catch(error){
    if(mime!=='image/heic')throw new Error('The image could not be decoded.');
    const {heicTo}=await import('heic-to/csp');
    try{return await heicTo({blob,type:'bitmap'});}
    catch{throw new Error('This HEIC could not be decoded. Try exporting it as JPG.');}
  }
}
/** Decode sequentially, preserve original bytes, persist only one upright JPEG preview. */
export async function preparePhoto(file,{cloud=false}={}){
  if(!canChoosePhoto(file))throw new Error('Use HEIC, JPG, PNG or WebP files up to 12 MiB.');
  const mime=photoMime(new Uint8Array(await file.slice(0,512).arrayBuffer()));
  if(!mime)throw new Error(file.name+': unsupported or invalid still image.');
  const metadata=await captureMetadata(file,file.lastModified);
  if(metadata.width&&metadata.height&&metadata.width*metadata.height>64*1024*1024)throw new Error(file.name+': image dimensions are too large.');
  const original=new File([file],file.name,{type:mime,lastModified:file.lastModified});
  let bitmap,canvas;
  try{
    bitmap=await decode(original,mime);
    if(bitmap.width*bitmap.height>64*1024*1024)throw new Error(file.name+': image dimensions are too large.');
    canvas=document.createElement('canvas');const scale=Math.min(1,768/bitmap.width,768/bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const preview=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create a photo preview.')),'image/jpeg',.8));
    const record={id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),...metadata,originalMime:mime,previewWidth:canvas.width,previewHeight:canvas.height,category:'待分类',style:'original',kind:'photo'};
    if(cloud)return {...record,src:'',file:original,previewBlob:preview};
    return {...record,src:await dataUrl(original),thumbnailSrc:await dataUrl(preview)};
  }finally{bitmap?.close();if(canvas){canvas.width=1;canvas.height=1;}}
}
