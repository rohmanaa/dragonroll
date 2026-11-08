/**
 * PowerGeometry.js — model 3D prosedural untuk 15 item (bentuk asli, bukan bola/kubus generik).
 * Tiap builder menerima set material M {main, accent, dark, glow, extra} dan mengembalikan THREE.Group.
 * userData.anchors = titik penting (tip, wing); userData.tick(t, dt) = animasi khusus model (opsional).
 * buildModel() menormalkan ukuran ke item.size dan memusatkan model di origin.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TAU } from './PowerConfig.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const Y = V(0, 1, 0);
const glass = (m) => !Array.isArray(m) && m.transparent;

function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (glass(mat)) m.userData.noAura = true; else m.castShadow = true;
  parent.add(m);
  return m;
}
/** Letakkan mesh di `pos` dengan sumbu +Y mengarah ke `axis`. */
function along(parent, geo, mat, pos, axis) {
  const m = put(parent, geo, mat, pos.x, pos.y, pos.z);
  m.quaternion.setFromUnitVectors(Y, axis.clone().normalize());
  return m;
}
const box = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const tor = (R, r, rs = 8, ts = 48) => new THREE.TorusGeometry(R, r, rs, ts);
const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), seg, r, 8, false);
const octa = (r) => new THREE.OctahedronGeometry(r, 0);
const prng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

function extrudeShape(s, depth, bevel = 0.012) {
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function poly(pts, depth, bevel = 0.012) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return extrudeShape(s, depth, bevel);
}
function starPts(n, R, r) {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n + Math.PI / 2, d = i % 2 ? r : R; p.push([Math.cos(a) * d, Math.sin(a) * d]); }
  return p;
}
function flat(geo) { const g = geo.toNonIndexed(); g.computeVertexNormals(); return g; }

// ---------------------------------------------------------------- pedang (parametrik, tiap pedang punya bilah & extras sendiri)
function sword(M, o) {
  const g = new THREE.Group();
  put(g, poly(o.blade, o.t, o.bevel ?? 0.014), M.main);
  if (o.fuller) put(g, box(o.fuller[0], o.fuller[1], o.t + 0.03, 0.008), M.accent, 0, o.fuller[2], 0);
  const [gw, gh, gd] = o.guard;
  put(g, box(gw, gh, gd, 0.035), M.accent, 0, -gh / 2 + 0.02, 0);
  const gl = o.grip;
  put(g, cyl(o.gripR, o.gripR, gl, 12), M.dark, 0, -gh - gl / 2 + 0.02, 0);
  for (let i = 0; i < 4; i++) put(g, tor(o.gripR + 0.004, 0.012, 6, 16), M.accent, 0, -gh - gl * (0.12 + 0.25 * i) + 0.02, 0, Math.PI / 2);
  put(g, sph(o.pommel, 16, 12), M.accent, 0, -gh - gl - o.pommel * 0.6 + 0.02, 0);
  g.userData.anchors = { tip: V(0, o.L, 0), wing: V(0, o.L * 0.3, -0.1) };
  return g;
}

