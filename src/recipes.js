// A demo is eligible only for an exact recipe and a bundled original photograph.
export const STYLE_RECIPES = [
  {id:'paper',name:'层叠纸雕',prompt:'将照片重绘为层叠纸雕，保留主体与构图，深蓝与苔绿配色，纸张纤维清晰，柔和侧光。',preserve:true,reference:null},
  {id:'clay',name:'黏土旅行',prompt:'将照片重绘为黏土定格动画场景，保留主体与构图，圆润手工造型、可见黏土纹理与柔和自然光。',preserve:true,reference:null},
  {id:'comic',name:'旧版漫画',prompt:'将照片重绘为旧版印刷漫画，保留主体与构图，清晰墨线、网点与轻微套印偏移，苔绿、深蓝和暖纸色。',preserve:true,reference:null},
];
export const LAB_RECIPES = STYLE_RECIPES.map((recipe,index)=>({...recipe,
  name:['Paper cut','Clay world','Vintage print'][index],
  prompt:[
    'Layered paper sculpture. Keep the composition. Moss green, deep blue, paper fibers and soft side light.',
    'Handmade clay, stop-motion feel. Keep the composition. Rounded forms, tactile textures and soft light.',
    'Vintage comic print. Keep the composition. Ink lines, halftone, moss green and warm paper.'
  ][index],
}));
const SOURCES = new Map([
  ['/photos/fjord-demo.png','fjord'],
  ['/photos/1067.jpg','city'],
  ['/photos/1060.jpg','coffee'],
]);
export function recipeSignature(recipe) {
  const translated=LAB_RECIPES.findIndex(item=>item.prompt===recipe.prompt.trim());
  const prompt=translated>=0?STYLE_RECIPES[translated].prompt:recipe.prompt.trim();
  return JSON.stringify([prompt,Boolean(recipe.preserve),recipe.reference?.src||null]);
}
export function matchingRecipe(recipe) {
  return [...STYLE_RECIPES,...LAB_RECIPES].find(item=>recipeSignature(item)===recipeSignature(recipe))||null;
}
export function sampleFor(photo,recipe) {
  const source=photo?.kind==='generation'?null:SOURCES.get(photo?.src);
  const style=matchingRecipe(recipe);
  return source&&style?'/styles/'+style.id+'-'+source+'.png':null;
}
export function makeSampleDerivative(photo,recipe,id,date) {
  const result=sampleFor(photo,recipe);
  if(!result)throw new Error('No pre-generated sample for this photo or recipe.');
  return {...photo,id,name:photo.name+' · '+recipe.name,src:photo.src,renderedSrc:result,generationSrc:result,
    category:'创作',style:'generated',kind:'generation',parentPhotoId:photo.id,recipeName:recipe.name,
    recipe:{prompt:recipe.prompt,preserve:recipe.preserve,reference:recipe.reference||null},
    recipeSignature:recipeSignature(recipe),generationSource:'pregenerated-demo',date};
}
