import * as THREE from 'three';

const cache = new Map();
export const viewport = { w: 0, h: 0 };
export function setViewport(w, h) { viewport.w = w; viewport.h = h; }

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
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  cache.set(k, t); return t;
}

// Damero bicolor (tatami).
export function checkerTexture(hexA, hexB) {
  const k = `chk${hexA}${hexB}`;
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = hexA; g.fillRect(0, 0, 64, 64);
  g.fillStyle = hexB; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  cache.set(k, t); return t;
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

// Celosía de cintas bicolor (túnel de cintas): bandas A horizontales y B verticales.
export function latticeTexture(hexA, hexB) {
  const k = `lat${hexA}${hexB}`;
  if (cache.has(k)) return cache.get(k);
  const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.fillStyle = hexA; for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 4, size, 16);
  g.fillStyle = hexB; for (let i = 0; i < 4; i++) g.fillRect(i * 32 + 4, 0, 16, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(k, t); return t;
}
