import * as THREE from 'three';
import { mat } from './models.js';
import { hexOf } from './palette.js';

// Persona del modo visita: figura de bloques (estilo Minecraft) a escala real.
// Pies en el origen, mira a -Z. Las medidas sirven también como referencia de escala del parque.
export const PRESETS = [
  { id: 'peque',  name: 'Peque · 1,15 m',  h: 1.15, legs: 0.42, torso: 0.40, head: 0.27, w: 0.26, speed: 1.4 },
  { id: 'mayor',  name: 'Mayor · 1,40 m',  h: 1.40, legs: 0.56, torso: 0.50, head: 0.28, w: 0.30, speed: 1.7 },
  { id: 'adulto', name: 'Adulto · 1,70 m', h: 1.70, legs: 0.74, torso: 0.62, head: 0.29, w: 0.36, speed: 1.9 },
];
export const SKINS = [
  { id: '#f3cfae', name: 'Piel clara', hex: '#f3cfae' }, { id: '#dba57a', name: 'Piel media', hex: '#dba57a' },
  { id: '#a9703f', name: 'Piel morena', hex: '#a9703f' }, { id: '#5b3a25', name: 'Piel oscura', hex: '#5b3a25' },
];
export const HAIRS = [
  { id: '#2b1d12', name: 'Castaño oscuro', hex: '#2b1d12' }, { id: '#7a4a2a', name: 'Castaño', hex: '#7a4a2a' },
  { id: '#d9a441', name: 'Rubio', hex: '#d9a441' }, { id: '#1a1a1a', name: 'Negro', hex: '#1a1a1a' }, { id: '#b3402b', name: 'Pelirrojo', hex: '#b3402b' },
];
export const presetById = id => PRESETS.find(p => p.id === id) || PRESETS[0];

function part(w, h, d, m, dy = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.castShadow = true; me.receiveShadow = true; me.position.y = dy; return me;
}

export function buildAvatar(p, colors) {
  const skin = mat(colors.piel), hair = mat(colors.pelo), shirt = mat(hexOf(colors.camiseta)), pants = mat(hexOf(colors.pantalon));
  const shoe = mat('#2a2a2a'), dark = mat('#1a1a1a'), mouth = mat('#b5523f');
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const w = p.w, t = w * 0.5, legW = w * 0.42, armW = w * 0.28, armL = p.torso * 0.95;
  // piernas con pivote en la cadera
  const leg = x => {
    const g = new THREE.Group(); g.position.set(x, p.legs, 0);
    g.add(part(legW, p.legs - 0.04, t * 0.9, pants, -(p.legs - 0.04) / 2));
    const s = part(legW + 0.02, 0.06, t * 1.15, shoe, -p.legs + 0.03); s.position.z = -0.015; g.add(s);
    return g;
  };
  // brazos con pivote en el hombro (manga + mano)
  const arm = x => {
    const g = new THREE.Group(); g.position.set(x, p.legs + p.torso - 0.03, 0);
    g.add(part(armW, armL * 0.55, armW, shirt, -armL * 0.275));
    g.add(part(armW * 0.9, armL * 0.45, armW * 0.9, skin, -armL * 0.775));
    return g;
  };
  const legL = leg(-w * 0.23), legR = leg(w * 0.23);
  const armL_ = arm(-(w / 2 + armW / 2 + 0.005)), armR = arm(w / 2 + armW / 2 + 0.005);
  const torso = part(w, p.torso, t, shirt, p.legs + p.torso / 2);
  const head = new THREE.Group(); head.position.y = p.legs + p.torso + 0.02;
  const hs = p.head;
  head.add(part(hs, hs, hs * 0.92, skin, hs / 2));
  head.add(part(hs + 0.02, hs * 0.3, hs * 0.94, hair, hs * 0.85 + 0.005));
  const back = part(hs + 0.02, hs * 0.55, hs * 0.18, hair, hs * 0.55); back.position.z = hs * 0.42; head.add(back);
  for (const sx of [-1, 1]) { const eye = part(hs * 0.12, hs * 0.14, 0.01, dark, hs * 0.56); eye.position.set(sx * hs * 0.2, hs * 0.56, -hs * 0.46); head.add(eye); }
  const mo = part(hs * 0.3, hs * 0.05, 0.01, mouth, hs * 0.3); mo.position.z = -hs * 0.46; head.add(mo);
  rig.add(legL, legR, torso, armL_, armR, head);
  root.userData.parts = { rig, legL, legR, armL: armL_, armR, head, torso };
  root.userData.preset = p;
  return root;
}

// Postura según lo que hace: andar/parado, deslizarse sentado, en el aire o entre bolas.
export function poseAvatar(av, { mode, phase, speed, t }) {
  const P = av.userData.parts, p = av.userData.preset;
  for (const o of [P.legL, P.legR, P.armL, P.armR, P.head]) o.rotation.set(0, 0, 0);
  P.rig.position.y = 0; P.rig.rotation.x = 0;
  if (mode === 'slide') {
    P.rig.position.y = -p.legs * 0.9; P.rig.rotation.x = -0.12;
    P.legL.rotation.x = P.legR.rotation.x = 1.35;   // piernas hacia delante (sentado)
    P.armL.rotation.x = P.armR.rotation.x = 2.4; P.armL.rotation.z = 0.5; P.armR.rotation.z = -0.5; // brazos arriba y adelante
    return;
  }
  if (mode === 'air') { P.armL.rotation.x = P.armR.rotation.x = -2.6; P.legL.rotation.x = 0.5; P.legR.rotation.x = -0.3; return; }
  const k = Math.min(1, speed / 1.4), s = Math.sin(phase) * 0.8 * k;
  P.legL.rotation.x = s; P.legR.rotation.x = -s;
  P.rig.position.y = Math.abs(Math.sin(phase)) * 0.035 * k;
  if (mode === 'balls') {
    const wg = Math.sin(t * 6) * 0.25;
    P.armL.rotation.x = -2.7 + wg; P.armR.rotation.x = -2.7 - wg; P.armL.rotation.z = 0.35; P.armR.rotation.z = -0.35;
    return;
  }
  P.armL.rotation.x = -s * 0.8; P.armR.rotation.x = s * 0.8;
  P.armL.rotation.z = 0.06; P.armR.rotation.z = -0.06;
  P.head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - k);
}
