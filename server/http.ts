type RecordData = Record<string, any>;
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
export const privateHeaders = {'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export class ApiError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
export function fail(status:number,message:string):never {throw new ApiError(status,message);}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:privateHeaders});}
export function identifier(value:unknown):string {if(typeof value!=='string'||!ID.test(value))fail(400,'Invalid identifier.');return value as string;}
export async function body(request:Request):Promise<RecordData>{
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))fail(400,'Expected JSON.');
  // Bound metadata before parsing, including requests with no Content-Length.
  const data = await boundedBytes(request.body,64*1024);
  let value;try{value=JSON.parse(new TextDecoder().decode(data));}catch{fail(400,'Invalid JSON.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Expected an object.');return value;
}
export async function boundedBytes(stream:ReadableStream<Uint8Array>|null,max:number){
  if(!stream)fail(400,'Missing body.');const reader=stream.getReader(),parts:Uint8Array[]=[];let length=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();fail(413,'File or metadata is too large.');}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;
}
