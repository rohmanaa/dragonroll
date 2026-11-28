/* Modal "Pakai Totem?": tombol memakai komponen HUD (ut-gl): Pakai = hijau (ut-c-g), Tidak = merah (ut-c-r).
   Tidak boleh ada lagi aturan gambar/gradasi !important pada .tm-y / .tm-n yang menimpa komponen. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = f => path.join(__dirname, '..', f);
const css = fs.readFileSync(root('src/gameplay/css/hud-mockup.css'), 'utf8') + fs.readFileSync(root('src/gameplay/css/gameplay.css'), 'utf8') + fs.readFileSync(root('src/gameplay/css/gameplay-overrides.css'), 'utf8');
const js = fs.readFileSync(root('src/gameplay/js/main.js'), 'utf8');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
const touching = rules.filter(r => /\.tm-(y|n)\b|\.tm-bt button\b/.test(r.sel));

t('tombol Totem dibuat dengan ut-gl: Pakai hijau, Tidak merah', () => {
  assert(js.includes('class="tm-y ut-gl ut-c-g"') && js.includes('class="tm-n ut-gl ut-c-r"'));
});
t('tidak ada aturan gambar/gradasi/shadow pada .tm-y / .tm-n / .tm-bt button', () => {
  touching.forEach(r => assert(!/background|box-shadow|border-radius/.test(r.body), 'cat lama pada ' + r.sel));
});
console.log(n + ' tes lulus');

