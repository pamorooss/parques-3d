import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { hexOf, EXTRA, BOLAS } from './palette.js';
import { netTexture, checkerTexture, latticeTexture, patternTexture } from './textures.js';
import { ELEMENTS, elementDims, activeColors, elementStyle } from './catalog.js';

// Todos los modelos se construyen en metros, con origen en el centro del suelo del
// módulo. El "frente" del elemento mira a -Z; render.js aplica la rotación r·90°.
// S = medidas efectivas de la pieza en metros { l (X), a (Z), h (Y) }.

const matCache = new Map();
export function mat(hex, opts = {}) {
  const k = hex + JSON.stringify({ ...opts, map: opts.map ? `${opts.map.name}|${opts.map.repeat.x}|${opts.map.repeat.y}` : undefined });
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.05, ...opts }));
  return matCache.get(k);
}
export const metalMat = () => mat(EXTRA.metal, { roughness: 0.35, metalness: 0.8 });
const UP = new THREE.Vector3(0, 1, 0);

function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }
export function box(w, h, d, m, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
  return shadow(new THREE.Mesh(g, m));
}
export function cyl(r, h, m, seg = 28) { return shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m)); }
export function sphere(r, m, seg = 20) { return shadow(new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), m)); }
// Cilindro entre dos puntos.
export function rod(a, b, r, m, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
  const me = cyl(r, len, m, seg);
  me.position.copy(a).addScaledVector(dir, 0.5);
  me.quaternion.setFromUnitVectors(UP, dir.normalize());
  return me;
}
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }
// Media luna extruida (semicilindro tumbado a lo largo de Z): radio r, largo len, base plana en y=0.
function halfCyl(r, len, m) {
  const sh = new THREE.Shape(); sh.absarc(0, 0, r, 0, Math.PI, false); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0, -len / 2);
  return shadow(new THREE.Mesh(geo, m));
}

class Helix extends THREE.Curve {
  constructor(R, drop, turns, cx, cz) { super(); Object.assign(this, { R, drop, turns, cx, cz }); }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.cx - this.R * Math.cos(a), -this.drop * t, this.cz + this.R * Math.sin(a));
  }
}

// Tobogán abierto: canal en U construido por tramos a lo largo de una curva.
function chute(curve, w, mFloor, mSide, segs = 28) {
  const g = new THREE.Group();
  const pts = curve.getPoints(segs);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length() * 1.15;
    const seg = new THREE.Group();
    seg.position.copy(a).lerp(b, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize());
    seg.add(at(box(w, 0.04, len, mFloor), 0, 0, 0));
    seg.add(at(box(0.05, 0.18, len, mSide), -w / 2 + 0.025, 0.09, 0));
    seg.add(at(box(0.05, 0.18, len, mSide), w / 2 - 0.025, 0.09, 0));
    g.add(seg);
  }
  return g;
}

// Bolas instanciadas rellenando un rectángulo l×a con `layers` capas.
function balls(ctx, l, a, layers, y0 = 0.045) {
  const n = Math.max(1, Math.floor(l / 0.085)), nz = Math.max(1, Math.floor(a / 0.085));
  const count = n * nz * layers;
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0425, 10, 8), mat('#ffffff', { roughness: 0.3 }), count);
  im.castShadow = true;
  const pal = BOLAS.find(b => b.id === ctx.el.colors.bolas) || BOLAS[0];
  const mix = pal.mix ? pal.mix.map(id => hexOf(id)) : [pal.hex];
  const d = new THREE.Object3D(); const col = new THREE.Color(); let k = 0;
  for (let ly = 0; ly < layers; ly++) for (let i = 0; i < n; i++) for (let j = 0; j < nz; j++) {
    d.position.set(-l / 2 + 0.0425 + i * 0.085 + (ly % 2) * 0.03 + (Math.random() - 0.5) * 0.02, y0 + ly * 0.075, -a / 2 + 0.0425 + j * 0.085 + (ly % 2) * 0.03 + (Math.random() - 0.5) * 0.02);
    d.updateMatrix(); im.setMatrixAt(k, d.matrix);
    im.setColorAt(k, col.set(mix[Math.floor(Math.random() * mix.length)])); k++;
  }
  return im;
}

