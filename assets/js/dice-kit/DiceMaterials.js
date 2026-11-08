/**
 * DiceMaterials.js — tekstur prosedural (canvas) + MeshPhysicalMaterial per dadu.
 *
 * Tidak butuh aset gambar. Setiap dadu: 6 material (satu per face) agar pip 1–6 tepat.
 * Hasil di-cache dan dibuang (dispose) saat dadu tidak dipakai agar hemat memori GPU di Android.
 */
import * as THREE from '../vendor/three.r170.module.min.js';
import { D6_FACES } from './DiceCatalog.js';

// ---------- util ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; }
function rgba(h, a) { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// ---------- primitif gambar ----------
const speckle = (c, S, r, colors, n, min, max, a = 1) => { for (let i = 0; i < n; i++) { c.fillStyle = rgba(colors[(r() * colors.length) | 0], a * (0.4 + r() * 0.6)); const s = min + r() * (max - min); c.fillRect(r() * S, r() * S, s, s); } };
const streaks = (c, S, r, col, n, l, w, a, vertical = false) => { c.lineCap = 'round'; for (let i = 0; i < n; i++) { c.strokeStyle = rgba(col, a * (0.3 + r() * 0.7)); c.lineWidth = w * (0.5 + r()); const x = r() * S, y = r() * S, L = l * (0.4 + r() * 0.6); c.beginPath(); c.moveTo(x, y); c.lineTo(vertical ? x + (r() - 0.5) * 4 : x + L, vertical ? y + L : y + (r() - 0.5) * 4); c.stroke(); } };
const veins = (c, S, r, col, n, w, a) => { c.lineCap = 'round'; c.lineJoin = 'round'; for (let i = 0; i < n; i++) { c.strokeStyle = rgba(col, a); c.lineWidth = w * (0.5 + r()); let x = r() * S, y = r() * S, ang = r() * 6.28; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 7; k++) { ang += (r() - 0.5) * 1.6; x += Math.cos(ang) * S * 0.1; y += Math.sin(ang) * S * 0.1; c.lineTo(x, y); } c.stroke(); } };
const blotches = (c, S, r, col, n, rmin, rmax, a) => { for (let i = 0; i < n; i++) { const x = r() * S, y = r() * S, R = rmin + r() * (rmax - rmin); const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - R, y - R, R * 2, R * 2); } };
const facets = (c, S, r, c1, c2, n) => { const cx = S / 2, cy = S / 2; for (let i = 0; i < n; i++) { const a1 = r() * 6.28, a2 = a1 + 0.3 + r() * 0.8, R = S * (0.45 + r() * 0.35); c.fillStyle = rgba(r() > 0.5 ? c1 : c2, 0.1 + r() * 0.3); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); c.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R); c.closePath(); c.fill(); } };
const tiles = (c, S, r, colors, n, grout) => { const t = S / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { c.fillStyle = colors[(r() * colors.length) | 0]; c.fillRect(x * t, y * t, t, t); } c.strokeStyle = grout; c.lineWidth = Math.max(1, S / 128); for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * t, 0); c.lineTo(i * t, S); c.moveTo(0, i * t); c.lineTo(S, i * t); c.stroke(); } };
const scales = (c, S, col, a, rows = 8) => { const R = S / rows; c.strokeStyle = rgba(col, a); c.lineWidth = Math.max(1, S / 90); for (let y = 0; y < rows + 1; y++) for (let x = 0; x < rows + 1; x++) { c.beginPath(); c.arc(x * R + (y % 2 ? R / 2 : 0), y * R * 0.6, R / 2, 0, Math.PI); c.stroke(); } };
const swirl = (c, S, r, col, a) => { c.strokeStyle = rgba(col, a); c.lineWidth = S / 70; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(S * (0.3 + r() * 0.4), S * (0.3 + r() * 0.4), S * (0.08 + i * 0.07), r() * 6, r() * 6 + 3.5); c.stroke(); } };
const border = (c, S, light, dark) => { const b = Math.max(2, S / 40); c.lineWidth = b; c.strokeStyle = rgba(light, 0.35); c.strokeRect(b / 2, b / 2, S - b, S - b); c.strokeStyle = rgba(dark, 0.35); c.strokeRect(b * 1.5, b * 1.5, S - b * 3, S - b * 3); };
const gradient = (c, S, a, b) => { const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, S, S); };

