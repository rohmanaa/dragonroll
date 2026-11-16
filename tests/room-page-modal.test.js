const assert = require('assert');
const fs = require('fs');
const PG = require("./_page");
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => PG.readFileSync(path.join(root, file), 'utf8');
const room = read('room.html');
const roomSource = fs.readFileSync(path.join(root, 'room.html'), 'utf8');
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
  assert.ok(room.includes('assets/images/ui/hud/efek-titik-berputar.webp'));
  assert.ok(room.includes("classList.add('on','loading')"));
});

test('room loads its layout stylesheet before page-specific overrides exactly once', () => {
  const layout = roomSource.indexOf('assets/css/pages/room-legacy.css');
  const overrides = roomSource.indexOf('assets/css/pages/room.css');
  assert.ok(layout > 0 && overrides > layout);
  assert.strictEqual((roomSource.match(/assets\/css\/pages\/room\.css/g) || []).length, 1);
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
  assert.ok(read('assets/css/pages/room-legacy.css').includes('--room-backdrop:#4b4162'));
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
  const pageCss = read('assets/css/page.css');
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
  const module = read('data/inventory/dice/_shared/js/room-dice-art.js');
  assert.ok(module.includes("from '../../../../../assets/js/renderers/dice-kit/dice-catalog.js'"));
  assert.ok(module.includes("from '../../../../../assets/js/renderers/dice-kit/dice-textures.js'"));
  assert.ok(module.includes('diceThumbDataURL(die, px)'));
});

test('dadu/frame/efek: modal ringan native berisi item yang DIMILIKI saja (tanpa iframe halaman penuh)', () => {
  assert.ok(room.includes("const EQP={dice:{kind:'dice'"), 'picker dice/frame/effect');
  assert.ok(room.includes("PD.owns(i.id)"), 'hanya item yang dimiliki');
  assert.ok(room.includes("k==='skin')openPageModal('skin');else openEqPick(k)"), 'hanya karakter yang tetap membuka halaman Karakter');
  assert.ok(/id="em"[^>]*role="dialog"/.test(room) && room.includes('id="emL"') && room.includes('id="emX"'));
  assert.ok(room.includes("PD.unequip('aura')") && room.includes('PD.equip(id)'), 'pakai/lepas lewat PlayerData');
});

test('modal Power & picker item: FULL WINDOW di luar stage, tombol close (X) kanan atas', () => {
  assert.ok(/<div class="fw" id="pm"[^>]*role="dialog"/.test(room) && room.includes('id="pmX"'));
  const stageEnd = room.indexOf('<div id="pageModal"');
  assert.ok(room.indexOf('id="pm"') > stageEnd && room.indexOf('id="em"') > stageEnd, 'di luar #stage yang diskalakan');
  assert.ok(/\.fw\{position:fixed;inset:0;[^}]*background:var\(--room-backdrop\)/.test(room));
  assert.ok(/\.fwx\{position:absolute;top:\d+px;right:\d+px/.test(room), 'close di kanan atas');
  assert.ok(room.includes("w.style.width=innerWidth/s+'px'") && room.includes("w.style.height=innerHeight/s+'px'"), 'isi mengikuti ukuran jendela');
  assert.ok(room.includes("$('#pmX').onclick=closePowerPick") && room.includes("e.key!=='Escape'"));
  assert.ok(room.includes("$('#powerPage').onclick=()=>openPowerPick()"));
});

console.log(count + ' tests passed');
