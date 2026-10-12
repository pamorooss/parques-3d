import { CATEGORIES, ELEMENTS, defaultColors } from './catalog.js';
import { PVC, RED, BOLAS, paletteOf, hexOf, nameOf } from './palette.js';
import { computeBudget } from './budget.js';
import { moduleById, localSettings, faceRect, cm, r3 } from './state.js';
import { unionName } from './structure.js';
import { ICONS } from './icons.js';

export const TOOLS = [
  { id: 'select',     name: 'Seleccionar', key: 'V', hint: 'Clic en una pieza o en un módulo para editarlo (medidas, posición, color). R gira, Supr borra. Arrastra para orbitar, rueda para zoom, botón derecho para desplazar.' },
  { id: 'estructura', name: 'Módulo',      key: 'E', hint: 'Clic en el suelo: módulo nuevo con las medidas del panel, por casillas y pegándose a los módulos de al lado. Clic en una cara de otro módulo: lo añade pegado a esa cara. Clic derecho: lo quita.' },
  { id: 'suelo',      name: 'Plataforma',  key: 'S', hint: 'Clic en la tapa de un módulo: plataforma arriba. Clic en un lateral: plataforma en su base. Repite para quitar.' },
  { id: 'red',        name: 'Red',         key: 'N', hint: 'Clic en una cara lateral de un módulo: pone o quita la red de protección.' },
  { id: 'pintar',     name: 'Pintar',      key: 'P', hint: 'Clic en cualquier pieza (coquilla, red, plataforma, juego) para aplicarle el color actual.' },
  { id: 'borrar',     name: 'Borrar',      key: 'X', hint: 'Clic en cualquier pieza o módulo para eliminarlo.' },
];

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const eur = n => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export class UI {
  constructor(store, actions) {
    this.store = store; this.actions = actions;
    this.tool = 'select'; this.placeType = null; this.rot = 0; this.paintColor = 'azul';
    this.placeColors = {}; this.selection = null; this.tab = 'pieza';
    this.moduleDims = null; // medidas (cm) del próximo módulo a colocar: { ancho, fondo, alto }
    this.el = {
      tools: document.getElementById('tools'), catalog: document.getElementById('catalog'), colorBox: document.getElementById('colorBox'),
      pieza: document.getElementById('tab-pieza'), presupuesto: document.getElementById('tab-presupuesto'), ajustes: document.getElementById('tab-ajustes'),
      hint: document.getElementById('hint'), name: document.getElementById('parkName'),
    };
    this.buildTools(); this.buildCatalog(); this.buildTabs(); this.buildTopbar(); this.buildAjustes();
  }

  // ---------- construcción estática ----------
  buildTools() {
    for (const t of TOOLS) {
      const b = h('button', 'tool', `${ICONS[t.id]}<span>${t.name}</span><kbd>${t.key}</kbd>`); b.dataset.tool = t.id;
      b.onclick = () => this.setTool(t.id); this.el.tools.appendChild(b);
    }
  }
  buildCatalog() {
    for (const cat of CATEGORIES) {
      const sec = h('div', 'cat'); sec.appendChild(h('h4', '', cat.name));
      for (const [id, d] of Object.entries(ELEMENTS)) if (d.cat === cat.id) {
        const b = h('button', 'item', d.name); b.dataset.place = id; b.title = d.desc || '';
        b.onclick = () => this.setTool('place', id); sec.appendChild(b);
      }
      this.el.catalog.appendChild(sec);
    }
  }
  buildTabs() {
    const tabIcons = { pieza: ICONS.piece, presupuesto: ICONS.money, ajustes: ICONS.settings };
    document.querySelectorAll('#tabs button').forEach(b => { b.insertAdjacentHTML('afterbegin', tabIcons[b.dataset.tab] || ''); b.onclick = () => this.showTab(b.dataset.tab); });
  }
  showTab(t) {
    this.tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('#right .tab').forEach(d => d.classList.toggle('active', d.id === 'tab-' + t));
    this.refresh();
  }
  buildTopbar() {
    document.querySelectorAll('#topbar [data-action]').forEach(b => { b.insertAdjacentHTML('afterbegin', ICONS[b.dataset.action] || ''); b.onclick = () => this.actions.topbar(b.dataset.action); });
    this.el.name.onchange = () => this.store.mutate(s => { s.settings.nombre = this.el.name.value; });
  }

  // ---------- herramientas ----------
  setTool(tool, placeType = null) {
    this.tool = tool; this.placeType = placeType;
    if (placeType && !this.placeColors[placeType]) this.placeColors[placeType] = defaultColors(placeType);
    document.querySelectorAll('#tools .tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    document.querySelectorAll('#catalog .item').forEach(b => b.classList.toggle('active', tool === 'place' && b.dataset.place === placeType));
    const t = TOOLS.find(x => x.id === tool);
    if (tool === 'place') { const d = ELEMENTS[placeType]; this.setHint(`${d.name}: clic en el módulo donde va (queda centrada; luego se afina en cm con las flechas). R gira (la flecha naranja marca el frente). ${d.desc || ''}`); }
    else this.setHint(t.hint);
    this.renderColorBox();
    this.actions.onToolChange && this.actions.onToolChange();
  }
  setHint(t) { this.el.hint.textContent = t; }

  swatches(palette, current, onPick) {
    const wrap = h('div', 'swatches');
    for (const c of palette) {
      const sw = h('div', 'swatch' + (c.id === current ? ' on' : '') + (c.id === 'blanco' || c.id === 'transparente' ? ' light' : ''));
      sw.title = c.name; sw.style.background = c.mix ? 'conic-gradient(#d6222b,#f7c600,#2e9e4f,#1d5fc2,#e1248c,#d6222b)' : c.hex;
      sw.onclick = () => onPick(c.id); wrap.appendChild(sw);
    }
    return wrap;
  }
  renderColorBox() {
    const box = this.el.colorBox; box.innerHTML = '';
    const s = this.store.state.settings;
    const set = (k) => (id) => { this.store.mutate(st => { st.settings[k] = id; }); };
    if (this.tool === 'estructura') { this.renderModuleDims(box); box.appendChild(h('label', '', 'Coquilla de los nuevos módulos')); box.appendChild(this.swatches(PVC, s.colorCoquilla, set('colorCoquilla'))); }
    else if (this.tool === 'red') { box.appendChild(h('label', '', 'Color de la red')); box.appendChild(this.swatches(RED, s.colorRed, set('colorRed'))); }
    else if (this.tool === 'suelo') { box.appendChild(h('label', '', 'PVC de la plataforma')); box.appendChild(this.swatches(PVC, s.colorSuelo, set('colorSuelo'))); }
    else if (this.tool === 'pintar') { box.appendChild(h('label', '', 'Color a aplicar')); box.appendChild(this.swatches(PVC, this.paintColor, id => { this.paintColor = id; this.renderColorBox(); })); }
    else if (this.tool === 'place') {
      const d = ELEMENTS[this.placeType]; const pc = this.placeColors[this.placeType];
      if (!d.slots.length) box.appendChild(h('div', 'muted', 'Esta pieza no tiene color a elegir.'));
      for (const slot of d.slots) {
        box.appendChild(h('label', '', slot.name));
        box.appendChild(this.swatches(paletteOf(slot.palette), pc[slot.key], id => { pc[slot.key] = id; this.renderColorBox(); }));
      }
    } else box.appendChild(h('div', 'muted', 'Elige Módulo, Red, Plataforma, Pintar o una pieza del catálogo para ver sus colores.'));
  }

  // ---------- selección ----------
  setSelection(sel) { this.selection = sel; this.renderPieza(); if (sel) this.showTab('pieza'); }

  numField(label, value, onChange) {
    const w = h('div', 'field'); w.appendChild(h('label', '', label));
    const inp = h('input'); inp.type = 'number'; inp.step = '1'; inp.value = value;
    inp.onchange = () => onChange(parseFloat(inp.value) || 0);
    inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
    w.appendChild(inp); return w;
  }
  // Medidas del módulo que se va a colocar (herramienta Módulo).
  renderModuleDims(box) {
    const s = this.store.state.settings;
    if (!this.moduleDims) this.moduleDims = { ancho: s.vano, fondo: s.vano, alto: s.altura };
    const d = this.moduleDims;
    box.appendChild(h('label', '', 'Medidas del módulo nuevo (cm)'));
    const row = h('div', 'row dims');
    row.appendChild(this.numField('Ancho', d.ancho, v => { d.ancho = Math.max(20, v); }));
    row.appendChild(this.numField('Fondo', d.fondo, v => { d.fondo = Math.max(20, v); }));
    row.appendChild(this.numField('Alto', d.alto, v => { d.alto = Math.max(20, v); }));
    box.appendChild(row);
    box.appendChild(h('p', 'muted', 'Cada módulo tiene sus propias medidas. Para cambiar uno ya puesto, selecciónalo.'));
  }

  renderPieza() {
    const box = this.el.pieza; box.innerHTML = '';
    const st = this.store.state, sel = this.selection;
    if (!sel) {
      const mods = st.modules.length;
      const floors = st.modules.reduce((a, m) => a + Object.keys(m.floors || {}).length, 0), nets = st.modules.reduce((a, m) => a + Object.keys(m.nets || {}).length, 0);
      box.appendChild(h('h3', '', 'Resumen del parque'));
      const stat = (ic, label, n, cls = '') => `<div class="stat ${cls}"><span class="ic">${ICONS[ic]}</span><div><small>${label}</small><b>${n}</b></div></div>`;
      box.appendChild(h('div', 'stats', stat('stat_mod', 'Módulos', mods, 'dark') + stat('stat_floor', 'Plataformas', floors) + stat('stat_net', 'Paños de red', nets) + stat('stat_play', 'Juegos', st.elements.length)));
      const bgt = computeBudget(st);
      if (bgt.groups.length) box.appendChild(h('div', 'kv', `<div>Presupuesto sin IVA<b>${eur(bgt.subtotal + bgt.margen)}</b></div><div>Total con IVA<b>${eur(bgt.total)}</b></div>`));
      box.appendChild(h('p', 'muted', mods ? 'Selecciona cualquier pieza o módulo con la herramienta Seleccionar para editar sus medidas, posición o color.' : 'Empieza con la herramienta Módulo (E): pon las medidas y haz clic en el suelo para colocar el primer módulo.'));
      return;
    }
    const mutate = fn => this.store.mutate(fn);
    const del = (fn) => { const b = h('button', 'danger', 'Eliminar'); b.onclick = () => { mutate(fn); this.actions.clearSelection(); }; return b; };
    if (sel.kind === 'element') {
      const el = st.elements.find(e => e.id === sel.id); if (!el) return;
      const d = ELEMENTS[el.type]; const ls = localSettings(st, el); const dims = d.dims(ls, el);
      box.appendChild(h('h3', '', d.name));
      if (d.desc) box.appendChild(h('p', 'muted', d.desc));
      box.appendChild(h('div', 'kv', `<div>Largo<b>${dims.l} cm</b></div><div>Ancho<b>${dims.a} cm</b></div><div>Alto<b>${dims.h} cm</b></div><div>Base a<b>${cm(el.y)} cm del suelo</b></div>`));
      const pos = h('div', 'row dims');
      const setEl = (k, v) => mutate(x => { x.elements.find(q => q.id === el.id)[k] = r3(v / 100); });
      pos.appendChild(this.numField('X (cm)', cm(el.x), v => setEl('x', v)));
      pos.appendChild(this.numField('Altura (cm)', cm(el.y), v => setEl('y', Math.max(0, v))));
      pos.appendChild(this.numField('Z (cm)', cm(el.z), v => setEl('z', v)));
      box.appendChild(pos);
      box.appendChild(h('p', 'muted', 'Centro de la pieza desde el origen del parque y altura de su base. Las flechas de abajo la mueven con el paso elegido.'));
      const row = h('div', 'row');
      const rl = h('button', '', '◁ Girar'); rl.onclick = () => mutate(x => { const e = x.elements.find(q => q.id === el.id); e.r = (e.r + 3) % 4; });
      const rr = h('button', '', 'Girar ▷'); rr.onclick = () => mutate(x => { const e = x.elements.find(q => q.id === el.id); e.r = (e.r + 1) % 4; });
      row.append(rl, rr); box.appendChild(row);
      for (const slot of d.slots) {
        box.appendChild(h('label', '', slot.name + ': ' + nameOf(el.colors[slot.key])));
        box.appendChild(this.swatches(paletteOf(slot.palette), el.colors[slot.key], id => mutate(x => { x.elements.find(q => q.id === el.id).colors[slot.key] = id; })));
      }
      const lines = d.budget(el, ls);
      box.appendChild(h('div', 'muted', 'Presupuesto: ' + lines.map(l => `${l.concepto} ${l.cantidad} ${l.unidad} × ${st.prices[l.key] ?? l.precio} €`).join(' · ')));
      box.appendChild(del(x => { x.elements = x.elements.filter(q => q.id !== el.id); }));
    } else if (sel.kind === 'module') {
      const m = moduleById(st, sel.id); if (!m) return;
      const setM = (k, v) => mutate(x => { moduleById(x, m.id)[k] = r3(v / 100); });
      box.appendChild(h('h3', '', 'Módulo de estructura'));
      box.appendChild(h('div', 'kv', `<div>Medida<b>${cm(m.w)} × ${cm(m.d)} × ${cm(m.h)} cm</b></div><div>Base a<b>${cm(m.y)} cm del suelo</b></div>`));
      box.appendChild(h('label', '', 'Medidas (cm)'));
      const dr = h('div', 'row dims');
      dr.appendChild(this.numField('Ancho', cm(m.w), v => setM('w', Math.max(20, v))));
      dr.appendChild(this.numField('Fondo', cm(m.d), v => setM('d', Math.max(20, v))));
      dr.appendChild(this.numField('Alto', cm(m.h), v => setM('h', Math.max(20, v))));
      box.appendChild(dr);
      box.appendChild(h('label', '', 'Posición de la esquina (cm)'));
      const pr = h('div', 'row dims');
      pr.appendChild(this.numField('X', cm(m.x), v => setM('x', v)));
      pr.appendChild(this.numField('Altura', cm(m.y), v => setM('y', Math.max(0, v))));
      pr.appendChild(this.numField('Z', cm(m.z), v => setM('z', v)));
      box.appendChild(pr);
      box.appendChild(h('p', 'muted', 'Solo cambia este módulo. Los tubos que coinciden con los de al lado se comparten y las uniones se calculan solas; las flechas de abajo lo mueven con el paso elegido.'));
      const row = h('div', 'row');
      const dup = h('button', '', 'Duplicar al lado'); dup.onclick = () => mutate(x => { const c = { ...m, id: x.nextId++, x: r3(m.x + m.w), floors: { ...m.floors }, nets: {} }; x.modules.push(c); });
      row.append(dup); box.appendChild(row);
      box.appendChild(del(x => { x.modules = x.modules.filter(q => q.id !== m.id); }));
    } else if (sel.kind === 'tube') {
      const t = this.actions.tube(sel.key); if (!t) return;
      box.appendChild(h('h3', '', 'Tubo Ø48 con coquilla'));
      box.appendChild(h('div', 'kv', `<div>Largo<b>${t.len} cm</b></div><div>Eje<b>${t.axis === 'y' ? 'vertical' : 'horizontal'}</b></div><div>Coquilla<b>${nameOf(t.color)}</b></div>`));
      box.appendChild(h('label', '', 'Color de la coquilla'));
      box.appendChild(this.swatches(PVC, t.color, id => mutate(x => { x.coquillaColors[sel.key] = id; })));
      box.appendChild(h('p', 'muted', 'El largo del tubo sale de las medidas del módulo: selecciona el módulo para cambiarlas.'));
    } else if (sel.kind === 'net') {
      const [id, face] = sel.key.split(':'); const m = moduleById(st, +id); if (!m || !m.nets[face]) return;
      const r = faceRect(m, face); const nw = cm(r.u1 - r.u0), nh = cm(r.v1 - r.v0);
      box.appendChild(h('h3', '', 'Red de protección 3×3 cm'));
      box.appendChild(h('div', 'kv', `<div>Paño<b>${nw} × ${nh} cm</b></div><div>Superficie<b>${(nw * nh / 1e4).toFixed(2)} m²</b></div>`));
      box.appendChild(this.swatches(RED, m.nets[face], c => mutate(x => { moduleById(x, m.id).nets[face] = c; })));
      box.appendChild(del(x => { delete moduleById(x, m.id).nets[face]; }));
    } else if (sel.kind === 'floor') {
      const [id, face] = sel.key.split(':'); const m = moduleById(st, +id); if (!m || !m.floors[face]) return;
      const y = face === 'top' ? m.y + m.h : m.y;
      box.appendChild(h('h3', '', 'Plataforma'));
      box.appendChild(h('div', 'kv', `<div>Medida<b>${cm(m.w)} × ${cm(m.d)} cm</b></div><div>Altura<b>${cm(y) === 0 ? 'suelo' : cm(y) + ' cm'}</b></div>`));
      box.appendChild(this.swatches(PVC, m.floors[face], c => mutate(x => { moduleById(x, m.id).floors[face] = c; })));
      box.appendChild(h('p', 'muted', 'La plataforma mide lo mismo que su módulo: selecciona el módulo para cambiarla.'));
      box.appendChild(del(x => { delete moduleById(x, m.id).floors[face]; }));
    }
  }

  // ---------- presupuesto ----------
  renderPresupuesto() {
    const box = this.el.presupuesto; box.innerHTML = '';
    const st = this.store.state, s = st.settings;
    const b = computeBudget(st); this.lastBudget = b;
    if (!b.groups.length) { box.appendChild(h('p', 'muted', 'Coloca módulos y piezas para ver el presupuesto.')); return; }
    box.appendChild(h('h3', '', 'Presupuesto'));
    const kpi = (label, v, cls = '') => `<div class="stat ${cls}"><div><small>${label}</small><b>${v}</b></div></div>`;
    box.appendChild(h('div', 'stats', kpi('Total con IVA', eur(b.total), 'dark') + kpi('Subtotal', eur(b.subtotal)) + kpi(`IVA ${s.iva}%`, eur(b.iva)) + kpi(b.pendientes ? 'Sin tarifa' : 'Partidas', b.pendientes ? `${b.pendientes} partidas` : b.groups.reduce((a, g) => a + g.lines.length, 0))));
    const table = h('table', 'budget');
    table.innerHTML = '<thead><tr><th>Concepto</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead>';
    const tb = h('tbody');
    for (const g of b.groups) {
      tb.appendChild(h('tr', 'g', `<td colspan="4">${g.name}</td>`));
      for (const l of g.lines) {
        const tr = h('tr');
        tr.appendChild(h('td', '', `${l.concepto}${l.detalle ? `<div class="d">${l.detalle}</div>` : ''}${l.pendiente ? '<span class="badge p">sin tarifa</span>' : l.est && !l.override ? '<span class="badge e">estimado</span>' : l.override ? '<span class="badge o">editado</span>' : ''}`));
        tr.appendChild(h('td', 'n', `${l.cantidad} ${l.unidad}`));
        const td = h('td', 'n'); const inp = h('input'); inp.type = 'number'; inp.step = '0.01'; inp.min = '0'; inp.value = l.precio;
        inp.onchange = () => this.store.mutate(x => { x.prices[l.key] = parseFloat(inp.value) || 0; });
        td.appendChild(inp); tr.appendChild(td);
        tr.appendChild(h('td', 'n', eur(l.importe)));
        tb.appendChild(tr);
      }
    }
    tb.appendChild(h('tr', 'tot', `<td colspan="3" class="n">Subtotal</td><td class="n">${eur(b.subtotal)}</td>`));
    if (s.margen) tb.appendChild(h('tr', 'tot', `<td colspan="3" class="n">Margen ${s.margen}%</td><td class="n">${eur(b.margen)}</td>`));
    tb.appendChild(h('tr', 'tot', `<td colspan="3" class="n">IVA ${s.iva}%</td><td class="n">${eur(b.iva)}</td>`));
    tb.appendChild(h('tr', 'tot big', `<td colspan="3" class="n">TOTAL</td><td class="n">${eur(b.total)}</td>`));
    table.appendChild(tb); box.appendChild(table);
    const note = [];
    if (b.pendientes) note.push(`${b.pendientes} partidas sin tarifa (tubo, uniones, toboganes…): pon el precio en la casilla y se guarda con el parque.`);
    if (b.estimadas) note.push(`${b.estimadas} partidas con precio estimado a partir de la web.`);
    note.push('Precios de bolakids.com a 09/10/2026. Edita cualquier precio directamente en la tabla.');
    box.appendChild(h('p', 'muted', note.join(' ')));
    const row = h('div', 'row');
    const csv = h('button', '', 'Descargar CSV'); csv.onclick = () => this.actions.topbar('csv');
    const ficha = h('button', 'primary', 'Ficha para el cliente'); ficha.onclick = () => this.actions.topbar('ficha');
    if (s.margen) {} // (el margen ya está en el subtotal mostrado arriba de la tabla)
    row.append(csv, ficha); box.appendChild(row);
  }

  // ---------- ajustes ----------
  buildAjustes() {
    const box = this.el.ajustes; box.innerHTML = '';
    const fields = [
      ['nombre', 'Nombre del parque', 'text'], ['cliente', 'Cliente', 'text'],
      ['vano', 'Ancho/fondo de módulo por defecto (cm)', 'number'], ['altura', 'Alto de módulo por defecto (cm)', 'number'],
      ['tuboLargos', 'Largos de tubo en stock (cm, separados por coma)', 'text'], ['coquillaLargo', 'Largo de coquilla (cm)', 'number'],
      ['bridasPorCoquilla', 'Bridas por tramo de coquilla', 'number'], ['bridasPorPack', 'Bridas por pack', 'number'],
      ['bridasRedPorMetro', 'Bridas de red por metro', 'number'], ['bridasRedPorPack', 'Bridas de red por pack', 'number'],
      ['bolasPorM2', 'Bolas por m² de piscina', 'number'], ['margen', 'Margen (%)', 'number'], ['iva', 'IVA (%)', 'number'],
    ];
    box.appendChild(h('h3', '', 'Ajustes del parque'));
    box.appendChild(h('p', 'muted', 'Medidas con las que arranca la herramienta Módulo. Cada módulo guarda las suyas propias en cm.'));
    this.ajInputs = {};
    for (const [k, label, type] of fields) {
      const w = h('div', 'field'); w.appendChild(h('label', '', label));
      const inp = h('input'); inp.type = type; if (type === 'number') { inp.step = 'any'; }
      inp.onchange = () => this.store.mutate(s => { s.settings[k] = type === 'number' ? (parseFloat(inp.value) || 0) : inp.value; });
      w.appendChild(inp); box.appendChild(w); this.ajInputs[k] = inp;
    }
    const w = h('div', 'field row'); const chk = h('input'); chk.type = 'checkbox'; chk.id = 'chkCotas';
    chk.onchange = () => this.store.mutate(s => { s.settings.mostrarCotas = chk.checked; });
    w.append(chk, h('label', '', 'Mostrar cotas generales')); w.querySelector('label').htmlFor = 'chkCotas'; box.appendChild(w); this.ajInputs.mostrarCotas = chk;
    const reset = h('button', 'danger', 'Vaciar parque'); reset.onclick = () => { if (confirm('¿Vaciar el parque actual?')) this.actions.topbar('new'); };
    box.appendChild(reset);
  }
  syncAjustes() {
    const s = this.store.state.settings;
    for (const [k, inp] of Object.entries(this.ajInputs)) {
      if (document.activeElement === inp) continue;
      if (inp.type === 'checkbox') inp.checked = !!s[k]; else inp.value = s[k] ?? '';
    }
    if (document.activeElement !== this.el.name) this.el.name.value = s.nombre;
  }

  refresh() {
    this.syncAjustes();
    this.renderColorBox();
    if (this.tab === 'pieza') this.renderPieza();
    if (this.tab === 'presupuesto') this.renderPresupuesto();
  }
}
