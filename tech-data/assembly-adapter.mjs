// Adapter for the current assembly editor. Missing/unsupported templates are skipped.
export function adaptTechTemplate(template) {
 if (!template || typeof template.id !== 'string' || typeof template.name !== 'string' || !template.name.trim() || !template.params) return null;
 const p = template.params;
 return {id:template.id, name:template.name, category:template.category, mount:template.mount,
  parameters:{name:template.name,width:p.width,height:p.height,depth:p.depth,thickness:p.thickness,
   doors:p.doors,drawers:p.drawers,shelves:p.shelves,divider:p.divider === true,
   dividerCount:p.divider === true ? 1 : 0,back:p.back === true,color:p.color,x:0,z:0}};
}
export async function loadAssemblyTemplates(validate, fetcher=fetch) {
 const pack={templates:[]}; const loadErrors=[];
 for(const file of ['base-module-pack.json','module-pack.json']) {
  try {const response=await fetcher('./tech-data/'+file);if(!response.ok)throw Error('Файл недоступен');
   const data=await response.json();
   if(data?.format!=='furnix.module.library'||data.version!==1||!Array.isArray(data.templates))throw Error('Неизвестный формат');
   pack.templates.push(...data.templates);
  } catch(error){loadErrors.push(file);}
 }
 if(!pack.templates.length)throw Error('Набор шаблонов недоступен');

 const templates=[],skipped=[]; const seen=new Set();
 for(const item of pack.templates){const adapted=adaptTechTemplate(item);
  if(!adapted||seen.has(adapted.id)||!validate(adapted.parameters)){skipped.push(item?.id||'без ID');continue;}
  seen.add(adapted.id);templates.push(adapted);
 }
 return {templates,skipped:[...skipped,...loadErrors]};
}
export async function mountTechTemplates(host,{validate,add,fetcher=fetch}) {
 host.textContent='Загрузка шаблонов Tech Library…';
 try {
  const {templates,skipped}=await loadAssemblyTemplates(validate,fetcher);
  host.replaceChildren();
  const note=document.createElement('p');note.className='note';
  note.textContent=templates.length+' шаблона Tech Library. Корпуса рассчитываются текущим редактором; ящики схематические. Размещение верхних шкафов по высоте задайте после добавления.'+(skipped.length?' Пропущено: '+skipped.length+'.':'');host.append(note);
  const search=document.createElement('input');search.type='search';search.placeholder='Поиск шаблона';search.setAttribute('aria-label','Поиск шаблонов Tech Library');host.append(search);
  const list=document.createElement('div');list.className='source-actions';host.append(list);
  function render(){list.replaceChildren();const query=search.value.trim().toLowerCase();
   for(const template of templates.filter(t=>t.name.toLowerCase().includes(query))){const button=document.createElement('button');button.type='button';button.textContent=template.name+' · '+template.parameters.width+'×'+template.parameters.height+'×'+template.parameters.depth;
    button.addEventListener('click',()=>add(structuredClone(template.parameters),{kind:'builtin-library',name:'Tech Library: '+template.name}));list.append(button);}
   if(!list.childElementCount)list.textContent='Шаблоны не найдены';
  }search.addEventListener('input',render);render();
 }catch(error){host.textContent='Tech Library: '+error.message+'. Основная библиотека доступна.';}
}
