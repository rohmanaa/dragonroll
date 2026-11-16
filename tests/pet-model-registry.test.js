const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const KEYS = ['forest_pup', 'copper_golem', 'crystal_axolotl', 'arcane_owl', 'storm_wolf', 'inferno_dragon', 'celestial_kitsune'];
const REGISTRY_PATH = 'data/pet/js/pet-model-registry.js';
const MODEL_PATHS = {
  forest_pup: 'data/pet/items/forest_pup/model.js',
  copper_golem: 'data/pet/items/copper_golem/model.js',
  crystal_axolotl: 'data/pet/items/crystal_axolotl/model.js',
  arcane_owl: 'data/pet/items/arcane_owl/model.js',
  storm_wolf: 'data/pet/items/storm_wolf/model.js',
  inferno_dragon: 'data/pet/items/inferno_dragon/model.js',
  celestial_kitsune: 'data/pet/items/celestial_kitsune/model.js'
};
const VIEWER_PATH = 'data/pet/js/pet-viewer.js';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function harness(mode, key) {
  key = key || 'forest_pup';
  const state = { creates: 0, appends: 0, scripts: [], registrationErrors: [] };
  const window = { UT: {} };
  const document = {
    createElement(tag) {
      state.creates++;
      return { tagName: tag.toUpperCase(), parentNode: null };
    },
    head: {
      appendChild(script) {
        state.appends++;
        state.scripts.push(script);
        script.parentNode = this;
        Promise.resolve().then(() => {
          if (mode === 'load-error') {
            script.onerror(new Error('network failure'));
            return;
          }
          if (mode === 'wrong-key') {
            const wrongKey = key === 'forest_pup' ? 'copper_golem' : 'forest_pup';
            try { vm.runInContext("window.UT.PetModelRegistry.register('" + wrongKey + "', function(){})", context); }
            catch (error) { state.registrationErrors.push(error); }
          } else if (mode !== 'missing-registration') {
            try {
              vm.runInContext(read(MODEL_PATHS[key]), context, { filename: MODEL_PATHS[key] });
            } catch (error) {
              state.registrationErrors.push(error);
            }
          }
          script.onload();
        });
      },
      removeChild(script) {
        script.parentNode = null;
      }
    }
  };
  window.document = document;
  const context = vm.createContext({ window, document, console, Promise, Error, TypeError });
  vm.runInContext(read(REGISTRY_PATH), context, { filename: REGISTRY_PATH });
  return { registry: window.UT.PetModelRegistry, state };
}

function modelContext() {
  let groups = 0, emitted = 0;
  const node = () => ({
    children: [],
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: {},
    scale: { x: 1, y: 1, z: 1, setScalar(value) { this.x = this.y = this.z = value; } },
    material: { emissiveIntensity: 0, opacity: 1 },
    add(child) { this.children.push(child); },
    traverse(fn) { fn(this); this.children.forEach(child => child.traverse(fn)); },
    updateMatrixWorld() {},
    getWorldPosition(target) { return target.set(0, 0, 0); },
    getWorldQuaternion(target) { return target; }
  });
  class Group {
    constructor() { groups++; Object.assign(this, node()); }
  }
  class PointLight {
    constructor() { Object.assign(this, node()); }
  }
  class Vector3 {
    set() { return this; }
    applyQuaternion() { return this; }
  }
  class Quaternion {}
  class Color {}
  const helpers = {
    bx(parent) { const result = node(); parent.add(result); return result; },
    cone(parent) { const result = node(); parent.add(result); return result; },
    cyl(parent) { const result = node(); parent.add(result); return result; },
    gp(parent) { const result = node(); parent.add(result); return result; },
    eye(parent) { const result = node(); parent.add(result); return result; },
    glow(parent) { const result = node(); parent.add(result); return result; },
    oct(parent) { const result = node(); parent.add(result); return result; },
    sph(parent) { const result = node(); parent.add(result); return result; },
    torus(parent) { const result = node(); parent.add(result); return result; },
    mk(parent) { const result = node(); parent.add(result); return result; },
    fan() { return node(); },
    makeBolt() { return { set() {}, hide() {} }; },
    zig() { return []; },
    rate() { return () => {}; },
    pick(values) { return values[0]; },
    rr(min) { return min; }
  };
  return {
    context: { THREE: { Group, PointLight, Vector3, Quaternion, Color }, helpers, emit() { emitted++; } },
    stats: () => ({ groups, emitted })
  };
}

