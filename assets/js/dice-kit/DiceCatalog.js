/**
 * DiceCatalog.js — satu sumber data untuk seluruh 20 dadu Dragon Roll.
 *
 * ATURAN GAMEPLAY (tidak boleh dilanggar):
 *  - Semua dadu D6 dengan probabilitas 1–6 sama.
 *  - Rarity / Effect Tier HANYA visual. Tidak ada field luck/bonus/harga di sini.
 *  - Satu geometri dasar untuk semua dadu (lihat DiceRenderer.js).
 *
 * Material (tampilan permukaan) dan Effect (partikel, glow, suara) dipisah
 * dan dibangun dari TIER_PRESETS yang bisa dipakai ulang.
 */

/** Urutan face mengikuti urutan group BoxGeometry: +x, -x, +y, -y, +z, -z. Sisi berlawanan berjumlah 7. */
export const D6_FACES = Object.freeze([
  Object.freeze({ value: 2, normal: Object.freeze([1, 0, 0]) }),
  Object.freeze({ value: 5, normal: Object.freeze([-1, 0, 0]) }),
  Object.freeze({ value: 1, normal: Object.freeze([0, 1, 0]) }),
  Object.freeze({ value: 6, normal: Object.freeze([0, -1, 0]) }),
  Object.freeze({ value: 3, normal: Object.freeze([0, 0, 1]) }),
  Object.freeze({ value: 4, normal: Object.freeze([0, 0, -1]) }),
]);

export const RARITY = Object.freeze({
  common:    { label: 'Common',    tier: 1, color: '#b8b8b8' },
  uncommon:  { label: 'Uncommon',  tier: 2, color: '#5fd35f' },
  rare:      { label: 'Rare',      tier: 3, color: '#4da3ff' },
  epic:      { label: 'Epic',      tier: 4, color: '#b266ff' },
  legendary: { label: 'Legendary', tier: 5, color: '#ffa31a' },
  mythic:    { label: 'Mythic',    tier: 6, color: '#ff4d8d' },
  divine:    { label: 'Divine',    tier: 7, color: '#ff2a2a' },
});

export const COLLECTIONS = Object.freeze([
  { id: 'basic',     name: 'Basic Collection' },
  { id: 'mineral',   name: 'Mineral Collection' },
  { id: 'elemental', name: 'Elemental Collection' },
  { id: 'mythical',  name: 'Mythical Collection' },
]);

/**
 * Preset per Effect Tier. Nilai ini default; tiap dadu boleh override.
 * Field wajib (16): effectTier, particleType, particleCount, particleSize, particleSpeed,
 * particleLifetime, glowIntensity, emissiveIntensity, trailEnabled, auraEnabled,
 * impactIntensity, landingEffect, idleEffect, rollEffect, resultEffect, soundEffect.
 */