const builders = {
  piscina(ctx) {
    const { S, c, g } = ctx; const t = 0.2, h = S.h; const m = mat(c.borde);
    const V = S.l, D = S.a;
    g.add(at(box(V, h, t, m, 0.03), 0, h / 2, -D / 2 + t / 2));
    g.add(at(box(V, h, t, m, 0.03), 0, h / 2, D / 2 - t / 2));
    g.add(at(box(t, h, D - 2 * t, m, 0.03), -V / 2 + t / 2, h / 2, 0));
    g.add(at(box(t, h, D - 2 * t, m, 0.03), V / 2 - t / 2, h / 2, 0));
    g.add(balls(ctx, V - 2 * t, D - 2 * t, Math.max(1, Math.min(6, Math.round(h / 0.13)))));
  },
  bolas(ctx) { const { S, g } = ctx; g.add(balls(ctx, S.l, S.a, Math.max(1, Math.round(S.h / 0.075)))); },
  canasta(ctx) {
    const { S, c, g } = ctx; const w = S.l;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(w, w), mat(c.color, { map: netTexture(6, 5), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    net.rotation.x = -Math.PI / 2; at(net, 0, 0.9, 0); g.add(net);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.2, 0.02, 10, 30), mat(hexOf('rojo')));
    ring.rotation.x = Math.PI / 2; at(ring, 0, 0.9, 0); g.add(ring);
  },
  escalera(ctx) {
    const { S, g, def, col } = ctx; const n = def.steps, d = S.a / n, h = S.h / n, w = S.l;
    for (let i = 0; i < n; i++) g.add(at(box(w, (i + 1) * h, d, col(i), 0.02), 0, (i + 1) * h / 2, -S.a / 2 + (i + 0.5) * d));
  },
  // Rampa de escalones (sin base): desde la planta baja hacia fuera del módulo.
  rampa(ctx) {
    const { S, D, g, el, def, col } = ctx; const steps = def.steps;
    const w = S.a, depth = S.l / steps, stepH = S.h / steps, top = S.h;
    const zTop = el.y > 0 ? -D / 2 - depth / 2 : D / 2 - depth / 2;
    const lift = el.y > 0 ? 0 : top;
    for (let i = 0; i < steps; i++) g.add(at(box(w, stepH, depth, col(i), 0.03), 0, lift - i * stepH - stepH / 2, zTop - i * depth));
  },
  rampa_grande(ctx) { builders.rampa(ctx); },
  rampa_mediana(ctx) { builders.rampa(ctx); },
  tobogan_recto(ctx) {
    const { S, g, zTop, lift, col } = ctx; const drop = S.h, run = Math.max(0.3, S.l - 0.85);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, zTop), new THREE.Vector3(0, -drop * 0.08, zTop - 0.35),
      new THREE.Vector3(0, -drop, zTop - 0.35 - run), new THREE.Vector3(0, -drop, zTop - 0.35 - run - 0.5)]);
    const ch = chute(curve, S.a, col(0), col(1)); ch.position.y = lift; g.add(ch);
  },
  tobogan_curvo(ctx) {
    const { S, g, zTop, lift, col } = ctx; const drop = S.h, w = Math.min(S.a, 0.6), xo = Math.max(0.2, S.a - w), run = Math.max(0.3, S.l - 0.9);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, zTop), new THREE.Vector3(0, -drop * 0.12, zTop - 0.4),
      new THREE.Vector3(xo * 0.5, -drop * 0.6, zTop - 0.4 - run * 0.65), new THREE.Vector3(xo, -drop, zTop - 0.4 - run),
      new THREE.Vector3(xo, -drop, zTop - 0.4 - run - 0.5)]);
    const ch = chute(curve, w, col(0), col(1), 36); ch.position.y = lift; g.add(ch);
  },
  tobogan_espiral(ctx) {
    const { S, g, zTop, lift, col } = ctx; const drop = S.h, R = Math.max(0.3, S.l / 2 - 0.36);
    const turns = Math.max(1, drop / 1.3);
    const curve = new Helix(R, drop, turns, R, zTop);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.36, 14, false), mat(ctx.cols[0], { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    tube.castShadow = true; tube.position.y = lift; g.add(tube);
    const post = cyl(0.03, drop, metalMat()); at(post, R, lift - drop / 2, zTop); g.add(post);
  },
  // Saco colgante: cilindro vertical colgado del techo del módulo. r, len en metros.
  sack(ctx, x, z, r, len, i = 0, yTop) {
    const { H, g } = ctx; const y0 = yTop ?? H - 0.3;
    g.add(at(box(0.05, y0 - (H - 0.3) + 0.3, 0.01, mat(EXTRA.cadena)), x, y0 + 0.15, z));
    const m = ctx.pm({ n: 8, rep: [1, len / (2 * Math.PI * r)], ring: Math.round(len / 0.12) }, i);
    const body = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, true), m));
    at(body, x, y0 - len / 2, z); g.add(body);
    g.add(at(cyl(r + 0.004, 0.05, mat(EXTRA.cadena)), x, y0 - 0.06, z));
    const cap = ctx.cols.length > 1 && ctx.style !== 'liso' ? ctx.col(0) : ctx.col(i);
    g.add(at(cyl(r, 0.01, cap, 24), x, y0, z));
    const bottom = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), cap)); at(bottom, x, y0 - len, z); g.add(bottom);
  },
  saco_grande(ctx) { builders.sack(ctx, 0, 0, ctx.S.l / 2, ctx.S.h); },
  saco_pequeno(ctx) { builders.sack(ctx, 0, 0, ctx.S.l / 2, ctx.S.h); },
  sacos_fila(ctx) {
    const { S } = ctx; const n = Math.max(2, Math.floor(S.l / 0.25)), step = S.l / n, r = Math.min(S.a / 2, step / 2 - 0.02);
    for (let i = 0; i < n; i++) builders.sack(ctx, -S.l / 2 + step * (i + 0.5), 0, r, S.h, i);
  },
  // Sacos inclinados 45° cruzando el módulo de lado a lado (de arriba de un lado a abajo del otro).
  sacos_diagonal(ctx) {
    const { S, g, H } = ctx; const n = Math.max(1, Math.floor(S.l / 0.4)), step = S.l / n, r = 0.11;
    const yTop = Math.min(S.h, H) - 0.12, span = S.a - 0.2;
    for (let i = 0; i < n; i++) {
      const x = -S.l / 2 + step * (i + 0.5);
      const a = new THREE.Vector3(x, yTop, -span / 2), b = new THREE.Vector3(x, 0.14, span / 2);
      const len = a.distanceTo(b);
      const m = ctx.pm({ n: 8, rep: [1, len / (2 * Math.PI * r)], ring: Math.round(len / 0.12) }, i);
      g.add(rod(a, b, r, m, 20));
      g.add(at(sphere(r, ctx.style === 'liso' ? ctx.col(i) : ctx.col(0), 14), a.x, a.y, a.z)); g.add(at(sphere(r, ctx.style === 'liso' ? ctx.col(i) : ctx.col(0), 14), b.x, b.y, b.z));
      g.add(rod(a, new THREE.Vector3(x, yTop + 0.1, -S.a / 2), 0.012, mat(EXTRA.cadena))); g.add(rod(b, new THREE.Vector3(x, 0.08, S.a / 2), 0.012, mat(EXTRA.cadena)));
    }
  },
  boya(ctx) {
    const { S, H, g, col } = ctx; const r = S.l / 2, yb = Math.max(r + 0.1, H * 0.5);
    g.add(rod(new THREE.Vector3(0, H, 0), new THREE.Vector3(0, yb + r, 0), 0.012, mat(EXTRA.canamo)));
    g.add(at(sphere(r, col(0)), 0, yb, 0));
    g.add(at(sphere(r * 0.45, mat('#1a1a1a')), 0, yb + r * 0.85, 0));
  },
  cuerdas(ctx) {
    const { S, H, g } = ctx; const m = mat(EXTRA.canamo), top = Math.min(S.h, H);
    for (const x of [-S.l / 4, 0, S.l / 4]) {
      g.add(rod(new THREE.Vector3(x, top, 0), new THREE.Vector3(x, 0.3, 0), 0.015, m));
      for (let y = 0.5; y < top - 0.2; y += 0.35) g.add(at(sphere(0.035, m, 10), x, y, 0));
    }
  },
  piramide(ctx) {
    const { S, g } = ctx;
    const cone = shadow(new THREE.Mesh(new THREE.ConeGeometry(S.l / Math.SQRT2, S.h, 4), ctx.pm({ n: 4, rep: [1, 1] })));
    cone.rotation.y = Math.PI / 4; at(cone, 0, S.h / 2, 0); g.add(cone);
  },
  cubo(ctx) { const { S, g } = ctx; g.add(at(box(S.l, S.h, S.a, ctx.pm({ n: 6, rep: [1, 1] }), 0.03), 0, S.h / 2, 0)); },
  cilindro(ctx) {
    const { S, g } = ctx; const r = S.l / 2;
    const me = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, S.h, 32), [ctx.pm({ n: 8, rep: [1, S.h / (2 * Math.PI * r)], ring: Math.round(S.h / 0.1) }), ctx.col(1), ctx.col(1)]));
    g.add(at(me, 0, S.h / 2, 0));
  },
  hexagono(ctx) {
    const { S, g } = ctx; const r = S.l / 2;
    const me = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, S.h, 6), [ctx.pm({ n: 6, rep: [1, S.h / (2 * Math.PI * r)], ring: Math.round(S.h / 0.1) }), ctx.col(1), ctx.col(1)]));
    me.rotation.y = Math.PI / 6; g.add(at(me, 0, S.h / 2, 0));
  },
  semicilindros(ctx) {
    const { S, g, c, col } = ctx; const lane = S.l / 3, len = S.a * 0.92;
    g.add(at(box(S.l, 0.04, S.a, mat(c.base), 0.01), 0, 0.02, 0));
    const f = [0.6, 1, 0.78];
    for (let i = 0; i < 3; i++) {
      const r = Math.min(lane / 2 - 0.01, S.h * f[i]);
      g.add(at(halfCyl(r, len, col(i)), -S.l / 2 + lane * (i + 0.5), 0.04, 0));
    }
  },
  rodillo(ctx) {
    const { S, g } = ctx; const r = S.a / 2;
    const t = cyl(0.024, S.l + 0.2, metalMat()); t.rotation.z = Math.PI / 2; at(t, 0, r, 0); g.add(t);
    const f = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, S.l, 28), [ctx.pm({ n: 8, rep: [1, S.l / (2 * Math.PI * r)], ring: Math.round(S.l / 0.12) }), ctx.col(1), ctx.col(1)]));
    f.rotation.z = Math.PI / 2; at(f, 0, r, 0); g.add(f);
  },
  // Pasarela a lo largo de X (largo S.l, ancho S.a).
  puente_tibetano(ctx) {
    const { S, H, g, col } = ctx; const n = Math.max(4, Math.round(S.l / 0.125)), w = S.a, d = S.l / n; const chain = mat(EXTRA.cadena); const top = Math.min(0.9, H - 0.2);
    for (let i = 0; i < n; i++) {
      const y = 0.04 - 0.12 * Math.sin(Math.PI * (i + 0.5) / n), x = -S.l / 2 + (i + 0.5) * d;
      g.add(at(box(d * 0.95, 0.05, w, col(i), 0.01), x, y, 0));
      for (const z of [-w / 2, w / 2]) g.add(rod(new THREE.Vector3(x, top, z), new THREE.Vector3(x, y, z), 0.006, chain));
    }
    for (const z of [-w / 2, w / 2]) g.add(rod(new THREE.Vector3(-S.l / 2, top, z), new THREE.Vector3(S.l / 2, top, z), 0.012, chain));
  },
  puente_fijo(ctx) {
    const { S, H, g, col } = ctx; const w = S.a, top = Math.min(S.h, H - 0.1); const rope = mat(EXTRA.canamo);
    g.add(at(box(S.l, 0.06, w, col(0), 0.01), 0, 0.03, 0));
    for (const sz of [-1, 1]) {
      g.add(rod(new THREE.Vector3(-S.l / 2, top, sz * w * 0.75), new THREE.Vector3(S.l / 2, top, sz * w * 0.75), 0.012, rope));
      for (let x = -S.l / 2 + 0.1; x <= S.l / 2 - 0.05; x += 0.22) g.add(rod(new THREE.Vector3(x, top, sz * w * 0.75), new THREE.Vector3(x, 0.06, sz * w / 2), 0.007, rope));
    }
  },
  // Túnel a lo largo de X (largo S.l, diámetro S.a).
  tunel(ctx, material) {
    const { S, g } = ctx; const r = S.a / 2, y = r + 0.05;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, S.l, 24, 1, true), material);
    t.rotation.z = Math.PI / 2; at(t, 0, y, 0); t.castShadow = true; g.add(t);
    for (const x of [-S.l / 2, S.l / 2]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 8, 32), metalMat()); ring.rotation.y = Math.PI / 2; at(ring, x, y, 0); g.add(ring); }
  },
  tunel_cintas(ctx) {
    const tex = latticeTexture(ctx.cols[0], ctx.cols[1] || ctx.cols[0], [6, Math.max(2, Math.round(ctx.S.l / 0.2))]);
    builders.tunel(ctx, mat('#ffffff', { map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  },
  tunel_red(ctx) {
    const tex = netTexture(8, 3).clone(); tex.needsUpdate = true; tex.repeat.set(4, Math.max(1, Math.round(ctx.S.l / 0.4)));
    builders.tunel(ctx, mat(ctx.c.color, { map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  },
  // Red de cintas tejida, horizontal, a ras de la base del módulo. hole: hueco central (m).
  cintas(ctx, hole = 0) {
    const { S, g, cols } = ctx; const l = S.l, a = S.a;
    const sh = new THREE.Shape(); sh.moveTo(-l / 2, -a / 2); sh.lineTo(l / 2, -a / 2); sh.lineTo(l / 2, a / 2); sh.lineTo(-l / 2, a / 2); sh.closePath();
    if (hole > 0) { const hp = new THREE.Path(); const r = hole / 2; hp.moveTo(-r, -r); hp.lineTo(r, -r); hp.lineTo(r, r); hp.lineTo(-r, r); hp.closePath(); sh.holes.push(hp); }
    const geo = new THREE.ShapeGeometry(sh, 4); // UV = coordenadas (m): 1 repetición de textura = 0,2 m
    const tex = latticeTexture(cols[0], cols[1] || cols[0], [5, 5]);
    const me = new THREE.Mesh(geo, mat('#ffffff', { map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    me.rotation.x = -Math.PI / 2; at(me, 0, Math.max(0.03, S.h / 2), 0); me.castShadow = true; g.add(me);
    if (hole > 0) { // ribete del hueco
      const r = hole / 2, rib = mat(cols[0]); const y = Math.max(0.03, S.h / 2);
      for (const [p, q] of [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]]) g.add(rod(new THREE.Vector3(p[0], y, p[1]), new THREE.Vector3(q[0], y, q[1]), 0.02, rib, 8));
    }
  },
  red_cintas(ctx) { builders.cintas(ctx, 0); },
  red_cintas_hueco(ctx) { builders.cintas(ctx, Math.min(ctx.S.l, ctx.S.a) * 0.4); },
  // Tela de araña: anillo central, radiales y anillos concéntricos de cuerda.
  red_arana(ctx) {
    const { S, g, c } = ctx; const l = S.l, a = S.a, y = Math.max(0.04, S.h / 2); const rope = mat(c.cuerda); const R0 = Math.min(l, a) * 0.13;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.022, 10, 36), mat(c.aro)); ring.rotation.x = Math.PI / 2; at(ring, 0, y, 0); g.add(ring);
    const N = 12; const edge = k => { // punto en el borde del rectángulo en la dirección k
      const ang = (k / N) * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
      const t = Math.min(l / 2 / Math.max(Math.abs(dx), 1e-6), a / 2 / Math.max(Math.abs(dz), 1e-6));
      return new THREE.Vector3(dx * t, y, dz * t);
    };
    const pts = [];
    for (let k = 0; k < N; k++) { const e = edge(k); const ang = (k / N) * Math.PI * 2; const s = new THREE.Vector3(Math.cos(ang) * R0, y, Math.sin(ang) * R0); g.add(rod(s, e, 0.012, rope, 8)); pts.push({ s, e }); }
    for (const f of [0.3, 0.55, 0.8, 1]) {
      for (let k = 0; k < N; k++) {
        const p = pts[k], q = pts[(k + 1) % N];
        const A = p.s.clone().lerp(p.e, f), B = q.s.clone().lerp(q.e, f);
        g.add(rod(A, B, f === 1 ? 0.016 : 0.011, rope, 8));
      }
    }
  },
  prot_cama(ctx) {
    const { S, g, col } = ctx; const V = S.l, D = S.a; const w = 0.3, h = Math.max(0.05, S.h); const m = col(0);
    g.add(at(box(V, h, w, m, 0.02), 0, h / 2, -D / 2 + w / 2)); g.add(at(box(V, h, w, m, 0.02), 0, h / 2, D / 2 - w / 2));
    g.add(at(box(w, h, D - 2 * w, m, 0.02), -V / 2 + w / 2, h / 2, 0)); g.add(at(box(w, h, D - 2 * w, m, 0.02), V / 2 - w / 2, h / 2, 0));
    g.add(at(box(V - 2 * w, 0.02, D - 2 * w, mat(EXTRA.lona)), 0, 0.03, 0));
  },
  cortina(ctx) {
    const { S, D, g, col } = ctx; const V = S.l, hh = S.h, z = -D / 2 + 0.03;
    g.add(at(box(V, 0.08, 0.03, col(0)), 0, hh, z));
    const n = Math.max(1, Math.floor(V / 0.1));
    for (let i = 0; i < n; i++) g.add(at(box(0.095, hh - 0.1, 0.01, col(i)), -V / 2 + 0.05 + i * 0.1, (hh - 0.1) / 2, z));
  },
  panel_acceso(ctx) {
    const { S, D, g, col } = ctx; const V = S.l, hh = S.h;
    const sh = new THREE.Shape(); sh.moveTo(-V / 2, 0); sh.lineTo(V / 2, 0); sh.lineTo(V / 2, hh); sh.lineTo(-V / 2, hh); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, hh / 2, Math.min(V, hh) * 0.3, 0, Math.PI * 2, true); sh.holes.push(hole);
    const me = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: S.a, bevelEnabled: false }), col(0)));
    at(me, 0, 0, -D / 2 - S.a / 2); g.add(me);
  },
  cremallera(ctx) {
    const { S, D, g, col } = ctx; const hh = S.h;
    g.add(at(box(S.l, hh, 0.02, mat('#2a2a2a')), 0, hh / 2, -D / 2 - 0.01));
    g.add(at(box(S.l * 0.45, hh, 0.03, col(0)), 0, hh / 2, -D / 2 - 0.01));
  },
  zapatero(ctx) {
    const { S, D, g, col } = ctx; const z = -D / 2 - 0.03, W = S.l, Hh = S.h;
    g.add(at(box(W, Hh, 0.03, col(0)), 0, Hh / 2, z));
    const cols = Math.max(1, Math.floor(W / 0.24)), rows = Math.max(1, Math.floor(Hh / 0.36));
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) g.add(at(box(0.2, 0.18, 0.05, col(1)), -W / 2 + 0.12 + i * (W / cols) * (cols / Math.max(cols, 1)) + (W / cols - 0.24) / 2, 0.2 + r * (Hh / rows), z - 0.03));
  },
  red_trepa(ctx) {
    const { S, D, g } = ctx; const V = S.l, Hh = S.h;
    const tex = netTexture(4, 6).clone(); tex.needsUpdate = true; tex.repeat.set(V / 0.8, Hh / 0.8);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(V, Hh), mat(EXTRA.canamo, { map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    at(me, 0, Hh / 2, -D / 2 + 0.03); g.add(me);
  },
  pared_cuadrada(ctx) { const { S, g } = ctx; g.add(at(box(S.l, S.h, S.a, ctx.pm({ n: 6, rep: [1, 1] }), 0.01), 0, S.h / 2, 0)); },
  pared_triangular(ctx) {
    const { S, g, col } = ctx;
    const sh = new THREE.Shape(); sh.moveTo(-S.l / 2, 0); sh.lineTo(S.l / 2, 0); sh.lineTo(-S.l / 2, S.h); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: S.a, bevelEnabled: false }); geo.translate(0, 0, -S.a / 2);
    g.add(shadow(new THREE.Mesh(geo, col(0))));
  },
  protector_columna(ctx) {
    const { S, g } = ctx; const t = 0.035; const m = ctx.pm({ n: 4, rep: [1, 1] });
    g.add(at(box(S.l, S.h, t, m, 0.01), 0, S.h / 2, -S.a / 2 + t / 2));
    g.add(at(box(t, S.h, S.a - t, m, 0.01), -S.l / 2 + t / 2, S.h / 2, t / 2));
  },
  tatami(ctx) {
    const { S, g, cols } = ctx; const V = S.l, D = S.a;
    const tex = checkerTexture(cols[0], cols[1] || cols[0]).clone(); tex.needsUpdate = true; tex.repeat.set(V / 1.0, D / 1.0);
    const me = shadow(new THREE.Mesh(new THREE.BoxGeometry(V, 0.02, D), mat('#ffffff', { map: tex })));
    at(me, 0, 0.01, 0); g.add(me);
  },
};
builders.escalera1 = builders.escalera; builders.escalera2 = builders.escalera; builders.escalera3 = builders.escalera;

