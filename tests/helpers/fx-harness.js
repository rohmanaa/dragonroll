const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', '..');

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

function harness(options) {
  options = options || {};
  let motion = !!options.reducedMotion;
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
    navigator: Object.assign({ userAgent: 'Desktop', deviceMemory: 4, hardwareConcurrency: 4 }, options.navigator || {}),
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
      this.scale = { x: 1, y: 1, z: 1, setScalar(value) { this.x = this.y = this.z = value; this.value = value; }, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    }
  }
  const THREE = {
    BoxGeometry: Geometry,
    RingGeometry: Geometry,
    CircleGeometry: Geometry,
    DoubleSide: 2,
    AdditiveBlending: 2,
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
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/gameplay/js/fx.js'), 'utf8'), context, { filename: 'src/gameplay/js/fx.js' });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/gameplay/js/particle-fx.js'), 'utf8'), context, { filename: 'src/gameplay/js/particle-fx.js' });
  return { FX: window.UT.GameplayFX, ParticleFX: window.UT.ParticleFX, window, document, scene, windowListeners, timers, setMotion: value => { motion = !!value; } };
}

module.exports = { harness, FakeNode };

