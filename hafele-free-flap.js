export const FREE_FLAP_315 = Object.freeze({
  manufacturer: "Häfele",
  family: "Free Flap",
  series: "3.15",
  verificationStatus: "preliminary-reference-only",
  datasetVersion: "provided-reference-summary-v1",
  sourceSummary: Object.freeze([
    { file: "Hafele_Free_Flap_315_Fornex_Reference.docx", status: "Предварительная сводка; в ней указано, что оригинальная инструкция не была полностью проверена" },
    { file: "Подъёмник Häfele Free Flap 3.15 G.pdf", page: 1, status: "Справочная карточка модели G; не полная монтажная инструкция производителя" },
  ]),
  modelsWithoutLoadedTables: Object.freeze(["D", "E", "F"]),
  modelG: Object.freeze({
    model: "G",
    manufacturerArticle: "372.91.333",
    supplierArticle: "62977",
    supplierArticleSource: "Код KRONAS из справочной карточки; требует подтверждения",
    coverColor: "Серый",
    mechanismMaterial: "Сталь, никелированное покрытие",
    coverMaterial: "Пластик",
    cabinetHeightMinMm: 350,
    cabinetHeightMaxMm: 650,
    minimumCabinetDepthMm: 132,
    depthMeasurementBasis: "Не уточнено: наружная или полезная внутренняя глубина",
    openingAngleDeg: 107,
    angleLimit90Mentioned: true,
    angleLimitComponentsKnown: false,
    sourceFile: "Подъёмник Häfele Free Flap 3.15 G.pdf",
    sourcePage: 1,
  }),
  heightMassRows: Object.freeze({
    350: Object.freeze({ minMassKg: 13.5, maxMassKg: 27.3 }),
    400: Object.freeze({ minMassKg: 11.8, maxMassKg: 23.3 }),
    450: Object.freeze({ minMassKg: 10.4, maxMassKg: 20.5 }),
    500: Object.freeze({ minMassKg: 9.2, maxMassKg: 18.3 }),
    550: Object.freeze({ minMassKg: 8.3, maxMassKg: 16.5 }),
    600: Object.freeze({ minMassKg: 7.6, maxMassKg: 15.0 }),
    650: Object.freeze({ minMassKg: 6.9, maxMassKg: 14.0 }),
  }),
  adapterRequirements: Object.freeze({
    woodPanel: Object.freeze({ required: false, article: null, note: "Для деревянных/плитных фасадов адаптер в сводке не указан" }),
    aluminum20: Object.freeze({ required: true, article: null, note: "Для алюминиевой рамки 20 мм указан отдельный адаптер; артикул в документах не приведён" }),
    solidGlass: Object.freeze({ required: true, article: null, note: "Для цельного стекла указан адаптер для приклеивания; артикул не приведён" }),
    other: Object.freeze({ required: null, article: null, note: "Совместимость других типов рамок не подтверждена" }),
  }),
  packageContents: Object.freeze(["Левый механизм", "Правый механизм", "Заглушки", "Крепёжные планки", "Инструкция", "Сверлильный кондуктор"]),
  salesUnit: null,
  packageQuantity: null,
});

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? { value } : { error: true };
  if (typeof value !== "string") return { error: true };
  const text = value.trim();
  if (!text) return { empty: true };
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text)) return { error: true };
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? { value: number } : { error: true };
}

