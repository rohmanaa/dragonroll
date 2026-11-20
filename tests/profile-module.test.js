/* profile.js (SPA tahap 3): dibungkus UT.PageModule; semua navigasi lewat UT.Spa.go di shell; cleanup renderer/tekstur/kelas html. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'assets/js/pages/profile.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'profile.html'), 'utf8');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("profile")', () => assert(/UT\.PageModule\.define\('profile'/.test(src)));
t('nav memakai UT.Spa.go untuk semua target (tanpa syarat canView)', () => {
  const nav = src.slice(src.indexOf('const nav ='), src.indexOf('const BUILT'));
  assert(/UT\.Spa && UT\.Spa\.go\) \{ UT\.Spa\.go\(u\); return; \}/.test(nav));
  assert(!/canView/.test(nav));
});
t('cleanup: lepas SharedGL, buang tekstur, cabut kelas pf-wide', () => {
  assert(/SharedGL\.release\('profile'\)/.test(src));
  assert(/m\.map\) m\.map\.dispose\(\)/.test(src));
  assert(/classList\.remove\('pf-wide'\)/.test(src));
});
t('tidak ada WebGLRenderer sendiri', () => assert(!/new THREE\.WebGLRenderer/.test(src)));
t('profile.html memuat shared-gl dan page-module sebelum profile.js', () => {
  const a = html.indexOf('core/shared-gl.js'), b = html.indexOf('core/page-module.js'), c = html.indexOf('pages/profile.js');
  assert(a > 0 && b > a && c > b);
});
t('tombol Coin/Gem berada di atas panel kanan (z-index) - dulu tertutup #right', () => {
  const css = fs.readFileSync(path.join(root, 'assets/css/pages/profile-legacy.css'), 'utf8');
  assert(/\.cur\{[^}]*z-index:\s*[1-9]/.test(css));
});
console.log(n + ' tes lulus');
