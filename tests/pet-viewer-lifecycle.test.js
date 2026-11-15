const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'assets/js/renderers/pet-viewer.js'), 'utf8');
const rafs = new Map(), timeouts = new Map(), fetches = [], scenes = [], renderers = [], observers = [], audioContexts = [], bufferSources = [];
const windowListeners = new Map(), canvasListeners = new Map();
const runtimeErrors = [];
let nextId = 0, glowTexture;
const context2d = { createRadialGradient() { return { addColorStop() {} }; }, fillRect() {} };
const view = { clientWidth: 800, clientHeight: 450, insertAdjacentHTML() {} };
const canvas = {
  setAttribute() {},
  setPointerCapture() {},
  addEventListener(type, fn) { canvasListeners.set(type, fn); },
  removeEventListener(type) { canvasListeners.delete(type); }
};

class Color { set(value) { this.value = value; } }
class Scene {
  constructor() { this.children = []; scenes.push(this); }
  add(child) { this.children.push(child); }
  remove(child) { this.children = this.children.filter(value => value !== child); }
}
class Camera {
  constructor() { this.position = { set() {} }; this.fov = 40; }
  updateProjectionMatrix() {}
  lookAt() {}
}
class Light {
  constructor() { this.position = { set() {} }; this.color = new Color(); }
}
class BufferGeometry {
  constructor() { this.attributes = {}; this.disposed = false; }
  setAttribute(key, value) { this.attributes[key] = value; }
  dispose() { this.disposed = true; }
}
class BufferAttribute { constructor(array) { this.array = array; } }
class ShaderMaterial {
  constructor() { this.disposed = false; }
  dispose() { this.disposed = true; }
}
class Points {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; }
}
class CanvasTexture {
  constructor() { this.disposed = false; glowTexture = this; }
  dispose() { this.disposed = true; }
}
class Renderer {
  constructor() { this.domElement = { height: 600 }; this.disposed = false; this.contextLost = false; renderers.push(this); }
  setPixelRatio() {}
  setClearColor() {}
  setSize(width, height) { this.domElement.height = height; }
  render() {}
  dispose() { this.disposed = true; }
  forceContextLoss() { this.contextLost = true; }
}
class ResizeObserver {
  constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
  observe() {}
  disconnect() { this.disconnected = true; }
}
class AudioContext {
  constructor() { this.state = 'running'; this.destination = {}; this.sampleRate = 44100; this.closed = false; audioContexts.push(this); }
  createDynamicsCompressor() { return { connect() {} }; }
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  createBufferSource() {
    const source = { started: false, stopped: false, disconnected: false, connect() {}, start() { this.started = true; },
      stop() { this.stopped = true; }, disconnect() { this.disconnected = true; } };
    bufferSources.push(source);
    return source;
  }
  decodeAudioData(buffer, done) { done({ buffer }); }
  close() { this.closed = true; return Promise.resolve(); }
}
class Group {
  constructor() {
    this.scale = { setScalar() {} };
  }
  traverse(fn) { fn({ geometry: this.geometry, material: this.material }); }
}

const manifests = new Map();
const registry = {
  createSelectionGuard() {
    let generation = 0;
    return { begin() { return ++generation; }, isCurrent(token) { return token === generation; } };
  },
  hasModule() { return true; },
  load(key) {
    return new Promise((resolve, reject) => {
      manifests.set(key, { resolve, reject });
    });
  }
};
const window = {
  devicePixelRatio: 1,
  ItemCatalog: {
    items: ['forest_pup', 'copper_golem', 'crystal_axolotl', 'arcane_owl', 'storm_wolf', 'inferno_dragon', 'celestial_kitsune']
      .map((gameKey, tier) => ({ kind: 'pet', gameKey, tier: tier + 1, name: gameKey, accent: '#ffffff' }))
  },
  UT: {
    PetModelRegistry: registry,
    ItemRegistry: {
      shared() {
        return { getItem(id) {
          const key = id.slice('pet.'.length);
          return { assets: { sfx: [0, 1, 2].map(n => 'data/inventory/pet/' + key + '/sfx/' + n + '.mp3') } };
        } };
      }
    },
    Prefs: { get() { return 100; } },
    Audio: { isMuted() { return false; } }
  },
  PlayerData: { settings() { return { sound: true }; } },
  AudioContext,
  matchMedia() { return { matches: true }; },
  addEventListener(type, fn) { windowListeners.set(type, fn); },
  removeEventListener(type) { windowListeners.delete(type); }
};
window.window = window;
const document = {
  createElement() { return { getContext() { return context2d; } }; },
  getElementById(id) { return id === 'fpv' ? view : canvas; }
};
const THREE = {
  WebGLRenderer: Renderer,
  CanvasTexture,
  Scene,
  PerspectiveCamera: Camera,
  HemisphereLight: Light,
  DirectionalLight: Light,
  PointLight: Light,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Points,
  Color,
  AdditiveBlending: 1
};
const context = vm.createContext({
  window, document, THREE, ResizeObserver, AbortController, Promise, Math, Date,
  performance: { now() { return 0; } },
  matchMedia: window.matchMedia,
  requestAnimationFrame(fn) { const id = ++nextId; rafs.set(id, fn); return id; },
  cancelAnimationFrame(id) { rafs.delete(id); },
  setTimeout(fn) { const id = ++nextId; timeouts.set(id, fn); return id; },
  clearTimeout(id) { timeouts.delete(id); },
  console: { error(...args) { runtimeErrors.push(args); }, warn() {} },
  fetch(url, options) {
    return new Promise((resolve, reject) => {
      fetches.push({ url, options, resolve, reject });
    });
  }
});