export function calculateFreeFlap315Mass({ frontHeightMm, frontWidthMm, thicknessMm, densityKgM3, handlesTotalMassKg = 0, otherIncludedMassKg = 0, densitySource = "", facadeType = "wood-panel" } = {}) {
  const fields = [frontHeightMm, frontWidthMm, thicknessMm, densityKgM3].map(parseNumber);
  const handles = parseNumber(handlesTotalMassKg === "" ? 0 : handlesTotalMassKg);
  const extras = parseNumber(otherIncludedMassKg === "" ? 0 : otherIncludedMassKg);
  if ([...fields, handles, extras].some((field) => field.error)) return { status: "invalid", errorCode: "invalid-number", errorText: "Введите корректное число" };
  if ([...fields, handles, extras].some((field) => field.empty)) return { status: "incomplete", errorCode: "incomplete", errorText: "Заполните размеры панели, толщину, плотность и суммарные массы дополнительных элементов" };
  if (!["wood-panel"].includes(facadeType)) return { status: "invalid", errorCode: "unsupported-estimate", errorText: "Оценка по одной плотности предназначена только для однородной деревянной или плитной панели. Для стекла, рамки и комбинированного фасада введите общую массу вручную" };
  if (![...fields].every((field) => field.value > 0) || handles.value < 0 || extras.value < 0) return { status: "invalid", errorCode: "out-of-range", errorText: "Размеры, толщина и плотность должны быть положительными; массы добавок — неотрицательными" };
  if (typeof densitySource !== "string" || !densitySource.trim()) return { status: "invalid", errorCode: "missing-density-source", errorText: "Укажите источник плотности материала" };
  const [height, width, thickness, density] = fields.map((field) => field.value);
  const areaM2 = height * width / 1_000_000;
  const volumeM3 = height * width * thickness / 1_000_000_000;
  const panelMassKg = volumeM3 * density;
  const selectionMassKg = panelMassKg + handles.value + extras.value;
  if (![areaM2, volumeM3, panelMassKg, selectionMassKg].every(Number.isFinite)) return { status: "invalid", errorCode: "numeric-range", errorText: "Значения выходят за числовой диапазон расчёта" };
  return {
    status: "estimated",
    areaM2,
    volumeM3,
    panelMassKg,
    handlesTotalMassKg: handles.value,
    otherIncludedMassKg: extras.value,
    selectionMassKg,
    densityKgM3: density,
    densitySource: densitySource.trim(),
    massOrigin: "estimated-panel-plus-user-entered-additions",
    method: "Геометрическая оценка панели; не формула производителя подъёмника",
    sourceFile: "Пользовательский ввод плотности; справочные документы Free Flap",
  };
}

export function checkFreeFlap315Mount({ cabinetDepthMm, facadeType, openingMethod, openingAngleDeg = 107 } = {}) {
  const depth = parseNumber(cabinetDepthMm);
  const notes = [];
  let depthStatus = "not-checked";
  if (depth.error || (!depth.empty && depth.value <= 0)) {
    depthStatus = "invalid";
    notes.push("Введите корректную глубину корпуса");
  } else if (depth.empty) {
    notes.push("Глубина корпуса не указана; проверка монтажного ограничения не выполнена");
  } else if (depth.value < FREE_FLAP_315.modelG.minimumCabinetDepthMm) {
    depthStatus = "below-reference-minimum";
    notes.push("Глубина ниже значения 132 мм из справки; база измерения в документе не уточнена");
  } else {
    depthStatus = "meets-reference-number";
    notes.push("Число глубины не меньше 132 мм из справки, но база измерения и полная монтажная совместимость не подтверждены");
  }
  const adapter = FREE_FLAP_315.adapterRequirements[facadeType] || FREE_FLAP_315.adapterRequirements.other;
  if (adapter.required === true) notes.push(adapter.note);
  else if (adapter.required === null) notes.push(adapter.note);
  else if (!facadeType) notes.push("Тип фасада не указан; необходимость адаптера не проверена");
  if (openingMethod === "push") notes.push("Открывание нажатием требует проверки совместимого исполнения и компонентов; базовый артикул G сам по себе не подтверждает Push-to-open");
  else if (openingMethod !== "handle") notes.push("Способ открывания не указан");
  if (Number(openingAngleDeg) === 90) notes.push("Ограничение угла до 90° упомянуто в Word-сводке; необходимые компоненты не установлены");
  else if (Number(openingAngleDeg) !== 107) notes.push("Угол открывания не подтверждён предоставленной справкой");
  notes.push("Проверенные монтажные чертежи и карта присадки отсутствуют");
  return {
    status: depthStatus === "invalid" ? "invalid" : notes.length ? "preliminary-review" : "preliminary-review",
    depthMm: depth.value ?? null,
    depthStatus,
    minimumReferenceDepthMm: FREE_FLAP_315.modelG.minimumCabinetDepthMm,
    depthMeasurementBasis: FREE_FLAP_315.modelG.depthMeasurementBasis,
    adapter,
    notes,
    productionDrillingAvailable: false,
  };
}

