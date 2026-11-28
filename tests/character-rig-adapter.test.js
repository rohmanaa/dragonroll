/* Tes fondasi rig CharacterData/BlockyCharacter tanpa mengubah pilihan renderer halaman. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const characterBuildPath = path.join(ROOT, 'tools', 'character-data', 'build.js');
const characterBuild = require(characterBuildPath);
const generatedCharacterData = characterBuild.generate();
const blockySource = read('tools/blocky-character/template.js');
const THREE = require(path.join(ROOT, 'src', 'vendor', 'three.min.js'));
const keys = ['steve', 'alex', 'creeper', 'zombie', 'skeleton', 'ender'];
const w = { UT: {} };
w.window = w;
const context = vm.createContext({ window: w, UT: w.UT, THREE, console, Math, JSON });
vm.runInContext(generatedCharacterData, context, { filename: 'generated-character-data.js' });
vm.runInContext(blockySource, context, { filename: 'blocky-character-template.js' });
const CD = w.UT.CharacterData;
const adapter = w.UT.CharacterRigAdapter;

const parity = spawnSync(process.execPath, [characterBuildPath, '--check'], { cwd: ROOT, encoding: 'utf8' });
if (!process.argv.includes('--source-only')) assert.strictEqual(parity.status, 0, parity.stdout + parity.stderr);

assert.deepStrictEqual(
  Array.from(CD.list('player')).filter(key => adapter.resolve(key).ok).sort(),
  keys.slice().sort()
);
assert.deepStrictEqual(Array.from(require('../data/inventory/character/index.js').keys), keys);
assert.strictEqual(CD.get('player', 'villager').rig, null);
assert.strictEqual(adapter.resolve('villager').reason, 'rig-unavailable');
console.log('ok - CharacterData menyediakan definisi rig untuk enam karakter katalog; Villager tetap NPC');

const expectedTypes = { steve: 'humanoid', alex: 'humanoid', zombie: 'humanoid', skeleton: 'humanoid', creeper: 'creeper', ender: 'ender' };
const close = (a, b) => Math.abs(a - b) < 0.002;
for (const key of keys) {
  const definition = adapter.resolve(key);
  assert.strictEqual(definition.ok, true, key);
  assert.strictEqual(definition.baseModelKey, key);
  assert.strictEqual(definition.type, expectedTypes[key]);
  const sourceData = CD.get('player', key);
  const indices = Object.values(definition.definition.parts).flatMap(part => Array.from(part.boxIndices));
  assert.deepStrictEqual(indices.slice().sort((a, b) => a - b), Array.from(sourceData.boxes, (_, index) => index), key + ' box coverage');

  const created = w.UT.BlockyCharacter.createBaseRig(THREE, key);
  assert.strictEqual(created.ok, true, key);
  assert.strictEqual(created.baseModelKey, key);
  assert.strictEqual(created.root.children.length, Object.keys(created.parts).length, key + ' parts');
  let meshCount = 0;
  created.root.traverse(object => { if (object.isMesh) meshCount++; });
  assert.strictEqual(meshCount, Object.keys(created.parts).length, key + ' one geometry group per part');
  Object.keys(created.parts).forEach(name => {
    const part = created.parts[name];
    assert.ok(part.size.every(size => size > 0), key + '/' + name + ' size');
    assert.ok(part.pivot.every(Number.isFinite), key + '/' + name + ' pivot');
  });

  created.root.updateMatrixWorld(true);
  const actual = new THREE.Box3().setFromObject(created.root);
  const expected = sourceData.bounds;
  assert.ok(close(actual.min.x, expected.minX) && close(actual.max.x, expected.maxX), key + ' x bounds');
  assert.ok(close(actual.min.y, expected.minY) && close(actual.max.y, expected.maxY), key + ' y bounds');
  assert.ok(close(actual.min.z, expected.minZ) && close(actual.max.z, expected.maxZ), key + ' z bounds');
  created.dispose();
  created.dispose();
  assert.strictEqual(created.root.children.length, 0, key + ' disposal');
}
console.log('ok - enam base rig memiliki parts/pivot/bounds valid tanpa mesh badan duplikat');

const creeper = adapter.resolve('creeper');
assert.strictEqual(creeper.definition.parts.rightArm, undefined);
assert.strictEqual(creeper.definition.parts.leftArm, undefined);
assert.strictEqual(creeper.definition.anchors.rightHand, undefined);
assert.strictEqual(creeper.definition.capabilities.actionRig.handAnchors, false);
assert.strictEqual(creeper.definition.capabilities.locomotion.gait, 'four-leg-hop');
console.log('ok - Creeper tidak mendapat tangan humanoid dan memakai struktur empat kaki');

const enderman = adapter.resolve('ender');
const steve = adapter.resolve('steve');
assert.ok(enderman.bounds.maxY - enderman.bounds.minY > (steve.bounds.maxY - steve.bounds.minY) * 1.3);
assert.deepStrictEqual(Array.from(enderman.definition.parts.rightArm.boxIndices), [1]);
assert.deepStrictEqual(Array.from(enderman.definition.parts.leftArm.boxIndices), [3]);
console.log('ok - Enderman mempertahankan bagian lengan panjang dan bounds tinggi');

assert.strictEqual(adapter.resolve('unknown-model').reason, 'unknown-model');
assert.strictEqual(w.UT.BlockyCharacter.createBaseRig(THREE, 'unknown-model').reason, 'unknown-model');
const fallback = w.UT.BlockyCharacter.createBaseRig(THREE, 'unknown-model', { fallbackKey: 'steve' });
assert.strictEqual(fallback.ok, true);
assert.strictEqual(fallback.baseModelKey, 'steve');
assert.deepStrictEqual(
  { requestedModelKey: fallback.fallback.requestedModelKey, usedModelKey: fallback.fallback.usedModelKey, reason: fallback.fallback.reason },
  { requestedModelKey: 'unknown-model', usedModelKey: 'steve', reason: 'unknown-model' }
);
fallback.dispose();
console.log('ok - model tak dikenal gagal eksplisit atau memakai fallback yang diminta secara eksplisit');

const noThree = adapter.create(null, 'steve');
assert.strictEqual(noThree.ok, false);
assert.strictEqual(noThree.reason, 'three-unavailable');
console.log('ok - dependency Three yang tidak tersedia dilaporkan eksplisit');
