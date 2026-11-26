/* Efek (Aura) sebagai view SPA: modul 'efek', renderer pratinjau 3D milik UT.SharedGL (acquire saat mount, release saat unmount). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('data/inventory/aura/_shared/js/efek.js'), html = rd('efek.html'), host = rd('assets/js/core/spa-host.js');
let n = 0;
t0();
function t0() {
  assert(html.includes('assets/components/button/button.css') && html.indexOf('assets/components/button/button.css') < html.indexOf('pet-page.css'), 'button.css sebelum CSS Pet');
  assert(/id="back" class="ut-gl ut-c-r"/.test(html) && /id="pvClose" class="ut-gl ut-c-r"/.test(html) && /class="btn ut-gl ut-c-r" id="m-no"/.test(html) && /class="btn ut-gl ut-c-g" id="m-ok"/.test(html) && !/tombol-(merah|hijau)-polos/.test(html));
  ['pc-pr no ut-gl ut-c-d','pc-pr used ut-gl ut-c-r','pc-pr own ut-gl ut-c-g','pc-pr ut-gl ut-c-y','pc-ic pc-eye ut-gl ut-c-b'].forEach(c => assert(js.includes(c), c));
}
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('efek.js = modul "efek"; timer/listener/langganan/rAF lewat env', () => {
  assert(/UT\.PageModule\.define\('efek',function\(env\)/.test(js) && /\}\);\s*$/.test(js));
  assert(!/(^|[^.\w])setTimeout\(/.test(js) && !/(^|[^.\w])clearTimeout\(/.test(js), 'timer mentah');
  assert(!/(^|[^.\w])requestAnimationFrame\(/.test(js), 'rAF mentah');
  assert(!/^\s*addEventListener\(|window\.addEventListener|document\.addEventListener/m.test(js), 'listener global mentah');
  assert(!/(^|[^.\w])UT\.Events\.on\(/.test(js.replace(/env\.own\(UT\.Events\.on\(/g, '')), 'Events.on harus dibungkus env.own');
  assert(/env\.own\(PD\.subscribe\(/.test(js));
  assert(/env\.own\(\(\)=>\{UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)\}\)/.test(js));
  assert(/if\(env\.disposed\)return;/.test(js));
});
t('renderer lewat SharedGL: tanpa new WebGLRenderer; acquire saat rigInit; release + dispose + lepas listener saat unmount', () => {
  assert(!/new\s+THREE\.WebGLRenderer/.test(js));
  assert(/UT\.SharedGL\.acquire\(GL_OWNER,\{shadows:false\}\)/.test(js) && /GL_OWNER='inv-efek'/.test(js));
  const cleanup = js.slice(js.indexOf('env.own(()=>{\n      ls.forEach'), js.indexOf('R=null;\n    });'));
  assert(/ls\.forEach\(f=>f\(\)\)/.test(cleanup), 'listener kanvas bersama dilepas');
  assert(/ro\.disconnect\(\)/.test(cleanup) && /sys\.dispose\(\)/.test(cleanup) && /scene\.traverse/.test(cleanup) && /SharedGL\.release\(GL_OWNER\)/.test(cleanup));
  assert(/SharedGL\.release\(GL_OWNER\)\}catch\(_\)\{\}console\.warn\('WebGL tidak tersedia'/.test(js), 'gagal init = renderer dilepas');
  assert(/function loop\(now\)\{\n  if\(env\.disposed\)return;\n  env\.requestAnimationFrame\(loop\)/.test(js), 'loop berhenti setelah unmount');
});
t('di shell nav lewat UT.Spa.go (location.href hanya cadangan); tanpa bar tab (tampilan sama dengan Pet)', () => {
  assert(/MANAGED&&UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\)/.test(js));
  assert.strictEqual((js.match(/location\.href/g) || []).length, 1);
  assert(!/mountChrome|InvTabs/.test(js), 'tanpa tab Inventory');
});
t('efek.html: page-module/inv-tabs sebelum efek.js, shared-gl setelah three.js; tanpa CSS bar tab, gaya kartu Pet dipakai', () => {
  const i = s => html.indexOf(s), e = i('aura/_shared/js/efek.js');
  assert(i('core/page-module.js') > 0 && i('core/page-module.js') < e && i('core/inv-tabs.js') > 0 && i('core/inv-tabs.js') < e);
  assert(i('vendor/three.min.js') > 0 && i('core/shared-gl.js') > i('vendor/three.min.js') && i('core/shared-gl.js') < e);
  assert(i('assets/css/inv-tabbar.css') < 0 && !/id="invtabs"/.test(html), 'tanpa bar tab');
  assert(i('pet/_shared/css/pet-page.css') > 0 && /id="pv"/.test(html) && /id="grid"/.test(html) && !/id="act"/.test(html), 'kartu + modal pratinjau seperti Pet');
});
t('routing: efek.html = view; masuk daftar tab view, frame-guard, prefetch', () => {
  assert(/'efek\.html': 'efek'/.test(host) && /efek: 'efek\.html'/.test(host));
  assert(/efek: 'efek\.html'/.test(rd('assets/js/core/inv-tabs.js')));
  assert(/\|efek\|dadu\)\\\.html/.test(rd('assets/js/frame-guard.js')));
  assert(/'efek\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
