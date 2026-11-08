/**
 * DiceAnimation.js — state machine animasi satu dadu:
 *   idle → windup (roll start) → rolling (+bounce) → settle → landed → result → rest
 *
 * Semua gerak memakai delta time. Fisika memakai timestep tetap (lihat DicePhysics), sehingga
 * hasil konsisten di 30/60/120 FPS. Hasil angka berasal dari fisika (adil), atau dari RNG game
 * yang sudah ada bila `roll(forcedValue)` dipakai (tampilan lalu diselaraskan dengan hop singkat).
 */
import * as THREE from '../vendor/three.r170.module.min.js';
import { DicePhysics, randomQuat, qmul, qaxis, qnorm } from './DicePhysics.js';
import { D6_FACES } from './DiceCatalog.js';

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inQuad: (t) => t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

const IDLE_POS = [0, 1.25, 1.2];
const tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion();

export class DiceAnimator {
  /**
   * @param {{mesh: THREE.Mesh, effects: import('./DiceEffects.js').DiceEffects, rng?: Function}} o
   */
  constructor({ mesh, effects, rng, bounds, idleZ }) {
    this.mesh = mesh;
    this.effects = effects;
    this.rng = rng || Math.random;
    this.idle = [0, 1.25, idleZ ?? 1.2];
    this.physics = new DicePhysics({ rng: this.rng, boundsX: bounds?.x, boundsZ: bounds?.z });
    this.state = 'idle';
    this.t = 0;
    this.pos = [...this.idle];
    this.q = [0, 0, 0, 1];
    this.view = { position: mesh.position, glow: 0, scaleMul: 1 }; // dibaca oleh DiceEffects (aura, light)
    this.faceIndex = 2;
    this.pending = null;
    this.onResult = null;
    this.onState = null;
    this._idleQ();
  }

  setDie(die, mats) {
    this.die = die;
    this.mats = mats;
    this.mesh.material = mats.materials;
    this.effects.setDie(die);
    this.toIdle(true);
  }

  get busy() { return this.state !== 'idle' && this.state !== 'rest'; }

  _set(state) { this.state = state; this.t = 0; this.onState?.(state); }

  _idleQ() {
    const t = this.idleT || 0;
    const yaw = t * 0.45, tilt = 0.5 + Math.sin(t * 0.9) * 0.07, roll = Math.sin(t * 0.6) * 0.06;
    this.q = qnorm(qmul(qmul(qaxis([0, 1, 0], yaw), qaxis([1, 0, 0], tilt)), qaxis([0, 0, 1], roll)));
  }