export const TIER_PRESETS = Object.freeze({
  1: { label: 'Basic',     particleCount: 14,  particleSize: 0.07, particleSpeed: 1.6, particleLifetime: 0.55, glowIntensity: 0,   emissiveIntensity: 0,   trailEnabled: false, auraEnabled: false, impactIntensity: 0.5, idleEffect: 'none',    rollEffect: 'none',  resultEffect: 'highlight' },
  2: { label: 'Enhanced',  particleCount: 24,  particleSize: 0.06, particleSpeed: 2.6, particleLifetime: 0.5,  glowIntensity: 0.2, emissiveIntensity: 0.12, trailEnabled: false, auraEnabled: false, impactIntensity: 0.7, idleEffect: 'none',    rollEffect: 'none',  resultEffect: 'highlight' },
  3: { label: 'Rare',      particleCount: 36,  particleSize: 0.07, particleSpeed: 2.4, particleLifetime: 0.8,  glowIntensity: 0.5, emissiveIntensity: 0.25, trailEnabled: false, auraEnabled: false, impactIntensity: 0.9, idleEffect: 'shimmer', rollEffect: 'none',  resultEffect: 'sparkle' },
  4: { label: 'Epic',      particleCount: 54,  particleSize: 0.08, particleSpeed: 2.8, particleLifetime: 0.9,  glowIntensity: 0.8, emissiveIntensity: 0.4,  trailEnabled: true,  auraEnabled: true,  impactIntensity: 1.1, idleEffect: 'float',   rollEffect: 'trail', resultEffect: 'pulse' },
  5: { label: 'Legendary', particleCount: 84,  particleSize: 0.09, particleSpeed: 3.2, particleLifetime: 1.1,  glowIntensity: 1.1, emissiveIntensity: 0.55, trailEnabled: true,  auraEnabled: true,  impactIntensity: 1.35, idleEffect: 'float',  rollEffect: 'trail', resultEffect: 'burst' },
  6: { label: 'Mythic',    particleCount: 115, particleSize: 0.1,  particleSpeed: 3.4, particleLifetime: 1.3,  glowIntensity: 1.4, emissiveIntensity: 0.7,  trailEnabled: true,  auraEnabled: true,  impactIntensity: 1.6, idleEffect: 'float',   rollEffect: 'trail', resultEffect: 'burst' },
  7: { label: 'Divine',    particleCount: 150, particleSize: 0.11, particleSpeed: 3.8, particleLifetime: 1.5,  glowIntensity: 1.8, emissiveIntensity: 0.9,  trailEnabled: true,  auraEnabled: true,  impactIntensity: 2.0, idleEffect: 'flames',  rollEffect: 'flame', resultEffect: 'halo' },
});

/** Pengaturan kualitas untuk perangkat low-end (Android) hingga desktop. */
export const QUALITY_PRESETS = Object.freeze({
  low:    { pixelRatio: 1,   shadowMap: 512,  antialias: false, particleCap: 120, particleMul: 0.4, ambientMul: 0,   aura: false, trail: false, clearcoat: false, texture: 128, light: false, rings: 3 },
  medium: { pixelRatio: 1.5, shadowMap: 1024, antialias: true,  particleCap: 400, particleMul: 0.7, ambientMul: 0.5, aura: true,  trail: true,  clearcoat: true,  texture: 256, light: true,  rings: 5 },
  high:   { pixelRatio: 2,   shadowMap: 2048, antialias: true,  particleCap: 900, particleMul: 1,   ambientMul: 1,   aura: true,  trail: true,  clearcoat: true,  texture: 512, light: true,  rings: 6 },
});

