export const LIBRARY_TIME_ZONE='Asia/Hong_Kong';
export function calendarDay(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
  return new Intl.DateTimeFormat('en-CA',{timeZone:LIBRARY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function validDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function timeline(photo,createdAt=Date.now()){
  if(typeof photo.capturedAt==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(photo.capturedAt)){
    const day=calendarDay(photo.capturedAt);if(day)return {day,source:'captured'};
  }
  if(validDay(photo.date))return {day:photo.date,source:photo.dateSource==='file-modified'?'file-modified':'record-date'};
  return {day:calendarDay(createdAt),source:'imported'};
}
export function dayOffset(day,offset){return new Date(Date.parse(day+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);}
export function photoDay(photo){return photo.timelineDay||timeline(photo,photo._order||photo.createdAt||Date.now()).day;}
export function monthTitle(month){return new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));}

/** Derived recent views: no image copies, inference requests or album writes. */
export function recentGroups(photos,today=calendarDay(Date.now())){
  const from=dayOffset(today,-29),days=new Map();
  for(const photo of photos){const day=photoDay(photo);if((photo.kind||'photo')!=='photo'||!day||day<from||day>today)continue;if(!days.has(day))days.set(day,[]);days.get(day).push(photo);}
  const groups=[];
  for(const [day,items] of [...days].sort(([a],[b])=>b.localeCompare(a))){
    items.sort((a,b)=>a.id.localeCompare(b.id));
    const tags=photo=>[...new Set((Array.isArray(photo.aiTags)?photo.aiTags:[]).filter(tag=>typeof tag==='string'&&tag.trim()&&tag.length<=20).map(tag=>tag.normalize('NFKC').trim().toLocaleLowerCase('en')))];
    const frequencies=new Map();for(const photo of items)for(const tag of tags(photo))frequencies.set(tag,(frequencies.get(tag)||0)+1);
    const buckets=new Map(),leftovers=[];
    for(const photo of items){
      const tag=tags(photo).filter(tag=>frequencies.get(tag)>=2).sort((a,b)=>frequencies.get(b)-frequencies.get(a)||a.localeCompare(b))[0];
      if(!tag){leftovers.push(photo);continue;}if(!buckets.has(tag))buckets.set(tag,[]);buckets.get(tag).push(photo);
    }
    function append(members,title,basis){for(let i=0;i<members.length;i+=20){const part=members.slice(i,i+20);if(part.length<2){if(basis==='ai-tags')leftovers.push(...part);continue;}groups.push({id:day+'|'+basis+'|'+title+'|'+i,day,title,basis,photoIds:part.map(p=>p.id),dateSources:[...new Set(part.map(p=>p.dateSource||timeline(p).source))].sort()});}}
    for(const [tag,members] of [...buckets].sort(([a],[b])=>a.localeCompare(b)))append(members,tag,'ai-tags');
    append(leftovers.sort((a,b)=>a.id.localeCompare(b.id)),'Same day','date');
  }
  return groups;
}
