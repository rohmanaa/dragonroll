/**
 * DiceEffects.js — sistem efek reusable berbasis konfigurasi (die.effect).
 *
 *  - ParticlePool : satu draw call per pool (normal + additive), ring-buffer pooling, tanpa alokasi per frame.
 *    (Setara instancing untuk ratusan partikel; shader point-sprite jauh lebih ringan di GPU mobile.)
 *  - Ring / Pillar pool : gelombang kejut, portal, pilar energi (mesh di-reuse).
 *  - Aura : fresnel hanya di tepi dadu, jadi angka di permukaan tidak tertutup.
 *  - 1 PointLight yang di-reuse untuk flash (tidak ada dynamic light per dadu).
 *  - DiceSound : suara prosedural WebAudio per material (tanpa aset audio).
 *
 * Resep landing/idle/roll/result dipetakan lewat nama di katalog, jadi dadu baru tidak butuh kode baru.
 */
import * as THREE from '../vendor/three.r170.module.min.js';

// ---------------------------------------------------------------------------
// Gaya partikel (perilaku). Warna & jumlah datang dari konfigurasi dadu.
// ---------------------------------------------------------------------------
const STYLES = {
  dust:   { add: false, gravity: -0.6, drag: 2.2, shape: 0, grow: 2.2, size: 1.8 },
  debris: { add: false, gravity: 16,   drag: 0.3, shape: 1, grow: 0.6, size: 1.0 },
  spark:  { add: true,  gravity: 12,   drag: 0.6, shape: 0, grow: 0.2, size: 0.8 },
  bolt:   { add: true,  gravity: 4,    drag: 1.6, shape: 1, grow: 0.1, size: 0.9 },
  glint:  { add: true,  gravity: -0.8, drag: 1.4, shape: 1, grow: 0.0, size: 1.1 },
  shard:  { add: false, gravity: 14,   drag: 0.4, shape: 1, grow: 0.5, size: 1.15 },
  energy: { add: true,  gravity: -1.2, drag: 1.2, shape: 0, grow: 0.3, size: 1.2 },
  smoke:  { add: false, gravity: -1.4, drag: 1.8, shape: 0, grow: 3.2, size: 2.6 },
  ember:  { add: true,  gravity: -1.8, drag: 0.9, shape: 0, grow: 0.1, size: 0.9 },
  lava:   { add: true,  gravity: 18,   drag: 0.3, shape: 0, grow: 0.5, size: 1.2 },
  bubble: { add: false, gravity: -2.4, drag: 1.0, shape: 2, grow: 1.2, size: 1.4 },
  frost:  { add: true,  gravity: 3,    drag: 1.2, shape: 1, grow: 0.4, size: 1.0 },
  void:   { add: true,  gravity: -0.5, drag: 1.6, shape: 0, grow: 0.2, size: 1.4 },
  star:   { add: true,  gravity: -0.8, drag: 1.0, shape: 1, grow: 0.0, size: 1.1 },
  flame:  { add: true,  gravity: -3.2, drag: 1.4, shape: 0, grow: 0.1, size: 1.7 },
};

// Resep idle: gaya, laju (partikel/detik), pola spawn.
const IDLE = {
  none:    null,
  shimmer: { style: 'glint',  rate: 2.2, mode: 'around' },
  sparks:  { style: 'bolt',   rate: 2.0, mode: 'around' },
  float:   { style: 'energy', rate: 3.0, mode: 'rise' },
  embers:  { style: 'ember',  rate: 5.0, mode: 'rise' },
  mist:    { style: 'smoke',  rate: 2.5, mode: 'low' },
  bubbles: { style: 'bubble', rate: 3.0, mode: 'rise' },
  stars:   { style: 'star',   rate: 4.0, mode: 'orbit' },
  void:    { style: 'void',   rate: 5.0, mode: 'orbit' },
  flames:  { style: 'flame',  rate: 9.0, mode: 'rise' },
};

const ROLL_STYLE = { trail: null, ember: 'ember', mist: 'smoke', stars: 'star', flame: 'flame' };