// ---------------------------------------------------------------------------
// Data 20 dadu. material = tampilan permukaan; effect = override dari TIER_PRESETS.
// ---------------------------------------------------------------------------
const RAW = [
  // ---- Dadu bawaan game (bukan dari paket Dragon Roll): pola 'plain' ----
  {
    id: 'klasik', name: 'Klasik Dice', collection: 'basic', rarity: 'common', materialName: 'Ivory',
    material: { pattern: 'plain', base: '#ffffff', accent: '#dfe5f0', roughness: 0.5, metalness: 0, pip: { color: '#1b2a3b' } },
    effect: { particleType: 'dust', colors: ['#ffffff', '#dfe6f2', '#c9d3e6'], glowColor: '#ffffff', landingEffect: 'puff', soundEffect: 'stone' },
  },
  {
    id: 'rumput', name: 'Rumput Dice', collection: 'basic', rarity: 'common', materialName: 'Grass Block',
    material: { pattern: 'plain', base: '#5fae3e', accent: '#8fd16a', roughness: 0.9, metalness: 0, speckle: ['#3f8a28', '#8fd16a', '#7a5a33'], pip: { color: '#1f4a12' } },
    effect: { particleType: 'debris', colors: ['#6fbf4a', '#3f8a28', '#8a5b33'], glowColor: '#8fd16a', landingEffect: 'debrisBurst', soundEffect: 'wood' },
  },
  {
    id: 'tnt', name: 'TNT Dice', collection: 'basic', rarity: 'rare', materialName: 'TNT',
    material: { pattern: 'plain', base: '#d63a2a', accent: '#f2d9a0', roughness: 0.6, metalness: 0, emissive: '#ff3a1a', stripes: true, pip: { color: '#ffffff' } },
    effect: { particleType: 'spark', colors: ['#ff7a3a', '#ffc040', '#ff3a1a'], glowColor: '#ff5a2a', landingEffect: 'sparkBurst', idleEffect: 'sparks', soundEffect: 'heavy' },
  },

  // ---- 1. BASIC ----
  {
    id: 'wood', name: 'Wood Dice', collection: 'basic', rarity: 'common', materialName: 'Oak Wood',
    material: { pattern: 'wood', base: '#8b5a2b', accent: '#5e3a18', roughness: 0.85, metalness: 0, pip: { color: '#2b1a0c' } },
    effect: { particleType: 'debris', colors: ['#b07a3c', '#7a4f22', '#d2a566'], glowColor: '#d2a566', landingEffect: 'debrisBurst', soundEffect: 'wood' },
  },
  {
    id: 'stone', name: 'Stone Dice', collection: 'basic', rarity: 'common', materialName: 'Stone',
    material: { pattern: 'stone', base: '#7d7d80', accent: '#55555a', roughness: 0.95, metalness: 0, pip: { color: '#26262a' } },
    effect: { particleType: 'dust', colors: ['#a4a4a8', '#85858a', '#c4c4c8'], glowColor: '#b0b0b4', landingEffect: 'puff', soundEffect: 'stone', particleCount: 18 },
  },
  {
    id: 'copper', name: 'Copper Dice', collection: 'basic', rarity: 'uncommon', materialName: 'Copper',
    material: { pattern: 'metal', base: '#c4733a', accent: '#e8a36a', roughness: 0.38, metalness: 0.92, emissive: '#ff7a1a', pip: { color: '#3a1a08' } },
    effect: { particleType: 'bolt', colors: ['#ff9a3d', '#ffc680', '#ff6a1a'], glowColor: '#ff8a2a', landingEffect: 'sparkBurst', soundEffect: 'electric' },
  },
  {
    id: 'iron', name: 'Iron Dice', collection: 'basic', rarity: 'uncommon', materialName: 'Iron',
    material: { pattern: 'metal', base: '#b4b8be', accent: '#e4e7eb', roughness: 0.34, metalness: 1, pip: { color: '#23262c' } },
    effect: { particleType: 'spark', colors: ['#f2f4f6', '#ffe3a0', '#c9ced4'], glowColor: '#dfe6f0', landingEffect: 'sparkBurst', soundEffect: 'metal' },
  },
  {
    id: 'emas', name: 'Gold Dice', collection: 'basic', rarity: 'rare', materialName: 'Gold Block',
    material: { pattern: 'gold', base: '#eab72a', accent: '#fff0a0', roughness: 0.2, metalness: 1, emissive: '#ffb800', clearcoat: 0.4, pip: { color: '#5a3d00' } },
    effect: { particleType: 'glint', colors: ['#fff2a8', '#ffd24a', '#ffffff'], glowColor: '#ffd24a', landingEffect: 'glintBurst', idleEffect: 'shimmer', rollEffect: 'trail', soundEffect: 'gold' },
  },

  // ---- 2. MINERAL ----
  {
    id: 'diamond', name: 'Diamond Dice', collection: 'mineral', rarity: 'epic', materialName: 'Diamond',
    material: { pattern: 'gem', base: '#3fdcd8', accent: '#c4f8ff', roughness: 0.08, metalness: 0.15, emissive: '#22d3e6', clearcoat: 1, clearcoatRoughness: 0.05, pip: { color: '#08414d' } },
    effect: { particleType: 'shard', colors: ['#9ff3ff', '#4de8e0', '#ffffff'], glowColor: '#4de8f0', landingEffect: 'shatter', soundEffect: 'crystal' },
  },
  {
    id: 'emerald', name: 'Emerald Dice', collection: 'mineral', rarity: 'epic', materialName: 'Emerald',
    material: { pattern: 'gem', base: '#16a34a', accent: '#8dffb8', roughness: 0.1, metalness: 0.1, emissive: '#10c050', clearcoat: 1, clearcoatRoughness: 0.06, pip: { color: '#03280f' } },
    effect: { particleType: 'energy', colors: ['#5dff95', '#16d65f', '#c8ffd8'], glowColor: '#3dff80', landingEffect: 'shockwave', soundEffect: 'magic' },
  },
  {
    id: 'lapis', name: 'Lapis Dice', collection: 'mineral', rarity: 'rare', materialName: 'Lapis Lazuli',
    material: { pattern: 'lapis', base: '#1d3a9e', accent: '#0f2266', roughness: 0.45, metalness: 0.1, emissive: '#2a5cff', pip: { color: '#e8d27a' } },
    effect: { particleType: 'energy', colors: ['#5a8cff', '#2a5cff', '#a8c4ff'], glowColor: '#3a6cff', landingEffect: 'pulseRing', soundEffect: 'magic' },
  },
  {
    id: 'amethyst', name: 'Amethyst Dice', collection: 'mineral', rarity: 'epic', materialName: 'Amethyst',
    material: { pattern: 'amethyst', base: '#8a4fd8', accent: '#e0baff', roughness: 0.12, metalness: 0.1, emissive: '#a855f7', clearcoat: 1, clearcoatRoughness: 0.08, pip: { color: '#2a0f4a' } },
    effect: { particleType: 'shard', colors: ['#d8a8ff', '#a855f7', '#f1deff'], glowColor: '#b878ff', landingEffect: 'resonance', soundEffect: 'crystal' },
  },
  {
    id: 'redstone', name: 'Redstone Dice', collection: 'mineral', rarity: 'epic', materialName: 'Redstone',
    material: { pattern: 'redstone', base: '#6a0d0d', accent: '#ff2a2a', roughness: 0.6, metalness: 0.05, emissive: '#ff1a1a', glowMap: true, pip: { color: '#ff3a3a', glow: true } },
    effect: { particleType: 'bolt', colors: ['#ff3030', '#ff7a5a', '#ffd0c0'], glowColor: '#ff2a2a', landingEffect: 'electricPulse', idleEffect: 'sparks', soundEffect: 'electric', emissiveIntensity: 0.8 },
  },

  // ---- 3. ELEMENTAL ----
  {
    id: 'obsidian', name: 'Obsidian Dice', collection: 'elemental', rarity: 'epic', materialName: 'Obsidian',
    material: { pattern: 'obsidian', base: '#120c1e', accent: '#7a3cff', roughness: 0.18, metalness: 0.3, emissive: '#7a3cff', glowMap: true, clearcoat: 1, pip: { color: '#b98cff', glow: true } },
    effect: { particleType: 'smoke', colors: ['#7a3cff', '#4a1fa0', '#b98cff'], glowColor: '#8a4cff', landingEffect: 'cracks', idleEffect: 'mist', soundEffect: 'stone' },
  },
  {
    id: 'magma', name: 'Magma Dice', collection: 'elemental', rarity: 'legendary', materialName: 'Magma Block',
    material: { pattern: 'magma', base: '#1a0d0a', accent: '#ff5a10', roughness: 0.7, metalness: 0, emissive: '#ff4a00', glowMap: true, pip: { color: '#ffb040', glow: true } },
    effect: { particleType: 'lava', colors: ['#ff6a1a', '#ffb020', '#ff3a00'], glowColor: '#ff5a10', landingEffect: 'lavaSplash', idleEffect: 'embers', rollEffect: 'ember', soundEffect: 'lava' },
  },
  {
    id: 'frost', name: 'Frost Dice', collection: 'elemental', rarity: 'legendary', materialName: 'Packed Ice',
    material: { pattern: 'ice', base: '#9fd8ff', accent: '#ffffff', roughness: 0.12, metalness: 0, emissive: '#6ac8ff', clearcoat: 1, clearcoatRoughness: 0.05, pip: { color: '#0c3a66' } },
    effect: { particleType: 'frost', colors: ['#e8f8ff', '#9fe0ff', '#ffffff'], glowColor: '#8adcff', landingEffect: 'iceBlast', idleEffect: 'mist', rollEffect: 'mist', soundEffect: 'ice' },
  },
  {
    id: 'prismarine', name: 'Prismarine Dice', collection: 'elemental', rarity: 'legendary', materialName: 'Prismarine',
    material: { pattern: 'prismarine', base: '#2ab8a8', accent: '#1f8a78', roughness: 0.3, metalness: 0.1, emissive: '#2affd0', clearcoat: 0.6, pip: { color: '#05302c' } },
    effect: { particleType: 'bubble', colors: ['#aaffee', '#4de8d0', '#e8fffa'], glowColor: '#4dffe0', landingEffect: 'splash', idleEffect: 'bubbles', rollEffect: 'trail', soundEffect: 'water' },
  },
  {
    id: 'quartz', name: 'Quartz Dice', collection: 'elemental', rarity: 'legendary', materialName: 'Nether Quartz',
    material: { pattern: 'quartz', base: '#f4eeee', accent: '#f0a8c0', roughness: 0.15, metalness: 0.05, emissive: '#ffd8e8', clearcoat: 1, clearcoatRoughness: 0.05, pip: { color: '#5a2a3a' } },
    effect: { particleType: 'glint', colors: ['#ffffff', '#ffd8e8', '#fff6fa'], glowColor: '#ffe4f0', landingEffect: 'radiant', idleEffect: 'shimmer', rollEffect: 'trail', soundEffect: 'crystal' },
  },

  // ---- 4. MYTHICAL ----
  {
    id: 'void', name: 'Void Dice', collection: 'mythical', rarity: 'mythic', materialName: 'Crying Obsidian',
    material: { pattern: 'crying', base: '#0a0614', accent: '#9a3cff', roughness: 0.15, metalness: 0.35, emissive: '#9a3cff', glowMap: true, clearcoat: 1, pip: { color: '#d8a8ff', glow: true } },
    effect: { particleType: 'void', colors: ['#9a3cff', '#5a1ab0', '#e0b0ff'], glowColor: '#a040ff', landingEffect: 'vortexPortal', idleEffect: 'void', rollEffect: 'trail', soundEffect: 'void' },
  },
  {
    id: 'netherite', name: 'Netherite Dice', collection: 'mythical', rarity: 'mythic', materialName: 'Netherite',
    material: { pattern: 'netherite', base: '#2e2a2c', accent: '#8a6a4a', roughness: 0.4, metalness: 0.95, emissive: '#a0602a', pip: { color: '#c8905a' } },
    effect: { particleType: 'ember', colors: ['#6a3a1a', '#c8803a', '#2a1a10'], glowColor: '#b0602a', landingEffect: 'heavyImpact', idleEffect: 'embers', rollEffect: 'ember', soundEffect: 'heavy', impactIntensity: 2.2 },
  },
  {
    id: 'sculk', name: 'Sculk Dice', collection: 'mythical', rarity: 'mythic', materialName: 'Sculk',
    material: { pattern: 'sculk', base: '#0a1f3a', accent: '#22d3ee', roughness: 0.5, metalness: 0.05, emissive: '#22d3ee', glowMap: true, pip: { color: '#7af0ff', glow: true } },
    effect: { particleType: 'energy', colors: ['#22d3ee', '#7af0ff', '#0e7490'], glowColor: '#22d3ee', landingEffect: 'sonic', idleEffect: 'float', rollEffect: 'trail', soundEffect: 'sonic' },
  },
  {
    id: 'ender', name: 'Ender Dice', collection: 'mythical', rarity: 'mythic', materialName: 'Ender Pearl',
    material: { pattern: 'ender', base: '#1c0a3a', accent: '#e020c8', roughness: 0.2, metalness: 0.2, emissive: '#d020ff', glowMap: true, clearcoat: 1, pip: { color: '#ff7af0', glow: true } },
    effect: { particleType: 'star', colors: ['#ff4de8', '#a030ff', '#ffffff'], glowColor: '#d040ff', landingEffect: 'teleport', idleEffect: 'stars', rollEffect: 'stars', soundEffect: 'ender' },
  },

  // ---- DIVINE ----
  {
    id: 'dragon', name: 'Dragon Dice', collection: 'mythical', rarity: 'divine', materialName: 'Dragon Essence',
    material: { pattern: 'dragon', base: '#0c0508', accent: '#e01830', roughness: 0.25, metalness: 0.6, emissive: '#ff1a30', glowMap: true, clearcoat: 1, pip: { color: '#ff5a40', glow: true } },
    effect: { particleType: 'flame', colors: ['#ff2a1a', '#ff8a2a', '#a020ff'], glowColor: '#ff2a3a', landingEffect: 'dragonExplosion', idleEffect: 'flames', rollEffect: 'flame', resultEffect: 'halo', soundEffect: 'dragon' },
  },
];

