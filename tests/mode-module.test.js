/* mode (SPA tahap 3): modul halaman, #view tidak bentrok dengan shell, multiplayer via import dinamis, RoomFlow sadar-shell, cleanup. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('assets/js/pages/mode.js'), html = rd('mode.html'), css = rd('assets/css/mode.css'), rf = rd('assets/js/room-flow.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("mode")', () => { assert(/UT\.PageModule\.define\('mode'/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(\(\)=>\{/m.test(js)); });
t('#view (kontainer shell play.html) tidak dipakai lagi: diganti #mapview di HTML, CSS, dan JS', () => {
  assert(/id="mapview"/.test(html) && !/id="view"/.test(html));
  assert(/#mapview\{/.test(css) && !/(^|[\s,}])#view\{/.test(css));
  assert(/\$\('#mapview'\)/.test(js) && !/\$\('#view'\)/.test(js));
  assert(/id="view"/.test(rd('play.html')), 'shell memang memakai #view');
});
t('<script type="module"> inline dihapus dari mode.html (dibuang loader SPA); diganti import dinamis di mode.js', () => {
  assert(!/type="module"/.test(html));
  assert(/import\('\.\.\/multiplayer\/room-service\.js'\)/.test(js) && /import\('\.\.\/multiplayer\/presence\.js'\)/.test(js));
  assert(/Presence\.start\(\{status:'lobby'\}\)/.test(js) && /if\(env\.disposed\)return;\s*window\.dispatchEvent/.test(js));
});
t('navigasi: go() lewat UT.Spa.go, location.href hanya fallback; tombol Gem/Coin memakai go()', () => {
  assert(/const go=u=>\{if\(UT\.Spa&&UT\.Spa\.go\)\{UT\.Spa\.go\(u\);return\}location\.href=u\};/.test(js));
  assert((js.match(/location\.href/g) || []).length === 1);
  assert(/go\('tambang\.html\?from=mode\.html'\)/.test(js) && /go\('shop\.html\?coin=1'\)/.test(js));
});
t('RoomFlow: semua perpindahan lewat go() sadar-shell; location.href hanya fallback', () => {
  assert(/function go\(url\) \{\s*try \{ if \(g\.UT && g\.UT\.Spa && g\.UT\.Spa\.go\)/.test(rf));
  assert((rf.match(/location\.href/g) || []).length === 1, 'hanya fallback di go()');
  ['go(\'room.html?\' + q.toString())', "go('mode.html')", "go('lobby.html')", "go('gameplay.html?' + p.toString())", 'go(to);'].forEach(s => assert(rf.includes(s), s));
});
t('RoomFlow tetap memakai location.href bila tidak ada shell (iframe/mandiri)', () => {
  const loc = { href: '' }, store = {};
  const g = { UT: {}, dispatchEvent: () => true, location: loc, sessionStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } } };
  g.addEventListener = () => {}; g.window = g;
  global.window = g; global.UT = g.UT; global.location = loc; global.sessionStorage = g.sessionStorage; global.CustomEvent = function (n, o) { this.detail = o && o.detail; };
  g.PlayerData = { equippedId: () => null, settings: () => ({}) }; g.ItemCatalog = { items: [], byId: () => null };
  new Function('window', 'UT', 'location', 'sessionStorage', 'CustomEvent', 'PlayerData', 'ItemCatalog', rf.replace(/\}\)\(window\);?\s*$/, '})(window);'))(g, g.UT, loc, g.sessionStorage, global.CustomEvent, g.PlayerData, g.ItemCatalog);
  g.UT.RoomFlow.navigate('mode'); assert.strictEqual(loc.href, 'mode.html');
  const calls = []; g.UT.Spa = { go: u => calls.push(u) }; loc.href = '';
  g.UT.RoomFlow.navigate('back'); g.UT.RoomFlow.navigate('room', { mode: 'cpu', format: 'solo', count: 2 });
  assert.deepStrictEqual(calls.slice(0, 1), ['lobby.html']); assert(/^room\.html\?/.test(calls[1])); assert.strictEqual(loc.href, '', 'dengan shell tidak memakai location.href');
});
t('langganan dilepas via env.own (Events, PlayerData); document listener lewat env.on; timer/listener window via env', () => {
  assert(/env\.own\(UT\.Events\.on\('currencyChanged',money\)\)/.test(js) && /env\.own\(PD\.subscribe\(/.test(js));
  assert(/env\.on\(document,'pointerdown'/.test(js) && !/document\.addEventListener/.test(js));
  assert(/const \{setTimeout,clearTimeout,addEventListener\}=env;/.test(js));
});
t('LiveSync dilepas dan dihentikan saat unmount', () => assert(/UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)/.test(js)));
t('toast/money dijaga env.disposed', () => assert((js.match(/env\.disposed/g) || []).length >= 3));
t('mode.html memuat page-module.js sebelum mode.js', () => assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/mode.js')));
t('spa-host dan frame-guard mengenal mode; play.js punya prefetch mode', () => {
  assert(/'mode\.html': 'mode'/.test(rd('assets/js/core/spa-host.js')));
  assert(/tambang\|friendship\|shop\|mode/.test(rd('assets/js/frame-guard.js')));
  assert(/'mode\.html': \['gameplay\.html'/.test(rd('assets/js/pages/play.js')));
});
console.log(n + ' tes lulus');
