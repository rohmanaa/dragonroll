const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const { harness } = require('./helpers/fx-harness');

let count = 0;
const test = (name, fn) => { fn(); count++; console.log('ok - ' + name); };

test('tracking memberi ID unik dan state lifecycle lengkap', () => {
  const { FX } = harness(), states = [];
  const effect = { onLifecycle(state) { states.push(state); }, stop() {}, cleanup() {} };
  const first = FX.track(effect, { scope: 'visual' });
  const second = FX.track({}, { scope: 'visual' });
  assert.notStrictEqual(first, second);
  assert.deepStrictEqual(states, ['created', 'playing']);
  assert.strictEqual(FX.getActive()[0].state, 'playing');
  assert.strictEqual(FX.stop(first), true);
  assert.strictEqual(FX.stop(first), false);
  assert.deepStrictEqual(states, ['created', 'playing', 'stopping', 'disposed']);
});

test('untrack menyelesaikan efek alami tanpa cleanup berulang', () => {
  const { FX } = harness();
  let cleanupCount = 0;
  const id = FX.track({ cleanup() { cleanupCount++; } }, { type: 'natural', scope: 'visual' });
  assert.strictEqual(FX.untrack(id), true);
  assert.strictEqual(FX.untrack(id), false);
  assert.strictEqual(cleanupCount, 0);
  assert.strictEqual(FX.getActive().length, 0);
});

test('stop hanya memengaruhi ID yang dipilih dan aman diulang', () => {
  const { FX } = harness();
  let first = 0, second = 0;
  const one = FX.track({ stop() { first++; } }, { scope: 'visual' });
  const two = FX.track({ stop() { second++; } }, { scope: 'visual' });
  FX.stop(one);
  FX.stop(one);
  assert.strictEqual(first, 1);
  assert.strictEqual(second, 0);
  assert.deepStrictEqual(Array.from(FX.getActive(), item => item.id), [two]);
});

test('stopAll menghormati scope dan category', () => {
  const { FX } = harness();
  let visual = 0, particle = 0, gameplay = 0;
  FX.track({ stop() { visual++; } }, { scope: 'visual' });
  FX.track({ stop() { particle++; } }, { scope: 'other', category: 'particle' });
  FX.track({ stop() { gameplay++; } }, { scope: 'gameplay' });
  assert.strictEqual(FX.stopAll({ scope: 'visual' }), 1);
  assert.strictEqual(visual, 1);
  assert.strictEqual(particle, 0);
  assert.strictEqual(gameplay, 0);
  assert.strictEqual(FX.stopAll({ scope: 'particle' }), 1);
  assert.strictEqual(particle, 1);
  FX.stopAll();
  assert.strictEqual(gameplay, 1);
  assert.strictEqual(FX.getActive().length, 0);
});

test('timeout FX berhenti, cleanup sekali, dan untrack saat selesai alami', () => {
  const { FX, timers } = harness();
  let fired = 0, stopped = 0;
  const cancelled = FX.timeout(() => fired++, 100, { type: 'fx-timer' }, () => stopped++);
  assert.strictEqual(FX.getActive()[0].id, cancelled.id);
  assert.strictEqual(timers.has(cancelled.timer), true);
  assert.strictEqual(cancelled.clear(), true);
  assert.strictEqual(cancelled.clear(), false);
  assert.strictEqual(timers.has(cancelled.timer), false);
  assert.strictEqual(fired, 0);
  assert.strictEqual(stopped, 1);
  const natural = FX.timeout(() => fired++, 100, { type: 'fx-timer' });
  const callback = timers.get(natural.timer);
  timers.delete(natural.timer);
  callback();
  assert.strictEqual(fired, 1);
  assert.strictEqual(FX.getActive().length, 0);
});

test('spark cleanup melepas material milik efek tanpa dispose geometri bersama', () => {
  const { FX, scene } = harness();
  FX.init(scene);
  FX.sparkle({ x: 0, y: 0, z: 0 });
  const id = FX.getActive()[0].id;
  const sparks = scene.children.slice();
  const ownedMaterials = sparks.map(item => item.material);
  const sharedGeometry = sparks[0].geometry;
  assert.strictEqual(FX.stop(id), true);
  assert.strictEqual(scene.children.length, 0);
  ownedMaterials.forEach(material => assert.strictEqual(material.disposeCount, 1));
  assert.strictEqual(sharedGeometry.disposeCount || 0, 0);
});

test('confetti dan explosion selesai otomatis dan clear mencakup spark', () => {
  const { FX, scene } = harness();
  FX.init(scene);
  FX.spawnConfetti({ x: 0, y: 0, z: 0 });
  const confettiId = FX.getActive()[0].id;
  FX.updateConfetti(5);
  assert.strictEqual(scene.children.length, 0);
  assert.strictEqual(FX.getActive().some(item => item.id === confettiId), false);
  FX.spawnExplosion({ x: 0, y: 0, z: 0 });
  const explosionId = FX.getActive()[0].id;
  FX.updateConfetti(3);
  assert.strictEqual(scene.children.length, 0);
  assert.strictEqual(FX.getActive().some(item => item.id === explosionId), false);
  FX.spawnConfetti({ x: 0, y: 0, z: 0 });
  FX.sparkle({ x: 0, y: 0, z: 0 });
  const sparkGeometry = scene.children[scene.children.length - 1].geometry;
  const sharedGeometry = scene.children.find(item => item.geometry !== sparkGeometry).geometry;
  const individualMaterials = scene.children.filter(item => item.geometry === sparkGeometry).map(item => item.material);
  FX.clearConfetti();
  assert.strictEqual(scene.children.length, 0);
  assert.strictEqual(FX.getActive().length, 0);
  assert.strictEqual(sharedGeometry.disposeCount || 0, 0);
  assert.strictEqual(sparkGeometry.disposeCount || 0, 0);
  individualMaterials.forEach(material => {
    if (material.color !== undefined) assert.strictEqual(material.disposeCount, 1);
  });
});