test('allowlist contains all seven active Pet model keys', () => {
  const { registry } = harness();
  assert.deepStrictEqual(Array.from(registry.keys()), KEYS);
  assert.deepStrictEqual(KEYS.filter(key => registry.hasModule(key)), KEYS);
  KEYS.forEach(key => assert.strictEqual(registry.isKnownKey(key), true, key));
  const source = read(REGISTRY_PATH);
  KEYS.forEach(key => assert.ok(source.includes(key + ":{url:'data/pet/items/" + key + "/model.js'"), key));
  KEYS.forEach(key => assert.ok(source.includes(key + ":{url:'data/pet/items/" + key + "/model.js',active:true}"), key));
});

test('unknown keys reject without creating a script or deriving a URL', async () => {
  const { registry, state } = harness();
  await assert.rejects(registry.load('../forest_pup'), /Unknown Pet model key/);
  assert.strictEqual(state.creates, 0);
  assert.strictEqual(state.appends, 0);
});

test('Forest Pup load is deduplicated and registration does not build the model', async () => {
  const { registry, state } = harness();
  const first = registry.load('forest_pup'), second = registry.load('forest_pup');
  assert.strictEqual(first, second);
  const builder = await first;
  assert.strictEqual(state.appends, 1);
  assert.strictEqual(state.scripts[0].src, MODEL_PATHS.forest_pup);
  const model = modelContext();
  assert.deepStrictEqual(model.stats(), { groups: 0, emitted: 0 });
  assert.strictEqual(typeof builder, 'function');
  const handle = builder(model.context);
  assert.ok(handle.root && handle.cam);
  assert.strictEqual(typeof handle.cam.y, 'number');
  assert.strictEqual(typeof handle.cam.d, 'number');
  assert.strictEqual(typeof handle.tick, 'function');
  assert.strictEqual(typeof handle.burst, 'function');
  handle.tick(0, 1 / 60);
  handle.burst();
  assert.ok(model.stats().groups > 0);
  assert.strictEqual(model.stats().emitted, 50);
  assert.strictEqual(await registry.load('forest_pup'), builder);
  assert.strictEqual(state.appends, 1);
  assert.throws(() => registry.register('forest_pup', builder), /already registered/);
});

test('Copper Golem load is deduplicated and its builder preserves the model handle contract', async () => {
  const { registry, state } = harness(null, 'copper_golem');
  const first = registry.load('copper_golem'), second = registry.load('copper_golem');
  assert.strictEqual(first, second);
  const builder = await first, model = modelContext();
  assert.strictEqual(state.appends, 1);
  assert.strictEqual(state.scripts[0].src, MODEL_PATHS.copper_golem);
  assert.deepStrictEqual(model.stats(), { groups: 0, emitted: 0 });
  assert.throws(() => builder(null), /requires the shared PetViewer context/);
  const handle = builder(model.context);
  assert.ok(handle.root && handle.cam);
  assert.deepStrictEqual([handle.cam.y, handle.cam.d], [1.5, 7.2]);
  assert.strictEqual(typeof handle.tick, 'function');
  assert.strictEqual(typeof handle.burst, 'function');
  handle.tick(0, 1 / 60);
  handle.burst();
  assert.ok(model.stats().groups > 0);
  assert.strictEqual(model.stats().emitted, 60);
  assert.strictEqual(await registry.load('copper_golem'), builder);
  assert.strictEqual(state.appends, 1);
  assert.throws(() => registry.register('copper_golem', builder), /already registered/);
});

test('Crystal Axolotl loads lazily and its builder preserves the model handle contract', async () => {
  const { registry, state } = harness(null, 'crystal_axolotl');
  const first = registry.load('crystal_axolotl'), second = registry.load('crystal_axolotl');
  assert.strictEqual(first, second);
  const builder = await first, model = modelContext();
  assert.strictEqual(state.appends, 1);
  assert.strictEqual(state.scripts[0].src, MODEL_PATHS.crystal_axolotl);
  assert.deepStrictEqual(model.stats(), { groups: 0, emitted: 0 });
  assert.throws(() => builder(null), /requires the shared PetViewer context/);
  const handle = builder(model.context);
  assert.ok(handle.root && handle.cam);
  assert.deepStrictEqual([handle.cam.y, handle.cam.d], [.95, 6.6]);
  assert.strictEqual(typeof handle.tick, 'function');
  assert.strictEqual(typeof handle.burst, 'function');
  handle.tick(0, 1 / 60);
  handle.burst();
  assert.ok(model.stats().groups > 0);
  assert.strictEqual(model.stats().emitted, 70);
  assert.strictEqual(await registry.load('crystal_axolotl'), builder);
  assert.strictEqual(state.appends, 1);
  assert.throws(() => registry.register('crystal_axolotl', builder), /already registered/);
  assert.ok(read(VIEWER_PATH).includes('const modelHelpers=Object.freeze({bx,cone,cyl,oct,torus,sph,gp,eye,glow,fan,mk,makeBolt,zig,rate,pick,rr})'));
});

