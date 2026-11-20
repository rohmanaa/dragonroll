/* Layar penuh / normal: Electron lewat electronAPI, web lewat Fullscreen API dokumen paling atas; tombol Pengaturan terhubung. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const DM = require('../assets/js/core/display-mode.js');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }

function webDoc(o) {
  o = o || {};
  const L = {};
  const d = { fullscreenEnabled: o.enabled !== false, fullscreenElement: null, addEventListener: (k, f) => { (L[k] = L[k] || []).push(f); }, removeEventListener: (k, f) => { L[k] = (L[k] || []).filter(x => x !== f); },
    fire: k => (L[k] || []).forEach(f => f()), L };
  d.documentElement = { requestFullscreen: async opt => { d.reqOpt = opt; if (o.deny) throw new Error('ditolak'); d.fullscreenElement = d.documentElement; d.fire('fullscreenchange'); } };
  d.exitFullscreen = async () => { d.fullscreenElement = null; d.fire('fullscreenchange'); };
  return d;
}
const win = (d, extra) => Object.assign({ document: d, setTimeout: (f) => f(), addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) }, extra || {});

(async () => {
  await t('web: kind web, masuk fullscreen lewat requestFullscreen (navigationUI hide), keluar lewat exitFullscreen', async () => {
    const d = webDoc(), W = win(d); W.top = W;
    const D = DM.create({ G: W });
    assert.strictEqual(D.kind(), 'web'); assert.strictEqual(D.supported(), true);
    assert.strictEqual(await D.isFullscreen(), false);
    assert.strictEqual(await D.set(true), true); assert.deepStrictEqual(d.reqOpt, { navigationUI: 'hide' });
    assert.strictEqual(await D.isFullscreen(), true);
    assert.strictEqual(await D.set(false), false);
  });
  await t('web: dokumen paling atas dipakai (halaman di dalam iframe shell)', async () => {
    const top = webDoc(), mine = webDoc();
    const W = win(mine, { top: win(top) });
    const D = DM.create({ G: W });
    await D.set(true);
    assert(top.fullscreenElement && !mine.fullscreenElement);
  });
  await t('web: ditolak browser -> promise ditolak (UI menampilkan toast)', async () => {
    const W = win(webDoc({ deny: true })); W.top = W;
    await assert.rejects(DM.create({ G: W }).set(true));
  });
  await t('web: tidak didukung (fullscreenEnabled false) -> supported false, set ditolak', async () => {
    const W = win(webDoc({ enabled: false })); W.top = W;
    const D = DM.create({ G: W });
    assert.strictEqual(D.kind(), 'none'); assert.strictEqual(D.supported(), false);
    await assert.rejects(D.set(true));
  });
  await t('web: PWA display-mode fullscreen dihitung sebagai fullscreen', async () => {
    const W = win(webDoc(), { matchMedia: () => ({ matches: true }) }); W.top = W;
    assert.strictEqual(await DM.create({ G: W }).isFullscreen(), true);
  });
  await t('web: on() dipanggil saat fullscreenchange (mis. tombol Esc) dan bisa dilepas', async () => {
    const d = webDoc(), W = win(d); W.top = W;
    const D = DM.create({ G: W }), got = [];
    const off = D.on(v => got.push(v));
    await D.set(true); await new Promise(r => setImmediate(r));
    assert.strictEqual(got[got.length - 1], true);
    off(); const k = got.length; await D.set(false); await new Promise(r => setImmediate(r));
    assert.strictEqual(got.length, k);
  });
  await t('electron: memakai electronAPI.setFullscreen/getFullscreen dan hasil aktual', async () => {
    let state = true; const calls = [];
    const W = win(webDoc(), { electronAPI: { setFullscreen: async v => { calls.push(v); state = v; return state; }, getFullscreen: async () => state } });
    const D = DM.create({ G: W });
    assert.strictEqual(D.kind(), 'electron');
    assert.strictEqual(await D.isFullscreen(), true);
    assert.strictEqual(await D.set(false), false); assert.deepStrictEqual(calls, [false]);
  });
  await t('settings.html memuat display-mode.js & page-module.js sebelum settings.js; settings-electron.js yang tak terpakai sudah dihapus', () => {
    const h = rd('settings.html'), i = h.indexOf('pages/settings.js');
    assert(h.indexOf('core/display-mode.js') > 0 && h.indexOf('core/display-mode.js') < i);
    assert(h.indexOf('core/page-module.js') > 0 && h.indexOf('core/page-module.js') < i);
    assert(!fs.existsSync(path.join(__dirname, '../assets/js/pages/settings-electron.js')));
  });
  await t('settings.js: tombol tampilan memakai UT.Display; dibungkus PageModule; nav lewat UT.Spa.go; langganan dilepas', () => {
    const js = rd('assets/js/pages/settings.js');
    assert(/UT\.PageModule\.define\('settings'/.test(js) && /\}\);\s*$/.test(js));
    assert(/UT\.Display/.test(js) && /D\.set\(want\)/.test(js) && /env\.own\(D\.on\(/.test(js));
    assert(/const go=u=>\{if\(UT\.Spa&&UT\.Spa\.go\)/.test(js));
    assert(/env\.own\(A\.on\(render\)\)/.test(js) && /env\.own\(PF\(\)\.on\(/.test(js));
    assert(/UT\.Version\.apply\(document\)/.test(js));
    assert(!/window\.addEventListener/.test(js));
  });
  await t('settings terdaftar di spa-host, frame-guard, prefetch play.js', () => {
    assert(/'settings\.html': 'settings'/.test(rd('assets/js/core/spa-host.js')));
    assert(/mail\|settings\)/.test(rd('assets/js/frame-guard.js')));
    assert(/'settings\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