const BUILDERS = {
  ironSword(M) {
    return sword(M, { L: 2.05, blade: [[-0.12, 0], [0.12, 0], [0.125, 1.75], [0, 2.05], [-0.125, 1.75]], t: 0.07,
      fuller: [0.035, 1.5, 0.85], guard: [0.78, 0.13, 0.2], grip: 0.55, gripR: 0.06, pommel: 0.1 });
  },

  diamondSword(M) {
    const g = sword(M, { L: 2.3, blade: [[-0.14, 0], [0.14, 0], [0.18, 0.7], [0.13, 1.95], [0, 2.3], [-0.13, 1.95], [-0.18, 0.7]], t: 0.085,
      fuller: [0.04, 1.7, 0.95], guard: [0.95, 0.15, 0.22], grip: 0.55, gripR: 0.06, pommel: 0.11 });
    put(g, box(0.022, 1.9, 0.11, 0.006), M.glow, 0, 1.0, 0);
    put(g, octa(0.11), M.glow, 0, -0.02, 0.13).scale.set(1, 1.3, 1);
    for (const s of [-1, 1]) {
      along(g, cone(0.06, 0.34, 6), M.accent, V(s * 0.46, 0.02, 0), V(s * 0.5, 1, 0));
      put(g, octa(0.07), M.glow, s * 0.3, -0.02, 0.1);
    }
    return g;
  },

  netheriteSword(M) {
    const g = sword(M, { L: 2.3, blade: [[-0.2, 0], [0.2, 0], [0.2, 0.45], [0.34, 0.62], [0.21, 0.9], [0.33, 1.2], [0.2, 1.5], [0.25, 1.85], [0, 2.3], [-0.2, 1.85], [-0.2, 0.45]], t: 0.12,
      fuller: [0.05, 1.6, 0.9], guard: [1.1, 0.2, 0.3], grip: 0.6, gripR: 0.075, pommel: 0.14 });
    for (const y of [0.55, 0.95, 1.35]) put(g, box(0.3, 0.035, 0.14, 0.008), M.glow, 0, y, 0);
    put(g, octa(0.14), M.glow, 0, -0.02, 0.18).scale.set(1, 1.3, 1);
    for (const s of [-1, 1]) along(g, cone(0.08, 0.42, 6), M.dark, V(s * 0.6, 0.0, 0), V(s * 0.9, 1, 0));
    return g;
  },

  woodenShield(M) {
    const g = new THREE.Group();
    const shape = (s) => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.7 * s, 1.0 * s); sh.lineTo(0.7 * s, 1.0 * s); sh.lineTo(0.7 * s, -0.1 * s);
      sh.quadraticCurveTo(0.7 * s, -0.85 * s, 0, -1.25 * s); sh.quadraticCurveTo(-0.7 * s, -0.85 * s, -0.7 * s, -0.1 * s);
      sh.closePath(); return sh;
    };
    put(g, extrudeShape(shape(1.07), 0.2, 0.03), M.dark, 0, 0, -0.02);
    put(g, extrudeShape(shape(0.94), 0.3, 0.035), M.main, 0, 0, 0);
    for (const x of [-0.31, 0, 0.31]) put(g, box(0.035, 1.9, 0.04, 0.01), M.accent, x, -0.05, 0.17);
    for (const y of [0.55, -0.35]) put(g, box(1.3, 0.12, 0.05, 0.015), M.dark, 0, y, 0.18);
    put(g, new THREE.SphereGeometry(0.27, 20, 12, 0, TAU, 0, Math.PI / 2), M.dark, 0, 0.1, 0.17, Math.PI / 2);
    for (const [x, y] of [[-0.55, 0.8], [0.55, 0.8], [-0.55, -0.1], [0.55, -0.1]]) put(g, sph(0.045, 8, 6), M.dark, x, y, 0.2);
    put(g, box(0.1, 0.5, 0.1, 0.02), M.accent, 0, 0.1, -0.22);
    g.userData.anchors = { tip: V(0, 1, 0), wing: V(0, 0.2, -0.2) };
    return g;
  },

  tnt(M) {
    const g = new THREE.Group();
    put(g, box(1.3, 1.3, 1.3, 0.06), [M.main, M.main, M.accent, M.accent, M.main, M.main]);
    put(g, cyl(0.2, 0.2, 0.06, 16), M.dark, 0, 0.67, 0);
    for (const y of [0.42, -0.42]) put(g, box(1.34, 0.07, 1.34, 0.02), M.dark, 0, y, 0);
    put(g, tube([[0, 0.68, 0], [0.06, 0.95, 0.04], [0.2, 1.15, 0], [0.38, 1.22, -0.06]], 0.035, 16), M.extra);
    put(g, sph(0.1, 12, 8), M.glow, 0.4, 1.23, -0.07);
    g.userData.anchors = { tip: V(0.4, 1.25, -0.07), wing: V(0, 0.2, -0.7) };
    g.userData.tick = (t) => { g.children[g.children.length - 1].scale.setScalar(1 + 0.35 * Math.sin(t * 18)); };
    return g;
  },

  feather(M) {
    const g = new THREE.Group();
    const L = 3, N = 28, right = [], left = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = Math.sin(Math.PI * Math.pow(t, 0.75)) * 0.36 * (i % 2 ? 0.86 : 1) + 0.008;
      right.push([w, t * L]); left.unshift([-w * 0.92, t * L]);
    }
    const geo = poly([...right, ...left], 0.018, 0.004);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) + 0.35 * Math.pow(y / L, 2) + x * x * 0.7); }
    geo.computeVertexNormals();
    put(g, geo, M.main);
    put(g, tube([[0, -0.2, 0], [0, L * 0.33, 0.03], [0, L * 0.66, 0.16], [0, L, 0.35]], 0.02, 20), M.accent);
    g.userData.anchors = { tip: V(0, L, 0.35), wing: V(0, L * 0.4, -0.1) };
    return g;
  },

  goldenApple(M) {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI;
      const r = Math.sin(a) * (0.92 - 0.1 * Math.cos(a));
      const y = -Math.cos(a) * 0.85 - 0.28 * Math.exp(-Math.pow((Math.PI - a) / 0.28, 2)) + 0.12 * Math.exp(-Math.pow(a / 0.3, 2));
      pts.push(V2(r, y));
    }
    put(g, new THREE.LatheGeometry(pts, 48), M.main);
    put(g, tube([[0, 0.5, 0], [0.02, 0.7, 0], [0.1, 0.95, 0.02], [0.2, 1.05, 0.03]], 0.035, 10), M.dark);
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.22, 0.14, 0.5, 0); leaf.quadraticCurveTo(0.22, -0.14, 0, 0);
    put(g, extrudeShape(leaf, 0.015, 0.004), M.glow, 0.2, 1.0, 0, 0.2, 0.3, 0.45);
    g.userData.anchors = { tip: V(0.2, 1.05, 0), wing: V(0, 0, -0.5) };
    return g;
  },

  totem(M) {
    const g = new THREE.Group();
    put(g, poly([[-0.32, 0], [0.32, 0], [0.42, 1.0], [1.05, 1.35], [1.05, 1.7], [0.35, 1.55], [-0.35, 1.55], [-1.05, 1.7], [-1.05, 1.35], [-0.42, 1.0]], 0.3, 0.03), M.main);
    put(g, box(0.78, 0.78, 0.6, 0.06), [M.main, M.main, M.main, M.main, M.accent, M.main], 0, 2.05, 0);
    put(g, box(0.92, 0.1, 0.34, 0.02), M.dark, 0, 0.45, 0);
    put(g, box(0.5, 0.1, 0.36, 0.02), M.dark, 0, 1.52, 0);
    put(g, octa(0.2), M.glow, 0, 0.95, 0.2).scale.set(1, 1.35, 0.7);
    for (const s of [-1, 1]) put(g, sph(0.07, 10, 8), M.dark, s * 1.0, 1.52, 0.17);
    g.userData.anchors = { tip: V(0, 2.5, 0), wing: V(0, 1.25, -0.3) };
    const gem = g.children[g.children.length - 3];
    g.userData.tick = (t) => gem.scale.set(1, 1.35 + 0.15 * Math.sin(t * 3), 0.7);
    return g;
  },

  enderPearl(M) {
    const g = new THREE.Group();
    put(g, sph(0.8, 56, 36), M.main);
    put(g, sph(0.88, 40, 28), M.extra);
    const orbit = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const r = put(orbit, tor(1.0 + i * 0.12, 0.012, 6, 64), M.accent, 0, 0, 0, Math.PI / 2 + i * 0.8, 0, i * 0.9);
      r.userData.noAura = true;
      put(r, sph(0.055, 10, 8), M.glow, 1.0 + i * 0.12, 0, 0).userData.noAura = true;
    }
    g.add(orbit);
    g.userData.anchors = { tip: V(0, 0.9, 0), wing: V(0, 0, -0.8) };
    g.userData.tick = (t, dt) => { orbit.rotation.y += dt * 0.9; orbit.rotation.x = Math.sin(t * 0.7) * 0.35; };
    return g;
  },

  fireCharge(M) {
    const g = new THREE.Group();
    const R = prng(7), flames = [];
    put(g, sph(0.55, 32, 24), M.main);
    put(g, sph(0.34, 20, 14), M.extra);
    for (let i = 0; i < 6; i++) {
      const d = V(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
      put(g, box(0.16, 0.12, 0.14, 0.03), M.accent, d.x * 0.55, d.y * 0.55, d.z * 0.55, R() * 3, R() * 3, R() * 3);
    }
    for (let i = 0; i < 10; i++) {
      const d = V(R() - 0.5, R() * 0.9 - 0.15, R() - 0.5).normalize(), h = 0.55 + R() * 0.55;
      const cg = cone(0.2 + R() * 0.1, h, 10); cg.translate(0, h / 2, 0);
      const f = along(g, cg, i % 2 ? M.glow : M.extra, d.clone().multiplyScalar(0.5), d);
      f.userData.seed = R() * 10; flames.push(f);
    }
    g.userData.anchors = { tip: V(0, 1, 0), wing: V(0, 0, -0.5) };
    g.userData.tick = (t) => flames.forEach((f) => f.scale.set(1 + 0.12 * Math.sin(t * 8 + f.userData.seed), 1 + 0.25 * Math.sin(t * 11 + f.userData.seed * 1.7), 1));
    return g;
  },

  iceCrystal(M) {
    const g = new THREE.Group();
    const crystal = (h, r) => flat(new THREE.LatheGeometry([V2(0.001, -h * 0.5), V2(r * 0.85, -h * 0.38), V2(r, -h * 0.1), V2(r, h * 0.22), V2(0.001, h * 0.5)], 6));
    put(g, crystal(2.7, 0.4), M.accent, 0, 0.1, 0);
    put(g, octa(0.2), M.glow, 0, 0.1, 0).scale.set(1, 1.6, 1);
    const R = prng(11);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3, h = 1.1 + R() * 0.8, tilt = 0.3 + R() * 0.15;
      const axis = V(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
      along(g, crystal(h, 0.2 + R() * 0.06), i % 2 ? M.main : M.dark, V(Math.cos(a) * 0.5, -0.9 + h * 0.4, Math.sin(a) * 0.5), axis);
    }
    put(g, flat(new THREE.IcosahedronGeometry(0.6, 0)), M.main, 0, -1.2, 0).scale.set(1.5, 0.5, 1.5);
    g.userData.anchors = { tip: V(0, 1.5, 0), wing: V(0, 0.2, -0.5) };
    return g;
  },

  blazeCore(M) {
    const g = new THREE.Group();
    put(g, box(0.95, 0.95, 0.95, 0.06), [M.main, M.main, M.main, M.main, M.accent, M.main]);
    put(g, sph(0.3, 16, 12), M.glow);
    const tiers = [];
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + k * 0.4;
        put(ring, box(0.1, 0.62, 0.1, 0.02), M.dark, Math.cos(a) * (0.85 + k * 0.1), -0.62 + k * 0.62, Math.sin(a) * (0.85 + k * 0.1));
      }
      g.add(ring); tiers.push(ring);
    }
    g.userData.anchors = { tip: V(0, 1.0, 0), wing: V(0, 0, -0.6) };
    g.userData.tick = (t, dt) => tiers.forEach((r, i) => { r.rotation.y += dt * (1.2 + i * 0.5) * (i % 2 ? -1 : 1); });
    return g;
  },

  trident(M) {
    const g = new THREE.Group();
    put(g, cyl(0.06, 0.06, 3.2, 12), M.main, 0, 0, 0);
    for (let i = 0; i < 5; i++) put(g, tor(0.07, 0.016, 6, 18), M.accent, 0, -1.3 + i * 0.5, 0, Math.PI / 2);
    put(g, cyl(0.075, 0.075, 0.5, 12), M.dark, 0, -1.2, 0);
    put(g, sph(0.1, 12, 10), M.accent, 0, -1.65, 0);
    const top = 1.6;
    put(g, tube([[-0.6, top + 0.55, 0], [-0.6, top + 0.2, 0], [-0.4, top - 0.12, 0], [0, top - 0.25, 0], [0.4, top - 0.12, 0], [0.6, top + 0.2, 0], [0.6, top + 0.55, 0]], 0.055, 40), M.main);
    const spear = new THREE.Shape();
    spear.moveTo(-0.12, 0); spear.lineTo(0.12, 0); spear.lineTo(0.14, 0.45); spear.lineTo(0, 0.95); spear.lineTo(-0.14, 0.45); spear.closePath();
    put(g, extrudeShape(spear, 0.07, 0.012), M.accent, 0, top - 0.05, 0);
    for (const s of [-1, 1]) {
      const sp = new THREE.Shape();
      sp.moveTo(-0.08, 0); sp.lineTo(0.08, 0); sp.lineTo(0, 0.5); sp.closePath();
      put(g, extrudeShape(sp, 0.06, 0.01), M.accent, s * 0.6, top + 0.5, 0);
      put(g, cone(0.045, 0.2, 6), M.accent, s * 0.6 + s * 0.07, top + 0.62, 0, 0, 0, -s * 0.9).userData.noAura = true;
    }
    put(g, octa(0.1), M.glow, 0, top - 0.25, 0.06).scale.set(1, 1.3, 1);
    g.userData.anchors = { tip: V(0, top + 0.9, 0), wing: V(0, 0.8, -0.1) };
    return g;
  },

  dragonCrystal(M) {
    const g = new THREE.Group();
    const core = put(g, octa(0.72), M.main); core.scale.set(1, 1.55, 1);
    const inner = put(g, octa(0.38), M.glow); inner.scale.set(1, 1.55, 1);
    put(g, octa(0.86), M.extra).scale.set(1, 1.55, 1);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      along(g, cone(0.13, 0.95, 8), M.dark, V(Math.cos(a) * 0.55, -1.25, Math.sin(a) * 0.55), V(-Math.cos(a) * 0.35, 1, -Math.sin(a) * 0.35));
      along(g, cone(0.08, 0.6, 6), M.accent, V(Math.cos(a + 0.8) * 0.4, 1.35, Math.sin(a + 0.8) * 0.4), V(Math.cos(a + 0.8) * 0.2, 1, Math.sin(a + 0.8) * 0.2));
    }
    const frames = [];
    for (let i = 0; i < 3; i++) frames.push(put(g, tor(1.1 + i * 0.1, 0.022, 6, 64), M.accent, 0, 0, 0, i * 1.0, i * 0.7, 0));
    const shards = new THREE.Group();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; put(shards, octa(0.1), M.accent, Math.cos(a) * 1.35, Math.sin(i * 2) * 0.5, Math.sin(a) * 1.35); }
    g.add(shards);
    g.userData.anchors = { tip: V(0, 1.6, 0), wing: V(0, 0, -0.5) };
    g.userData.tick = (t, dt) => {
      frames.forEach((f, i) => { f.rotation.x += dt * (0.5 + i * 0.3); f.rotation.y += dt * (0.4 - i * 0.2); });
      shards.rotation.y += dt * 0.9; inner.scale.set(1, 1.55, 1).multiplyScalar(1 + 0.12 * Math.sin(t * 3));
    };
    return g;
  },

  netherStar(M) {
    const g = new THREE.Group();
    const pts = starPts(4, 1.05, 0.3);
    const a = put(g, poly(pts, 0.32, 0.03), M.main);
    const b = put(g, poly(pts, 0.32, 0.03), M.main); b.rotation.y = Math.PI / 2;
    const c = put(g, poly(pts, 0.28, 0.03), M.main); c.rotation.y = Math.PI / 4; c.scale.setScalar(0.82);
    const core = put(g, sph(0.3, 20, 14), M.glow);
    for (let i = 0; i < 4; i++) { const ang = (i / 4) * TAU + Math.PI / 4; put(g, octa(0.08), M.accent, Math.cos(ang) * 0.75, 0, Math.sin(ang) * 0.75); }
    g.userData.anchors = { tip: V(0, 1.05, 0), wing: V(0, 0, -0.4) };
    g.userData.tick = (t) => { core.scale.setScalar(1 + 0.14 * Math.sin(t * 3.2)); a.rotation.z = Math.sin(t * 0.8) * 0.12; };
    return g;
  },
};

function fallback(M, item) {
  const g = new THREE.Group();
  put(g, new THREE.IcosahedronGeometry(item.size * 0.35, 1), M.main);
  g.userData.anchors = { tip: V(0, item.size * 0.4, 0) };
  return g;
}

/** Bangun model, normalkan ke item.size, pusatkan di origin. */
export function buildModel(item, M) {
  const raw = (BUILDERS[item.model] || fallback)(M, item);
  raw.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(raw);
  const sz = box3.getSize(V()), c = box3.getCenter(V());
  const s = item.size / Math.max(sz.x, sz.y, sz.z);
  const wrap = new THREE.Group();
  wrap.add(raw);
  raw.scale.setScalar(s);
  raw.position.copy(c).multiplyScalar(-s);
  const anchors = {};
  for (const [k, v] of Object.entries(raw.userData.anchors || {})) anchors[k] = v.clone().sub(c).multiplyScalar(s);
  anchors.tip ||= V(0, (sz.y * s) / 2, 0);
  anchors.wing ||= V(0, 0, -0.3);
  wrap.userData = { anchors, scale: s, extent: sz.clone().multiplyScalar(s), tick: raw.userData.tick };
  return wrap;
}

export const MODEL_IDS = Object.keys(BUILDERS);
