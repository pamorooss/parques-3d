import * as THREE from 'three';
import { Store, newState, bounds, moduleSummary, moduleById, moduleFor, localSettings, levelsAt, inFootprint, r3, cm } from './state.js';
import { modulesWithTube } from './structure.js';
import { createScene } from './scene.js';
import { ParkRenderer } from './render.js';
import { Dims } from './dims.js';
import { UI } from './ui.js';
import { ELEMENTS, defaultColors } from './catalog.js';
import { RED } from './palette.js';
import { ICONS } from './icons.js';
import { cloud } from './cloud.js';
import { buildAllThumbs } from './thumbs.js';
import { computeBudget } from './budget.js';
import { saveJSON, snapshotPNG, savePhoto, saveCSV, openFicha } from './export.js';

const AUTOSAVE = 'bolakids3d:autosave';
const SNAP = 0.05;            // redondeo fino (m)
const EDGE_SNAP = 0.12;       // imán a los bordes de otros módulos (m)
const snap = v => r3(Math.round(v / SNAP) * SNAP);
const store = new Store();
const sc = createScene(document.getElementById('viewport'));
const park = new ParkRenderer(sc.scene);
const dims = new Dims(sc.scene);
let selection = null;

// ---------- parque de ejemplo ----------
function demoState() {
  const s = newState();
  s.settings.nombre = 'Parque de ejemplo';
  let id = 1;
  const mod = (x, y, z, w = 1, h = 1.5, d = 1) => { const m = { id: id++, x, y, z, w, h, d, floors: {}, nets: {} }; s.modules.push(m); return m; };
  const g = {}, u = {};
  for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) { g[`${x},${z}`] = mod(x, 0, z); u[`${x},${z}`] = mod(x, 1.5, z); }
  for (const m of Object.values(g)) m.floors.top = 'azul';
  for (let x = 0; x < 3; x++) { u[`${x},0`].nets['-z'] = 'negro'; u[`${x},1`].nets['+z'] = 'negro'; }
  for (let z = 0; z < 2; z++) { u[`0,${z}`].nets['-x'] = 'negro'; g[`0,${z}`].nets['-x'] = 'negro'; }
  u['2,1'].nets['+x'] = 'negro'; g['1,1'].nets['+z'] = 'azul';
  const add = (type, x, y, z, r = 0, colors = {}) => s.elements.push({ id: id++, type, x: x + 0.5, y, z: z + 0.5, r, colors: { ...defaultColors(type), ...colors } });
  add('piscina', 0, 0, 0, 0, { borde: 'rojo' }); add('piscina', 0, 0, 1, 0, { borde: 'rojo' });
  add('tobogan_recto', 1, 1.5, 0, 0, { color: 'amarillo' });
  add('rampa_grande', 2, 1.5, 1, 3);
  add('saco_grande', 1, 1.5, 0); add('boya', 1, 1.5, 1);
  add('cortina', 1, 0, 0, 0); add('cilindro', 2, 0, 0); add('piramide', 2, 0, 1); add('zapatero', 1, 0, 1, 2);
  s.nextId = id;
  return s;
}

// ---------- UI ----------
const ui = new UI(store, {
  topbar: handleTopbar,
  clearSelection: () => setSelection(null),
  tube: key => park.structure && park.structure.tubes.find(t => t.key === key),
  onToolChange: () => { if (ui.tool !== 'select') setSelection(null); park.hideGhost(); },
});

function setSelection(sel) {
  selection = sel;
  ui.setSelection(sel);
  refreshSelectionVisuals();
}
const selectedItem = s => !selection ? null : selection.kind === 'element' ? s.elements.find(q => q.id === selection.id) : selection.kind === 'module' ? moduleById(s, selection.id) : null;