// ---------- pola per material: (c, g, S, r, m) — c = warna, g = peta glow (opsional) ----------
const PATTERNS = {
  plain(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); if (m.stripes) { c.fillStyle = rgba(m.accent, 0.55); c.fillRect(0, S * 0.06, S, S * 0.07); c.fillRect(0, S * 0.87, S, S * 0.07); } speckle(c, S, r, m.speckle || [m.accent], m.speckle ? 260 : 90, S / 120, S / 36, m.speckle ? 0.6 : 0.25); border(c, S, '#ffffff', '#000000'); },
  wood(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); streaks(c, S, r, m.accent, 70, S * 0.9, S / 90, 0.5); streaks(c, S, r, '#c89a5a', 25, S * 0.7, S / 120, 0.25); for (let i = 0; i < 2; i++) { const x = r() * S, y = r() * S; c.strokeStyle = rgba(m.accent, 0.5); c.lineWidth = S / 80; for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y, S * 0.02 * k, S * 0.012 * k, 0, 0, 6.28); c.stroke(); } } border(c, S, '#c89a5a', '#2a1808'); },
  stone(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, m.accent, 14, S * 0.05, S * 0.18, 0.35); speckle(c, S, r, [m.accent, '#a4a4a8', '#606064'], 500, S / 100, S / 40); veins(c, S, r, '#4a4a4e', 2, S / 200, 0.5); border(c, S, '#b0b0b4', '#2a2a2e'); },
  metal(c, g, S, r, m) { gradient(c, S, m.base, m.accent); streaks(c, S, r, '#ffffff', 90, S * 0.8, S / 200, 0.18); streaks(c, S, r, '#000000', 60, S * 0.8, S / 200, 0.12); speckle(c, S, r, ['#ffffff'], 40, 1, S / 90, 0.3); border(c, S, '#ffffff', '#000000'); },
  gold(c, g, S, r, m) { gradient(c, S, m.base, m.accent); streaks(c, S, r, '#ffffff', 60, S * 0.7, S / 220, 0.2); c.fillStyle = rgba('#ffffff', 0.1); c.fillRect(S * 0.12, S * 0.12, S * 0.76, S * 0.76); speckle(c, S, r, ['#fff8c0', '#c89a10'], 80, 1, S / 70, 0.5); border(c, S, '#fff8c0', '#8a6000'); },
  gem(c, g, S, r, m) { const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75); gr.addColorStop(0, m.accent); gr.addColorStop(1, m.base); c.fillStyle = gr; c.fillRect(0, 0, S, S); facets(c, S, r, '#ffffff', '#000000', 18); speckle(c, S, r, ['#ffffff'], 18, 1, S / 60, 0.6); border(c, S, '#ffffff', '#000000'); },
  lapis(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, m.accent, 22, S * 0.04, S * 0.16, 0.5); blotches(c, S, r, '#4a70e0', 12, S * 0.03, S * 0.1, 0.4); speckle(c, S, r, ['#e8c840', '#f4e6a0'], 90, 1, S / 55, 0.9); speckle(c, S, r, ['#ffffff'], 40, 1, S / 80, 0.7); border(c, S, '#8aa4ff', '#0a1440'); },
  amethyst(c, g, S, r, m) { const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.7); gr.addColorStop(0, m.accent); gr.addColorStop(1, m.base); c.fillStyle = gr; c.fillRect(0, 0, S, S); facets(c, S, r, '#ffffff', '#2a0a50', 22); for (let i = 0; i < 9; i++) { const x = r() * S, y = r() * S, s = S * (0.04 + r() * 0.05); c.fillStyle = rgba(r() > 0.5 ? '#f0d8ff' : '#5a24a0', 0.5); c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.6, y + s * 0.4); c.lineTo(x - s * 0.6, y + s * 0.4); c.fill(); } border(c, S, '#f0d8ff', '#2a0a50'); },
  redstone(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, '#2a0000', 14, S * 0.05, S * 0.15, 0.6); speckle(c, S, r, ['#ff2a2a', '#ff6a4a', '#aa0000'], 380, S / 100, S / 28, 0.9); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); speckle(g, S, r, ['#ff4a3a', '#ffa090'], 140, S / 100, S / 30, 0.9); } border(c, S, '#ff5a4a', '#200000'); },
  obsidian(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, '#2a1850', 10, S * 0.06, S * 0.2, 0.5); veins(c, S, r, m.accent, 6, S / 110, 0.6); streaks(c, S, r, '#ffffff', 25, S * 0.4, S / 260, 0.1); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); veins(g, S, r, '#ffffff', 6, S / 120, 0.8); } border(c, S, '#8a5cff', '#000000'); },
  magma(c, g, S, r, m) { tiles(c, S, r, ['#1a0d0a', '#241410', '#120808', '#2e1a12'], 6, '#050202'); veins(c, S, r, '#ff5a10', 9, S / 60, 0.9); veins(c, S, r, '#ffc040', 5, S / 110, 0.9); blotches(c, S, r, '#ff4a00', 8, S * 0.05, S * 0.14, 0.5); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); veins(g, S, r, '#ff8a20', 9, S / 60, 1); veins(g, S, r, '#ffe080', 5, S / 110, 1); blotches(g, S, r, '#ff5a00', 8, S * 0.05, S * 0.12, 0.7); } },
  ice(c, g, S, r, m) { gradient(c, S, '#d8f0ff', m.base); blotches(c, S, r, '#ffffff', 14, S * 0.05, S * 0.2, 0.45); streaks(c, S, r, '#ffffff', 40, S * 0.5, S / 160, 0.4); facets(c, S, r, '#ffffff', '#4a9ad8', 10); speckle(c, S, r, ['#ffffff'], 40, 1, S / 80, 0.7); border(c, S, '#ffffff', '#4a8ac0'); },
  prismarine(c, g, S, r, m) { tiles(c, S, r, [m.base, m.accent, '#3ad0b8', '#58d8a0', '#1a7a68'], 8, '#0a3a34'); blotches(c, S, r, '#aaffee', 10, S * 0.04, S * 0.12, 0.3); border(c, S, '#aaffee', '#08302a'); },
  quartz(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, '#ffd0e0', 12, S * 0.06, S * 0.2, 0.35); veins(c, S, r, m.accent, 5, S / 130, 0.4); streaks(c, S, r, '#ffffff', 50, S * 0.7, S / 140, 0.5); streaks(c, S, r, '#e0a0b8', 20, S * 0.5, S / 200, 0.25); border(c, S, '#ffffff', '#d890a8'); },
  crying(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, '#241048', 10, S * 0.06, S * 0.2, 0.6); veins(c, S, r, '#5a1ab0', 4, S / 120, 0.6); streaks(c, S, r, m.accent, 26, S * 0.35, S / 70, 0.85, true); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); streaks(g, S, r, '#ffffff', 26, S * 0.35, S / 70, 0.9, true); } border(c, S, '#a050ff', '#000000'); },
  netherite(c, g, S, r, m) { gradient(c, S, '#3a3436', '#1e1a1c'); streaks(c, S, r, '#000000', 60, S * 0.6, S / 160, 0.3); speckle(c, S, r, [m.accent, '#5a4a3a', '#c8905a'], 200, 1, S / 45, 0.8); tiles(c, S, r, ['rgba(0,0,0,0)'], 4, rgba('#c8905a', 0.35)); border(c, S, '#c8905a', '#000000'); },
  sculk(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, '#12507a', 12, S * 0.05, S * 0.16, 0.6); blotches(c, S, r, m.accent, 14, S * 0.02, S * 0.07, 0.8); veins(c, S, r, '#22d3ee', 3, S / 140, 0.5); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); blotches(g, S, r, '#ffffff', 14, S * 0.02, S * 0.07, 0.9); veins(g, S, r, '#8affff', 3, S / 140, 0.6); } border(c, S, '#22d3ee', '#020a14'); },
  ender(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); blotches(c, S, r, '#3a1070', 10, S * 0.06, S * 0.2, 0.6); swirl(c, S, r, m.accent, 0.7); swirl(c, S, r, '#40ffa0', 0.4); speckle(c, S, r, ['#ff7af0', '#ffffff'], 60, 1, S / 70, 0.9); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); swirl(g, S, r, '#ffffff', 0.8); speckle(g, S, r, ['#ffffff'], 60, 1, S / 70, 1); } border(c, S, '#e020c8', '#05000a'); },
  dragon(c, g, S, r, m) { c.fillStyle = m.base; c.fillRect(0, 0, S, S); scales(c, S, m.accent, 0.8); scales(c, S, '#7a20c0', 0.35, 6); blotches(c, S, r, '#400010', 10, S * 0.06, S * 0.16, 0.6); veins(c, S, r, '#a020ff', 3, S / 130, 0.5); if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); scales(g, S, '#ffffff', 0.7); veins(g, S, r, '#c060ff', 3, S / 130, 0.7); } border(c, S, '#ff3040', '#000000'); },
};

