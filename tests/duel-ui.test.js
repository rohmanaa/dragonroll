const assert = require('assert');
const THREE = require('../assets/js/vendor/three.min.js');

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.hidden = false;
    this.attributes = {};
    this.listeners = {};
    this.className = '';
    this.textContent = '';
    this.style = { setProperty() {} };
    this.classList = {
      add: (...names) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); names.forEach(name => set.add(name)); this.className = [...set].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => name && !names.includes(name)).join(' '); }
    };
  }
  appendChild(element) { element.parentNode = this; this.children.push(element); return element; }
  get innerHTML() { return this._innerHTML || ''; }
  set innerHTML(value) {
    this._innerHTML = value;
    if (value === '') { this.children.forEach(element => { element.parentNode = null; }); this.children = []; }
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  getBoundingClientRect() { return { width: 640, height: 360 }; }
  click() { if (this.listeners.click) this.listeners.click(); }
}

class Renderer {
  constructor() { this.domElement = new Element('canvas'); this.loops = []; this.sizes = []; this.shadowMap = { enabled: false, type: null }; }
  setPixelRatio(value) { this.pixelRatio = value; }
  setClearColor() {}
  setSize(width, height) { this.sizes.push([width, height]); }
  setAnimationLoop(callback) { this.loops.push(callback); this.loop = callback; }
  render() {}
}
THREE.WebGLRenderer = Renderer;

function find(element, className) {
  if (element.className.split(/\s+/).includes(className)) return element;
  for (const child of element.children) { const result = find(child, className); if (result) return result; }
  return null;
}
function findAll(element, className, results) {
  results = results || [];
  if (element.className.split(/\s+/).includes(className)) results.push(element);
  element.children.forEach(child => findAll(child, className, results));
  return results;
}

