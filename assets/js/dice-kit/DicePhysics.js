/**
 * DicePhysics.js — simulasi rigid body kubus (D6) tanpa dependensi.
 *
 * Kubus homogen punya tensor inersia isotropik (I = m·s²/6), jadi solver impuls
 * bisa memakai skalar. Kolisi: 8 sudut kubus vs lantai dan 4 dinding arena.
 * Timestep tetap (1/120 s) dengan akumulator => hasil konsisten di berbagai FPS.
 * Modul ini murni matematika (tanpa THREE) sehingga bisa diuji di Node.
 *
 * Quaternion berformat [x, y, z, w].
 */
import { D6_FACES } from './DiceCatalog.js';

const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS = 10;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

export function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}
export function qnorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
export function qaxis(axis, angle) {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}
/** Rotasi busur terpendek yang memutar vektor a ke vektor b (keduanya unit). */
export function qarc(a, b) {
  const d = dot(a, b);
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) return qaxis([1, 0, 0], Math.PI);
  const ax = cross(a, b);
  return qnorm([ax[0], ax[1], ax[2], 1 + d]);
}
export function randomQuat(rng) {
  const u1 = rng(), u2 = rng(), u3 = rng();
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  return [a * Math.sin(2 * Math.PI * u2), a * Math.cos(2 * Math.PI * u2), b * Math.sin(2 * Math.PI * u3), b * Math.cos(2 * Math.PI * u3)];
}

