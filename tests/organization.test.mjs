import test from 'node:test';
import assert from 'node:assert/strict';
import {environment} from './support.mjs';
import {handleApi} from '../server/api.ts';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const owner={userId:'owner-a',email:'owner@example.test'};
const now=Date.parse('2026-11-03T17:30:00Z'); // Nov 4 in Hong Kong.
function api(env,path,method='GET',data,user=owner){return handleApi(new Request('https://moment.test/api'+path,{method,...(data?{headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{})}),env,user);}
async function photo(env,id,date,extra={}){const r=await api(env,'/photos/'+id,'PUT',{id,name:id,src:'/photos/1060.jpg',kind:'photo',category:'旅行',...(date?{date}:{}),...extra});assert.equal(r.status,200,await r.clone().text());return (await r.json()).item;}

test('months aggregate the whole library, filter paginated photos and retain honest date sources',async t=>{
  t.mock.method(Date,'now',()=>now);const env=environment();
  await photo(env,'oct','2026-10-31');
  await photo(env,'nov','2026-11-02');
  await photo(env,'boundary',null,{capturedAt:'2026-10-31T18:10:00Z'});
  await photo(env,'fallback');
  await photo(env,'invalid-date','2026-02-30');
  await photo(env,'city','2026-11-01',{category:'城市'});
  const response=await api(env,'/photos/months?limit=1');assert.equal(response.status,200,await response.clone().text());
  const first=await response.json();assert.equal(first.months[0].month,'2026-11');assert.equal(first.months[0].count,5);assert.equal(first.nextCursor,'2026-11');
  const second=await (await api(env,'/photos/months?limit=1&cursor=2026-11')).json();assert.equal(second.months[0].month,'2026-10');assert.equal(second.months[0].count,1);
  const all=[];let cursor;
  do{const page=await (await api(env,'/photos?month=2026-11&category='+encodeURIComponent('旅行')+'&limit=2'+(cursor?'&cursor='+encodeURIComponent(cursor):''))).json();assert.equal(page.total,4);all.push(...page.items);cursor=page.nextCursor;}while(cursor);
  assert.deepEqual(all.map(p=>p.id).sort(),['boundary','fallback','invalid-date','nov']);
  assert.equal(all.find(p=>p.id==='boundary').timelineDay,'2026-11-01');assert.equal(all.find(p=>p.id==='boundary').dateSource,'captured');
  assert.equal(all.find(p=>p.id==='fallback').timelineDay,'2026-11-04');assert.equal(all.find(p=>p.id==='fallback').dateSource,'imported');
  const category=await (await api(env,'/photos/months?category='+encodeURIComponent('城市'))).json();assert.equal(category.months.length,1);assert.equal(category.months[0].count,1);
  assert.equal((await api(env,'/photos?month=2026-13')).status,400);
});

test('recent groups are readonly, owner-scoped, bounded and do not touch manual albums',async t=>{
  t.mock.method(Date,'now',()=>Date.parse('2026-11-03T12:00:00Z'));const env=environment();
  await photo(env,'a','2026-11-03',{aiTags:['Coffee','手冲']});await photo(env,'b','2026-11-03',{aiTags:['coffee']});
  await photo(env,'c','2026-11-02');await photo(env,'d','2026-11-02');await photo(env,'old','2026-10-01');
  await photo(env,'creation','2026-11-03',{kind:'collage'});
  await api(env,'/albums/manual','PUT',{id:'manual',title:'Mine',note:'Keep the order',photoIds:['d','a','b']});
  const before=env.sql.prepare('SELECT * FROM albums').all();
  const response=await api(env,'/groups');assert.equal(response.status,200,await response.clone().text());const data=await response.json();
  assert.deepEqual(data.groups.map(g=>({day:g.day,basis:g.basis,ids:[...g.photoIds].sort()})),[{day:'2026-11-03',basis:'ai-tags',ids:['a','b']},{day:'2026-11-02',basis:'date',ids:['c','d']}]);
  assert.equal(data.truncated,false);assert.equal(data.days,30);
  assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),before);
  assert.equal((await api(env,'/groups','GET',undefined,null)).status,401);
  assert.equal((await api(env,'/photos/months','GET',undefined,{userId:'other',email:'other@test'})).status,403);
  for(let i=0;i<305;i++)await photo(env,'many-'+String(i).padStart(3,'0'),'2026-11-03',{aiTags:['city']});
  const bounded=await (await api(env,'/groups')).json();assert.equal(bounded.truncated,true);assert.equal(bounded.scanned,300);assert.ok(bounded.groups.every(g=>g.photoIds.length>=2&&g.photoIds.length<=20));
  const members=bounded.groups.flatMap(g=>g.photoIds);assert.equal(new Set(members).size,members.length);assert.ok(members.length<=300);
  assert.deepEqual(env.sql.prepare('SELECT * FROM albums').all(),before);
});

