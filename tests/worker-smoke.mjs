import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const origin=process.argv[2]||'http://127.0.0.1:4174';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))throw new Error('Local mock-auth smoke test must only target loopback.');
const anonymous=await fetch(origin+'/api/me',{redirect:'manual'});assert.equal(anonymous.status,401);
const login=await fetch(origin+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'});
let cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');assert.ok(cookie,'Local sign-in must return a session cookie');
async function api(path,method='GET',body){
  const response=await fetch(origin+'/api'+path,{method,headers:{cookie,origin,...(body&&!(body instanceof Uint8Array)?{'content-type':'application/json'}:{})},body:body instanceof Uint8Array?body:body===undefined?undefined:JSON.stringify(body)});
  assert.ok(response.ok,method+' '+path+': '+response.status+' '+(response.ok?'':await response.text()));return response;
}
await api('/bootstrap','POST',{});
const bytes=readFileSync(new URL('../public/photos/1060.jpg',import.meta.url)),id='qa-'+crypto.randomUUID();
const descriptor={id,name:'Cloud smoke coffee.jpg',mime:'image/jpeg',size:bytes.length,purpose:'original'};
await api('/uploads','POST',descriptor);await api('/uploads','POST',descriptor);
await api('/uploads/'+id+'/body','PUT',bytes);
const changed=new Uint8Array(bytes);changed[changed.length-1]^=1;await api('/uploads/'+id+'/body','PUT',changed);
const file=(await (await api('/uploads/'+id+'/complete','POST',{})).json()).file;
const photo=(await (await api('/photos/'+id,'PUT',{id,name:'Cloud smoke coffee',src:file.src,kind:'photo',style:'original',category:'日常'})).json()).item;
const edited=(await (await api('/photos/'+id,'PUT',{...photo,category:'旅行'})).json()).item;
assert.equal(edited.category,'旅行');
const album={id:'album-'+id,title:'Cloud smoke album',note:'Persistent example data',photoIds:[id]};await api('/albums/'+album.id,'PUT',album);
const style={id:'style-'+id,name:'Cloud smoke style',prompt:'Layered paper',preserve:true,reference:{src:file.src,name:'Coffee'}};await api('/styles/'+style.id,'PUT',style);
const downloaded=new Uint8Array(await (await api('/files/'+id+'?download=1')).arrayBuffer());
const sha=value=>createHash('sha256').update(value).digest('hex');assert.equal(sha(downloaded),sha(bytes));
const reauthenticated=await fetch(origin+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'});assert.ok(reauthenticated.headers.getSetCookie().length);cookie=reauthenticated.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
assert.equal((await (await api('/photos/'+id)).json()).item.name,photo.name);
console.log(JSON.stringify({result:'PASS',environment:'local Workers D1/R2',anonymous:401,uploadRetry:true,originalSha256:sha(bytes),photoId:id,album:true,styleReference:true,reauthentication:true}));
