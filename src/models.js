import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hexOf, EXTRA, BOLAS } from './palette.js';
import { netTexture, checkerTexture, latticeTexture } from './textures.js';
import { ELEMENTS } from './catalog.js';

// Todos los modelos se construyen en metros, con origen en el centro del suelo del
// módulo. El "frente" del elemento mira a -Z; render.js aplica la rotación r·90°.

const matCache = new Map();
export function mat(hex, opts = {}) {
  const k = hex + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.05, ...opts }));
  return matCache.get(k);
}
export const metalMat = () => mat(EXTRA.metal, { roughness: 0.35, metalness: 0.8 });
const UP = new THREE.Vector3(0, 1, 0);

function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }
export function box(w, h, d, m, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  return shadow(new THREE.Mesh(g, m));
}
export function cyl(r, h, m, seg = 28) { return shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m)); }
export function sphere(r, m, seg = 20) { return shadow(new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), m)); }
// Cilindro entre dos puntos.
export function rod(a, b, r, m) {
  const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
  const me = cyl(r, len, m, 10);
  me.position.copy(a).addScaledVector(dir, 0.5);
  me.quaternion.setFromUnitVectors(UP, dir.normalize());
  return me;
}
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

class Helix extends THREE.Curve {
  constructor(R, drop, turns, cx, cz) { super(); Object.assign(this, { R, drop, turns, cx, cz }); }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.cx - this.R * Math.cos(a), -this.drop * t, this.cz + this.R * Math.sin(a));
  }
}

// Tobogán abierto: canal en U construido por tramos a lo largo de una curva.
function chute(curve, w, m, segs = 28) {
  const g = new THREE.Group();
  const pts = curve.getPoints(segs);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length() * 1.15;
    const seg = new THREE.Group();
    seg.position.copy(a).lerp(b, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize());
    seg.add(at(box(w, 0.04, len, m), 0, 0, 0));
    seg.add(at(box(0.05, 0.18, len, m), -w / 2 + 0.025, 0.09, 0));
    seg.add(at(box(0.05, 0.18, len, m), w / 2 - 0.025, 0.09, 0));
    g.add(seg);
  }
  return g;
}

