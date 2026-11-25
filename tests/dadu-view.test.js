/* Dadu sebagai view SPA: modul 'dadu'; DiceKit memakai renderer bersama (sharedGL:'inv-dadu') hanya untuk tab ini — gameplay tetap mandiri. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('data/inventory/dice/_shared/js/dadu.js'), html = rd('dadu.html'), host = rd('assets/js/core/spa-host.js'), dr = rd('assets/js/renderers/dice-kit/dice-renderer.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dadu.js = modul "dadu"; timer/listener/langganan lewat env', () => {
  assert(/UT\.PageModule\.define\('dadu',function\(env\)/.test(js) && /\}\);\s*$/.test(js));
  assert(!/(^|[^.\w])setTimeout\(/.test(js) && !/(^|[^.\w])clearTimeout\(/.test(js), 'timer mentah');
  assert(!/^\s*addEventListener\(|window\.addEventListener|document\.addEventListener/m.test(js), 'listener global mentah');
  assert(!/(^|[^.\w])UT\.Events\.on\(/.test(js.replace(/env\.own\(UT\.Events\.on\(/g, '')), 'Events.on harus dibungkus env.own');
  assert(/env\.own\(PD\.subscribe\(/.test(js));
  assert(/env\.own\(\(\)=>\{UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)\}\)/.test(js));
  assert(/if\(env\.disposed\)return;/.test(js));
});
t('DiceKit: mount dengan sharedGL:"inv-dadu"; unmount = KIT.dispose(); event dicekit-ready lewat env; mount tidak jalan setelah unmount', () => {
  /* sharedGL sengaja DIHAPUS di dadu.js: SharedGL memakai three r128, DiceKit butuh r170 (shader gagal). Mount memakai renderer sendiri. */
  assert(/sound:!!SET\(\)\.sound\}\)/.test(js) && !/sharedGL:'inv-dadu'/.test(js));
  assert(/function disposeKit\(\)\{\n  const k=KIT;KIT=null;if\(!k\)return;\n  try\{const gl=k\.renderer;k\.dispose\(\);/.test(js) && /env\.own\(\(\)=>\{disposeKit\(\);stopSnaps\(\)\}\)/.test(js), 'unmount = KIT.dispose() (+ lepas konteks WebGL) lewat env.own');
  assert(/env\.addEventListener\('dicekit-ready'/.test(js));
  assert(/function mountKit\(\)\{\n  if\(env\.disposed\|\|KIT\|\|!window\.DiceKit\)return;\n  if\(!previewOpen\(\)\)return;/.test(js), 'mount tidak jalan setelah unmount / tanpa pratinjau terbuka');
});
t('DiceRenderer: SharedGL hanya bila diminta (opts.sharedGL); dispose melepas (tanpa dispose renderer bersama); jalur mandiri utuh untuk gameplay', () => {
  assert(/const SGL = opts\.sharedGL && globalThis\.UT && globalThis\.UT\.SharedGL;/.test(dr));
  assert(/SGL\.acquire\(String\(opts\.sharedGL\), \{ shadows: true \}\)/.test(dr));
  assert(/else renderer = new THREE\.WebGLRenderer\(\{ antialias: this\.q\.antialias, alpha: this\.opt\.transparent, powerPreference: 'high-performance' \}\);/.test(dr), 'jalur mandiri gameplay tidak berubah');
  assert(/if \(this\._glOwner\) \{ globalThis\.UT\.SharedGL\.release\(this\._glOwner\); this\._glOwner = null; \}[^\n]*\n    else \{ this\.renderer\.dispose\(\); this\.renderer\.domElement\.remove\(\); \}/.test(dr));
  assert(!/sharedGL/.test(rd('gameplay.html')) && !/sharedGL/.test(rd('assets/js/renderers/dice-kit/index.js')), 'gameplay tidak meminta SharedGL');
});
t('di shell nav lewat UT.Spa.go (location.href hanya cadangan); tanpa bar tab (tampilan sama dengan Pet)', () => {
  assert(/MANAGED&&UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\)/.test(js));
  assert.strictEqual((js.match(/location\.href/g) || []).length, 1);
  assert(!/mountChrome|InvTabs/.test(js), 'tanpa tab Inventory');
});
t('dadu.html: page-module/inv-tabs sebelum dadu.js, shared-gl setelah three.js dan sebelum dice-kit; tanpa CSS bar tab, gaya kartu Pet dipakai', () => {
  const i = s => html.indexOf(s), d = i('dice/_shared/js/dadu.js');
  assert(i('core/page-module.js') > 0 && i('core/page-module.js') < d && i('core/inv-tabs.js') > 0 && i('core/inv-tabs.js') < d);
  assert(i('vendor/three.min.js') > 0 && i('core/shared-gl.js') > i('vendor/three.min.js') && i('core/shared-gl.js') < i('dice-kit/index.js'));
  assert(i('assets/css/inv-tabbar.css') < 0 && !/id="invtabs"/.test(html), 'tanpa bar tab');
  assert(i('pet/_shared/css/pet-page.css') > 0 && /id="fpv"/.test(html) && /id="dgrid"/.test(html) && !/id="act"/.test(html), 'panel pratinjau #fpv + grid kartu #dgrid (desain ulang dadu)');
});
t('routing: dadu.html = view; masuk daftar tab view, frame-guard, prefetch', () => {
  assert(/'dadu\.html': 'dadu'/.test(host) && /dadu: 'dadu\.html'/.test(host));
  assert(/dadu: 'dadu\.html'/.test(rd('assets/js/core/inv-tabs.js')));
  assert(/\|dadu\)\\\.html/.test(rd('assets/js/frame-guard.js')));
  assert(/'dadu\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
