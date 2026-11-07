const makeRows = (series, models, textRows, sourceFile, sourcePage) => Object.fromEntries(
  textRows.map(([height, ...ranges]) => [height, Object.fromEntries(models.map((model, index) => {
    const [minMassKg, maxMassKg] = ranges[index].split("-").map(Number);
    return [model, { system:"Häfele Free Space", series, cabinetHeightMm:height, model, minMassKg, maxMassKg, sourceFile, sourcePage }];
  }))]),
);

const freeSpace111Models = ["B", "C", "D", "E", "F"];
const freeSpace18PushModels = ["B pto", "C pto", "D pto", "E pto"];
const instructionRows = [
  [225,"2.3-4.3","3.8-7.1","6.4-9.3","9.2-13.4","13.4-19.1"],
  [250,"1.9-3.9","3.4-6.4","5.8-9.1","8.3-12.6","12.1-17.2"],
  [275,"1.9-3.5","3.1-5.8","5.3-8.2","7.5-12.0","11.0-15.6"],
  [300,"1.7-3.2","2.8-5.3","4.8-7.5","6.9-11.0","10.1-14.3"],
  [325,"1.6-3.0","2.6-4.9","4.4-7.0","6.4-10.2","9.3-13.2"],
  [350,"1.5-2.8","2.4-4.6","4.1-6.5","5.9-9.5","8.6-12.3"],
  [375,"1.3-2.6","2.2-4.3","3.8-6.0","5.5-8.8","8.1-11.4"],
  [400,"1.2-2.4","2.1-4.0","3.6-5.6","5.2-8.3","7.6-10.7"],
  [425,"1.1-2.3","2.0-3.8","3.4-5.3","4.9-7.8","7.1-10.1"],
  [450,"1.0-2.1","1.9-3.5","3.2-5.0","4.6-7.3","6.7-9.5"],
  [475,"1.0-2.0","1.8-3.4","3.0-4.7","4.3-7.0","6.4-9.0"],
  [500,"0.9-1.9","1.7-3.2","2.9-4.5","4.1-6.6","6.0-8.6"],
  [525,"0.9-1.8","1.6-3.0","2.7-4.3","3.9-6.3","5.7-8.2"],
  [550,"0.8-1.7","1.5-2.9","2.6-4.1","3.7-6.0","5.5-7.8"],
  [575,"0.8-1.7","1.4-2.8","2.5-3.9","3.6-5.7","5.2-7.4"],
  [600,"0.8-1.6","1.4-2.7","2.4-3.7","3.4-5.5","5.0-7.1"],
  [625,"0.7-1.5","1.3-2.5","2.3-3.6","3.3-5.3","4.8-6.8"],
  [650,"0.7-1.5","1.3-2.4","2.2-3.5","3.2-5.1","4.6-6.6"],
];
const pushRows = [
  [225,"2.3-4.3","3.8-7.1","6.4-9.3","9.2-13.4"],
  [250,"1.9-3.9","3.4-6.4","5.8-9.1","8.3-12.6"],
  [300,"1.7-3.2","2.8-5.3","4.8-7.5","6.9-11.0"],
  [350,"1.5-2.8","2.4-4.6","4.1-6.5","5.9-9.5"],
  [400,"1.2-2.4","2.1-4.0","3.6-5.6","5.2-8.3"],
  [450,"1.0-2.1","1.9-3.5","3.2-5.0","4.6-7.3"],
  [500,"0.9-1.9","1.7-3.2","2.9-4.5","4.1-6.6"],
  [550,"0.8-1.7","1.5-2.9","2.6-4.1","3.7-6.0"],
  [600,"0.8-1.6","1.4-2.7","2.4-3.7","3.4-5.5"],
  [650,"0.7-1.5","1.3-2.4","2.2-3.5","3.2-5.1"],
];

