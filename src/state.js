import { DEFAULT_SETTINGS } from './config.js';

// Modelo del documento. Todo lo que se guarda está aquí.
// Versión 3: los módulos son cajas libres en metros (cada uno con su posición y
// sus medidas); las piezas se colocan en metros y con altura de base libre.
export function newState() {
  return {
    version: 3,
    settings: { ...DEFAULT_SETTINGS },
    modules: [],        // { id, x, y, z, w, h, d, floors: { top?: color, bottom?: color }, floorShapes: { top?: { kind: 'half'|'tri', r: 0..3 } }, nets: { '+x'?: color, ... } }
    coquillaColors: {}, // tubeKey -> colorId ('sin' = tubo sin coquilla)
    hiddenTubes: {},    // tubeKey -> true (tramos de tubo quitados a mano)
    elements: [],       // { id, type, x, y, z (m, mundo; y = altura de la base), r, colors: {}, estilo?, size?: {l,a,h} cm }
    prices: {},         // key -> precio unitario (override)
    nextId: 1,
  };
}

export class Store {
  constructor() {
    this.state = newState();
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.state); }
  snapshot() { return JSON.stringify(this.state); }
  // Toda mutación pasa por aquí: guarda undo, aplica y notifica.
  mutate(fn) {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack.length = 0;
    fn(this.state);
    this.emit();
  }
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.state = JSON.parse(this.undoStack.pop());
    this.emit();
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.state = JSON.parse(this.redoStack.pop());
    this.emit();
  }
  load(obj) {
    const s = newState();
    this.state = migrate({ ...s, ...obj, settings: { ...s.settings, ...(obj.settings || {}) } });
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.emit();
  }
  reset() { this.load(newState()); }
}

// ---------------------------------------------------------------------------
// Migración de formatos antiguos (v1: rejilla fija; v2: rejilla con medidas por fila/columna).
function migrate(st) {
  const v = st.version || 1;
  if (v >= 3) { st.modules = st.modules || []; st.hiddenTubes = st.hiddenTubes || {}; for (const m of st.modules) { m.floors = m.floors || {}; m.nets = m.nets || {}; m.floorShapes = m.floorShapes || {}; } return st; }
  const s = st.settings, grid = st.grid || { x: {}, y: {}, z: {} };
  const size = (ax, i) => ((grid[ax] && grid[ax][i]) > 0 ? grid[ax][i] : (ax === 'y' ? s.altura : s.vano)) / 100;
  const pos = (ax, i) => { let p = 0; if (i >= 0) for (let k = 0; k < i; k++) p += size(ax, k); else for (let k = i; k < 0; k++) p -= size(ax, k); return p; };
  const modules = []; const byCell = new Map();
  let nextId = st.nextId || 1;
  for (const k of Object.keys(st.cells || {})) {
    const [x, y, z] = k.split(',').map(Number);
    const m = { id: nextId++, x: r3(pos('x', x)), y: r3(pos('y', y)), z: r3(pos('z', z)), w: r3(size('x', x)), h: r3(size('y', y)), d: r3(size('z', z)), floors: {}, nets: {} };
    modules.push(m); byCell.set(k, m);
  }
  for (const [k, f] of Object.entries(st.floors || {})) {
    const [x, py, z] = k.split(',').map(Number);
    const below = byCell.get(`${x},${py - 1},${z}`), here = byCell.get(`${x},${py},${z}`);
    if (py > 0 && below) below.floors.top = f.color; else if (here) here.floors.bottom = f.color;
  }
  for (const [k, n] of Object.entries(st.nets || {})) {
    const [axis, rest] = k.split(':'); const [px, y, pz] = rest.split(',').map(Number);
    const a = byCell.get(`${px},${y},${pz}`);
    const b = axis === 'x' ? byCell.get(`${px - 1},${y},${pz}`) : byCell.get(`${px},${y},${pz - 1}`);
    if (a) a.nets[axis === 'x' ? '-x' : '-z'] = n.color; else if (b) b.nets[axis === 'x' ? '+x' : '+z'] = n.color;
  }
  const V = s.vano / 100;
  const elements = (st.elements || []).map(e => {
    const x = v === 1 ? (e.x + 0.5) * V : e.x, z = v === 1 ? (e.z + 0.5) * V : e.z;
    return { ...e, x: r3(x), z: r3(z), y: r3(pos('y', e.y)) };
  });
  return { ...newState(), settings: s, modules, elements, coquillaColors: {}, prices: st.prices || {}, nextId };
}