function build(raw, index) {
  const rarity = RARITY[raw.rarity];
  const tier = rarity.tier;
  const effect = Object.freeze({ ...TIER_PRESETS[tier], ...raw.effect, effectTier: tier });
  const material = Object.freeze({ ...raw.material, pip: Object.freeze({ ...raw.material.pip }) });
  return Object.freeze({
    id: raw.id,
    order: index + 1,
    name: raw.name,
    collection: raw.collection,
    rarity: raw.rarity,
    materialName: raw.materialName,
    faces: 6, // semua dadu D6
    material,
    effect,
  });
}

export const DICE_CATALOG = Object.freeze(RAW.map(build));
const BY_ID = new Map(DICE_CATALOG.map((d) => [d.id, d]));

export const getDice = (id) => BY_ID.get(id) || null;
export const getDiceByCollection = (collectionId) => DICE_CATALOG.filter((d) => d.collection === collectionId);

/** Field efek wajib dari spesifikasi. */
export const EFFECT_FIELDS = Object.freeze([
  'effectTier', 'particleType', 'particleCount', 'particleSize', 'particleSpeed', 'particleLifetime',
  'glowIntensity', 'emissiveIntensity', 'trailEnabled', 'auraEnabled', 'impactIntensity',
  'landingEffect', 'idleEffect', 'rollEffect', 'resultEffect', 'soundEffect',
]);

