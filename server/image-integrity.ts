export async function digest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function jpegDimensions(bytes:Uint8Array){
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=2;
  while(offset+4<bytes.length){if(bytes[offset++]!==255)return null;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)return null;
    const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)return null;
    if([192,193,194].includes(marker)&&length>=8)return {height:view.getUint16(offset+3),width:view.getUint16(offset+5)};offset+=length;
  }return null;
}
