import * as THREE from 'three';
import { bounds, moduleSummary } from './state.js';
import { textSprite } from './textures.js';

// Cotas generales del parque (largo, ancho, alto) y etiqueta de la pieza seleccionada.
export class Dims {
  constructor(scene) { this.group = new THREE.Group(); scene.add(this.group); this.mat = new THREE.LineBasicMaterial({ color: 0x222831 }); }
  clear() { this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); this.group.clear(); }

  line(a, b) { this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), this.mat)); }
  dim(a, b, label, tick) {
    this.line(a, b);
    this.line(a.clone().sub(tick), a.clone().add(tick));
    this.line(b.clone().sub(tick), b.clone().add(tick));
    const sp = textSprite(label); sp.position.copy(a).lerp(b, 0.5).add(tick.clone().multiplyScalar(1.6)); this.group.add(sp);
  }

  update(state, selection) {
    this.clear();
    const s = state.settings;
    const bb = bounds(state);
    if (bb && s.mostrarCotas) {
      const [x0, y0, z0] = bb.min, [x1, y1, z1] = bb.max;
      const cm = v => Math.round(v * 100);
      const L = cm(x1 - x0), A = cm(z1 - z0), Hc = cm(y1 - y0);
      const off = 0.45, y = 0.02;
      this.dim(new THREE.Vector3(x0, y, z1 + off), new THREE.Vector3(x1, y, z1 + off), `Largo ${L} cm`, new THREE.Vector3(0, 0, 0.1));
      this.dim(new THREE.Vector3(x1 + off, y, z0), new THREE.Vector3(x1 + off, y, z1), `Ancho ${A} cm`, new THREE.Vector3(0.1, 0, 0));
      this.dim(new THREE.Vector3(x1 + off, 0, z0 - off), new THREE.Vector3(x1 + off, y1, z0 - off), `Alto ${Hc} cm`, new THREE.Vector3(0.1, 0, 0));
      const mods = moduleSummary(state);
      const txt = mods.length === 1 ? `Módulo ${mods[0]} cm` : mods.length ? `${mods.length} medidas de módulo` : '';
      if (txt) { const info = textSprite(txt, { size: 22, bg: 'rgba(43,127,255,0.15)' }); info.position.set(x0, y1 + 0.5, z0); this.group.add(info); }
    }
    if (selection && selection.label) {
      const sp = textSprite(selection.label, { size: 24, bg: 'rgba(255,122,0,0.9)', color: '#fff' });
      sp.position.copy(selection.pos); this.group.add(sp);
    }
  }
}
