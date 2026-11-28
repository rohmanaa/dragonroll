/* Pembukaan berikutnya tidak memindai/mengunduh ulang ratusan file yang sudah ada di cache perangkat. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }

function env(cachedSet, files, marker) {
  const calls = [], store = marker == null ? {} : { 'ut:preload:sig': marker };
  global.window = global;
  global.location = { origin: 'https://g.test' };
  Object.defineProperty(global, 'localStorage', { configurable: true, value: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } });
  Object.defineProperty(global, 'caches', { configurable: true, value: { match: async u => (cachedSet.has(u) ? {} : undefined) } });
  global.requestAnimationFrame = f => setTimeout(() => f(performance.now()), 0);
  global.fetch = async u => { calls.push(u); if (u === 'assets/preload-manifest.json') return { ok: true, json: async () => files }; if (files[u] === 'FAIL') return { ok: true, status: 404, body: null, arrayBuffer: async () => new ArrayBuffer(0) }; return { ok: true, status: 200, body: null, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(8) }; };
  delete require.cache[require.resolve('../assets/js/preloader.js')];
  require('../assets/js/preloader.js');
  return { P: global.UT_Preload, calls, store };
}
function manifest() { const m = {}; for (let i = 0; i < 30; i++) m['assets/js/f' + i + '.js'] = 1000 + i; for (let i = 0; i < 30; i++) m['assets/img/i' + i + '.webp'] = 5000 + i; return m; }
const sigOf = m => Object.keys(m).length + ':' + Object.values(m).reduce((a, b) => a + b, 0);

(async () => {
  await t('pembukaan pertama: mengunduh semua, lalu menyimpan tanda tangan daftar aset', async () => {
    const m = manifest(), e = env(new Set(), m, null);
    await e.P.runAuto([], () => {});
    assert.strictEqual(e.calls.filter(u => u !== 'assets/preload-manifest.json').length, 60);
    assert.strictEqual(e.store['ut:preload:sig'], sigOf(m));
  });
  await t('pembukaan berikutnya (tanda tangan sama + contoh ada di cache): tidak ada fetch aset sama sekali, langsung 100%', async () => {
    const m = manifest(), all = new Set(Object.keys(m)), e = env(all, m, sigOf(m)); let last = -1;
    await e.P.runAuto([], p => { last = p; });
    assert.deepStrictEqual(e.calls, ['assets/preload-manifest.json']); assert.strictEqual(last, 100);
  });
  await t('setelah pembaruan versi (cache kode baru kosong): contoh kode hilang -> unduh penuh hanya untuk yang belum ada', async () => {
    const m = manifest(), cached = new Set(Object.keys(m).filter(u => /\.webp$/.test(u))), e = env(cached, m, sigOf(m));
    await e.P.runAuto([], () => {});
    const got = e.calls.filter(u => u !== 'assets/preload-manifest.json');
    assert.strictEqual(got.length, 30, 'hanya 30 file kode; media yang sudah ada dilewati'); assert.ok(got.every(u => /\.js$/.test(u)));
  });
  await t('daftar aset berubah (rilis baru): tanda tangan beda -> pindai penuh, file yang sudah ada tetap dilewati (kode DAN media)', async () => {
    const m = manifest(), old = sigOf(m); m['assets/js/baru.js'] = 777;
    const cached = new Set(Object.keys(m).filter(u => u !== 'assets/js/baru.js')), e = env(cached, m, old);
    await e.P.runAuto([], () => {});
    assert.deepStrictEqual(e.calls.filter(u => u !== 'assets/preload-manifest.json'), ['assets/js/baru.js']);
    assert.strictEqual(e.store['ut:preload:sig'], sigOf(m));
  });
  await t('ada file gagal diunduh -> tanda tangan TIDAK disimpan (dicoba lagi pembukaan berikutnya)', async () => {
    const m = manifest(), files = Object.assign({}, m); files['assets/img/i3.webp'] = 'FAIL';
    const e = env(new Set(), files, null);
    await e.P.runAuto([], () => {});
    assert.strictEqual(e.store['ut:preload:sig'], undefined);
  });
  await t('splash: batas tunggu cek pembaruan dipersingkat (maks 2,5 dtk) dan sw.js memakai ulang handle cache', () => {
    assert.ok(/promptOnSplash\(2500,/.test(fs.readFileSync(path.join(__dirname, '..', 'assets/js/pages/splash.js'), 'utf8')));
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    assert.ok(/const mediaCache = /.test(sw) && /const codeCache = /.test(sw) && !/respondWith\(caches\.open/.test(sw));
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
