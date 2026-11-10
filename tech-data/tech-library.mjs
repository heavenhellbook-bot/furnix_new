/** Original FURNIX TECH DATA index. Technical records are NOT production-certified. */
export const CATALOG_FILES=Object.freeze({
 modules:'module-pack.json', baseModules:'base-module-pack.json', materials:'materials.json', edging:'edgebands.json',
 hardware:'hardware.json', production:'manufacturing-profiles.json', sources:'source-registry.json'
});
const allowedFormats=Object.freeze({
 materials:'furnix.tech.materials',edging:'furnix.tech.edgebands',
 hardware:'furnix.tech.hardware',production:'furnix.tech.manufacturing',sources:'furnix.tech.sources'
});
function cleanText(s,max=180){return typeof s==='string'?s.trim().slice(0,max):''}
export function validURL(url){if(!url)return null;try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
export function validateCatalog(kind,payload){
 if(!allowedFormats[kind])throw Error('Невідома категорія технічного каталогу.');
 if(!payload||payload.format!==allowedFormats[kind]||payload.version!==1||!Array.isArray(payload.items)||payload.items.length>2000)throw Error('Невірний формат технічної бібліотеки '+kind);
 const ids=new Set();
 for(const item of payload.items){if(!item||typeof item!=='object'||Array.isArray(item)||!cleanText(item.name,120))throw Error('Кожен запис повинен мати назву.');
   if(!cleanText(item.id,100)||ids.has(item.id))throw Error('Некоректний або повторний ID.');ids.add(item.id);
   if(item.sourceUrl&&!validURL(item.sourceUrl))throw Error('Недопустиме посилання у записі.');
   if(kind==='materials'&&(!Number.isFinite(item.thicknessMm)||item.thicknessMm<=0||item.thicknessMm>100))throw Error('Матеріал: товщина поза діапазоном.');
   if(kind==='edging'&&(!Number.isFinite(item.nominalThicknessMm)||item.nominalThicknessMm<=0||item.nominalThicknessMm>10))throw Error('Крайка: недопустима товщина.');
 }
 return payload;
}
export function toUnverified(kind,payload){const parsed=validateCatalog(kind,payload);return {...parsed,items:parsed.items.map(it=>({...it,reviewStatus:'draft',manufacturingApproved:false,importedAt:new Date().toISOString()}))}}
export function addRecord(kind,catalog,record){
 validateCatalog(kind,catalog);if(!record||!cleanText(record.name,120))throw Error('Необхідна назва.');
 const id='custom-'+(crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2));
 const item={...record,id,name:cleanText(record.name,120),sourceUrl:validURL(record.sourceUrl),reviewStatus:'draft',manufacturingApproved:false};
 return validateCatalog(kind,{...catalog,items:[...catalog.items,item]});
}
export function findRecords(items,query=''){const q=cleanText(query,200).toLowerCase();return items.filter(x=>[x.id,x.name,x.manufacturer,x.decor,x.materialType,x.description,x.notes].join(' ').toLowerCase().includes(q))}
export async function loadTechCatalogs(fetcher=fetch,{allowPartial=false}={}){
 const result={};for(const [kind,file] of Object.entries(CATALOG_FILES)){
  try {
 const response=await fetcher('./tech-data/'+file);if(!response.ok)throw Error('Не відкривається '+file);
  const payload=await response.json();if(kind==='modules'||kind==='baseModules'){if(payload?.format!=='furnix.module.library'||payload.version!==1||!Array.isArray(payload.templates))throw Error('Помилка бібліотеки модулів');result[kind]=payload}
  else result[kind]=validateCatalog(kind,payload);
 } catch(error) {if(!allowPartial)throw error;(result.loadErrors??=[]).push({kind,file,message:error.message});}
 }
 return result;
}
/** No automatic approval: ensure external URL, name and dimensions don't masquerade as validated tech data. */
export function productionReadiness(catalogs){
 const failures=[];
 for(const key of ['materials','edging','hardware','production']){
 if(!catalogs[key]?.items?.length)failures.push({kind:key,id:null,reason:'Каталог відсутній або порожній'});
 for(const r of (catalogs[key]?.items||[])){
  if(!r.manufacturingApproved||r.reviewStatus!=='production_validated')failures.push({kind:key,id:r.id,reason:'Відсутня фізична/технологічна валідація'});
 }
 }
 return {ready:failures.length===0&&Object.keys(catalogs).length>0,blocked:failures};
}
