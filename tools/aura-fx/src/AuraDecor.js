/**
 * AuraDecor.js — elemen non-partikel aura, semuanya dikontrol data katalog (fx[]):
 *   ring (cincin kaki berlapis, 15 gaya shader), fog, halo, backRing, glow, wings (voxel bitmap), horns,
 *   silhouette, dragonShadow, arcs (petir voxel), distort.
 * Builder: (spec, ctx) -> { follow:'pos'|'yaw', ground?:true, obj, update(t, dt, s), dispose() }
 * ground:true = menempel ke LANTAI (cincin & kabut): tetap di lantai saat karakter melompat, tidak ikut terangkat.
 *   ctx = { u, q, layers, paint(colorObj, hex) }   s = { env, inten, size, air, pulse, tintV }
 */
import * as THREE from 'three';
import { TAU, clamp, lerp, rnd, smooth } from './AuraConfig.js';

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
  #include <colorspace_fragment>
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
  #include <colorspace_fragment>
}`;
const SHELL_V = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const SHELL_F = `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uColor, f * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let _radial;
function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c); _radial.colorSpace = THREE.SRGBColorSpace;
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
export const DECOR = {
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
