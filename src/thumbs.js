import * as THREE from 'three';
import { buildElement } from './models.js';
import { ELEMENTS, defaultColors } from './catalog.js';
import { DEFAULT_SETTINGS } from './config.js';

// Miniaturas del catálogo: cada pieza se construye con el mismo modelo 3D que en el
// parque y se renderiza en pequeño (fondo transparente) usando el renderer principal.
const W = 256, H = 192;
const settings = { ...DEFAULT_SETTINGS, vano: 100, fondo: 100, altura: 150, caida: 0 };
let rt, scene, camera, buf, canvas, ctx2d;

function setup() {
  rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a968a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-4, 2, -3); scene.add(fill);
  camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
  buf = new Uint8Array(W * H * 4);
  canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; ctx2d = canvas.getContext('2d');
}

export function makeThumb(renderer, type) {
  if (!rt) setup();
  // toboganes y rampas se muestran como en el parque: bajando desde una planta de 1 m
  const exit = ELEMENTS[type].place === 'exit';
  const el = { type, x: 0, y: exit ? 1 : 0, z: 0, r: 0, colors: defaultColors(type) };
  const g = buildElement(el, { ...settings, caida: exit ? 100 : 0 });
  g.traverse(o => { o.castShadow = false; o.receiveShadow = false; });
  scene.add(g);
  // encuadre: desde una diagonal baja, acercando hasta que las 8 esquinas de la caja llenan el cuadro
  const box = new THREE.Box3().setFromObject(g);
  const center = box.getCenter(new THREE.Vector3());
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  // las piezas de salida (toboganes, rampas) y las de cara miran a -Z: se ven desde delante
  const front = exit || ELEMENTS[type].place === 'face';
  const dir = new THREE.Vector3(1, 0.55, front ? -1.25 : 1.25).normalize();
  const fits = d => {
    camera.position.copy(center).addScaledVector(dir, d); camera.lookAt(center); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    return corners.every(c => { const p = c.clone().project(camera); return Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9; });
  };
  let lo = 0.2, hi = 40; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  fits(hi);

  const prevTarget = renderer.getRenderTarget(); const prevColor = new THREE.Color(); renderer.getClearColor(prevColor); const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha);
  scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); });

  // el buffer viene volteado verticalmente
  const img = ctx2d.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  ctx2d.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// Genera todas las miniaturas repartidas en varios frames para no bloquear el arranque.
export function buildAllThumbs(renderer, onThumb) {
  const types = Object.keys(ELEMENTS); let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < types.length && performance.now() - t0 < 12) { const t = types[i++]; try { onThumb(t, makeThumb(renderer, t)); } catch (e) { console.warn('miniatura', t, e); } }
    if (i < types.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