const POINT_VS = `
attribute float aSize; attribute float aAlpha; attribute float aShape; attribute vec3 aColor;
uniform float uScale;
varying float vAlpha; varying float vShape; varying vec3 vColor;
void main(){
  vAlpha = aAlpha; vShape = aShape; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 96.0);
}`;
const POINT_FS = `
varying float vAlpha; varying float vShape; varying vec3 vColor;
void main(){
  vec2 p = gl_PointCoord - 0.5; float d = length(p); float a;
  if (vShape < 0.5) a = smoothstep(0.5, 0.05, d);
  else if (vShape < 1.5) a = 1.0 - smoothstep(0.28, 0.5, abs(p.x) + abs(p.y));
  else a = smoothstep(0.5, 0.42, d) * smoothstep(0.22, 0.4, d) + 0.12 * (1.0 - d * 2.0);
  if (a * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

class ParticlePool {
  constructor(capacity, additive) {
    this.cap = capacity;
    this.next = 0;
    this.active = 0;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.shape = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity); // 0 = slot bebas
    this.size0 = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 } };
    this.material = new THREE.ShaderMaterial({
      vertexShader: POINT_VS, fragmentShader: POINT_FS, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.geo = geo;
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, st, shape) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    if (this.life[i] === 0) this.active++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.size0[i] = size; this.size[i] = size; this.life[i] = life; this.age[i] = 0; this.alpha[i] = 1;
    this.grav[i] = st.gravity; this.drag[i] = st.drag; this.grow[i] = st.grow; this.shape[i] = shape;
    this.dirty = true;
  }

  update(dt) {
    if (this.active === 0) return;
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      const life = this.life[i];
      if (life === 0) continue;
      const age = (this.age[i] += dt);
      if (age >= life) { this.life[i] = 0; this.size[i] = 0; this.alpha[i] = 0; continue; }
      alive++;
      const i3 = i * 3, k = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= k; this.vel[i3 + 1] = this.vel[i3 + 1] * k - this.grav[i] * dt; this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i3 + 1] = 0.02; this.vel[i3 + 1] *= -0.3; this.vel[i3] *= 0.7; this.vel[i3 + 2] *= 0.7; }
      const t = age / life;
      this.alpha[i] = Math.min(1, age * 14) * (1 - t) * (1 - t * 0.3);
      this.size[i] = this.size0[i] * (1 + (this.grow[i] - 1) * t);
    }
    this.active = alive;
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
    if (this.dirty) { a.aColor.needsUpdate = a.aShape.needsUpdate = true; this.dirty = false; }
  }

  dispose() { this.geo.dispose(); this.material.dispose(); }
}

// ---------------------------------------------------------------------------
class DiceSound {
  constructor() { this.enabled = true; this.ctx = null; this.volume = 1; this._noise = null; this._master = null; }
  _ensure() {
    if (!this.enabled) return false;
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      try { this.ctx = new AC(); } catch { return false; }
      try { // bus utama: dikuatkan + compressor agar keras tapi tidak pecah
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -12; comp.knee.value = 14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
        const mg = this.ctx.createGain(); mg.gain.value = 2.4;
        mg.connect(comp); comp.connect(this.ctx.destination); this._master = mg;
      } catch { this._master = null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }
  _noiseBuf() {
    if (this._noise) return this._noise;
    const n = this.ctx.sampleRate * 0.6, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = b);
  }
  _tone(f0, f1, dur, gain, type = 'sine', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * this.volume, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._master || c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  _noiseHit(freq, q, dur, gain, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this._noiseBuf(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain * this.volume, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this._master || c.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  /** kind = die.effect.soundEffect; intensity 0..2 */
  play(kind, intensity = 1) {
    if (!this._ensure()) return;
    const i = Math.min(2, Math.max(0.5, intensity)), G = 0.85 * i;
    switch (kind) {
      case 'rattle': for (let n = 0; n < 9; n++) { this._noiseHit(1500 + Math.random() * 2200, 2.2, 0.055, 0.7 * G, 'bandpass', n * 0.085); this._tone(220 + Math.random() * 160, 120, 0.05, 0.25 * G, 'triangle', n * 0.085); } break;
      case 'wood':    this._noiseHit(500, 1.2, 0.09, G); this._tone(190, 90, 0.1, 0.5 * G, 'triangle'); break;
      case 'stone':   this._noiseHit(900, 0.9, 0.12, G); this._tone(120, 60, 0.12, 0.4 * G, 'triangle'); break;
      case 'metal':   this._tone(2200, null, 0.25, 0.25 * G, 'sine'); this._tone(3300, null, 0.18, 0.15 * G); this._noiseHit(5000, 1, 0.04, 0.5 * G, 'highpass'); break;
      case 'gold':    this._tone(1320, null, 0.5, 0.25 * G); this._tone(1980, null, 0.4, 0.15 * G, 'sine', 0.02); this._tone(2640, null, 0.3, 0.1 * G, 'sine', 0.04); break;
      case 'electric': this._noiseHit(4500, 2, 0.1, 0.8 * G, 'highpass'); this._tone(900, 200, 0.12, 0.2 * G, 'sawtooth'); break;
      case 'crystal': this._tone(1800, null, 0.6, 0.18 * G); this._tone(2700, null, 0.5, 0.14 * G, 'sine', 0.03); this._tone(3600, null, 0.4, 0.1 * G, 'sine', 0.06); break;
      case 'magic':   [660, 880, 1320].forEach((f, k) => this._tone(f, f * 1.02, 0.3, 0.16 * G, 'sine', k * 0.05)); break;
      case 'water':   [400, 600, 800].forEach((f, k) => this._tone(f, f * 1.8, 0.12, 0.2 * G, 'sine', k * 0.05)); this._noiseHit(1500, 0.7, 0.2, 0.3 * G, 'lowpass'); break;
      case 'ice':     this._noiseHit(6000, 1.5, 0.08, 0.8 * G, 'highpass'); this._tone(1500, 900, 0.2, 0.2 * G); break;
      case 'lava':    this._noiseHit(250, 0.7, 0.35, 0.9 * G, 'lowpass'); this._tone(80, 50, 0.3, 0.5 * G, 'sawtooth'); break;
      case 'void':    this._tone(320, 40, 0.7, 0.4 * G, 'triangle'); this._tone(160, 30, 0.8, 0.3 * G, 'sine'); break;
      case 'heavy':   this._tone(70, 35, 0.4, 0.8 * G, 'sine'); this._noiseHit(200, 0.8, 0.25, 0.8 * G, 'lowpass'); break;
      case 'sonic':   [0, 0.12, 0.24].forEach((d) => this._tone(150, 90, 0.2, 0.4 * G, 'sine', d)); break;
      case 'ender':   this._tone(300, 1800, 0.25, 0.2 * G, 'sine'); this._tone(1800, 200, 0.3, 0.15 * G, 'triangle', 0.15); break;
      case 'dragon':  this._tone(55, 40, 0.9, 0.7 * G, 'sawtooth'); this._noiseHit(300, 0.6, 0.6, 0.8 * G, 'lowpass'); this._tone(880, 440, 0.5, 0.15 * G, 'sine', 0.1); break;
      default:        this._noiseHit(700, 1, 0.08, G);
    }
  }
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);

// ---------------------------------------------------------------------------
export class DiceEffects {
  /**
   * @param {THREE.Scene} scene
   * @param {object} quality  salah satu QUALITY_PRESETS
   * @param {THREE.PointLight} light  satu light bersama untuk flash
   */
  constructor(scene, quality, light) {
    this.scene = scene;
    this.light = light;
    this.sound = new DiceSound();
    this.timers = [];
    this.flashI = 0; this.flashDecay = 6; this.flashBase = 0;
    this.shake = 0; this.slowmo = { scale: 1, t: 0 };
    this.auraFlare = 0;
    this.fxPos = [0, 0, 0];
    this.faceFlash = 0;
    this._tmp = new THREE.Color();
    this._colors = [];
    this.setQuality(quality);
  }

  setQuality(q) {
    this._disposePools();
    this.q = q;
    this.normal = new ParticlePool(Math.max(40, Math.floor(q.particleCap * 0.55)), false);
    this.additive = new ParticlePool(Math.max(60, q.particleCap), true);
    this.scene.add(this.normal.points, this.additive.points);

    // ring & pilar
    const rg = new THREE.RingGeometry(0.88, 1, 56); rg.rotateX(-Math.PI / 2);
    this.ringGeo = rg;
    this.rings = [];
    for (let i = 0; i < q.rings; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
      const mesh = new THREE.Mesh(rg, mat); mesh.visible = false; mesh.position.y = 0.03; mesh.renderOrder = 5;
      this.scene.add(mesh);
      this.rings.push({ mesh, t: 1, dur: 1, r0: 0.3, r1: 2, op: 1, delay: 0, active: false });
    }
    this.ringNext = 0;
    const pg = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true); pg.translate(0, 0.5, 0);
    this.pillarGeo = pg;
    const pm = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
    this.pillar = { mesh: new THREE.Mesh(pg, pm), t: 1, dur: 1, h: 3, r: 0.8, op: 1, active: false };
    this.pillar.mesh.visible = false; this.scene.add(this.pillar.mesh);

    this._buildAura();
    if (this.light) { this.light.visible = !!q.light; }
  }

  _buildAura() {
    if (this.aura) { this.scene.remove(this.aura); this.aura.geometry.dispose(); this.aura.material.dispose(); }
    const geo = new THREE.SphereGeometry(1, 24, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uI: { value: 0 } },
      vertexShader: 'varying vec3 vN;\nvarying vec3 vV;\nvoid main(){\n vec4 mv = modelViewMatrix * vec4(position,1.0);\n vN = normalize(normalMatrix * normal);\n vV = normalize(-mv.xyz);\n gl_Position = projectionMatrix * mv;\n}',
      fragmentShader: 'uniform vec3 uColor;\nuniform float uI;\nvarying vec3 vN;\nvarying vec3 vV;\nvoid main(){\n float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);\n gl_FragColor = vec4(uColor, f * uI);\n #include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.aura = new THREE.Mesh(geo, mat);
    this.aura.visible = false; this.aura.renderOrder = 6;
    this.scene.add(this.aura);
  }

  /** Dipanggil saat dadu diganti. */
  setDie(die) {
    this.die = die;
    const e = die.effect;
    this._colors = e.colors.map((c) => new THREE.Color(c));
    this.glowColor = new THREE.Color(e.glowColor);
    this.aura.material.uniforms.uColor.value.copy(this.glowColor);
    this.aura.visible = false;
    this.flashI = 0;
    if (this.light) { this.light.color.copy(this.glowColor); this.light.intensity = 0; }
  }

  setScale(renderer, camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const s = size.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.normal.uniforms.uScale.value = s;
    this.additive.uniforms.uScale.value = s;
  }

  // ---------- primitif ----------
  _col() { return this._colors[(Math.random() * this._colors.length) | 0]; }

  /**
   * @param style nama gaya (STYLES)
   * @param o {mode:'sphere'|'cone'|'ring'|'fountain'|'inward', dir, speed, spread, size, life, up, radius}
   */
  emit(style, origin, count, o = {}) {
    const st = STYLES[style] || STYLES.dust, e = this.die.effect;
    const n = Math.max(count > 0 ? 1 : 0, Math.round(count * this.q.particleMul));
    const pool = st.add ? this.additive : this.normal;
    const speed = (o.speed ?? e.particleSpeed), sz = (o.size ?? e.particleSize) * st.size, life = o.life ?? e.particleLifetime;
    const mode = o.mode || 'sphere';
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, sp = speed * (0.4 + Math.random() * 0.8);
      let x = origin[0], y = origin[1], z = origin[2], vx, vy, vz;
      if (mode === 'ring') { vx = Math.cos(a) * sp; vz = Math.sin(a) * sp; vy = (o.up ?? 0.5) * sp * Math.random(); }
      else if (mode === 'fountain') { const s = o.spread ?? 0.5; vx = Math.cos(a) * sp * s * Math.random(); vz = Math.sin(a) * sp * s * Math.random(); vy = sp * (0.8 + Math.random() * 0.6); }
      else if (mode === 'inward') { const R = o.radius ?? 1.2; x += Math.cos(a) * R; z += Math.sin(a) * R; vx = -Math.cos(a) * sp * 0.6; vz = -Math.sin(a) * sp * 0.6; vy = Math.random() * sp * 0.5; }
      else if (mode === 'cone') { const d = o.dir || [0, 1, 0], s = o.spread ?? 0.5; vx = d[0] * sp + (Math.random() - 0.5) * sp * s; vy = d[1] * sp + (Math.random() - 0.5) * sp * s; vz = d[2] * sp + (Math.random() - 0.5) * sp * s; }
      else { const u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u); vx = Math.cos(a) * r * sp; vz = Math.sin(a) * r * sp; vy = Math.abs(u) * sp * (o.up ?? 1) ; }
      const c = this._tmp.copy(this._col()); const br = 0.8 + Math.random() * 0.4; c.r *= br; c.g *= br; c.b *= br;
      pool.spawn(x, y, z, vx, vy, vz, c, sz * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.7), st, st.shape);
    }
  }

  ring(color, r0, r1, dur, op = 0.9, delay = 0) {
    const R = this.rings[this.ringNext]; this.ringNext = (this.ringNext + 1) % this.rings.length;
    R.mesh.material.color.set(color || this.glowColor); R.r0 = r0; R.r1 = r1; R.dur = dur; R.op = op; R.delay = delay; R.t = 0; R.active = true; R.mesh.visible = false; R.mesh.position.set(this.fxPos[0], 0.03, this.fxPos[2]);
  }
  pillarFx(color, h, r, dur, op = 0.7) {
    const P = this.pillar; P.mesh.material.color.set(color || this.glowColor); P.h = h; P.r = r; P.dur = dur; P.op = op; P.t = 0; P.active = true; P.mesh.visible = true;
  }
  flash(intensity, decay = 6) { if (this.q.light) { this.flashI = intensity; this.flashDecay = decay; } this.auraFlare = Math.min(2, this.auraFlare + intensity * 0.25); }
  shakeCam(a) { this.shake = Math.max(this.shake, a); }
  slow(scale, dur) { this.slowmo.scale = scale; this.slowmo.t = dur; }
  later(delay, fn) { this.timers.push({ t: delay, fn }); }
  setLightAt(p) { if (this.light) this.light.position.set(p[0], p[1] + 1.2, p[2] + 0.4); }

  // ---------- hooks dari DiceAnimator ----------
  onRollStart(pos) {
    const e = this.die.effect, c = Math.round(e.particleCount * 0.25);
    this.emit(e.effectTier >= 4 ? STYLE_OF(e) : 'dust', pos, c, { mode: 'ring', speed: 1.4, up: 0.8, life: 0.5 });
    this.sound.play(e.soundEffect, 0.35);
  }

  onRollFrame(dt, pos, speed) {
    const e = this.die.effect;
    if (!e.trailEnabled || !this.q.trail || e.rollEffect === 'none') return;
    this._trailAcc = (this._trailAcc || 0) + dt * Math.min(1, speed / 6) * (14 + e.effectTier * 5) * this.q.particleMul;
    const style = ROLL_STYLE[e.rollEffect] || e.particleType;
    while (this._trailAcc >= 1) {
      this._trailAcc -= 1;
      this.emit(style, [pos[0] + (Math.random() - 0.5) * 0.4, pos[1] + (Math.random() - 0.5) * 0.4, pos[2] + (Math.random() - 0.5) * 0.4], 1, { mode: 'sphere', speed: 0.5, up: 0.4, life: 0.5, size: e.particleSize * 0.8 });
    }
  }

  /** Setiap pantulan. index 0 = benturan pertama => resep landing penuh. */
  onImpact(point, speed, index) {
    const e = this.die.effect, p = [point[0], 0.05, point[2]];
    this.fxPos = p;
    const k = Math.min(1.6, speed / 9) * e.impactIntensity;
    this.sound.play(e.soundEffect, Math.min(2, k));
    this.auraFlare = Math.min(2, this.auraFlare + 0.3 * k);
    if (index === 0) {
      (RECIPES[e.landingEffect] || RECIPES.puff)(this, p, e, k);
      this.shakeCam(0.012 * e.impactIntensity);
    } else {
      this.emit(e.effectTier <= 2 ? e.particleType : 'dust', p, Math.round(e.particleCount * 0.22 * Math.min(1, k)), { mode: 'ring', speed: e.particleSpeed * 0.5, up: 0.6, life: e.particleLifetime * 0.6, size: e.particleSize * 0.8 });
    }
  }

  /** Dadu berhenti. Efek kecil saja agar angka terbaca jelas. */
  onLand(pos) {
    const e = this.die.effect, p = [pos[0], 0.05, pos[2]];
    this.fxPos = p;
    this.emit('dust', p, 8, { mode: 'ring', speed: 0.8, up: 0.2, life: 0.5, size: e.particleSize });
    this.auraFlare = Math.min(2, this.auraFlare + 0.6);
    if (e.effectTier >= 6) this.ring(this.glowColor, 0.6, 2.2, 0.9, 0.5);
  }

  onResult(pos) {
    const e = this.die.effect, p = [pos[0], 0.05, pos[2]];
    this.fxPos = p;
    this.faceFlash = 1;
    const r = e.resultEffect;
    if (r === 'sparkle' || r === 'pulse' || r === 'burst' || r === 'halo') this.emit(STYLE_OF(e), [p[0], 0.15, p[2]], Math.round(e.particleCount * 0.3), { mode: 'ring', speed: 1.4, up: 1.2, life: e.particleLifetime });
    if (r === 'pulse' || r === 'burst' || r === 'halo') this.ring(this.glowColor, 0.7, r === 'pulse' ? 1.8 : 2.6, 0.8, 0.7);
    if (r === 'burst' || r === 'halo') { this.ring(this.glowColor, 0.5, 3.2, 1.1, 0.5, 0.1); this.flash(1.2 * e.glowIntensity, 3); }
    if (r === 'halo') { this.pillarPos = p; this.pillarFx(this.glowColor, 2.2, 0.7, 1.1, 0.35); this.later(0.15, () => this.emit('flame', [p[0], 0.1, p[2]], 40, { mode: 'fountain', speed: 2.4, spread: 0.4, life: 1 })); }
    this.sound.play(e.soundEffect, 0.4 + e.effectTier * 0.12);
  }

  // ---------- per frame ----------
  update(dt, dieObj) {
    this.normal.update(dt); this.additive.update(dt);

    for (let i = this.timers.length - 1; i >= 0; i--) { const T = this.timers[i]; T.t -= dt; if (T.t <= 0) { this.timers.splice(i, 1); T.fn(); } }
    if (this.slowmo.t > 0) { this.slowmo.t -= dt; if (this.slowmo.t <= 0) this.slowmo.scale = 1; }

    for (const R of this.rings) {
      if (!R.active) continue;
      if (R.delay > 0) { R.delay -= dt; continue; }
      R.t += dt / R.dur;
      if (R.t >= 1) { R.active = false; R.mesh.visible = false; continue; }
      const s = R.r0 + (R.r1 - R.r0) * easeOut(R.t);
      R.mesh.visible = true; R.mesh.scale.set(s, 1, s); R.mesh.material.opacity = R.op * Math.pow(1 - R.t, 1.6);
    }
    const P = this.pillar;
    if (P.active) {
      P.t += dt / P.dur;
      if (P.t >= 1) { P.active = false; P.mesh.visible = false; }
      else { const k = easeOut(P.t); P.mesh.scale.set(P.r * (1 + k * 0.6), P.h * (0.4 + k * 0.6), P.r * (1 + k * 0.6)); P.mesh.position.set(this.pillarPos?.[0] ?? 0, 0, this.pillarPos?.[2] ?? 0); P.mesh.material.opacity = P.op * (1 - P.t); }
    }

    // flash light
    if (this.light && this.q.light) { this.flashI = Math.max(0, this.flashI - this.flashDecay * dt * Math.max(0.3, this.flashI)); this.light.intensity = this.flashI * 14 + (dieObj?.glow || 0) * 3; }

    // aura (hanya tepi => angka tetap terlihat)
    const e = this.die.effect;
    const on = e.auraEnabled && this.q.aura && dieObj;
    this.aura.visible = !!on;
    if (on) {
      this.auraFlare = Math.max(0, this.auraFlare - dt * 1.4);
      const t = performance.now() * 0.001;
      const base = 0.22 + 0.06 * Math.sin(t * 2.2);
      this.aura.material.uniforms.uI.value = Math.min(1.6, (base + this.auraFlare * 0.5) * (0.5 + e.glowIntensity * 0.5));
      this.aura.position.copy(dieObj.position);
      this.aura.scale.setScalar(0.92 * (e.effectTier >= 7 ? 1.18 : 1) * (dieObj.scaleMul || 1) + this.auraFlare * 0.05);
    }
    this.faceFlash = Math.max(0, this.faceFlash - dt * 1.1);
    this.shake = Math.max(0, this.shake - dt * 0.06);
  }

  /** Efek ambient saat idle (tier yang mendukung & kualitas medium ke atas). */
  idle(dt, pos) {
    const e = this.die.effect, rec = IDLE[e.idleEffect];
    if (!rec || this.q.ambientMul === 0) return;
    this._idleAcc = (this._idleAcc || 0) + dt * rec.rate * this.q.ambientMul;
    while (this._idleAcc >= 1) {
      this._idleAcc -= 1;
      const a = Math.random() * 6.28, R = 0.62 + Math.random() * 0.25;
      let o = [pos[0] + Math.cos(a) * R, pos[1] + (Math.random() - 0.5) * 0.8, pos[2] + Math.sin(a) * R], opt = { life: 1.1, speed: 0.25 };
      if (rec.mode === 'rise') opt = { mode: 'fountain', speed: 0.7, spread: 0.2, life: 1.3, size: e.particleSize * 0.8 };
      else if (rec.mode === 'low') { o[1] = 0.1; opt = { mode: 'ring', speed: 0.3, up: 0.3, life: 1.6 }; }
      else if (rec.mode === 'orbit') opt = { mode: 'sphere', speed: 0.35, life: 1.2 };
      this.emit(rec.style, o, 1, { size: e.particleSize * 0.8, ...opt });
    }
  }

  dispose() {
    this._disposePools();
    this.ringGeo?.dispose(); this.pillarGeo?.dispose(); this.pillar?.mesh.material.dispose();
    this.rings?.forEach((r) => r.mesh.material.dispose());
    if (this.aura) { this.scene.remove(this.aura); this.aura.geometry.dispose(); this.aura.material.dispose(); }
    this.sound.ctx?.close?.();
  }
  _disposePools() {
    for (const p of [this.normal, this.additive]) if (p) { this.scene.remove(p.points); p.dispose(); }
    this.rings?.forEach((r) => { this.scene.remove(r.mesh); r.mesh.material.dispose(); });
    this.ringGeo?.dispose();
    if (this.pillar) { this.scene.remove(this.pillar.mesh); this.pillar.mesh.material.dispose(); this.pillarGeo.dispose(); }
  }
}

const STYLE_OF = (e) => e.particleType;

// ---------------------------------------------------------------------------
// Resep landing — komposisi dari primitif di atas. k = intensitas benturan.
// ---------------------------------------------------------------------------
const N = (e, m = 1) => Math.round(e.particleCount * m);
const RECIPES = {
  puff:        (fx, p, e) => { fx.emit('dust', p, N(e), { mode: 'ring', speed: e.particleSpeed, up: 0.5 }); },
  debrisBurst: (fx, p, e) => { fx.emit('debris', p, N(e), { mode: 'fountain', speed: e.particleSpeed * 1.8, spread: 0.9 }); fx.emit('dust', p, N(e, 0.4), { mode: 'ring', speed: 1, up: 0.3 }); },
  sparkBurst:  (fx, p, e) => { fx.emit(e.particleType, p, N(e), { mode: 'fountain', speed: e.particleSpeed * 2, spread: 1.1 }); fx.flash(0.8 * (e.glowIntensity + 0.3), 9); },
  glintBurst:  (fx, p, e) => { fx.emit('glint', p, N(e), { mode: 'sphere', speed: e.particleSpeed, up: 1 }); fx.ring(fx.glowColor, 0.4, 1.7, 0.6, 0.7); fx.flash(1.4, 7); },
  shatter:     (fx, p, e) => { fx.emit('shard', p, N(e), { mode: 'fountain', speed: e.particleSpeed * 2.2, spread: 1.0 }); fx.emit('glint', p, N(e, 0.5), { mode: 'sphere', speed: 2 }); fx.ring(fx.glowColor, 0.4, 2, 0.6, 0.8); fx.flash(1.6, 6); },
  pulseRing:   (fx, p, e) => { fx.ring(fx.glowColor, 0.4, 2.3, 0.8, 0.9); fx.emit(e.particleType, p, N(e), { mode: 'ring', speed: e.particleSpeed, up: 0.4 }); fx.flash(1.0, 7); },
  shockwave:   (fx, p, e) => { fx.ring(fx.glowColor, 0.3, 3.2, 0.7, 0.9); fx.ring('#ffffff', 0.2, 2.2, 0.5, 0.5, 0.04); fx.emit(e.particleType, p, N(e), { mode: 'ring', speed: e.particleSpeed * 1.5, up: 0.6 }); fx.flash(1.8, 6); },
  resonance:   (fx, p, e) => { [0, 0.18, 0.36].forEach((d, i) => fx.ring(fx.glowColor, 0.4, 1.8 + i * 0.5, 0.9, 0.7, d)); fx.emit('shard', p, N(e), { mode: 'fountain', speed: e.particleSpeed * 1.6, spread: 0.8 }); fx.flash(1.4, 6); },
  electricPulse: (fx, p, e) => { fx.ring(fx.glowColor, 0.3, 2.6, 0.55, 0.9); fx.emit('bolt', p, N(e), { mode: 'sphere', speed: e.particleSpeed * 1.8, up: 1 }); [0.12, 0.24].forEach((d) => fx.later(d, () => { fx.ring(fx.glowColor, 0.3, 2 + d * 3, 0.45, 0.6); fx.flash(1.2, 12); })); fx.flash(2, 10); },
  cracks:      (fx, p, e) => { fx.ring(fx.glowColor, 0.2, 2.4, 0.9, 0.8); fx.ring('#2a0a60', 0.3, 1.6, 1.1, 0.7, 0.08); fx.emit('smoke', p, N(e, 0.6), { mode: 'ring', speed: 0.8, up: 0.8, life: 1.4, size: e.particleSize * 1.4 }); fx.emit('bolt', p, N(e, 0.5), { mode: 'sphere', speed: e.particleSpeed * 1.5 }); fx.flash(1.0, 6); },
  lavaSplash:  (fx, p, e) => { fx.emit('lava', p, N(e, 0.7), { mode: 'fountain', speed: e.particleSpeed * 2.4, spread: 1.0 }); fx.emit('ember', p, N(e, 0.5), { mode: 'sphere', speed: 2, up: 1.2, life: 1.4 }); fx.ring('#ff5a10', 0.3, 2.4, 0.7, 0.9); fx.flash(2.4, 5); },
  iceBlast:    (fx, p, e) => { fx.emit('frost', p, N(e, 0.7), { mode: 'sphere', speed: e.particleSpeed * 1.6, up: 1.2 }); fx.emit('smoke', p, N(e, 0.4), { mode: 'ring', speed: 1.1, up: 0.3, life: 1.6, size: e.particleSize * 1.5 }); fx.ring('#bff0ff', 0.3, 2.8, 0.7, 0.9); fx.ring('#ffffff', 0.2, 1.8, 0.45, 0.6, 0.05); fx.flash(1.8, 6); },
  splash:      (fx, p, e) => { fx.emit('bubble', p, N(e, 0.6), { mode: 'fountain', speed: e.particleSpeed * 1.4, spread: 0.7 }); fx.emit('glint', p, N(e, 0.3), { mode: 'sphere', speed: 2 }); [0, 0.15].forEach((d, i) => fx.ring('#7affe8', 0.3, 2.2 + i * 0.6, 0.8, 0.7, d)); fx.flash(1.2, 6); },
  radiant:     (fx, p, e) => { fx.emit('glint', p, N(e, 0.8), { mode: 'sphere', speed: e.particleSpeed * 1.5, up: 1.2 }); fx.ring('#ffffff', 0.3, 2.8, 0.7, 0.9); fx.ring(fx.glowColor, 0.2, 2, 0.5, 0.7, 0.05); fx.flash(2.6, 5); },
  vortexPortal:(fx, p, e) => { fx.ring('#9a3cff', 1.6, 0.2, 1.1, 0.8); fx.ring('#e0b0ff', 1.0, 1.8, 1.0, 0.7, 0.1); fx.emit('void', p, N(e, 0.8), { mode: 'inward', radius: 1.3, speed: e.particleSpeed * 0.9, life: 0.9 }); fx.emit('void', p, N(e, 0.3), { mode: 'fountain', speed: 2, spread: 0.4, life: 1.1 }); fx.pillarPos = p; fx.pillarFx('#9a3cff', 1.6, 0.5, 0.9, 0.35); fx.flash(2, 5); },
  heavyImpact: (fx, p, e) => { fx.emit('ember', p, N(e, 0.7), { mode: 'fountain', speed: e.particleSpeed * 1.2, spread: 0.9, life: 1.2 }); fx.emit('smoke', p, N(e, 0.3), { mode: 'ring', speed: 1.2, up: 0.2, life: 1.2, size: e.particleSize * 1.6 }); fx.ring('#c8803a', 0.3, 3, 0.55, 0.8); fx.ring('#2a1a10', 0.3, 2.2, 0.8, 0.6, 0.05); fx.shakeCam(0.05); fx.flash(1.2, 8); fx.slow(0.55, 0.12); },
  sonic:       (fx, p, e) => { [0, 0.16, 0.32].forEach((d, i) => fx.ring('#22d3ee', 0.3, 2.4 + i * 0.7, 0.8, 0.8, d)); fx.emit('energy', p, N(e, 0.8), { mode: 'ring', speed: e.particleSpeed * 1.2, up: 0.4 }); fx.flash(1.6, 6); },
  teleport:    (fx, p, e) => { fx.pillarPos = p; fx.pillarFx('#d040ff', 3.2, 0.55, 0.8, 0.5); fx.emit('star', p, N(e, 0.9), { mode: 'fountain', speed: e.particleSpeed * 1.6, spread: 0.5, life: 1.3 }); fx.ring('#ff4de8', 0.2, 1.8, 0.7, 0.9); fx.ring('#a030ff', 0.2, 2.6, 0.9, 0.6, 0.1); fx.flash(2.2, 5); },
  dragonExplosion: (fx, p, e) => {
    fx.pillarPos = p; fx.pillarFx('#ff2a3a', 3.6, 0.9, 1.0, 0.55);
    fx.emit('flame', p, N(e, 0.5), { mode: 'fountain', speed: e.particleSpeed * 1.8, spread: 0.9, life: 1.1, size: e.particleSize * 1.3 });
    fx.emit('ember', p, N(e, 0.4), { mode: 'sphere', speed: e.particleSpeed * 1.6, up: 1.2, life: 1.6 });
    fx.emit('void', p, N(e, 0.2), { mode: 'ring', speed: 2.4, up: 0.5, life: 1.2 });
    [0, 0.14, 0.3].forEach((d, i) => fx.ring(i === 1 ? '#a020ff' : '#ff2a3a', 0.3, 3.4 + i * 0.9, 0.9, 0.9, d));
    fx.later(0.1, () => fx.emit('flame', p, N(e, 0.3), { mode: 'ring', speed: e.particleSpeed * 1.4, up: 0.8, life: 1 }));
    fx.flash(4, 4); fx.shakeCam(0.07); fx.slow(0.4, 0.22);
  },
};
export const LANDING_RECIPES = Object.keys(RECIPES);
export const IDLE_RECIPES = Object.keys(IDLE);
