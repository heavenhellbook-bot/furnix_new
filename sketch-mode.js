// Sketch mode: the cabinet interior as a tree of openings, as in Bazis.
// A split divides an opening along X (vertical panels, «Перегородка N») or Y (horizontal panels, «Полка N»).
// Each child opening has a fixed size in mm or null — a "rubber" size that shares the rest equally,
// so moving a panel or resizing the cabinet only changes rubber openings.
// Panel names are stored in the tree and never renumbered: part overrides and connections refer to them.

export const layoutLimits = { depth: 8, nodes: 200, minOpening: 1 };

const nodeIdPattern = /^[a-z0-9-]{1,40}$/;
const panelPrefixes = { x: "Перегородка", y: "Полка" };
const panelNamePattern = /^(Полка|Перегородка) (\d+)$/;

export function newLayout() {
  return { version: 1, root: { id: "n1", type: "opening", fill: "empty" } };
}

export function validLayout(layout) {
  if (!layout || typeof layout !== "object" || layout.version !== 1 || !layout.root) return false;
  const ids = new Set();
  const names = new Set();
  let count = 0;
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || typeof node.id !== "string" || !nodeIdPattern.test(node.id) ||
        ids.has(node.id) || depth > layoutLimits.depth || ++count > layoutLimits.nodes) return false;
    ids.add(node.id);
    if (node.type === "opening") return (node.fill ?? "empty") === "empty";
    if (node.type !== "split" || !["x", "y"].includes(node.axis) ||
        !Array.isArray(node.children) || node.children.length < 2 ||
        !Array.isArray(node.panels) || node.panels.length !== node.children.length - 1 ||
        !node.children.some((child) => child?.size === null)) return false;
    for (const panel of node.panels) {
      const match = typeof panel?.name === "string" && panel.name.match(panelNamePattern);
      if (!match || match[1] !== panelPrefixes[node.axis] || names.has(panel.name)) return false;
      names.add(panel.name);
    }
    return node.children.every((child) => child && typeof child === "object" &&
      (child.size === null || (Number.isFinite(child.size) && child.size > 0 && child.size <= 10000)) &&
      visit(child.node, depth + 1));
  };
  return visit(layout.root, 0);
}

// Openings and panels in cabinet coordinates (X from the left side, Y from the floor), in mm.
export function resolveLayout(layout, box, thickness) {
  const openings = [];
  const panels = [];
  const issues = [];
  const nodeBoxes = new Map();
  const visit = (node, area) => {
    nodeBoxes.set(node.id, area);
    if (node.type === "opening") {
      openings.push({ id: node.id, fill: node.fill ?? "empty", box: area });
      return;
    }
    const [start, end] = node.axis === "x" ? [area.x0, area.x1] : [area.y0, area.y1];
    const fixed = node.children.reduce((sum, child) => sum + (child.size ?? 0), 0);
    const rubber = node.children.filter((child) => child.size === null).length;
    const rubberSize = (end - start - fixed - thickness * node.panels.length) / rubber;
    if (rubberSize < layoutLimits.minOpening) {
      issues.push(`проёмы деления «${node.panels.map((panel) => panel.name).join(", ")}» не помещаются: ` +
        `не хватает ${Math.round(layoutLimits.minOpening - rubberSize)} мм`);
    }
    let cursor = start;
    node.children.forEach((child, index) => {
      const size = child.size ?? rubberSize;
      const next = cursor + size;
      visit(child.node, node.axis === "x" ? { ...area, x0: cursor, x1: next } : { ...area, y0: cursor, y1: next });
      if (index < node.panels.length) {
        panels.push({
          name: node.panels[index].name,
          axis: node.axis,
          box: node.axis === "x" ? { ...area, x0: next, x1: next + thickness } : { ...area, y0: next, y1: next + thickness },
        });
      }
      cursor = next + thickness;
    });
  };
  visit(layout.root, box);
  return { openings, panels, issues, nodeBoxes };
}

// Interior between the sides, the bottom and the roof of a FURNIX cabinet.
export function cabinetInterior(p) {
  return { x0: p.thickness, x1: p.width - p.thickness, y0: p.thickness, y1: p.height - p.thickness };
}

// Panels as generated parts: the same placement convention as the legacy shelves and divider.
export function layoutParts(p) {
  const { panels } = resolveLayout(p.layout, cabinetInterior(p), p.thickness);
  return panels.map(({ name, axis, box }) => ({
    name,
    length: axis === "x" ? box.y1 - box.y0 : box.x1 - box.x0,
    width: p.depth,
    thickness: p.thickness,
    x: (box.x0 + box.x1) / 2,
    y: (box.y0 + box.y1) / 2,
    z: p.depth / 2,
    orientation: axis === "x" ? "vertical" : "horizontal",
  }));
}

export function layoutIssues(p) {
  return resolveLayout(p.layout, cabinetInterior(p), p.thickness).issues;
}

function layoutNodes(layout) {
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    if (node.type === "split") node.children.forEach((child) => visit(child.node));
  };
  visit(layout.root);
  return nodes;
}

function nextNumber(values) {
  return Math.max(0, ...values) + 1;
}

