/* chest (SPA tahap 3): modul halaman, navigasi lewat UT.Spa.go, cleanup langganan/LiveSync/listener/timer. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/chest.js'), html = rd('chest.html');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("chest")', () => { assert(/UT\.PageModule\.define\('chest'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(\(\)=>\{/m.test(js)); });
t('nav lewat UT.Spa.go di shell; fade + location.href hanya fallback mandiri', () => {
  assert(/const nav=u=>\{if\(UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\);return\}/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1);
});
t('listener klik dokumen & visibilitychange lewat env.on; tanpa document/window.addEventListener', () => {
  assert(/env\.on\(document,'click'/.test(js) && /env\.on\(document,'visibilitychange'/.test(js));
  assert(!/document\.addEventListener|window\.addEventListener/.test(js));
});
t('timer & listener window lewat env (destructuring)', () => assert(/const \{setTimeout,clearTimeout,setInterval,addEventListener\}=env;/.test(js)));
t('penjaga window.__curSub dihapus; langganan dilepas via env.own', () => {
  assert(!/window\.__curSub\s*=/.test(js) && !/if\(!window\.__curSub\)/.test(js));
  assert(/env\.own\(PD\.subscribe\(/.test(js) && /env\.own\(UT\.Events\.on\('currencyChanged'/.test(js));
});
t('LiveSync wallet dilepas dan dihentikan saat unmount', () => assert(/UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)/.test(js)));
t('mulai: di shell (dokumen sudah load) tidak menunggu event load', () => assert(/document\.readyState==='complete'/.test(js)));
t('callback async dijaga env.disposed', () => assert((js.match(/env\.disposed/g) || []).length >= 7));
t('chest.html memuat page-module.js sebelum chest.js; tanpa id bentrok shell', () => {
  assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/chest.js'));
  assert(!/id="(view|f|ov)"/.test(html));
});
t('spa-host dan frame-guard mengenal chest; play.js punya prefetch', () => {
  assert(/'chest\.html': 'chest'/.test(rd('assets/js/core/spa-host.js')));
  assert(/hadiah-misi\|chest/.test(rd('assets/js/frame-guard.js')));
  assert(/'chest\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