export function checkFreeFlap315({ cabinetHeightMm, totalFacadeMassKg } = {}) {
  const base = { status: "incomplete", model: "G", manufacturerArticle: FREE_FLAP_315.modelG.manufacturerArticle, cabinetHeightMm: null, totalFacadeMassKg: null, selectedRow: null };
  const kh = parseNumber(cabinetHeightMm), mass = parseNumber(totalFacadeMassKg);
  if (kh.error || mass.error) return { ...base, status: "invalid", errorCode: "invalid-number", errorText: "Введите корректное число" };
  if (kh.empty || mass.empty) return { ...base, status: "incomplete", errorCode: "incomplete", errorText: "Введите высоту корпуса KH и общую массу фасада с ручкой" };
  if (kh.value <= 0 || mass.value < 0) return { ...base, status: "invalid", cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value, errorCode: "out-of-range", errorText: "Высота корпуса должна быть положительной, масса — неотрицательной" };
  if (kh.value < 350 || kh.value > 650) return { ...base, status: "out-of-range", cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value, errorCode: "height-out-of-range", errorText: "Высота вне диапазона предоставленной справки" };
  const row = FREE_FLAP_315.heightMassRows[kh.value];
  if (!row) return { ...base, status: "no-exact-row", cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value, errorCode: "no-exact-row", errorText: "Для этой высоты в предоставленной справке нет точной строки", neighbouringRows: Object.keys(FREE_FLAP_315.heightMassRows).map(Number).filter((height) => height < kh.value).slice(-1).concat(Object.keys(FREE_FLAP_315.heightMassRows).map(Number).find((height) => height > kh.value) || []) };
  const common = { ...base, cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value, selectedRow: { cabinetHeightMm: kh.value, ...row }, sourceFile: FREE_FLAP_315.modelG.sourceFile, sourcePage: FREE_FLAP_315.modelG.sourcePage, verificationStatus: FREE_FLAP_315.verificationStatus, rangeRule: "minMassKg ≤ totalFacadeMassKg ≤ maxMassKg" };
  if (mass.value < row.minMassKg) return { ...common, status: "below-range", errorCode: "below-range", errorText: "Масса ниже диапазона G" };
  if (mass.value > row.maxMassKg) return { ...common, status: "above-range", errorCode: "above-range", errorText: "Масса выше диапазона G" };
  return { ...common, status: "matched", errorCode: null, errorText: "Соответствует диапазону G по предоставленной справке", preliminary: true, otherModelsStatus: "Для проверки D/E/F необходимы их таблицы" };
}

