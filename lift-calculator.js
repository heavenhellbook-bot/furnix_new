import { HAFELE_SERIES, HAFELE_COLORS, calculateHafele, estimateHafeleMass, getHafeleDimensionX } from "./hafele-free-space.js";
import { mountFreeFlap315 } from "./hafele-free-flap.js";
import { mountFreeFlap17 } from "./hafele-free-flap-17.js";

export const LIFT_MATERIALS = Object.freeze({
  chipboard: Object.freeze({ name: "ДСП 18–19 мм", massKgPerM2: 15.1 }),
  mdf: Object.freeze({ name: "МДФ 19 мм", massKgPerM2: 17.1 }),
});

export const LIFT_THRESHOLDS = Object.freeze({
  300: Object.freeze([4.2, 5.6, 7.1, 8.8]),
  400: Object.freeze([3.3, 4.7, 5.8, 6.9]),
  500: Object.freeze([2.4, 3.2, 4.0, 4.9]),
  600: Object.freeze([1.6, 2.1, 2.9, 3.2]),
});
export const LIFT_FORCES = Object.freeze([60, 80, 100, 120]);
export const LIFT_ARTICLES = Object.freeze({
  60: Object.freeze({ white: "83425", silver: "83426" }),
  80: Object.freeze({ white: "83427", silver: "83428" }),
  100: Object.freeze({ white: "83421", silver: "83422" }),
  120: Object.freeze({ white: "83423", silver: "83424" }),
});

function parseDimension(value) {
  if (typeof value === "number") return Number.isFinite(value) ? { value } : { error: "Введите корректное число" };
  if (typeof value !== "string") return { error: "Введите корректное число" };
  const text = value.trim();
  if (!text) return { empty: true };
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text)) return { error: "Введите корректное число" };
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? { value: number } : { error: "Введите корректное число" };
}

export function selectLiftHeightColumn(heightMm) {
  if (!Number.isFinite(heightMm) || heightMm < 300 || heightMm > 600) return null;
  if (heightMm === 300) return 300;
  if (heightMm <= 400) return 400;
  if (heightMm <= 500) return 500;
  return 600;
}

export function selectLiftForce(massKg, heightColumnMm) {
  const thresholds = LIFT_THRESHOLDS[heightColumnMm];
  if (!thresholds || !Number.isFinite(massKg) || massKg < 0) return null;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (massKg < thresholds[i]) return LIFT_FORCES[i];
  }
  return null;
}

