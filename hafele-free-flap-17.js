import { calculateFreeFlap315Mass } from "./hafele-free-flap.js";

export const FREE_FLAP_17_C = Object.freeze({
  manufacturer: "Häfele",
  family: "Free Flap",
  series: "1.7",
  model: "C",
  manufacturerArticle: "372.91.322",
  supplier: "KRONAS",
  supplierArticle: "62984",
  coverColor: "Серый",
  salesUnit: "Комплект",
  cabinetHeightRangeMm: Object.freeze([200, 450]),
  supplierFrontHeightRangeMm: Object.freeze([250, 400]),
  heightMassRows: Object.freeze({
    200: Object.freeze({ minMassKg: 6.8, maxMassKg: 14.7 }),
    250: Object.freeze({ minMassKg: 5.4, maxMassKg: 11.8 }),
    300: Object.freeze({ minMassKg: 4.4, maxMassKg: 9.6 }),
    350: Object.freeze({ minMassKg: 3.7, maxMassKg: 8.1 }),
    400: Object.freeze({ minMassKg: 3.2, maxMassKg: 7.0 }),
    450: Object.freeze({ minMassKg: 2.7, maxMassKg: 6.1 }),
  }),
  mechanismMaterial: "Сталь с никелированным покрытием",
  coverMaterial: "Пластик",
  openingAngleDeg: 107,
  optionalLimitedAngleDeg: 90,
  limiterArticle: null,
  packageContents: null,
  sourceFile: "Hafele_Free_Flap_1_7_C_37291322_for_prompt.pdf",
  sourcePage: 1,
  sourceSection: "Раздел 3",
  verificationStatus: "preliminary-provided-reference",
  datasetVersion: "free-flap-1.7-c-reference-summary-v1",
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

export function calculateFreeFlap17Mass({
  mode = "manual", totalFacadeMassKg, massElements = "unknown",
  frontHeightMm, frontWidthMm, thicknessMm, densityKgM3, densitySource = "",
  handlesTotalMassKg = "0", otherAddedMassKg = "0", facadeType = "solid-panel",
} = {}) {
  if (mode === "manual") {
    const mass = parseNumber(totalFacadeMassKg);
    if (mass.error) return { status: "invalid", errorText: "Введите корректное числовое значение массы" };
    if (mass.empty) return { status: "incomplete", errorText: "Введите общую массу фасада" };
    if (mass.value < 0) return { status: "invalid", errorText: "Масса не может быть отрицательной" };
    const accountingNotes = {
      panel: "Введённая масса относится только к панели; учёт ручек и других элементов отдельно не подтверждён.",
      assembled: "Введённая масса относится к собранному фасаду; ручки и добавки повторно не прибавляются.",
      total: "Общая масса подвижного фасада принята как явное допущение приложения; состав массы требует проверки.",
      unknown: "Не уточнено, какие элементы входят в массу; таблица справки не поясняет учёт ручки.",
    };
    return { status: "calculated", massKg: mass.value, mode, massElements, accountingNote: accountingNotes[massElements] || accountingNotes.unknown, massOrigin: "manual-total-no-additions" };
  }
  if (mode !== "estimate") return { status: "invalid", errorText: "Выберите способ определения массы" };
  if (facadeType !== "solid-panel") return { status: "invalid", errorText: "Оценка применима только к однородной сплошной панели. Для рамочного или комбинированного фасада введите известную общую массу." };
  const estimate = calculateFreeFlap315Mass({
    frontHeightMm, frontWidthMm, thicknessMm, densityKgM3, densitySource,
    handlesTotalMassKg, otherIncludedMassKg: otherAddedMassKg,
    facadeType: "wood-panel",
  });
  if (estimate.status !== "estimated") return estimate;
  return {
    ...estimate,
    mode,
    massKg: estimate.selectionMassKg,
    massElements: "panel-handles-additions",
    accountingNote: "Геометрическая оценка панели с явно введённой суммарной массой ручек и другими добавками; это не формула производителя подъёмника.",
    massOrigin: "estimated-panel-plus-user-entered-additions",
  };
}

export function checkFreeFlap17C({ cabinetHeightMm, totalFacadeMassKg, frontHeightMm = "" } = {}) {
  const kh = parseNumber(cabinetHeightMm);
  const mass = parseNumber(totalFacadeMassKg);
  const frontHeight = parseNumber(frontHeightMm);
  const base = {
    status: "incomplete", model: "C", manufacturerArticle: FREE_FLAP_17_C.manufacturerArticle,
    cabinetHeightMm: null, totalFacadeMassKg: null, selectedRow: null,
    verificationStatus: FREE_FLAP_17_C.verificationStatus,
  };
  if (kh.error || mass.error || frontHeight.error) return { ...base, status: "invalid", errorText: "Проверьте числовой ввод" };
  const facadeHeightStatus = frontHeight.empty ? "not-entered" :
    frontHeight.value <= 0 ? "invalid" :
      frontHeight.value < 250 || frontHeight.value > 400 ? "out-of-described-range" : "within-described-range";
  if (facadeHeightStatus === "invalid") return { ...base, status: "invalid", facadeHeightStatus, errorText: "Высота фасада должна быть положительной" };
  if (kh.empty || mass.empty) return {
    ...base, status: "incomplete", facadeHeightStatus,
    errorText: "Введите KH корпуса и массу фасада; высота фасада проверяется отдельно",
  };
  if (kh.value <= 0 || mass.value < 0) return { ...base, status: "invalid", facadeHeightStatus, errorText: "KH должен быть положительным, масса — неотрицательной" };
  const [minKh, maxKh] = FREE_FLAP_17_C.cabinetHeightRangeMm;
  if (kh.value < minKh || kh.value > maxKh) return {
    ...base, status: "out-of-range", cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value,
    facadeHeightStatus, massStatus: "not-checked", errorText: "Высота корпуса вне диапазона предоставленной справки 1.7 C",
  };
  const row = FREE_FLAP_17_C.heightMassRows[kh.value];
  if (!row) {
    const heights = Object.keys(FREE_FLAP_17_C.heightMassRows).map(Number);
    const lower = heights.filter((height) => height < kh.value).at(-1);
    const upper = heights.find((height) => height > kh.value);
    return {
      ...base, status: "no-exact-row", cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value,
      facadeHeightStatus, massStatus: "no-exact-row", errorText: "Для этой высоты KH в предоставленной справке нет точной строки",
      neighbouringRows: [lower, upper].filter(Number.isFinite),
    };
  }
  const common = {
    ...base, cabinetHeightMm: kh.value, totalFacadeMassKg: mass.value,
    facadeHeightMm: frontHeight.empty ? null : frontHeight.value,
    selectedRow: { cabinetHeightMm: kh.value, ...row },
    sourceFile: FREE_FLAP_17_C.sourceFile, sourcePage: FREE_FLAP_17_C.sourcePage,
    sourceSection: FREE_FLAP_17_C.sourceSection, facadeHeightStatus,
    rangeRule: "minMassKg <= totalFacadeMassKg <= maxMassKg",
  };
  if (mass.value < row.minMassKg) return { ...common, status: "below-range", massStatus: "below-range", errorText: "Масса ниже диапазона модели C для указанной высоты корпуса" };
  if (mass.value > row.maxMassKg) return { ...common, status: "above-range", massStatus: "above-range", errorText: "Масса выше диапазона модели C для указанной высоты корпуса" };
  return {
    ...common, status: "matched", massStatus: "matched",
    errorText: "По высоте корпуса и массе соответствует предоставленной таблице; проверка предварительная",
  };
}

export function runFreeFlap17Checks() {
  const checks = [];
  const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const close = (actual, expected) => Math.abs(actual - expected) < 1e-12;
  const examples = [
    [200, 6.8, "matched"], [200, 14.7, "matched"], [200, 6.799999, "below-range"],
    [200, 14.700001, "above-range"], [250, 10, "matched"], [300, 7, "matched"],
    [350, 8.1, "matched"], [400, 7.000001, "above-range"], [450, 2.7, "matched"],
    [450, 6.1, "matched"], [325, 7, "no-exact-row"], [199.999, 10, "out-of-range"],
    [450.001, 5, "out-of-range"],
  ];
  for (const [height, mass, expected] of examples) check(`example ${height}/${mass}`, checkFreeFlap17C({ cabinetHeightMm: height, totalFacadeMassKg: mass }).status === expected);
  for (const [heightText, row] of Object.entries(FREE_FLAP_17_C.heightMassRows)) {
    const height = Number(heightText);
    for (const [name, mass, expected] of [
      ["min below", row.minMassKg - 0.000001, "below-range"], ["min equal", row.minMassKg, "matched"],
      ["max equal", row.maxMassKg, "matched"], ["max above", row.maxMassKg + 0.000001, "above-range"],
    ]) check(`boundary ${height}/${name}`, checkFreeFlap17C({ cabinetHeightMm: height, totalFacadeMassKg: mass }).status === expected);
  }
  check("KH and facade heights checked separately", checkFreeFlap17C({ cabinetHeightMm: 300, totalFacadeMassKg: 7, frontHeightMm: 350 }).facadeHeightStatus === "within-described-range" && checkFreeFlap17C({ cabinetHeightMm: 300, totalFacadeMassKg: 7, frontHeightMm: 420 }).facadeHeightStatus === "out-of-described-range");
  check("missing facade height does not block mass table", checkFreeFlap17C({ cabinetHeightMm: 300, totalFacadeMassKg: 7 }).status === "matched" && checkFreeFlap17C({ cabinetHeightMm: 300, totalFacadeMassKg: 7 }).facadeHeightStatus === "not-entered");
  check("manual mass is not incremented", calculateFreeFlap17Mass({ mode: "manual", totalFacadeMassKg: 3.98, massElements: "assembled" }).massKg === 3.98);
  const mass = calculateFreeFlap17Mass({ mode: "estimate", frontHeightMm: 300, frontWidthMm: 1000, thicknessMm: 18, densityKgM3: 700, handlesTotalMassKg: 0.2, otherAddedMassKg: 0, densitySource: "Ввод пользователя" });
  check("geometric mass example", mass.status === "estimated" && close(mass.areaM2, 0.3) && close(mass.volumeM3, 0.0054) && close(mass.panelMassKg, 3.78) && close(mass.massKg, 3.98));
  check("missing density source is invalid", calculateFreeFlap17Mass({ mode: "estimate", frontHeightMm: 300, frontWidthMm: 1000, thicknessMm: 18, densityKgM3: 700, handlesTotalMassKg: 0, otherAddedMassKg: 0 }).status === "invalid");
  check("unknowns stay unknown", FREE_FLAP_17_C.limiterArticle === null && FREE_FLAP_17_C.packageContents === null);
  check("supplier and manufacturer articles stay distinct", FREE_FLAP_17_C.manufacturerArticle !== FREE_FLAP_17_C.supplierArticle);
  check("angle does not alter model rows", FREE_FLAP_17_C.openingAngleDeg === 107 && FREE_FLAP_17_C.optionalLimitedAngleDeg === 90 && Object.keys(FREE_FLAP_17_C.heightMassRows).length === 6);
  return { ok: checks.every((item) => item.ok), checks };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function mountFreeFlap17(host, { onCalculation = () => {} } = {}) {
  host.innerHTML = `
    <div class="flap-subtabs" role="tablist" aria-label="Разделы Häfele Free Flap 1.7 C">
      <button type="button" role="tab" aria-selected="true" data-flap17-section="selection">Подбор</button>
      <button type="button" role="tab" aria-selected="false" data-flap17-section="characteristics">Характеристики</button>
      <button type="button" role="tab" aria-selected="false" data-flap17-section="installation">Комплектующие и монтаж</button>
      <button type="button" role="tab" aria-selected="false" data-flap17-section="documents">Документы</button>
    </div>
    <section role="tabpanel" data-flap17-panel="selection">
      <p class="lift-unverified">Предварительная проверка по предоставленной сводке. Табличная масса не уточняет, учтена ли ручка. Приложение сравнивает явно введённую общую массу подвижного фасада и сохраняет это допущение.</p>
      <div class="flap-grid">
        <label>Высота корпуса KH, мм<input id="flap17-kh" type="number" step="any" inputmode="decimal"></label>
        <label>Масса фасада для сравнения, кг<input id="flap17-mass" type="number" min="0" step="any" inputmode="decimal"></label>
        <label>Состав введённой массы<select id="flap17-mass-elements"><option value="unknown">Не уточнён</option><option value="panel">Только панель</option><option value="assembled">Собранный фасад с ручками/добавками</option><option value="total">Общая масса подвижного фасада (допущение FURNIX)</option></select></label>
        <label>Высота фасада, мм<input id="flap17-front-height" type="number" min="0" step="any" inputmode="decimal"><small>Диапазон описания KRONAS: 250–400 мм; это не таблица KH.</small></label>
        <label>Ширина фасада, мм<input id="flap17-front-width" type="number" min="0" step="any" inputmode="decimal"></label>
        <label>Способ определения массы<select id="flap17-mass-mode"><option value="manual">Ввести общую массу</option><option value="estimate">Рассчитать массу панели</option></select></label>
        <label>Угол открывания<select id="flap17-angle"><option value="107">107°</option><option value="90">90° с дополнительным ограничителем</option></select></label>
        <label>Количество комплектов для спецификации<input id="flap17-quantity" type="number" min="1" step="1" inputmode="numeric" placeholder="Укажите явно"></label>
      </div>
      <div id="flap17-estimate-fields" class="flap-grid" hidden>
        <label>Толщина панели, мм<input id="flap17-thickness" type="number" min="0.1" step="any" inputmode="decimal"></label>
        <label>Плотность, кг/м³<input id="flap17-density" type="number" min="0.1" step="any" inputmode="decimal"></label>
        <label>Источник плотности<input id="flap17-density-source" type="text" maxlength="200"></label>
        <label>Суммарная масса ручек, кг<input id="flap17-handles" type="number" min="0" step="any" value="0" inputmode="decimal"></label>
        <label>Другие добавки к массе, кг<input id="flap17-other" type="number" min="0" step="any" value="0" inputmode="decimal"></label>
        <label>Тип фасада<select id="flap17-facade-type"><option value="solid-panel">Однородная сплошная панель</option><option value="frame">Рамочный</option><option value="combined">Комбинированный</option></select></label>
      </div>
      <div id="flap17-mass-result" class="lift-result" role="status" aria-live="polite">Введите общую массу либо параметры панели для оценки.</div>
      <div id="flap17-result" class="lift-result" role="status" aria-live="polite">Введите KH и массу фасада.</div>
      <div class="flap-actions"><button type="button" id="flap17-check" class="primary">Проверить модель C</button><button type="button" id="flap17-calculate-mass">Рассчитать массу</button><button type="button" id="flap17-use-estimate" disabled>Использовать рассчитанную массу</button><button type="button" id="flap17-show-table">Показать таблицу</button><button type="button" id="flap17-reset">Сбросить</button></div>
      <div id="flap17-table" hidden><h3>Таблица модели C</h3><div class="lift-table-wrap"><table><thead><tr><th>KH корпуса, мм</th><th>Мин. масса, кг</th><th>Макс. масса, кг</th></tr></thead><tbody>${Object.entries(FREE_FLAP_17_C.heightMassRows).map(([height, row]) => `<tr><th>${height}</th><td>${row.minMassKg.toFixed(1)}</td><td>${row.maxMassKg.toFixed(1)}</td></tr>`).join("")}</tbody></table></div><small>Источник: ${esc(FREE_FLAP_17_C.sourceFile)}, стр. ${FREE_FLAP_17_C.sourcePage}, раздел ${esc(FREE_FLAP_17_C.sourceSection)}. Предварительная проверка по предоставленной сводке.</small></div>
    </section>
    <section role="tabpanel" data-flap17-panel="characteristics" hidden>
      <h3>Häfele Free Flap 1.7, модель C</h3>
      <dl><dt>Артикул производителя</dt><dd>372.91.322</dd><dt>Артикул KRONAS</dt><dd>62984</dd><dt>Цвет заглушек</dt><dd>Серый</dd><dt>Единица продажи по справке</dt><dd>Комплект; точный состав неизвестен</dd><dt>Высота корпуса KH</dt><dd>200–450 мм по предоставленной карточке</dd><dt>Высота фасада</dt><dd>250–400 мм по описанию KRONAS</dd><dt>Открывание</dt><dd>107°; ограничение до 90° требует отдельного ограничителя</dd><dt>Механизм</dt><dd>Сталь с никелированным покрытием; крепление винтами</dd><dt>Фасад</dt><dd>Цельный, крепление защёлкивающимися монтажными элементами</dd></dl>
      <figure class="flap-angle-figure">
        <svg viewBox="0 0 360 230" role="img" aria-labelledby="flap17-angle-title flap17-angle-desc">
          <title id="flap17-angle-title">Схема открывания фасада</title>
          <desc id="flap17-angle-desc">Схематичное положение фасада при выбранном угле, без проверки монтажной геометрии.</desc>
          <path d="M100 70H280V205H100Z" fill="#edf1f4" stroke="#71808b" stroke-width="2" />
          <line x1="100" y1="70" x2="100" y2="205" stroke="#a1abb3" stroke-width="2" stroke-dasharray="6 5" />
          <circle cx="100" cy="70" r="5" fill="#263b4d" />
          <line id="flap17-angle-door" x1="100" y1="70" x2="-20" y2="45" stroke="#1976a5" stroke-width="8" stroke-linecap="round" />
          <text id="flap17-angle-label" x="115" y="48" font-size="15" fill="#263b4d">107°</text>
        </svg>
        <figcaption>Схема принципа открывания, без проверки монтажной геометрии.</figcaption>
      </figure>
      <p>Неизвестные монтажные размеры, глубина, максимальная ширина и толщина фасада в карточке не указаны. Табличная масса не поясняет, включена ли ручка.</p>
    </section>
    <section role="tabpanel" data-flap17-panel="installation" hidden>
      <p>Регулировки высоты, бокового положения и наклона; в карточке приведено значение ±1,5 мм без однозначного диапазона для каждой оси. Регулировка удерживающего усилия указана. Не назначайте ±1,5 мм всем осям автоматически.</p>
      <p id="flap17-limiter-note">При 107° дополнительный ограничитель не выбран.</p>
      <p>Для режима 90° требуется дополнительный ограничитель. Его артикул и включение в комплект в предоставленной справке не указаны.</p>
      <p>Состав комплекта, количество механизмов, крепёж, адаптеры, монтажные зазоры и присадка не установлены. Совместимость с Push-to-open не подтверждена. Монтажных чертежей в доступных материалах нет.</p>
      <p>Доступная схема принципа открывания, если будет добавлена, не проверяет монтажную геометрию и столкновения с мебелью.</p>
    </section>
    <section role="tabpanel" data-flap17-panel="documents" hidden>
      <h3>Источник данных</h3><p>${esc(FREE_FLAP_17_C.sourceFile)}, стр. ${FREE_FLAP_17_C.sourcePage}, раздел ${esc(FREE_FLAP_17_C.sourceSection)}. Предоставленная сводка описывает двухстраничную карточку знаний, а не полную оригинальную инструкцию.</p>
      <p class="lift-unverified">Сам PDF не найден в проекте, папке загрузок или папке вложения; ссылку «Открыть PDF» не показываем. Данные перенесены из задания пользователя и отдельно не сверялись с производителем.</p>
    </section>`;

  const byId = (id) => host.querySelector(`#${id}`);
  const renderAngleSketch = () => {
    const angle = Number(byId("flap17-angle").value);
    const length = 135, radians = angle * Math.PI / 180;
    const door = byId("flap17-angle-door");
    door.setAttribute("x2", String(100 - Math.sin(radians) * length));
    door.setAttribute("y2", String(70 + Math.cos(radians) * length));
    byId("flap17-angle-label").textContent = `${angle}°`;
    byId("flap17-angle-desc").textContent = `Схематичное положение фасада при ${angle} градусах, без проверки монтажной геометрии.`;
  };
  byId("flap17-angle").addEventListener("change", renderAngleSketch);
  const result = byId("flap17-result"), massResult = byId("flap17-mass-result");
  const estimateFields = byId("flap17-estimate-fields"), massMode = byId("flap17-mass-mode");
  let lastEstimate = null;
  let lastCheck = null;
  let lastInputsSignature = "";
  const tabs = [...host.querySelectorAll("[data-flap17-section]")];
  tabs.forEach((button) => button.addEventListener("click", () => {
    tabs.forEach((tab) => {
      const active = tab === button;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      host.querySelector(`[data-flap17-panel="${tab.dataset.flap17Section}"]`).hidden = !active;
    });
  }));
  const inputs = () => ({
    cabinetHeightMm: byId("flap17-kh").value,
    totalFacadeMassKg: byId("flap17-mass").value,
    frontHeightMm: byId("flap17-front-height").value,
    frontWidthMm: byId("flap17-front-width").value,
    mode: massMode.value,
    massOrigin: byId("flap17-mass").dataset.origin || "manual",
    massElements: byId("flap17-mass-elements").value,
    openingAngleDeg: byId("flap17-angle").value,
    quantity: byId("flap17-quantity").value,
    thicknessMm: byId("flap17-thickness").value,
    densityKgM3: byId("flap17-density").value,
    densitySource: byId("flap17-density-source").value,
    handlesTotalMassKg: byId("flap17-handles").value,
    otherAddedMassKg: byId("flap17-other").value,
    facadeType: byId("flap17-facade-type").value,
  });
  const readEstimate = () => calculateFreeFlap17Mass({
    mode: "estimate", frontHeightMm: byId("flap17-front-height").value,
    frontWidthMm: byId("flap17-front-width").value, thicknessMm: byId("flap17-thickness").value,
    densityKgM3: byId("flap17-density").value, densitySource: byId("flap17-density-source").value,
    handlesTotalMassKg: byId("flap17-handles").value, otherAddedMassKg: byId("flap17-other").value,
    facadeType: byId("flap17-facade-type").value,
  });
  const renderMass = () => {
    const estimating = massMode.value === "estimate";
    estimateFields.hidden = !estimating;
    byId("flap17-mass").disabled = estimating;
    if (!estimating) {
      if (byId("flap17-mass").dataset.origin !== "estimated") lastEstimate = null;
      byId("flap17-use-estimate").disabled = true;
      massResult.className = "lift-result";
      massResult.textContent = "Введённая масса используется без повторного добавления ручек. Укажите состав массы или оставьте его неуточнённым.";
      refreshCheck();
      return null;
    }
    lastEstimate = readEstimate();
    if (lastEstimate.status !== "estimated") {
      massResult.className = `lift-result ${lastEstimate.status === "invalid" ? "no-match" : ""}`;
      massResult.textContent = lastEstimate.errorText;
      byId("flap17-use-estimate").disabled = true;
    } else {
      massResult.className = "lift-result calculated";
      massResult.innerHTML = `<p>Площадь ${lastEstimate.areaM2.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} м²; объём ${lastEstimate.volumeM3.toLocaleString("ru-RU", { maximumFractionDigits: 9 })} м³; панель ${lastEstimate.panelMassKg.toLocaleString("ru-RU", { maximumFractionDigits: 9 })} кг.</p><p>Ручки ${lastEstimate.handlesTotalMassKg} кг; другие добавки ${lastEstimate.otherIncludedMassKg} кг.</p><p><strong>Оценка общей массы: ${lastEstimate.massKg.toLocaleString("ru-RU", { maximumFractionDigits: 9 })} кг.</strong></p><small>${esc(lastEstimate.method)}. Источник плотности: ${esc(lastEstimate.densitySource)}.</small>`;
      byId("flap17-use-estimate").disabled = false;
    }
    refreshCheck();
    return lastEstimate;
  };
  const refreshCheck = () => {
    const state = inputs();
    const signature = JSON.stringify(state);
    const mass = state.mode === "estimate" && lastEstimate?.status === "estimated" ? lastEstimate.massKg : state.mode === "manual" ? state.totalFacadeMassKg : "";
    const value = checkFreeFlap17C({ cabinetHeightMm: state.cabinetHeightMm, totalFacadeMassKg: mass, frontHeightMm: state.frontHeightMm });
    const limitedAngle = Number(state.openingAngleDeg) === 90;
    byId("flap17-limiter-note").textContent = limitedAngle
      ? "Требуется дополнительный ограничитель до 90°. Артикул и включение в комплект в справке не указаны."
      : "Выбран основной угол 107°. Ограничитель 90° не выбран.";
    const quantityValue = parseNumber(state.quantity);
    const quantityValid = !quantityValue.error && !quantityValue.empty && Number.isInteger(quantityValue.value) && quantityValue.value > 0;
    const resultClass = value.status === "matched" ? "calculated" : value.status === "incomplete" ? "" : "no-match";
    result.className = `lift-result ${resultClass}`;
    if (value.status === "matched") {
      const heightLine = value.facadeHeightStatus === "within-described-range" ? `Высота фасада ${value.facadeHeightMm} мм находится в диапазоне описания KRONAS.` : value.facadeHeightStatus === "out-of-described-range" ? `Высота фасада вне диапазона описания KRONAS 250–400 мм; совместимость требует уточнения.` : "Высота фасада не введена; дополнительная проверка не завершена.";
      const angle = Number(state.openingAngleDeg);
      const limiter = angle === 90 ? "Требуется дополнительный ограничитель. Артикул и включение в комплект в справке не указаны." : "Дополнительный ограничитель не выбран.";
      result.innerHTML = `<p><strong>Häfele Free Flap 1.7 C · артикул ${FREE_FLAP_17_C.manufacturerArticle}</strong></p><p>KH ${value.cabinetHeightMm} мм; масса ${value.totalFacadeMassKg} кг; диапазон строки ${value.selectedRow.minMassKg.toFixed(1)}–${value.selectedRow.maxMassKg.toFixed(1)} кг.</p><p>По высоте корпуса и массе соответствует предоставленной таблице.</p><p>${esc(heightLine)}</p><p>Угол ${angle}°; ${esc(limiter)}</p><p>${esc(state.mode === "estimate" || state.massOrigin === "estimated" ? lastEstimate?.accountingNote || "" : (calculateFreeFlap17Mass({ mode: "manual", totalFacadeMassKg: mass, massElements: state.massElements }).accountingNote))}</p><p>Монтажные размеры в предоставленной карточке отсутствуют.</p><p><strong>Общий статус: предварительная проверка. Безусловный статус «Подходит» не назначается.</strong></p>`;
    } else if (["below-range", "above-range"].includes(value.status)) {
      const angle = Number(state.openingAngleDeg);
      const heightText = value.facadeHeightStatus === "not-entered" ? "Высота фасада не введена; дополнительная проверка не завершена." : value.facadeHeightStatus === "out-of-described-range" ? "Высота фасада вне диапазона описания KRONAS 250–400 мм." : `Высота фасада ${value.facadeHeightMm} мм в диапазоне описания KRONAS.`;
      result.innerHTML = `<p><strong>${esc(value.errorText)}</strong></p><p>Табличный диапазон для KH ${value.cabinetHeightMm} мм: ${value.selectedRow.minMassKg.toFixed(1)}–${value.selectedRow.maxMassKg.toFixed(1)} кг; введённая масса: ${value.totalFacadeMassKg} кг.</p><p>${esc(heightText)}</p><p>${angle === 90 ? "Для угла 90° требуется дополнительный ограничитель; артикул и включение в комплект не указаны." : "Выбран основной угол 107°."}</p><p>Общий статус: предварительная проверка.</p>`;
    } else if (value.status === "out-of-range") {
      const heightText = value.facadeHeightStatus === "not-entered" ? "Высота фасада не введена." : `Статус высоты фасада: ${value.facadeHeightStatus}.`;
      result.innerHTML = `<p><strong>${esc(value.errorText)}</strong></p><p>Проверка массы: не выполнена, так как KH находится вне диапазона 200–450 мм.</p><p>${esc(heightText)}</p><p>Общий статус: предварительная проверка.</p>`;
    } else if (value.status === "no-exact-row" && value.neighbouringRows?.length) {
      result.textContent = `${value.errorText}. Соседние строки ${value.neighbouringRows.join(" и ")} мм показаны только как справка.`;
    } else {
      result.textContent = value.errorText || "Введите KH и массу фасада.";
    }
    const modelEligible = value.status === "matched" && value.facadeHeightStatus !== "out-of-described-range" && quantityValid;
    const massSavable = value.status === "matched" || ["below-range", "above-range", "no-exact-row", "out-of-range"].includes(value.status);
    lastCheck = { value, inputs: state, massKg: mass, quantity: quantityValid ? quantityValue.value : null, eligible: modelEligible, savable: massSavable };
    lastInputsSignature = signature;
    const selectionMass = Number.parseFloat(String(mass).replace(",", "."));
    onCalculation(value.status !== "incomplete" && value.status !== "invalid" ? {
      system: "hafele-free-flap-1.7-c", systemName: "Häfele Free Flap 1.7 C",
      status: value.status, savable: massSavable, eligible: modelEligible,
      title: `Free Flap 1.7 C, KH ${(value.cabinetHeightMm ?? state.cabinetHeightMm) || "—"} мм`,
      inputs: { ...state, totalFacadeMassKg: Number.isFinite(selectionMass) ? selectionMass : state.totalFacadeMassKg, massEstimate: (state.mode === "estimate" || state.massOrigin === "estimated") && lastEstimate?.status === "estimated" ? structuredClone(lastEstimate) : null },
      summary: `${value.massStatus || value.status}; KH ${(value.cabinetHeightMm ?? state.cabinetHeightMm) || "не задана"} мм; масса ${Number.isFinite(selectionMass) ? selectionMass : "не задана"} кг; фасад ${state.frontHeightMm || "не задан"} мм; угол ${state.openingAngleDeg}°`,
      candidates: [{ modelName: `Free Flap 1.7 C ${state.openingAngleDeg}°`, article: FREE_FLAP_17_C.manufacturerArticle, quantity: quantityValid ? quantityValue.value : null, unit: FREE_FLAP_17_C.salesUnit }],
      result: structuredClone(value), assumptions: [value.facadeHeightStatus === "not-entered" ? "Высота фасада не проверена" : "Проверка высоты фасада по описанию KRONAS", "Табличная масса не уточняет учёт ручки", state.openingAngleDeg === "90" ? "Нужен ограничитель с неподтверждённым артикулом и комплектностью" : "Ограничитель 90° не выбран"],
      datasetVersion: FREE_FLAP_17_C.datasetVersion, verificationStatus: FREE_FLAP_17_C.verificationStatus,
    } : null);
    return value;
  };
  byId("flap17-check").addEventListener("click", refreshCheck);
  byId("flap17-calculate-mass").addEventListener("click", () => { massMode.value = "estimate"; renderMass(); });
  byId("flap17-use-estimate").addEventListener("click", () => {
    const estimate = readEstimate();
    if (estimate.status !== "estimated") return;
    byId("flap17-mass").value = String(estimate.massKg);
    lastEstimate = estimate;
    massMode.value = "manual";
    byId("flap17-mass-elements").value = "assembled";
    byId("flap17-mass").dataset.origin = "estimated";
    renderMass();
    refreshCheck();
  });
  byId("flap17-show-table").addEventListener("click", () => { byId("flap17-table").hidden = !byId("flap17-table").hidden; });
  byId("flap17-reset").addEventListener("click", () => {
    host.querySelectorAll("[data-flap17-panel] input").forEach((input) => { input.value = input.id === "flap17-handles" || input.id === "flap17-other" ? "0" : ""; delete input.dataset.origin; });
    host.querySelectorAll("[data-flap17-panel] select").forEach((select) => { select.selectedIndex = 0; });
    renderAngleSketch();
    byId("flap17-table").hidden = true;
    byId("flap17-mass").disabled = false;
    byId("flap17-use-estimate").disabled = true;
    massResult.className = "lift-result"; massResult.textContent = "Введите общую массу либо параметры панели для оценки.";
    result.className = "lift-result"; result.textContent = "Введите KH и массу фасада.";
    lastEstimate = null; lastCheck = null; lastInputsSignature = ""; onCalculation(null);
  });
  for (const input of host.querySelectorAll("[data-flap17-panel] input, [data-flap17-panel] select")) {
    input.addEventListener("input", () => {
      if (input.id === "flap17-mass") { input.dataset.origin = "manual"; lastEstimate = null; refreshCheck(); }
      else if (massMode.value === "estimate" && ["flap17-front-height", "flap17-front-width", "flap17-thickness", "flap17-density", "flap17-density-source", "flap17-handles", "flap17-other", "flap17-facade-type"].includes(input.id)) renderMass();
      else refreshCheck();
    });
    input.addEventListener("change", () => {
      if (input.id === "flap17-mass-mode" || input.id === "flap17-facade-type") renderMass();
      else if (massMode.value === "estimate" && ["flap17-front-height", "flap17-front-width", "flap17-thickness", "flap17-density", "flap17-density-source", "flap17-handles", "flap17-other"].includes(input.id)) renderMass();
      else refreshCheck();
    });
  }
  renderAngleSketch();
  renderMass();
  return { check: refreshCheck, estimate: readEstimate };
}