// Helpers de dominio -------------------------------------------------------

export const r3 = n => Math.round(n * 1000) / 1000;
export const cm = m => Math.round(m * 100);

export function moduleById(state, id) { return state.modules.find(m => m.id === id); }

// ¿El punto (x, z) cae dentro de la planta del módulo?
export function inFootprint(m, x, z, tol = 0.001) {
  return x >= m.x - tol && x <= m.x + m.w + tol && z >= m.z - tol && z <= m.z + m.d + tol;
}

// Módulo sobre el que "vive" una pieza: el que arranca a su altura (y) y la contiene en planta.
// Si no hay, el módulo cuya tapa está a esa altura; si no, cualquiera que la contenga.
export function moduleFor(state, el) {
  const here = state.modules.filter(m => inFootprint(m, el.x, el.z));
  return here.find(m => Math.abs(m.y - el.y) < 0.02) || here.find(m => Math.abs(m.y + m.h - el.y) < 0.09) || here[0] || null;
}

// Ajustes "locales" para catálogo y modelos: medidas del módulo donde está la pieza.
export function localSettings(state, el) {
  const s = state.settings, m = moduleFor(state, el);
  const w = m ? cm(m.w) : s.vano, d = m ? cm(m.d) : s.vano, h = m ? cm(m.h) : s.altura;
  return { ...s, vano: el.r % 2 ? d : w, fondo: el.r % 2 ? w : d, altura: h, caida: cm(el.y) };
}

// Alturas (m) a las que se puede apoyar una pieza en (x, z): suelo, bases y tapas de módulos.
export function levelsAt(state, x, z) {
  const set = new Set([0]);
  for (const m of state.modules) if (inFootprint(m, x, z)) { set.add(r3(m.y)); set.add(r3(m.y + m.h)); }
  return [...set].sort((a, b) => a - b);
}

// Rectángulo (mundo) de una cara de módulo. face: '+x' '-x' '+z' '-z' 'top' 'bottom'
export function faceRect(m, face) {
  if (face === 'top' || face === 'bottom') return { axis: 'y', at: face === 'top' ? m.y + m.h : m.y, u0: m.x, u1: m.x + m.w, v0: m.z, v1: m.z + m.d };
  if (face[1] === 'x') return { axis: 'x', at: face === '+x' ? m.x + m.w : m.x, u0: m.z, u1: m.z + m.d, v0: m.y, v1: m.y + m.h };
  return { axis: 'z', at: face === '+z' ? m.z + m.d : m.z, u0: m.x, u1: m.x + m.w, v0: m.y, v1: m.y + m.h };
}
// Forma de una plataforma: 'full' (entera), 'half' (mitad) o 'tri' (triángulo), con giro r (0..3).
export const FLOOR_SHAPES = [{ id: 'full', name: 'Entera' }, { id: 'half', name: 'Mitad' }, { id: 'tri', name: 'Triángulo' }];
export function floorShape(m, face) { const fs = m.floorShapes && m.floorShapes[face]; return fs && fs.kind && fs.kind !== 'full' ? { kind: fs.kind, r: (fs.r || 0) % 4 } : { kind: 'full', r: 0 }; }
export const floorAreaFactor = sh => sh.kind === 'full' ? 1 : 0.5;
export const rectKey = r => `${r.axis}|${cm(r.at)}|${cm(r.u0)}|${cm(r.u1)}|${cm(r.v0)}|${cm(r.v1)}`;

export function bounds(state) {
  // Caja envolvente en metros (mundo): módulos y piezas.
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const add = (x0, y0, z0, x1, y1, z1) => {
    min = [Math.min(min[0], x0), Math.min(min[1], y0), Math.min(min[2], z0)];
    max = [Math.max(max[0], x1), Math.max(max[1], y1), Math.max(max[2], z1)];
  };
  for (const m of state.modules) add(m.x, m.y, m.z, m.x + m.w, m.y + m.h, m.z + m.d);
  for (const e of state.elements) add(e.x - 0.3, e.y, e.z - 0.3, e.x + 0.3, e.y + 0.5, e.z + 0.3);
  if (min[0] === Infinity) return null;
  const tops = new Set(state.modules.map(m => cm(m.y + m.h)));
  return { min, max, plantas: tops.size };
}

// Resumen de medidas de módulo usadas (para la cota informativa y la ficha).
export function moduleSummary(state) {
  const set = new Set();
  for (const m of state.modules) set.add(`${cm(m.w)}×${cm(m.d)}×${cm(m.h)}`);
  return [...set];
}
