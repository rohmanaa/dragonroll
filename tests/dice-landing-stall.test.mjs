import assert from 'node:assert/strict';
import { DiceAnimator } from '../assets/js/dice-kit/DiceAnimation.js';
import { D6_FACES } from '../assets/js/dice-kit/DiceCatalog.js';
import * as THREE from '../assets/js/vendor/three.r170.module.min.js';

const calls = [];
const animator = Object.create(DiceAnimator.prototype);
animator.forced = 4;
animator.physics = {
  throwDie(...args) { calls.push(['throwDie', ...args]); },
  throwTowards(...args) { calls.push(['throwTowards', ...args]); },
};
animator.pos = [0, 1, 0];
animator.q = [0, 0, 0, 1];
animator.spinAxis = [1, 0, 0];
animator.rng = () => 0.5;

animator._throw(true);
assert.equal(calls[0][0], 'throwDie', 'drop gameplay rolls must not run synchronous target-search simulations');
assert.equal(calls.length, 1);

calls.length = 0;
animator._throw(false);
assert.equal(calls[0][0], 'throwTowards', 'non-drop forced rolls retain natural target selection');

animator.physics = {
  pos: [0.1, 0.7, -0.2],
  q: [0, 0, 0, 1],
  h: 0.7,
  topFace: () => ({ value: 2, index: D6_FACES.findIndex((face) => face.value === 2) }),
  quatForValue: (value) => [0, value, 0, 1],
};
animator._set = (state) => { animator.state = state; };
animator._finishPhysics();
assert.equal(animator.state, 'settle', 'a physical face mismatch should smoothly settle to the game result');
assert.equal(D6_FACES[animator.faceIndex].value, 4, 'the displayed result must remain the game-forced value');

const effects = {
  slowmo: { scale: 1 },
  faceFlash: 0,
  glowIntensity: 0,
  sound: { play() {} },
  onRollStart() {},
  onRollFrame() {},
  onImpact() {},
  onLand() {},
  onResult() {},
  setLightAt() {},
};

for (let value = 1; value <= 6; value++) {
  let seed = value * 7919;
  const die = new DiceAnimator({
    mesh: new THREE.Object3D(),
    effects,
    rng: () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    },
    bounds: { x: 1.3, z: 1.1 },
    drop: true,
    dieScale: 1.4,
  });
  die.die = { id: 'test', effect: { effectTier: 0, resultEffect: 'none' } };
  const states = [];
  die.onState = (state) => states.push(state);
  const resultPromise = die.roll(value);
  for (let frame = 0; frame < 600 && die.pending; frame++) die.update(1 / 60);
  const result = await resultPromise;
  assert.equal(result.value, value, `drop roll must physically land on forced face ${value}`);
  assert.ok(!states.includes('settle'), `drop roll ${value} must not correct its face after landing`);
}

const fallback = Object.create(DiceAnimator.prototype);
Object.assign(fallback, {
  state: 'settle',
  t: 0,
  speed: 1,
  effects,
  die: { effect: { effectTier: 0, resultEffect: 'none' } },
  from: { pos: [0, 0.7, 0], q: [0, 0, 0, 1] },
  target: [0, 1, 0, 0],
  physics: { h: 0.7 },
  q: [0, 0, 0, 1],
  pos: [0, 0.7, 0],
  restY: 0.7,
  mesh: { position: { set() {} }, quaternion: { set() {} } },
});
fallback.update(0.2);
assert.equal(fallback.pos[1], fallback.restY, 'fallback face correction must stay on the floor');
fallback.update(0.2);
assert.equal(fallback.pos[1], fallback.restY, 'fallback landing must not restore a raised position');
console.log('ok - gameplay drop rolls land on their result without a post-landing lift');