test('grouping is deterministic, shared tags take priority and singletons are not invented albums',async()=>{
  const {recentGroups}=await import('../src/services/organization.js');
  const input=Array.from({length:25},(_,i)=>({id:String(i).padStart(2,'0'),date:'2026-11-03',kind:'photo',aiTags:['CITY']}));
  const first=recentGroups(input,'2026-11-03'),again=recentGroups([...input].reverse(),'2026-11-03');assert.deepEqual(first,again);
  assert.deepEqual(first.map(g=>g.photoIds.length),[20,5]);assert.equal(first.flatMap(g=>g.photoIds).length,25);
  assert.deepEqual(recentGroups([{id:'alone',date:'2026-11-03'}],'2026-11-03'),[]);
});

test('updating a date moves the indexed month while preserving category and album membership',async()=>{
  const env=environment(),saved=await photo(env,'a','2026-10-02');
  await api(env,'/albums/manual','PUT',{id:'manual',title:'Manual',note:'',photoIds:['a']});
  const edited=await api(env,'/photos/a?month=2026-10','PUT',{...saved,date:'2026-11-02'});assert.equal(edited.status,200,await edited.clone().text());assert.equal((await edited.json()).total,0);
  assert.equal((await (await api(env,'/photos?month=2026-11')).json()).total,1);
  assert.deepEqual((await (await api(env,'/albums')).json()).items[0].photoIds,['a']);
});
test('timeline migration backfills old photos without rewriting their metadata or albums',()=>{
  const sql=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>/^000[0-4]_.*\.sql$/.test(name)).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const data=[{id:'old',date:'2026-10-02',category:'旅行'},{id:'captured',capturedAt:'2026-10-31T18:10:00Z'},{id:'invalid',date:'2026-02-30'},{id:'file',date:'2026-11-01',dateSource:'file-modified'}];
  for(const value of data)sql.prepare('INSERT INTO photos(id,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?)').run(value.id,'owner-a',JSON.stringify(value),now,now);
  sql.exec("INSERT INTO albums(id,owner_id,data,created_at,updated_at) VALUES ('mine','owner-a','{\"photoIds\":[\"old\"]}',0,0)");
  const before=sql.prepare('SELECT id,data,revision FROM photos ORDER BY id').all(),albums=sql.prepare('SELECT * FROM albums').all();
  sql.exec(readFileSync(new URL('../drizzle/0005_ambiguous_wild_pack.sql',import.meta.url),'utf8'));
  assert.deepEqual(sql.prepare('SELECT id,data,revision FROM photos ORDER BY id').all(),before);assert.deepEqual(sql.prepare('SELECT * FROM albums').all(),albums);
  assert.deepEqual({...sql.prepare('SELECT timeline_day,date_source FROM photos WHERE id=?').get('captured')},{timeline_day:'2026-11-01',date_source:'captured'});
  assert.equal(sql.prepare('SELECT timeline_day FROM photos WHERE id=?').get('invalid').timeline_day,'2026-11-04');
  assert.equal(sql.prepare('SELECT date_source FROM photos WHERE id=?').get('file').date_source,'file-modified');
});

test('demo months and recent groups ignore trashed photos and recover them on restore',async()=>{
 const {monthGroups,recentGroups}=await import('../src/services/organization.js');
 const items=[{id:'a',date:'2026-11-03',category:'旅行'},{id:'b',date:'2026-11-03',category:'旅行',trashedAt:1},{id:'c',date:'2026-10-01',trashedAt:1}];
 assert.deepEqual(monthGroups(items,'all').map(m=>[m.month,m.count]),[['2026-11',1]]);assert.deepEqual(recentGroups(items,'2026-11-03'),[]);
 const restored=items.map(p=>({...p,trashedAt:null}));assert.equal(monthGroups(restored,'旅行')[0].count,2);assert.deepEqual(recentGroups(restored,'2026-11-03')[0].photoIds,['a','b']);
});
