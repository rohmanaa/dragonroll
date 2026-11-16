const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

class FakeNode {
  constructor(tag, document, fragment) {
    this.tagName = tag;
    this.ownerDocument = document;
    this.isFragment = !!fragment;
    this.children = [];
    this.parentNode = null;
    this.id = '';
    this.className = '';
    this.attributes = {};
    this.listeners = Object.create(null);
    this.style = { setProperty(name, value) { this[name] = value; } };
    const node = this;
    this.classList = {
      contains(name) { return node.className.split(/\s+/).indexOf(name) >= 0; },
      add(name) { if (!this.contains(name)) node.className = (node.className + ' ' + name).trim(); },
      remove(name) { node.className = node.className.split(/\s+/).filter(item => item && item !== name).join(' '); },
      toggle(name, force) {
        const enabled = force === undefined ? !this.contains(name) : !!force;
        if (enabled) this.add(name); else this.remove(name);
        return enabled;
      }
    };
  }
  get isConnected() { return this === this.ownerDocument.body || !!(this.parentNode && this.parentNode.isConnected); }
  get childElementCount() { return this.children.length; }
  get textContent() { return this.children.map(node => node.textContent).join(''); }
  set textContent(value) {
    if (value) return;
    this.children.slice().forEach(child => this.removeChild(child));
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  appendChild(child) {
    if (child.isFragment) {
      child.children.slice().forEach(node => this.appendChild(node));
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }
  addEventListener(type, listener) {
    (this.listeners[type] || (this.listeners[type] = [])).push(listener);
  }
  removeEventListener(type, listener) {
    const list = this.listeners[type] || [];
    const index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
  }
  dispatch(type, event) {
    (this.listeners[type] || []).slice().forEach(listener => listener(Object.assign({ type, target: this }, event || {})));
  }
  querySelectorAll(selector) {
    const result = [];
    const className = selector.charAt(0) === '.' ? selector.slice(1) : '';
    const visit = node => node.children.forEach(child => {
      if (className && child.classList.contains(className)) result.push(child);
      visit(child);
    });
    visit(this);
    return result;
  }
}

function harness() {
  let motion = false;
  let timerSequence = 0;
  const timers = new Map();
  const document = {
    hidden: false,
    listeners: Object.create(null),
    createElement(tag) { return new FakeNode(tag, document, false); },
    createDocumentFragment() { return new FakeNode('#fragment', document, true); },
    getElementById(id) {
      const visit = node => {
        if (node.id === id) return node;
        for (const child of node.children) {
          const found = visit(child);
          if (found) return found;
        }
        return null;
      };
      return visit(document.body);
    },
    addEventListener(type, listener) { (this.listeners[type] || (this.listeners[type] = [])).push(listener); },
    removeEventListener(type, listener) {
      const list = this.listeners[type] || [], index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, event) { (this.listeners[type] || []).slice().forEach(listener => listener(Object.assign({ type, target: this }, event || {}))); }
  };
  document.body = new FakeNode('body', document, false);
  const windowListeners = Object.create(null);
  const window = {
    UT: {},
    document,
    navigator: { userAgent: 'Desktop', deviceMemory: 4, hardwareConcurrency: 4 },
    CSS: { supports() { return true; } },
    matchMedia() { return { get matches() { return motion; } }; },
    setTimeout(callback) { const id = ++timerSequence; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, listener) { (windowListeners[type] || (windowListeners[type] = [])).push(listener); },
    removeEventListener(type, listener) {
      const list = windowListeners[type] || [], index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, event) { (windowListeners[type] || []).slice().forEach(listener => listener(Object.assign({ type }, event || {}))); },
    console: { warn() {} }
  };
  class Geometry { dispose() { this.disposeCount = (this.disposeCount || 0) + 1; } }
  class Material {
    constructor(options) { Object.assign(this, options || {}); }
    dispose() { this.disposeCount = (this.disposeCount || 0) + 1; }
  }
  class Vector3 {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = { setScalar(value) { this.value = value; } };
    }
  }
  const THREE = {
    BoxGeometry: Geometry,
    MeshLambertMaterial: Material,
    MeshBasicMaterial: Material,
    Mesh,
    Vector3
  };
  window.THREE = THREE;
  const scene = {
    children: [],
    add(item) { item.parent = this; this.children.push(item); },
    remove(item) {
      const index = this.children.indexOf(item);
      if (index >= 0) this.children.splice(index, 1);
      if (item.parent === this) item.parent = null;
    }
  };
  const context = { window, document, THREE, console: window.console, Number, Math, isFinite, Set, Array };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'gameplay/js/fx.js'), 'utf8'), context, { filename: 'gameplay/js/fx.js' });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'gameplay/js/particle-fx.js'), 'utf8'), context, { filename: 'gameplay/js/particle-fx.js' });
  return { FX: window.UT.GameplayFX, ParticleFX: window.UT.ParticleFX, window, document, scene, windowListeners, timers };
}

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
  const overlay = fs.readFileSync(path.join(root, 'assets/js/renderers/power-3d/power-overlay.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'assets/js/renderers/power-3d/power-renderer.js'), 'utf8');
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