// Pad de flechas: mueve la pieza o el módulo seleccionado (relativo a la cámara).
const movepad = document.getElementById('movepad');
const stepSel = document.getElementById('moveStep');
function cameraAxes() {
  const f = new THREE.Vector3().subVectors(sc.controls.target, sc.camera.position); f.y = 0; f.normalize();
  const fwd = Math.abs(f.x) > Math.abs(f.z) ? [Math.sign(f.x), 0] : [0, Math.sign(f.z)];
  return { fwd, right: [-fwd[1], fwd[0]] };
}
// Paso (m) en el eje ax para el objeto it: medio módulo, módulo entero o cm fijos.
function stepFor(s, it, axName, forced) {
  const mode = forced || stepSel.value;
  if (mode === 'half' || mode === 'full') {
    const m = it.w ? it : moduleFor(s, it);
    const size = m ? (axName === 'x' ? m.w : m.d) : s.settings.vano / 100;
    return mode === 'half' ? size / 2 : size;
  }
  return (parseFloat(mode) || 1) / 100;
}
function moveSelection(dir, forcedStep) {
  if (!selection || (selection.kind !== 'element' && selection.kind !== 'module')) return;
  const { fwd, right } = cameraAxes();
  const d = { up: fwd, down: [-fwd[0], -fwd[1]], right, left: [-right[0], -right[1]] }[dir];
  store.mutate(s => {
    const it = selectedItem(s); if (!it) return;
    if (d) {
      const axName = d[0] ? 'x' : 'z', sign = d[0] || d[1];
      it[axName] = r3(it[axName] + sign * stepFor(s, it, axName, forcedStep));
    } else if (dir === 'lvlup' || dir === 'lvldown') {
      // Niveles disponibles en ese punto: suelo, bases y tapas de los módulos (sin contar el propio).
      const others = it.w ? { ...s, modules: s.modules.filter(m => m.id !== it.id) } : s;
      const px = it.w ? it.x + it.w / 2 : it.x, pz = it.w ? it.z + it.d / 2 : it.z;
      const lv = levelsAt(others, px, pz);
      const next = dir === 'lvlup' ? lv.find(v => v > it.y + 0.001) : [...lv].reverse().find(v => v < it.y - 0.001);
      if (next !== undefined) it.y = r3(next); else if (dir === 'lvlup' && it.w) it.y = r3(it.y + it.h);
    }
    else if (dir === 'rotl' && !it.w) it.r = (it.r + 3) % 4;
    else if (dir === 'rotr' && !it.w) it.r = (it.r + 1) % 4;
  });
}
movepad.querySelectorAll('button[data-move]').forEach(b => { b.insertAdjacentHTML('afterbegin', ICONS[b.dataset.move] || ''); b.onclick = () => moveSelection(b.dataset.move); });

function refreshSelectionVisuals() {
  const obj = park.objectFor(selection);
  if (selection && !obj) { selection = null; ui.setSelection(null); }
  park.setHighlight(obj);
  const movable = !!(obj && selection && (selection.kind === 'element' || selection.kind === 'module'));
  movepad.hidden = !movable;
  movepad.classList.toggle('module', movable && selection.kind === 'module');
  if (movable) { const it = selectedItem(store.state); document.getElementById('movepadName').textContent = selection.kind === 'module' ? `Módulo ${cm(it.w)}×${cm(it.d)}×${cm(it.h)}` : ELEMENTS[it.type].name; }
  let label = null;
  if (obj && selection.kind === 'element') {
    const el = store.state.elements.find(e => e.id === selection.id);
    const d = ELEMENTS[el.type].dims(localSettings(store.state, el), el);
    const b = new THREE.Box3().setFromObject(obj);
    label = { label: `${d.l} × ${d.a} × ${d.h} cm`, pos: new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.25, (b.min.z + b.max.z) / 2) };
  } else if (obj && selection.kind === 'module') {
    const m = moduleById(store.state, selection.id);
    label = { label: `${cm(m.w)} × ${cm(m.d)} × ${cm(m.h)} cm`, pos: new THREE.Vector3(m.x + m.w / 2, m.y + m.h + 0.25, m.z + m.d / 2) };
  }
  dims.update(store.state, label);
}

store.subscribe(state => {
  park.rebuild(state);
  sc.setGrid(1);
  refreshSelectionVisuals();
  ui.refresh();
  try { localStorage.setItem(AUTOSAVE, JSON.stringify(state)); } catch (e) { /* sin almacenamiento */ }
  scheduleCloudAutosave();
});

