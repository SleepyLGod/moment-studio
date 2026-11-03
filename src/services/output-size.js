import {recipeSignature} from '../recipes.js';
/** Upright original pixel geometry; previews never replace full-size metadata. */
export function photoDimensions(photo){
 if(photo?.uprightWidth&&photo?.uprightHeight)return {width:photo.uprightWidth,height:photo.uprightHeight};
 if(!Number.isInteger(photo?.width)||!Number.isInteger(photo?.height))return null;
 return [5,6,7,8].includes(photo.orientation)?{width:photo.height,height:photo.width}:{width:photo.width,height:photo.height};
}
/** Current Cloudflare adapter bounds, not a claim about every model's limits. */
export function validateOutputSize(size){
 if(!size||![size.width,size.height].every(n=>Number.isInteger(n)&&n>=256&&n<=2048))throw new Error('This model supports 256–2048 pixels per side. Choose a custom size; the original will not be resized automatically.');
 if(size.width%16||size.height%16)throw new Error('This model requires dimensions in steps of 16. Choose a custom size.');
 return {width:size.width,height:size.height};
}
/** An explicit preset action; never applied silently to an Original request. */
export function fitOutputSize(size,max=2048){
 const gcd=(a,b)=>b?gcd(b,a%b):a,unit=gcd(size.width,size.height),x=size.width/unit,y=size.height/unit,k=Math.floor(max/(16*Math.max(x,y)))*16;
 const result=k?{width:x*k,height:y*k}:{width:Math.round(max*size.width/Math.max(size.width,size.height)/16)*16,height:Math.round(max*size.height/Math.max(size.width,size.height)/16)*16};
 validateOutputSize(result);if(Math.abs(result.width/result.height-size.width/size.height)/(size.width/size.height)>.01)throw new Error('This aspect ratio needs a different model or a custom size.');return result;
}
export function editSignature(recipe,output){return JSON.stringify([recipeSignature(recipe),output]);}
/** Browser-only fallback for older JPEG/PNG records without stored geometry. */
export async function readPhotoSize(photo){
 const stored=photoDimensions(photo);if(stored)return stored;
 if(photo.originalMime==='image/heic')throw new Error('Original HEIC dimensions are unavailable. Choose a custom size.');
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('Could not read the original dimensions.'));image.src=photo.src;});
}
