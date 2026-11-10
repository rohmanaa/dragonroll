/* assets/js/aura-fx.js — GENERATED oleh tools/aura-fx/build.js dari tools/aura-fx/src (paket aura-3d). JANGAN edit manual.
   Aura karakter voxel 3D (15 aura, Common..Divine). Skrip klasik, global UT.AuraFX; perlu global THREE (r128).
     const sys = new UT.AuraFX.AuraSystem(scene, camera, {quality:'medium'});
     const aura = sys.attach(object3D, 'dragon', {intensity:1,size:1,speed:1,tint:null}, {height:2});
     aura.setAura('solar'); aura.jump(); aura.despawn(); // tiap frame: sys.update(dt)
*/
(function(){
window.UT=window.UT||{};
const Config = (function(){
/**
 * AuraConfig.js — util kecil, rarity (Common..Divine), preset Tier 1–7 dan preset kualitas.
 * Satuan panjang di seluruh sistem = "u" (1u ≈ 1 blok Minecraft, karakter standar 1.8u tinggi).
 */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const RARITY = Object.freeze({
  common:    { label: 'Common',    tier: 1, color: '#b8b8b8' },
  uncommon:  { label: 'Uncommon',  tier: 2, color: '#5fd35f' },
  rare:      { label: 'Rare',      tier: 3, color: '#4da3ff' },
  epic:      { label: 'Epic',      tier: 4, color: '#b266ff' },
  legendary: { label: 'Legendary', tier: 5, color: '#ffa31a' },
  mythic:    { label: 'Mythic',    tier: 6, color: '#ff4d8d' },
  divine:    { label: 'Divine',    tier: 7, color: '#fff2b0' },
});

/** rate = pengali emisi partikel, rings = jumlah lapisan cincin kaki, glow = kekuatan cahaya. */
const TIER = Object.freeze({
  1: { label: 'Dust',      rate: 0.6, rings: 1, glow: 0.4 },
  2: { label: 'Elemental', rate: 0.8, rings: 1, glow: 0.5 },
  3: { label: 'Energy',    rate: 1.0, rings: 2, glow: 0.7 },
  4: { label: 'Orbit',     rate: 1.25, rings: 2, glow: 0.9 },
  5: { label: 'Layered',   rate: 1.5, rings: 3, glow: 1.1 },
  6: { label: 'Mythic',    rate: 1.8, rings: 3, glow: 1.4 },
  7: { label: 'Divine',    rate: 2.2, rings: 4, glow: 1.8 },
});

/** cap = total instance voxel (dibagi ke pool), rate = pengali emisi, extras = silhouette/distorsi/tanduk. */
const QUALITY = Object.freeze({
  low:    { cap: 300,  rate: 0.45, fog: false, rings: 1, arcs: 2, extras: false },
  medium: { cap: 800,  rate: 0.75, fog: true,  rings: 2, arcs: 4, extras: true },
  high:   { cap: 1800, rate: 1,    fog: true,  rings: 4, arcs: 6, extras: true },
});

function detectQuality() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || '');
  const cores = nav.hardwareConcurrency || 4, mem = nav.deviceMemory || 4;
  if (mem <= 2 || (cores <= 4 && mobile)) return 'low';
  if (mobile || cores <= 4) return 'medium';
  return 'high';
}

return { TAU, clamp, lerp, rnd, pick, smooth, RARITY, TIER, QUALITY, detectQuality };
})();
const Particles = (function(){
/**
 * AuraParticles.js — partikel VOXEL ber-pool (ring buffer) memakai InstancedMesh.
 * 6 pool: {cube, plate, shard} x {additive (cahaya), solid (voxel padat berlampu)}.
 * Satu sistem dipakai bersama semua aura -> jumlah draw call tetap (6) berapa pun jumlah karakter.
 * Mode 0 = bebas (velocity, gravity, drag); mode 1 = orbit relatif terhadap anchor hidup (mengikuti karakter).
 */
const {rnd} = Config;

const GEO = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  plate: () => new THREE.BoxGeometry(1, 0.16, 1),
  shard: () => new THREE.BoxGeometry(0.4, 1.7, 0.4),
};
const SHARE = { cubeA: 0.3, plateA: 0.12, shardA: 0.12, cubeS: 0.2, plateS: 0.14, shardS: 0.12 };

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const dummy = new THREE.Object3D();
const tmpC = new THREE.Color();

class VoxelPool {
  constructor(geo, solid, cap) {
    this.cap = cap; this.head = 0; this.aliveCount = 0; this.dirty = true; this.solid = solid;
    const mat = solid
      ? new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, emissive: 0x1c1c1c, flatShading: true })
      : new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = solid ? 2 : 4;
    this.mesh.castShadow = false;
    this.mesh.setColorAt(0, tmpC.set(0xffffff));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO);
    const f3 = () => new Float32Array(cap * 3), f1 = () => new Float32Array(cap);
    this.pos = f3(); this.vel = f3(); this.rot = f3(); this.spn = f3(); this.col = f3();
    this.life = f1(); this.max = f1(); this.size = f1(); this.alpha = f1(); this.grav = f1(); this.drag = f1(); this.grow = f1();
    this.mode = f1(); this.ang = f1(); this.rad = f1(); this.h = f1(); this.w = f1(); this.vy = f1(); this.radV = f1();
    this.tele = f1(); this.bob = f1(); this.phase = f1();
    this.anchor = new Array(cap).fill(null);
  }

  emit(o) {
    const i = this.head; this.head = (i + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = o.x || 0; this.pos[k + 1] = o.y || 0; this.pos[k + 2] = o.z || 0;
    this.vel[k] = o.vx || 0; this.vel[k + 1] = o.vy || 0; this.vel[k + 2] = o.vz || 0;
    this.rot[k] = rnd(0, 6.28); this.rot[k + 1] = rnd(0, 6.28); this.rot[k + 2] = rnd(0, 6.28);
    const s = o.spin || 0;
    this.spn[k] = rnd(-1, 1) * s; this.spn[k + 1] = rnd(-1, 1) * s; this.spn[k + 2] = rnd(-1, 1) * s;
    this.col[k] = o.r; this.col[k + 1] = o.g; this.col[k + 2] = o.b;
    this.life[i] = this.max[i] = o.life; this.size[i] = o.size; this.alpha[i] = o.alpha ?? 1;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag ?? 1; this.grow[i] = o.grow ?? 1;
    this.mode[i] = o.mode || 0; this.ang[i] = o.ang || 0; this.rad[i] = o.rad || 0; this.h[i] = o.h || 0;
    this.w[i] = o.w || 0; this.vy[i] = o.vyO || 0; this.radV[i] = o.radV || 0;
    this.tele[i] = o.tele || 0; this.bob[i] = o.bob || 0; this.phase[i] = rnd(0, 6.28);
    this.anchor[i] = o.anchor || null;
    if (this.solid) { this.mesh.setColorAt(i, tmpC.setRGB(o.r, o.g, o.b)); this.dirty = true; }
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, ZERO); this.dirty = true; continue; }
      alive++;
      const k = i * 3, age = this.max[i] - this.life[i], f = age / this.max[i];
      if (this.mode[i] === 0) {
        this.vel[k + 1] -= this.grav[i] * dt;
        const dmp = Math.exp(-this.drag[i] * dt);
        this.vel[k] *= dmp; this.vel[k + 1] *= dmp; this.vel[k + 2] *= dmp;
        this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      } else {
        const a = this.anchor[i];
        if (this.tele[i] > 0) {
          this.tele[i] -= dt;
          if (this.tele[i] <= 0) { this.ang[i] += rnd(-1.5, 1.5); this.rad[i] *= rnd(0.8, 1.25); this.h[i] += rnd(-0.3, 0.3); this.tele[i] = rnd(0.4, 1.2); }
        }
        this.ang[i] += this.w[i] * dt; this.rad[i] = Math.max(0.02, this.rad[i] + this.radV[i] * dt); this.h[i] += this.vy[i] * dt;
        this.pos[k] = a.x + Math.cos(this.ang[i]) * this.rad[i];
        this.pos[k + 1] = a.y + this.h[i] + this.bob[i] * Math.sin(this.phase[i] + age * 3);
        this.pos[k + 2] = a.z + Math.sin(this.ang[i]) * this.rad[i];
      }
      this.rot[k] += this.spn[k] * dt; this.rot[k + 1] += this.spn[k + 1] * dt; this.rot[k + 2] += this.spn[k + 2] * dt;
      const kIn = Math.min(1, f / 0.12), kOut = 1 - f;
      let sc = this.size[i] * (1 + (this.grow[i] - 1) * f);
      if (this.solid) sc *= Math.min(1, f * 10) * Math.min(1, kOut * 5);
      else { const b = this.alpha[i] * kIn * kOut; tmpC.setRGB(this.col[k] * b, this.col[k + 1] * b, this.col[k + 2] * b); this.mesh.setColorAt(i, tmpC); sc *= 0.6 + 0.4 * kOut; }
      dummy.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      dummy.rotation.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]);
      dummy.scale.setScalar(Math.max(1e-4, sc));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.aliveCount = alive;
    if (alive || this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
      this.dirty = alive > 0;
    }
  }

  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}

