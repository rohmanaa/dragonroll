/* tambang-world: konstanta, RNG, material — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 01 CORE: konstanta, RNG, material & geometri bersama ============ */
MW.W = 32;            // lebar dunia (unit voxel)
MW.H = 18;            // tinggi tiap layer
MW.LAYERS = 6;
MW.SHAFT = { x0: 1, x1: 5 };           // ruang shaft lift: x 1..5
MW.FLOOR = 3;                          // lantai lorong (lokal) layer 2-6
MW.GROUND = 12;                        // permukaan tanah layer 1 (lokal)
MW.stopY = [12, 3, 3, 3, 3, 3];        // tinggi berhenti lift per layer (lokal)
MW.worldY = (layer, y) => y - layer * MW.H;
MW.NAMES = ['Base Camp', 'Stone Mine', 'Crystal Mine', 'Deep Mine', 'Ancient Mine', 'Mystery Mine'];

MW.rng = function (seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* --- cache material & geometri agar bisa dipakai ulang (hemat draw call/memori) --- */
MW._mat = {};
MW.M = function (color, emissive, ei) {
  const k = color + '|' + (emissive || 0) + '|' + (ei || 0);
  if (!MW._mat[k]) {
    MW._mat[k] = new THREE.MeshLambertMaterial({ color: color, emissive: emissive || 0x000000 });
    if (emissive) MW._mat[k].emissiveIntensity = ei === undefined ? 1 : ei;
  }
  return MW._mat[k];
};
MW.glow = function (color) {              // material self-lit (kristal, retakan, lampu)
  const k = 'glow' + color;
  if (!MW._mat[k]) MW._mat[k] = new THREE.MeshBasicMaterial({ color: color });
  return MW._mat[k];
};
MW.unitBox = new THREE.BoxGeometry(1, 1, 1);
MW.unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
MW.unitCyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);

/* box berpusat di (x,y,z) ukuran (w,h,d) */
MW.B = function (parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(MW.unitBox, typeof mat === 'number' ? MW.M(mat) : mat);
  m.scale.set(w, h, d); m.position.set(x || 0, y || 0, z || 0);
  if (parent) parent.add(m);
  return m;
};
/* box dengan titik bawah di y */
MW.Bb = function (parent, w, h, d, mat, x, y, z) {
  return MW.B(parent, w, h, d, mat, x, (y || 0) + h / 2, z);
};
MW.shade = function (hex, f) {
  const c = new THREE.Color(hex); c.multiplyScalar(f); return c;
};

/* --- bantu InstancedMesh: kumpulkan matriks lalu bangun sekali --- */
MW.InstBuilder = function (geo, mat) {
  this.geo = geo; this.mat = mat; this.items = [];
};
MW.InstBuilder.prototype.add = function (x, y, z, sx, sy, sz, color, rx, ry, rz) {
  this.items.push([x, y, z, sx, sy, sz, color, rx || 0, ry || 0, rz || 0]);
};
MW.InstBuilder.prototype.build = function (parent, name) {
  const n = this.items.length;
  if (!n) return null;
  const im = new THREE.InstancedMesh(this.geo, this.mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const it = this.items[i];
    p.set(it[0], it[1], it[2]); s.set(it[3], it[4], it[5]);
    e.set(it[7], it[8], it[9]); q.setFromEuler(e);
    m.compose(p, q, s); im.setMatrixAt(i, m);
    c.set(it[6]); im.setColorAt(i, c);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;     // satu mesh per layer; culling dilakukan di tingkat Group
  if (name) im.name = name;
  if (parent) parent.add(im);
  return im;
};

/* --- grid voxel per layer: solid[x][y] --- */
MW.makeGrid = function () {
  const g = [];
  for (let x = 0; x < MW.W; x++) { g.push(new Uint8Array(MW.H).fill(1)); }
  return g;
};
MW.carve = function (grid, x0, x1, y0, y1) {   // kosongkan sel x0..x1, y0..y1 (inklusif)
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
    if (x >= 0 && x < MW.W && y >= 0 && y < MW.H) grid[x][y] = 0;
};
MW.isSolid = function (grid, x, y) {
  if (x < 0 || x >= MW.W || y < 0 || y >= MW.H) return true;
  return grid[x][y] === 1;
};
/* profil langit-langit acak yang deterministik */
MW.ceilProfile = function (seed, x0, x1, lo, hi, segMin, segMax) {
  const r = MW.rng(seed), out = {};
  let x = x0;
  while (x <= x1) {
    const w = segMin + Math.floor(r() * (segMax - segMin + 1));
    const h = lo + Math.floor(r() * (hi - lo + 1));
    for (let i = 0; i < w && x <= x1; i++, x++) out[x] = h;
  }
  return out;
};
})();