export function calculateLift({ material, heightMm, widthMm, color = "white" } = {}) {
  const base = { status: "incomplete", material, heightMm: null, widthMm: null, areaM2: null, massKg: null, selectedHeightColumnMm: null };
  const h = parseDimension(heightMm);
  const w = parseDimension(widthMm);
  if (h.empty || w.empty) return { ...base, status: "incomplete", errorCode: "incomplete", errorText: "Введите высоту и ширину фасада" };
  if (h.error || w.error) return { ...base, status: "invalid", errorCode: "invalid-number", errorText: "Введите корректное число" };
  if (!LIFT_MATERIALS[material]) return { ...base, status: "invalid", errorCode: "unknown-material", errorText: "Выберите материал фасада" };
  const height = h.value;
  const width = w.value;
  if (height < 300 || height > 600) return { ...base, status: "invalid", heightMm: height, widthMm: width, errorCode: "height-out-of-range", errorText: "Высота должна быть от 300 до 600 мм" };
  if (width < 300) return { ...base, status: "invalid", heightMm: height, widthMm: width, errorCode: "width-out-of-range", errorText: "Ширина должна быть не менее 300 мм" };
  const areaM2 = height * width / 1_000_000;
  const massKg = areaM2 * LIFT_MATERIALS[material].massKgPerM2;
  if (!Number.isFinite(areaM2) || !Number.isFinite(massKg)) return { ...base, status: "invalid", heightMm: height, widthMm: width, errorCode: "numeric-range", errorText: "Размеры выходят за числовой диапазон расчёта" };
  const selectedHeightColumnMm = selectLiftHeightColumn(height);
  const forceN = selectLiftForce(massKg, selectedHeightColumnMm);
  if (forceN === null) return { ...base, status: "noMatch", heightMm: height, widthMm: width, areaM2, massKg, selectedHeightColumnMm, legacyResult: 0, errorCode: "no-match", errorText: "В пределах таблицы GIFF Alto подходящее усилие не найдено" };
  const articles = LIFT_ARTICLES[forceN];
  return { status: "calculated", material, heightMm: height, widthMm: width, areaM2, massKg, selectedHeightColumnMm, forceN, quantity: 2, articles: { ...articles }, selectedArticle: articles[color] || null, color };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function mountLiftCalculator(host, liftStorage = {}) {
  const savedCalculations = () => liftStorage.getCalculations?.() || [];
  const specificationItems = () => liftStorage.getSpecificationItems?.() || [];
  let currentCalculation = null;
  host.innerHTML = `
    <section class="lift-card" aria-labelledby="lift-heading">
      <h1 id="lift-heading">Подъёмники</h1>
      <label class="lift-system-label">Система подъёмников<select id="lift-system"><option value="giff">GIFF Alto</option><option value="hafele">Häfele Free Space</option><option value="hafele-free-flap">Häfele Free Flap</option></select></label>
      <div id="lift-giff-panel">
      <h2>GIFF Alto</h2>
      <p class="lift-intro">Подбор по массе фасада и таблице усилий из предоставленного XLSX.</p>
      <div class="lift-grid">
        <label>Материал фасада
          <select id="lift-material"><option value="chipboard">ДСП 18–19 мм — по исходному XLSX</option><option value="mdf">МДФ 19 мм</option></select>
        </label>
        <label>Высота фасада, мм<input id="lift-height" type="number" min="300" max="600" step="any" inputmode="decimal"></label>
        <label>Ширина фасада, мм<input id="lift-width" type="number" min="300" step="any" inputmode="decimal"></label>
        <label>Цвет подъёмника
          <select id="lift-color"><option value="white">Белый</option><option value="silver">Серебро</option></select>
        </label>
      </div>
      <div id="lift-result" class="lift-result" role="status" aria-live="polite">Введите высоту и ширину фасада</div>
      <details class="lift-method"><summary>Таблица подбора и методика</summary>
        <div class="lift-table-wrap"><table><thead><tr><th>Усилие, N</th><th>Высота 300 мм</th><th>400 мм</th><th>500 мм</th><th>600 мм</th></tr></thead><tbody>${LIFT_FORCES.map((force, index) => `<tr><th>${force}</th>${[300, 400, 500, 600].map((height) => `<td>${LIFT_THRESHOLDS[height][index].toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <p>Пороги строгие: при равенстве порогу выбирается следующая ступень. Высота 300 мм использует колонку 300; далее используются ближайшие верхние ступени 400, 500 и 600 мм без интерполяции.</p>
        <p>Для ДСП исходная книга указывает блок «ДСП 18–19 мм», но коэффициент 15,1 кг/м² подписан как ЛДСП 18 мм. Отдельного коэффициента для 19 мм в книге нет; здесь используется ровно указанное значение.</p>
        <p>Расчёт не учитывает ручки, стекло, отделку, фурнитуру, запас, угол открывания и монтажную геометрию. Исходная книга задаёт два подъёмника на фасад.</p>
        <p class="lift-unverified">Коэффициенты и каталог перенесены из предоставленного XLSX; техническая достоверность данных производителя отдельно не проверялась. Наличие, цены и актуальность артикулов не подтверждены.</p>
      </details>
      </div>
      <div id="lift-hafele-free-flap-panel" hidden>
        <label class="lift-system-label">Серия Free Flap<select id="lift-free-flap-series"><option value="1.7">1.7 · модель C</option><option value="3.15" selected>3.15 · модель G</option></select></label>
        <div id="lift-free-flap-17-panel"></div>
        <div id="lift-free-flap-315-panel" hidden></div>
      </div>
      <div id="lift-hafele-panel" hidden>
        <h2>Häfele Free Space</h2>
        <div class="lift-grid">
          <label>Серия<select id="hafele-series"><option value="1.11">Free Space 1.11 — с ручкой</option><option value="1.8-push">Free Space 1.8 push — без ручки</option></select></label>
          <label>Высота корпуса KH, мм<input id="hafele-kh" type="number" step="any" inputmode="decimal"></label>
          <label>Ширина корпуса, мм<input id="hafele-cabinet-width" type="number" step="any" inputmode="decimal"></label>
          <label>Внутренняя глубина корпуса, мм<input id="hafele-depth" type="number" step="any" inputmode="decimal"></label>
          <label>Способ задания массы<select id="hafele-mass-mode"><option value="manual">Ввести итоговую массу фасада</option><option value="estimate">Оценить массу панели и ручек</option></select></label>
          <label id="hafele-manual-mass-label">Масса для подбора, кг<input id="hafele-mass" type="number" min="0" step="any" inputmode="decimal"></label>
          <label>Цвет подъёмника<select id="hafele-color">${Object.entries(HAFELE_COLORS).map(([code,name])=>`<option value="${code}">${name}</option>`).join("")}</select></label>
        </div>
        <div id="hafele-estimate-fields" class="lift-grid" hidden>
          <label>Высота фасада, мм<input id="hafele-front-height" type="number" min="1" step="any" inputmode="decimal"></label>
          <label>Ширина фасада, мм<input id="hafele-front-width" type="number" min="1" step="any" inputmode="decimal"></label>
          <label>Материал фасада<select id="hafele-material"><option value="chipboard">ДСП 18–19 мм — коэффициент XLSX GIFF</option><option value="mdf">МДФ 19 мм — коэффициент XLSX GIFF</option></select></label>
          <label>Масса одной ручки, кг<input id="hafele-handle-mass" type="number" min="0" step="any" inputmode="decimal"></label>
          <label>Дополнительная масса, кг<input id="hafele-extra-mass" type="number" min="0" step="any" value="0" inputmode="decimal"></label>
        </div>
        <div class="lift-grid">
          <label>Толщина фасада Y, мм<input id="hafele-front-thickness" type="number" step="any" inputmode="decimal"></label>
          <label>Толщина верхней панели, мм<input id="hafele-top-thickness" type="number" step="any" inputmode="decimal"></label>
          <label>Угол открывания<select id="hafele-angle"><option value="107">107°</option><option value="90">90° (ограниченный)</option></select></label>
          <label>Фасад<select id="hafele-front-type"><option value="solid">Сплошной</option><option value="frame">Рамочный</option></select></label>
        </div>
        <div id="hafele-dimension-result" class="lift-result" role="status" aria-live="polite">Укажите толщину фасада и верхней панели для справки X/Y.</div>
        <div id="hafele-result" class="lift-result" role="status" aria-live="polite">Введите высоту корпуса KH и массу для подбора</div>
        <details class="lift-method"><summary>Таблицы подбора, монтаж и методика</summary>
          <div id="hafele-tables"></div>
          <p>Подбор выполняется только для точной высоты KH из таблицы. Значение массы на нижней и верхней границах включается; это принятое правило чтения записи «от–до», а не оператор из PDF. При пересекающихся диапазонах показываются все подходящие модели.</p>
          <p>Прямой ввод означает итоговую массу для подбора; ручка повторно не добавляется. Оценка использует формулу из инструкции, стр. 3: масса панели + 2 × масса одной ручки. Коэффициенты 15,1/17,1 кг/м² взяты из XLSX GIFF, а не из документов Häfele.</p>
          <h3>Монтажная справка Free Space 1.11</h3>
          <p>Источники: инструкция Free Space 1.11, обозначение 733.23.205, редакция 05.08.2019 (файл free-space-instruction 25.pdf), стр. 2, 4–5, 8–9, 11; брошюра hafele-free-space 25.pdf, стр. 7, 11–13. Число «25» в имени файла не считается годом издания. Минимальная внутренняя глубина 63 мм; размеры на схеме 173, 24,5 и 36,5 мм; углы 107° и ограниченный 90°. Эти значения не являются полной проверкой монтажа.</p>
          <p>Размер X для схемы открытого фасада при толщине верхней панели 16 мм (инструкция, стр. 2; брошюра, стр. 12):</p><div class="lift-table-wrap"><table><thead><tr><th>Толщина фасада Y, мм</th><th>16</th><th>18</th><th>19</th><th>22</th><th>24</th><th>26</th><th>28</th></tr></thead><tbody><tr><th>X, мм</th><td>117</td><td>110</td><td>107</td><td>96</td><td>90</td><td>83</td><td>76</td></tr></tbody></table></div>
          <p>На схеме корпуса 1.11: три отверстия на сторону, Ø5 мм, глубина 12 мм, линия отверстий в 37 мм от переднего края, первое в 102 мм от показанной верхней базы, шаг 32 мм; стороны зеркальны. Это справочные данные, а не сгенерированная присадка.</p>
          <p>На фасаде 1.11 показаны межосевое расстояние 64 мм, базовые размеры 12 и 25 мм, поправки A1/A2, K/A/F, рамочный профиль от 45 мм и RBmin = 26 + K − F; дополнительный крепёж 372.27.600. Отверстия корпуса выше — три на сторону; они не заменяют два отверстия крепления фасада. Для 1.8 push брошюра отдельно показывает защёлку Ø10 и размер 90 мм — не трактовать последний как глубину сверления.</p>
          <p>Для рамочного фасада профиль должен быть не уже 45 мм по указанной схеме. Регулировки 1.11: усилие, угол 107°→90°, высота ±2 мм, боковое положение ±1,5 мм, наклон ±2 мм (линейная величина). Монтажный шаблон стр. 11 печатать из оригинального PDF в масштабе 100%, сверив размеры 32 и 37 мм.</p>
          <p>Free Space 1.8 push предназначен для фасадов без ручки с Push-to-open. Отдельная защёлка видна в брошюре, но её артикул и включение в комплект не подтверждены. Инструкция монтажа 1.11 не считается отдельной проверенной инструкцией 1.8 push.</p>
          <p>Другие семейства Häfele из брошюры не включены в автоматический подбор: для них в предоставленных материалах нет необходимых таблиц.</p>
          <p class="lift-unverified">Сведения перенесены из пользовательского описания предоставленных PDF; сами PDF в проект не приложены и отдельно не сверялись. Актуальность ассортимента, наличие, цены и состав продажи не подтверждены. На схеме 1.11 показана пара левого и правого механизмов: артикулы автоматически не удваиваются, комплектность продажи нужно уточнить.</p>
        </details>
      </div>
      <section class="lift-storage" aria-labelledby="lift-storage-heading">
        <h2 id="lift-storage-heading">Расчёты и спецификация</h2>
        <div class="lift-storage-actions"><label id="lift-candidate-label" hidden>Модель для позиции<select id="lift-candidate"></select></label><button type="button" id="lift-save-calculation">Сохранить расчёт</button><button type="button" id="lift-add-specification" class="primary">Добавить текущий расчёт в спецификацию</button></div>
        <p id="lift-storage-status" class="lift-unverified" role="status" aria-live="polite">Сохраненные расчёты и позиции спецификации входят в JSON проекта. Для сохранения на диск скачайте проект JSON.</p>
        <div id="lift-calculation-list"></div><div id="lift-specification-list"></div>
      </section>
    </section>`;
  const material = host.querySelector("#lift-material");
  const height = host.querySelector("#lift-height");
  const width = host.querySelector("#lift-width");
  const color = host.querySelector("#lift-color");
  const result = host.querySelector("#lift-result");
  const storageStatus = host.querySelector("#lift-storage-status");
  const candidateSelect = host.querySelector("#lift-candidate");
  const candidateLabel = host.querySelector("#lift-candidate-label");
  const renderStorage = () => {
    const calculations = savedCalculations();
    const items = specificationItems();
    host.querySelector("#lift-calculation-list").innerHTML = `<h3>Сохранённые расчёты (${calculations.length})</h3>${calculations.length ? calculations.map((item) => `<div class="lift-saved-item"><span><strong>${esc(item.systemName)}</strong> · ${esc(item.title)} · ${esc(item.summary)} · ${esc(item.createdAt)}</span><button type="button" data-lift-add-saved="${esc(item.id)}" ${item.eligible === false || !Number.isInteger(item.candidate?.quantity) ? "disabled" : ""}>В спецификацию</button><button type="button" data-lift-remove-saved="${esc(item.id)}" aria-label="Удалить расчёт">Удалить</button></div>`).join("") : "<p>Пока нет сохранённых расчётов.</p>"}`;
    host.querySelector("#lift-specification-list").innerHTML = `<h3>Подъёмники в спецификации (${items.length})</h3>${items.length ? `<div class="lift-table-wrap"><table><thead><tr><th>Система</th><th>Модель / артикул</th><th>Параметры</th><th>Кол-во позиций</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(item.systemName)}</td><td>${esc(item.modelName)} · ${esc(item.article || "артикул не указан")}</td><td>${esc(item.summary)}</td><td>${item.quantity} ${esc(item.unit || "позиция")}</td><td><button type="button" data-lift-remove-spec="${esc(item.id)}">Убрать</button></td></tr>`).join("")}</tbody></table></div>` : "<p>Позиции ещё не добавлены.</p>"}`;
    host.querySelectorAll("[data-lift-add-saved]").forEach((button) => button.addEventListener("click", () => { liftStorage.addToSpecification?.(button.dataset.liftAddSaved); renderStorage(); }));
    host.querySelectorAll("[data-lift-remove-saved]").forEach((button) => button.addEventListener("click", () => { liftStorage.removeCalculation?.(button.dataset.liftRemoveSaved); renderStorage(); }));
    host.querySelectorAll("[data-lift-remove-spec]").forEach((button) => button.addEventListener("click", () => { liftStorage.removeSpecificationItem?.(button.dataset.liftRemoveSpec); renderStorage(); }));
  };
  const describeCurrent = () => {
    if (!currentCalculation) return null;
    const candidates = currentCalculation.candidates || [];
    const candidate = candidates[candidateSelect.value === "" ? 0 : Number(candidateSelect.value)] || null;
    return { ...currentCalculation, candidate, title: currentCalculation.title || currentCalculation.systemName };
  };
  const setCurrentCalculation = (value) => {
    currentCalculation = value;
    const candidates = value?.candidates || [];
    candidateLabel.hidden = candidates.length < 2;
    candidateSelect.replaceChildren(...candidates.map((candidate, index) => {
      const option = document.createElement("option"); option.value = String(index);
      option.textContent = `${candidate.modelName || candidate.name || "Модель"} · ${candidate.article || "артикул не указан"}`;
      return option;
    }));
    const savable = Boolean((value?.savable ?? value?.eligible) && candidates.length);
    const addable = Boolean(value?.eligible && candidates.length && Number.isInteger(candidates[0]?.quantity) && candidates[0].quantity > 0);
    host.querySelector("#lift-save-calculation").disabled = !savable;
    host.querySelector("#lift-add-specification").disabled = !addable;
  };
  const persistCurrentCalculation = (addToSpec) => {
    const record = describeCurrent();
    if (!record?.candidate || (addToSpec ? !record.eligible || !Number.isInteger(record.candidate.quantity) || record.candidate.quantity < 1 : !(record.savable ?? record.eligible))) return;
    if (addToSpec) liftStorage.addCurrentToSpecification?.(record);
    else liftStorage.saveCalculation?.(record);
    storageStatus.textContent = addToSpec ? "Подъёмник добавлен в спецификацию проекта." : "Расчёт сохранён в проекте. Нажмите «Сохранить проект JSON», чтобы записать его на диск.";
    renderStorage();
  };
  host.querySelector("#lift-save-calculation").addEventListener("click", () => persistCurrentCalculation(false));
  host.querySelector("#lift-add-specification").addEventListener("click", () => persistCurrentCalculation(true));
  renderStorage();
  host.querySelector("#hafele-tables").innerHTML = Object.entries(HAFELE_SERIES).map(([key, data]) => `<h3>Free Space ${key === "1.11" ? "1.11" : "1.8 push"} — ${esc(data.sourceFile)}, стр. ${data.sourcePage}</h3><div class="lift-table-wrap"><table><thead><tr><th>KH, мм</th>${data.models.map((model) => `<th>${esc(model)}, кг</th>`).join("")}</tr></thead><tbody>${Object.entries(data.rows).map(([heightMm,row]) => `<tr><th>${heightMm}</th>${data.models.map((model) => `<td>${row[model].minMassKg}–${row[model].maxMassKg}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`).join("");
  const render = () => {
    const value = calculateLift({ material: material.value, heightMm: height.value, widthMm: width.value, color: color.value });
    setCurrentCalculation(value.status === "calculated" ? {
      system: "giff", systemName: "GIFF Alto", status: value.status, eligible: true,
      title: `GIFF Alto ${value.forceN} N`,
      inputs: { material: material.value, heightMm: height.value, widthMm: width.value, color: color.value },
      summary: `Фасад ${value.heightMm} × ${value.widthMm} мм; масса ${value.massKg} кг; усилие ${value.forceN} N; ${value.quantity} шт.`,
      candidates: [{ modelName: `GIFF Alto ${value.forceN} N`, article: value.selectedArticle, quantity: value.quantity }],
    } : null);
    if (value.status === "incomplete" || value.status === "invalid") {
      result.className = `lift-result ${value.status}`;
      result.textContent = value.errorText;
      return;
    }
    if (value.status === "noMatch") {
      result.className = "lift-result no-match";
      result.innerHTML = `<p>${esc(value.errorText)}</p><dl><dt>Площадь фасада</dt><dd>${value.areaM2.toLocaleString("ru-RU", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} м²</dd><dt>Расчётная масса</dt><dd><strong>${value.massKg.toLocaleString("ru-RU", { maximumFractionDigits: 12 })} кг</strong> <small>(точное значение расчёта)</small></dd><dt>Колонка таблицы</dt><dd>${value.selectedHeightColumnMm} мм</dd></dl>`;
      return;
    }
    const massDisplay = value.massKg.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const massExact = value.massKg.toLocaleString("ru-RU", { maximumFractionDigits: 12 });
    result.className = "lift-result calculated";
    result.innerHTML = `<dl><dt>Площадь фасада</dt><dd>${value.areaM2.toLocaleString("ru-RU", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} м²</dd><dt>Расчётная масса</dt><dd><strong>${massDisplay} кг</strong> <small>(точное значение: ${massExact} кг)</small></dd><dt>Номинальное усилие</dt><dd class="lift-force">GIFF Alto ${value.forceN} N — ${value.quantity} шт. на один фасад</dd><dt>Артикул, ${value.color === "white" ? "белый" : "серебро"}</dt><dd>${esc(value.selectedArticle)} <small>· L=245 мм</small></dd><dt>Другой цвет</dt><dd>Белый: ${value.articles.white} · Серебро: ${value.articles.silver}</dd></dl>`;
  };
  for (const element of [material, height, width, color]) element.addEventListener("input", render);
  for (const element of [material, color]) element.addEventListener("change", render);
  render();
  const freeFlap17Controls = mountFreeFlap17(host.querySelector("#lift-free-flap-17-panel"), { onCalculation: (value) => setCurrentCalculation(value ? {
    system: "hafele-free-flap-1.7-c", systemName: "Häfele Free Flap 1.7 C", status: value.status,
    eligible: value.eligible, savable: value.savable, title: value.title,
    inputs: value.inputs, summary: value.summary, candidates: value.candidates,
    result: value.result, assumptions: value.assumptions,
    datasetVersion: value.datasetVersion, verificationStatus: value.verificationStatus,
  } : null) });
  const freeFlap315Controls = mountFreeFlap315(host.querySelector("#lift-free-flap-315-panel"), { onCalculation: (value) => setCurrentCalculation(value ? {
    system: "hafele-free-flap-3.15", systemName: "Häfele Free Flap 3.15", status: value.status,
    eligible: value.status === "matched", title: `Free Flap 3.15 G, KH ${value.cabinetHeightMm} мм`,
    inputs: {
      cabinetHeightMm: value.cabinetHeightMm, totalFacadeMassKg: value.totalFacadeMassKg,
      cabinetDepthMm: host.querySelector("#flap-depth").value,
      massOrigin: host.querySelector("#flap-total-mass").dataset.origin || "manual",
      frontHeightMm: host.querySelector("#flap-front-height").value,
      frontWidthMm: host.querySelector("#flap-front-width").value,
      thicknessMm: host.querySelector("#flap-thickness").value,
      densityKgM3: host.querySelector("#flap-density").value,
      densitySource: host.querySelector("#flap-density-source").value,
      handlesTotalMassKg: host.querySelector("#flap-handles-mass").value,
      otherIncludedMassKg: host.querySelector("#flap-other-mass").value,
      facadeType: host.querySelector("#flap-facade-type").value,
      openingMethod: host.querySelector("#flap-opening").value,
      openingAngleDeg: host.querySelector("#flap-angle").value,
    },
    summary: `KH ${value.cabinetHeightMm} мм; масса фасада ${value.totalFacadeMassKg} кг`,
    candidates: [{ modelName: "Free Flap 3.15 G", article: value.manufacturerArticle, quantity: 1 }],
  } : null) });
  const system = host.querySelector("#lift-system");
  const freeFlapSeries = host.querySelector("#lift-free-flap-series");
  const freeFlap17Panel = host.querySelector("#lift-free-flap-17-panel");
  const freeFlap315Panel = host.querySelector("#lift-free-flap-315-panel");
  const giffPanel = host.querySelector("#lift-giff-panel");
  const hafelePanel = host.querySelector("#lift-hafele-panel");
  const freeFlapPanel = host.querySelector("#lift-hafele-free-flap-panel");
  const massMode = host.querySelector("#hafele-mass-mode");
  const massField = host.querySelector("#hafele-mass");
  const manualMassLabel = host.querySelector("#hafele-manual-mass-label");
  const estimateFields = host.querySelector("#hafele-estimate-fields");
  const hafeleResult = host.querySelector("#hafele-result");
  const hafeleDimensions = host.querySelector("#hafele-dimension-result");
  const hafeleInput = (id) => host.querySelector(`#${id}`);
  const renderHafele = () => {
    const estimating = massMode.value === "estimate";
    estimateFields.hidden = !estimating;
    manualMassLabel.hidden = estimating;
    let selectionMass = massField.value;
    let estimate = null;
    if (estimating) {
      estimate = estimateHafeleMass({
        frontHeightMm:hafeleInput("hafele-front-height").value,
        frontWidthMm:hafeleInput("hafele-front-width").value,
        material:hafeleInput("hafele-material").value,
        handleMassKg:hafeleInput("hafele-handle-mass").value,
        extraMassKg:hafeleInput("hafele-extra-mass").value,
      });
      selectionMass = estimate.status === "estimated" ? String(estimate.selectionMassKg) : "";
      hafeleResult.dataset.massOrigin = "calculated";
    } else hafeleResult.dataset.massOrigin = "manual";
    const value = calculateHafele({
      series:hafeleInput("hafele-series").value,
      cabinetHeightMm:hafeleInput("hafele-kh").value,
      cabinetWidthMm:hafeleInput("hafele-cabinet-width").value,
      innerDepthMm:hafeleInput("hafele-depth").value,
      selectionMassKg:selectionMass,
      color:hafeleInput("hafele-color").value,
    });
    setCurrentCalculation(value.status === "matched" ? {
      system: "hafele-free-space", systemName: "Häfele Free Space", status: value.status, eligible: true,
      title: `Free Space ${value.series === "1.11" ? "1.11" : "1.8 push"}`,
      inputs: {
        series: hafeleInput("hafele-series").value, cabinetHeightMm: hafeleInput("hafele-kh").value,
        cabinetWidthMm: hafeleInput("hafele-cabinet-width").value, innerDepthMm: hafeleInput("hafele-depth").value,
        selectionMassKg: value.selectionMassKg, massOrigin: hafeleResult.dataset.massOrigin,
        massMode: hafeleInput("hafele-mass-mode").value, manualMassKg: hafeleInput("hafele-mass").value,
        frontHeightMm: hafeleInput("hafele-front-height").value, frontWidthMm: hafeleInput("hafele-front-width").value,
        material: hafeleInput("hafele-material").value, handleMassKg: hafeleInput("hafele-handle-mass").value,
        extraMassKg: hafeleInput("hafele-extra-mass").value, frontThicknessMm: hafeleInput("hafele-front-thickness").value,
        topPanelThicknessMm: hafeleInput("hafele-top-thickness").value, openingAngleDeg: hafeleInput("hafele-angle").value,
        facadeType: hafeleInput("hafele-front-type").value, color: hafeleInput("hafele-color").value,
      },
      summary: `Серия ${value.series}; KH ${value.cabinetHeightMm} мм; масса ${value.selectionMassKg} кг`,
      candidates: value.candidates.map((item) => ({ modelName: `Free Space ${value.series} ${item.model}`, article: item.articleNumber ?? null, quantity: 1, range: `${item.minMassKg}–${item.maxMassKg} кг` })),
    } : null);
    if (estimate?.status === "incomplete" || estimate?.status === "invalid") {
      hafeleResult.className = `lift-result ${estimate.status}`;
      hafeleResult.textContent = estimate.errorText;
    } else if (value.status !== "matched") {
      hafeleResult.className = `lift-result ${value.status === "no-match" || value.status === "no-exact-row" ? "no-match" : value.status}`;
      hafeleResult.textContent = value.status === "no-exact-row" && value.neighbouringRows?.length ? `${value.errorText}. Соседние строки KH: ${value.neighbouringRows.join(" и ")} мм (только для справки).` : value.errorText;
    } else {
      const estimateLine = estimate ? `<dt>Площадь фасада</dt><dd>${estimate.panelAreaM2.toLocaleString("ru-RU",{minimumFractionDigits:3,maximumFractionDigits:3})} м²</dd><dt>Масса панели</dt><dd>${estimate.panelMassKg.toLocaleString("ru-RU",{maximumFractionDigits:6})} кг; ручки по схеме: 2 × ${estimate.handleMassKg} кг; добавки: ${estimate.extraMassKg} кг</dd>` : "";
      const candidates = value.candidates.map((item) => `<article class="hafele-candidate"><h3>Free Space ${value.series === "1.11" ? "1.11" : "1.8 push"} ${esc(item.model)}</h3><p>Артикул ${esc(item.articleNumber || "не указан")} · ${esc(item.color || "цвет не распознан")}</p><p>При KH = ${value.cabinetHeightMm} мм: ${item.minMassKg}–${item.maxMassKg} кг. Масса для подбора: ${value.selectionMassKg} кг.</p><p class="note">Таблица: ${esc(item.sourceFile)}, стр. ${item.sourcePage}; артикул: ${esc(item.articleSourceFile)}, стр. ${item.articleSourcePage}. Подбор по таблице; не гарантия применимости.</p><p class="note">Схема показывает левый и правый механизмы. Единица продажи и комплектность артикула не подтверждены; артикулы автоматически не удваиваются.</p></article>`).join("");
      hafeleResult.className = `lift-result calculated ${value.installationStatus}`;
      const seriesLabel = value.series === "1.11" ? "1.11" : "1.8 push";
      const frameCheck = hafeleInput("hafele-front-type").value === "frame" ? "Для рамочного фасада источник указывает профиль шириной не менее 45 мм; размер профиля не введён, поэтому эта проверка не выполнена." : "";
      const installText = value.installationStatus === "limited-check" ? "Ширина и внутренняя глубина соответствуют доступным проверкам. Это частичная проверка, а не подтверждение полной совместимости монтажа." : value.installationNotes.map(esc).join("; ");
      hafeleResult.innerHTML = `<p><strong>Подбор модели по таблице</strong> · масса ${value.selectionMassKg} кг · ${hafeleResult.dataset.massOrigin === "manual" ? "Введено вручную" : "Рассчитано по схеме"}</p><p>Серия Free Space ${seriesLabel}; угол ${hafeleInput("hafele-angle").value}° указан для справки и не меняет подбор.</p><p>${frameCheck}</p><dl>${estimateLine}<dt>Проверка размеров установки</dt><dd>${installText}</dd></dl>${candidates}`;
    }
    const x = getHafeleDimensionX({frontThicknessMm:hafeleInput("hafele-front-thickness").value,topPanelThicknessMm:hafeleInput("hafele-top-thickness").value});
    hafeleDimensions.className = `lift-result ${x.status === "available" ? "calculated" : ""}`;
    hafeleDimensions.textContent = x.status === "available" ? `По схеме открытого фасада: X = ${x.xMm} мм (инструкция, стр. 2; брошюра, стр. 12). Не универсальная координата сверления.` : x.errorText;
  };
  const renderSystem = () => {
    const isGiff = system.value === "giff";
    const isFreeSpace = system.value === "hafele";
    giffPanel.hidden = !isGiff;
    hafelePanel.hidden = !isFreeSpace;
    freeFlapPanel.hidden = system.value !== "hafele-free-flap";
    if (isGiff) render();
    else if (isFreeSpace) renderHafele();
    else renderFlapSeries();
  };
  const renderFlapSeries = () => {
    const is17 = freeFlapSeries.value === "1.7";
    freeFlap17Panel.hidden = !is17;
    freeFlap315Panel.hidden = is17;
    if (is17) freeFlap17Controls.check();
    else freeFlap315Controls.check();
  };
  system.addEventListener("change", renderSystem);
  freeFlapSeries.addEventListener("change", renderFlapSeries);
  for (const input of host.querySelectorAll("#lift-hafele-panel input, #lift-hafele-panel select")) {
    input.addEventListener("input", renderHafele);
    input.addEventListener("change", renderHafele);
  }
  renderSystem();
  return { calculate: render, calculateHafele: renderHafele, refreshStorage: renderStorage };
}

export function runLiftSelfChecks() {
  const checks = [];
  const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const close = (a, b) => Math.abs(a - b) < 1e-12;
  const samples = [
    ["chipboard", 300, 300, 60, 1.359], ["mdf", 300, 300, 60, 1.539],
    ["chipboard", 400, 600, 80, 3.624], ["mdf", 400, 600, 80, 4.104],
    ["chipboard", 500, 500, 100, 3.775], ["mdf", 500, 500, 120, 4.275],
    ["chipboard", 600, 300, 100, 2.718], ["mdf", 600, 300, 120, 3.078],
    ["chipboard", 600, 400, null, 3.624], ["mdf", 600, 400, null, 4.104], ["chipboard", 300, 1000, 80, 4.53],
  ];
  for (const [material, h, w, force, mass] of samples) {
    const result = calculateLift({ material, heightMm: h, widthMm: w });
    check(`sample ${material}/${h}/${w}`, close(result.massKg, mass) && (result.forceN ?? null) === force);
  }
  for (const [height, expected] of [[299.999, null], [300, 300], [300.001, 400], [399.999, 400], [400, 400], [400.001, 500], [500, 500], [500.001, 600], [600, 600], [600.001, null]]) check(`height boundary ${height}`, selectLiftHeightColumn(height) === expected);
  for (const [column, thresholds] of Object.entries(LIFT_THRESHOLDS)) {
    for (let i = 0; i < thresholds.length; i += 1) {
      const threshold = thresholds[i];
      check(`threshold ${column}/${threshold}/below`, selectLiftForce(threshold - 0.000001, Number(column)) === LIFT_FORCES[i]);
      check(`threshold ${column}/${threshold}/equal`, selectLiftForce(threshold, Number(column)) === (LIFT_FORCES[i + 1] ?? null));
      check(`threshold ${column}/${threshold}/above`, selectLiftForce(threshold + 0.000001, Number(column)) === (LIFT_FORCES[i + 1] ?? null));
    }
  }
  const validation = [
    ["empty", { material: "chipboard", heightMm: "", widthMm: "" }, "incomplete"],
    ["half empty", { material: "chipboard", heightMm: 400, widthMm: "" }, "incomplete"],
    ["empty with invalid second size", { material: "chipboard", heightMm: "", widthMm: "400abc" }, "incomplete"],
    ["height low", { material: "chipboard", heightMm: 299.999, widthMm: 300 }, "invalid"],
    ["width low", { material: "chipboard", heightMm: 300, widthMm: 299.999 }, "invalid"],
    ["negative", { material: "chipboard", heightMm: -1, widthMm: 300 }, "invalid"],
    ["text", { material: "chipboard", heightMm: "400abc", widthMm: 300 }, "invalid"],
    ["space", { material: "chipboard", heightMm: "   ", widthMm: 300 }, "incomplete"],
    ["comma", { material: "chipboard", heightMm: "400,5", widthMm: 500 }, "calculated"],
    ["dot", { material: "chipboard", heightMm: "400.5", widthMm: 500 }, "calculated"],
    ["NaN", { material: "chipboard", heightMm: NaN, widthMm: 300 }, "invalid"],
    ["Infinity", { material: "chipboard", heightMm: Infinity, widthMm: 300 }, "invalid"],
    ["boolean", { material: "chipboard", heightMm: true, widthMm: 300 }, "invalid"],
    ["unknown material", { material: "other", heightMm: 300, widthMm: 300 }, "invalid"],
    ["large width", { material: "chipboard", heightMm: 300, widthMm: 1e300 }, "noMatch"],
  ];
  for (const [name, input, status] of validation) check(`validation ${name}`, calculateLift(input).status === status);
  for (const [force, articles] of Object.entries(LIFT_ARTICLES)) {
    check(`catalog ${force}`, articles.white && articles.silver && Object.keys(articles).length === 2);
  }
  check("display rounding does not change threshold selection", selectLiftForce(4.199999, 300) === 60 && selectLiftForce(4.2, 300) === 80);
  const noMatch = calculateLift({ material: "chipboard", heightMm: 600, widthMm: 400 });
  check("no article for no-match", noMatch.status === "noMatch" && !noMatch.articles && noMatch.forceN === undefined);
  check("two lifts on successful result", calculateLift({ material: "chipboard", heightMm: 300, widthMm: 300 }).quantity === 2);
  check("color changes article only", calculateLift({ material: "chipboard", heightMm: 300, widthMm: 300, color: "white" }).forceN === calculateLift({ material: "chipboard", heightMm: 300, widthMm: 300, color: "silver" }).forceN && calculateLift({ material: "chipboard", heightMm: 300, widthMm: 300, color: "silver" }).selectedArticle === "83426");
  return { ok: checks.every((checkResult) => checkResult.ok), checks };
}
