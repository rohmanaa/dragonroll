const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const main = read('gameplay/js/main.js');
const sync = read('assets/js/multiplayer/game-sync.js');
const ui = read('gameplay/js/duel-ui.js');

/* duelCheck: room online tidak lagi dilewati total; hanya TAMU (bukan host) yang tidak menjalankan duel */
const duelCheck = main.slice(main.indexOf('async function duelCheck('), main.indexOf('async function playTurn('));
assert(!/\|\|ONLINE_ROOM\|\|gameOver/.test(duelCheck), 'duelCheck tidak boleh melewati semua room online');
assert(/\(ONLINE_ROOM&&!ONLINE_HOST\)/.test(duelCheck), 'tamu tidak menjalankan duel (host-authoritative)');
/* dadu duel online diundi server, bukan Math.random klien */
assert(/duelServerRolls\(pair\)/.test(duelCheck) && /serverRoll\(q,'normal',null\)/.test(main));
/* setiap langkah tampilan dicerminkan ke tamu */
assert(/mpDuelUI\(UI,pair,did\)/.test(duelCheck));
['open', 'intro', 'banner', 'log', 'state', 'turn', 'act', 'impact', 'pop', 'shake', 'revealRolls', 'result'].forEach(n => {
  assert(main.includes("'" + n + "'"), 'cue duel ' + n);
});
/* cue 'duel' sampai di tamu dan 'go' diproses di luar antrean */
assert(/const MPFB=\{duel:1,/.test(main));
assert(/c\.k==='duel'&&c\.f==='go'/.test(main));
/* host menerima tap ROLL tamu */
assert(/onDuelRoll:onMpDuelRoll/.test(main));
assert(/event:'duel_roll'/.test(sync) && /sendDuelRoll/.test(sync) && /onDuelRoll/.test(sync));
/* UI */
assert(/lockRoll\(label_\)/.test(ui) && /'lockRoll'/.test(ui));
/* mode offline tidak berubah: satu tombol ROLL */
assert(/if\(!ONLINE_ROOM\) return UI\.waitForRoll\(round\)/.test(main));
console.log('duel-online-wiring ok');
