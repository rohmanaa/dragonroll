const assert = require('assert');
const fs = require('fs');
const PG = require("./_page");
const path = require('path');
const root = path.join(__dirname, '..');
const lobby = PG.readFileSync(path.join(root, 'lobby.html'), 'utf8');

assert.ok(lobby.includes('assets/ng/css/lobby.css'));
assert.ok(lobby.includes('assets/css/scene-bg.css'));
assert.ok(lobby.includes('assets/js/scene-bg.js" data-auto data-preset="soft" data-image="assets/Images/background/lobby-kastel.webp" data-lights="lobby"'));
assert.ok(lobby.includes('.sbg-clouds{display:none!important}'));
assert.ok(lobby.includes('.sbg-stars,.sbg-moon,.sbg-fog,.sbg-rays{display:none!important}'));
assert.ok(lobby.includes('.sbg-lights{opacity:.3}'));
assert.ok(lobby.includes('html[data-ambience="night"] .sbg-img{filter:brightness(.72) saturate(.9) hue-rotate(5deg)!important}'));
assert.ok(lobby.includes('#gl3d{position:fixed;inset:0;width:100%;height:100%;display:block;z-index:1;pointer-events:none}'));
assert.ok(lobby.includes('#wrap{z-index:2}'));
assert.ok(lobby.includes('.sbg{z-index:0!important}'));
assert.ok(lobby.includes('floor.position.set(0,-2.62,0)'));
assert.ok(lobby.includes('hero.position.set(0,-2.60,0)'));
assert.ok(lobby.includes('UT.FloatingIsland.contactShadow(THREE,3.6,2.2,.9)'));
assert.ok(lobby.includes('contact.position.set(0,-2.62,.12)'));
assert.ok(lobby.includes('const LOBBY_MOTION_SCALE=.72;'));
assert.ok(lobby.includes('bc.tick(motionDt);stepLobby(motionDt);'));
assert.ok(lobby.includes('id="gl3d"'));
assert.ok(lobby.includes('assets/js/floating-island.js'));
assert.ok(lobby.includes('UT.FloatingIsland.contactShadow(THREE'));
assert.ok(!lobby.includes('UT.FloatingIsland.create(THREE'));
assert.ok(!lobby.includes('id="bdrop"'));
assert.ok(lobby.includes('assets/Images/background/lobby-kastel.webp'));
assert.ok(!lobby.includes('lobby-bg.webp'));
assert.ok(lobby.includes('assets/Images/icon/currency/coin.webp'));
assert.ok(lobby.includes('assets/Images/icon/mode/console.webp'));
assert.ok(lobby.includes('AUR.only(bc.root,UT.AuraView.equippedKey(),{facing:-hero.rotation.y})'));
assert.ok(lobby.includes('AUR.update(motionDt)'));
assert.ok(lobby.includes('bc.tick(motionDt)'));
assert.ok(lobby.includes('const lobbyActs='));
assert.ok(!lobby.includes("$('#md').classList"));

const background = PG.readFileSync(path.join(root, 'assets/Images/background/lobby-kastel.webp'));
assert.strictEqual(background.toString('ascii', 0, 4), 'RIFF');
assert.strictEqual(background.toString('ascii', 8, 12), 'WEBP');
for (const icon of ['assets/Images/icon/currency/coin.webp', 'assets/Images/icon/mode/console.webp']) {
  const image = PG.readFileSync(path.join(root, icon));
  assert.strictEqual(image.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(image.toString('ascii', 8, 12), 'WEBP');
}
assert.ok(lobby.includes('assets/ng/komponen/ikon-item/podium.webp'));
assert.ok(lobby.includes('assets/ng/komponen/tombol-dan-kontrol/tombol-play-lobby.webp'));
console.log('ok - lobby keeps ui-newgui HUD over main WebP backdrop, character, aura, and animations');
