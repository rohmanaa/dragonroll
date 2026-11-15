/**
 * PowerEffects.js — SEMUA efek visual dikelola di sini lewat data katalog (bukan per item):
 *  - ambient particles (mode around / tip / orbit / rise)
 *  - spawn / activation charge / impact / disappear
 *  - impact: cincin lantai, shell energi, flash, kolom cahaya, petir, camera shake
 *  - trail ribbon (tip / center), special: wings, rings, lightning, coldMist
 * Pool objek dipakai ulang; dispose() membersihkan semua geometry/material.
 */
import * as THREE from 'three';
import { TAU, clamp, lerp, rnd, pick } from './PowerConfig.js';
import { styleOf } from './PowerParticles.js';
import { radialTexture } from './PowerAura.js';
import { ease } from './PowerAnimation.js';

const ADD = THREE.AdditiveBlending;

/** Preset impact (nama dari katalog). c1/c2 warna, rings = jumlah cincin, sphere = shell energi. */
export const IMPACTS = {
  metalSparks:      { c1: '#ffd98a', c2: '#ffffff', rings: 1, sphere: 0, flash: 0.6, count: 0.8, type: 'spark', shake: 0.3 },
  shieldWave:       { c1: '#d9a066', c2: '#fff0d0', rings: 1, sphere: 0, flash: 0.5, count: 0.8, type: 'debris', shake: 0.5 },
  explosion:        { c1: '#ff7a20', c2: '#ffd24a', rings: 1, sphere: 1, flash: 1.6, count: 1.4, type: 'flame', shake: 1.5, smoke: true },
  windWave:         { c1: '#ffffff', c2: '#cfe0ff', rings: 2, sphere: 0, flash: 0.6, count: 1, type: 'feather', shake: 0.2 },
  goldPulse:        { c1: '#ffd24a', c2: '#fff2a8', rings: 2, sphere: 1, flash: 1, count: 1, type: 'sparkle', shake: 0.2 },
  cyanShockwave:    { c1: '#27d8f2', c2: '#d8ffff', rings: 2, sphere: 1, flash: 1.1, count: 1.2, type: 'shard', shake: 0.6 },
  resurrection:     { c1: '#ffd24a', c2: '#46ff7a', rings: 3, sphere: 1, flash: 1.5, count: 1.4, type: 'energy', shake: 0.5, column: true },
  rift:             { c1: '#a43cff', c2: '#ff40d8', rings: 2, sphere: 1, flash: 1.2, count: 1.3, type: 'ender', shake: 0.6, inward: true },
  fireExplosion:    { c1: '#ff7a18', c2: '#ffe27a', rings: 2, sphere: 1, flash: 1.6, count: 1.5, type: 'flame', shake: 1, smoke: true },
  iceBurst:         { c1: '#7fd0ff', c2: '#ffffff', rings: 2, sphere: 1, flash: 1.2, count: 1.4, type: 'shard', shake: 0.7 },
  heavyShockwave:   { c1: '#ff2a3a', c2: '#ffb07a', rings: 3, sphere: 1, flash: 1.5, count: 1.5, type: 'spark', shake: 1.6 },
  flameExplosion:   { c1: '#ff9a1a', c2: '#ffe27a', rings: 3, sphere: 1, flash: 1.8, count: 1.6, type: 'ember', shake: 1.3, smoke: true },
  waterShockwave:   { c1: '#27d8e6', c2: '#ffffff', rings: 3, sphere: 1, flash: 1.4, count: 1.5, type: 'water', shake: 1, bolt: true },
  crimsonExplosion: { c1: '#ff2a52', c2: '#b266ff', rings: 3, sphere: 1, flash: 2, count: 1.8, type: 'flame', shake: 1.8, smoke: true },
  celestialExplosion: { c1: '#ffffff', c2: '#7fe6ff', rings: 3, sphere: 1, flash: 2.2, count: 1.8, type: 'star', shake: 1.6, column: true },
};
function resolveImpact(item) {
  const c = IMPACTS[item.impact];
  if (c) return c;
  return { c1: item.colors.primary, c2: item.colors.secondary, rings: clamp(item.tier - 2, 1, 3), sphere: 1, flash: 0.6 + item.tier * 0.25, count: 0.8 + item.tier * 0.15, type: item.particles.particleType, shake: 0.4 + item.tier * 0.2 };
}

