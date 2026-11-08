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
    this.pixelScale = Math.max(1, Math.min(2, +opts.pixelScale || 1)); // kompensasi CSS zoom induk agar canvas tetap tajam
    this.dieScale = Math.max(0.5, Math.min(3, +opts.dieScale || 1));
    this.opt = { pad: !!opts.pad, transparent: !!opts.transparent, arena: opts.arena !== false, bounds: opts.bounds || null, idleZ: opts.idleZ, camScale: opts.camScale || 1, drop: !!opts.drop, lookY: opts.lookY ?? 0.2 };

    const renderer = new THREE.WebGLRenderer({ antialias: this.q.antialias, alpha: this.opt.transparent, powerPreference: 'high-performance' });
    if (this.opt.transparent) renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(this._pr());
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
    if (this.opt.pad) this._buildPad();

    // Satu geometri untuk semua dadu
    this.geometry = new RoundedBoxGeometry(this.dieScale, this.dieScale, this.dieScale, 4, 0.13 * this.dieScale);
    this.mesh = new THREE.Mesh(this.geometry, []);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.materials = new MaterialCache(3);
    this.effects = new DiceEffects(scene, this.q, this.point);
    this.effects.sound.enabled = opts.sound !== false;
    this.animator = new DiceAnimator({ mesh: this.mesh, effects: this.effects, rng: opts.rng, bounds: this.opt.bounds, idleZ: this.opt.idleZ, drop: this.opt.drop, dieScale: this.dieScale, speed: opts.speed });
    this.animator.onResult = (r) => opts.onResult?.(r);
    this.animator.onImpact = (ev) => { this._kick = Math.max(this._kick || 0, Math.min(1, ev.speed / 9)); opts.onImpact?.(ev); };

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

  /** Pixel ratio efektif: DPR perangkat (dibatasi preset kualitas) x kompensasi zoom, maksimum 3. */
  _pr() { return Math.min(3, Math.min(globalThis.devicePixelRatio || 1, this.q.pixelRatio) * (this.pixelScale || 1)); }

  setPixelScale(s) {
    s = Math.max(1, Math.min(2, +s || 1));
    if (Math.abs(s - this.pixelScale) < 0.01) return;
    this.pixelScale = s;
    this.renderer.setPixelRatio(this._pr());
    this.resize();
  }

  /** Tatakan dadu 3D DATAR (pelat batu voxel + garis emas + kristal biru + alas kain). Permukaan atas = y 0 = lantai fisika dadu.
   *  Semua mesh ikut pencahayaan/bayangan scene yang sama dengan dadu (dadu menjatuhkan bayangan asli ke permukaan pelat). */
  _buildPad() {
    const px = (draw, size = 128) => { // tekstur blok piksel (gaya voxel), filter nearest
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const g = cv.getContext('2d'); draw(g, size);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    };
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stoneTex = px((g, n) => { // paving abu-biru berpola blok 16px
      g.fillStyle = '#8b96ac'; g.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 16) for (let x = 0; x < n; x += 16) { const k = rnd(); g.fillStyle = k < .33 ? '#7d889f' : k < .66 ? '#98a3b8' : '#8b96ac'; g.fillRect(x, y, 16, 16); }
      g.fillStyle = 'rgba(20,28,48,.35)'; for (let i = 0; i <= n; i += 32) { g.fillRect(i, 0, 2, n); g.fillRect(0, i, n, 2); }
    });
    const feltTex = px((g, n) => { // kain biru tua bertekstur halus
      g.fillStyle = '#2f3b5a'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)'; g.fillRect((rnd() * n) | 0, (rnd() * n) | 0, 3, 3); }
    }, 64);
    feltTex.repeat.set(3, 3);
    stoneTex.repeat.set(2, 1);
    this._padTex = [stoneTex, feltTex];

    const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.64, metalness: 0.12 });
    const base = new THREE.MeshStandardMaterial({ color: '#39425a', roughness: 0.8, metalness: 0.1 });
    const felt = new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.96, metalness: 0 });
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd35a', roughness: 0.28, metalness: 0.9, emissive: '#ff9d00', emissiveIntensity: 0.22 });
    const steel = new THREE.MeshStandardMaterial({ color: '#c9d1e0', roughness: 0.35, metalness: 0.85 });
    const crystal = new THREE.MeshStandardMaterial({ color: '#4aa8ff', roughness: 0.15, metalness: 0.2, emissive: '#2e8dff', emissiveIntensity: 1.1 });

    const OX = 1.25, OZ = 1.1; // setengah ukuran pelat; permukaan atas = y 0 = lantai fisika (dadu mendarat rata di atasnya)
    const g = new THREE.Group();
    const meshes = [];
    const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); meshes.push(m); return m; };
    const box = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, r);

    add(box(OX * 2 + 0.3, 0.14, OZ * 2 + 0.3, 0.06), base, 0, -0.27, 0);                  // alas bawah, sedikit lebih lebar
    add(box(OX * 2, 0.22, OZ * 2, 0.07), stone, 0, -0.11, 0);                              // pelat batu datar (atas di y 0)
    const mw = OX * 2 - 0.5, md = OZ * 2 - 0.5;                                            // alas kain tempat dadu mendarat
    add(new THREE.PlaneGeometry(mw, md).rotateX(-Math.PI / 2), felt, 0, 0.003, 0, false);
    const inlay = (w, d, x, z) => add(new THREE.BoxGeometry(w, 0.012, d), gold, x, 0.006, z, false); // garis emas pembatas alas kain
    const gi = 0.05;
    inlay(mw + gi, gi, 0, -md / 2); inlay(mw + gi, gi, 0, md / 2); inlay(gi, md, -mw / 2, 0); inlay(gi, md, mw / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(0.16, 0.05, 0.16, 0.02), steel, sx * (OX - 0.16), 0.02, sz * (OZ - 0.16), false); // baut rendah di sudut
    for (const sx of [-1, 1]) { // kristal biru di sisi depan pelat
      const c = add(new THREE.OctahedronGeometry(0.1), crystal, sx * 0.55, -0.11, OZ + 0.02, false);
      c.scale.set(0.9, 1.1, 0.4);
    }

    // cahaya biru lembut di bawah tatakan (berdenyut pelan)
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gx = gc.getContext('2d'), gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(110,190,255,.85)'); gr.addColorStop(0.55, 'rgba(46,116,230,.35)'); gr.addColorStop(1, 'rgba(46,116,230,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(gc); glowTex.colorSpace = THREE.SRGBColorSpace;
    this._padTex.push(glowTex);
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(OX * 2 + 1.6, OZ * 2 + 1.6).rotateX(-Math.PI / 2), glowMat);
    glow.position.y = -0.36; glow.renderOrder = -1;
    this.scene.add(glow);

    this.scene.add(g);
    this.padGroup = g; this.padGlow = glowMat; this._padT = 0; this._kick = 0;
    this._arenaMats.push(stone, base, felt, gold, steel, crystal, glowMat);
    this.arena.push(...meshes, glow);
  }

  _padFrame(dt) {
    this._padT += dt;
    if (this.padGlow) this.padGlow.opacity = 0.5 + 0.18 * Math.sin(this._padT * 1.9);
    const k = this._kick = Math.max(0, (this._kick || 0) - dt * 3.2); // tatakan sedikit "tertekan" saat dadu menghantam
    this.padGroup.scale.set(1 + 0.012 * k, 1 - 0.05 * k, 1 + 0.012 * k);
  }

  _buildArena() {
    if (this.opt.pad) { this.arena = []; this._arenaMats = []; return; } // tatakan 3D (_buildPad) menggantikan lantai bayangan
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
  /** Lempar begitu siap: bila dadu sedang bergulir, tunggu selesai (dan pergantian dadu) lalu lempar. */
  rollWhenReady() { if (!this.animator.busy) return this.roll(); this._pending.roll = true; return null; }
  toIdle() { this.animator.toIdle(); }
  /** Dadu diam dengan angka v di atas (tanpa animasi). false bila lemparan sedang berjalan. */
  showFace(v) { return this.animator.showFace(v); }
  /** Paksa lemparan yang sedang berjalan langsung mendarat di angka yang diminta. */
  finish() { return this.animator.finishNow(); }
  get busy() { return this.animator.busy; }

  setQuality(name) {
    if (!QUALITY_PRESETS[name]) return;
    if (this.animator.busy) { this._pending.quality = name; return; }
    this.qName = name; this.q = QUALITY_PRESETS[name];
    this.renderer.setPixelRatio(this._pr());
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
    if (this.padGroup) this._padFrame(dt);
    this.effects.update(dt * this.effects.slowmo.scale, this.animator.view);

    // camera shake ringan (benturan berat / ledakan)
    const s = this.effects.shake;
    this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * s * 6, this.camBase.y + (Math.random() - 0.5) * s * 6, this.camBase.z);
    this.renderer.render(this.scene, this.camera);

    if (!this.animator.busy) {
      if (this._pending.quality) { const q = this._pending.quality; this._pending.quality = null; this.setQuality(q); }
      if (this._pending.dice) { const d = this._pending.dice; this._pending.dice = null; this.equip(d); }
      if (this._pending.roll) { this._pending.roll = false; this.roll(); }
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
    this._padTex?.forEach((t) => t.dispose());
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