// ---------- pip ----------
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.3, 0.25], [0.3, 0.5], [0.3, 0.75], [0.7, 0.25], [0.7, 0.5], [0.7, 0.75]],
};
export const PIP_LAYOUTS = PIPS;

function drawPips(c, g, S, value, pip) {
  const R = S * 0.085;
  for (const [px, py] of PIPS[value]) {
    const x = px * S, y = py * S;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(x, y, R * 1.18, 0, 6.28); c.fill(); // cekungan pip
    c.fillStyle = pip.color; c.beginPath(); c.arc(x, y, R, 0, 6.28); c.fill();
    const hl = c.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R);
    hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.beginPath(); c.arc(x, y, R, 0, 6.28); c.fill();
    if (g && pip.glow) { const gg = g.createRadialGradient(x, y, 0, x, y, R * 1.3); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.75, 'rgba(255,255,255,0.9)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, R * 1.3, 0, 6.28); g.fill(); }
  }
}

function makeCanvas(S) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv;
}

/**
 * Bangun 6 material untuk satu dadu.
 * @returns {{materials: THREE.MeshPhysicalMaterial[], dispose: Function, baseEmissive: number}}
 */
export function createDiceMaterials(die, quality) {
  const m = die.material, e = die.effect, S = quality.texture;
  const textures = [];
  const materials = D6_FACES.map((face, i) => {
    const r = mulberry32(hashStr(die.id) + i * 7919);
    const cv = makeCanvas(S), c = cv.getContext('2d');
    let gcv = null, g = null;
    if (m.glowMap) { gcv = makeCanvas(S); g = gcv.getContext('2d'); }
    PATTERNS[m.pattern](c, g, S, r, m);
    drawPips(c, g, S, face.value, m.pip);

    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = quality.texture >= 256 ? 4 : 1;
    textures.push(map);
    let emissiveMap = map;
    if (gcv) { emissiveMap = new THREE.CanvasTexture(gcv); emissiveMap.colorSpace = THREE.SRGBColorSpace; textures.push(emissiveMap); }

    return new THREE.MeshPhysicalMaterial({
      map,
      color: 0xffffff,
      roughness: m.roughness,
      metalness: m.metalness,
      emissive: new THREE.Color(m.emissive || e.glowColor || '#ffffff'),
      emissiveMap,
      emissiveIntensity: e.emissiveIntensity,
      clearcoat: quality.clearcoat ? (m.clearcoat ?? 0) : 0,
      clearcoatRoughness: m.clearcoatRoughness ?? 0.15,
      envMapIntensity: m.envMapIntensity ?? 1,
    });
  });
  return {
    materials,
    baseEmissive: e.emissiveIntensity,
    dispose() { materials.forEach((mt) => mt.dispose()); textures.forEach((t) => t.dispose()); },
  };
}

