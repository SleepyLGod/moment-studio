import type {GalleryEnv} from './api.ts';
import {fail,json} from './http.ts';
import {CATEGORIES} from '../src/data.js';
import {calendarDay,dayOffset,recentGroups} from '../src/services/organization.js';

export function photoScope(ownerId:string,category:string|null,month:string|null,trash=false){
  const conditions=['owner_id=?',trash?'deleted_at IS NOT NULL':'deleted_at IS NULL'],args:(string|number)[]=[ownerId];
  if(category&&category!=='all'){if(!CATEGORIES.includes(category))fail(400,'Invalid photo category.');conditions.push("json_extract(data,'$.category')=?");args.push(category);}
  if(month&&month!=='all'){
    if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||month.startsWith('0000'))fail(400,'Invalid photo month.');
    conditions.push('timeline_day>=? AND timeline_day<=?');args.push(month+'-01',month+'-31');
  }
  return {conditions,args};
}
type Row={id:string;data:string;revision:number;created_at:number;timeline_day?:string;date_source?:string;deleted_at?:number|null};
export function presentPhoto(row:Row){return {...JSON.parse(row.data),...('deleted_at' in row?{trashedAt:row.deleted_at||null}:{}),revision:row.revision,_order:row.created_at,...(row.timeline_day?{timelineDay:row.timeline_day,dateSource:row.date_source}:{})};}

/** Collection reads never mutate photos, manual albums or files. */
export async function handleLibraryViews(request:Request,env:GalleryEnv,ownerId:string):Promise<Response|null>{
  const url=new URL(request.url);if(request.method!=='GET')return null;
  if(url.pathname==='/api/photos/months'){
    const limit=Number(url.searchParams.get('limit')||50);if(!Number.isInteger(limit)||limit<1||limit>50)fail(400,'Invalid page size.');
    const {conditions,args}=photoScope(ownerId,url.searchParams.get('category'),null),cursor=url.searchParams.get('cursor');
    if(cursor){if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(cursor))fail(400,'Invalid month cursor.');conditions.push('timeline_day<?');args.push(cursor+'-01');}
    const rows=(await env.DB.prepare(`SELECT substr(timeline_day,1,7) AS month,count(*) AS count,min(id) AS coverId FROM photos WHERE ${conditions.join(' AND ')} GROUP BY substr(timeline_day,1,7) ORDER BY month DESC LIMIT ?`).bind(...args,limit+1).all<{month:string;count:number;coverId:string}>()).results;
    const months=rows.slice(0,limit);return json({months,nextCursor:rows.length>limit?months.at(-1)!.month:null,timeZone:'Asia/Hong_Kong'});
  }
  if(url.pathname==='/api/groups'){
    const today=calendarDay(Date.now())!,from=dayOffset(today,-29);
    const rows=(await env.DB.prepare("SELECT * FROM photos WHERE owner_id=? AND deleted_at IS NULL AND timeline_day>=? AND timeline_day<=? AND coalesce(json_extract(data,'$.kind'),'photo')='photo' ORDER BY timeline_day DESC,created_at DESC,id DESC LIMIT 301").bind(ownerId,from,today).all<Row>()).results;
    const scanned=rows.slice(0,300);return json({groups:recentGroups(scanned.map(presentPhoto),today),days:30,from,to:today,scanned:scanned.length,truncated:rows.length>300,timeZone:'Asia/Hong_Kong'});
  }
  return null;
}
