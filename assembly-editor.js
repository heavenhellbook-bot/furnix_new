import { mountTechTemplates } from './tech-data/assembly-adapter.mjs';
import { mountDrawerCalculator } from './drawer-calculator-ui.js';
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  validLayout, layoutParts, layoutIssues, newLayout, splitOpening, setOpeningSize,
  openingAt, snapPanelCenter, insertPanel, resolveLayout, cabinetInterior, mountSketchMode,
  panelAt, panelRegion, movePanel, removePanel, parseSketchCommand, planSketchCommand,
} from "./sketch-mode.js?v=6";
import { createUndoHistory } from "./project-history.js?v=1";
import { viewPresets, viewFrustum, viewCameraPosition } from "./view-presets.js?v=1";
import { mountLiftCalculator } from "./lift-calculator.js?v=7";

const byId = (id) => document.getElementById(id);
const viewport = byId("viewport");
const sidebar = document.querySelector("main > aside");
const colors = { oak: 0xc49a62, white: 0xe6e9ea, graphite: 0x525b66, hdf: 0x9eaaad };
const hardwareCategories = new Set(["case-joint", "back-panel", "shelf-support", "reinforcement"]);
const hardwareCategoryLabels = {
  "case-joint": "Корпусное соединение",
  "back-panel": "Крепёж задней стенки",
  "shelf-support": "Полкодержатель",
  reinforcement: "Усиливающий уголок",
};
const hardwareTypes = [
  ["confirmat", "Конфирмат"],
  ["dowel", "Шкант"],
  ["minifix", "Minifix"],
  ["rafix", "Rafix"],
  ["screw", "Саморез"],
  ["angle-bracket", "Уголок"],
];
const hardwareTypeLabels = Object.fromEntries(hardwareTypes);
const products = [];
let selected = { productId: null, partId: null, connectionId: null, hardwareComponentId: null };
let serial = 0;
let hardwareDraft = false;
let pendingExternalCsv = null;
let externalCsvFile = null;
let voiceRecognition = null;
// Finishes the current recording by hand when the browser never sends the "end" event.
let voiceFinish = null;
let voiceDraft = null;
let voiceSetDraft = null;
let voiceSetPreviewBoxes = [];
let latestAssemblyAnalysis = { issues: [], order: [], ranks: new Map(), zones: [] };
let latestProjectIssues = [];
let availableConstructionChanges = [];
let constructionChangeNotice = "";
const libraryStorageKey = "furnix.personal-module-library.v1";
// Catalog codes: the legacy oak/white/graphite/hdf plus any user code of Latin letters, digits, "-" and "_".
// Back panels always use "hdf"; thickness 0 means "not set", color is the 3D display color.
const materialCodePattern = /^[a-z0-9_-]{1,40}$/;
const materialColorPattern = /^#[0-9a-f]{6}$/i;
const defaultMaterialCatalog = () => [
  { code: "oak", name: "Дуб натуральный ЛДСП", unit: "лист", currency: "", supplier: "", price: "", priceSource: "", priceDate: "", priceValidUntil: "", priceStatus: "needs-review", grain: "directional" },
  { code: "white", name: "Белый ЛДСП", unit: "лист", currency: "", supplier: "", price: "", priceSource: "", priceDate: "", priceValidUntil: "", priceStatus: "needs-review", grain: "directional" },
  { code: "graphite", name: "Графит ЛДСП", unit: "лист", currency: "", supplier: "", price: "", priceSource: "", priceDate: "", priceValidUntil: "", priceStatus: "needs-review", grain: "directional" },
  { code: "hdf", name: "ХДФ", unit: "лист", currency: "", supplier: "", price: "", priceSource: "", priceDate: "", priceValidUntil: "", priceStatus: "needs-review", grain: "none" },
];
const defaultSupplierProfile = (overrides = {}) => ({
  id: "viyarpro-ua",
  name: "ВИЯР / ViyarPro",
  country: "Украина",
  orderChannel: "ViyarPro",
  status: "needs-confirmation",
  services: ["Раскрой плит", "Кромление", "Фрезеровка", "Присадка"],
  acceptedFormats: [
    "CSV: фиксированный порядок из 10 полей для ViyarPro",
    "БАЗИС через Bazis2Viyar; опубликованная ссылка загрузки сейчас недоступна",
  ],
  lastVerifiedAt: "",
  sources: [
    "https://viyar.ua/ua/catalog/uslugi/",
    "https://www.viyar.pro/service/doc/?cid=dsp&s=intro",
    "https://www.viyar.pro/service/doc/?cid=dsp&s=details-import",
    "https://www.viyar.pro/service/doc/?cid=dsp&s=import-export",
    "https://www.viyar.pro/service/doc/?cid=dsp&s=cost",
    "https://www.viyar.pro/service/doc/?cid=dsp&s=limitations",
    "https://viyar.ua/ua/downloads/",
  ],
  ...overrides,
});
const defaultCollisionSettings = () => ({
  doorOpenAngle: 95,
  singleDoorHinge: "left",
  drawerExtension: 400,
  angularStep: 5,
  linearStep: 25,
  clearance: 10,
  toolAccessDepth: 100,
  toolAccessWidth: 80,
  showSweptEnvelope: true,
});
const defaultAssemblyPlan = () => ({ operations: [] });
let projectResources = {
  id: `project-${Date.now()}`,
  revision: 0,
  history: [],
  cutSettings: { trim: 10, minRemnant: 300, machineLength: 0, machineWidth: 0 },
  collisionSettings: defaultCollisionSettings(),
  environmentZones: [],
  assemblyPlan: defaultAssemblyPlan(),
  supplierProfile: defaultSupplierProfile(),
  estimates: [],
  liftCalculations: [],
  liftSpecificationItems: [],
  remnants: [],
  materials: defaultMaterialCatalog(),
};

const styles = document.createElement("style");
styles.textContent = `
  #assembly-panel{border:1px solid #344a63;border-radius:10px;background:#111c2c;padding:12px;margin:12px 0 18px}
  #assembly-panel h2{margin:4px 0 10px}
  #input-source-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:8px 0}
  #input-source-tabs button{font-size:11px;padding:7px 5px}
  #input-source-tabs button[aria-selected="true"]{border-color:#79d3c0;background:#24453f}
  .input-source-panel{border:1px solid #344a63;border-radius:8px;padding:9px;margin:7px 0 12px}
  .input-source-panel[hidden]{display:none}
  .input-source-panel h3{margin:2px 0 7px;font-size:12px;color:#c5d6d3}
  .source-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px}
  .source-actions button{font-size:10px;padding:7px 5px}
  #library-template-form{border-top:1px solid #344258;margin-top:8px;padding-top:7px}
  #library-template-form label,#external-csv-unit-label{font-size:11px;margin:6px 0}
  #library-template-form input,#external-csv-unit{padding:7px;font-size:12px}
  #library-template-form button,#external-csv-import,#external-csv-sample{width:100%;margin-top:5px}
  #library-template-list{display:grid;gap:4px;margin-top:7px}
  .library-template-row{display:flex;align-items:center;gap:4px}
  .library-template-row button{font-size:10px;padding:6px}
  .library-template-row button:first-child{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis}
  .library-template-delete{flex:0 0 auto}
  #external-csv-file{padding:7px;font-size:11px}
  #external-source-reference{padding:7px;font-size:12px}
  #external-csv-status{white-space:pre-line;font-size:11px;line-height:1.45;margin:6px 0}
  #external-csv-preview{max-height:150px;overflow:auto}
  #external-csv-preview table{font-size:10px}
  #external-csv-preview th,#external-csv-preview td{padding:5px 3px}
  #external-source-links{display:grid;gap:4px;margin:7px 0}
  #external-source-links a{color:#8ed4c1;font-size:11px}
  #viyar-source-links{display:grid;gap:4px;margin:7px 0}
  #viyar-source-links a{color:#8ed4c1;font-size:11px}
  #viyar-export-panel button{width:100%;margin-top:5px}
  #viyar-export-group{padding:7px;font-size:12px}
  #assembly-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  #assembly-actions button,#assembly-tree button{font-size:11px;padding:7px}
  #project-self-check-report{max-height:240px;overflow:auto;white-space:pre-wrap;font-size:11px;line-height:1.45;margin:6px 0}
  #project-self-check-report:empty{display:none}
  #project-self-check-report.error{color:#ffb2a9}
  #project-self-check-report.valid{color:#8ce0bb}
  #assembly-connection-form{border-top:1px solid #344258;margin-top:8px;padding-top:8px}
  #assembly-connection-form button{width:100%;margin-top:7px}
  #assembly-connection-note{font-size:11px;color:#ffcf91;line-height:1.45}
  #assembly-hardware-form{border-top:1px solid #344258;margin-top:8px;padding-top:8px}
  #assembly-hardware-form button{width:100%;margin-top:7px}
  #resource-settings{border-top:1px solid #344258;margin-top:8px;padding-top:8px;font-size:11px}
  #resource-settings summary{cursor:pointer;color:#a8bed6;font-weight:600}
  #resource-settings textarea{display:block;width:100%;margin-top:6px;padding:7px;background:#0f1a2b;color:#f6f8ff;border:1px solid #40526c;border-radius:8px}
  #sketch-panel{border:1px solid #344a63;border-radius:8px;padding:8px;margin:10px 0;background:#132235}
  #sketch-panel h3{margin:2px 0 6px;font-size:13px}
  #sketch-panel .sketch-row{display:flex;flex-wrap:wrap;gap:5px;align-items:flex-end;margin:6px 0}
  #sketch-panel .sketch-row label{flex:1 1 70px;margin:0;font-size:11px}
  #sketch-panel button{width:auto!important;font-size:11px;padding:6px 8px}
  #sketch-panel [aria-checked="true"]{background:#1d98c8;color:#071622}
  #material-catalog{overflow-x:auto}
  #material-add{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;margin:8px 0;font-size:11px}
  #material-add strong,#material-add .note{flex-basis:100%}
  #material-add label{margin:0}
  #material-add button{width:auto!important}
  #material-catalog table{min-width:1000px}
  #resource-form button{width:100%;margin-top:6px}
  #supplier-profile,#estimate-panel{border:1px solid #344a63;border-radius:8px;padding:9px;margin:9px 0}
  #supplier-profile h3,#estimate-panel h3{margin:3px 0 7px;font-size:12px}
  #supplier-profile p,#estimate-panel p{font-size:11px;line-height:1.45}
  #supplier-profile .unverified{color:#ffcf91}
  #estimate-panel button{width:100%;margin-top:6px}
  #estimate-history{display:grid;gap:6px;margin-top:8px}
  .estimate-row{border:1px solid #344258;border-radius:6px;padding:7px;font-size:10px}
  .estimate-row strong{display:block;color:#dce7ea}
  .estimate-row button{width:auto!important}
  .estimate-row label{display:inline-flex;align-items:center;gap:4px;margin:4px 8px 0 0}
  #estimate-archive{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;font-size:11px}
  #estimate-archive button{width:auto!important}
  #estimate-archive label{display:inline-flex;align-items:center;gap:4px;margin:0}
  #collision-settings{border:1px solid #344a63;border-radius:10px;background:#111c2c;padding:12px;margin:12px 0}
  #collision-settings summary{cursor:pointer;color:#a8bed6;font-weight:600}
  #collision-settings label{font-size:11px;margin:7px 0}
  #collision-settings input,#collision-settings select{padding:7px;font-size:12px}
  #collision-settings .collision-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}
  #collision-settings button{width:100%;margin-top:6px}
  #environment-zone-list{display:grid;gap:5px;margin:8px 0}
  .environment-zone-row{display:flex;align-items:center;gap:5px;padding:6px;border:1px solid #344258;border-radius:6px;font-size:10px}
  .environment-zone-row span{flex:1;min-width:0;overflow-wrap:anywhere}
  .environment-zone-row button{width:auto;margin:0;padding:5px 7px}
  #collision-report{max-height:240px;overflow:auto;white-space:pre-wrap;font-size:11px;line-height:1.45}
  #collision-report.error{color:#ffb2a9}
  #collision-report.valid{color:#8ce0bb}
  #assembly-plan{border:1px solid #344a63;border-radius:10px;background:#111c2c;padding:12px;margin:12px 0}
  #assembly-plan summary{cursor:pointer;color:#a8bed6;font-weight:600}
  #assembly-plan label{font-size:11px;margin:7px 0}
  #assembly-plan input,#assembly-plan select{padding:7px;font-size:12px}
  #assembly-plan .plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}
  #assembly-plan button{width:100%;margin-top:6px}
  #assembly-plan-dependencies{min-height:70px}
  #assembly-plan-graph{display:block;width:auto;max-width:none;max-height:420px;overflow:auto;background:#0d1722;border-radius:7px;margin:8px 0}
  #assembly-plan-graph text{font-family:Inter,system-ui,Arial,sans-serif}
  #assembly-plan-report{max-height:220px;overflow:auto;white-space:pre-wrap;font-size:11px;line-height:1.45}
  #assembly-plan-report.error{color:#ffb2a9}
  #assembly-plan-report.valid{color:#8ce0bb}
  #assembly-change-options{display:grid;gap:7px;margin:9px 0}
  .construction-change{border:1px solid #536149;border-radius:7px;padding:8px;font-size:11px}
  .construction-change strong{display:block;color:#e3eecf;margin-bottom:4px}
  .construction-change p{margin:4px 0;line-height:1.45}
  .construction-change .change-impact{color:#c1d2d3}
  .construction-change button{width:auto;padding:6px 9px}
  #assembly-plan-operations{display:grid;gap:7px;margin:8px 0}
  .assembly-operation{border:1px solid #344258;border-radius:7px;padding:7px;font-size:10px}
  .assembly-operation strong{display:block;color:#dce7ea}
  .assembly-operation select{margin-top:5px;min-height:58px}
  .assembly-operation button{width:auto;padding:4px 7px;font-size:10px}
  #material-catalog{overflow:auto}
  #material-catalog table{font-size:10px}
  #material-catalog input,#material-catalog select{min-width:78px;padding:5px;font-size:10px}
  #price-lists{border-top:1px solid #344a63;margin-top:10px;padding-top:6px}
  #price-lists code{font-size:10px}
  #price-list-sources,#price-list-status{white-space:pre-line;font-size:11px}
  #price-list-results{max-height:340px;overflow:auto}
  #price-list-results table{font-size:10px;width:100%}
  #price-list-results td,#price-list-results th{padding:3px 4px;vertical-align:top;text-align:left}
  #price-list-results select,#price-list-results button{font-size:10px;padding:3px;width:auto;margin:1px 0}
  #resource-status{white-space:pre-line}
  #voice-input{border:1px solid #344a63;border-radius:10px;background:#111c2c;padding:12px;margin:12px 0}
  #voice-input label[hidden]{display:none}
  #voice-input textarea{display:block;width:100%;min-height:90px;margin-top:6px;padding:8px;background:#0f1a2b;color:#f6f8ff;border:1px solid #40526c;border-radius:8px}
  #voice-input .voice-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}
  #voice-input .voice-grid input,#voice-input .voice-grid select{padding:7px;font-size:12px}
  #voice-input .voice-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  #voice-input .voice-actions button{width:auto;margin:0}
  #voice-input-questions{white-space:pre-line}
  #voice-input-questions.error{color:#ffcf91}
  #voice-input-provenance{white-space:pre-line}
  #voice-input-status{white-space:pre-line}
  #voice-input .voice-set-module{border:1px solid #344a63;border-radius:8px;padding:6px 8px;margin:8px 0}
  #voice-input .voice-set-module legend{font-size:12px;color:#9fc4e8;padding:0 4px}
  #voice-input .voice-set-module input[readonly]{opacity:.7}
  #voice-set-questions,#voice-set-assumptions,#voice-set-preview,#voice-set-provenance{white-space:pre-line}
  #voice-set-questions.error{color:#ffcf91}
  .voice-set-notes{white-space:pre-line;color:#ffcf91;font-size:11px;margin:4px 0}
  #assembly-tree{max-height:230px;overflow:auto;margin:9px 0}
  #furniture-set{border:1px solid #344258;border-radius:8px;padding:10px;margin:10px 0}
  #furniture-set h3{margin:0 0 6px}
  #furniture-set-list{max-height:150px;overflow:auto}
  .furniture-set-module{display:block;width:100%;text-align:left;margin:3px 0;font-size:11px}
  .furniture-set-module.selected{border-color:#48c8f2;background:#18405a}
  #furniture-set-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:8px}
  #furniture-set-controls button{font-size:11px;padding:6px}
  #furniture-set-spec{max-height:210px;overflow:auto;margin-top:8px;font-size:10px}
  #furniture-set-spec table{width:100%;border-collapse:collapse}
  #furniture-set-spec th,#furniture-set-spec td{padding:3px;border-bottom:1px solid #344258;text-align:left}
  #furniture-set-warnings{white-space:pre-line}
  .assembly-node{display:block;width:100%;text-align:left;margin:3px 0}
  .assembly-node.selected{border-color:#48c8f2;background:#18405a}
  .assembly-node.assembly-node-warning{color:#ffcf91;border-color:#a8742f}
  .assembly-child{margin-left:13px!important;width:calc(100% - 13px)!important;color:#bdcbe0}
  #assembly-editor{border-top:1px solid #344258;margin-top:10px;padding-top:8px}
  #assembly-editor label{font-size:11px;margin:7px 0}
  #assembly-editor input,#assembly-editor select{padding:7px;font-size:12px}
  #assembly-message{font-size:11px;line-height:1.45;margin:8px 0 2px;color:#a8bed6;white-space:pre-line}
  #assembly-message.error{color:#ffb2a9}
  #assembly-message.valid{color:#8ce0bb}
  #assembly-canvas{display:block;width:100%;height:100%;touch-action:none}
  @media(max-width:680px){#assembly-tree{max-height:180px}}
`;
document.head.append(styles);

const panel = document.createElement("section");
panel.id = "assembly-panel";
panel.innerHTML = `
  <h2>Проект и дерево деталей</h2>
  <div id="input-source-tabs" role="tablist" aria-label="Способы получения элементов">
    <button type="button" id="source-tab-library" role="tab" aria-selected="true" aria-controls="source-panel-library">Моя библиотека</button>
    <button type="button" id="source-tab-external" role="tab" aria-selected="false" aria-controls="source-panel-external">Внешний ввод</button>
  </div>
  <section class="input-source-panel" id="source-panel-library" role="tabpanel" aria-labelledby="source-tab-library">
    <h3>Параметрические модули FURNIX</h3>
    <p class="note">Выберите модуль и настройте его параметры после добавления в проект.</p>
    <div class="source-actions">
      <button type="button" data-builtin-module="base">Нижний корпус</button>
      <button type="button" data-builtin-module="wall">Верхний корпус</button>
      <button type="button" data-builtin-module="tall">Пенал</button>
    </div>
    <details><summary>Шаблоны Tech Library</summary><div id="tech-template-list"></div></details>
    <h3 style="margin-top:10px">Личная библиотека</h3>
    <div id="library-template-list" aria-live="polite"></div>
    <form id="library-template-form">
      <label>Сохранить выбранный корпус как шаблон
        <input name="name" type="text" maxlength="80" placeholder="Например, тумба под мойку" required>
      </label>
      <button type="submit">Сохранить в мою библиотеку</button>
    </form>
    <p id="library-status" class="note" role="status">Шаблоны хранятся локально в этом браузере.</p>
  </section>
  <section class="input-source-panel" id="source-panel-external" role="tabpanel" aria-labelledby="source-tab-external" hidden>
    <h3>Получить данные из внешнего источника</h3>
    <p class="note">Откройте каталог, затем подготовьте таблицу параметров корпуса в CSV. Импорт создаёт параметрические изделия FURNIX по размерам из таблицы; исходная геометрия SketchUp напрямую не загружается.</p>
    <div id="external-source-links">
      <a href="https://3dwarehouse.sketchup.com/" target="_blank" rel="noopener noreferrer">SketchUp 3D Warehouse ↗</a>
      <a href="https://hettich.partcommunity.com/3d-cad-models/" target="_blank" rel="noopener noreferrer">Hettich CAD ↗</a>
      <a href="https://www.blum.com/eu/en/services/industrial-production/cad-cam-dataservice/" target="_blank" rel="noopener noreferrer">Blum CAD/CAM ↗</a>
    </div>
    <label id="external-csv-unit-label">Единицы размеров в файле
      <select id="external-csv-unit">
        <option value="mm">Миллиметры (мм)</option>
        <option value="cm">Сантиметры (см)</option>
        <option value="m">Метры (м)</option>
        <option value="in">Дюймы (in)</option>
      </select>
    </label>
    <label>Таблица корпусов CSV
      <input id="external-csv-file" type="file" accept=".csv,text/csv">
    </label>
    <label>Источник / ссылка
      <input id="external-source-reference" type="text" maxlength="240" placeholder="Например, SketchUp или URL модели">
    </label>
    <p class="note">Обязательные столбцы: name, width, height, depth. Необязательные: thickness, shelves, divider, back, color, doors, drawers. Допускаются русские названия столбцов. Все размеры переводятся в мм.</p>
    <button type="button" id="external-csv-sample">Скачать образец CSV</button>
    <p id="external-csv-status" class="note" role="status" aria-live="polite">Импортированные размеры станут параметрами FURNIX; 3D-форма корпуса будет построена по правилам конструктора.</p>
    <div id="external-csv-preview"></div>
    <label><input id="external-source-rights" type="checkbox" style="display:inline;width:auto;margin-right:6px">Подтверждаю право использовать эти данные</label>
    <button type="button" id="external-csv-import" disabled>Добавить корпуса в проект</button>
  </section>
  <section id="voice-input" aria-labelledby="voice-input-heading">
    <h3 id="voice-input-heading">Описание голосом</h3>
    <p class="note">MVP распознаёт только явные слова и числа по локальным правилам, это не ИИ-разбор. Для настоящего семантического разбора нужна отдельная ИИ-интеграция; сейчас её нет.</p>
    <p class="note">Распознавание речи предоставляет браузер и, в зависимости от его реализации, аудио может обрабатываться службой браузера. Разрешение ниже нужно включить перед записью. FURNIX не отправляет текст описания во внешние ИИ-сервисы.</p>
    <label><input id="voice-speech-consent" type="checkbox" style="display:inline;width:auto;margin-right:6px">Разрешаю браузеру распознавать речь; понимаю, что аудио может обрабатываться его службой</label>
    <div class="voice-actions">
      <button type="button" id="voice-record">Начать запись</button>
      <button type="button" id="voice-stop" disabled>Остановить</button>
      <button type="button" id="voice-clear">Очистить</button>
    </div>
    <p id="voice-input-status" class="note" role="status" aria-live="polite"></p>
    <label for="voice-transcript">Распознанный текст или ручной ввод</label>
    <p class="note">Если распознавание браузера не возвращает текст, можно продиктовать средствами Windows: щёлкните в поле ниже и нажмите Win+H, затем «Разобрать текст».</p>
    <textarea id="voice-transcript" maxlength="2000" placeholder="Например: Создай кухонный нижний шкаф шириной 800, высотой 720 и глубиной 560 мм. ЛДСП 18 мм, две двери и одна полка."></textarea>
    <div class="voice-actions">
      <button type="button" id="voice-parse">Разобрать текст</button>
      <button type="button" id="voice-parse-set">Разобрать как комплект</button>
    </div>
    <div id="voice-draft-fields" hidden>
      <p class="note">Проверьте и заполните параметры. Поля не распознаны — это не значения по умолчанию.</p>
      <div class="voice-grid">
        <label>Тип изделия
          <select id="voice-product-type">
            <option value="">Не указан</option>
            <option value="lower-cabinet">Нижний кухонный корпус</option>
            <option value="upper-cabinet">Верхний кухонный корпус</option>
            <option value="tall-cabinet">Пенал / высокий корпус</option>
            <option value="cabinet">Другое корпусное изделие</option>
          </select>
        </label>
        <label>Название изделия
          <input id="voice-name" maxlength="80">
        </label>
        <label>Ширина, мм
          <input id="voice-width" type="number" min="300" max="3000" step="any">
        </label>
        <label>Высота, мм
          <input id="voice-height" type="number" min="300" max="3000" step="any">
        </label>
        <label>Глубина, мм
          <input id="voice-depth" type="number" min="200" max="1200" step="any">
        </label>
        <label>Толщина плиты, мм
          <input id="voice-thickness" type="number" min="10" max="40" step="any">
        </label>
        <label>Материал корпуса
          <select id="voice-material">
            <option value="">Не указан</option>
            <option value="ldsp">ЛДСП</option>
            <option value="unsupported">Другой / не поддерживается моделью корпуса</option>
          </select>
        </label>
        <label>Декор / цвет
          <select id="voice-color">
            <option value="">Не указан</option>
            <option value="oak">Дуб натуральный</option>
            <option value="white">Белый</option>
            <option value="graphite">Графит</option>
          </select>
        </label>
        <label>Полки, шт.
          <input id="voice-shelves" type="number" min="0" max="12" step="1">
        </label>
        <label>Двери, шт.
          <input id="voice-doors" type="number" min="0" max="2" step="1">
        </label>
        <label>Ящики, шт.
          <input id="voice-drawers" type="number" min="0" max="4" step="1">
        </label>
        <label>Вертикальная перегородка
          <select id="voice-divider">
            <option value="">Не указано</option>
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </label>
        <label>Задняя стенка
          <select id="voice-back">
            <option value="">Не указано</option>
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </label>
        <label style="grid-column:1/-1">Названная фурнитура (не будет создана автоматически)
          <input id="voice-hardware" maxlength="300">
        </label>
      </div>
      <p id="voice-input-questions" class="error" role="status" aria-live="polite"></p>
      <label id="voice-units-confirm-label" hidden><input id="voice-units-confirm" type="checkbox" style="display:inline;width:auto;margin-right:6px">Проверил: значения в размерных полях указаны в миллиметрах</label>
      <label id="voice-hardware-confirm-label" hidden><input id="voice-hardware-confirm" type="checkbox" style="display:inline;width:auto;margin-right:6px">Подтверждаю: названная фурнитура останется заметкой и не попадёт в модель</label>
      <div class="voice-actions">
        <button type="button" id="voice-confirm" class="primary" disabled>Подтвердить и создать изделие</button>
      </div>
      <p id="voice-input-provenance" class="note" aria-live="polite"></p>
    </div>
    <div id="voice-set-draft" hidden>
      <p class="note">Черновик комплекта: разбор по локальным правилам без ИИ. Каждый модуль станет отдельным корпусом. Пустые поля не распознаны — это не значения по умолчанию. Проверки размещения предварительные и не подтверждают готовность к производству.</p>
      <div class="voice-grid">
        <label>Порядок размещения
          <select id="voice-set-direction">
            <option value="">Не указан</option>
            <option value="left-to-right">Слева направо</option>
            <option value="right-to-left">Справа налево</option>
          </select>
        </label>
        <label>Размещение
          <select id="voice-set-placement">
            <option value="row">В ряд по порядку (черновик)</option>
            <option value="manual">Вручную: X/Z каждого модуля</option>
          </select>
        </label>
      </div>
      <fieldset class="voice-set-module" id="voice-set-common">
        <legend>Общие значения (заполняют только пустые поля модулей)</legend>
        <div class="voice-grid" id="voice-set-common-fields"></div>
        <div class="voice-actions"><button type="button" id="voice-set-fill">Заполнить пустые поля модулей</button></div>
      </fieldset>
      <div id="voice-set-modules"></div>
      <div class="voice-actions"><button type="button" id="voice-set-add-module">+ Пустой модуль</button></div>
      <p id="voice-set-assumptions" class="note"></p>
      <p id="voice-set-preview" class="note" aria-live="polite"></p>
      <p id="voice-set-questions" class="error" role="status" aria-live="polite"></p>
      <label id="voice-set-units-confirm-label" hidden><input id="voice-set-units-confirm" type="checkbox" style="display:inline;width:auto;margin-right:6px">Проверил: размеры модулей указаны в миллиметрах</label>
      <label id="voice-set-notes-confirm-label" hidden><input id="voice-set-notes-confirm" type="checkbox" style="display:inline;width:auto;margin-right:6px">Подтверждаю: назначения модулей и названная фурнитура останутся заметками и не попадут в модель</label>
      <div class="voice-actions">
        <button type="button" id="voice-set-confirm" class="primary" disabled>Подтвердить и создать комплект</button>
      </div>
      <p id="voice-set-provenance" class="note" aria-live="polite"></p>
    </div>
  </section>
  <section class="input-source-panel" id="viyar-export-panel">
    <h3>Экспорт деталей в ViyarPro</h3>
    <p class="note">Формируется CSV по опубликованной схеме ВИЯР: длина, ширина, количество, верхняя/нижняя/левая/правая кромки, текстура, название, кратность. До импорта выберите в ViyarPro тот же материал и толщину. Отверстия и другие операции в этот CSV не входят. Ориентацию кромок подтвердите контрольным импортом.</p>
    <label>Группа материала и толщины
      <select id="viyar-export-group"></select>
    </label>
    <button type="button" id="viyar-export-csv">Скачать CSV для ViyarPro</button>
    <p id="viyar-export-status" class="note" role="status" aria-live="polite"></p>
    <div id="viyar-source-links">
      <a href="https://www.viyar.pro/service/doc/?cid=dsp&s=details-import" target="_blank" rel="noopener noreferrer">Инструкция и порядок столбцов ↗</a>
      <a href="https://www.viyar.pro/service/doc/?cid=dsp&s=import-export" target="_blank" rel="noopener noreferrer">Импорт/экспорт, включая Bazis2Viyar ↗</a>
      <a href="https://www.viyar.pro/service/doc/?cid=dsp&s=cost" target="_blank" rel="noopener noreferrer">Предварительный расчёт стоимости ↗</a>
      <a href="https://www.viyar.pro/service/doc/?cid=dsp&s=limitations" target="_blank" rel="noopener noreferrer">Производственные ограничения ↗</a>
    </div>
  </section>
  <div id="assembly-actions">
    <button type="button" id="assembly-add">+ Изделие</button>
    <button type="button" id="assembly-add-panel">+ Деталь</button>
    <button type="button" id="assembly-duplicate">Копировать</button>
    <button type="button" id="assembly-delete">Удалить</button>
    <button type="button" id="assembly-add-joint">+ Конфирмат</button>
    <button type="button" id="assembly-add-hardware">+ Крепёж</button>
    <button type="button" id="assembly-spec-csv">Спецификация CSV</button>
    <button type="button" id="assembly-parts-svg">Чертежи деталей SVG</button>
    <button type="button" id="assembly-assembly-svg">Схема сборки SVG</button>
    <button type="button" id="assembly-dxf">Контуры деталей DXF</button>
    <button type="button" id="project-self-check">Проверить проект</button>
  </div>
  <div id="project-self-check-report" class="note" role="status" aria-live="polite"></div>
  <details id="resource-settings">
    <summary>Раскрой, материалы и версии проекта</summary>
    <form id="resource-form">
      <label>Припуск по периметру листа, мм<input name="trim" type="number" min="0" max="100" step="1"></label>
      <label>Минимальный пригодный остаток (по каждой стороне), мм<input name="minRemnant" type="number" min="0" max="3000" step="1"></label>
      <label>Максимальная длина станка, мм (0 — не задана)<input name="machineLength" type="number" min="0" max="10000" step="1"></label>
      <label>Максимальная ширина станка, мм (0 — не задана)<input name="machineWidth" type="number" min="0" max="10000" step="1"></label>
      <label>Пригодные остатки: код материала, толщина, ширина, длина (мм; по одному на строку)
        <textarea name="remnants" rows="3" placeholder="oak,18,800,1200"></textarea>
      </label>
      <div id="material-catalog"></div>
      <section id="price-lists">
        <h3>Прайс-листы поставщиков</h3>
        <p class="note">Прайсы переводятся из xlsx командой <code>python tools/import_prices.py «папка с прайсами»</code> и хранятся в папке <code>prices/</code> проекта. Цены указаны на дату файла и получают статус «требует проверки»: FURNIX не сверяет их с поставщиком. Плиту из прайса можно назначить материалу каталога; кромка, фурнитура и остальные позиции пока доступны только для поиска и будут использованы в расчётах кромки и сметы.</p>
        <div id="price-list-sources" class="note"></div>
        <div class="price-list-controls">
          <label>Прайс-лист<select id="price-list-select"></select></label>
          <label>Поиск по артикулу, названию или группе<input id="price-list-search" type="search" maxlength="120" placeholder="например: ЛДСП 2800x2070x18 белый"></label>
        </div>
        <div id="price-list-results"></div>
        <p id="price-list-status" class="note" role="status" aria-live="polite"></p>
      </section>
      <label>История редакций проекта<select name="revision"></select></label>
      <button type="button" id="resource-save">Сохранить ресурсы и настройки</button>
      <button type="button" id="resource-restore">Восстановить выбранную редакцию</button>
      <button type="button" id="resource-optimize">Рассчитать раскрой</button>
      <button type="button" id="resource-cut-csv">Экспорт карты раскроя CSV</button>
      <section id="supplier-profile" aria-live="polite"></section>
      <section id="estimate-panel">
        <h3>Версии сметы</h3>
        <p>Создаётся снимок проекта, зафиксированных цен и свежего плана раскроя. Неизвестные стоимости и неподтверждённые правила будут явно отмечены.</p>
        <button type="button" id="estimate-create" class="primary">Создать версию сметы</button>
        <div id="estimate-status" class="note" role="status" aria-live="polite"></div>
        <div id="estimate-archive">
          <button type="button" id="estimate-select-all">Выбрать все</button>
          <button type="button" id="estimate-select-none">Снять выбор</button>
          <button type="button" id="estimate-archive-selected">Архивировать выбранные</button>
          <label><input type="checkbox" id="estimate-archive-remove"> Удалить из проекта после архивирования</label>
        </div>
        <div id="estimate-history" aria-live="polite"></div>
      </section>
    </form>
    <p id="resource-status" class="note">Цены и станочные ограничения не заданы до ввода пользователем.</p>
    <div id="resource-cut" class="layout"></div>
  </details>
  <details id="collision-settings" open>
    <summary>Проверка движения и сервисных зон</summary>
    <p class="note">Зоны задаются в координатах сборки, мм: X — ширина, Y — высота от пола, Z — глубина (передняя сторона обычно +Z). Проверка предварительная.</p>
    <div class="collision-grid">
      <label>Угол открытия фасада, °<input data-collision-setting="doorOpenAngle" type="number" min="0" max="180" step="1"></label>
      <label>Петли одностворчатого фасада
        <select data-collision-setting="singleDoorHinge"><option value="left">Слева</option><option value="right">Справа</option></select>
      </label>
      <label>Выдвижение ящика, мм<input data-collision-setting="drawerExtension" type="number" min="0" max="2000" step="10"></label>
      <label>Угловой шаг фасада, °<input data-collision-setting="angularStep" type="number" min="1" max="15" step="1"></label>
      <label>Линейный шаг ящика, мм<input data-collision-setting="linearStep" type="number" min="5" max="100" step="5"></label>
      <label>Зазор обнаружения столкновения, мм<input data-collision-setting="clearance" type="number" min="0" max="100" step="1"></label>
      <label>Доступ инструмента к крепежу, глубина, мм<input data-collision-setting="toolAccessDepth" type="number" min="0" max="1000" step="5"></label>
      <label>Ширина зоны доступа к крепежу, мм<input data-collision-setting="toolAccessWidth" type="number" min="0" max="500" step="5"></label>
    </div>
    <label><input data-collision-setting="showSweptEnvelope" type="checkbox" style="display:inline;width:auto;margin-right:6px">Показывать огибающие движения в 3D</label>
    <form id="environment-zone-form">
      <h3>Добавить объёмную зону</h3>
      <label>Название<input name="name" maxlength="80" placeholder="Например, духовка или труба" required></label>
      <div class="collision-grid">
        <label>Тип
          <select name="type">
            <option value="appliance">Техника / препятствие</option>
            <option value="pipe">Труба / коммуникация</option>
            <option value="ventilation">Вентиляционный зазор</option>
            <option value="service">Зона обслуживания</option>
          </select>
        </label>
        <label>Центр X, мм<input name="x" type="number" step="1" required></label>
        <label>Центр Y, мм<input name="y" type="number" step="1" required></label>
        <label>Центр Z, мм<input name="z" type="number" step="1" required></label>
        <label>Размер X, мм<input name="width" type="number" min="1" step="1" required></label>
        <label>Размер Y, мм<input name="height" type="number" min="1" step="1" required></label>
        <label>Размер Z, мм<input name="depth" type="number" min="1" step="1" required></label>
      </div>
      <button type="submit">Добавить зону</button>
    </form>
    <div id="environment-zone-list" aria-live="polite"></div>
    <button type="button" id="collision-check" class="primary">Проверить сборку</button>
    <div id="collision-report" class="note" role="status" aria-live="polite"></div>
  </details>
  <details id="assembly-plan" open>
    <summary>Граф сборочных операций</summary>
    <p class="note">Зависимости задают порядок. Для каждой операции можно выбрать целевую деталь, направление подхода и габариты монтажной зоны.</p>
    <button type="button" id="assembly-plan-generate">Создать черновой граф для всех изделий</button>
    <form id="assembly-operation-form">
      <h3>Добавить операцию</h3>
      <label>Название операции<input name="name" maxlength="100" placeholder="Например, установить полку" required></label>
      <div class="plan-grid">
        <label>Изделие<select name="productId" required></select></label>
        <label>Целевая деталь<select name="targetPartId" required></select></label>
        <label>Тип
          <select name="kind">
            <option value="install">Установка детали</option>
            <option value="fasten">Крепление / монтаж</option>
            <option value="inspect">Контроль операции</option>
          </select>
        </label>
        <label>Направление подхода
          <select name="approach">
            <option value="front">Спереди (+Z)</option>
            <option value="back">Сзади (-Z)</option>
            <option value="left">Слева (-X)</option>
            <option value="right">Справа (+X)</option>
            <option value="top">Сверху (+Y)</option>
            <option value="bottom">Снизу (-Y)</option>
          </select>
        </label>
        <label>Ход / длина доступа, мм<input name="travel" type="number" min="0" max="2000" value="150" step="5" required></label>
        <label>Ширина монтажной зоны, мм<input name="accessWidth" type="number" min="1" max="1000" value="100" step="5" required></label>
        <label>Высота монтажной зоны, мм<input name="accessHeight" type="number" min="1" max="1000" value="100" step="5" required></label>
      </div>
      <label>Предшествующие операции (Ctrl/⌘ для нескольких)
        <select id="assembly-plan-dependencies" name="dependsOn" multiple></select>
      </label>
      <button type="submit">Добавить в граф</button>
    </form>
    <div id="assembly-plan-operations"></div>
    <svg id="assembly-plan-graph" role="img" aria-label="Граф зависимостей сборочных операций"></svg>
    <button type="button" id="assembly-plan-check" class="primary">Проверить физический порядок</button>
    <div id="assembly-plan-report" class="note" role="status" aria-live="polite"></div>
    <div id="assembly-change-options" aria-live="polite"></div>
  </details>
  <div id="assembly-tree" role="tree" aria-label="Изделия и детали проекта"></div>
  <section id="furniture-set" aria-labelledby="furniture-set-heading">
    <h3 id="furniture-set-heading">Мебельный комплект</h3>
    <p class="note">Комплект собирается из отдельных параметрических корпусов. X/Z — положение центра корпуса, Y — смещение основания от пола; размеры и координаты указаны в мм. Выбирайте модули здесь или в дереве; импорт CSV и библиотека также добавляют их в проект.</p>
    <div id="furniture-set-list" aria-label="Корпуса комплекта"></div>
    <div id="furniture-set-selected" class="note" aria-live="polite"></div>
    <div id="furniture-set-controls">
      <button type="button" data-set-move="left">← 100 мм</button>
      <button type="button" data-set-move="front">Вперёд +Z</button>
      <button type="button" data-set-move="right">100 мм →</button>
      <button type="button" data-set-move="back">Назад −Z</button>
      <button type="button" data-set-floor>На пол (Y=0)</button>
      <button type="button" data-set-rotate>Поворот 90°</button>
      <button type="button" data-set-duplicate>Дублировать</button>
      <button type="button" data-set-delete>Удалить</button>
      <button type="button" data-set-spec-export>Экспорт спецификации</button>
    </div>
    <div id="furniture-set-warnings" class="note" role="status" aria-live="polite"></div>
    <div id="furniture-set-spec"></div>
  </section>
  <div id="assembly-editor"></div>
  <p id="assembly-message" role="status">Проверка геометрии проекта</p>
`;
sidebar.prepend(panel);
document.querySelector("header span").textContent = "· прототип v0.3 · корпусная мебель";
document.querySelector("aside.right .notice").textContent =
  "FURNIX — прототип для проектирования корпусной мебели. Раскрой и производственная обработка требуют проверки.";

const windowStyle = document.createElement("style");
windowStyle.textContent = `
  body{min-height:max(100vh,670px);height:max(100vh,670px);display:grid;grid-template-rows:54px 36px 42px 36px minmax(300px,1fr) 206px 32px;overflow:auto;background:#101820;color:#e8edf0}
  body>header{height:54px;padding:0 18px;background:#18242b;border-color:#35434a}
  body>header strong{color:#8ed4c1}
  #window-menu,#command-toolbar{display:flex;align-items:center;gap:5px;padding:0 12px;background:#202d33;border-bottom:1px solid #35434a;min-width:0}
  #window-menu{z-index:10;overflow:visible}
  .window-menu{position:relative;height:100%;display:flex;align-items:center}
  .window-menu summary{list-style:none;cursor:pointer;padding:7px 10px;border-radius:4px;color:#d9e2e4;font-size:12px}
  .window-menu summary::-webkit-details-marker{display:none}
  .window-menu[open] summary,.window-menu summary:hover{background:#34464a;color:#fff}
  .menu-items{position:absolute;top:31px;left:0;z-index:20;min-width:205px;padding:5px;background:#202d33;border:1px solid #53646a;box-shadow:0 8px 20px #0008}
  .menu-items button{display:block;width:100%;text-align:left;border:0;border-radius:3px;background:transparent;padding:8px 10px;font-size:12px;font-weight:500}
  .menu-items button:hover{background:#344b4c}
  #command-toolbar{gap:7px;background:#18242b}
  #command-toolbar button{padding:7px 11px;border-radius:4px;font-size:12px}
  #app-tabs{display:flex;align-items:stretch;gap:4px;padding:3px 12px;background:#1c292e;border-bottom:1px solid #35434a}
  #app-tabs button{border-radius:4px 4px 0 0;padding:6px 14px;font-size:12px}
  #app-tabs button[aria-selected="true"]{background:#31524b;border-color:#79d3c0;color:#fff}
  #lift-page{display:none;position:fixed;z-index:8;top:168px;right:0;bottom:32px;left:0;overflow:auto;padding:24px;background:#172126}
  body.lift-active #lift-page{display:block}
  body.lift-active main,body.lift-active #parameter-dock,body.lift-active #status-bar{visibility:hidden}
  .lift-card{max-width:980px;margin:0 auto;border:1px solid #435950;border-radius:12px;background:#202c32;padding:24px;color:#e8edf0}
  .lift-card [hidden]{display:none!important}
  .hafele-candidate{border-top:1px solid #42534b;padding:8px 0}.hafele-candidate h3{color:#9ce2c4;margin:4px 0}.lift-card h2{color:#a8d7c8;margin:10px 0}
  .lift-card h1{margin:0 0 8px;color:#a8d7c8;font-size:24px}
  .lift-intro,.lift-card p{line-height:1.55;color:#c4d1ce}
  .lift-grid{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:4px 16px;margin:22px 0}
  .lift-grid label{font-size:13px}
  .lift-result{min-height:70px;border:1px solid #465750;border-radius:8px;padding:14px;background:#182329}
  .lift-result.calculated{border-color:#568b72}.lift-result.invalid,.lift-result.no-match{border-color:#a87454;color:#ffcfad}
  .lift-result dl{display:grid;grid-template-columns:minmax(150px,230px) 1fr;gap:8px 16px;margin:0}
  .lift-result dt{color:#a9bbb5}.lift-result dd{margin:0;color:#eff5f2}.lift-result small{color:#b0c0ba;font-size:11px}
  .lift-result .lift-force{font-size:18px;font-weight:700;color:#9ce2c4}
  .lift-method{margin-top:18px;border-top:1px solid #435950;padding-top:14px}.lift-method summary{cursor:pointer;color:#a8d7c8;font-weight:600}
  .lift-table-wrap{overflow-x:auto;margin-top:12px}.lift-method table{min-width:540px}.lift-method td,.lift-method th{text-align:center;padding:8px}
  .lift-unverified{border-left:3px solid #c39155;padding-left:10px;color:#ffcfad!important}
  #document-title{margin-left:auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c2d0d1;font-size:12px}
  main{display:grid;min-height:0;height:auto;grid-template-columns:250px minmax(300px,1fr) 330px;grid-template-rows:minmax(0,1fr);overflow:hidden}
  main>aside{min-width:0;min-height:0;padding:12px;background:#202c32;border-color:#35434a;overflow:auto}
  main>aside.right{border-left:1px solid #35434a}
  .stage{min-width:0;min-height:0;background:radial-gradient(circle at 50% 42%,#344b4c,#121b20 72%)}
  #viewport{inset:0}
  #parameter-dock{height:206px;min-height:0;overflow:auto;padding:8px 14px 12px;background:#202b30;border-top:1px solid #52605f}
  #parameter-dock h2{margin:2px 0 7px;color:#a8c8bc}
  #parameter-fields{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:0 12px;align-items:start}
  #parameter-dock label{margin:5px 0;font-size:11px}
  #parameter-dock input,#parameter-dock select{margin-top:4px;padding:7px;border-radius:4px;background:#121d21;border-color:#52605f}
  #parameter-dock .btns{grid-column:1/-1;margin:7px 0 0}
  #parameter-dock button{border-radius:4px}
  #status-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;overflow:hidden;padding:0 12px;background:#172126;border-top:1px solid #35434a;font-size:11px}
  #status-bar #status-errors,#status-bar #status-geometry{min-width:0;overflow:hidden}
  #status-bar #errors,#status-bar #assembly-message{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #status-bar #errors{color:#ffb2a9}
  #status-bar #assembly-message{flex:1;text-align:right}
  #status-bar #assembly-message{max-width:100%;min-width:0}
  #status-bar #assembly-message.error{color:#ffb2a9}
  #status-bar #assembly-message.valid{color:#8ce0bb}
  body.left-hidden main{grid-template-columns:minmax(300px,1fr) 330px}
  body.left-hidden main>.stage{grid-column:1}
  body.left-hidden main>.right{grid-column:2}
  body.right-hidden main{grid-template-columns:250px minmax(300px,1fr)}
  body.right-hidden main>.stage{grid-column:2}
  body.left-hidden.right-hidden main{grid-template-columns:minmax(0,1fr)}
  body.left-hidden.right-hidden main>.stage{grid-column:1}
  body.parameters-hidden{grid-template-rows:54px 36px 42px minmax(300px,1fr) 0 32px}
  main>.is-hidden{display:none!important}
  @media(max-width:1080px){main{grid-template-columns:220px minmax(260px,1fr) 290px}#parameter-fields{grid-template-columns:repeat(4,minmax(120px,1fr))}}
  @media(max-width:820px){
    body{min-height:max(100vh,578px);height:max(100vh,578px);grid-template-rows:50px 36px 40px 36px minmax(230px,1fr) 190px 32px}
    body.parameters-hidden{grid-template-rows:50px 36px 40px 36px minmax(230px,1fr) 0 32px}
    body>header{height:50px}
    #window-menu,#command-toolbar{padding-left:7px;padding-right:7px}
    #app-tabs{padding-left:7px}
    #lift-page{top:162px;padding:12px}
    #window-menu{overflow-x:auto}
    #command-toolbar button{padding:6px 8px}
    #document-title{max-width:30%}
    main,body.left-hidden main,body.right-hidden main,body.left-hidden.right-hidden main{position:relative;height:100%;grid-template-columns:minmax(0,1fr)}
    main>aside,main>aside.right{display:none;position:absolute;z-index:5;top:0;bottom:0;width:min(88vw,320px);box-shadow:0 0 24px #0009}
    body.show-left main>.workspace-sidebar{display:block!important;left:0}
    body.show-right main>.right{display:block!important;right:0}
    main>.stage,body.left-hidden main>.stage,body.right-hidden main>.stage,body.left-hidden.right-hidden main>.stage{grid-column:1}
    #parameter-dock{height:190px}
    #parameter-fields{grid-template-columns:repeat(3,minmax(105px,1fr))}
  }
  @media(max-width:520px){#parameter-fields{grid-template-columns:repeat(2,minmax(105px,1fr))}#document-title{display:none}#command-toolbar button{font-size:11px}#status-bar{font-size:10px}.lift-card{padding:16px}.lift-grid{grid-template-columns:1fr}.lift-result dl{grid-template-columns:1fr;gap:3px}.lift-result dd{margin-bottom:8px}}
`;
document.head.append(windowStyle);

const main = document.querySelector("main");
main.id = "design-panel";
main.setAttribute("role", "tabpanel");
sidebar.classList.add("workspace-sidebar");
const header = document.querySelector("body > header");
const menuBar = document.createElement("nav");
menuBar.id = "window-menu";
menuBar.setAttribute("aria-label", "Главное меню");
menuBar.innerHTML = `
  <details class="window-menu"><summary>Файл</summary><div class="menu-items">
    <button type="button" data-action="load">Открыть проект JSON</button>
    <button type="button" data-action="save">Сохранить проект JSON</button>
    <button type="button" data-action="csv">Экспорт деталей CSV</button>
    <button type="button" data-action="facade-svg">Экспорт эскиза фасадов SVG</button>
  </div></details>
  <details class="window-menu"><summary>Правка</summary><div class="menu-items">
    <button type="button" data-action="undo">Отменить (Ctrl+Z)</button>
    <button type="button" data-action="redo">Повторить (Ctrl+Y)</button>
  </div></details>
  <details class="window-menu"><summary>Вид</summary><div class="menu-items">
    <button type="button" data-view="3d">3D (перспектива)</button>
    <button type="button" data-view="front">Спереди</button>
    <button type="button" data-view="top">Сверху</button>
    <button type="button" data-view="left">Слева</button>
  </div></details>
  <details class="window-menu"><summary>Изделие</summary><div class="menu-items">
    <button type="button" data-action="update">Обновить модель</button>
    <button type="button" data-action="reset">Восстановить типовой образец</button>
  </div></details>
  <details class="window-menu"><summary>Инструменты</summary><div class="menu-items">
    <button type="button" data-panel="left">Показать или скрыть дерево проекта</button>
    <button type="button" data-panel="right">Показать или скрыть спецификацию</button>
    <button type="button" data-panel="parameters">Показать или скрыть параметры</button>
  </div></details>
  <details class="window-menu"><summary>Окно</summary><div class="menu-items">
    <button type="button" data-panel="left">Дерево проекта</button>
    <button type="button" data-panel="right">Производственная спецификация</button>
    <button type="button" data-panel="parameters">Панель параметров</button>
  </div></details>
  <details class="window-menu"><summary>Справка</summary><div class="menu-items"><button type="button" data-info>FURNIX CAD/CAM · прототип редактора корпусных изделий</button></div></details>
`;
header.insertAdjacentElement("afterend", menuBar);

const toolbar = document.createElement("div");
toolbar.id = "command-toolbar";
toolbar.setAttribute("role", "toolbar");
toolbar.setAttribute("aria-label", "Основные команды");
toolbar.innerHTML = `
  <button type="button" data-action="load">Открыть</button>
  <button type="button" data-action="save">Сохранить</button>
  <button type="button" id="undo" disabled title="Отменить (Ctrl+Z)">↶ Отменить</button>
  <button type="button" id="redo" disabled title="Повторить (Ctrl+Y)">↷ Повторить</button>
  <button type="button" data-action="update" class="primary">Обновить модель</button>
  <button type="button" data-action="csv">Детали CSV</button>
  <button type="button" data-view="3d" class="primary" aria-pressed="true" title="Свободный 3D-вид">3D</button>
  <button type="button" data-view="front" aria-pressed="false" title="Вид спереди (со стороны +Z)">Спереди</button>
  <button type="button" data-view="top" aria-pressed="false" title="Вид сверху">Сверху</button>
  <button type="button" data-view="left" aria-pressed="false" title="Вид слева">Слева</button>
  <span id="document-title"></span>
`;
menuBar.insertAdjacentElement("afterend", toolbar);

const appTabs = document.createElement("nav");
appTabs.id = "app-tabs";
appTabs.setAttribute("role", "tablist");
appTabs.setAttribute("aria-label", "Разделы FURNIX");
appTabs.innerHTML = '<button type="button" role="tab" id="tab-design" aria-selected="true" aria-controls="design-panel" tabindex="0">Проектирование</button><button type="button" role="tab" id="tab-lifts" aria-selected="false" aria-controls="lift-page" tabindex="-1">Подъёмники</button>';
appTabs.insertAdjacentHTML('beforeend', '<button type="button" role="tab" id="tab-drawers" aria-selected="false" aria-controls="drawer-page" tabindex="-1">Ящики</button>');
toolbar.insertAdjacentElement("afterend", appTabs);
const techLibraryLink = document.createElement('a');
techLibraryLink.href = './tech.html';
techLibraryLink.target = '_blank';
techLibraryLink.rel = 'noopener';
techLibraryLink.textContent = 'Техническая библиотека ↗';
techLibraryLink.style.cssText = 'align-self:center;padding:8px;color:#a8d7c8';
appTabs.append(techLibraryLink);
const drawerPage = document.createElement('section');
drawerPage.id = 'drawer-page';
drawerPage.setAttribute('role','tabpanel');
drawerPage.setAttribute('aria-labelledby','tab-drawers');
drawerPage.hidden = true;
document.body.append(drawerPage);
mountDrawerCalculator(drawerPage);
const liftPage = document.createElement("section");
liftPage.id = "lift-page";
liftPage.setAttribute("role", "tabpanel");
liftPage.setAttribute("aria-labelledby", "tab-lifts");
main.setAttribute("aria-labelledby", "tab-design");
document.body.append(liftPage);
const liftControls = mountLiftCalculator(liftPage, {
  getCalculations: () => projectResources.liftCalculations,
  getSpecificationItems: () => projectResources.liftSpecificationItems,
  saveCalculation: storeLiftCalculation,
  addCurrentToSpecification: (record) => addLiftSpecificationItem(record),
  addToSpecification: (id) => {
    const record = projectResources.liftCalculations.find((item) => item.id === id);
    if (record) addLiftSpecificationItem(record, record.id);
  },
  removeCalculation: removeLiftCalculation,
  removeSpecificationItem: removeLiftSpecificationItem,
});
const setAppTab = (name) => {
  for (const key of ['design','lifts','drawers']) {
    byId('tab-'+key).setAttribute('aria-selected',String(name === key));
    byId('tab-'+key).tabIndex = name === key ? 0 : -1;
  }
  document.body.classList.toggle('lift-active',name === 'lifts');
  document.body.classList.toggle('drawer-active',name === 'drawers');
  liftPage.hidden = name !== 'lifts';
  drawerPage.hidden = name !== 'drawers';
};
for (const key of ['design','lifts','drawers']) byId('tab-'+key).addEventListener('click',()=>setAppTab(key));
appTabs.addEventListener('keydown',event=>{
 const tabs = [...appTabs.querySelectorAll('[role="tab"]')];
 if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
 event.preventDefault();
 const i=tabs.indexOf(event.target);
 if(i < 0) return;
 const next=tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (i+(event.key === 'ArrowRight' ? 1 : -1)+tabs.length)%tabs.length];
 next.focus(); next.click();
});
setAppTab('design');

const parameterDock = document.createElement("section");
parameterDock.id = "parameter-dock";
parameterDock.setAttribute("aria-label", "Параметры изделия");
parameterDock.innerHTML = '<h2>Параметры изделия</h2><div id="parameter-fields"></div>';
main.insertAdjacentElement("afterend", parameterDock);
const parameterFields = parameterDock.querySelector("#parameter-fields");
parameterFields.append(sidebar.querySelector(":scope > h2"));
for (const id of ["name", "width", "height", "depth", "thickness", "shelves", "divider", "back", "color", "doors", "drawers", "edgeThickness", "sheet", "kerf"]) {
  parameterFields.append(byId(id).closest("label"));
}
parameterFields.append(byId("update").closest(".btns"));
parameterDock.querySelector("h2").remove();

const statusBar = document.createElement("div");
statusBar.id = "status-bar";
statusBar.setAttribute("aria-label", "Строка сообщений");
statusBar.innerHTML = '<span>Состояние модели</span><div id="status-errors"></div><div id="status-geometry"></div>';
parameterDock.insertAdjacentElement("afterend", statusBar);
statusBar.querySelector("#status-errors").append(byId("errors"));
statusBar.querySelector("#status-geometry").append(byId("assembly-message"));
byId("errors").setAttribute("role", "status");

const documentTitle = byId("document-title");
const syncDocumentTitle = () => { documentTitle.textContent = byId("name").value.trim() || "Без названия"; };
byId("name").addEventListener("input", syncDocumentTitle);
syncDocumentTitle();

menuBar.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const panelTarget = event.target.closest("[data-panel]");
  if (action) byId(action.dataset.action)?.click();
  if (panelTarget) {
    const target = panelTarget.dataset.panel;
    if (target === "parameters") {
      parameterDock.classList.toggle("is-hidden");
      document.body.classList.toggle("parameters-hidden", parameterDock.classList.contains("is-hidden"));
    }
    else {
      const panelElement = target === "left" ? sidebar : document.querySelector("main > aside.right");
      const hiddenClass = target === "left" ? "left-hidden" : "right-hidden";
      const showClass = target === "left" ? "show-left" : "show-right";
      panelElement.classList.toggle("is-hidden");
      document.body.classList.toggle(hiddenClass, panelElement.classList.contains("is-hidden"));
      document.body.classList.toggle(showClass, !panelElement.classList.contains("is-hidden"));
      if (compactPanels && !panelElement.classList.contains("is-hidden")) {
        const otherPanel = target === "left" ? rightSidebar : sidebar;
        const otherHiddenClass = target === "left" ? "right-hidden" : "left-hidden";
        const otherShowClass = target === "left" ? "show-right" : "show-left";
        otherPanel.classList.add("is-hidden");
        document.body.classList.add(otherHiddenClass);
        document.body.classList.remove(otherShowClass);
      }
    }
  }
  // Any command closes the menus; the command itself is handled above or by its own listener.
  if (event.target.closest(".menu-items button")) closeMenus();
});

// Menus are <details>, which the browser opens independently of each other. The bar takes over:
// a summary click is handled here, so at most one menu per level is open and aria-expanded stays in sync.
// Nested <details> inside .menu-items work the same way and close together with their parent.
function menuSummary(menu) {
  return menu.querySelector(":scope > summary");
}
function menuSiblings(menu) {
  return [...menu.parentElement.children].filter((item) => item !== menu && item.matches("details.window-menu"));
}
function setMenuOpen(menu, open) {
  if (open) menuSiblings(menu).forEach((sibling) => setMenuOpen(sibling, false));
  menu.open = open;
  menuSummary(menu)?.setAttribute("aria-expanded", String(open));
  if (!open) menu.querySelectorAll("details.window-menu[open]").forEach((nested) => setMenuOpen(nested, false));
}
function closeMenus() {
  menuBar.querySelectorAll("details.window-menu").forEach((menu) => {
    if (menu.open || menuSummary(menu)?.getAttribute("aria-expanded") === "true") setMenuOpen(menu, false);
  });
}
function topMenus() {
  return [...menuBar.querySelectorAll(":scope > details.window-menu")];
}
for (const menu of menuBar.querySelectorAll("details.window-menu")) {
  const summary = menuSummary(menu);
  summary.setAttribute("aria-haspopup", "menu");
  summary.setAttribute("aria-expanded", "false");
  summary.addEventListener("click", (event) => {
    event.preventDefault();
    setMenuOpen(menu, !menu.open);
  });
  // Moving the pointer along the bar switches menus only while one of them is already open.
  summary.addEventListener("pointerenter", () => {
    if (!menu.open && menuSiblings(menu).some((sibling) => sibling.open)) setMenuOpen(menu, true);
  });
}
document.addEventListener("pointerdown", (event) => {
  if (!menuBar.contains(event.target)) closeMenus();
});
menuBar.addEventListener("keydown", (event) => {
  const menus = topMenus();
  const current = event.target.closest("details.window-menu");
  if (event.key === "Escape") {
    const open = menus.find((menu) => menu.open);
    if (!open) return;
    event.preventDefault();
    closeMenus();
    menuSummary(open).focus();
    return;
  }
  if (!current || !menus.includes(current)) return;
  const items = [...current.querySelectorAll(":scope > .menu-items button")];
  const onSummary = event.target === menuSummary(current);
  if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && onSummary) {
    event.preventDefault();
    const next = menus[(menus.indexOf(current) + (event.key === "ArrowRight" ? 1 : menus.length - 1)) % menus.length];
    if (current.open) setMenuOpen(next, true);
    menuSummary(next).focus();
  } else if (event.key === "ArrowDown" && onSummary) {
    event.preventDefault();
    setMenuOpen(current, true);
    items[0]?.focus();
  } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.includes(event.target)) {
    event.preventDefault();
    const index = items.indexOf(event.target);
    items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
  }
});
toolbar.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) byId(action.dataset.action)?.click();
});
const rightSidebar = document.querySelector("main > aside.right");
let compactPanels;
function syncPanelBreakpoint() {
  const nextCompact = window.innerWidth <= 820;
  if (compactPanels === nextCompact) return;
  compactPanels = nextCompact;
  sidebar.classList.toggle("is-hidden", nextCompact);
  rightSidebar.classList.toggle("is-hidden", nextCompact);
  document.body.classList.toggle("left-hidden", nextCompact);
  document.body.classList.toggle("right-hidden", nextCompact);
  document.body.classList.remove("show-left", "show-right");
}
window.addEventListener("resize", syncPanelBreakpoint);
syncPanelBreakpoint();

const scene = new THREE.Scene();
scene.background = new THREE.Color("#132033");
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
camera.position.set(3.6, 2.9, 4.5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.domElement.id = "assembly-canvas";
viewport.replaceChildren(renderer.domElement);
// Fixed views (front/top/left) use an orthographic camera; "3d" returns to the perspective one.
const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
let activeCamera = camera;
let activeView = "3d";
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.1));
const light = new THREE.DirectionalLight(0xffffff, 2.4);
light.position.set(3, 5, 4);
scene.add(light);
const modelGroup = new THREE.Group();
scene.add(modelGroup);
const grid = new THREE.GridHelper(12, 48, 0x50708c, 0x294057);
grid.position.y = -0.005;
scene.add(grid);

function readForm() {
  const number = (id) => Number(byId(id).value);
  return {
    name: byId("name").value.trim().slice(0, 80) || "Корпусное изделие",
    width: number("width"),
    height: number("height"),
    depth: number("depth"),
    thickness: number("thickness"),
    shelves: number("shelves"),
    dividerCount: Math.max(0, Math.min(8, Math.floor(number("divider")))),
    divider: number("divider") > 0,
    back: byId("back").value === "yes",
    color: byId("color").value,
    doors: number("doors"),
    drawers: number("drawers"),
    x: 0,
    z: 0,
  };
}

function validCabinet(p) {
  const dividerCount = Number.isInteger(p.dividerCount) ? p.dividerCount : (p.divider === true || p.divider === "yes" ? 1 : 0);
  return (
    Number.isFinite(p.width) &&
    Number.isFinite(p.height) &&
    Number.isFinite(p.depth) &&
    p.width >= 300 &&
    p.width <= 3000 &&
    p.height >= 300 &&
    p.height <= 3000 &&
    p.depth >= 200 &&
    p.depth <= 1200 &&
    p.thickness >= 10 &&
    p.thickness <= 40 &&
    typeof p.color === "string" && materialCodePattern.test(p.color) &&
    p.width > 3 * p.thickness &&
    p.height > 3 * p.thickness &&
    dividerCount >= 0 && dividerCount <= 8 &&
    (p.width - 2 * p.thickness - dividerCount * p.thickness) / (dividerCount + 1) >= 100 &&
    Number.isInteger(p.shelves) &&
    p.shelves >= 0 &&
    p.shelves <= 12 &&
    Number.isInteger(p.drawers) &&
    p.drawers >= 0 &&
    p.drawers <= 4 &&
    [0, 1, 2].includes(p.doors) &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    (p.layout === undefined || validLayout(p.layout))
  );
}

function validCabinetPlacement(product) {
  const y = product.y ?? 0;
  const rotationY = product.rotationY ?? 0;
  return Number.isFinite(product.x) && Math.abs(product.x) <= 100000 &&
    Number.isFinite(product.z) && Math.abs(product.z) <= 100000 &&
    Number.isFinite(y) && Math.abs(y) <= 100000 &&
    [0, 90, 180, 270].includes(rotationY);
}

function cabinetFootprint(product) {
  const quarterTurn = product.rotationY === 90 || product.rotationY === 270;
  return {
    width: quarterTurn ? product.parameters.depth : product.parameters.width,
    depth: quarterTurn ? product.parameters.width : product.parameters.depth,
  };
}

function cabinetModulesOverlap(a, b) {
  const boxFor = (product) => ({
    center: [product.x, (product.y || 0) + product.parameters.height / 2, product.z],
    size: [product.parameters.width, product.parameters.height, product.parameters.depth],
    axes: cabinetWorldAxes(product),
  });
  return orientedBoxesIntersect(boxFor(a), boxFor(b), -2);
}

function boxBelowFloor(box) {
  return boundsOf(box)[1].min < -0.5;
}

function validVoiceParameterLedger(ledger) {
  if (ledger === undefined) return true;
  const allowedFields = [
    "type", "name", "width", "height", "depth", "thickness", "material", "color",
    "shelves", "doors", "drawers", "divider", "back", "hardware", "purpose", "order",
  ];
  return ledger &&
    typeof ledger === "object" &&
    !Array.isArray(ledger) &&
    Object.keys(ledger).length <= allowedFields.length &&
    Object.entries(ledger).every(([field, parameter]) =>
      allowedFields.includes(field) &&
      parameter &&
      typeof parameter === "object" &&
      (parameter.sourceValue === null || typeof parameter.sourceValue === "string" && parameter.sourceValue.length <= 500) &&
      (parameter.recognizedValue === null || typeof parameter.recognizedValue === "string" || Number.isFinite(parameter.recognizedValue)) &&
      (parameter.finalValue === null || typeof parameter.finalValue === "string" || Number.isFinite(parameter.finalValue)) &&
      (parameter.unit === null || typeof parameter.unit === "string" && parameter.unit.length <= 20) &&
      (parameter.sourceUnit === null || typeof parameter.sourceUnit === "string" && parameter.sourceUnit.length <= 80) &&
      ["recognized", "needs-clarification", "confirmed", "modified"].includes(parameter.status));
}

function validVoiceSetInfo(info) {
  if (info === undefined) return true;
  const shortTexts = (list) => Array.isArray(list) && list.length <= 20 &&
    list.every((item) => typeof item === "string" && item.length <= 300);
  const placement = info?.placement;
  return !!info && typeof info === "object" && !Array.isArray(info) &&
    info.schemaVersion === 1 &&
    typeof info.setId === "string" && info.setId.length > 0 && info.setId.length <= 80 &&
    Number.isInteger(info.moduleCount) && info.moduleCount >= 2 && info.moduleCount <= 12 &&
    Number.isInteger(info.moduleIndex) && info.moduleIndex >= 1 && info.moduleIndex <= info.moduleCount &&
    ["left-to-right", "right-to-left", "manual"].includes(info.orderDirection) &&
    typeof info.moduleSourceText === "string" && info.moduleSourceText.length <= 500 &&
    shortTexts(info.notes) && shortTexts(info.assumptions) &&
    !!placement && typeof placement === "object" &&
    ["row", "manual"].includes(placement.mode) &&
    ["x", "y", "z"].every((axis) => Number.isFinite(placement[axis])) &&
    typeof placement.yAssumed === "boolean";
}

function validSourceInfo(sourceInfo) {
  if (sourceInfo === undefined) return true;
  if (!sourceInfo || typeof sourceInfo !== "object") return false;
  if (!["builtin-library", "personal-library", "external-csv", "voice-input"].includes(sourceInfo.kind)) return false;
  if (typeof sourceInfo.name !== "string" || !sourceInfo.name.trim() || sourceInfo.name.length > 160) return false;
  if (sourceInfo.reference !== undefined &&
      (typeof sourceInfo.reference !== "string" || sourceInfo.reference.length > 240)) return false;
  if (sourceInfo.kind === "external-csv" &&
      (!["mm", "cm", "m", "in"].includes(sourceInfo.unit) ||
        typeof sourceInfo.importedAt !== "string" || sourceInfo.importedAt.length > 40)) return false;
  if (sourceInfo.kind === "voice-input") {
    return typeof sourceInfo.transcript === "string" &&
      sourceInfo.transcript.length <= 2000 &&
      typeof sourceInfo.confirmedAt === "string" &&
      sourceInfo.parsedParameters && typeof sourceInfo.parsedParameters === "object" &&
      sourceInfo.confirmedParameters && typeof sourceInfo.confirmedParameters === "object" &&
      Array.isArray(sourceInfo.changedFields) &&
      sourceInfo.changedFields.length <= 20 &&
      sourceInfo.changedFields.every((field) => typeof field === "string" && field.length <= 80) &&
      typeof sourceInfo.recognizedHardware === "string" &&
      sourceInfo.recognizedHardware.length <= 300 &&
      sourceInfo.hardwareModeled === false &&
      (sourceInfo.voiceParameterSchemaVersion === undefined || sourceInfo.voiceParameterSchemaVersion === 1) &&
      validVoiceParameterLedger(sourceInfo.voiceParameters) &&
      validVoiceSetInfo(sourceInfo.voiceSet);
  }
  return true;
}

function validPart(part) {
  return part &&
    typeof part === "object" &&
    typeof part.name === "string" &&
    part.name.trim().length > 0 &&
    part.name.length <= 80 &&
    ["length", "width", "thickness", "x", "y", "z"].every((key) => Number.isFinite(part[key])) &&
    part.length > 0 &&
    part.width > 0 &&
    part.thickness > 0;
}

function newCabinet(parameters, x = 0, z = 0) {
  const id = `product-${++serial}`;
  return {
    id,
    type: "cabinet",
    name: parameters.name || `Изделие ${serial}`,
    x,
    z,
    y: 0,
    rotationY: 0,
    parameters: { ...parameters, x, z },
    overrides: {},
    customParts: [],
    connections: [],
    hardwareComponents: [],
  };
}

function newPanel(parent, values = {}) {
  const cabinet = products.find((item) => item.id === parent);
  if (!cabinet || cabinet.type !== "cabinet") {
    throw new Error("Сначала выберите корпусное изделие для добавления детали.");
  }
  const p = cabinet.parameters;
  const sections = cabinetSections(p);
  const left = sections[0].left;
  const right = p.width - p.thickness;
  return {
    id: `detail-${++serial}`,
    name: values.name || "Новая деталь",
    length: values.length ?? right - left,
    width: values.width ?? p.depth - (p.back ? 3 : 0),
    thickness: values.thickness ?? p.thickness,
    x: values.x ?? (left + right) / 2 - p.width / 2,
    y: values.y ?? p.thickness * 2,
    z: values.z ?? (p.back ? 1.5 : 0),
    material: values.material || p.color,
  };
}

function addGeneratedPart(product, list, name, length, width, thickness, x, y, z, material = "ЛДСП", orientation = "horizontal") {
  const id = `part-${encodeURIComponent(name)}`;
  const override = product.overrides?.[id];
  const edges = name === "Задняя стенка" ||
    (name.startsWith("Шухляда") && !name.endsWith("перед")) ||
    (name.includes("боковина") && !name.endsWith("левая") && !name.endsWith("правая"))
    ? [false, false, false, false]
    : name.startsWith("Фасад")
      ? [true, true, true, true]
      : name.startsWith("Шухляда")
        ? [true, true, false, false]
        : [true, false, false, false];
  const base = { id, name, length, width, thickness, x, y, z, material, orientation, edges };
  list.push(override ? { ...base, ...override } : base);
}

function cabinetDividerCount(p) {
  return Math.max(0, Math.min(8, Math.floor(p.dividerCount ?? (p.divider === true || p.divider === "yes" ? 1 : 0))));
}

function cabinetSections(p) {
  const { width: W, thickness: T } = p;
  const count = cabinetDividerCount(p);
  const interiorLeft = T;
  const interiorRight = W - T;
  const openingWidth = (interiorRight - interiorLeft - count * T) / (count + 1);
  return Array.from({ length: count + 1 }, (_, index) => ({
    left: interiorLeft + index * (openingWidth + T),
    right: interiorLeft + index * (openingWidth + T) + openingWidth,
  }));
}

// Drawers occupy the bottom of one section: the whole interior, or the left section when there is a divider.
// The stack keeps 35 mm above the bottom, 30 mm between drawers and above the last one, and ends below the roof.
function drawerLayout(p) {
  if (!p.drawers) return null;
  const { height: H, depth: D, thickness: T } = p;
  const sectionIndex = 0;
  const section = cabinetSections(p)[sectionIndex];
  const depth = D - 65;
  const height = Math.min(160, (H - 2 * T - 35) / p.drawers - 30);
  if (depth <= 0 || height <= 0) return null;
  return {
    sectionIndex,
    section,
    width: section.right - section.left - 6,
    depth,
    height,
    centers: Array.from({ length: p.drawers }, (_, i) => T + height / 2 + 35 + i * (height + 30)),
    zoneTop: T + 35 + p.drawers * (height + 30),
  };
}

function shelfLevels(p) {
  const { height: H, thickness: T, shelves: S } = p;
  const segments = cabinetSections(p);
  const drawers = drawerLayout(p);
  return Array.from({ length: S }, (_, i) => {
    const sectionIndex = i % segments.length;
    const level = Math.floor(i / segments.length) + 1;
    const amount = Math.ceil((S - sectionIndex) / segments.length);
    const bottom = drawers && drawers.sectionIndex === sectionIndex ? drawers.zoneTop : T;
    return {
      sectionIndex,
      section: segments[sectionIndex],
      y: bottom + (H - T - bottom) * level / (amount + 1),
      spacing: (H - T - bottom) / (amount + 1),
    };
  });
}

function drawerLayoutIssues(product) {
  const p = product.parameters;
  if (p.layout) {
    return [
      ...layoutIssues(p).map((issue) => `${product.name}: ${issue}.`),
      ...(p.drawers ? [`${product.name}: в корпусе с проёмами эскиза ящики пока не строятся — они появятся вместе с фасадами по проёмам.`] : []),
    ];
  }
  if (!p.drawers) return [];
  const layout = drawerLayout(p);
  if (!layout) return [`${product.name}: ящики не помещаются в корпус по высоте или глубине и не построены.`];
  const issues = [];
  if (p.divider) {
    issues.push(`${product.name}: секция для ящиков не задана — ящики поставлены в левую секцию у перегородки. Проверьте, что это нужная секция.`);
  }
  if (p.doors) {
    issues.push(`${product.name}: двери и ящики в одном корпусе. Ящик пока упрощённый (без дна и собственного фасада) и стоит за дверью; конструкцию проверьте вручную.`);
  }
  if (shelfLevels(p).some((shelf) => shelf.sectionIndex === layout.sectionIndex && shelf.spacing < p.thickness)) {
    issues.push(`${product.name}: полки над зоной ящиков не помещаются — расстояние между ними меньше толщины плиты.`);
  }
  return issues;
}

function generatedParts(product) {
  const p = product.parameters;
  const { width: W, height: H, depth: D, thickness: T, divider: V, back: B } = p;
  const list = [];
  const inside = W - 2 * T;
  addGeneratedPart(product, list, "Боковина левая", H, D, T, T / 2, H / 2, D / 2, "ЛДСП", "vertical");
  addGeneratedPart(product, list, "Боковина правая", H, D, T, W - T / 2, H / 2, D / 2, "ЛДСП", "vertical");
  addGeneratedPart(product, list, "Дно", inside, D, T, W / 2, T / 2, D / 2);
  addGeneratedPart(product, list, "Крыша", inside, D, T, W / 2, H - T / 2, D / 2);
  // A cabinet with a sketch layout takes its shelves and dividers from the opening tree.
  if (p.layout) {
    for (const part of layoutParts(p)) {
      addGeneratedPart(product, list, part.name, part.length, part.width, part.thickness,
        part.x, part.y, part.z, "ЛДСП", part.orientation);
    }
  }
  const dividerCount = cabinetDividerCount(p);
  if (!p.layout) Array.from({ length: dividerCount }, (_, index) => {
    const openingWidth = (W - 2 * T - dividerCount * T) / (dividerCount + 1);
    const x = T + openingWidth * (index + 1) + T * (index + 0.5);
    addGeneratedPart(product, list, `Перегородка ${index + 1}`, H - 2 * T, D, T, x, H / 2, D / 2, "ЛДСП", "vertical");
  });
  if (!p.layout) shelfLevels(p).forEach(({ section, y }, i) => {
    addGeneratedPart(
      product,
      list,
      `Полка ${i + 1}`,
      section.right - section.left,
      D,
      T,
      (section.left + section.right) / 2,
      y,
      D / 2,
    );
  });
  if (B) addGeneratedPart(product, list, "Задняя стенка", W, H, 3, W / 2, H / 2, -1.5, "ХДФ", "back");
  if (p.doors) {
    const gap = 3;
    const doorWidth = (W - (p.doors + 1) * gap) / p.doors;
    for (let i = 0; i < p.doors; i++) {
      addGeneratedPart(product, list, `Фасад ${i + 1}`, H - 2 * gap, doorWidth, T,
        gap + i * (doorWidth + gap) + doorWidth / 2, H / 2, D + T / 2 + 2, "ЛДСП", "front");
    }
  }
  const drawers = p.layout ? null : drawerLayout(p);
  if (drawers) {
    const { section, width: drawerWidth, depth: drawerDepth, height: drawerHeight } = drawers;
    const centerX = (section.left + section.right) / 2;
    drawers.centers.forEach((y, i) => {
      addGeneratedPart(product, list, `Шухляда ${i + 1} перед`, drawerWidth, drawerHeight, T,
        centerX, y, D - 50, "ЛДСП", "drawer");
      addGeneratedPart(product, list, `Шухляда ${i + 1} зад`, drawerWidth, drawerHeight, T,
        centerX, y, 90, "ЛДСП", "drawer");
      addGeneratedPart(product, list, `Шухляда ${i + 1} боковина левая`, drawerDepth, drawerHeight, T,
        section.left + 3 + T / 2, y, D / 2, "ЛДСП", "drawer-side");
      addGeneratedPart(product, list, `Шухляда ${i + 1} боковина правая`, drawerDepth, drawerHeight, T,
        section.right - 3 - T / 2, y, D / 2, "ЛДСП", "drawer-side");
    });
  }
  return list;
}

function partBox(part, product) {
  return transformCabinetBox(partLocalBox(part, product), product);
}

function partLocalBox(part, product) {
  const p = product.parameters;
  let size;
  let center;
  if (part.orientation === "vertical") {
    size = [part.thickness, part.length, part.width];
    center = [part.x - p.width / 2, part.y, part.z - p.depth / 2];
  } else if (part.orientation === "front") {
    size = [part.width, part.length, part.thickness];
    center = [part.x - p.width / 2, part.y, part.z - p.depth / 2];
  } else if (part.orientation === "back") {
    size = [part.length, part.width, part.thickness];
    center = [part.x - p.width / 2, part.y, part.z - p.depth / 2];
  } else if (part.orientation === "drawer") {
    size = [part.length, part.width, part.thickness];
    center = [part.x - p.width / 2, part.y, part.z - p.depth / 2];
  } else if (part.orientation === "drawer-side") {
    size = [part.thickness, part.width, part.length];
    center = [part.x - p.width / 2, part.y, part.z - p.depth / 2];
  } else {
    size = [part.length, part.thickness, part.width];
    center = [part.x - p.width / 2, part.y, part.z - p.depth / 2];
  }
  return { size, center, axes: identityAxes };
}

function panelBox(part, product) {
  return transformCabinetBox({
    size: [part.length, part.thickness, part.width],
    center: [part.x, part.y, part.z],
  }, product);
}

function snapUnit(value) {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function cabinetLocalToWorldVector(product, vector) {
  const rotation = (product.rotationY || 0) * Math.PI / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    snapUnit(cosine * vector[0] + sine * vector[2]),
    vector[1],
    snapUnit(-sine * vector[0] + cosine * vector[2]),
  ];
}

function cabinetWorldToLocalVector(product, vector) {
  const rotation = -(product.rotationY || 0) * Math.PI / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    snapUnit(cosine * vector[0] + sine * vector[2]),
    vector[1],
    snapUnit(-sine * vector[0] + cosine * vector[2]),
  ];
}

function cabinetLocalToWorldPoint(product, point) {
  const vector = cabinetLocalToWorldVector(product, point);
  return [
    product.x + vector[0],
    (product.y || 0) + vector[1],
    product.z + vector[2],
  ];
}

function cabinetWorldToLocalPoint(product, point) {
  return cabinetWorldToLocalVector(product, [
    point[0] - product.x,
    point[1] - (product.y || 0),
    point[2] - product.z,
  ]);
}

function cabinetWorldAxes(product) {
  return [
    cabinetLocalToWorldVector(product, [1, 0, 0]),
    cabinetLocalToWorldVector(product, [0, 1, 0]),
    cabinetLocalToWorldVector(product, [0, 0, 1]),
  ];
}

function transformCabinetBox(box, product) {
  return {
    size: [...box.size],
    center: cabinetLocalToWorldPoint(product, box.center),
    axes: (box.axes || identityAxes).map((axis) => cabinetLocalToWorldVector(product, axis)),
  };
}

function boundsOf(box) {
  const oriented = box.axes ? box : { ...box, axes: identityAxes };
  const bounds = orientedBoxBounds(oriented);
  return bounds.center.map((center, axis) => ({
    min: center - bounds.size[axis] / 2,
    max: center + bounds.size[axis] / 2,
  }));
}

function findPartById(parts, id) {
  const exact = parts.find((part) => part.id === id);
  if (exact || typeof id !== "string" || !id.startsWith("part-")) return exact;
  let name;
  try {
    name = decodeURIComponent(id.slice(5)).normalize("NFC").trim();
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
    return undefined;
  }
  return parts.find((part) => part.name.normalize("NFC").trim() === name);
}

function findJoint(product, partAId, partBId) {
  const allParts = [...generatedParts(product), ...product.customParts];
  const partA = findPartById(allParts, partAId);
  const partB = findPartById(allParts, partBId);
  if (!partA || !partB) return { error: "В соединении указана деталь, которой нет в изделии." };
  if (partA.id === partB.id) return { error: "Выберите две разные детали одного изделия." };
  const boxA = partA.orientation ? partLocalBox(partA, product) : {
    size: [partA.length, partA.thickness, partA.width],
    center: [partA.x, partA.y, partA.z],
    axes: identityAxes,
  };
  const boxB = partB.orientation ? partLocalBox(partB, product) : {
    size: [partB.length, partB.thickness, partB.width],
    center: [partB.x, partB.y, partB.z],
    axes: identityAxes,
  };
  const boundsA = boundsOf(boxA);
  const boundsB = boundsOf(boxB);
  const contacts = [];
  for (let axis = 0; axis < 3; axis++) {
    const gapAB = boundsB[axis].min - boundsA[axis].max;
    const gapBA = boundsA[axis].min - boundsB[axis].max;
    if (Math.min(Math.abs(gapAB), Math.abs(gapBA)) > 3) continue;
    const overlaps = [0, 1, 2]
      .filter((other) => other !== axis)
      .map((other) => ({
        axis: other,
        min: Math.max(boundsA[other].min, boundsB[other].min),
        max: Math.min(boundsA[other].max, boundsB[other].max),
      }));
    if (overlaps.every((range) => range.max - range.min > 4)) {
      contacts.push({ axis, gap: Math.min(Math.abs(gapAB), Math.abs(gapBA)), overlaps, gapAB, gapBA });
    }
  }
  if (!contacts.length) {
    return { error: "Детали не соприкасаются гранями. Перед конфирматом установите контакт и проверьте положение." };
  }
  contacts.sort((a, b) => a.gap - b.gap);
  const contact = contacts[0];
  const seam = [...contact.overlaps].sort((a, b) => (b.max - b.min) - (a.max - a.min))[0];
  const cross = contact.overlaps.find((range) => range.axis !== seam.axis);
  const face = contact.gapAB >= -3
    ? (boundsA[contact.axis].max + boundsB[contact.axis].min) / 2
    : (boundsA[contact.axis].min + boundsB[contact.axis].max) / 2;
  const entryIsA = boxA.size[contact.axis] <= boxB.size[contact.axis];
  const sign = entryIsA
    ? Math.sign(boxB.center[contact.axis] - boxA.center[contact.axis]) || 1
    : Math.sign(boxA.center[contact.axis] - boxB.center[contact.axis]) || -1;
  const entryBox = entryIsA ? boundsA : boundsB;
  const start = sign > 0 ? entryBox[contact.axis].min : entryBox[contact.axis].max;
  const values = {
    axis: contact.axis,
    seamAxis: seam.axis,
    face,
    sign,
    start,
    seamStart: seam.min,
    seamEnd: seam.max,
    crossCenter: (cross.min + cross.max) / 2,
  };
  if (seam.max - seam.min < 2 * product.parameters.thickness + 40) {
    return { error: "Мало места вдоль общего ребра для крепежа с безопасным отступом от краёв." };
  }
  return { partA, partB, ...values };
}

function connectionPositions(product, connection) {
  const joint = findJoint(product, connection.partA, connection.partB);
  if (joint.error) return joint;
  const components = (product.hardwareComponents || [])
    .filter((component) => connection.componentIds?.includes(component.id));
  const count = components.length || Number(connection.count);
  const inset = Number(components[0]?.installationPoint?.edgeInset ?? connection.edgeInset);
  const span = joint.seamEnd - joint.seamStart;
  if (!Number.isInteger(count) || count < 1 || count > 8 || !Number.isFinite(inset) ||
      inset < 20 || 2 * inset >= span) {
    return { error: "Проверьте количество крепежа (1–8) и отступ от торцов (20 мм или больше)." };
  }
  const entries = [];
  for (let index = 0; index < count; index++) {
    const component = components[index];
    const placement = component?.installationPoint;
    const fraction = placement?.distribution?.index !== undefined
      ? placement.distribution.count === 1
        ? 0.5
        : placement.distribution.index / (placement.distribution.count - 1)
      : count === 1 ? 0.5 : index / (count - 1);
    const center = joint.seamStart + inset + (span - 2 * inset) * fraction;
    const point = [0, 0, 0];
    point[joint.axis] = joint.face;
    point[joint.seamAxis] = center;
    point[3 - joint.axis - joint.seamAxis] = joint.crossCenter;
    const localEntry = [...point];
    localEntry[joint.axis] = joint.start;
    const localTip = [...localEntry];
    const length = Number(component?.dimensions?.length ?? 50);
    localTip[joint.axis] += joint.sign * length;
    const localDirection = [0, 0, 0];
    localDirection[joint.axis] = joint.sign;
    const start = cabinetLocalToWorldPoint(product, localEntry);
    const tip = cabinetLocalToWorldPoint(product, localTip);
    entries.push({
      component,
      localStart: localEntry,
      direction: cabinetLocalToWorldVector(product, localDirection),
      start,
      center: start.map((value, axis) => (value + tip[axis]) / 2),
      tip,
    });
  }
  return { ...joint, entries };
}

function toolAccessCorridor(product, layout, entry, settings) {
  const center = [...entry.localStart];
  center[layout.axis] -= layout.sign * settings.toolAccessDepth / 2;
  const size = [settings.toolAccessWidth, settings.toolAccessWidth, settings.toolAccessWidth];
  size[layout.axis] = settings.toolAccessDepth;
  return transformLocalOrientedBox({ center, size, axes: identityAxes }, product);
}

function createConfirmatComponents(product, connection, count, edgeInset) {
  product.hardwareComponents ||= [];
  connection.componentIds = [];
  for (let index = 0; index < count; index++) {
    const id = `hardware-${++serial}`;
    connection.componentIds.push(id);
    product.hardwareComponents.push({
      id,
      category: "case-joint",
      type: "confirmat",
      model: "6.4x50",
      dimensions: { diameter: 6.4, length: 50 },
      installationPoint: {
        kind: "joint-edge",
        partAId: connection.partA,
        partBId: connection.partB,
        edgeInset,
        distribution: { strategy: "evenly-spaced", index, count },
      },
    });
  }
}

function validHardwareComponent(component) {
  const dimensions = component?.dimensions;
  const point = component?.installationPoint;
  const validPoint = point?.kind === "joint-edge"
    ? typeof point.partAId === "string" && typeof point.partBId === "string" &&
      Number.isFinite(point.edgeInset) && point.edgeInset >= 20 &&
      point.distribution?.strategy === "evenly-spaced" &&
      Number.isInteger(point.distribution.index) && point.distribution.index >= 0 &&
      Number.isInteger(point.distribution.count) && point.distribution.count >= 1 &&
      point.distribution.index < point.distribution.count
    : point?.kind === "part-reference" &&
      typeof point.partId === "string" && typeof point.reference === "string";
  return component &&
    typeof component.id === "string" &&
    hardwareCategories.has(component.category) &&
    hardwareTypeLabels[component.type] &&
    typeof component.model === "string" &&
    component.model.trim().length > 0 && component.model.length <= 120 &&
    dimensions && typeof dimensions === "object" &&
    ["length", "diameter", "width", "height"].every((key) =>
      dimensions[key] === null || dimensions[key] === undefined ||
      (Number.isFinite(dimensions[key]) && dimensions[key] > 0)) &&
    validPoint;
}

function overlaps(a, b, tolerance = 2) {
  return orientedBoxesIntersect(a, b, -tolerance);
}

const zoneTypeLabels = {
  appliance: "техника / препятствие",
  pipe: "труба / коммуникация",
  ventilation: "вентиляционный зазор",
  service: "зона обслуживания",
};
const identityAxes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
let highlightedEnvironmentZoneIds = new Set();
let latestCollisionIssues = [];

function boxForPart(part, product) {
  return part.orientation ? partBox(part, product) : panelBox(part, product);
}

function asOrientedBox(box, angle = 0, center = box.center) {
  const axes = box.axes || identityAxes;
  return {
    center,
    size: box.size,
    axes: angle ? axes.map((axis) => rotateWorldVectorY(axis, angle)) : axes,
  };
}

function rotateWorldVectorY(vector, angle) {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    snapUnit(cosine * vector[0] + sine * vector[2]),
    vector[1],
    snapUnit(-sine * vector[0] + cosine * vector[2]),
  ];
}

function rotateWorldPointAroundY(point, pivot, angle) {
  const rotated = rotateWorldVectorY(point.map((value, axis) => value - pivot[axis]), angle);
  return rotated.map((value, axis) => value + pivot[axis]);
}

function transformLocalOrientedBox(box, product) {
  return {
    size: [...box.size],
    center: cabinetLocalToWorldPoint(product, box.center),
    axes: (box.axes || identityAxes).map((axis) => cabinetLocalToWorldVector(product, axis)),
  };
}

function orientedBoxesIntersect(a, b, clearance = 0) {
  const axesA = a.axes || identityAxes;
  const axesB = b.axes || identityAxes;
  const rotation = axesA.map((axisA) => axesB.map((axisB) =>
    axisA.reduce((sum, value, index) => sum + value * axisB[index], 0)));
  const absoluteRotation = rotation.map((row) => row.map((value) => Math.abs(value) + 1e-8));
  const difference = b.center.map((value, axis) => value - a.center[axis]);
  const translated = axesA.map((axis) => axis.reduce((sum, value, index) => sum + value * difference[index], 0));
  const halfA = a.size.map((value) => value / 2);
  const halfB = b.size.map((value) => value / 2);

  for (let i = 0; i < 3; i++) {
    const radiusA = halfA[i];
    const radiusB = halfB.reduce((sum, value, j) => sum + value * absoluteRotation[i][j], 0);
    if (Math.abs(translated[i]) >= radiusA + radiusB + clearance) return false;
  }
  for (let j = 0; j < 3; j++) {
    const radiusA = halfA.reduce((sum, value, i) => sum + value * absoluteRotation[i][j], 0);
    const radiusB = halfB[j];
    const distance = Math.abs(translated.reduce((sum, value, i) => sum + value * rotation[i][j], 0));
    if (distance >= radiusA + radiusB + clearance) return false;
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      // Edge-cross axes are not normalized: scale the clearance and skip parallel edges.
      const crossLength = Math.sqrt(Math.max(0, 1 - rotation[i][j] ** 2));
      if (crossLength < 1e-6) continue;
      const axisA = (i + 1) % 3;
      const axisANext = (i + 2) % 3;
      const axisB = (j + 1) % 3;
      const axisBNext = (j + 2) % 3;
      const radiusA = halfA[axisA] * absoluteRotation[axisANext][j] +
        halfA[axisANext] * absoluteRotation[axisA][j];
      const radiusB = halfB[axisB] * absoluteRotation[i][axisBNext] +
        halfB[axisBNext] * absoluteRotation[i][axisB];
      const distance = Math.abs(
        translated[axisANext] * rotation[axisA][j] -
        translated[axisA] * rotation[axisANext][j],
      );
      if (distance >= radiusA + radiusB + clearance * crossLength) return false;
    }
  }
  return true;
}

function getMotionAssemblies(product, settings = projectResources.collisionSettings) {
  const parts = getProductParts(product);
  const doors = parts.filter((part) => part.orientation === "front" && /^Фасад \d+$/.test(part.name));
  const motions = doors.map((part, index) => {
    const number = Number(part.name.match(/\d+$/)?.[0]) || index + 1;
    const hingeSide = doors.length === 1
      ? settings.singleDoorHinge
      : number === 1 ? "left" : "right";
    return {
      id: `${product.id}:door:${number}`,
      name: `${product.name} · ${part.name}`,
      kind: "door",
      product,
      parts: [{ part, box: boxForPart(part, product) }],
      hingeSide,
    };
  });
  const drawers = new Map();
  for (const part of parts) {
    const match = part.name.match(/^Шухляда (\d+) /);
    if (!match || !["drawer", "drawer-side"].includes(part.orientation)) continue;
    const group = drawers.get(match[1]) || [];
    group.push({ part, box: boxForPart(part, product) });
    drawers.set(match[1], group);
  }
  for (const [number, drawerParts] of drawers) {
    motions.push({
      id: `${product.id}:drawer:${number}`,
      name: `${product.name} · Шухляда ${number}`,
      kind: "drawer",
      product,
      parts: drawerParts,
    });
  }
  return motions;
}

function motionPose(motion, entry, progress, settings) {
  if (motion.kind === "drawer") {
    const center = [...entry.box.center];
    const front = entry.box.axes[2];
    for (let axis = 0; axis < 3; axis++) {
      center[axis] += front[axis] * settings.drawerExtension * progress;
    }
    return asOrientedBox(entry.box, 0, center);
  }
  const widthAxis = entry.box.axes[0];
  const hingeSign = motion.hingeSide === "left" ? -1 : 1;
  const hinge = entry.box.center.map((value, axis) =>
    value + widthAxis[axis] * hingeSign * entry.box.size[0] / 2);
  const signedAngle = settings.doorOpenAngle * progress * (motion.hingeSide === "left" ? -1 : 1);
  const center = rotateWorldPointAroundY(entry.box.center, hinge, signedAngle);
  return asOrientedBox(entry.box, signedAngle, center);
}

function motionSamples(motion, settings) {
  const distance = motion.kind === "door" ? settings.doorOpenAngle : settings.drawerExtension;
  const smallestPartDimension = Math.min(...motion.parts.flatMap(({ box }) => box.size));
  const step = motion.kind === "door"
    ? Math.min(settings.angularStep, 5 * 180 / (Math.PI * Math.max(...motion.parts.map(({ box }) =>
      Math.hypot(box.size[0], box.size[2])))))
    : Math.min(settings.linearStep, Math.max(2, smallestPartDimension / 2));
  const count = Math.max(1, Math.ceil(distance / step));
  return Array.from({ length: count + 1 }, (_, index) => index / count);
}

function orientedBoxBounds(box) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let mask = 0; mask < 8; mask++) {
    const point = [...box.center];
    for (let axis = 0; axis < 3; axis++) {
      const sign = mask & (1 << axis) ? 1 : -1;
      for (let component = 0; component < 3; component++) {
        point[component] += (box.axes || identityAxes)[axis][component] * box.size[axis] / 2 * sign;
      }
    }
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis]);
    }
  }
  return {
    center: minimum.map((value, axis) => (value + maximum[axis]) / 2),
    size: minimum.map((value, axis) => maximum[axis] - value),
  };
}

function collisionSettingsValid(settings) {
  return settings && Number.isFinite(settings.doorOpenAngle) &&
    settings.doorOpenAngle >= 0 && settings.doorOpenAngle <= 180 &&
    ["left", "right"].includes(settings.singleDoorHinge) &&
    Number.isFinite(settings.drawerExtension) && settings.drawerExtension >= 0 &&
    settings.drawerExtension <= 2000 &&
    Number.isFinite(settings.angularStep) && settings.angularStep >= 1 && settings.angularStep <= 15 &&
    Number.isFinite(settings.linearStep) && settings.linearStep >= 5 && settings.linearStep <= 100 &&
    Number.isFinite(settings.clearance) && settings.clearance >= 0 && settings.clearance <= 100 &&
    Number.isFinite(settings.toolAccessDepth) && settings.toolAccessDepth >= 0 &&
    settings.toolAccessDepth <= 1000 &&
    Number.isFinite(settings.toolAccessWidth) && settings.toolAccessWidth >= 0 &&
    settings.toolAccessWidth <= 500 && typeof settings.showSweptEnvelope === "boolean";
}

function validEnvironmentZone(zone) {
  return zone && typeof zone === "object" &&
    typeof zone.id === "string" && zone.id.length > 0 && zone.id.length <= 100 &&
    typeof zone.name === "string" && zone.name.trim().length > 0 && zone.name.length <= 80 &&
    Object.prototype.hasOwnProperty.call(zoneTypeLabels, zone.type) &&
    ["x", "y", "z", "width", "height", "depth"].every((key) =>
      Number.isFinite(zone[key]) && Math.abs(zone[key]) <= 100000) &&
    zone.width > 0 && zone.height > 0 && zone.depth > 0 &&
    zone.width <= 100000 && zone.height <= 100000 && zone.depth <= 100000;
}

const assemblyOperationLabels = {
  install: "Установка детали",
  fasten: "Крепление / монтаж",
  inspect: "Контроль операции",
};
const approachVectors = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
};
const assemblyOperationDefaults = () => ({
  approach: "front",
  travel: 150,
  accessWidth: 100,
  accessHeight: 100,
});

function validAssemblyOperation(operation) {
  return operation && typeof operation === "object" &&
    typeof operation.id === "string" && operation.id.length > 0 && operation.id.length <= 100 &&
    typeof operation.name === "string" && operation.name.trim().length > 0 && operation.name.length <= 100 &&
    ["install", "fasten", "inspect"].includes(operation.kind) &&
    typeof operation.productId === "string" && operation.productId.length > 0 &&
    typeof operation.targetPartId === "string" && operation.targetPartId.length > 0 &&
    Object.prototype.hasOwnProperty.call(approachVectors, operation.approach) &&
    Number.isFinite(operation.travel) && operation.travel >= 0 && operation.travel <= 2000 &&
    Number.isFinite(operation.accessWidth) && operation.accessWidth > 0 && operation.accessWidth <= 1000 &&
    Number.isFinite(operation.accessHeight) && operation.accessHeight > 0 && operation.accessHeight <= 1000 &&
    Array.isArray(operation.dependsOn) && operation.dependsOn.length <= 500 &&
    operation.dependsOn.every((id) => typeof id === "string" && id.length > 0);
}

function validAssemblyPlan(plan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.operations) || plan.operations.length > 500) return false;
  const ids = new Set();
  for (const operation of plan.operations) {
    if (!validAssemblyOperation(operation) || ids.has(operation.id)) return false;
    ids.add(operation.id);
  }
  return plan.operations.every((operation) =>
    new Set(operation.dependsOn).size === operation.dependsOn.length &&
    !operation.dependsOn.includes(operation.id));
}

function operationTarget(operation) {
  const product = products.find((item) => item.id === operation.productId);
  if (!product || product.type !== "cabinet") return null;
  const part = findPartById(getProductParts(product), operation.targetPartId);
  return part ? { product, part, box: boxForPart(part, product) } : null;
}

function operationZone(operation, target) {
  const localVector = approachVectors[operation.approach];
  const vector = cabinetLocalToWorldVector(target.product, localVector);
  const axis = localVector.findIndex((value) => value !== 0);
  if (operation.kind === "install") {
    const center = [...target.box.center];
    for (let component = 0; component < 3; component++) {
      center[component] += vector[component] * operation.travel / 2;
    }
    const size = [...target.box.size];
    size[axis] += operation.travel;
    return { center, size, axes: target.box.axes };
  }
  const size = axis === 0
    ? [operation.travel, operation.accessHeight, operation.accessWidth]
    : axis === 1
      ? [operation.accessWidth, operation.travel, operation.accessHeight]
      : [operation.accessWidth, operation.accessHeight, operation.travel];
  size[axis] = Math.max(operation.travel, 1);
  const center = [...target.box.center];
  for (let component = 0; component < 3; component++) {
    center[component] += vector[component] * (target.box.size[axis] / 2 + operation.travel / 2);
  }
  return { center, size, axes: target.box.axes };
}

function analyzeAssemblyPlan(plan = projectResources.assemblyPlan) {
  const issues = [];
  const operations = plan.operations;
  if (!operations.length) {
    return { issues: ["Информация: граф операций ещё не создан."], order: [], ranks: new Map(), zones: [] };
  }
  const byId = new Map(operations.map((operation) => [operation.id, operation]));
  const incoming = new Map(operations.map((operation) => [operation.id, 0]));
  const outgoing = new Map(operations.map((operation) => [operation.id, []]));
  const indexById = new Map(operations.map((operation, index) => [operation.id, index]));

  for (const operation of operations) {
    for (const dependencyId of operation.dependsOn) {
      if (!byId.has(dependencyId)) {
        issues.push(`${operation.name}: не найдена предшествующая операция ${dependencyId}.`);
        continue;
      }
      outgoing.get(dependencyId).push(operation.id);
      incoming.set(operation.id, incoming.get(operation.id) + 1);
    }
    if (!operationTarget(operation)) {
      issues.push(`${operation.name}: изделие или целевая деталь отсутствуют в проекте.`);
    }
  }

  const ready = operations.filter((operation) => incoming.get(operation.id) === 0);
  const order = [];
  const ranks = new Map(ready.map((operation) => [operation.id, 0]));
  while (ready.length) {
    ready.sort((a, b) => indexById.get(a.id) - indexById.get(b.id));
    const operation = ready.shift();
    order.push(operation);
    for (const nextId of outgoing.get(operation.id)) {
      ranks.set(nextId, Math.max(ranks.get(nextId) || 0, (ranks.get(operation.id) || 0) + 1));
      incoming.set(nextId, incoming.get(nextId) - 1);
      if (incoming.get(nextId) === 0) ready.push(byId.get(nextId));
    }
  }
  if (order.length !== operations.length) {
    const cyclic = operations.filter((operation) => incoming.get(operation.id) > 0);
    issues.push(`Обнаружен цикл зависимостей: ${cyclic.map((operation) => operation.name).join(", ")}.`);
  }

  const installed = new Map();
  const zones = [];
  const environmentZones = projectResources.environmentZones.map((zone) => ({
    zone,
    box: { center: [zone.x, zone.y, zone.z], size: [zone.width, zone.height, zone.depth] },
  }));
  const sampledOrder = order.length === operations.length
    ? order
    : operations;
  for (const operation of sampledOrder) {
    const target = operationTarget(operation);
    if (!target) continue;
    const targetKey = `${target.product.id}:${target.part.id}`;
    const zone = operationZone(operation, target);
    zones.push({ operation, zone });
    const vector = cabinetLocalToWorldVector(target.product, approachVectors[operation.approach]);
    const dependenciesInstalled = operation.dependsOn.every((id) =>
      sampledOrder.findIndex((item) => item.id === id) < sampledOrder.indexOf(operation));
    if (!dependenciesInstalled) {
      issues.push(`${operation.name}: предшественники не могут быть завершены до этой операции.`);
    }

    if (operation.kind === "install") {
      if (installed.has(targetKey)) {
        issues.push(`${operation.name}: деталь «${target.part.name}» уже установлена другой операцией.`);
        continue;
      }
      const step = Math.max(25, Math.min(50, Math.min(operation.accessWidth, operation.accessHeight) / 2));
      const ignoredFinalTravel = Math.min(operation.travel, Math.max(3, projectResources.collisionSettings.clearance));
      const checkedTravel = Math.max(0, operation.travel - ignoredFinalTravel);
      const count = operation.travel === 0 ? 1 : Math.max(1, Math.ceil(checkedTravel / step));
      for (const other of installed.values()) {
        if (!orientedBoxesIntersect(asOrientedBox(zone), asOrientedBox(other.box))) continue;
        for (let sample = 0; sample <= count; sample++) {
          const progress = count ? sample / count : 1;
          const remaining = checkedTravel * (1 - progress);
          const center = [...target.box.center];
          for (let component = 0; component < 3; component++) {
            center[component] += vector[component] * (ignoredFinalTravel + remaining);
          }
          const moving = asOrientedBox(target.box, 0, center);
          if (orientedBoxesIntersect(moving, asOrientedBox(other.box))) {
            issues.push(`${operation.name}: монтажный путь перекрыт уже установленной деталью «${other.part.name}».`);
            break;
          }
        }
      }
      for (const { zone: obstruction, box } of environmentZones) {
        if (obstruction.type === "service") continue;
        if (orientedBoxesIntersect(asOrientedBox(zone), asOrientedBox(box), projectResources.collisionSettings.clearance)) {
          issues.push(`${operation.name}: монтажная зона пересекает «${obstruction.name}» (${zoneTypeLabels[obstruction.type]}).`);
        }
      }
      installed.set(targetKey, target);
      continue;
    }

    if (!installed.has(targetKey)) {
      issues.push(`${operation.name}: целевая деталь «${target.part.name}» должна быть установлена раньше.`);
    }
    const accessBox = operationZone(operation, target);
    for (const [installedKey, other] of installed) {
      if (installedKey !== targetKey &&
          orientedBoxesIntersect(asOrientedBox(accessBox), asOrientedBox(other.box),
            projectResources.collisionSettings.clearance)) {
        issues.push(`${operation.name}: зона доступа к детали перекрыта «${other.part.name}».`);
      }
    }
    for (const { zone: obstruction, box } of environmentZones) {
      if (obstruction.type === "service") continue;
      if (orientedBoxesIntersect(asOrientedBox(accessBox), asOrientedBox(box), projectResources.collisionSettings.clearance)) {
        issues.push(`${operation.name}: монтажная зона пересекает «${obstruction.name}».`);
      }
    }
  }

  const installedByPlan = new Set(operations
    .filter((operation) => operation.kind === "install")
    .map((operation) => {
      const target = operationTarget(operation);
      return target ? `${target.product.id}:${target.part.id}` : null;
    }).filter(Boolean));
  for (const product of products) {
    for (const part of getProductParts(product)) {
      if (!installedByPlan.has(`${product.id}:${part.id}`)) {
        issues.push(`Информация: деталь «${product.name} · ${part.name}» не включена в граф монтажа.`);
      }
    }
  }
  return { issues: [...new Set(issues)], order, ranks, zones };
}

function issueSet(issues) {
  return new Set(issues.filter((issue) => !issue.startsWith("Информация:")));
}

function proposeConstructionChanges() {
  const proposals = [];
  const seen = new Set();
  const baselinePlanIssues = latestAssemblyAnalysis.issues;
  const baselineMotionIssues = latestCollisionIssues;
  const addProposal = (proposal, beforeIssues, afterIssues) => {
    const before = issueSet(beforeIssues);
    const after = issueSet(afterIssues);
    const resolved = [...before].filter((issue) => !after.has(issue));
    const introduced = [...after].filter((issue) => !before.has(issue));
    if (!resolved.length || introduced.length) return;
    const key = proposal.key;
    if (seen.has(key)) return;
    seen.add(key);
    proposals.push({
      ...proposal,
      resolved,
      remaining: [...after],
      score: resolved.length,
    });
  };

  const planErrors = [...issueSet(baselinePlanIssues)];
  if (planErrors.length && validAssemblyPlan(projectResources.assemblyPlan)) {
    const affectedOperations = projectResources.assemblyPlan.operations
      .filter((operation) => planErrors.some((issue) => issue.startsWith(`${operation.name}:`)))
      .slice(0, 4);
    for (const operation of affectedOperations) {
      for (const [approach, label] of [
        ["front", "спереди (+Z)"], ["back", "сзади (-Z)"],
        ["left", "слева (-X)"], ["right", "справа (+X)"],
        ["top", "сверху (+Y)"], ["bottom", "снизу (-Y)"],
      ]) {
        if (approach === operation.approach) continue;
        const plan = structuredClone(projectResources.assemblyPlan);
        const changed = plan.operations.find((candidate) => candidate.id === operation.id);
        changed.approach = approach;
        const result = analyzeAssemblyPlan(plan);
        addProposal({
          key: `approach:${operation.id}:${approach}`,
          title: `Изменить подход к операции «${operation.name}»`,
          summary: `Текущий подход: ${operation.approach}; вариант: ${label}.`,
          consequences: [
            `Монтажная зона и путь движения будут построены с новой стороны детали.`,
            "Размеры деталей, материал и их положение не изменятся.",
          ],
          plan,
          beforeIssues: baselinePlanIssues,
          afterIssues: result.issues,
        }, baselinePlanIssues, result.issues);
      }

      for (const ratio of [0.75, 0.5]) {
        const newTravel = Math.floor(operation.travel * ratio / 5) * 5;
        if (newTravel >= operation.travel || newTravel < 0) continue;
        const plan = structuredClone(projectResources.assemblyPlan);
        const changed = plan.operations.find((candidate) => candidate.id === operation.id);
        changed.travel = newTravel;
        const result = analyzeAssemblyPlan(plan);
        addProposal({
          key: `travel:${operation.id}:${newTravel}`,
          title: `Сократить подход для «${operation.name}»`,
          summary: `Длина хода: ${operation.travel} → ${newTravel} мм.`,
          consequences: [
            `Расчётная монтажная зона уменьшится на ${operation.travel - newTravel} мм по направлению подхода.`,
            "Проверьте, достаточно ли этого хода для реального инструмента и установки детали.",
          ],
          plan,
          beforeIssues: baselinePlanIssues,
          afterIssues: result.issues,
        }, baselinePlanIssues, result.issues);
      }

      const blockingParts = getProductParts(products.find((item) => item.id === operation.productId) || {})
        .filter((part) => planErrors.some((issue) =>
          issue.startsWith(`${operation.name}: монтажный путь перекрыт уже установленной деталью «${part.name}».`)));
      for (const part of blockingParts) {
        const blocker = projectResources.assemblyPlan.operations.find((candidate) =>
          candidate.kind === "install" && candidate.productId === operation.productId &&
          candidate.targetPartId === part.id && candidate.id !== operation.id);
        if (!blocker) continue;
        const plan = structuredClone(projectResources.assemblyPlan);
        const targetOperation = plan.operations.find((candidate) => candidate.id === operation.id);
        const blockerOperation = plan.operations.find((candidate) => candidate.id === blocker.id);
        targetOperation.dependsOn = targetOperation.dependsOn.filter((id) => id !== blocker.id);
        blockerOperation.dependsOn = [...new Set([...blockerOperation.dependsOn, operation.id])];
        if (!validAssemblyPlan(plan)) continue;
        const result = analyzeAssemblyPlan(plan);
        addProposal({
          key: `order:${operation.id}:${blocker.id}`,
          title: `Установить «${operation.name}» раньше детали «${part.name}»`,
          summary: `Изменить зависимость: ${operation.name} → ${blocker.name}.`,
          consequences: [
            `Деталь «${part.name}» будет устанавливаться после целевой детали проблемной операции.`,
            "Габариты и материалы не изменятся; повторно проверяется весь порядок зависимостей.",
          ],
          plan,
          beforeIssues: baselinePlanIssues,
          afterIssues: result.issues,
        }, baselinePlanIssues, result.issues);
      }
    }
  }

  const motionIssuePattern = /траектория движения|траектория пересекает|конфликт движения/i;
  const hasMotionIssues = baselineMotionIssues.some((issue) => motionIssuePattern.test(issue));
  if (hasMotionIssues) {
    const originalSettings = projectResources.collisionSettings;
    const originalLatestIssues = latestCollisionIssues;
    const originalHighlights = highlightedEnvironmentZoneIds;
    const motionOptions = [
      ...(originalSettings.doorOpenAngle > 30
        ? [{ key: "doorOpenAngle", value: Math.max(30, originalSettings.doorOpenAngle - 15), label: "Уменьшить угол открывания фасада" }]
        : []),
      ...(originalSettings.drawerExtension > 50
        ? [{ key: "drawerExtension", value: Math.max(50, originalSettings.drawerExtension - 50), label: "Уменьшить выдвижение ящика" }]
        : []),
    ];
    for (const option of motionOptions) {
      projectResources.collisionSettings = { ...originalSettings, [option.key]: option.value };
      const candidateMotionIssues = validateMotionAndZones();
      const candidateAllIssues = [...baselinePlanIssues, ...candidateMotionIssues];
      addProposal({
        key: `motion:${option.key}:${option.value}`,
        title: option.label,
        summary: `${option.key === "doorOpenAngle" ? "Угол открывания" : "Ход ящика"}: ${originalSettings[option.key]} → ${option.value}${option.key === "doorOpenAngle" ? "°" : " мм"}.`,
        consequences: [
          option.key === "doorOpenAngle"
            ? `Фасад будет открываться на ${originalSettings.doorOpenAngle - option.value}° меньше.`
            : `Ящик будет выдвигаться на ${originalSettings.drawerExtension - option.value} мм меньше.`,
          "Габариты корпуса и спецификация деталей не изменятся; свободный проём станет меньше.",
        ],
        collisionSettings: { ...projectResources.collisionSettings },
        beforeIssues: [...baselinePlanIssues, ...baselineMotionIssues],
        afterIssues: candidateAllIssues,
      }, [...baselinePlanIssues, ...baselineMotionIssues], candidateAllIssues);
    }
    projectResources.collisionSettings = originalSettings;
    latestCollisionIssues = originalLatestIssues;
    highlightedEnvironmentZoneIds = originalHighlights;
  }

  return proposals.sort((a, b) => b.score - a.score).slice(0, 6);
}

function validateMotionAndZones() {
  const issues = [];
  const settings = projectResources.collisionSettings;
  const zones = projectResources.environmentZones;
  const zoneBoxes = zones.map((zone) => ({
    zone,
    box: { center: [zone.x, zone.y, zone.z], size: [zone.width, zone.height, zone.depth] },
  }));
  const motions = products.flatMap((product) => getMotionAssemblies(product)
    .map((motion) => ({ product, motion })));
  const movingPartKeys = new Set(motions.flatMap(({ product, motion }) =>
    motion.parts.map(({ part }) => `${product.id}:${part.id}`)));
  const fixedParts = products.flatMap((product) => getProductParts(product)
    .filter((part) => !movingPartKeys.has(`${product.id}:${part.id}`))
    .map((part) => ({ product, part, box: boxForPart(part, product) })));
  const motionHits = new Set();
  highlightedEnvironmentZoneIds = new Set();

  for (const { product, part, box } of fixedParts) {
    for (const { zone, box: zoneBox } of zoneBoxes) {
      if (!orientedBoxesIntersect(asOrientedBox(box), asOrientedBox(zoneBox), settings.clearance)) continue;
      highlightedEnvironmentZoneIds.add(zone.id);
      issues.push(`${product.name} · ${part.name}: пересечение с зоной «${zone.name}» (${zoneTypeLabels[zone.type]}); зазор ${settings.clearance} мм.`);
    }
  }

  for (const current of motions) {
    const samples = motionSamples(current.motion, settings);
    const otherMovingParts = motions
      .filter((item) => item.motion.id !== current.motion.id)
      .flatMap((item) => {
        const endpoints = [0, 1].map((progress) =>
          item.motion.parts.map((entry) => motionPose(item.motion, entry, progress, settings)));
        return item.motion.parts.flatMap((entry, index) => [
          { label: `${item.product.name} · ${entry.part.name} (закрыто)`, box: endpoints[0][index] },
          { label: `${item.product.name} · ${entry.part.name} (открыто)`, box: endpoints[1][index] },
        ]);
      });
    for (const progress of samples) {
      for (const entry of current.motion.parts) {
        const movingBox = motionPose(current.motion, entry, progress, settings);
        for (const fixed of fixedParts) {
          const pairClearance = fixed.product.id === current.product.id ? 0 : settings.clearance;
          if (!orientedBoxesIntersect(movingBox, asOrientedBox(fixed.box), pairClearance)) continue;
          const key = `${current.motion.id}:${fixed.product.id}:${fixed.part.id}`;
          if (!motionHits.has(key)) {
            motionHits.add(key);
            issues.push(`${current.motion.name}: траектория движения пересекает ${fixed.product.name} · ${fixed.part.name} (зазор ${settings.clearance} мм).`);
          }
        }
        for (const { zone, box } of zoneBoxes) {
          if (!orientedBoxesIntersect(movingBox, asOrientedBox(box), settings.clearance)) continue;
          const key = `${current.motion.id}:zone:${zone.id}`;
          if (!motionHits.has(key)) {
            motionHits.add(key);
            highlightedEnvironmentZoneIds.add(zone.id);
            issues.push(`${current.motion.name}: траектория пересекает зону «${zone.name}» (${zoneTypeLabels[zone.type]}).`);
          }
        }
        for (const other of otherMovingParts) {
          if (!orientedBoxesIntersect(movingBox, other.box, settings.clearance)) continue;
          const key = `${current.motion.id}:${other.label}`;
          if (!motionHits.has(key)) {
            motionHits.add(key);
            issues.push(`${current.motion.name}: возможный конфликт движения с ${other.label}.`);
          }
        }
      }
    }
  }

  if (settings.toolAccessDepth > 0 && settings.toolAccessWidth > 0) {
    let accessChecks = 0;
    for (const product of products) {
      for (const connection of product.connections || []) {
        const layout = connectionPositions(product, connection);
        if (layout.error) continue;
        const targets = new Set([layout.partA.id, layout.partB.id]);
        for (const entry of layout.entries) {
          accessChecks++;
          const corridor = toolAccessCorridor(product, layout, entry, settings);
          for (const fixed of fixedParts) {
            if (fixed.product.id === product.id && targets.has(fixed.part.id)) continue;
            if (orientedBoxesIntersect(asOrientedBox(corridor), asOrientedBox(fixed.box), settings.clearance)) {
              issues.push(`${product.name} · ${connection.name || "крепёж"}: зона доступа инструмента к крепежу может быть перекрыта деталью «${fixed.part.name}».`);
            }
          }
          for (const { zone, box } of zoneBoxes) {
            if (!orientedBoxesIntersect(asOrientedBox(corridor), asOrientedBox(box), settings.clearance)) continue;
            highlightedEnvironmentZoneIds.add(zone.id);
            issues.push(`${product.name} · ${connection.name || "крепёж"}: зона доступа инструмента пересекается с «${zone.name}».`);
          }
        }
      }
    }
    if (!accessChecks) {
      issues.push("Информация: нет рассчитанных соединений для проверки доступа к крепежу.");
    }
  }

  latestCollisionIssues = [...new Set(issues)];
  return latestCollisionIssues;
}

function validateProject() {
  const issues = [];
  for (const product of products) {
    if (product.type === "cabinet" && !validCabinet(product.parameters)) {
      issues.push(`${product.name}: проверьте размеры и количество элементов.`);
    }
    if (product.type === "cabinet" && !validCabinetPlacement(product)) {
      issues.push(`${product.name}: недопустимы координаты или поворот корпуса.`);
    }
    if (product.type !== "cabinet") continue;
    const connectedHardware = new Set((product.connections || [])
      .flatMap((connection) => connection.componentIds || []));
    if (((product.rotationY || 0) !== 0 || (product.y || 0) !== 0) &&
        (product.hardwareComponents || []).some((component) =>
          component.installationPoint?.kind === "part-reference" && !connectedHardware.has(component.id))) {
      issues.push(`${product.name}: у части фурнитуры сохранено только текстовое место установки; геометрия и ориентация компонента не заданы и не преобразуются.`);
    }
    const p = product.parameters;
    issues.push(...drawerLayoutIssues(product));
    const generated = generatedParts(product).map((part) => ({ part, box: partBox(part, product) }));
    const worldBoxes = [
      ...generated.map(({ box }) => box),
      ...product.customParts.map((part) => panelBox(part, product)),
    ];
    if (worldBoxes.some(boxBelowFloor)) {
      issues.push(`${product.name}: корпус или деталь находится ниже уровня пола (Y=0).`);
    }
    for (const detail of product.customParts) {
      if (
        ![detail.length, detail.width, detail.thickness, detail.x, detail.y, detail.z].every(Number.isFinite) ||
        detail.length <= 0 || detail.width <= 0 || detail.thickness <= 0 ||
        detail.length > p.width || detail.width > p.depth || detail.thickness > p.height
      ) {
        issues.push(`${detail.name}: недопустимый размер детали.`);
        continue;
      }
      const box = panelBox(detail, product);
      if (
        Math.abs(detail.x) + detail.length / 2 > p.width / 2 ||
        detail.y - detail.thickness / 2 < 0 ||
        detail.y + detail.thickness / 2 > p.height ||
        Math.abs(detail.z) + detail.width / 2 > p.depth / 2
      ) issues.push(`${detail.name}: деталь выходит за габариты изделия.`);
      if (generated.some(({ box: part }) => overlaps(box, part))) {
        issues.push(`${detail.name}: возможное пересечение с базовыми деталями (допуск 2 мм).`);
      }
    }
    for (let i = 0; i < product.customParts.length; i++) {
      for (let j = i + 1; j < product.customParts.length; j++) {
        if (overlaps(panelBox(product.customParts[i], product), panelBox(product.customParts[j], product))) {
          issues.push(`${product.customParts[i].name} и ${product.customParts[j].name}: детали пересекаются.`);
        }
      }
    }
    for (const connection of product.connections || []) {
      const joint = connectionPositions(product, connection);
      if (joint.error) issues.push(`${connection.name || "Соединение"}: ${joint.error}`);
    }
  }
  const cabinets = products.filter((item) => item.type === "cabinet" && validCabinet(item.parameters));
  for (let i = 0; i < cabinets.length; i++) {
    for (let j = i + 1; j < cabinets.length; j++) {
      const a = cabinets[i], b = cabinets[j];
      if (cabinetModulesOverlap(a, b)) {
        issues.push(`${a.name} и ${b.name}: габариты изделий пересекаются.`);
      }
    }
  }
  issues.push(...projectSheetFitIssues().issues);
  issues.push(...materialThicknessIssues(products.flatMap((product) =>
    getProductParts(product).map((part) => ({ product, part })))));
  issues.push(...validateMotionAndZones().filter((issue) => !issue.startsWith("Информация:")));
  issues.push(...latestAssemblyAnalysis.issues.filter((issue) => !issue.startsWith("Информация:")));
  return [...new Set(issues)];
}

function displayGeometryIssues(issues) {
  const message = byId("assembly-message");
  message.className = issues.length ? "error" : "valid";
  message.textContent = issues.length
    ? `Проверка выявила ${issues.length} замечаний:\n${issues.slice(0, 5).join("\n")}${issues.length > 5 ? "\n…" : ""}`
    : "Проверка габаритов и пересечений пройдена. Это предварительная геометрическая проверка, не производственный допуск.";
  const report = byId("collision-report");
  if (report) {
    const findings = latestCollisionIssues;
    const warnings = findings.filter((item) => !item.startsWith("Информация:"));
    const information = findings.filter((item) => item.startsWith("Информация:"));
    report.className = warnings.length ? "error" : "valid";
    report.textContent = warnings.length
      ? `Результат расширенной проверки: ${warnings.length} замечаний.\n${warnings.slice(0, 30).map((item) => `• ${item}`).join("\n")}${warnings.length > 30 ? "\n… показаны первые 30" : ""}\n\nПроверка основана на прямоугольных объёмах и дискретных шагах; это не подтверждение производственной пригодности.`
      : `Препятствий на проверенных траекториях не обнаружено. Результат предварительный; проверьте реальные зазоры и данные фурнитуры.${information.length ? `\n${information.join("\n")}` : ""}`;
  }
}

function disposeModel() {
  while (modelGroup.children.length) {
    const object = modelGroup.children.pop();
    modelGroup.remove(object);
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose();
  }
}

function addBox(box, color, selection, key) {
  const geometry = new THREE.BoxGeometry(...box.size.map((value) => value / 1000));
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.73, transparent: color === 0x9eaaad, opacity: color === 0x9eaaad ? 0.82 : 1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...box.center.map((value) => value / 1000));
  const axes = box.axes || identityAxes;
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...axes[0]),
    new THREE.Vector3(...axes[1]),
    new THREE.Vector3(...axes[2]),
  ));
  mesh.userData.selection = selection;
  mesh.userData.key = key;
  modelGroup.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0x26313b, transparent: true, opacity: 0.58 }),
  );
  edges.position.copy(mesh.position);
  edges.quaternion.copy(mesh.quaternion);
  modelGroup.add(edges);
}

function renderModel() {
  disposeModel();
  latestAssemblyAnalysis = analyzeAssemblyPlan();
  const issues = validateProject();
  latestProjectIssues = issues;
  renderAssemblyPlan();
  for (const product of products) {
    if (product.type !== "cabinet") continue;
    const cabinetColor = materialDisplayColor(product.parameters.color);
    for (const part of generatedParts(product)) {
      const box = partBox(part, product);
      const isSelected = selected.productId === product.id && selected.partId === part.id;
      const baseColor = part.material === "ХДФ" ? materialDisplayColor("hdf") : cabinetColor;
      const productColor = selected.productId === product.id
        ? new THREE.Color(baseColor).lerp(new THREE.Color(0x35c9ff), 0.22).getHex()
        : baseColor;
      addBox(box, isSelected ? 0x35c9ff : productColor,
        { productId: product.id, partId: part.id }, `${product.id}:${part.id}`);
    }
    for (const part of product.customParts) {
      const isSelected = selected.productId === product.id && selected.partId === part.id;
      const baseColor = materialDisplayColor(part.material, cabinetColor);
      const productColor = selected.productId === product.id
        ? new THREE.Color(baseColor).lerp(new THREE.Color(0x35c9ff), 0.22).getHex()
        : baseColor;
      addBox(panelBox(part, product), isSelected ? 0x35c9ff : productColor,
        { productId: product.id, partId: part.id }, `${product.id}:${part.id}`);
    }
    for (const connection of product.connections || []) {
      const layout = connectionPositions(product, connection);
      if (layout.error) continue;
      for (const [index, entry] of layout.entries.entries()) {
        addFastener(entry, entry.component?.dimensions?.length || 50, product.id, connection.id, index,
          selected.productId === product.id && selected.connectionId === connection.id);
      }
    }
  }
  for (const zone of projectResources.environmentZones) {
    const color = highlightedEnvironmentZoneIds.has(zone.id) ? 0xff625d :
      zone.type === "ventilation" ? 0xffbd59 :
        zone.type === "service" ? 0xb68bff :
          zone.type === "pipe" ? 0x5de0c2 : 0x58a9ff;
    addOverlayBox(
      { center: [zone.x, zone.y, zone.z], size: [zone.width, zone.height, zone.depth] },
      color,
      0.18,
    );
  }
  if (byId("assembly-plan").open && projectResources.collisionSettings.showSweptEnvelope) {
    for (const { operation, zone } of latestAssemblyAnalysis.zones) {
      const hasIssue = latestAssemblyAnalysis.issues.some((issue) =>
        !issue.startsWith("Информация:") && issue.startsWith(`${operation.name}:`));
      addOverlayBox(zone, hasIssue ? 0xff625d : 0x65d6a5, 0.11);
    }
  }
  if (projectResources.collisionSettings.showSweptEnvelope) {
    for (const product of products) {
      for (const motion of getMotionAssemblies(product)) {
        const samples = motionSamples(motion, projectResources.collisionSettings);
        const points = samples.flatMap((progress) =>
          motion.parts.map((entry) => orientedBoxBounds(
            motionPose(motion, entry, progress, projectResources.collisionSettings),
          )));
        if (!points.length) continue;
        const minimum = [0, 1, 2].map((axis) => Math.min(...points.map((box) => box.center[axis] - box.size[axis] / 2)));
        const maximum = [0, 1, 2].map((axis) => Math.max(...points.map((box) => box.center[axis] + box.size[axis] / 2)));
        addOverlayBox({
          center: minimum.map((value, axis) => (value + maximum[axis]) / 2),
          size: minimum.map((value, axis) => maximum[axis] - value),
        }, 0xffcc66, 0.1);
      }
    }
  }
  for (const box of voiceSetPreviewBoxes) addOverlayBox(box, 0x7ad8ff, 0.16);
  updateProjectSpecification();
  renderFacadeSketch();
  displayGeometryIssues(issues);
  renderFurnitureSetPanel(issues);
  undoHistory.observe();
  renderUndoControls();
  sketchMode?.refresh();
}

// Undo covers the products (cabinets, parts, connections, hardware, sketch layouts);
// catalog and cut settings have their own revisions in «Раскрой, материалы и версии проекта».
const undoHistory = createUndoHistory({
  serialize: () => JSON.stringify(products),
  restore: (text) => { products.splice(0, products.length, ...JSON.parse(text)); },
});

function renderUndoControls() {
  const undoButton = byId("undo");
  const redoButton = byId("redo");
  if (!undoButton || !redoButton) return;
  undoButton.disabled = !undoHistory.undoCount;
  redoButton.disabled = !undoHistory.redoCount;
  undoButton.title = `Отменить (Ctrl+Z) · шагов: ${undoHistory.undoCount}`;
  redoButton.title = `Повторить (Ctrl+Y) · шагов: ${undoHistory.redoCount}`;
}

function stepUndoHistory(direction) {
  const changed = direction < 0 ? undoHistory.undo() : undoHistory.redo();
  if (!changed) return false;
  const product = products.find((item) => item.id === selected.productId);
  if (!product) {
    selected = { productId: products[0]?.id ?? null, partId: null, connectionId: null, hardwareComponentId: null };
  } else if (selected.partId && !getProductParts(product).some((part) => part.id === selected.partId)) {
    selected = { ...selected, partId: null };
  }
  if (selectedProduct()) syncInputs(selectedProduct());
  renderTree();
  buildEditor();
  renderModel();
  return true;
}

function addOverlayBox(box, color, opacity) {
  const geometry = new THREE.BoxGeometry(...box.size.map((value) => Math.max(value, 1) / 1000));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  }));
  mesh.position.set(...box.center.map((value) => value / 1000));
  const axes = box.axes || identityAxes;
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...axes[0]),
    new THREE.Vector3(...axes[1]),
    new THREE.Vector3(...axes[2]),
  ));
  modelGroup.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(0.9, opacity * 4) }),
  );
  edges.position.copy(mesh.position);
  edges.quaternion.copy(mesh.quaternion);
  modelGroup.add(edges);
}

function addFastener(entry, length, productId, connectionId, index, isSelected) {
  const direction = new THREE.Vector3(...entry.direction).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0032, 0.0032, length / 1000, 12),
    new THREE.MeshStandardMaterial({ color: isSelected ? 0x35c9ff : 0xc3cbd2, metalness: 0.7, roughness: 0.3 }),
  );
  const positions = [...entry.center];
  positions[1] += 0;
  shaft.position.set(positions[0] / 1000, positions[1] / 1000, positions[2] / 1000);
  shaft.quaternion.copy(rotation);
  shaft.userData.selection = { productId, connectionId };
  shaft.userData.fastenerIndex = index;
  modelGroup.add(shaft);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.002, 16),
    new THREE.MeshStandardMaterial({ color: isSelected ? 0x35c9ff : 0xffc15a, metalness: 0.35, roughness: 0.45 }),
  );
  const headPosition = [...entry.start];
  for (let axis = 0; axis < 3; axis++) headPosition[axis] -= entry.direction[axis] * 2;
  head.position.set(...headPosition.map((value) => value / 1000));
  head.quaternion.copy(rotation);
  head.userData.selection = { productId, connectionId };
  modelGroup.add(head);

  for (const marker of [
    { point: entry.start, color: 0xffc15a },
    { point: entry.tip, color: 0x55ccff },
  ]) {
    const dot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0045, 0.001, 16),
      new THREE.MeshBasicMaterial({ color: marker.color }),
    );
    dot.position.set(...marker.point.map((value) => value / 1000));
    dot.quaternion.copy(rotation);
    dot.userData.selection = { productId, connectionId };
    modelGroup.add(dot);
  }
}

function updateProjectSpecification() {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") return;
  const items = [...generatedParts(product), ...product.customParts];
  const groups = new Map();
  for (const part of items) {
    const key = [part.name.replace(/ \d+$/, ""), Math.round(part.length), Math.round(part.width), Math.round(part.thickness)].join("|");
    const row = groups.get(key) || { name: part.name.replace(/ \d+$/, ""), size: `${Math.round(part.length)}×${Math.round(part.width)}`, quantity: 0 };
    row.quantity++;
    groups.set(key, row);
  }
  for (const component of product.hardwareComponents || []) {
    const name = `${hardwareCategoryLabels[component.category] || component.category}: ${component.type} ${component.model}`;
    const key = `${component.category}|${component.type}|${component.model}`;
    const row = groups.get(key) || {
      name,
      size: component.dimensions.length ? `${component.dimensions.length} мм` : "—",
      quantity: 0,
    };
    row.quantity++;
    groups.set(key, row);
  }
  byId("parts").innerHTML = [...groups.values()]
    .map((row) => `<tr><td>${escapeHtmlText(row.name)}</td><td>${row.size}</td><td>${row.quantity}</td></tr>`)
    .join("");
  const p = product.parameters;
  const area = items.filter((part) => part.material !== "ХДФ")
    .reduce((sum, part) => sum + part.length * part.width / 1e6, 0);
  const edges = items.reduce((sum, part) => {
    if (!part.edges) return sum;
    return sum + part.edges.reduce((total, on, edge) => total + (on ? (edge < 2 ? part.length : part.width) : 0), 0);
  }, 0) / 1000;
  byId("count").textContent = items.length + (product.hardwareComponents || []).length;
  byId("area").textContent = `${area.toFixed(2)} м²`;
  byId("edge").textContent = `${edges.toFixed(1)} м`;
  byId("dims").textContent = `${p.width} × ${p.height} × ${p.depth}`;
}

function escapeHtmlText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function getProductParts(product) {
  return product.type === "cabinet" ? [...generatedParts(product), ...product.customParts] : [];
}

function materialLabel(material) {
  return projectResources.materials.find((item) => item.code === material)?.name ||
    ({ oak: "Дуб натуральный", white: "Белый", graphite: "Графит", "ЛДСП": "ЛДСП", "ХДФ": "ХДФ" })[material] || material || "Не указан";
}

function materialDisplayColor(code, fallback = colors.oak, materials = projectResources.materials) {
  const hex = materials.find((item) => item.code === code)?.color;
  return hex && materialColorPattern.test(hex) ? parseInt(hex.slice(1), 16) : colors[code] ?? fallback;
}

// Case materials offered for a cabinet: every catalog material except the back-panel HDF,
// plus the current code when it is missing from the catalog, so the select keeps its value.
function caseMaterialOptions(current) {
  const options = projectResources.materials.filter((item) => item.code !== "hdf")
    .map((item) => [item.code, item.name]);
  if (current && !options.some(([code]) => code === current)) options.push([current, `${current} — нет в каталоге`]);
  return options;
}

function refreshMaterialSelects(value = byId("color")?.value) {
  const select = byId("color");
  if (!select) return;
  select.replaceChildren(...caseMaterialOptions(value).map(([code, name]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    return option;
  }));
  select.value = value;
}

function materialThicknessIssues(entries, materials = projectResources.materials) {
  const issues = [];
  for (const { product, part } of entries) {
    const material = materials.find((item) => item.code === projectMaterialCode(product, part));
    if (material?.thickness > 0 && Math.abs(part.thickness - material.thickness) > 0.001) {
      issues.push(`${product.name} · ${part.name}: толщина детали ${part.thickness} мм не совпадает с толщиной материала «${material.name}» ${material.thickness} мм.`);
    }
  }
  return issues;
}

function partEdgeLabel(part) {
  return ["L1", "L2", "W1", "W2"]
    .map((label, index) => `${label}:${part.edges?.[index] ? "да" : "нет"}`)
    .join(", ");
}

function componentReference(product, component) {
  const point = component.installationPoint;
  const parts = getProductParts(product);
  const nameOf = (id) => findPartById(parts, id)?.name || id || "не указана";
  if (point.kind === "joint-edge") {
    return `Общее ребро: ${nameOf(point.partAId)} / ${nameOf(point.partBId)}; отступ ${point.edgeInset} мм; позиция ${(point.distribution?.index ?? 0) + 1}/${point.distribution?.count ?? 1}`;
  }
  return `${nameOf(point.partId)}; ${point.reference}`;
}

function storeLiftCalculation(record) {
  const candidate = structuredClone(record.candidate);
  const saved = {
    ...structuredClone(record),
    id: `lift-calculation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    candidate,
  };
  projectResources.liftCalculations.push(saved);
  projectResources.liftCalculations = projectResources.liftCalculations.slice(-500);
}

function addLiftSpecificationItem(record, calculationId = null) {
  const candidate = record.candidate || record.candidates?.[0];
  if (!candidate || !record.eligible || !Number.isInteger(candidate.quantity) || candidate.quantity < 1) return;
  projectResources.liftSpecificationItems.push({
    id: `lift-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    calculationId,
    system: record.system,
    systemName: record.systemName,
    modelName: candidate.modelName,
    article: candidate.article ?? null,
    summary: record.summary,
    quantity: candidate.quantity,
    unit: candidate.unit || (record.system === "giff" ? "шт." : "позиция"),
    addedAt: new Date().toISOString(),
  });
  projectResources.liftSpecificationItems = projectResources.liftSpecificationItems.slice(-1000);
}

function removeLiftCalculation(id) {
  projectResources.liftCalculations = projectResources.liftCalculations.filter((item) => item.id !== id);
}
function removeLiftSpecificationItem(id) {
  projectResources.liftSpecificationItems = projectResources.liftSpecificationItems.filter((item) => item.id !== id);
}

function specificationRows() {
  const rows = [[
    "Тип записи", "Изделие_ID", "Изделие", "Элемент_ID", "Наименование", "Материал",
    "Длина_X_мм", "Ширина_Z_мм", "Толщина_Y_мм", "Диаметр_мм", "Ширина_мм", "Высота_мм",
    "Кромки_L1_L2_W1_W2", "Количество", "Группа", "Тип", "Модель_артикул",
    "Ссылка_на_элементы", "Операции", "Единица", "Валюта", "Поставщик", "Цена", "Технические_свойства",
    "Канал_данных", "Источник_данных", "Статус_цены", "Источник_цены", "Дата_цены", "Цена_действует_до",
  ]];
  for (const product of products) {
    const parts = getProductParts(product);
    const sourceLabel = product.sourceInfo?.kind === "external-csv"
      ? "Внешний CSV"
      : product.sourceInfo?.kind === "personal-library"
        ? "Личная библиотека"
        : product.sourceInfo?.kind === "builtin-library"
          ? "Библиотека FURNIX"
          : "Проект FURNIX";
    const sourceName = product.sourceInfo?.reference
      ? `${product.sourceInfo.reference} (${product.sourceInfo.name})`
      : product.sourceInfo?.name || "";
    for (const part of parts) {
      const materialCode = projectMaterialCode(product, part);
      const materialData = projectResources.materials.find((item) => item.code === materialCode);
      rows.push([
        "Деталь", product.id, product.name, part.id, part.name, materialData?.name || materialLabel(part.material || product.parameters.color),
        part.length, part.width, part.thickness, "", "", "", partEdgeLabel(part), 1,
        "", "", "", "", "Не заданы в модели", materialData?.unit || "", materialData?.currency || "",
        materialData?.supplier || "", materialData?.price ?? "", materialData?.technology || "",
        sourceLabel, sourceName, materialData?.priceStatus || "needs-review",
        materialData?.priceSource || "", materialData?.priceDate || "", materialData?.priceValidUntil || "",
      ]);
    }
    for (const component of product.hardwareComponents || []) {
      rows.push([
        "Фурнитура", product.id, product.name, component.id, `${hardwareTypeLabels[component.type] || component.type}: ${component.model}`,
        "Металл", component.dimensions.length ?? "", "", "", component.dimensions.diameter ?? "",
        component.dimensions.width ?? "", component.dimensions.height ?? "", "", 1,
        hardwareCategoryLabels[component.category] || component.category, component.type, component.model,
        componentReference(product, component), "Отверстия и операции не заданы", "", "", "", "", "",
        sourceLabel, sourceName, "", "", "", "",
      ]);
    }
  }
  for (const item of projectResources.liftSpecificationItems || []) {
    rows.push([
      "Подъёмник", "lift", item.systemName, item.id, item.modelName, "",
      "", "", "", "", "", "", "", item.quantity,
      "Подъёмники", item.system, item.article || "", item.summary,
      "Производственные операции не заданы", item.unit, "", "Häfele / GIFF", "",
      JSON.stringify({ system: item.system, summary: item.summary, calculationId: item.calculationId }),
      "FURNIX", "Сохранённый расчёт подъёмника", "needs-review", "", "", "",
    ]);
  }
  return rows;
}

function csvText(rows) {
  return `\ufeff${rows.map((row) => row.map((value) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
}

function resourceForm() {
  const form = byId("resource-form");
  if (!form) return;
  const settings = projectResources.cutSettings;
  for (const [key, value] of Object.entries(settings)) form.elements.namedItem(key).value = value;
  form.elements.namedItem("remnants").value = projectResources.remnants
    .map((item) => `${item.material},${item.thickness},${item.width},${item.length}`).join("\n");
  form.elements.namedItem("revision").replaceChildren(...projectResources.history.map((item) => {
    const option = document.createElement("option");
    option.value = item.revision;
    option.textContent = `Редакция ${item.revision} · ${item.savedAt}`;
    return option;
  }));
  const catalog = byId("material-catalog");
  catalog.innerHTML = `<p>Цена и ее источник вводятся вручную или подставляются из прайс-листа ниже. Для включения в расчет материалов используйте цену за лист; неподтвержденные цены не считаются подтвержденной сметой.</p>
    <div id="material-add">
      <strong>Новый материал</strong>
      <label>Код<input id="material-new-code" maxlength="40" placeholder="egger-w1000"></label>
      <label>Название<input id="material-new-name" maxlength="120" placeholder="ЛДСП Egger W1000 белый"></label>
      <label>Толщина, мм<input id="material-new-thickness" type="number" min="0" max="100" step="0.1"></label>
      <label>Лист X, мм<input id="material-new-sheet-width" type="number" min="0" max="10000" step="1"></label>
      <label>Лист Y, мм<input id="material-new-sheet-length" type="number" min="0" max="10000" step="1"></label>
      <label>Текстура<select id="material-new-grain"><option value="directional">Направленная</option><option value="none">Не учитывать</option></select></label>
      <label>Цвет в 3D<input id="material-new-color" type="color" value="#c8c8c8"></label>
      <button type="button" id="material-add-button">Добавить материал</button>
      <p class="note">Код — латиница, цифры, «-» и «_», до 40 символов; после добавления не меняется. Толщина 0 или пусто — не задана. Пустой формат листа — используется формат из основных настроек.</p>
    </div>
    <table><thead><tr><th>Материал</th><th>Толщина, мм</th><th>Цвет 3D</th><th>Ед.</th><th>Валюта</th><th>Поставщик</th><th>Цена</th><th>Статус цены</th><th>Источник</th><th>Дата цены</th><th>Действует до</th><th>Текстура</th><th>Лист X</th><th>Лист Y</th><th>Тех. свойства</th></tr></thead>
    <tbody>${projectResources.materials.map(materialRowHtml).join("")}</tbody></table>`;
  for (const material of projectResources.materials) {
    const row = catalog.querySelector(`tr[data-material="${CSS.escape(material.code)}"]`);
    setMaterialRowSelects(row, material);
  }
  refreshMaterialSelects();
  renderSupplierProfile();
  renderEstimateHistory();
}

function setMaterialRowSelects(row, material) {
  const grain = row?.querySelector('[data-field="grain"]');
  if (grain) grain.value = material.grain || "directional";
  const priceStatus = row?.querySelector('[data-field="priceStatus"]');
  if (priceStatus) priceStatus.value = material.priceStatus || "needs-review";
}

function materialRowHtml(material) {
  const color = materialColorPattern.test(material.color || "")
    ? material.color
    : `#${materialDisplayColor(material.code, colors.oak, []).toString(16).padStart(6, "0")}`;
  return `<tr data-material="${escapeHtmlText(material.code)}">
      <td><input data-field="name" maxlength="120" value="${escapeHtmlText(material.name)}" aria-label="Название материала ${escapeHtmlText(material.code)}"><br><small>${escapeHtmlText(material.code)}</small>
        ${material.code === "hdf" ? "<br><small>задние стенки</small>" : `<br><button type="button" data-material-remove="${escapeHtmlText(material.code)}">Удалить</button>`}</td>
      <td><input data-field="thickness" type="number" min="0" max="100" step="0.1" value="${escapeHtmlText(material.thickness || "")}" aria-label="Толщина ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="color" type="color" value="${escapeHtmlText(color)}" aria-label="Цвет в 3D ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="unit" value="${escapeHtmlText(material.unit)}" aria-label="Единица ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="currency" value="${escapeHtmlText(material.currency)}" aria-label="Валюта ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="supplier" value="${escapeHtmlText(material.supplier)}" aria-label="Поставщик ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="price" type="number" min="0" step="any" value="${escapeHtmlText(material.price)}" aria-label="Цена ${escapeHtmlText(material.name)}"></td>
      <td><select data-field="priceStatus" aria-label="Статус цены ${escapeHtmlText(material.name)}">
        <option value="needs-review">Требует проверки</option><option value="confirmed">Подтверждена вручную</option>
        <option value="expired">Устарела</option></select></td>
      <td><input data-field="priceSource" maxlength="500" value="${escapeHtmlText(material.priceSource || "")}" aria-label="Источник цены ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="priceDate" type="date" value="${escapeHtmlText(material.priceDate || "")}" aria-label="Дата цены ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="priceValidUntil" type="date" value="${escapeHtmlText(material.priceValidUntil || "")}" aria-label="Срок действия цены ${escapeHtmlText(material.name)}"></td>
      <td><select data-field="grain" aria-label="Текстура ${escapeHtmlText(material.name)}"><option value="directional">Направленная</option><option value="none">Не учитывать</option></select></td>
      <td><input data-field="sheetWidth" type="number" min="0" max="10000" step="1" value="${escapeHtmlText(material.sheetWidth || "")}" aria-label="Лист X ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="sheetLength" type="number" min="0" max="10000" step="1" value="${escapeHtmlText(material.sheetLength || "")}" aria-label="Лист Y ${escapeHtmlText(material.name)}"></td>
      <td><input data-field="technology" value="${escapeHtmlText(material.technology || "")}" aria-label="Технологические свойства ${escapeHtmlText(material.name)}"></td>
    </tr>`;
}

function newCatalogMaterial(values, existingCodes) {
  const code = values.code.trim();
  const name = values.name.trim();
  const thickness = values.thickness === "" ? 0 : Number(values.thickness);
  const sheetWidth = values.sheetWidth === "" ? 0 : Number(values.sheetWidth);
  const sheetLength = values.sheetLength === "" ? 0 : Number(values.sheetLength);
  if (!materialCodePattern.test(code)) {
    throw new Error("Код материала: латиница в нижнем регистре, цифры, «-» и «_», до 40 символов.");
  }
  if (existingCodes.includes(code)) throw new Error(`Материал с кодом «${code}» уже есть в каталоге.`);
  if (!name || name.length > 120) throw new Error("Укажите название материала (до 120 символов).");
  if (!Number.isFinite(thickness) || thickness < 0 || thickness > 100) throw new Error("Толщина материала — от 0 до 100 мм.");
  if (![sheetWidth, sheetLength].every((value) => Number.isFinite(value) && value >= 0 && value <= 10000)) {
    throw new Error("Формат листа — от 0 до 10000 мм.");
  }
  if (!["directional", "none"].includes(values.grain)) throw new Error("Выберите текстуру материала.");
  if (!materialColorPattern.test(values.color)) throw new Error("Цвет в 3D задаётся в виде #rrggbb.");
  return {
    code, name, thickness, color: values.color.toLowerCase(),
    unit: "лист", currency: "", supplier: "", price: "", priceSource: "", priceDate: "", priceValidUntil: "",
    priceStatus: "needs-review", grain: values.grain, sheetWidth, sheetLength, technology: "",
  };
}

let priceListIndex = null;
const priceListCache = new Map();
let priceListSearchTimer = null;

function validPriceListIndex(index) {
  return !!index && index.schemaVersion === 1 && Array.isArray(index.lists) &&
    index.lists.every((entry) => entry && typeof entry.path === "string" &&
      /^[a-z0-9_-]+\/\d{2}\.json$/.test(entry.path) &&
      typeof entry.category === "string" && typeof entry.supplier === "string" &&
      typeof entry.currency === "string" && typeof entry.fileDate === "string" &&
      entry.stats && Number.isInteger(entry.stats.items));
}

function validPriceList(list) {
  return !!list && list.schemaVersion === 1 && Array.isArray(list.items) &&
    list.items.every((item) => item && typeof item.article === "string" && typeof item.name === "string" &&
      (item.price === null || Number.isFinite(item.price)) &&
      (item.unit === null || typeof item.unit === "string"));
}

function normalizedPriceSearchText(value) {
  // Price names mix Latin "x", Cyrillic "х" and "×" in sizes such as 2800x2070x18.
  return String(value).toLocaleLowerCase().replace(/[х×*]/g, "x").replace(/ё/g, "е");
}

function searchPriceItems(items, query, limit = 50) {
  const tokens = normalizedPriceSearchText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return { total: 0, items: [] };
  const found = items.filter((item) => {
    const text = normalizedPriceSearchText(`${item.article} ${item.name} ${item.group || ""}`);
    return tokens.every((token) => text.includes(token));
  });
  return { total: found.length, items: found.slice(0, limit) };
}

function priceItemAssignable(item) {
  return item.attributes?.kind === "board" && item.unit === "лист" && Number.isFinite(item.price) && item.price > 0;
}

function priceItemMaterialFields(item, list) {
  return {
    unit: "лист",
    currency: list.currency,
    supplier: list.supplier,
    price: item.price,
    priceStatus: "needs-review",
    priceSource: `${list.supplier}, арт. ${item.article} «${item.name}»; файл «${list.sourceFile}»; ${list.sourceUrl}`.slice(0, 500),
    priceDate: list.fileDate,
    priceValidUntil: "",
    sheetWidth: item.attributes.sheetWidth,
    sheetLength: item.attributes.sheetLength,
  };
}

async function loadPriceListIndex() {
  const sources = byId("price-list-sources");
  try {
    const response = await fetch("prices/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    if (!validPriceListIndex(index)) throw new Error("формат индекса не распознан");
    priceListIndex = index;
    const select = byId("price-list-select");
    addSelectOptions(select, index.lists.map((entry, position) => [String(position),
      `${entry.category} · ${entry.supplier} · ${entry.stats.items} поз. · файл от ${entry.fileDate}`]), select.value);
    sources.textContent = index.lists.length
      ? `Установлено прайс-листов: ${index.lists.length}, позиций: ${index.lists.reduce((sum, entry) => sum + entry.stats.items, 0)}. Валюта: ${[...new Set(index.lists.map((entry) => entry.currency))].join(", ")}. Без единицы измерения: ${index.lists.reduce((sum, entry) => sum + (entry.stats.withoutUnit || 0), 0)} поз., без цены: ${index.lists.reduce((sum, entry) => sum + (entry.stats.withoutPrice || 0), 0)} поз. — такие позиции не используются в расчётах, пока не будут уточнены.`
      : "Прайс-листы не установлены.";
  } catch (error) {
    priceListIndex = null;
    sources.textContent = `Прайс-листы не загружены (${error.message}). Откройте FURNIX через локальный сервер и проверьте папку prices/.`;
  }
}

async function selectedPriceList() {
  const entry = priceListIndex?.lists[Number(byId("price-list-select").value)];
  if (!entry) return null;
  if (!priceListCache.has(entry.path)) {
    const response = await fetch(`prices/${entry.path}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`прайс «${entry.category}» не загружен (HTTP ${response.status})`);
    const list = await response.json();
    if (!validPriceList(list)) throw new Error(`прайс «${entry.category}» имеет неизвестный формат`);
    priceListCache.set(entry.path, list);
  }
  return priceListCache.get(entry.path);
}

async function renderPriceListResults() {
  const results = byId("price-list-results");
  const status = byId("price-list-status");
  try {
    const list = await selectedPriceList();
    if (!list) {
      results.replaceChildren();
      return;
    }
    const query = byId("price-list-search").value;
    const found = searchPriceItems(list.items, query);
    if (!query.trim()) {
      results.replaceChildren();
      status.textContent = `Прайс «${list.category}»: ${list.items.length} позиций. Введите артикул или слова из названия.`;
      return;
    }
    const materialOptions = projectResources.materials
      .map((material) => `<option value="${escapeHtmlText(material.code)}">${escapeHtmlText(material.name)}</option>`).join("");
    results.innerHTML = found.items.length
      ? `<table><thead><tr><th>Артикул</th><th>Название</th><th>Группа</th><th>Цена, ${escapeHtmlText(list.currency)}</th><th>Ед.</th><th>В FURNIX</th></tr></thead><tbody>${found.items.map((item) => `<tr>
        <td>${escapeHtmlText(item.article)}</td>
        <td>${escapeHtmlText(item.name)}</td>
        <td>${escapeHtmlText(item.group || "")}</td>
        <td>${item.price === null ? "нет цены" : escapeHtmlText(item.price)}</td>
        <td>${item.unit === null ? "не указана" : escapeHtmlText(item.unit)}</td>
        <td>${priceItemAssignable(item)
          ? `<select data-price-material aria-label="Материал для артикула ${escapeHtmlText(item.article)}">${materialOptions}</select><button type="button" data-price-assign="${escapeHtmlText(item.article)}">Назначить материалу</button>`
          : "—"}</td>
      </tr>`).join("")}</tbody></table>`
      : "<p>Ничего не найдено.</p>";
    status.textContent = `Найдено: ${found.total}${found.total > found.items.length ? `, показаны первые ${found.items.length}` : ""}. Назначить материалу можно плиту с ценой за лист и форматом в названии.`;
  } catch (error) {
    results.replaceChildren();
    status.textContent = `Ошибка прайс-листа: ${error.message}.`;
  }
}

async function assignPriceItemToMaterial(article, materialCode) {
  const list = await selectedPriceList();
  const item = list?.items.find((candidate) => candidate.article === article);
  const status = byId("price-list-status");
  const row = byId("material-catalog").querySelector(`tr[data-material="${CSS.escape(materialCode)}"]`);
  if (!item || !priceItemAssignable(item) || !row) {
    status.textContent = "Позицию нельзя назначить материалу: нужна плита с ценой за лист и форматом в названии.";
    return;
  }
  const fields = priceItemMaterialFields(item, list);
  for (const [field, value] of Object.entries(fields)) {
    const input = row.querySelector(`[data-field="${field}"]`);
    if (input) input.value = String(value);
  }
  const material = projectResources.materials.find((candidate) => candidate.code === materialCode);
  const usedThicknesses = [...new Set(products.flatMap((product) => getProductParts(product)
    .filter((part) => projectMaterialCode(product, part) === materialCode)
    .map((part) => part.thickness)))];
  const thicknessNote = usedThicknesses.length && !usedThicknesses.includes(item.attributes.thickness)
    ? `\nВнимание: в прайсе толщина ${item.attributes.thickness} мм, а детали проекта из этого материала имеют толщину ${usedThicknesses.join(", ")} мм. Проверьте, та ли позиция выбрана.`
    : "";
  status.textContent = `Материал «${material?.name || materialCode}»: подставлены цена ${item.price} ${list.currency} за лист, формат ${item.attributes.sheetWidth}×${item.attributes.sheetLength} мм, поставщик ${list.supplier}, источник — арт. ${item.article}, дата файла ${list.fileDate}. Статус цены — «Требует проверки». Нажмите «Сохранить ресурсы и настройки», чтобы записать изменения в проект.${thicknessNote}`;
}

byId("price-list-select").addEventListener("change", renderPriceListResults);
byId("price-list-search").addEventListener("input", () => {
  clearTimeout(priceListSearchTimer);
  priceListSearchTimer = setTimeout(renderPriceListResults, 200);
});
byId("price-list-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
});
byId("price-list-results").addEventListener("click", (event) => {
  const button = event.target.closest("[data-price-assign]");
  if (!button) return;
  const materialCode = button.parentElement.querySelector("[data-price-material]").value;
  assignPriceItemToMaterial(button.dataset.priceAssign, materialCode);
});
loadPriceListIndex();

function readResourceForm() {
  const form = byId("resource-form");
  const number = (name) => Number(form.elements.namedItem(name).value);
  const cutSettings = {
    trim: number("trim"),
    minRemnant: number("minRemnant"),
    machineLength: number("machineLength"),
    machineWidth: number("machineWidth"),
  };
  if (!Object.values(cutSettings).every(Number.isFinite) ||
      cutSettings.trim < 0 || cutSettings.trim > 100 ||
      cutSettings.minRemnant < 0 || cutSettings.minRemnant > 3000 ||
      cutSettings.machineLength < 0 || cutSettings.machineLength > 10000 ||
      cutSettings.machineWidth < 0 || cutSettings.machineWidth > 10000) {
    throw new Error("Проверьте припуск, минимальный остаток и ограничения станка.");
  }
  const materials = [...byId("material-catalog").querySelectorAll("tbody tr")].map((row) => {
    const values = Object.fromEntries([...row.querySelectorAll("[data-field]")].map((input) =>
      [input.dataset.field, input.value.trim()]));
    const price = values.price === "" ? "" : Number(values.price);
    const sheetWidth = values.sheetWidth === "" ? 0 : Number(values.sheetWidth);
    const sheetLength = values.sheetLength === "" ? 0 : Number(values.sheetLength);
    const thickness = values.thickness === "" ? 0 : Number(values.thickness);
    if (!values.name || values.name.length > 120 ||
        !Number.isFinite(thickness) || thickness < 0 || thickness > 100 ||
        !materialColorPattern.test(values.color)) {
      throw new Error(`Материал «${row.dataset.material}»: проверьте название, толщину (0–100 мм) и цвет.`);
    }
    if (!values.unit || values.unit.length > 20 || values.currency.length > 8 ||
        values.supplier.length > 120 || values.technology.length > 200 ||
        values.priceSource.length > 500 ||
        (values.priceDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.priceDate)) ||
        (values.priceValidUntil && !/^\d{4}-\d{2}-\d{2}$/.test(values.priceValidUntil)) ||
        !["needs-review", "confirmed", "expired"].includes(values.priceStatus) ||
        (price !== "" && (!Number.isFinite(price) || price < 0)) ||
        !Number.isFinite(sheetWidth) || !Number.isFinite(sheetLength) ||
        sheetWidth < 0 || sheetWidth > 10000 || sheetLength < 0 || sheetLength > 10000 ||
        !["directional", "none"].includes(values.grain)) {
      throw new Error("Проверьте единицы, валюту, поставщика, цену и технические свойства материала.");
    }
    const source = projectResources.materials.find((item) => item.code === row.dataset.material);
    return {
      ...source,
      code: row.dataset.material,
      name: values.name,
      thickness,
      color: values.color.toLowerCase(),
      unit: values.unit,
      currency: values.currency,
      supplier: values.supplier,
      price,
      priceSource: values.priceSource,
      priceDate: values.priceDate,
      priceValidUntil: values.priceValidUntil,
      priceStatus: values.priceStatus,
      grain: values.grain,
      sheetWidth,
      sheetLength,
      technology: values.technology,
    };
  });
  const codes = materials.map((material) => material.code);
  if (!codes.includes("hdf")) throw new Error("Материал hdf нужен для задних стенок и не может быть удалён.");
  const used = [...new Set(products.flatMap((product) =>
    getProductParts(product).map((part) => projectMaterialCode(product, part))))];
  const missing = used.filter((code) => !codes.includes(code) &&
    projectResources.materials.some((material) => material.code === code));
  if (missing.length) {
    throw new Error(`Материал ${missing.map((code) => `«${code}»`).join(", ")} используется в проекте и не может быть удалён. Сначала смените материал корпусов и деталей.`);
  }
  const remnants =form.elements.namedItem("remnants").value.split(/\r?\n/)
    .map((line) => line.trim()).filter(Boolean).map((line, index) => {
      const [material, thicknessText, widthText, lengthText] = line.split(",").map((value) => value.trim());
      const thickness = Number(thicknessText), width = Number(widthText), length = Number(lengthText);
      if (!materials.some((item) => item.code === material) ||
          ![thickness, width, length].every(Number.isFinite) ||
          thickness <= 0 || thickness > 100 || width <= 0 || width > 10000 ||
          length <= 0 || length > 10000) {
        throw new Error(`Некорректный остаток «${line}». Формат: код,толщина,ширина,длина.`);
      }
      return { id: `remnant-${index + 1}-${material}-${thickness}-${width}-${length}`, material, thickness, width, length };
    });
  if (remnants.some((item) =>
    (cutSettings.machineWidth && item.width > cutSettings.machineWidth) ||
    (cutSettings.machineLength && item.length > cutSettings.machineLength))) {
    throw new Error("Размер введённого остатка превышает заданные ограничения станка.");
  }
  return { cutSettings, materials, remnants };
}

function saveSupplierProfile() {
  const form = byId("supplier-profile-form");
  if (!form) return;
  const parseList = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const profile = {
    ...(projectResources.supplierProfile || defaultSupplierProfile()),
    id: String(form.elements.namedItem("supplier-id").value || "custom-supplier").trim() || "custom-supplier",
    name: String(form.elements.namedItem("supplier-name").value || "").trim() || "Новый подрядчик",
    country: String(form.elements.namedItem("supplier-country").value || "").trim() || "Не указано",
    orderChannel: String(form.elements.namedItem("supplier-order").value || "").trim() || "Не указано",
    status: String(form.elements.namedItem("supplier-status").value || "needs-confirmation").trim(),
    services: parseList(form.elements.namedItem("supplier-services").value),
    acceptedFormats: parseList(form.elements.namedItem("supplier-formats").value),
    lastVerifiedAt: String(form.elements.namedItem("supplier-last-verified").value || "").trim(),
    sources: parseList(form.elements.namedItem("supplier-sources").value).map((item) => {
      const normalized = /^https?:\/\//i.test(item) ? item : `https://${item}`;
      return normalized;
    }),
  };
  if (!validSupplierProfile(profile)) {
    throw new Error("Проверьте поля профиля: id, название, страна, канал, услуги и ссылки должны быть корректными.");
  }
  projectResources.supplierProfile = structuredClone(profile);
  renderSupplierProfile();
  renderEstimateHistory();
  byId("resource-status").textContent = `Профиль подрядчика ${profile.name} сохранён. Он не считается производственно подтверждённым без проверки актуальной документации и тарифов.`;
  byId("resource-status").className = "note";
}

function renderSupplierProfile() {
  const profile = projectResources.supplierProfile || defaultSupplierProfile();
  byId("supplier-profile").innerHTML = `
    <h3>Профиль подрядчика</h3>
    <form id="supplier-profile-form">
      <label>Идентификатор профиля
        <input name="supplier-id" value="${escapeHtmlText(profile.id)}" maxlength="80">
      </label>
      <label>Название подрядчика
        <input name="supplier-name" value="${escapeHtmlText(profile.name)}" maxlength="120">
      </label>
      <label>Страна
        <input name="supplier-country" value="${escapeHtmlText(profile.country)}" maxlength="80">
      </label>
      <label>Канал заказа
        <input name="supplier-order" value="${escapeHtmlText(profile.orderChannel)}" maxlength="120">
      </label>
      <label>Статус
        <select name="supplier-status">
          <option value="needs-confirmation" ${profile.status === "needs-confirmation" ? "selected" : ""}>Нужно подтвердить</option>
          <option value="verified" ${profile.status === "verified" ? "selected" : ""}>Подтверждён</option>
          <option value="ready-for-test" ${profile.status === "ready-for-test" ? "selected" : ""}>Готов к пилоту</option>
          <option value="inactive" ${profile.status === "inactive" ? "selected" : ""}>Неактивен</option>
        </select>
      </label>
      <label>Услуги (через запятую)
        <input name="supplier-services" value="${escapeHtmlText(profile.services.join(", "))}" maxlength="500">
      </label>
      <label>Поддерживаемые форматы (через запятую)
        <input name="supplier-formats" value="${escapeHtmlText(profile.acceptedFormats.join(", "))}" maxlength="500">
      </label>
      <label>Дата последней проверки
        <input name="supplier-last-verified" type="date" value="${escapeHtmlText(profile.lastVerifiedAt || "")}">
      </label>
      <label>Ссылки справки (через запятую)
        <input name="supplier-sources" value="${escapeHtmlText(profile.sources.join(", "))}" maxlength="1200">
      </label>
      <button type="button" id="supplier-profile-save">Сохранить профиль</button>
    </form>
    <p class="unverified">Черновик · данные фирмы считаются подтверждёнными только после сверки с реальным профилем подрядчика и актуальными документами.</p>
    <p>Публично заявленные услуги: ${profile.services.map(escapeHtmlText).join(", ")}. Канал: ${escapeHtmlText(profile.orderChannel)}.</p>
    <p>В справке опубликован CSV-формат списка деталей; перед производственным заказом сверьте импорт и правила в кабинете подрядчика. FURNIX не отправляет заказ автоматически.</p>
    <p>Источники справки: ${profile.sources.map((url, index) =>
    `<a href="${escapeHtmlText(url)}" target="_blank" rel="noopener noreferrer">Источник ${index + 1}</a>`).join(" · ")}</p>`;
  byId("supplier-profile-save")?.addEventListener("click", saveSupplierProfile);
}
const selectedEstimateIds = new Set();

function renderEstimateHistory() {
  const root = byId("estimate-history");
  if (!root) return;
  const storedIds = new Set(projectResources.estimates.map((estimate) => estimate.id));
  for (const id of selectedEstimateIds) if (!storedIds.has(id)) selectedEstimateIds.delete(id);
  const archiveButton = byId("estimate-archive-selected");
  if (archiveButton) {
    archiveButton.textContent = `Архивировать выбранные (${selectedEstimateIds.size})`;
    archiveButton.disabled = !selectedEstimateIds.size;
  }
  root.replaceChildren(...projectResources.estimates.slice().reverse().map((estimate) => {
    const row = document.createElement("article");
    row.className = "estimate-row";
    const totals = estimate.totals.length
      ? estimate.totals.map(({ currency, amount }) => `${amount.toFixed(2)} ${currency}`).join(" · ")
      : "Нет рассчитанной стоимости";
    row.innerHTML = `<strong>Смета v${estimate.revision} · ${escapeHtmlText(new Date(estimate.createdAt).toLocaleString())}</strong>
      <span>${estimate.status === "materials-priced"
    ? "Листовые материалы оценены; смета не полная"
    : "Черновик с пробелами"} · ${escapeHtmlText(totals)}</span>
      <label><input type="checkbox" data-select-estimate="${escapeHtmlText(estimate.id)}"${selectedEstimateIds.has(estimate.id) ? " checked" : ""}> выбрать</label>
      <button type="button" data-export-estimate="${escapeHtmlText(estimate.id)}">Скачать JSON</button>
      <button type="button" data-archive-estimate="${escapeHtmlText(estimate.id)}">В архив</button>`;
    return row;
  }));
}

// One archive file per project: the chosen versions of its estimate history, oldest first.
function estimateArchiveFile(estimates, now = new Date()) {
  const ordered = estimates.slice().sort((a, b) => a.revision - b.revision);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const versions = ordered.length === 1 ? `v${ordered[0].revision}` : `v${ordered[0].revision}-v${ordered.at(-1).revision}`;
  return {
    name: `furnix-estimates-archive-${versions}-${date}.json`,
    data: JSON.stringify({
      format: "furnix.estimate-archive",
      version: 1,
      archivedAt: now.toISOString(),
      project: {
        products: products.map((product) => product.name),
        revisions: ordered.map((estimate) => estimate.revision),
      },
      estimates: ordered,
    }, null, 2),
  };
}

function estimateArchiveMessage(estimates, fileName, remove) {
  const versions = estimates.slice().sort((a, b) => a.revision - b.revision)
    .map((estimate) => `v${estimate.revision} от ${new Date(estimate.createdAt).toLocaleString()}`);
  return `Архивировать ${estimates.length === 1 ? "смету" : `сметы проекта (${estimates.length} шт.)`} в файл ${fileName}?\n\n${versions.join("\n")}\n\n${remove
    ? "После скачивания эти сметы будут удалены из проекта."
    : "Сметы останутся в проекте."}`;
}

// Asks before every archive; returns a status line, or "" when the user declined.
function archiveEstimates(ids, remove) {
  const chosen = projectResources.estimates.filter((estimate) => ids.includes(estimate.id));
  if (!chosen.length) throw new Error("Выберите хотя бы одну смету для архива.");
  const file = estimateArchiveFile(chosen);
  if (!confirm(estimateArchiveMessage(chosen, file.name, remove))) return "";
  downloadFile(file.name, file.data, "application/json");
  const versions = chosen.map((estimate) => `v${estimate.revision}`).join(", ");
  if (remove) {
    projectResources.estimates = projectResources.estimates.filter((estimate) => !ids.includes(estimate.id));
  }
  for (const id of ids) selectedEstimateIds.delete(id);
  return `В архив ${file.name}: ${versions}.${remove
    ? " Сметы удалены из проекта; сохраните проект JSON, чтобы записать изменение на диск."
    : " Сметы остались в проекте."}`;
}

function sheetPriceUnit(unit) {
  return ["лист", "листы", "листов", "sheet", "sheets"].includes(unit.trim().toLowerCase());
}

const estimateLimit = 50;

// Versions that adding one more estimate pushes out of the stored history.
function estimatesRemovedOnAdd(estimates, limit = estimateLimit) {
  return estimates.slice(0, Math.max(0, estimates.length + 1 - limit));
}

function estimateRemovalMessage(removed) {
  const oldest = removed[0];
  return `В проекте хранится не больше ${estimateLimit} смет. Самая старая смета от ${new Date(oldest.createdAt).toLocaleString()} (v${oldest.revision}) будет удалена.${removed.length > 1 ? ` Всего удаляется смет: ${removed.length}.` : ""}\n\nСначала скачать старые сметы файлом?\nOK — скачать и продолжить, Отмена — продолжить без скачивания.`;
}

function estimateFile(estimate) {
  return {
    name: `furnix-estimate-v${estimate.revision}.json`,
    data: JSON.stringify({ format: "furnix.estimate", version: 1, estimate }, null, 2),
  };
}

// beforeRemove(removed) is called only when the new version pushes old ones out of the history.
function makeEstimate(beforeRemove = () => {}) {
  if (cutPlanSignature !== currentCutSignature() || !cutPlanResult.length) {
    throw new Error("Смету по материалам можно зафиксировать только после актуального расчета раскроя.");
  }
  const { materials, cutSettings } = readResourceForm();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const sheetCounts = new Map();
  for (const sheet of cutPlanResult) {
    if (sheet.kind !== "board") continue;
    const key = `${sheet.material}|${sheet.thickness}|${sheet.width}|${sheet.length}`;
    sheetCounts.set(key, (sheetCounts.get(key) || 0) + 1);
  }
  const lines = [...sheetCounts].map(([key, quantity]) => {
    const [materialCode, thickness, width, length] = key.split("|");
    const material = materials.find((item) => item.code === materialCode);
    if (!material) throw new Error(`Материал «${materialCode}» отсутствует в каталоге.`);
    const expiredByDate = material.priceValidUntil && material.priceValidUntil < today;
    const priceStatus = expiredByDate ? "expired" : (material.priceStatus || "needs-review");
    const unitPrice = material.price !== "" && sheetPriceUnit(material.unit) ? material.price : null;
    const currency = material.currency.trim();
    const priced = unitPrice !== null && currency.length > 0 && priceStatus !== "expired";
    return {
      materialCode,
      name: material.name,
      thicknessMm: Number(thickness),
      sheetSizeMm: [Number(width), Number(length)],
      quantity,
      unit: material.unit,
      unitPrice,
      currency,
      amount: priced ? Math.round(quantity * unitPrice * 100) / 100 : null,
      priceStatus,
      supplier: material.supplier,
      priceSource: material.priceSource || "",
      priceDate: material.priceDate || "",
      priceValidUntil: material.priceValidUntil || "",
      excludedReason: priced ? "" : (priceStatus === "expired"
        ? "Цена просрочена; она сохранена в снимке, но исключена из текущей суммы."
        : unitPrice === null
          ? "Нужна цена за лист; иная единица не пересчитывается автоматически."
          : "Не указана валюта."),
    };
  });
  const currencies = [...new Set(lines.filter((line) => line.amount !== null).map((line) => line.currency))];
  const totals = currencies.map((currency) => ({
    currency,
    amount: Math.round(lines.filter((line) => line.currency === currency)
      .reduce((sum, line) => sum + (line.amount || 0), 0) * 100) / 100,
  }));
  const allPriced = lines.length > 0 && lines.every((line) =>
    line.amount !== null && line.priceStatus === "confirmed" && line.priceSource && line.priceDate);
  const revision = (projectResources.estimates.at(-1)?.revision || 0) + 1;
  const estimate = {
    id: `estimate-${Date.now()}-${revision}`,
    revision,
    createdAt: new Date().toISOString(),
    status: allPriced ? "materials-priced" : "incomplete",
    supplierProfile: structuredClone(projectResources.supplierProfile || defaultSupplierProfile()),
    project: {
      products: structuredClone(products),
      settings: {
        sheet: byId("sheet").value,
        kerf: Number(byId("kerf").value),
        edgeThickness: Number(byId("edgeThickness").value),
      },
      cutSettings: structuredClone(cutSettings),
      cutPlan: structuredClone(cutPlanResult),
      materialPrices: structuredClone(materials),
    },
    lines,
    totals,
    exclusions: [
      "Кромка и услуги раскроя, присадки, фрезеровки не оценены.",
      "Не включены фурнитура, доставка, налоги и скидки.",
      "Профиль ВИЯР не подтверждает формат импорта, цены или условия конкретного филиала.",
    ],
  };
  const removed = estimatesRemovedOnAdd(projectResources.estimates);
  if (removed.length) beforeRemove(removed);
  projectResources.estimates.push(estimate);
  projectResources.estimates = projectResources.estimates.slice(-estimateLimit);
  return estimate;
}

function projectSnapshot() {
  return {
    products: structuredClone(products),
    resources: structuredClone({
      cutSettings: projectResources.cutSettings,
      collisionSettings: projectResources.collisionSettings,
      environmentZones: projectResources.environmentZones,
      assemblyPlan: projectResources.assemblyPlan,
      materials: projectResources.materials,
      remnants: projectResources.remnants,
      supplierProfile: projectResources.supplierProfile,
      liftCalculations: projectResources.liftCalculations,
      liftSpecificationItems: projectResources.liftSpecificationItems,
    }),
    settings: {
      sheet: byId("sheet").value,
      kerf: Number(byId("kerf").value),
      edgeThickness: Number(byId("edgeThickness").value),
    },
  };
}

function validSupplierProfile(profile) {
  return profile && typeof profile.id === "string" && profile.id.length > 0 && profile.id.length <= 120 &&
    typeof profile.name === "string" && profile.name.length > 0 && profile.name.length <= 120 &&
    typeof profile.country === "string" && profile.country.length > 0 && profile.country.length <= 80 &&
    typeof profile.orderChannel === "string" && profile.orderChannel.length > 0 && profile.orderChannel.length <= 120 &&
    ["needs-confirmation", "verified", "ready-for-test", "inactive"].includes(profile.status || "needs-confirmation") &&
    Array.isArray(profile.services) && profile.services.length > 0 && profile.services.length <= 20 &&
    profile.services.every((service) => typeof service === "string" && service.length > 0 && service.length <= 100) &&
    Array.isArray(profile.acceptedFormats) && profile.acceptedFormats.length > 0 && profile.acceptedFormats.length <= 30 &&
    profile.acceptedFormats.every((format) => typeof format === "string" && format.length > 0 && format.length <= 200) &&
    typeof profile.lastVerifiedAt === "string" &&
    Array.isArray(profile.sources) && profile.sources.length > 0 && profile.sources.length <= 20 &&
    profile.sources.every((source) => typeof source === "string" && /^https?:\/\/[^\s]+$/.test(source));
}
function validEstimate(estimate) {
  return estimate && typeof estimate.id === "string" && estimate.id.length <= 100 &&
    Number.isInteger(estimate.revision) && estimate.revision > 0 &&
    typeof estimate.createdAt === "string" && !Number.isNaN(Date.parse(estimate.createdAt)) &&
    ["materials-priced", "incomplete"].includes(estimate.status) &&
    validSupplierProfile(estimate.supplierProfile) &&
    estimate.project && Array.isArray(estimate.project.products) &&
    estimate.project.products.length > 0 && estimate.project.products.length <= 100 &&
    estimate.project.products.every((product) => product?.type === "cabinet" &&
      typeof product.id === "string" && validCabinet(product.parameters)) &&
    estimate.project.settings &&
    ["2800x2070", "2750x1830", "2440x1220"].includes(estimate.project.settings.sheet) &&
    Number.isFinite(estimate.project.settings.kerf) &&
    [0.4, 2].includes(estimate.project.settings.edgeThickness) &&
    Array.isArray(estimate.project.cutPlan) && estimate.project.cutPlan.length <= 500 &&
    Array.isArray(estimate.project.materialPrices) && estimate.project.materialPrices.length <= 100 &&
    Array.isArray(estimate.lines) && estimate.lines.length <= 1000 &&
    estimate.lines.every((line) => line && typeof line.materialCode === "string" &&
      typeof line.name === "string" && Number.isFinite(line.quantity) && line.quantity >= 0 &&
      typeof line.unit === "string" && (line.unitPrice === null ||
        (Number.isFinite(line.unitPrice) && line.unitPrice >= 0)) &&
      (line.amount === null || (Number.isFinite(line.amount) && line.amount >= 0)) &&
      typeof line.currency === "string" && ["needs-review", "confirmed", "expired"].includes(line.priceStatus) &&
      (line.priceValidUntil === undefined || typeof line.priceValidUntil === "string")) &&
    Array.isArray(estimate.totals) && estimate.totals.length <= 10 &&
    estimate.totals.every((total) => typeof total.currency === "string" &&
      Number.isFinite(total.amount) && total.amount >= 0) &&
    Array.isArray(estimate.exclusions) && estimate.exclusions.length <= 30 &&
    estimate.exclusions.every((item) => typeof item === "string" && item.length <= 500);
}

function validLiftCandidate(candidate) {
  return candidate && typeof candidate.modelName === "string" && candidate.modelName.length <= 160 &&
    (candidate.article === null || typeof candidate.article === "string") &&
    (candidate.quantity === null || (Number.isInteger(candidate.quantity) && candidate.quantity > 0 && candidate.quantity <= 100)) &&
    (candidate.unit === undefined || typeof candidate.unit === "string") &&
    (candidate.range === undefined || typeof candidate.range === "string");
}
function validLiftCalculation(item) {
  return item && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt)) &&
    typeof item.system === "string" && item.system.length <= 80 &&
    typeof item.systemName === "string" && item.systemName.length <= 120 &&
    typeof item.title === "string" && item.title.length <= 200 &&
    typeof item.status === "string" && item.status.length <= 60 &&
    typeof item.summary === "string" && item.summary.length <= 1000 &&
    item.inputs && typeof item.inputs === "object" && !Array.isArray(item.inputs) &&
    Array.isArray(item.candidates) && item.candidates.length > 0 && item.candidates.length <= 100 &&
    item.candidates.every(validLiftCandidate) && validLiftCandidate(item.candidate);
}
function validLiftSpecificationItem(item) {
  return item && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    (item.calculationId === null || typeof item.calculationId === "string") &&
    typeof item.system === "string" && item.system.length <= 80 &&
    typeof item.systemName === "string" && item.systemName.length <= 120 &&
    typeof item.modelName === "string" && item.modelName.length <= 160 &&
    (item.article === null || typeof item.article === "string") &&
    typeof item.summary === "string" && item.summary.length <= 1000 &&
    Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100 &&
    typeof item.unit === "string" && item.unit.length <= 40 &&
    typeof item.addedAt === "string" && !Number.isNaN(Date.parse(item.addedAt));
}

function validResourceBundle(resources) {
  if (!resources || typeof resources !== "object" || !Array.isArray(resources.materials) ||
      !Array.isArray(resources.remnants) || resources.remnants.length > 2000) return false;
  if ((resources.supplierProfile !== undefined && !validSupplierProfile(resources.supplierProfile)) ||
      (resources.estimates !== undefined &&
        (!Array.isArray(resources.estimates) || resources.estimates.length > estimateLimit ||
          !resources.estimates.every(validEstimate)))) return false;
  if ((resources.liftCalculations !== undefined &&
      (!Array.isArray(resources.liftCalculations) || resources.liftCalculations.length > 500 ||
        !resources.liftCalculations.every(validLiftCalculation))) ||
      (resources.liftSpecificationItems !== undefined &&
        (!Array.isArray(resources.liftSpecificationItems) || resources.liftSpecificationItems.length > 1000 ||
          !resources.liftSpecificationItems.every(validLiftSpecificationItem)))) return false;
  if ((resources.collisionSettings !== undefined && !collisionSettingsValid(resources.collisionSettings)) ||
      (resources.environmentZones !== undefined &&
        (!Array.isArray(resources.environmentZones) || resources.environmentZones.length > 200 ||
          !resources.environmentZones.every(validEnvironmentZone))) ||
      (resources.assemblyPlan !== undefined && !validAssemblyPlan(resources.assemblyPlan))) return false;
  const settings = resources.cutSettings;
  if (!settings || !["trim", "minRemnant", "machineLength", "machineWidth"].every((key) =>
    Number.isFinite(settings[key]))) return false;
  if (settings.trim < 0 || settings.trim > 100 || settings.minRemnant < 0 || settings.minRemnant > 3000 ||
      settings.machineLength < 0 || settings.machineLength > 10000 ||
      settings.machineWidth < 0 || settings.machineWidth > 10000) return false;
  const codes = new Set();
  for (const material of resources.materials) {
    if (!material || typeof material.code !== "string" || !material.code ||
        !materialCodePattern.test(material.code) ||
        typeof material.name !== "string" || !material.name || material.name.length > 120 ||
        (material.thickness !== undefined &&
          (!Number.isFinite(material.thickness) || material.thickness < 0 || material.thickness > 100)) ||
        (material.color !== undefined && material.color !== "" &&
          (typeof material.color !== "string" || !materialColorPattern.test(material.color))) ||
        typeof material.unit !== "string" || !material.unit ||
        typeof material.currency !== "string" || typeof material.supplier !== "string" ||
        (material.priceSource !== undefined &&
          (typeof material.priceSource !== "string" || material.priceSource.length > 500)) ||
        (material.priceDate !== undefined &&
          (typeof material.priceDate !== "string" || (material.priceDate &&
            !/^\d{4}-\d{2}-\d{2}$/.test(material.priceDate)))) ||
          (material.priceValidUntil !== undefined &&
            (typeof material.priceValidUntil !== "string" || (material.priceValidUntil &&
              !/^\d{4}-\d{2}-\d{2}$/.test(material.priceValidUntil)))) ||
        (material.priceStatus !== undefined &&
          !["needs-review", "confirmed", "expired"].includes(material.priceStatus)) ||
        !["directional", "none"].includes(material.grain) ||
        (material.price !== "" && (!Number.isFinite(material.price) || material.price < 0)) ||
        !Number.isFinite(material.sheetWidth ?? 0) || (material.sheetWidth ?? 0) < 0 ||
        (material.sheetWidth ?? 0) > 10000 ||
        !Number.isFinite(material.sheetLength ?? 0) || (material.sheetLength ?? 0) < 0 ||
        (material.sheetLength ?? 0) > 10000 ||
        (material.technology !== undefined && typeof material.technology !== "string") ||
        codes.has(material.code)) return false;
    codes.add(material.code);
  }
  return resources.materials.length > 0 && resources.remnants.every((remnant) =>
    remnant && codes.has(remnant.material) && Number.isFinite(remnant.thickness) && remnant.thickness > 0 &&
    remnant.thickness <= 100 && Number.isFinite(remnant.width) && remnant.width > 0 &&
    remnant.width <= 10000 && Number.isFinite(remnant.length) && remnant.length > 0 && remnant.length <= 10000);
}

function validVersionSnapshot(snapshot) {
  return snapshot && Array.isArray(snapshot.products) && snapshot.products.length > 0 &&
    snapshot.products.length <= 100 && validResourceBundle(snapshot.resources) &&
    snapshot.settings && ["2800x2070", "2750x1830", "2440x1220"].includes(snapshot.settings.sheet) &&
    Number.isFinite(snapshot.settings.kerf) && snapshot.settings.kerf >= 0 && snapshot.settings.kerf <= 12 &&
    [0.4, 2].includes(snapshot.settings.edgeThickness) &&
    snapshot.products.every((product) =>
      product?.type === "cabinet" && typeof product.id === "string" &&
      validCabinet(product.parameters) && validSourceInfo(product.sourceInfo) &&
      validCabinetPlacement(product) &&
      Array.isArray(product.customParts) &&
      product.customParts.every(validPart) && Array.isArray(product.hardwareComponents) &&
      product.hardwareComponents.every(validHardwareComponent) && Array.isArray(product.connections) &&
      product.overrides && typeof product.overrides === "object" && !Array.isArray(product.overrides) &&
      Object.entries(product.overrides).every(([partId, part]) => partId.startsWith("part-") && validPart(part)) &&
      product.connections.every((connection) => connection?.type === "confirmat-joint" &&
        typeof connection.id === "string" && typeof connection.partA === "string" &&
        typeof connection.partB === "string" && Number.isFinite(connection.edgeInset) &&
        Array.isArray(connection.componentIds)));
}

function runSelfChecks() {
  const results = [];
  const fallbackProduct = {
    id: "self-check-product",
    type: "cabinet",
    name: "Self check",
    parameters: {
      name: "Self check",
      width: 800,
      height: 720,
      depth: 600,
      thickness: 18,
      shelves: 2,
      divider: "yes",
      back: "yes",
      color: "white",
      doors: 2,
      drawers: 0,
    },
    x: 0,
    z: 0,
    customParts: [],
    connections: [],
    hardwareComponents: [],
    overrides: {},
  };
  const product = products[0] || fallbackProduct;
  const firstPartId = getProductParts(product)[0]?.id || "self-check-part";
  const samplePlan = {
    operations: [{
      id: "op-check-1",
      name: "Проверка корпуса",
      kind: "install",
      productId: product.id,
      targetPartId: firstPartId,
      approach: "front",
      travel: 150,
      accessWidth: 100,
      accessHeight: 100,
      dependsOn: [],
    }],
  };
  const sampleMaterials = [{
    code: "oak",
    name: "Дуб натуральный ЛДСП",
    unit: "лист",
    currency: "UAH",
    supplier: "Тест",
    price: 1200,
    priceSource: "manual",
    priceDate: "2026-11-03",
    priceValidUntil: "2026-12-03",
    priceStatus: "confirmed",
    grain: "directional",
    sheetWidth: 2800,
    sheetLength: 2070,
    technology: "ЛДСП",
  }];
  const sampleBundle = {
    materials: sampleMaterials,
    remnants: [{ material: "oak", thickness: 18, width: 800, length: 1200 }],
    cutSettings: { trim: 5, minRemnant: 300, machineLength: 2800, machineWidth: 2070 },
    collisionSettings: defaultCollisionSettings(),
    environmentZones: [],
    assemblyPlan: samplePlan,
    supplierProfile: defaultSupplierProfile({ id: "pilot-supplier", name: "Тестовый поставщик", country: "Польша", orderChannel: "CSV" }),
    estimates: [],
  };
  const rotatedProduct = { ...fallbackProduct, x: 10, y: 5, z: 20, rotationY: 90 };
  const rotatedBox = transformCabinetBox({
    size: [100, 18, 200],
    center: [100, 30, 200],
  }, rotatedProduct);
  const customPanel = { length: 100, width: 50, thickness: 18, x: 20, y: 30, z: 40 };
  const expectedCustomPanels = new Map([
    [0, { center: [30, 35, 60], lengthAxis: [1, 0, 0], widthAxis: [0, 0, 1], bounds: [100, 18, 50] }],
    [90, { center: [50, 35, 0], lengthAxis: [0, 0, -1], widthAxis: [1, 0, 0], bounds: [50, 18, 100] }],
    [180, { center: [-10, 35, -20], lengthAxis: [-1, 0, 0], widthAxis: [0, 0, -1], bounds: [100, 18, 50] }],
    [270, { center: [-30, 35, 40], lengthAxis: [0, 0, 1], widthAxis: [-1, 0, 0], bounds: [50, 18, 100] }],
  ]);
  const customPanelChecks = [...expectedCustomPanels].every(([angle, expected]) => {
    const item = { ...fallbackProduct, x: 10, y: 5, z: 20, rotationY: angle };
    const box = panelBox(customPanel, item);
    const bounds = boundsOf(box);
    const localCenter = cabinetWorldToLocalPoint(item, box.center);
    return box.center.every((value, axis) => Math.abs(value - expected.center[axis]) < 0.001) &&
      box.axes[0].every((value, axis) => Math.abs(value - expected.lengthAxis[axis]) < 0.001) &&
      box.axes[2].every((value, axis) => Math.abs(value - expected.widthAxis[axis]) < 0.001) &&
      bounds.every((range, axis) => Math.abs(range.max - range.min - expected.bounds[axis]) < 0.001) &&
      localCenter.every((value, axis) => Math.abs(value - [20, 30, 40][axis]) < 0.001);
  });
  const expectedTransforms = new Map([
    [0, { point: [110, 35, 220], front: [0, 0, 1] }],
    [90, { point: [210, 35, -80], front: [1, 0, 0] }],
    [180, { point: [-90, 35, -180], front: [0, 0, -1] }],
    [270, { point: [-190, 35, 120], front: [-1, 0, 0] }],
  ]);
  const transformChecks = [...expectedTransforms].every(([angle, expected]) => {
    const item = { ...fallbackProduct, x: 10, y: 5, z: 20, rotationY: angle };
    const worldPoint = cabinetLocalToWorldPoint(item, [100, 30, 200]);
    const worldFront = cabinetLocalToWorldVector(item, [0, 0, 1]);
    const localPoint = cabinetWorldToLocalPoint(item, worldPoint);
    const localFront = cabinetWorldToLocalVector(item, worldFront);
    return worldPoint.every((value, axis) => Math.abs(value - expected.point[axis]) < 0.001) &&
      worldFront.every((value, axis) => Math.abs(value - expected.front[axis]) < 0.001) &&
      localPoint.every((value, axis) => Math.abs(value - [100, 30, 200][axis]) < 0.001) &&
      localFront.every((value, axis) => Math.abs(value - [0, 0, 1][axis]) < 0.001);
  });
  const movingProduct = {
    ...fallbackProduct,
    x: 10,
    y: 0,
    z: 20,
    rotationY: 90,
    parameters: { ...fallbackProduct.parameters, doors: 1, drawers: 1 },
  };
  const movingParts = generatedParts(movingProduct);
  const nearlyEqual = (a, b) => a.every((value, axis) => Math.abs(value - b[axis]) < 0.001);
  // Expected project directions of the cabinet's local +X (width) and +Z (front) axes.
  const quarterTurnAxes = new Map([
    [0, { width: [1, 0, 0], front: [0, 0, 1], leftSide: [-381, 360, 20] }],
    [90, { width: [0, 0, -1], front: [1, 0, 0], leftSide: [10, 360, 411] }],
    [180, { width: [-1, 0, 0], front: [0, 0, -1], leftSide: [401, 360, 20] }],
    [270, { width: [0, 0, 1], front: [-1, 0, 0], leftSide: [10, 360, -371] }],
  ]);
  const confirmatConnection = {
    partA: `part-${encodeURIComponent("Боковина левая")}`,
    partB: `part-${encodeURIComponent("Дно")}`,
    count: 2,
    edgeInset: 50,
  };
  const accessSettings = { ...defaultCollisionSettings(), toolAccessDepth: 100, toolAccessWidth: 40 };
  const unrotatedLayout = connectionPositions({ ...movingProduct, rotationY: 0 }, confirmatConnection);
  const quarterTurnResults = [...quarterTurnAxes].map(([angle, expected]) => {
    const item = { ...movingProduct, rotationY: angle };
    const parts = generatedParts(item);
    const leftSide = partBox(parts.find((part) => part.name === "Боковина левая"), item);
    const motions = getMotionAssemblies(item, defaultCollisionSettings());
    const door = motions.find((motion) => motion.kind === "door");
    const doorEntry = door?.parts[0];
    const doorOpen = doorEntry && motionPose(door, doorEntry, 1, { ...defaultCollisionSettings(), doorOpenAngle: 90 });
    const hingeSign = door?.hingeSide === "left" ? -1 : 1;
    const hingeEdge = (box) => box.center.map((value, axis) =>
      value + box.axes[0][axis] * hingeSign * box.size[0] / 2);
    const doorShift = doorOpen && doorOpen.center.map((value, axis) => value - doorEntry.box.center[axis]);
    const drawer = motions.find((motion) => motion.kind === "drawer");
    const drawerEntry = drawer?.parts.find((entry) => entry.part.name === "Шухляда 1 перед");
    const drawerOpen = drawerEntry && motionPose(drawer, drawerEntry, 1, { ...defaultCollisionSettings(), drawerExtension: 150 });
    const drawerShift = drawerOpen && drawerOpen.center.map((value, axis) => value - drawerEntry.box.center[axis]);
    const cabinetSides = ["Боковина левая", "Боковина правая"]
      .map((name) => partBox(parts.find((part) => part.name === name), item));
    const drawerSides = (drawer?.parts || []).filter((entry) => entry.part.orientation === "drawer-side");
    const layout = connectionPositions(item, confirmatConnection);
    const entries = layout.entries || [];
    return {
      side: nearlyEqual(leftSide.center, expected.leftSide) && nearlyEqual(leftSide.axes[0], expected.width),
      door: !!doorOpen &&
        cabinetWorldToLocalPoint(item, doorOpen.center)[2] > cabinetWorldToLocalPoint(item, doorEntry.box.center)[2] &&
        doorShift.reduce((sum, value, axis) => sum + value * expected.front[axis], 0) > 0 &&
        nearlyEqual(hingeEdge(doorOpen), hingeEdge(doorEntry.box)),
      drawer: !!drawerOpen && nearlyEqual(drawerShift, expected.front.map((value) => value * 150)) &&
        nearlyEqual(drawerOpen.axes[2], expected.front) && nearlyEqual(drawerOpen.size, drawerEntry.box.size),
      drawerSides: drawerSides.length === 2 && drawerSides.every((entry) => {
        const local = boundsOf(partLocalBox(entry.part, item));
        return entry.box.size[2] === entry.part.length && nearlyEqual(entry.box.axes[2], expected.front) &&
          local[0].min >= -400 + 18 && local[0].max <= 400 - 18 &&
          [0, 1].every((progress) => cabinetSides.every((side) =>
            !orientedBoxesIntersect(motionPose(drawer, entry, progress, { ...defaultCollisionSettings(), drawerExtension: 150 }), side)));
      }),
      hardware: entries.length === 2 && entries.every((entry, index) =>
        nearlyEqual(entry.direction, expected.width) &&
        nearlyEqual(entry.localStart, unrotatedLayout.entries[index].localStart) &&
        nearlyEqual(cabinetWorldToLocalPoint(item, entry.start), entry.localStart) &&
        Math.abs(entry.localStart[0] + 400) < 0.001),
      access: entries.length === 2 && entries.every((entry) => {
        const corridor = toolAccessCorridor(item, layout, entry, accessSettings);
        const localCenter = cabinetWorldToLocalPoint(item, corridor.center);
        return Math.abs(localCenter[0] + 450) < 0.001 && nearlyEqual(corridor.axes[0], expected.width) &&
          corridor.size[0] === 100;
      }),
    };
  });
  // Drawers with a divider and shelves: they stay in one section, below its shelves, also when extended.
  const drawerCabinet = {
    ...fallbackProduct,
    x: 10,
    y: 0,
    z: 20,
    parameters: { ...fallbackProduct.parameters, divider: true, shelves: 3, doors: 0, drawers: 2 },
  };
  const drawerExtensionSettings = { ...defaultCollisionSettings(), drawerExtension: 150 };
  const drawerPoses = (item) => getMotionAssemblies(item, defaultCollisionSettings())
    .filter((motion) => motion.kind === "drawer")
    .flatMap((motion) => motion.parts.flatMap((entry) =>
      [0, 1].map((progress) => motionPose(motion, entry, progress, drawerExtensionSettings))));
  const drawerLayoutResults = [0, 90, 180, 270].map((angle) => {
    const item = { ...drawerCabinet, rotationY: angle };
    const p = item.parameters;
    const parts = generatedParts(item);
    const boxOf = (name) => partBox(parts.find((part) => part.name === name), item);
    const drawerParts = parts.filter((part) => part.name.startsWith("Шухляда "));
    const poses = drawerPoses(item);
    const shelves = parts.filter((part) => part.name.startsWith("Полка ")).map((part) => partBox(part, item));
    const tallStack = { ...item, parameters: { ...p, divider: false, shelves: 0, drawers: 4 } };
    const withDoors = { ...item, parameters: { ...p, doors: 2 } };
    const doorParts = generatedParts(withDoors);
    const doorFront = cabinetWorldToLocalPoint(withDoors,
      partBox(doorParts.find((part) => part.name === "Фасад 1"), withDoors).center)[2];
    const drawerFront = cabinetWorldToLocalPoint(withDoors,
      partBox(doorParts.find((part) => part.name === "Шухляда 1 перед"), withDoors).center)[2];
    const hasIssue = (product, text) => drawerLayoutIssues(product).some((issue) => issue.includes(text));
    return {
      section: drawerParts.length === 8 && drawerParts.every((part) => {
        const local = boundsOf(partLocalBox(part, item));
        return local[0].min >= -p.width / 2 + p.thickness && local[0].max <= -p.thickness / 2;
      }) && poses.length === 16 && poses.every((pose) => !orientedBoxesIntersect(pose, boxOf("Перегородка"))) &&
        hasIssue(item, "секция для ящиков не задана") &&
        !hasIssue({ ...item, parameters: { ...p, divider: false } }, "секция для ящиков не задана"),
      shelves: shelves.length === 3 && poses.every((pose) => !shelves.some((box) => orientedBoxesIntersect(pose, box))) &&
        drawerPoses(tallStack).length === 32 &&
        drawerPoses(tallStack).every((pose) => !orientedBoxesIntersect(pose, partBox(generatedParts(tallStack)
          .find((part) => part.name === "Крыша"), tallStack))) &&
        drawerLayoutIssues(item).every((issue) => !issue.includes("полки над зоной")),
      doors: doorFront > drawerFront && hasIssue(withDoors, "двери и ящики в одном корпусе") &&
        !hasIssue(item, "двери и ящики в одном корпусе"),
    };
  });
  // Menu bar on the live page: one open menu, switching, second click, outside click, Escape, command, nested menu.
  const menuChecks = (() => {
    const menus = topMenus();
    const [file, edit] = menus;
    const openNames = () => menus.filter((menu) => menu.open).map((menu) => menuSummary(menu).textContent);
    const ariaMatches = () => menus.every((menu) => menuSummary(menu).getAttribute("aria-expanded") === String(menu.open));
    const results = [];
    closeMenus();
    menuSummary(file).click();
    results.push(openNames().join() === "Файл" && ariaMatches());
    menuSummary(edit).click();
    results.push(openNames().join() === "Правка" && ariaMatches());
    menuSummary(edit).click();
    results.push(openNames().length === 0 && ariaMatches());
    menuSummary(file).click();
    menuSummary(edit).dispatchEvent(new PointerEvent("pointerenter"));
    results.push(openNames().join() === "Правка");
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    results.push(openNames().length === 0 && ariaMatches());
    menuSummary(file).click();
    menuSummary(file).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    results.push(openNames().length === 0 && ariaMatches());
    menuSummary(edit).dispatchEvent(new PointerEvent("pointerenter"));
    results.push(openNames().length === 0);
    const help = menus.find((menu) => menuSummary(menu).textContent === "Справка");
    menuSummary(help).click();
    help.querySelector("[data-info]").click();
    results.push(openNames().length === 0 && ariaMatches());
    // A temporary nested submenu closes together with its parent.
    const nested = document.createElement("details");
    nested.className = "window-menu";
    nested.innerHTML = "<summary>Подменю</summary><div class=\"menu-items\"></div>";
    file.querySelector(".menu-items").append(nested);
    menuSummary(nested).addEventListener("click", (event) => { event.preventDefault(); setMenuOpen(nested, !nested.open); });
    menuSummary(file).click();
    menuSummary(nested).click();
    const nestedOpen = file.open && nested.open;
    menuSummary(edit).click();
    results.push(nestedOpen && !file.open && !nested.open && edit.open);
    nested.remove();
    closeMenus();
    return results.every(Boolean) && openNames().length === 0;
  })();
  // Fixed views: a 0.8×0.72×0.56 m box; which project direction ends up right/up on screen, and the box fits.
  const viewChecks = (() => {
    const center = [1, 0.36, 2];
    const size = [0.8, 0.72, 0.56];
    const expected = {
      front: { right: [1, 0, 0], up: [0, 1, 0] },
      top: { right: [1, 0, 0], up: [0, 0, -1] },
      left: { right: [0, 0, 1], up: [0, 1, 0] },
    };
    return Object.entries(expected).every(([name, axes]) => {
      const probe = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      const aspect = 1.6;
      const { halfWidth, halfHeight } = viewFrustum(name, size, aspect);
      Object.assign(probe, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight });
      probe.position.fromArray(viewCameraPosition(name, center, size));
      probe.up.fromArray(viewPresets[name].up);
      probe.lookAt(...center);
      probe.updateProjectionMatrix();
      probe.updateMatrixWorld();
      const screen = (offset) => new THREE.Vector3(...center.map((value, axis) => value + offset[axis] * 0.1)).project(probe);
      const corners = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) =>
        new THREE.Vector3(center[0] + sx * size[0] / 2, center[1] + sy * size[1] / 2, center[2] + sz * size[2] / 2).project(probe))));
      return screen(axes.right).x > 0.01 && Math.abs(screen(axes.right).y) < 1e-6 &&
        screen(axes.up).y > 0.01 && Math.abs(screen(axes.up).x) < 1e-6 &&
        corners.every((point) => Math.abs(point.x) < 1 && Math.abs(point.y) < 1) &&
        Math.abs(halfWidth / halfHeight - aspect) < 1e-9;
    });
  })();
  const historyChecks = (() => {
    let state = { width: 600 };
    const history = createUndoHistory({
      serialize: () => JSON.stringify(state),
      restore: (text) => { state = JSON.parse(text); },
      limit: 3,
    });
    history.observe();
    const firstStepEmpty = history.undoCount === 0;
    state = { width: 800 };
    history.observe();
    state = { width: 900 };
    history.observe();
    const unchanged = !history.observe();
    history.undo();
    const undone = state.width === 800 && history.redoCount === 1;
    history.redo();
    const redone = state.width === 900 && history.redoCount === 0;
    history.undo();
    state = { width: 1000 };
    history.observe();
    const branchClearsRedo = history.redoCount === 0 && !history.redo();
    for (const width of [1100, 1200, 1300, 1400]) {
      state = { width };
      history.observe();
    }
    const limited = history.undoCount === 3;
    history.reset();
    return firstStepEmpty && unchanged && undone && redone && branchClearsRedo && limited &&
      history.undoCount === 0 && history.redoCount === 0 && !history.undo() && state.width === 1400;
  })();
  // Sketch layout: a 300 mm left opening, the right one split into three equal openings by two shelves.
  const sketchLayout = (() => {
    const divided = splitOpening(newLayout(), "n1", "x", 2);
    const sized = setOpeningSize(divided, divided.root.children[0].node.id, 300);
    return splitOpening(sized, sized.root.children[1].node.id, "y", 3);
  })();
  const sketchCabinet = (angle) => ({
    ...fallbackProduct, id: "sketch-cabinet", x: 10, y: 0, z: 20, rotationY: angle,
    parameters: { ...fallbackProduct.parameters, width: 800, height: 720, depth: 560, thickness: 18,
      shelves: 0, divider: false, doors: 0, drawers: 0, x: 10, z: 20, layout: sketchLayout },
  });
  const sketchResults = [0, 90, 180, 270].map((angle) => {
    const item = sketchCabinet(angle);
    const parts = generatedParts(item);
    const byName = (name) => parts.find((part) => part.name === name);
    const divider = byName("Перегородка 1");
    const shelves = [byName("Полка 1"), byName("Полка 2")];
    const boxes = parts.filter((part) => part.orientation !== "back").map((part) => partBox(part, item));
    // Touching faces are allowed: orientedBoxesIntersect counts exact contact as an intersection.
    const noOverlap = boxes.every((box, i) => boxes.every((other, j) => j <= i || !orientedBoxesIntersect(box, other, -0.01)));
    // Interior 764×684: divider at 18+300…+18, right opening 446 wide, three openings of (684−36)/3 = 216.
    return !!divider && shelves.every(Boolean) && parts.filter((part) => /^Полка|^Перегородка/.test(part.name)).length === 3 &&
      Math.abs(divider.x - 327) < 0.001 && Math.abs(divider.length - 684) < 0.001 &&
      shelves.every((shelf) => Math.abs(shelf.length - 446) < 0.001 && Math.abs(shelf.x - 559) < 0.001) &&
      Math.abs(shelves[0].y - 243) < 0.001 && Math.abs(shelves[1].y - 477) < 0.001 &&
      noOverlap && layoutIssues(item.parameters).length === 0;
  });
  // Drawing: snaps, panel insertion and the rule that untouched openings keep their size.
  const drawingChecks = (() => {
    const base = { width: 800, height: 720, depth: 560, thickness: 18 };
    const at = (layout) => ({ ...base, layout });
    let p = at(newLayout());
    const root = openingAt(p, { x: 400, y: 300 });
    const middle = snapPanelCenter(p, root, "x", 402, 10);
    const free = snapPanelCenter(p, root, "x", 300.4, 5);
    let step = insertPanel(p, root.id, "x", middle.center);
    p = at(step.layout);
    const divider = layoutParts(p).find((part) => part.name === "Перегородка 1");
    const right = openingAt(p, { x: 600, y: 300 });
    step = insertPanel(p, right.id, "y", 243);
    p = at(step.layout);
    const left = openingAt(p, { x: 200, y: 300 });
    // 242: «Полка 1» (243) is nearer than the 1/3 division of this opening (249).
    const aligned = snapPanelCenter(p, left, "y", 242, 10);
    // Three equal rubber openings; a shelf in the middle one must not move the outer ones.
    const equal = at(splitOpening(newLayout(), "n1", "y", 3));
    const sizes = (layout) => resolveLayout(layout, cabinetInterior(base), base.thickness).openings
      .map(({ box }) => Math.round((box.y1 - box.y0) * 1000) / 1000);
    const before = sizes(equal.layout);
    const middleOpening = openingAt(equal, { x: 400, y: 360 });
    const nested = insertPanel(equal, middleOpening.id, "y", 330).layout;
    const after = sizes(nested);
    // A fixed bottom opening and a single rubber one: the new shelf joins the same split.
    const fixedBottom = setOpeningSize(splitOpening(newLayout(), "n1", "y", 2), "n1", 300);
    const flat = insertPanel(at(fixedBottom), openingAt(at(fixedBottom), { x: 400, y: 600 }).id, "y", 500).layout;
    let edgeRejected = false;
    try {
      insertPanel(at(newLayout()), "n1", "x", 18);
    } catch {
      edgeRejected = true;
    }
    return root.id === "n1" && middle.label === "середина" && Math.abs(middle.center - 400) < 1e-9 &&
      middle.before === 373 && middle.after === 373 && free.label === null && free.center === 300 &&
      !!divider && Math.abs(divider.x - 400) < 1e-9 && step.name === "Полка 1" &&
      aligned.label === "по Полка 1" && aligned.center === 243 &&
      before[0] === after[0] && before[2] === after[after.length - 1] && after.length === 4 &&
      flat.root.children.length === 3 && flat.root.panels.length === 2 && validLayout(flat) && edgeRejected;
  })();
  // Editing: moving a panel changes only its two neighbours («резиновая нить»), removing merges openings.
  const editingChecks = (() => {
    const base = { width: 800, height: 720, depth: 560, thickness: 18 };
    const at = (layout, extra = {}) => ({ ...base, ...extra, layout });
    const sizes = (p) => resolveLayout(p.layout, cabinetInterior(p), p.thickness).openings
      .map(({ box }) => Math.round((p.layout.root.axis === "x" ? box.x1 - box.x0 : box.y1 - box.y0) * 1000) / 1000);
    const shelfY = (p, name) => layoutParts(p).find((part) => part.name === name)?.y;
    const equal = at(splitOpening(newLayout(), "n1", "y", 3));
    const region = panelRegion(equal, "Полка 1");
    const moved = at(movePanel(equal, "Полка 1", 300));
    const taller = { ...moved, height: 820 };
    const throws = (action) => { try { action(); return false; } catch { return true; } };
    const removed = at(removePanel(equal, "Полка 1"));
    const lastRemoved = removePanel(at(removePanel(equal, "Полка 1")), "Полка 2");
    // Both sides of «Перегородка 1» subdivided → refused; one side subdivided → it stretches to the whole width.
    const columns = splitOpening(newLayout(), "n1", "x", 2);
    const bothSplit = at(splitOpening(splitOpening(columns, columns.root.children[0].node.id, "y", 2),
      columns.root.children[1].node.id, "y", 2));
    const oneSplit = at(splitOpening(columns, columns.root.children[1].node.id, "y", 2));
    const stretched = at(removePanel(oneSplit, "Перегородка 1"));
    const hit = panelAt(equal, { x: 400, y: 487 }, 2);
    return region.before === 216 && region.after === 216 && region.center === 243 &&
      sizes(moved).join() === "273,159,216" && shelfY(moved, "Полка 2") === 477 &&
      sizes(taller).join() === "273,159,316" &&
      throws(() => movePanel(equal, "Полка 1", 20)) &&
      sizes(removed).join() === "450,216" && layoutParts(removed).map((part) => part.name).join() === "Полка 2" &&
      lastRemoved.root.type === "opening" &&
      throws(() => removePanel(bothSplit, "Перегородка 1")) &&
      stretched.layout.root.axis === "y" && layoutParts(stretched).every((part) => part.length === 764) &&
      hit?.name === "Полка 2";
  })();
  // Speech arrives without commas: «шириной 800 высотой 720» must not give the height two values.
  const speechChecks = (() => {
    const spoken = parseVoiceDescription("Создай нижний шкаф шириной 800 высотой 720 и глубиной 560 мм лдсп 18 мм две двери одна полка").parsed;
    const reversed = parseVoiceDescription("Нижний шкаф 800 мм в ширину, 720 мм в высоту, 560 мм в глубину").parsed;
    const conflict = parseVoiceDescription("Нижний шкаф шириной 800, шириной 900, высотой 720 и глубиной 560 мм");
    return spoken.width === 800 && spoken.height === 720 && spoken.depth === 560 && spoken.thickness === 18 &&
      spoken.doors === 2 && spoken.shelves === 1 &&
      reversed.width === 800 && reversed.height === 720 && reversed.depth === 560 &&
      conflict.parsed.width === null && conflict.issues.some((issue) => issue.fields.includes("width"));
  })();
  // Voice commands: parsing and planning on a sketch; heights are from the floor to the shelf centre.
  const commandChecks = (() => {
    const helpers = { number: voiceNumber, toMm: voiceUnitToMillimeters };
    const parse = (text) => parseSketchCommand(text, helpers);
    const base = { width: 800, height: 720, depth: 560, thickness: 18 };
    const empty = { ...base, layout: newLayout() };
    const frame = parse("Корпус 800 на 720 на 560 мм");
    const frameCm = parse("рамка 80 на 72 на 56 см");
    const frameNoUnit = parse("800 х 720 х 560");
    const middle = parse("Поставь полку посередине");
    const dividerMiddle = parse("перегородку по центру");
    const split3 = parse("раздели проём на три");
    const splitV = parse("Раздели на две части по вертикали");
    const shelfAt = parse("полка на высоте 800");
    const shelfAtM = parse("полку на высоте 0,4 м");
    const doors = parse("добавь две двери");
    const unknown = parse("сделай красиво");
    const shelfLayout = planSketchCommand(empty, middle).layout;
    const shelf = layoutParts({ ...base, layout: shelfLayout })[0];
    const columns = { ...base, layout: splitOpening(newLayout(), "n1", "x", 2) };
    const throws = (action) => { try { action(); return false; } catch { return true; } };
    const rightId = resolveLayout(columns.layout, cabinetInterior(base), 18).openings[1].id;
    // Cabinet base 100 mm above the floor: a shelf at 600 mm from the floor has its centre at 500 mm in the cabinet.
    const atHeight = layoutParts({ ...base, layout: planSketchCommand(columns, parse("полка на высоте 600"), { selectedId: rightId, cabinetY: 100 }).layout })
      .find((part) => part.orientation === "horizontal");
    return frame.type === "frame" && frame.width === 800 && frame.height === 720 && frame.depth === 560 && frame.notes.length === 0 &&
      frameCm.width === 800 && frameCm.depth === 560 && frameNoUnit.height === 720 && frameNoUnit.notes.length === 3 &&
      middle.type === "middle" && middle.axis === "y" && dividerMiddle.axis === "x" &&
      split3.type === "split" && split3.count === 3 && split3.axis === "y" && split3.notes.length === 1 &&
      splitV.count === 2 && splitV.axis === "x" && splitV.notes.length === 0 &&
      shelfAt.type === "shelf-at" && shelfAt.height === 800 && shelfAt.notes.length === 1 && shelfAtM.height === 400 &&
      doors.type === "unsupported" && unknown.type === "unknown" &&
      shelf?.y === 360 && shelf.length === 764 &&
      throws(() => planSketchCommand(columns, middle)) &&
      throws(() => planSketchCommand(columns, shelfAt, { cabinetY: 100 })) &&
      atHeight?.y === 500 && atHeight.x > 400 &&
      throws(() => planSketchCommand(empty, parse("полка на высоте 2000"))) &&
      layoutParts({ ...base, layout: planSketchCommand(empty, split3).layout }).length === 2;
  })();
  const reopenedSketch = JSON.parse(JSON.stringify(sketchCabinet(90)));
  const brokenLayout = (change) => {
    const copy = structuredClone(sketchLayout);
    change(copy);
    return validLayout(copy);
  };
  const legacyShelf = generatedParts({ ...fallbackProduct, parameters: { ...fallbackProduct.parameters, divider: false, shelves: 1, drawers: 0 } })
    .find((part) => part.name === "Полка 1");
  const sketchChecks = sketchResults.every(Boolean) &&
    validCabinet(reopenedSketch.parameters) &&
    JSON.stringify(generatedParts(reopenedSketch)) === JSON.stringify(generatedParts(sketchCabinet(90))) &&
    !brokenLayout((layout) => { layout.root.children.forEach((child) => { child.size = 100; }); }) &&
    !brokenLayout((layout) => { layout.root.panels[0].name = "Полка 9"; }) &&
    !brokenLayout((layout) => { layout.root.children[1].node.id = layout.root.id; }) &&
    !brokenLayout((layout) => { layout.root.panels.push({ name: "Перегородка 5" }); }) &&
    !validCabinet({ ...sketchCabinet(0).parameters, layout: { version: 2, root: sketchLayout.root } }) &&
    layoutIssues({ ...sketchCabinet(0).parameters, layout: setOpeningSize(sketchLayout, sketchLayout.root.children[0].node.id, 900) })
      .some((issue) => issue.includes("не помещаются")) &&
    !!legacyShelf && Math.abs(legacyShelf.y - 360) < 0.001;
  const facadeBase = {
    ...fallbackProduct, id: "facade-a", name: "Фасад А", x: 0, y: 0, z: 0, rotationY: 0,
    parameters: { ...fallbackProduct.parameters, divider: true, doors: 2, drawers: 0, x: 0, z: 0 },
  };
  const extentOf = (entries, axis) =>
    Math.max(...entries.map(({ bounds }) => bounds[axis].max)) - Math.min(...entries.map(({ bounds }) => bounds[axis].min));
  const facadeResults = [0, 90, 180, 270].map((angle) => {
    const turned = {
      ...fallbackProduct, id: "facade-b", name: "Фасад Б", x: 2000, y: 0, z: 0, rotationY: angle,
      parameters: { ...fallbackProduct.parameters, width: 600, divider: false, doors: 1, drawers: 2, shelves: 1, x: 0, z: 0 },
    };
    const local = facadeEntries(turned, true);
    const world = facadeEntries(turned, false);
    const localView = facadeView(local, { left: 0, top: 0, maxWidth: 400, maxHeight: 400 });
    const kinds = [...localView.svg.matchAll(/data-part-kind="(\w+)"/g)].map((match) => match[1]);
    const sketch = facadeSketchSvg(true, [facadeBase, turned]);
    const sideways = angle === 90 || angle === 270;
    return Math.abs(extentOf(local, 0) - 600) < 0.001 && Math.abs(extentOf(local, 1) - turned.parameters.height) < 0.001 &&
      kinds.filter((kind) => kind === "front").length === 1 &&
      kinds.lastIndexOf("carcase") < kinds.indexOf("front") && kinds.lastIndexOf("drawer") < kinds.indexOf("front") &&
      local.some((entry) => entry.kind === "front" && entry.hingeSide) &&
      Math.abs(extentOf(world, 0) - extentOf(local, sideways ? 2 : 0)) < 0.001 &&
      (sketch.match(/data-cabinet=/g) || []).length === 2 &&
      sketch.includes("Фасад А") && sketch.includes("Фасад Б") && sketch.includes('data-view="project"');
  });
  const customMaterial = newCatalogMaterial({
    code: "egger-w1000", name: "ЛДСП Egger W1000 белый", thickness: "18", sheetWidth: "2800", sheetLength: "2070",
    grain: "none", color: "#F2F2EE",
  }, ["oak", "white", "graphite", "hdf"]);
  const rejectsMaterial = (values) => {
    try {
      newCatalogMaterial({ code: "x", name: "x", thickness: "", sheetWidth: "", sheetLength: "", grain: "none", color: "#000000", ...values }, ["oak"]);
      return false;
    } catch {
      return true;
    }
  };
  const customMaterialProduct = {
    ...fallbackProduct,
    parameters: { ...fallbackProduct.parameters, color: "egger-w1000", thickness: 16, divider: false, shelves: 0, doors: 0, x: 0, z: 0 },
  };
  const customMaterialParts = generatedParts(customMaterialProduct);
  const customMaterialEntries = customMaterialParts.map((part) => ({ product: customMaterialProduct, part }));
  const sampleEstimates = Array.from({ length: estimateLimit }, (_, i) =>
    ({ id: `estimate-${i + 1}`, revision: i + 1, createdAt: new Date(Date.UTC(2026, 9, 1 + i % 28)).toISOString() }));
  const estimateRemoval = estimatesRemovedOnAdd(sampleEstimates);
  const estimateRemovalText = estimateRemovalMessage(estimateRemoval);
  const archiveDate = new Date(2026, 10, 5, 12);
  const singleArchive = estimateArchiveFile([sampleEstimates[4]], archiveDate);
  const projectArchive = estimateArchiveFile([sampleEstimates[6], sampleEstimates[2], sampleEstimates[4]], archiveDate);
  const singleArchiveData = JSON.parse(singleArchive.data);
  const projectArchiveData = JSON.parse(projectArchive.data);
  const archiveQuestion = estimateArchiveMessage([sampleEstimates[2], sampleEstimates[6]], projectArchive.name, true);
  const frontInstallOperation = { ...samplePlan.operations[0], approach: "front", travel: 100 };
  const frontInstallTarget = { product: movingProduct, part: movingParts[0], box: partBox(movingParts[0], movingProduct) };
  const frontInstallZone = operationZone(frontInstallOperation, frontInstallTarget);
  const nearbyProduct = { ...fallbackProduct, x: 700, y: 0, z: 0, rotationY: 0 };
  const rotatedSeparateProduct = { ...fallbackProduct, x: 0, y: 0, z: 701, rotationY: 90 };
  const elevatedProduct = { ...fallbackProduct, x: 0, y: 721, z: 0, rotationY: 0 };
  const floorTestBox = { size: [10, 10, 10], center: [0, 4, 0] };
  let csv = null;
  try {
    csv = viyarExportCsv();
  } catch {
    // An empty project has no material group to export; the check below then fails.
  }
  const specification = specificationRows();
  const voiceSetExample = parseVoiceSetDescription("Создай нижний ряд кухни из трёх шкафов слева направо: мойка 800 на 720 на 560, тумба с ящиками 600 на 720 на 560, шкаф с дверцами 400 на 720 на 560 миллиметров. Все из ЛДСП 18 миллиметров.");
  const exampleModules = voiceSetExample.modules;
  const voiceSetConflicts = parseVoiceSetDescription("Нижний ряд слева направо: шкаф 600 на 720 на 560 шириной 800 мм, тумба -400 на 720 на 560 мм, пенал не 500, а 600 на 2100 на 560 мм. ЛДСП 18 мм.");
  const voiceSetAmbiguous = parseVoiceSetDescription("Два нижних шкафа рядом: тумба 600 на 720 на 560 мм, шкаф 400 на 720 на 560 мм, шкаф 300 на 720 на 560 мм с петлями.");
  const voiceSetSingle = parseVoiceSetDescription("Нижний шкаф 600 на 720 на 560 мм");
  const moduleIssue = (result, module, field) =>
    result.issues.some((issue) => issue.module === module && issue.fields.includes(field));
  const voiceModuleValues = (overrides) => ({
    order: 1, type: "lower-cabinet", name: "Проверка", width: 600, height: 720, depth: 560, thickness: 18,
    material: "ldsp", color: "white", shelves: 1, doors: 1, drawers: 0, divider: "no", back: "yes",
    y: 0, x: null, z: null, purpose: "", hardware: "", ...overrides,
  });
  const voiceSetSelfCheckDraft = {
    sourceText: "проверка",
    setId: "voice-set-self-check",
    modules: [0, 1].map(() => ({ sourceText: "проверка", parsed: {}, notes: [], parameters: voiceSetLedger({}, {}), yEdited: false })),
  };
  const productCountBefore = products.length;
  const voiceSetBuild = (second) => buildVoiceSetCabinets({
    draft: voiceSetSelfCheckDraft,
    modulesValues: [voiceModuleValues({}), voiceModuleValues({ order: 2, ...second })],
    placement: [{ x: -300, z: 0 }, { x: 300, z: 0 }],
    mode: "row",
    direction: "left-to-right",
    assumptions: ["проверка"],
  });
  const sheetFitProduct = { ...fallbackProduct, id: "sheet-fit-product", name: "Проверка листа" };
  const sheetFitPart = (length, width) => ({ id: `part-${length}x${width}`, name: `${length}×${width}`, length, width, thickness: 18, material: "ЛДСП" });
  const sheetFitContext = (grain, cutOverrides = {}) => ({
    materials: [{ code: sheetFitProduct.parameters.color, name: "Проверочная ЛДСП", grain, sheetWidth: 2800, sheetLength: 2070 }],
    cutSettings: { trim: 10, minRemnant: 300, machineLength: 0, machineWidth: 0, ...cutOverrides },
    remnants: [],
    kerf: 4,
    sheetFormat: "2800x2070",
  });
  const sheetFit = (part, grain, cutOverrides) =>
    sheetFitIssues([{ product: sheetFitProduct, part }], sheetFitContext(grain, cutOverrides));
  const samplePriceList = {
    supplier: "KRONAS", currency: "UAH", sourceFile: "Плитные материалы.xlsx", sourceUrl: "https://example.invalid/plity", fileDate: "2026-10-30",
    items: [
      { article: "138900", name: "ЛДСП 2800x2070x18 3274 LX Бетон серый", price: 4725, unit: "лист", group: "ЛДСП", attributes: { kind: "board", sheetWidth: 2800, sheetLength: 2070, thickness: 18 } },
      { article: "139070", name: "ЛДСП Kronospan 2739 PW 2800x2070x18", price: 3557, unit: null, group: "ЛДСП", attributes: { kind: "board", sheetWidth: 2800, sheetLength: 2070, thickness: 18 } },
      { article: "17125", name: "Кромка ABS 22х0,4 075W", price: 20.9, unit: "м.п.", group: "Кромка", attributes: { kind: "edge", width: 22, thickness: 0.4 } },
    ],
  };
  const priceSearch = searchPriceItems(samplePriceList.items, "лдсп 2800х2070х18 бетон");
  const priceFields = priceItemMaterialFields(samplePriceList.items[0], samplePriceList);
  const voiceSetInvalid = voiceSetBuild({ width: 100 });
  const voiceSetValid = voiceSetBuild({});
  const checks = [
    ["assembly-plan", validAssemblyPlan(samplePlan)],
    ["resource-bundle", validResourceBundle(sampleBundle)],
    ["snapshot", validVersionSnapshot(projectSnapshot())],
    ["csv-export", !!csv && typeof csv.csv === "string" && csv.csv.includes("Довжина")],
    ["save-open-cycle", !!projectResources && Array.isArray(projectResources.history)],
    ["estimate-limit-asks-before-removal", estimatesRemovedOnAdd(sampleEstimates.slice(1)).length === 0 &&
      estimateRemoval.length === 1 && estimateRemoval[0].revision === 1 &&
      estimateRemovalText.includes(new Date(sampleEstimates[0].createdAt).toLocaleString()) &&
      estimateRemovalText.includes("Сначала скачать старые сметы файлом?")],
    ["estimate-archive-single-and-project", singleArchive.name === "furnix-estimates-archive-v5-2026-11-05.json" &&
      singleArchiveData.format === "furnix.estimate-archive" && singleArchiveData.estimates.length === 1 &&
      singleArchiveData.estimates[0].revision === 5 &&
      projectArchive.name === "furnix-estimates-archive-v3-v7-2026-11-05.json" &&
      projectArchiveData.estimates.map((estimate) => estimate.revision).join(",") === "3,5,7" &&
      projectArchiveData.project.revisions.join(",") === "3,5,7" && Array.isArray(projectArchiveData.project.products) &&
      archiveQuestion.includes(projectArchive.name) && archiveQuestion.includes("v3 от") &&
      archiveQuestion.includes("будут удалены из проекта") &&
      estimateArchiveMessage([sampleEstimates[2]], singleArchive.name, false).includes("останутся в проекте")],
    ["facade-sketch-all-cabinets-0-90-180-270", facadeResults.every(Boolean)],
    ["sketch-layout-parts-0-90-180-270", sketchChecks],
    ["sketch-drawing-snaps-and-insert", drawingChecks],
    ["sketch-move-and-remove-panel", editingChecks],
    ["sketch-voice-commands", commandChecks],
    ["voice-speech-without-commas", speechChecks],
    ["undo-redo-history", historyChecks],
    ["fixed-views-front-top-left", viewChecks],
    ["menu-bar-single-open", menuChecks],
    ["material-catalog-custom-code",customMaterial.code === "egger-w1000" && customMaterial.thickness === 18 &&
      customMaterial.color === "#f2f2ee" && customMaterial.grain === "none" &&
      rejectsMaterial({ code: "Дуб" }) && rejectsMaterial({ code: "oak" }) && rejectsMaterial({ name: "" }) &&
      rejectsMaterial({ thickness: "150" }) && rejectsMaterial({ color: "белый" }) &&
      validResourceBundle({ ...sampleBundle, materials: [...sampleMaterials, customMaterial] }) &&
      !validResourceBundle({ ...sampleBundle, materials: [...sampleMaterials, { ...customMaterial, code: "W 1000" }] }) &&
      !validResourceBundle({ ...sampleBundle, materials: [...sampleMaterials, customMaterial, customMaterial] }) &&
      validCabinet(customMaterialProduct.parameters) &&
      !validCabinet({ ...customMaterialProduct.parameters, color: "Белый!" }) &&
      projectMaterialCode(customMaterialProduct, customMaterialParts.find((part) => part.name === "Дно")) === "egger-w1000" &&
      projectMaterialCode(customMaterialProduct, customMaterialParts.find((part) => part.name === "Задняя стенка")) === "hdf" &&
      materialDisplayColor("egger-w1000", 0, [customMaterial]) === 0xf2f2ee &&
      materialDisplayColor("oak", 0, []) === colors.oak],
    ["material-thickness-mismatch-reported", materialThicknessIssues(customMaterialEntries, [customMaterial])
      .filter((issue) => issue.includes("не совпадает с толщиной материала")).length ===
        customMaterialParts.filter((part) => part.material !== "ХДФ").length &&
      materialThicknessIssues(customMaterialEntries, [{ ...customMaterial, thickness: 16 }]).length === 0 &&
      materialThicknessIssues(customMaterialEntries, [{ ...customMaterial, thickness: 0 }]).length === 0],
    ["legacy-placement-defaults",validCabinetPlacement({ x: 0, z: 0 })],
    ["placement-rejects-invalid-coordinates", !validCabinetPlacement({ x: 0, y: -100001, z: 0, rotationY: 0 })],
    ["quarter-turn-oriented-box", Math.abs(rotatedBox.center[0] - 210) < 0.001 &&
      Math.abs(rotatedBox.center[1] - 35) < 0.001 && Math.abs(rotatedBox.center[2] + 80) < 0.001 &&
      rotatedBox.size[0] === 100 && rotatedBox.size[2] === 200 &&
      rotatedBox.axes[0].every((value, axis) => Math.abs(value - [0, 0, -1][axis]) < 0.001)],
    ["custom-panel-default-axes-0-90-180-270", customPanelChecks],
    ["coordinate-round-trip-0-90-180-270", transformChecks],
    ["cabinet-side-faces-0-90-180-270", quarterTurnResults.every((result) => result.side)],
    ["door-swing-local-front-0-90-180-270", quarterTurnResults.every((result) => result.door)],
    ["drawer-extension-local-front-0-90-180-270", quarterTurnResults.every((result) => result.drawer)],
    ["drawer-sides-along-depth-inside-cabinet-0-90-180-270", quarterTurnResults.every((result) => result.drawerSides)],
    ["drawers-inside-divider-section-0-90-180-270", drawerLayoutResults.every((result) => result.section)],
    ["shelves-above-drawer-zone-0-90-180-270", drawerLayoutResults.every((result) => result.shelves)],
    ["doors-with-drawers-warning-0-90-180-270", drawerLayoutResults.every((result) => result.doors)],
    ["confirmat-points-0-90-180-270", quarterTurnResults.every((result) => result.hardware)],
    ["tool-access-corridor-0-90-180-270", quarterTurnResults.every((result) => result.access)],
    ["assembly-front-approach-rotates", Math.abs(
      frontInstallZone.center[0] - frontInstallTarget.box.center[0] - 50,
    ) < 0.001 && Math.abs(frontInstallZone.center[2] - frontInstallTarget.box.center[2]) < 0.001],
    ["module-intersection", cabinetModulesOverlap(fallbackProduct, nearbyProduct) &&
      !cabinetModulesOverlap(fallbackProduct, elevatedProduct) &&
      !cabinetModulesOverlap(fallbackProduct, rotatedSeparateProduct) &&
      cabinetModulesOverlap(fallbackProduct, { ...nearbyProduct, rotationY: 180 }) &&
      cabinetModulesOverlap(fallbackProduct, { ...rotatedSeparateProduct, z: 650, rotationY: 270 }) &&
      !cabinetModulesOverlap(fallbackProduct, { ...rotatedSeparateProduct, rotationY: 270 })],
    ["floor-check", boxBelowFloor(floorTestBox) && !boxBelowFloor({ ...floorTestBox, center: [0, 6, 0] })],
    ["complete-specification", specification.length > 1 &&
      specification.every((row) => row.length === specification[0].length)],
    ["sheet-fit-directional-part-fits", sheetFit(sheetFitPart(2200, 600), "directional").issues.length === 0],
    ["sheet-fit-oversized-part-reported", sheetFit(sheetFitPart(2900, 600), "directional").partMessages.size === 1],
    ["sheet-fit-rotation-only-without-grain", sheetFit(sheetFitPart(600, 2700), "none").issues.length === 0 &&
      sheetFit(sheetFitPart(600, 2700), "directional").issues.length === 1],
    ["sheet-fit-machine-limit-reported", sheetFit(sheetFitPart(600, 400), "directional", { machineWidth: 2500 })
      .issues.some((issue) => issue.includes("габарита станка"))],
    ["price-list-search-and-assignment", priceSearch.total === 1 && priceSearch.items[0].article === "138900" &&
      priceItemAssignable(samplePriceList.items[0]) && !priceItemAssignable(samplePriceList.items[1]) &&
      !priceItemAssignable(samplePriceList.items[2]) &&
      priceFields.price === 4725 && priceFields.currency === "UAH" && priceFields.sheetWidth === 2800 &&
      priceFields.sheetLength === 2070 && priceFields.priceStatus === "needs-review" &&
      priceFields.priceDate === "2026-10-30" && priceFields.priceSource.includes("138900")],
    ["price-list-index-rejects-unsafe-path", validPriceListIndex({ schemaVersion: 1, lists: [
      { path: "kronas/01.json", category: "Плиты", supplier: "KRONAS", currency: "UAH", fileDate: "2026-10-30", stats: { items: 1 } },
    ] }) && !validPriceListIndex({ schemaVersion: 1, lists: [
      { path: "../secret.json", category: "Плиты", supplier: "KRONAS", currency: "UAH", fileDate: "2026-10-30", stats: { items: 1 } },
    ] })],
    ["voice-set-example-three-modules", exampleModules.length === 3 &&
      [800, 600, 400].every((width, index) => exampleModules[index].parsed.width === width) &&
      exampleModules.every((module) => module.parsed.height === 720 && module.parsed.depth === 560 &&
        module.parsed.thickness === 18 && module.parsed.material === "ldsp" && module.parsed.type === "lower-cabinet") &&
      exampleModules.map((module) => module.parsed.name).join("|") === "Мойка|Тумба с ящиками|Шкаф с дверцами" &&
      voiceSetExample.direction.value === "left-to-right" && voiceSetExample.declaredCount === 3 &&
      exampleModules[0].unitsMissing && !exampleModules[2].unitsMissing &&
      exampleModules[0].parsed.purpose === "мойка" &&
      exampleModules[1].parsed.drawers === null && exampleModules[2].parsed.doors === null],
    ["voice-set-conflict-negative-correction", moduleIssue(voiceSetConflicts, 0, "width") &&
      voiceSetConflicts.modules[0].parsed.width === null &&
      moduleIssue(voiceSetConflicts, 1, "width") && voiceSetConflicts.modules[1].parsed.width === null &&
      voiceSetConflicts.modules[2].parsed.width === 600 && voiceSetConflicts.modules[2].parsed.type === "tall-cabinet" &&
      voiceSetConflicts.corrections.length === 1],
    ["voice-set-count-order-hardware", voiceSetAmbiguous.declaredCount === 2 && voiceSetAmbiguous.modules.length === 3 &&
      voiceSetAmbiguous.direction.value === "" && voiceSetAmbiguous.direction.adjacencyOnly &&
      voiceSetAmbiguous.modules[2].parsed.hardware.includes("петли")],
    ["voice-set-needs-two-modules", voiceSetSingle.modules.length === 1 &&
      voiceSetSingle.issues.some((issue) => issue.permanent)],
    ["voice-set-atomic-creation", voiceSetInvalid.cabinets.length === 0 && voiceSetInvalid.errors.length === 1 &&
      voiceSetValid.cabinets.length === 2 && voiceSetValid.cabinets.every((cabinet) => validSourceInfo(cabinet.sourceInfo)) &&
      products.length === productCountBefore],
    ["specification-product-source", specification.slice(1)
      .filter((row) => row[0] === "Деталь")
      .every((row) => typeof row[1] === "string" && !!row[1] && typeof row[2] === "string" && !!row[2])],
  ];
  return { ok: checks.every(([, passed]) => passed), results: checks };
}
function projectMaterialCode(product, part) {
  if (part.material === "ХДФ") return "hdf";
  if (typeof part.material === "string" && materialCodePattern.test(part.material)) return part.material;
  return product.parameters.color;
}

function viyarMaterialGroups() {
  const groups = new Map();
  for (const product of products) {
    for (const part of getProductParts(product)) {
      const code = projectMaterialCode(product, part);
      const key = `${code}|${part.thickness}`;
      const group = groups.get(key) || { code, thickness: part.thickness, parts: [] };
      group.parts.push({ product, part });
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

function renderViyarExportGroups() {
  const select = byId("viyar-export-group");
  if (!select) return;
  const selectedKey = select.value;
  const groups = viyarMaterialGroups();
  const options = groups.map(({ code, thickness, parts }) => {
    const material = projectResources.materials.find((item) => item.code === code);
    return [`${code}|${thickness}`,
      `${material?.name || code} · ${thickness} мм · ${parts.length} деталей`];
  });
  addSelectOptions(select, options, selectedKey);
  const button = byId("viyar-export-csv");
  button.disabled = options.length === 0;
  if (options.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Нет деталей для экспорта";
    select.replaceChildren(empty);
    byId("viyar-export-status").textContent = "Добавьте корпус с деталями, чтобы подготовить список.";
    return;
  }
  const edgeThickness = Number(byId("edgeThickness").value);
  const hasEdgedParts = groups.some((item) => item.parts.some(({ part }) => part.edges?.some(Boolean)));
  byId("viyar-export-status").textContent = hasEdgedParts && edgeThickness === 0.4
    ? "ВНИМАНИЕ: ВИЯР трактует индекс кромки 1 как 0,5 мм по умолчанию. Проверьте/выберите точную кромку в ViyarPro; 0,4 мм этим индексом не подтверждается."
    : "CSV передаёт размеры FURNIX без пересчёта и кромки по схеме ВИЯР. Проверьте ориентацию кромок контрольным импортом, затем сверьте список и назначьте материал/кромку в ViyarPro.";
}

function viyarExportCsv() {
  const [code, thicknessText] = byId("viyar-export-group").value.split("|");
  const thickness = Number(thicknessText);
  const group = viyarMaterialGroups().find((item) =>
    item.code === code && item.thickness === thickness);
  if (!group || !Number.isFinite(thickness)) {
    throw new Error("Выберите существующую группу материала и толщины.");
  }
  const edgeThickness = Number(byId("edgeThickness").value);
  const edgeIndex = edgeThickness === 2 ? 2 : 1;
  const rows = [[
    "Довжина", "Ширина", "К-сть", "В", "Н", "Л", "П", "Текстура", "Назва", "Кратність зрощення",
  ]];
  for (const { product, part } of group.parts) {
    const edges = part.edges || [false, false, false, false];
    rows.push([
      part.length,
      part.width,
      1,
      edges[0] ? edgeIndex : 0,
      edges[1] ? edgeIndex : 0,
      edges[2] ? edgeIndex : 0,
      edges[3] ? edgeIndex : 0,
      projectResources.materials.find((item) => item.code === group.code)?.grain === "none" ? "-" : "+",
      `${product.name} / ${part.name}`,
      1,
    ]);
  }
  return {
    filename: `furnix-viyarpro-${code}-${String(thickness).replace(".", "_")}mm.csv`,
    csv: csvText(rows),
    count: group.parts.length,
  };
}

function addStockSheet(sheets, material, thickness, width, length, trim, kind, id) {
  const usableWidth = kind === "board" ? width - 2 * trim : width;
  const usableLength = kind === "board" ? length - 2 * trim : length;
  if (usableWidth <= 0 || usableLength <= 0) {
    throw new Error(`Припуск ${trim} мм не оставляет рабочую область на листе ${width}×${length} мм.`);
  }
  sheets.push({
    id,
    material,
    thickness,
    width,
    length,
    kind,
    used: false,
    free: [{ x: kind === "board" ? trim : 0, y: kind === "board" ? trim : 0, width: usableWidth, length: usableLength }],
    placements: [],
  });
}

// Same placement rule as optimizeCutPlan: the part plus kerf must fit the trimmed sheet or a remnant;
// rotation is allowed only for materials without grain direction.
function partFitsStock(part, material, sheet, trim, kerf, remnants) {
  const orientations = material.grain === "none"
    ? [[part.length, part.width], [part.width, part.length]]
    : [[part.length, part.width]];
  const areas = [
    { width: sheet.width - 2 * trim, length: sheet.length - 2 * trim },
    ...remnants.map((remnant) => ({ width: remnant.width, length: remnant.length })),
  ];
  return areas.some((area) => orientations.some(([width, length]) =>
    width + kerf <= area.width && length + kerf <= area.length));
}

function sheetFitIssues(entries, { materials, cutSettings, remnants, kerf, sheetFormat }) {
  const [selectedWidth, selectedLength] = String(sheetFormat || "").split("x").map(Number);
  const issues = [];
  const partMessages = new Map();
  const checkedSheets = new Set();
  for (const { product, part } of entries) {
    const materialCode = projectMaterialCode(product, part);
    const material = materials.find((item) => item.code === materialCode);
    const label = `${product.name} · ${part.name}`;
    if (!material) {
      const message = `${label}: материал «${materialCode}» отсутствует в каталоге, раскрой детали невозможен.`;
      issues.push(message);
      partMessages.set(`${product.id}:${part.id}`, message);
      continue;
    }
    const sheet = { width: material.sheetWidth || selectedWidth, length: material.sheetLength || selectedLength };
    const trim = cutSettings.trim || 0;
    const sheetKey = `${material.code}|${sheet.width}|${sheet.length}`;
    if (!checkedSheets.has(sheetKey)) {
      checkedSheets.add(sheetKey);
      if ((cutSettings.machineWidth && sheet.width > cutSettings.machineWidth) ||
          (cutSettings.machineLength && sheet.length > cutSettings.machineLength)) {
        issues.push(`Лист «${material.name}» ${sheet.width}×${sheet.length} мм больше габарита станка ${cutSettings.machineWidth || "—"}×${cutSettings.machineLength || "—"} мм.`);
      }
      if (sheet.width - 2 * trim <= 0 || sheet.length - 2 * trim <= 0) {
        issues.push(`Припуск ${trim} мм не оставляет рабочей области на листе «${material.name}» ${sheet.width}×${sheet.length} мм.`);
      }
    }
    const stockRemnants = remnants.filter((item) => item.material === material.code && item.thickness === part.thickness);
    if (!partFitsStock(part, material, sheet, trim, kerf, stockRemnants)) {
      const grainNote = material.grain === "none" ? "" : "; поворот запрещён направлением текстуры";
      const message = `${label}: ${part.length}×${part.width} мм не помещается на лист «${material.name}» ${sheet.width}×${sheet.length} мм (рабочая область ${sheet.width - 2 * trim}×${sheet.length - 2 * trim} мм при припуске ${trim} мм, пропил ${kerf} мм${grainNote}).`;
      issues.push(message);
      partMessages.set(`${product.id}:${part.id}`, message);
    }
  }
  return { issues, partMessages };
}

function projectSheetFitIssues(entries = products.flatMap((product) =>
  getProductParts(product).map((part) => ({ product, part })))) {
  const kerf = Number(byId("kerf")?.value);
  return sheetFitIssues(entries, {
    materials: projectResources.materials,
    cutSettings: projectResources.cutSettings,
    remnants: projectResources.remnants,
    kerf: Number.isFinite(kerf) ? kerf : 0,
    sheetFormat: byId("sheet")?.value,
  });
}

function optimizeCutPlan() {
  const { cutSettings, materials, remnants } = readResourceForm();
  const kerf = Number(byId("kerf").value);
  if (!Number.isFinite(kerf) || kerf < 0 || kerf > 12) throw new Error("Недопустимый пропил.");
  const [selectedWidth, selectedLength] = byId("sheet").value.split("x").map(Number);
  const fit = sheetFitIssues(
    products.flatMap((product) => getProductParts(product).map((part) => ({ product, part }))),
    { materials, cutSettings, remnants, kerf, sheetFormat: byId("sheet").value },
  );
  if (fit.issues.length) throw new Error(fit.issues[0]);
  const pieces = products.flatMap((product) => getProductParts(product).map((part) => ({
    product,
    part,
    material: projectMaterialCode(product, part),
    thickness: part.thickness,
    area: part.length * part.width,
  }))).sort((a, b) => b.area - a.area);
  const groups = new Map();
  for (const piece of pieces) {
    const key = `${piece.material}|${piece.thickness}`;
    const list = groups.get(key) || [];
    list.push(piece);
    groups.set(key, list);
  }
  const updatedRemnants = remnants
    .filter((remnant) => !groups.has(`${remnant.material}|${remnant.thickness}`))
    .map((remnant) => ({ ...remnant }));
  const remnantIds = new Set(remnants.map((remnant) => remnant.id));
  const result = [];
  for (const [key, items] of groups) {
    const [materialCode, thicknessText] = key.split("|");
    const thickness = Number(thicknessText);
    const material = materials.find((item) => item.code === materialCode);
    if (!material) throw new Error(`Материал «${materialCode}» отсутствует в каталоге.`);
    const width = material.sheetWidth || selectedWidth;
    const length = material.sheetLength || selectedLength;
    if ((cutSettings.machineWidth && width > cutSettings.machineWidth) ||
        (cutSettings.machineLength && length > cutSettings.machineLength)) {
      throw new Error(`Лист ${material.name} ${width}×${length} мм превышает заданный габарит станка.`);
    }
    const stock = [];
    const stockRemnants = remnants.filter((item) => item.material === materialCode && item.thickness === thickness);
    for (const remnant of stockRemnants) {
      addStockSheet(stock, materialCode, thickness, remnant.width, remnant.length, 0, "remnant", remnant.id);
      stock[stock.length - 1].sourceRemnant = remnant;
    }
    const unusedRemnants = [...stockRemnants];
    for (const item of items) {
      const rotations = material.grain === "none"
        ? [{ width: item.part.length, length: item.part.width, rotated: false },
          { width: item.part.width, length: item.part.length, rotated: true }]
        : [{ width: item.part.length, length: item.part.width, rotated: false }];
      let choice = null;
      for (const sheet of stock) {
        for (const free of sheet.free) {
          for (const orientation of rotations) {
            const reservedWidth = orientation.width + kerf;
            const reservedLength = orientation.length + kerf;
            if (reservedWidth > free.width || reservedLength > free.length) continue;
            const score = Math.min(free.width - reservedWidth, free.length - reservedLength) +
              Math.max(free.width - reservedWidth, free.length - reservedLength);
            if (!choice || score < choice.score) {
              choice = { sheet, free, orientation, reservedWidth, reservedLength, score };
            }
          }
        }
      }
      if (!choice) {
        addStockSheet(stock, materialCode, thickness, width, length, cutSettings.trim, "board", `sheet-${result.length + stock.length + 1}`);
        const sheet = stock[stock.length - 1];
        for (const free of sheet.free) {
          for (const orientation of rotations) {
            const reservedWidth = orientation.width + kerf;
            const reservedLength = orientation.length + kerf;
            if (reservedWidth <= free.width && reservedLength <= free.length) {
              choice = { sheet, free, orientation, reservedWidth, reservedLength, score: free.width * free.length - reservedWidth * reservedLength };
              break;
            }
          }
          if (choice) break;
        }
      }
      if (!choice) {
        const machineInfo = cutSettings.machineWidth || cutSettings.machineLength
          ? ` Ограничение станка: ${cutSettings.machineWidth || "—"}×${cutSettings.machineLength || "—"} мм.`
          : "";
        throw new Error(`Деталь «${item.part.name}» ${item.part.length}×${item.part.width} мм не помещается на лист ${width}×${length} мм с припуском ${cutSettings.trim} мм и пропилом ${kerf} мм.${machineInfo}`);
      }
      const { sheet, free, orientation, reservedWidth, reservedLength } = choice;
      sheet.used = true;
      sheet.placements.push({
        product: item.product.name,
        part: item.part.name,
        x: free.x,
        y: free.y,
        width: orientation.width,
        length: orientation.length,
        thickness,
        rotated: orientation.rotated,
      });
      sheet.free = sheet.free.filter((candidate) => candidate !== free);
      const remainingWidth = free.width - reservedWidth;
      const remainingLength = free.length - reservedLength;
      if (remainingWidth > 0) sheet.free.push({ x: free.x + reservedWidth, y: free.y, width: remainingWidth, length: reservedLength });
      if (remainingLength > 0) sheet.free.push({ x: free.x, y: free.y + reservedLength, width: free.width, length: remainingLength });
      const sourceIndex = unusedRemnants.indexOf(sheet.sourceRemnant);
      if (sourceIndex >= 0) unusedRemnants.splice(sourceIndex, 1);
    }
    for (const sheet of stock) {
      if (!sheet.used) continue;
      result.push(sheet);
      for (const free of sheet.free) {
        if (free.width >= cutSettings.minRemnant && free.length >= cutSettings.minRemnant) {
          const baseId = `remnant-${materialCode}-${thickness}-${Math.round(free.width)}-${Math.round(free.length)}`;
          let id = baseId;
          let suffix = 1;
          while (remnantIds.has(id)) id = `${baseId}-${suffix++}`;
          remnantIds.add(id);
          updatedRemnants.push({
            id,
            material: materialCode,
            thickness,
            width: Math.floor(free.width),
            length: Math.floor(free.length),
          });
        }
      }
    }
    for (const remnant of unusedRemnants) {
      updatedRemnants.push({ ...remnant });
    }
  }
  projectResources.cutSettings = cutSettings;
  projectResources.materials = materials;
  projectResources.remnants = updatedRemnants;
  renderCutPlan(result, cutSettings);
  return result;
}

function renderCutPlan(sheets, settings) {
  const target = byId("resource-cut");
  target.innerHTML = sheets.map((sheet, index) => {
    const scale = 0.18;
    const placements = sheet.placements.map((item) =>
      `<div style="position:absolute;left:${(item.x - (sheet.kind === "board" ? settings.trim : 0)) * scale}px;top:${(item.y - (sheet.kind === "board" ? settings.trim : 0)) * scale}px;width:${item.width * scale}px;height:${item.length * scale}px;border:1px solid #14202c;background:#9fc6dcaa;color:#14202c;overflow:hidden;font-size:9px" title="${escapeHtmlText(item.product)}: ${escapeHtmlText(item.part)}">${escapeHtmlText(item.part)}${item.rotated ? " ↻" : ""}</div>`).join("");
    const left = sheet.free.filter((area) => area.width >= settings.minRemnant && area.length >= settings.minRemnant)
      .map((area) => `${Math.floor(area.width)}×${Math.floor(area.length)}`).join(", ") || "нет";
    return `<section style="margin:8px 0;color:#14202c;background:#fff;padding:8px">
      <strong>${sheet.kind === "remnant" ? "Остаток" : "Лист"} ${index + 1} · ${escapeHtmlText(sheet.material)} · ${sheet.thickness} мм · ${sheet.width}×${sheet.length} мм</strong>
      <div style="position:relative;margin:8px auto;width:${sheet.width * scale}px;height:${sheet.length * scale}px;border:1px solid #435260;background:#f2f4f6;overflow:hidden">${placements}</div>
      <small>Деталей: ${sheet.placements.length}; пригодные остатки: ${left}</small>
    </section>`;
  }).join("") || "<p>Нет деталей для раскроя.</p>";
  byId("resource-status").textContent =
    `Раскладка рассчитана: ${sheets.length} листов/остатков, деталей: ${sheets.reduce((sum, sheet) => sum + sheet.placements.length, 0)}. Учтены пропил, припуск, текстура материала и введённые ограничения станка. Алгоритм guillotine best-fit — эвристика, требует сравнения с производственным оптимизатором.`;
}

function addSelectOptions(select, options, selectedValue) {
  select.replaceChildren(...options.map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }));
  if (options.some(([value]) => value === selectedValue)) select.value = selectedValue;
}

function operationProductOptions() {
  return products
    .filter((product) => product.type === "cabinet")
    .map((product) => [product.id, product.name]);
}

function operationPartOptions(productId) {
  const product = products.find((item) => item.id === productId);
  return product
    ? getProductParts(product).map((part) => [part.id, part.name])
    : [];
}

function renderAssemblyPlan() {
  const form = byId("assembly-operation-form");
  const operationsRoot = byId("assembly-plan-operations");
  if (!form || !operationsRoot) return;
  const productSelect = form.elements.namedItem("productId");
  const targetSelect = form.elements.namedItem("targetPartId");
  const dependencySelect = form.elements.namedItem("dependsOn");
  const currentProductId = productSelect.value || selected.productId || products[0]?.id || "";
  addSelectOptions(productSelect, operationProductOptions(), currentProductId);
  const productId = productSelect.value;
  addSelectOptions(targetSelect, operationPartOptions(productId), targetSelect.value || selected.partId || "");
  addSelectOptions(dependencySelect,
    projectResources.assemblyPlan.operations.map((operation) => [operation.id, operation.name]), "");

  operationsRoot.replaceChildren(...projectResources.assemblyPlan.operations.map((operation, index) => {
    const card = document.createElement("form");
    card.className = "assembly-operation";
    card.addEventListener("submit", (event) => event.preventDefault());
    const heading = document.createElement("strong");
    heading.textContent = `${index + 1}. ${operation.name}`;
    card.append(heading);

    const fields = document.createElement("div");
    fields.className = "plan-grid";
    const addField = (labelText, control) => {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.append(control);
      fields.append(label);
    };
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "name";
    nameInput.maxLength = 100;
    nameInput.value = operation.name;
    nameInput.required = true;
    addField("Название операции", nameInput);
    const product = products.find((item) => item.id === operation.productId);
    const targetPart = product && findPartById(getProductParts(product), operation.targetPartId);
    const kindSelect = document.createElement("select");
    kindSelect.name = "kind";
    addSelectOptions(kindSelect, Object.entries(assemblyOperationLabels), operation.kind);
    addField("Тип операции", kindSelect);
    const productSelect = document.createElement("select");
    productSelect.name = "productId";
    addSelectOptions(productSelect, operationProductOptions(), operation.productId);
    addField("Изделие", productSelect);
    const partSelect = document.createElement("select");
    partSelect.name = "targetPartId";
    addSelectOptions(partSelect, operationPartOptions(operation.productId), operation.targetPartId);
    addField("Целевая деталь", partSelect);
    const approachSelect = document.createElement("select");
    approachSelect.name = "approach";
    addSelectOptions(approachSelect, [
      ["front", "Спереди (+Z)"], ["back", "Сзади (-Z)"],
      ["left", "Слева (-X)"], ["right", "Справа (+X)"],
      ["top", "Сверху (+Y)"], ["bottom", "Снизу (-Y)"],
    ], operation.approach);
    addField("Направление подхода", approachSelect);
    for (const [fieldName, labelText, min, max] of [
      ["travel", "Ход, мм", 0, 2000],
      ["accessWidth", "Ширина зоны, мм", 1, 1000],
      ["accessHeight", "Высота зоны, мм", 1, 1000],
    ]) {
      const input = document.createElement("input");
      input.type = "number";
      input.name = fieldName;
      input.min = String(min);
      input.max = String(max);
      input.step = "5";
      input.value = operation[fieldName];
      input.required = true;
      addField(labelText, input);
    }
    const dependencies = document.createElement("select");
    dependencies.name = "dependsOn";
    dependencies.multiple = true;
    dependencies.size = 4;
    addSelectOptions(dependencies, projectResources.assemblyPlan.operations
      .filter((candidate) => candidate.id !== operation.id)
      .map((candidate) => [candidate.id, candidate.name]), "");
    for (const option of dependencies.options) {
      option.selected = operation.dependsOn.includes(option.value);
    }
    addField("Предшествующие операции", dependencies);
    card.append(fields);
    const actions = document.createElement("div");
    actions.className = "source-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.dataset.saveOperation = operation.id;
    save.textContent = "Сохранить";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.removeOperation = operation.id;
    remove.textContent = "Удалить";
    actions.append(save, remove);
    card.append(actions);
    if (!targetPart) {
      const warning = document.createElement("p");
      warning.className = "note";
      warning.textContent = "Целевая деталь не найдена в текущем проекте.";
      card.append(warning);
    }
    return card;
  }));

  const graph = byId("assembly-plan-graph");
  const nodes = projectResources.assemblyPlan.operations;
  const width = Math.max(360, 40 + Math.max(1, ...nodes.map((operation) =>
    (latestAssemblyAnalysis.ranks.get(operation.id) || 0) + 1)) * 220);
  const rowByRank = new Map();
  const positions = new Map();
  for (const operation of nodes) {
    const rank = latestAssemblyAnalysis.ranks.get(operation.id) || 0;
    const row = rowByRank.get(rank) || 0;
    rowByRank.set(rank, row + 1);
    positions.set(operation.id, { x: 20 + rank * 220, y: 22 + row * 76 });
  }
  const height = Math.max(90, 44 + Math.max(1, ...rowByRank.values()) * 76);
  graph.setAttribute("viewBox", `0 0 ${width} ${height}`);
  graph.setAttribute("width", String(width));
  graph.setAttribute("height", String(height));
  const links = nodes.flatMap((operation) => operation.dependsOn
    .filter((dependencyId) => positions.has(dependencyId))
    .map((dependencyId) => {
      const from = positions.get(dependencyId);
      const to = positions.get(operation.id);
      return `<path d="M ${from.x + 178} ${from.y + 24} C ${from.x + 202} ${from.y + 24}, ${to.x - 24} ${to.y + 24}, ${to.x} ${to.y + 24}" fill="none" stroke="#7996a6" stroke-width="2" marker-end="url(#assembly-arrow)"/>`;
    })).join("");
  const graphNodes = nodes.map((operation) => {
    const point = positions.get(operation.id);
    const target = operationTarget(operation);
    const issue = latestAssemblyAnalysis.issues.some((item) =>
      !item.startsWith("Информация:") && item.startsWith(`${operation.name}:`));
    const color = issue ? "#713d43" : "#254e4a";
    const detail = target ? `${target.product.name} · ${target.part.name}` : "Деталь не найдена";
    return `<g><title>${escapeHtmlText(operation.name)} — ${escapeHtmlText(detail)}</title>
      <rect x="${point.x}" y="${point.y}" width="178" height="48" rx="6" fill="${color}" stroke="${issue ? "#ff8e86" : "#6ec8ad"}"/>
      <text x="${point.x + 8}" y="${point.y + 18}" fill="#f3f6f7" font-size="11">${escapeHtmlText(operation.name.slice(0, 25))}</text>
      <text x="${point.x + 8}" y="${point.y + 36}" fill="#b9c9d0" font-size="9">${escapeHtmlText(assemblyOperationLabels[operation.kind])}</text></g>`;
  }).join("");
  graph.innerHTML = `<defs><marker id="assembly-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7996a6"/></marker></defs>${links}${graphNodes}`;

  const report = byId("assembly-plan-report");
  const findings = latestAssemblyAnalysis.issues;
  const errors = findings.filter((item) => !item.startsWith("Информация:"));
  const information = findings.filter((item) => item.startsWith("Информация:"));
  report.className = errors.length ? "error" : "valid";
  report.textContent = errors.length
    ? `Физическая проверка: ${errors.length} замечаний.\n${errors.slice(0, 30).map((item) => `• ${item}`).join("\n")}${errors.length > 30 ? "\n… показаны первые 30" : ""}\n\nПорядок рассчитан по зависимостям; столкновения проверяются прямоугольными объёмами и дискретным перемещением. Это предварительная проверка, не производственный допуск.`
    : nodes.length
      ? `Порядок зависимостей непротиворечив, препятствий на проверенных монтажных путях и зонах доступа не обнаружено.${information.length ? `\n${information.slice(0, 20).join("\n")}` : ""}\n\nПроверка предварительная: форма упрощена до прямоугольных объёмов.`
      : "Граф операций пуст. Добавьте операции вручную или создайте черновой граф.";
  if (constructionChangeNotice) report.textContent += `\n\n${constructionChangeNotice}`;
  renderConstructionChanges();
}

function renderConstructionChanges() {
  const root = byId("assembly-change-options");
  if (!root) return;
  availableConstructionChanges = proposeConstructionChanges();
  if (availableConstructionChanges.length) {
    const heading = document.createElement("h3");
    heading.textContent = "Предложения по исправлению";
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Варианты рассчитаны на копии текущего проекта; ничего не меняется до нажатия «Применить вариант».";
    const cards = availableConstructionChanges.map((proposal, index) => {
      const card = document.createElement("section");
      card.className = "construction-change";
      const title = document.createElement("strong");
      title.textContent = proposal.title;
      const summary = document.createElement("p");
      summary.textContent = proposal.summary;
      card.append(title, summary);

      const impact = document.createElement("p");
      impact.className = "change-impact";
      impact.textContent = `Последствия:\n${proposal.consequences.map((line) => `• ${line}`).join("\n")}`;
      card.append(impact);

      const resolved = document.createElement("p");
      resolved.textContent = `Симуляция устраняет замечаний: ${proposal.resolved.length}. ${proposal.resolved.slice(0, 2).join(" · ")}`;
      card.append(resolved);
      if (proposal.remaining.length) {
        const remaining = document.createElement("p");
        remaining.textContent = `Останутся замечания: ${proposal.remaining.length}. ${proposal.remaining.slice(0, 2).join(" · ")}`;
        card.append(remaining);
      } else {
        const clear = document.createElement("p");
        clear.textContent = "В этой проверке других замечаний не осталось.";
        card.append(clear);
      }

      const apply = document.createElement("button");
      apply.type = "button";
      apply.dataset.applyConstructionChange = String(index);
      apply.textContent = "Применить вариант";
      card.append(apply);
      return card;
    });
    root.replaceChildren(heading, note, ...cards);
    return;
  }
  root.replaceChildren();
  if ([...issueSet(latestAssemblyAnalysis.issues), ...issueSet(latestCollisionIssues)].length) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Для текущих замечаний безопасный автоматический вариант не найден. Измените параметры вручную и повторите проверку; система не будет предлагать неподтверждённое исправление.";
    root.append(note);
  }
}

function applyConstructionChange(index) {
  const proposal = availableConstructionChanges[index];
  if (!proposal) return;
  if (proposal.plan) {
    if (!validAssemblyPlan(proposal.plan)) {
      throw new Error("Предложенный граф повреждён; вариант не применён.");
    }
    projectResources.assemblyPlan = structuredClone(proposal.plan);
  }
  if (proposal.collisionSettings) {
    if (!collisionSettingsValid(proposal.collisionSettings)) {
      throw new Error("Предложенные настройки движения недопустимы; вариант не применён.");
    }
    projectResources.collisionSettings = structuredClone(proposal.collisionSettings);
    renderCollisionControls();
  }
  constructionChangeNotice = `Применён вариант «${proposal.title}». Проверка пересчитана; сверьте новое состояние конструкции и сохраните проект обычным способом.`;
  renderModel();
}

function operationFromForm(form, id) {
  const values = new FormData(form);
  if (["travel", "accessWidth", "accessHeight"].some((key) =>
    String(values.get(key) ?? "").trim() === "")) {
    throw new Error("Укажите ход и размеры монтажной зоны.");
  }
  return {
    id,
    name: String(values.get("name") || "").trim(),
    kind: String(values.get("kind") || ""),
    productId: String(values.get("productId") || ""),
    targetPartId: String(values.get("targetPartId") || ""),
    approach: String(values.get("approach") || ""),
    travel: Number(values.get("travel")),
    accessWidth: Number(values.get("accessWidth")),
    accessHeight: Number(values.get("accessHeight")),
    dependsOn: values.getAll("dependsOn").map(String),
  };
}

function showAssemblyPlanError(message) {
  const report = byId("assembly-plan-report");
  report.className = "error";
  report.textContent = message;
}

function addAssemblyPlanOperation(operation) {
  const nextPlan = { operations: [...projectResources.assemblyPlan.operations, operation] };
  if (!validAssemblyPlan(nextPlan)) {
    throw new Error("Проверьте название, тип операции, направление и размеры монтажной зоны.");
  }
  if (!operationTarget(operation)) {
    throw new Error("Выберите существующее изделие и целевую деталь.");
  }
  projectResources.assemblyPlan = nextPlan;
}

function generateDraftAssemblyPlan() {
  const plan = [];
  for (const product of products) {
    let previousId = null;
    for (const part of getProductParts(product)) {
      const operation = {
        id: `operation-${Date.now()}-${++serial}`,
        name: `Установить: ${part.name}`,
        kind: "install",
        productId: product.id,
        targetPartId: part.id,
        ...assemblyOperationDefaults(),
        approach: part.orientation === "back" ? "back" : "front",
        dependsOn: previousId ? [previousId] : [],
      };
      plan.push(operation);
      previousId = operation.id;
    }
  }
  if (!plan.length) throw new Error("В проекте нет деталей для построения плана сборки.");
  if (plan.length > 500) throw new Error("Черновой план превышает ограничение в 500 операций.");
  projectResources.assemblyPlan = { operations: plan };
}

function renderResourceControls() {
  resourceForm();
  renderCollisionControls();
  latestAssemblyAnalysis = analyzeAssemblyPlan();
  renderAssemblyPlan();
}

function renderCollisionControls() {
  const settings = projectResources.collisionSettings;
  for (const input of document.querySelectorAll("[data-collision-setting]")) {
    const key = input.dataset.collisionSetting;
    if (input.type === "checkbox") input.checked = settings[key];
    else input.value = settings[key];
  }
  const list = byId("environment-zone-list");
  list.replaceChildren(...projectResources.environmentZones.map((zone) => {
    const row = document.createElement("div");
    row.className = "environment-zone-row";
    const label = document.createElement("span");
    label.textContent = `${zone.name} · ${zoneTypeLabels[zone.type]} · центр ${zone.x}, ${zone.y}, ${zone.z} · ${zone.width}×${zone.height}×${zone.depth} мм`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.removeZone = zone.id;
    remove.textContent = "Удалить";
    remove.setAttribute("aria-label", `Удалить зону ${zone.name}`);
    row.append(label, remove);
    return row;
  }));
}

function readCollisionForm() {
  const settings = {};
  for (const input of document.querySelectorAll("[data-collision-setting]")) {
    const key = input.dataset.collisionSetting;
    if (input.type === "number" && input.value.trim() === "") {
      throw new Error(`Параметр «${input.closest("label")?.textContent.trim()}» не задан.`);
    }
    settings[key] = input.type === "checkbox" ? input.checked :
      input.type === "number" ? Number(input.value) : input.value;
  }
  if (!collisionSettingsValid(settings)) {
    throw new Error("Проверьте параметры движения, шаг проверки и зазоры.");
  }
  if (!Array.isArray(projectResources.environmentZones) ||
      projectResources.environmentZones.length > 200 ||
      !projectResources.environmentZones.every(validEnvironmentZone)) {
    throw new Error("Список объёмных зон повреждён или превышает 200 записей.");
  }
  return {
    collisionSettings: settings,
    environmentZones: structuredClone(projectResources.environmentZones),
  };
}

function currentCutSignature() {
  const resources = readResourceForm();
  return JSON.stringify({
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      parts: getProductParts(product).map((part) => ({
        id: part.id, name: part.name, length: part.length, width: part.width,
        thickness: part.thickness, material: part.material, edges: part.edges,
      })),
    })),
    resources,
    sheet: byId("sheet").value,
    kerf: Number(byId("kerf").value),
  });
}

function updateRevisionOptions() {
  const select = byId("resource-form")?.elements.namedItem("revision");
  if (!select) return;
  const selectedValue = select.value;
  select.replaceChildren(...projectResources.history.map((item) => {
    const option = document.createElement("option");
    option.value = item.revision;
    option.textContent = `Редакция ${item.revision} · ${item.savedAt}`;
    return option;
  }));
  if (projectResources.history.some((item) => String(item.revision) === selectedValue)) select.value = selectedValue;
}

function partsDrawingSvg() {
  const entries = products.flatMap((product) => getProductParts(product).map((part) => ({ product, part })));
  const cardWidth = 390;
  const cardHeight = 210;
  const columns = 2;
  const rows = Math.max(1, Math.ceil(entries.length / columns));
  const width = columns * cardWidth + 30;
  const height = rows * cardHeight + 70;
  const cards = entries.map(({ product, part }, index) => {
    const x = 15 + index % columns * cardWidth;
    const y = 55 + Math.floor(index / columns) * cardHeight;
    const scale = Math.min(280 / part.length, 110 / part.width);
    const rectWidth = part.length * scale;
    const rectHeight = part.width * scale;
    const rectX = x + 24;
    const rectY = y + 34;
    const fill = part.material === "ХДФ" ? "#d8dfe3" : "#eef2f5";
    return `<g font-family="Arial,sans-serif" fill="#17212b">
      <text x="${x + 8}" y="${y + 16}" font-size="12">${index + 1}. ${escapeHtmlText(part.name)} · ${escapeHtmlText(product.name)}</text>
      <rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="${fill}" stroke="#111" stroke-width="1.5"/>
      <line x1="${rectX}" y1="${rectY + rectHeight + 13}" x2="${rectX + rectWidth}" y2="${rectY + rectHeight + 13}" stroke="#253746"/>
      <text x="${rectX + rectWidth / 2}" y="${rectY + rectHeight + 27}" font-size="11" text-anchor="middle">${part.length} мм</text>
      <text x="${rectX + rectWidth + 8}" y="${rectY + rectHeight / 2}" font-size="11">${part.width} мм</text>
      <text x="${x + 8}" y="${y + 190}" font-size="10">Толщина ${part.thickness} мм · ${escapeHtmlText(materialLabel(part.material || product.parameters.color))} · Кромки: ${escapeHtmlText(partEdgeLabel(part))}</text>
    </g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="white"/>
    <text x="15" y="24" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#14202c">Чертежи деталей · размеры в мм · эскиз, проверить перед производством</text>
    ${cards}
    <text x="15" y="${height - 12}" font-family="Arial,sans-serif" font-size="10" fill="#333">Отверстия, присадка и технологические операции не заданы.</text>
  </svg>`;
}

function assemblyDrawingSvg() {
  let nextProductY = 76;
  const productCards = products.filter((product) => product.type === "cabinet").map((product, productIndex) => {
    const parts = getProductParts(product);
    const parameters = product.parameters;
    const scale = Math.min(470 / parameters.width, 390 / parameters.height);
    const baseX = 35;
    const baseY = nextProductY;
    const cabinetWidth = parameters.width * scale;
    const cabinetHeight = parameters.height * scale;
    const listedParts = parts.map((part, index) => {
      const box = part.orientation ? partBox(part, product) : panelBox(part, product);
      const left = baseX + (box.center[0] - (product.x - parameters.width / 2)) * scale - box.size[0] * scale / 2;
      const top = baseY + (parameters.height - box.center[1] - box.size[1] / 2) * scale;
      const rectWidth = Math.max(2, box.size[0] * scale);
      const rectHeight = Math.max(2, box.size[1] * scale);
      const fill = part.orientation === "front" ? "#9cc9df" : part.orientation === "back" ? "#d0d5d9" : "#d9c39d";
      return `<g font-family="Arial,sans-serif">
        <rect x="${left}" y="${top}" width="${rectWidth}" height="${rectHeight}" fill="${fill}" fill-opacity="0.62" stroke="#1b2b39" stroke-width="1"/>
        <text x="${left + rectWidth / 2}" y="${top + rectHeight / 2 + 3}" font-size="9" text-anchor="middle" fill="#101820">${index + 1}</text>
      </g>`;
    }).join("");
    const listX = 550;
    const listY = baseY + 10;
    const partRows = parts.map((part, index) =>
      `<text x="${listX}" y="${listY + index * 19}" font-size="11">${index + 1}. ${escapeHtmlText(part.name)} — ${part.length}×${part.width}×${part.thickness} мм; ${escapeHtmlText(materialLabel(part.material || parameters.color))}</text>`
    ).join("");
    const hardwareY = listY + parts.length * 19 + 14;
    const hardware = (product.hardwareComponents || []).map((component, index) =>
      `<text x="${listX}" y="${hardwareY + index * 18}" font-size="10">${index + 1}. ${escapeHtmlText(component.id)} · ${escapeHtmlText(hardwareCategoryLabels[component.category] || component.category)} · ${escapeHtmlText(component.type)} ${escapeHtmlText(component.model)} · ${escapeHtmlText(componentReference(product, component))}</text>`
    ).join("");
    const connectionSummary = (product.connections || []).map((connection, index) => {
      const componentCount = (connection.componentIds || []).length;
      const partName = (partId) => findPartById(parts, partId)?.name || partId;
      return `<text x="${listX}" y="${hardwareY + ((product.hardwareComponents || []).length + index) * 18 + 20}" font-size="10">${escapeHtmlText(connection.id)} · ${escapeHtmlText(connection.name)}: ${escapeHtmlText(partName(connection.partA))} / ${escapeHtmlText(partName(connection.partB))} · крепежа: ${componentCount} · отступ ${connection.edgeInset} мм</text>`;
    }).join("");
    const listHeight = 120 + parts.length * 19 +
      (product.hardwareComponents || []).length * 18 + (product.connections || []).length * 18;
    nextProductY += Math.max(cabinetHeight + 70, listHeight) + 35;
    return `<g font-family="Arial,sans-serif" fill="#17212b">
      <text x="25" y="${baseY - 38}" font-size="16" font-weight="bold">${productIndex + 1}. ${escapeHtmlText(product.name)} · ${parameters.width}×${parameters.height}×${parameters.depth} мм</text>
      <rect x="${baseX}" y="${baseY}" width="${cabinetWidth}" height="${cabinetHeight}" fill="none" stroke="#31546a" stroke-width="2"/>
      ${listedParts}
      <text x="${listX}" y="${baseY - 9}" font-size="13" font-weight="bold">Детали и элементы модели</text>
      ${partRows}
      ${hardware.length ? `<text x="${listX}" y="${hardwareY - 8}" font-size="12" font-weight="bold">Фурнитура / ссылки</text>${hardware}` : ""}
      ${connectionSummary}
      <text x="25" y="${baseY + cabinetHeight + 24}" font-size="10">Нумерация на схеме соответствует списку деталей. Эскиз; не монтажный чертёж.</text>
    </g>`;
  }).join("");
  const height = Math.max(160, nextProductY);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000mm" height="${height}mm" viewBox="0 0 1000 ${height}">
    <rect width="100%" height="100%" fill="white"/>
    <text x="25" y="28" font-family="Arial,sans-serif" font-size="17" font-weight="bold" fill="#14202c">Схема сборки · состав и привязки элементов проекта</text>
    ${productCards}
    <text x="25" y="${height - 12}" font-family="Arial,sans-serif" font-size="10" fill="#333">Операции, отверстия и производственные координаты, отсутствующие в модели, здесь не показаны.</text>
  </svg>`;
}

// Front elevation: parts are projected onto the X/Y plane and drawn far-to-near along Z, so doors
// cover the carcase. local=true uses the cabinet's own axes (its front faces the viewer),
// local=false uses project coordinates seen from +Z, where turned cabinets show their side or back.
function facadeEntries(product, local) {
  const custom = new Set(product.customParts);
  const hinges = new Map(getMotionAssemblies(product)
    .filter((motion) => motion.kind === "door").map((motion) => [motion.parts[0].part.id, motion.hingeSide]));
  return getProductParts(product).map((part) => {
    const isCustom = custom.has(part);
    const box = local
      ? (isCustom ? { size: [part.length, part.thickness, part.width], center: [part.x, part.y, part.z] } : partLocalBox(part, product))
      : (isCustom ? panelBox(part, product) : partBox(part, product));
    const kind = isCustom ? "custom"
      : part.orientation === "back" ? "back"
        : part.orientation === "front" ? "front"
          : part.orientation === "drawer" || part.orientation === "drawer-side" ? "drawer"
            : "carcase";
    return { product, part, kind, bounds: boundsOf(box), hingeSide: local ? hinges.get(part.id) : undefined };
  });
}

const facadeStyles = {
  back: 'fill="#eef1f3" stroke="#9aa6ae"',
  carcase: 'fill="#e3cfae" stroke="#1d344d"',
  drawer: 'fill="#efe4d2" stroke="#53616d"',
  custom: 'fill="#b9d3c6" stroke="#2f4f45"',
  front: 'fill="#d9bf98" fill-opacity="0.45" stroke="#53616d" stroke-dasharray="4,2"',
};

function facadeView(entries, { left, top, maxWidth, maxHeight }) {
  const minX = Math.min(...entries.map(({ bounds }) => bounds[0].min));
  const maxX = Math.max(...entries.map(({ bounds }) => bounds[0].max));
  const minY = Math.min(0, ...entries.map(({ bounds }) => bounds[1].min));
  const maxY = Math.max(...entries.map(({ bounds }) => bounds[1].max));
  const scale = Math.min(maxWidth / Math.max(1, maxX - minX), maxHeight / Math.max(1, maxY - minY));
  const toX = (value) => left + (value - minX) * scale;
  const toY = (value) => top + (maxY - value) * scale;
  const ordered = entries.slice().sort((a, b) =>
    (a.bounds[2].min + a.bounds[2].max) - (b.bounds[2].min + b.bounds[2].max));
  const shapes = ordered.map(({ part, kind, bounds, hingeSide }) => {
    const x = toX(bounds[0].min);
    const y = toY(bounds[1].max);
    const width = Math.max(0.5, (bounds[0].max - bounds[0].min) * scale);
    const height = Math.max(0.5, (bounds[1].max - bounds[1].min) * scale);
    // Opening lines meet at the hinge side, as on furniture drawings.
    const opening = hingeSide
      ? (() => {
        const hingeX = hingeSide === "left" ? x : x + width;
        const freeX = hingeSide === "left" ? x + width : x;
        return `<polyline points="${freeX},${y} ${hingeX},${y + height / 2} ${freeX},${y + height}" fill="none" stroke="#53616d" stroke-width="0.8" stroke-dasharray="5,3"/>`;
      })()
      : "";
    return `<rect data-part-kind="${kind}" x="${x}" y="${y}" width="${width}" height="${height}" ${facadeStyles[kind]} stroke-width="0.8"><title>${escapeHtmlText(part.name)}</title></rect>${opening}`;
  }).join("");
  return {
    svg: shapes,
    width: (maxX - minX) * scale,
    height: (maxY - minY) * scale,
    extent: { minX, maxX, minY, maxY },
    toX,
    toY,
  };
}

function facadeSketchSvg(includeCabinets = true, cabinets = products.filter((product) => product.type === "cabinet")) {
  const font = 'font-family="Arial,sans-serif" fill="#17212b"';
  if (!cabinets.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 60"><rect width="100%" height="100%" fill="white"/><text x="20" y="35" ${font} font-size="13">В проекте нет корпусов.</text></svg>`;
  }
  const pageWidth = 820;
  let cursor = 34;
  const blocks = [`<text x="24" y="${cursor}" ${font} font-size="16" font-weight="bold">Эскиз фасадов · вид спереди (со стороны +Z проекта)</text>`];
  const projectEntries = cabinets.flatMap((product) => facadeEntries(product, false));
  const project = facadeView(projectEntries, { left: 40, top: cursor + 44, maxWidth: pageWidth - 80, maxHeight: includeCabinets ? 360 : 300 });
  const labels = cabinets.map((product) => {
    const own = projectEntries.filter((entry) => entry.product === product);
    const minX = Math.min(...own.map(({ bounds }) => bounds[0].min));
    const maxX = Math.max(...own.map(({ bounds }) => bounds[0].max));
    const maxY = Math.max(...own.map(({ bounds }) => bounds[1].max));
    return `<text x="${project.toX((minX + maxX) / 2)}" y="${project.toY(maxY) - 6}" ${font} font-size="10" text-anchor="middle">${escapeHtmlText(product.name)}${product.rotationY ? ` · ${product.rotationY}°` : ""}</text>`;
  }).join("");
  const { minX, maxX, minY, maxY } = project.extent;
  blocks.push(`<g data-view="project">${project.svg}
    <line x1="${project.toX(minX) - 10}" y1="${project.toY(0)}" x2="${project.toX(maxX) + 10}" y2="${project.toY(0)}" stroke="#31546a" stroke-width="1.2"/>
    ${labels}
    <text x="${project.toX((minX + maxX) / 2)}" y="${cursor + 22}" ${font} font-size="11" text-anchor="middle">${Math.round(maxX - minX)} мм</text>
    <text x="22" y="${project.toY((minY + maxY) / 2)}" ${font} font-size="11" text-anchor="middle" transform="rotate(-90 22 ${project.toY((minY + maxY) / 2)})">${Math.round(maxY - minY)} мм</text>
  </g>`);
  cursor += 44 + project.height + 28;
  if (cabinets.some((product) => product.rotationY)) {
    blocks.push(`<text x="24" y="${cursor}" ${font} font-size="10">Корпуса, повёрнутые на 90° или 270°, на общем виде видны сбоку, на 180° — со стороны задней стенки.</text>`);
    cursor += 20;
  }
  if (includeCabinets) {
    cabinets.forEach((product, index) => {
      const p = product.parameters;
      cursor += 18;
      blocks.push(`<text x="24" y="${cursor}" ${font} font-size="13" font-weight="bold">${index + 1}. ${escapeHtmlText(product.name)} · ${p.width}×${p.height}×${p.depth} мм · фасад корпуса${product.rotationY ? ` (корпус повёрнут на ${product.rotationY}°)` : ""}</text>`);
      const view = facadeView(facadeEntries(product, true), { left: 60, top: cursor + 34, maxWidth: 420, maxHeight: 300 });
      const e = view.extent;
      const sketchPanels = p.layout ? layoutParts(p) : [];
      const counts = p.layout
        ? `Двери: ${p.doors} · полки: ${sketchPanels.filter((part) => part.orientation === "horizontal").length} · перегородки: ${sketchPanels.filter((part) => part.orientation === "vertical").length} (эскиз) · ${escapeHtmlText(materialLabel(p.color))}`
        : `Двери: ${p.doors} · ящики: ${p.drawers} · полки: ${p.shelves}${p.divider ? " · перегородка" : ""} · ${escapeHtmlText(materialLabel(p.color))}`;
      blocks.push(`<g data-cabinet="${escapeHtmlText(product.id)}">${view.svg}
        <text x="${view.toX((e.minX + e.maxX) / 2)}" y="${cursor + 26}" ${font} font-size="11" text-anchor="middle">${p.width} мм</text>
        <text x="44" y="${view.toY((e.minY + e.maxY) / 2)}" ${font} font-size="11" text-anchor="middle" transform="rotate(-90 44 ${view.toY((e.minY + e.maxY) / 2)})">${p.height} мм</text>
        <text x="${60 + view.width + 24}" y="${cursor + 52}" ${font} font-size="11">${counts}</text>
      </g>`);
      cursor += 34 + view.height + 24;
    });
  }
  cursor += 10;
  blocks.push(`<text x="24" y="${cursor}" ${font} font-size="10">Эскиз по модели FURNIX: штриховые линии — открывание двери к петлям. Не рабочий чертёж; зазоры и фурнитура не показаны.</text>`);
  const height = cursor + 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${height}" viewBox="0 0 ${pageWidth} ${height}">
    <rect width="100%" height="100%" fill="white"/>
    ${blocks.join("\n")}
  </svg>`;
}

function renderFacadeSketch() {
  const target = byId("facade-sketch");
  if (target) target.innerHTML = facadeSketchSvg(false);
}

function dxfText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/[^\x20-\x7e]/g, (character) =>
    `\\U+${character.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}`);
}

function dxfDocument() {
  const pairs = [];
  const pair = (code, value) => pairs.push(String(code), String(value));
  const line = (x1, y1, x2, y2, layer = "DIMENSIONS") => {
    pair(0, "LINE"); pair(8, layer);
    pair(10, x1); pair(20, y1); pair(30, 0);
    pair(11, x2); pair(21, y2); pair(31, 0);
  };
  const text = (value, x, y, height = 8, layer = "ANNOTATIONS") => {
    pair(0, "TEXT"); pair(8, layer);
    pair(10, x); pair(20, y); pair(30, 0);
    pair(40, height); pair(1, dxfText(value));
  };
  const polyline = (x, y, width, height) => {
    pair(0, "POLYLINE"); pair(8, "PART_OUTLINES"); pair(66, 1); pair(70, 1);
    for (const [px, py] of [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]) {
      pair(0, "VERTEX"); pair(8, "PART_OUTLINES");
      pair(10, px); pair(20, py); pair(30, 0); pair(70, 0);
    }
    pair(0, "SEQEND");
  };
  pair(0, "SECTION"); pair(2, "HEADER");
  pair(9, "$ACADVER"); pair(1, "AC1009");
  pair(9, "$INSBASE"); pair(10, 0); pair(20, 0); pair(30, 0);
  pair(0, "ENDSEC");
  pair(0, "SECTION"); pair(2, "TABLES");
  pair(0, "TABLE"); pair(2, "LAYER"); pair(70, 3);
  for (const [name, color] of [["PART_OUTLINES", 7], ["DIMENSIONS", 3], ["ANNOTATIONS", 5]]) {
    pair(0, "LAYER"); pair(2, name); pair(70, 0); pair(62, color); pair(6, "CONTINUOUS");
  }
  pair(0, "ENDTAB"); pair(0, "ENDSEC");
  pair(0, "SECTION"); pair(2, "ENTITIES");
  text("FURNIX PART OUTLINES - UNITS MM - SCHEMATIC ONLY - NO HOLES OR CNC OPERATIONS", 0, 0, 10);
  let cursorX = 100;
  let cursorY = -100;
  let rowDepth = 0;
  for (const product of products) {
    const parts = getProductParts(product);
    for (const part of parts) {
      if (cursorX > 100 && cursorX + part.length > 2400) {
        cursorX = 100;
        cursorY -= rowDepth + 180;
        rowDepth = 0;
      }
      const x = cursorX;
      const y = cursorY - part.width;
      polyline(x, y, part.length, part.width);
      line(x, y - 22, x + part.length, y - 22);
      line(x, y - 28, x, y - 16);
      line(x + part.length, y - 28, x + part.length, y - 16);
      text(`${part.length} mm`, x + part.length / 2 - 20, y - 36, 7);
      line(x - 22, y, x - 22, y + part.width);
      line(x - 28, y, x - 16, y);
      line(x - 28, y + part.width, x - 16, y + part.width);
      text(`${part.width} mm`, x - 48, y + part.width / 2, 7);
      text(`${product.name} | ${part.name} | ${part.length}x${part.width}x${part.thickness} mm`, x, cursorY + 18, 8);
      text(`ID=${part.id} | MAT=${materialLabel(part.material || product.parameters.color)} | EDGES=${partEdgeLabel(part)}`, x, cursorY + 7, 6);
      text("OPERATIONS=NOT_DEFINED", x, cursorY - 4, 6);
      cursorX += part.length + 150;
      rowDepth = Math.max(rowDepth, part.width + 90);
    }
    for (const component of product.hardwareComponents || []) {
      text(`HARDWARE ID=${component.id} | PRODUCT=${product.name} | GROUP=${hardwareCategoryLabels[component.category] || component.category} | TYPE=${component.type} | MODEL=${component.model} | LENGTH=${component.dimensions.length ?? ""} | DIA=${component.dimensions.diameter ?? ""} | REF=${componentReference(product, component)}`,
        100, cursorY - rowDepth - 24, 6);
      cursorY -= 18;
    }
    cursorX = 100;
    cursorY -= rowDepth + 180;
    rowDepth = 0;
  }
  text("NO DRILLING DATA OR MANUFACTURING COORDINATES ARE INCLUDED", 100, cursorY, 8);
  pair(0, "ENDSEC"); pair(0, "EOF");
  return pairs.join("\r\n");
}

// focus: a product to frame instead of the whole project (used by the sketch mode).
function setView(name, focus = null) {
  const bounds = new THREE.Box3();
  if (focus) {
    for (const part of getProductParts(focus)) {
      const box = part.orientation ? partBox(part, focus) : panelBox(part, focus);
      const [min, max] = boundsOf(box).reduce((pair, range) =>
        [[...pair[0], range.min / 1000], [...pair[1], range.max / 1000]], [[], []]);
      bounds.expandByPoint(new THREE.Vector3(...min)).expandByPoint(new THREE.Vector3(...max));
    }
  } else {
    bounds.setFromObject(modelGroup);
  }
  activeView = name;
  if (name === "3d" || bounds.isEmpty()) {
    activeView = "3d";
    activeCamera = camera;
    controls.object = camera;
    controls.enableRotate = true;
    frameAssembly();
  } else {
    const center = bounds.getCenter(new THREE.Vector3()).toArray();
    const size = bounds.getSize(new THREE.Vector3()).toArray();
    orthoCamera.position.fromArray(viewCameraPosition(name, center, size));
    orthoCamera.up.fromArray(viewPresets[name].up);
    orthoCamera.zoom = 1;
    orthoCamera.far = Math.max(...size, 1) * 10;
    activeCamera = orthoCamera;
    controls.object = orthoCamera;
    controls.enableRotate = false;
    controls.target.fromArray(center);
    orthoCamera.lookAt(controls.target);
    fitOrthoCamera(size);
    controls.update();
  }
  document.querySelectorAll("#command-toolbar button[data-view]").forEach((button) => {
    button.classList.toggle("primary", button.dataset.view === activeView);
    button.setAttribute("aria-pressed", String(button.dataset.view === activeView));
  });
}

let orthoViewSize = [1, 1, 1];
function fitOrthoCamera(size = orthoViewSize) {
  orthoViewSize = size;
  if (activeView === "3d") return;
  const aspect = Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight);
  const { halfWidth, halfHeight } = viewFrustum(activeView, size, aspect);
  Object.assign(orthoCamera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight });
  orthoCamera.updateProjectionMatrix();
}

function frameAssembly() {
  if (activeView !== "3d") {
    setView(activeView);
    return;
  }
  const bounds = new THREE.Box3().setFromObject(modelGroup);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 1);
  controls.target.copy(center);
  camera.position.set(center.x + span * 2.2, center.y + span * 1.2, center.z + span * 1.0);
  camera.far = Math.max(100, span * 10);
  camera.updateProjectionMatrix();
  controls.update();
}

function syncInputs(product) {
  const p = product.parameters;
  const values = {
    name: product.name,
    width: p.width,
    height: p.height,
    depth: p.depth,
    thickness: p.thickness,
    shelves: p.shelves,
    divider: cabinetDividerCount(p),
    back: p.back ? "yes" : "no",
    color: p.color,
    doors: p.doors,
    drawers: p.drawers,
  };
  refreshMaterialSelects(p.color);
  for (const [id, value] of Object.entries(values)) if (byId(id)) byId(id).value = value;
}

function selectedProduct() {
  return products.find((product) => product.id === selected.productId) || null;
}

function selectedPart(product) {
  if (!product || !selected.partId) return null;
  if (product.type === "cabinet") {
    const generated = generatedParts(product).find((part) => part.id === selected.partId);
    return generated
      ? { kind: "generated", value: generated }
      : { kind: "custom", value: product.customParts.find((part) => part.id === selected.partId) };
  }
  return null;
}

function createField(labelText, key, value, options = {}) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = options.type || "number";
  input.name = key;
  input.value = value;
  if (input.type === "number") {
    input.min = options.min ?? "1";
    input.max = options.max ?? "10000";
    input.step = options.step ?? "1";
  }
  if (options.required) input.required = true;
  label.append(input);
  return label;
}

function createSelect(labelText, key, value, options) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.name = key;
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    select.append(option);
  }
  select.value = String(value);
  label.append(select);
  return label;
}

function buildEditor() {
  const editor = byId("assembly-editor");
  editor.replaceChildren();
  const product = selectedProduct();
  if (!product) return;
  if (selected.hardwareComponentId || hardwareDraft) {
    const component = product.hardwareComponents?.find((item) => item.id === selected.hardwareComponentId);
    if (component || hardwareDraft) {
      byId("assembly-delete").textContent = component ? "Удалить компонент" : "Отменить";
      buildHardwareEditor(editor, product, component);
      return;
    }
  }
  if (selected.connectionId) {
    const connection = product.connections?.find((item) => item.id === selected.connectionId);
    if (connection) {
      byId("assembly-delete").textContent = "Удалить соединение";
      buildConnectionProperties(editor, product, connection);
      return;
    }
  }
  if (selected.connectionId) {
    const connection = product.connections?.find((item) => item.id === selected.connectionId);
    if (connection) {
      buildConnectionProperties(editor, product, connection);
      return;
    }
  }
  const heading = document.createElement("h2");
  heading.textContent = selected.partId ? "Свойства детали" : "Свойства изделия";
  editor.append(heading);
  if (!selected.partId && product.sourceInfo) {
    const sourceNote = document.createElement("p");
    sourceNote.className = "note";
    sourceNote.textContent = product.sourceInfo.kind === "external-csv"
      ? `Источник: ${product.sourceInfo.reference || "внешний CSV"} · файл «${product.sourceInfo.name}» · единицы: ${product.sourceInfo.unit}. Геометрия построена по параметрам FURNIX; исходный 3D-объект не импортирован.`
      : `Источник: ${product.sourceInfo.kind === "personal-library" ? "личная библиотека" : "библиотека FURNIX"} · ${product.sourceInfo.name}.`;
    editor.append(sourceNote);
  }
  const form = document.createElement("form");
  form.id = "assembly-properties";
  if (!selected.partId && product.type === "cabinet") {
    form.append(
      createField("Название", "name", product.name, { type: "text" }),
      createField("Ширина, мм", "width", product.parameters.width, { min: 300, max: 3000 }),
      createField("Высота, мм", "height", product.parameters.height, { min: 300, max: 3000 }),
      createField("Глубина, мм", "depth", product.parameters.depth, { min: 200, max: 1200 }),
      createField("Толщина плиты, мм", "thickness", product.parameters.thickness, { min: 10, max: 40 }),
      createField("Полок, шт.", "shelves", product.parameters.shelves, { min: 0, max: 12 }),
      createField("Положение X, мм", "x", product.x, { min: -100000, max: 100000 }),
      createField("Высота установки Y, мм", "y", product.y || 0, { min: -100000, max: 100000 }),
      createField("Положение Z, мм", "z", product.z, { min: -100000, max: 100000 }),
      createSelect("Поворот вокруг Y", "rotationY", product.rotationY || 0, [
        ["0", "0°"], ["90", "90°"], ["180", "180°"], ["270", "270°"],
      ]),
      createField("Фасадов, шт.", "doors", product.parameters.doors, { min: 0, max: 2 }),
      createField("Шухляд, шт.", "drawers", product.parameters.drawers, { min: 0, max: 4 }),
      createSelect("Материал корпуса", "color", product.parameters.color, caseMaterialOptions(product.parameters.color)),
    );
    const divider = document.createElement("label");
    divider.textContent = "Центральная перегородка";
    divider.innerHTML += `<select name="divider"><option value="yes">Да</option><option value="no">Нет</option></select>`;
    divider.querySelector("select").value = product.parameters.divider ? "yes" : "no";
    const back = document.createElement("label");
    back.textContent = "Задняя стенка";
    back.innerHTML += `<select name="back"><option value="yes">Да</option><option value="no">Нет</option></select>`;
    back.querySelector("select").value = product.parameters.back ? "yes" : "no";
    form.append(divider, back);
  } else {
    const chosen = selectedPart(product);
    if (!chosen?.value) return;
    const part = chosen.value;
    const detailFields = chosen.kind === "generated"
      ? { name: part.name, length: part.length, width: part.width, thickness: part.thickness, x: part.x, y: part.y, z: part.z }
      : part;
    for (const key of ["name", "length", "width", "thickness", "x", "y", "z"]) {
      form.append(createField(
        ({ name: "Название", length: "Длина X, мм", width: "Ширина Z, мм", thickness: "Толщина Y, мм", x: "Положение X, мм", y: "Положение Y, мм", z: "Положение Z, мм" })[key],
        key,
        detailFields[key],
        key === "name" ? { type: "text" } : { min: key === "x" || key === "y" || key === "z" ? -10000 : 1, max: 10000 },
      ));
    }
    if (chosen.kind === "generated") {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "Сохранение создаст локальную правку детали; базовые размеры изделия останутся параметрическими.";
      form.append(note);
    }
  }
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "primary";
  save.textContent = "Применить свойства";
  form.append(save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applyEditor(form, product);
  });
  editor.append(form);
  byId("assembly-delete").textContent = selected.partId && selectedPart(product)?.kind === "generated"
    ? "Сбросить правку"
    : "Удалить";
  if (jointDraft) {
    byId("assembly-delete").textContent = "Отменить";
    buildJointCreator(editor, product);
  }
}

let jointDraft = false;

function buildHardwareEditor(editor, product, component = null) {
  const parts = [...generatedParts(product), ...product.customParts];
  if (!parts.length) {
    const note = document.createElement("p");
    note.className = "error";
    note.textContent = "Сначала добавьте деталь, чтобы указать относительную ссылку на установку.";
    editor.append(note);
    return;
  }
  const form = document.createElement("form");
  form.id = "assembly-hardware-form";
  const heading = document.createElement("h2");
  heading.textContent = component ? "Компонент крепежа" : "Новый компонент крепежа";
  form.append(heading);
  form.append(createSelect("Тип", "type", component?.type || "confirmat", hardwareTypes));
  form.append(createSelect("Группа", "category", component?.category || "case-joint",
    Object.entries(hardwareCategoryLabels)));
  form.append(createField("Модель / артикул", "model", component?.model || "", {
    type: "text", required: true,
  }));
  const dimensions = component?.dimensions || {};
  for (const [key, label] of [
    ["length", "Длина, мм"],
    ["diameter", "Диаметр, мм"],
    ["width", "Ширина, мм"],
    ["height", "Высота, мм"],
  ]) {
    form.append(createField(label, key, dimensions[key] ?? "", {
      min: 0, max: 10000, step: "any",
    }));
  }
  const partSelect = createSelect("Деталь для относительной ссылки", "partId",
    component?.installationPoint?.partId || parts[0].id,
    parts.map((part) => [part.id, part.name]));
  form.append(partSelect);
  form.append(createField("Место установки (описание)", "reference",
    component?.installationPoint?.reference || "", { type: "text", required: true }));
  const note = document.createElement("p");
  note.id = "assembly-connection-note";
  note.textContent = "Размеры и модель вводятся по выбранному изделию. Ссылка описывает деталь и место установки; координаты, отверстия и присадка не рассчитываются.";
  form.append(note);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = component ? "Сохранить компонент" : "Добавить компонент";
  form.append(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const model = String(data.get("model") || "").trim().slice(0, 120);
    const category = String(data.get("category"));
    const type = String(data.get("type"));
    const partId = String(data.get("partId"));
    const reference = String(data.get("reference") || "").trim().slice(0, 120);
    const dimensions = {};
    for (const key of ["length", "diameter", "width", "height"]) {
      const raw = String(data.get(key) || "").trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0 || value > 10000) {
        note.textContent = `Проверьте поле «${key}»: размер должен быть больше 0 и не превышать 10000 мм.`;
        note.className = "error";
        return;
      }
      dimensions[key] = value;
    }
    if (!hardwareTypeLabels[type] || !hardwareCategories.has(category) || !model || !reference ||
        !parts.some((part) => part.id === partId)) {
      note.textContent = "Укажите тип, группу, модель, деталь и место установки.";
      note.className = "error";
      return;
    }
    const next = {
      id: component?.id || `hardware-${++serial}`,
      category,
      type,
      model,
      dimensions,
      installationPoint: { kind: "part-reference", partId, reference },
    };
    if (component) Object.assign(component, next);
    else {
      product.hardwareComponents ||= [];
      product.hardwareComponents.push(next);
    }
    hardwareDraft = false;
    selected = { productId: product.id, partId: null, connectionId: null, hardwareComponentId: next.id };
    renderTree();
    buildEditor();
    renderModel();
  });
  editor.append(form);
}

function buildJointCreator(editor, product) {
  const parts = [...generatedParts(product), ...product.customParts];
  const section = document.createElement("form");
  section.id = "assembly-connection-form";
  const heading = document.createElement("h2");
  heading.textContent = "Новое соединение";
  section.append(heading);
  const describePart = (part) => `${part.name} · ${Math.round(part.length)}×${Math.round(part.width)}×${Math.round(part.thickness)} мм`;
  const makePartSelect = (labelText, name, chosenId, excludedId = null) => {
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.name = name;
    for (const part of parts.filter((item) => item.id !== excludedId)) {
      const option = document.createElement("option");
      option.value = part.id;
      option.textContent = describePart(part);
      select.append(option);
    }
    if (parts.some((part) => part.id === chosenId && part.id !== excludedId)) select.value = chosenId;
    label.append(select);
    return label;
  };
  const firstId = selected.partId && parts.some((part) => part.id === selected.partId)
    ? selected.partId
    : parts.find((part) => part.name === "Боковина правая")?.id || parts[0]?.id;
  const secondId = parts.find((part) =>
    part.id !== firstId && part.name.startsWith("Полка") && !findJoint(product, firstId, part.id).error)?.id ||
    parts.find((part) =>
      part.id !== firstId && !findJoint(product, firstId, part.id).error)?.id ||
    parts.find((part) => part.id !== firstId)?.id;
  section.append(
    makePartSelect("Деталь A", "partA", firstId),
    makePartSelect("Деталь B", "partB", secondId, firstId),
    createField("Количество конфирматов", "count", "2", { min: 1, max: 8 }),
    createField("Отступ от краёв общего ребра, мм", "edgeInset", "50", { min: 20, max: 500 }),
  );
  const note = document.createElement("p");
  note.id = "assembly-connection-note";
  note.textContent = "Видимый крепёж и точки — эскиз. Реальные отверстия, допуски и присадку пока не рассчитываем.";
  section.append(note);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = "Добавить соединение";
  section.append(submit);
  section.addEventListener("change", (event) => {
    if (event.target.name === "partA") {
      const partB = section.elements.namedItem("partB");
      if (partB.value === event.target.value) {
        partB.value = [...partB.options].find((option) => option.value !== event.target.value)?.value || "";
      }
    }
    if (event.target.name === "partA" || event.target.name === "partB") {
      const partA = section.elements.namedItem("partA");
      const partB = section.elements.namedItem("partB");
      for (const option of partB.options) option.disabled = option.value === partA.value;
    }
  });
  section.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(section);
    const connection = {
      id: `connection-${++serial}`,
      name: "Конфирмат 6,4×50",
      type: "confirmat-joint",
      partA: String(data.get("partA")),
      partB: String(data.get("partB")),
      edgeInset: Number(data.get("edgeInset")),
    };
    const layout = connectionPositions(product, { ...connection, count: Number(data.get("count")) });
    if (layout.error) {
      note.textContent = layout.error;
      note.className = "error";
      return;
    }
    createConfirmatComponents(product, connection, Number(data.get("count")), connection.edgeInset);
    product.connections ??= [];
    product.connections.push(connection);
    jointDraft = false;
    selected = { productId: product.id, partId: null, connectionId: connection.id, hardwareComponentId: null };
    renderTree();
    buildEditor();
    byId("update").click();
  });
  editor.append(section);
}

function buildConnectionProperties(editor, product, connection) {
  const heading = document.createElement("h2");
  heading.textContent = connection.name;
  editor.append(heading);
  const layout = connectionPositions(product, connection);
  const components = (product.hardwareComponents || [])
    .filter((component) => connection.componentIds?.includes(component.id));
  const note = document.createElement("p");
  note.className = layout.error ? "error" : "note";
  note.textContent = layout.error
    ? `Соединение требует проверки: ${layout.error}`
    : `${components.length} отдельных компонентов.\n${components.map((component, index) =>
        `${index + 1}. ${hardwareCategoryLabels[component.category] || component.category} · ${component.type} · модель ${component.model} · Ø${component.dimensions.diameter} × ${component.dimensions.length} мм · точка установки: общее ребро, позиция ${component.installationPoint.distribution.index + 1} из ${component.installationPoint.distribution.count}, отступ ${component.installationPoint.edgeInset} мм`).join("\n")}\nПоказаны только эскизные положения в модели, не производственные координаты. Отверстия не рассчитываются; применимость размеров требует документации изготовителя.`;
  editor.append(note);
}

byId("assembly-add-joint").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") return;
  selected = { productId: product.id, partId: selected.partId, connectionId: null, hardwareComponentId: null };
  hardwareDraft = false;
  jointDraft = true;
  buildEditor();
});

byId("assembly-add-hardware").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") {
    displayGeometryIssues(["Выберите корпусное изделие, чтобы добавить крепёж."]);
    return;
  }
  selected = { productId: product.id, partId: null, connectionId: null, hardwareComponentId: null };
  jointDraft = false;
  hardwareDraft = true;
  buildEditor();
});

byId("reset").onclick = () => {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") return;
  const parameters = {
    name: "Шафа — демонстрация",
    width: 1200,
    height: 2200,
    depth: 600,
    thickness: 18,
    shelves: 4,
    divider: true,
    back: true,
    color: "oak",
    doors: 2,
    drawers: 0,
    x: product.x,
    z: product.z,
  };
  product.name = parameters.name;
  product.parameters = parameters;
  product.overrides = {};
  product.customParts = [];
  product.connections = [];
  product.hardwareComponents = [];
  selected = { productId: product.id, partId: null, connectionId: null, hardwareComponentId: null };
  jointDraft = false;
  hardwareDraft = false;
  syncInputs(product);
  renderTree();
  buildEditor();
  byId("update").click();
};

function applyEditor(form, product) {
  const data = new FormData(form);
  if (!selected.partId) {
    const next = {
      ...product.parameters,
      width: Number(data.get("width")),
      height: Number(data.get("height")),
      depth: Number(data.get("depth")),
      thickness: Number(data.get("thickness")),
      shelves: Number(data.get("shelves")),
      doors: Number(data.get("doors")),
      drawers: Number(data.get("drawers")),
      color: String(data.get("color")),
      divider: data.get("divider") === "yes",
      back: data.get("back") === "yes",
      x: Number(data.get("x")),
      z: Number(data.get("z")),
    };
    const y = Number(data.get("y"));
    const rotationY = Number(data.get("rotationY"));
    const name = String(data.get("name") || "").trim().slice(0, 80);
    if (!name || !validCabinet(next) ||
        !validCabinetPlacement({ x: next.x, y, z: next.z, rotationY, parameters: next })) {
      displayGeometryIssues([`${product.name}: проверьте название, параметры, координаты и поворот корпуса.`]);
      return;
    }
    product.name = name;
    product.parameters = next;
    product.x = next.x;
    product.z = next.z;
    product.y = y;
    product.rotationY = rotationY;
    syncInputs(product);
  } else {
    const chosen = selectedPart(product);
    if (!chosen?.value) return;
    const value = Object.fromEntries(["name", "length", "width", "thickness", "x", "y", "z"]
      .map((key) => [key, key === "name" ? String(data.get(key) || "").trim().slice(0, 80) : Number(data.get(key))]));
    if (!value.name || ![value.length, value.width, value.thickness, value.x, value.y, value.z].every(Number.isFinite) ||
        value.length <= 0 || value.width <= 0 || value.thickness <= 0) {
      displayGeometryIssues(["Проверьте название и размеры детали."]);
      return;
    }
    if (chosen.kind === "custom") Object.assign(chosen.value, value);
    else {
      product.overrides[chosen.value.id] = value;
    }
  }
  renderTree();
  buildEditor();
  byId("update").click();
  if (!selected.partId && product.type === "cabinet") frameAssembly();
}

function renderTree() {
  renderViyarExportGroups();
  const tree = byId("assembly-tree");
  tree.replaceChildren();
  const sheetFitMessages = projectSheetFitIssues().partMessages;
  const markSheetFit = (button, product, part) => {
    const message = sheetFitMessages.get(`${product.id}:${part.id}`);
    if (!message) return;
    button.textContent = `⚠ ${button.textContent}`;
    button.title = message;
    button.classList.add("assembly-node-warning");
  };
  for (const product of products) {
    const productButton = document.createElement("button");
    productButton.type = "button";
    productButton.className = `assembly-node${selected.productId === product.id && !selected.partId && !selected.connectionId && !selected.hardwareComponentId ? " selected" : ""}`;
    productButton.setAttribute("role", "treeitem");
    const sourceMark = product.sourceInfo?.kind === "external-csv"
      ? " · внешний CSV"
      : product.sourceInfo?.kind === "personal-library"
        ? " · моя библиотека"
        : "";
    productButton.textContent = `${product.type === "cabinet" ? "▣ " : "▱ "}${product.name}${sourceMark}`;
    if (product.sourceInfo) {
      productButton.title = `Источник: ${product.sourceInfo.reference || product.sourceInfo.name}`;
    }
    productButton.addEventListener("click", () => selectItem(product.id));
    tree.append(productButton);
    if (product.type === "cabinet") {
      for (const part of generatedParts(product)) {
        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = `assembly-node assembly-child${selected.productId === product.id && selected.partId === part.id ? " selected" : ""}`;
        detailButton.setAttribute("role", "treeitem");
        detailButton.textContent = `${part.name} · ${Math.round(part.length)}×${Math.round(part.width)}×${Math.round(part.thickness)}`;
        markSheetFit(detailButton, product, part);
        detailButton.addEventListener("click", () => selectItem(product.id, part.id));
        tree.append(detailButton);
      }
      for (const part of product.customParts) {
        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = `assembly-node assembly-child${selected.productId === product.id && selected.partId === part.id ? " selected" : ""}`;
        detailButton.setAttribute("role", "treeitem");
        detailButton.textContent = `${part.name} · ${Math.round(part.length)}×${Math.round(part.width)}×${Math.round(part.thickness)}`;
        markSheetFit(detailButton, product, part);
        detailButton.addEventListener("click", () => selectItem(product.id, part.id));
        tree.append(detailButton);
      }
      for (const connection of product.connections || []) {
        const jointButton = document.createElement("button");
        jointButton.type = "button";
        jointButton.className = `assembly-node assembly-child${selected.productId === product.id && selected.connectionId === connection.id ? " selected" : ""}`;
        jointButton.setAttribute("role", "treeitem");
        jointButton.textContent = `${connection.name} · ${(connection.componentIds || []).length || connection.count || 0} шт.`;
        jointButton.addEventListener("click", () => selectItem(product.id, null, connection.id));
        tree.append(jointButton);
      }
      for (const component of product.hardwareComponents || []) {
        if (product.connections?.some((connection) => connection.componentIds?.includes(component.id))) continue;
        const componentButton = document.createElement("button");
        componentButton.type = "button";
        componentButton.className = `assembly-node assembly-child${selected.productId === product.id && selected.hardwareComponentId === component.id ? " selected" : ""}`;
        componentButton.setAttribute("role", "treeitem");
        componentButton.textContent = `${hardwareTypeLabels[component.type] || component.type} · ${component.model}`;
        componentButton.addEventListener("click", () => selectItem(product.id, null, null, component.id));
        tree.append(componentButton);
      }
    }
  }
  renderFurnitureSetPanel();
}

function renderFurnitureSetPanel(issues = null) {
  const list = byId("furniture-set-list");
  if (!list) return;
  list.replaceChildren();
  for (const product of products) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `furniture-set-module${selected.productId === product.id ? " selected" : ""}`;
    button.textContent = `${product.name} · ${product.parameters.width}×${product.parameters.height}×${product.parameters.depth} мм · X${product.x}, Y${product.y || 0}, Z${product.z} · ${product.rotationY || 0}°`;
    button.setAttribute("aria-pressed", String(selected.productId === product.id));
    button.addEventListener("click", () => selectItem(product.id));
    list.append(button);
  }

  const product = selectedProduct();
  byId("furniture-set-selected").textContent = product
    ? `Выбран: ${product.name} · ${product.parameters.width} × ${product.parameters.height} × ${product.parameters.depth} мм · положение X ${product.x}, Y ${product.y || 0}, Z ${product.z} мм · поворот ${product.rotationY || 0}°`
    : "Выберите корпус комплекта.";

  const warnings = issues || latestProjectIssues;
  const warningBox = byId("furniture-set-warnings");
  warningBox.className = warnings.length ? "error" : "note";
  warningBox.textContent = warnings.length
    ? `Замечания комплекта:\n${warnings.slice(0, 8).map((issue) => `• ${issue}`).join("\n")}${warnings.length > 8 ? "\n• …" : ""}\nПроверки предварительные и не подтверждают производственную готовность.`
    : "Пересечения и выход ниже пола не обнаружены. Проверка предварительная.";

  const detailGroups = new Map();
  const materialTotals = new Map();
  for (const cabinet of products) {
    if (cabinet.type !== "cabinet") continue;
    for (const part of getProductParts(cabinet)) {
      const material = part.material || cabinet.parameters.color;
      const thickness = Math.round(part.thickness);
      const size = `${Math.round(part.length)}×${Math.round(part.width)} мм`;
      const name = part.name.replace(/ \d+$/, "");
      const key = [cabinet.id, name, material, thickness, size].join("|");
      const row = detailGroups.get(key) || {
        product: cabinet.name, name, material: materialLabel(material), thickness, size, quantity: 0,
      };
      row.quantity++;
      detailGroups.set(key, row);
      const totalKey = `${material}|${thickness}`;
      const total = materialTotals.get(totalKey) || { material: materialLabel(material), thickness, quantity: 0 };
      total.quantity++;
      materialTotals.set(totalKey, total);
    }
  }
  const detailRows = [...detailGroups.values()].map((row) =>
    `<tr><td>${escapeHtmlText(row.product)}</td><td>${escapeHtmlText(row.name)}</td><td>${escapeHtmlText(row.material)}</td><td>${row.thickness}</td><td>${row.size}</td><td>${row.quantity}</td></tr>`);
  const totalRows = [...materialTotals.values()].map((row) =>
    `<tr><td>${escapeHtmlText(row.material)} · ${row.thickness} мм</td><td>${row.quantity} деталей</td></tr>`);
  byId("furniture-set-spec").innerHTML =
    `<strong>Общая спецификация · ${detailGroups.size} групп деталей</strong>` +
    `<table><thead><tr><th>Корпус</th><th>Деталь</th><th>Материал</th><th>Толщина</th><th>Размер</th><th>Кол.</th></tr></thead>` +
    `<tbody>${detailRows.join("") || "<tr><td colspan=\"6\">Нет деталей</td></tr>"}</tbody></table>` +
    `<strong>Сводка по материалу и толщине</strong>` +
    `<table><tbody>${totalRows.join("") || "<tr><td colspan=\"2\">Нет деталей</td></tr>"}</tbody></table>`;
}

function updateSelectedCabinet(mutator) {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") {
    byId("furniture-set-warnings").className = "error";
    byId("furniture-set-warnings").textContent = "Выберите корпус, чтобы изменить положение комплекта.";
    return;
  }
  mutator(product);
  product.parameters.x = product.x;
  product.parameters.z = product.z;
  renderTree();
  buildEditor();
  renderModel();
}

function selectItem(productId, partId = null, connectionId = null, hardwareComponentId = null) {
  selected = { productId, partId, connectionId, hardwareComponentId };
  hardwareDraft = false;
  jointDraft = false;
  const product = selectedProduct();
  if (product?.type === "cabinet") syncInputs(product);
  if (product?.type === "cabinet" && !connectionId) byId("update").click();
  else renderModel();
  renderTree();
  buildEditor();
}

function nextPlacement(width, depth) {
  const cabinets = products.filter((item) => item.type === "cabinet");
  if (!cabinets.length) return { x: 0, z: 0 };
  const maxX = Math.max(...cabinets.map((item) => item.x + cabinetFootprint(item).width / 2));
  return { x: maxX + width / 2 + 100, z: 0 };
}

function addCabinet(parameters = readForm(), sourceInfo = undefined) {
  if (!validCabinet(parameters)) {
    displayGeometryIssues(["Невозможно создать изделие: проверьте габариты и параметры."]);
    return null;
  }
  const position = nextPlacement(parameters.width, parameters.depth);
  const product = newCabinet(parameters, position.x, position.z);
  if (sourceInfo) product.sourceInfo = sourceInfo;
  products.push(product);
  selectItem(product.id);
  frameAssembly();
  return product;
}

function setInputSourceTab(tabName) {
  const librarySelected = tabName === "library";
  byId("source-tab-library").setAttribute("aria-selected", String(librarySelected));
  byId("source-tab-external").setAttribute("aria-selected", String(!librarySelected));
  byId("source-panel-library").hidden = !librarySelected;
  byId("source-panel-external").hidden = librarySelected;
}

function modulePreset(kind) {
  const presets = {
    base: {
      name: "Нижний кухонный корпус",
      width: 600, height: 720, depth: 560, thickness: 18, shelves: 1,
      divider: false, back: true, color: "white", doors: 0, drawers: 2, x: 0, z: 0,
    },
    wall: {
      name: "Верхний кухонный корпус",
      width: 600, height: 720, depth: 320, thickness: 18, shelves: 2,
      divider: false, back: true, color: "white", doors: 2, drawers: 0, x: 0, z: 0,
    },
    tall: {
      name: "Кухонный пенал",
      width: 600, height: 2200, depth: 560, thickness: 18, shelves: 4,
      divider: true, back: true, color: "oak", doors: 2, drawers: 0, x: 0, z: 0,
    },
  };
  return presets[kind] ? structuredClone(presets[kind]) : null;
}

function renderPersonalLibrary() {
  const container = byId("library-template-list");
  container.replaceChildren();
  let templates;
  try {
    const stored = localStorage.getItem(libraryStorageKey);
    templates = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(templates) || templates.length > 50 ||
        !templates.every((item) => item && typeof item.id === "string" &&
          typeof item.name === "string" && item.name.trim() &&
          item.name.length <= 80 && validCabinet(item.parameters))) {
      throw new Error("Сохранённая личная библиотека повреждена. Проверьте или удалите её данные в хранилище браузера.");
    }
  } catch (error) {
    byId("library-status").textContent = error.message || "Не удалось прочитать личную библиотеку браузера.";
    byId("library-status").className = "error";
    return;
  }
  if (!templates.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "Пока нет личных шаблонов. Выберите корпус в проекте и сохраните его здесь.";
    container.append(empty);
  }
  for (const template of templates) {
    const row = document.createElement("div");
    row.className = "library-template-row";
    const use = document.createElement("button");
    use.type = "button";
    use.dataset.useTemplate = template.id;
    use.textContent = `${template.name} · ${template.parameters.width}×${template.parameters.height}×${template.parameters.depth}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "library-template-delete";
    remove.dataset.deleteTemplate = template.id;
    remove.setAttribute("aria-label", `Удалить шаблон ${template.name}`);
    remove.textContent = "×";
    row.append(use, remove);
    container.append(row);
  }
  byId("library-status").textContent = "Личные шаблоны хранятся локально в этом браузере.";
  byId("library-status").className = "note";
}

const csvHeaderAliases = {
  name: ["name", "название", "названиеизделия", "наименование", "наименованиеизделия", "имя", "модуль"],
  width: ["width", "widthmm", "ширина", "ширинамм"],
  height: ["height", "heightmm", "высота", "высотамм"],
  depth: ["depth", "depthmm", "глубина", "глубинамм"],
  thickness: ["thickness", "thicknessmm", "толщина", "толщинаплиты", "толщинамм"],
  shelves: ["shelves", "shelfcount", "полки", "полок", "количествополок"],
  divider: ["divider", "перегородка", "вертикальнаяперегородка"],
  back: ["back", "backpanel", "задняястенка", "задник"],
  color: ["color", "material", "материал", "цвет"],
  doors: ["doors", "фасады", "двери", "количестводверей"],
  drawers: ["drawers", "ящики", "шухляды", "количествоящиков"],
};

function parseCsvRows(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let index = 0; index < firstLine.length; index++) {
    const character = firstLine[index];
    if (character === '"' && firstLine[index + 1] === '"' && quoted) index++;
    else if (character === '"') quoted = !quoted;
    else if (!quoted && Object.hasOwn(counts, character)) counts[character]++;
  }
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = "";
  quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("В CSV не закрыта кавычка.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV должен содержать заголовки и хотя бы одну строку данных.");
  return rows;
}

function normalizeCsvHeader(value) {
  return String(value).replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
}

function parseExternalCabinetCsv(text, unit) {
  const rows = parseCsvRows(text);
  const headers = rows[0].map(normalizeCsvHeader);
  const columns = {};
  for (const [field, aliases] of Object.entries(csvHeaderAliases)) {
    const matches = headers.map((header, index) => aliases.includes(header) ? index : -1)
      .filter((index) => index >= 0);
    if (matches.length > 1) throw new Error(`Для поля «${field}» найдено несколько столбцов.`);
    if (matches.length) columns[field] = matches[0];
  }
  for (const field of ["width", "height", "depth"]) {
    if (columns[field] === undefined) {
      throw new Error("Не найдены обязательные столбцы width, height, depth (или русские названия).");
    }
  }
  const scale = { mm: 1, cm: 10, m: 1000, in: 25.4 }[unit];
  if (!scale) throw new Error("Неизвестная единица измерения.");
  const parsed = [];
  const errors = [];
  const readCell = (row, field) => columns[field] === undefined ? "" : (row[columns[field]] ?? "").trim();
  const parseNumber = (value, label, defaultValue) => {
    if (value === "" && defaultValue !== undefined) return defaultValue;
    const number = Number(value.replace(",", "."));
    if (!Number.isFinite(number)) throw new Error(`${label}: ожидалось число.`);
    return number;
  };
  const parseBoolean = (value, label, fallback) => {
    if (value === "") return fallback;
    const normalized = value.toLowerCase();
    if (["1", "true", "yes", "да", "так", "есть"].includes(normalized)) return true;
    if (["0", "false", "no", "нет", "ні", "немає"].includes(normalized)) return false;
    throw new Error(`${label}: используйте да/нет или true/false.`);
  };
  if (rows.length - 1 > 50) throw new Error("За один раз можно импортировать не более 50 корпусов.");
  for (let index = 1; index < rows.length; index++) {
    try {
      if (rows[index].length !== headers.length) {
        throw new Error(`ожидалось столбцов: ${headers.length}, получено: ${rows[index].length}.`);
      }
      const readDimension = (field, defaultValue) =>
        parseNumber(readCell(rows[index], field), field, defaultValue) * scale;
      const rawColor = readCell(rows[index], "color").toLowerCase();
      const colorAliases = {
        oak: "oak", дуб: "oak", white: "white", белый: "white",
        graphite: "graphite", графит: "graphite",
      };
      const catalogCode = projectResources.materials.some((item) => item.code === rawColor && item.code !== "hdf");
      if (rawColor && !colorAliases[rawColor] && !catalogCode) {
        throw new Error("Материал должен быть oak, white, graphite, соответствующим русским названием или кодом из каталога материалов.");
      }
      const parameters = {
        name: (readCell(rows[index], "name") || `Импортированный корпус ${index}`).slice(0, 80),
        width: readDimension("width"),
        height: readDimension("height"),
        depth: readDimension("depth"),
        thickness: readDimension("thickness", 18),
        shelves: parseNumber(readCell(rows[index], "shelves"), "shelves", 0),
        divider: parseBoolean(readCell(rows[index], "divider"), "divider", false),
        back: parseBoolean(readCell(rows[index], "back"), "back", true),
        color: colorAliases[rawColor] || (catalogCode ? rawColor : "oak"),
        doors: parseNumber(readCell(rows[index], "doors"), "doors", 0),
        drawers: parseNumber(readCell(rows[index], "drawers"), "drawers", 0),
        x: 0,
        z: 0,
      };
      if (!validCabinet(parameters)) {
        throw new Error("габариты или количество элементов вне допустимых диапазонов FURNIX.");
      }
      parsed.push(parameters);
    } catch (error) {
      errors.push(`Строка ${index + 1}: ${error.message}`);
    }
  }
  return { products: parsed, errors };
}

function renderExternalCsvPreview(products) {
  const preview = byId("external-csv-preview");
  preview.replaceChildren();
  if (!products.length) return;
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const heading = document.createElement("tr");
  for (const label of ["Корпус", "Ширина × высота × глубина, мм"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    heading.append(cell);
  }
  head.append(heading);
  const body = document.createElement("tbody");
  for (const product of products.slice(0, 5)) {
    const row = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = product.name;
    const dimensions = document.createElement("td");
    dimensions.textContent = `${product.width} × ${product.height} × ${product.depth}`;
    row.append(name, dimensions);
    body.append(row);
  }
  table.append(head, body);
  preview.append(table);
  if (products.length > 5) {
    const more = document.createElement("p");
    more.className = "note";
    more.textContent = `И ещё строк: ${products.length - 5}.`;
    preview.append(more);
  }
}

function prepareExternalCsv() {
  pendingExternalCsv = null;
  byId("external-csv-import").disabled = true;
  byId("external-csv-preview").replaceChildren();
  if (!externalCsvFile) return;
  try {
    const result = parseExternalCabinetCsv(externalCsvFile.text, byId("external-csv-unit").value);
    renderExternalCsvPreview(result.products);
    if (result.errors.length) {
      const visibleErrors = result.errors.slice(0, 8).join("\n");
      const extra = result.errors.length > 8 ? `\nИ ещё ошибок: ${result.errors.length - 8}.` : "";
      byId("external-csv-status").textContent =
        `Найдено корректных строк: ${result.products.length}; с ошибками: ${result.errors.length}. Исправьте файл — частичный импорт не выполняется.\n${visibleErrors}${extra}`;
      byId("external-csv-status").className = "error";
      return;
    }
    pendingExternalCsv = result.products;
    const sourceReference = byId("external-source-reference").value.trim();
    const canImport = result.products.length > 0 &&
      byId("external-source-rights").checked && sourceReference.length > 0;
    byId("external-csv-import").disabled = !canImport;
    byId("external-csv-status").textContent = result.products.length
      ? `Проверка пройдена: ${result.products.length} корпус(а). Единицы ${byId("external-csv-unit").value} будут пересчитаны в мм. Импорт добавит новые изделия, не изменяя текущие.${canImport ? "" : " Укажите источник и подтвердите право использования данных."}`
      : "В CSV нет импортируемых корпусов.";
    byId("external-csv-status").className = "note";
  } catch (error) {
    byId("external-csv-status").textContent = error.message;
    byId("external-csv-status").className = "error";
  }
}

function setPersonalLibraryStatus(message, isError = false) {
  byId("library-status").textContent = message;
  byId("library-status").className = isError ? "error" : "note";
}

function selectedGeneratedOrCustom() {
  const product = selectedProduct();
  return product ? selectedPart(product) : null;
}

const voiceTypeNames = {
  "lower-cabinet": "Нижний кухонный корпус",
  "upper-cabinet": "Верхний кухонный корпус",
  "tall-cabinet": "Кухонный пенал",
  cabinet: "Корпусное изделие",
};
const voiceFieldLabels = {
  type: "тип изделия",
  name: "название",
  width: "ширина",
  height: "высота",
  depth: "глубина",
  thickness: "толщина",
  material: "материал",
  color: "декор/цвет",
  shelves: "полки",
  doors: "двери",
  drawers: "ящики",
  divider: "перегородка",
  back: "задняя стенка",
  hardware: "фурнитура",
};

function voiceNumber(token) {
  const words = {
    ноль: 0,
    один: 1, одна: 1, одно: 1, одну: 1, одни: 1,
    два: 2, две: 2, двух: 2,
    три: 3, трех: 3, трёх: 3,
    четыре: 4, четырех: 4, четырёх: 4,
    пять: 5, пяти: 5,
    шесть: 6, шести: 6,
    семь: 7, семи: 7,
    восемь: 8, восьми: 8,
    девять: 9, девяти: 9,
    десять: 10,
  };
  const normalized = String(token).toLocaleLowerCase().replace(",", ".");
  return Object.prototype.hasOwnProperty.call(words, normalized) ? words[normalized] : Number(normalized);
}

function voiceUnitToMillimeters(value, unit) {
  const multipliers = {
    mm: 1, мм: 1, миллиметр: 1, миллиметра: 1, миллиметров: 1, миллиметры: 1,
    cm: 10, см: 10, сантиметр: 10, сантиметра: 10, сантиметров: 10, сантиметры: 10,
    m: 1000, м: 1000, метр: 1000, метра: 1000, метров: 1000,
    millimeter: 1, millimeters: 1, centimeter: 10, centimeters: 10,
    in: 25.4, inch: 25.4, inches: 25.4, дюйм: 25.4, дюйма: 25.4, дюймов: 25.4, дюймы: 25.4,
  };
  const multiplier = multipliers[String(unit || "").toLocaleLowerCase()];
  return multiplier ? value * multiplier : value;
}

function voiceDimension(text, field, wordPattern) {
  const numberPattern = "(-?\\d+(?:[.,]\\d+)?)";
  const unitPattern = "(миллиметр(?:а|ов)?|сантиметр(?:а|ов)?|миллиметры|сантиметры|метр(?:а|ов)?|дюйм(?:а|ов)?|дюймы|millimeters?|centimeters?|inches?|мм|см|mm|cm|м|m|in)";
  const patterns = [
    new RegExp(`(?:${wordPattern})\\s*(?:[:=]\\s*)?${numberPattern}\\s*${unitPattern}?`, "gi"),
    new RegExp(`${numberPattern}\\s*${unitPattern}?\\s*(?:в\\s+)?(?:${wordPattern})`, "gi"),
  ];
  // Speech comes without commas («шириной 800 высотой 720»): a number right after another size word
  // belongs to that word, so the «number before word» form must not take it for this field.
  const ownedByPreviousWord = /(?:ширин|высот|глубин|толщин|длин)[а-яё]*\s*(?:[:=]\s*)?$/i;
  const matches = patterns.flatMap((pattern, patternIndex) => [...text.matchAll(pattern)]
    .filter((match) => patternIndex === 0 || !ownedByPreviousWord.test(text.slice(0, match.index)))
    .map((match) => ({
      raw: Number(match[1].replace(",", ".")),
      rawText: match[0],
      unit: match[2] || "",
      index: match.index,
    }))).filter((match, index, all) =>
    Number.isFinite(match.raw) &&
    all.findIndex((other) => other.index === match.index && other.raw === match.raw) === index)
    .sort((left, right) => left.index - right.index);
  if (!matches.length) {
    return { value: null, conflict: false, unitsMissing: false, negative: false, sourceValue: null, sourceUnit: null };
  }
  const unitsMissing = matches.some((match) => !match.unit);
  const negative = matches.some((match) => match.raw < 0);
  const values = matches.map((match) => voiceUnitToMillimeters(match.raw, match.unit));
  const unique = [...new Set(values.map((value) => Math.round(value * 1000) / 1000))];
  return {
    value: unique.length === 1 && !negative ? unique[0] : null,
    conflict: unique.length > 1,
    unitsMissing,
    negative,
    field,
    sourceValue: matches.map((match) => match.rawText).join(" / "),
    sourceUnit: [...new Set(matches.map((match) => match.unit).filter(Boolean))].join(", ") || null,
  };
}

function voiceNumberPattern() {
  return "-?\\d+|ноль|один|одна|одно|одну|одни|двух|два|две|трех|трёх|три|четырех|четырёх|четыре|пяти|пять|шести|шесть|семи|семь|восьми|восемь|девяти|девять|десяти|десять";
}

function voiceCount(text, nounPattern, negativePattern) {
  const numberPattern = voiceNumberPattern();
  const corrections = [
    ...text.matchAll(new RegExp(`не\\s*(${numberPattern})\\s*(?:${nounPattern})\\s*,?\\s*а\\s*(${numberPattern})\\s*(?:${nounPattern})?`, "gi")),
    ...text.matchAll(new RegExp(`не\\s*(${numberPattern})\\s*,?\\s*а\\s*(${numberPattern})\\s*(?:${nounPattern})`, "gi")),
  ].sort((left, right) => left.index - right.index);
  const corrected = corrections.filter((match) =>
    !corrections.some((other) => other !== match && other.index <= match.index && other.index + other[0].length >= match.index + match[0].length));
  const validCorrections = corrected.map((match) => ({
    value: voiceNumber(match[2]),
    rejectedValue: voiceNumber(match[1]),
    sourceValue: match[0],
    index: match.index,
    end: match.index + match[0].length,
  }));
  const correctionConflict = new Set(validCorrections.map((match) => match.value)).size > 1;
  const matches = [
    ...[...text.matchAll(new RegExp(`(${numberPattern})\\s*(?:${nounPattern})`, "gi"))].map((match) => ({
      value: voiceNumber(match[1]),
      sourceValue: match[0],
      index: match.index,
      end: match.index + match[0].length,
    })),
    // «двери одна полка» (speech has no commas): «одна» counts the shelf that follows, not the doors.
    ...[...text.matchAll(new RegExp(`(?:${nounPattern})\\s*(?:[:=]\\s*|\\s+)(${numberPattern})`, "gi"))]
      .filter((match) => !/^\s*(?:полк|двер|ящик|шухляд|фасад|створ|перегородк|шкаф|корпус|тумб|модул|пенал)/i
        .test(text.slice(match.index + match[0].length)))
      .map((match) => ({
        value: voiceNumber(match[1]),
        sourceValue: match[0],
        index: match.index,
        end: match.index + match[0].length,
      })),
  ].filter((match) => Number.isFinite(match.value) &&
    !validCorrections.some((correction) =>
      match.index < correction.end && match.end > correction.index ||
      match.index < correction.index && match.value === correction.rejectedValue &&
      correction.index - match.end <= 60));
  matches.push(...validCorrections);
  const negativeMention = new RegExp(`не\\s*(${numberPattern})\\s*(?:${nounPattern})`, "i").test(text);
  if (new RegExp(negativePattern, "i").test(text)) {
    matches.push({ value: 0, sourceValue: text.match(new RegExp(negativePattern, "i"))[0], index: text.length, end: text.length });
  }
  const values = matches.map((match) => match.value);
  const unique = [...new Set(values)];
  const negative = unique.some((value) => value < 0);
  const conflict = correctionConflict || negativeMention && validCorrections.length === 0 || unique.length > 1;
  return {
    value: unique.length === 1 && !conflict && !negative ? unique[0] : null,
    conflict,
    negative,
    sourceValue: matches.map((match) => match.sourceValue).join(" / ") || null,
    unit: matches.length ? "шт." : null,
  };
}

function parseVoiceDescription(text) {
  const source = text.trim();
  if (!source) throw new Error("Введите описание вручную или распознайте его браузером.");
  const issues = [];
  const addIssue = (message, fields = [], permanent = false, code = null) => issues.push({ message, fields, permanent, code });
  const typePatterns = [
    ["lower-cabinet", /нижн[а-яё]*\s+(?:кухонн[а-яё]*\s+)?(?:шкаф[а-яё]*|корпус[а-яё]*|тумб[а-яё]*|модул[а-яё]*)|(?:шкаф[а-яё]*|корпус[а-яё]*|тумб[а-яё]*|модул[а-яё]*)\s+(?:кухонн[а-яё]*\s+)?(?:нижн[а-яё]*|снизу|внизу)/gi],
    ["upper-cabinet", /верхн[а-яё]*\s+(?:кухонн[а-яё]*\s+)?(?:шкаф[а-яё]*|корпус[а-яё]*|тумб[а-яё]*|модул[а-яё]*)|(?:шкаф[а-яё]*|корпус[а-яё]*|тумб[а-яё]*|модул[а-яё]*)\s+(?:кухонн[а-яё]*\s+)?(?:верхн[а-яё]*|сверху|вверху)/gi],
    ["tall-cabinet", /пенал[а-яё]*|высок[а-яё]*\s+(?:кухонн[а-яё]*\s+)?(?:шкаф|корпус|тумб[а-яё]*)/gi],
  ];
  const typeMatches = typePatterns.flatMap(([value, pattern]) =>
    [...source.matchAll(pattern)].map((match) => ({ value, sourceValue: match[0], index: match.index })));
  if (!typeMatches.length) {
    typeMatches.push(...[...source.matchAll(/шкаф[а-яё]*|корпус[а-яё]*|тумб[а-яё]*|модул[а-яё]*/gi)]
      .map((match) => ({ value: "cabinet", sourceValue: match[0], index: match.index })));
  }
  const uniqueTypes = [...new Set(typeMatches.map((match) => match.value))];
  const pluralProduct = /(?:^|[^а-яё])(?:две|два|три|четыре|пять|[2-9]\d*)\s+(?:(?:нижн|верхн|высок)[а-яё]*\s+)?(?:кухонн[а-яё]*\s+)?(?:шкаф|корпус|тумб[а-яё]*|пенал[а-яё]*)/i.test(source);
  const typeConflict = uniqueTypes.length > 1 || typeMatches.length > 1;
  const type = typeConflict || pluralProduct ? "" : (uniqueTypes[0] || "");
  const typeSource = typeMatches.map((match) => match.sourceValue).join(" / ") || null;
  if (typeConflict) addIssue("В описании несколько типов или корпусов. Оставьте описание одного изделия либо выберите тип вручную.", ["type"], false, "type-conflict");
  if (pluralProduct) addIssue("Описание относится к нескольким изделиям, а форма создаёт только один корпус. Опишите одно изделие отдельно или нажмите «Разобрать как комплект».", [], true, "plural");
  if (!uniqueTypes.length && /(стол(?!ешниц)|стул|кроват|диван)/i.test(source)) {
    addIssue("Назван тип мебели, для которого в этой версии нет модели. Исправьте описание на один поддерживаемый корпус.", [], true);
  }

  const dimensions = {
    width: voiceDimension(source, "width", "ширин(?:а|ы|ой|у|е)"),
    height: voiceDimension(source, "height", "высот(?:а|ы|ой|у|е)"),
    depth: voiceDimension(source, "depth", "глубин(?:а|ы|ой|у|е)"),
  };
  for (const [field, dimension] of Object.entries(dimensions)) {
    if (dimension.conflict) addIssue(`В описании несколько значений ${voiceFieldLabels[field]}. Укажите одно значение в поле.`, [field]);
    if (dimension.negative) addIssue(`Значение поля «${voiceFieldLabels[field]}» отрицательное. Введите положительное число вручную.`, [field]);
  }
  const thicknessData = voiceDimension(source, "thickness",
    "толщин[а-яё]*|плит[а-яё]*|лдсп|дсп|мдф|хдф|фанер[а-яё]*");
  if (thicknessData.conflict) addIssue("В описании несколько значений толщины плиты. Укажите одно значение.", ["thickness"]);
  if (thicknessData.negative) addIssue("Значение толщины плиты отрицательное. Введите положительное число вручную.", ["thickness"]);
  const thickness = thicknessData.value;
  const unitsMissing = [...Object.values(dimensions), thicknessData].some((dimension) =>
    dimension.unitsMissing);

  const materialTerms = [
    ["ldsp", /лдсп|дсп/gi],
    ["unsupported", /мдф|хдф|фанер[а-яё]*|массив[а-яё]*/gi],
  ];
  const hdfBackPanel = /(?:задн[а-яё]*\s+)?стенк[а-яё]*\s+хдф|хдф\s+(?:задн[а-яё]*\s+)?стенк[а-яё]*/i.test(source);
  let materialMentions = materialTerms.flatMap(([value, pattern]) => [...source.matchAll(pattern)]
    .filter((match) => !(value === "unsupported" && match[0].toLocaleLowerCase() === "хдф" && hdfBackPanel))
    .map((match) => ({ value, sourceValue: match[0], index: match.index, end: match.index + match[0].length })));
  const materialCorrection = source.match(/не\s+(лдсп|дсп|мдф|хдф|фанер[а-яё]*|массив[а-яё]*)\s*,?\s*а\s+(лдсп|дсп|мдф|хдф|фанер[а-яё]*|массив[а-яё]*)/i);
  if (materialCorrection) {
    const correctionIndex = materialCorrection.index;
    materialMentions = materialMentions.filter((match) =>
      match.index < correctionIndex || match.index >= correctionIndex + materialCorrection[0].length);
    materialMentions.push({
      value: /лдсп|дсп/i.test(materialCorrection[2]) ? "ldsp" : "unsupported",
      sourceValue: materialCorrection[0],
      index: correctionIndex,
      end: correctionIndex + materialCorrection[0].length,
    });
  }
  const materialValues = [...new Set(materialMentions.map((match) => match.value))];
  const materialConflict = materialValues.length > 1;
  const materialNegated = /не\s+(?:лдсп|дсп|мдф|хдф|фанер[а-яё]*|массив[а-яё]*)(?!\s*,?\s*а\s+(?:лдсп|дсп|мдф|хдф|фанер[а-яё]*|массив[а-яё]*))/i.test(source);
  const material = materialConflict ? "" : materialValues[0] || "";
  if (materialConflict) addIssue("В описании названы разные материалы корпуса. Выберите один.", ["material"]);
  if (materialNegated) addIssue("Материал указан с отрицанием без однозначного исправления. Выберите материал вручную.", ["material"]);

  const colorPatterns = [
    ["white", /бел(?:ый|ая|ое|ую|ого|ым|ом)/gi],
    ["oak", /(?:натуральн[а-яё]*\s+дуб[а-яё]*|дуб[а-яё]*\s+натуральн[а-яё]*|дуб[а-яё]*)/gi],
    ["graphite", /графит[а-яё]*/gi],
  ];
  const colorMatches = colorPatterns.flatMap(([value, pattern]) =>
    [...source.matchAll(pattern)].map((match) => ({ value, sourceValue: match[0], index: match.index, end: match.index + match[0].length })));
  const colorCorrection = source.match(/не\s*(бел(?:ый|ая|ое|ую|ого|ым|ом)|дуб[а-яё]*|графит[а-яё]*)\s*,?\s*а\s*(бел(?:ый|ая|ое|ую|ого|ым|ом)|дуб[а-яё]*|графит[а-яё]*)/i);
  if (colorCorrection) {
    const correctionIndex = colorCorrection.index;
    const correctedColor = colorPatterns.find(([, pattern]) =>
      new RegExp(pattern.source, "i").test(colorCorrection[2]))?.[0] || "";
    for (const pattern of colorPatterns) pattern[1].lastIndex = 0;
    for (let index = colorMatches.length - 1; index >= 0; index -= 1) {
      if (colorMatches[index].index >= correctionIndex &&
          colorMatches[index].end <= correctionIndex + colorCorrection[0].length) colorMatches.splice(index, 1);
    }
    if (correctedColor) colorMatches.push({
      value: correctedColor,
      sourceValue: colorCorrection[0],
      index: correctionIndex,
      end: correctionIndex + colorCorrection[0].length,
    });
  }
  const negatedColor = /не\s*(?:бел(?:ый|ая|ое|ую|ого|ым|ом)|дуб[а-яё]*|графит[а-яё]*)(?!\s*,?\s*а\s*(?:бел(?:ый|ая|ое|ую|ого|ым|ом)|дуб|графит))/i.test(source);
  const uniqueColors = [...new Set(colorMatches.map((match) => match.value))];
  const colorConflict = uniqueColors.length > 1;
  const color = colorConflict || negatedColor ? "" : uniqueColors[0] || "";
  if (colorConflict) addIssue("В описании названы разные декоры. Выберите один.", ["color"]);
  if (negatedColor) addIssue("Цвет указан с отрицанием без однозначного исправления. Выберите декор вручную.", ["color"]);
  const shelves = voiceCount(source, "полк[а-яё]*", "без\\s+полк[а-яё]*");
  const doors = voiceCount(source, "(?:двер[а-яё]*|фасад[а-яё]*)", "без\\s+(?:двер[а-яё]*|фасад[а-яё]*)");
  const drawers = voiceCount(source, "(?:ящик[а-яё]*|шухляд[а-яё]*)", "без\\s+(?:ящик[а-яё]*|шухляд[а-яё]*)");
  for (const [field, count] of Object.entries({ shelves, doors, drawers })) {
    if (count.conflict) addIssue(`В описании несколько или противоречивые значения: ${voiceFieldLabels[field]}. Укажите одно значение в поле.`, [field]);
    if (count.negative) addIssue(`Количество для поля «${voiceFieldLabels[field]}» отрицательное. Введите неотрицательное целое число вручную.`, [field]);
  }
  const dividerNo = /без\s+(?:вертикальн[а-яё]*\s+)?перегородк[а-яё]*|перегородк[а-яё]*\s*(?:не\s+нужна|нет)|не\s+(?:нужна|нужен)\s+(?:вертикальн[а-яё]*\s+)?перегородк[а-яё]*/i.test(source);
  const backNo = /без\s+(?:задн[а-яё]*\s+)?стенк[а-яё]*|задн[а-яё]*\s+стенк[а-яё]*\s*(?:не\s+нужна|нет)|не\s+(?:нужна|нужен)\s+(?:задн[а-яё]*\s+)?стенк[а-яё]*/i.test(source);
  const dividerMentioned = /перегородк[а-яё]*/i.test(source);
  const dividerPositiveSource = source.replace(/не\s+(?:нужна|нужен)\s+(?:вертикальн[а-яё]*\s+)?перегородк[а-яё]*/gi, "");
  const dividerYes = /(?:с|есть|нужна|нужен)\s+(?:вертикальн[а-яё]*\s+)?перегородк[а-яё]*|перегородк[а-яё]*\s*[:=]\s*да/i.test(dividerPositiveSource) ||
    (dividerMentioned && !dividerNo);
  const backMentioned = /задн[а-яё]*\s+стенк[а-яё]*|хдф\s+(?:задн[а-яё]*\s+)?стенк[а-яё]*/i.test(source);
  const backPositiveSource = source.replace(/не\s+(?:нужна|нужен)\s+(?:задн[а-яё]*\s+)?стенк[а-яё]*/gi, "");
  const backYes = /(?:с|есть|нужна|нужен)\s+(?:задн[а-яё]*\s+)?стенк[а-яё]*|задн[а-яё]*\s+стенк[а-яё]*\s*[:=]\s*да/i.test(backPositiveSource) ||
    (backMentioned && !backNo);
  const hardwareTerms = [
    ["конфирмат", /конфирмат[а-яё]*/i],
    ["шкант", /шкант[а-яё]*/i],
    ["Minifix", /minifix/i],
    ["Rafix", /rafix/i],
    ["саморез", /саморез[а-яё]*/i],
    ["уголок", /уголк[а-яё]*/i],
    ["петли", /петл[а-яё]*/i],
    ["направляющие", /направляющ[а-яё]*/i],
  ].filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
  const parsed = {
    type,
    name: voiceTypeNames[type] || "",
    width: dimensions.width.value,
    height: dimensions.height.value,
    depth: dimensions.depth.value,
    thickness,
    material,
    color,
    shelves: shelves.value,
    doors: doors.value,
    drawers: drawers.value,
    divider: dividerYes === dividerNo ? "" : (dividerYes ? "yes" : "no"),
    back: backYes === backNo ? "" : (backYes ? "yes" : "no"),
    hardware: hardwareTerms.join(", "),
  };
  if (dividerYes && dividerNo) addIssue("Противоречивое описание перегородки. Выберите да или нет.", ["divider"]);
  if (backYes && backNo) addIssue("Противоречивое описание задней стенки. Выберите да или нет.", ["back"]);
  const evidence = {
    type: { sourceValue: typeSource, unit: null },
    name: { sourceValue: typeSource, unit: null },
    width: { sourceValue: dimensions.width.sourceValue, unit: "мм", sourceUnit: dimensions.width.sourceUnit },
    height: { sourceValue: dimensions.height.sourceValue, unit: "мм", sourceUnit: dimensions.height.sourceUnit },
    depth: { sourceValue: dimensions.depth.sourceValue, unit: "мм", sourceUnit: dimensions.depth.sourceUnit },
    thickness: { sourceValue: thicknessData.sourceValue, unit: "мм", sourceUnit: thicknessData.sourceUnit },
    material: { sourceValue: materialMentions.map((match) => match.sourceValue).join(" / ") || null, unit: null },
    color: { sourceValue: colorMatches.map((match) => match.sourceValue).join(" / ") || null, unit: null },
    shelves: { sourceValue: shelves.sourceValue, unit: shelves.unit },
    doors: { sourceValue: doors.sourceValue, unit: doors.unit },
    drawers: { sourceValue: drawers.sourceValue, unit: drawers.unit },
    divider: { sourceValue: dividerMentioned ? (source.match(/.{0,12}перегородк[а-яё]*.{0,12}/i) || ["перегородка"])[0] : null, unit: null },
    back: { sourceValue: backMentioned ? (source.match(/.{0,12}(?:задн[а-яё]*\s+стенк[а-яё]*|хдф).{0,12}/i) || ["задняя стенка"])[0] : null, unit: null },
    hardware: { sourceValue: hardwareTerms.join(", ") || null, unit: null },
  };
  return {
    parsed,
    issues,
    evidence,
    unitsMissing,
    materialClass: material === "ldsp" ? "ЛДСП" : material === "unsupported" ? "неподдерживаемый" : "",
  };
}

function voiceValuesFromForm() {
  const value = (id) => byId(id).value;
  const number = (id) => value(id) === "" ? null : Number(value(id));
  return {
    type: value("voice-product-type"),
    name: value("voice-name").trim(),
    width: number("voice-width"),
    height: number("voice-height"),
    depth: number("voice-depth"),
    thickness: number("voice-thickness"),
    material: value("voice-material"),
    color: value("voice-color"),
    shelves: number("voice-shelves"),
    doors: number("voice-doors"),
    drawers: number("voice-drawers"),
    divider: value("voice-divider"),
    back: value("voice-back"),
    hardware: value("voice-hardware").trim(),
  };
}

function voiceValueLabel(value) {
  if (value === null || value === undefined || value === "") return "не указано";
  if (value === "yes") return "да";
  if (value === "no") return "нет";
  if (voiceTypeNames[value]) return voiceTypeNames[value];
  if (value === "ldsp") return "ЛДСП";
  if (value === "unsupported") return "неподдерживаемый материал";
  if (value === "oak") return "дуб натуральный";
  if (value === "white") return "белый";
  if (value === "graphite") return "графит";
  return String(value);
}

const voiceInputIds = {
  type: "voice-product-type",
  name: "voice-name",
  width: "voice-width",
  height: "voice-height",
  depth: "voice-depth",
  thickness: "voice-thickness",
  material: "voice-material",
  color: "voice-color",
  shelves: "voice-shelves",
  doors: "voice-doors",
  drawers: "voice-drawers",
  divider: "voice-divider",
  back: "voice-back",
  hardware: "voice-hardware",
};

function normalizedVoiceValue(value) {
  return value === undefined || value === "" ? null : value;
}

function sameVoiceValue(left, right) {
  return JSON.stringify(normalizedVoiceValue(left)) === JSON.stringify(normalizedVoiceValue(right));
}

function formatVoiceParameterProvenance(parameters, labels = voiceFieldLabels) {
  const statusLabels = {
    recognized: "распознано",
    "needs-clarification": "требует уточнения",
    confirmed: "подтверждено",
    modified: "изменено пользователем",
  };
  return Object.entries(parameters).map(([field, parameter]) => {
    const source = parameter.sourceValue === null ? "нет в тексте" : `«${parameter.sourceValue}»`;
    const final = parameter.finalValue === null
      ? "не указано"
      : `${voiceValueLabel(parameter.finalValue)}${parameter.unit ? ` ${parameter.unit}` : ""}`;
    const sourceUnit = parameter.sourceUnit ? ` (единицы в тексте: ${parameter.sourceUnit})` : "";
    return `${labels[field]}: источник ${source}${sourceUnit}; распознано ${voiceValueLabel(parameter.recognizedValue)}; итог ${final}; статус ${statusLabels[parameter.status]}.`;
  }).join("\n");
}

function updateVoiceDraftStatus() {
  if (!voiceDraft) return;
  const values = voiceValuesFromForm();
  const questions = [];
  for (const [field, parameter] of Object.entries(voiceDraft.parameters)) {
    parameter.finalValue = normalizedVoiceValue(values[field]);
    if (!sameVoiceValue(parameter.finalValue, parameter.recognizedValue)) {
      parameter.status = "modified";
    } else if (parameter.status !== "confirmed") {
      parameter.status = parameter.finalValue === null ? "needs-clarification" : "recognized";
    }
  }
  if (byId("voice-transcript").value.trim() !== voiceDraft.sourceText) {
    questions.push("Текст изменён после разбора. Разберите его повторно; текущие ручные исправления сохранятся.");
  }
  for (const issue of voiceDraft.issues) {
    const resolved = !issue.permanent && issue.fields.length > 0 && issue.fields.every((field) => {
      const parameter = voiceDraft.parameters[field];
      return parameter && parameter.status === "modified" && parameter.finalValue !== null;
    });
    if (!resolved) questions.push(issue.message);
  }
  const required = [
    ["type", "тип изделия"], ["name", "название"], ["width", "ширина"], ["height", "высота"],
    ["depth", "глубина"], ["thickness", "толщина плиты"], ["material", "материал корпуса"],
    ["color", "декор/цвет"], ["shelves", "количество полок"], ["doors", "количество дверей"],
    ["drawers", "количество ящиков"], ["divider", "наличие перегородки"], ["back", "наличие задней стенки"],
  ];
  for (const [field, label] of required) {
    if (values[field] === null || values[field] === "") questions.push(`Уточните ${label}.`);
  }
  if (values.material === "unsupported") questions.push("Указанный материал не поддерживается моделью корпуса FURNIX. Выберите ЛДСП или измените описание.");
  for (const field of ["width", "height", "depth", "thickness", "shelves", "doors", "drawers"]) {
    const input = byId(voiceInputIds[field]);
    if (values[field] !== null && !input.validity.valid) {
      questions.push(`Проверьте диапазон или целое значение поля «${voiceFieldLabels[field]}».`);
    }
  }
  byId("voice-units-confirm-label").hidden = !voiceDraft.unitsMissing;
  if (voiceDraft.unitsMissing && !byId("voice-units-confirm").checked) {
    questions.push("Размеры были без единиц. Проверьте числа и подтвердите, что они указаны в мм.");
  }
  byId("voice-hardware-confirm-label").hidden = !values.hardware;
  if (values.hardware && !byId("voice-hardware-confirm").checked) {
    questions.push("Подтвердите, что названная фурнитура останется заметкой: автоматического добавления компонентов нет.");
  }
  const parameters = {
    name: values.name,
    width: values.width,
    height: values.height,
    depth: values.depth,
    thickness: values.thickness,
    shelves: values.shelves,
    divider: values.divider === "yes",
    back: values.back === "yes",
    color: values.color,
    doors: values.doors,
    drawers: values.drawers,
    x: 0,
    z: 0,
  };
  if (values.material === "ldsp" && values.color && !validCabinet(parameters)) {
    questions.push("Проверьте диапазоны размеров и количества: корпус не проходит проверку параметров FURNIX.");
  }
  byId("voice-input-questions").textContent = questions.length
    ? `Нужно уточнить перед созданием:\n• ${questions.join("\n• ")}`
    : "Параметры заполнены. Проверьте их и подтвердите создание модели.";
  byId("voice-input-questions").className = questions.length ? "error" : "note";
  byId("voice-confirm").disabled = questions.length > 0;

  byId("voice-input-provenance").textContent = formatVoiceParameterProvenance(voiceDraft.parameters);
}

function renderVoiceParse(result, transcript) {
  const sourceText = transcript.trim();
  const previousDraft = voiceDraft;
  const previousValues = previousDraft ? voiceValuesFromForm() : null;
  const parsed = result.parsed;
  const set = (id, value) => { byId(id).value = value === null || value === undefined ? "" : String(value); };
  const parameters = {};
  for (const [field, recognizedValue] of Object.entries(parsed)) {
    const previousParameter = previousDraft?.parameters?.[field];
    const previousValue = previousValues?.[field];
    const keepPreviousEdit = previousParameter && !sameVoiceValue(previousParameter.recognizedValue, previousValue);
    const evidence = result.evidence[field] || { sourceValue: null, unit: null };
    const finalValue = keepPreviousEdit ? normalizedVoiceValue(previousValue) : normalizedVoiceValue(recognizedValue);
    parameters[field] = {
      sourceValue: evidence.sourceValue ?? null,
      recognizedValue: normalizedVoiceValue(recognizedValue),
      finalValue,
      unit: evidence.unit ?? null,
      sourceUnit: evidence.sourceUnit ?? null,
      status: keepPreviousEdit
        ? "modified"
        : finalValue === null && field !== "hardware" ? "needs-clarification" : "recognized",
    };
    set(voiceInputIds[field], finalValue);
  }
  const sameSource = previousDraft?.sourceText === sourceText;
  voiceDraft = {
    sourceText,
    parsed: structuredClone(parsed),
    parameters,
    issues: result.issues,
    unitsMissing: result.unitsMissing,
  };
  if (!sameSource) {
    byId("voice-units-confirm").checked = false;
    byId("voice-hardware-confirm").checked = false;
  }
  byId("voice-draft-fields").hidden = false;
  byId("voice-input-status").className = "note";
  byId("voice-input-status").textContent = result.materialClass
    ? `Черновой разбор правилом без ИИ. Материал распознан как ${result.materialClass}; декор/цвет определяется отдельно.`
    : "Черновой разбор правилом без ИИ. Проверьте каждое значение; нераспознанные параметры оставлены пустыми.";
  updateVoiceDraftStatus();
}

function setVoiceStatus(message, isError = false) {
  byId("voice-input-status").textContent = message;
  byId("voice-input-status").className = isError ? "error" : "note";
}

function setVoiceTranscript(text) {
  byId("voice-transcript").value = text.slice(0, 2000);
  updateVoiceDraftStatus();
}

// Error codes of the browser SpeechRecognition API, explained for the user.
function voiceRecognitionErrorText(code) {
  return ({
    "no-speech": "Речь не услышана. Говорите сразу после нажатия и ближе к микрофону; проверьте, что в Chrome выбран нужный микрофон (значок камеры/микрофона справа в адресной строке).",
    "audio-capture": "Микрофон недоступен: Chrome не получил звук. Проверьте, что микрофон подключён и выбран в настройках Chrome и Windows.",
    "not-allowed": "Доступ к микрофону запрещён для этой страницы. Разрешите микрофон: значок справа в адресной строке → «Разрешить», затем обновите страницу.",
    "service-not-allowed": "Браузер не разрешает службу распознавания речи. В Chrome она работает только с включённым интернетом и не работает в некоторых профилях и режимах.",
    network: "Нет связи со службой распознавания речи Chrome — она работает через интернет (серверы Google). Проверьте подключение к интернету, VPN и блокировщики.",
    aborted: "Запись прервана.",
    "language-not-supported": "Браузер не поддерживает распознавание русского языка.",
  })[code] || `Ошибка распознавания (${code || "неизвестная"}).`;
}

function configureVoiceRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasRecognition = typeof Recognition === "function";
  // The record button stays clickable without consent: a disabled button ignores clicks silently,
  // so the click explains what is missing instead.
  byId("voice-record").disabled = !!voiceRecognition;
  if (!hasRecognition) {
    setVoiceStatus("Распознавание речи недоступно в этом браузере. Введите или исправьте текст вручную.");
  } else if (!byId("voice-speech-consent").checked && !voiceRecognition) {
    setVoiceStatus("Для записи включите согласие на обработку речи браузером. Ручной ввод доступен без согласия.");
  } else if (byId("voice-speech-consent").checked && !voiceRecognition) {
    setVoiceStatus("Распознавание браузера доступно. Проверьте настройки браузера и нажмите «Начать запись».");
  }
}

function recordVoiceDescription() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (typeof Recognition !== "function") {
    setVoiceStatus("Этот браузер не поддерживает распознавание речи. Откройте FURNIX в Google Chrome или введите текст вручную.", true);
    return;
  }
  if (!byId("voice-speech-consent").checked) {
    setVoiceStatus("Сначала отметьте галочку «Разрешаю браузеру распознавать речь» над кнопкой, затем снова нажмите «Начать запись».", true);
    const consent = byId("voice-speech-consent");
    consent.closest("label")?.scrollIntoView({ block: "center", behavior: "smooth" });
    consent.focus();
    return;
  }
  if (voiceRecognition) return;
  try {
    const recognition = new Recognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    // Continuous: a pause between phrases does not end the recording; «Остановить» does.
    recognition.continuous = true;
    let recognitionError = null;
    let heard = "";
    let started = false;
    let speechDetected = false;
    let soundDetected = false;
    // No second microphone stream here (a level meter): with one open, Chrome's recogniser can
    // receive silence and end with «no-speech». Progress comes from the recogniser's own events.
    voiceRecognition = recognition;
    byId("voice-record").disabled = true;
    byId("voice-stop").disabled = false;
    setVoiceStatus("Запускаю запись… Если Chrome спросит разрешение на микрофон — нажмите «Разрешить».");
    // Chrome may accept start() and never answer (no connection to its speech service): say so after 5 s.
    const startTimer = setTimeout(() => {
      if (started || voiceRecognition !== recognition) return;
      try { recognition.abort(); } catch { /* already finished */ }
      voiceRecognition = null;
      byId("voice-stop").disabled = true;
      configureVoiceRecognition();
      setVoiceStatus("Запись не началась: браузер не ответил за 5 секунд. Распознавание в Chrome работает через интернет — проверьте подключение, VPN и блокировщики; в браузерах на основе Chromium (Opera, Яндекс, Brave) оно может не работать. Текст можно ввести вручную.", true);
    }, 5000);
    recognition.onstart = () => {
      started = true;
      clearTimeout(startTimer);
      setVoiceStatus("● Запись запущена. Говорите; когда закончите — «Остановить». Текст появится в поле ниже.");
    };
    // Event journal, shown after a recording without text: tells where the browser stopped.
    const journal = [];
    for (const name of ["start", "audiostart", "soundstart", "speechstart", "speechend", "soundend", "audioend", "nomatch"]) {
      recognition.addEventListener?.(name, () => journal.push(name));
    }
    recognition.addEventListener?.("result", (event) => journal.push(`result(${event.results.length})`));
    recognition.addEventListener?.("error", (event) => journal.push(`error:${event.error}`));
    recognition.onaudiostart = () => {
      if (!heard) setVoiceStatus("● Микрофон включён, говорите. Когда закончите — «Остановить».");
    };
    recognition.onsoundstart = () => {
      soundDetected = true;
      if (!heard) setVoiceStatus("● Звук есть, жду речь…");
    };
    recognition.onspeechstart = () => {
      speechDetected = true;
      if (!heard) setVoiceStatus("● Слышу речь, распознаю…");
    };
    recognition.onresult = (event) => {
      heard = [...event.results].map((result) => result[0]?.transcript || "").join(" ").replace(/\s+/g, " ").trim();
      setVoiceTranscript(heard);
      setVoiceStatus("● Идёт запись. Распознаётся… «Остановить» — закончить.");
    };
    recognition.onerror = (event) => {
      recognitionError = event.error || "unknown";
    };
    // onend always follows onerror: the outcome is reported here, so a later status does not hide the error.
    // forced: «Остановить» was pressed and the browser did not send "end" in time (see the stop handler).
    const finish = (forced = false) => {
      clearTimeout(startTimer);
      // After the start timeout this recogniser is already reported and replaced.
      if (voiceRecognition !== recognition) return;
      voiceRecognition = null;
      voiceFinish = null;
      byId("voice-stop").disabled = true;
      configureVoiceRecognition();
      const events = ` События браузера: ${[...journal, forced ? "end не пришёл — запись остановлена принудительно" : "end"].join(" → ")}.`;
      if (!heard && journal.includes("nomatch")) {
        setVoiceStatus(`Служба распознавания слышала звук, но не распознала слова (nomatch). Говорите чётче и ближе к микрофону.${events}`, true);
        return;
      }
      if (!heard && !recognitionError) {
        const heardSound = soundDetected ? "Звук до распознавателя дошёл, " : "Распознаватель Chrome не получил звука, ";
        setVoiceStatus(`${heardSound}${speechDetected ? "речь обнаружена, но служба распознавания" : "служба распознавания не обнаружила речь и"} текст не вернула. Распознавание Chrome работает через интернет (серверы Google): проверьте подключение, отключите VPN и блокировщики рекламы для этой страницы. Обходной путь — диктовка Windows: щёлкните в поле текста ниже и нажмите Win+H.${events}`, true);
        return;
      }
      if (heard) {
        // Fill the draft right away; the cabinet is still created only after the draft is confirmed.
        const asSet = parseVoiceSetDescription(heard).modules.length >= 2;
        byId(asSet ? "voice-parse-set" : "voice-parse").click();
        const note = byId("voice-input-status").className === "error" ? "" :
          ` Распознано и разобрано ${asSet ? "как комплект" : "как один корпус"}: проверьте поля черновика ниже и подтвердите.`;
        if (note) setVoiceStatus(`${byId("voice-input-status").textContent}${note}`.trim());
      } else if (recognitionError && recognitionError !== "aborted") {
        setVoiceStatus(`${voiceRecognitionErrorText(recognitionError)} Текст можно ввести вручную или продиктовать средствами Windows (щёлкните в поле текста и нажмите Win+H).${events}`, true);
      } else if (recognitionError !== "aborted" || forced) {
        setVoiceStatus(`Ничего не распознано. Нажмите «Начать запись» и говорите сразу; проверьте выбранный микрофон в Chrome. Текст можно ввести вручную.${events}`, true);
      }
    };
    recognition.onend = () => finish(false);
    voiceFinish = finish;
    try {
      recognition.start();
    } catch (error) {
      clearTimeout(startTimer);
      throw error;
    }
  } catch (error) {
    voiceRecognition = null;
    byId("voice-stop").disabled = true;
    configureVoiceRecognition();
    setVoiceStatus(`Не удалось начать запись: ${error.message}. Введите текст вручную.`, true);
  }
}

function confirmVoiceDraft() {
  if (!voiceDraft) return;
  updateVoiceDraftStatus();
  if (byId("voice-confirm").disabled) return;
  const values = voiceValuesFromForm();
  const confirmedVoiceParameters = structuredClone(voiceDraft.parameters);
  for (const parameter of Object.values(confirmedVoiceParameters)) {
    if (parameter.status === "recognized") parameter.status = "confirmed";
  }
  const parameters = {
    name: values.name,
    width: values.width,
    height: values.height,
    depth: values.depth,
    thickness: values.thickness,
    shelves: values.shelves,
    divider: values.divider === "yes",
    back: values.back === "yes",
    color: values.color,
    doors: values.doors,
    drawers: values.drawers,
    x: 0,
    z: 0,
  };
  const changedFields = Object.keys(voiceFieldLabels).filter((field) =>
    !sameVoiceValue(voiceDraft.parsed[field], values[field]));
  const sourceInfo = {
    kind: "voice-input",
    name: "Описание голосом",
    transcript: voiceDraft.sourceText,
    confirmedAt: new Date().toISOString(),
    parsedParameters: structuredClone(voiceDraft.parsed),
    confirmedParameters: structuredClone(values),
    voiceParameterSchemaVersion: 1,
    voiceParameters: confirmedVoiceParameters,
    changedFields,
    recognizedHardware: values.hardware,
    hardwareModeled: false,
  };
  const product = addCabinet(parameters, sourceInfo);
  if (!product) {
    setVoiceStatus("Модель не создана: проверьте параметры и сообщения проверки FURNIX.", true);
    return;
  }
  voiceDraft.parameters = confirmedVoiceParameters;
  setVoiceStatus(`Создана редактируемая модель «${product.name}». Из речи извлечены: ${Object.entries(voiceDraft.parsed)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([field, value]) => `${voiceFieldLabels[field]} — ${voiceValueLabel(value)}`).join("; ") || "параметры не распознаны"}.
Подтверждено или изменено пользователем: ${changedFields.map((field) => voiceFieldLabels[field]).join(", ") || "без изменений"}.
${values.hardware ? `Фурнитура (${values.hardware}) сохранена как заметка и не добавлена в модель.` : "Фурнитура не была добавлена."}`, false);
  byId("voice-input-provenance").textContent = formatVoiceParameterProvenance(confirmedVoiceParameters);
}

const voiceSetFieldLabels = {
  ...voiceFieldLabels,
  order: "порядок",
  purpose: "назначение (заметка)",
};
const voiceSetLedgerFields = [
  "order", "type", "name", "width", "height", "depth", "thickness", "material",
  "color", "shelves", "doors", "drawers", "divider", "back", "purpose", "hardware",
];
const voiceSetSharedFields = [
  "width", "height", "depth", "thickness", "material", "color", "shelves", "doors", "drawers", "divider", "back",
];
const voiceSetCommonFields = ["height", "depth", "thickness", "material", "color", "shelves", "doors", "drawers", "divider", "back"];
const voiceSetModuleFields = [...voiceSetLedgerFields.slice(0, 14), "y", "x", "z", "purpose", "hardware"];
const voiceYesNoOptions = [["", "Не указано"], ["yes", "Да"], ["no", "Нет"]];
const voiceSetInputs = {
  order: { label: "Порядок", type: "number", min: 1, max: 12, step: 1 },
  type: { label: "Тип", options: [["", "Не указан"], ["lower-cabinet", "Нижний кухонный корпус"], ["upper-cabinet", "Верхний кухонный корпус"], ["tall-cabinet", "Пенал / высокий корпус"], ["cabinet", "Другое корпусное изделие"]] },
  name: { label: "Название", type: "text", maxLength: 80 },
  width: { label: "Ширина, мм", type: "number", min: 300, max: 3000, step: "any" },
  height: { label: "Высота, мм", type: "number", min: 300, max: 3000, step: "any" },
  depth: { label: "Глубина, мм", type: "number", min: 200, max: 1200, step: "any" },
  thickness: { label: "Толщина плиты, мм", type: "number", min: 10, max: 40, step: "any" },
  material: { label: "Материал", options: [["", "Не указан"], ["ldsp", "ЛДСП"], ["unsupported", "Другой / не поддерживается"]] },
  color: { label: "Декор / цвет", options: [["", "Не указан"], ["oak", "Дуб натуральный"], ["white", "Белый"], ["graphite", "Графит"]] },
  shelves: { label: "Полки, шт.", type: "number", min: 0, max: 12, step: 1 },
  doors: { label: "Двери, шт.", type: "number", min: 0, max: 2, step: 1 },
  drawers: { label: "Ящики, шт.", type: "number", min: 0, max: 4, step: 1 },
  divider: { label: "Перегородка", options: voiceYesNoOptions },
  back: { label: "Задняя стенка", options: voiceYesNoOptions },
  y: { label: "Y основания, мм", type: "number", min: -100000, max: 100000, step: "any" },
  x: { label: "X центра, мм", type: "number", min: -100000, max: 100000, step: "any" },
  z: { label: "Z центра, мм", type: "number", min: -100000, max: 100000, step: "any" },
  purpose: { label: "Назначение (заметка, не меняет конструкцию)", type: "text", maxLength: 200, wide: true },
  hardware: { label: "Фурнитура (заметка, не создаётся)", type: "text", maxLength: 300, wide: true },
};
const voiceSetNumberSource = "-?\\d+(?:[.,]\\d+)?";
const voiceSetUnitSource = "(?:\\s*(миллиметр(?:а|ов|ы)?|сантиметр(?:а|ов|ы)?|метр(?:а|ов)?|дюйм(?:а|ов|ы)?|мм|см|mm|cm|м|m|in)(?![а-яёa-z]))?";
const voiceSetPurposeTerms = [
  ["мойка", /мойк[а-яё]*/i, "назначение «мойка» сохранено заметкой: вырез под мойку, сантехника и усиления не моделируются"],
  ["духовой шкаф", /духов[а-яё]*/i, "назначение «духовой шкаф» сохранено заметкой: ниша и вентиляция под технику не моделируются"],
  ["посудомоечная машина", /посудомо[а-яё]*/i, "назначение «посудомоечная машина» сохранено заметкой: ниша под технику не моделируется"],
  ["варочная панель", /варочн[а-яё]*/i, "назначение «варочная панель» сохранено заметкой: вырез и техника не моделируются"],
  ["холодильник", /холодильн[а-яё]*/i, "назначение «холодильник» сохранено заметкой: техника не моделируется"],
  ["вытяжка", /вытяжк[а-яё]*/i, "назначение «вытяжка» сохранено заметкой: техника и вентиляция не моделируются"],
];

function voiceSetTripleRegex() {
  const n = voiceSetNumberSource;
  const u = voiceSetUnitSource;
  const by = "\\s*(?:на(?![а-яё])|x|х|×|\\*)\\s*";
  return new RegExp(`(${n})${u}${by}(${n})${u}${by}(${n})${u}`, "gi");
}

function parseVoiceSetDescription(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Введите описание вручную или распознайте его браузером.");
  const issues = [];
  const addIssue = (message, fields = [], module = null, permanent = false, code = null) =>
    issues.push({ message, fields, module, permanent, code });
  const corrections = [];
  // "не 600, а 800" keeps only the corrected number; the correction is reported as an assumption.
  const corrected = source.replace(
    new RegExp(`не\\s+(${voiceSetNumberSource})${voiceSetUnitSource}\\s*,?\\s*а\\s+(${voiceSetNumberSource})`, "gi"),
    (match, rejected, rejectedUnit, accepted) => {
      corrections.push(match.trim());
      return accepted;
    });
  const hasTriple = (value) => voiceSetTripleRegex().test(value);
  const sentences = corrected.split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/[.!?]+$/, "").trim())
    .filter(Boolean);
  const colonIndex = sentences.findIndex((sentence) => sentence.includes(":"));
  let header = "";
  const listParts = [];
  const commonParts = [];
  sentences.forEach((sentence, index) => {
    if (index === colonIndex) {
      header = sentence.slice(0, sentence.indexOf(":")).trim();
      listParts.push(sentence.slice(sentence.indexOf(":") + 1).trim());
    } else if (hasTriple(sentence) && index > colonIndex) {
      listParts.push(sentence);
    } else {
      commonParts.push(sentence);
    }
  });
  const moduleMarker = /шкаф|тумб|пенал|корпус|модул|мойк|секци/i;
  const pieces = listParts
    .flatMap((part) => part.split(/\s*;\s*|,(?!\d)\s*|\s+(?:и|затем|потом|далее)\s+/i))
    .map((piece) => piece.trim())
    .filter(Boolean);
  const segments = [];
  let pending = "";
  for (const piece of pieces) {
    const last = segments[segments.length - 1];
    const marker = moduleMarker.test(piece);
    const triple = hasTriple(piece);
    if (last !== undefined && !marker && (!triple || !hasTriple(last))) {
      segments[segments.length - 1] = `${last}, ${piece}`;
    } else if (last === undefined && !marker && !triple) {
      pending = pending ? `${pending}, ${piece}` : piece;
    } else {
      segments.push(pending ? `${pending} ${piece}` : piece);
      pending = "";
    }
  }
  if (pending) segments.push(pending);
  if (segments.length > 12) {
    addIssue("Поддерживается не больше 12 модулей за один раз. Разделите описание на части.", [], null, true);
  }
  if (segments.length < 2) {
    addIssue("Не удалось выделить хотя бы два модуля. Перечислите модули после двоеточия через запятую, например: «…: мойка 800 на 720 на 560, тумба 600 на 720 на 560». Для одного корпуса используйте «Разобрать текст».", [], null, true, "too-few");
  }

  const firstDigit = corrected.search(/\d/);
  const countText = header || (firstDigit > 0 ? corrected.slice(0, firstDigit) : "");
  const declared = countText
    ? voiceCount(countText, "(?:(?:нижн|верхн|кухонн|высок|навесн|напольн)[а-яё]*\\s+){0,2}(?:шкаф|корпус|модул|тумб|секци|пенал)[а-яё]*", "(?!)")
    : { value: null, conflict: false };
  if (declared.conflict) {
    addIssue("Количество модулей названо противоречиво. Исправьте текст описания.", [], null, true);
  } else if (declared.value !== null) {
    addIssue("count", [], null, false, "count");
  }

  const leftToRight = /слева\s+направо/i.test(corrected);
  const rightToLeft = /справа\s+налево/i.test(corrected);
  const adjacency = /рядом|в\s+ряд|подряд|друг\s+за\s+другом|один\s+за\s+другим/i.test(corrected);
  const direction = {
    value: leftToRight && !rightToLeft ? "left-to-right" : rightToLeft && !leftToRight ? "right-to-left" : "",
    conflict: leftToRight && rightToLeft,
    adjacencyOnly: adjacency && !leftToRight && !rightToLeft,
    sourceValue: (corrected.match(/слева\s+направо|справа\s+налево|рядом|в\s+ряд|подряд/gi) || []).join(" / ") || null,
  };

  const rowSource = countText;
  const rowTypes = [
    /нижн[а-яё]*\s+(?:ряд|модул|шкаф|тумб|корпус|секци)/i.test(rowSource) && "lower-cabinet",
    /верхн[а-яё]*\s+(?:ряд|модул|шкаф|тумб|корпус|секци)/i.test(rowSource) && "upper-cabinet",
  ].filter(Boolean);
  if (rowTypes.length > 1) addIssue("В описании ряда названы и нижние, и верхние модули. Выберите тип каждого модуля.", ["type"]);
  const rowType = rowTypes.length === 1 ? rowTypes[0] : "";

  const commonText = [header, ...commonParts].filter(Boolean).join(". ");
  const common = commonText ? parseVoiceDescription(commonText) : null;
  for (const issue of common?.issues || []) {
    if (["type-conflict", "plural"].includes(issue.code)) continue;
    const fields = issue.fields.filter((field) => voiceSetSharedFields.includes(field));
    addIssue(`Общая часть описания: ${issue.message}`, fields, null, issue.permanent || !fields.length);
  }

  let usedTriple = false;
  let sharedTripleUnit = false;
  const modules = segments.slice(0, 12).map((segmentText, index) => {
    const triples = [...segmentText.matchAll(voiceSetTripleRegex())];
    const single = parseVoiceDescription(segmentText.replace(voiceSetTripleRegex(), " , ") || segmentText);
    for (const issue of single.issues) {
      if (["type-conflict", "plural"].includes(issue.code)) continue;
      addIssue(issue.message, issue.fields, index, issue.permanent);
    }
    let unitsMissing = single.unitsMissing;
    const tripleValues = {};
    if (triples.length > 1) {
      addIssue("в описании модуля несколько наборов размеров. Укажите одну ширину, высоту и глубину.", ["width", "height", "depth"], index);
    } else if (triples.length === 1) {
      usedTriple = true;
      const triple = triples[0];
      const shared = !triple[2] && !triple[4] && triple[6] ? triple[6] : "";
      if (shared) sharedTripleUnit = true;
      for (const [field, valueGroup, unitGroup] of [["width", 1, 2], ["height", 3, 4], ["depth", 5, 6]]) {
        const raw = Number(triple[valueGroup].replace(",", "."));
        const unit = triple[unitGroup] || shared;
        if (!unit) unitsMissing = true;
        if (raw < 0) {
          addIssue(`значение поля «${voiceFieldLabels[field]}» отрицательное. Введите положительное число вручную.`, [field], index);
          continue;
        }
        tripleValues[field] = {
          value: Math.round(voiceUnitToMillimeters(raw, unit) * 1000) / 1000,
          sourceValue: triple[0].trim(),
          sourceUnit: unit || null,
        };
      }
    }
    const parsed = {};
    const evidence = {};
    for (const field of voiceSetSharedFields) {
      const candidates = [];
      if (tripleValues[field]) candidates.push(tripleValues[field]);
      const own = single.parsed[field];
      if (own !== null && own !== "") {
        candidates.push({ value: own, sourceValue: single.evidence[field]?.sourceValue ?? null, sourceUnit: single.evidence[field]?.sourceUnit ?? null });
      }
      const shared = common?.parsed[field];
      if (shared !== null && shared !== undefined && shared !== "") {
        candidates.push({
          value: shared,
          sourceValue: common.evidence[field]?.sourceValue ? `общее: ${common.evidence[field].sourceValue}` : "общее описание",
          sourceUnit: common.evidence[field]?.sourceUnit ?? null,
        });
      }
      const unique = [...new Set(candidates.map((candidate) => JSON.stringify(candidate.value)))];
      if (unique.length > 1) {
        addIssue(`для поля «${voiceFieldLabels[field]}» в тексте разные значения (${candidates.map((candidate) => voiceValueLabel(candidate.value)).join(" / ")}). Выберите одно.`, [field], index);
      }
      parsed[field] = unique.length === 1 ? candidates[0].value : (field === "material" || field === "color" || field === "divider" || field === "back" ? "" : null);
      evidence[field] = {
        sourceValue: candidates.map((candidate) => candidate.sourceValue).filter(Boolean).join(" / ") || null,
        unit: ["width", "height", "depth", "thickness"].includes(field) ? "мм" : ["shelves", "doors", "drawers"].includes(field) ? "шт." : null,
        sourceUnit: [...new Set(candidates.map((candidate) => candidate.sourceUnit).filter(Boolean))].join(", ") || null,
      };
    }
    if (common?.unitsMissing) unitsMissing = true;

    const specificTypes = [...new Set([
      /пенал|высок[а-яё]*\s+(?:шкаф|корпус|тумб)/i.test(segmentText) && "tall-cabinet",
      /верхн/i.test(segmentText) && "upper-cabinet",
      /нижн/i.test(segmentText) && "lower-cabinet",
    ].filter(Boolean))];
    if (specificTypes.length > 1) addIssue("в описании модуля несколько типов. Выберите тип вручную.", ["type"], index);
    let type = specificTypes.length === 1 ? specificTypes[0] : rowType || (moduleMarker.test(segmentText) ? "cabinet" : "");
    if (specificTypes.length === 1 && rowType && specificTypes[0] !== "tall-cabinet" && specificTypes[0] !== rowType) {
      addIssue(`тип модуля («${voiceTypeNames[specificTypes[0]]}») не совпадает с типом ряда («${voiceTypeNames[rowType]}»). Выберите тип вручную.`, ["type"], index);
      type = "";
    }
    if (specificTypes.length > 1) type = "";
    const prefixEnd = segmentText.search(/-?\d/);
    const prefix = (prefixEnd >= 0 ? segmentText.slice(0, prefixEnd) : segmentText)
      .replace(/^(?:и|а)\s+/i, "")
      .replace(/^(?:создай|сделай|добавь|построй|нужн[а-яё]*)\s+/i, "")
      .replace(/[\s:,;–—-]+$/, "")
      .trim()
      .slice(0, 80);
    const name = prefix.length >= 2 ? prefix[0].toLocaleUpperCase() + prefix.slice(1) : "";
    const notes = [];
    const purposes = [];
    for (const [label, pattern, note] of voiceSetPurposeTerms) {
      if (pattern.test(segmentText)) {
        purposes.push(label);
        notes.push(note);
      }
    }
    if (/ящик|шухляд/i.test(segmentText) && parsed.drawers === null) {
      notes.push("упомянуты ящики без количества — укажите количество (0–4); ящики в модели условные блоки");
    }
    if (/двер|фасад/i.test(segmentText) && parsed.doors === null) {
      notes.push("упомянуты двери без количества — укажите количество (0–2)");
    }
    const hardware = [...new Set([single.parsed.hardware, common?.parsed.hardware]
      .filter(Boolean).flatMap((value) => value.split(", ")))].join(", ");
    Object.assign(parsed, { order: index + 1, type, name, purpose: purposes.join(", "), hardware });
    Object.assign(evidence, {
      order: { sourceValue: `${index + 1}-й в перечне`, unit: null },
      type: { sourceValue: specificTypes.length ? segmentText : rowType ? `ряд: ${rowSource}` : null, unit: null },
      name: { sourceValue: name ? prefix : null, unit: null },
      purpose: { sourceValue: purposes.length ? purposes.join(", ") : null, unit: null },
      hardware: { sourceValue: hardware || null, unit: null },
    });
    for (const field of Object.keys(evidence)) {
      if (evidence[field].sourceValue && evidence[field].sourceValue.length > 500) {
        evidence[field].sourceValue = evidence[field].sourceValue.slice(0, 500);
      }
    }
    return { sourceText: segmentText.slice(0, 500), parsed, evidence, notes, unitsMissing };
  });
  return {
    modules,
    issues,
    direction,
    declaredCount: declared.conflict ? null : declared.value,
    rowType,
    corrections,
    usedTriple,
    sharedTripleUnit,
  };
}

function voiceSetControl(field, value, moduleKey) {
  const spec = voiceSetInputs[field];
  const label = document.createElement("label");
  label.append(spec.label);
  if (spec.wide) label.style.gridColumn = "1/-1";
  let control;
  if (spec.options) {
    control = document.createElement("select");
    for (const [optionValue, text] of spec.options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = text;
      control.append(option);
    }
  } else {
    control = document.createElement("input");
    control.type = spec.type;
    for (const key of ["min", "max", "step", "maxLength"]) {
      if (spec[key] !== undefined) control[key] = spec[key];
    }
  }
  control.dataset.voiceSetField = field;
  control.dataset.voiceSetModule = String(moduleKey);
  control.value = value === null || value === undefined ? "" : String(value);
  label.append(control);
  return label;
}

function voiceSetControlFor(moduleKey, field) {
  return document.querySelector(`[data-voice-set-module="${moduleKey}"][data-voice-set-field="${field}"]`);
}

function voiceSetModuleValues(moduleKey) {
  const values = {};
  for (const field of voiceSetModuleFields) {
    const control = voiceSetControlFor(moduleKey, field);
    const raw = control ? control.value : "";
    const spec = voiceSetInputs[field];
    values[field] = spec.type === "number"
      ? (raw === "" ? null : Number(raw))
      : spec.type === "text" ? raw.trim() : raw;
  }
  return values;
}

function renderVoiceSetModules() {
  const container = byId("voice-set-modules");
  container.replaceChildren(...voiceSetDraft.modules.map((module, index) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "voice-set-module";
    const legend = document.createElement("legend");
    legend.textContent = `Модуль ${index + 1}${module.sourceText ? ` — «${module.sourceText}»` : " — добавлен вручную"}`;
    const grid = document.createElement("div");
    grid.className = "voice-grid";
    for (const field of voiceSetModuleFields) {
      const value = ["x", "y", "z"].includes(field)
        ? module.placementValues[field]
        : module.parameters[field].finalValue;
      grid.append(voiceSetControl(field, value, index));
    }
    fieldset.append(legend, grid);
    if (module.notes.length) {
      const notes = document.createElement("p");
      notes.className = "voice-set-notes";
      notes.textContent = `Внимание:\n• ${module.notes.join("\n• ")}`;
      fieldset.append(notes);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.voiceSetRemove = String(index);
    remove.textContent = "Удалить модуль из черновика";
    const actions = document.createElement("div");
    actions.className = "voice-actions";
    actions.append(remove);
    fieldset.append(actions);
    return fieldset;
  }));
  byId("voice-set-add-module").disabled = voiceSetDraft.modules.length >= 12;
}

function voiceSetLedger(parsed, evidence) {
  return Object.fromEntries(voiceSetLedgerFields.map((field) => {
    const recognizedValue = normalizedVoiceValue(parsed[field]);
    return [field, {
      sourceValue: evidence[field]?.sourceValue ?? null,
      recognizedValue,
      finalValue: recognizedValue,
      unit: evidence[field]?.unit ?? null,
      sourceUnit: evidence[field]?.sourceUnit ?? null,
      status: recognizedValue === null && !["hardware", "purpose"].includes(field) ? "needs-clarification" : "recognized",
    }];
  }));
}

function renderVoiceSetParse(result, transcript) {
  const previous = voiceSetDraft;
  const keepEdits = previous && previous.modules.length === result.modules.length;
  if (previous) updateVoiceSetStatus();
  const modules = result.modules.map((module, index) => {
    const parameters = voiceSetLedger(module.parsed, module.evidence);
    const isUpper = module.parsed.type === "upper-cabinet";
    let placementValues = { x: null, y: isUpper ? null : 0, z: null };
    let yEdited = false;
    if (keepEdits) {
      const old = previous.modules[index];
      for (const field of voiceSetLedgerFields) {
        const oldParameter = old.parameters[field];
        if (!sameVoiceValue(oldParameter.recognizedValue, oldParameter.finalValue)) {
          parameters[field].finalValue = oldParameter.finalValue;
          parameters[field].status = "modified";
        }
      }
      if (old.yEdited) {
        placementValues = { ...placementValues, y: old.placementValues.y };
        yEdited = true;
      }
      placementValues = { ...placementValues, x: old.placementValues.x, z: old.placementValues.z };
    }
    return { ...module, parameters, placementValues, yEdited };
  });
  const previousDirection = previous ? byId("voice-set-direction").value : "";
  const keepDirection = keepEdits && previousDirection !== previous.direction.value;
  voiceSetDraft = {
    sourceText: transcript.trim(),
    setId: `voice-set-${Date.now()}`,
    modules,
    issues: result.issues,
    direction: result.direction,
    declaredCount: result.declaredCount,
    corrections: result.corrections,
    usedTriple: result.usedTriple,
    sharedTripleUnit: result.sharedTripleUnit,
  };
  byId("voice-set-direction").value = keepDirection ? previousDirection : result.direction.value;
  if (!keepEdits) {
    byId("voice-set-placement").value = "row";
    byId("voice-set-units-confirm").checked = false;
    byId("voice-set-notes-confirm").checked = false;
  }
  const common = byId("voice-set-common-fields");
  if (!common.children.length) {
    common.append(...voiceSetCommonFields.map((field) => voiceSetControl(field, null, "common")));
  }
  renderVoiceSetModules();
  byId("voice-draft-fields").hidden = true;
  byId("voice-set-draft").hidden = false;
  setVoiceStatus(`Черновой разбор комплекта правилами без ИИ: выделено модулей — ${modules.length}. Проверьте каждый модуль; нераспознанные параметры оставлены пустыми.`);
  updateVoiceSetStatus();
}

function voiceSetPlacement(modulesValues, direction, mode) {
  if (mode === "manual") {
    return modulesValues.map((values) =>
      Number.isFinite(values.x) && Number.isFinite(values.z) ? { x: values.x, z: values.z } : null);
  }
  const count = modulesValues.length;
  const orders = modulesValues.map((values) => values.order);
  if (!direction || orders.some((order) => !Number.isInteger(order) || order < 1 || order > count) ||
      new Set(orders).size !== count ||
      modulesValues.some((values) => !(values.width > 0) || !(values.depth > 0))) {
    return modulesValues.map(() => null);
  }
  const sequence = modulesValues.map((values, index) => ({ values, index }))
    .sort((left, right) => left.values.order - right.values.order);
  if (direction === "right-to-left") sequence.reverse();
  const total = modulesValues.reduce((sum, values) => sum + values.width, 0);
  const maxDepth = Math.max(...modulesValues.map((values) => values.depth));
  const cabinets = products.filter((item) => item.type === "cabinet");
  let cursor = cabinets.length
    ? Math.max(...cabinets.map((item) => item.x + cabinetFootprint(item).width / 2)) + 100
    : -total / 2;
  const result = [];
  for (const { values, index } of sequence) {
    result[index] = {
      x: Math.round((cursor + values.width / 2) * 10) / 10,
      z: Math.round((-maxDepth / 2 + values.depth / 2) * 10) / 10,
    };
    cursor += values.width;
  }
  return result;
}

function voiceSetCabinetParameters(values, position) {
  return {
    name: values.name,
    width: values.width,
    height: values.height,
    depth: values.depth,
    thickness: values.thickness,
    shelves: values.shelves,
    divider: values.divider === "yes",
    back: values.back === "yes",
    color: values.color,
    doors: values.doors,
    drawers: values.drawers,
    x: position?.x ?? NaN,
    z: position?.z ?? NaN,
  };
}

function voiceSetModuleNotes(module, values) {
  // Count reminders are dropped once the user has entered the count.
  const notes = module.notes.filter((note) =>
    !(note.startsWith("упомянуты ящики") && values.drawers !== null) &&
    !(note.startsWith("упомянуты двери") && values.doors !== null));
  if (values.purpose && !notes.some((note) => note.includes(`«${values.purpose}»`))) {
    notes.push(`назначение: ${values.purpose}`);
  }
  return notes;
}

// Builds every cabinet before anything is added to the project, so an invalid module leaves no partial set.
function buildVoiceSetCabinets({ draft, modulesValues, placement, mode, direction, assumptions }) {
  const errors = [];
  modulesValues.forEach((values, index) => {
    const position = placement[index];
    const parameters = voiceSetCabinetParameters(values, position);
    if (values.material !== "ldsp" || !values.name || !values.type || !position ||
        !validCabinet(parameters) ||
        !validCabinetPlacement({ x: position.x, y: values.y, z: position.z, rotationY: 0 }) ||
        !Number.isFinite(values.y)) {
      errors.push(`Модуль ${index + 1}${values.name ? ` («${values.name}»)` : ""}: параметры или положение не проходят проверку FURNIX.`);
    }
  });
  if (modulesValues.length < 2) errors.push("Комплект должен содержать хотя бы два модуля.");
  if (errors.length) return { errors, cabinets: [] };
  const confirmedAt = new Date().toISOString();
  const cabinets = modulesValues.map((values, index) => {
    const module = draft.modules[index];
    const position = placement[index];
    const ledger = structuredClone(module.parameters);
    for (const parameter of Object.values(ledger)) {
      if (parameter.status === "recognized") parameter.status = "confirmed";
    }
    const product = newCabinet(voiceSetCabinetParameters(values, position), position.x, position.z);
    product.y = values.y;
    product.sourceInfo = {
      kind: "voice-input",
      name: "Описание голосом — комплект",
      transcript: draft.sourceText.slice(0, 2000),
      confirmedAt,
      parsedParameters: structuredClone(module.parsed),
      confirmedParameters: structuredClone({ ...values, x: position.x, z: position.z }),
      voiceParameterSchemaVersion: 1,
      voiceParameters: ledger,
      changedFields: voiceSetLedgerFields.filter((field) => !sameVoiceValue(module.parsed[field], values[field])),
      recognizedHardware: (values.hardware || "").slice(0, 300),
      hardwareModeled: false,
      voiceSet: {
        schemaVersion: 1,
        setId: draft.setId,
        moduleIndex: values.order,
        moduleCount: modulesValues.length,
        orderDirection: mode === "manual" ? "manual" : direction,
        moduleSourceText: module.sourceText.slice(0, 500),
        notes: voiceSetModuleNotes(module, values).slice(0, 20).map((note) => note.slice(0, 300)),
        assumptions: assumptions.slice(0, 20).map((note) => note.slice(0, 300)),
        placement: { mode, x: position.x, y: values.y, z: position.z, yAssumed: !module.yEdited },
      },
    };
    return product;
  });
  return { errors, cabinets };
}

function updateVoiceSetStatus() {
  if (!voiceSetDraft) return null;
  const draft = voiceSetDraft;
  const mode = byId("voice-set-placement").value;
  const direction = byId("voice-set-direction").value;
  const modulesValues = draft.modules.map((_, index) => voiceSetModuleValues(index));
  draft.modules.forEach((module, index) => {
    for (const field of voiceSetLedgerFields) {
      const parameter = module.parameters[field];
      parameter.finalValue = normalizedVoiceValue(modulesValues[index][field]);
      if (!sameVoiceValue(parameter.finalValue, parameter.recognizedValue)) {
        parameter.status = "modified";
      } else if (parameter.status !== "confirmed") {
        parameter.status = parameter.finalValue === null && !["hardware", "purpose"].includes(field)
          ? "needs-clarification"
          : "recognized";
      }
    }
  });
  const placement = voiceSetPlacement(modulesValues, direction, mode);
  draft.modules.forEach((module, index) => {
    for (const axis of ["x", "z"]) {
      const control = voiceSetControlFor(index, axis);
      if (!control) continue;
      control.readOnly = mode === "row";
      if (mode === "row") control.value = placement[index] ? String(placement[index][axis]) : "";
    }
    modulesValues[index].x = placement[index]?.x ?? null;
    modulesValues[index].z = placement[index]?.z ?? null;
    module.placementValues = { x: modulesValues[index].x, y: modulesValues[index].y, z: modulesValues[index].z };
  });

  const questions = [];
  if (byId("voice-transcript").value.trim() !== draft.sourceText) {
    questions.push("Текст изменён после разбора. Нажмите «Разобрать как комплект» повторно; ручные исправления сохранятся, если число модулей не изменится.");
  }
  if (draft.modules.length < 2 && !draft.issues.some((issue) => issue.code === "too-few")) {
    questions.push("Комплект должен содержать хотя бы два модуля. Для одного корпуса используйте «Разобрать текст».");
  }
  for (const issue of draft.issues) {
    if (issue.code === "count") {
      if (draft.declaredCount !== null && draft.declaredCount !== draft.modules.length) {
        questions.push(`В описании названо модулей: ${draft.declaredCount}, в черновике: ${draft.modules.length}. Исправьте текст или удалите/добавьте модули.`);
      }
      continue;
    }
    const targets = issue.module === null ? draft.modules.map((_, index) => index) : [issue.module];
    const resolved = !issue.permanent && issue.fields.length > 0 && targets.length > 0 &&
      targets.every((index) => issue.fields.every((field) => {
        const parameter = draft.modules[index]?.parameters[field];
        return parameter && parameter.status === "modified" && parameter.finalValue !== null;
      }));
    if (!resolved) questions.push(issue.module === null ? issue.message : `Модуль ${issue.module + 1}: ${issue.message}`);
  }
  if (mode === "row" && !direction) {
    questions.push(draft.direction.conflict
      ? "В описании названы оба направления — слева направо и справа налево. Выберите одно."
      : draft.direction.adjacencyOnly
        ? "«Рядом» или «в ряд» не задаёт направление. Выберите порядок размещения или задайте положение вручную."
        : "Порядок размещения не указан. Выберите направление или задайте положение вручную.");
  }
  const count = modulesValues.length;
  const orders = modulesValues.map((values) => values.order);
  if (orders.some((order) => !Number.isInteger(order) || order < 1 || order > count) || new Set(orders).size !== count) {
    questions.push(`Номера порядка модулей должны быть разными целыми числами от 1 до ${count}.`);
  }
  const required = [
    ["type", "тип"], ["name", "название"], ["width", "ширину"], ["height", "высоту"], ["depth", "глубину"],
    ["thickness", "толщину плиты"], ["material", "материал"], ["color", "декор/цвет"],
    ["shelves", "количество полок"], ["doors", "количество дверей"], ["drawers", "количество ящиков"],
    ["divider", "наличие перегородки"], ["back", "наличие задней стенки"], ["y", "высоту основания Y"],
    ...(mode === "manual" ? [["x", "положение X"], ["z", "положение Z"]] : []),
  ];
  modulesValues.forEach((values, index) => {
    const prefix = `Модуль ${index + 1}${values.name ? ` («${values.name}»)` : ""}`;
    const missing = required.filter(([field]) => values[field] === null || values[field] === "").map(([, label]) => label);
    if (missing.length) questions.push(`${prefix}: уточните ${missing.join(", ")}.`);
    if (values.material === "unsupported") questions.push(`${prefix}: материал не поддерживается моделью корпуса FURNIX; выберите ЛДСП или измените описание.`);
    const invalid = voiceSetModuleFields.filter((field) => {
      const control = voiceSetControlFor(index, field);
      return control && control.value !== "" && !control.validity.valid;
    });
    if (invalid.length) {
      questions.push(`${prefix}: проверьте диапазон или целое значение — ${invalid.map((field) => voiceSetInputs[field].label).join(", ")}.`);
    }
    if (!missing.length && !invalid.length && values.material === "ldsp" &&
        !validCabinet(voiceSetCabinetParameters(values, placement[index] || { x: 0, z: 0 }))) {
      questions.push(`${prefix}: корпус не проходит проверку параметров FURNIX (например, ширина и высота должны быть больше трёх толщин плиты).`);
    }
  });
  const unitsMissing = draft.modules.some((module) => module.unitsMissing);
  byId("voice-set-units-confirm-label").hidden = !unitsMissing;
  if (unitsMissing && !byId("voice-set-units-confirm").checked) {
    questions.push("Часть размеров была без единиц. Проверьте числа и подтвердите, что они указаны в миллиметрах.");
  }
  const hasNotes = modulesValues.some((values) => values.purpose || values.hardware);
  byId("voice-set-notes-confirm-label").hidden = !hasNotes;
  if (hasNotes && !byId("voice-set-notes-confirm").checked) {
    questions.push("Подтвердите, что назначения модулей и фурнитура останутся заметками: конструкция под мойку, технику или фурнитуру не создаётся.");
  }

  const existingCabinets = products.filter((item) => item.type === "cabinet");
  const assumptions = [];
  if (draft.usedTriple) assumptions.push("Тройка «A на B на C» прочитана как ширина × высота × глубина.");
  if (draft.sharedTripleUnit) assumptions.push("Единица после последнего числа тройки отнесена ко всем трём размерам этой тройки.");
  for (const correction of draft.corrections) assumptions.push(`Учтено исправление «${correction}»: использовано второе значение.`);
  if (mode === "row") {
    assumptions.push("Модули стоят вплотную, без зазора, в порядке номеров; задние стенки на одной линии; фасады обращены в +Z проекта; поворот не применяется.");
    assumptions.push(existingCabinets.length
      ? "Ряд начинается в 100 мм правее существующих корпусов проекта."
      : "Ряд центрирован относительно X = 0.");
  } else {
    assumptions.push("Положение X/Z каждого модуля задано вручную; поворот не применяется.");
  }
  const onFloor = draft.modules
    .map((module, index) => (!module.yEdited && modulesValues[index].y === 0 ? index + 1 : null))
    .filter(Boolean);
  if (onFloor.length) assumptions.push(`Модули ${onFloor.join(", ")} стоят на полу (Y = 0) — это допущение, его можно изменить.`);
  assumptions.push("Назначение и фурнитура сохраняются как заметки и не меняют конструкцию.");
  byId("voice-set-assumptions").textContent = `Допущения черновика:\n• ${assumptions.join("\n• ")}`;

  const previewModules = modulesValues
    .map((values, index) => ({ values, index }))
    .filter(({ values }) => [values.width, values.height, values.depth, values.x, values.y, values.z].every(Number.isFinite));
  const asCabinet = ({ values }) => ({
    x: values.x, y: values.y, z: values.z, rotationY: 0,
    parameters: { width: values.width, height: values.height, depth: values.depth },
  });
  const warnings = [];
  for (let left = 0; left < previewModules.length; left++) {
    const a = previewModules[left];
    if (a.values.y < 0) warnings.push(`Модуль ${a.index + 1} ниже уровня пола.`);
    for (let right = left + 1; right < previewModules.length; right++) {
      if (cabinetModulesOverlap(asCabinet(a), asCabinet(previewModules[right]))) {
        warnings.push(`Модули ${a.index + 1} и ${previewModules[right].index + 1} пересекаются.`);
      }
    }
    for (const existing of existingCabinets) {
      if (cabinetModulesOverlap(asCabinet(a), existing)) warnings.push(`Модуль ${a.index + 1} пересекается с корпусом «${existing.name}».`);
    }
  }
  const lines = previewModules
    .sort((left, right) => left.values.x - right.values.x)
    .map(({ values, index }) => `Модуль ${index + 1} «${values.name || "без названия"}»: X ${values.x - values.width / 2}…${values.x + values.width / 2}, Z ${values.z - values.depth / 2}…${values.z + values.depth / 2}, Y ${values.y}…${values.y + values.height} мм`);
  byId("voice-set-preview").textContent = lines.length
    ? `Предварительное размещение (слева направо по оси X):\n${lines.join("\n")}${warnings.length ? `\nПредварительная проверка: ${warnings.join(" ")}` : "\nПредварительная проверка пересечений и пола замечаний не нашла."}`
    : "Предварительное размещение появится после заполнения размеров, порядка и положения модулей.";
  voiceSetPreviewBoxes = previewModules.map(({ values }) => ({
    center: [values.x, values.y + values.height / 2, values.z],
    size: [values.width, values.height, values.depth],
  }));
  renderModel();

  byId("voice-set-questions").textContent = questions.length
    ? `Нужно уточнить перед созданием комплекта:\n• ${questions.join("\n• ")}`
    : "Все модули заполнены. Проверьте предварительное размещение и подтвердите создание комплекта.";
  byId("voice-set-questions").className = questions.length ? "error" : "note";
  byId("voice-set-confirm").disabled = questions.length > 0;
  byId("voice-set-provenance").textContent = draft.modules
    .map((module, index) => `Модуль ${index + 1}:\n${formatVoiceParameterProvenance(module.parameters, voiceSetFieldLabels)}`)
    .join("\n\n");
  return { modulesValues, placement, mode, direction, assumptions, blocked: questions.length > 0 };
}

function confirmVoiceSetDraft() {
  if (!voiceSetDraft) return;
  const state = updateVoiceSetStatus();
  if (!state || state.blocked) return;
  const built = buildVoiceSetCabinets({ draft: voiceSetDraft, ...state });
  if (built.errors.length) {
    setVoiceStatus(`Комплект не создан, проект не изменён:\n${built.errors.join("\n")}`, true);
    return;
  }
  voiceSetPreviewBoxes = [];
  try {
    products.push(...built.cabinets);
    selectItem(built.cabinets[0].id);
    frameAssembly();
  } catch (error) {
    for (const cabinet of built.cabinets) {
      const at = products.indexOf(cabinet);
      if (at >= 0) products.splice(at, 1);
    }
    selected = { productId: products[0]?.id || null, partId: null, connectionId: null, hardwareComponentId: null };
    renderTree();
    renderModel();
    setVoiceStatus(`Комплект не создан: ${error.message}. Проект возвращён к прежнему составу.`, true);
    return;
  }
  const notes = built.cabinets
    .map((cabinet) => cabinet.sourceInfo.voiceSet.notes.length
      ? `${cabinet.name}: ${cabinet.sourceInfo.voiceSet.notes.join("; ")}`
      : null)
    .filter(Boolean);
  const hardware = built.cabinets.map((cabinet) => cabinet.sourceInfo.recognizedHardware).filter(Boolean);
  setVoiceStatus(`Создан комплект из ${built.cabinets.length} отдельных корпусов: ${built.cabinets.map((cabinet) => `«${cabinet.name}»`).join(", ")}. Их можно редактировать и перемещать в панели «Мебельный комплект».
${notes.length ? `Заметки (в модель не добавлены): ${notes.join(" | ")}.` : "Заметок о назначении нет."}
${hardware.length ? `Фурнитура (${[...new Set(hardware)].join(", ")}) сохранена как заметка и не добавлена в модель.` : "Фурнитура не была добавлена."}
Проверки размещения предварительные; это не подтверждение готовности к производству. Сохраните проект, чтобы записать комплект в JSON и историю.`);
  byId("voice-set-confirm").disabled = true;
  byId("voice-set-questions").className = "note";
  byId("voice-set-questions").textContent = "Комплект создан. Для нового комплекта разберите текст повторно.";
  voiceSetDraft = null;
  byId("voice-set-draft").hidden = true;
}

function clearVoiceSetDraft() {
  voiceSetDraft = null;
  byId("voice-set-draft").hidden = true;
  byId("voice-set-units-confirm").checked = false;
  byId("voice-set-notes-confirm").checked = false;
  if (voiceSetPreviewBoxes.length) {
    voiceSetPreviewBoxes = [];
    renderModel();
  }
}

byId("voice-parse-set").addEventListener("click", () => {
  try {
    const transcript = byId("voice-transcript").value;
    renderVoiceSetParse(parseVoiceSetDescription(transcript), transcript);
  } catch (error) {
    updateVoiceSetStatus();
    setVoiceStatus(error.message, true);
  }
});
byId("voice-set-draft").addEventListener("input", (event) => {
  const field = event.target.dataset?.voiceSetField;
  const moduleKey = event.target.dataset?.voiceSetModule;
  if (field === "y" && moduleKey !== "common" && voiceSetDraft?.modules[Number(moduleKey)]) {
    voiceSetDraft.modules[Number(moduleKey)].yEdited = true;
  }
  if (moduleKey !== "common") updateVoiceSetStatus();
});
byId("voice-set-draft").addEventListener("change", (event) => {
  if (event.target.dataset?.voiceSetModule !== "common") updateVoiceSetStatus();
});
byId("voice-set-draft").addEventListener("click", (event) => {
  const remove = event.target.closest("[data-voice-set-remove]");
  if (!remove || !voiceSetDraft) return;
  updateVoiceSetStatus();
  const index = Number(remove.dataset.voiceSetRemove);
  voiceSetDraft.modules.splice(index, 1);
  voiceSetDraft.issues = voiceSetDraft.issues
    .filter((issue) => issue.module !== index)
    .map((issue) => issue.module !== null && issue.module > index ? { ...issue, module: issue.module - 1 } : issue);
  renderVoiceSetModules();
  updateVoiceSetStatus();
});
byId("voice-set-add-module").addEventListener("click", () => {
  if (!voiceSetDraft || voiceSetDraft.modules.length >= 12) return;
  updateVoiceSetStatus();
  const parsed = Object.fromEntries(voiceSetLedgerFields.map((field) => [field, null]));
  voiceSetDraft.modules.push({
    sourceText: "",
    parsed,
    evidence: {},
    notes: [],
    unitsMissing: false,
    parameters: voiceSetLedger(parsed, {}),
    placementValues: { x: null, y: null, z: null },
    yEdited: false,
  });
  renderVoiceSetModules();
  updateVoiceSetStatus();
});
byId("voice-set-fill").addEventListener("click", () => {
  if (!voiceSetDraft) return;
  for (const field of voiceSetCommonFields) {
    const value = voiceSetControlFor("common", field)?.value ?? "";
    if (value === "") continue;
    voiceSetDraft.modules.forEach((_, index) => {
      const control = voiceSetControlFor(index, field);
      if (control && control.value === "") control.value = value;
    });
  }
  updateVoiceSetStatus();
});
byId("voice-set-confirm").addEventListener("click", confirmVoiceSetDraft);

byId("voice-speech-consent").addEventListener("change", configureVoiceRecognition);
byId("voice-record").addEventListener("click", recordVoiceDescription);
byId("voice-stop").addEventListener("click", () => {
  const recognition = voiceRecognition;
  if (!recognition) return;
  byId("voice-stop").disabled = true;
  try {
    recognition.stop();
    setVoiceStatus("Останавливаю запись…");
  } catch (error) {
    setVoiceStatus(`Не удалось остановить запись: ${error.message}. Текст можно проверить и исправить вручную.`, true);
  }
  // Chrome sometimes never sends "end" after stop() (its speech service hangs); without this the
  // buttons stay locked. Finish by hand: the text received so far is parsed as usual.
  setTimeout(() => {
    if (voiceRecognition !== recognition) return;
    try { recognition.abort(); } catch { /* already finished */ }
    voiceFinish?.(true);
  }, 4000);
});
byId("voice-clear").addEventListener("click", () => {
  if (voiceRecognition) {
    try {
      voiceRecognition.abort();
    } catch (error) {
      setVoiceStatus(`Не удалось прервать запись: ${error.message}`, true);
    }
    voiceRecognition = null;
    voiceFinish = null;
  }
  setVoiceTranscript("");
  byId("voice-draft-fields").hidden = true;
  clearVoiceSetDraft();
  byId("voice-units-confirm").checked = false;
  byId("voice-hardware-confirm").checked = false;
  byId("voice-stop").disabled = true;
  configureVoiceRecognition();
});
byId("voice-transcript").addEventListener("input", () => {
  updateVoiceDraftStatus();
  updateVoiceSetStatus();
  setVoiceStatus("Текст изменён. Разберите его повторно перед созданием модели.");
});
byId("voice-parse").addEventListener("click", () => {
  try {
    const transcript = byId("voice-transcript").value;
    if (!transcript.trim()) {
      setVoiceStatus("Поле «Распознанный текст или ручной ввод» пустое — разбирать нечего. Запишите фразу или введите текст вручную.", true);
      byId("voice-transcript").focus();
      return;
    }
    clearVoiceSetDraft();
    renderVoiceParse(parseVoiceDescription(transcript), transcript);
  } catch (error) {
    updateVoiceDraftStatus();
    setVoiceStatus(error.message, true);
  }
});
byId("voice-draft-fields").addEventListener("input", updateVoiceDraftStatus);
byId("voice-draft-fields").addEventListener("change", updateVoiceDraftStatus);
byId("voice-confirm").addEventListener("click", confirmVoiceDraft);
configureVoiceRecognition();

byId("assembly-add").addEventListener("click", () => addCabinet({
  ...readForm(),
  name: `Изделие ${products.filter((item) => item.type === "cabinet").length + 1}`,
}));
byId("source-tab-library").addEventListener("click", () => setInputSourceTab("library"));
byId("source-tab-external").addEventListener("click", () => setInputSourceTab("external"));
byId("source-panel-library").addEventListener("click", (event) => {
  const presetButton = event.target.closest("[data-builtin-module]");
  const templateButton = event.target.closest("[data-use-template]");
  const deleteButton = event.target.closest("[data-delete-template]");
  if (presetButton) {
    const parameters = modulePreset(presetButton.dataset.builtinModule);
    if (parameters) addCabinet(parameters, { kind: "builtin-library", name: parameters.name });
    return;
  }
  if (templateButton) {
    try {
      const templates = JSON.parse(localStorage.getItem(libraryStorageKey) || "[]");
      const template = templates.find((item) => item.id === templateButton.dataset.useTemplate);
      if (!template || !validCabinet(template.parameters)) {
        throw new Error("Шаблон не найден или содержит недопустимые параметры.");
      }
      addCabinet(
        { ...structuredClone(template.parameters), name: template.name },
        { kind: "personal-library", name: template.name },
      );
    } catch (error) {
      setPersonalLibraryStatus(error.message || "Не удалось открыть шаблон.", true);
    }
    return;
  }
  if (deleteButton) {
    try {
      const templates = JSON.parse(localStorage.getItem(libraryStorageKey) || "[]");
      const remaining = templates.filter((item) => item.id !== deleteButton.dataset.deleteTemplate);
      localStorage.setItem(libraryStorageKey, JSON.stringify(remaining));
      renderPersonalLibrary();
    } catch (error) {
      setPersonalLibraryStatus(error.message || "Не удалось удалить шаблон.", true);
    }
  }
});
byId("library-template-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const product = selectedProduct();
  const name = String(new FormData(event.currentTarget).get("name") || "").trim().slice(0, 80);
  if (!product || product.type !== "cabinet") {
    setPersonalLibraryStatus("Выберите корпус в дереве проекта, прежде чем сохранять шаблон.", true);
    return;
  }
  if (!name) {
    setPersonalLibraryStatus("Введите название шаблона.", true);
    return;
  }
  try {
    const stored = localStorage.getItem(libraryStorageKey);
    const templates = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(templates) || templates.length >= 50) {
      throw new Error("Личная библиотека заполнена или повреждена (максимум 50 шаблонов).");
    }
    if (templates.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error("Шаблон с таким названием уже есть в личной библиотеке.");
    }
    const parameters = { ...structuredClone(product.parameters), name, x: 0, z: 0 };
    if (!validCabinet(parameters)) throw new Error("Параметры выбранного корпуса недопустимы.");
    templates.push({ id: `template-${Date.now()}-${++serial}`, name, parameters });
    localStorage.setItem(libraryStorageKey, JSON.stringify(templates));
    event.currentTarget.reset();
    renderPersonalLibrary();
  } catch (error) {
    setPersonalLibraryStatus(error.message || "Не удалось сохранить шаблон в браузере.", true);
  }
});
byId("external-csv-file").addEventListener("change", async (event) => {
  pendingExternalCsv = null;
  byId("external-csv-import").disabled = true;
  const file = event.currentTarget.files?.[0];
  if (!file) {
    externalCsvFile = null;
    byId("external-csv-status").textContent = "Импортированные размеры станут параметрами FURNIX; 3D-форма корпуса будет построена по правилам конструктора.";
    byId("external-csv-status").className = "note";
    return;
  }
  try {
    if (file.size > 1024 * 1024) throw new Error("CSV-файл должен быть не больше 1 МБ.");
    externalCsvFile = { name: file.name, text: await file.text() };
    prepareExternalCsv();
  } catch (error) {
    externalCsvFile = null;
    byId("external-csv-status").textContent = `Не удалось прочитать файл: ${error.message}`;
    byId("external-csv-status").className = "error";
  }
});
byId("external-csv-unit").addEventListener("change", prepareExternalCsv);
byId("external-source-reference").addEventListener("input", prepareExternalCsv);
byId("external-source-rights").addEventListener("change", prepareExternalCsv);
byId("external-csv-sample").addEventListener("click", () => {
  downloadFile(
    "furnix-external-modules-template.csv",
    "\ufeffname,width,height,depth,thickness,shelves,divider,back,color,doors,drawers\r\n" +
      "Нижний корпус,600,720,560,18,1,нет,да,white,0,2\r\n" +
      "Верхний корпус,600,720,320,18,2,нет,да,white,2,0\r\n",
    "text/csv;charset=utf-8",
  );
});
byId("external-csv-import").addEventListener("click", () => {
  const sourceReference = byId("external-source-reference").value.trim();
  if (!pendingExternalCsv?.length || !externalCsvFile || !sourceReference ||
      !byId("external-source-rights").checked) {
    byId("external-csv-status").textContent = "Проверьте CSV, укажите внешний источник и подтвердите право использования данных.";
    byId("external-csv-status").className = "error";
    byId("external-csv-import").disabled = true;
    return;
  }
  const sourceInfo = {
    kind: "external-csv",
    name: externalCsvFile.name.slice(0, 160),
    reference: sourceReference.slice(0, 240),
    importedAt: new Date().toISOString(),
    unit: byId("external-csv-unit").value,
  };
  const importedCount = pendingExternalCsv.length;
  for (const parameters of pendingExternalCsv) {
    const product = addCabinet(parameters, sourceInfo);
    if (!product) {
      byId("external-csv-status").textContent = "Импорт прерван: один из корпусов не прошёл проверку параметров.";
      byId("external-csv-status").className = "error";
      return;
    }
  }
  byId("external-csv-status").textContent =
    `Добавлено изделий: ${importedCount}. Источник «${sourceInfo.reference}», файл «${sourceInfo.name}» сохранены в свойствах и JSON проекта. Геометрия построена по параметрам FURNIX, а не перенесена из исходной 3D-модели.`;
  byId("external-csv-status").className = "note";
  byId("external-csv-import").disabled = true;
  pendingExternalCsv = null;
  externalCsvFile = null;
  byId("external-csv-file").value = "";
  byId("external-source-rights").checked = false;
});
renderPersonalLibrary();
mountTechTemplates(byId("tech-template-list"), {validate:validCabinet,add:addCabinet});
byId("assembly-add-panel").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") {
    displayGeometryIssues(["Выберите корпусное изделие, чтобы добавить в него деталь."]);
    return;
  }
  const part = newPanel(product.id);
  product.customParts.push(part);
  selectItem(product.id, part.id);
});
byId("assembly-duplicate").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product) return;
  if (selected.hardwareComponentId) {
    const component = product.hardwareComponents?.find((item) => item.id === selected.hardwareComponentId);
    if (!component) return;
    const copy = { ...structuredClone(component), id: `hardware-${++serial}`, model: `${component.model} · копия` };
    product.hardwareComponents.push(copy);
    selectItem(product.id, null, null, copy.id);
    return;
  }
  if (selected.connectionId) {
    const connection = product.connections?.find((item) => item.id === selected.connectionId);
    if (!connection) return;
    const copy = {
      ...connection,
      id: `connection-${++serial}`,
      name: `${connection.name} · копия`,
      componentIds: [],
    };
    const sourceComponents = (product.hardwareComponents || [])
      .filter((component) => connection.componentIds?.includes(component.id));
    for (const component of sourceComponents) {
      const id = `hardware-${++serial}`;
      copy.componentIds.push(id);
      product.hardwareComponents.push({
        ...structuredClone(component),
        id,
        installationPoint: {
          ...component.installationPoint,
          partAId: copy.partA,
          partBId: copy.partB,
        },
      });
    }
    product.connections.push(copy);
    selectItem(product.id, null, copy.id);
    return;
  }
  if (selected.partId) {
    const chosen = selectedGeneratedOrCustom();
    if (!chosen?.value) return;
    const copy = chosen.kind === "custom"
      ? { ...chosen.value, id: `detail-${++serial}`, name: `${chosen.value.name} копия`, x: chosen.value.x + 40 }
      : (() => {
          const box = partBox(chosen.value, product);
          return {
            id: `detail-${++serial}`,
            name: `${chosen.value.name} копия`,
            length: box.size[0],
            width: box.size[2],
            thickness: box.size[1],
            x: box.center[0] - product.x,
            y: box.center[1],
            z: box.center[2] - product.z,
          };
        })();
    product.customParts.push({
      id: copy.id,
      name: copy.name,
      length: copy.length,
      width: copy.width,
      thickness: copy.thickness,
      x: copy.x,
      y: copy.y,
      z: copy.z,
      material: product.parameters.color,
    });
    selectItem(product.id, copy.id);
    return;
  }
  if (product.type !== "cabinet") return;
  const footprint = cabinetFootprint(product);
  const offset = nextPlacement(footprint.width, footprint.depth);
  const clone = newCabinet({ ...product.parameters, name: `${product.name} копия` }, offset.x, offset.z);
  clone.y = product.y || 0;
  clone.rotationY = product.rotationY || 0;
  clone.overrides = structuredClone(product.overrides);
  const copiedDetailIds = new Map();
  clone.customParts = product.customParts.map((part) => {
    const id = `detail-${++serial}`;
    copiedDetailIds.set(part.id, id);
    return { ...part, id };
  });
  const copiedComponentIds = new Map();
  clone.hardwareComponents = (product.hardwareComponents || []).map((component) => {
    const id = `hardware-${++serial}`;
    copiedComponentIds.set(component.id, id);
    return {
      ...structuredClone(component),
      id,
      installationPoint: {
        ...component.installationPoint,
        partId: copiedDetailIds.get(component.installationPoint?.partId) || component.installationPoint?.partId,
        partAId: copiedDetailIds.get(component.installationPoint?.partAId) || component.installationPoint?.partAId,
        partBId: copiedDetailIds.get(component.installationPoint?.partBId) || component.installationPoint?.partBId,
      },
    };
  });
  clone.connections = (product.connections || []).map((connection) => ({
    ...connection,
    id: `connection-${++serial}`,
    partA: copiedDetailIds.get(connection.partA) || connection.partA,
    partB: copiedDetailIds.get(connection.partB) || connection.partB,
    componentIds: (connection.componentIds || []).map((id) => copiedComponentIds.get(id)).filter(Boolean),
  }));
  products.push(clone);
  selectItem(clone.id);
  frameAssembly();
});
byId("assembly-delete").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product) return;
  if (jointDraft || hardwareDraft) {
    jointDraft = false;
    hardwareDraft = false;
    selectItem(product.id);
    return;
  }
  if (selected.partId && product.type === "cabinet") {
    const customIndex = product.customParts.findIndex((part) => part.id === selected.partId);
    if (customIndex >= 0) {
      product.customParts.splice(customIndex, 1);
      product.connections = (product.connections || []).filter((connection) =>
        connection.partA !== selected.partId && connection.partB !== selected.partId);
      product.hardwareComponents = (product.hardwareComponents || []).filter((component) =>
        component.installationPoint?.partId !== selected.partId &&
        component.installationPoint?.partAId !== selected.partId &&
        component.installationPoint?.partBId !== selected.partId);
    }
    else delete product.overrides[selected.partId];
    selected.partId = null;
  } else if (selected.hardwareComponentId) {
    product.hardwareComponents = (product.hardwareComponents || [])
      .filter((component) => component.id !== selected.hardwareComponentId);
    selected.hardwareComponentId = null;
  } else if (selected.connectionId) {
    const connection = product.connections.find((item) => item.id === selected.connectionId);
    const removedComponentIds = new Set(connection?.componentIds || []);
    product.hardwareComponents = (product.hardwareComponents || [])
      .filter((component) => !removedComponentIds.has(component.id));
    product.connections = (product.connections || []).filter((connection) => connection.id !== selected.connectionId);
    selected.connectionId = null;
  } else {
    if (products.length === 1) {
      displayGeometryIssues(["В проекте должно остаться хотя бы одно изделие."]);
      return;
    }
    products.splice(products.indexOf(product), 1);
    selected = { productId: products[0].id, partId: null, connectionId: null, hardwareComponentId: null };
  }
  selectItem(selected.productId);
});

byId("furniture-set-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const move = button.dataset.setMove;
  if (move) {
    const offsets = {
      left: [-100, 0],
      right: [100, 0],
      front: [0, 100],
      back: [0, -100],
    };
    const [dx, dz] = offsets[move];
    updateSelectedCabinet((product) => {
      product.x += dx;
      product.z += dz;
    });
  } else if (button.hasAttribute("data-set-floor")) {
    updateSelectedCabinet((product) => { product.y = 0; });
  } else if (button.hasAttribute("data-set-rotate")) {
    updateSelectedCabinet((product) => {
      product.rotationY = ((product.rotationY || 0) + 90) % 360;
    });
  } else if (button.hasAttribute("data-set-duplicate")) {
    const product = selectedProduct();
    if (!product || product.type !== "cabinet") {
      byId("furniture-set-warnings").className = "error";
      byId("furniture-set-warnings").textContent = "Выберите корпус, который нужно дублировать.";
      return;
    }
    selectItem(product.id);
    byId("assembly-duplicate").click();
  } else if (button.hasAttribute("data-set-delete")) {
    const product = selectedProduct();
    if (!product || product.type !== "cabinet") {
      byId("furniture-set-warnings").className = "error";
      byId("furniture-set-warnings").textContent = "Выберите корпус, который нужно удалить.";
      return;
    }
    selectItem(product.id);
    byId("assembly-delete").click();
  } else if (button.hasAttribute("data-set-spec-export")) {
    byId("assembly-spec-csv").click();
  }
});

byId("update").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product || product.type !== "cabinet") return;
  const parameters = readForm();
  if (!validCabinet(parameters)) {
    byId("errors").textContent = "Модель не обновлена: проверьте параметры. Ширина и высота 300–3000 мм, глубина 200–1200 мм, толщина 10–40 мм, полок 0–12, ящиков 0–4, дверей 0–2.";
    return;
  }
  byId("errors").textContent = "";
  product.name = parameters.name;
  product.parameters = {
    ...parameters,
    x: product.x,
    z: product.z,
    ...(product.parameters.layout ? { layout: product.parameters.layout } : {}),
  };
  syncInputs(product);
  renderTree();
  buildEditor();
  renderModel();
});

function downloadFile(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolveImportedPartId(product, detailIds, id) {
  if (typeof id !== "string") return id;
  const cleanedId = id.trim();
  const mappedId = detailIds.get(cleanedId);
  if (mappedId) return mappedId;
  const parts = [...generatedParts(product), ...product.customParts];
  if (parts.some((part) => part.id === cleanedId)) return cleanedId;
  if (cleanedId.startsWith("part-")) {
    try {
      const decodedName = decodeURIComponent(cleanedId.slice(5));
      const matchingPart = parts.find((part) => part.name === decodedName);
      if (matchingPart) return matchingPart.id;
    } catch (error) {
      if (!(error instanceof URIError)) throw error;
    }
  }
  return cleanedId;
}

byId("save").onclick = () => {
  try {
    const resources = readResourceForm();
    const collision = readCollisionForm();
    projectResources.cutSettings = resources.cutSettings;
    projectResources.materials = resources.materials;
    projectResources.remnants = resources.remnants;
    projectResources.collisionSettings = collision.collisionSettings;
    projectResources.environmentZones = collision.environmentZones;
    projectResources.revision++;
    const snapshot = projectSnapshot();
    projectResources.history.push({
      revision: projectResources.revision,
      savedAt: new Date().toISOString(),
      ...snapshot,
    });
    projectResources.history = projectResources.history.slice(-10);
    updateRevisionOptions();
    downloadFile("furnix-project.json", JSON.stringify({
      format: "furnix.project",
      version: 4,
      projectId: projectResources.id,
      revision: projectResources.revision,
      history: projectResources.history,
      resources: {
        cutSettings: projectResources.cutSettings,
        collisionSettings: projectResources.collisionSettings,
        environmentZones: projectResources.environmentZones,
        assemblyPlan: projectResources.assemblyPlan,
        materials: projectResources.materials,
        remnants: projectResources.remnants,
        supplierProfile: projectResources.supplierProfile,
        liftCalculations: projectResources.liftCalculations,
        liftSpecificationItems: projectResources.liftSpecificationItems,
        estimates: projectResources.estimates,
      },
      activeProductId: selected.productId,
      activeConnectionId: selected.connectionId,
      settings: snapshot.settings,
      products,
    }, null, 2), "application/json");
    byId("resource-status").textContent = `Проект сохранён как редакция ${projectResources.revision}. В историю включён полный снимок состава и настроек.`;
  } catch (error) {
    byId("resource-status").textContent = error.message;
    byId("resource-status").className = "error";
  }
};
byId("load").onclick = () => byId("file").click();
byId("file").onchange = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    let imported;
    const importedIds = new Map();
    const importedPartIds = new Map();
    const importedConnectionIds = new Map();
    if (data.format !== "furnix.project") throw new Error("Неизвестный формат проекта.");
    if ([2, 3, 4].includes(data.version) && Array.isArray(data.products) && data.products.length) {
      if (data.settings !== undefined && (
        !["2800x2070", "2750x1830", "2440x1220"].includes(data.settings.sheet) ||
        !Number.isFinite(data.settings.kerf) || data.settings.kerf < 0 || data.settings.kerf > 12 ||
        ![0.4, 2].includes(data.settings.edgeThickness)
      )) throw new Error("Параметры листа или пропила недопустимы.");
      const historyRevisions = Array.isArray(data.history)
        ? data.history.map((revision) => revision?.revision)
        : [];
      if (data.version === 4 && (!validResourceBundle(data.resources) ||
          !Array.isArray(data.history) || data.history.length > 10 ||
          !Number.isInteger(data.revision) || data.revision < 0 ||
          new Set(historyRevisions).size !== historyRevisions.length ||
          historyRevisions.some((revision) => !Number.isInteger(revision) || revision <= 0 || revision > data.revision) ||
          !data.history.every((revision) => Number.isInteger(revision.revision) &&
            revision.revision > 0 && typeof revision.savedAt === "string" &&
            validVersionSnapshot(revision)))) {
        throw new Error("История редакций или каталог ресурсов повреждены.");
      }
      imported = data.products.map((item) => {
        const x = Number(item?.x);
        const z = Number(item?.z);
        const y = item?.y === undefined ? 0 : Number(item.y);
        const rotationY = item?.rotationY === undefined ? 0 : Number(item.rotationY);
        const parameters = item?.parameters && { ...item.parameters, x, z };
        if (item?.type === "cabinet" && parameters && validCabinet(parameters) &&
            validCabinetPlacement({ x, y, z, rotationY })) {
          if (!validSourceInfo(item.sourceInfo)) {
            throw new Error("В проекте повреждены сведения об источнике изделия.");
          }
          if (item.customParts !== undefined &&
              (!Array.isArray(item.customParts) || !item.customParts.every(validPart))) {
            throw new Error("В проекте есть деталь с недопустимыми свойствами.");
          }
          const overrides = {};
          if (item.overrides !== undefined) {
            if (!item.overrides || typeof item.overrides !== "object" || Array.isArray(item.overrides)) {
              throw new Error("В проекте повреждены правки базовых деталей.");
            }
            for (const [partId, value] of Object.entries(item.overrides)) {
              if (!partId.startsWith("part-") || !validPart(value)) {
                throw new Error("В проекте есть правка детали с недопустимыми свойствами.");
              }
              overrides[partId] = {
                name: value.name.trim().slice(0, 80),
                length: value.length,
                width: value.width,
                thickness: value.thickness,
                x: value.x,
                y: value.y,
                z: value.z,
              };
            }
          }
          const detailIds = new Map();
          const customParts = (item.customParts || []).map((part) => {
            const id = `detail-${++serial}`;
            detailIds.set(part.id, id);
            return {
              id,
              name: part.name.trim().slice(0, 80),
              length: part.length,
              width: part.width,
              thickness: part.thickness,
              x: part.x,
              y: part.y,
              z: part.z,
              material: typeof part.material === "string" && materialCodePattern.test(part.material) && part.material !== "hdf"
                ? part.material : parameters.color,
            };
          });
          const id = `product-${++serial}`;
          importedIds.set(item.id, id);
          const importedProduct = {
            id,
            type: "cabinet",
            name: String(item.name || "Изделие").slice(0, 80),
            x,
            z,
            y,
            rotationY,
            parameters,
            overrides,
            customParts,
            connections: [],
            hardwareComponents: [],
            ...(item.sourceInfo ? { sourceInfo: structuredClone(item.sourceInfo) } : {}),
          };
          const partIdMap = new Map();
          importedPartIds.set(item.id, partIdMap);
          for (const sourcePart of [...generatedParts(item), ...(item.customParts || [])]) {
            const mappedId = detailIds.get(sourcePart.id) || sourcePart.id;
            const targetPart = findPartById(getProductParts(importedProduct), mappedId) ||
              getProductParts(importedProduct).find((part) => part.name === sourcePart.name);
            if (targetPart) partIdMap.set(sourcePart.id, targetPart.id);
          }
          const hardwareIds = new Map();
          if ([3, 4].includes(data.version)) {
            if (!Array.isArray(item.hardwareComponents) || item.hardwareComponents.length > 2000 ||
                !item.hardwareComponents.every(validHardwareComponent)) {
              throw new Error("Список компонентов крепежа повреждён или слишком велик.");
            }
            if (new Set(item.hardwareComponents.map((component) => component.id)).size !== item.hardwareComponents.length) {
              throw new Error("В проекте обнаружены повторяющиеся идентификаторы компонентов.");
            }
            importedProduct.hardwareComponents = item.hardwareComponents.map((component) => {
              const componentId = `hardware-${++serial}`;
              hardwareIds.set(component.id, componentId);
              return {
                ...structuredClone(component),
                id: componentId,
                installationPoint: {
                  ...component.installationPoint,
                  partId: resolveImportedPartId(importedProduct, detailIds, component.installationPoint.partId),
                  partAId: resolveImportedPartId(importedProduct, detailIds, component.installationPoint.partAId),
                  partBId: resolveImportedPartId(importedProduct, detailIds, component.installationPoint.partBId),
                },
              };
            });
          }
          if (item.connections !== undefined &&
              (!Array.isArray(item.connections) || item.connections.length > 200)) {
            throw new Error("Список соединений в проекте повреждён или слишком велик.");
          }
          importedProduct.connections = (item.connections || []).map((connection) => {
            const isLegacyConnection = data.version === 2 && connection?.type === "confirmat-6.4x50";
            if (!isLegacyConnection && (![3, 4].includes(data.version) || connection?.type !== "confirmat-joint")) {
              throw new Error("В проекте есть неподдерживаемый тип соединения.");
            }
            const candidate = {
              id: `connection-${++serial}`,
              name: "Конфирмат 6,4×50",
              type: "confirmat-joint",
              partA: resolveImportedPartId(importedProduct, detailIds, connection.partA),
              partB: resolveImportedPartId(importedProduct, detailIds, connection.partB),
              edgeInset: Number(connection.edgeInset),
              componentIds: isLegacyConnection
                ? []
                : Array.isArray(connection.componentIds)
                  ? connection.componentIds.map((componentId) => hardwareIds.get(componentId)).filter(Boolean)
                  : [],
            };
            if (isLegacyConnection) {
              const legacyCount = Number(connection.count);
              const validation = connectionPositions(importedProduct, { ...candidate, count: legacyCount });
              if (validation.error) throw new Error(`Невозможно восстановить соединение: ${validation.error}`);
              createConfirmatComponents(importedProduct, candidate, legacyCount, candidate.edgeInset);
            } else {
              if (!candidate.componentIds.length ||
                  candidate.componentIds.some((componentId) => {
                    const component = importedProduct.hardwareComponents.find((item) => item.id === componentId);
                    return !component || component.category !== "case-joint" || component.type !== "confirmat" ||
                      component.model !== "6.4x50" || component.dimensions.diameter !== 6.4 ||
                      component.dimensions.length !== 50 ||
                      component.installationPoint.kind !== "joint-edge" ||
                      component.installationPoint.partAId !== candidate.partA ||
                      component.installationPoint.partBId !== candidate.partB ||
                      component.installationPoint.distribution.count !== candidate.componentIds.length ||
                      component.installationPoint.edgeInset !== candidate.edgeInset;
                  })) {
                throw new Error("У соединения отсутствуют совместимые компоненты конфирмата.");
              }
              const indices = candidate.componentIds.map((componentId) =>
                importedProduct.hardwareComponents.find((item) => item.id === componentId)
                  .installationPoint.distribution.index);
              if (new Set(indices).size !== indices.length ||
                  indices.some((index) => index >= indices.length)) {
                throw new Error("У компонентов соединения повреждены точки установки.");
              }
            }
            const validation = connectionPositions(importedProduct, candidate);
            if (validation.error) throw new Error(`Невозможно восстановить соединение: ${validation.error}`);
            importedConnectionIds.set(connection.id, candidate.id);
            return candidate;
          });
          return importedProduct;
        }
        throw new Error("Проект содержит неподдерживаемый тип или недопустимые параметры изделия.");
      });
    } else if (data.version === 1 && data.parameters) {
      const p = { ...data.parameters, x: 0, z: 0 };
      if (!validCabinet(p)) throw new Error("Недопустимые параметры изделия.");
      imported = [newCabinet(p)];
      if (["2800x2070", "2750x1830", "2440x1220"].includes(data.parameters.sheet)) {
        byId("sheet").value = data.parameters.sheet;
      }
      if (Number.isFinite(data.parameters.kerf) && data.parameters.kerf >= 0 && data.parameters.kerf <= 12) {
        byId("kerf").value = data.parameters.kerf;
      }
      if ([0.4, 2].includes(data.parameters.edgeThickness)) {
        byId("edgeThickness").value = data.parameters.edgeThickness;
      }
    } else {
      throw new Error("Версия файла не поддерживается.");
    }
    products.splice(0, products.length, ...imported);
    if ([2, 3, 4].includes(data.version) && data.settings) {
      byId("sheet").value = data.settings.sheet;
      byId("kerf").value = data.settings.kerf;
      byId("edgeThickness").value = data.settings.edgeThickness;
    }
    if (data.version === 4) {
      projectResources = {
        id: typeof data.projectId === "string" && data.projectId ? data.projectId : `project-${Date.now()}`,
        revision: Number.isInteger(data.revision) && data.revision >= 0 ? data.revision : 0,
        history: structuredClone(data.history),
        cutSettings: structuredClone(data.resources.cutSettings),
        collisionSettings: structuredClone(data.resources.collisionSettings || defaultCollisionSettings()),
        environmentZones: structuredClone(data.resources.environmentZones || []),
        assemblyPlan: structuredClone(data.resources.assemblyPlan || defaultAssemblyPlan()),
        materials: structuredClone(data.resources.materials),
        remnants: structuredClone(data.resources.remnants),
        supplierProfile: structuredClone(data.resources.supplierProfile || defaultSupplierProfile()),
        estimates: structuredClone(data.resources.estimates || []),
        liftCalculations: structuredClone(data.resources.liftCalculations || []),
        liftSpecificationItems: structuredClone(data.resources.liftSpecificationItems || []),
      };
      projectResources.assemblyPlan.operations = projectResources.assemblyPlan.operations.map((operation) => ({
        ...operation,
        productId: importedIds.get(operation.productId) || operation.productId,
        targetPartId: importedPartIds.get(operation.productId)?.get(operation.targetPartId) || operation.targetPartId,
      }));
    } else {
      projectResources = {
        id: `project-${Date.now()}`,
        revision: 0,
        history: [],
        cutSettings: { trim: 10, minRemnant: 300, machineLength: 0, machineWidth: 0 },
        collisionSettings: defaultCollisionSettings(),
        environmentZones: [],
        assemblyPlan: defaultAssemblyPlan(),
        supplierProfile: defaultSupplierProfile(),
        estimates: [],
        liftCalculations: [],
        liftSpecificationItems: [],
        remnants: [],
        materials: defaultMaterialCatalog(),
      };
    }
    selected = {
      productId: importedIds.get(data.activeProductId) || products[0].id,
      partId: null,
      connectionId: importedConnectionIds.get(data.activeConnectionId) || null,
      hardwareComponentId: null,
    };
    cutPlanResult = [];
    cutPlanSignature = "";
    byId("resource-cut").replaceChildren();
    jointDraft = false;
    hardwareDraft = false;
    renderResourceControls();
    liftControls.refreshStorage();
    syncInputs(selectedProduct());
    byId("update").click();
    renderTree();
    buildEditor();
    frameAssembly();
    undoHistory.reset();
    renderUndoControls();
  } catch (error) {
    alert(`Не удалось открыть проект: ${error.message}`);
  } finally {
    event.target.value = "";
  }
};

const selfCheckLabels = {
  "assembly-plan": "Граф сборочных операций проходит проверку формата",
  "resource-bundle": "Каталог материалов и настройки раскроя проходят проверку формата",
  "snapshot": "Снимок текущего проекта проходит проверку формата",
  "csv-export": "Формируется CSV для ViyarPro (нужна хотя бы одна деталь)",
  "save-open-cycle": "Доступна история редакций проекта",
  "estimate-limit-asks-before-removal": "Сметы: при 50 версиях перед удалением самой старой задаётся вопрос",
  "estimate-archive-single-and-project": "Архив смет: одна смета и несколько смет проекта в одном файле, вопрос перед архивированием",
  "menu-bar-single-open": "Меню: открыто не больше одного, повторный щелчок, щелчок вне меню, Escape и выбор команды закрывают, подменю закрывается с родителем",
  "fixed-views-front-top-left":"Виды спереди, сверху, слева: направления осей на экране и весь объект в кадре",
  "undo-redo-history":"Отмена и повтор: шаг на каждое изменение, повтор сбрасывается новым действием, лимит шагов, сброс истории",
  "voice-speech-without-commas": "Голосовой ввод: речь без запятых («шириной 800 высотой 720 и глубиной 560 мм лдсп 18 мм») разбирается без ложного конфликта",
  "sketch-voice-commands":"Эскиз: голосовые команды — габарит, полка посередине, деление проёма, полка на высоте от пола до центра, двери пока не поддерживаются",
  "sketch-move-and-remove-panel":"Эскиз: перенос панели меняет только соседние проёмы, удаление объединяет проёмы, при делениях с обеих сторон удаление отклоняется",
  "sketch-drawing-snaps-and-insert":"Эскиз: привязки (середина, по соседней полке), вставка панели, соседние проёмы не меняются, у края панель не ставится",
  "sketch-layout-parts-0-90-180-270":"Эскиз: проёмы и панели из дерева с учётом толщин, без пересечений, неверное дерево отклоняется (0/90/180/270°)",
  "facade-sketch-all-cabinets-0-90-180-270":"Эскиз фасадов: все корпуса проекта, двери поверх корпуса, повёрнутый корпус виден сбоку (0/90/180/270°)",
  "material-catalog-custom-code": "Каталог материалов: свой код, толщина, формат листа, текстура и цвет; неверный код отклоняется",
  "material-thickness-mismatch-reported": "Толщина детали, не совпадающая с толщиной материала, отмечается замечанием",
  "legacy-placement-defaults":"Корпус без Y и поворота получает значения по умолчанию",
  "placement-rejects-invalid-coordinates": "Недопустимые координаты корпуса отклоняются",
  "quarter-turn-oriented-box": "Объём детали поворачивается вместе с корпусом на 90°",
  "custom-panel-default-axes-0-90-180-270": "Пользовательская деталь поворачивается с корпусом (0/90/180/270°)",
  "coordinate-round-trip-0-90-180-270": "Прямое и обратное преобразование координат (0/90/180/270°)",
  "cabinet-side-faces-0-90-180-270": "Положение и ориентация боковины корпуса (0/90/180/270°)",
  "door-swing-local-front-0-90-180-270": "Дверь открывается наружу вокруг петель (0/90/180/270°)",
  "drawer-extension-local-front-0-90-180-270": "Ящик выдвигается в сторону фасада (0/90/180/270°)",
  "drawer-sides-along-depth-inside-cabinet-0-90-180-270": "Боковины ящика идут по глубине и не задевают корпус (0/90/180/270°)",
  "drawers-inside-divider-section-0-90-180-270": "Ящики стоят в одной секции и не задевают перегородку (0/90/180/270°)",
  "shelves-above-drawer-zone-0-90-180-270": "Полки над зоной ящиков, ящики не упираются в крышу (0/90/180/270°)",
  "doors-with-drawers-warning-0-90-180-270": "Двери и ящики в одном корпусе дают предупреждение (0/90/180/270°)",
  "confirmat-points-0-90-180-270": "Точки и направление конфирматов (0/90/180/270°)",
  "tool-access-corridor-0-90-180-270": "Коридор доступа инструмента к крепежу (0/90/180/270°)",
  "assembly-front-approach-rotates": "Монтажная зона подхода спереди поворачивается с корпусом",
  "module-intersection": "Пересечение корпусов под разными углами",
  "floor-check": "Проверка выхода ниже уровня пола",
  "complete-specification": "Спецификация формируется с одинаковым числом столбцов",
  "specification-product-source": "В спецификации у каждой детали указано изделие",
  "sheet-fit-directional-part-fits": "Деталь 2200×600 мм с направленной текстурой помещается на лист 2800×2070 мм",
  "sheet-fit-oversized-part-reported": "Деталь 2900×600 мм отмечается как не помещающаяся на лист",
  "sheet-fit-rotation-only-without-grain": "Поворот детали на листе разрешён только без направленной текстуры",
  "sheet-fit-machine-limit-reported": "Лист больше габарита станка отмечается замечанием",
  "price-list-search-and-assignment": "Прайс-лист: поиск по размеру с «х» и подстановка цены и формата плиты в материал",
  "price-list-index-rejects-unsafe-path": "Прайс-лист: индекс с путём вне папки prices/ отклоняется",
  "voice-set-example-three-modules": "Голосовой комплект: пример из трёх модулей разбирается на три корпуса",
  "voice-set-conflict-negative-correction": "Голосовой комплект: конфликт размеров, отрицательное значение и исправление «не …, а …»",
  "voice-set-count-order-hardware": "Голосовой комплект: несовпадение количества, неоднозначный порядок, фурнитура как заметка",
  "voice-set-needs-two-modules": "Голосовой комплект: описание одного корпуса не принимается как комплект",
  "voice-set-atomic-creation": "Голосовой комплект: при ошибке в модуле не создаётся ни один корпус",
};

byId("project-self-check").addEventListener("click", () => {
  const report = byId("project-self-check-report");
  try {
    const { ok, results } = runSelfChecks();
    const failed = results.filter(([, passed]) => !passed);
    report.className = ok ? "valid" : "error";
    report.textContent = [
      ok
        ? `Самопроверки пройдены: ${results.length} из ${results.length}.`
        : `Самопроверки не пройдены: ${failed.length} из ${results.length}.`,
      ...results.map(([name, passed]) => `${passed ? "✓" : "✗"} ${selfCheckLabels[name] || name}`),
      "Самопроверки контролируют расчёты FURNIX на типовых примерах и не подтверждают производственную пригодность проекта.",
    ].join("\n");
  } catch (error) {
    report.className = "error";
    report.textContent = `Самопроверки прервались с ошибкой: ${error.message}`;
  }
});

byId("assembly-spec-csv").onclick = () => {
  downloadFile("furnix-full-specification.csv", csvText(specificationRows()), "text/csv;charset=utf-8");
};
byId("viyar-export-csv").addEventListener("click", () => {
  const status = byId("viyar-export-status");
  try {
    renderViyarExportGroups();
    const result = viyarExportCsv();
    downloadFile(result.filename, result.csv, "text/csv;charset=utf-8");
    status.className = "note";
    const edgeThickness = Number(byId("edgeThickness").value);
    const hasEdgedParts = viyarMaterialGroups().some((group) =>
      group.parts.some(({ part }) => part.edges?.some(Boolean)));
    status.textContent = `Подготовлен CSV: ${result.count} деталей. Файл передаёт длину и ширину как есть; проверьте, что это пильные размеры. Выберите в ViyarPro материал «${projectResources.materials.find((item) => item.code === byId("viyar-export-group").value.split("|")[0])?.name || "по списку"}» толщиной ${byId("viyar-export-group").value.split("|")[1]} мм и сверьте кромки. ${
      hasEdgedParts && edgeThickness === 0.4
        ? "Индекс 1 по документации ВИЯР означает 0,5 мм по умолчанию, поэтому назначьте фактическую кромку вручную."
        : ""
    }`;
    status.textContent += " Проверьте ориентацию кромок контрольным импортом; присадка, пазы и другие операции в CSV не передаются.";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  }
});
byId("assembly-parts-svg").onclick = () => {
  downloadFile("furnix-part-drawings.svg", partsDrawingSvg(), "image/svg+xml;charset=utf-8");
};
byId("assembly-assembly-svg").onclick = () => {
  downloadFile("furnix-assembly-scheme.svg", assemblyDrawingSvg(), "image/svg+xml;charset=utf-8");
};
byId("facade-svg").onclick = () => {
  downloadFile("furnix-facades.svg", facadeSketchSvg(), "image/svg+xml;charset=utf-8");
};
byId("assembly-dxf").onclick = () => {
  downloadFile("furnix-part-outlines.dxf", dxfDocument(), "application/dxf;charset=utf-8");
};

byId("csv").onclick = () => {
  const rows = [["Изделие", "Деталь", "Длина_X_мм", "Ширина_Z_мм", "Толщина_Y_мм", "Материал"]];
  for (const product of products) {
    if (product.type !== "cabinet") continue;
    for (const part of [...generatedParts(product), ...product.customParts]) {
      rows.push([product.name, part.name, Math.round(part.length), Math.round(part.width), Math.round(part.thickness), part.material || product.parameters.color]);
    }
    for (const connection of product.connections || []) {
      for (const component of (product.hardwareComponents || [])
        .filter((item) => connection.componentIds?.includes(item.id))) {
        rows.push([
          product.name,
          `${component.category}: ${component.type} ${component.model}`,
          component.dimensions.length || 0,
          component.dimensions.diameter || 0,
          0,
          "Металл",
        ]);
      }
    }
  }
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  downloadFile("furnix-project-parts.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
};

byId("hardware-csv").onclick = () => {
  const rows = [[
    "Изделие", "Группа", "Тип", "Модель", "Длина_мм", "Диаметр_мм", "Ширина_мм", "Высота_мм",
    "Ссылка_на_установку", "Деталь_A", "Деталь_B", "Отступ_мм", "Позиция", "Позиций_в_наборе",
  ]];
  for (const product of products) {
    for (const component of product.hardwareComponents || []) {
      const point = component.installationPoint;
      const distribution = point.distribution;
      rows.push([
        product.name,
        component.category,
        component.type,
        component.model,
        component.dimensions.length ?? "",
        component.dimensions.diameter ?? "",
        component.dimensions.width ?? "",
        component.dimensions.height ?? "",
        point.kind === "joint-edge" ? "общее ребро деталей" : point.reference || point.kind,
        point.partAId || point.partId || "",
        point.partBId || "",
        point.edgeInset ?? "",
        distribution ? distribution.index + 1 : "",
        distribution?.count ?? "",
      ]);
    }
  }
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  downloadFile("furnix-hardware-components.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let sketchMode = null;
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (sketchMode?.isDrawing()) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, activeCamera);
  const hit = raycaster.intersectObjects(modelGroup.children, false).find((item) => item.object.userData.selection);
  if (hit) selectItem(hit.object.userData.selection.productId, hit.object.userData.selection.partId);
});

function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  fitOrthoCamera();
}
new ResizeObserver(resize).observe(viewport);
function animate() {
  controls.update();
  renderer.render(scene, activeCamera);
  requestAnimationFrame(animate);
}

let cutPlanResult = [];
let cutPlanSignature = "";
byId("resource-save").addEventListener("click", () => {
  try {
    const resources = readResourceForm();
    const collision = readCollisionForm();
    projectResources.cutSettings = resources.cutSettings;
    projectResources.materials = resources.materials;
    projectResources.remnants = resources.remnants;
    projectResources.collisionSettings = collision.collisionSettings;
    projectResources.environmentZones = collision.environmentZones;
    refreshMaterialSelects();
    buildEditor();
    renderModel();
    byId("resource-status").className = "note";
    byId("resource-status").textContent = "Параметры материалов, раскроя, движения и сервисных зон сохранены в проекте. JSON-снимок создаётся кнопкой «Сохранить JSON».";
  } catch (error) {
    byId("resource-status").className = "error";
    byId("resource-status").textContent = error.message;
  }
});
byId("material-catalog").addEventListener("click", (event) => {
  const status = byId("resource-status");
  const remove = event.target.closest("[data-material-remove]");
  if (remove) {
    const code = remove.dataset.materialRemove;
    remove.closest("tr").remove();
    status.className = "note";
    status.textContent = `Материал «${code}» убран из таблицы. Нажмите «Сохранить ресурсы и настройки», чтобы удалить его из каталога; материал, который используется в проекте, удалить нельзя.`;
    return;
  }
  if (event.target.id !== "material-add-button") return;
  try {
    const value = (id) => byId(id).value;
    const material = newCatalogMaterial({
      code: value("material-new-code"),
      name: value("material-new-name"),
      thickness: value("material-new-thickness").trim(),
      sheetWidth: value("material-new-sheet-width").trim(),
      sheetLength: value("material-new-sheet-length").trim(),
      grain: value("material-new-grain"),
      color: value("material-new-color"),
    }, [...byId("material-catalog").querySelectorAll("tbody tr")].map((row) => row.dataset.material));
    const body = byId("material-catalog").querySelector("tbody");
    body.insertAdjacentHTML("beforeend", materialRowHtml(material));
    setMaterialRowSelects(body.lastElementChild, material);
    for (const id of ["material-new-code", "material-new-name", "material-new-thickness", "material-new-sheet-width", "material-new-sheet-length"]) {
      byId(id).value = "";
    }
    status.className = "note";
    status.textContent = `Материал «${material.name}» (${material.code}) добавлен в таблицу. Нажмите «Сохранить ресурсы и настройки» — после этого он появится в списке материалов корпуса.`;
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  }
});
document.querySelectorAll("[data-collision-setting]").forEach((input) => {
  input.addEventListener("change", () => {
    try {
      const collision = readCollisionForm();
      projectResources.collisionSettings = collision.collisionSettings;
      projectResources.environmentZones = collision.environmentZones;
      renderModel();
    } catch (error) {
      byId("collision-report").className = "error";
      byId("collision-report").textContent = error.message;
    }
  });
});
byId("environment-zone-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const zone = {
    id: `zone-${Date.now()}-${++serial}`,
    name: String(values.get("name") || "").trim(),
    type: String(values.get("type") || ""),
    x: Number(values.get("x")),
    y: Number(values.get("y")),
    z: Number(values.get("z")),
    width: Number(values.get("width")),
    height: Number(values.get("height")),
    depth: Number(values.get("depth")),
  };
  if (!validEnvironmentZone(zone)) {
    byId("collision-report").className = "error";
    byId("collision-report").textContent = "Проверьте название, тип, координаты и положительные размеры зоны (до 100 000 мм).";
    return;
  }
  if (projectResources.environmentZones.length >= 200) {
    byId("collision-report").className = "error";
    byId("collision-report").textContent = "В проекте разрешено не более 200 объёмных зон.";
    return;
  }
  projectResources.environmentZones.push(zone);
  form.reset();
  renderCollisionControls();
  renderModel();
});
byId("environment-zone-list").addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-zone]");
  if (!remove) return;
  projectResources.environmentZones = projectResources.environmentZones
    .filter((zone) => zone.id !== remove.dataset.removeZone);
  renderCollisionControls();
  renderModel();
});
byId("collision-check").addEventListener("click", () => {
  try {
    const collision = readCollisionForm();
    projectResources.collisionSettings = collision.collisionSettings;
    projectResources.environmentZones = collision.environmentZones;
    renderModel();
  } catch (error) {
    byId("collision-report").className = "error";
    byId("collision-report").textContent = error.message;
  }
});
byId("assembly-operation-form").elements.namedItem("productId").addEventListener("change", (event) => {
  const target = byId("assembly-operation-form").elements.namedItem("targetPartId");
  addSelectOptions(target, operationPartOptions(event.target.value), "");
});
byId("assembly-operation-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    addAssemblyPlanOperation(operationFromForm(event.currentTarget, `operation-${Date.now()}-${++serial}`));
    event.currentTarget.elements.namedItem("name").value = "";
    event.currentTarget.elements.namedItem("dependsOn").selectedIndex = -1;
    renderModel();
  } catch (error) {
    showAssemblyPlanError(error.message);
  }
});
byId("assembly-plan-generate").addEventListener("click", () => {
  try {
    if (projectResources.assemblyPlan.operations.length &&
        !window.confirm("Заменить текущий граф операций черновым планом?")) return;
    generateDraftAssemblyPlan();
    renderModel();
  } catch (error) {
    showAssemblyPlanError(error.message);
  }
});
byId("assembly-plan-operations").addEventListener("click", (event) => {
  const save = event.target.closest("[data-save-operation]");
  const remove = event.target.closest("[data-remove-operation]");
  try {
    if (save) {
      const card = save.closest(".assembly-operation");
      const updated = operationFromForm(card, save.dataset.saveOperation);
      if (!validAssemblyOperation(updated) || !operationTarget(updated)) {
        throw new Error("Проверьте параметры операции и выбранную деталь.");
      }
      const operations = projectResources.assemblyPlan.operations.map((operation) =>
        operation.id === updated.id ? updated : operation);
      const nextPlan = { operations };
      if (!validAssemblyPlan(nextPlan)) {
        throw new Error("Операция содержит повторяющиеся или недопустимые зависимости.");
      }
      projectResources.assemblyPlan = nextPlan;
      renderModel();
    } else if (remove) {
      const removedId = remove.dataset.removeOperation;
      projectResources.assemblyPlan.operations = projectResources.assemblyPlan.operations
        .filter((operation) => operation.id !== removedId)
        .map((operation) => ({
          ...operation,
          dependsOn: operation.dependsOn.filter((dependencyId) => dependencyId !== removedId),
        }));
      renderModel();
    }
  } catch (error) {
    showAssemblyPlanError(error.message);
  }
});
byId("assembly-plan-operations").addEventListener("change", (event) => {
  if (event.target.name !== "productId") return;
  const card = event.target.closest(".assembly-operation");
  const partSelect = card?.elements.namedItem("targetPartId");
  if (partSelect) addSelectOptions(partSelect, operationPartOptions(event.target.value), "");
});
byId("assembly-plan-check").addEventListener("click", () => {
  latestAssemblyAnalysis = analyzeAssemblyPlan();
  renderAssemblyPlan();
  renderModel();
});
byId("assembly-change-options").addEventListener("click", (event) => {
  const apply = event.target.closest("[data-apply-construction-change]");
  if (!apply) return;
  try {
    applyConstructionChange(Number(apply.dataset.applyConstructionChange));
  } catch (error) {
    showAssemblyPlanError(error.message);
  }
});
byId("assembly-plan").addEventListener("toggle", () => {
  if (byId("assembly-plan").open) renderModel();
});
byId("resource-optimize").addEventListener("click", () => {
  try {
    cutPlanResult = optimizeCutPlan();
    byId("resource-form").elements.namedItem("remnants").value = projectResources.remnants
      .map((item) => `${item.material},${item.thickness},${item.width},${item.length}`).join("\n");
    cutPlanSignature = currentCutSignature();
    byId("resource-status").className = "note";
  } catch (error) {
    cutPlanSignature = "";
    byId("resource-status").className = "error";
    byId("resource-status").textContent = error.message;
  }
});
byId("estimate-create").addEventListener("click", () => {
  const status = byId("estimate-status");
  try {
    let removalNote = "";
    const estimate = makeEstimate((removed) => {
      const versions = removed.map((item) => `v${item.revision}`).join(", ");
      if (confirm(estimateRemovalMessage(removed))) {
        const file = estimateArchiveFile(removed);
        downloadFile(file.name, file.data, "application/json");
        removalNote = ` Удалена из истории: ${versions}; скачана файлом ${file.name}.`;
      } else {
        removalNote = ` Удалена из истории без скачивания: ${versions}.`;
      }
    });
    renderEstimateHistory();
    status.className = "note";
    status.textContent = `Добавлена версия ${estimate.revision} (${estimate.status === "materials-priced"
      ? "оценены только листовые материалы по указанным вручную ценам"
      : "оценка неполная; проверьте цены и исключения"}).${removalNote} Это не полный расчёт заказа ВИЯР. Сохраните проект JSON, чтобы записать историю смет на диск.`;
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  }
});
function runEstimateArchive(ids) {
  const status = byId("estimate-status");
  try {
    const result = archiveEstimates(ids, byId("estimate-archive-remove").checked);
    renderEstimateHistory();
    status.className = "note";
    status.textContent = result || "Архивирование отменено, сметы не изменились.";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  }
}
byId("estimate-select-all").addEventListener("click", () => {
  for (const estimate of projectResources.estimates) selectedEstimateIds.add(estimate.id);
  renderEstimateHistory();
});
byId("estimate-select-none").addEventListener("click", () => {
  selectedEstimateIds.clear();
  renderEstimateHistory();
});
byId("estimate-archive-selected").addEventListener("click", () => runEstimateArchive([...selectedEstimateIds]));
byId("estimate-history").addEventListener("change", (event) => {
  const box = event.target.closest("[data-select-estimate]");
  if (!box) return;
  if (box.checked) selectedEstimateIds.add(box.dataset.selectEstimate);
  else selectedEstimateIds.delete(box.dataset.selectEstimate);
  renderEstimateHistory();
});
byId("estimate-history").addEventListener("click", (event) => {
  const archive = event.target.closest("[data-archive-estimate]");
  if (archive) {
    runEstimateArchive([archive.dataset.archiveEstimate]);
    return;
  }
  const button = event.target.closest("[data-export-estimate]");
  if (!button) return;
  const estimate = projectResources.estimates.find((item) => item.id === button.dataset.exportEstimate);
  if (!estimate) {
    byId("estimate-status").className = "error";
    byId("estimate-status").textContent = "Выбранная версия сметы не найдена.";
    return;
  }
  const file = estimateFile(estimate);
  downloadFile(file.name, file.data, "application/json");
});
byId("resource-cut-csv").addEventListener("click", () => {
  if (!cutPlanResult.length || !cutPlanSignature) {
    byId("resource-status").className = "error";
    byId("resource-status").textContent = "Сначала рассчитайте раскрой.";
    return;
  }
  try {
    if (cutPlanSignature !== currentCutSignature()) {
      cutPlanSignature = "";
      throw new Error("Состав проекта или настройки изменились. Пересчитайте раскрой перед экспортом.");
    }
  } catch (error) {
    byId("resource-status").className = "error";
    byId("resource-status").textContent = error.message;
    return;
  }
  const rows = [["Источник", "Тип", "Материал", "Толщина_мм", "Лист_ширина_мм", "Лист_длина_мм", "Изделие", "Деталь", "X_мм", "Y_мм", "Ширина_мм", "Длина_мм", "Поворот"]];
  for (const sheet of cutPlanResult) {
    for (const placement of sheet.placements) {
      rows.push([
        sheet.id, sheet.kind, sheet.material, sheet.thickness, sheet.width, sheet.length,
        placement.product, placement.part, placement.x, placement.y, placement.width,
        placement.length, placement.rotated ? "да" : "нет",
      ]);
    }
  }
  downloadFile("furnix-cut-plan.csv", csvText(rows), "text/csv;charset=utf-8");
});
byId("resource-restore").addEventListener("click", () => {
  const revision = Number(byId("resource-form").elements.namedItem("revision").value);
  const snapshot = projectResources.history.find((item) => item.revision === revision);
  if (!snapshot || !validVersionSnapshot(snapshot)) {
    byId("resource-status").className = "error";
    byId("resource-status").textContent = "Выбранная редакция отсутствует или повреждена.";
    return;
  }
  products.splice(0, products.length, ...structuredClone(snapshot.products).map((product) => ({
    ...product,
    y: product.y ?? 0,
    rotationY: product.rotationY ?? 0,
  })));
  projectResources.cutSettings = structuredClone(snapshot.resources.cutSettings);
  projectResources.collisionSettings = structuredClone(snapshot.resources.collisionSettings || defaultCollisionSettings());
  projectResources.environmentZones = structuredClone(snapshot.resources.environmentZones || []);
  projectResources.assemblyPlan = structuredClone(snapshot.resources.assemblyPlan || defaultAssemblyPlan());
  projectResources.materials = structuredClone(snapshot.resources.materials);
  projectResources.remnants = structuredClone(snapshot.resources.remnants);
  projectResources.supplierProfile = structuredClone(snapshot.resources.supplierProfile || defaultSupplierProfile());
  projectResources.liftCalculations = structuredClone(snapshot.resources.liftCalculations || []);
  projectResources.liftSpecificationItems = structuredClone(snapshot.resources.liftSpecificationItems || []);
  projectResources.revision = Math.max(projectResources.revision, revision);
  const numericIds = products.flatMap((product) => [
    product.id, ...product.customParts.map((part) => part.id),
    ...product.connections.map((connection) => connection.id),
    ...product.hardwareComponents.map((component) => component.id),
  ]).map((id) => Number(id.match(/-(\d+)$/)?.[1]) || 0);
  serial = Math.max(serial, ...numericIds);
  byId("sheet").value = snapshot.settings.sheet;
  byId("kerf").value = snapshot.settings.kerf;
  byId("edgeThickness").value = snapshot.settings.edgeThickness;
  selected = { productId: products[0].id, partId: null, connectionId: null, hardwareComponentId: null };
  cutPlanResult = [];
  cutPlanSignature = "";
  byId("resource-cut").replaceChildren();
  renderResourceControls();
  liftControls.refreshStorage();
  syncInputs(selectedProduct());
  renderTree();
  buildEditor();
  renderModel();
  frameAssembly();
  undoHistory.reset();
  renderUndoControls();
  byId("resource-status").className = "note";
  byId("resource-status").textContent = `Восстановлена редакция ${revision}. Проект можно редактировать и сохранить новой редакцией.`;
});

// Sketch preview lives outside modelGroup, which is rebuilt on every render.
const sketchGroup = new THREE.Group();
scene.add(sketchGroup);
const sketchPreviewStyles = {
  opening: { color: 0x7ad8ff, opacity: 0.14 },
  selected: { color: 0xffcc66, opacity: 0.22 },
  panel: { color: 0x35c9ff, opacity: 0.55 },
  hoverPanel: { color: 0x7ad8ff, opacity: 0.45 },
  selectedPanel: { color: 0xffcc66, opacity: 0.7 },
};
function showSketchPreview(product, boxes) {
  while (sketchGroup.children.length) {
    const mesh = sketchGroup.children.pop();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  if (!product) return;
  const p = product.parameters;
  for (const box of boxes) {
    const style = sketchPreviewStyles[box.kind];
    // Openings are drawn as a thin plate just in front of the cabinet, panels through the full depth.
    const flat = box.kind === "opening" || box.kind === "selected";
    const local = {
      size: [box.x1 - box.x0, box.y1 - box.y0, flat ? 1 : p.depth],
      center: [(box.x0 + box.x1) / 2 - p.width / 2, (box.y0 + box.y1) / 2, flat ? p.depth / 2 + 2 : 0],
    };
    const world = transformCabinetBox(local, product);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...world.size.map((value) => Math.max(value, 1) / 1000)),
      new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: style.opacity, depthWrite: false, depthTest: !flat }),
    );
    mesh.position.set(...world.center.map((value) => value / 1000));
    mesh.renderOrder = 2;
    sketchGroup.add(mesh);
  }
}
// Pointer → cabinet mm (X from the left side, Y from the floor) on the plane of the cabinet front.
function pointerToCabinet(event, product) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, activeCamera);
  const frontZ = cabinetLocalToWorldPoint(product, [0, 0, product.parameters.depth / 2])[2] / 1000;
  const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -frontZ), new THREE.Vector3());
  if (!hit) return null;
  const local = cabinetWorldToLocalPoint(product, hit.toArray().map((value) => value * 1000));
  return { x: local[0] + product.parameters.width / 2, y: local[1] };
}
function sketchMmPerPixel() {
  const width = Math.max(1, renderer.domElement.clientWidth);
  return activeCamera === orthoCamera ? (orthoCamera.right - orthoCamera.left) / orthoCamera.zoom / width * 1000 : 2;
}
const sketchHost = document.createElement("div");
byId("assembly-editor").before(sketchHost);
sketchMode = mountSketchMode(sketchHost, {
  canvas: renderer.domElement,
  selectedCabinet: () => {
    const product = selectedProduct();
    return product?.type === "cabinet" ? product : null;
  },
  createCabinet: (size) => {
    const sketches = products.filter((product) => product.parameters?.layout).length;
    return addCabinet({
      ...readForm(), ...size, name: `Эскиз ${sketches + 1}`,
      shelves: 0, divider: false, doors: 0, drawers: 0, layout: newLayout(),
    });
  },
  applyLayout: (product, layout) => {
    product.parameters = { ...product.parameters, layout };
    renderTree();
    buildEditor();
    renderModel();
  },
  setView,
  pointerToCabinet,
  mmPerPixel: sketchMmPerPixel,
  showPreview: showSketchPreview,
  formDefaults: () => ({ width: byId("width").value, height: byId("height").value, depth: byId("depth").value }),
  resizeCabinet: (product, size) => {
    const next = { ...product.parameters, ...size };
    if (!validCabinet(next)) return false;
    product.parameters = next;
    syncInputs(product);
    renderTree();
    buildEditor();
    renderModel();
    setView("front", product);
    return true;
  },
  voiceHelpers: { number: voiceNumber, toMm: voiceUnitToMillimeters, errorText: voiceRecognitionErrorText },
  speechAllowed: () => !!byId("voice-speech-consent")?.checked,
});

for (const bar of [menuBar, toolbar]) {
  bar.addEventListener("click", (event) => {
    const view = event.target.closest("button[data-view]");
    if (view) setView(view.dataset.view);
  });
}
byId("undo").onclick = () => stepUndoHistory(-1);
byId("redo").onclick = () => stepUndoHistory(1);
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  // Text fields keep their own undo; event.code works in any keyboard layout.
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  const redo = event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey);
  if (event.code !== "KeyZ" && !redo) return;
  event.preventDefault();
  stepUndoHistory(redo ? 1 : -1);
});

const initialProduct = newCabinet(readForm());
products.push(initialProduct);
selected.productId = initialProduct.id;
renderResourceControls();
syncInputs(initialProduct);
renderTree();
buildEditor();
renderModel();
frameAssembly();
resize();
animate();
