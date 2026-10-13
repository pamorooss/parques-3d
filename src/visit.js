import * as THREE from 'three';
import { buildAvatar, poseAvatar } from './avatar.js';

// Modo visita: una persona recorre el parque de verdad. Física sencilla con rayos contra
// las mallas del parque: el suelo se busca con un rayo hacia abajo (escalones hasta STEP),
// las paredes con rayos horizontales a dos alturas (se desliza a lo largo de ellas), los
// toboganes son superficies marcadas `slide` por las que se acelera cuesta abajo y las
// bolas son zonas donde se anda más despacio con los brazos en alto.
const G = 14, STEP = 0.45, RADIUS = 0.2, JUMP = 3.6, MAX_SLIDE = 4.5;
const DOWN = new THREE.Vector3(0, -1, 0);
const KEYS = { w: 'fwd', arrowup: 'fwd', s: 'back', arrowdown: 'back', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'jump' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export class Visitor {
  constructor(sc, hooks = {}) {
    this.sc = sc; this.hooks = hooks;
    this.avatar = null; this.preset = null; this.active = false; this.cam = 'first'; // por defecto se ve con sus ojos
    this.keys = {}; this.ray = new THREE.Raycaster(); this.coll = []; this.zones = [];
    this.pos = new THREE.Vector3(); this.renderY = 0; this.vy = 0; this.onGround = true;
    this.yaw = 0; this.camYaw = 0; this.pitch = 0.35; this.elev = 0; this.dist = 3;
    this.mode = 'walk'; this.slideV = new THREE.Vector3(); this.phase = 0; this.t = 0; this.drag = null;
    const c = sc.renderer.domElement;
    c.addEventListener('pointerdown', e => { if (!this.active) return; this.drag = { x: e.clientX, y: e.clientY }; try { c.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ } });
    c.addEventListener('pointermove', e => {
      if (!this.active || !this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag = { x: e.clientX, y: e.clientY };
      this.camYaw -= dx * 0.006;
      if (this.cam === 'third') this.pitch = clamp(this.pitch + dy * 0.005, 0.05, 1.25); else this.elev = clamp(this.elev - dy * 0.005, -1.2, 1.2);
    });
    const end = () => { this.drag = null; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', e => { if (!this.active || this.cam !== 'third') return; e.preventDefault(); this.dist = clamp(this.dist + e.deltaY * 0.004, 1.2, 7); }, { passive: false });
  }

  // Soltar la persona en un punto (pies). Mira alejándose de la cámara.
  place(point, preset, colors) {
    this.remove();
    this.avatar = buildAvatar(preset, colors); this.preset = preset;
    this.pos.copy(point); this.renderY = point.y; this.vy = 0; this.onGround = true; this.mode = 'walk'; this.slideV.set(0, 0, 0);
    const cam = this.sc.camera; this.yaw = Math.atan2(-(point.x - cam.position.x), -(point.z - cam.position.z));
    this.avatar.position.copy(point); this.avatar.rotation.y = this.yaw;
    this.sc.scene.add(this.avatar);
  }
  remove() {
    if (this.active) { this.exit(); return; } // exit() ya la quita
    this.dispose();
  }
  dispose() {
    if (!this.avatar) return;
    this.sc.scene.remove(this.avatar); this.avatar.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.avatar = null;
  }
  // Mallas con las que choca / se pisa, y zonas de bolas { x0, x1, z0, z1, top, base }.
  setWorld(coll, zones) {
    this.coll = coll; this.zones = zones;
    // La cámara solo choca con suelo, plataformas y paredes (las redes y los tubos se ven a través / son finos).
    this.camColl = coll.filter(o => o.userData.type === 'ground' || o.userData.type === 'floor' || o.userData.wall);
  }

  enter() {
    if (!this.avatar || this.active) return;
    this.active = true; this.sc.controls.enabled = false; this.keys = {};
    const cam = this.sc.camera, p = this.pos; const dx = cam.position.x - p.x, dz = cam.position.z - p.z; const hd = Math.hypot(dx, dz) || 1;
    this.camYaw = Math.atan2(dx, dz);
    this.pitch = clamp(Math.atan2(cam.position.y - p.y - this.preset.h * 0.75, hd), 0.15, 1.1);
    this.dist = clamp(hd, 1.6, 5);
    if (this.cam === 'first') this.avatar.visible = false;
    this.hooks.onEnter && this.hooks.onEnter();
  }
  exit() {
    if (!this.active) return;
    this.active = false; this.keys = {}; this.drag = null;
    const c = this.sc.controls, cam = this.sc.camera;
    if (this.avatar) {
      // la cámara se queda mirando donde estaba la persona, un poco atrás y arriba
      c.target.set(this.pos.x, this.pos.y + this.preset.h * 0.6, this.pos.z);
      if (this.cam === 'first') cam.position.set(this.pos.x + Math.sin(this.camYaw) * 3.5, this.pos.y + 2.2, this.pos.z + Math.cos(this.camYaw) * 3.5);
    }
    c.enabled = true; c.update();
    this.dispose(); // al salir, la persona desaparece
    this.hooks.onExit && this.hooks.onExit();
  }
  toggleCamera() {
    this.cam = this.cam === 'third' ? 'first' : 'third'; this.elev = 0;
    if (this.avatar) this.avatar.visible = this.cam === 'third' || !this.active;
    this.hooks.onCamera && this.hooks.onCamera(this.cam);
  }
  keydown(e) {
    if (!this.active) return false;
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.exit(); return true; }
    if (k === 'c') { this.toggleCamera(); return true; }
    if (k === 'shift') { this.keys.run = true; return true; }
    if (KEYS[k]) { if (KEYS[k] === 'jump' && !this.keys.jump) this.jumpAt = this.t; this.keys[KEYS[k]] = true; e.preventDefault(); return true; }
    return false;
  }
  keyup(e) { const k = e.key.toLowerCase(); if (KEYS[k]) this.keys[KEYS[k]] = false; if (k === 'shift') this.keys.run = false; }

  cast(origin, dir, far) {
    this.ray.set(origin, dir); this.ray.near = 0; this.ray.far = far;
    const hits = this.ray.intersectObjects(this.coll, false);
    return hits.length ? hits[0] : null;
  }
  groundBelow(p) { return this.cast(new THREE.Vector3(p.x, p.y + STEP, p.z), DOWN, 80); }
  worldNormal(hit) { const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); return n; }

  // Avanza `move` chocando con paredes: al tocar una, el resto del paso se desliza a lo largo de ella.
  moveWithWalls(move) {
    const p = this.pos; const hs = this.mode === 'slide' ? [0.1, 0.3] : [0.5, 0.66];
    for (let iter = 0; iter < 3; iter++) {
      const len = move.length(); if (len < 1e-6) return;
      const dir = move.clone().normalize(); let best = null;
      for (const h of hs) { const hit = this.cast(new THREE.Vector3(p.x, p.y + h, p.z), dir, RADIUS + len); if (hit && (!best || hit.distance < best.distance)) best = hit; }
      if (!best) { p.add(move); return; }
      const n = this.worldNormal(best); n.y = 0;
      if (n.lengthSq() < 1e-6) return;
      n.normalize(); if (n.dot(dir) > 0) n.negate();
      const allowed = clamp(best.distance - RADIUS, 0, len);
      p.addScaledVector(dir, allowed);
      move = dir.multiplyScalar(len - allowed); move.addScaledVector(n, -move.dot(n));
      if (this.mode === 'slide') this.slideV.addScaledVector(n, -this.slideV.dot(n));
    }
  }

  update(dt) {
    if (!this.avatar) return;
    dt = Math.min(dt, 0.05); this.t += dt;
    const p = this.pos, pr = this.preset, k = this.keys;
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)), right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const d = new THREE.Vector3();
    if (k.fwd) d.add(fwd); if (k.back) d.sub(fwd); if (k.right) d.add(right); if (k.left) d.sub(right);
    const want = d.lengthSq() > 0; if (want) d.normalize();
    const zone = this.zones.find(z => p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1 && p.y < z.top && p.y >= z.base - 0.15);
    const speed = pr.speed * (k.run ? 1.8 : 1) * (zone ? 0.5 : 1);

    // movimiento horizontal (andando o deslizándose)
    const move = this.mode === 'slide' ? this.slideV.clone().multiplyScalar(dt) : want ? d.clone().multiplyScalar(speed * dt) : new THREE.Vector3();
    this.moveWithWalls(move);

    // suelo: seguirlo (escalones, rampas), aterrizar o caer
    const hit = this.groundBelow(p);
    const gy = hit ? hit.point.y : -100;
    if (this.onGround && gy >= p.y - STEP && gy <= p.y + STEP) { p.y = gy; this.vy = 0; }
    else if (!this.onGround && this.vy <= 0 && gy > p.y && gy <= p.y + STEP) { p.y = gy; this.vy = 0; this.onGround = true; }
    else { this.vy -= G * dt; p.y += this.vy * dt; this.onGround = false; if (p.y <= gy) { p.y = gy; this.vy = 0; this.onGround = true; } }
    // salto: la pulsación se guarda 0,25 s para no perderla entre frames
    if (this.jumpAt !== undefined && this.t - this.jumpAt < 0.25 && this.onGround && this.mode !== 'slide') { this.jumpAt = undefined; this.vy = JUMP * (zone ? 0.7 : 1); this.onGround = false; p.y += this.vy * dt; }
    if (p.y < -5) { p.y = 0.5; this.vy = 0; }

    // toboganes
    const onSlide = this.onGround && hit && hit.object.userData.slide;
    if (onSlide) {
      const n = this.worldNormal(hit); if (n.y < 0) n.negate();
      const down = new THREE.Vector3(n.x, 0, n.z); const sl = down.length();
      if (this.mode !== 'slide') { this.mode = 'slide'; const start = sl > 0.03 ? down.clone().normalize() : (want ? d : fwd); this.slideV.copy(start).multiplyScalar(Math.max(0.8, speed * 0.6)); }
      if (sl > 0.03) this.slideV.addScaledVector(down.normalize(), 9.8 * sl * 0.95 * dt);
      this.slideV.multiplyScalar(Math.max(0, 1 - 0.35 * dt));
      if (this.slideV.length() > MAX_SLIDE) this.slideV.setLength(MAX_SLIDE);
    } else if (this.mode === 'slide') {
      const v = this.slideV.length();
      if (v < 0.3 || (!this.onGround && this.vy < -2.5)) { this.mode = 'walk'; this.slideV.set(0, 0, 0); }
      else if (this.onGround) this.slideV.setLength(Math.max(0, v - 4 * dt));
    }

    // orientación, animación y posición visible (la altura se suaviza en los escalones)
    const hv = this.mode === 'slide' ? this.slideV : want ? d.clone().multiplyScalar(speed) : null;
    const hs = hv ? hv.length() : 0;
    if (hv && hs > 0.05) { this.yaw = lerpAngle(this.yaw, Math.atan2(-hv.x, -hv.z), 1 - Math.exp(-12 * dt)); this.phase += hs * dt * 7; }
    this.renderY = this.onGround ? this.renderY + (p.y - this.renderY) * Math.min(1, 16 * dt) : p.y;
    this.avatar.position.set(p.x, this.renderY, p.z); this.avatar.rotation.y = this.yaw;
    const mode = this.mode === 'slide' ? 'slide' : (!this.onGround && Math.abs(this.vy) > 1) ? 'air' : zone ? 'balls' : 'walk';
    poseAvatar(this.avatar, { mode, phase: this.phase, speed: hs, t: this.t });
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.sc.camera, pr = this.preset;
    if (this.cam === 'first') {
      const eye = new THREE.Vector3(this.pos.x, this.renderY + (this.mode === 'slide' ? pr.h * 0.5 : pr.h * 0.93), this.pos.z);
      const look = new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.elev), Math.sin(this.elev), -Math.cos(this.camYaw) * Math.cos(this.elev));
      cam.position.copy(eye); cam.lookAt(eye.add(look)); return;
    }
    const target = new THREE.Vector3(this.pos.x, this.renderY + pr.h * 0.75, this.pos.z);
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.camYaw) * Math.cos(this.pitch));
    let dist = this.dist;
    this.ray.set(target, off); this.ray.near = 0; this.ray.far = dist;
    const hits = this.ray.intersectObjects(this.camColl || [], false);
    if (hits.length) dist = Math.max(0.6, hits[0].distance - 0.15); // no dejar suelos ni paredes entre cámara y persona
    const want = target.clone().addScaledVector(off, dist);
    cam.position.lerp(want, 1 - Math.exp(-14 * dt)); cam.lookAt(target);
  }
}
