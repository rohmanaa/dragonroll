/* mail (SPA tahap 3): modul halaman, ?from dari URL rute aktif, navigasi lewat UT.Spa.go, cleanup langganan/listener/polling. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/mail.js'), html = rd('mail.html');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("mail")', () => { assert(/UT\.PageModule\.define\('mail'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(\(\)=>\{/m.test(js)); });
t('nav lewat UT.Spa.go di shell; fade + location.href hanya fallback mandiri', () => {
  assert(/const nav=u=>\{if\(UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\);return\}/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1);
});
t('?from dibaca dari URL rute aktif di shell, bukan location.search milik play.html', () => {
  assert(/c\.name==='mail'/.test(js) && /UT\.Spa\.current\(\)/.test(js));
  assert(/new URLSearchParams\(search\(\)\)/.test(js) && !/new URLSearchParams\(location\.search\)/.test(js));
});
t('timer & listener lewat env; visibilitychange lewat env.on', () => {
  assert(/const \{setTimeout,clearTimeout,setInterval,addEventListener\}=env;/.test(js));
  assert(!/document\.addEventListener|window\.addEventListener/.test(js));
  assert(/env\.on\(document,'visibilitychange'/.test(js));
});
t('penjaga window.__curSub dihapus; langganan dilepas via env.own', () => {
  assert(!/window\.__curSub\s*=/.test(js) && !/if\(!window\.__curSub\)/.test(js));
  assert(/env\.own\(PD\.subscribe\(/.test(js) && /env\.own\(UT\.Events\.on\('currencyChanged'/.test(js));
});
t('callback async (list, claim, remove, readAll, claimAll, refresh) dijaga env.disposed', () => assert((js.match(/env\.disposed/g) || []).length >= 11));
t('mail.html memuat page-module.js sebelum mail.js; tanpa id bentrok shell', () => {
  assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/mail.js'));
  assert(!/id="(view|f|ov)"/.test(html));
});
t('spa-host dan frame-guard mengenal mail; play.js punya prefetch', () => {
  assert(/'mail\.html': 'mail'/.test(rd('assets/js/core/spa-host.js')));
  assert(/hadiah-misi\|mail[|)]/.test(rd('assets/js/frame-guard.js')));
  assert(/'mail\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
