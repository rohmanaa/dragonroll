/**
 * AuraSystem.js — satu engine untuk semua aura (data dari AuraCatalog).
 *
 * const sys = new AuraSystem(scene, camera, { quality: 'medium' });
 * const aura = sys.attach(characterObject3D, 'dragon', { intensity: 1, size: 1, speed: 1, tint: null });
 * aura.set({ intensity: 1.4 }); aura.jump(); aura.despawn(); aura.setAura('solar');
 * // di render loop: sys.update(dt)
 *
 * Aura mengikuti posisi + arah hadap karakter otomatis (walk/run/jump/rotate), mengukur tinggi karakter
 * untuk skala (1u = tinggi/1.8), dan mendeteksi lompat/mendarat dari perubahan posisi Y.
 */
import * as THREE from 'three';
import { TIER, QUALITY, detectQuality, TAU, clamp, lerp, rnd, smooth } from './AuraConfig.js';
import { VoxelParticles } from './AuraParticles.js';
import { DECOR } from './AuraDecor.js';
import { AURAS, getAura } from './AuraCatalog.js';

const ZONE = { foot: { h: [0, 0.1], r: 0.6 }, body: { h: [0.15, 1.6], r: 0.6 }, head: { h: [1.85, 2.3], r: 0.35 }, back: { h: [0.4, 1.8], r: 0.5 }, ambient: { h: [0, 2.2], r: 1.1 } };
const DRAG = { orbit: 0, helix: 0, rise: 0.5, drift: 1.2, fall: 0.3 };
const EXTRA = new Set(['silhouette', 'dragonShadow', 'distort', 'horns']);

class CharacterAura {
  constructor(sys, character, id, settings = {}, opts = {}) {
    this.sys = sys; this.ch = character; this.opts = { facing: 0, ...opts };
    this.settings = { intensity: 1, size: 1, speed: 1, tint: null, tintMix: 0.75, ...settings };
    this._tint = this.settings.tint ? new THREE.Color(this.settings.tint) : null;
    this.flat = new THREE.Group(); this.yaw = new THREE.Group();
    sys.scene.add(this.flat, this.yaw);
    this.anchor = new THREE.Vector3(); this.vel = new THREE.Vector3(); this._prev = new THREE.Vector3(); this._has = false;
    this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this.t = 0; this.env = 0; this.phase = 'spawn'; this.air = 0; this.airborne = false; this.pulse = 0; this.tintV = 0; this.lod = 1; this.removeOnDone = true;
    this.s = { env: 0, inten: 1, size: 1, air: 0, pulse: 0, tintV: 0 };
    this._measure();
    this.ground = this.anchor.y;
    this._build(id);
    this._burstSpawn();
  }

  _measure() {
    const ch = this.ch; ch.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(ch), size = b.getSize(new THREE.Vector3());
    ch.getWorldPosition(this._p);
    const H = this.opts.height || size.y || 1.8;
    this.u = H / 1.8; this.footOff = b.min.y - this._p.y;
    this.anchor.set(this._p.x, this._p.y + this.footOff, this._p.z); this._prev.copy(this.anchor);
  }

  paint(target, hex) { target.set(hex); if (this._tint) target.lerp(this._tint, this.settings.tintMix); return target; }

  _clearDecor() { for (const d of this.decor || []) { d.obj.parent?.remove(d.obj); d.dispose(); } this.decor = []; }
  _build(id) {
    this._clearDecor();
    this.def = typeof id === 'string' ? getAura(id) : id;
    if (!this.def) throw new Error(`Aura tidak ditemukan: ${id}`);
    const q = this.sys.q, T = TIER[this.def.tier];
    this.T = T;
    this.emitters = this.def.emit.map((e) => ({ ...e, acc: 0, burstT: e.burst ? e.burst.every * rnd(0.3, 1) : 0, pulseT: e.pulse ? e.pulse.every * rnd(0.2, 0.8) : 0 }));
    this._recolor();
    const ctx = { u: this.u, q, layers: T.rings, paint: (t, h) => this.paint(t, h) };
    for (const spec of this.def.fx) {
      if ((EXTRA.has(spec.type) && !q.extras) || (spec.type === 'fog' && !q.fog) || !DECOR[spec.type]) continue;
      const d = DECOR[spec.type](spec, ctx);
      (d.follow === 'yaw' ? this.yaw : this.flat).add(d.obj);
      this.decor.push(d);
    }
  }
  rebuild() { this._build(this.def); }
  _recolor() { for (const e of this.emitters) e._cols = e.colors.map((h) => this.paint(new THREE.Color(), h)); }