// Splits an opening into `count` equal rubber openings along the axis. Returns a new layout.
export function splitOpening(layout, openingId, axis, count = 2) {
  if (!["x", "y"].includes(axis) || !Number.isInteger(count) || count < 2 || count > 20) {
    throw new Error("Проём делится на 2–20 частей по вертикали или горизонтали.");
  }
  const next = structuredClone(layout);
  const nodes = layoutNodes(next);
  let idNumber = nextNumber(nodes.map((node) => Number(node.id.match(/^n(\d+)$/)?.[1]) || 0));
  const prefix = panelPrefixes[axis];
  let nameNumber = nextNumber(nodes.flatMap((node) => node.type === "split" ? node.panels : [])
    .map((panel) => panel.name.match(panelNamePattern))
    .filter((match) => match && match[1] === prefix)
    .map((match) => Number(match[2])));
  const replace = (node) => {
    if (node.type !== "opening" || node.id !== openingId) return null;
    return {
      id: `n${idNumber++}`,
      type: "split",
      axis,
      children: Array.from({ length: count }, (_, index) => ({
        size: null,
        node: index === 0 ? node : { id: `n${idNumber++}`, type: "opening", fill: "empty" },
      })),
      panels: Array.from({ length: count - 1 }, () => ({ name: `${prefix} ${nameNumber++}` })),
    };
  };
  const rootReplacement = replace(next.root);
  if (rootReplacement) {
    next.root = rootReplacement;
    return next;
  }
  for (const node of nodes) {
    if (node.type !== "split") continue;
    for (const child of node.children) {
      const replacement = replace(child.node);
      if (replacement) {
        child.node = replacement;
        return next;
      }
    }
  }
  throw new Error(`Проём «${openingId}» не найден.`);
}

export function openingAt(p, point) {
  const { openings } = resolveLayout(p.layout, cabinetInterior(p), p.thickness);
  return openings.find(({ box }) =>
    point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1) || null;
}

export const snapFractions = [[1 / 2, "середина"], [1 / 3, "1/3"], [2 / 3, "2/3"], [1 / 4, "1/4"], [3 / 4, "3/4"]];

// Panel centre for a raw pointer position in an opening (cabinet mm). Snaps, within `threshold` mm,
// to equal divisions of the opening and to parallel panels elsewhere in the cabinet;
// otherwise rounds to 1 mm. Both resulting openings keep at least the minimum size.
export function snapPanelCenter(p, opening, axis, raw, threshold) {
  const T = p.thickness;
  const [start, end] = axis === "x" ? [opening.box.x0, opening.box.x1] : [opening.box.y0, opening.box.y1];
  const low = start + layoutLimits.minOpening + T / 2;
  const high = end - layoutLimits.minOpening - T / 2;
  if (high < low) return null;
  const candidates = snapFractions.map(([fraction, label]) => ({ center: start + (end - start - T) * fraction + T / 2, label }));
  for (const panel of resolveLayout(p.layout, cabinetInterior(p), T).panels) {
    if (panel.axis !== axis) continue;
    const center = axis === "x" ? (panel.box.x0 + panel.box.x1) / 2 : (panel.box.y0 + panel.box.y1) / 2;
    candidates.push({ center, label: `по ${panel.name}` });
  }
  let best = null;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.center - raw);
    if (candidate.center >= low && candidate.center <= high && distance <= threshold && (!best || distance < best.distance)) {
      best = { ...candidate, distance };
    }
  }
  const center = best ? best.center : Math.min(high, Math.max(low, Math.round(raw)));
  return { center, label: best?.label ?? null, before: center - T / 2 - start, after: end - center - T / 2 };
}

function findParent(layout, nodeId) {
  for (const node of layoutNodes(layout)) {
    if (node.type !== "split") continue;
    const index = node.children.findIndex((child) => child.node.id === nodeId);
    if (index >= 0) return { node, index };
  }
  return null;
}

// Puts a panel with its centre at `center` (cabinet mm along the axis) into an opening.
// The part before the panel gets a fixed size; the part after keeps the opening's own size type.
// When splitting a rubber opening would also shrink other rubber openings of the same split,
// a nested split is made instead, so openings the user did not touch keep their size.
export function insertPanel(p, openingId, axis, center) {
  const opening = resolveLayout(p.layout, cabinetInterior(p), p.thickness).openings.find((item) => item.id === openingId);
  if (!opening) throw new Error(`Проём «${openingId}» не найден.`);
  const T = p.thickness;
  const [start, end] = axis === "x" ? [opening.box.x0, opening.box.x1] : [opening.box.y0, opening.box.y1];
  const before = Math.round((center - T / 2 - start) * 1000) / 1000;
  const after = Math.round((end - center - T / 2) * 1000) / 1000;
  if (before < layoutLimits.minOpening || after < layoutLimits.minOpening) {
    throw new Error("Панель не помещается в проём: до краёв проёма должно оставаться место.");
  }
  const next = structuredClone(p.layout);
  const nodes = layoutNodes(next);
  const prefix = panelPrefixes[axis];
  const name = `${prefix} ${nextNumber(nodes.flatMap((node) => node.type === "split" ? node.panels : [])
    .map((panel) => panel.name.match(panelNamePattern))
    .filter((match) => match && match[1] === prefix)
    .map((match) => Number(match[2])))}`;
  let idNumber = nextNumber(nodes.map((node) => Number(node.id.match(/^n(\d+)$/)?.[1]) || 0));
  const added = { id: `n${idNumber++}`, type: "opening", fill: "empty" };
  const parent = findParent(next, openingId);
  const child = parent?.node.children[parent.index];
  const otherRubber = parent ? parent.node.children.filter((item, index) => index !== parent.index && item.size === null).length : 0;
  if (parent && parent.node.axis === axis && (child.size !== null || otherRubber === 0)) {
    parent.node.children.splice(parent.index, 1,
      { size: before, node: child.node },
      { size: child.size === null ? null : after, node: added });
    parent.node.panels.splice(parent.index, 0, { name });
  } else {
    const original = parent ? child.node : next.root;
    const split = {
      id: `n${idNumber++}`,
      type: "split",
      axis,
      children: [{ size: before, node: original }, { size: null, node: added }],
      panels: [{ name }],
    };
    if (parent) child.node = split;
    else next.root = split;
  }
  if (!validLayout(next)) throw new Error("Не удалось вставить панель: дерево проёмов стало бы неверным.");
  return { layout: next, name };
}

