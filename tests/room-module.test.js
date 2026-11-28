/* room (SPA tahap 3): modul halaman, parameter dari URL rute aktif, tautan undangan ke room.html, modul multiplayer dimuat sendiri,
   cleanup langganan realtime/Presence/LiveSync/kelas html, dan dukungan <script type="module"> di spa-host. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = rd('src/views/room.js'), html = rd('room.html'), host = rd('src/core/spa-host.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('dibungkus UT.PageModule.define("room")', () => { assert(/UT\.PageModule\.define\('room',function\(env\)\{/.test(js)); assert(/\}\);\s*$/.test(js)); assert(!/^\(\(\)=>\{/m.test(js)); });
t('parameter room dibaca dari URL rute aktif di shell, bukan location.search milik play.html', () => {
  assert(/c\.name==='room'/.test(js) && /UT\.Spa\.current\(\)/.test(js));
  assert(/new URLSearchParams\(search\(\)\)/.test(js) && !/new URLSearchParams\(location\.search\)/.test(js));
});
t('mode tidak valid -> mode.html lewat UT.Spa.go (replace), fallback location.replace', () => {
  assert(/UT\.Spa\.go\('mode\.html',\{replace:true\}\)/.test(js) && /location\.replace\('mode\.html'\)/.test(js));
});
t('tautan undangan memakai room.html, bukan location.pathname (di shell = play.html)', () => {
  assert(/const roomUrl=\(\)=>location\.origin \+ \(document\.baseURI \|\| \(location\.origin \+ '\/'\)\)/.test(js));
  assert(/replace\([^)]*\)/.test(js));
  assert(/'room\.html'/.test(js));
  assert(!/\$\{location\.origin\}\$\{location\.pathname\}/.test(js));
  assert((js.match(/\$\{roomUrl\(\)\}\?mode=online/g) || []).length === 2);
});
t('timer & listener lewat env; tidak ada window/document.addEventListener langsung', () => {
  assert(/const \{setTimeout,clearTimeout,addEventListener\}=env;/.test(js));
  assert(!/document\.addEventListener|window\.addEventListener/.test(js));
  assert(/env\.on\(\$\('#pageModalFrame'\),'load'/.test(js));
});
t('langganan realtime, Presence, Events, CharacterFace, LiveSync dilepas lewat env.own', () => {
  assert(/env\.own\(unsub\)/.test(js) && /const unsub=\(\)=>\{const u=S\.mpUnsub;S\.mpUnsub=null/.test(js));
  assert(/env\.own\(PR\.onChange\(/.test(js));
  assert(/env\.own\(UT\.Events\.on\('inventoryChanged'/.test(js));
  assert(/env\.own\(UT\.CharacterFace\.watch\(/.test(js));
  assert(/UT\.LiveSync\.remove\('wallet'\);UT\.LiveSync\.stop\(\)/.test(js));
});
t('kelas html dro & mp-online dilepas saat unmount', () => {
  assert(/env\.own\(\(\)=>root\.classList\.remove\('dro'\)\)/.test(js));
  assert(/env\.own\(\(\)=>document\.documentElement\.classList\.remove\('mp-online'\)\)/.test(js));
});
t('setupOnline berhenti bila halaman sudah ditinggalkan (setelah ensurePlayer dan createRoom/joinRoom)', () => {
  assert(/ensurePlayer\(\);if\(env\.disposed\)return;/.test(js));
  assert(/joinRoom\(\{code:JOIN,name:S\.mpIdentity\.name\}\)\}\n  if\(env\.disposed\)return;/.test(js));
});
t('modul multiplayer dimuat lewat import() di shell, dijaga flag started (tanpa setup ganda)', () => {
  assert(/import\('\.\.\/multiplayer\/room-service\.js'\)\.then\(\(\)=>import\('\.\.\/multiplayer\/presence\.js'\)\)\.then\(start,start\)/.test(js));
  assert(/let started=false;const start=\(\)=>\{if\(started\|\|env\.disposed\)return;started=true;setupOnline\(\)\}/.test(js));
});
t('loadFace tidak memuat ulang skrip yang sudah ada di dokumen (three.min.js bersama)', () => {
  assert(/Array\.prototype\.some\.call\(document\.scripts,x=>x\.src===abs\)/.test(js));
  assert(/env\.disposed\|\|L\('assets\/js\/renderers\/blocky-character\.js'\)/.test(js));
});
t('toast dijaga env.disposed', () => assert(/function toast\(m\)\{if\(env\.disposed\)return;/.test(js)));
t('room.html memuat page-module.js sebelum room.js; tanpa id bentrok shell', () => {
  assert(html.indexOf('core/page-module.js') > 0 && html.indexOf('core/page-module.js') < html.indexOf('pages/room.js'));
  assert(!/id="(view|f|ov)"/.test(html));
});
t('room.html mandiri tetap memuat modul multiplayer (blok module inline) dan room-dice-art', () => {
  assert(/import '\.\/assets\/js\/multiplayer\/room-service\.js'/.test(html) && /ut:multiplayer-ready/.test(html));
  assert(/<script type="module" src="data\/inventory\/dice\/_shared\/js\/room-dice-art\.js">/.test(html));
});
t('spa-host: room terdaftar; <script type=module> dimuat lewat import(); skrip yang sudah ada tidak diunduh ulang', () => {
  assert(/'room\.html': 'room'/.test(host));
  assert(/mods\[src\] = 1/.test(host) && /import\(new G\.URL\(src, base\(\)\)\.href\)/.test(host) && /function base\(\) \{ return \(G\.document && G\.document\.baseURI\) \|\| G\.location\.href; \}/.test(host));
  assert(/function inDoc\(k\)/.test(host) && /scripts\[k\] = Promise\.resolve\(\)/.test(host));
});
t('frame-guard mengenal room; play.js punya prefetch', () => {
  assert(/mail\|settings\|room[|)]/.test(rd('src/boot/frame-guard.js')));
  assert(/'room\.html': \['gameplay\.html', 'mode\.html'\]/.test(rd('src/views/play.js')));
});
console.log(n + ' tes lulus');