  // ---------------------------------------------------------------- API
  set(p) {
    Object.assign(this.settings, p);
    if ('tint' in p) { this._tint = p.tint ? new THREE.Color(p.tint) : null; this.tintV++; this._recolor(); }
    return this;
  }
  setAura(id) { this._build(id); this.phase = 'spawn'; this.env = 0; this.t = 0; this._burstSpawn(); return this; }
  despawn(remove = true) { this.phase = 'despawn'; this.removeOnDone = remove; return this; }
  respawn() { this.phase = 'spawn'; this.t = 0; this._burstSpawn(); return this; }
  jump() { this._onJump(); }

  // ---------------------------------------------------------------- partikel
  _spawn(em, o = {}) {
    const P = this.sys.particles, S = this.settings, u = this.u, k = S.speed, boost = o.boost || 1, A = this.anchor;
    const Z = ZONE[em.zone] || ZONE.body, h = em.h || Z.h, hh = rnd(h[0], h[1]) * u, rad = (em.radius ?? Z.r) * u * S.size;
    const c = em._cols[(Math.random() * em._cols.length) | 0];
    const base = {
      shape: em.shape, solid: em.solid, r: c.r, g: c.g, b: c.b, size: em.size * u * S.size * rnd(0.8, 1.25), life: (em.life * rnd(0.8, 1.2)) / k,
      alpha: (em.alpha ?? 1) * Math.min(1.5, S.intensity), spin: em.spin || 0, grow: em.grow ?? 1, drag: em.drag ?? DRAG[em.mode] ?? 1, bob: (em.bob || 0) * u, tele: em.tele ? rnd(0.3, 1) : 0,
    };
    const a = rnd(0, TAU), ca = Math.cos(a), sa = Math.sin(a), rr = rad * Math.sqrt(Math.random());
    if (em.mode === 'orbit' || em.mode === 'helix') {
      const dir = em.dir || (Math.random() < 0.5 ? -1 : 1);
      P.emit({ ...base, mode: 1, anchor: A, ang: a, rad: rad * rnd(0.85, 1.15), h: em.mode === 'helix' ? h[0] * u : hh, w: dir * em.speed * k * rnd(0.7, 1.3), vyO: (em.rise || 0) * u * k });
    } else if (em.mode === 'fall') {
      P.emit({ ...base, x: A.x + ca * rr, y: A.y + hh, z: A.z + sa * rr, grav: (em.grav ?? 0.15) * u * k * k });
    } else { // rise | drift
      let vx, vy, vz; const sp = em.speed * u * k * boost;
      if (em.mode === 'rise') { vx = rnd(-0.1, 0.1) * u; vy = sp * rnd(0.7, 1.2); vz = rnd(-0.1, 0.1) * u; }
      else if (em.radial) { vx = ca * sp; vy = rnd(0, 0.15) * u; vz = sa * sp; }
      else { const z = rnd(-1, 1), q = Math.sqrt(1 - z * z); vx = q * ca * sp; vy = z * sp; vz = q * sa * sp; }
      P.emit({ ...base, x: A.x + ca * rr, y: A.y + hh, z: A.z + sa * rr, vx, vy, vz, grav: (em.grav || 0) * u * k * k });
    }
  }
  _pulseRing(em) {
    const P = this.sys.particles, u = this.u, S = this.settings, k = S.speed, n = em.pulse.count, off = rnd(0, TAU);
    for (let i = 0; i < n; i++) {
      const c = em._cols[i % em._cols.length];
      P.emit({ shape: em.shape, solid: em.solid, r: c.r, g: c.g, b: c.b, size: em.size * u * S.size, life: em.life / k, alpha: Math.min(1.5, S.intensity),
        drag: 0, mode: 1, anchor: this.anchor, ang: off + (i / n) * TAU, rad: (em.radius ?? 0.6) * u * S.size, h: 0.05 * u, w: 0.35 * k, radV: 0.3 * u * k, vyO: (em.rise || 1) * u * k });
    }
  }
  _burstFeet(n, up = 0.6) {
    const P = this.sys.particles, u = this.u, S = this.settings, cols = this.emitters[0]._cols;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), c = cols[i % cols.length], sp = rnd(0.5, 1.2) * u;
      P.emit({ shape: 'cube', solid: false, r: c.r, g: c.g, b: c.b, size: 0.045 * u * S.size, life: rnd(0.5, 0.9), alpha: Math.min(1.5, S.intensity),
        x: this.anchor.x + Math.cos(a) * 0.4 * u, y: this.anchor.y + 0.05 * u, z: this.anchor.z + Math.sin(a) * 0.4 * u,
        vx: Math.cos(a) * sp, vy: rnd(0.2, up) * u * 1.5, vz: Math.sin(a) * sp, grav: 2.5 * u, drag: 0.8 });
    }
  }
  _burstSpawn() { for (const e of this.emitters) for (let i = 0; i < Math.min(10, e.rate * 2); i++) this._spawn(e); this.pulse = 1; }
  _onJump() { this._burstFeet(Math.round(14 * this.sys.q.rate + 4)); this.pulse = 1; }
  _onLand() { this._burstFeet(Math.round(18 * this.sys.q.rate + 4), 0.4); this.pulse = 1.2; }

  // ---------------------------------------------------------------- loop
  update(dt) {
    const S = this.settings, k = S.speed, sdt = dt * k, u = this.u, q = this.sys.q;
    this.t += sdt;
    // lifecycle
    if (this.phase === 'spawn') { this.env = Math.min(1, this.env + dt / 0.9); if (this.env >= 1) this.phase = 'run'; }
    else if (this.phase === 'despawn') { this.env = Math.max(0, this.env - dt / 0.8); if (this.env <= 0) { this.phase = 'dead'; if (this.removeOnDone) this.dispose(); return; } }
    if (this.phase === 'dead') return;
    // ikuti karakter (posisi + arah hadap)
    const ch = this.ch;
    ch.getWorldPosition(this._p);
    this.anchor.set(this._p.x, this._p.y + this.footOff, this._p.z);
    ch.getWorldQuaternion(this._q); this._e.setFromQuaternion(this._q, 'YXZ');
    this.flat.position.copy(this.anchor); this.yaw.position.copy(this.anchor); this.yaw.rotation.y = this._e.y + this.opts.facing;
    // kecepatan, lompat / mendarat
    if (this._has) this.vel.copy(this.anchor).sub(this._prev).divideScalar(Math.max(dt, 1e-4));
    if (this.vel.length() > 60 * u) this.vel.set(0, 0, 0);
    this._prev.copy(this.anchor); this._has = true;
    const spd = Math.hypot(this.vel.x, this.vel.z) / u;
    const air = this.anchor.y - this.ground > 0.12 * u;
    if (air && !this.airborne) this._onJump();
    if (!air && this.airborne) this._onLand();
    if (!air) this.ground += (this.anchor.y - this.ground) * 0.2;
    this.airborne = air; this.air += ((air ? 1 : 0) - this.air) * Math.min(1, dt * 8);
    this.pulse *= Math.exp(-3 * dt);
    // LOD jarak kamera
    const dist = this.sys.camera.position.distanceTo(this.anchor);
    this.lod = clamp(1.15 - dist / (40 * u), 0.25, 1);
    // emisi
    const eEnv = smooth(0, 1, this.env), mul = this.T.rate * q.rate * this.lod * Math.min(2, S.intensity) * eEnv * (1 + this.air * 0.6 + Math.min(spd, 6) * 0.08);
    for (const em of this.emitters) {
      em.acc = Math.min(20, em.acc + em.rate * mul * sdt);
      while (em.acc >= 1) { em.acc--; this._spawn(em); }
      if (em.burst && eEnv > 0.5) { em.burstT -= sdt; if (em.burstT <= 0) { em.burstT = em.burst.every; const n = Math.round(em.burst.count * q.rate * this.lod); for (let i = 0; i < n; i++) this._spawn(em, { boost: 1.8 }); } }
      if (em.pulse && eEnv > 0.5) { em.pulseT -= sdt; if (em.pulseT <= 0) { em.pulseT = em.pulse.every; this._pulseRing(em); } }
    }
    // dekor
    const s = this.s; s.env = eEnv; s.inten = S.intensity; s.size = S.size; s.air = this.air; s.pulse = this.pulse; s.tintV = this.tintV;
    for (const d of this.decor) d.update(this.t, sdt, s);
  }

  dispose() {
    this._clearDecor();
    this.sys.scene.remove(this.flat, this.yaw);
    const i = this.sys.auras.indexOf(this); if (i >= 0) this.sys.auras.splice(i, 1);
    this.phase = 'dead';
  }
}