export class DicePhysics {
  constructor(o = {}) {
    this.h = o.halfSize ?? 0.5;
    this.bx = o.boundsX ?? 3.3;
    this.bz = o.boundsZ ?? 2.6;
    this.rng = o.rng || Math.random;
    this.restitution = o.restitution ?? 0.42;
    this.friction = o.friction ?? 0.5;
    this.gravity = o.gravity ?? 24; // sedikit lebih ringan dari 30: jatuh terasa lebih melayang
    this.centerX = o.centerX ?? null; // bila diisi (mode jatuh dari atas): dadu ditarik & mendarat tepat di titik ini
    this.centerZ = o.centerZ ?? null;
    this.mass = 1;
    this.invI = 1.5 / (this.mass * this.h * this.h);
    const h = this.h;
    this.corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) this.corners.push([sx * h, sy * h, sz * h]);
    // Bidang: [normal, d] dengan jarak = n·p − d (≥0 berarti di dalam arena).
    this.planes = [
      { n: [0, 1, 0], d: 0, kind: 'floor' },
      { n: [-1, 0, 0], d: -this.bx, kind: 'wall' },
      { n: [1, 0, 0], d: -this.bx, kind: 'wall' },
      { n: [0, 0, -1], d: -this.bz, kind: 'wall' },
      { n: [0, 0, 1], d: -this.bz, kind: 'wall' },
    ];
    this.reset([0, h, 0], [0, 0, 0, 1]);
  }

  reset(pos, q) {
    this.pos = [...pos];
    this.q = [...q];
    this.v = [0, 0, 0];
    this.w = [0, 0, 0];
    this.asleep = true;
    this.sleepT = 0;
    this.time = 0;
    this.bounceCount = 0;
    this.lastImpactT = -1;
    this.acc = 0;
  }

  /** Lemparan: arah menjauhi kamera (−z) dengan variasi acak. Hasil angka murni dari fisika. */
  throwDie(pos, q, spinAxisHint, drop = false) {
    const r = this.rng;
    this.reset(pos, q);
    this.asleep = false;
    if (drop) {
      // jatuh dari atas: hampir lurus ke bawah, sedikit melenceng saja
      this.v = [(r() - 0.5) * 0.16, -1.2 - r() * 1.0, (r() - 0.5) * 0.12];
    } else {
      const speed = 4.4 + r() * 2.4;
      const yaw = (r() - 0.5) * 1.1;
      this.v = [Math.sin(yaw) * speed, 2.2 + r() * 2.6, -Math.cos(yaw) * speed];
    }
    let ax = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1];
    if (spinAxisHint) ax = [ax[0] + spinAxisHint[0] * 1.5, ax[1] + spinAxisHint[1] * 1.5, ax[2] + spinAxisHint[2] * 1.5];
    const l = len(ax) || 1;
    const mag = drop ? 9 + r() * 8 : 14 + r() * 10;
    this.w = [(ax[0] / l) * mag, (ax[1] / l) * mag, (ax[2] / l) * mag];
  }

  /** Maju sebesar dt detik. Mengembalikan daftar event: impact / wall / settled. */
  step(dt) {
    const events = [];
    if (this.asleep) return events;
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= FIXED_DT && n < MAX_SUBSTEPS) {
      this._sub(FIXED_DT, events);
      this.acc -= FIXED_DT;
      n++;
      if (this.asleep) break;
    }
    if (n === MAX_SUBSTEPS) this.acc = 0;
    return events;
  }

  _sub(dt, events) {
    const { v, w } = this;
    this.time += dt;
    v[1] -= this.gravity * dt;
    if (this.centerX != null) { // tarik halus ke tengah + redam gerak samping agar tidak melenceng ke pinggir frame
      v[0] += (this.centerX - this.pos[0]) * 26 * dt; v[2] += (this.centerZ - this.pos[2]) * 26 * dt;
      const ld = Math.max(0, 1 - 7 * dt); v[0] *= ld; v[2] *= ld;
    }
    for (let i = 0; i < 3; i++) this.pos[i] += v[i] * dt;

    // Integrasi orientasi: q += ½·dt·(ω⊗q)
    const q = this.q;
    const dq = [
      w[0] * q[3] + w[1] * q[2] - w[2] * q[1],
      w[1] * q[3] + w[2] * q[0] - w[0] * q[2],
      w[2] * q[3] + w[0] * q[1] - w[1] * q[0],
      -(w[0] * q[0] + w[1] * q[1] + w[2] * q[2]),
    ];
    this.q = qnorm([q[0] + 0.5 * dt * dq[0], q[1] + 0.5 * dt * dq[1], q[2] + 0.5 * dt * dq[2], q[3] + 0.5 * dt * dq[3]]);

    const rs = this.corners.map((c) => qrot(this.q, c));
    let floorContacts = 0;
    let impact = null;

    for (let iter = 0; iter < 4; iter++) {
      for (const pl of this.planes) {
        for (let k = 0; k < 8; k++) {
          const r = rs[k];
          const p = [this.pos[0] + r[0], this.pos[1] + r[1], this.pos[2] + r[2]];
          if (dot(pl.n, p) - pl.d >= 0) continue;
          if (iter === 0 && pl.kind === 'floor') floorContacts++;
          const wr = cross(this.w, r);
          const vp = [v[0] + wr[0], v[1] + wr[1], v[2] + wr[2]];
          const vn = dot(vp, pl.n);
          if (vn >= 0) continue;
          const e = vn < -1.2 ? this.restitution : 0;
          const rn = cross(r, pl.n);
          const jn = (-(1 + e) * vn) / (1 / this.mass + this.invI * dot(rn, rn));
          this._apply(r, [pl.n[0] * jn, pl.n[1] * jn, pl.n[2] * jn]);
          if (iter === 0 && vn < -1.2 && (!impact || -vn > impact.speed)) impact = { speed: -vn, point: p, kind: pl.kind };
          // Gesekan Coulomb
          const wr2 = cross(this.w, r);
          const vp2 = [v[0] + wr2[0], v[1] + wr2[1], v[2] + wr2[2]];
          const vn2 = dot(vp2, pl.n);
          const vt = [vp2[0] - vn2 * pl.n[0], vp2[1] - vn2 * pl.n[1], vp2[2] - vn2 * pl.n[2]];
          const vtl = len(vt);
          if (vtl > 1e-6) {
            const t = [vt[0] / vtl, vt[1] / vtl, vt[2] / vtl];
            const rt = cross(r, t);
            let jt = vtl / (1 / this.mass + this.invI * dot(rt, rt));
            jt = Math.min(jt, this.friction * jn);
            this._apply(r, [-t[0] * jt, -t[1] * jt, -t[2] * jt]);
          }
        }
      }
    }

    // Koreksi penetrasi posisi
    for (const pl of this.planes) {
      let deepest = 0;
      for (let k = 0; k < 8; k++) {
        const d = dot(pl.n, [this.pos[0] + rs[k][0], this.pos[1] + rs[k][1], this.pos[2] + rs[k][2]]) - pl.d;
        if (d < deepest) deepest = d;
      }
      if (deepest < -0.0005) {
        const push = (-deepest - 0.0005) * 0.9;
        for (let i = 0; i < 3; i++) this.pos[i] += pl.n[i] * push;
      }
    }

    // Peredaman saat menyentuh lantai (rolling resistance)
    if (floorContacts > 0) {
      const wd = Math.max(0, 1 - 2.2 * dt), vd = Math.max(0, 1 - 0.7 * dt);
      for (let i = 0; i < 3; i++) { this.w[i] *= wd; if (i !== 1) this.v[i] *= vd; }
    }

    if (impact && this.time - this.lastImpactT > 0.06) {
      this.lastImpactT = this.time;
      events.push({ type: impact.kind === 'floor' ? 'impact' : 'wall', speed: impact.speed, point: impact.point, index: impact.kind === 'floor' ? this.bounceCount++ : -1 });
    }

    const lin = len(this.v), ang = len(this.w);
    if (floorContacts > 0 && lin < 0.15 && ang < 0.45) this.sleepT += dt; else this.sleepT = 0;
    if (this.sleepT > 0.3 || this.time > 8) {
      this._snapFlat();
      events.push({ type: 'settled', value: this.topFace().value, point: [...this.pos] });
    }
  }

  _apply(r, J) {
    this.v[0] += J[0] / this.mass; this.v[1] += J[1] / this.mass; this.v[2] += J[2] / this.mass;
    const t = cross(r, J);
    this.w[0] += this.invI * t[0]; this.w[1] += this.invI * t[1]; this.w[2] += this.invI * t[2];
  }

  /** Face yang sedang menghadap ke atas. */
  topFace() {
    let best = null, bd = -2;
    for (let i = 0; i < 6; i++) {
      const n = qrot(this.q, D6_FACES[i].normal);
      if (n[1] > bd) { bd = n[1]; best = { value: D6_FACES[i].value, index: i, dot: n[1] }; }
    }
    return best;
  }

  _snapFlat() {
    const top = this.topFace();
    const n = qrot(this.q, D6_FACES[top.index].normal);
    this.q = qnorm(qmul(qarc(n, [0, 1, 0]), this.q));
    this.pos[1] = this.h;
    if (this.centerX != null) { this.pos[0] = this.centerX; this.pos[2] = this.centerZ; } // selalu berhenti tepat di tengah
    this.v = [0, 0, 0];
    this.w = [0, 0, 0];
    this.asleep = true;
  }

  /**
   * Quaternion target agar face `value` menghadap atas (busur terpendek dari orientasi sekarang).
   * Dipakai untuk menyelaraskan tampilan dengan hasil RNG game yang sudah ada.
   */
  quatForValue(value, fromQ = this.q) {
    const f = D6_FACES.find((x) => x.value === value);
    const n = qrot(fromQ, f.normal);
    return qnorm(qmul(qarc(n, [0, 1, 0]), fromQ));
  }
}