test('Arcane Owl, Storm Wolf, Inferno Dragon, and Celestial Kitsune load their Pet-owned builders', async () => {
  for (const key of KEYS.slice(3)) {
    const { registry, state } = harness(null, key);
    const builder = await registry.load(key), model = modelContext();
    assert.strictEqual(state.scripts[0].src, MODEL_PATHS[key]);
    assert.strictEqual(typeof builder, 'function');
    const handle = builder(model.context);
    assert.ok(handle.root && handle.cam);
    assert.strictEqual(typeof handle.tick, 'function');
    assert.strictEqual(typeof handle.burst, 'function');
    handle.tick(0, 1 / 60);
    handle.burst();
    assert.ok(model.stats().groups > 0, key);
    assert.ok(model.stats().emitted > 0, key);
  }
});

test('a module that registers a different key is rejected', async () => {
  const { registry, state } = harness('wrong-key', 'copper_golem');
  await assert.rejects(registry.load('copper_golem'), /did not register the requested key/);
  assert.strictEqual(state.registrationErrors.length, 1);
});

test('all seven Pet builders have one canonical model.js and none remain inline in PetViewer', () => {
  const viewer = read(VIEWER_PATH);
  const names = ['ForestPup', 'CopperGolem', 'CrystalAxolotl', 'ArcaneOwl', 'StormWolf', 'InfernoDragon', 'CelestialKitsune'];
  KEYS.forEach((key, index) => {
    const model = read(MODEL_PATHS[key]);
    assert.ok(model.includes('function build' + names[index] + '(context)'), key);
    assert.ok(!viewer.includes('function pet' + names[index]), key);
  });
  assert.ok(viewer.includes("catalogItems.filter(item=>item.kind==='pet')"));
  assert.ok(viewer.includes("map(item=>({id:item.gameKey,name:item.name,color:item.accent}))"));
  assert.ok(!/function pet(?:Pup|Golem|Axolotl|Owl|Wolf|Dragon|Kitsune)\(/.test(viewer), 'viewer must not retain Pet model builders');
  assert.strictEqual((viewer.match(/function pet(?:Pup|Golem|Axolotl|Owl|Wolf|Dragon|Kitsune)\(/g) || []).length, 0);
});

test('script load errors reject explicitly', async () => {
  const { registry, state } = harness('load-error');
  await assert.rejects(registry.load('forest_pup'), /Failed to load Pet model module/);
  assert.strictEqual(state.appends, 1);
});

test('a later selection invalidates an older Copper Golem load before its builder can run', async () => {
  const { registry } = harness(null, 'copper_golem'), guard = registry.createSelectionGuard();
  const stale = guard.begin(), pending = registry.load('copper_golem'), latest = guard.begin();
  let built = false;
  const builder = await pending;
  if (guard.isCurrent(stale)) { builder(modelContext().context); built = true; }
  assert.strictEqual(guard.isCurrent(latest), true);
  assert.strictEqual(built, false);

  const viewer = read(VIEWER_PATH);
  const selectAt = viewer.indexOf('selectFn=function(i){');
  assert.ok(viewer.includes('if(pendingId===i)return;'));
  assert.ok(viewer.includes('if(cur===i&&pet){if(pendingId!==null){selectionGuard.begin();pendingId=null}return}'));
  assert.ok(viewer.includes('const token=selectionGuard.begin(),changed=cur!==i;'));
  const loadAt = viewer.indexOf('registry.load(d.id).then');
  const currentGuard = viewer.indexOf('if(!selectionGuard.isCurrent(token))return;', loadAt);
  const buildAt = viewer.indexOf('builder({THREE:T,helpers:modelHelpers,emit})', loadAt);
  assert.ok(selectAt >= 0 && loadAt > selectAt && currentGuard > loadAt && currentGuard < buildAt);
  assert.ok(viewer.includes('catch(error){failed(error)}'));
  assert.ok(viewer.includes('window.PetViewer={\n  select(gameKey){'));
  assert.ok(viewer.includes("console.error('[PetViewer] Failed to load or build '+d.id+'.',error)"));
});

test('Pet audio remains manifest and ItemRegistry-backed, not duplicated in model modules', () => {
  const viewer = read(VIEWER_PATH), registry = read(REGISTRY_PATH);
  assert.ok(viewer.includes("IR.shared().getItem('pet.'+id)"));
  assert.ok(viewer.includes('m&&m.assets&&m.assets.sfx'));
  assert.ok(!/assets\.sfx|assets\/sfx/.test(registry));
  Object.values(MODEL_PATHS).forEach(file => assert.ok(!/assets\.sfx|assets\/sfx/.test(read(file)), file));
});

(async () => {
  for (const [name, fn] of tests) {
    await fn();
    console.log('ok - ' + name);
  }
  console.log('PASS ' + tests.length + '/' + tests.length);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
