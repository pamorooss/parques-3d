import { deriveStructure, unionName, unionRef } from './structure.js';
import { ELEMENTS, GENERIC_PRICES, elementDims } from './catalog.js';
import { localSettings, faceRect, rectKey, cm, floorShape, floorAreaFactor } from './state.js';
import { nameOf } from './palette.js';

// Corte 1D: piezas (cm) en barras de largo `stock`. First-fit decreasing.
export function cutBars(pieces, stock) {
  const bars = []; // hueco libre que queda en cada barra abierta
  let full = 0;    // barras enteras consumidas por piezas más largas que la barra (se empalman)
  const rest = [];
  for (const p of pieces) {
    if (p >= stock) { full += Math.floor(p / stock); const r = p % stock; if (r > 0) rest.push(r); }
    else rest.push(p);
  }
  for (const p of rest.sort((a, b) => b - a)) {
    let placed = false;
    for (let i = 0; i < bars.length; i++) if (bars[i] >= p) { bars[i] -= p; placed = true; break; }
    if (!placed) bars.push(stock - p);
  }
  const used = pieces.reduce((a, b) => a + b, 0);
  const n = bars.length + full, total = n * stock;
  return { bars: n, used, waste: total - used, wastePct: total ? (total - used) / total * 100 : 0 };
}

function line(key, props, state) {
  const base = GENERIC_PRICES[key] || {};
  const l = { key, est: false, pendiente: false, ...base, ...props };
  if (state.prices[key] !== undefined) { l.precio = state.prices[key]; l.pendiente = false; l.override = true; }
  l.importe = +(l.cantidad * l.precio).toFixed(2);
  return l;
}