export function runFreeFlap315Checks() {
  const checks = [];
  const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const expected = [
    [350,13.5,"matched"],[350,27.3,"matched"],[350,13.499999,"below-range"],[350,27.300001,"above-range"],
    [400,12,"matched"],[450,10,"below-range"],[500,12,"matched"],[500,18.3,"matched"],[500,18.300001,"above-range"],
    [600,15,"matched"],[650,6.9,"matched"],[650,14,"matched"],[425,12,"no-exact-row"],[349.999,20,"out-of-range"],[650.001,10,"out-of-range"],
  ];
  for (const [height,mass,status] of expected) check(`sample ${height}/${mass}`,checkFreeFlap315({cabinetHeightMm:height,totalFacadeMassKg:mass}).status===status);
  for (const [height,row] of Object.entries(FREE_FLAP_315.heightMassRows)) {
    for (const [bound,mass,want] of [["min-below",row.minMassKg-0.000001,"below-range"],["min-equal",row.minMassKg,"matched"],["max-equal",row.maxMassKg,"matched"],["max-above",row.maxMassKg+0.000001,"above-range"]]) {
      check(`range ${height}/${bound}`,checkFreeFlap315({cabinetHeightMm:Number(height),totalFacadeMassKg:mass}).status===want);
    }
  }
  const empty = checkFreeFlap315({cabinetHeightMm:"",totalFacadeMassKg:""});
  check("empty is incomplete",empty.status==="incomplete");
  check("partial numeric string rejected",checkFreeFlap315({cabinetHeightMm:"500abc",totalFacadeMassKg:12}).status==="invalid");
  check("comma decimal accepted",checkFreeFlap315({cabinetHeightMm:"500",totalFacadeMassKg:"12,5"}).status==="matched");
  check("zero mass accepted at parsing but below range",checkFreeFlap315({cabinetHeightMm:500,totalFacadeMassKg:0}).status==="below-range");
  check("negative mass rejected",checkFreeFlap315({cabinetHeightMm:500,totalFacadeMassKg:-0.01}).status==="invalid");
  check("infinite value rejected",checkFreeFlap315({cabinetHeightMm:Infinity,totalFacadeMassKg:12}).status==="invalid");
  check("depth 132 is threshold only",checkFreeFlap315Mount({cabinetDepthMm:132,facadeType:"woodPanel",openingMethod:"handle"}).depthStatus==="meets-reference-number");
  check("depth 131.999 below threshold",checkFreeFlap315Mount({cabinetDepthMm:131.999,facadeType:"woodPanel",openingMethod:"handle"}).depthStatus==="below-reference-minimum");
  check("blank depth incomplete",checkFreeFlap315Mount({cabinetDepthMm:"",facadeType:"woodPanel",openingMethod:"handle"}).depthStatus==="not-checked");
  check("aluminum needs unknown adapter article",checkFreeFlap315Mount({cabinetDepthMm:132,facadeType:"aluminum20",openingMethod:"handle"}).adapter.required===true&&checkFreeFlap315Mount({cabinetDepthMm:132,facadeType:"aluminum20",openingMethod:"handle"}).adapter.article===null);
  check("glass needs unknown adapter article",checkFreeFlap315Mount({cabinetDepthMm:132,facadeType:"solidGlass",openingMethod:"handle"}).adapter.required===true&&checkFreeFlap315Mount({cabinetDepthMm:132,facadeType:"solidGlass",openingMethod:"handle"}).adapter.article===null);
  check("push not confirmed by base article",checkFreeFlap315Mount({cabinetDepthMm:132,facadeType:"woodPanel",openingMethod:"push"}).notes.some((note)=>note.includes("не подтверждает Push-to-open")));
  check("other models do not have data",FREE_FLAP_315.modelsWithoutLoadedTables.join("")==="DEF"&&!FREE_FLAP_315.heightMassRows.D);
  check("supplier and manufacturer articles distinct",FREE_FLAP_315.modelG.manufacturerArticle!==FREE_FLAP_315.modelG.supplierArticle);
  check("no current price stored",!Object.hasOwn(FREE_FLAP_315.modelG,"priceUAH")&&FREE_FLAP_315.modelG.supplierArticle==="62977");
  const estimate=calculateFreeFlap315Mass({frontHeightMm:500,frontWidthMm:1000,thicknessMm:18,densityKgM3:700,handlesTotalMassKg:0.2,otherIncludedMassKg:0,densitySource:"Контрольный ввод",facadeType:"wood-panel"});
  check("panel estimate example",estimate.status==="estimated"&&estimate.areaM2===0.5&&estimate.volumeM3===0.009&&estimate.panelMassKg===6.3&&estimate.selectionMassKg===6.5);
  check("missing density source rejected",calculateFreeFlap315Mass({frontHeightMm:500,frontWidthMm:1000,thicknessMm:18,densityKgM3:700,handlesTotalMassKg:0,otherIncludedMassKg:0,facadeType:"wood-panel"}).status==="invalid");
  check("glass one-density estimate refused",calculateFreeFlap315Mass({frontHeightMm:500,frontWidthMm:1000,thicknessMm:18,densityKgM3:700,handlesTotalMassKg:0,otherIncludedMassKg:0,densitySource:"x",facadeType:"solidGlass"}).status==="invalid");
  return { ok: checks.every((item) => item.ok), checks };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
}

