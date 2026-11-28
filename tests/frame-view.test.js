/* Frame sebagai view SPA (tab Inventory tanpa iframe) + helper bar tab bersama UT.InvTabs.mountChrome. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('data/inventory/frame/_shared/js/frame.js'), html = rd('frame.html'), host = rd('assets/js/core/spa-host.js');
const InvTabs = require('../assets/js/core/inv-tabs.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('frame.js = modul "frame"; timer/listener/langganan lewat env', () => {
  assert(/UT\.PageModule\.define\('frame',function\(env\)/.test(js) && /\}\);\s*$/.test(js));
  assert(!/(^|[^.\w])setTimeout\(/.test(js) && !/(^|[^.\w])clearTimeout\(/.test(js), 'timer mentah');
  assert(!/^\s*addEventListener\(|[^.\w]window\.addEventListener|document\.addEventListener/m.test(js), 'listener global mentah');
  assert(!/(^|[^.\w])UT\.Events\.on\(/.test(js.replace(/env\.own\(UT\.Events\.on\(/g, '')), 'Events.on harus dibungkus env.own');
  assert(/env\.own\(PD\.subscribe\(/.test(js));
  assert(/env\.own\(\(\)=>\{UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)\}\)/.test(js));
  assert(/if\(env\.disposed\)return;/.test(js));
});
t('frame.js: di shell nav lewat UT.Spa.go; location.href hanya cadangan mandiri; chrome tab dipasang', () => {
  assert(/MANAGED&&UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\)/.test(js));
  assert.strictEqual((js.match(/location\.href/g) || []).length, 1);
  assert(/UT\.InvTabs\.mountChrome\(env,'frame',nav,snd\)/.test(js));
});
t('frame.html: page-module.js + inv-tabs.js sebelum frame.js; CSS bar tab', () => {
  const i = s => html.indexOf(s);
  assert(i('core/page-module.js') > 0 && i('core/page-module.js') < i('frame/_shared/js/frame.js'));
  assert(i('core/inv-tabs.js') > 0 && i('core/inv-tabs.js') < i('frame/_shared/js/frame.js'));
  assert(i('src/styles/inv-tabbar.css') > 0);
});
t('spa-host: frame.html = view; canon memetakan semua tab view; frame-guard & prefetch mengenal frame', () => {
  assert(/'frame\.html': 'frame'/.test(host) && /INV_VIEW_TABS = \{ frame: 'frame\.html', dadu: 'dadu\.html', efek: 'efek\.html', pet: 'pet\.html' \}/.test(host));
  assert(/\|pet\|frame\|efek\|dadu\)\\\.html/.test(rd('assets/js/frame-guard.js')));
  assert(/'frame\.html': \['lobby\.html'\]/.test(rd('assets/js/pages/play.js')));
  assert.deepStrictEqual(InvTabs.VIEW_TABS, { frame: 'frame.html', dadu: 'dadu.html', efek: 'efek.html', pet: 'pet.html' });
});
t('mountChrome (grup Perlengkapan): judul Perlengkapan, class inv-view, bar 3 tab (Karakter/Dadu/Efek; Frame = modal di Profil), klik tab lain = buka halamannya; tab aktif diabaikan; tab terakhir Inventory tidak diingat; unmount melepas class', () => {
  const classes = new Set(), appended = [], title = { textContent: 'Frame' }, store = {}, snds = [], navs = [];
  const stage = { appendChild: el => appended.push(el) };
  let barClick = null;
  global.document = {
    body: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } },
    querySelector: s => (s === '#stage' ? stage : s === '#title' ? title : null),
    createElement: () => ({ setAttribute() {}, addEventListener: (type, fn) => { if (type === 'click') barClick = fn; } })
  };
  global.sessionStorage = { setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
  const disposers = [], env = { own: fn => disposers.push(fn) };
  const bar = InvTabs.mountChrome(env, 'dadu', u => navs.push(u), s => snds.push(s));
  assert.strictEqual(appended[0], bar); assert(bar.id === 'invtabs');
  assert.strictEqual(title.textContent, 'Perlengkapan'); assert(classes.has('inv-view'));
  assert.strictEqual((bar.innerHTML.match(/class="ut-tab tab/g) || []).length, 3);
  assert(/class="ut-tab tab on" type="button" data-k="dadu"/.test(bar.innerHTML));
  assert.strictEqual(store['ut-inv-tab'], undefined);
  barClick({ target: { closest: () => ({ dataset: { k: 'dadu' } }) } });
  assert.deepStrictEqual(navs, []);
  barClick({ target: { closest: () => ({ dataset: { k: 'efek' } }) } });
  assert.deepStrictEqual(navs, ['efek.html']); assert.deepStrictEqual(snds, ['button']); assert.strictEqual(store['ut-inv-tab'], undefined);
  disposers.forEach(f => f()); assert(!classes.has('inv-view'));
  delete global.document; delete global.sessionStorage;
});
console.log(n + ' tes lulus');
