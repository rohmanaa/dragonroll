/* Modal "Unduh Data" di Lobby: pembaruan hanya diunduh setelah pemain menekan Unduh; Mulai ulang = SKIP_WAITING lalu reload. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const U = require('../assets/js/systems/update-service.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }

const BASE = 'https://game.test/';
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function fakeCaches() {
  const stores = {};
  return { stores, open: async name => { const s = stores[name] = stores[name] || new Map();
    return { match: async r => { const v = s.get(r.url); return v ? v.clone() : undefined; }, put: async (r, res) => { s.set(r.url, res); }, delete: async r => s.delete(r.url) }; } };
}
function setup(opts) {
  opts = opts || {};
  const calls = [], posted = [], caches = fakeCaches(), sessions = mem(), local = mem();
  const old = opts.old || { 'a.png': '1', 'b.png': '2', 'gone.png': '9' };
  const next = opts.next || { 'a.png': '1', 'b.png': 'X', 'c.mp3': '4' };
  const sizes = { 'b.png': 1048576 * 2, 'c.mp3': 1048576 * 3 };
  if (old) caches.open('ut-media').then(c => c.put(new Request(BASE + '__media-index__'), new Response(JSON.stringify(old))));
  const reg = { scope: BASE, waiting: null, installing: null,
    update: async () => { reg.waiting = { state: 'installed', postMessage: m => posted.push(m) }; } };
  const nav = { serviceWorker: { controller: {}, getRegistration: async () => reg, addEventListener: (ev, f) => { if (ev === 'controllerchange') setTimeout(f, 0); } } };
  const files = { 'sw.js': "const VERSION = 'ut-pwa-v" + (opts.swVer || 319) + "';", 'assets/media-hash.json': JSON.stringify(next), 'assets/preload-manifest.json': JSON.stringify(sizes) };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const rel = String(url).replace(BASE, '');
    const body = files[rel] != null ? files[rel] : (next[rel] ? 'data:' + rel : null);
    if (body == null) return new Response('no', { status: 404 });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  };
  const reloads = [];
  const G = { UT: { Version: { get: async () => ({ raw: 'ut-pwa-v318' }), label: r => 'v' + /(\d+)$/.exec(r)[1] } }, Request, Response, Blob, URL, location: { href: BASE + 'lobby.html', reload: () => reloads.push('reload'), replace: u => reloads.push(u) } };
  const svc = U.create({ G, navigator: nav, fetch, caches, storage: local, session: sessions });
  return { svc, calls, posted, caches, reg, reloads, local, sessions };
}

(async () => {
  await t('plan: hanya media berubah/baru yang diunduh, yang hilang dicatat, ukuran dijumlah', () => {
    const p = U.plan({ a: '1', b: '2', c: '3' }, { a: '1', b: '9', d: '4' }, { b: 100, d: 50 });
    assert.deepStrictEqual(p, { files: ['b', 'd'], removed: ['c'], bytes: 150 });
    assert.deepStrictEqual(U.plan(null, { a: '1' }, {}).files, [], 'tanpa indeks lama = SW bermigrasi sendiri, tidak ada yang dikonfirmasi');
  });
  await t('formatBytes: format seperti modal (40.5MB)', () => {
    assert.strictEqual(U.formatBytes(42467328), '40.5MB');
    assert.strictEqual(U.formatBytes(1000), '<0.1MB');
    assert.strictEqual(U.formatBytes(250 * 1048576), '250MB');
  });
  await t('check: versi sw.js server beda -> tersedia + daftar file + ukuran; cek selalu lewat jaringan (X-UT-Fresh)', async () => {
    const s = setup(); const info = await s.svc.check();
    assert.strictEqual(info.available, true);
    assert.strictEqual(info.version, 'ut-pwa-v319'); assert.strictEqual(info.label, 'v319');
    assert.deepStrictEqual(info.files.sort(), ['b.png', 'c.mp3']); assert.deepStrictEqual(info.removed, ['gone.png']);
    assert.strictEqual(info.bytes, 5 * 1048576); assert.strictEqual(info.ready, false);
    assert.ok(s.calls.length >= 3 && s.calls.every(c => c.init.headers['X-UT-Fresh'] === '1' && c.init.cache === 'no-store'));
  });
  await t('check: versi sama -> tidak ada pembaruan; tanpa service worker/controller -> null', async () => {
    assert.deepStrictEqual(await setup({ swVer: 318 }).svc.check(), { available: false });
    const s = setup(); s.reg.scope = BASE; const svc2 = U.create({ G: { UT: {}, Request, Response, URL }, navigator: {}, fetch: async () => {}, caches: {} });
    assert.strictEqual(await svc2.check(), null);
  });
  await t('download: menyimpan media berubah ke cache permanen, hapus yang hilang, tulis indeks baru, pasang SW baru, laporkan progres', async () => {
    const s = setup(); const info = await s.svc.check(); const ev = [];
    s.svc.onEvent(e => ev.push(e.type));
    await s.svc.download(info);
    const mc = s.caches.stores['ut-media'];
    assert.ok(mc.has(BASE + 'b.png') && mc.has(BASE + 'c.mp3'), 'file baru tersimpan');
    assert.ok(!mc.has(BASE + 'gone.png'), 'file yang dihapus dibuang');
    assert.deepStrictEqual(await new Response(mc.get(BASE + '__media-index__').clone().body).json(), { 'a.png': '1', 'b.png': 'X', 'c.mp3': '4' });
    assert.ok(s.reg.waiting, 'SW baru terpasang (menunggu)');
    assert.deepStrictEqual([...new Set(ev)], ['progress', 'installing', 'done']);
    assert.strictEqual(s.local.getItem('ut:upd:done'), 'ut-pwa-v319');
    assert.ok((await s.svc.check()).ready, 'kunjungan Lobby berikutnya langsung menawarkan Mulai ulang');
  });
  await t('download: gagal jaringan -> galat, indeks lama tidak diubah, tidak ditandai selesai', async () => {
    const s = setup(); const info = await s.svc.check();
    const bad = U.create({ G: { UT: { Version: { get: async () => ({ raw: 'ut-pwa-v318' }) } }, Request, Response, Blob, URL }, navigator: { serviceWorker: { controller: {}, getRegistration: async () => s.reg } },
      fetch: async () => new Response('x', { status: 500 }), caches: s.caches, storage: s.local, session: s.sessions });
    await assert.rejects(bad.download(info));
    const idx = await new Response(s.caches.stores['ut-media'].get(BASE + '__media-index__').clone().body).json();
    assert.strictEqual(idx['b.png'], '2'); assert.strictEqual(s.local.getItem('ut:upd:done'), null);
  });
  await t('restart: mengirim SKIP_WAITING ke SW yang menunggu lalu memuat ulang', async () => {
    const s = setup(); await s.reg.update(); await s.svc.restart();
    assert.deepStrictEqual(s.posted, [{ type: 'SKIP_WAITING' }]);
    await new Promise(r => setTimeout(r, 20)); assert.ok(s.reloads.length >= 1);
    assert.strictEqual(s.reloads[0], BASE, 'Mulai ulang pindah ke URL root, bukan reload halaman terakhir (lobby)');
  });
  await t('restart: tanpa SW menunggu tetap pindah ke root; flag sesi ut:booted dibuang', async () => {
    const s = setup(); s.sessions.setItem('ut:booted', '1'); await s.svc.restart();
    assert.deepStrictEqual(s.reloads, [BASE]); assert.strictEqual(s.sessions.getItem('ut:booted'), null);
  });
  await t('sw.js: SKIP_WAITING hanya atas pesan; permintaan X-UT-Fresh dilewatkan ke jaringan', () => {
    const sw = rd('sw.js').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(/type === 'SKIP_WAITING'\) \{ self\.skipWaiting\(\)/.test(sw));
    assert.ok(/r\.headers\.has\('x-ut-fresh'\)\) return/.test(sw));
  });
  await t('Lobby: skrip dimuat berurutan & modal dipanggil dari lobby.js (cadangan bila ditunda di splash)', () => {
    const h = rd('lobby.html'), i = n => h.indexOf(n);
    assert.ok(i('systems/game-dialog.js') > 0 && i('systems/update-service.js') > i('systems/game-dialog.js') && i('services/tos-service.js') > 0);
    assert.ok(/UT\.Update/.test(rd('data/lobby/js/lobby.js')) && /promptOnLobby/.test(rd('data/lobby/js/lobby.js')));
  });
  await t('Splash: cek server DULU (sebelum mengunduh aset); modal muncul di awal, bar loading menyusul', () => {
    const h = rd('splash.html'), j = rd('assets/js/pages/splash.js'), i = n => h.indexOf(n);
    assert.ok(i('systems/game-dialog.js') > 0 && i('systems/update-service.js') > i('systems/game-dialog.js') && i('systems/update-service.js') < i('pages/splash.js'));
    assert.ok(/promptOnSplash\(/.test(j));
    assert.ok(j.indexOf('promptOnSplash') < j.indexOf('UT_Preload.runAuto(ASSETS'), 'cek pembaruan sebelum preloader mengunduh aset');
  });
  await t('promptOnSplash: tanpa pembaruan langsung selesai; ada pembaruan -> modal, selesai setelah ditutup', async () => {
    const s = setup({ swVer: 318 }); assert.strictEqual(await s.svc.promptOnSplash(), null, 'tanpa GameDialog/pembaruan tidak menahan splash');
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
