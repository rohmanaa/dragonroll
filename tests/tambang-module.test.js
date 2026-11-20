/* tambang (SPA tahap 3): modul halaman, navigasi lewat UT.Spa.go, ?from= dari rute aktif, renderer bersama, cleanup lengkap. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('data/mining/js/tambang.js'), html = rd('tambang.html'), isl = rd('data/mining/js/mine-island.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("tambang")', () => { assert(/UT\.PageModule\.define\('tambang'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(\(\)=>\{/m.test(js)); });
t('nav selalu lewat UT.Spa.go (tanpa location.href langsung selain fallback mandiri)', () => {
  assert(/const nav=u=>\{if\(UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\);return\}location\.href=u\}/.test(js));
  assert(!/canView/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1);
  assert(/nav\(FROM\)/.test(js) && /nav\('shop\.html\?coin=1'\)/.test(js));
});
t('?from= dibaca dari URL rute aktif (location.search di shell milik play.html)', () => {
  assert(/UT\.Spa\.current\(\)/.test(js) && /c\.name==='tambang'/.test(js) && /new URLSearchParams\(search\(\)\)/.test(js));
});
t('langganan dilepas via env.own; penjaga window.__curSub dihapus', () => { assert(!/__curSub/.test(js)); assert(/env\.own\(PD\.subscribe/.test(js)); });
t('listener dokumen lewat env.on; timer/rAF lewat env', () => {
  assert(/env\.on\(document,'visibilitychange'/.test(js)); assert(!/document\.addEventListener/.test(js));
  assert(/const \{setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,addEventListener\}=env/.test(js));
});
t('LiveSync dilepas dan dihentikan saat unmount', () => assert(/LS\.remove\('wallet'\);LS\.stop\(\)/.test(js)));
t('callback async dijaga env.disposed (load, act, loop)', () => { assert((js.match(/env\.disposed/g) || []).length >= 4); });
t('renderer bersama: SharedGL.acquire/release, tanpa WebGLRenderer sendiri, tanpa renderer.dispose()', () => {
  assert(/UT\.SharedGL\.acquire\('tambang'/.test(js) && /UT\.SharedGL\.release\('tambang'\)/.test(js));
  assert(!/new THREE\.WebGLRenderer/.test(js)); assert(!/renderer\.dispose\(\)/.test(js));
  assert(/env\.own\(cleanup\)/.test(js));
});
t('pulau membuang geometri, material, dan tekstur saat dispose', () => { assert(/m\.map\.dispose\(\)/.test(isl)); });
t('tambang.html memuat shared-gl dan page-module sebelum tambang.js', () => {
  const a = html.indexOf('core/shared-gl.js'), b = html.indexOf('core/page-module.js'), c = html.indexOf('mining/js/tambang.js');
  assert(a > 0 && b > a && c > b);
});
t('spa-host, frame-guard, dan play.js mengenal tambang', () => {
  assert(/'tambang\.html': 'tambang'/.test(rd('assets/js/core/spa-host.js')));
  assert(/leaderboard\|tambang/.test(rd('assets/js/frame-guard.js')));
  assert(/'tambang\.html': \['lobby\.html', 'shop\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