export function mountFreeFlap315(host, { onCalculation = () => {} } = {}) {
  host.innerHTML = `
    <h2>Häfele Free Flap 3.15</h2>
    <div class="flap-subtabs" role="tablist" aria-label="Разделы Häfele Free Flap 3.15">
      <button type="button" role="tab" aria-selected="true" data-free-flap-section="selection">Подбор</button>
      <button type="button" role="tab" aria-selected="false" data-free-flap-section="characteristics">Характеристики</button>
      <button type="button" role="tab" aria-selected="false" data-free-flap-section="components">Комплектующие</button>
      <button type="button" role="tab" aria-selected="false" data-free-flap-section="documents">Документы</button>
    </div>
    <section role="tabpanel" data-free-flap-panel="selection">
      <div class="flap-grid">
        <label>Высота корпуса KH, мм<input id="flap-kh" type="number" step="any" inputmode="decimal"></label>
        <label>Масса фасада вместе с ручкой, кг<input id="flap-total-mass" type="number" min="0" step="any" inputmode="decimal"></label>
        <label>Глубина корпуса, мм<input id="flap-depth" type="number" min="0" step="any" inputmode="decimal"><small>Источник не уточняет, наружная это глубина или полезная внутренняя.</small></label>
        <label>Тип фасада<select id="flap-facade-type"><option value="">Не указан</option><option value="woodPanel">Деревянный / плитный</option><option value="aluminum20">Алюминиевая рамка 20 мм</option><option value="solidGlass">Цельное стекло</option><option value="other">Другой</option></select></label>
        <label>Способ открывания<select id="flap-opening"><option value="">Не указан</option><option value="handle">С ручкой</option><option value="push">Нажатием</option></select></label>
        <label>Угол открывания<select id="flap-angle"><option value="107">107°</option><option value="90">Ограничение до 90° (упомянуто в сводке)</option></select></label>
      </div>
      <div class="flap-actions"><button type="button" id="flap-check" class="primary">Проверить модель G</button><button type="button" id="flap-reset">Сбросить</button></div>
      <p class="flap-origin">Предварительная проверка по предоставленной справке. Не является подтверждённой рекомендацией производителя.</p>
      <div id="flap-result" class="lift-result" role="status" aria-live="polite">Введите высоту корпуса KH и общую массу фасада с ручкой</div>
      <div id="flap-install-result" class="lift-result" role="status" aria-live="polite">Монтажная проверка не выполнена</div>
      <details class="lift-method"><summary>Оценить массу однородной панели</summary>
        <div class="flap-grid">
          <label>Высота фасада, мм<input id="flap-front-height" type="number" min="0" step="any" inputmode="decimal"></label>
          <label>Ширина фасада, мм<input id="flap-front-width" type="number" min="0" step="any" inputmode="decimal"></label>
          <label>Толщина, мм<input id="flap-thickness" type="number" min="0" step="any" inputmode="decimal"></label>
          <label>Плотность, кг/м³<input id="flap-density" type="number" min="0" step="any" inputmode="decimal"></label>
          <label>Источник плотности<input id="flap-density-source" type="text" maxlength="240" placeholder="Например, паспорт материала"></label>
          <label>Суммарная масса ручек, кг<input id="flap-handles-mass" type="number" min="0" step="any" value="0" inputmode="decimal"></label>
          <label>Другие учитываемые элементы, кг<input id="flap-other-mass" type="number" min="0" step="any" value="0" inputmode="decimal"></label>
        </div>
        <p>Расчёт доступен только для однородного деревянного/плитного фасада. Для стекла, рамки и комбинированных фасадов введите общую массу вручную.</p>
        <div class="flap-actions"><button type="button" id="flap-estimate" class="primary">Рассчитать массу</button><button type="button" id="flap-use-estimate" disabled>Использовать рассчитанную массу</button></div>
        <div id="flap-estimate-result" class="lift-result" role="status" aria-live="polite">Плотность не задана заранее: введите значение и источник.</div>
      </details>
    </section>
    <section role="tabpanel" data-free-flap-panel="characteristics" hidden>
      <h3>Карточка модели G</h3>
      <dl class="flap-facts"><dt>Производитель</dt><dd>Häfele</dd><dt>Семейство / серия</dt><dd>Free Flap 3.15</dd><dt>Модель</dt><dd>G</dd><dt>Артикул производителя</dt><dd>372.91.333</dd><dt>Код KRONAS из справки</dt><dd>62977 — требует подтверждения</dd><dt>Цвет заглушек</dt><dd>Серый</dd><dt>Механизм</dt><dd>Сталь, никелированное покрытие</dd><dt>Заглушки</dt><dd>Пластик</dd><dt>Высота корпуса KH</dt><dd>350–650 мм по справке</dd><dt>Глубина корпуса</dt><dd>Минимум 132 мм по справке; измерительная база не уточнена</dd><dt>Угол</dt><dd>107°</dd><dt>Назначение</dt><dd>Подъём цельного фасада вверх</dd></dl>
      <p>В справке упомянуты деревянные фасады, алюминиевые рамки и стекло с соответствующими адаптерами. Максимальная ширина не указана. Буквенные модели не переводятся в ньютоны.</p>
      <p>Возможность ограничения до 90° упомянута только в Word-сводке; необходимые компоненты не установлены. Диапазоны отдельных регулировок ±1,5 мм требуют уточнения по оригинальной инструкции.</p>
      <p class="lift-unverified">Статус: предварительная сводка. Цена 2 981,85 грн из карточки не используется как текущая цена. Наличие неизвестно.</p>
      <h3>Таблица массы модели G</h3>
      <div class="lift-table-wrap"><table><thead><tr><th>KH корпуса, мм</th><th>Мин. масса, кг</th><th>Макс. масса, кг</th></tr></thead><tbody>${Object.entries(FREE_FLAP_315.heightMassRows).map(([height,row])=>`<tr><th>${height}</th><td>${row.minMassKg.toFixed(1)}</td><td>${row.maxMassKg.toFixed(1)}</td></tr>`).join("")}</tbody></table></div>
      <p class="lift-unverified">Таблица перенесена из предоставленной справочной карточки PDF, стр. 1; не подтверждена по полной оригинальной таблице производителя.</p>
      <h3>Модели D, E и F</h3><p>Упомянуты в сводке. Таблица подбора не загружена. Артикулы и диапазоны не назначаются.</p>
    </section>
    <section role="tabpanel" data-free-flap-panel="components" hidden>
      <p class="flap-origin">Состав, указанный в справке; комплектация конкретного предложения требует подтверждения.</p>
      <ul>${FREE_FLAP_315.packageContents.map((part)=>`<li>${esc(part)}</li>`).join("")}</ul>
      <p>Справка перечисляет левый и правый механизмы, но единица продажи и объём артикула 372.91.333 не установлены. Количество упаковок автоматически не рассчитывается.</p>
      <h3>Адаптеры</h3><ul><li>${esc(FREE_FLAP_315.adapterRequirements.aluminum20.note)}; артикул не указан.</li><li>${esc(FREE_FLAP_315.adapterRequirements.solidGlass.note)}; артикул не указан.</li><li>${esc(FREE_FLAP_315.adapterRequirements.other.note)}</li></ul>
      <p>Открывание нажатием требует проверки совместимого исполнения и компонентов. Базовый артикул G сам по себе не подтверждает Push-to-open.</p>
      <p>Код KRONAS 62977 хранится отдельно от артикула производителя 372.91.333 и требует подтверждения. Состав поставки, единица заказа и упаковки остаются неизвестными.</p>
    </section>
    <section role="tabpanel" data-free-flap-panel="documents" hidden>
      <h3>Источники сведений</h3>
      <ul>${FREE_FLAP_315.sourceSummary.map((source)=>`<li><strong>${esc(source.file)}</strong>${source.page ? `, стр. ${source.page}` : ""} — ${esc(source.status)}</li>`).join("")}</ul>
      <p>Сводка и PDF не являются двумя независимыми подтверждениями одного параметра. Самих исходных файлов в текущем проекте нет; внешний путь компьютера в интерфейс не подставляется.</p>
      <p>В этой версии нет оригинальной монтажной инструкции. Не формируются координаты сверления, глубины, зазоры, производственная карта и заказ.</p>
      <p>После получения оригинального каталога можно обновить данные и статус проверки. Файлы из проекта сейчас нельзя открыть из интерфейса.</p>
    </section>`;

  const byId = (id) => host.querySelector(`#${id}`);
  const result = byId("flap-result"), installResult = byId("flap-install-result"), estimateResult = byId("flap-estimate-result");
  const sections = [...host.querySelectorAll("[data-free-flap-section]")];
  sections.forEach((button) => button.addEventListener("click", () => {
    sections.forEach((candidate) => {
      const active = candidate === button;
      candidate.setAttribute("aria-selected", String(active));
      candidate.tabIndex = active ? 0 : -1;
      host.querySelector(`[data-free-flap-panel="${candidate.dataset.freeFlapSection}"]`).hidden = !active;
    });
  }));
  const updateInstall = () => {
    const value = checkFreeFlap315Mount({ cabinetDepthMm: byId("flap-depth").value, facadeType: byId("flap-facade-type").value, openingMethod: byId("flap-opening").value, openingAngleDeg: byId("flap-angle").value });
    installResult.className = `lift-result ${value.depthStatus === "below-reference-minimum" || value.depthStatus === "invalid" ? "no-match" : ""}`;
    installResult.innerHTML = `<strong>Проверка установки: предварительная</strong><p>Глубина корпуса: ${value.depthMm === null ? "не указана" : `${value.depthMm} мм`}; числовой порог справки: ${value.minimumReferenceDepthMm} мм.</p><p>${value.notes.map(esc).join("; ")}</p><p>Основание измерения: ${esc(value.depthMeasurementBasis)}. Полная монтажная совместимость не подтверждена.</p>`;
  };
  const runCheck = () => {
    const value = checkFreeFlap315({ cabinetHeightMm: byId("flap-kh").value, totalFacadeMassKg: byId("flap-total-mass").value });
    onCalculation(value.status === "matched" ? value : null);
    result.className = `lift-result ${value.status === "matched" ? "calculated" : value.status === "incomplete" ? "" : "no-match"}`;
    if (value.status === "matched") {
      result.innerHTML = `<p><strong>Häfele Free Flap 3.15 G</strong></p><p>Артикул ${value.manufacturerArticle}, серые заглушки.</p><p>Высота корпуса KH: ${value.cabinetHeightMm} мм.<br>Масса фасада вместе с ручкой: ${value.totalFacadeMassKg} кг.<br>Диапазон по справке: ${value.selectedRow.minMassKg.toFixed(1)}–${value.selectedRow.maxMassKg.toFixed(1)} кг.</p><p>Соответствует таблице по высоте и массе. Проверка предварительная; оригинальные таблица производителя и монтажные условия требуют подтверждения.</p>`;
    } else {
      const extra = value.status === "below-range" || value.status === "above-range" ? `<p>${esc(value.errorText)}. Для проверки D/E/F необходимы их таблицы.</p>` : value.status === "no-exact-row" && value.neighbouringRows?.length ? `<p>${esc(value.errorText)} Соседние строки KH ${value.neighbouringRows.join(" и ")} мм показаны только для справки.</p>` : `<p>${esc(value.errorText)}</p>`;
      result.innerHTML = extra;
    }
    updateInstall();
    return value;
  };
  const estimate = () => {
    const value = calculateFreeFlap315Mass({
      frontHeightMm: byId("flap-front-height").value,
      frontWidthMm: byId("flap-front-width").value,
      thicknessMm: byId("flap-thickness").value,
      densityKgM3: byId("flap-density").value,
      densitySource: byId("flap-density-source").value,
      handlesTotalMassKg: byId("flap-handles-mass").value,
      otherIncludedMassKg: byId("flap-other-mass").value,
      facadeType: byId("flap-facade-type").value === "woodPanel" ? "wood-panel" : byId("flap-facade-type").value,
    });
    if (value.status !== "estimated") {
      estimateResult.className = `lift-result ${value.status === "invalid" ? "no-match" : ""}`;
      estimateResult.textContent = value.errorText;
      byId("flap-use-estimate").disabled = true;
      return value;
    }
    estimateResult.className = "lift-result calculated";
    estimateResult.innerHTML = `<p>Площадь: ${value.areaM2.toLocaleString("ru-RU",{minimumFractionDigits:3,maximumFractionDigits:3})} м²; объём: ${value.volumeM3.toLocaleString("ru-RU",{maximumFractionDigits:9})} м³.</p><p>Масса панели: ${value.panelMassKg.toLocaleString("ru-RU",{maximumFractionDigits:9})} кг. Ручки: ${value.handlesTotalMassKg} кг; другие элементы: ${value.otherIncludedMassKg} кг.</p><p><strong>Общая масса для подбора: ${value.selectionMassKg.toLocaleString("ru-RU",{maximumFractionDigits:9})} кг.</strong></p><small>${esc(value.method)}. Источник плотности: ${esc(value.densitySource)}.</small>`;
    byId("flap-use-estimate").disabled = false;
    return value;
  };
  byId("flap-check").addEventListener("click", runCheck);
  byId("flap-reset").addEventListener("click", () => {
    host.querySelectorAll("[data-free-flap-panel] input").forEach((input) => { input.value = ""; });
    host.querySelectorAll("[data-free-flap-panel] select").forEach((select) => { select.selectedIndex = 0; });
    byId("flap-handles-mass").value = "0";
    byId("flap-other-mass").value = "0";
    result.className = "lift-result";
    result.textContent = "Введите высоту корпуса KH и общую массу фасада с ручкой";
    installResult.className = "lift-result";
    installResult.textContent = "Монтажная проверка не выполнена";
    estimateResult.className = "lift-result";
    estimateResult.textContent = "Плотность не задана заранее: введите значение и источник.";
    byId("flap-use-estimate").disabled = true;
    onCalculation(null);
  });
  byId("flap-estimate").addEventListener("click", estimate);
  byId("flap-use-estimate").addEventListener("click", () => {
    const value = estimate();
    if (value.status !== "estimated") return;
    byId("flap-total-mass").value = String(value.selectionMassKg);
    byId("flap-total-mass").dataset.origin = "estimated";
    runCheck();
  });
  for (const id of ["flap-depth", "flap-facade-type", "flap-opening", "flap-angle"]) byId(id).addEventListener("input", updateInstall);
  byId("flap-total-mass").addEventListener("input", () => { byId("flap-total-mass").dataset.origin = "manual"; runCheck(); });
  byId("flap-kh").addEventListener("input", runCheck);
  for (const id of ["flap-front-height", "flap-front-width", "flap-thickness", "flap-density", "flap-density-source", "flap-handles-mass", "flap-other-mass"]) byId(id).addEventListener("input", () => {
    if (byId("flap-use-estimate").disabled) return;
    const value = estimate();
    if (value.status === "estimated" && byId("flap-total-mass").dataset.origin === "estimated") {
      byId("flap-total-mass").value = String(value.selectionMassKg);
      runCheck();
    } else if (byId("flap-total-mass").dataset.origin === "estimated") {
      byId("flap-total-mass").value = "";
      byId("flap-total-mass").dataset.origin = "stale-estimate";
      runCheck();
    }
  });
  return { check: runCheck, estimate };
}