const builders = {
  piscina(ctx) {
    const { V, D, c, g } = ctx; const t = 0.2, h = 0.4; const m = mat(c.borde);
    g.add(at(box(V, h, t, m, 0.03), 0, h / 2, -D / 2 + t / 2));
    g.add(at(box(V, h, t, m, 0.03), 0, h / 2, D / 2 - t / 2));
    g.add(at(box(t, h, D - 2 * t, m, 0.03), -V / 2 + t / 2, h / 2, 0));
    g.add(at(box(t, h, D - 2 * t, m, 0.03), V / 2 - t / 2, h / 2, 0));
    const inner = V - 2 * t, innerD = D - 2 * t, n = Math.floor(inner / 0.085), nz = Math.floor(innerD / 0.085), layers = 3;
    const count = n * nz * layers;
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0425, 10, 8), mat('#ffffff', { roughness: 0.3 }), count);
    im.castShadow = true;
    const pal = BOLAS.find(b => b.id === ctx.el.colors.bolas) || BOLAS[0];
    const mix = pal.mix ? pal.mix.map(id => hexOf(id)) : [pal.hex];
    const d = new THREE.Object3D(); const col = new THREE.Color(); let k = 0;
    for (let l = 0; l < layers; l++) for (let i = 0; i < n; i++) for (let j = 0; j < nz; j++) {
      d.position.set(-inner / 2 + 0.0425 + i * 0.085 + (l % 2) * 0.03 + (Math.random() - 0.5) * 0.02, 0.045 + l * 0.075, -innerD / 2 + 0.0425 + j * 0.085 + (l % 2) * 0.03 + (Math.random() - 0.5) * 0.02);
      d.updateMatrix(); im.setMatrixAt(k, d.matrix);
      im.setColorAt(k, col.set(mix[Math.floor(Math.random() * mix.length)])); k++;
    }
    g.add(im);
  },
  canasta(ctx) {
    const { V, D, c, g } = ctx;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mat(c.color, { map: netTexture(6, 5), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    net.rotation.x = -Math.PI / 2; at(net, -V / 2 + 0.42, 0.9, -D / 2 + 0.42); g.add(net);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 10, 30), mat(hexOf('rojo')));
    ring.rotation.x = Math.PI / 2; at(ring, -V / 2 + 0.42, 0.9, -D / 2 + 0.42); g.add(ring);
  },
  escalera(ctx) {
    const { V, D, c, g, def } = ctx; const n = def.steps, d = 0.3, h = 0.15, w = V * 0.8; const m = mat(c.color);
    for (let i = 0; i < n; i++) g.add(at(box(w, (i + 1) * h, d, m, 0.02), 0, (i + 1) * h / 2, -D / 2 + (i + 0.5) * d));
  },
  rampa(ctx, steps, w, depth, stepH) {
    const { D, c, g, el } = ctx; const ma = mat(c.a), mb = mat(c.b);
    const top = steps * stepH;
    const zTop = el.y > 0 ? -D / 2 - depth / 2 : D / 2 - depth / 2;
    const lift = el.y > 0 ? 0 : top;
    for (let i = 0; i < steps; i++) {
      g.add(at(box(w, stepH, depth, i % 2 ? mb : ma, 0.04), 0, lift - i * stepH - stepH / 2, zTop - i * depth));
    }
    // base de madera inclinada bajo los escalones (baja hacia -Z)
    const L = steps * depth, base = box(w, 0.02, Math.hypot(L, top), mat(EXTRA.madera));
    base.rotation.x = -Math.atan2(top, L);
    g.add(at(base, 0, lift - top / 2 - stepH - 0.01, zTop - L / 2 + depth / 2));
    // si la planta es más alta que la rampa, zócalo de espuma hasta el suelo
    const extra = ctx.drop - top;
    if (el.y > 0 && extra > 0.02) {
      g.add(at(box(w, extra, L, ma, 0.02), 0, -top - stepH - extra / 2, zTop - L / 2 + depth / 2));
    }
  },
  rampa_grande(ctx) { builders.rampa(ctx, 10, 1.0, 0.21, 0.10); },
  rampa_mediana(ctx) { builders.rampa(ctx, 6, 0.55, 0.21, 0.10); },
  tobogan_recto(ctx) {
    const { V, c, g, drop, zTop, lift } = ctx; const m = mat(c.color);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, zTop), new THREE.Vector3(0, -drop * 0.08, zTop - 0.35),
      new THREE.Vector3(0, -drop, zTop - 0.35 - drop * 1.5), new THREE.Vector3(0, -drop, zTop - 0.35 - drop * 1.5 - 0.5)]);
    const ch = chute(curve, 0.55, m); ch.position.y = lift; g.add(ch);
  },
  tobogan_curvo(ctx) {
    const { V, c, g, drop, zTop, lift } = ctx; const m = mat(c.color);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, zTop), new THREE.Vector3(0, -drop * 0.12, zTop - 0.4),
      new THREE.Vector3(0.5, -drop * 0.6, zTop - 0.4 - drop * 0.8), new THREE.Vector3(1.0, -drop, zTop - 0.4 - drop * 1.2),
      new THREE.Vector3(1.0, -drop, zTop - 0.4 - drop * 1.2 - 0.5)]);
    const ch = chute(curve, 0.55, m, 36); ch.position.y = lift; g.add(ch);
  },
  tobogan_espiral(ctx) {
    const { c, g, drop, zTop, lift } = ctx; const R = 0.6;
    const turns = Math.max(1, drop / 1.3);
    const curve = new Helix(R, drop, turns, R, zTop);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.36, 14, false), mat(c.color, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    tube.castShadow = true; tube.position.y = lift; g.add(tube);
    // poste central
    const post = cyl(0.03, drop, metalMat()); at(post, R, lift - drop / 2, zTop); g.add(post);
  },
  saco(ctx, r, len) {
    const { H, c, g } = ctx; const y0 = H - 0.3;
    g.add(at(box(0.05, 0.3, 0.01, mat(EXTRA.cadena)), 0, y0 + 0.15, 0));
    const a = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, false, 0, Math.PI), mat(c.a)));
    const b = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, false, Math.PI, Math.PI), mat(c.b)));
    at(a, 0, y0 - len / 2, 0); at(b, 0, y0 - len / 2, 0); g.add(a, b);
    g.add(at(cyl(r + 0.004, 0.05, mat(EXTRA.cadena)), 0, y0 - 0.06, 0));
    g.add(at(cyl(r, 0.01, mat(c.a)), 0, y0, 0)); g.add(at(cyl(r, 0.01, mat(c.a)), 0, y0 - len, 0));
  },
  saco_grande(ctx) { builders.saco(ctx, 0.15, 1.0); },
  saco_pequeno(ctx) { builders.saco(ctx, 0.075, 0.7); },
  boya(ctx) {
    const { H, c, g } = ctx; const yb = H * 0.5;
    g.add(rod(new THREE.Vector3(0, H, 0), new THREE.Vector3(0, yb + 0.2, 0), 0.012, mat(EXTRA.canamo)));
    g.add(at(sphere(0.2, mat(c.color)), 0, yb, 0));
    g.add(at(sphere(0.09, mat('#1a1a1a')), 0, yb + 0.17, 0));
  },
  cuerdas(ctx) {
    const { V, H, g } = ctx; const m = mat(EXTRA.canamo);
    for (const x of [-V / 4, 0, V / 4]) {
      g.add(rod(new THREE.Vector3(x, H, 0), new THREE.Vector3(x, 0.3, 0), 0.015, m));
      for (let y = 0.5; y < H - 0.2; y += 0.35) g.add(at(sphere(0.035, m, 10), x, y, 0));
    }
  },
  piramide(ctx) {
    const { c, g } = ctx;
    const cone = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.424, 0.6, 4), mat(c.color)));
    cone.rotation.y = Math.PI / 4; at(cone, 0, 0.3, 0); g.add(cone);
  },
  cubo(ctx) { ctx.g.add(at(box(0.5, 0.5, 0.5, mat(ctx.c.color), 0.03), 0, 0.25, 0)); },
  cilindro(ctx) {
    const me = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 32), [mat(ctx.c.a), mat(ctx.c.b), mat(ctx.c.b)]));
    ctx.g.add(at(me, 0, 0.25, 0));
  },
  rodillo(ctx) {
    const { V, c, g } = ctx;
    const t = cyl(0.024, V, metalMat()); t.rotation.z = Math.PI / 2; at(t, 0, 0.5, 0); g.add(t);
    const f = cyl(0.25, V - 0.2, mat(c.color)); f.rotation.z = Math.PI / 2; at(f, 0, 0.5, 0); g.add(f);
  },
  puente_tibetano(ctx) {
    const { V, D, c, g } = ctx; const n = Math.max(4, Math.round(D / 0.125)), w = V * 0.6, d = D / n; const chain = mat(EXTRA.cadena);
    for (let i = 0; i < n; i++) {
      const y = 0.04 - 0.12 * Math.sin(Math.PI * (i + 0.5) / n), z = -D / 2 + (i + 0.5) * d;
      g.add(at(box(w, 0.05, d * 0.95, mat(i % 2 ? c.b : c.a), 0.01), 0, y, z));
      for (const x of [-w / 2, w / 2]) g.add(rod(new THREE.Vector3(x, 0.9, z), new THREE.Vector3(x, y, z), 0.006, chain));
    }
    for (const x of [-w / 2, w / 2]) g.add(rod(new THREE.Vector3(x, 0.9, -D / 2), new THREE.Vector3(x, 0.9, D / 2), 0.012, chain));
  },
  puente_fijo(ctx) {
    const { V, D, H, c, g } = ctx; const w = V * 0.6, top = H * 0.6; const rope = mat(EXTRA.canamo);
    g.add(at(box(w, 0.06, D, mat(c.color), 0.01), 0, 0.03, 0));
    for (const sx of [-1, 1]) {
      g.add(rod(new THREE.Vector3(sx * V * 0.45, top, -D / 2), new THREE.Vector3(sx * V * 0.45, top, D / 2), 0.012, rope));
      for (let z = -D / 2 + 0.1; z <= D / 2 - 0.05; z += 0.22) g.add(rod(new THREE.Vector3(sx * V * 0.45, top, z), new THREE.Vector3(sx * w / 2, 0.06, z), 0.007, rope));
    }
  },
  tunel(ctx, material) {
    const { D, g } = ctx;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, D, 24, 1, true), material);
    t.rotation.x = Math.PI / 2; at(t, 0, 0.4, 0); t.castShadow = true; g.add(t);
    for (const z of [-D / 2, D / 2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 8, 32), metalMat()); at(r, 0, 0.4, z); g.add(r); }
  },
  tunel_cintas(ctx) {
    const tex = latticeTexture(ctx.c.a, ctx.c.b); tex.repeat.set(6, Math.round(ctx.D / 0.2));
    builders.tunel(ctx, mat('#ffffff', { map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  },
  tunel_red(ctx) {
    const tex = netTexture(8, 3).clone(); tex.needsUpdate = true; tex.repeat.set(4, Math.round(ctx.D / 0.4));
    builders.tunel(ctx, mat(ctx.c.color, { map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  },
  prot_cama(ctx) {
    const { V, D, c, g } = ctx; const w = 0.3, h = 0.08; const m = mat(c.color);
    g.add(at(box(V, h, w, m, 0.02), 0, h / 2, -D / 2 + w / 2)); g.add(at(box(V, h, w, m, 0.02), 0, h / 2, D / 2 - w / 2));
    g.add(at(box(w, h, D - 2 * w, m, 0.02), -V / 2 + w / 2, h / 2, 0)); g.add(at(box(w, h, D - 2 * w, m, 0.02), V / 2 - w / 2, h / 2, 0));
    g.add(at(box(V - 2 * w, 0.02, D - 2 * w, mat(EXTRA.lona)), 0, 0.03, 0));
  },
  cortina(ctx) {
    const { V, D, H, c, g } = ctx; const hh = H * 0.8, z = -D / 2 + 0.03;
    g.add(at(box(V, 0.08, 0.03, mat(c.a)), 0, hh, z));
    const n = Math.floor(V / 0.1);
    for (let i = 0; i < n; i++) g.add(at(box(0.095, hh - 0.1, 0.01, mat(i % 2 ? c.b : c.a)), -V / 2 + 0.05 + i * 0.1, (hh - 0.1) / 2, z));
  },
  panel_acceso(ctx) {
    const { V, D, c, g } = ctx;
    const sh = new THREE.Shape(); sh.moveTo(-V / 2, 0); sh.lineTo(V / 2, 0); sh.lineTo(V / 2, V); sh.lineTo(-V / 2, V); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, V / 2, V * 0.3, 0, Math.PI * 2, true); sh.holes.push(hole);
    const me = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }), mat(c.color)));
    at(me, 0, 0, -D / 2 - 0.03); g.add(me);
  },
  cremallera(ctx) {
    const { D, H, c, g } = ctx; const hh = H * 0.8;
    g.add(at(box(0.08, hh, 0.02, mat('#2a2a2a')), 0, hh / 2, -D / 2 - 0.01));
    g.add(at(box(0.035, hh, 0.03, mat(c.color)), 0, hh / 2, -D / 2 - 0.01));
  },
  zapatero(ctx) {
    const { D, c, g } = ctx; const z = -D / 2 - 0.03;
    g.add(at(box(1.2, 1.2, 0.03, mat(c.a)), 0, 0.7, z));
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) g.add(at(box(0.2, 0.18, 0.05, mat(c.b)), -0.48 + i * 0.24, 0.3 + r * 0.36, z - 0.03));
  },
  red_trepa(ctx) {
    const { V, D, H, g } = ctx;
    const tex = netTexture(4, 6).clone(); tex.needsUpdate = true; tex.repeat.set(V / 0.8, H / 0.8);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(V, H), mat(EXTRA.canamo, { map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    at(me, 0, H / 2, -D / 2 + 0.03); g.add(me);
  },
  tatami(ctx) {
    const { V, D, c, g } = ctx;
    const tex = checkerTexture(c.a, c.b).clone(); tex.needsUpdate = true; tex.repeat.set(V / 1.0, D / 1.0);
    const me = shadow(new THREE.Mesh(new THREE.BoxGeometry(V, 0.02, D), mat('#ffffff', { map: tex })));
    at(me, 0, 0.01, 0); g.add(me);
  },
};
builders.escalera1 = builders.escalera; builders.escalera2 = builders.escalera; builders.escalera3 = builders.escalera;

// settings: ajustes "locales" del módulo donde está la pieza (vano = ancho, fondo, altura en cm).
// extra.drop: altura (m) desde la planta de la pieza hasta el suelo.
export function buildElement(el, settings, extra = {}) {
  const def = ELEMENTS[el.type];
  const V = settings.vano / 100, D = (settings.fondo || settings.vano) / 100, H = settings.altura / 100;
  const c = {}; for (const s of def.slots) c[s.key] = hexOf(el.colors[s.key] ?? s.default);
  const g = new THREE.Group();
  const drop = el.y > 0 ? (extra.drop || el.y * H) : 1.0;
  const ctx = { V, D, H, el, def, c, g, drop, zTop: el.y > 0 ? -D / 2 : D / 2 - 0.25, lift: el.y > 0 ? 0 : 1.0 };
  const b = builders[el.type];
  if (b) b(ctx); else g.add(at(box(0.4, 0.4, 0.4, mat('#ff00ff')), 0, 0.2, 0));
  return g;
}