vm.runInContext(source, context, { filename: 'assets/js/renderers/pet-viewer.js' });

function model() {
  const geometry = { disposed: false, dispose() { this.disposed = true; } };
  const material = { disposed: false, dispose() { this.disposed = true; } };
  const root = {
    geometry, material, scale: { setScalar() {} },
    traverse(fn) { fn({ geometry, material }); }
  };
  return { root, geometry, material, cam: { y: 1, d: 6 }, tick() {}, burst() {} };
}
function flush() { return Promise.resolve().then(() => Promise.resolve()); }
function resolveBuilder(key, result, stats) {
  manifests.get(key).resolve(() => { if (stats) stats.built++; return result; });
}

(async () => {
  assert.strictEqual(typeof window.PetViewer.select, 'function');
  assert.strictEqual(typeof window.PetViewer.destroy, 'function');
  assert.strictEqual(rafs.size, 1);
  assert.strictEqual(observers.length, 1);

  windowListeners.get('pointerdown')();
  fetches.forEach(request => request.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  await flush();
  const first = model();
  window.PetViewer.select('forest_pup');
  resolveBuilder('forest_pup', first);
  await flush();
  assert.ok(scenes[0].children.includes(first.root));
  assert.ok(timeouts.size > 0);

  window.PetViewer.select('copper_golem');
  manifests.get('copper_golem').reject(new Error('simulated model load failure'));
  await flush();
  assert.ok(scenes[0].children.includes(first.root), 'failed load must keep the previous model visible');
  assert.strictEqual(first.geometry.disposed, false);
  assert.strictEqual(first.material.disposed, false);

  window.PetViewer.select('copper_golem');
  const second = model();
  resolveBuilder('copper_golem', second);
  await flush();
  assert.ok(scenes[0].children.includes(second.root));
  assert.strictEqual(scenes[0].children.includes(first.root), false);
  assert.strictEqual(first.geometry.disposed, true);
  assert.strictEqual(first.material.disposed, true);

  const sourceTimer = Array.from(timeouts.entries()).pop();
  if (sourceTimer) { timeouts.delete(sourceTimer[0]); sourceTimer[1](); }
  assert.ok(bufferSources.some(source => source.started));

  const stale = { built: 0 };
  window.PetViewer.select('crystal_axolotl');
  window.PetViewer.destroy();
  resolveBuilder('crystal_axolotl', model(), stale);
  await flush();
  assert.strictEqual(stale.built, 0, 'a pending model must not build after teardown');

  assert.strictEqual(rafs.size, 0);
  assert.strictEqual(observers[0].disconnected, true);
  assert.strictEqual(canvasListeners.size, 0);
  assert.strictEqual(windowListeners.size, 0);
  assert.strictEqual(timeouts.size, 0);
  assert.strictEqual(second.geometry.disposed, true);
  assert.strictEqual(second.material.disposed, true);
  assert.strictEqual(renderers[0].disposed, true);
  assert.strictEqual(renderers[0].contextLost, true);
  assert.strictEqual(audioContexts[0].closed, true);
  assert.strictEqual(glowTexture.disposed, true);
  assert.ok(bufferSources.some(source => source.stopped && source.disconnected));
  assert.strictEqual(runtimeErrors.length, 1, 'model load failure must be reported');
  assert.strictEqual(fetches.length, 21);
  console.log('PASS PetViewer preserves active models on load failure and tears down runtime resources');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