export const HAFELE_SERIES = Object.freeze({
  "1.11": Object.freeze({
    label: "Free Space 1.11 — для фасадов с ручкой",
    models: freeSpace111Models,
    rows: makeRows("1.11", freeSpace111Models, instructionRows, "free-space-instruction 25.pdf", 3),
    sourceFile: "free-space-instruction 25.pdf", sourcePage: 3,
  }),
  "1.8-push": Object.freeze({
    label: "Free Space 1.8 push — для фасадов без ручки",
    models: freeSpace18PushModels,
    rows: makeRows("1.8-push", freeSpace18PushModels, pushRows, "hafele-free-space 25.pdf", 13),
    sourceFile: "hafele-free-space 25.pdf", sourcePage: 13,
  }),
});

const colors = ["white", "lightGrey", "anthracite", "black"];
export const HAFELE_COLORS = Object.freeze({
  white: "Белый", lightGrey: "Светло-серый", anthracite: "Антрацит", black: "Чёрный",
});
export const HAFELE_ARTICLES = Object.freeze({
  "1.11": {
    B: ["372.27.700","372.27.500","372.27.350","372.27.300"],
    C: ["372.27.701","372.27.501","372.27.351","372.27.301"],
    D: ["372.27.702","372.27.502","372.27.352","372.27.302"],
    E: ["372.27.703","372.27.503","372.27.353","372.27.303"],
    F: ["372.27.704","372.27.504","372.27.354","372.27.304"],
  },
  "1.8-push": {
    "B pto": ["372.27.705","372.27.505","372.27.355","372.27.305"],
    "C pto": ["372.27.706","372.27.506","372.27.356","372.27.306"],
    "D pto": ["372.27.707","372.27.507","372.27.357","372.27.307"],
    "E pto": ["372.27.708","372.27.508","372.27.358","372.27.308"],
  },
});

const X_BY_FRONT_THICKNESS = Object.freeze({ 16:117, 18:110, 19:107, 22:96, 24:90, 26:83, 28:76 });
function parseFinite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? { value } : { error: true };
  if (typeof value !== "string" || !value.trim()) return { empty: true };
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text)) return { error: true };
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? { value: number } : { error: true };
}

export function estimateHafeleMass({ frontHeightMm, frontWidthMm, material, handleMassKg, extraMassKg = 0 } = {}) {
  const height = parseFinite(frontHeightMm), width = parseFinite(frontWidthMm);
  const handle = parseFinite(handleMassKg), extra = extraMassKg === "" ? { value:0 } : parseFinite(extraMassKg);
  if ([height,width,handle,extra].some((item) => item.empty)) return { status: "incomplete", errorText: "Введите размеры фасада, массу одной ручки и дополнительные добавки (если есть)" };
  if ([height,width,handle,extra].some((item) => item.error)) return { status: "invalid", errorText: "Введите корректное число" };
  const factors = { chipboard:15.1, mdf:17.1 };
  if (!Object.hasOwn(factors, material)) return { status: "invalid", errorText: "Для этого материала нет коэффициента массы в исходном XLSX GIFF" };
  if (height.value <= 0 || width.value <= 0 || handle.value < 0 || extra.value < 0) return { status: "invalid", errorText: "Размеры должны быть положительными, добавки к массе — неотрицательными" };
  const panelAreaM2 = height.value * width.value / 1_000_000;
  const panelMassKg = panelAreaM2 * factors[material];
  const selectionMassKg = panelMassKg + 2 * handle.value + extra.value;
  if (![panelAreaM2,panelMassKg,selectionMassKg].every(Number.isFinite)) return { status: "invalid", errorText: "Значения выходят за числовой диапазон расчёта" };
  return { status: "estimated", material, panelAreaM2, panelMassKg, handleMassKg:handle.value, handleCountBySourceDiagram:2, extraMassKg:extra.value, selectionMassKg, source:"Рассчитано по схеме: масса панели + 2 × масса одной ручки + заданные добавки", coefficientSource:"Исходный XLSX GIFF, не документация Häfele" };
}