class VoxelParticles {
  constructor(scene, q) {
    this.pools = {};
    for (const [key, share] of Object.entries(SHARE)) {
      const shape = key.replace(/[AS]$/, ''), solid = key.endsWith('S');
      const p = new VoxelPool(GEO[shape](), solid, Math.max(24, Math.round(q.cap * share)));
      this.pools[key] = p; scene.add(p.mesh);
    }
  }
  /** o: {x,y,z,vx,vy,vz,r,g,b,size,life,alpha,shape,solid,grav,drag,grow,spin,mode,anchor,ang,rad,h,w,vyO,radV,tele,bob} */
  emit(o) { this.pools[o.shape + (o.solid ? 'S' : 'A')].emit(o); }
  update(dt) { for (const p of Object.values(this.pools)) p.update(dt); }
  get alive() { let n = 0; for (const p of Object.values(this.pools)) n += p.aliveCount; return n; }
  dispose() { for (const p of Object.values(this.pools)) p.dispose(); }
}

return { VoxelParticles };
})();
const Catalog = (function(){
/**
 * AuraCatalog.js — SATU katalog data untuk 15 aura. Tidak ada kode render per aura.
 *
 * emit[]  = emitter partikel voxel: zone (foot|body|head|ambient), mode (orbit|helix|rise|drift|fall),
 *           shape (cube|plate|shard), solid (voxel padat berlampu) / additive (cahaya), rate (per detik, sebelum
 *           pengali tier/kualitas), size/radius/h dalam "u" (1u = 1 blok), life (detik), speed, colors, bob, tele,
 *           burst {every,count} (semburan berkala), pulse {every,count} (cincin partikel naik).
 * fx[]    = dekor shader/mesh: ring (cincin kaki), fog, halo, backRing, glow, wings, horns, silhouette,
 *           dragonShadow, arcs, distort. Lihat AuraDecor.js.
 */
const {RARITY} = Config;

const E = (zone, mode, shape, o) => ({ zone, mode, shape, solid: false, rate: 3, size: 0.06, life: 1.5, speed: 0.3, ...o });

const AURAS = [
  // ============ 1. NATURE (Common / T1) ============
  { id: 'nature', name: 'Nature Aura', rarity: 'common', theme: 'Nature / Forest', colors: ['#4caf50', '#8bc34a', '#7a5230'],
    fx: [{ type: 'ring', style: 'grass', r: 0.95, c1: '#6fcf4a', c2: '#2f7a2a' }],
    emit: [
      E('body', 'orbit', 'plate', { solid: true, rate: 2.5, size: 0.1, life: 6, speed: 0.45, radius: 0.8, h: [0.2, 1.6], spin: 1.5, bob: 0.06, colors: ['#4caf50', '#6dbb4a', '#8bc34a', '#5d9c3a'] }),
      E('head', 'orbit', 'plate', { solid: true, rate: 0.9, size: 0.08, life: 5, speed: 0.7, radius: 0.35, h: [2.0, 2.3], spin: 2, bob: 0.05, colors: ['#5fbf4a', '#8bc34a'] }),
      E('ambient', 'fall', 'cube', { rate: 2.5, size: 0.03, life: 3, grav: 0.15, h: [2.0, 2.4], radius: 1, colors: ['#f3e26b', '#fff59d'] }),
      E('foot', 'rise', 'cube', { solid: true, rate: 1.5, size: 0.03, life: 1.2, speed: 0.4, radius: 0.7, colors: ['#7a5230', '#5a3a1e'] }),
    ] },

  // ============ 2. STONE (Common / T1) ============
  { id: 'stone', name: 'Stone Aura', rarity: 'common', theme: 'Stone / Mountain', colors: ['#9a9ea6', '#ffffff', '#c0c4cc'],
    fx: [{ type: 'ring', style: 'dust', r: 0.95, c1: '#d0d3d8', c2: '#80858e', dark: true }],
    emit: [
      E('body', 'orbit', 'cube', { solid: true, rate: 2.5, size: 0.1, life: 6, speed: 0.45, radius: 0.8, h: [0.3, 1.5], spin: 0.8, bob: 0.1, colors: ['#8a8e96', '#a9adb5', '#c8ccd2', '#6f737b'] }),
      E('foot', 'rise', 'cube', { solid: true, rate: 3, size: 0.05, life: 1.4, speed: 0.3, radius: 0.75, colors: ['#c8ccd2', '#a9adb5'] }),
      E('head', 'rise', 'cube', { rate: 0.8, size: 0.04, life: 1.6, speed: 0.35, radius: 0.3, h: [1.9, 2.0], alpha: 0.5, colors: ['#ffffff', '#d8dce2'] }),
    ] },

  // ============ 3. FLAME (Uncommon / T2) ============
  { id: 'flame', name: 'Flame Aura', rarity: 'uncommon', theme: 'Fire', colors: ['#ff3a1a', '#ff7a18', '#ffd24a'],
    fx: [{ type: 'ring', style: 'flame', r: 1.0, c1: '#ff4a14', c2: '#ffd24a' }],
    emit: [
      E('foot', 'rise', 'cube', { rate: 9, size: 0.08, life: 0.8, speed: 0.9, radius: 0.6, colors: ['#ff3a1a', '#ff7a18', '#ffb02e'] }),
      E('body', 'rise', 'cube', { rate: 10, size: 0.09, life: 0.9, speed: 1.2, radius: 0.5, h: [0.1, 1.5], colors: ['#ff4a14', '#ff7a18', '#ffd24a'] }),
      E('head', 'drift', 'cube', { rate: 2.5, size: 0.035, life: 1.8, speed: 0.25, radius: 0.35, h: [1.9, 2.4], colors: ['#ffd24a', '#ff9a1a'] }),
      E('body', 'rise', 'cube', { solid: true, rate: 1.5, size: 0.1, life: 1.8, speed: 0.5, radius: 0.4, h: [1.2, 1.8], colors: ['#3a3a3a', '#555555'] }),
    ] },

  // ============ 4. FROST (Uncommon / T2) ============
  { id: 'frost', name: 'Frost Aura', rarity: 'uncommon', theme: 'Ice', colors: ['#9fe4ff', '#ffffff', '#5ac8ff'],
    fx: [{ type: 'ring', style: 'ice', r: 1.0, c1: '#9fe4ff', c2: '#ffffff' }, { type: 'fog', h: 0.55, r: 1.1, c1: '#bfeeff', c2: '#ffffff', alpha: 0.35 }],
    emit: [
      E('body', 'orbit', 'shard', { rate: 2.5, size: 0.08, life: 6, speed: 0.6, radius: 0.8, h: [0.2, 1.5], spin: 1.2, colors: ['#9fe4ff', '#ffffff', '#5ac8ff'] }),
      E('head', 'fall', 'cube', { rate: 4, size: 0.03, life: 3, grav: 0.15, h: [2.3, 2.5], radius: 0.7, colors: ['#ffffff', '#dff6ff'] }),
      E('foot', 'rise', 'plate', { rate: 3, size: 0.16, life: 2, speed: 0.12, radius: 0.8, alpha: 0.35, colors: ['#d6f3ff'] }),
    ] },

  // ============ 5. ELECTRIC (Rare / T3) ============
  { id: 'electric', name: 'Electric Aura', rarity: 'rare', theme: 'Lightning', colors: ['#ffe94a', '#ffffff', '#5ac8ff'],
    fx: [{ type: 'ring', style: 'electric', r: 1.1, c1: '#ffe94a', c2: '#5ac8ff' }, { type: 'arcs', rate: 5, c1: '#fff7a0', c2: '#7ad0ff' }],
    emit: [
      E('body', 'drift', 'cube', { rate: 6, size: 0.035, life: 0.3, speed: 1.6, radius: 0.55, h: [0.1, 1.6], colors: ['#ffe94a', '#ffffff', '#7ad0ff'] }),
      E('head', 'drift', 'cube', { rate: 1.5, size: 0.04, life: 0.35, speed: 1.2, radius: 0.35, h: [1.9, 2.2], colors: ['#ffffff', '#ffe94a'] }),
      E('foot', 'drift', 'cube', { rate: 3, size: 0.03, life: 0.35, speed: 1.4, radius: 0.5, radial: true, colors: ['#ffe94a', '#7ad0ff'] }),
    ] },

  // ============ 6. EMERALD (Rare / T3) ============
  { id: 'emerald', name: 'Emerald Aura', rarity: 'rare', theme: 'Emerald', colors: ['#1fd16a', '#c6ff5a', '#ffffff'],
    fx: [{ type: 'ring', style: 'energy', r: 1.0, c1: '#1fd16a', c2: '#c6ff5a' }, { type: 'glow', y: 2.05, z: 0, size: 0.9, color: '#46ff8a', pulse: 2, alpha: 0.5 }],
    emit: [
      E('body', 'orbit', 'shard', { solid: true, rate: 2, size: 0.075, life: 6, speed: 0.75, radius: 0.8, h: [0.2, 1.6], spin: 2, colors: ['#17b45a', '#2ee37a', '#0e8f47'] }),
      E('body', 'orbit', 'cube', { rate: 4, size: 0.03, life: 3, speed: 0.5, radius: 0.7, h: [0.1, 1.7], colors: ['#c6ff5a', '#ffffff', '#46ff8a'] }),
      E('head', 'rise', 'cube', { rate: 1.2, size: 0.03, life: 1.4, speed: 0.4, radius: 0.3, h: [1.9, 2.1], colors: ['#ffffff', '#46ff8a'] }),
    ] },

  // ============ 7. ENDER (Epic / T4) ============
  { id: 'ender', name: 'Ender Aura', rarity: 'epic', theme: 'Enderman / End Dimension', colors: ['#c24cff', '#ff40d8', '#14041f'],
    fx: [{ type: 'ring', style: 'void', r: 1.05, c1: '#c24cff', c2: '#12031f', dark: true },
         { type: 'fog', h: 0.6, r: 1.0, c1: '#7a2ab8', c2: '#14041f', alpha: 0.5, dark: true },
         { type: 'distort', period: 5.5, color: '#c24cff' }],
    emit: [
      E('body', 'orbit', 'cube', { rate: 6, size: 0.055, life: 2.5, speed: 1.0, radius: 0.75, h: [0.1, 1.7], tele: true, colors: ['#c24cff', '#ff40d8', '#8a2cff'] }),
      E('head', 'drift', 'cube', { rate: 2, size: 0.05, life: 0.4, speed: 1.5, radius: 0.35, h: [1.8, 2.2], colors: ['#ff40d8', '#ffffff'] }),
      E('ambient', 'orbit', 'cube', { solid: true, rate: 1.5, size: 0.04, life: 4, speed: 0.4, radius: 1.0, tele: true, colors: ['#0a0010', '#240b36'] }),
    ] },

  // ============ 8. NETHER (Epic / T4) ============
  { id: 'nether', name: 'Nether Aura', rarity: 'epic', theme: 'Nether', colors: ['#ff3a1a', '#ff7a18', '#1a0505'],
    fx: [{ type: 'ring', style: 'lava', r: 1.05, c1: '#ff5a14', c2: '#1a0505', dark: true }],
    emit: [
      E('body', 'orbit', 'cube', { rate: 7, size: 0.05, life: 4, speed: 0.9, radius: 0.7, h: [0.1, 1.3], rise: 0.12, colors: ['#ff3a1a', '#ff7a18', '#ffb02e'] }),
      E('head', 'rise', 'cube', { solid: true, rate: 2, size: 0.1, life: 2, speed: 0.45, radius: 0.3, h: [1.9, 2.1], colors: ['#1c1416', '#2e2226'] }),
      E('head', 'drift', 'cube', { rate: 2.5, size: 0.035, life: 0.8, speed: 0.6, radius: 0.4, h: [1.8, 2.3], colors: ['#ff2a3a', '#ff7a18'] }),
      E('foot', 'rise', 'cube', { rate: 0, burst: { every: 3, count: 18 }, size: 0.06, life: 1.2, speed: 2.0, grav: 2.5, radius: 0.5, colors: ['#ff3a1a', '#ffb02e'] }),
    ] },

  // ============ 9. AMETHYST (Epic / T4) ============
  { id: 'amethyst', name: 'Amethyst Aura', rarity: 'epic', theme: 'Amethyst Geode', colors: ['#b266ff', '#d8b4ff', '#ff9ae6'],
    fx: [{ type: 'ring', style: 'energy', r: 1.0, c1: '#b266ff', c2: '#ff9ae6' }],
    emit: [
      E('foot', 'orbit', 'shard', { solid: true, rate: 0.9, size: 0.09, life: 9, speed: 0.25, radius: 0.95, h: [0.05, 0.1], bob: 0.02, colors: ['#9a4cdf', '#b266ff', '#7a2ab8'] }),
      E('body', 'orbit', 'shard', { solid: true, rate: 2, size: 0.08, life: 6, speed: 0.7, radius: 0.85, h: [0.2, 1.6], spin: 1.5, colors: ['#b266ff', '#d8b4ff', '#9a4cdf'] }),
      E('head', 'orbit', 'shard', { solid: true, rate: 0.8, size: 0.05, life: 5, speed: 1.2, radius: 0.4, h: [2.05, 2.3], spin: 2, colors: ['#d8b4ff', '#ff9ae6'] }),
      E('body', 'drift', 'cube', { rate: 1.5, size: 0.035, life: 1.2, speed: 0.5, radius: 0.7, h: [0.2, 1.6], burst: { every: 2.5, count: 10 }, colors: ['#ff9ae6', '#ffffff', '#d8b4ff'] }),
    ] },

  // ============ 10. OCEAN (Epic / T4) ============
  { id: 'ocean', name: 'Ocean Aura', rarity: 'epic', theme: 'Ocean / Prismarine', colors: ['#27d8e6', '#8ff6ff', '#1a6fb8'],
    fx: [{ type: 'ring', style: 'ripple', r: 1.05, c1: '#27d8e6', c2: '#1a6fb8' }],
    emit: [
      E('foot', 'helix', 'cube', { rate: 7, size: 0.045, life: 2.6, speed: 1.1, radius: 0.7, rise: 0.75, h: [0, 0.1], colors: ['#27d8e6', '#8ff6ff', '#1a9fd8'] }),
      E('foot', 'orbit', 'plate', { rate: 3, size: 0.09, life: 1.6, speed: 3, radius: 0.35, h: [0.05, 0.15], colors: ['#27d8e6', '#8ff6ff'] }),
      E('head', 'rise', 'cube', { rate: 3, size: 0.045, life: 2, speed: 0.5, radius: 0.35, h: [1.9, 2.1], colors: ['#ffffff', '#bff8ff'] }),
      E('ambient', 'fall', 'cube', { rate: 2, size: 0.025, life: 2.5, grav: 0.3, h: [2.2, 2.5], radius: 0.8, colors: ['#27d8e6', '#8ff6ff'] }),
      E('body', 'orbit', 'cube', { solid: true, rate: 1, size: 0.05, life: 5, speed: 0.6, radius: 0.8, h: [0.3, 1.5], colors: ['#2ec7b1', '#1a8f86'] }),
    ] },

  // ============ 11. SOLAR (Legendary / T5) ============
  { id: 'solar', name: 'Solar Aura', rarity: 'legendary', theme: 'Sun / Solar Energy', colors: ['#ffd24a', '#fff7c8', '#ffffff'],
    fx: [{ type: 'ring', style: 'solar', r: 1.1, c1: '#ffd24a', c2: '#fff7c8' },
         { type: 'backRing', style: 'solar', r: 1.15, y: 1.35, dz: 0.55, spin: 0.25, c1: '#ffd24a', c2: '#fff7c8' },
         { type: 'glow', y: 1.35, z: -0.5, size: 2.2, color: '#ffd24a', pulse: 1.2, alpha: 0.35 }],
    emit: [
      E('body', 'orbit', 'cube', { rate: 6, size: 0.04, life: 4, speed: 0.8, radius: 0.85, h: [0.1, 1.7], colors: ['#ffd24a', '#fff7c8', '#ffb02e'] }),
      E('head', 'rise', 'shard', { rate: 3, size: 0.05, life: 1.4, speed: 1, radius: 0.25, h: [2.0, 2.2], colors: ['#ffe27a', '#ffffff'] }),
      E('ambient', 'drift', 'cube', { rate: 4, size: 0.03, life: 2, speed: 0.3, radius: 1.2, colors: ['#ffffff', '#ffd24a'] }),
    ] },

  // ============ 12. SHADOW (Legendary / T5) ============
  { id: 'shadow', name: 'Shadow Aura', rarity: 'legendary', theme: 'Dark Dimension', colors: ['#0a0510', '#5a1a8a', '#c0182c'],
    fx: [{ type: 'ring', style: 'shadow', r: 1.1, c1: '#c0182c', c2: '#0a0510', dark: true },
         { type: 'fog', h: 1.0, r: 0.95, c1: '#3a0a40', c2: '#0a0210', alpha: 0.5, dark: true },
         { type: 'silhouette', period: 6, dur: 1.8, color: '#14041c' }],
    emit: [
      E('foot', 'drift', 'cube', { solid: true, rate: 5, size: 0.12, life: 2, speed: 0.5, radius: 0.5, radial: true, colors: ['#0a0510', '#1d0a26', '#2a0d33'] }),
      E('body', 'orbit', 'cube', { solid: true, rate: 4, size: 0.09, life: 4, speed: 0.6, radius: 0.65, h: [0.2, 1.6], colors: ['#0a0510', '#1d0a26'] }),
      E('head', 'drift', 'plate', { solid: true, rate: 2, size: 0.08, life: 1.6, speed: 0.3, radius: 0.35, h: [1.9, 2.3], colors: ['#050208', '#1d0a26'] }),
      E('body', 'drift', 'cube', { rate: 1.5, size: 0.03, life: 1, speed: 0.5, radius: 0.6, h: [0.2, 1.6], colors: ['#ff2a3a', '#c0182c'] }),
    ] },

  // ============ 13. SCULK (Legendary / T5) ============
  { id: 'sculk', name: 'Sculk Aura', rarity: 'legendary', theme: 'Deep Dark / Sculk', colors: ['#27e6ff', '#0a2a5a', '#1a5fbf'],
    fx: [{ type: 'ring', style: 'sonic', r: 1.2, c1: '#27e6ff', c2: '#0a2a5a' },
         { type: 'glow', y: 2.1, z: 0, size: 0.8, color: '#27e6ff', pulse: 1.6, alpha: 0.5 }],
    emit: [
      E('foot', 'orbit', 'cube', { rate: 0, pulse: { every: 1.6, count: 18 }, size: 0.045, life: 1.5, rise: 1.1, radius: 0.6, colors: ['#27e6ff', '#7af2ff'] }),
      E('body', 'orbit', 'cube', { rate: 4, size: 0.04, life: 3, speed: 0.8, radius: 0.6, bob: 0.15, h: [0.2, 1.6], colors: ['#27e6ff', '#1a8fbf'] }),
      E('ambient', 'drift', 'cube', { rate: 3, size: 0.03, life: 2.5, speed: 0.25, radius: 1.1, colors: ['#27e6ff', '#1a5fbf'] }),
    ] },

  // ============ 14. DRAGON (Mythic / T6) ============
  { id: 'dragon', name: 'Dragon Aura', rarity: 'mythic', theme: 'Ender Dragon', colors: ['#ff2a3a', '#7a2aa8', '#0a0510'],
    fx: [{ type: 'ring', style: 'flame', r: 1.15, c1: '#ff2a3a', c2: '#7a2aa8' },
         { type: 'wings', bitmap: 'dragon', vox: 0.115, c1: '#ff2a52', c2: '#7a2aa8', flap: 0.7, alpha: 0.75, y: 1.05, z: -0.17 },
         { type: 'horns', c1: '#ff2a52', c2: '#7a2aa8' },
         { type: 'dragonShadow', period: 10, color: '#1a0510' }],
    emit: [
      E('foot', 'rise', 'cube', { rate: 10, size: 0.09, life: 0.9, speed: 1, radius: 0.65, colors: ['#ff2a3a', '#ff7a18', '#b030ff'] }),
      E('body', 'orbit', 'cube', { rate: 6, size: 0.045, life: 4, speed: 0.9, radius: 0.85, h: [0.1, 1.7], colors: ['#ff2a52', '#7a2aa8'] }),
      E('head', 'rise', 'cube', { rate: 3, size: 0.04, life: 1.2, speed: 0.8, radius: 0.3, h: [2.0, 2.4], colors: ['#ff2a52', '#ffb07a'] }),
      E('ambient', 'drift', 'cube', { rate: 3, size: 0.03, life: 2.5, speed: 0.3, radius: 1.2, colors: ['#b266ff', '#ff2a52'] }),
    ] },

  // ============ 15. CELESTIAL (Divine / T7) ============
  { id: 'celestial', name: 'Celestial Aura', rarity: 'divine', theme: 'Divine / Cosmic', colors: ['#fff2b0', '#ffffff', '#7fe6ff'],
    fx: [{ type: 'ring', style: 'celestial', r: 1.2, c1: '#ffe9a0', c2: '#7fe6ff' },
         { type: 'halo', r: 0.5, y: 0.3, c1: '#fff2b0', c2: '#ffffff' },
         { type: 'backRing', style: 'celestial', r: 1.5, y: 1.4, dz: 0.6, spin: 0.12, c1: '#ffe9a0', c2: '#7fe6ff' },
         { type: 'wings', bitmap: 'light', vox: 0.11, c1: '#ffffff', c2: '#9fe8ff', flap: 0.5, alpha: 0.5, cycle: 9, y: 1.05, z: -0.17 },
         { type: 'glow', y: 1.4, z: -0.5, size: 2.6, color: '#fff0b0', pulse: 0.8, alpha: 0.3 }],
    emit: [
      E('body', 'orbit', 'cube', { rate: 8, size: 0.04, life: 5, speed: 0.7, radius: 0.85, h: [0.1, 1.8], colors: ['#ffffff', '#ffe9a0', '#9fe8ff'] }),
      E('foot', 'helix', 'cube', { rate: 5, size: 0.035, life: 3, speed: 0.9, radius: 0.7, rise: 0.6, h: [0, 0.1], colors: ['#ffe9a0', '#ffffff'] }),
      E('ambient', 'drift', 'cube', { rate: 6, size: 0.025, life: 3, speed: 0.2, radius: 1.2, colors: ['#fff2b0', '#ffd24a'] }),
      E('head', 'rise', 'shard', { rate: 2, size: 0.04, life: 1.6, speed: 0.7, radius: 0.25, h: [2.1, 2.4], colors: ['#ffffff', '#ffe9a0'] }),
    ] },
].map((a) => ({ ...a, tier: RARITY[a.rarity].tier }));

const getAura = (id) => AURAS.find((a) => a.id === id);

return { AURAS, getAura };
})();
const Decor = (function(){
/**
 * AuraDecor.js — elemen non-partikel aura, semuanya dikontrol data katalog (fx[]):
 *   ring (cincin kaki berlapis, 15 gaya shader), fog, halo, backRing, glow, wings (voxel bitmap), horns,
 *   silhouette, dragonShadow, arcs (petir voxel), distort.
 * Builder: (spec, ctx) -> { follow:'pos'|'yaw', ground?:true, obj, update(t, dt, s), dispose() }
 * ground:true = menempel ke LANTAI (cincin & kabut): tetap di lantai saat karakter melompat, tidak ikut terangkat.
 *   ctx = { u, q, layers, paint(colorObj, hex) }   s = { env, inten, size, air, pulse, tintV }
 */
const {TAU, clamp, lerp, rnd, smooth} = Config;

const ADD = THREE.AdditiveBlending;
const PLANE = new THREE.PlaneGeometry(2, 2);

// ------------------------------------------------------------------------------- shader cincin / decal
const STYLE = { grass: 0, dust: 1, flame: 2, ice: 3, electric: 4, energy: 5, void: 6, lava: 7, ripple: 8, sonic: 9, solar: 10, shadow: 11, celestial: 12, halo: 13, disc: 14 };
const DECAL_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DECAL_F = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform float uTime; uniform float uAlpha; uniform float uStyle; uniform float uLayer; uniform float uRot;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float cr = cos(uRot), sr = sin(uRot); p = mat2(cr, -sr, sr, cr) * p;
  float r = length(p); if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  float ring = smoothstep(0.06, 0.0, abs(r - 0.82)), soft = smoothstep(1.0, 0.2, r);
  float a = 0.0; vec3 col = uC1; int st = int(uStyle + 0.5);
  if (st == 0) { float tuft = step(0.55, noise(vec2(ang * 5.0, uLayer))) * smoothstep(0.2, 0.0, abs(r - 0.7)); a = ring * 0.8 + tuft * 0.9 + soft * 0.12; col = mix(uC1, uC2, noise(p * 4.0)); }
  else if (st == 1) { a = ring * 0.5 + soft * 0.25 * noise(p * 6.0 + uTime * 0.3) + step(0.96, hash(floor(p * 12.0))) * soft; col = mix(uC1, uC2, noise(p * 5.0)); }
  else if (st == 2) { float lick = noise(vec2(ang * 4.0 + uTime * 1.5, r * 3.0 - uTime * 2.0)); a = smoothstep(0.45, 0.9, lick) * smoothstep(1.0, 0.55, r) * smoothstep(0.2, 0.6, r) + ring * 0.6; col = mix(uC2, uC1, lick); }
  else if (st == 3) { float lines = smoothstep(0.05, 0.0, abs(sin(ang * 3.0))) * smoothstep(0.2, 0.7, r) * smoothstep(1.0, 0.7, r); float sp = step(0.97, hash(floor(p * 14.0) + floor(uTime * 3.0))) * soft; a = soft * 0.28 + ring * 0.7 + lines * 0.6 + sp; col = mix(uC1, uC2, noise(p * 3.0)); }
  else if (st == 4) { float rr = fract(uTime * 0.6 + uLayer * 0.3); a = smoothstep(0.08, 0.0, abs(r - rr)) * (1.0 - rr) + ring * 0.4 + step(0.8, noise(vec2(ang * 8.0, uTime * 6.0))) * smoothstep(1.0, 0.3, r) * 0.8; col = mix(uC1, uC2, noise(p * 5.0 + uTime)); }
  else if (st == 5) { float ticks = step(0.5, fract(ang * 12.0 / 6.2832 + uTime * 0.05)) * smoothstep(0.05, 0.0, abs(r - 0.7)); a = ring * 0.9 + smoothstep(0.04, 0.0, abs(r - 0.6)) * 0.5 + ticks * 0.7 + soft * 0.15; col = mix(uC1, uC2, 0.5 + 0.5 * sin(ang * 3.0 + uTime)); }
  else if (st == 6) { float sp = 0.5 + 0.5 * sin(ang * 3.0 + r * 12.0 - uTime * 2.0); a = soft * (0.35 + 0.5 * sp) * smoothstep(1.0, 0.85, r); col = mix(uC2, uC1, sp); }
  else if (st == 7) { float n = noise(p * 4.0 + uTime * 0.1); float ln = smoothstep(0.06, 0.0, abs(n - 0.5)); a = soft * 0.45 + ln * 0.95 * smoothstep(1.0, 0.5, r); col = mix(uC2, uC1, ln); }
  else if (st == 8) { a = (0.5 + 0.5 * sin(r * 24.0 - uTime * 3.0)) * soft * 0.5 + ring * 0.7; col = mix(uC1, uC2, r); }
  else if (st == 9) { float rr = fract(uTime * 0.5 + uLayer * 0.4); a = smoothstep(0.1, 0.0, abs(r - rr)) * (1.0 - rr) * 1.2 + ring * 0.3 + soft * 0.1; col = uC1; }
  else if (st == 10) { float rays = step(0.5, fract(ang * 16.0 / 6.2832 + uTime * 0.1)); a = ring + smoothstep(0.04, 0.0, abs(r - 0.58)) * 0.7 + rays * smoothstep(0.1, 0.0, abs(r - 0.7)) * 0.9 + soft * 0.12; col = mix(uC1, uC2, 0.5 + 0.5 * sin(ang * 4.0 - uTime)); }
  else if (st == 11) { float n = noise(p * 3.0 + vec2(uTime * 0.3, -uTime * 0.2)); a = soft * (0.35 + 0.5 * n) + ring * 0.5; col = mix(uC2, uC1, clamp(n * 0.6 + ring, 0.0, 1.0)); }
  else if (st == 12) { float tk = step(0.8, hash(vec2(floor(ang * 30.0 / 6.2832), uLayer))) * smoothstep(0.04, 0.0, abs(r - 0.9)); a = ring + smoothstep(0.03, 0.0, abs(r - 0.65)) * 0.7 + smoothstep(0.03, 0.0, abs(r - 0.45)) * 0.5 + tk + soft * 0.15; col = mix(uC1, uC2, 0.5 + 0.5 * sin(r * 10.0 - uTime)); }
  else if (st == 13) { a = smoothstep(0.16, 0.0, abs(r - 0.8)) * 0.9 + smoothstep(0.4, 0.0, abs(r - 0.8)) * 0.3 + step(0.985, hash(floor(vec2(ang * 20.0, uTime * 2.0)))) * 0.8; col = mix(uC1, uC2, noise(p * 3.0 + uTime)); }
  else { a = soft * soft; }
  gl_FragColor = vec4(col, clamp(a * uAlpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;

function decalMat(style, dark) {
  return new THREE.ShaderMaterial({
    uniforms: { uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 }, uStyle: { value: STYLE[style] ?? 5 }, uLayer: { value: 0 }, uRot: { value: 0 } },
    vertexShader: DECAL_V, fragmentShader: DECAL_F, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: dark ? THREE.NormalBlending : ADD,
  });
}

const FOG_F = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform float uTime; uniform float uAlpha; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){ float n = noise(vec2(vUv.x * 8.0 + uTime * 0.2, vUv.y * 3.0 - uTime * 0.3)); float a = (0.3 + 0.7 * n) * pow(1.0 - vUv.y, 1.5);
  gl_FragColor = vec4(mix(uC1, uC2, n), clamp(a * uAlpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
const SHELL_V = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const SHELL_F = `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uColor, f * uOpacity);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;

let _radial;
function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) _radial.colorSpace = THREE.SRGBColorSpace; /* r152+; r128 tidak punya */
  return _radial;
}

// ------------------------------------------------------------------------------------------ bitmap voxel
const BITMAPS = {
  // akar di kolom kiri, ujung sayap ke kanan; baris 0 = atas
  light: [
    '...........##', '.........####', '......#######', '...##########', '.############',
    '..###########', '....#########', '......#######', '........#####', '..........###',
  ],
  dragon: [
    '...........#', '..........##', '.........###', '#.......####', '##.....#####',
    '###...######', '####.#######', '############', '.##.##.#####', '..#..#..#.##',
  ],
  human: [
    '....####....', '....####....', '....####....', '....####....', '..########..', '.##########.', '###.####.###', '###.####.###',
    '###.####.###', '###.####.###', '.##.####.##.', '....####....', '....#..#....', '....#..#....', '....#..#....', '....#..#....',
  ],
  dragonTop: [
    '..........####..........', '...........##...........', '#.........####.........#', '##.......######.......##',
    '###.....########.....###', '.####..##########..####.', '..####################..', '...##..##########..##...',
    '....#...########...#....', '..........####..........', '...........##...........', '............#...........',
  ],
};

function bitmapMesh(rows, v, thick, mat) {
  let n = 0; for (const r of rows) for (const ch of r) if (ch === '#') n++;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(v * 0.95, v * 0.95, v * thick), mat, n);
  mesh.setColorAt(0, new THREE.Color());
  mesh.frustumCulled = false;
  const cells = []; let i = 0; const d = new THREE.Object3D();
  rows.forEach((row, ry) => { for (let cx = 0; cx < row.length; cx++) if (row[cx] === '#') {
    d.position.set(cx * v, (rows.length - 1 - ry) * v, 0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    cells.push([cx / Math.max(1, row.length - 1), ry / Math.max(1, rows.length - 1)]); i++;
  } });
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, cells };
}
function recolor(b, paint, c1, c2) {
  const a = new THREE.Color(), c = new THREE.Color(); paint(a, c1); paint(c, c2);
  const t = new THREE.Color();
  b.cells.forEach(([x, y], i) => { t.copy(a).lerp(c, clamp(x * 0.8 + y * 0.2)); b.mesh.setColorAt(i, t); });
  b.mesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------- builders
const DECOR = {
  ring(spec, ctx) {
    const g = new THREE.Group(), meshes = [], n = Math.max(1, Math.min(ctx.layers, ctx.q.rings));
    for (let L = 0; L < n; L++) {
      const m = new THREE.Mesh(PLANE, decalMat(spec.style, spec.dark));
      m.rotation.x = -Math.PI / 2; m.position.y = (0.03 + L * 0.004) * ctx.u; m.renderOrder = 1 + L; g.add(m); meshes.push(m);
    }
    return { follow: 'pos', ground: true, obj: g,
      update(t, dt, s) {
        meshes.forEach((m, L) => {
          const u = m.material.uniforms;
          ctx.paint(u.uC1.value, spec.c1); ctx.paint(u.uC2.value, spec.c2);
          u.uTime.value = t; u.uLayer.value = L; u.uRot.value = t * (0.15 + 0.12 * L) * (L % 2 ? -1 : 1);
          u.uAlpha.value = (s.env * Math.min(1.4, s.inten) * (1 - 0.35 * s.air) * (spec.alpha ?? 1)) / (1 + L * 0.35);
          m.scale.setScalar(spec.r * ctx.u * s.size * (1 + L * 0.28) * (1 + s.pulse * 0.35));
        });
      },
      dispose() { meshes.forEach((m) => m.material.dispose()); } };
  },

  fog(spec, ctx) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: { uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: DECAL_V, fragmentShader: FOG_F, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: spec.dark ? THREE.NormalBlending : ADD });
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 1;
    return { follow: 'pos', ground: true, obj: m,
      update(t, dt, s) {
        ctx.paint(mat.uniforms.uC1.value, spec.c1); ctx.paint(mat.uniforms.uC2.value, spec.c2);
        mat.uniforms.uTime.value = t; mat.uniforms.uAlpha.value = s.env * Math.min(1.3, s.inten) * (spec.alpha ?? 0.4) * (1 - 0.3 * s.air);
        m.scale.set(spec.r * ctx.u * s.size, spec.h * ctx.u * s.size, spec.r * ctx.u * s.size);
      },
      dispose() { geo.dispose(); mat.dispose(); } };
  },

  halo(spec, ctx) { // cincin di atas kepala (tidak menutupi wajah)
    const m = new THREE.Mesh(PLANE, decalMat('halo', false)); m.rotation.x = -Math.PI / 2; m.renderOrder = 6;
    return { follow: 'pos', obj: m,
      update(t, dt, s) {
        const u = m.material.uniforms; ctx.paint(u.uC1.value, spec.c1); ctx.paint(u.uC2.value, spec.c2 || spec.c1);
        u.uTime.value = t; u.uRot.value = t * 0.4; u.uAlpha.value = s.env * Math.min(1.4, s.inten) * (0.8 + 0.2 * Math.sin(t * 2));
        m.position.y = (1.8 + spec.y + 0.03 * Math.sin(t * 1.5)) * ctx.u; m.scale.setScalar(spec.r * ctx.u * s.size * (1 + s.pulse * 0.2));
      },
      dispose() { m.material.dispose(); } };
  },

  backRing(spec, ctx) { // lingkaran besar vertikal di belakang karakter
    const m = new THREE.Mesh(PLANE, decalMat(spec.style, false)); m.renderOrder = 0;
    const g = new THREE.Group(); g.add(m);
    return { follow: 'yaw', obj: g,
      update(t, dt, s) {
        const u = m.material.uniforms; ctx.paint(u.uC1.value, spec.c1); ctx.paint(u.uC2.value, spec.c2);
        u.uTime.value = t; u.uRot.value = t * spec.spin; u.uAlpha.value = s.env * Math.min(1.4, s.inten) * (0.85 + 0.15 * Math.sin(t * 1.3));
        m.position.set(0, spec.y * ctx.u, -spec.dz * ctx.u); m.scale.setScalar(spec.r * ctx.u * s.size * (1 + 0.03 * Math.sin(t * 1.3)));
      },
      dispose() { m.material.dispose(); } };
  },

  glow(spec, ctx) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), blending: ADD, transparent: true, depthWrite: false, opacity: 0 }));
    sp.renderOrder = 0; const g = new THREE.Group(); g.add(sp);
    return { follow: 'yaw', obj: g,
      update(t, dt, s) {
        ctx.paint(sp.material.color, spec.color);
        sp.material.opacity = s.env * (spec.alpha ?? 0.4) * (0.7 + 0.3 * Math.sin(t * (spec.pulse || 1) * 2)) * Math.min(1.3, s.inten);
        sp.position.set(0, spec.y * ctx.u, (spec.z || 0) * ctx.u); sp.scale.setScalar(spec.size * ctx.u * s.size);
      },
      dispose() { sp.material.dispose(); } };
  },

  wings(spec, ctx) { // sayap voxel dari bitmap, mengepak
    const rows = BITMAPS[spec.bitmap], v = spec.vox * ctx.u, g = new THREE.Group(), sides = [];
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const bms = [];
    for (const sd of [1, -1]) {
      const b = bitmapMesh(rows, v, 0.4, mat), pivot = new THREE.Group();
      b.mesh.position.set(0.05 * ctx.u, -rows.length * v * 0.5, 0);
      pivot.add(b.mesh); pivot.position.set(sd * 0.14 * ctx.u, spec.y * ctx.u, spec.z * ctx.u); pivot.scale.x = sd;
      g.add(pivot); sides.push({ pivot, sd }); bms.push(b);
    }
    let tv = -1;
    return { follow: 'yaw', obj: g,
      update(t, dt, s) {
        if (tv !== s.tintV) { tv = s.tintV; bms.forEach((b) => recolor(b, ctx.paint, spec.c1, spec.c2)); }
        const flap = Math.sin(t * spec.flap * 3);
        for (const { pivot, sd } of sides) { pivot.rotation.y = sd * (0.5 + 0.3 * flap + s.pulse * 0.3 + s.air * 0.25); pivot.rotation.z = sd * -0.05 * flap; }
        let cyc = 1; if (spec.cycle) cyc = smooth(0.1, 0.6, 0.5 + 0.5 * Math.sin((t * TAU) / spec.cycle - Math.PI / 2));
        mat.opacity = s.env * spec.alpha * cyc * Math.min(1.2, s.inten); g.visible = mat.opacity > 0.01; g.scale.setScalar(s.size);
      },
      dispose() { bms.forEach((b) => { b.mesh.geometry.dispose(); b.mesh.dispose(); }); mat.dispose(); } };
  },

  horns(spec, ctx) { // dua tanduk energi voxel di kepala
    const pts = [[0, 0], [0.07, 0.12], [0.15, 0.22], [0.26, 0.3], [0.38, 0.34]];
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const g = new THREE.Group(), meshes = [], cA = new THREE.Color(), cB = new THREE.Color(), tmp = new THREE.Color();
    for (const sd of [1, -1]) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, pts.length); im.setColorAt(0, cA); im.frustumCulled = false;
      const d = new THREE.Object3D();
      pts.forEach(([x, y], i) => { d.position.set(sd * x * ctx.u, y * ctx.u, 0); d.scale.setScalar(ctx.u * (0.075 - i * 0.01)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.position.set(sd * 0.15 * ctx.u, 1.85 * ctx.u, 0.02 * ctx.u); g.add(im); meshes.push(im);
    }
    return { follow: 'yaw', obj: g,
      update(t, dt, s) {
        ctx.paint(cA, spec.c1); ctx.paint(cB, spec.c2);
        meshes.forEach((im) => { for (let i = 0; i < pts.length; i++) im.setColorAt(i, tmp.copy(cA).lerp(cB, i / (pts.length - 1))); im.instanceColor.needsUpdate = true; });
        mat.opacity = s.env * (0.7 + 0.3 * Math.sin(t * 5)) * Math.min(1.2, s.inten); g.scale.setScalar(s.size);
      },
      dispose() { meshes.forEach((m) => { m.geometry.dispose(); m.dispose(); }); mat.dispose(); } };
  },

  silhouette(spec, ctx) { // siluet bayangan sesaat muncul di belakang karakter
    const rows = BITMAPS.human, v = ((1.8 * 1.25) / rows.length) * ctx.u;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
    const b = bitmapMesh(rows, v, 0.3, mat), g = new THREE.Group(); b.mesh.position.set((-rows[0].length * v) / 2, 0, -1.0 * ctx.u); g.add(b.mesh);
    const c = new THREE.Color(); let tv = -1;
    return { follow: 'yaw', obj: g,
      update(t, dt, s) {
        if (tv !== s.tintV) { tv = s.tintV; ctx.paint(c, spec.color); for (let i = 0; i < b.cells.length; i++) b.mesh.setColorAt(i, c); b.mesh.instanceColor.needsUpdate = true; }
        const ph = t % spec.period, e = ph < spec.dur ? Math.pow(Math.sin((Math.PI * ph) / spec.dur), 2) : 0;
        mat.opacity = e * 0.6 * s.env; g.visible = mat.opacity > 0.01; g.scale.setScalar(s.size); b.mesh.position.x = (-rows[0].length * v) / 2 + Math.sin(t * 2) * 0.02 * ctx.u;
      },
      dispose() { b.mesh.geometry.dispose(); b.mesh.dispose(); mat.dispose(); } };
  },

  dragonShadow(spec, ctx) { // bayangan naga melintas di belakang karakter
    const rows = BITMAPS.dragonTop, v = 0.14 * ctx.u;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
    const b = bitmapMesh(rows, v, 0.3, mat), g = new THREE.Group(); g.add(b.mesh);
    const c = new THREE.Color(); let tv = -1; const dur = 3.4;
    return { follow: 'yaw', obj: g,
      update(t, dt, s) {
        if (tv !== s.tintV) { tv = s.tintV; ctx.paint(c, spec.color); for (let i = 0; i < b.cells.length; i++) b.mesh.setColorAt(i, c); b.mesh.instanceColor.needsUpdate = true; }
        const ph = t % spec.period, k = ph / dur, on = ph < dur;
        mat.opacity = on ? Math.sin(Math.PI * k) * 0.55 * s.env : 0; g.visible = on;
        if (on) b.mesh.position.set(lerp(-3.8, 3.8, k) * ctx.u - (rows[0].length * v) / 2, 2.4 * ctx.u + Math.sin(k * 6) * 0.15 * ctx.u, -1.8 * ctx.u);
      },
      dispose() { b.mesh.geometry.dispose(); b.mesh.dispose(); mat.dispose(); } };
  },

  arcs(spec, ctx) { // petir voxel (jalur patah berkelipatan kecil, terasa "blocky")
    const N = ctx.q.arcs, g = new THREE.Group(), lines = [], cA = new THREE.Color(), cB = new THREE.Color(); let acc = 0;
    for (let i = 0; i < N; i++) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0, blending: ADD, depthWrite: false }));
      l.frustumCulled = false; l.userData.life = 0; g.add(l); lines.push(l);
    }
    const q = ctx.u * 0.06, snap = (x) => Math.round(x / q) * q;
    return { follow: 'pos', obj: g,
      update(t, dt, s) {
        ctx.paint(cA, spec.c1); ctx.paint(cB, spec.c2);
        acc += spec.rate * s.env * Math.min(1.5, s.inten) * dt;
        while (acc >= 1) {
          acc--; const l = lines.find((x) => x.userData.life <= 0); if (!l) break;
          const a = rnd(0, TAU), rad = rnd(0.35, 0.65) * ctx.u * s.size, y0 = rnd(0, 0.3) * ctx.u, y1 = rnd(1.3, 1.8) * ctx.u, p = l.geometry.attributes.position.array;
          for (let i = 0; i < 9; i++) { const u = i / 8, j = i === 0 || i === 8 ? 0 : ctx.u * 0.14;
            p[i * 3] = snap(Math.cos(a) * rad + rnd(-j, j)); p[i * 3 + 1] = lerp(y0, y1, u); p[i * 3 + 2] = snap(Math.sin(a) * rad + rnd(-j, j)); }
          l.geometry.attributes.position.needsUpdate = true; l.userData.life = 0.14; l.material.color.copy(Math.random() > 0.5 ? cA : cB);
        }
        for (const l of lines) { if (l.userData.life > 0) { l.userData.life -= dt; l.material.opacity = Math.random() > 0.25 ? 1 : 0.3; } else l.material.opacity = 0; }
      },
      dispose() { lines.forEach((l) => { l.geometry.dispose(); l.material.dispose(); }); } };
  },

  distort(spec, ctx) { // gelombang distorsi ruang singkat berkala
    const geo = new THREE.SphereGeometry(1, 24, 16);
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } }, vertexShader: SHELL_V, fragmentShader: SHELL_F, transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 5;
    return { follow: 'pos', obj: m,
      update(t, dt, s) {
        const dur = 1.1, ph = t % spec.period, k = ph / dur;
        if (ph < dur) {
          m.visible = true; ctx.paint(mat.uniforms.uColor.value, spec.color);
          m.position.y = 0.9 * ctx.u; m.scale.setScalar(ctx.u * lerp(0.9, 2.0, 1 - Math.pow(1 - k, 3)) * s.size * (1 + 0.06 * Math.sin(t * 40)));
          mat.uniforms.uOpacity.value = (1 - k) * 0.55 * s.env;
        } else m.visible = false;
      },
      dispose() { geo.dispose(); mat.dispose(); } };
  },
};

return { DECOR };
})();
const System = (function(){
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
const {TIER, QUALITY, detectQuality, TAU, clamp, lerp, rnd, smooth} = Config;
const {VoxelParticles} = Particles;
const {DECOR} = Decor;
const {AURAS, getAura} = Catalog;

const ZONE = { foot: { h: [0, 0.1], r: 0.6 }, body: { h: [0.15, 1.6], r: 0.6 }, head: { h: [1.85, 2.3], r: 0.35 }, back: { h: [0.4, 1.8], r: 0.5 }, ambient: { h: [0, 2.2], r: 1.1 } };
const DRAG = { orbit: 0, helix: 0, rise: 0.5, drift: 1.2, fall: 0.3 };
const EXTRA = new Set(['silhouette', 'dragonShadow', 'distort', 'horns']);

class CharacterAura {
  constructor(sys, character, id, settings = {}, opts = {}) {
    this.sys = sys; this.ch = character; this.opts = { facing: 0, ...opts };
    this.settings = { intensity: 1, size: 1, speed: 1, tint: null, tintMix: 0.75, ...settings };
    this._tint = this.settings.tint ? new THREE.Color(this.settings.tint) : null;
    this.flat = new THREE.Group(); this.yaw = new THREE.Group(); this.floor = new THREE.Group(); /* floor = cincin & kabut: tetap di lantai saat melompat */
    sys.scene.add(this.flat, this.yaw, this.floor);
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
      (d.ground ? this.floor : d.follow === 'yaw' ? this.yaw : this.flat).add(d.obj);
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
    this.flat.position.copy(this.anchor); this.yaw.position.copy(this.anchor); this.floor.position.set(this.anchor.x, this.ground, this.anchor.z); this.yaw.rotation.y = this._e.y + this.opts.facing;
    // kecepatan, lompat / mendarat
    if (this._has) this.vel.copy(this.anchor).sub(this._prev).divideScalar(Math.max(dt, 1e-4));
    if (this.vel.length() > 60 * u) this.vel.set(0, 0, 0);
    this._prev.copy(this.anchor); this._has = true;
    const spd = Math.hypot(this.vel.x, this.vel.z) / u;
    const air = this.anchor.y - this.ground > 0.12 * u;
    if (air && !this.airborne) this._onJump();
    if (!air && this.airborne) this._onLand();
    if (!air && Math.abs(this.vel.y) < 0.6 * u) this.ground += (this.anchor.y - this.ground) * 0.2; /* lantai tidak ikut terangkat saat awal lompatan */
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
    this.sys.scene.remove(this.flat, this.yaw, this.floor);
    const i = this.sys.auras.indexOf(this); if (i >= 0) this.sys.auras.splice(i, 1);
    this.phase = 'dead';
  }
}

class AuraSystem {
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

return { AuraSystem };
})();
UT.AuraFX = { AuraSystem: System.AuraSystem, AURAS: Catalog.AURAS, getAura: Catalog.getAura, RARITY: Config.RARITY, TIER: Config.TIER, QUALITY: Config.QUALITY, detectQuality: Config.detectQuality };
})();
