/** Detect supported still-image bytes, independently of extension or browser MIME. */
export function photoMime(bytes){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
  const text=(start,end)=>new TextDecoder().decode(bytes.subarray(start,end));
  if(bytes.length>=12&&text(0,4)==='RIFF'&&text(8,12)==='WEBP')return 'image/webp';
  if(bytes.length<16||text(4,8)!=='ftyp')return null;
  const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
  if(size<16||size>bytes.length||size>512||size%4)return null;
  const brands=[text(8,12)];for(let i=16;i<size;i+=4)brands.push(text(i,i+4));
  if(brands.some(brand=>['hevc','hevx','msf1','avis'].includes(brand)))return null;
  return brands.some(brand=>['heic','heix'].includes(brand))?'image/heic':null;
}
