import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {STYLE_RECIPES, LAB_RECIPES, sampleFor, makeSampleDerivative, recipeSignature} from '../src/recipes.js';

const photo={id:'1015',src:'/photos/fjord-demo.png',name:'原片',kind:'photo',style:'original'};
for(const recipe of STYLE_RECIPES) {
  for(const src of ['/photos/fjord-demo.png','/photos/1067.jpg','/photos/1060.jpg']) {
    const result=sampleFor({...photo,src},recipe);
    assert.ok(result);
    assert.ok(existsSync(new URL('../public'+result,import.meta.url)));
    assert.ok(existsSync(new URL('../public'+result.replace('.png','.provenance.json'),import.meta.url)));
  }
  assert.equal(sampleFor({...photo,src:'data:image/jpeg;base64,upload'},recipe),null);
  assert.equal(sampleFor(photo,{...recipe,prompt:recipe.prompt+' 更多星星'}),null);
  assert.equal(sampleFor(photo,{...recipe,preserve:false}),null);
  assert.equal(sampleFor(photo,{...recipe,reference:{src:'data:image/png;base64,reference'}}),null);
}
for(let i=0;i<LAB_RECIPES.length;i++){
  assert.equal(recipeSignature(LAB_RECIPES[i]),recipeSignature(STYLE_RECIPES[i]));
  assert.equal(sampleFor(photo,LAB_RECIPES[i]),sampleFor(photo,STYLE_RECIPES[i]));
}
const before=JSON.stringify(photo),recipe=STYLE_RECIPES[0];
const output=makeSampleDerivative(photo,recipe,'new-id','2026-11-02');
assert.equal(JSON.stringify(photo),before);
assert.equal(output.parentPhotoId,photo.id);
assert.equal(output.src,photo.src);
assert.equal(output.generationSrc,output.renderedSrc);
assert.notEqual(output.id,photo.id);
assert.equal(output.generationSource,'pregenerated-demo');
assert.equal(output.recipeSignature,recipeSignature(recipe));
assert.equal(sampleFor(output,recipe),null);
assert.throws(()=>makeSampleDerivative(photo,{...recipe,prompt:'other'},'invalid','today'));
console.log('PASS: 9 assets/provenance; exact recipe eligibility; custom input exclusion; immutable originals.');
