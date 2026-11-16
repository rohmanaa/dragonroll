/* Tes Core FX (gameplay/js/fx.js): cleanup, batas partikel, skala kualitas.
   Jalankan: node tests/gameplay-fx-core.test.js   (tanpa browser; memakai three.min.js asli, tanpa render) */
const assert = require('assert'), path = require('path'), vm = require('vm'), fs = require('fs');
const R = path.join(__dirname, '..') + path.sep;

global.window = global; global.UT = {};
global.THREE = require(R + 'assets/js/vendor/three.min.js');
vm.runInThisContext(fs.readFileSync(R + 'gameplay/js/fx.js', 'utf8'), { filename: 'fx.js' });
const FX = UT.GameplayFX;

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const P = new THREE.Vector3(0, 0, 0);
const fresh = () => { const scene = new THREE.Scene(); assert(FX.init(scene)); FX.clearConfetti(); FX.setQuality('high'); return scene; };

t('API Core FX tersedia', () => {
  for (const k of ['init', 'spawnConfetti', 'spawnExplosion', 'updateConfetti', 'clearConfetti', 'sparkle', 'updateSparks', 'setQuality', 'stats'])
    assert.strictEqual(typeof FX[k], 'function', k);
});

t('kualitas default (high) = jumlah partikel lama', () => {
  const sc = fresh(); const base = sc.children.length;
  FX.spawnConfetti(P); assert.strictEqual(FX.stats().confetti, 110);
  FX.spawnExplosion(P); assert.strictEqual(FX.stats().blasts, 58);
  FX.sparkle(P); assert.strictEqual(FX.stats().sparks, 14);
  assert.strictEqual(sc.children.length - base, 110 + 58 + 14);
});

t('setQuality low/medium mengurangi partikel; nilai tak dikenal = 1x', () => {
  fresh(); FX.setQuality('low'); FX.spawnConfetti(P); assert.strictEqual(FX.stats().confetti, 44);
  fresh(); FX.setQuality('medium'); FX.spawnConfetti(P); assert.strictEqual(FX.stats().confetti, 77);
  fresh(); assert.strictEqual(FX.setQuality('bogus'), 1);
});

t('clearConfetti membersihkan confetti, blast, DAN sparkle dari scene', () => {
  const sc = fresh(); const base = sc.children.length;
  FX.spawnConfetti(P); FX.spawnExplosion(P, 'ender'); FX.sparkle(P);
  assert(sc.children.length > base);
  FX.clearConfetti();
  assert.strictEqual(FX.stats().live, 0); assert.strictEqual(sc.children.length, base);
});

t('batas keras: spawn berulang tidak menumpuk melebihi MAX_LIVE (600)', () => {
  fresh(); for (let i = 0; i < 20; i++) { FX.spawnConfetti(P); FX.spawnExplosion(P); FX.sparkle(P); }
  assert(FX.stats().live <= 600, 'live=' + FX.stats().live);
});

t('partikel habis umur dilepas dari scene (update sampai selesai)', () => {
  const sc = fresh(); const base = sc.children.length;
  FX.spawnConfetti(P); FX.spawnExplosion(P); FX.sparkle(P);
  for (let i = 0; i < 400; i++) { FX.updateConfetti(0.02); FX.updateSparks(0.02); }
  assert.strictEqual(FX.stats().live, 0); assert.strictEqual(sc.children.length, base);
});

console.log(n + ' tes lulus');
