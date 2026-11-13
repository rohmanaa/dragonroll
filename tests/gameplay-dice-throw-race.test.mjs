import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function createHarness(withKit) {
  let now = 0, nextTimer = 1;
  const timers = new Map(), scene = { children: [], add(node) { this.children.push(node); } };
  const clock = {
    setTimeout(fn, delay) {
      const id = nextTimer++;
      timers.set(id, { at: now + (delay || 0), fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      now += ms;
      let next;
      while ((next = [...timers.entries()].find(([, timer]) => timer.at <= now))) {
        timers.delete(next[0]);
        next[1].fn();
      }
    }
  };
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    normalize() { return this; }
    project() { return this; }
  }
  class Quaternion {
    setFromUnitVectors() { return this; }
    setFromAxisAngle() { return this; }
    setFromEuler() { return this; }
    multiply() { return this; }
    premultiply() { return this; }
    copy() { return this; }
    slerp() { return this; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new Vector3();
      this.quaternion = new Quaternion();
      this.rotation = { x: 0 };
      this.scale = { setScalar() {} };
      this.visible = true;
    }
  }
  const THREE = {
    Vector3, Quaternion, Euler: class {},
    BoxGeometry: class {}, CircleGeometry: class {},
    MeshLambertMaterial: class { constructor(opts) { Object.assign(this, opts); } },
    MeshBasicMaterial: class { constructor(opts) { Object.assign(this, opts); } },
    Mesh, CanvasTexture: class {}
  };
  const context2d = new Proxy({}, { set: () => true, get: () => () => {} });
  let stage;
  const animations = [];
  const doc = {
    body: { appendChild(node) { stage = node; node.isConnected = true; } },
    createElement(tag) {
      if (tag === 'canvas') return { getContext: () => context2d, toDataURL: () => '' };
      return {
        style: {}, setAttribute() {},
        animate(frames, options) {
          const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
          animations.push(animation);
          return animation;
        },
        getAnimations() { return animations.filter(animation => !animation.cancelled); }
      };
    },
    getElementById() { return null; }
  };
  const rollResolvers = [];
  const kit = {
    busy: false,
    setVolume() {}, stop() { this.stopped = true; }, start() { this.stopped = false; },
    roll(value) {
      this.busy = true;
      return new Promise(resolve => rollResolvers.push(() => { this.busy = false; resolve(value); }));
    },
    finish() { if (this.busy) rollResolvers.shift()(); }
  };
  const win = {
    addEventListener() {}, innerWidth: 1280, innerHeight: 720,
    THREE,
    DiceKit: withKit ? { has: () => true, mount: () => kit } : null
  };
  win.window = win;
  const context = vm.createContext({
    window: win, document: doc, THREE, console,
    performance: { now: () => now },
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {}
  });
  vm.runInContext(fs.readFileSync('gameplay/js/dice-throw.js', 'utf8'), context);
  win.UT.GameplayDiceThrow.init(scene);
  return { api: win.UT.GameplayDiceThrow, clock, scene, get stage() { return stage; }, rollResolvers, animations, Vector3 };
}

{
  const h = createHarness(false), pos = new h.Vector3(0, 0, 0);
  const first = h.api.throwFrom(pos, 1, { hold: 1500 });
  h.api.skip();
  await first;
  const second = h.api.throwFrom(pos, 2, { hold: 1500 });
  h.clock.advance(1500);
  assert.equal(h.scene.children[0].visible, true, 'the previous world-die fade must not hide a new throw');
  h.api.skip();
  await second;
}

{
  const h = createHarness(true), pos = new h.Vector3(0, 0, 0);
  const opt = { camera: { position: { x: 0, z: 0 } }, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }, hold: 1800 };
  const first = h.api.throwFrom(pos, 1, opt);
  h.rollResolvers.shift()();
  await first;
  h.clock.advance(1800);
  h.clock.advance(330);
  const fade = h.animations.find(animation => animation.frames.some(frame => frame.opacity === 0));
  assert.ok(fade && fade.cancelled, 'the completed Dice Kit fade must be cancelled so it cannot hide later throws');
  const orphanFade = h.stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
  const second = h.api.throwFrom(pos, 2, opt);
  assert.equal(orphanFade.cancelled, true, 'any stale stage animation must be cancelled before the next throw');
  assert.equal(h.stage.style.opacity, '1', 'a new Dice Kit throw should reset stage opacity');
  assert.equal(h.stage.style.visibility, 'visible', 'the previous Dice Kit fade must not hide a new throw');
  h.rollResolvers.shift()();
  await second;
}

console.log('ok - stale dice fade timers do not hide the next throw');
