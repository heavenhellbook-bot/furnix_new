import { calculateDrawer } from './drawer-calculator.js';
export function mountDrawerCalculator(host) {
 const thickness = '<option>16</option><option selected>18</option><option>19</option>';
 host.innerHTML = `<section class="lift-card" aria-labelledby="drawer-heading"><h1 id="drawer-heading">Ящики · Clip 3D</h1><p>Расчёт деталей и подбор направляющих скрытого монтажа по исходному справочнику Kronas.</p><div class="lift-grid"><label>Тип фасада<select id="drawer-mode"><option value="external">Наружный фасад</option><option value="internal">Внутренний фасад</option></select></label>${[['widthMm','Внутренняя ширина корпуса LW, мм','564'],['depthMm','Внутренняя глубина корпуса LT, мм','500'],['heightMm','Высота фасада, мм','200']].map(([key,label,value])=>`<label>${label}<input id="drawer-${key}" inputmode="decimal" type="text" value="${value}" aria-describedby="drawer-error-${key}"><small class="drawer-error" id="drawer-error-${key}"></small></label>`).join('')}<label>Толщина материала ящика, мм<select id="drawer-thicknessMm" aria-describedby="drawer-error-thicknessMm">${thickness}</select><small id="drawer-error-thicknessMm" class="drawer-error"></small></label><label id="drawer-facade-field" hidden>Толщина фасада, мм<select id="drawer-facadeThicknessMm" aria-describedby="drawer-error-facadeThicknessMm">${thickness}</select><small id="drawer-error-facadeThicknessMm" class="drawer-error"></small></label></div><div id="drawer-result" class="lift-result" aria-live="polite" role="status"></div><details class="lift-method"><summary>Правила расчёта и схемы из Excel</summary><p>Длина выбирается по исходным строгим интервалам в исходном порядке. Для наружного фасада LT ≥ 605 мм и для внутреннего доступная глубина ≥ 600 мм не дают подходящей длины. Автоматического выбора самой длинной направляющей нет.</p><p>Для внутреннего фасада доступная глубина = LT − толщина фасада − 3 − 5 мм. Проверка глубины корпуса отдельная: LT &gt; 326 мм; для наружного LT &gt; 304 мм. Целые минимумы: 327 и 305 мм.</p><p>Артикул 0 означает отсутствие варианта. Артикулы для материала 18 и 19 мм совпадают. При отсутствии длины деталировка скрыта.</p><img src="./reports/drawer-image1.png" alt="Наружный фасад: LT = NL + 5, SKL = NL − 10" style="max-width:100%;height:auto"><img src="./reports/drawer-image2.png" alt="Внутренний фасад: схема из исходного Excel" style="max-width:100%;height:auto"></details></section>`;
 const field = key => host.querySelector('#drawer-'+key);
 function render() {
  const mode = field('mode').value;
  host.querySelector('#drawer-facade-field').hidden = mode !== 'internal';
  const input = {mode};
  for (const key of ['widthMm','depthMm','heightMm','thicknessMm','facadeThicknessMm']) input[key] = field(key).value;
  const result = calculateDrawer(input);
  for (const key of ['widthMm','depthMm','heightMm','thicknessMm','facadeThicknessMm']) {
   field(key).setAttribute('aria-invalid',String(Boolean(result.errors[key])));
   host.querySelector('#drawer-error-'+key).textContent = result.errors[key] || '';
  }
  const output = host.querySelector('#drawer-result');
  output.className = 'lift-result '+(result.status === 'calculated' ? 'calculated' : 'no-match');
  if (result.status === 'invalid') {output.textContent = 'Исправьте отмеченные поля для расчёта.';return;}
  const depth = mode === 'internal' ? '<p>Доступная глубина: '+result.availableDepthMm+' мм</p>' : '';
  if (result.status === 'no-length') {output.innerHTML = depth+'<p>По исходным интервалам подходящая длина направляющей не найдена. Деталировка не сформирована.</p>';return;}
  output.innerHTML = depth+'<p class="lift-force">Рекомендуемая длина NL: '+result.lengthMm+' мм</p><div class="lift-table-wrap"><table><thead><tr><th>Деталь</th><th>Длина, мм</th><th>Ширина, мм</th><th>Количество, шт.</th></tr></thead><tbody>'+result.parts.map(p=>'<tr><td>'+p.name+'</td><td>'+p.lengthMm+'</td><td>'+p.widthMm+'</td><td>'+p.quantity+'</td></tr>').join('')+'</tbody></table></div><p>* Примечание Excel: эта деталь в некоторых конструктивах ящиков может отсутствовать. Фальшпанель применяется для удобства установки фасада.</p><h2>Направляющие</h2>'+result.slides.map(s=>'<p>Артикул Kronas <strong>'+s.article+'</strong> · '+s.execution+' · '+s.clip+' · '+s.lengthMm+' мм · материал '+s.thicknessMm+' мм</p>'+(s.catalogMatch ? '<p><small>Каталог FURNIX · Kronas: '+s.catalogMatch.name+'</small></p>' : '')).join('')+['с отталкивателем','с доводчиком'].filter(type=>!result.slides.some(s=>s.execution===type)).map(type=>'<p>В справочнике нет артикула: '+type+' для этой длины и толщины.</p>').join('');
 }
 host.addEventListener('input',render); host.addEventListener('change',render); render();
 return {refresh:render};
}