// ---------- nube: sesión y parques guardados ----------
const loginBox = document.getElementById('login'), loginForm = document.getElementById('loginForm'), loginError = document.getElementById('loginError');
const cloudStatus = document.getElementById('cloudStatus'), cloudGroup = document.getElementById('cloudGroup'), cloudModal = document.getElementById('cloudModal');
document.querySelector('#login .lockIcon').innerHTML = ICONS.lock;
let cloudOn = false, cloudTimer = null, cloudBusy = false;
const hhmm = d => new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
function setStatus(text, cls = '') { cloudStatus.hidden = !text; cloudStatus.textContent = text; cloudStatus.className = 'status ' + cls; }
function showLogin(msg = '') { loginError.hidden = !msg; loginError.textContent = msg; loginBox.hidden = false; cloudGroup.hidden = true; cloudOn = false; setTimeout(() => document.getElementById('loginUser').focus(), 50); }
function enterCloud() { loginBox.hidden = true; cloudGroup.hidden = false; cloudOn = true; const c = store.state.cloud; setStatus(c && c.id ? `En la nube · ${c.nombre || ''}`.trim() : 'Nube conectada · sin guardar', 'ok'); }
loginForm.onsubmit = async e => {
  e.preventDefault(); loginError.hidden = true;
  const btn = loginForm.querySelector('button[type=submit]'); btn.disabled = true;
  try { await cloud.login(document.getElementById('loginUser').value.trim(), document.getElementById('loginPass').value); enterCloud(); }
  catch (err) { loginError.hidden = false; loginError.textContent = err.message; }
  btn.disabled = false;
};
async function initCloud() {
  const mode = await cloud.probe();
  if (mode === 'ok') enterCloud();
  else if (mode === 'login') showLogin();
  else if (mode === 'unconfigured') showLogin('La nube no está configurada: faltan APP_USER y APP_PASS en Netlify.');
  else setStatus('Modo local (sin nube)');
}
// Guardado automático en la nube: 2,5 s después del último cambio, si el parque ya está en la nube.
function scheduleCloudAutosave() {
  if (!cloudOn || !(store.state.cloud && store.state.cloud.id)) return;
  clearTimeout(cloudTimer); cloudTimer = setTimeout(() => cloudSave(true), 2500);
}
async function cloudSave(auto = false) {
  if (!cloudOn || cloudBusy) return;
  cloudBusy = true; setStatus('Guardando en la nube…');
  try {
    const st = store.state, id = st.cloud && st.cloud.id;
    const { cloud: _c, ...data } = st;
    const meta = await cloud.save(id || '', data);
    st.cloud = { id: meta.id, nombre: meta.nombre, updated: meta.updated };
    try { localStorage.setItem(AUTOSAVE, JSON.stringify(st)); } catch (e) { /* sin almacenamiento */ }
    setStatus(`Guardado en la nube · ${hhmm(meta.updated)}`, 'ok');
  } catch (err) {
    if (err.status === 401) showLogin('La sesión ha caducado, vuelve a entrar.');
    else setStatus('Error al guardar: ' + err.message, 'err');
    if (!auto && err.status !== 401) alert('No se ha podido guardar en la nube: ' + err.message);
  }
  cloudBusy = false;
}
async function openCloudModal() {
  if (!cloudOn) return;
  const list = document.getElementById('cloudList'); list.innerHTML = '<p class="muted">Cargando…</p>'; cloudModal.hidden = false;
  try {
    const items = await cloud.list();
    list.innerHTML = items.length ? '' : '<p class="muted">Todavía no hay parques guardados en la nube.</p>';
    const cur = store.state.cloud && store.state.cloud.id;
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'it' + (it.id === cur ? ' current' : '');
      row.innerHTML = `<div class="txt"><b>${it.nombre}</b><small>${it.cliente ? it.cliente + ' · ' : ''}${it.modulos} módulos, ${it.piezas} piezas · ${new Date(it.updated).toLocaleString('es-ES')}</small></div>`;
      const open = document.createElement('button'); open.textContent = 'Abrir'; open.className = 'primary';
      open.onclick = async () => { try { const data = await cloud.load(it.id); store.load({ ...data, cloud: { id: it.id, nombre: it.nombre, updated: it.updated } }); setSelection(null); sc.resetView(park.worldBox()); cloudModal.hidden = true; enterCloud(); } catch (e) { alert('No se ha podido abrir: ' + e.message); } };
      const del = document.createElement('button'); del.innerHTML = ICONS.trash; del.className = 'danger'; del.title = 'Borrar de la nube';
      del.onclick = async () => { if (!confirm(`¿Borrar "${it.nombre}" de la nube? No se puede deshacer.`)) return; try { await cloud.remove(it.id); if (it.id === cur) { store.state.cloud = null; } openCloudModal(); } catch (e) { alert('No se ha podido borrar: ' + e.message); } };
      row.append(open, del); list.appendChild(row);
    }
  } catch (err) { list.innerHTML = `<p class="error">${err.message}</p>`; if (err.status === 401) { cloudModal.hidden = true; showLogin('La sesión ha caducado, vuelve a entrar.'); } }
}
document.getElementById('cloudSaveNew').onclick = async () => { store.state.cloud = null; cloudModal.hidden = true; await cloudSave(); };
cloudModal.querySelector('[data-close]').onclick = () => { cloudModal.hidden = true; };
cloudModal.addEventListener('click', e => { if (e.target === cloudModal) cloudModal.hidden = true; });

