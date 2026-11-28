/* shop (SPA tahap 3): modul halaman, parameter dari URL rute aktif, navigasi lewat UT.Spa.go, cleanup langganan/LiveSync/listener/timer. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('src/views/shop-page.js'), html = rd('shop.html');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("shop")', () => { assert(/UT\.PageModule\.define\('shop'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(function \(\) \{/m.test(js)); });
t('nav selalu lewat UT.Spa.go; location.href hanya fallback mandiri', () => {
  assert(/const nav = url => \{ if \(UT\.Spa && UT\.Spa\.go\) \{ UT\.Spa\.go\(url\); return; \} location\.href = url; \};/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1, 'hanya fallback di dalam nav');
  assert(/nav\(go\.dataset\.go\)/.test(js) && /nav\('lobby\.html'\)/.test(js));
});
t('parameter halaman (?coin, ?tab, ?emerald) dibaca dari URL rute aktif di shell, bukan location.search milik play.html', () => {
  assert(/c\.name === 'shop'/.test(js) && /UT\.Spa\.current\(\)/.test(js));
  assert(/new URLSearchParams\(search\(\)\)/.test(js));
  assert(!/new URLSearchParams\(location\.search\)/.test(js));
});
t('penjaga window.__curSub dihapus; langganan PlayerData & Events dilepas via env.own', () => {
  assert(!/window\.__curSub\s*=/.test(js) && !/if \(!window\.__curSub\)/.test(js));
  assert(/env\.own\(PD\.subscribe\(/.test(js));
  assert(/env\.own\(UT\.Events\.on\('currencyChanged'/.test(js));
});
t('timer & listener window lewat env (destructuring)', () => {
  assert(/const \{ setTimeout, clearTimeout, requestAnimationFrame, addEventListener \} = env;/.test(js));
  assert(!/document\.addEventListener|window\.addEventListener/.test(js));
});
t('LiveSync dilepas dan dihentikan saat unmount', () => assert(/UT\.LiveSync\.remove\('wallet'\); UT\.LiveSync\.stop\(\)/.test(js)));
t('callback async dijaga env.disposed (history, exchange, chestBuy, wallet.refresh, render, toast, modal)', () => { assert((js.match(/env\.disposed/g) || []).length >= 9); });
t('shop.html memuat page-module.js sebelum shop-page.js', () => assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/shop-page.js')));
t('spa-host dan frame-guard mengenal shop; play.js punya prefetch shop', () => {
  assert(/'shop\.html': 'shop'/.test(rd('src/core/spa-host.js')));
  assert(/tambang\|friendship\|shop/.test(rd('src/boot/frame-guard.js')));
  assert(/'shop\.html': \['lobby\.html'\]/.test(rd('src/views/play.js')));
});
console.log(n + ' tes lulus');

