/* Popup undangan teman (presence.js): tombol GABUNG/TOLAK memakai aset gambar (bukan gradien CSS) dan GABUNG tidak meninggalkan shell SPA. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fsrc = fs.readFileSync(path.join(__dirname, '..', 'src/multiplayer/presence.js'), 'utf8');
const BTN = 'assets/images/ui/buttons-and-controls/';
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('GABUNG = tombol-hijau-polos, TOLAK = tombol-merah-polos (aset ada di disk)', () => {
  assert(/mk\('GABUNG','tombol-hijau-polos\.webp'/.test(fsrc) && /mk\('TOLAK','tombol-merah-polos\.webp'/.test(fsrc));
  assert(/const BTN='assets\/images\/ui\/buttons-and-controls\/'/.test(fsrc));
  ['tombol-hijau-polos.webp', 'tombol-merah-polos.webp'].forEach(f => assert(fs.existsSync(path.join(__dirname, '..', BTN, f)), f));
});
t('tombol tidak lagi memakai latar gradien CSS', () => {
  assert(!/mk\('(GABUNG|TOLAK)','linear-gradient/.test(fsrc));
  assert(!/b\.style\.cssText='border:0;border-radius:10px;padding:8px 14px/.test(fsrc));
});
t('gaya tombol inline (popup muncul di halaman tanpa page.css)', () => assert(/position:relative;display:grid;place-items:center;width:150px;height:56px/.test(fsrc) && /object-fit:fill/.test(fsrc)));
t('GABUNG pindah lewat UT.Spa.go bila ada shell, fallback location.href', () => assert(/UT\.Spa&&UT\.Spa\.go\)UT\.Spa\.go\(u\);else location\.href=u/.test(fsrc)));
console.log(n + ' tes lulus');