const randUnit = (v) => { const z = rnd(-1, 1), a = rnd(0, TAU), r = Math.sqrt(1 - z * z); return v.set(r * Math.cos(a), z, r * Math.sin(a)); };

// -------------------------------------------------------------------------------------------- Trail
class Trail {
  constructor(parent, cfg, S) {
    this.max = 40; this.pts = []; this.S = S; this.spiral = !!cfg.spiral; this.tip = cfg.anchor === 'tip';
    this.life = 0.7; this.w0 = S * 0.05;
    this.c1 = new THREE.Color(cfg.color); this.c2 = new THREE.Color('#ffffff').lerp(this.c1, 0.3);
    this.geo = new THREE.BufferGeometry();
    const n = this.max * 2;
    this.posA = new Float32Array(n * 3); this.colA = new Float32Array(n * 4);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colA, 4).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: ADD, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    parent.add(this.mesh);
    this._t = new THREE.Vector3(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3(); this._c = new THREE.Color();
  }
  update(dt, p, cam, f) {
    const pts = this.pts;
    if (!pts.length || pts[0].p.distanceToSquared(p) > 1e-4) pts.unshift({ p: p.clone(), age: 0 });
    for (const pt of pts) pt.age += dt;
    const life = this.life * (f.trail ? 1.6 : 1);
    while (pts.length && pts[pts.length - 1].age > life) pts.pop();
    if (pts.length > this.max) pts.length = this.max;
    const n = pts.length;
    if (n < 2 || !f.alive) { this.geo.setDrawRange(0, 0); return; }
    const idleA = this.tip ? 0.22 : 0.35, baseA = f.trail ? 0.9 : idleA;
    for (let i = 0; i < n; i++) {
      const pt = pts[i], k = pt.age / life;
      this._t.copy(pts[Math.min(n - 1, i + 1)].p).sub(pts[Math.max(0, i - 1)].p);
      if (this._t.lengthSq() < 1e-9) this._t.set(0, 1, 0);
      this._t.normalize();
      this._v.copy(cam.position).sub(pt.p);
      this._s.crossVectors(this._t, this._v);
      if (this._s.lengthSq() < 1e-9) this._s.set(1, 0, 0);
      this._s.normalize();
      const w = this.w0 * (1 - k) * (f.trail ? 1.4 : 0.8);
      const off = this.spiral ? Math.sin(pt.age * 16 + i * 0.6) * this.S * 0.07 * (1 - k) : 0;
      const cx = pt.p.x + this._s.x * off, cy = pt.p.y + this._s.y * off, cz = pt.p.z + this._s.z * off;
      const o = i * 6;
      this.posA[o] = cx + this._s.x * w; this.posA[o + 1] = cy + this._s.y * w; this.posA[o + 2] = cz + this._s.z * w;
      this.posA[o + 3] = cx - this._s.x * w; this.posA[o + 4] = cy - this._s.y * w; this.posA[o + 5] = cz - this._s.z * w;
      this._c.copy(this.c2).lerp(this.c1, Math.min(1, k * 2));
      const a = Math.pow(1 - k, 1.5) * baseA * f.fade, c = i * 8;
      for (let s = 0; s < 2; s++) { this.colA[c + s * 4] = this._c.r; this.colA[c + s * 4 + 1] = this._c.g; this.colA[c + s * 4 + 2] = this._c.b; this.colA[c + s * 4 + 3] = a; }
    }
    this.geo.setDrawRange(0, (n - 1) * 6);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.geo.dispose(); this.mesh.material.dispose(); }
}