test('DOM burst dilacak dan animationend menuntaskan tracking grup', () => {
  const { FX, ParticleFX, scene, document } = harness();
  FX.init(scene);
  assert.strictEqual(ParticleFX.burstAt(20, 30, { count: 3 }), 3);
  const id = FX.getActive().find(item => item.metadata.type === 'dom-particle-burst').id;
  const layer = document.getElementById('fx-layer');
  const nodes = layer.children.slice();
  nodes.forEach(node => layer.dispatch('animationend', { target: node }));
  assert.strictEqual(layer.childElementCount, 0);
  assert.strictEqual(FX.getActive().some(item => item.id === id), false);
});

test('stop pada grup DOM menghapus node tanpa menyentuh grup lain', () => {
  const { FX, ParticleFX, scene, document } = harness();
  FX.init(scene);
  ParticleFX.burstAt(0, 0, { count: 2 });
  ParticleFX.burstAt(0, 0, { count: 3 });
  const ids = FX.getActive().filter(item => item.metadata.type === 'dom-particle-burst').map(item => item.id);
  assert.strictEqual(document.getElementById('fx-layer').childElementCount, 5);
  FX.stop(ids[0]);
  assert.strictEqual(document.getElementById('fx-layer').childElementCount, 3);
  assert.strictEqual(FX.getActive().some(item => item.id === ids[1]), true);
  ParticleFX.clear();
  assert.strictEqual(document.getElementById('fx-layer').childElementCount, 0);
});

test('visibility menghentikan efek visual tanpa mengubah gameplay scope', () => {
  const { FX, ParticleFX, scene, document } = harness();
  FX.init(scene);
  FX.spawnConfetti({ x: 0, y: 0, z: 0 });
  ParticleFX.burstAt(0, 0, { count: 2 });
  const gameplay = FX.track({ stop() { throw new Error('gameplay effect must continue'); } }, { scope: 'gameplay' });
  document.hidden = true;
  document.dispatch('visibilitychange');
  assert.strictEqual(scene.children.length, 0);
  assert.strictEqual(document.getElementById('fx-layer').childElementCount, 0);
  assert.deepStrictEqual(Array.from(FX.getActive(), item => item.id), [gameplay]);
});

test('overlay Power 3D dihentikan saat visual dihentikan dan di-dispose saat keluar', () => {
  const { FX, window } = harness();
  let stopped = 0, disposed = 0;
  window.UT.PowerOverlay = { stop() { stopped++; }, dispose() { disposed++; } };
  FX.stopAll({ scope: 'visual' });
  assert.strictEqual(stopped, 1);
  assert.strictEqual(disposed, 0);
  FX.dispose();
  assert.strictEqual(stopped, 2);
  assert.strictEqual(disposed, 1);
  const overlay = fs.readFileSync(path.join(root, 'src/renderers/power-3d/power-overlay.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'src/renderers/power-3d/power-renderer.js'), 'utf8');
  assert.match(overlay, /fx\.track\(\{ stop \}, \{ type: 'power-overlay', scope: 'visual' \}\)/);
  assert.match(overlay, /export function stop\(\)/);
  assert.match(overlay, /export function dispose\(\)/);
  assert.match(renderer, /stop\(\) \{ cancelAnimationFrame\(this\._raf\); this\._raf = 0; this\._wasRunning = false; \}/);
});

test('pagehide melepaskan listener, DOM partikel, dan resource FX tepat sekali', () => {
  const { FX, ParticleFX, scene, document, window, windowListeners } = harness();
  FX.init(scene);
  FX.spawnConfetti({ x: 0, y: 0, z: 0 });
  ParticleFX.burstAt(0, 0, { count: 2 });
  const sharedGeometry = scene.children[0].geometry;
  window.dispatch('pagehide', { persisted: false });
  assert.strictEqual(FX.dispose(), false);
  assert.strictEqual(scene.children.length, 0);
  assert.strictEqual(document.getElementById('fx-layer'), null);
  assert.strictEqual(document.listeners.visibilitychange.length, 0);
  assert.strictEqual(windowListeners.pagehide.length, 0);
  assert.strictEqual(sharedGeometry.disposeCount, 1);
  assert.strictEqual(FX.getActive().length, 0);
});

test('Ender Hole dilacak terpisah dari tween gameplay dan reset menghentikan visual', () => {
  const main = fs.readFileSync(path.join(root, 'gameplay/js/main.js'), 'utf8');
  assert.match(main, /const EH_LIFE=2\.3/);
  assert.match(main, /type:'ender-hole',scope:'visual',category:'transition'/);
  assert.match(main, /visualTween=tweenVisual\(EH_LIFE/);
  assert.match(main, /if\(cancelVisual&&visualTween\) visualTween\.cancel\(\)/);
  assert.match(main, /function enderSwapAnim[\s\S]*?await tween\(0\.7,\(\)=>\{\}\)[\s\S]*?await tween\(0\.7,k=>/);
  assert.match(main, /if\(FX&&typeof FX\.stopAll==='function'\) FX\.stopAll\(\{scope:'visual'\}\)/);
  assert.match(main, /if\(document\.hidden\)\{ holdEnd\(false\); dragonFireStop\(\); DFX\.clear\(\); \}/);
  assert.match(main, /if\(!e\.persisted&&PAURA&&PAURA\.system&&typeof PAURA\.system\.dispose==='function'\)\{\s*PAURA\.system\.dispose\(\)/);
});

console.log('\n' + count + ' tes lifecycle lulus');

