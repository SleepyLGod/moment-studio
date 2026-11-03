import exifr from 'exifr';
import {calendarDay,timeline,validLocalTime} from './organization.js';

/** Only capture time, orientation and dimensions enter library metadata; never GPS. */
export function captureFields(tags={},lastModified){
  const fields={date:calendarDay(lastModified),dateSource:'file-modified'};
  const local=typeof tags.DateTimeOriginal==='string'?tags.DateTimeOriginal.trim().replace(/^(\d{4}):(\d{2}):(\d{2}) /,'$1-$2-$3T'):null;
  if(validLocalTime(local)){
    fields.capturedLocal=local;
    const offset=tags.OffsetTimeOriginal;
    if(typeof offset==='string'&&/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(offset))fields.capturedAt=local+offset;
    const date=timeline(fields);fields.date=date.day;fields.dateSource=date.source;
  }
  if(Number.isInteger(tags.Orientation)&&tags.Orientation>=1&&tags.Orientation<=8)fields.orientation=tags.Orientation;
  for(const [key,value] of [['width',tags.ExifImageWidth||tags.ImageWidth],['height',tags.ExifImageHeight||tags.ImageHeight]])if(Number.isInteger(value)&&value>0)fields[key]=value;
  return fields;
}
export async function captureMetadata(input,lastModified){
  let tags;
  try{tags=await exifr.parse(input,{pick:['DateTimeOriginal','OffsetTimeOriginal','Orientation','ExifImageWidth','ExifImageHeight','ImageWidth','ImageHeight'],silentErrors:false,reviveValues:false,translateValues:false,gps:false,xmp:false,icc:false,iptc:false,makerNote:false,userComment:false});}
  catch{return {...captureFields({},lastModified),metadataWarning:'Capture metadata could not be read; using file date.'};}
  return captureFields(tags||{},lastModified);
}
