/**
 * AuraParticles.js — partikel VOXEL ber-pool (ring buffer) memakai InstancedMesh.
 * 6 pool: {cube, plate, shard} x {additive (cahaya), solid (voxel padat berlampu)}.
 * Satu sistem dipakai bersama semua aura -> jumlah draw call tetap (6) berapa pun jumlah karakter.
 * Mode 0 = bebas (velocity, gravity, drag); mode 1 = orbit relatif terhadap anchor hidup (mengikuti karakter).
 */
import * as THREE from 'three';
import { rnd } from './AuraConfig.js';

const GEO = {
  cube: () => new THREE.BoxGeometry(1, 1, 1),
  plate: () => new THREE.BoxGeometry(1, 0.16, 1),
  shard: () => new THREE.BoxGeometry(0.4, 1.7, 0.4),
};
const SHARE = { cubeA: 0.3, plateA: 0.12, shardA: 0.12, cubeS: 0.2, plateS: 0.14, shardS: 0.12 };

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const dummy = new THREE.Object3D();
const tmpC = new THREE.Color();

class VoxelPool {
  constructor(geo, solid, cap) {
    this.cap = cap; this.head = 0; this.aliveCount = 0; this.dirty = true; this.solid = solid;
    const mat = solid
      ? new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, emissive: 0x1c1c1c, flatShading: true })
      : new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = solid ? 2 : 4;
    this.mesh.castShadow = false;
    this.mesh.setColorAt(0, tmpC.set(0xffffff));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO);
    const f3 = () => new Float32Array(cap * 3), f1 = () => new Float32Array(cap);
    this.pos = f3(); this.vel = f3(); this.rot = f3(); this.spn = f3(); this.col = f3();
    this.life = f1(); this.max = f1(); this.size = f1(); this.alpha = f1(); this.grav = f1(); this.drag = f1(); this.grow = f1();
    this.mode = f1(); this.ang = f1(); this.rad = f1(); this.h = f1(); this.w = f1(); this.vy = f1(); this.radV = f1();
    this.tele = f1(); this.bob = f1(); this.phase = f1();
    this.anchor = new Array(cap).fill(null);
  }

  emit(o) {
    const i = this.head; this.head = (i + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = o.x || 0; this.pos[k + 1] = o.y || 0; this.pos[k + 2] = o.z || 0;
    this.vel[k] = o.vx || 0; this.vel[k + 1] = o.vy || 0; this.vel[k + 2] = o.vz || 0;
    this.rot[k] = rnd(0, 6.28); this.rot[k + 1] = rnd(0, 6.28); this.rot[k + 2] = rnd(0, 6.28);
    const s = o.spin || 0;
    this.spn[k] = rnd(-1, 1) * s; this.spn[k + 1] = rnd(-1, 1) * s; this.spn[k + 2] = rnd(-1, 1) * s;
    this.col[k] = o.r; this.col[k + 1] = o.g; this.col[k + 2] = o.b;
    this.life[i] = this.max[i] = o.life; this.size[i] = o.size; this.alpha[i] = o.alpha ?? 1;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag ?? 1; this.grow[i] = o.grow ?? 1;
    this.mode[i] = o.mode || 0; this.ang[i] = o.ang || 0; this.rad[i] = o.rad || 0; this.h[i] = o.h || 0;
    this.w[i] = o.w || 0; this.vy[i] = o.vyO || 0; this.radV[i] = o.radV || 0;
    this.tele[i] = o.tele || 0; this.bob[i] = o.bob || 0; this.phase[i] = rnd(0, 6.28);
    this.anchor[i] = o.anchor || null;
    if (this.solid) { this.mesh.setColorAt(i, tmpC.setRGB(o.r, o.g, o.b)); this.dirty = true; }
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, ZERO); this.dirty = true; continue; }
      alive++;
      const k = i * 3, age = this.max[i] - this.life[i], f = age / this.max[i];
      if (this.mode[i] === 0) {
        this.vel[k + 1] -= this.grav[i] * dt;
        const dmp = Math.exp(-this.drag[i] * dt);
        this.vel[k] *= dmp; this.vel[k + 1] *= dmp; this.vel[k + 2] *= dmp;
        this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      } else {
        const a = this.anchor[i];
        if (this.tele[i] > 0) {
          this.tele[i] -= dt;
          if (this.tele[i] <= 0) { this.ang[i] += rnd(-1.5, 1.5); this.rad[i] *= rnd(0.8, 1.25); this.h[i] += rnd(-0.3, 0.3); this.tele[i] = rnd(0.4, 1.2); }
        }
        this.ang[i] += this.w[i] * dt; this.rad[i] = Math.max(0.02, this.rad[i] + this.radV[i] * dt); this.h[i] += this.vy[i] * dt;
        this.pos[k] = a.x + Math.cos(this.ang[i]) * this.rad[i];
        this.pos[k + 1] = a.y + this.h[i] + this.bob[i] * Math.sin(this.phase[i] + age * 3);
        this.pos[k + 2] = a.z + Math.sin(this.ang[i]) * this.rad[i];
      }
      this.rot[k] += this.spn[k] * dt; this.rot[k + 1] += this.spn[k + 1] * dt; this.rot[k + 2] += this.spn[k + 2] * dt;
      const kIn = Math.min(1, f / 0.12), kOut = 1 - f;
      let sc = this.size[i] * (1 + (this.grow[i] - 1) * f);
      if (this.solid) sc *= Math.min(1, f * 10) * Math.min(1, kOut * 5);
      else { const b = this.alpha[i] * kIn * kOut; tmpC.setRGB(this.col[k] * b, this.col[k + 1] * b, this.col[k + 2] * b); this.mesh.setColorAt(i, tmpC); sc *= 0.6 + 0.4 * kOut; }
      dummy.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      dummy.rotation.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]);
      dummy.scale.setScalar(Math.max(1e-4, sc));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.aliveCount = alive;
    if (alive || this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
      this.dirty = alive > 0;
    }
  }

  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}

export class VoxelParticles {
  constructor(scene, q) {
    this.pools = {};
    for (const [key, share] of Object.entries(SHARE)) {
      const shape = key.replace(/[AS]$/, ''), solid = key.endsWith('S');
      const p = new VoxelPool(GEO[shape](), solid, Math.max(24, Math.round(q.cap * share)));
      this.pools[key] = p; scene.add(p.mesh);
    }
  }
  /** o: {x,y,z,vx,vy,vz,r,g,b,size,life,alpha,shape,solid,grav,drag,grow,spin,mode,anchor,ang,rad,h,w,vyO,radV,tele,bob} */
  emit(o) { this.pools[o.shape + (o.solid ? 'S' : 'A')].emit(o); }
  update(dt) { for (const p of Object.values(this.pools)) p.update(dt); }
  get alive() { let n = 0; for (const p of Object.values(this.pools)) n += p.aliveCount; return n; }
  dispose() { for (const p of Object.values(this.pools)) p.dispose(); }
}
