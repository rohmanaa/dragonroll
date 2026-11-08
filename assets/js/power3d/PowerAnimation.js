/**
 * PowerAnimation.js — state machine animasi: hidden -> spawn -> idle <-> activate -> disappear.
 * Semua berbasis delta time. Output tiap frame (this.frame): glow, boost, fade, trail, pulse, alive.
 * Callback: on.spawn / on.activate / on.hit / on.disappear / on.spawnDone / on.activateEnd / on.disappearDone
 */
import { TAU, clamp, lerp } from './PowerConfig.js';

export const ease = {
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return c3 * x * x * x - c1 * x * x; },
};
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Pose aktivasi per jenis fx (sweep / burst / shake / spiral / inward) + variasi per nama. */
function activationPose(a, p, hold, holdT) {
  const h = a.hit, w = clamp(p / h), post = clamp((p - h) / (1 - h));
  const hp = Math.exp(-Math.pow((p - h) / 0.07, 2));
  const o = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1, glow: 0, boost: 0, trail: 0 };
  o.glow = ease.inQuad(w) * (1 - post) * 0.7 + hp;
  o.boost = o.glow * 1.2;
  switch (a.fx) {
    case 'sweep': {
      const ws = Math.max(0.05, h - 0.22);
      let ang;
      if (p < ws) ang = ease.outCubic(p / ws);
      else if (p < h) ang = 1 - 2.6 * ease.inCubic((p - ws) / (h - ws));
      else ang = -1.6 * (1 - ease.inOut(post));
      o.rz = ang; o.pz = 0.35 * hp; o.s = 1 + 0.08 * hp;
      o.trail = p > ws - 0.05 && p < h + 0.2 ? 1 : 0;
      break;
    }
    case 'shake': {
      if (p < h) {
        const amp = 0.05 * w * w;
        o.px = (Math.random() - 0.5) * amp * 2; o.py = (Math.random() - 0.5) * amp * 2; o.pz = (Math.random() - 0.5) * amp * 2;
        o.s = 1 + 0.07 * Math.sin(p * 110) * w;
        o.glow = Math.sin(p * 70) > 0 ? w : w * 0.3;
      } else {
        const since = (p - h) * a.duration + holdT;
        o.s = since < 0.06 ? 1 + 1.1 * hp : holdT > hold * 0.4 ? ease.outBack(clamp((holdT - hold * 0.4) / (hold * 0.6))) : 0;
        o.glow = hp * 1.5;
      }
      break;
    }
    case 'spiral':
      o.py = 0.5 * ease.outCubic(w) * (1 - ease.inOut(post));
      o.ry = TAU * 2 * ease.inOut(p); o.s = 1 + 0.12 * hp; o.trail = 1;
      break;
    case 'inward':
      o.s = p < h ? 1 - 0.3 * ease.inOut(w) : lerp(0.7, 1, ease.outBack(post)) + 0.3 * hp;
      o.ry = TAU * 1.5 * ease.inQuad(w) * (1 - post); o.trail = 1;
      break;
    default: // burst
      o.s = (p < h ? 1 - 0.12 * ease.outQuad(w) : 1) + 0.32 * hp;
      o.ry = TAU * ease.outCubic(p);
  }
  if (a.name === 'shieldRaise') { o.py += 0.45 * Math.sin(Math.PI * p); o.rx -= 0.4 * Math.sin(Math.PI * p); }
  if (a.name === 'featherBurst') o.rz += 0.6 * Math.sin(p * TAU * 2) * (1 - p);
  return o;
}

export class PowerAnimator {
  constructor(item, holder, baseY = 1.55) {
    this.item = item; this.holder = holder; this.baseY = baseY;
    this.idle = { float: 0.07, floatSpeed: 1, rot: [0, 0.4, 0], tilt: [0, 0, 0], sway: [0, 0, 0], shake: 0, pulse: 0, ...item.idle };
    this.act = { name: 'burst', duration: 1.1, hit: 0.5, fx: 'burst', ...item.activation };
    this.hold = this.act.fx === 'shake' ? 1.1 : 0; // TNT: tetap "meledak" sebentar sebelum muncul lagi
    this.state = 'hidden'; this.t = 0; this.time = 0;
    this.spin = [0, 0, 0]; this.faceTarget = 0; this._hit = false;
    this.speed = 1;
    this.on = {};
    this.frame = { state: 'hidden', alive: false, glow: 0, boost: 0, fade: 0, trail: 0, pulse: 0 };
  }