// --------------------------------------------------------------------------------------- shader sayap
const WING_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WING_FRAG = `uniform vec3 uC1; uniform vec3 uC2; uniform float uOpacity; varying vec2 vUv;
void main(){ float a = pow(1.0 - abs(vUv.y), 0.7) * (1.0 - 0.5 * vUv.x) * uOpacity; gl_FragColor = vec4(mix(uC1, uC2, vUv.x), clamp(a, 0.0, 1.0));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const SHELL_VERT = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const SHELL_FRAG = `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uColor, f * uOpacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function bladeGeo(L, w) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, L * 0.38, w, 0, L, 0, 0, L * 0.38, -w, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.38, 1, 1, 0, 0.38, -1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ------------------------------------------------------------------------------------------ Effects
export class PowerEffects {
  constructor(scene, particles, lighting, q) {
    this.scene = scene; this.particles = particles; this.lighting = lighting; this.q = q;
    this.world = new THREE.Group(); this.root = new THREE.Group();
    scene.add(this.world, this.root);
    this.active = []; this.shake = 0; this.item = null;
    this._sp = []; this._disp = []; this._acc = 0;
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this._makePools();
  }

  // ---- pool objek efek
  _makePools() {
    const basic = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: ADD, depthWrite: false, side: THREE.DoubleSide });
    this.pool = { ring: [], shell: [], flash: [], beam: [], bolt: [] };
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2);
    this.shellGeo = new THREE.SphereGeometry(1, 28, 18);
    this.beamGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 28, 1, true).translate(0, 0.5, 0);
    this.owned = [this.ringGeo, this.shellGeo, this.beamGeo];
    const add = (kind, obj) => { obj.visible = false; this.world.add(obj); this.pool[kind].push(obj); };
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(this.ringGeo, basic()); m.renderOrder = 3; add('ring', m); this.owned.push(m.material); }
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } }, vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide });
      const m = new THREE.Mesh(this.shellGeo, mat); m.renderOrder = 3; add('shell', m); this.owned.push(mat);
    }
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), blending: ADD, transparent: true, depthWrite: false, opacity: 0 }));
      s.renderOrder = 5; add('flash', s); this.owned.push(s.material);
    }
    { const m = new THREE.Mesh(this.beamGeo, basic()); m.renderOrder = 3; add('beam', m); this.owned.push(m.material); }
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(17 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: ADD, depthWrite: false }));
      l.frustumCulled = false; l.renderOrder = 5; add('bolt', l); this.owned.push(g, l.material);
    }
  }
  _take(kind) { const m = this.pool[kind].pop(); if (m) m.visible = true; return m; }
  _run(kind, mesh, dur, delay, apply) { this.active.push({ kind, mesh, dur, delay, t: 0, apply }); }
  _updateFx(dt) {
    for (const e of this.active) {
      e.t += dt;
      const tt = e.t - e.delay;
      if (tt < 0) { e.mesh.visible = false; continue; }
      const k = tt / e.dur;
      if (k >= 1) { e.mesh.visible = false; e.done = true; this.pool[e.kind].push(e.mesh); continue; }
      e.mesh.visible = true; e.apply(k, e.mesh);
    }
    this.active = this.active.filter((e) => !e.done);
  }
  _ring(color, max, delay = 0, dur = 0.9) {
    const m = this._take('ring'); if (!m) return;
    m.position.set(this.holder.position.x, 0.03, this.holder.position.z); m.material.color.set(color);
    this._run('ring', m, dur, delay, (k) => { m.scale.setScalar(lerp(0.15, max, ease.outCubic(k))); m.material.opacity = Math.pow(1 - k, 1.5) * 0.85; });
  }
  _shell(color, max, dur = 0.7) {
    const m = this._take('shell'); if (!m) return;
    m.position.copy(this.holder.position); m.material.uniforms.uColor.value.set(color);
    this._run('shell', m, dur, 0, (k) => { m.scale.setScalar(lerp(0.3, max, ease.outCubic(k))); m.material.uniforms.uOpacity.value = Math.pow(1 - k, 2) * 0.7; });
  }
  _flash(color, size, dur = 0.4) {
    const m = this._take('flash'); if (!m) return;
    m.position.copy(this.holder.position); m.material.color.set(color);
    this._run('flash', m, dur, 0, (k) => { m.scale.setScalar(size * (1 + k * 0.8)); m.material.opacity = Math.pow(1 - k, 2); });
  }
  _beam(color, h, dur = 0.9) {
    const m = this._take('beam'); if (!m) return;
    m.position.set(this.holder.position.x, 0, this.holder.position.z); m.material.color.set(color);
    this._run('beam', m, dur, 0, (k) => { m.scale.set(1 - k * 0.7 + 0.1, h * ease.outCubic(Math.min(1, k * 4)), 1 - k * 0.7 + 0.1); m.material.opacity = (1 - k) * 0.55; });
  }
  _bolt(color) {
    const m = this._take('bolt'); if (!m) return;
    const S = this.S, a = this._v.copy(this.holder.position).add(new THREE.Vector3(rnd(-1, 1) * S * 0.6, S * 3.2, rnd(-0.5, 0.5)));
    const b = this.holder.position.clone().add(new THREE.Vector3(0, S * 0.55, 0));
    m.material.color.set(color);
    const arr = m.geometry.attributes.position.array, from = a.clone();
    this._run('bolt', m, 0.22, 0, (k) => {
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, j = i === 0 || i === 16 ? 0 : S * 0.18;
        arr[i * 3] = lerp(from.x, b.x, u) + rnd(-j, j); arr[i * 3 + 1] = lerp(from.y, b.y, u); arr[i * 3 + 2] = lerp(from.z, b.z, u) + rnd(-j, j);
      }
      m.geometry.attributes.position.needsUpdate = true;
      m.material.opacity = Math.random() > 0.3 ? 1 - k : 0.2;
    });
    this._flash(color, S * 1.2, 0.2);
    this.lighting.punch(color, 1.2);
  }

  // ---- partikel
  _p(x, y, z, vx, vy, vz, st, o = {}) {
    const P = this.item.particles, c = o.color || pick(this.cols);
    this.particles.emit({
      x, y, z, vx, vy, vz, r: c.r, g: c.g, b: c.b,
      size: (o.size ?? P.particleSize) * st.size * rnd(0.75, 1.3),
      life: (o.life ?? P.particleLifetime) * st.life * rnd(0.7, 1.2),
      alpha: (st.alpha ?? 1) * P.particleOpacity, shape: st.shape, add: st.add,
      grav: o.grav ?? st.grav, drag: st.drag, grow: st.grow, spin: (st.spin || 0) * rnd(-1, 1),
      mode: o.mode, ang: o.ang, rad: o.rad, h: o.h, w: o.w,
    });
  }
  burst(count, type, o = {}) {
    const st = styleOf(type), P = this.item.particles, c = this.holder.position, S = this.S;
    const n = Math.round(count * this.q.particleMul), cols = o.colors || this.cols;
    for (let i = 0; i < n; i++) {
      const d = randUnit(this._w);
      if (o.flat) d.y *= 0.35;
      if (o.up) d.y = Math.abs(d.y);
      const sp = P.particleSpeed * st.speed * rnd(0.5, 1.2) * (o.speed || 1), r = rnd(0, P.spreadRadius) * S * 0.4;
      const grav = type === P.particleType && P.gravity ? P.gravity : st.grav;
      const col = pick(cols);
      if (o.inward) this._p(c.x + d.x * S * 0.9, c.y + d.y * S * 0.9, c.z + d.z * S * 0.9, -d.x * sp, -d.y * sp, -d.z * sp, st, { color: col, size: P.particleSize * (o.size || 1), grav });
      else this._p(c.x + d.x * r, c.y + d.y * r, c.z + d.z * r, d.x * sp, d.y * sp, d.z * sp, st, { color: col, size: P.particleSize * (o.size || 1), grav });
    }
  }
  _ambient(dt) {
    const am = this.item.ambient, st = styleOf(am.type), S = this.S, P = this.item.particles;
    this._acc += am.rate * 2.5 * this.q.particleMul * (this.item.aura.particleDensity / 2 + 0.5) * dt * (this.frame.fade || 0);
    const c = this.holder.position, grav = am.type === P.particleType && P.gravity ? P.gravity : st.grav;
    while (this._acc >= 1) {
      this._acc -= 1;
      const sz = P.particleSize;
      if (am.mode === 'tip') {
        const t = this.holder.localToWorld(this._v.copy(this.model.userData.anchors.tip));
        this._p(t.x + rnd(-0.05, 0.05), t.y, t.z + rnd(-0.05, 0.05), rnd(-0.2, 0.2), rnd(0.3, 0.9) * st.speed, rnd(-0.2, 0.2), st, { size: sz, grav });
      } else if (am.mode === 'orbit') {
        this._p(c.x, c.y, c.z, -0.0, rnd(-0.05, 0.2), 0, st, { size: sz, grav, mode: 1, ang: rnd(0, TAU), rad: S * rnd(0.5, 0.7), h: rnd(-0.4, 0.4) * S, w: rnd(0.9, 1.8) * (Math.random() > 0.5 ? 1 : -1) });
      } else if (am.mode === 'rise') {
        this._p(c.x + rnd(-0.3, 0.3) * S, c.y - S * 0.45 + rnd(0, 0.25) * S, c.z + rnd(-0.3, 0.3) * S, rnd(-0.1, 0.1), rnd(0.8, 1.6) * st.speed, rnd(-0.1, 0.1), st, { size: sz, grav });
      } else {
        const d = randUnit(this._w), r = S * rnd(0.42, 0.62);
        this._p(c.x + d.x * r, c.y + d.y * r * 0.8, c.z + d.z * r, d.x * st.speed * 0.25, d.y * st.speed * 0.25, d.z * st.speed * 0.25, st, { size: sz, grav });
      }
    }
  }

  // ---- bind / unbind item
  bind(item, holder, model) {
    this.unbind();
    this.item = item; this.holder = holder; this.model = model; this.S = item.size; this.frame = { fade: 0 };
    this.cols = (item.particles.colors || [item.colors.primary]).map((c) => new THREE.Color(c));
    if (item.trail && this.q.trail) this.trail = new Trail(this.world, item.trail, this.S);
    const sp = item.special;
    if (sp) {
      const n = sp.name || '';
      if (/wing/i.test(n)) this._wings(sp);
      else if (/ring/i.test(n)) this._rings(sp);
      else if (/lightning/i.test(n)) this._lightning(sp);
      else if (/mist/i.test(n)) this._mist();
    }
  }
  unbind() {
    this.trail?.dispose(); this.trail = null;
    this.root.traverse((o) => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    this.root.clear();
    this._sp.length = 0; this._acc = 0; this.item = null;
    for (const e of this.active) { e.mesh.visible = false; this.pool[e.kind].push(e.mesh); }
    this.active.length = 0;
  }

  // ---- special effects
  _wings(sp) {
    const S = this.S, q = this.q, bat = !!sp.bat;
    const c1 = new THREE.Color(sp.color || this.item.colors.primary), c2 = new THREE.Color(sp.color2 || this.item.colors.secondary);
    const mk = (op) => new THREE.ShaderMaterial({ uniforms: { uC1: { value: c1 }, uC2: { value: c2 }, uOpacity: { value: op } }, vertexShader: WING_VERT, fragmentShader: WING_FRAG, transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide });
    const memb = mk(0.55), bone = mk(1);
    const anchor = this.model.userData.anchors.wing;
    const group = new THREE.Group(); this.root.add(group);
    const sides = [];
    for (const sd of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sd * S * 0.12, anchor.y, anchor.z - S * 0.1); pivot.scale.x = sd;
      if (bat) {
        const ang = [1.0, 0.45, -0.1, -0.65], len = [0.8, 1.05, 0.95, 0.7].map((x) => x * S), tips = ang.map((a, i) => [Math.cos(a) * len[i], Math.sin(a) * len[i]]);
        const v = [], u = [];
        for (let i = 0; i < 3; i++) {
          const m = [(tips[i][0] + tips[i + 1][0]) / 2 * 0.7, (tips[i][1] + tips[i + 1][1]) / 2 * 0.7];
          v.push(0, 0, 0, ...tips[i], 0, ...m, 0, 0, 0, 0, ...m, 0, ...tips[i + 1], 0);
          const ul = (p) => Math.hypot(p[0], p[1]) / (S * 1.05);
          u.push(0, 0, ul(tips[i]), 0, ul(m), 0, 0, 0, ul(m), 0, ul(tips[i + 1]), 0);
        }
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); mg.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
        pivot.add(new THREE.Mesh(mg, memb));
        ang.forEach((a, i) => { const m = new THREE.Mesh(bladeGeo(len[i], S * 0.02), bone); m.rotation.z = a; pivot.add(m); });
      } else {
        const N = q.wingBlades;
        for (let i = 0; i < N; i++) {
          const a = lerp(0.55, -0.7, i / Math.max(1, N - 1)), L = S * (0.95 - i * 0.06 + (i === 0 ? 0.1 : 0));
          const m = new THREE.Mesh(bladeGeo(L, L * 0.14), memb); m.rotation.z = a; m.position.z = i * 0.01; pivot.add(m);
          if (N >= 5) { const m2 = new THREE.Mesh(bladeGeo(L * 0.55, L * 0.12), bone); m2.rotation.z = a + 0.08; m2.position.z = i * 0.01 + 0.005; pivot.add(m2); }
        }
      }
      group.add(pivot); sides.push({ pivot, sd });
    }
    this._sp.push((dt, t, f) => {
      const flap = 2.2 + f.boost * 5;
      for (const { pivot, sd } of sides) pivot.rotation.y = sd * (0.15 + 0.3 * Math.sin(t * flap));
      group.scale.setScalar(1 + f.boost * 0.25);
      memb.uniforms.uOpacity.value = (0.5 + 0.25 * f.pulse * 3 + f.boost * 0.4) * f.fade;
      bone.uniforms.uOpacity.value = 0.9 * f.fade;
    });
    this._disp.push(memb, bone);
  }
  _rings(sp) {
    const S = this.S, n = clamp(this.item.T.rings || 1, 1, this.q.ringsMax);
    const c1 = new THREE.Color(sp.color || this.item.colors.primary), c2 = new THREE.Color(sp.color2 || this.item.colors.secondary);
    const rings = [];
    for (let i = 0; i < n; i++) {
      const R = S * (0.66 + 0.14 * i);
      const m = new THREE.Mesh(new THREE.TorusGeometry(R, S * 0.011, 6, 80), new THREE.MeshBasicMaterial({ color: i % 2 ? c2 : c1, transparent: true, blending: ADD, depthWrite: false, opacity: 0.8 }));
      m.rotation.set(0.9 * i + 0.5, i * 1.1, i * 0.6);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(S * 0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      bead.position.set(R, 0, 0); m.add(bead);
      this.root.add(m); rings.push(m);
    }
    this._sp.push((dt, t, f) => rings.forEach((m, i) => {
      m.rotation.z += dt * (1.1 + 0.5 * i) * (1 + f.boost * 1.5) * (i % 2 ? -1 : 1);
      m.material.opacity = (0.55 + 0.25 * Math.sin(t * 2 + i)) * f.fade * (1 + f.boost * 0.4);
    }));
  }
  _lightning(sp) {
    let timer = rnd(2, 4);
    this._sp.push((dt, t, f) => { timer -= dt; if (timer <= 0 && f.alive && f.fade > 0.8) { timer = rnd(3.5, 7); this._bolt(sp.color || '#d8ffff'); } });
  }
  _mist() {
    const st = styleOf('smoke'), S = this.S; let acc = 0;
    this._sp.push((dt, t, f) => {
      acc += 4 * this.q.particleMul * dt * f.fade;
      while (acc >= 1) {
        acc--; const a = rnd(0, TAU), r = S * rnd(0.1, 0.9), c = this.holder.position;
        this._p(c.x + Math.cos(a) * r, 0.08, c.z + Math.sin(a) * r, Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12, st, { color: new THREE.Color('#d8f2ff'), size: S * 0.12, life: 2, grav: 0 });
      }
    });
  }

  // ---- event animasi
  onSpawn() {
    const it = this.item, S = this.S;
    this._flash(it.colors.primary, S * 1.4, 0.5); this._ring(it.colors.primary, S * 1.4, 0, 0.8);
    this.burst(it.particles.particleCount * 0.5, it.particles.particleType, { speed: 0.7 });
    this.lighting.punch(it.colors.primary, 0.6);
  }
  onActivate(act) {
    const it = this.item, S = this.S, st = styleOf(it.particles.particleType);
    const n = Math.round(24 * this.q.particleMul * (0.6 + it.tier * 0.15)), dur = Math.max(0.3, act.duration * act.hit * 0.9);
    const c = this.holder.position;
    for (let i = 0; i < n; i++) {
      const rad = S * rnd(0.8, 1.3);
      this._p(c.x, c.y, c.z, -rad / dur * 0.9, rnd(-0.1, 0.1), 0, st, { mode: 1, ang: rnd(0, TAU), rad, h: rnd(-0.5, 0.5) * S, w: rnd(2, 4) * (Math.random() > 0.5 ? 1 : -1), life: dur / st.life / 1 });
    }
    if (it.special && /lightning/i.test(it.special.name || '')) this._bolt(it.special.color || '#d8ffff');
  }
  onHit() {
    const it = this.item, S = this.S, cfg = resolveImpact(it), cols = [new THREE.Color(cfg.c1), new THREE.Color(cfg.c2)];
    this._flash(cfg.c2, S * 3 * cfg.flash, 0.45);
    for (let i = 0; i < cfg.rings; i++) this._ring(i % 2 ? cfg.c2 : cfg.c1, S * (1.6 + 0.7 * i), i * 0.09, 0.9 + 0.15 * i);
    if (cfg.sphere) this._shell(cfg.c1, S * 2, 0.7);
    this.burst(it.particles.particleCount * cfg.count, cfg.type, { speed: 1.4, size: 1.3, colors: cols, inward: false });
    if (cfg.inward) this.burst(it.particles.particleCount * 0.5, cfg.type, { speed: 1.2, colors: cols, inward: true });
    if (cfg.smoke) this.burst(20, 'smoke', { speed: 0.8, size: 1.6, colors: [new THREE.Color('#3a3a44'), new THREE.Color('#6a6a74')], up: true });
    if (cfg.column) this._beam(cfg.c1, S * 3.2, 0.9);
    if (cfg.bolt) this._bolt(cfg.c2);
    this.shake = Math.max(this.shake, it.T.shake * cfg.shake);
    this.lighting.punch(cfg.c1, 1.5 * (0.4 + cfg.flash * 0.4));
  }
  onDisappear() {
    const it = this.item;
    this.burst(it.particles.particleCount * 0.7, it.particles.particleType, { speed: 0.6 });
    this._ring(it.colors.primary, this.S * 1.2, 0, 0.7);
  }

  // ---- loop
  update(dt, t, f, cam) {
    if (!this.item) return;
    this.frame = f;
    const h = this.holder;
    this.root.visible = f.alive;
    this.root.position.copy(h.position);
    this.root.scale.setScalar(Math.max(1e-3, h.scale.x));
    if (f.alive) this._ambient(dt);
    for (const fn of this._sp) fn(dt, t, f);
    if (this.trail) {
      const tip = this.trail.tip ? h.localToWorld(this._v.copy(this.model.userData.anchors.tip)) : this._v.copy(h.position);
      this.trail.update(dt, tip, cam, f);
    }
    this._updateFx(dt);
    this.shake *= Math.exp(-6 * dt);
  }

  dispose() {
    this.unbind();
    this._disp.forEach((m) => m.dispose());
    this.owned.forEach((o) => o.dispose?.());
    this.scene.remove(this.world, this.root);
  }
}
