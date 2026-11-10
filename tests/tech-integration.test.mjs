import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {loadAssemblyTemplates,adaptTechTemplate} from '../tech-data/assembly-adapter.mjs';
import {loadTechCatalogs,productionReadiness} from '../tech-data/tech-library.mjs';
const root=new URL('../',import.meta.url);
const editor=await fs.readFile(new URL('assembly-editor.js',root),'utf8');
const functionSource=editor.slice(editor.indexOf('function validCabinet(p)'),editor.indexOf('function validCabinetPlacement'));
const validate=vm.runInNewContext('const materialCodePattern=/^[a-z0-9_-]{1,40}$/;'+functionSource+';validCabinet');
const fetcher=async p=>{try{return {ok:true,json:async()=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'))}}catch{return {ok:false}}};
test('all 42 templates fit the actual assembly-editor validator',async()=>{
 const {templates,skipped}=await loadAssemblyTemplates(validate,fetcher);
 assert.equal(templates.length,42);assert.deepEqual(skipped,[]);
 const cabinet=templates.find(t=>t.id==='flp-base-735');assert.equal(cabinet.parameters.width,735);assert.equal(cabinet.parameters.dividerCount,1);
 assert.ok(templates.every(t=>t.parameters.x===0&&t.parameters.z===0));
 assert.equal(new Set(templates.map(t=>t.id)).size,42);
});
test('missing optional pack keeps available templates',async()=>{
 const {templates,skipped}=await loadAssemblyTemplates(validate,p=>p.includes('base-module')?{ok:false}:fetcher(p));
 assert.equal(templates.length,24);assert.deepEqual(skipped,['base-module-pack.json']);
});
test('invalid and duplicate templates are skipped, not silently changed',async()=>{
 const template={id:'one',name:'Test',params:{width:600,height:720,depth:560,thickness:18,doors:2,drawers:0,shelves:1,back:true,color:'oak'}};
 const {templates,skipped}=await loadAssemblyTemplates(validate,async p=>({ok:true,json:async()=>({format:'furnix.module.library',version:1,templates:p.includes('base-module')?[template,template,{...template,id:'bad',params:{...template.params,width:1}}]:[]})}));
 assert.equal(templates.length,1);assert.deepEqual(skipped,['one','bad']);assert.equal(adaptTechTemplate(null),null);
});
test('missing technical catalog leaves other catalogs available',async()=>{
 const catalogs=await loadTechCatalogs(p=>p.includes('hardware.json')?{ok:false}:fetcher(p),{allowPartial:true});
 assert.equal(catalogs.materials.items.length,13);assert.equal(catalogs.hardware,undefined);assert.equal(catalogs.loadErrors[0].kind,'hardware');assert.equal(productionReadiness(catalogs).ready,false);
});
test('empty catalogs cannot claim production readiness',()=>{
 assert.equal(productionReadiness({sources:{items:[]}}).ready,false);
 assert.equal(productionReadiness({materials:{items:[]},edging:{items:[]},hardware:{items:[]},production:{items:[]}}).ready,false);
});
test('main page retains calculators and exposes technical library',async()=>{
 assert.ok(editor.includes('mountDrawerCalculator'));assert.ok(editor.includes('mountLiftCalculator'));assert.ok(editor.includes('mountTechTemplates(byId("tech-template-list")'));
 assert.ok(editor.includes("techLibraryLink.href = './tech.html'"));
 const html=await fs.readFile(new URL('tech.html',root),'utf8');assert.ok(html.includes('href="./index.html"'));
});
