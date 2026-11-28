/* Versi game = VERSION di sw.js: SW menjawab GET_VERSION, halaman (splash, settings) mengisi dari sana tanpa edit manual tiap rilis. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const AV = require('../src/core/app-version.js');
const swSrc = rd('sw.js');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }

function fakeEls(k) { return Array.from({ length: k }, () => ({ textContent: '', hidden: true, title: '' })); }
function fakeDoc(els) { return { querySelectorAll: s => (s === '[data-app-version]' ? els : []) }; }
function fakeController(reply) {
  return { postMessage(msg, ports) { if (reply) setTimeout(() => ports[0].postMessage(reply(msg)), 0); } };
}
class MC { constructor() { const a = {}, b = {}; this.port1 = a; this.port2 = { postMessage: d => a.onmessage && a.onmessage({ data: d }) }; } }

(async () => {
  await t('parse mengambil VERSION dari teks sw.js yang asli', () => {
    const v = AV.parse(swSrc);
    assert(/^ut-pwa-v\d+$/.test(v), v);
    assert.strictEqual(AV.parse("const VERSION = \"x-v9\";"), 'x-v9');
    assert.strictEqual(AV.parse('tanpa versi'), null);
  });
  await t('label: ut-pwa-v307 -> v307; format lain apa adanya', () => {
    assert.strictEqual(AV.label('ut-pwa-v307'), 'v307');
    assert.strictEqual(AV.label('ut-pwa-v1.2.3'), 'v1.2.3');
    assert.strictEqual(AV.label('beta'), 'beta');
  });
  await t('sw.js: handler message menjawab GET_VERSION dengan VERSION lewat port; abaikan pesan lain', () => {
    const L = {}; const posted = [];
    const self = { addEventListener: (k, f) => { L[k] = f; }, registration: { scope: 'http://x/' }, clients: { claim() {} } };
    new Function('self', 'caches', 'fetch', 'URL', swSrc)(self, {}, () => {}, URL);
    assert(typeof L.message === 'function');
    L.message({ data: { type: 'GET_VERSION' }, ports: [{ postMessage: d => posted.push(d) }] });
    L.message({ data: { type: 'LAIN' }, ports: [{ postMessage: d => posted.push(d) }] });
    L.message({ data: null, ports: [] });
    assert.deepStrictEqual(posted, [{ type: 'VERSION', version: AV.parse(swSrc) }]);
  });
  await t('get: memakai versi dari SW aktif (controller)', async () => {
    const v = AV.create({ G: { MessageChannel: MC }, navigator: { serviceWorker: { controller: fakeController(() => ({ type: 'VERSION', version: 'ut-pwa-v12' })) } }, fetch: () => { throw new Error('tidak boleh fetch'); } });
    assert.deepStrictEqual(await v.get(), { raw: 'ut-pwa-v12', label: 'v12' });
  });
  await t('get: SW lama tanpa handler (timeout) -> cadangan baca sw.js', async () => {
    const v = AV.create({ G: { MessageChannel: MC }, timeout: 20, navigator: { serviceWorker: { controller: fakeController(null) } }, fetch: async () => ({ ok: true, text: async () => "const VERSION = 'ut-pwa-v5';" }) });
    assert.strictEqual((await v.get()).label, 'v5');
  });
  await t('get: tanpa controller (kunjungan pertama/Electron) -> baca sw.js; gagal total -> null', async () => {
    const a = AV.create({ G: {}, navigator: {}, fetch: async () => ({ ok: true, text: async () => "const VERSION = 'ut-pwa-v7';" }) });
    assert.strictEqual((await a.get()).label, 'v7');
    const b = AV.create({ G: {}, navigator: {}, fetch: async () => { throw new Error('offline'); } });
    assert.strictEqual(await b.get(), null);
  });
  await t('apply: mengisi semua [data-app-version] dan menampilkannya; kosong bila versi tidak diketahui', async () => {
    const els = fakeEls(2);
    const v = AV.create({ G: {}, navigator: {}, document: fakeDoc(els), fetch: async () => ({ ok: true, text: async () => "const VERSION = 'ut-pwa-v307';" }) });
    await v.apply();
    els.forEach(e => { assert.strictEqual(e.textContent, 'Versi v307'); assert.strictEqual(e.hidden, false); assert.strictEqual(e.title, 'ut-pwa-v307'); });
    const els2 = fakeEls(1);
    const w = AV.create({ G: {}, navigator: {}, document: fakeDoc(els2), fetch: async () => { throw new Error('x'); } });
    await w.apply(); assert.strictEqual(els2[0].hidden, true); assert.strictEqual(els2[0].textContent, '');
  });
  await t('splash & settings: elemen data-app-version + skrip dimuat; teks versi TIDAK ditulis manual di halaman', () => {
    for (const f of ['splash.html', 'settings.html']) {
      const h = rd(f);
      assert(/data-app-version/.test(h) && /core\/app-version\.js/.test(h), f);
      assert(!/ut-pwa-v\d+|Versi v\d+/.test(h), f + ' tidak boleh berisi nomor versi tetap');
    }
    assert(/#ver\b/.test(rd('src/styles/splash.css')) && /#appver\b/.test(rd('src/styles/settings.css')));
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });

