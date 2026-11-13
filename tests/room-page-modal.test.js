const assert = require('assert');
const fs = require('fs');
const PG = require("./_page");
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => PG.readFileSync(path.join(root, file), 'utf8');
const room = read('room.html');
let count = 0;

function test(name, fn) {
  fn();
  count++;
  console.log('ok - ' + name);
}

test('equipment slots open their corresponding full-screen page modal', () => {
  for (const [key, file] of Object.entries({
    dice: 'dadu.html',
    skin: 'karakter.html',
    frame: 'frame.html',
    effect: 'efek.html',
    power: 'powerup.html',
  })) {
    assert.ok(room.includes(`${key}:['${file}'`), `${key} page mapping`);
  }
  assert.ok(/id="pageModal"[^>]*role="dialog"/.test(room));
  assert.ok(/id="pageModalFrame"/.test(room));
  assert.ok(!room.includes('pageModalClose'));
  assert.ok(room.includes('id="pageModalLoading"'));
  assert.ok(room.includes('assets/ng/komponen/hud/efek-titik-berputar.webp'));
  assert.ok(room.includes("classList.add('on','loading')"));
});

test('equipment modal fills the viewport with an opaque backdrop outside the Room stage', () => {
  assert.ok(/#pageModal\{position:fixed;inset:0;[^}]*background:var\(--room-backdrop\)/.test(room));
  assert.ok(/#pageModal iframe\{[^}]*background:var\(--room-backdrop\)/.test(room));
  assert.ok(/#pageModalLoading\{[^}]*background:var\(--room-backdrop\)/.test(room));
  assert.ok(/<div id="toast"><\/div>\s*<\/div>\s*<div id="pageModal"/.test(room), 'modal is outside the scaled Room stage');
  const bridge = read('assets/js/room-modal-bridge.js');
  assert.ok(bridge.includes('background:#4b4162!important'));
  assert.ok(bridge.includes('background:#483e60!important'));
  assert.ok(!bridge.includes('background:transparent'), 'embedded page uses an opaque Room background');
  assert.ok(read('assets/ng/css/room.css').includes('--room-backdrop:#4b4162'));
  const bootGuard = read('assets/js/boot-guard.js');
  assert.ok(bootGuard.includes("get('from') === 'room'"), 'embedded pages skip the cinematic black fade');
});

test('embedded pages close the parent modal from their back controls', () => {
  for (const file of ['dadu.html', 'karakter.html', 'frame.html', 'efek.html', 'powerup.html']) {
    assert.ok(read(file).includes('assets/js/room-modal-bridge.js'), `${file} bridge`);
  }
  const bridge = read('assets/js/room-modal-bridge.js');
  assert.ok(bridge.includes("closest('#back, #home')"));
  assert.ok(bridge.includes("type: 'ut-room-modal-close'"));
  assert.ok(!bridge.includes('.ut-curbar'));
  assert.ok(!bridge.includes('#cur-em'));
  assert.ok(!bridge.includes('#cur-co'));
});

test('effects page keeps its back button and removes the home button', () => {
  const effect = read('efek.html');
  const pageCss = read('assets/ng/css/page.css');
  assert.ok(effect.includes('id="back"'));
  assert.ok(!effect.includes('id="home"'));
  assert.ok(!effect.includes("$('#home')"));
  assert.ok(pageCss.includes('body.ef #cur-em{left:auto!important;right:340px!important}'));
  assert.ok(pageCss.includes('body.ef #cur-co{left:auto!important;right:26px!important}'));
});

test('power uses a compact icon action and concise label', () => {
  assert.ok(room.includes('<h3>POWER <button type="button" id="powerPage"'));
  assert.ok(room.includes('id="pmT">PILIH POWER</h2>'));
  assert.ok(!room.includes('POWER LOADOUT</h3>'));
});

test('room dice art uses the same procedural thumbnail source as the preview', () => {
  assert.ok(room.includes('RoomDiceArt.thumb(it.gameKey,96)'));
  const module = read('assets/js/room-dice-art.js');
  assert.ok(module.includes("from './dice-kit/DiceCatalog.js'"));
  assert.ok(module.includes("from './dice-kit/DiceTextures.js'"));
  assert.ok(module.includes('diceThumbDataURL(die, px)'));
});

console.log(count + ' tests passed');
