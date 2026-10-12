import * as THREE from 'three';
import { deriveStructure } from './structure.js';
import { localSettings, faceRect, rectKey } from './state.js';
import { hexOf } from './palette.js';
import { mat, metalMat, buildElement } from './models.js';
import { netTexture } from './textures.js';

export const FLOOR_OFF = 0.066; // plataforma apoyada sobre el anillo de tubos
export const TUBE_R = 0.044;    // coquilla 8,8 cm Ø

export class ParkRenderer {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    this.pickGroup = new THREE.Group(); scene.add(this.pickGroup);
    this.byKey = new Map();
    this.ghost = this.makeGhost(); scene.add(this.ghost);
    this.highlight = null;
  }

  makeGhost() {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0x2b7fff, transparent: true, opacity: 0.25, depthWrite: false });
    g.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m); g.add(g.box);
    g.edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x2b7fff }));
    g.add(g.edges);
    g.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12), new THREE.MeshBasicMaterial({ color: 0xff7a00 }));
    g.arrow.rotation.x = -Math.PI / 2; g.add(g.arrow);
    g.visible = false;
    return g;
  }

  // Fantasma: caja en coordenadas de mundo {x0,y0,z0,w,h,d}; flecha opcional marcando el frente (rot).
  setGhost({ box, rot = 0, showArrow = false, color = 0x2b7fff }) {
    const g = this.ghost; g.visible = true;
    g.box.material.color.set(color); g.edges.material.color.set(color);
    g.arrow.visible = showArrow;
    g.position.set(box.x0 + box.w / 2, box.y0 + box.h / 2, box.z0 + box.d / 2);
    g.box.scale.set(box.w, box.h, box.d); g.edges.scale.set(box.w, box.h, box.d);
    if (showArrow) {
      const V = Math.min(box.w, box.d);
      g.arrow.position.set(Math.sin(-rot * Math.PI / 2) * -V * 0.35, -box.h / 2 + 0.2, Math.cos(rot * Math.PI / 2) * -V * 0.35);
      g.arrow.rotation.set(-Math.PI / 2, 0, 0); g.arrow.rotation.order = 'YXZ'; g.arrow.rotation.y = rot * Math.PI / 2;
    }
  }
  hideGhost() { this.ghost.visible = false; }

  setHighlight(obj) {
    if (this.highlight) { this.scene.remove(this.highlight); this.highlight.geometry.dispose(); this.highlight = null; }
    if (!obj) return;
    this.highlight = new THREE.BoxHelper(obj, 0xff7a00);
    this.highlight.material.depthTest = false; this.highlight.renderOrder = 998;
    this.scene.add(this.highlight);
  }

  clear() {
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.pickGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.root.clear(); this.pickGroup.clear(); this.byKey.clear();
  }

  rebuild(state) {
    this.clear();
    const s = state.settings;
    const st = deriveStructure(state);
    this.structure = st;

    // Tubos con coquilla (una geometría por largo distinto)
    const tubeGeos = new Map();
    const tubeGeo = len => { if (!tubeGeos.has(len)) tubeGeos.set(len, new THREE.CylinderGeometry(TUBE_R, TUBE_R, len, 16)); return tubeGeos.get(len); };
    for (const t of st.tubes) {
      const m = new THREE.Mesh(tubeGeo(t.len / 100), mat(hexOf(t.color)));
      m.castShadow = m.receiveShadow = true;
      m.position.set((t.a[0] + t.b[0]) / 200, (t.a[1] + t.b[1]) / 200, (t.a[2] + t.b[2]) / 200);
      if (t.axis === 'x') m.rotation.z = Math.PI / 2; else if (t.axis === 'z') m.rotation.x = Math.PI / 2;
      m.userData = { type: 'tube', key: t.key };
      this.root.add(m); this.byKey.set('tube:' + t.key, m);
    }
    // Nudos (uniones)
    const nodeGeo = new THREE.SphereGeometry(TUBE_R + 0.012, 12, 10);
    const plateGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.012, 20);
    for (const n of st.nodes) {
      const m = new THREE.Mesh(nodeGeo, metalMat()); m.castShadow = true;
      m.position.set(n.pos[0] / 100, n.pos[1] / 100, n.pos[2] / 100);
      m.userData = { type: 'node', key: n.key }; this.root.add(m);
      if (n.ground) { const pl = new THREE.Mesh(plateGeo, metalMat()); pl.position.set(n.pos[0] / 100, 0.006, n.pos[2] / 100); this.root.add(pl); }
    }
    // Plataformas y redes por módulo (las caras compartidas se dibujan una vez)
    const netTex = netTexture(8, 3); const seen = new Set();
    for (const m of state.modules) {
      for (const face of ['top', 'bottom']) {
        const color = m.floors && m.floors[face]; if (!color) continue;
        const r = faceRect(m, face); const k = rectKey(r); if (seen.has(k)) continue; seen.add(k);
        const me = new THREE.Mesh(new THREE.BoxGeometry(m.w, 0.04, m.d), mat(hexOf(color)));
        me.castShadow = me.receiveShadow = true;
        me.position.set(m.x + m.w / 2, r.at + (r.at > 0.001 ? FLOOR_OFF : 0.02), m.z + m.d / 2);
        me.userData = { type: 'floor', key: `${m.id}:${face}` }; this.root.add(me); this.byKey.set('floor:' + me.userData.key, me);
      }
      for (const face of ['+x', '-x', '+z', '-z']) {
        const color = m.nets && m.nets[face]; if (!color) continue;
        const r = faceRect(m, face); const k = rectKey(r); if (seen.has(k)) continue; seen.add(k);
        const w = r.u1 - r.u0, h = r.v1 - r.v0;
        const tex = netTex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 0.5, h / 0.5);
        const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(hexOf(color), { map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }));
        me.castShadow = true;
        if (r.axis === 'x') { me.rotation.y = Math.PI / 2; me.position.set(r.at, (r.v0 + r.v1) / 2, (r.u0 + r.u1) / 2); }
        else me.position.set((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, r.at);
        me.userData = { type: 'net', key: `${m.id}:${face}` }; this.root.add(me); this.byKey.set('net:' + me.userData.key, me);
      }
    }
    // Elementos (x, y, z en metros)
    for (const el of state.elements) {
      const g = buildElement(el, localSettings(state, el), { drop: el.y });
      const onFloor = state.modules.some(m => m.floors && ((m.floors.top && Math.abs(m.y + m.h - el.y) < 0.01) || (m.floors.bottom && Math.abs(m.y - el.y) < 0.01)) && el.x >= m.x && el.x <= m.x + m.w && el.z >= m.z && el.z <= m.z + m.d)
        ? (el.y > 0.001 ? FLOOR_OFF + 0.02 : 0.04) : 0;
      g.position.set(el.x, el.y + onFloor, el.z);
      g.rotation.y = el.r * Math.PI / 2;
      g.userData = { type: 'element', id: el.id };
      this.root.add(g); this.byKey.set('element:' + el.id, g);
    }
    // Cajas invisibles para apuntar a los módulos
    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    for (const m of state.modules) {
      const me = new THREE.Mesh(new THREE.BoxGeometry(m.w, m.h, m.d), pickMat);
      me.position.set(m.x + m.w / 2, m.y + m.h / 2, m.z + m.d / 2);
      me.userData = { type: 'module', id: m.id };
      this.pickGroup.add(me); this.byKey.set('module:' + m.id, me);
    }
  }

  // Sube por la jerarquía hasta encontrar userData.type.
  resolve(obj) {
    let o = obj;
    while (o && !(o.userData && o.userData.type)) o = o.parent;
    return o ? { ...o.userData, object: o } : null;
  }
  objectFor(sel) {
    if (!sel) return null;
    return this.byKey.get(`${sel.kind}:${sel.kind === 'element' || sel.kind === 'module' ? sel.id : sel.key}`) || null;
  }
  worldBox() {
    const b = new THREE.Box3();
    if (!this.root.children.length) return null;
    b.setFromObject(this.root); return b;
  }
}