/** Cache kecil (LRU) agar berpindah dadu cepat tetapi memori GPU tidak membengkak. */
export class MaterialCache {
  constructor(max = 3) { this.max = max; this.map = new Map(); }
  get(die, quality) {
    const key = die.id + ':' + quality.texture + ':' + quality.clearcoat;
    if (this.map.has(key)) { const v = this.map.get(key); this.map.delete(key); this.map.set(key, v); return v; }
    const v = createDiceMaterials(die, quality);
    this.map.set(key, v);
    while (this.map.size > this.max) { const [k, old] = this.map.entries().next().value; old.dispose(); this.map.delete(k); }
    return v;
  }
  /** Lindungi entry yang sedang dipakai agar tidak ter-dispose saat render. */
  clear() { this.map.forEach((v) => v.dispose()); this.map.clear(); }
}

/**
 * Thumbnail kubus isometrik statis (tanpa animasi) memakai tekstur ASLI dadu yang sama dengan preview 3D
 * (pola + warna + pip dari PATTERNS/drawPips), jadi warnanya persis sama, bukan warna perkiraan.
 * Muka atas = 1, kiri = 3, kanan = 2. Kanvas dipotong rapat mengikuti bentuk kubus.
 */
const THUMB_CACHE = new Map();
export function diceThumbDataURL(die, px = 160) {
  const key = die.id + ':' + px;
  if (THUMB_CACHE.has(key)) return THUMB_CACHE.get(key);
  const S = 128, face = (value) => {
    const i = D6_FACES.findIndex((f) => f.value === value);
    const r = mulberry32(hashStr(die.id) + i * 7919), cv = makeCanvas(S), c = cv.getContext('2d');
    PATTERNS[die.material.pattern](c, null, S, r, die.material);
    drawPips(c, null, S, value, die.material.pip);
    return cv;
  };
  // sistem koordinat 64x64 yang sama dengan ItemArt.dice; dipotong ke kotak pas kubus (x 6..58, y 4..60)
  const X0 = 6, Y0 = 4, W = 52, H = 56, k = px / H;
  const cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = px;
  const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high';
  const paint = (img, a, b, cc, d, e, f, shade) => {
    c.save(); c.setTransform(k * a / S, k * b / S, k * cc / S, k * d / S, k * (e - X0), k * (f - Y0)); c.drawImage(img, 0, 0);
    if (shade) { c.fillStyle = shade; c.fillRect(0, 0, S, S); }
    c.restore();
  };
  paint(face(1), 25, -14, 25, 14, 7, 19, 'rgba(255,255,255,0.10)');
  paint(face(3), 25, 14, 0, 26, 7, 19, null);
  paint(face(2), 25, -14, 0, 26, 32, 33, 'rgba(0,0,0,0.30)');
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = Math.max(1.5, k * 1.4); c.lineJoin = 'round';
  const P = (x, y) => [k * (x - X0), k * (y - Y0)];
  const poly = (pts) => { c.beginPath(); pts.forEach(([x, y], n) => { const [X, Y] = P(x, y); n ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke(); };
  poly([[32, 5], [57, 19], [32, 33], [7, 19]]); poly([[7, 19], [32, 33], [32, 59], [7, 45]]); poly([[32, 33], [57, 19], [57, 45], [32, 59]]);
  const url = cv.toDataURL('image/png');
  THUMB_CACHE.set(key, url);
  return url;
}