// The panel under a point (cabinet mm), with a tolerance around its thickness.
export function panelAt(p, point, tolerance = 0) {
  const { panels } = resolveLayout(p.layout, cabinetInterior(p), p.thickness);
  return panels.find(({ box }) =>
    point.x >= box.x0 - tolerance && point.x <= box.x1 + tolerance &&
    point.y >= box.y0 - tolerance && point.y <= box.y1 + tolerance) || null;
}

function findPanel(layout, name) {
  for (const node of layoutNodes(layout)) {
    if (node.type !== "split") continue;
    const index = node.panels.findIndex((panel) => panel.name === name);
    if (index >= 0) return { split: node, index };
  }
  return null;
}

// The two openings on both sides of a panel along its axis: where the panel may move.
export function panelRegion(p, name) {
  const found = findPanel(p.layout, name);
  if (!found) throw new Error(`Панель «${name}» не найдена в эскизе.`);
  const { split, index } = found;
  const { nodeBoxes } = resolveLayout(p.layout, cabinetInterior(p), p.thickness);
  const first = nodeBoxes.get(split.children[index].node.id);
  const second = nodeBoxes.get(split.children[index + 1].node.id);
  const [start, before] = split.axis === "x" ? [first.x0, first.x1 - first.x0] : [first.y0, first.y1 - first.y0];
  const [end, after] = split.axis === "x" ? [second.x1, second.x1 - second.x0] : [second.y1, second.y1 - second.y0];
  const box = split.axis === "x" ? { ...first, x1: second.x1 } : { ...first, y1: second.y1 };
  return { axis: split.axis, start, end, before, after, center: start + before + p.thickness / 2, box };
}

// Moves a panel so that its centre is at `center` («резиновая нить»): only the two openings next to it
// change, the rest of the cabinet keeps its sizes. Returns a new layout.
export function movePanel(p, name, center) {
  const region = panelRegion(p, name);
  const T = p.thickness;
  const before = Math.round((center - T / 2 - region.start) * 1000) / 1000;
  const after = Math.round((region.end - center - T / 2) * 1000) / 1000;
  if (before < layoutLimits.minOpening || after < layoutLimits.minOpening) {
    throw new Error("Панель нельзя сдвинуть так далеко: проём по одну из сторон исчез бы.");
  }
  const next = structuredClone(p.layout);
  const { split, index } = findPanel(next, name);
  const [first, second] = [split.children[index], split.children[index + 1]];
  const rubber = [first, second].filter((child) => child.size === null);
  first.size = before;
  second.size = after;
  // Fixing both exact sizes keeps other rubber openings unchanged; if no rubber one is left,
  // one neighbour stays rubber — being the only one, it gets exactly its new size.
  if (!split.children.some((child) => child.size === null)) (rubber.at(-1) || second).size = null;
  if (!validLayout(next)) throw new Error("Не удалось сдвинуть панель: дерево проёмов стало бы неверным.");
  return next;
}

// Removes a panel and merges the openings on both sides. If both sides are already subdivided,
// the panel is kept: otherwise one side's content would disappear. Returns a new layout.
export function removePanel(p, name) {
  const region = panelRegion(p, name);
  const next = structuredClone(p.layout);
  const { split, index } = findPanel(next, name);
  const [first, second] = [split.children[index], split.children[index + 1]];
  if (first.node.type === "split" && second.node.type === "split") {
    throw new Error("По обе стороны панели есть деления. Сначала удалите панели в одном из проёмов.");
  }
  const kept = first.node.type === "split" ? first.node : second.node.type === "split" ? second.node : first.node;
  const merged = { size: Math.round((region.end - region.start) * 1000) / 1000, node: kept };
  split.children.splice(index, 2, merged);
  split.panels.splice(index, 1);
  if (!split.children.some((child) => child.size === null)) merged.size = null;
  if (split.children.length === 1) {
    // A split with one child is just that child.
    const replacement = split.children[0].node;
    const parent = findParent(next, split.id);
    if (parent) parent.node.children[parent.index].node = replacement;
    else next.root = replacement;
  }
  if (!validLayout(next)) throw new Error("Не удалось удалить панель: дерево проёмов стало бы неверным.");
  return next;
}