export class AuraSystem {
  constructor(scene, camera, opts = {}) {
    this.scene = scene; this.camera = camera;
    this.qName = opts.quality || detectQuality(); this.q = QUALITY[this.qName];
    this.particles = new VoxelParticles(scene, this.q);
    this.auras = [];
  }
  list() { return AURAS.map((a) => ({ id: a.id, name: a.name, rarity: a.rarity, tier: a.tier, theme: a.theme })); }
  attach(character, id, settings, opts) { const a = new CharacterAura(this, character, id, settings, opts); this.auras.push(a); return a; }
  update(dt) {
    dt = Math.min(dt, 0.05);
    for (const a of [...this.auras]) a.update(dt);
    this.particles.update(dt);
  }
  /** Ganti kualitas: pool partikel dibuat ulang, dekor tiap aura dibangun ulang. */
  setQuality(name) {
    if (!QUALITY[name] || name === this.qName) return;
    this.qName = name; this.q = QUALITY[name];
    this.particles.dispose(); this.particles = new VoxelParticles(this.scene, this.q);
    for (const a of this.auras) a.rebuild();
  }
  get stats() { return { particles: this.particles.alive, auras: this.auras.length, quality: this.qName }; }
  dispose() { for (const a of [...this.auras]) a.dispose(); this.particles.dispose(); }
}
