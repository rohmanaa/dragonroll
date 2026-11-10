/* Tes statis room.html: avatar pemain online lain = wajah karakter dari server (room_appearance_get), bukan huruf awal. */
const assert = require('assert'), fs = require('fs'), path = require('path');
const g = fs.readFileSync(path.join(__dirname, '..', 'room.html'), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
t('appearance-service.js dimuat sebelum app.js dan skrip room', () => {
  const a = g.indexOf('assets/js/appearance-service.js'), b = g.indexOf('assets/js/player-data.js'), c = g.indexOf('assets/js/app.js');
  assert.ok(b > 0 && a > b && a < c);
});
t('avatar() memakai UT.CharacterFace.urlData + frame pemain; fallback huruf awal & karakter bawaan', () => {
  const f = g.slice(g.indexOf('function avatar(p){'), g.indexOf('const CROWN='));
  assert.ok(/CharacterFace\.urlData\(d\)/.test(f) && /S\.looks\[/.test(f) && /EMPTY_LOOK/.test(f));
  assert.ok(/FrameAvatar\.wrap\(face,'4\.2rem',pf\)/.test(f) && /esc\(p\.name\[0\]/.test(f));
  assert.ok(/p\.kind==='bot'/.test(f) && /ONLINE&&/.test(f));
});
t('loadLooks: ambil lewat roomAppearance sekali per pemain baru, ulang bila gagal, dipanggil saat room berubah & modul wajah siap', () => {
  const f = g.slice(g.indexOf('async function loadLooks()'), g.indexOf('function avatar(p){'));
  assert.ok(/roomAppearance\(S\.mpRoomId\)/.test(f) && /S\.looksTried/.test(f) && /delete S\.looksTried\[id\]/.test(f));
  assert.ok(/renderPlayers\(\);loadLooks\(\);/.test(g.replace(/\s+/g, ' ').replace('renderPlayers();renderBottom();loadLooks();', 'renderPlayers();loadLooks();')));
  assert.ok(/FACE_DONE=true;renderEq\(\);renderPlayers\(\);loadLooks\(\);/.test(g));
});
console.log(n + ' tes lulus');
