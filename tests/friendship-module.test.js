/* friendship (SPA tahap 3): modul halaman, navigasi lewat UT.Spa.go, cleanup langganan/Presence/LiveSync/listener, #home tidak lagi melempar error. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/friendship-page.js'), html = rd('friendship.html');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("friendship")', () => { assert(/UT\.PageModule\.define\('friendship'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(function \(\) \{/m.test(js)); });
t('nav selalu lewat UT.Spa.go; location.href hanya fallback mandiri', () => {
  assert(/const nav = url => \{ if \(UT\.Spa && UT\.Spa\.go\) \{ UT\.Spa\.go\(url\); return; \} location\.href = url; \};/.test(js));
  assert(!/canView/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1, 'hanya fallback di dalam nav');
  assert(/nav\('lobby\.html'\)/.test(js) && /nav\('tambang\.html\?from=friendship\.html'\)/.test(js) && /nav\('shop\.html\?coin=1'\)/.test(js) && /nav\(`room\.html\?mode=online/.test(js));
});
t('#home tidak ada di HTML dan tidak boleh dipakai tanpa penjaga (dulu TypeError menghentikan seluruh skrip)', () => {
  assert(!/id="home"/.test(html));
  assert(!/\$\('#home'\)\.addEventListener/.test(js));
  assert(/const homeBtn = \$\('#home'\); if \(homeBtn\)/.test(js));
});
t('langganan dilepas via env.own (PlayerData, Events, Presence)', () => {
  assert(/env\.own\(PD\.subscribe\(renderCurrency\)\)/.test(js));
  assert(/env\.own\(UT\.Events\.on\('currencyChanged'/.test(js));
  assert(/env\.own\(PR\(\)\.onChange\(render\)\)/.test(js));
});
t('listener dokumen lewat env.on; timer lewat env', () => {
  assert(/env\.on\(document, 'keydown'/.test(js) && /env\.on\(document, 'visibilitychange'/.test(js));
  assert(!/document\.addEventListener/.test(js));
  assert(/const \{ setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, addEventListener \} = env;/.test(js));
});
t('LiveSync dilepas dan dihentikan saat unmount', () => assert(/UT\.LiveSync\.remove\('wallet'\); UT\.LiveSync\.stop\(\)/.test(js)));
t('render/toast/renderCurrency/loadData dijaga env.disposed (DOM view sudah dibuang)', () => { assert((js.match(/env\.disposed/g) || []).length >= 6); });
t('friendship.html memuat page-module.js sebelum friendship-page.js', () => assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/friendship-page.js')));
t('spa-host, frame-guard, dan play.js mengenal friendship', () => {
  assert(/'friendship\.html': 'friendship'/.test(rd('assets/js/core/spa-host.js')));
  assert(/tambang\|friendship/.test(rd('assets/js/frame-guard.js')));
  assert(/'friendship\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
