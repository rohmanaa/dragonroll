const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const KEYS = ['forest_pup', 'copper_golem', 'crystal_axolotl', 'arcane_owl', 'storm_wolf', 'inferno_dragon', 'celestial_kitsune'];
const REGISTRY_PATH = 'assets/js/renderers/pet-model-registry.js';
const MODEL_PATH = 'data/inventory/pet/forest_pup/model.js';
const VIEWER_PATH = 'assets/js/pet-viewer.js';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function harness(mode) {
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
            try {
              vm.runInContext("window.UT.PetModelRegistry.register('copper_golem', function(){})", context);
            } catch (error) {
              state.registrationErrors.push(error);
            }
          } else if (mode !== 'missing-registration') {
            try {
              vm.runInContext(read(MODEL_PATH), context, { filename: MODEL_PATH });
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
    add() {},
    traverse() {}
  });
  class Group {
    constructor() { groups++; Object.assign(this, node()); }
  }
  const helpers = {
    bx(parent) { const result = node(); parent.add(result); return result; },
    gp(parent) { const result = node(); parent.add(result); return result; },
    eye(parent) { const result = node(); parent.add(result); return result; },
    rate() { return () => {}; },
    pick(values) { return values[0]; },
    rr(min) { return min; }
  };
  return {
    context: { THREE: { Group }, helpers, emit() { emitted++; } },
    stats: () => ({ groups, emitted })
  };
}

test('allowlist contains all seven keys and only Forest Pup is externally active', () => {
  const { registry } = harness();
  assert.deepStrictEqual(Array.from(registry.keys()), KEYS);
  assert.deepStrictEqual(KEYS.filter(key => registry.hasModule(key)), ['forest_pup']);
  KEYS.forEach(key => assert.strictEqual(registry.isKnownKey(key), true, key));
  const source = read(REGISTRY_PATH);
  KEYS.forEach(key => assert.ok(source.includes(key + ":{url:'data/inventory/pet/" + key + "/model.js'"), key));
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

test('a module that registers a different key is rejected', async () => {
  const { registry, state } = harness('wrong-key');
  await assert.rejects(registry.load('forest_pup'), /did not register the requested key/);
  assert.strictEqual(state.registrationErrors.length, 1);
});

test('only Forest Pup is extracted; the six remaining builders stay inline', () => {
  const viewer = read(VIEWER_PATH), model = read(MODEL_PATH);
  assert.ok(!viewer.includes('function petPup('));
  assert.ok(viewer.includes("id:'forest_pup'") && viewer.includes("color:'#6fd05a',build:null"));
  ['petGolem', 'petAxolotl', 'petOwl', 'petWolf', 'petDragon', 'petKitsune'].forEach(name => {
    assert.ok(viewer.includes('function ' + name + '()'), name);
  });
  assert.ok(model.includes('function buildForestPup(context)'));
});

test('script load errors reject explicitly', async () => {
  const { registry, state } = harness('load-error');
  await assert.rejects(registry.load('forest_pup'), /Failed to load Pet model module/);
  assert.strictEqual(state.appends, 1);
});

test('a later selection invalidates an older Forest Pup load before its builder can run', async () => {
  const { registry } = harness(), guard = registry.createSelectionGuard();
  const stale = guard.begin(), pending = registry.load('forest_pup'), latest = guard.begin();
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
  assert.ok(viewer.includes('window.PetViewer={\n  select(id){'));
  assert.ok(viewer.includes("console.error('[PetViewer] Failed to load or build '+d.id+'.',error)"));
});

test('Pet audio remains manifest and ItemRegistry-backed, not duplicated in the model registry', () => {
  const viewer = read(VIEWER_PATH), registry = read(REGISTRY_PATH), model = read(MODEL_PATH);
  assert.ok(viewer.includes("IR.shared().getItem('pet.'+id)"));
  assert.ok(viewer.includes('m&&m.assets&&m.assets.sfx'));
  assert.ok(!/assets\.sfx|assets\/sfx/.test(registry));
  assert.ok(!/assets\.sfx|assets\/sfx/.test(model));
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
