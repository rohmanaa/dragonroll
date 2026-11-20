/* Kriteria SPA: tidak ada `new THREE.WebGLRenderer` di luar UT.SharedGL.
   PENGECUALIAN_SENGAJA = memang mandiri (halaman contoh, gameplay dibekukan).
   PELANGGAR_TERSISA    = utang migrasi; setiap tahap tab MENGHAPUS satu entri dari daftar ini (tes gagal bila entri sudah bersih,
   supaya daftar tidak membusuk). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'referensi', 'release', 'tests', 'audit', 'docs', 'promosi', 'tools']);
const PATTERN = /new\s+(?:THREE|T)\.WebGLRenderer\s*\(/;

const SHARED_GL = 'assets/js/core/shared-gl.js';
const PENGECUALIAN_SENGAJA = [
  'assets/js/pages/floatingsample.js',
  'gameplay/js/main.js',
  'gameplay/js/duel-ui.js'          // di area gameplay yang dibekukan
];
const PELANGGAR_TERSISA = [
  'assets/js/renderers/power-3d/power-renderer.js',
  'assets/js/renderers/dice-kit/dice-renderer.js',
  'data/inventory/aura/_shared/js/efek.js'
];
const PEMEGANG_OFFSCREEN = ['assets/js/renderers/character-face.js'];   // jalur cadangan bila SharedGL.offscreen tidak ada

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); continue; }
    if (/\.(js|mjs|html)$/.test(e.name)) out.push(path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/'));
  }
  return out;
}

const hits = walk(ROOT, []).filter(f => PATTERN.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
const allowed = new Set([SHARED_GL, ...PENGECUALIAN_SENGAJA, ...PELANGGAR_TERSISA, ...PEMEGANG_OFFSCREEN]);

assert.deepStrictEqual(hits.filter(f => !allowed.has(f)), [], 'renderer baru di luar SharedGL: pakai UT.SharedGL.acquire');
for (const f of PELANGGAR_TERSISA) assert.ok(hits.includes(f), f + ' sudah bersih: hapus dari PELANGGAR_TERSISA');

/* Pet (tahap 1) sudah bersih dan tidak boleh kembali */
assert.ok(!hits.includes('data/inventory/pet/_shared/js/pet-viewer.js'));
const viewer = fs.readFileSync(path.join(ROOT, 'data/inventory/pet/_shared/js/pet-viewer.js'), 'utf8');
assert.match(viewer, /SGL\.acquire\(GL_OWNER/);
assert.match(viewer, /SharedGL\.release\(GL_OWNER/);
assert.ok(!/forceContextLoss/.test(viewer), 'renderer bersama tidak boleh dimatikan oleh satu halaman');
const pet = fs.readFileSync(path.join(ROOT, 'pet.html'), 'utf8');
assert.ok(pet.indexOf('assets/js/core/shared-gl.js') > pet.indexOf('assets/js/vendor/three.min.js'));
assert.ok(pet.indexOf('assets/js/core/shared-gl.js') < pet.indexOf('data/inventory/pet/_shared/js/pet-viewer.js'));

console.log('ok - WebGLRenderer hanya di SharedGL; pelanggar tersisa: ' + PELANGGAR_TERSISA.length);
