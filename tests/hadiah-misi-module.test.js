/* hadiah-misi (SPA tahap 3): modul halaman, tab dari URL rute aktif, navigasi lewat UT.Spa.go, cleanup langganan/LiveSync/listener/timer. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/hadiah-misi.js'), html = rd('hadiah-misi.html');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("hadiah-misi")', () => { assert(/UT\.PageModule\.define\('hadiah-misi'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(\(\)=>\{/m.test(js)); });
t('nav lewat UT.Spa.go di shell; fade + location.href hanya fallback mandiri', () => {
  assert(/const nav=u=>\{if\(UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\);return\}/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1, 'hanya fallback di dalam nav');
});
t('?tab dibaca dari URL rute aktif di shell, bukan location.search milik play.html', () => {
  assert(/c\.name==='hadiah-misi'/.test(js) && /UT\.Spa\.current\(\)/.test(js));
  assert(/new URLSearchParams\(search\(\)\)/.test(js));
  assert(!/new URLSearchParams\(location\.search\)/.test(js));
});
t('history.replaceState tidak mengubah URL play.html di shell maupun URL hub', () => assert(/if\(!\(UT\.Spa&&UT\.Spa\.go\)&&!HUB\(\)\)\{try\{history\.replaceState/.test(js)));
t('di hub sub-tab dibaca dari ?sub= (UT.AccountHub.query), default Misi Harian', () => assert(/HUB\(\)\?\(new URLSearchParams\(search\(\)\)\.get\('sub'\)\|\|'misi'\)/.test(js) && /UT\.AccountHub\.query\(\)/.test(js)));
t('penjaga window.__curSub dihapus; langganan PlayerData & Events dilepas via env.own', () => {
  assert(!/window\.__curSub\s*=/.test(js) && !/if\(!window\.__curSub\)/.test(js));
  assert(/env\.own\(PD\.subscribe\(/.test(js));
  assert(/env\.own\(UT\.Events\.on\('currencyChanged'/.test(js));
});
t('timer & listener lewat env; visibilitychange lewat env.on', () => {
  assert(/const \{setTimeout,clearTimeout,setInterval,addEventListener\}=env;/.test(js));
  assert(!/document\.addEventListener|window\.addEventListener/.test(js));
  assert(/env\.on\(document,'visibilitychange'/.test(js));
});
t('LiveSync (wallet + ach) dilepas dan dihentikan saat unmount', () => assert(/UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.remove\('ach'\);UT\.LiveSync\.stop\(\)/.test(js)));
t('callback async dijaga env.disposed', () => { assert((js.match(/env\.disposed/g) || []).length >= 14, 'env.disposed: ' + (js.match(/env\.disposed/g) || []).length); });
t('hadiah-misi.html memuat page-module.js sebelum hadiah-misi.js', () => assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/hadiah-misi.js')));
t('halaman tidak punya id bentrok dengan shell (view, f, ov)', () => assert(!/id="(view|f|ov)"/.test(html)));
t('spa-host dan frame-guard mengenal hadiah-misi; play.js punya prefetch', () => {
  assert(/'hadiah-misi\.html': 'hadiah-misi'/.test(rd('assets/js/core/spa-host.js')));
  assert(/mode\|hadiah-misi[|)]/.test(rd('assets/js/frame-guard.js')));
  assert(/'hadiah-misi\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
