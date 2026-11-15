/** PowerConfig.js — konfigurasi bersama: kualitas, tier efek, rarity, koleksi, style aura, util matematika. */
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export const QUALITY = {
  low:    { antialias: false, pixelRatio: 1,   texture: 32, bump: false, clearcoat: false, light: false, shadowMap: 512,  ambientMul: 1,   auraLayers: 1, particleMul: 0.45, particleCap: 500,  wingBlades: 3, ringsMax: 1, trail: false },
  medium: { antialias: true,  pixelRatio: 1.5, texture: 64, bump: true,  clearcoat: true,  light: true,  shadowMap: 1024, ambientMul: 1,   auraLayers: 2, particleMul: 0.8,  particleCap: 1200, wingBlades: 4, ringsMax: 2, trail: true },
  high:   { antialias: true,  pixelRatio: 2,   texture: 128, bump: true, clearcoat: true,  light: true,  shadowMap: 2048, ambientMul: 1,   auraLayers: 3, particleMul: 1.3,  particleCap: 2500, wingBlades: 6, ringsMax: 3, trail: true },
};

/** Deteksi kualitas otomatis: HP / memori kecil -> low. */
export function detectQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (mobile || mem <= 4 || cores <= 4) return 'low';
  return 'medium';
}

export const RARITY = {
  common: { tier: 1 }, uncommon: { tier: 2 }, rare: { tier: 3 }, epic: { tier: 4 }, legendary: { tier: 5 }, mythic: { tier: 6 },
};
export const COLLECTIONS = ['Weapons', 'Defense', 'Utility', 'Magic', 'Cosmic'];

/** Gaya aura -> indeks shader (lihat PowerAura.js). */
export const AURA_STYLE = { soft: 0, wind: 1, fire: 2, ice: 3, lightning: 4, smoke: 5, ender: 6, flame: 7, cosmic: 6 };

/** Default per Effect Tier. */
const tier = (glow, shake, rings, d, layers, speed, count, size) => ({
  glow, shake, rings,
  aura: { auraIntensity: 0.5 + d * 0.18, auraRadius: 0.04 + d * 0.01, auraOpacity: 0.35 + d * 0.07, pulseSpeed: 1.2 + d * 0.15, rotationSpeed: 0.3 + d * 0.1, layerCount: layers, particleDensity: d },
  particle: { particleCount: count, particleSize: size, particleSpeed: speed, particleLifetime: 1, particleOpacity: 0.9, spreadRadius: 1.2, gravity: 0 },
});
export const TIER = {
  1: tier(0.4, 0.3, 1, 1, 1, 1.0, 14, 0.05),
  2: tier(0.6, 0.5, 1, 2, 1, 1.1, 20, 0.055),
  3: tier(0.8, 0.8, 2, 3, 2, 1.2, 28, 0.06),
  4: tier(1.0, 1.1, 2, 4, 2, 1.3, 38, 0.065),
  5: tier(1.3, 1.4, 3, 5, 3, 1.4, 50, 0.07),
  6: tier(1.6, 1.8, 3, 6, 3, 1.5, 64, 0.075),
};