// ---------- acciones de la barra superior ----------
function handleTopbar(action) {
  const st = store.state;
  if (action === 'new') { store.load(newState()); setSelection(null); sc.resetView(null); }
  else if (action === 'open') document.getElementById('fileInput').click();
  else if (action === 'cloudsave') cloudSave();
  else if (action === 'cloudopen') openCloudModal();
  else if (action === 'logout') { cloud.logout(); showLogin(); }
  else if (action === 'save') saveJSON(st);
  else if (action === 'undo') store.undo();
  else if (action === 'redo') store.redo();
  else if (action === 'view') sc.resetView(park.worldBox());
  else if (action === 'dims') store.mutate(s => { s.settings.mostrarCotas = !s.settings.mostrarCotas; });
  else if (action === 'photo') savePhoto(st, takePhoto());
  else if (action === 'csv') saveCSV(st, computeBudget(st));
  else if (action === 'ficha') {
    const b = bounds(st);
    const dimsText = b ? [
      { k: 'Largo', v: `${cm(b.max[0] - b.min[0])} cm` }, { k: 'Ancho', v: `${cm(b.max[2] - b.min[2])} cm` },
      { k: 'Alto', v: `${cm(b.max[1] - b.min[1])} cm` }, { k: 'Módulos', v: moduleSummary(st).map(m => m + ' cm').join(', ') },
      { k: 'Plantas', v: `${b.plantas}` }] : [];
    openFicha(st, computeBudget(st), takePhoto(), dimsText);
  }
}
function takePhoto() {
  const hl = park.highlight; const ghostVisible = park.ghost.visible;
  return snapshotPNG(sc, () => { park.ghost.visible = false; if (hl) hl.visible = false; }, () => { park.ghost.visible = ghostVisible; if (hl) hl.visible = true; });
}
document.getElementById('fileInput').onchange = ev => {
  const f = ev.target.files[0]; if (!f) return;
  f.text().then(t => { try { store.load(JSON.parse(t)); setSelection(null); sc.resetView(park.worldBox()); } catch (e) { alert('El archivo no es un parque válido.'); } });
  ev.target.value = '';
};

// ---------- interacción con el 3D ----------
const canvas = sc.renderer.domElement;
let down = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 5 && performance.now() - down.t < 500) handleClick(e.clientX, e.clientY, down.b);
  down = null;
});
canvas.addEventListener('pointermove', e => { if (!down) handleHover(e.clientX, e.clientY); });
canvas.addEventListener('pointerleave', () => park.hideGhost());

const pickObjs = () => [...park.pickGroup.children, sc.ground];
const moduleDims = () => { const d = ui.moduleDims || { ancho: store.state.settings.vano, fondo: store.state.settings.vano, alto: store.state.settings.altura }; return { w: d.ancho / 100, d: d.fondo / 100, h: d.alto / 100 }; };

