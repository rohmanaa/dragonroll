/* leaderboard (SPA tahap 3): modul halaman, navigasi lewat UT.Spa.go, cleanup LiveSync/PodiumFX/langganan, mount podium tidak lagi inline. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/leaderboard.js'), html = rd('leaderboard.html'), fx = rd('assets/js/podium-fx.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("leaderboard")', () => assert(/UT\.PageModule\.define\('leaderboard'/.test(js)));
t('nav selalu lewat UT.Spa.go', () => { const nv = js.slice(js.indexOf('const nav='), js.indexOf('const esc=')); assert(/UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\);return\}/.test(nv)); assert(!/canView/.test(nv)); });
t('langganan dilepas via env.own; penjaga window.__curSub dihapus', () => {
  assert(!/__curSub/.test(js));
  assert(/env\.own\(PD\.subscribe/.test(js) && /env\.own\(UT\.Events\.on\('currencyChanged'/.test(js));
});
t('listener dokumen lewat env.on', () => { assert(/env\.on\(document,'visibilitychange'/.test(js)); assert(!/document\.addEventListener/.test(js)); });
t('LiveSync dilepas dan dihentikan saat unmount', () => assert(/LS\.remove\('board'\);LS\.remove\('wallet'\);LS\.stop\(\)/.test(js)));
t('callback async dijaga env.disposed', () => { assert((js.match(/env\.disposed/g) || []).length >= 6); });
t('PodiumFX di-mount dari modul dan punya unmount', () => {
  assert(/UT\.PodiumFX\.mount\(\)/.test(js) && /UT\.PodiumFX\.unmount\(\)/.test(js));
  assert(/unmount: function/.test(fx) && /removeEventListener\('visibilitychange', onVis\)/.test(fx));
  assert(!/<script>UT\.PodiumFX/.test(html));
});
t('leaderboard.html memuat page-module.js sebelum leaderboard.js', () => assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/leaderboard.js')));
t('frame-guard dan play.js mengenal leaderboard', () => { assert(/profile\|leaderboard/.test(rd('assets/js/frame-guard.js'))); assert(/'leaderboard\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js'))); });
t('tombol Coin/Gem berada di atas #board (z-index) - dulu tertutup', () => {
  assert(/\.cur\{z-index:\s*[1-9]/.test(rd('src/styles/leaderboard.css')));
});
console.log(n + ' tes lulus');
