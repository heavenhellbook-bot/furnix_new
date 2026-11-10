import { DRAWER_SLIDES } from './drawer-slides-data.js';
export function parseDrawerNumber(value) {
 if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
 if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim())) return NaN;
 return Number(value.trim().replace(',', '.'));
}
export function selectDrawerLength(depth, mode = 'external') {
 if (!Number.isFinite(depth) || !['external','internal'].includes(mode)) return 0;
 const start = mode === 'external' ? 304 : 299;
 for (let i = 0; i < 6; i++) if (depth > start + i * 50 && depth < start + i * 50 + 51) return 300 + i * 50;
 return 0;
}
export function findDrawerSlides(lengthMm, thicknessMm) {
 const seen = new Set();
 return DRAWER_SLIDES.filter(row => {
  const key = row.article + ':' + row.execution;
  if (row.lengthMm !== lengthMm || row.thicknessMm !== thicknessMm || !row.article || row.article === '0' || seen.has(key)) return false;
  seen.add(key); return true;
 });
}
export function calculateDrawer(input = {}) {
 const errors = {}; const values = {};
 const mode = input.mode;
 if (!['external','internal'].includes(mode)) errors.mode = 'Выберите тип фасада';
 for (const key of ['widthMm','depthMm','heightMm','thicknessMm', ...(mode === 'internal' ? ['facadeThicknessMm'] : [])]) {
  values[key] = parseDrawerNumber(input[key]);
  if (!Number.isFinite(values[key])) errors[key] = 'Введите корректное число';
 }
 const {widthMm:w,depthMm:d,heightMm:h,thicknessMm:t,facadeThicknessMm:f} = values;
 if (Number.isFinite(w) && (w < 200 || w > 800)) errors.widthMm = 'Ширина: от 200 до 800 мм';
 if (Number.isFinite(h) && (h < 109 || h > 800)) errors.heightMm = 'Высота: от 109 до 800 мм';
 if (Number.isFinite(d) && d <= (mode === 'internal' ? 326 : 304)) errors.depthMm = mode === 'internal' ? 'Глубина должна быть больше 326 мм (целая: от 327 мм)' : 'Глубина должна быть больше 304 мм (целая: от 305 мм)';
 for (const key of ['thicknessMm', ...(mode === 'internal' ? ['facadeThicknessMm'] : [])]) if (Number.isFinite(values[key]) && ![16,18,19].includes(values[key])) errors[key] = 'Выберите 16, 18 или 19 мм';
 const base = {mode,values,errors,parts:[],slides:[],lengthMm:null,availableDepthMm:null};
 if (Object.keys(errors).length) return {...base,status:'invalid'};
 const availableDepthMm = mode === 'internal' ? d-f-3-5 : d;
 const lengthMm = selectDrawerLength(availableDepthMm, mode);
 if (!lengthMm) return {...base,status:'no-length',availableDepthMm};
 const width = w - (t === 16 ? 42 : 49);
 const parts = [
  {name:'Днище',lengthMm:lengthMm-10,widthMm:width,quantity:1},
  {name:'Задняя панель',lengthMm:width,widthMm:h-50,quantity:1},
  {name:'Фасадная фальшпанель*',lengthMm:width,widthMm:h-50,quantity:1},
  {name:'Боковины',lengthMm:lengthMm-10,widthMm:h-20,quantity:2}
 ];
 const slides = findDrawerSlides(lengthMm,t);
 return {...base,status:slides.length ? 'calculated' : 'no-article',lengthMm,availableDepthMm,parts,slides};
}
