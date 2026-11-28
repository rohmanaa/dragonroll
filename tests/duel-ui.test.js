/* Duel UI baru (Dadu Duel Blok): tes struktur + kontrak API. Animasi 3D diuji manual/di browser. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ui = read('src/gameplay/js/duel-ui.js'), css = read('src/gameplay/css/duel.css'), main = read('src/gameplay/js/main.js'), html = read('gameplay.html');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('API publik: urutan open -> intro -> waitForRoll -> revealRolls -> turn -> result -> close', () => {
  const sandbox = { window: {}, document: {}, console: { error() {}, log() {} }, Promise, Math, setTimeout, clearTimeout };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(ui, sandbox);
  const U = sandbox.window.UT.GameplayDuelUI;
  ['open', 'chooseOpponent', 'intro', 'waitForRoll', 'lockRoll', 'revealRolls', 'state', 'turn', 'banner', 'log', 'pop', 'shake', 'act', 'impact', 'result', 'close']
    .forEach(k => assert.strictEqual(typeof U[k], 'function', k));
});
t('tanpa Three.js/WebGL: open() = false (duel dilewati), pemanggil lain aman', async () => {
  const sandbox = { window: {}, document: { getElementById() { return null; } }, console: { error() {}, log() {} }, Promise, Math, setTimeout, clearTimeout };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(ui, sandbox);
  const U = sandbox.window.UT.GameplayDuelUI;
  assert.strictEqual(U.open({ fighters: [{}, {}] }), false);
  assert.strictEqual(U.close(), undefined);
  assert.strictEqual(typeof U.turn({}).then, 'function');
});
t('rig BARU (Shuri/Raja Blok) dan rig LAMA (Ksatria Mahkota, karakter asli, model bidak) sama-sama tersedia', () => {
  ['buildArcher', 'buildKnight'].forEach(f => assert(ui.includes('function ' + f), f));
  ['ksatria', 'blocky', 'model'].forEach(k => assert(ui.includes("'" + k + "'"), 'rig lama ' + k));
  assert(/UT\.PvpKnight\.createKnight|PK\.createKnight/.test(ui), 'memakai pvp-knight-rig');
  assert(/UT\.BlockyCharacter\.create/.test(ui), 'memakai BlockyCharacter');
  assert(/function rigFor\(/.test(ui) && /ksUpdate/.test(ui) && /bcUpdate/.test(ui) && /mdUpdate/.test(ui));
});
t('3 giliran saja: tidak ada adu ulang / sudden death di UI', () => {
  assert(!/ADU ULANG|G\.sd\s*=\s*true/.test(ui));
  assert(/GILIRAN '\+Math\.min\(3,/.test(ui));
});
t('CSS: semua selektor dibatasi ke #du2 (tidak bocor ke game)', () => {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const heads = []; let depth = 0, cur = '';
  for (const ch of stripped) {
    if (ch === '{') { if (depth === 0) heads.push(cur.trim()); depth++; cur = ''; }
    else if (ch === '}') { depth--; cur = ''; }
    else if (depth === 0) cur += ch;
  }
  heads.filter(h => !h.startsWith('@')).forEach(h => h.split(',').forEach(s => {
    s = s.trim(); assert(/^(#du2|body\.duel-active)/.test(s), 'selektor bocor: ' + s);
  }));
  assert(/@keyframes du2-/.test(css) && !/@keyframes (up|tumble|toss|rot)\b/.test(css));
});
t('HTML duel memakai id berawalan du2- (tidak bentrok dengan #roll/#top milik game)', () => {
  const tpl = ui.slice(ui.indexOf('var TEMPLATE'), ui.indexOf('var inner'));
  const ids = [...tpl.matchAll(/id=\\"([\w-]+)\\"/g)].map(m => m[1]);
  assert(ids.length > 20); ids.forEach(i => assert(i.startsWith('du2-'), i));
});
t('hanya UI duel yang membuat WebGLRenderer sendiri (daftar pengecualian tes SharedGL)', () => {
  assert(/new THREE\.WebGLRenderer\(/.test(ui));
});
t('gameplay.html memuat duel-core, rig ksatria, lalu duel-ui', () => {
  const a = html.indexOf('duel-core.js'), b = html.indexOf('pvp-knight-rig.js'), c = html.indexOf('duel-ui.js');
  assert(a > 0 && b > 0 && c > b);
  assert(/duel\.css/.test(html));
});
t('main.js memakai alur baru: DU.turn(r.turn) dan hasil seri/menang-kalah', () => {
  const dc = main.slice(main.indexOf('async function duelCheck('), main.indexOf('async function playTurn('));
  assert(/DU\.revealRolls\(rolls\)/.test(dc) && /DU\.turn\(r\.turn\)/.test(dc));
  assert(/out\.draw/.test(dc) && /out\.back/.test(dc));
  assert(!/DU\.actions\(|D\.ACTIONS\[/.test(dc), 'sisa API hati/aksi lama');
  assert(/rig:'archer'/.test(main) && /rig:\(f\.idx%2\?'knight':'archer'\)/.test(main));
});
console.log('\n' + n + ' tes duel-ui lulus');

