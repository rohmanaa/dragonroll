/**
 * DiceMaterials.js — tekstur prosedural (canvas) + MeshPhysicalMaterial per dadu.
 *
 * Tidak butuh aset gambar. Setiap dadu: 6 material (satu per face) agar pip 1–6 tepat.
 * Hasil di-cache dan dibuang (dispose) saat dadu tidak dipakai agar hemat memori GPU di Android.
 */
import * as THREE from '../vendor/three.r170.module.min.js';
import { D6_FACES } from './DiceCatalog.js';
import { paintFace } from './DiceTextures.js';

/**
 * Bangun 6 material untuk satu dadu.
 * @returns {{materials: THREE.MeshPhysicalMaterial[], dispose: Function, baseEmissive: number}}
 */
export function createDiceMaterials(die, quality) {
  const m = die.material, e = die.effect, S = quality.texture;
  const textures = [];
  const materials = D6_FACES.map((face, i) => {
    const { canvas: cv, glow: gcv } = paintFace(die, face.value, S, true);

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

