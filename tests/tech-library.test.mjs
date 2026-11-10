import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {validateCatalog,toUnverified,validURL,productionReadiness,findRecords,loadTechCatalogs} from '../tech-data/tech-library.mjs';
const base=new URL('../tech-data/',import.meta.url);
async function get(n){return JSON.parse(await fs.readFile(new URL(n,base),'utf8'))}
test('tech library contains technical catalogs and 24 additional templates',async()=>{
 const catalogs=await loadTechCatalogs(async path=>({ok:true,json:()=>get(path.split('/').at(-1))}));
 assert.equal(catalogs.modules.templates.length,24);
 assert.equal(catalogs.materials.items.length,13);
 assert.equal(catalogs.edging.items.length,12);
 assert.equal(catalogs.hardware.items.length,4);
 assert.equal(catalogs.production.items.length,3);
 assert.ok(catalogs.sources.items.length>=10);
});
test('no unverified technical records have manufacturing approval',async()=>{
 const data=await loadTechCatalogs(async path=>({ok:true,json:()=>get(path.split('/').at(-1))}));
 assert.equal(productionReadiness(data).ready,false);
 for(const k of ['materials','edging','hardware','production'])assert.ok(data[k].items.every(x=>x.manufacturingApproved===false));
});
test('imported materials are always marked draft even if file claims production approved',async()=>{
 let item=(await get('materials.json')).items[0];
 const untrusted={format:'furnix.tech.materials',version:1,items:[{...item,manufacturingApproved:true,reviewStatus:'production_validated'}]};
 const sanitized=toUnverified('materials',untrusted);assert.equal(sanitized.items[0].manufacturingApproved,false);assert.equal(sanitized.items[0].reviewStatus,'draft');
});
test('catalog rejects duplicate IDs',async()=>{
 let doc=await get('edgebands.json');assert.throws(()=>validateCatalog('edging',{...doc,items:[doc.items[0],doc.items[0]]}),/повторний/);
});
test('catalog rejects invalid dimensions and bad URLs',async()=>{
 let doc=await get('materials.json');
 assert.throws(()=>validateCatalog('materials',{...doc,items:[{...doc.items[0],thicknessMm:-12}]}),/товщина/);
 assert.equal(validURL('javascript:alert(1)'),null);
 assert.throws(()=>validateCatalog('materials',{...doc,items:[{...doc.items[0],sourceUrl:'javascript:alert(1)'}]}),/посилання/);
});
test('search by manufacturer works',async()=>{let doc=await get('hardware.json');assert.equal(findRecords(doc.items,'Hettich').length,1)});
test('missing catalogue fails closed',async()=>{await assert.rejects(loadTechCatalogs(async()=>({ok:false})),/Не відкривається/)});
