import { nameOf } from './palette.js';

function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safe = n => (n || 'parque').replace(/[^\w\dáéíóúñü -]/gi, '').trim().replace(/\s+/g, '_');

export function saveJSON(state) {
  download(`${safe(state.settings.nombre)}.parque.json`, new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
}

export function snapshotPNG(sc, before, after) {
  before && before(); sc.render();
  const url = sc.renderer.domElement.toDataURL('image/png');
  after && after(); return url;
}
export function savePhoto(state, dataUrl) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = `${safe(state.settings.nombre)}.png`; a.click();
}

export function saveCSV(state, budget) {
  const rows = [['Grupo', 'Concepto', 'Detalle', 'Cantidad', 'Unidad', 'Precio', 'Importe', 'Estado']];
  for (const g of budget.groups) for (const l of g.lines) rows.push([g.name, l.concepto, l.detalle || '', l.cantidad, l.unidad, l.precio, l.importe, l.pendiente ? 'pendiente' : l.est && !l.override ? 'estimado' : '']);
  rows.push([], ['', 'Subtotal', '', '', '', '', budget.subtotal.toFixed(2)], ['', `Margen ${state.settings.margen}%`, '', '', '', '', budget.margen.toFixed(2)], ['', `IVA ${state.settings.iva}%`, '', '', '', '', budget.iva.toFixed(2)], ['', 'TOTAL', '', '', '', '', budget.total.toFixed(2)]);
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  download(`${safe(state.settings.nombre)}_presupuesto.csv`, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}

const eur = n => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

// Ficha estándar para el cliente: mismo formato siempre.
export function openFicha(state, budget, imgUrl, dimsText) {
  const s = state.settings;
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const rows = budget.groups.map(g => `
    <tr class="g"><td colspan="5">${g.name}</td></tr>
    ${g.lines.map(l => `<tr><td>${l.concepto}${l.detalle ? `<div class="d">${l.detalle}</div>` : ''}</td><td class="n">${l.cantidad}</td><td>${l.unidad}</td><td class="n">${l.pendiente ? '<span class="p">pendiente</span>' : eur(l.precio)}</td><td class="n">${eur(l.importe)}</td></tr>`).join('')}`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${s.nombre} · Ficha del parque</title>
  <style>
    body{font-family:Helvetica,Arial,sans-serif;color:#1b1f24;margin:0;padding:28px 36px;max-width:960px}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #2b7fff;padding-bottom:10px}
    h1{margin:0;font-size:26px} .sub{color:#555;font-size:13px}
    .logo{font-weight:800;font-size:22px;color:#2b7fff} .logo span{color:#ff7a00}
    img{width:100%;border-radius:8px;margin:18px 0 8px;border:1px solid #dde}
    .dims{display:flex;gap:24px;font-size:14px;margin:6px 0 18px} .dims b{display:block;font-size:18px}
    table{width:100%;border-collapse:collapse;font-size:12.5px} td{padding:5px 6px;border-bottom:1px solid #e6e9ee;vertical-align:top}
    tr.g td{background:#eef4ff;font-weight:700;padding-top:9px} .n{text-align:right;white-space:nowrap} .d{color:#667;font-size:11px}
    .p{color:#c0392b;font-weight:700} .tot td{font-weight:700;border-top:2px solid #1b1f24} .tot.big td{font-size:16px;background:#fff6ec}
    .note{font-size:11px;color:#667;margin-top:14px} h2{font-size:16px;margin:18px 0 8px}
    @media print{body{padding:10mm}}
  </style></head><body>
  <header><div><h1>${s.nombre}</h1><div class="sub">${s.cliente ? 'Cliente: ' + s.cliente + ' · ' : ''}${fecha}</div></div></header>
  <img src="${imgUrl}" alt="Vista 3D del parque">
  <div class="dims">${dimsText.map(d => `<div>${d.k}<b>${d.v}</b></div>`).join('')}</div>
  <h2>Presupuesto</h2>
  <table><thead><tr><td>Concepto</td><td class="n">Cant.</td><td>Ud.</td><td class="n">Precio</td><td class="n">Importe</td></tr></thead>
  <tbody>${rows}
  <tr class="tot"><td colspan="4" class="n">Subtotal</td><td class="n">${eur(budget.subtotal)}</td></tr>
  ${s.margen ? `<tr class="tot"><td colspan="4" class="n">Margen ${s.margen}%</td><td class="n">${eur(budget.margen)}</td></tr>` : ''}
  <tr class="tot"><td colspan="4" class="n">IVA ${s.iva}%</td><td class="n">${eur(budget.iva)}</td></tr>
  <tr class="tot big"><td colspan="4" class="n">TOTAL</td><td class="n">${eur(budget.total)}</td></tr></tbody></table>
  <p class="note">${budget.pendientes ? `${budget.pendientes} partidas sin precio (pendiente de tarifa). ` : ''}${budget.estimadas ? `${budget.estimadas} partidas con precio estimado. ` : ''}Diseño y fabricación conforme a UNE-EN 1176-1, 1176-3 y 1176-10. Colores según carta de PVC ignífugo. Presupuesto orientativo, validez 30 días.</p>
  </body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
  w.onload = () => setTimeout(() => w.print(), 300);
}