/** Dipakai oleh test: memastikan katalog valid dan tidak ada field yang memengaruhi peluang angka. */
export function validateCatalog() {
  const errors = [];
  if (DICE_CATALOG.length !== 23) errors.push(`Harus 23 dadu, ada ${DICE_CATALOG.length}`);
  const ids = new Set();
  for (const d of DICE_CATALOG) {
    if (ids.has(d.id)) errors.push(`ID ganda: ${d.id}`);
    ids.add(d.id);
    if (d.faces !== 6) errors.push(`${d.id}: bukan D6`);
    for (const f of EFFECT_FIELDS) if (!(f in d.effect)) errors.push(`${d.id}: field efek hilang ${f}`);
    if (d.effect.effectTier !== RARITY[d.rarity].tier) errors.push(`${d.id}: tier tidak sesuai rarity`);
    for (const k of Object.keys(d)) if (/luck|bonus|weight|chance|price/i.test(k)) errors.push(`${d.id}: field terlarang ${k}`);
  }
  return errors;
}

/** Peluang adil 1–6. Pakai crypto bila ada, dengan rejection sampling agar tanpa bias. */
export function rollFairD6(rng) {
  if (rng) return 1 + Math.floor(rng() * 6);
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (c && c.getRandomValues) {
    const a = new Uint8Array(1);
    do { c.getRandomValues(a); } while (a[0] >= 252); // 252 = 6 * 42
    return 1 + (a[0] % 6);
  }
  return 1 + Math.floor(Math.random() * 6);
}
