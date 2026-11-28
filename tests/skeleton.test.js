/* Sistem "item memuat" ala COC: kerangka UI langsung tampil, gambar item yang belum tiba = placeholder kilap lalu fade-in. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { create } = require('../assets/js/systems/skeleton.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fakeImg(o) {
  o = o || {}; const cls = new Set(), ls = {};
  return { nodeType: 1, tagName: 'IMG', complete: !!o.complete, naturalWidth: o.complete ? 10 : 0, getAttribute: () => 'x.webp', classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
    closest: sel => (o.inOverlay ? {} : null), addEventListener: (e, f) => { ls[e] = f; }, removeEventListener: (e) => { delete ls[e]; }, fire: e => ls[e] && ls[e](), ls };
}
const mk = () => create({ G: {}, document: null, delay: 20 });

(async () => {
  await t('gambar yang sudah siap/ter-cache tidak diberi placeholder (tanpa kedip)', async () => {
    const s = mk(), a = fakeImg({ complete: true }); s.scan(a); await sleep(40);
    assert.ok(!a.classList.contains('ut-sk') && !a.classList.contains('ut-sk-in'));
    const b = fakeImg(); s.scan(b); b.complete = true; b.fire('load'); await sleep(40);   // tiba sebelum DELAY
    assert.ok(!b.classList.contains('ut-sk') && !b.classList.contains('ut-sk-in'), 'tiba cepat = tanpa efek');
  });
  await t('gambar lambat: placeholder muncul setelah DELAY, lalu fade-in saat load, kelas dilepas', async () => {
    const s = mk(), a = fakeImg(); s.scan(a);
    assert.ok(!a.classList.contains('ut-sk'), 'belum langsung');
    await sleep(40); assert.ok(a.classList.contains('ut-sk'));
    a.complete = true; a.fire('load');
    assert.ok(!a.classList.contains('ut-sk') && a.classList.contains('ut-sk-in'));
    await sleep(450); assert.ok(!a.classList.contains('ut-sk-in'), 'kelas fade-in dibuang agar tidak menimpa animasi halaman');
  });
  await t('gambar gagal dimuat: placeholder dilepas (tidak berkilat selamanya)', async () => {
    const s = mk(), a = fakeImg(); s.scan(a); await sleep(40); assert.ok(a.classList.contains('ut-sk'));
    a.fire('error'); assert.ok(!a.classList.contains('ut-sk') && !a.classList.contains('ut-sk-in'));
  });
  await t('layar muat (#ov/#gl, data-no-sk) dikecualikan; node bukan img diabaikan; scan container menemukan img di dalamnya', async () => {
    const s = mk(), a = fakeImg({ inOverlay: true }); s.scan(a); await sleep(40); assert.ok(!a.classList.contains('ut-sk'));
    s.scan({ nodeType: 3 }); s.scan(null);
    const inner = fakeImg(), box = { nodeType: 1, tagName: 'DIV', querySelectorAll: () => [inner] };
    s.scan(box); await sleep(40); assert.ok(inner.classList.contains('ut-sk'));
  });
  await t('tidak memasang pengamat ganda pada img yang sama', async () => {
    const s = mk(), a = fakeImg(); s.scan(a); s.scan(a); s.scan(a); await sleep(40);
    a.complete = true; a.fire('load'); assert.ok(a.classList.contains('ut-sk-in'));
  });
  await t('semua halaman mendapat sistem ini lewat renderBase; font utama di-preload dan ada di repo; font-display bukan swap', () => {
    const ps = rd('assets/js/core/page-shell.js');
    assert.ok(/enabled\('skeleton'\) \? 'assets\/css\/components\/skeleton\.css'/.test(ps) && /enabled\('skeleton'\) \? 'assets\/js\/systems\/skeleton\.js'/.test(ps));
    const m = /FONT_PRELOAD = \[([^\]]+)\]/.exec(ps); assert.ok(m);
    const fonts = m[1].match(/'([^']+)'/g).map(x => x.replace(/'/g, '')); assert.ok(fonts.length >= 3);
    fonts.forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', f)), 'font preload harus ada: ' + f));
    assert.ok(!/font-display:\s*swap/.test(rd('assets/css/fonts.css')));
    assert.ok(/'assets\/js\/systems\/skeleton\.js'/.test(rd('sw.js')) && /skeleton\.css/.test(rd('sw.js')));
  });
  await t('spa-host: prepare() menghangatkan CSS + aset url() ke cache sebelum halaman dibuka; hormati Save-Data/2g', () => {
    const s = rd('assets/js/core/spa-host.js');
    assert.ok(/function prepare\(page\) \{\s*return fetchPage\(page\)\.then\(function \(p\) \{ warmCss\(p\)/.test(s));
    assert.ok(/saveData/.test(s.slice(s.indexOf('function warmCss'))) && /woff2/.test(s.slice(s.indexOf('function warmCss'))));
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