// Voice and text commands of the sketch mode. Numbers and units come from the editor's voice parser
// (helpers.number for words like «три», helpers.toMm for units); a size without a unit is taken in mm.
const commandNumber = "(\\d+(?:[.,]\\d+)?)";
const commandUnit = "(миллиметр(?:а|ов|ы)?|сантиметр(?:а|ов|ы)?|метр(?:а|ов)?|мм|см|м)?";
const middleWords = "посередине|посредине|по\\s+центру|в\\s+центре|в\\s+середин[а-я]*";
const countWords = "\\d+|два|две|двух|три|трех|четыре|четырех|пять|пяти|шесть|шести|семь|восемь|девять|десять";

export function parseSketchCommand(text, helpers) {
  const source = String(text || "").trim();
  const t = source.toLocaleLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ");
  const notes = [];
  const mm = (value, unit) => {
    if (!unit) notes.push(`${value} — единицы не названы, приняты миллиметры`);
    return Math.round(helpers.toMm(Number(String(value).replace(",", ".")), unit || "мм") * 1000) / 1000;
  };
  if (/двер|фасад|ящик|шухляд/.test(t)) {
    return { type: "unsupported", source, reason: "Двери и ящики по проёмам появятся на шаге 6 — после ответов о фасадах и ящиках." };
  }
  const frame = t.match(new RegExp(`${commandNumber}\\s*${commandUnit}\\s*(?:на|x|х|×)\\s*${commandNumber}\\s*${commandUnit}\\s*(?:на|x|х|×)\\s*${commandNumber}\\s*${commandUnit}`));
  if (frame) {
    // «800 на 720 на 560 мм»: a unit named once applies to all three sizes.
    const shared = frame[6] || frame[4] || frame[2];
    const [width, height, depth] = [[frame[1], frame[2]], [frame[3], frame[4]], [frame[5], frame[6]]]
      .map(([value, unit]) => mm(value, unit || shared));
    return { type: "frame", source, width, height, depth, notes };
  }
  const shelfAt = t.match(new RegExp(`полк[а-яa-z]*\\s+(?:на\\s+)?высот[а-яa-z]*\\s+${commandNumber}\\s*${commandUnit}`));
  if (shelfAt) return { type: "shelf-at", source, height: mm(shelfAt[1], shelfAt[2]), notes };
  const split = t.match(new RegExp(`(?:раздел|подел)[а-яa-z]*.*?на\\s+(${countWords})(?![а-я\\d])`));
  if (split) {
    const count = helpers.number(split[1]);
    const vertical = /вертикал|перегородк|столб|колонк/.test(t);
    if (!vertical && !/горизонтал|полк|ряд/.test(t)) notes.push("направление не названо — проём делится полками (по горизонтали)");
    return { type: "split", source, axis: vertical ? "x" : "y", count, notes };
  }
  if (new RegExp(`полк[а-яa-z]*.*(?:${middleWords})|(?:${middleWords}).*полк`).test(t)) return { type: "middle", source, axis: "y", notes };
  if (new RegExp(`перегородк[а-яa-z]*.*(?:${middleWords})|(?:${middleWords}).*перегородк`).test(t)) return { type: "middle", source, axis: "x", notes };
  return { type: "unknown", source };
}

// Plans a parsed command on the active sketch: which opening it applies to and the new layout.
// selectedId — the opening chosen in the sketch, if any; cabinetY — height of the cabinet base above the floor.
// «Полка на высоте H» measures H from the floor to the centre of the shelf (answer of 06.11.2026).
export function planSketchCommand(p, command, { selectedId = null, cabinetY = 0 } = {}) {
  const { openings } = resolveLayout(p.layout, cabinetInterior(p), p.thickness);
  const chosen = () => {
    if (selectedId) {
      const opening = openings.find((item) => item.id === selectedId);
      if (opening) return opening;
    }
    if (openings.length === 1) return openings[0];
    throw new Error("В корпусе несколько проёмов — сначала выберите проём инструментом «Выбор проёма».");
  };
  if (command.type === "split") {
    const opening = chosen();
    return { layout: splitOpening(p.layout, opening.id, command.axis, command.count), openingId: opening.id,
      message: `Проём разделён поровну на ${command.count} ${command.axis === "x" ? "перегородками" : "полками"}.` };
  }
  if (command.type === "middle") {
    const opening = chosen();
    const box = opening.box;
    const center = command.axis === "x" ? (box.x0 + box.x1) / 2 : (box.y0 + box.y1) / 2;
    const { layout, name } = insertPanel(p, opening.id, command.axis, center);
    return { layout, openingId: opening.id, message: `«${name}» поставлена посередине проёма.` };
  }
  if (command.type === "shelf-at") {
    const center = command.height - cabinetY;
    const candidates = openings.filter(({ box }) => center > box.y0 && center < box.y1);
    const selected = selectedId && candidates.find((item) => item.id === selectedId);
    const opening = selected || (candidates.length === 1 ? candidates[0] : null);
    if (!opening) {
      throw new Error(candidates.length
        ? `На высоте ${command.height} мм несколько проёмов — выберите нужный инструментом «Выбор проёма».`
        : `На высоте ${command.height} мм от пола нет проёма этого корпуса.`);
    }
    const { layout, name } = insertPanel(p, opening.id, "y", center);
    return { layout, openingId: opening.id, message: `«${name}»: центр на высоте ${command.height} мм от пола.` };
  }
  throw new Error("Эта команда не меняет проёмы.");
}