export function calculateHafele({ series, cabinetHeightMm, cabinetWidthMm, innerDepthMm, selectionMassKg, color = "white" } = {}) {
  const base = { status:"incomplete", series, cabinetHeightMm:null, selectionMassKg:null, candidates:[], installationStatus:"not-checked", installationNotes:[] };
  if (!HAFELE_SERIES[series]) return { ...base, status:"invalid", errorCode:"unknown-series", errorText:"Выберите серию Häfele Free Space" };
  const kh = parseFinite(cabinetHeightMm), mass = parseFinite(selectionMassKg);
  if (kh.empty || mass.empty) return { ...base, errorCode:"incomplete", errorText:"Введите высоту корпуса KH и массу для подбора" };
  if (kh.error || mass.error) return { ...base, status:"invalid", errorCode:"invalid-number", errorText:"Введите корректное число" };
  if (kh.value < 225 || kh.value > 650) return { ...base, status:"invalid", cabinetHeightMm:kh.value, selectionMassKg:mass.value, errorCode:"height-out-of-range", errorText:"Высота корпуса KH должна быть в пределах таблиц 225–650 мм" };
  if (mass.value < 0) return { ...base, status:"invalid", cabinetHeightMm:kh.value, selectionMassKg:mass.value, errorCode:"negative-mass", errorText:"Масса для подбора не может быть отрицательной" };
  const data = HAFELE_SERIES[series];
  const row = data.rows[kh.value];
  if (!row) return { ...base, status:"no-exact-row", cabinetHeightMm:kh.value, selectionMassKg:mass.value, errorCode:"no-exact-row", errorText:"Нет точной строки для этой высоты корпуса; интерполяция и выбор соседней строки не выполняются", neighbouringRows:Object.keys(data.rows).map(Number).filter((value) => value < kh.value).slice(-1).concat(Object.keys(data.rows).map(Number).find((value) => value > kh.value) || []) };
  const matches = data.models.filter((model) => mass.value >= row[model].minMassKg && mass.value <= row[model].maxMassKg);
  const allRanges = data.models.map((model) => row[model]);
  if (!matches.length) {
    const errorText = mass.value < Math.min(...allRanges.map((range) => range.minMassKg))
      ? "Масса ниже диапазона моделей в предоставленной таблице"
      : mass.value > Math.max(...allRanges.map((range) => range.maxMassKg))
        ? "Масса выше диапазона моделей в предоставленной таблице"
        : "Для этих параметров в таблице нет подходящей модели";
    return { ...base, status:"no-match", cabinetHeightMm:kh.value, selectionMassKg:mass.value, errorCode:"no-match", errorText, sourceFile:data.sourceFile, sourcePage:data.sourcePage };
  }
  const notes = [];
  const width = parseFinite(cabinetWidthMm), depth = parseFinite(innerDepthMm);
  if (width.error || depth.error || (!width.empty && width.value <= 0) || (!depth.empty && depth.value <= 0)) notes.push("Ширина и внутренняя глубина требуют корректного ввода");
  if (width.empty) notes.push("Ширина корпуса не указана: проверка схемы шириной ≤1800 мм не выполнена");
  else if (series === "1.11" && width.value > 1800) notes.push("Ширина корпуса превышает 1800 мм на схеме 1.11; подбор по массе сохранён, совместимость установки не подтверждена");
  if (series === "1.8-push") notes.push("Отдельная монтажная инструкция 1.8 push не подтверждена; полная монтажная совместимость не проверена. Ограничение ширины 1800 мм из инструкции 1.11 сюда не переносится");
  if (depth.empty) notes.push("Внутренняя глубина не указана: минимальное пространство 63 мм не проверено");
  else if (depth.value < 63) notes.push("Внутренняя глубина меньше 63 мм — указанное в брошюре минимальное пространство не соблюдено");
  const candidates = matches.map((model) => ({
    model, ...row[model], articleNumber:HAFELE_ARTICLES[series][model]?.[colors.indexOf(color)] || null,
    color:HAFELE_COLORS[color] || null, sourceFile:data.sourceFile, sourcePage:data.sourcePage,
    articleSourceFile:series === "1.11" ? "free-space-instruction 25.pdf" : "hafele-free-space 25.pdf",
    articleSourcePage:series === "1.11" ? 2 : 13,
  }));
  return { status:"matched", series, cabinetHeightMm:kh.value, cabinetWidthMm:width.value ?? null, innerDepthMm:depth.value ?? null, selectionMassKg:mass.value, candidates, installationStatus:notes.length ? "needs-review" : "limited-check", installationNotes:notes, sourceFile:data.sourceFile, sourcePage:data.sourcePage, rangeRule:"minMassKg ≤ selectionMassKg ≤ maxMassKg" };
}