// settings: ajustes "locales" del módulo donde está la pieza (vano = ancho, fondo, altura, caida en cm).
export function buildElement(el, settings) {
  const def = ELEMENTS[el.type];
  const V = settings.vano / 100, D = (settings.fondo || settings.vano) / 100, H = settings.altura / 100;
  const dims = elementDims(el, settings);
  const S = { l: Math.max(0.02, dims.l / 100), a: Math.max(0.02, dims.a / 100), h: Math.max(0.02, dims.h / 100) };
  const c = {}; for (const s of def.slots) c[s.key] = hexOf(el.colors[s.key] ?? s.default);
  const cols = activeColors(el).map(id => hexOf(id));
  const style = elementStyle(el);
  const g = new THREE.Group();
  const drop = S.h;
  const ctx = {
    V, D, H, S, el, def, c, g, cols, style,
    col: i => mat(cols[i % cols.length]),
    // Material con el estilo elegido (liso = un color, cíclico por índice i para piezas de varias partes).
    pm: ({ n = 8, rep = [1, 1], ring } = {}, i = 0) => {
      if (style === 'liso' || cols.length < 2) return mat(cols[i % cols.length]);
      const bands = style === 'franjas' ? Math.max(cols.length, ring || n) : style === 'mitades' ? cols.length : n;
      return mat('#ffffff', { map: patternTexture(style, cols, bands, style === 'cuadros' ? rep : [1, 1]) });
    },
    drop, zTop: el.y > 0 ? -D / 2 : D / 2 - 0.25, lift: el.y > 0 ? 0 : drop,
  };
  const b = builders[el.type];
  if (b) b(ctx); else g.add(at(box(0.4, 0.4, 0.4, mat('#ff00ff')), 0, 0.2, 0));
  return g;
}
