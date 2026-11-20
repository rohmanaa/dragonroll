/* mode (SPA tahap 3): modul halaman, id #view tidak bentrok dengan shell, navigasi lewat UT.Spa.go, cleanup langganan/LiveSync/listener/timer. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/mode.js'), html = rd('mode.html'), css = rd('assets/css/mode.css');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("mode")', () => {
  assert(/UT\.PageModule\.define\('mode',function\(env\)\{/.test(js));
  assert(/\}\);\s*$/.test(js));
  assert(!/^\(\(\)=>\{/m.test(js), 'IIFE lama sudah diganti');
});
t('#view milik shell play.html: area geser peta memakai #mapview (HTML, CSS, JS)', () => {
  assert(!/id="view"/.test(html), 'mode.html tidak boleh punya id="view"');
  assert(/id="mapview"/.test(html));
  assert(!/(^|[^-\w])#view\b/.test(css), 'mode.css tidak boleh menata #view');
  assert(/#mapview\{/.test(css));
  assert(!/\$\('#view'\)/.test(js) && /\$\('#mapview'\)/.test(js));
});
t('semua navigasi lewat go() -> UT.Spa.go; location.href hanya fallback di dalam go()', () => {
  assert(/const go=url=>\{if\(inShell\(\)\)UT\.Spa\.go\(url\);else location\.href=url\}/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1, 'hanya fallback di dalam go()');
  assert(/go\('tambang\.html\?from=mode\.html'\)/.test(js) && /go\('shop\.html\?coin=1'\)/.test(js));
});
t('fade 330 ms hanya untuk halaman mandiri; di shell nav() langsung jalan', () => {
  assert(/function nav\(fn\)\{if\(inShell\(\)\)\{fn\(\);return\}/.test(js));
});
t('timer & listener window lewat env (destructuring); document lewat env.on', () => {
  assert(/const \{setTimeout,clearTimeout,addEventListener\}=env;/.test(js));
  assert(!/document\.addEventListener|window\.addEventListener/.test(js));
  assert(/env\.on\(document,'pointerdown'/.test(js));
});
t('langganan PlayerData & Events dilepas via env.own', () => {
  assert(/env\.own\(UT\.Events\.on\('currencyChanged',money\)\)/.test(js));
  assert(/env\.own\(PD\.subscribe\(/.test(js));
});
t('LiveSync dilepas dan dihentikan saat unmount', () => assert(/UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)/.test(js)));
t('toast dijaga env.disposed', () => assert(/function toast\(m\)\{if\(env\.disposed\)return;/.test(js)));
t('simulasi Quick Start memakai setTimeout milik env (batal otomatis saat unmount)', () => {
  const body = js.slice(js.indexOf('function ranked'), js.indexOf("$('#mcancel').onclick"));
  assert(/tm\.push\(setTimeout\(/.test(body));
  assert(!/window\.setTimeout/.test(js));
});
t('mode.html memuat page-module.js sebelum mode.js; blok module Presence tetap untuk halaman mandiri', () => {
  const a = html.indexOf('core/page-module.js'), b = html.indexOf('pages/mode.js');
  assert(a > 0 && a < b);
  assert(/Presence\.start\(\{status:'lobby'\}\)/.test(html));
});
t('spa-host, frame-guard mengenal mode; app.js memulai Presence untuk halaman mode; play.js punya prefetch mode', () => {
  assert(/'mode\.html': 'mode'/.test(rd('assets/js/core/spa-host.js')));
  assert(/friendship\|shop\|mode\)/.test(rd('assets/js/frame-guard.js')));
  assert(/'mail','mode'\]\.indexOf\(UT\.App\.page\)/.test(rd('assets/js/core/app.js')));
  assert(/'mode\.html': \['gameplay\.html', 'room\.html', 'lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
t('play.js: hook leave shell memakai overlay "now" bila ut:nav-heavy disetel (peluncuran gameplay dari view)', () => {
  const p = rd('assets/js/pages/play.js');
  assert(/leave: function \(kind\) \{[\s\S]*?ut:nav-heavy[\s\S]*?removeItem\('ut:nav-heavy'\)[\s\S]*?\(kind === 'now' \|\| heavy\) \? 'now' : 'delay'/.test(p));
});
console.log(n + ' tes lulus');
