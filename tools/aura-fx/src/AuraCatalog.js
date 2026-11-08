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
import { RARITY } from './AuraConfig.js';

const E = (zone, mode, shape, o) => ({ zone, mode, shape, solid: false, rate: 3, size: 0.06, life: 1.5, speed: 0.3, ...o });

export const AURAS = [
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

export const getAura = (id) => AURAS.find((a) => a.id === id);
