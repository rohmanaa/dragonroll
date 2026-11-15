/* LiveSync: penyegar data server tanpa refresh halaman. Jalankan: node tests/live-sync.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../assets/js/core/live-sync.js'), 'utf8');
const ROOT = path.join(__dirname, '..');
const pageSource = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pageScriptSources = html => Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), m => m[1]);
function env() {
  const L = {}, dl = {};
  const doc = { hidden: false, addEventListener: (n, f) => { (dl[n] = dl[n] || []).push(f); } };
  const win = { document: doc, navigator: { onLine: true }, setTimeout, clearTimeout,
    addEventListener: (n, f) => { (L[n] = L[n] || []).push(f); } };
  win.window = win; vm.runInNewContext(src, { window: win, setTimeout, clearTimeout, Date, Math, Promise });
  return { win, doc, fire: (n, e) => (L[n] || []).forEach(f => f(e)), fireDoc: n => (dl[n] || []).forEach(f => f()), LS: win.UT.LiveSync };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0; const T = async (name, fn) => { await fn(); n++; console.log('ok - ' + name); };
(async () => {
  await T('Shop dan Tambang memuat LiveSync canonical tepat sekali sebelum init/controller', async () => {
    const canonical = 'assets/js/core/live-sync.js';
    const legacy = 'assets/js/live-sync.js';
    assert.ok(fs.existsSync(path.join(ROOT, canonical)), 'implementasi canonical tersedia');
    [
      { file: 'shop.html', controller: 'assets/js/pages/shop-page.js', page: 'shop' },
      { file: 'tambang.html', controller: 'assets/js/pages/tambang.js', page: 'tambang' }
    ].forEach(({ file, controller, page }) => {
      const html = pageSource(file);
      const sources = pageScriptSources(html);
      assert.strictEqual(sources.filter(source => source === canonical).length, 1, file + ' harus memuat LiveSync canonical tepat sekali');
      assert.strictEqual(sources.includes(legacy), false, file + ' tidak boleh memakai path lama');
      const liveSyncTag = html.indexOf('<script src="' + canonical + '"></script>');
      const appInit = html.indexOf("UT.App.init({page:'" + page + "'})");
      const pageController = html.indexOf('<script src="' + controller + '"></script>');
      assert.ok(liveSyncTag >= 0 && liveSyncTag < appInit, file + ' LiveSync harus sebelum UT.App.init()');
      assert.ok(appInit >= 0 && appInit < pageController, file + ' UT.App.init() harus sebelum controller');
    });
  });
  await T('timer menjalankan semua tugas berulang', async () => {
    const e = env(); let a = 0, b = 0; e.LS.add('a', () => { a++; }); e.LS.add('b', async () => { b++; });
    e.LS.start({ interval: 15, minGap: 1 }); await sleep(120); e.LS.stop();
    assert.ok(a >= 3 && b >= 3, 'a=' + a + ' b=' + b);
  });
  await T('tab tersembunyi / offline: tidak memanggil server', async () => {
    const e = env(); let c = 0; e.LS.add('x', () => { c++; }); e.LS.start({ interval: 15, minGap: 1 });
    e.doc.hidden = true; await sleep(80); assert.strictEqual(c, 0, 'hidden');
    e.doc.hidden = false; e.win.navigator.onLine = false; await sleep(80); assert.strictEqual(c, 0, 'offline');
    e.win.navigator.onLine = true; await sleep(80); assert.ok(c >= 1, 'pulih'); e.LS.stop();
  });
  await T('tab kembali aktif / fokus / online memicu penyegaran segera', async () => {
    const e = env(); const seen = []; e.LS.add('x', r => { seen.push(r); }); e.LS.start({ interval: 100000, minGap: 1 });
    e.fireDoc('visibilitychange'); await sleep(10); e.fire('focus'); await sleep(10); e.fire('online'); await sleep(10);
    e.fire('pageshow', { persisted: false }); await sleep(10); e.fire('pageshow', { persisted: true }); await sleep(10); e.LS.stop();
    assert.deepStrictEqual(seen, ['visible', 'focus', 'online', 'pageshow']);
  });
  await T('minGap mencegah serangan berulang; tidak pernah dua putaran bersamaan', async () => {
    const e = env(); let c = 0, active = 0, maxActive = 0;
    e.LS.add('x', async () => { c++; active++; maxActive = Math.max(maxActive, active); await sleep(30); active--; });
    e.LS.start({ interval: 100000, minGap: 200 });
    e.fire('focus'); e.fire('focus'); e.fire('focus'); await sleep(80); e.LS.stop();
    assert.strictEqual(c, 1, 'hanya 1 putaran'); assert.strictEqual(maxActive, 1);
  });
  await T('gagal -> jeda berlipat (backoff), sukses -> kembali normal', async () => {
    const e = env(); let c = 0, fail = true; e.LS.add('x', () => { c++; return fail ? { ok: false } : { ok: true }; });
    e.LS.start({ interval: 20, maxInterval: 400, minGap: 1, immediate: true }); await sleep(300);
    const failedCalls = c; assert.ok(e.LS.status().fails >= 2, 'fails=' + e.LS.status().fails);
    assert.ok(failedCalls <= 7, 'backoff terlalu agresif: ' + failedCalls + ' panggilan');
    fail = false; e.fire('focus'); await sleep(60); assert.strictEqual(e.LS.status().fails, 0); e.LS.stop();
  });
  await T("throw / reject dihitung gagal, 'mode-lokal' tidak", async () => {
    const e = env(); e.LS.add('boom', () => { throw new Error('x'); }); e.LS.start({ interval: 100000, minGap: 1 });
    let r = await e.LS.now('t'); assert.strictEqual(r.ok, false); e.LS.stop();
    const f = env(); f.LS.add('lokal', () => ({ ok: false, reason: 'mode-lokal' })); f.LS.start({ interval: 100000, minGap: 1 });
    r = await f.LS.now('t'); assert.strictEqual(r.ok, true); f.LS.stop();
  });
  await T('minGap per tugas dihormati dan stop() menghentikan timer', async () => {
    const e = env(); let slow = 0, fast = 0; e.LS.add('slow', () => { slow++; }, { minGap: 100000 }); e.LS.add('fast', () => { fast++; });
    e.LS.start({ interval: 15, minGap: 1 }); await sleep(100); e.LS.stop(); const f0 = fast; await sleep(60);
    assert.strictEqual(slow, 1); assert.ok(fast >= 3); assert.strictEqual(fast, f0, 'stop() harus berhenti');
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
