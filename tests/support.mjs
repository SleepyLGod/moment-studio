import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function environment(){
  const sql=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const wrap=(query,args=[])=>({bind:(...values)=>wrap(query,values),first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>{const r=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}});
  const objects=new Map();
  const BUCKET={put:async(key,body,options)=>{const bytes=new Uint8Array(await new Response(body).arrayBuffer());const value={key,size:bytes.length,httpMetadata:options?.httpMetadata,body:new Response(bytes).body,arrayBuffer:async()=>bytes.buffer};objects.set(key,{...value,bytes});return value;},head:async key=>objects.get(key)||null,get:async key=>{const v=objects.get(key);return v?{...v,body:new Response(v.bytes).body}:null;}};
  return {DB:{prepare:wrap,batch:async statements=>{sql.exec('BEGIN');try{const rows=[];for(const statement of statements)rows.push(await statement.run());sql.exec('COMMIT');return rows;}catch(error){sql.exec('ROLLBACK');throw error;}}},BUCKET,sql,objects};
}