const toolLabels ={ select: "Выбор проёма", x: "Вертикальная панель", y: "Горизонтальная панель" };

// Sketch mode UI. The editor passes what the mode needs, the 3D scene stays in assembly-editor.js:
//   selectedCabinet() → product | null; createCabinet({ width, height, depth }) → product;
//   applyLayout(product, layout); setView(name, focusProduct); pointerToCabinet(event, product) → { x, y } | null;
//   mmPerPixel() → number; showPreview(product, boxes) with boxes in cabinet mm; formDefaults();
//   resizeCabinet(product, { width, height, depth }) → boolean; voiceHelpers { number, toMm };
//   speechAllowed() → boolean; canvas — the 3D canvas element.
export function mountSketchMode(host, ctx) {
  const section = document.createElement("section");
  section.id = "sketch-panel";
  section.innerHTML = `
    <h3>Режим эскиза</h3>
    <p class="note">Рисование в виде спереди: панель встаёт в проём под курсором, её длина считается по проёму с учётом толщин. Привязки — середина, трети, четверти проёма и уже стоящие панели.</p>
    <div class="sketch-row">
      <label>Ширина, мм<input id="sketch-width" type="number" min="300" max="3000" step="1"></label>
      <label>Высота, мм<input id="sketch-height" type="number" min="300" max="3000" step="1"></label>
      <label>Глубина, мм<input id="sketch-depth" type="number" min="200" max="1200" step="1"></label>
    </div>
    <div class="sketch-row">
      <button type="button" id="sketch-new">Новый корпус эскизом</button>
      <button type="button" id="sketch-edit">Эскиз выбранного корпуса</button>
    </div>
    <div class="sketch-row">
      <label>Команда<input id="sketch-command" maxlength="200" placeholder="поставь полку посередине"></label>
      <button type="button" id="sketch-command-run">Выполнить</button>
      <button type="button" id="sketch-command-voice" title="Сказать команду (распознавание браузера)">🎤 Сказать</button>
    </div>
    <p class="note">Команды: «корпус 800 на 720 на 560», «поставь полку посередине», «перегородку посередине», «раздели проём на три», «раздели на две по вертикали», «полка на высоте 800» (от пола до центра полки). Без единиц размеры — в мм.</p>
    <div id="sketch-tools" hidden>
      <div class="sketch-row" role="radiogroup" aria-label="Инструмент эскиза">
        ${Object.entries(toolLabels).map(([tool, label]) =>
    `<button type="button" role="radio" aria-checked="false" data-sketch-tool="${tool}">${label}</button>`).join("")}
      </div>
      <div class="sketch-row">
        <label>Выбранный проём поровну на<input id="sketch-equal" type="number" min="2" max="20" step="1" value="2"></label>
        <button type="button" data-sketch-equal="x">по вертикали</button>
        <button type="button" data-sketch-equal="y">по горизонтали</button>
      </div>
      <div id="sketch-panel-edit" hidden>
        <strong id="sketch-panel-name"></strong>
        <div class="sketch-row">
          <label><span id="sketch-before-label">До панели</span>, мм<input id="sketch-before" type="number" min="1" step="1"></label>
          <label><span id="sketch-after-label">После панели</span>, мм<input id="sketch-after" type="number" min="1" step="1"></label>
        </div>
        <div class="sketch-row">
          <button type="button" id="sketch-panel-apply">Применить размер</button>
          <button type="button" id="sketch-panel-delete">Удалить панель (Delete)</button>
        </div>
      </div>
      <button type="button" id="sketch-exit">Завершить эскиз</button>
    </div>
    <p id="sketch-status" class="note" role="status" aria-live="polite"></p>`;
  host.append(section);
  const get = (id) => section.querySelector(`#${id}`);
  const state = { productId: null, tool: "select", openingId: null, hover: null, panelName: null, drag: null };
  const status = (text) => { get("sketch-status").textContent = text; };
  const product = () => {
    const item = ctx.selectedCabinet();
    return item && item.id === state.productId ? item : null;
  };

  const syncButtons = () => {
    const active = !!product();
    get("sketch-tools").hidden = !active;
    get("sketch-edit").disabled = active || !ctx.selectedCabinet()?.parameters.layout;
    section.querySelectorAll("[data-sketch-tool]").forEach((button) =>
      button.setAttribute("aria-checked", String(button.dataset.sketchTool === state.tool)));
    section.querySelectorAll("[data-sketch-equal]").forEach((button) => { button.disabled = !state.openingId; });
    syncPanelEditor();
  };
  // Exact sizes of the openings on both sides of the selected panel.
  const syncPanelEditor = () => {
    const item = product();
    let region = null;
    try {
      region = item && state.panelName ? panelRegion(item.parameters, state.panelName) : null;
    } catch {
      state.panelName = null;
    }
    get("sketch-panel-edit").hidden = !region;
    if (!region) return;
    get("sketch-panel-name").textContent = `Выбрана «${state.panelName}»`;
    get("sketch-before-label").textContent = region.axis === "x" ? "Слева" : "Снизу";
    get("sketch-after-label").textContent = region.axis === "x" ? "Справа" : "Сверху";
    if (document.activeElement !== get("sketch-before")) get("sketch-before").value = Math.round(region.before * 10) / 10;
    if (document.activeElement !== get("sketch-after")) get("sketch-after").value = Math.round(region.after * 10) / 10;
  };
  const deleteSelectedPanel = () => {
    const item = product();
    if (!item || !state.panelName) return;
    try {
      const name = state.panelName;
      const layout = removePanel(item.parameters, name);
      state.panelName = null;
      ctx.applyLayout(item, layout);
      ctx.showPreview(item, []);
      status(`«${name}» удалена, проёмы по её сторонам объединены.`);
    } catch (error) {
      status(error.message);
    }
    syncButtons();
  };
  const fillDefaults = () => {
    const defaults = ctx.formDefaults();
    for (const key of ["width", "height", "depth"]) {
      if (!get(`sketch-${key}`).value) get(`sketch-${key}`).value = defaults[key];
    }
  };

  const enter = (item) => {
    if (!item?.parameters.layout) {
      status("Эскиз доступен для корпусов, созданных в режиме эскиза. Перевод существующих корпусов ждёт ответа (вопрос 6 открытых вопросов).");
      return;
    }
    if ((item.rotationY || 0) !== 0) {
      status("Для эскиза поверните корпус на 0°: рисование идёт в виде спереди проекта.");
      return;
    }
    state.productId = item.id;
    state.tool = "select";
    state.openingId = null;
    state.panelName = null;
    state.drag = null;
    ctx.setView("front", item);
    status(`Эскиз «${item.name}». Выберите инструмент и щёлкните в проёме.`);
    syncButtons();
  };
  const exit = () => {
    state.productId = null;
    state.hover = null;
    state.openingId = null;
    state.panelName = null;
    state.drag = null;
    ctx.showPreview(null, []);
    status("Эскиз завершён. Корпус — обычная модель FURNIX: спецификация, проверки и раскрой работают как обычно.");
    syncButtons();
  };

  get("sketch-new").onclick = () => {
    const size = Object.fromEntries(["width", "height", "depth"].map((key) => [key, Number(get(`sketch-${key}`).value)]));
    const item = ctx.createCabinet(size);
    if (!item) {
      status("Корпус не создан: ширина и высота 300–3000 мм, глубина 200–1200 мм.");
      return;
    }
    enter(item);
  };
  get("sketch-edit").onclick = () => enter(ctx.selectedCabinet());

  // A recognised or typed command does the same as the matching mouse action.
  const runCommand = (text) => {
    const command = parseSketchCommand(text, ctx.voiceHelpers);
    const notes = command.notes?.length ? ` (${command.notes.join("; ")})` : "";
    if (command.type === "unknown") {
      status(`Команда «${command.source}» не распознана. Примеры — под полем команды.`);
      return command;
    }
    if (command.type === "unsupported") {
      status(command.reason);
      return command;
    }
    if (command.type === "frame") {
      const item = product();
      const size = { width: command.width, height: command.height, depth: command.depth };
      if (item) {
        if (!ctx.resizeCabinet(item, size)) {
          status(`Размер не принят: ширина и высота 300–3000 мм, глубина 200–1200 мм${notes}.`);
          return command;
        }
        status(`Габарит «${item.name}»: ${size.width}×${size.height}×${size.depth} мм${notes}.`);
      } else {
        Object.entries(size).forEach(([key, value]) => { get(`sketch-${key}`).value = value; });
        const created = ctx.createCabinet(size);
        if (!created) {
          status(`Корпус не создан: ширина и высота 300–3000 мм, глубина 200–1200 мм${notes}.`);
          return command;
        }
        enter(created);
        status(`Новый корпус эскизом ${size.width}×${size.height}×${size.depth} мм${notes}.`);
      }
      return command;
    }
    const item = product();
    if (!item) {
      status("Сначала начните эскиз: «Новый корпус эскизом» или команда «корпус 800 на 720 на 560».");
      return command;
    }
    try {
      const plan = planSketchCommand(item.parameters, command, { selectedId: state.openingId, cabinetY: item.y || 0 });
      state.openingId = null;
      state.panelName = null;
      ctx.applyLayout(item, plan.layout);
      ctx.showPreview(item, []);
      status(`${plan.message}${notes}`);
    } catch (error) {
      status(`${error.message}${notes}`);
    }
    syncButtons();
    return command;
  };
  get("sketch-command-run").onclick = () => runCommand(get("sketch-command").value);
  get("sketch-command").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(get("sketch-command").value);
    }
  });
  get("sketch-command-voice").onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition !== "function") {
      status("Распознавание речи недоступно в этом браузере. Введите команду текстом.");
      return;
    }
    if (!ctx.speechAllowed()) {
      status("Для записи включите согласие на распознавание речи в блоке «Описание голосом». Команду можно ввести текстом.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    let heard = "";
    let failure = null;
    recognition.onresult = (event) => {
      heard = [...event.results].map((result) => result[0]?.transcript || "").join(" ").trim();
    };
    recognition.onerror = (event) => { failure = event.error || "unknown"; };
    // The command runs when recording ends, so silence and errors are reported instead of a hanging prompt.
    recognition.onend = () => {
      get("sketch-command-voice").disabled = false;
      if (heard) {
        get("sketch-command").value = heard;
        runCommand(heard);
      } else if (failure) {
        status(`${ctx.voiceHelpers.errorText?.(failure) || `Ошибка распознавания (${failure}).`} Команду можно ввести текстом.`);
      } else {
        status("Команда не услышана. Нажмите «Сказать» и говорите сразу; команду можно ввести текстом.");
      }
    };
    get("sketch-command-voice").disabled = true;
    status("● Говорите команду…");
    try {
      recognition.start();
    } catch (error) {
      get("sketch-command-voice").disabled = false;
      status(`Не удалось начать запись: ${error.message}. Команду можно ввести текстом.`);
    }
  };
  get("sketch-exit").onclick = exit;
  get("sketch-panel-delete").onclick = deleteSelectedPanel;
  get("sketch-panel-apply").onclick = () => {
    const item = product();
    if (!item || !state.panelName) return;
    try {
      const region = panelRegion(item.parameters, state.panelName);
      const before = Number(get("sketch-before").value);
      const after = Number(get("sketch-after").value);
      const T = item.parameters.thickness;
      // Whichever field changed sets the position; the other one follows from the opening.
      const useBefore = Math.abs(before - region.before) >= 0.05 || Math.abs(after - region.after) < 0.05;
      if (!Number.isFinite(useBefore ? before : after)) throw new Error("Введите размер в миллиметрах.");
      const center = useBefore ? region.start + before + T / 2 : region.end - after - T / 2;
      ctx.applyLayout(item, movePanel(item.parameters, state.panelName, center));
      const moved = panelRegion(item.parameters, state.panelName);
      status(`«${state.panelName}»: ${Math.round(moved.before * 10) / 10} / ${Math.round(moved.after * 10) / 10} мм.`);
    } catch (error) {
      status(error.message);
    }
    syncButtons();
  };
  section.addEventListener("click", (event) => {
    const tool = event.target.closest("[data-sketch-tool]");
    if (tool) {
      state.tool = tool.dataset.sketchTool;
      status(state.tool === "select" ? "Щёлкните в проёме, чтобы выбрать его." : `${toolLabels[state.tool]}: наведите на проём и щёлкните.`);
      syncButtons();
    }
    const equal = event.target.closest("[data-sketch-equal]");
    if (equal && product() && state.openingId) {
      try {
        const count = Number(get("sketch-equal").value);
        ctx.applyLayout(product(), splitOpening(product().parameters.layout, state.openingId, equal.dataset.sketchEqual, count));
        status(`Проём разделён поровну на ${count} (${equal.dataset.sketchEqual === "x" ? "по вертикали" : "по горизонтали"}).`);
        state.openingId = null;
        ctx.showPreview(product(), []);
      } catch (error) {
        status(error.message);
      }
      syncButtons();
    }
  });

  // Hover: the opening under the pointer and, for a drawing tool, the snapped panel.
  const track = (event) => {
    const item = product();
    if (!item) return null;
    const point = ctx.pointerToCabinet(event, item);
    const p = item.parameters;
    if (state.drag) {
      if (!point) return null;
      const region = panelRegion(p, state.drag.name);
      const raw = region.axis === "x" ? point.x : point.y;
      const snap = snapPanelCenter(p, { box: region.box }, region.axis, raw, ctx.mmPerPixel() * 12);
      if (!snap) return null;
      state.drag.center = snap.center;
      state.drag.moved = state.drag.moved || Math.abs(snap.center - region.center) > 0.0005;
      const box = region.axis === "x"
        ? { ...region.box, x0: snap.center - p.thickness / 2, x1: snap.center + p.thickness / 2, kind: "panel" }
        : { ...region.box, y0: snap.center - p.thickness / 2, y1: snap.center + p.thickness / 2, kind: "panel" };
      ctx.showPreview(item, [{ ...region.box, kind: "opening" }, box]);
      status(`«${state.drag.name}»: ${Math.round(snap.before)} мм ${region.axis === "x" ? "слева" : "снизу"} · ${Math.round(snap.after)} мм ${region.axis === "x" ? "справа" : "сверху"}${snap.label ? ` · привязка: ${snap.label}` : ""}`);
      return null;
    }
    if (state.tool === "select" && point) {
      const panel = panelAt(p, point, ctx.mmPerPixel() * 4);
      if (panel) {
        state.hover = { panel };
        ctx.showPreview(item, [...selectedBoxes(item), { ...panel.box, kind: "hoverPanel" }]);
        status(`«${panel.name}»: щёлкните, чтобы выбрать, или перетащите.`);
        return state.hover;
      }
    }
    const opening = point && openingAt(p, point);
    if (!opening) {
      state.hover = null;
      ctx.showPreview(item, selectedBoxes(item));
      return null;
    }
    const axis = state.tool === "select" ? null : state.tool;
    const snap = axis && snapPanelCenter(p, opening, axis, axis === "x" ? point.x : point.y, ctx.mmPerPixel() * 12);
    state.hover = { opening, axis, snap };
    const boxes = [...selectedBoxes(item), { ...opening.box, kind: "opening" }];
    if (snap) {
      boxes.push(axis === "x"
        ? { ...opening.box, x0: snap.center - p.thickness / 2, x1: snap.center + p.thickness / 2, kind: "panel" }
        : { ...opening.box, y0: snap.center - p.thickness / 2, y1: snap.center + p.thickness / 2, kind: "panel" });
    }
    ctx.showPreview(item, boxes);
    const box = opening.box;
    status(snap
      ? `${axis === "x" ? "Перегородка" : "Полка"}: ${Math.round(snap.before)} мм ${axis === "x" ? "слева" : "снизу"} · ${Math.round(snap.after)} мм ${axis === "x" ? "справа" : "сверху"}${snap.label ? ` · привязка: ${snap.label}` : ""}`
      : `Проём ${Math.round(box.x1 - box.x0)} × ${Math.round(box.y1 - box.y0)} мм`);
    return state.hover;
  };
  const selectedBoxes = (item) => {
    const resolved = resolveLayout(item.parameters.layout, cabinetInterior(item.parameters), item.parameters.thickness);
    const opening = state.openingId && resolved.openings.find((entry) => entry.id === state.openingId);
    const panel = state.panelName && resolved.panels.find((entry) => entry.name === state.panelName);
    return [
      ...(opening ? [{ ...opening.box, kind: "selected" }] : []),
      ...(panel ? [{ ...panel.box, kind: "selectedPanel" }] : []),
    ];
  };
  ctx.canvas.addEventListener("pointermove", track);
  ctx.canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !product()) return;
    const hover = track(event);
    if (!hover) return;
    if (state.tool === "select" && hover.panel) {
      state.panelName = hover.panel.name;
      state.openingId = null;
      state.drag = { name: hover.panel.name, center: null, moved: false };
      ctx.showPreview(product(), selectedBoxes(product()));
      status(`Выбрана «${hover.panel.name}». Перетащите её или введите размер; Delete — удалить.`);
      syncButtons();
      return;
    }
    if (state.tool === "select") {
      state.panelName = null;
      state.openingId = hover.opening.id;
      ctx.showPreview(product(), selectedBoxes(product()));
      status(`Выбран проём ${Math.round(hover.opening.box.x1 - hover.opening.box.x0)} × ${Math.round(hover.opening.box.y1 - hover.opening.box.y0)} мм. Его можно разделить поровну.`);
      syncButtons();
      return;
    }
    if (!hover.snap) {
      status("Проём слишком мал для панели.");
      return;
    }
    try {
      const { layout, name } = insertPanel(product().parameters, hover.opening.id, hover.axis, hover.snap.center);
      ctx.applyLayout(product(), layout);
      status(`Добавлена «${name}»: ${Math.round(hover.snap.before)} / ${Math.round(hover.snap.after)} мм.`);
      track(event);
    } catch (error) {
      status(error.message);
    }
  });
  // Releasing the button ends a drag: one move is one undo step.
  window.addEventListener("pointerup", () => {
    const drag = state.drag;
    state.drag = null;
    const item = product();
    if (!drag || !item || !drag.moved || drag.center === null) return;
    try {
      ctx.applyLayout(item, movePanel(item.parameters, drag.name, drag.center));
      const region = panelRegion(item.parameters, drag.name);
      status(`«${drag.name}» перенесена: ${Math.round(region.before)} / ${Math.round(region.after)} мм.`);
    } catch (error) {
      status(error.message);
    }
    ctx.showPreview(item, selectedBoxes(item));
    syncButtons();
  });
  document.addEventListener("keydown", (event) => {
    if (!product() || event.target.closest?.("input, textarea, select")) return;
    if (event.key === "Delete" && state.panelName) {
      event.preventDefault();
      deleteSelectedPanel();
      return;
    }
    if (event.key !== "Escape") return;
    if (state.drag) {
      state.drag = null;
      ctx.showPreview(product(), selectedBoxes(product()));
      status("Перенос отменён.");
      return;
    }
    if (state.tool !== "select") {
      state.tool = "select";
      status("Инструмент сброшен: выбор проёма.");
      syncButtons();
    } else if (state.panelName || state.openingId) {
      state.panelName = null;
      state.openingId = null;
      ctx.showPreview(product(), []);
      status("Выбор снят.");
      syncButtons();
    }
  });

  fillDefaults();
  syncButtons();
  return {
    // While a sketch is active, a click in the 3D view belongs to the sketch, not to part selection.
    isDrawing: () => !!product(),
    runCommand,
    refresh: () => {
      if (state.productId && !product()) exit();
      syncButtons();
    },
  };
}

// Fixes the size of a child opening (mm) or makes it rubber again (null). Returns a new layout.
export function setOpeningSize(layout, openingId, size) {
  const next = structuredClone(layout);
  for (const node of layoutNodes(next)) {
    if (node.type !== "split") continue;
    const child = node.children.find((item) => item.node.id === openingId);
    if (!child) continue;
    child.size = size;
    if (!validLayout(next)) throw new Error("Хотя бы один проём деления должен оставаться «резиновым».");
    return next;
  }
  throw new Error(`Проём «${openingId}» не входит ни в одно деление.`);
}