  /** Lempar dadu. forcedValue (1–6) opsional: dari RNG game yang sudah ada. Mengembalikan Promise<{value}>. */
  roll(forcedValue = null) {
    if (['windup', 'rolling', 'settle', 'landed', 'result'].includes(this.state)) return this.pending?.promise ?? Promise.resolve(this.lastResult);
    if (this.queued) return this.pending.promise;
    if (forcedValue != null && !(forcedValue >= 1 && forcedValue <= 6)) forcedValue = null;
    this.forced = forcedValue;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this.pending = { promise, resolve };
    const r = this.rng;
    const a = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], l = Math.hypot(...a) || 1;
    this.spinAxis = [a[0] / l, a[1] / l, a[2] / l];
    if (this.state === 'idle') this._set('windup');
    else { this.queued = true; if (this.state === 'rest') this.toIdle(); } // dari rest/return: kembali ke idle dulu, lalu lempar
    return promise;
  }

  /** Kembali ke pose melayang. instant=true untuk tanpa transisi. */
  toIdle(instant = false) {
    if (['windup', 'rolling', 'settle', 'landed'].includes(this.state)) return;
    this.faceBoost = 0;
    this.mats?.materials.forEach((m) => (m.emissiveIntensity = this.mats.baseEmissive));
    if (instant) { this._set('idle'); this.idleT = this.idleT || 0; this.mesh.scale.setScalar(1); return; }
    this.from = { pos: [...this.pos], q: [...this.q] };
    this._set('return');
  }

  _sync() {
    this.mesh.position.set(this.pos[0], this.pos[1], this.pos[2]);
    this.mesh.quaternion.set(this.q[0], this.q[1], this.q[2], this.q[3]);
  }

  update(dtReal) {
    const dt = dtReal * this.effects.slowmo.scale;
    const e = this.die?.effect;
    if (!e) return;

    switch (this.state) {
      case 'idle':
      case 'rest': {
        if (this.state === 'idle') {
          this.idleT = (this.idleT || 0) + dt;
          this._idleQ();
          this.pos = [this.idle[0], this.idle[1] + Math.sin(this.idleT * 1.5) * 0.07, this.idle[2]];
          this.effects.idle(dt, this.pos);
        }
        break;
      }
      case 'return': {
        this.t += dt / 0.5;
        const k = ease.inOutCubic(Math.min(1, this.t));
        this._idleQ();
        tq.set(...this.from.q).slerp(tq2.set(...this.q), k);
        this.q = [tq.x, tq.y, tq.z, tq.w];
        const target = [this.idle[0], this.idle[1], this.idle[2]];
        this.pos = this.from.pos.map((v, i) => v + (target[i] - v) * k);
        this.mesh.scale.setScalar(1);
        if (this.t >= 1) {
          this.idleT = this.idleT || 0;
          if (this.queued) { this.queued = false; this._set('windup'); } else this._set('idle');
        }
        break;
      }
      case 'windup': {
        // Naik sedikit + akselerasi putaran sebelum dilempar
        this.t += dt;
        const k = Math.min(1, this.t / 0.34);
        const omega = 3 + 22 * k * k;
        this.q = qnorm(qmul(qaxis(this.spinAxis, omega * dt), this.q));
        this.pos = [this.idle[0], this.idle[1] + 0.07 * Math.sin((this.idleT || 0) * 1.5) + 0.65 * ease.outCubic(k), this.idle[2]];
        this.mesh.scale.setScalar(1 + 0.05 * Math.sin(k * Math.PI));
        if (k >= 1) {
          this.mesh.scale.setScalar(1);
          this.physics.throwDie(this.pos, this.q, this.spinAxis);
          this.effects.onRollStart(this.pos);
          this._set('rolling');
        }
        break;
      }
      case 'rolling': {
        const events = this.physics.step(dt);
        this.pos = this.physics.pos; this.q = this.physics.q;
        const sp = Math.hypot(...this.physics.v);
        this.effects.onRollFrame(dt, this.pos, sp);
        for (const ev of events) {
          if (ev.type === 'impact') this.effects.onImpact(ev.point, ev.speed, ev.index);
          else if (ev.type === 'wall') this.effects.sound.play(e.soundEffect, Math.min(1, ev.speed / 10) * 0.5);
          else if (ev.type === 'settled') { this._finishPhysics(); break; }
        }
        break;
      }
      case 'settle': {
        // Selaraskan dengan hasil RNG game: hop singkat ke orientasi target
        this.t += dt / 0.4;
        const k = ease.inOutCubic(Math.min(1, this.t));
        tq.set(...this.from.q).slerp(tq2.set(...this.target), k);
        this.q = [tq.x, tq.y, tq.z, tq.w];
        this.pos = [this.from.pos[0], this.from.pos[1] + Math.sin(k * Math.PI) * 0.32, this.from.pos[2]];
        if (this.t >= 1) { this.q = [...this.target]; this.pos = [...this.from.pos]; this._land(); }
        break;
      }
      case 'landed': {
        this.t += dt;
        if (this.t >= 0.12) this._showResult();
        break;
      }
      case 'result': {
        // Pop skala kecil + sorotan pada sisi atas (face emissive), lalu stabil
        this.t += dt / 0.5;
        const k = Math.min(1, this.t);
        const bump = Math.sin(k * Math.PI) * (1 - k * 0.4);
        this.mesh.scale.setScalar(1 + 0.12 * bump);
        this.pos[1] = this.restY + 0.1 * bump;
        this.view.scaleMul = 1 + 0.12 * bump;
        if (this.t >= 1) { this.mesh.scale.setScalar(1); this.pos[1] = this.restY; this.view.scaleMul = 1; this._set('rest'); }
        break;
      }
    }

    // emissive: denyut halus saat idle + sorotan face atas saat result
    if (this.mats) {
      const base = this.mats.baseEmissive;
      const pulse = this.state === 'idle' && e.effectTier >= 3 ? 1 + 0.18 * Math.sin((this.idleT || 0) * 2.2) : 1;
      const boost = e.resultEffect === 'none' ? 0 : this.effects.faceFlash * 0.9;
      const ms = this.mats.materials;
      for (let i = 0; i < 6; i++) ms[i].emissiveIntensity = base * pulse + (i === this.faceIndex ? boost : 0);
      this.view.glow = e.glowIntensity * (this.state === 'idle' ? 0.5 : 0.3);
    }
    this.effects.setLightAt(this.pos);
    this._sync();
  }

  _finishPhysics() {
    const natural = this.physics.topFace();
    this.pos = this.physics.pos; this.q = this.physics.q;
    this.restY = this.physics.h;
    if (this.forced != null && this.forced !== natural.value) {
      this.from = { pos: [...this.pos], q: [...this.q] };
      this.target = this.physics.quatForValue(this.forced);
      this.faceIndex = D6_FACES.findIndex((f) => f.value === this.forced);
      this._set('settle');
    } else {
      this.faceIndex = natural.index;
      this._land();
    }
  }

  _land() {
    this.restY = this.physics.h;
    this.effects.onLand(this.pos);
    this._set('landed');
  }

  _showResult() {
    const value = D6_FACES[this.faceIndex].value;
    this.effects.onResult(this.pos);
    this._set('result');
    const p = this.pending; this.pending = null;
    const out = { value, dice: this.die.id };
    this.lastResult = out;
    this.onResult?.(out);
    p?.resolve(out);
  }
}
