/**
 * PowerRenderer.js — orkestrator: membaca PowerCatalog, membangun scene, dan menjalankan SATU pipeline
 * (geometry -> material -> aura -> animasi -> partikel -> efek -> lighting) untuk semua 15 item.
 *
 * const pr = new PowerRenderer(containerEl, { quality: 'medium' });
 * pr.show('diamond_sword'); pr.activate(); pr.disappear(); pr.setQuality('low');
 */
import * as THREE from 'three';
import * as Catalog from './PowerCatalog.js';
import { QUALITY, TIER, RARITY, COLLECTIONS, detectQuality } from './PowerConfig.js';
import { buildModel } from './PowerGeometry.js';
import { createMaterialSet } from './PowerMaterials.js';
import { PowerAura } from './PowerAura.js';
import { PowerAnimator } from './PowerAnimation.js';
import { PowerParticles } from './PowerParticles.js';
import { PowerEffects } from './PowerEffects.js';
import { PowerLighting } from './PowerLighting.js';
import { PowerSound } from './PowerSound.js';

/** Ambil daftar item dari PowerCatalog.js (mendukung beberapa nama export / array / objek). */
function readCatalog() {
  const C = Catalog;
  let list = C.POWER_ITEMS || C.POWERS || C.POWER_CATALOG || C.CATALOG || C.ITEMS || C.ITEM_LIST || C.default;
  if (!list) list = Object.values(C).find((v) => (Array.isArray(v) && v[0]?.model) || (v && typeof v === 'object' && Object.values(v)[0]?.model));
  if (list && !Array.isArray(list)) list = list.items || list.list || Object.values(list);
  if (!Array.isArray(list)) throw new Error('PowerCatalog.js: daftar item tidak ditemukan — sesuaikan readCatalog() di PowerRenderer.js');
  return list;
}

/** Gabungkan default Effect Tier dengan override item (idempotent). */
export function resolveItem(raw) {
  const tier = raw.tier ?? raw.effectTier ?? RARITY[raw.rarity]?.tier ?? 1;
  const T = TIER[tier] || TIER[1];
  const colors = raw.colors || { primary: '#ffffff', secondary: '#aaaaaa' };
  const particles = { ...T.particle, ...(raw.particles || {}) };
  particles.colors = particles.colors || [colors.primary];
  particles.particleType = particles.particleType || 'sparkle';
  return {
    ...raw, tier, T, colors, size: raw.size || 2,
    aura: { ...T.aura, ...(raw.aura || {}) }, particles,
    mat: raw.mat || { main: { c: colors.primary, r: 0.5 } },
    ambient: raw.ambient || { type: particles.particleType, rate: 3, mode: 'around' },
    idle: raw.idle || {}, activation: raw.activation || {}, trail: raw.trail || null, special: raw.special || null,
  };
}

export class PowerRenderer {
  constructor(container, opts = {}) {
    this.container = container;
    this.items = readCatalog().map(resolveItem);
    this.qName = opts.quality || detectQuality();
    this.q = QUALITY[this.qName];
    this.baseY = 1.55;
    this.target = new THREE.Vector3(0, 1.5, 0);
    this.orbit = { az: 0, pol: 1.38, dist: 7.6 };
    this.time = 0; this._raf = 0; this._last = 0; this.current = null;

    this.soundOn = !!opts.sound;             /* suara sintetis per fase (spawn/activate/hit/disappear); default mati, halaman mengikuti Pengaturan Suara */
    this.transparent = !!opts.transparent;   /* Tahap Power-3D: latar transparan agar menyatu dengan halaman */
    this.renderer = new THREE.WebGLRenderer({ antialias: this.q.antialias, powerPreference: 'high-performance', alpha: this.transparent });
    if (this.transparent) this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const cv = this.renderer.domElement;
    cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(cv);

    this.scene = new THREE.Scene();
    this.scene.background = this.transparent ? null : new THREE.Color('#0b0d16');
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);

