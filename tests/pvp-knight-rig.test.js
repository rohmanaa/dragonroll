const assert = require('assert');
const THREE = require('../src/vendor/three.min.js');
const PvpKnight = require('../src/gameplay/js/pvp-knight-rig.js');

function run() {
  assert.ok(PvpKnight, 'PvpKnight module exports correctly');
  assert.strictEqual(typeof PvpKnight.createKnight, 'function', 'createKnight is a function');
  assert.ok(PvpKnight.POSES, 'POSES are defined');
  assert.ok(PvpKnight.POSES.guard, 'guard pose exists');
  assert.ok(PvpKnight.POSES.block, 'block pose exists');
  assert.ok(PvpKnight.POSES.smite, 'smite (critical) pose exists');
  assert.ok(PvpKnight.POSES.holy, 'holy (berserk) pose exists');
  assert.ok(PvpKnight.POSES.ko, 'ko pose exists');
  assert.ok(PvpKnight.POSES.win, 'win pose exists');

  // Test pose sampling
  const sampled = PvpKnight.sample(PvpKnight.POSES.smite, 0.5);
  assert.ok(sampled, 'sample returns interpolated pose');
  assert.strictEqual(typeof sampled.rx, 'number', 'rx angle interpolated');

  // Test SFX definitions
  assert.ok(PvpKnight.SFX, 'SFX module exists');
  const sfxMethods = ['roll', 'land', 'hit', 'crit', 'berserk', 'block', 'guard', 'heal', 'thud', 'ko', 'defeat', 'victory'];
  sfxMethods.forEach(method => {
    assert.strictEqual(typeof PvpKnight.SFX[method], 'function', `SFX.${method} is callable`);
    // Should execute safely without window/AudioContext in node
    PvpKnight.SFX[method]();
  });

  // Test Palettes
  assert.ok(PvpKnight.DEFAULT_PAL.skin, 'DEFAULT_PAL skin color defined');
  assert.ok(PvpKnight.RIVAL_PAL.skin, 'RIVAL_PAL skin color defined');

  console.log('pvp-knight-rig tests passed');
}

run();


