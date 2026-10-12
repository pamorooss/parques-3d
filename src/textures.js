import * as THREE from 'three';

const cache = new Map();
export const viewport = { w: 0, h: 0 };
export function setViewport(w, h) { viewport.w = w; viewport.h = h; }

function canvasTexture(k, c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.name = k;
  if (opts.nearest) t.magFilter = THREE.NearestFilter;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  cache.set(k, t); return t;
}

// Textura de red: líneas blancas sobre fondo transparente; se tiñe con material.color.
export function netTexture(cells = 8, lineWidth = 3) {
  const k = `net${cells}_${lineWidth}`;
  if (cache.has(k)) return cache.get(k);
  const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.strokeStyle = '#ffffff'; g.lineWidth = lineWidth;
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(size, i * step); g.stroke();
  }
  return canvasTexture(k, c);
}

// Damero bicolor (tatami).
export function checkerTexture(hexA, hexB) {
  const k = `chk${hexA}${hexB}`;
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = hexA; g.fillRect(0, 0, 64, 64);
  g.fillStyle = hexB; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  return canvasTexture(k, c, { nearest: true });
}

// Estilos de acabado con hasta 3 colores: 'liso' (solo A), 'mitades', 'rayas' (verticales),
// 'franjas' (horizontales) y 'cuadros'. n = número de bandas/casillas por periodo; rep = repetición (u, v).
export const ESTILOS = [
  { id: 'liso', name: 'Liso' }, { id: 'mitades', name: 'Mitades' }, { id: 'rayas', name: 'Rayas' },
  { id: 'franjas', name: 'Franjas' }, { id: 'cuadros', name: 'Cuadros' },
];
export function patternTexture(style, hexes, n = 8, rep = [1, 1]) {
  const k = `pat|${style}|${hexes.join('')}|${n}|${rep[0].toFixed(3)}|${rep[1].toFixed(3)}`;
  if (cache.has(k)) return cache.get(k);
  const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const L = hexes.length;
  const band = size / n;
  if (style === 'rayas') { for (let i = 0; i < n; i++) { g.fillStyle = hexes[i % L]; g.fillRect(Math.floor(i * band), 0, Math.ceil(band) + 1, size); } }
  else if (style === 'franjas') { for (let i = 0; i < n; i++) { g.fillStyle = hexes[i % L]; g.fillRect(0, Math.floor(i * band), size, Math.ceil(band) + 1); } }
  else if (style === 'cuadros') { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = hexes[(i + j) % L]; g.fillRect(Math.floor(i * band), Math.floor(j * band), Math.ceil(band) + 1, Math.ceil(band) + 1); } }
  else { const w = size / L; for (let i = 0; i < L; i++) { g.fillStyle = hexes[i]; g.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, size); } }
  return canvasTexture(k, c, { nearest: true, repeat: rep });
}

// Etiqueta de texto como sprite.
export function textSprite(text, { size = 28, color = '#111', bg = 'rgba(255,255,255,0.85)' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${size}px Helvetica, Arial, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 20, h = size + 16;
  c.width = w; c.height = h;
  g.font = `bold ${size}px Helvetica, Arial, sans-serif`;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 10, h / 2);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false });
  const sp = new THREE.Sprite(m);
  // Tamaño fijo en pantalla: con sizeAttenuation=false la escala está en unidades de clip (2 = todo el viewport).
  const vw = viewport.w || 1200, vh = viewport.h || 800, px = 0.24;
  sp.scale.set(w * px * 2 / vw, h * px * 2 / vh, 1);
  sp.renderOrder = 999;
  return sp;
}

// Celosía de cintas bicolor (túnel de cintas, redes de cintas): bandas A horizontales y B verticales.
export function latticeTexture(hexA, hexB, rep = [1, 1]) {
  const k = `lat${hexA}${hexB}|${rep[0].toFixed(3)}|${rep[1].toFixed(3)}`;
  if (cache.has(k)) return cache.get(k);
  const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.fillStyle = hexA; for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 4, size, 16);
  g.fillStyle = hexB; for (let i = 0; i < 4; i++) g.fillRect(i * 32 + 4, 0, 16, size);
  // puntadas en cruz en los cruces
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 32 + 4, y = j * 32 + 4;
    g.beginPath(); g.moveTo(x + 2, y + 2); g.lineTo(x + 14, y + 14); g.moveTo(x + 14, y + 2); g.lineTo(x + 2, y + 14); g.stroke();
  }
  return canvasTexture(k, c, { repeat: rep });
}
