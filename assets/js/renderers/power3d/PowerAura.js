/**
 * PowerAura.js — aura yang MENGIKUTI BENTUK objek: tiap mesh model diberi "shell" (geometri yang sama,
 * normal dihaluskan, digelembungkan sepanjang normal) dengan shader fresnel + pola per gaya
 * (soft/energy/fire/frost/electric/dark/cosmic/dragon). Ditambah halo sprite lembut.
 * Properti aura bisa diubah runtime lewat setProps().
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { AURA_STYLE } from './PowerConfig.js';

let _radial;
export function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  _radial.colorSpace = THREE.SRGBColorSpace;
  return _radial;
}

const VERT = /* glsl */ `
uniform float uRadius; uniform float uLayer;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){
  vec3 p = position + normal * uRadius * (1.0 + uLayer * 0.9);
  vP = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2;
uniform float uTime; uniform float uIntensity; uniform float uOpacity; uniform float uStyle;
uniform float uLayer; uniform float uFade; uniform float uRot;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main(){
  float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.2);
  vec3 q = vP; float cr = cos(uRot), sr = sin(uRot); q.xz = mat2(cr, -sr, sr, cr) * q.xz;
  float pat = 1.0; vec3 col = uC1;
  int st = int(uStyle + 0.5);
  if (st == 0) { pat = 0.7 + 0.3 * noise(q * 2.0 + uTime * 0.3); }
  else if (st == 1) { float b = sin(q.y * 6.0 - uTime * 3.0 + noise(q * 3.0) * 2.0); pat = 0.5 + 0.5 * b; col = mix(uC1, uC2, pat); }
  else if (st == 2 || st == 7) {
    float n = noise(q * 3.0 - vec3(0.0, uTime * 2.2, 0.0)) * 0.6 + noise(q * 7.0 - vec3(0.0, uTime * 4.0, 0.0)) * 0.4;
    pat = smoothstep(0.25, 0.8, n + q.y * 0.15); col = mix(uC1, uC2, n);
    if (st == 7) { pat *= 0.6 + 0.4 * step(0.55, noise(q * 5.0 + uTime * 0.5)); col = mix(col, uC2, 0.35); }
  }
  else if (st == 3) { float n = noise(q * 10.0); pat = 0.4 + 0.6 * smoothstep(0.55, 0.9, n) + 0.2 * sin(uTime * 2.0 + n * 20.0); col = mix(uC1, uC2, n); }
  else if (st == 4) { float n = noise(q * 6.0 + uTime * 1.5); float l = 1.0 - smoothstep(0.0, 0.07, abs(n - 0.5)); pat = 0.25 + l * 1.6; col = mix(uC1, uC2, l); }
  else if (st == 5) { pat = 0.5 + 0.5 * noise(q * 2.5 - vec3(0.0, uTime * 0.5, 0.0)); col = uC1 * (0.6 + 0.8 * noise(q * 5.0)); }
  else { float n = noise(q * 3.0 + uTime * 0.2); float sp = step(0.93, noise(q * 18.0 + floor(uTime * 2.0))); pat = 0.5 + 0.5 * n + sp * 2.0; col = mix(uC1, uC2, 0.5 + 0.5 * sin(q.y * 3.0 + uTime + n * 4.0)); }
  float a = (fres * 1.2 + 0.12) * pat * uIntensity * uOpacity * uFade / (1.0 + uLayer * 0.6);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PowerAura {
  /** @param model grup hasil buildModel (userData.scale dipakai agar radius aura dalam satuan dunia) */
  constructor(item, model, q) {
    this.item = item; this.model = model; this.q = q;
    this.k = model.userData.scale || 1;
    const a = item.aura;
    this.props = {
      enabled: a.enabled !== false,
      auraColor: a.color || item.colors.primary,
      auraColor2: a.color2 || a.color || item.colors.secondary,
      auraIntensity: a.auraIntensity ?? 1, auraRadius: a.auraRadius ?? 0.05, auraOpacity: a.auraOpacity ?? 0.6,
      pulseSpeed: a.pulseSpeed ?? 1.5, rotationSpeed: a.rotationSpeed ?? 0.5, layerCount: a.layerCount ?? 1,
      particleDensity: a.particleDensity ?? 1,
    };
    this.style = AURA_STYLE[a.type] ?? 0;
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: this.props.auraColor, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    this.halo.scale.setScalar(item.size * 2.6);
    this.halo.renderOrder = -1;
    this.mats = []; this.shells = []; this.geos = new Map();
    this._build();
  }

  _geo(src) {
    if (!this.geos.has(src.uuid)) {
      let g = src.clone();
      for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n);
      g.clearGroups();
      g = mergeVertices(g, 1e-3);
      g.computeVertexNormals();
      this.geos.set(src.uuid, g);
    }
    return this.geos.get(src.uuid);
  }

  _clear() {
    for (const s of this.shells) s.parent?.remove(s);
    this.shells.length = 0;
    this.mats.forEach((m) => m.dispose());
    this.mats.length = 0;
  }

  _build() {
    this._clear();
    const meshes = [];
    this.model.traverse((o) => { if (o.isMesh && !o.userData.noAura) meshes.push(o); });
    let layers = Math.max(1, Math.min(this.props.layerCount, this.q.auraLayers));
    while (layers > 1 && meshes.length * layers > 60) layers--;
    for (let L = 0; L < layers; L++) {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uTime: { value: 0 }, uIntensity: { value: 1 },
          uOpacity: { value: 0.6 }, uStyle: { value: this.style }, uLayer: { value: L }, uFade: { value: 0 }, uRot: { value: 0 }, uRadius: { value: 0.05 },
        },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.mats.push(m);
      for (const mesh of meshes) {
        const s = new THREE.Mesh(this._geo(mesh.geometry), m);
        s.renderOrder = 2; s.raycast = () => {};
        mesh.add(s); this.shells.push(s);
      }
    }
    this._layers = this.props.layerCount;
  }

  /** Ubah properti aura saat runtime (enabled, auraColor, auraIntensity, auraRadius, auraOpacity, pulseSpeed, rotationSpeed, layerCount, particleDensity). */
  setProps(p) {
    Object.assign(this.props, p);
    if (p.layerCount != null && p.layerCount !== this._layers) this._build();
  }

  update(t, dt, f) {
    const p = this.props, on = p.enabled ? 1 : 0;
    const pulse = 1 + 0.22 * Math.sin(t * p.pulseSpeed * 2);
    const inten = p.auraIntensity * pulse * (1 + (f.boost || 0) * 0.9);
    for (const m of this.mats) {
      const u = m.uniforms;
      u.uTime.value = t; u.uIntensity.value = inten * on; u.uOpacity.value = p.auraOpacity; u.uFade.value = f.fade;
      u.uRot.value = t * p.rotationSpeed; u.uRadius.value = p.auraRadius / this.k;
      u.uC1.value.set(p.auraColor); u.uC2.value.set(p.auraColor2);
    }
    this.halo.material.color.set(p.auraColor);
    this.halo.material.opacity = 0.22 * p.auraOpacity * Math.min(1.6, inten) * f.fade * on;
  }

  dispose() {
    this._clear();
    this.geos.forEach((g) => g.dispose());
    this.geos.clear();
    this.halo.parent?.remove(this.halo);
    this.halo.material.dispose();
  }
}
