/**
 * PowerParticles.js — sistem partikel ber-pool (ring buffer) berbasis THREE.Points + shader.
 * Dua pool: additive (cahaya/api/percikan) dan normal (debu/asap/bulu). Kapasitas dari QUALITY.particleCap.
 * Perilaku: spawn, follow/orbit (mode 1), burst, trail (lewat emit berulang), fade, disappear.
 */
import * as THREE from 'three';

/** Gaya per particleType: shape 0=glow 1=spark 2=pixel 3=shard 4=feather 5=smoke. grav>0 jatuh, <0 naik. */
export const PARTICLE_STYLES = {
  spark:   { shape: 1, add: true,  size: 1.1, speed: 1.2, grav: 3,    drag: 1.2, grow: 0.4, life: 0.8 },
  dust:    { shape: 5, add: false, size: 1.2, speed: 0.25, grav: 0,   drag: 1,   grow: 1.8, life: 1.6, alpha: 0.35 },
  debris:  { shape: 2, add: false, size: 1,   speed: 1,   grav: 9,    drag: 0.3, grow: 1,   life: 0.9 },
  smoke:   { shape: 5, add: false, size: 3,   speed: 0.5, grav: -0.6, drag: 1,   grow: 3,   life: 1.6, alpha: 0.45 },
  feather: { shape: 4, add: false, size: 2.4, speed: 0.6, grav: 0.7,  drag: 1.5, grow: 1,   life: 2.2, spin: 2 },
  sparkle: { shape: 1, add: true,  size: 1.1, speed: 0.5, grav: -0.2, drag: 1,   grow: 0.5, life: 1.1 },
  shard:   { shape: 3, add: true,  size: 1.3, speed: 1,   grav: 2,    drag: 0.8, grow: 0.6, life: 1.1, spin: 3 },
  energy:  { shape: 0, add: true,  size: 1.4, speed: 0.7, grav: -0.8, drag: 1,   grow: 0.3, life: 1.3 },
  ender:   { shape: 1, add: true,  size: 1.2, speed: 0.6, grav: 0,    drag: 1,   grow: 0.3, life: 1.4 },
  flame:   { shape: 0, add: true,  size: 1.8, speed: 0.5, grav: -2.2, drag: 1.2, grow: 0.2, life: 0.9 },
  ember:   { shape: 0, add: true,  size: 0.9, speed: 0.6, grav: -0.9, drag: 0.6, grow: 0.3, life: 1.5 },
  water:   { shape: 0, add: true,  size: 1.1, speed: 0.8, grav: 1.5,  drag: 0.5, grow: 0.5, life: 1.1 },
  snow:    { shape: 0, add: false, size: 1,   speed: 0.2, grav: 0.35, drag: 1,   grow: 1,   life: 3, alpha: 0.7 },
  star:    { shape: 1, add: true,  size: 1.3, speed: 0.5, grav: 0,    drag: 0.8, grow: 0.4, life: 1.8 },
};
export const styleOf = (t) => PARTICLE_STYLES[t] || PARTICLE_STYLES[/star|cosmic|celest/i.test(t || '') ? 'star' : 'sparkle'];

const VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aShape; attribute float aRot;
uniform float uScale;
varying float vA; varying vec3 vC; varying float vS; varying float vR;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vA = aAlpha; vC = aColor; vS = aShape; vR = aRot;
}`;

const FRAG = /* glsl */ `
varying float vA; varying vec3 vC; varying float vS; varying float vR;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vR), s = sin(vR); p = mat2(c, -s, s, c) * p;
  float d = length(p), a = 0.0;
  if (vS < 0.5) { a = smoothstep(0.5, 0.0, d); a *= a; }
  else if (vS < 1.5) { a = pow(max(0.0, 1.0 - abs(p.x) * abs(p.y) * 40.0), 4.0) * smoothstep(0.5, 0.0, d); }
  else if (vS < 2.5) { a = 1.0 - smoothstep(0.34, 0.4, max(abs(p.x), abs(p.y))); }
  else if (vS < 3.5) { a = 1.0 - smoothstep(0.36, 0.44, abs(p.x) * 2.2 + abs(p.y) * 0.9); }
  else if (vS < 4.5) { float e = length(p * vec2(3.2, 0.9)); a = (1.0 - smoothstep(0.4, 0.5, e)) * (0.8 + 0.4 * (1.0 - smoothstep(0.0, 0.05, abs(p.y)))); }
  else { a = smoothstep(0.5, 0.1, d) * 0.6; }
  float al = a * vA;
  if (al < 0.01) discard;
  gl_FragColor = vec4(vC, al);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(cap, additive) {
    this.cap = cap; this.head = 0; this.aliveCount = 0;
    const f3 = () => new Float32Array(cap * 3), f1 = () => new Float32Array(cap);
    this.pos = f3(); this.vel = f3(); this.col = f3();
    this.size = f1(); this.alpha = f1(); this.shape = f1(); this.rot = f1();
    this.life = f1(); this.max = f1(); this.s0 = f1(); this.a0 = f1();
    this.grav = f1(); this.drag = f1(); this.grow = f1(); this.spin = f1();
    this.mode = f1(); this.ang = f1(); this.rad = f1(); this.h = f1(); this.w = f1();
    const g = new THREE.BufferGeometry();
    const A = (n, arr, k) => g.setAttribute(n, new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage));
    A('position', this.pos, 3); A('aColor', this.col, 3); A('aSize', this.size, 1); A('aAlpha', this.alpha, 1); A('aShape', this.shape, 1); A('aRot', this.rot, 1);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 4 : 3;
  }

  emit(o) {
    const i = this.head; this.head = (i + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = o.x; this.pos[k + 1] = o.y; this.pos[k + 2] = o.z;
    this.vel[k] = o.vx || 0; this.vel[k + 1] = o.vy || 0; this.vel[k + 2] = o.vz || 0;
    this.col[k] = o.r; this.col[k + 1] = o.g; this.col[k + 2] = o.b;
    this.life[i] = this.max[i] = o.life; this.s0[i] = o.size; this.a0[i] = o.alpha ?? 1;
    this.shape[i] = o.shape || 0; this.rot[i] = Math.random() * 6.283; this.spin[i] = o.spin || 0;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag ?? 1; this.grow[i] = o.grow ?? 1;
    this.mode[i] = o.mode || 0; this.ang[i] = o.ang || 0; this.rad[i] = o.rad || 0; this.h[i] = o.h || 0; this.w[i] = o.w || 0;
    this.size[i] = o.size; this.alpha[i] = 0;
  }

  update(dt, anchor) {
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.size[i] = 0; this.alpha[i] = 0; continue; }
      alive++;
      const k = i * 3, f = 1 - this.life[i] / this.max[i];
      if (this.mode[i] === 0) {
        this.vel[k + 1] -= this.grav[i] * dt;
        const dmp = Math.exp(-this.drag[i] * dt);
        this.vel[k] *= dmp; this.vel[k + 1] *= dmp; this.vel[k + 2] *= dmp;
        this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      } else {
        this.ang[i] += this.w[i] * dt;
        this.rad[i] = Math.max(0.02, this.rad[i] + this.vel[k] * dt);
        this.h[i] += this.vel[k + 1] * dt;
        this.pos[k] = anchor.x + Math.cos(this.ang[i]) * this.rad[i];
        this.pos[k + 1] = anchor.y + this.h[i];
        this.pos[k + 2] = anchor.z + Math.sin(this.ang[i]) * this.rad[i];
      }
      this.rot[i] += this.spin[i] * dt;
      this.size[i] = this.s0[i] * (1 + (this.grow[i] - 1) * f);
      this.alpha[i] = this.a0[i] * Math.min(1, f / 0.12) * (1 - f);
    }
    this.aliveCount = alive;
    for (const n of ['position', 'aSize', 'aAlpha', 'aRot', 'aShape', 'aColor']) this.geo.attributes[n].needsUpdate = true;
  }

  dispose() { this.points.parent?.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

export class PowerParticles {
  constructor(scene, q) {
    this.q = q;
    const cap = q.particleCap;
    this.add = new Pool(cap, true);
    this.norm = new Pool(Math.max(48, Math.round(cap * 0.35)), false);
    this.anchor = new THREE.Vector3();
    scene.add(this.add.points, this.norm.points);
  }
  /** o: {x,y,z,vx,vy,vz,r,g,b,size,life,alpha,shape,add,grav,drag,grow,spin,mode,ang,rad,h,w} */
  emit(o) { (o.add === false ? this.norm : this.add).emit(o); }
  /** scale = tinggi drawing buffer / (2*tan(fov/2)) agar ukuran partikel konsisten dalam satuan dunia. */
  setScale(s) { this.add.mat.uniforms.uScale.value = s; this.norm.mat.uniforms.uScale.value = s; }
  update(dt) { this.add.update(dt, this.anchor); this.norm.update(dt, this.anchor); }
  get alive() { return this.add.aliveCount + this.norm.aliveCount; }
  dispose() { this.add.dispose(); this.norm.dispose(); }
}
