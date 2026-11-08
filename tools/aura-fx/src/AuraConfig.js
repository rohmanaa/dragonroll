/**
 * AuraConfig.js — util kecil, rarity (Common..Divine), preset Tier 1–7 dan preset kualitas.
 * Satuan panjang di seluruh sistem = "u" (1u ≈ 1 blok Minecraft, karakter standar 1.8u tinggi).
 */
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const RARITY = Object.freeze({
  common:    { label: 'Common',    tier: 1, color: '#b8b8b8' },
  uncommon:  { label: 'Uncommon',  tier: 2, color: '#5fd35f' },
  rare:      { label: 'Rare',      tier: 3, color: '#4da3ff' },
  epic:      { label: 'Epic',      tier: 4, color: '#b266ff' },
  legendary: { label: 'Legendary', tier: 5, color: '#ffa31a' },
  mythic:    { label: 'Mythic',    tier: 6, color: '#ff4d8d' },
  divine:    { label: 'Divine',    tier: 7, color: '#fff2b0' },
});

/** rate = pengali emisi partikel, rings = jumlah lapisan cincin kaki, glow = kekuatan cahaya. */
export const TIER = Object.freeze({
  1: { label: 'Dust',      rate: 0.6, rings: 1, glow: 0.4 },
  2: { label: 'Elemental', rate: 0.8, rings: 1, glow: 0.5 },
  3: { label: 'Energy',    rate: 1.0, rings: 2, glow: 0.7 },
  4: { label: 'Orbit',     rate: 1.25, rings: 2, glow: 0.9 },
  5: { label: 'Layered',   rate: 1.5, rings: 3, glow: 1.1 },
  6: { label: 'Mythic',    rate: 1.8, rings: 3, glow: 1.4 },
  7: { label: 'Divine',    rate: 2.2, rings: 4, glow: 1.8 },
});

/** cap = total instance voxel (dibagi ke pool), rate = pengali emisi, extras = silhouette/distorsi/tanduk. */
export const QUALITY = Object.freeze({
  low:    { cap: 300,  rate: 0.45, fog: false, rings: 1, arcs: 2, extras: false },
  medium: { cap: 800,  rate: 0.75, fog: true,  rings: 2, arcs: 4, extras: true },
  high:   { cap: 1800, rate: 1,    fog: true,  rings: 4, arcs: 6, extras: true },
});

export function detectQuality() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || '');
  const cores = nav.hardwareConcurrency || 4, mem = nav.deviceMemory || 4;
  if (mem <= 2 || (cores <= 4 && mobile)) return 'low';
  if (mobile || cores <= 4) return 'medium';
  return 'high';
}