  spawn() { this.state = 'spawn'; this.t = 0; this.holder.visible = true; this.on.spawn?.(); }
  activate() {
    if (this.state !== 'idle') return false;
    this.state = 'activate'; this.t = 0; this._hit = false;
    this.faceTarget = Math.round(this.spin[1] / TAU) * TAU;
    this.on.activate?.();
    return true;
  }
  disappear() { if (this.state === 'hidden' || this.state === 'disappear') return; this.state = 'disappear'; this.t = 0; this.on.disappear?.(); }

  update(dtRaw) {
    const dt = dtRaw * this.speed, id = this.idle, f = this.frame;
    this.time += dt; this.t += dt;
    const time = this.time;
    let sMul = 1, glow = 0, boost = 0, fade = 1, trail = 0, spinMul = 1, faceK = 0;
    const d = { x: 0, y: 0, z: 0 }, r = { x: 0, y: 0, z: 0 };

    if (this.state === 'hidden') { this.holder.visible = false; f.state = 'hidden'; f.alive = false; f.glow = f.boost = f.fade = f.trail = 0; return f; }

    if (this.state === 'spawn') {
      const p = clamp(this.t / 0.95);
      sMul = Math.max(0.001, ease.outBack(p)); fade = smooth(0.25, 1, p); glow = (1 - p) * 0.8; boost = (1 - p) * 0.8;
      r.y = (1 - ease.outCubic(p)) * Math.PI;
      if (p >= 1) { this.state = 'idle'; this.t = 0; this.on.spawnDone?.(); }
    } else if (this.state === 'activate') {
      const a = this.act, total = a.duration + this.hold;
      const p = clamp(this.t / a.duration), holdT = Math.max(0, this.t - a.duration);
      const o = activationPose(a, p, this.hold, holdT);
      d.x = o.px; d.y = o.py; d.z = o.pz; r.x = o.rx; r.y = o.ry; r.z = o.rz;
      sMul = o.s; glow = o.glow; boost = o.boost; trail = o.trail;
      spinMul = 0; faceK = smooth(0, 0.15, p) * (1 - smooth(0.85, 1, this.t / total));
      if (!this._hit && p >= a.hit) { this._hit = true; this.on.hit?.(); }
      if (this.t >= total) { this.state = 'idle'; this.t = 0; this.on.activateEnd?.(); }
    } else if (this.state === 'disappear') {
      const p = clamp(this.t / 0.8);
      sMul = Math.max(0, 1 - ease.inBack(p)); fade = 1 - p; glow = p * 0.6;
      if (p >= 1) { this.state = 'hidden'; this.holder.visible = false; this.on.disappearDone?.(); }
    }

    for (let i = 0; i < 3; i++) this.spin[i] += id.rot[i] * dt * spinMul;
    const ry = lerp(this.spin[1], this.faceTarget, faceK);
    const h = this.holder;
    h.rotation.set(
      id.tilt[0] + this.spin[0] + id.sway[0] * Math.sin(time * 1.3) + r.x,
      id.tilt[1] + ry + id.sway[1] * Math.sin(time * 1.1 + 1) + r.y,
      id.tilt[2] + this.spin[2] + id.sway[2] * Math.sin(time * 1.7 + 2) + r.z,
    );
    const j = id.shake;
    h.position.set(
      d.x + (j ? (Math.random() - 0.5) * j * 2 : 0),
      this.baseY + id.float * 2.2 * Math.sin(time * id.floatSpeed * 2) + d.y,
      d.z,
    );
    h.scale.setScalar(Math.max(1e-4, sMul));

    f.state = this.state; f.alive = this.state !== 'hidden';
    f.glow = glow; f.boost = boost; f.fade = fade; f.trail = trail;
    f.pulse = id.pulse ? id.pulse * (0.5 + 0.5 * Math.sin(time * 2.4)) : 0.12 * (0.5 + 0.5 * Math.sin(time * id.floatSpeed * 2));
    return f;
  }
}