// Qué hay bajo el ratón: suelo o un módulo (con su cara).
function hitAt(cx, cy) {
  const hit = sc.pick(cx, cy, pickObjs(), false);
  if (!hit) return null;
  const u = hit.object.userData;
  if (u.type === 'ground') return { type: 'ground', point: hit.point };
  const n = hit.face.normal;
  const face = Math.abs(n.y) > 0.5 ? (n.y > 0 ? 'top' : 'bottom') : Math.abs(n.x) > 0.5 ? (n.x > 0 ? '+x' : '-x') : (n.z > 0 ? '+z' : '-z');
  return { type: 'module', m: moduleById(store.state, u.id), face, point: hit.point };
}

// Caja del módulo nuevo según dónde se apunta: pegado a la cara de otro módulo o libre en el suelo (con imán a bordes).
function newModuleBox(h) {
  const { w, d, h: hh } = moduleDims();
  if (!h) return null;
  if (h.type === 'module') {
    const m = h.m, f = h.face;
    if (f === 'bottom') return null;
    if (f === 'top') return { x0: m.x, y0: r3(m.y + m.h), z0: m.z, w, h: hh, d };
    if (f === '+x') return { x0: r3(m.x + m.w), y0: m.y, z0: m.z, w, h: hh, d };
    if (f === '-x') return { x0: r3(m.x - w), y0: m.y, z0: m.z, w, h: hh, d };
    if (f === '+z') return { x0: m.x, y0: m.y, z0: r3(m.z + m.d), w, h: hh, d };
    return { x0: m.x, y0: m.y, z0: r3(m.z - d), w, h: hh, d };
  }
  // En el suelo se coloca por casillas de su propio tamaño (como una rejilla de módulos)...
  let x0 = r3(Math.floor(h.point.x / w + 1e-6) * w), z0 = r3(Math.floor(h.point.z / d + 1e-6) * d);
  // ...y con imán: alinear un borde del nuevo con un borde de algún módulo existente
  let bx = Math.max(EDGE_SNAP, w / 2), bz = Math.max(EDGE_SNAP, d / 2); // hasta medio módulo de imán
  for (const m of store.state.modules) {
    for (const c of [m.x, m.x + m.w, m.x - w, m.x + m.w - w]) if (Math.abs(c - x0) < bx) { bx = Math.abs(c - x0); x0 = r3(c); }
    for (const c of [m.z, m.z + m.d, m.z - d, m.z + m.d - d]) if (Math.abs(c - z0) < bz) { bz = Math.abs(c - z0); z0 = r3(c); }
  }
  return { x0, y0: 0, z0, w, h: hh, d };
}
// Dónde iría una pieza: en el suelo o sobre la tapa de un módulo (punto libre, imán al centro), o centrada en el módulo si se apunta a un lateral.
function placeTarget(h) {
  if (!h) return null;
  const type = ui.placeType, def = ELEMENTS[type];
  // En el suelo: casillas de medio metro. Sobre un módulo: centrada en él (luego se afina con las flechas en cm).
  if (h.type === 'ground') return { x: r3(Math.floor(h.point.x / 0.5) * 0.5 + 0.25), y: 0, z: r3(Math.floor(h.point.z / 0.5) * 0.5 + 0.25), r: ui.rot, m: null };
  const m = h.m, cx = r3(m.x + m.w / 2), cz = r3(m.z + m.d / 2);
  if (h.face === 'top' || h.face === 'bottom') return { x: cx, y: h.face === 'top' ? r3(m.y + m.h) : m.y, z: cz, r: ui.rot, m };
  // lateral: pieza centrada en el módulo, mirando hacia esa cara (las de tipo 'face' se giran solas)
  const faceRot = { '-z': 0, '-x': 1, '+z': 2, '+x': 3 }[h.face];
  return { x: cx, y: m.y, z: cz, r: def.place === 'face' ? faceRot : ui.rot, m };
}
function ghostForPlace(t) {
  const el = { type: ui.placeType, x: t.x, y: t.y, z: t.z, r: t.r, colors: {} };
  const d = ELEMENTS[ui.placeType].dims(localSettings(store.state, el), el);
  const w = (t.r % 2 ? d.a : d.l) / 100, dd = (t.r % 2 ? d.l : d.a) / 100, hh = Math.max(0.1, d.h / 100);
  return { x0: t.x - w / 2, y0: t.y, z0: t.z - dd / 2, w, h: hh, d: dd };
}
function faceBox(m, face) {
  const t = 0.06;
  if (face === 'top') return { x0: m.x, y0: m.y + m.h, z0: m.z, w: m.w, h: 0.08, d: m.d };
  if (face === 'bottom') return { x0: m.x, y0: m.y, z0: m.z, w: m.w, h: 0.08, d: m.d };
  if (face === '+x') return { x0: m.x + m.w - t / 2, y0: m.y, z0: m.z, w: t, h: m.h, d: m.d };
  if (face === '-x') return { x0: m.x - t / 2, y0: m.y, z0: m.z, w: t, h: m.h, d: m.d };
  if (face === '+z') return { x0: m.x, y0: m.y, z0: m.z + m.d - t / 2, w: m.w, h: m.h, d: t };
  return { x0: m.x, y0: m.y, z0: m.z - t / 2, w: m.w, h: m.h, d: t };
}
function pieceAt(cx, cy) {
  const hit = sc.pick(cx, cy, park.root.children, true);
  if (!hit) return null;
  const r = park.resolve(hit.object);
  if (!r || r.type === 'node') return null;
  return r;
}
function pieceToSelection(r) {
  if (r.type === 'element' || r.type === 'module') return { kind: r.type, id: r.id };
  return { kind: r.type, key: r.key };
}
const splitKey = key => { const [id, face] = key.split(':'); return { id: +id, face }; };

