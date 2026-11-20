/* Modal "Pakai Totem?": kedua tombol (.tm-y Pakai, .tm-n Tidak) memakai ASET gambar, bukan gradasi CSS. Penyebab bug lama:
   `.tm-bt .tm-y { background: linear-gradient(...) !important }` (spesifisitas lebih tinggi) mengalahkan `.tm-bt button { background: url(...) !important }`. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = f => path.join(__dirname, '..', f);
const css = fs.readFileSync(root('gameplay/css/hud-mockup.css'), 'utf8');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

/* kumpulkan semua aturan yang menyentuh .tm-y / .tm-n */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
const touching = k => rules.filter(r => new RegExp('\\.tm-' + k + '\\b').test(r.sel));

t('hud-mockup.css: tidak ada aturan !important berlatar gradasi pada .tm-y / .tm-n', () => {
  for (const k of ['y', 'n']) touching(k).forEach(r => assert(!(/gradient/.test(r.body) && /!important/.test(r.body)), 'gradasi !important pada ' + r.sel));
});
t('.tm-y dan .tm-n punya aturan background-image url(...) !important ke aset yang ada', () => {
  for (const k of ['y', 'n']) {
    const r = touching(k).find(x => /background-image:\s*url\(/.test(x.body) && /!important/.test(x.body));
    assert(r, 'aturan gambar .tm-' + k + ' tidak ada');
    const u = /url\("?([^")]+)"?\)/.exec(r.body)[1];
    assert(fs.existsSync(path.join(root('gameplay/css'), u)), 'aset hilang: ' + u);
  }
});
t('tombol Pakai = hijau, tombol Tidak = biru (aset tombol-*-polos)', () => {
  const g = k => /url\("?([^")]+)"?\)/.exec(touching(k).find(x => /background-image:\s*url\(/.test(x.body)).body)[1];
  assert(/tombol-hijau-polos\.webp$/.test(g('y')) && /tombol-biru-polos\.webp$/.test(g('n')));
});
t('aturan dasar .tm-bt button tetap memakai gambar (bukan hanya warna)', () => {
  assert(rules.some(r => /\.tm-bt button\b/.test(r.sel) && /background:\s*url\(/.test(r.body) && /!important/.test(r.body)));
});
console.log(n + ' tes lulus');
