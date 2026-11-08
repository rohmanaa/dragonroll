/**
 * DiceRenderer.js — scene Three.js, satu geometri D6 untuk seluruh koleksi, integrasi API publik.
 *
 * Satu RoundedBoxGeometry dipakai bersama oleh 20 dadu; identitas dadu hanya dari material + efek.
 */
import * as THREE from '../vendor/three.r170.module.min.js';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { DICE_CATALOG, QUALITY_PRESETS, getDice } from './DiceCatalog.js';
import { MaterialCache } from './DiceMaterials.js';
import { DiceEffects } from './DiceEffects.js';
import { DiceAnimator } from './DiceAnimation.js';

/** Pilih kualitas awal berdasarkan perangkat (Android/CPU lemah => lebih rendah). */
export function detectQuality() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || '');
  const cores = nav.hardwareConcurrency || 4, mem = nav.deviceMemory || 4;
  if (mem <= 2 || cores <= 4 && mobile) return 'low';
  if (mobile || cores <= 4) return 'medium';
  return 'high';
}

export class DiceRenderer {
  /**
   * @param {HTMLElement} container  elemen tempat canvas ditambahkan
   * @param {{diceId?: string, quality?: 'auto'|'low'|'medium'|'high', rng?: Function, onResult?: Function, sound?: boolean}} opts
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.qName = !opts.quality || opts.quality === 'auto' ? detectQuality() : opts.quality;
    this.q = QUALITY_PRESETS[this.qName];
    this._pending = {};
    this.opt = { transparent: !!opts.transparent, arena: opts.arena !== false, bounds: opts.bounds || null, idleZ: opts.idleZ, camScale: opts.camScale || 1, drop: !!opts.drop, lookY: opts.lookY ?? 0.2 };

    const renderer = new THREE.WebGLRenderer({ antialias: this.q.antialias, alpha: this.opt.transparent, powerPreference: 'high-performance' });
    if (this.opt.transparent) renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.q.pixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    if (!this.opt.transparent) { scene.background = new THREE.Color('#0b0c11'); scene.fog = new THREE.Fog('#0b0c11', 16, 36); }
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);

    // Environment map untuk pantulan (dibuat sekali, lalu sumbernya dibuang)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.envTex = pmrem.fromScene(room, 0.04).texture;
    scene.environment = this.envTex;
    scene.environmentIntensity = 0.85;
    room.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    pmrem.dispose();

    // Pencahayaan: hemisphere + 1 directional (bayangan lembut) + 1 PointLight bersama untuk flash/glow
    scene.add(new THREE.HemisphereLight('#c8d4ff', '#14101c', 0.45));
    const key = new THREE.DirectionalLight('#fff3e0', 2.4);
    key.position.set(3.5, 8, 4.5);
    key.castShadow = true;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 1; key.shadow.camera.far = 22;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    scene.add(key);
    this.key = key;
    this.point = new THREE.PointLight('#ffffff', 0, 9, 2);
    scene.add(this.point);

    this._buildArena();

    // Satu geometri untuk semua dadu
    this.geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.13);
    this.mesh = new THREE.Mesh(this.geometry, []);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.materials = new MaterialCache(3);
    this.effects = new DiceEffects(scene, this.q, this.point);
    this.effects.sound.enabled = opts.sound !== false;
    this.animator = new DiceAnimator({ mesh: this.mesh, effects: this.effects, rng: opts.rng, bounds: this.opt.bounds, idleZ: this.opt.idleZ, drop: this.opt.drop });
    this.animator.onResult = (r) => opts.onResult?.(r);

    this._applyShadowSize();
    this.resize();
    this.equip(opts.diceId || DICE_CATALOG[0].id);

    this._onResize = () => this.resize();
    this._onVis = () => (document.hidden ? this.stop() : this.start());
    globalThis.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVis);
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(container); }
    this.start();
  }

  _buildArena() {
    if (!this.opt.arena) { /* tanpa pad/rel: hanya bayangan lembut di lantai transparan */
      const m = new THREE.ShadowMaterial({ opacity: 0.32 });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), m);
      f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
      this.arena = [f]; this.scene.add(f); this._arenaMats = [m];
      return;
    }
    const floorMat = new THREE.MeshStandardMaterial({ color: '#171a22', roughness: 0.82, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const padMat = new THREE.MeshStandardMaterial({ color: '#20242f', roughness: 0.7, metalness: 0.08 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 5.8), padMat);
    pad.position.y = -0.03; pad.receiveShadow = true;
    const railMat = new THREE.MeshStandardMaterial({ color: '#2b2f3c', roughness: 0.6, metalness: 0.2 });
    const rails = [[0, -2.95, 7.6, 0.3], [0, 2.95, 7.6, 0.3], [-3.65, 0, 0.3, 6.2], [3.65, 0, 0.3, 6.2]].map(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), railMat); m.position.set(x, 0.12, z); m.castShadow = true; m.receiveShadow = true; return m;
    });
    this.arena = [floor, pad, ...rails];
    this.arena.forEach((m) => this.scene.add(m));
    this._arenaMats = [floorMat, padMat, railMat];
  }

  _applyShadowSize() {
    const n = this.q.shadowMap;
    this.key.shadow.mapSize.set(n, n);
    if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const f = this.camera.aspect < 1.25 ? Math.min(1.9, 1.25 / this.camera.aspect) : 1; // layar potret: mundur agar arena muat
    const cs = this.opt.camScale;
    this.camBase = new THREE.Vector3(0, 7.4 * f * cs, 8.6 * f * cs);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, this.opt.lookY, -0.2);
    this.camera.updateProjectionMatrix();
    this.effects?.setScale(this.renderer, this.camera);
  }

  /** Pasang dadu (dipanggil dari sistem equipped dice Dragon Roll). */
  equip(id) {
    const die = getDice(id);
    if (!die) return false;
    if (this.animator.busy) { this._pending.dice = id; return true; }
    this.die = die;
    const mats = this.materials.get(die, this.q);
    this.animator.setDie(die, mats);
    this.effects.setScale(this.renderer, this.camera);
    return true;
  }

  /** Lempar dadu. forcedValue (1–6) = hasil dari RNG game yang sudah ada; kosong = hasil murni fisika. */
  roll(forcedValue = null) { return this.animator.roll(forcedValue); }
  toIdle() { this.animator.toIdle(); }

  setQuality(name) {
    if (!QUALITY_PRESETS[name]) return;
    if (this.animator.busy) { this._pending.quality = name; return; }
    this.qName = name; this.q = QUALITY_PRESETS[name];
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.q.pixelRatio));
    this._applyShadowSize();
    this.effects.setQuality(this.q);
    this.materials.clear();
    this.resize();
    this.equip(this.die.id);
  }

  setSound(on) { this.effects.sound.enabled = !!on; }
  setVolume(v) { this.effects.sound.volume = Math.max(0, Math.min(1.5, +v || 0)); }

  start() {
    if (this._running) return;
    this._running = true; this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }
  stop() { this._running = false; this.renderer.setAnimationLoop(null); }

  _frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000); // batasi lonjakan saat tab lambat
    this._last = now;

    this.animator.update(dt);
    this.effects.update(dt * this.effects.slowmo.scale, this.animator.view);

    // camera shake ringan (benturan berat / ledakan)
    const s = this.effects.shake;
    this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * s * 6, this.camBase.y + (Math.random() - 0.5) * s * 6, this.camBase.z);
    this.renderer.render(this.scene, this.camera);

    if (!this.animator.busy) {
      if (this._pending.quality) { const q = this._pending.quality; this._pending.quality = null; this.setQuality(q); }
      if (this._pending.dice) { const d = this._pending.dice; this._pending.dice = null; this.equip(d); }
    }
  }

  dispose() {
    this.stop();
    globalThis.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    this._ro?.disconnect();
    this.effects.dispose();
    this.materials.clear();
    this.geometry.dispose();
    this._arenaMats.forEach((m) => m.dispose());
    this.arena.forEach((m) => m.geometry.dispose());
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