export function computeBudget(state) {
  const s = state.settings;
  const st = deriveStructure(state);
  const groups = [];

  // --- Estructura ---------------------------------------------------------
  const estr = [];
  const byLen = {};
  for (const t of st.tubes) byLen[t.len] = (byLen[t.len] || 0) + 1;
  const metros = st.tubes.reduce((a, t) => a + t.len, 0) / 100;
  const stockLens = String(s.tuboLargos).split(/[,; ]+/).map(Number).filter(n => n > 0);
  let detalleTubo = Object.entries(byLen).map(([l, n]) => `${n} tramos de ${l} cm`).join(', ');
  if (stockLens.length) {
    const best = stockLens.map(L => ({ L, ...cutBars(st.tubes.map(t => t.len), L) })).sort((a, b) => a.bars * a.L - b.bars * b.L)[0];
    detalleTubo += ` · ${best.bars} barras de ${best.L} cm (merma ${best.wastePct.toFixed(0)}%)`;
  }
  if (st.tubes.length) estr.push(line('tubo_m', { detalle: detalleTubo, cantidad: +metros.toFixed(2) }, state));

  const unions = {};
  for (const n of st.nodes) { unions[n.union] = (unions[n.union] || 0) + 1; if (n.ground) unions.placabase = (unions.placabase || 0) + 1; }
  for (const [u, n] of Object.entries(unions)) {
    estr.push(line('union_' + u, { concepto: unionName(u), detalle: 'Ref. ' + unionRef(u), cantidad: n, unidad: 'ud', precio: GENERIC_PRICES.union.precio, pendiente: true }, state));
  }

  // Coquillas: por color, optimizando el corte de la pieza de 248 cm.
  const byColor = {};
  for (const t of st.tubes) if (t.color !== 'sin') (byColor[t.color] = byColor[t.color] || []).push(t.len);
  let piezas = 0;
  for (const [color, lens] of Object.entries(byColor)) {
    const cut = cutBars(lens, s.coquillaLargo);
    piezas += lens.length;
    estr.push(line('coquilla', { key: 'coquilla', concepto: `Coquilla ${s.coquillaLargo} cm · ${nameOf(color)}`, detalle: `${lens.length} tramos, ${(cut.used / 100).toFixed(1)} m, merma ${cut.wastePct.toFixed(0)}%`, cantidad: cut.bars }, state));
  }
  if (piezas) {
    const bridas = piezas * s.bridasPorCoquilla;
    estr.push(line('bridas_pack', { detalle: `${bridas} bridas (${s.bridasPorCoquilla} por tramo, packs de ${s.bridasPorPack})`, cantidad: Math.ceil(bridas / s.bridasPorPack) }, state));
  }
  if (estr.length) groups.push({ name: 'Estructura', lines: estr });

  // --- Cerramientos --------------------------------------------------------
  const cer = [];
  const seen = new Set(); let nets = 0, m2 = 0, perim = 0; const colores = {}, medidas = {};
  const floors = []; // { w, d, color }
  for (const m of state.modules) {
    for (const face of ['+x', '-x', '+z', '-z']) {
      const color = m.nets && m.nets[face]; if (!color) continue;
      const r = faceRect(m, face); const k = rectKey(r); if (seen.has(k)) continue; seen.add(k);
      const w = cm(r.u1 - r.u0), hh = cm(r.v1 - r.v0);
      nets++; m2 += w * hh / 1e4; perim += 2 * (w + hh) / 100;
      colores[color] = (colores[color] || 0) + 1;
      const mk = `${w}×${hh}`; medidas[mk] = (medidas[mk] || 0) + 1;
    }
    for (const face of ['top', 'bottom']) {
      const color = m.floors && m.floors[face]; if (!color) continue;
      const k = rectKey(faceRect(m, face)); if (seen.has(k)) continue; seen.add(k);
      const sh = floorShape(m, face);
      floors.push({ w: cm(m.w), d: cm(m.d), color, factor: floorAreaFactor(sh), shape: sh.kind });
    }
  }
  if (nets) {
    const det = Object.entries(medidas).map(([m, n]) => `${n} de ${m} cm`).join(', ');
    cer.push(line('red_m2', { detalle: `${nets} paños (${det}) · ` + Object.entries(colores).map(([c, n]) => `${n} ${nameOf(c)}`).join(', '), cantidad: +m2.toFixed(2) }, state));
    const b = Math.ceil(perim * s.bridasRedPorMetro);
    cer.push(line('bridas_red', { detalle: `${b} bridas (${s.bridasRedPorMetro}/m, packs de ${s.bridasRedPorPack})`, cantidad: Math.ceil(b / s.bridasRedPorPack) }, state));
  }
  if (cer.length) groups.push({ name: 'Cerramientos', lines: cer });

  // --- Suelos -----------------------------------------------------------------
  if (floors.length) {
    let fm2 = 0; const fmed = {};
    for (const f of floors) { fm2 += f.w * f.d / 1e4 * f.factor; const mk = `${f.w}×${f.d} cm${f.shape === "half" ? " (mitad)" : f.shape === "tri" ? " (triángulo)" : ""}`; fmed[mk] = (fmed[mk] || 0) + 1; }
    const det = Object.entries(fmed).map(([m, n]) => `${n} de ${m}`).join(', ');
    groups.push({ name: 'Plataformas', lines: [line('plataforma_m2', { detalle: `${floors.length} plataformas (${det})`, cantidad: +fm2.toFixed(2) }, state)] });
  }

  // --- Elementos ------------------------------------------------------------
  const agg = {};
  let foamShapes = 0;
  for (const el of state.elements) {
    const def = ELEMENTS[el.type]; if (!def) continue;
    if (['piramide', 'cubo', 'cilindro', 'hexagono'].includes(el.type)) foamShapes++;
    const ls = localSettings(state, el);
    for (const l of def.budget(el, ls, elementDims(el, ls))) {
      const k = l.key + '|' + (l.detalle || '');
      if (!agg[k]) agg[k] = { ...l, cantidad: 0 };
      agg[k].cantidad += l.cantidad;
    }
  }
  const elLines = Object.values(agg).map(l => line(l.key, { ...l, cantidad: +l.cantidad.toFixed(2) }, state));
  if (foamShapes) elLines.push(line('tapones', { detalle: `${foamShapes * 4} tapones (4 por figura)`, cantidad: Math.ceil(foamShapes * 4 / 50) }, state));
  if (elLines.length) groups.push({ name: 'Juegos y elementos', lines: elLines });

  const subtotal = groups.flatMap(g => g.lines).reduce((a, l) => a + l.importe, 0);
  const margen = subtotal * (s.margen / 100);
  const base = subtotal + margen;
  const iva = base * (s.iva / 100);
  const pendientes = groups.flatMap(g => g.lines).filter(l => l.pendiente).length;
  const estimadas = groups.flatMap(g => g.lines).filter(l => l.est && !l.override).length;
  return { groups, subtotal, margen, base, iva, total: base + iva, pendientes, estimadas, structure: st };
}