let fighterGroundY = () => 0;
async function run() {
  const body = new Element('body'), knightCreated = [], listeners = {};
  body.classList.add('app');

  /* Minimal POSES for PvpKnight mock */
  const GUARD_POSE = { body: { rx: 0, ry: 0, rz: 0 } };
  const mockPoses = {
    guard: GUARD_POSE, block: GUARD_POSE, hurt: GUARD_POSE, dodge: GUARD_POSE,
    win: GUARD_POSE, ko: GUARD_POSE, holy: GUARD_POSE, smite: GUARD_POSE,
    atk: [GUARD_POSE, GUARD_POSE]
  };

  global.window = {
    UT: {}, THREE, innerWidth: 640, innerHeight: 360, devicePixelRatio: 2,
    addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener(name) { delete listeners[name]; }
  };
  global.document = { body, createElement: tag => new Element(tag) };

  /* Mock PvpKnight — takes priority over BlockyCharacter */
  window.UT.PvpKnight = {
    POSES: mockPoses,
    RIVAL_PAL: { body: 0xff0000 },
    createKnight(THREE, opts) {
      const kn = {
        root: new THREE.Group(), cape2: null,
        setFlash() {}, setGlow() {}, dispose() {}
      };
      knightCreated.push({ kn, opts });
      return kn;
    },
    newPose() { return Object.assign({}, GUARD_POSE); },
    sample(keys, u) { return GUARD_POSE; },
    applyPose(kn, cur, tgt, dt, rate) {}
  };

  /* Karakter ASLI pemain/CPU = BlockyCharacter; PvpKnight hanya untuk skin 'ksatria' */
  const blockyCreated = [];
  window.UT.BlockyCharacter = {
    create() {
      const character = {
        root: new THREE.Group(), actions: [], modes: [], config: { outfit: 'equipped' },
        apply(config) { this.appliedConfig = config; },
        loadPreset(preset) { this.preset = preset; },
        loadFromPlayer() { this.loadedPlayer = true; },
        tick() {},
        setMode(mode) { this.modes.push(mode); },
        act(type, duration) { this.actions.push([type, duration]); }
      };
      blockyCreated.push(character);
      return character;
    }
  };
  require('../gameplay/js/duel-ui.js');

  const UI = window.UT.GameplayDuelUI;
  UI.open({
    names: ['Rohman', 'CPU'], css: ['#ff4a54', '#55aaff'],
    faces: ['face-one.webp', 'face-two.webp'], reducedMotion: false,
    fighters: [{ config: { outfit: 'equipped' } }, { preset: 5 }]
  });
  assert.ok(body.className.includes('duel-active'), 'duel mode hides the board HUD');
  assert.strictEqual(knightCreated.length, 0, 'karakter asli pemain/CPU tidak diganti ksatria');
  assert.strictEqual(blockyCreated.length, 2, 'both fighters use their real BlockyCharacter');
  assert.deepStrictEqual(blockyCreated[0].appliedConfig, { outfit: 'equipped' }, 'config pemain dipakai apa adanya');
  assert.strictEqual(blockyCreated[1].preset, 5, 'preset CPU dipakai');
  assert.strictEqual(fighterGroundY(), 0, 'karakter menapak di lantai (y=0)');
  assert.ok(find(body, 'du-scene'), 'the arena includes a dedicated Three.js scene');
  assert.strictEqual(findAll(body, 'du-die-slot').length, 2, 'tiap pemain punya slot dadu 3D di atas panel aksinya');
  assert.strictEqual(findAll(body, 'du-fighter').length, 2, 'both arena fighters have action HUDs');
  assert.strictEqual(find(body, 'du-scene').children[0].tagName, 'canvas');
  const rollButton = find(body, 'du-roll-button');
  assert.ok(rollButton && rollButton.disabled, 'the duel waits for an explicit roll before a round begins');
  const rollWait = UI.waitForRoll(1);
  assert.strictEqual(rollButton.disabled, false);
  rollButton.click();
  assert.strictEqual(await rollWait, true, 'the roll button starts the duel round');
  await UI.revealRolls([2, 5]);
  assert.deepStrictEqual(findAll(body, 'du-die').map(die => die.textContent), ['2', '5'], 'both dice results are shown before combat resolves');
  const intro = UI.intro();
  const skipButton = find(body, 'du-skip');
  assert.strictEqual(skipButton.hidden, false, 'skip animation is available during the duel intro');
  skipButton.click();
  await intro;
  assert.strictEqual(skipButton.hidden, true, 'skip animation closes the intro promptly');

  UI.state([2, 3], [3, 1]);
  assert.ok(find(body, 'du-hp').innerHTML.includes('du-heart on'));
  assert.ok(find(body, 'du-mom').innerHTML.includes('on'));
  UI.actions([4, 6]);
  assert.ok(findAll(body, 'du-action')[0].className.includes('critical'));
  assert.ok(findAll(body, 'du-action')[1].className.includes('berserk'));
  UI.act(0, 'attack', 0.75);
  UI.act(1, 'block', 0.9);
  assert.deepStrictEqual(blockyCreated[0].actions[0], ['attack', 0.75], 'serangan diteruskan ke karakter asli');
  assert.deepStrictEqual(blockyCreated[1].actions[0], ['block', 0.9], 'block diteruskan ke karakter asli');
  UI.act(1, 'sad', 1.8);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(blockyCreated[1].modes.includes('poseDown'), 'yang kalah terpental lalu jatuh (poseDown)');
  UI.impact(1, 'block');
  assert.ok(findAll(body, 'du-fighter')[1].className.includes('block'), 'impact FX are attached to the defending fighter');

  /* skin ksatria memakai rig PvpKnight dengan palet rival untuk pemain kedua */
  UI.open({ names: ['A', 'B'], css: ['#fff', '#fff'], fighters: [{ skin: 'ksatria' }, { skin: 'ksatria' }], reducedMotion: true });
  assert.strictEqual(knightCreated.length, 2, 'skin ksatria memakai rig PvpKnight');
  assert.ok(knightCreated[1].opts && knightCreated[1].opts.palette, 'rival fighter gets RIVAL_PAL palette');
  assert.strictEqual(blockyCreated.length, 2, 'ksatria tidak membuat karakter blocky baru');

  const chooser = UI.chooseOpponent([{ name: 'CPU A' }, { name: 'CPU B' }]);
  const chooserNode = find(body, 'du-choose');
  assert.strictEqual(chooserNode.children.length, 3);
  chooserNode.children[2].click();
  assert.strictEqual(await chooser, 1, 'target selection resolves the chosen opponent');

  /* online: lockRoll mengunci tombol dan melepas janji waitForRoll yang menggantung (hasil false) */
  const lockedWait = UI.waitForRoll(3);
  const lockBtn = find(body, 'du-roll-button');
  assert.strictEqual(lockBtn.disabled, false);
  UI.lockRoll('MENUNGGU LAWAN...');
  assert.strictEqual(lockBtn.disabled, true, 'lockRoll mengunci tombol ROLL');
  assert.strictEqual(await lockedWait, false, 'lockRoll membatalkan penantian ROLL tanpa dianggap tap');

  const cancelledRoll = UI.waitForRoll(2);
  UI.close();
  assert.strictEqual(await cancelledRoll, false, 'closing the duel cancels a pending roll prompt');
  await new Promise(resolve => setTimeout(resolve, 280));
  assert.ok(!body.className.includes('duel-active'), 'closing the duel restores the board HUD');
  assert.strictEqual(window.THREE.WebGLRenderer, Renderer);
  assert.strictEqual(listeners.resize, undefined, 'arena resize listener is removed on close');
  console.log('duel-ui tests passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