export function getHafeleDimensionX({ frontThicknessMm, topPanelThicknessMm } = {}) {
  const front = parseFinite(frontThicknessMm), top = parseFinite(topPanelThicknessMm);
  if (front.empty || top.empty) return { status:"incomplete", errorText:"Укажите толщину фасада Y и толщину верхней панели корпуса" };
  if (front.error || top.error) return { status:"invalid", errorText:"Введите корректную толщину" };
  if (top.value !== 16 || !Object.hasOwn(X_BY_FRONT_THICKNESS, front.value)) return { status:"not-in-table", errorText:"В предоставленных документах нет точного значения X для этого сочетания" };
  return { status:"available", xMm:X_BY_FRONT_THICKNESS[front.value], sourceFile:"free-space-instruction 25.pdf", sourcePage:2 };
}

export function runHafeleSelfChecks() {
  const checks=[];
  const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
  const sampleTests=[
    ["1.11",400,1.2,["B"]],["1.11",400,2.2,["B","C"]],["1.11",400,3.8,["C","D"]],
    ["1.11",400,5.3,["D","E"]],["1.11",400,8,["E","F"]],["1.11",400,10.7,["F"]],
    ["1.11",225,13.4,["E","F"]],["1.11",275,5.5,["C","D"]],["1.11",650,.7,["B"]],["1.11",650,6.6,["F"]],
    ["1.8-push",400,3.8,["C pto","D pto"]],["1.8-push",400,8,["E pto"]],
  ];
  for(const [series,cabinetHeightMm,selectionMassKg,expected] of sampleTests){
    const result=calculateHafele({series,cabinetHeightMm,selectionMassKg,color:"lightGrey",cabinetWidthMm:600,innerDepthMm:100});
    check(`sample ${series}/${cabinetHeightMm}/${selectionMassKg}`,result.status==="matched"&&JSON.stringify(result.candidates.map((item)=>item.model))===JSON.stringify(expected));
  }
  check("no 1.11 model above max",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:10.700001}).status==="no-match");
  check("push upper mass has no model",calculateHafele({series:"1.8-push",cabinetHeightMm:400,selectionMassKg:9}).status==="no-match");
  check("push 275 has no exact row",calculateHafele({series:"1.8-push",cabinetHeightMm:275,selectionMassKg:5.5}).status==="no-exact-row");
  check("1.11 410 has no exact row",calculateHafele({series:"1.11",cabinetHeightMm:410,selectionMassKg:3.8}).status==="no-exact-row");
  check("height below table",calculateHafele({series:"1.11",cabinetHeightMm:224.999,selectionMassKg:2}).status==="invalid");
  check("height above table",calculateHafele({series:"1.11",cabinetHeightMm:650.001,selectionMassKg:2}).status==="invalid");
  check("width 1800 allowed with limited check",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3,cabinetWidthMm:1800,innerDepthMm:63}).installationStatus==="limited-check");
  check("width over 1800 flags mount only",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3,cabinetWidthMm:1800.001,innerDepthMm:63}).installationStatus==="needs-review");
  const pushMount=calculateHafele({series:"1.8-push",cabinetHeightMm:400,selectionMassKg:3,cabinetWidthMm:1800.001,innerDepthMm:63});
  check("push has no 1.11 width rule and mount remains unverified",pushMount.installationStatus==="needs-review"&&pushMount.installationNotes.some((note)=>note.includes("не переносится")));
  check("depth 63 allowed with limited check",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3,cabinetWidthMm:500,innerDepthMm:63}).installationStatus==="limited-check");
  check("depth below flags mount",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3,cabinetWidthMm:500,innerDepthMm:62.999}).installationStatus==="needs-review");
  const allArticles=Object.values(HAFELE_ARTICLES).flatMap((series)=>Object.values(series).flat());
  check("all article mappings",allArticles.length===36&&new Set(allArticles).size===36&&allArticles.every((article)=>/^\d{3}\.\d{2}\.\d{3}$/.test(article))&&!HAFELE_ARTICLES["1.8-push"]["F pto"]);
  check("article catalog samples",HAFELE_ARTICLES["1.11"].B[0]==="372.27.700"&&HAFELE_ARTICLES["1.11"].F[3]==="372.27.304"&&HAFELE_ARTICLES["1.8-push"]["E pto"][3]==="372.27.308");
  check("color only changes article",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3,color:"white"}).candidates[0].minMassKg===calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3,color:"black"}).candidates[0].minMassKg);
  const mass=estimateHafeleMass({frontHeightMm:1000,frontWidthMm:3e6/(15.1*1000),material:"chipboard",handleMassKg:.1});
  check("estimated mass adds two handles",mass.status==="estimated"&&mass.selectionMassKg===3.2&&mass.handleCountBySourceDiagram===2);
  check("manual mass is not augmented",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:3.2}).selectionMassKg===3.2);
  check("mass below table has distinct explanation",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:1.19}).errorText==="Масса ниже диапазона моделей в предоставленной таблице");
  check("mass above table has distinct explanation",calculateHafele({series:"1.11",cabinetHeightMm:400,selectionMassKg:10.700001}).errorText==="Масса выше диапазона моделей в предоставленной таблице");
  check("unknown coefficient refused",estimateHafeleMass({frontHeightMm:1000,frontWidthMm:1000,material:"unknown",handleMassKg:0}).status==="invalid");
  check("X for Y19/top16",getHafeleDimensionX({frontThicknessMm:19,topPanelThicknessMm:16}).xMm===107);
  check("X for intermediate Y unavailable",getHafeleDimensionX({frontThicknessMm:20,topPanelThicknessMm:16}).status==="not-in-table");
  check("X unavailable if top not 16",getHafeleDimensionX({frontThicknessMm:19,topPanelThicknessMm:18}).status==="not-in-table");
  for(const [series,data] of Object.entries(HAFELE_SERIES)){
    for(const [height,row] of Object.entries(data.rows)){
      for(const [model,range] of Object.entries(row)){
        const below=calculateHafele({series,cabinetHeightMm:Number(height),selectionMassKg:range.minMassKg-0.000001});
        const atMin=calculateHafele({series,cabinetHeightMm:Number(height),selectionMassKg:range.minMassKg});
        const atMax=calculateHafele({series,cabinetHeightMm:Number(height),selectionMassKg:range.maxMassKg});
        const above=calculateHafele({series,cabinetHeightMm:Number(height),selectionMassKg:range.maxMassKg+0.000001});
        check(`range lower inclusive ${series}/${height}/${model}`,atMin.candidates.some((item)=>item.model===model));
        check(`range upper inclusive ${series}/${height}/${model}`,atMax.candidates.some((item)=>item.model===model));
        check(`range excludes below ${series}/${height}/${model}`,!below.candidates.some((item)=>item.model===model));
        check(`range excludes above ${series}/${height}/${model}`,!above.candidates.some((item)=>item.model===model));
      }
    }
  }
  return {ok:checks.every((item)=>item.ok),checks};
}
