/* inventory (SPA tahap 3): view di shell, ?tab= dari URL rute aktif, tanpa history.replaceState di shell, nav lewat UT.Spa.go. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/inventory.js'), html = rd('inventory.html');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }
t('dibungkus UT.PageModule.define("inventory")', () => { assert(/UT\.PageModule\.define\('inventory'/.test(js)); assert(/\}\);\s*$/.test(js)); });
t('nav lewat UT.Spa.go di shell; fade + location.href hanya fallback mandiri', () => {
  assert(/function nav\(u\)\s*\{ if \(window\.UT && UT\.Spa && UT\.Spa\.go\) \{ UT\.Spa\.go\(u\); return; \}/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1);
});
t('?tab= dari URL rute aktif; replaceState dimatikan di shell', () => {
  assert(/c\.name === 'inventory'/.test(js) && /new URLSearchParams\(search\(\)\)/.test(js) && !/new URLSearchParams\(location\.search\)/.test(js));
  assert(/if \(!inShell\(\)\) history\.replaceState/.test(js));
});
t('listener lewat env', () => { assert(/var addEventListener = env\.addEventListener/.test(js)); assert(!/window\.addEventListener/.test(js)); });
t('inventory.html memuat page-module.js sebelum inventory.js; tanpa id bentrok shell', () => {
  assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/inventory.js'));
  assert(!/id="(view|f|ov)"/.test(html));
});
t('spa-host, frame-guard, play.js mengenal inventory', () => {
  assert(/'inventory\.html': 'inventory'/.test(rd('assets/js/core/spa-host.js')));
  assert(/room\|inventory(\|pet\|frame)*\)/.test(rd("assets/js/frame-guard.js")));
  assert(/'inventory\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
