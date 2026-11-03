import {UPLOAD_SAMPLES} from '../data.js';
import {calendarDay} from './organization.js';

export function prepareStyleSave(draft,name,cover,pending){
  if(pending)return pending;
  return {...draft,id:crypto.randomUUID(),name:name.trim(),cover,createdAt:new Date().toISOString()};
}
export function prepareSampleBatch(pending){
  if(pending)return pending;
  const batch=crypto.randomUUID(),date=calendarDay(Date.now());
  return UPLOAD_SAMPLES.map(([id,name,demoCategory])=>({id:'sample-'+id+'-'+batch,name,src:'/photos/'+id+'.jpg',demoCategory,category:'待分类',date,style:'original',kind:'photo'}));
}
export const COLLAGE_MAX={editorial:3,grid:4,nine:9,strip:6};
export function collageInputs(photos,layout,offset=0){
  if(!photos.length)return [];
  const start=offset%photos.length;
  return [...photos.slice(start),...photos.slice(0,start)].slice(0,COLLAGE_MAX[layout]);
}
export function mergePhotos(current,incoming){
  const byId=new Map(current.map(p=>[p.id,p]));for(const photo of incoming)byId.set(photo.id,photo);
  return [...byId.values()].sort((a,b)=>(b._order||0)-(a._order||0)||b.id.localeCompare(a.id));
}