function handleHover(cx, cy) {
  const tool = ui.tool;
  park.hideGhost();
  if (tool === 'estructura') {
    const box = newModuleBox(hitAt(cx, cy)); if (box) park.setGhost({ box });
  } else if (tool === 'place') {
    const t = placeTarget(hitAt(cx, cy)); if (t) park.setGhost({ box: ghostForPlace(t), rot: t.r, showArrow: true, color: 0xff7a00 });
  } else if (tool === 'suelo') {
    const h = hitAt(cx, cy); if (h && h.type === 'module') park.setGhost({ box: faceBox(h.m, h.face === 'top' ? 'top' : 'bottom') });
  } else if (tool === 'red') {
    const h = hitAt(cx, cy); if (h && h.type === 'module' && h.face !== 'top' && h.face !== 'bottom') park.setGhost({ box: faceBox(h.m, h.face) });
  }
  canvas.style.cursor = (tool === 'select' || tool === 'pintar' || tool === 'borrar') && (pieceAt(cx, cy) || (hitAt(cx, cy) || {}).type === 'module') ? 'pointer' : 'default';
}

function handleClick(cx, cy, button) {
  const tool = ui.tool, right = button === 2;
  if (tool === 'estructura') {
    const h = hitAt(cx, cy);
    if (right) { if (h && h.type === 'module') store.mutate(s => { s.modules = s.modules.filter(m => m.id !== h.m.id); }); return; }
    const box = newModuleBox(h); if (!box) return;
    store.mutate(s => { s.modules.push({ id: s.nextId++, x: box.x0, y: box.y0, z: box.z0, w: box.w, h: box.h, d: box.d, floors: {}, nets: {} }); });
  } else if (tool === 'place') {
    const t = placeTarget(hitAt(cx, cy)); if (!t) return;
    const type = ui.placeType;
    store.mutate(s => { s.elements.push({ id: s.nextId++, type, x: t.x, y: t.y, z: t.z, r: t.r, colors: { ...defaultColors(type), ...(ui.placeColors[type] || {}) } }); });
  } else if (tool === 'suelo') {
    const h = hitAt(cx, cy); if (!h || h.type !== 'module') return;
    const face = h.face === 'top' ? 'top' : 'bottom';
    store.mutate(s => { const m = moduleById(s, h.m.id); if (m.floors[face]) delete m.floors[face]; else m.floors[face] = s.settings.colorSuelo; });
  } else if (tool === 'red') {
    const h = hitAt(cx, cy); if (!h || h.type !== 'module' || h.face === 'top' || h.face === 'bottom') return;
    store.mutate(s => { const m = moduleById(s, h.m.id); if (m.nets[h.face]) delete m.nets[h.face]; else m.nets[h.face] = s.settings.colorRed; });
  } else if (tool === 'pintar') {
    const r = pieceAt(cx, cy); if (!r) return;
    const color = ui.paintColor;
    store.mutate(s => {
      if (r.type === 'tube') s.coquillaColors[r.key] = color;
      else if (r.type === 'floor') { const { id, face } = splitKey(r.key); moduleById(s, id).floors[face] = color; }
      else if (r.type === 'net') { const { id, face } = splitKey(r.key); if (RED.some(c => c.id === color)) moduleById(s, id).nets[face] = color; }
      else if (r.type === 'element') { const e = s.elements.find(q => q.id === r.id); const slot = ELEMENTS[e.type].slots.find(sl => sl.palette === 'pvc'); if (slot) e.colors[slot.key] = color; }
    });
  } else if (tool === 'borrar') {
    const r = pieceAt(cx, cy);
    if (r) { store.mutate(s => deleteThing(s, pieceToSelection(r))); return; }
    const h = hitAt(cx, cy);
    if (h && h.type === 'module') store.mutate(s => { s.modules = s.modules.filter(m => m.id !== h.m.id); });
  } else if (tool === 'select') {
    const r = pieceAt(cx, cy);
    if (r) setSelection(pieceToSelection(r));
    else { const h = hitAt(cx, cy); setSelection(h && h.type === 'module' ? { kind: 'module', id: h.m.id } : null); }
  }
  handleHover(cx, cy);
}
function deleteThing(s, sel) {
  if (sel.kind === 'element') s.elements = s.elements.filter(q => q.id !== sel.id);
  else if (sel.kind === 'module') s.modules = s.modules.filter(m => m.id !== sel.id);
  else if (sel.kind === 'floor') { const { id, face } = splitKey(sel.key); const m = moduleById(s, id); if (m) delete m.floors[face]; }
  else if (sel.kind === 'net') { const { id, face } = splitKey(sel.key); const m = moduleById(s, id); if (m) delete m.nets[face]; }
  else if (sel.kind === 'tube') { // borrar tubo = borrar los módulos que lo usan
    const t = park.structure.tubes.find(q => q.key === sel.key); if (!t) return;
    const ids = new Set(modulesWithTube(s, t).map(m => m.id));
    s.modules = s.modules.filter(m => !ids.has(m.id));
  }
}

