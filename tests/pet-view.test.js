/* Pet sebagai view SPA (tab Inventory tanpa iframe): modul 'pet' + 'pet-viewer', bar tab bersama, routing inventory?tab=pet -> view pet. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const page = rd('data/inventory/pet/_shared/js/pet-page.js'), viewer = rd('data/inventory/pet/_shared/js/pet-viewer.js');
const html = rd('pet.html'), inv = rd('assets/js/pages/inventory.js'), host = rd('assets/js/core/spa-host.js');
const InvTabs = require('../assets/js/core/inv-tabs.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('pet-page = modul "pet"; semua timer/listener/langganan lewat env (dilepas saat unmount)', () => {
  assert(/UT\.PageModule\.define\('pet', function \(env\)/.test(page) && /\}\);\s*$/.test(page));
  assert(!/(^|[^.\w])setTimeout\(/.test(page) && !/(^|[^.\w])clearTimeout\(/.test(page), 'timer mentah');
  assert(!/window\.addEventListener|document\.addEventListener/.test(page), 'listener global mentah');
  assert(!/(^|[^.\w])requestAnimationFrame\(/.test(page));
  assert(!/^\s*window\.UT\.Events\.on\(/m.test(page), 'Events.on harus dibungkus env.own');
  assert(/env\.own\(\(\) => \{ window\.UT\.LiveSync\.remove\('wallet'\)/.test(page));
});
t('pet-page: di shell navigasi lewat UT.Spa.go; location.href hanya cadangan mandiri; viewer ikut mount/unmount', () => {
  assert(/MANAGED && window\.UT\.Spa && window\.UT\.Spa\.go\) \{ window\.UT\.Spa\.go\(url\)/.test(page));
  assert((page.match(/location\.href/g) || []).length === 1);
  assert(/PageModule\.mount\('pet-viewer'\)/.test(page) && /PageModule\.unmount\('pet-viewer'\)/.test(page));
  assert(/if \(env\.disposed\) return;/.test(page), 'callback async setelah unmount tidak menyentuh DOM');
});
t('pet-viewer = modul "pet-viewer" (state per-mount); unmount = destroy (release SharedGL)', () => {
  assert(/PageModule\.define\('pet-viewer',function\(env\)/.test(viewer));
  assert(/env\.own\(\(\)=>window\.PetViewer\.destroy\(\)\)/.test(viewer));
});
t('pet.html memuat page-module.js + inv-tabs.js sebelum viewer/page, dan CSS bar tab', () => {
  const i = s => html.indexOf(s);
  assert(i('core/page-module.js') > 0 && i('core/inv-tabs.js') > 0);
  assert(i('core/page-module.js') < i('pet-viewer.js') && i('core/inv-tabs.js') < i('pet-page.js'));
  assert(i('assets/css/inv-tabbar.css') > 0);
});
t('spa-host: pet.html = view; inventory-bridge dilewati (tidak mengalihkan shell); canon inventory?tab=pet', () => {
  assert(/'pet\.html': 'pet'/.test(host) && /inventory-bridge/.test(host));
  assert(/function canon\(url\)/.test(host) && /url = canon\(url\)/.test(host));
});
t('inventory.js: tab view (Pet) tidak dimuat di iframe saat di shell', () => {
  assert(/UT\.InvTabs\.VIEW_TABS\[t\.k\] && inShell\(\) && UT\.Spa\.canView/.test(inv));
  assert.deepStrictEqual(InvTabs.VIEW_TABS, { frame: 'frame.html', dadu: 'dadu.html', efek: 'efek.html', pet: 'pet.html' });
});
t('InvTabs.markup: 5 tab, hanya yang aktif berkelas "on"; url tab', () => {
  const m = InvTabs.markup('pet');
  assert.strictEqual((m.match(/class="tab/g) || []).length, 5);
  assert.strictEqual((m.match(/class="tab on"/g) || []).length, 1);
  assert(/class="tab on" type="button" data-k="pet"/.test(m));
  assert.strictEqual(InvTabs.url('dadu'), 'inventory.html?tab=dadu');
  assert.strictEqual((InvTabs.markup('').match(/class="tab on"/g) || []).length, 0);
});
t('CSS: bar tab dan mode view hanya aktif lewat #invtabs / body.inv-view (tidak menimpa halaman lain)', () => {
  const css = rd('assets/css/inv-tabbar.css');
  const sel = css.split('}').map(b => b.split('{')[0].trim()).filter(Boolean);
  assert(sel.every(s => /#invtabs|body\.inv-view/.test(s)), sel.join(' | '));
});
console.log(n + ' tes lulus');
