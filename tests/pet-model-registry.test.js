const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const KEYS = ['forest_pup', 'copper_golem', 'crystal_axolotl', 'arcane_owl', 'storm_wolf', 'inferno_dragon', 'celestial_kitsune'];
const REGISTRY_PATH = 'assets/js/renderers/pet-model-registry.js';
const MODEL_PATHS = {
  forest_pup: 'data/inventory/pet/forest_pup/model.js',
  copper_golem: 'data/inventory/pet/copper_golem/model.js'
};
const VIEWER_PATH = 'assets/js/pet-viewer.js';
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
    position: { set() {} },
    rotation: {},
    scale: { y: 1 },
    material: { emissiveIntensity: 0, opacity: 1 },
    add() {},
    traverse() {}
  });
  class Group {
    constructor() { groups++; Object.assign(this, node()); }
  }
  const helpers = {
    bx(parent) { const result = node(); parent.add(result); return result; },
    cyl(parent) { const result = node(); parent.add(result); return result; },
    gp(parent) { const result = node(); parent.add(result); return result; },
    eye(parent) { const result = node(); parent.add(result); return result; },
    glow(parent) { const result = node(); parent.add(result); return result; },
    sph(parent) { const result = node(); parent.add(result); return result; },
    rate() { return () => {}; },
    pick(values) { return values[0]; },
    rr(min) { return min; }
  };
  return {
    context: { THREE: { Group }, helpers, emit() { emitted++; } },
    stats: () => ({ groups, emitted })
  };
}

test('allowlist contains all seven keys with Forest Pup and Copper Golem active', () => {
  const { registry } = harness();
  assert.deepStrictEqual(Array.from(registry.keys()), KEYS);
  assert.deepStrictEqual(KEYS.filter(key => registry.hasModule(key)), ['forest_pup', 'copper_golem']);
  KEYS.forEach(key => assert.strictEqual(registry.isKnownKey(key), true, key));
  const source = read(REGISTRY_PATH);
  KEYS.forEach(key => assert.ok(source.includes(key + ":{url:'data/inventory/pet/" + key + "/model.js'"), key));
  assert.ok(source.includes("forest_pup:{url:'data/inventory/pet/forest_pup/model.js',active:true}"));
  assert.ok(source.includes("copper_golem:{url:'data/inventory/pet/copper_golem/model.js',active:true}"));
  KEYS.slice(2).forEach(key => assert.ok(source.includes(key + ":{url:'data/inventory/pet/" + key + "/model.js',active:false}"), key));
});

test('unknown and inactive keys reject without creating a script or deriving a URL', async () => {
  const { registry, state } = harness();
  await assert.rejects(registry.load('../forest_pup'), /Unknown Pet model key/);
  await assert.rejects(registry.load('copper_golem'), /not active/);
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

test('a module that registers a different key is rejected', async () => {
  const { registry, state } = harness('wrong-key', 'copper_golem');
  await assert.rejects(registry.load('copper_golem'), /did not register the requested key/);
  assert.strictEqual(state.registrationErrors.length, 1);
});

test('Forest Pup and Copper Golem are extracted; the five remaining builders stay inline', () => {
  const viewer = read(VIEWER_PATH), model = read(MODEL_PATHS.forest_pup), copper = read(MODEL_PATHS.copper_golem);
  assert.ok(!viewer.includes('function petPup('));
  assert.ok(!viewer.includes('function petGolem('));
  assert.ok(viewer.includes("id:'forest_pup'") && viewer.includes("color:'#6fd05a',build:null"));
  assert.ok(viewer.includes("id:'copper_golem'") && viewer.includes("color:'#ff9a30',build:null"));
  ['petAxolotl', 'petOwl', 'petWolf', 'petDragon', 'petKitsune'].forEach(name => {
    assert.ok(viewer.includes('function ' + name + '()'), name);
  });
  assert.ok(model.includes('function buildForestPup(context)'));
  assert.ok(copper.includes('function buildCopperGolem(context)'));
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
  assert.ok(viewer.includes('if((cur===i&&pet)||pendingId===i)return;'));
  assert.ok(viewer.includes('const token=selectionGuard.begin(),changed=cur!==i;'));
  const loadAt = viewer.indexOf('registry.load(d.id).then');
  const currentGuard = viewer.indexOf('if(!selectionGuard.isCurrent(token))return;', loadAt);
  const buildAt = viewer.indexOf('builder({THREE:T,helpers:modelHelpers,emit})', loadAt);
  assert.ok(selectAt >= 0 && loadAt > selectAt && currentGuard > loadAt && currentGuard < buildAt);
  assert.ok(viewer.includes('catch(error){failed(error)}'));
  assert.ok(viewer.includes('window.PetViewer={\n  select(id){'));
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
