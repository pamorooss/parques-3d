import { UNIONES } from './config.js';
import { cm } from './state.js';

// Deriva tubos (tramos) y nudos (uniones) a partir de los módulos. Trabaja en cm
// enteros. Cada módulo aporta sus 12 aristas; las aristas que comparten línea se
// parten en todos los puntos donde termina alguna (ahí va una unión) y se unifican.
export function deriveStructure(state) {
  const lines = new Map(); // "axis|c1|c2" -> { axis, c1, c2, segs: [[a,b], ...] }
  const idx = { x: 0, y: 1, z: 2 };
  const addSeg = (axis, c1, c2, a, b) => {
    const k = `${axis}|${c1}|${c2}`;
    if (!lines.has(k)) lines.set(k, { axis, c1, c2, segs: [] });
    lines.get(k).segs.push([Math.min(a, b), Math.max(a, b)]);
  };
  for (const m of state.modules) {
    const x0 = cm(m.x), y0 = cm(m.y), z0 = cm(m.z), x1 = cm(m.x + m.w), y1 = cm(m.y + m.h), z1 = cm(m.z + m.d);
    for (const y of [y0, y1]) for (const z of [z0, z1]) addSeg('x', y, z, x0, x1);
    for (const x of [x0, x1]) for (const z of [z0, z1]) addSeg('y', x, z, y0, y1);
    for (const x of [x0, x1]) for (const y of [y0, y1]) addSeg('z', x, y, z0, z1);
  }
  // Punto 3D (cm) de una coordenada t sobre la línea.
  const point = (l, t) => l.axis === 'x' ? [t, l.c1, l.c2] : l.axis === 'y' ? [l.c1, t, l.c2] : [l.c1, l.c2, t];

  const tubes = []; const nodes = new Map();
  const touch = (p, dir) => { const k = p.join(','); if (!nodes.has(k)) nodes.set(k, new Set()); nodes.get(k).add(dir); };
  for (const l of lines.values()) {
    const cuts = [...new Set(l.segs.flat())].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (!l.segs.some(s => s[0] <= a && s[1] >= b)) continue; // hueco entre tramos
      const pa = point(l, a), pb = point(l, b);
      const key = `${pa.join(',')}|${pb.join(',')}`;
      if (state.hiddenTubes && state.hiddenTubes[key]) continue; // tramo quitado a mano
      tubes.push({ key, a: pa, b: pb, axis: l.axis, len: b - a, color: state.coquillaColors[key] || state.settings.colorCoquilla });
      touch(pa, '+' + l.axis); touch(pb, '-' + l.axis);
    }
  }

  const nodeList = [];
  for (const [k, dirs] of nodes) {
    const pos = k.split(',').map(Number);
    const d = dirs.size;
    let c = 0;
    for (const ax of ['x', 'y', 'z']) if (dirs.has('+' + ax) && dirs.has('-' + ax)) c++;
    let union;
    if (d === 1) union = 'embellecedor';
    else if (d === 2) union = c === 1 ? 'empalme' : 'codo90';
    else if (d === 3) union = c === 1 ? 'tcorta' : 'codotriple';
    else if (d === 4) union = c === 2 ? 'cruzfija' : 'triple';
    else if (d === 5) union = 'cruz4';
    else union = 'cruz5';
    const ground = pos[1] === 0 && dirs.has('+y');
    nodeList.push({ key: k, pos, dirs: [...dirs], union, ground });
  }
  return { tubes, nodes: nodeList };
}

// ¿El tramo de tubo (a, b en cm) está en una arista del módulo?
export function tubeOnModule(m, a, b) {
  const x0 = cm(m.x), y0 = cm(m.y), z0 = cm(m.z), x1 = cm(m.x + m.w), y1 = cm(m.y + m.h), z1 = cm(m.z + m.d);
  const onEdge = p => (p[0] === x0 || p[0] === x1 ? 1 : 0) + (p[1] === y0 || p[1] === y1 ? 1 : 0) + (p[2] === z0 || p[2] === z1 ? 1 : 0) >= 2
    && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 && p[2] >= z0 && p[2] <= z1;
  return onEdge(a) && onEdge(b);
}
// Claves de tubos quitados que pertenecen al módulo (para restaurarlos).
export function hiddenTubesOf(state, m) {
  return Object.keys(state.hiddenTubes || {}).filter(k => { const [a, b] = k.split('|').map(p => p.split(',').map(Number)); return tubeOnModule(m, a, b); });
}
// Módulos que contienen el tramo de tubo (para borrar por tubo).
export function modulesWithTube(state, tube) {
  const [a, b] = [tube.a, tube.b];
  return state.modules.filter(m => {
    const x0 = cm(m.x), y0 = cm(m.y), z0 = cm(m.z), x1 = cm(m.x + m.w), y1 = cm(m.y + m.h), z1 = cm(m.z + m.d);
    const onEdge = p => (p[0] === x0 || p[0] === x1 ? 1 : 0) + (p[1] === y0 || p[1] === y1 ? 1 : 0) + (p[2] === z0 || p[2] === z1 ? 1 : 0) >= 2
      && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 && p[2] >= z0 && p[2] <= z1;
    return onEdge(a) && onEdge(b);
  });
}

export function unionName(id) { return UNIONES[id] ? UNIONES[id].name : id; }
export function unionRef(id) { return UNIONES[id] ? UNIONES[id].ref : ''; }