    this._initSystems();
    this._bindInput();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this._vis = () => (document.hidden ? this._pause() : this._resume());
    document.addEventListener('visibilitychange', this._vis);
    this.resize();
    this._updateCamera();
  }

  _initSystems() {
    this.lighting = new PowerLighting(this.renderer, this.scene, this.q);
    this.particles = new PowerParticles(this.scene, this.q);
    this.effects = new PowerEffects(this.scene, this.particles, this.lighting, this.q);
  }
  _disposeSystems() { this.effects?.dispose(); this.particles?.dispose(); this.lighting?.dispose(); }

  // ------------------------------------------------------------------ API publik
  list() { return this.items.map((i) => ({ id: i.id, name: i.name, collection: i.collection, rarity: i.rarity, tier: i.tier })); }
  get collections() { return COLLECTIONS; }

  show(idOrIndex) {
    const item = typeof idOrIndex === 'number' ? this.items[idOrIndex] : this.items.find((i) => i.id === idOrIndex);
    if (!item) return false;
    this._clearItem();
    this.current = item;
    this.mats = createMaterialSet(item, this.q);
    this.model = buildModel(item, this.mats.slots);
    this.holder.rotation.set(0, 0, 0); this.holder.scale.setScalar(1); this.holder.position.set(0, this.baseY, 0);
    this.holder.add(this.model);
    this.aura = new PowerAura(item, this.model, this.q);
    this.holder.add(this.aura.halo);
    this.animator = new PowerAnimator(item, this.holder, this.baseY);
    this.lighting.setItem(item);
    this.effects.bind(item, this.holder, this.model);
    const a = this.animator;
    a.on.spawn = () => { this.effects.onSpawn(); this._snd('spawn'); };
    a.on.activate = () => { this.effects.onActivate(a.act); this._snd('activate'); };
    a.on.hit = () => { this.effects.onHit(); this._snd('hit'); };
    a.on.disappear = () => { this.effects.onDisappear(); this._snd('disappear'); };
    a.spawn();
    return true;
  }
  _snd(phase) { if (this.soundOn && this.current) PowerSound.play(this.current.id, { phase, tier: this.current.tier }); }
  setSound(on) { this.soundOn = !!on; if (on) PowerSound.ensure(); }
  next(d = 1) { const i = this.items.indexOf(this.current); this.show((i + d + this.items.length) % this.items.length); }
  activate() { return this.animator?.activate() || false; }
  disappear() { this.animator?.disappear(); }
  respawn() { if (this.current) this.show(this.current.id); }

  /** Ubah kualitas efek: 'low' | 'medium' | 'high' (antialias hanya berubah saat renderer dibuat ulang). */
  setQuality(name) {
    if (!QUALITY[name] || name === this.qName) return;
    const id = this.current?.id;
    this._clearItem();
    this._disposeSystems();
    this.qName = name; this.q = QUALITY[name];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this._initSystems(); this.resize();
    if (id) this.show(id);
  }
  setAuraProps(p) { this.aura?.setProps(p); }
  setParticleProps(p) { if (this.current) Object.assign(this.current.particles, p); }
  get stats() { return { particles: this.particles.alive, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, quality: this.qName }; }

  start() { if (this._raf) return; this._last = performance.now(); this._raf = requestAnimationFrame((t) => this._frame(t)); return this; }
  stop() { cancelAnimationFrame(this._raf); this._raf = 0; }
  _pause() { this._wasRunning = !!this._raf; this.stop(); }
  _resume() { if (this._wasRunning) this.start(); }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // layar potret (HP): jauhkan kamera agar item tidak terpotong
    this.aspectDist = w / h < 1 ? 1 + (1 - w / h) * 0.9 : 1;
    this.camera.updateProjectionMatrix();
    this.particles?.setScale(this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360)));
  }

  dispose() {
    this.stop();
    this._ro.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
    this._unbindInput();
    this._clearItem();
    this._disposeSystems();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ------------------------------------------------------------------ internal
  _clearItem() {
    if (!this.current) return;
    this.effects.unbind();
    this.aura?.dispose(); this.aura = null;
    if (this.model) {
      this.holder.remove(this.model);
      this.model.traverse((o) => o.geometry?.dispose?.());
    }
    this.mats?.dispose(); this.mats = null; this.model = null; this.animator = null;
    this.current = null;
  }

  _frame(now) {
    this._raf = requestAnimationFrame((t) => this._frame(t));
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now; this.time += dt;
    const t = this.time;
    if (this.animator) {
      const f = this.animator.update(dt);
      this.holder.updateMatrixWorld(true);
      this.model.userData.tick?.(t, dt, f);
      this.mats.setGlow(1 + f.glow * 1.2 + f.pulse * 0.35);
      this.aura.update(t, dt, f);
      this.effects.update(dt, t, f, this.camera);
      this.lighting.setGlow((this.current.T.glow * 0.5 + f.glow * 0.8) * f.fade);
    }
    this.lighting.update(dt);
    this.particles.update(dt);
    this._updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  _updateCamera() {
    const o = this.orbit, d = o.dist * (this.aspectDist || 1), s = this.effects?.shake || 0;
    this.camera.position.set(
      this.target.x + d * Math.sin(o.pol) * Math.sin(o.az) + (Math.random() - 0.5) * s,
      this.target.y + d * Math.cos(o.pol) + (Math.random() - 0.5) * s,
      this.target.z + d * Math.sin(o.pol) * Math.cos(o.az),
    );
    this.camera.lookAt(this.target);
  }

  // drag = orbit kamera, scroll / pinch = zoom
  _bindInput() {
    const cv = this.renderer.domElement, ptr = new Map();
    let pinch = 0;
    this._h = {
      down: (e) => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, e); },
      move: (e) => {
        const prev = ptr.get(e.pointerId); if (!prev) return;
        ptr.set(e.pointerId, e);
        if (ptr.size === 2) {
          const [a, b] = [...ptr.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          if (pinch) this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (pinch / d), 4.5, 12);
          pinch = d; return;
        }
        this.orbit.az -= (e.clientX - prev.clientX) * 0.008;
        this.orbit.pol = THREE.MathUtils.clamp(this.orbit.pol - (e.clientY - prev.clientY) * 0.006, 0.6, 1.6);
      },
      up: (e) => { ptr.delete(e.pointerId); pinch = 0; },
      wheel: (e) => { e.preventDefault(); this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (1 + e.deltaY * 0.001), 4.5, 12); },
    };
    cv.addEventListener('pointerdown', this._h.down); cv.addEventListener('pointermove', this._h.move);
    cv.addEventListener('pointerup', this._h.up); cv.addEventListener('pointercancel', this._h.up);
    cv.addEventListener('wheel', this._h.wheel, { passive: false });
  }
  _unbindInput() {
    const cv = this.renderer.domElement, h = this._h;
    cv.removeEventListener('pointerdown', h.down); cv.removeEventListener('pointermove', h.move);
    cv.removeEventListener('pointerup', h.up); cv.removeEventListener('pointercancel', h.up);
    cv.removeEventListener('wheel', h.wheel);
  }
}
