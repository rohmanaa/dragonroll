/**
 * PowerMaterials.js — MeshPhysicalMaterial (PBR) + tekstur prosedural bergaya pixel Minecraft.
 * createMaterialSet(item, quality) -> { slots:{main,accent,dark,glow,extra}, setGlow(mult), dispose() }
 * Spesifikasi slot dibaca dari item.mat (lihat singkatan di PowerCatalog.js).
 */
import * as THREE from 'three';
import { clamp } from './PowerConfig.js';

/** pola katalog -> jenis painter */
const KIND = {
  iron: 'noise', woodgrip: 'rows', wood: 'planks', tnt: 'tnt', tntTop: 'tntTop', feather: 'feather', goldApple: 'apple',
  diamond: 'cells', totem: 'diag', totemFace: 'face', ender: 'veins', ember: 'veins', packedIce: 'cells', netherite: 'cells',
  blazeHead: 'noise', blazeFace: 'face', prismarine: 'cells', dragon: 'veins',
};
const SMOOTH = new Set(['feather', 'apple']);

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }

function paint(kind, c1, c2, size, seed) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const x = cv.getContext('2d');
  const R = rng(hash(seed));
  const A = new THREE.Color(c1), B = new THREE.Color(c2);
  const G = 16, px = size / G;
  const col = (t) => '#' + A.clone().lerp(B, clamp(t)).getHexString();
  const cell = (i, j, t, w = 1, h = 1) => { x.fillStyle = col(t); x.fillRect(i * px, j * px, w * px + 1, h * px + 1); };
  const each = (fn) => { for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) cell(i, j, fn(i, j)); };

  switch (kind) {
    case 'planks': { const tone = [R() * 0.5, R() * 0.5, R() * 0.5, R() * 0.5]; each((i) => tone[(i / 4) | 0] * 0.8 + R() * 0.2 + (i % 4 === 0 ? 0.4 : 0)); break; }
    case 'rows': each((i, j) => (j % 3 === 0 ? 0.6 : 0.15) + R() * 0.25); break;
    case 'diag': each((i, j) => ((i + j) % 6 < 2 ? 0.95 : 0.05) + R() * 0.1); break;
    case 'feather': each((i, j) => 0.12 + ((i * 3 + j) % 7 === 0 ? 0.3 : 0) + R() * 0.1); break;
    case 'apple': each((i, j) => (j / G) * 0.35 + R() * 0.12 + (R() > 0.93 ? 0.4 : 0)); break;
    case 'cells': {
      each(() => R() * 0.2);
      for (let k = 0; k < 36; k++) cell((R() * G) | 0, (R() * G) | 0, R(), 1 + ((R() * 3) | 0), 1 + ((R() * 3) | 0));
      break;
    }
    case 'veins': {
      each(() => R() * 0.22);
      for (let k = 0; k < 5; k++) { let i = (R() * G) | 0, j = (R() * G) | 0; for (let s = 0; s < 12; s++) { cell(i, j, 0.8 + R() * 0.2); i = (i + ((R() * 3) | 0) - 1 + G) % G; j = (j + 1) % G; } }
      break;
    }
    case 'face': {
      each(() => R() * 0.12);
      for (const [i, j] of [[4, 6], [5, 6], [4, 7], [5, 7], [10, 6], [11, 6], [10, 7], [11, 7]]) cell(i, j, 1);
      for (let i = 5; i <= 10; i++) cell(i, 11, 0.9);
      break;
    }
    case 'tnt': {
      each(() => R() * 0.08);
      for (let j = 5; j <= 10; j++) for (let i = 0; i < G; i++) cell(i, j, 0.9 + R() * 0.1);
      x.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 0; i < G; i += 4) x.fillRect(i * px, 0, 1.5, 5 * px);
      x.fillStyle = '#161616';
      x.fillRect(0, 4.7 * px, size, 0.35 * px); x.fillRect(0, 10.95 * px, size, 0.35 * px);
      x.font = `bold ${px * 3.4}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('TNT', size / 2, size * 0.5);
      break;
    }
    case 'tntTop': {
      each(() => R() * 0.1);
      each((i, j) => { const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5)); return d > 4.5 && d < 6 ? 0.9 : R() * 0.1; });
      x.fillStyle = '#222'; x.fillRect(7 * px, 7 * px, 2 * px, 2 * px);
      break;
    }
    default: each(() => R() * 0.3);
  }
  return cv;
}

function makeTex(kind, c1, c2, size, seed) {
  const t = new THREE.CanvasTexture(paint(kind, c1, c2, size, seed));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (!SMOOTH.has(kind)) t.magFilter = THREE.NearestFilter;
  return t;
}

const SLOTS = ['main', 'accent', 'dark', 'extra', 'glow'];

export function createMaterialSet(item, q) {
  const specs = item.mat || {};
  const texCache = new Map(), textures = [], mats = [], slots = {};
  const prim = item.colors?.primary || '#cccccc';

  const getTex = (p, c, c2) => {
    const key = `${p}|${c}|${c2}`;
    if (!texCache.has(key)) { const t = makeTex(KIND[p] || 'noise', c, c2 || c, q.texture, key); texCache.set(key, t); textures.push(t); }
    return texCache.get(key);
  };

  const make = (s) => {
    const m = new THREE.MeshPhysicalMaterial({ color: s.p ? 0xffffff : s.c, roughness: s.r ?? 0.5, metalness: s.m ?? 0 });
    if (s.p) {
      const map = getTex(s.p, s.c, s.c2);
      m.map = map;
      if (q.bump) { m.bumpMap = map; m.bumpScale = 1.2; }
      if (s.e) m.emissiveMap = map;
    }
    if (s.e) { m.emissive = new THREE.Color(s.e); m.emissiveIntensity = s.ei ?? 1; }
    m.userData.baseEI = s.e ? s.ei ?? 1 : 0;
    if (s.cc && q.clearcoat) { m.clearcoat = s.cc; m.clearcoatRoughness = 0.08; }
    if (s.ior) m.ior = s.ior;
    if (s.o != null && s.o < 1) { m.transparent = true; m.opacity = s.o; m.depthWrite = false; }
    if (s.ds) m.side = THREE.DoubleSide;
    mats.push(m);
    return m;
  };

  const resolved = {};
  resolved.main = specs.main || { c: prim, r: 0.5 };
  resolved.accent = specs.accent || resolved.main;
  resolved.dark = specs.dark || resolved.accent;
  resolved.extra = specs.extra || resolved.accent;
  resolved.glow = specs.glow || { c: prim, e: prim, ei: 1.5, r: 0.3 };
  const made = new Map();
  for (const k of SLOTS) {
    const s = resolved[k];
    if (!made.has(s)) made.set(s, make(s));
    slots[k] = made.get(s);
  }

  return {
    slots,
    setGlow(mult) { for (const m of mats) if (m.userData.baseEI) m.emissiveIntensity = m.userData.baseEI * mult; },
    dispose() { mats.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); },
  };
}