// ---------- teclado ----------
window.addEventListener('keydown', e => {
  if (!loginBox.hidden) return;
  if (!cloudModal.hidden) { if (e.key === 'Escape') cloudModal.hidden = true; return; }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
  if (k === 'escape') { ui.setTool('select'); return; }
  const arrows = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', pageup: 'lvlup', pagedown: 'lvldown' };
  if (arrows[k] && selection && (selection.kind === 'element' || selection.kind === 'module')) { e.preventDefault(); moveSelection(arrows[k], e.shiftKey ? '1' : undefined); return; }
  if (k === 'r') {
    if (ui.tool === 'select' && selection && selection.kind === 'element') store.mutate(s => { const el = s.elements.find(q => q.id === selection.id); el.r = (el.r + 1) % 4; });
    else ui.rot = (ui.rot + 1) % 4;
    return;
  }
  if ((k === 'delete' || k === 'backspace') && selection) {
    e.preventDefault();
    const sel = selection; store.mutate(s => deleteThing(s, sel));
    setSelection(null); return;
  }
  const map = { v: 'select', e: 'estructura', s: 'suelo', n: 'red', p: 'pintar', x: 'borrar' };
  if (map[k]) ui.setTool(map[k]);
});

// ---------- arranque ----------
let saved = null;
try { saved = JSON.parse(localStorage.getItem(AUTOSAVE)); } catch (e) { saved = null; }
store.load(saved && (saved.modules || saved.cells) ? saved : demoState());
ui.setTool('select');
sc.resetView(park.worldBox());
initCloud();
buildAllThumbs(sc.renderer, (type, url) => ui.setThumb(type, url));
window.__bk = { sc, store, park, ui, setSelection, get selection() { return selection; } };
(function loop() { requestAnimationFrame(loop); sc.render(); })();
