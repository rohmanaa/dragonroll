import assert from 'node:assert/strict';
import { DiceAnimator } from '../assets/js/dice-kit/DiceAnimation.js';
import { D6_FACES } from '../assets/js/dice-kit/DiceCatalog.js';

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
console.log('ok - gameplay drop rolls avoid synchronous target-search stalls');
