import { nameOf } from './palette.js';

function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safe = n => (n || 'parque').replace(/[^\w\dáéíóúñü -]/gi, '').trim().replace(/\s+/g, '_');
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

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
const LOGO = new URL(`${import.meta.env.BASE_URL || "/"}logo-bolakids.png`, location.href).href;

// Presupuesto / ficha para el cliente: documento imprimible (PDF) con el logo de BolaKids,
// imagen 3D, medidas y desglose por capítulos. Mismo formato siempre.
export function openFicha(state, budget, imgUrl, dimsText) {
  const s = state.settings;
  const hoy = new Date();
  const fecha = hoy.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const ref = s.referencia || `P-${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
  const validez = s.validez || 30;
  const nLines = budget.groups.reduce((a, g) => a + g.lines.length, 0);
  const rows = budget.groups.map(g => {
    const sub = g.lines.reduce((a, l) => a + l.importe, 0);
    return `<tr class="g"><td colspan="4">${esc(g.name)}</td><td class="n">${eur(sub)}</td></tr>
    ${g.lines.map(l => `<tr><td><div class="c">${esc(l.concepto)}${l.pendiente ? '<span class="tag p">pendiente de tarifa</span>' : l.est && !l.override ? '<span class="tag e">estimado</span>' : ''}</div>${l.detalle ? `<div class="d">${esc(l.detalle)}</div>` : ''}</td><td class="n">${l.cantidad}</td><td class="u">${esc(l.unidad)}</td><td class="n">${l.pendiente ? '—' : eur(l.precio)}</td><td class="n">${l.pendiente ? '—' : eur(l.importe)}</td></tr>`).join('')}`;
  }).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(s.nombre)} · Presupuesto</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{--ink:#2b2b2b;--mut:#6f7276;--line:#e6e4df;--soft:#f6f5f1;--pink:#c0145a;--teal:#4fb3b3;--orange:#f39a1c;--grey:#58595b}
    *{box-sizing:border-box} body{font-family:"Plus Jakarta Sans",Helvetica,Arial,sans-serif;color:var(--ink);margin:0;background:#fff}
    .page{max-width:900px;margin:0 auto;padding:36px 44px 48px}
    header{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-bottom:18px;border-bottom:1px solid var(--line)}
    header img{height:62px;width:auto;display:block}
    .meta{text-align:right;font-size:12.5px;color:var(--mut);line-height:1.5}
    .meta b{display:block;color:var(--ink);font-size:13px}
    .bar{height:5px;border-radius:999px;background:linear-gradient(90deg,var(--pink) 0 33%,var(--teal) 33% 66%,var(--orange) 66% 100%);margin:18px 0 26px}
    h1{margin:0 0 4px;font-size:28px;letter-spacing:-.02em;font-weight:800}
    .sub{color:var(--mut);font-size:14px;margin:0 0 20px}
    .hero{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:stretch}
    .hero img{width:100%;height:100%;object-fit:cover;border-radius:14px;border:1px solid var(--line);background:#e6e4dd}
    .cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .card{background:var(--soft);border-radius:12px;padding:12px 14px;font-size:11.5px;color:var(--mut)}
    .card b{display:block;font-size:17px;color:var(--ink);margin-top:2px;letter-spacing:-.01em;font-weight:700}
    .card.total{grid-column:1/-1;background:var(--grey);color:#d9d9d9}.card.total b{color:#fff;font-size:24px}
    h2{font-size:16px;margin:30px 0 10px;letter-spacing:-.01em}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    thead th{text-align:left;font-weight:600;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:8px 8px;border-bottom:2px solid var(--ink)}
    td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
    tr.g td{background:var(--soft);font-weight:700;padding-top:10px;padding-bottom:10px;border-bottom:none}
    tr.g td:first-child{border-left:4px solid var(--teal);border-radius:6px 0 0 6px}
    .n{text-align:right;white-space:nowrap} .u{color:var(--mut)} .c{font-weight:600} .d{color:var(--mut);font-size:11px;margin-top:2px}
    .tag{display:inline-block;font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:999px;margin-left:6px;vertical-align:middle;text-transform:uppercase;letter-spacing:.04em}
    .tag.p{background:#fde8ee;color:var(--pink)} .tag.e{background:#fff1dc;color:#b36f12}
    .totals{margin-top:14px;margin-left:auto;width:320px;font-size:13px}
    .totals div{display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--line)}
    .totals .big{background:var(--grey);color:#fff;border-radius:10px;font-weight:800;font-size:17px;padding:12px 14px;margin-top:8px;border:none}
    .note{font-size:11px;color:var(--mut);margin-top:26px;line-height:1.55}
    footer{margin-top:34px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:11px;color:var(--mut)}
    footer b{color:var(--grey)} footer i{color:var(--pink);font-style:normal}
    @media print{.page{padding:0;max-width:none} body{-webkit-print-color-adjust:exact;print-color-adjust:exact} tr{page-break-inside:avoid} h2{page-break-after:avoid}}
    @page{margin:14mm 12mm}
  </style></head><body><div class="page">
  <header><img src="${LOGO}" alt="bolakids · funny toys factory"><div class="meta"><b>Presupuesto ${esc(ref)}</b>${esc(fecha)}<br>Validez ${validez} días</div></header>
  <div class="bar"></div>
  <h1>${esc(s.nombre)}</h1>
  <p class="sub">${s.cliente ? 'Preparado para <b>' + esc(s.cliente) + '</b> · ' : ''}Parque de bolas modular · estructura Ø48 con coquilla, redes homologadas y juegos de espuma forrada en PVC ignífugo</p>
  <div class="hero"><img src="${imgUrl}" alt="Vista 3D del parque"><div class="cards">
    ${dimsText.map(d => `<div class="card">${esc(d.k)}<b>${esc(d.v)}</b></div>`).join('')}
    <div class="card total">Total con IVA<b>${eur(budget.total)}</b></div>
  </div></div>
  <h2>Desglose del presupuesto <span style="color:var(--mut);font-weight:500;font-size:12px">· ${nLines} partidas</span></h2>
  <table><thead><tr><th>Concepto</th><th class="n">Cant.</th><th>Ud.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${eur(budget.subtotal)}</span></div>
    ${s.margen ? `<div><span>Margen ${s.margen}%</span><span>${eur(budget.margen)}</span></div>` : ''}
    <div><span>Base imponible</span><span>${eur(budget.base)}</span></div>
    <div><span>IVA ${s.iva}%</span><span>${eur(budget.iva)}</span></div>
    <div class="big"><span>TOTAL</span><span>${eur(budget.total)}</span></div>
  </div>
  <p class="note">${budget.pendientes ? `<b>${budget.pendientes} partidas pendientes de tarifa</b> no están incluidas en el total y se confirmarán en la oferta definitiva. ` : ''}${budget.estimadas ? `${budget.estimadas} partidas con precio estimado. ` : ''}Diseño y fabricación conforme a UNE-EN 1176-1, 1176-3 y 1176-10. Colores según carta de PVC ignífugo; las imágenes son una representación orientativa. Montaje, transporte y certificación no incluidos salvo que se indique. Presupuesto orientativo con validez de ${validez} días.</p>
  <footer><div><b>bolakids</b> · funny toys factory</div><div>${esc(s.nombre)} · ${esc(ref)} · <i>bolakids.com</i></div></footer>
  </div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador ha bloqueado la ventana del presupuesto. Permite las ventanas emergentes para este sitio.'); return; }
  w.document.write(html); w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
}
