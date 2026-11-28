/* UT.SharedGL: satu renderer untuk seluruh sesi; state direset tiap acquire; release melepas kanvas; konteks hilang memberi tahu pemilik. */
const assert = require('assert');
const path = require('path');
const SGL = require(path.join(__dirname, '..', 'src/core/shared-gl.js'));
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

function fakeEnv() {
  const made = [];
  function Canvas() {
    const attrs = {}, ls = {};
    return {
      width: 300, height: 150, id: '', className: '', parentNode: null,
      setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return k in attrs ? attrs[k] : null; }, removeAttribute(k) { delete attrs[k]; },
      addEventListener(type, fn) { ls[type] = fn; }, _fire(type) { if (ls[type]) ls[type]({ preventDefault() {} }); },
      _attrs: attrs
    };
  }
  function Renderer(o) {
    const r = {
      opts: o, toneMapping: 0, toneMappingExposure: 1, outputColorSpace: 'srgb', sortObjects: true, localClippingEnabled: false,
      autoClear: true, shadowMap: { enabled: false, type: 0 }, calls: [], ratio: 0,
      setClearColor(c, a) { r.clearColor = [c, a]; }, setScissorTest(v) { r.scissor = v; }, setViewport() {}, setRenderTarget(x) { r.rt = x; },
      setPixelRatio(v) { r.ratio = v; }, clear() { r.calls.push('clear'); }, renderLists: { dispose() { r.calls.push('lists'); } }
    };
    made.push(r); return r;
  }
  const THREE = { WebGLRenderer: Renderer, PCFSoftShadowMap: 2 };
  const document = { createElement() { return Canvas(); } };
  const G = { devicePixelRatio: 2, navigator: { maxTouchPoints: 0, userAgent: 'Desktop' } };
  return { THREE, document, G, made, Canvas };
}
function pageCanvas(Canvas, id) {
  const c = Canvas(); c.id = id; c.className = 'cls';
  const par = { replaceChild(nw, old) { nw.parentNode = par; old.parentNode = null; par.child = nw; } };
  c.parentNode = par; c.setAttribute('style', 'width:10px'); return c;
}

t('acquire membuat renderer sekali dan memakainya ulang', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  const a = gl.acquire('lobby'); gl.release('lobby');
  const b = gl.acquire('karakter');
  assert.strictEqual(a.renderer, b.renderer);
  assert.strictEqual(e.made.length, 1);
  assert.strictEqual(gl.stats().created, 1);
});
t('antialias mati di HP, hidup di desktop', () => {
  const e = fakeEnv(); e.G.navigator = { maxTouchPoints: 5, userAgent: 'Android Mobi' };
  SGL.create(e).acquire('a');
  assert.strictEqual(e.made[0].opts.antialias, false);
  const d = fakeEnv(); SGL.create(d).acquire('a');
  assert.strictEqual(d.made[0].opts.antialias, true);
});
t('acquire mereset state yang diubah halaman sebelumnya', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  const r = gl.acquire('lobby').renderer;
  r.toneMapping = 4; r.autoClear = false; r.shadowMap.enabled = true; r.setScissorTest(true); r.sortObjects = false;
  gl.release('lobby');
  gl.acquire('karakter', { shadows: false });
  assert.strictEqual(r.toneMapping, 0); assert.strictEqual(r.autoClear, true);
  assert.strictEqual(r.scissor, false); assert.strictEqual(r.sortObjects, true);
  assert.strictEqual(r.shadowMap.enabled, false);
  assert.deepStrictEqual(r.clearColor, [0x000000, 0]);
});
t('satu pemilik pada satu waktu: acquire baru melepas pemilik lama', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  gl.acquire('lobby'); assert.strictEqual(gl.owner(), 'lobby');
  gl.acquire('karakter'); assert.strictEqual(gl.owner(), 'karakter');
  assert.strictEqual(gl.stats().releases, 1);
});
t('release hanya berlaku untuk pemilik; membuang daftar render dan kanvas', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  const { renderer, canvas } = gl.acquire('lobby');
  assert.strictEqual(gl.release('lain'), false);
  assert.strictEqual(gl.owner(), 'lobby');
  assert.strictEqual(gl.release('lobby'), true);
  assert.strictEqual(gl.owner(), null);
  assert.ok(renderer.calls.includes('lists') && renderer.calls.includes('clear'));
  assert.strictEqual(canvas.id, '');
});
t('kanvas halaman diganti kanvas bersama dengan id/kelas/style disalin', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  const pc = pageCanvas(e.Canvas, 'gl3d'), par = pc.parentNode;
  const { canvas } = gl.acquire('lobby', { canvas: pc });
  assert.strictEqual(canvas.id, 'gl3d'); assert.strictEqual(canvas.className, 'cls');
  assert.strictEqual(canvas.getAttribute('style'), 'width:10px');
  assert.strictEqual(par.child, canvas);
});
t('konteks hilang/pulih memanggil callback pemilik aktif saja', () => {
  const e = fakeEnv(), gl = SGL.create(e); let lost = 0, rest = 0;
  const { canvas } = gl.acquire('lobby', { onContextLost() { lost++; }, onContextRestored() { rest++; } });
  canvas._fire('webglcontextlost'); canvas._fire('webglcontextrestored');
  assert.deepStrictEqual([lost, rest], [1, 1]);
  gl.release('lobby'); canvas._fire('webglcontextlost');
  assert.strictEqual(lost, 1);
  assert.deepStrictEqual([gl.stats().lost, gl.stats().restored], [2, 1]);
});
t('offscreen dibuat sekali dan dipakai ulang', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  assert.strictEqual(gl.offscreen(), gl.offscreen());
  assert.strictEqual(e.made[0].opts.preserveDrawingBuffer, true);
});
t('setQuality membatasi pixel ratio dan shadow', () => {
  const e = fakeEnv(), gl = SGL.create(e);
  gl.setQuality({ maxPixelRatio: 1.5, shadows: false });
  const r = gl.acquire('a').renderer;
  assert.strictEqual(r.ratio, 1.5); assert.strictEqual(r.shadowMap.enabled, false);
});
t('acquire tanpa owner atau tanpa THREE melempar error', () => {
  assert.throws(() => SGL.create(fakeEnv()).acquire(''));
  assert.throws(() => SGL.create({ THREE: {}, document: {}, G: {} }).acquire('a'));
});
console.log(n + ' tes lulus');

