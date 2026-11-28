/* UT.PageModule: mount menjalankan body, unmount melepas SEMUA registrasi halaman (timer, interval, rAF, listener, langganan). */
const assert = require('assert');
const path = require('path');
const PM = require(path.join(__dirname, '..', 'src/core/page-module.js'));
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

/* Global tiruan: timer & rAF dikendalikan manual agar tes deterministik. */
function fakeG() {
  let seq = 0;
  const timers = new Map(), frames = new Map(), ints = new Map(), listeners = [];
  const G = {
    console: { error() {} },
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) { const id = ++seq; ints.set(id, fn); return id; },
    clearInterval(id) { ints.delete(id); },
    requestAnimationFrame(fn) { const id = ++seq; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(type, fn) { listeners.push([type, fn]); },
    removeEventListener(type, fn) { const i = listeners.findIndex(l => l[0] === type && l[1] === fn); if (i > -1) listeners.splice(i, 1); },
    _timers: timers, _frames: frames, _ints: ints, _listeners: listeners,
    runTimers() { const l = [...timers]; timers.clear(); l.forEach(([, f]) => f()); },
    runFrames() { const l = [...frames]; frames.clear(); l.forEach(([, f]) => f(16)); },
    runInts() { [...ints.values()].forEach(f => f()); }
  };
  return G;
}
function fakeTarget() {
  const ls = [];
  return { addEventListener(t, f) { ls.push([t, f]); }, removeEventListener(t, f) { const i = ls.findIndex(l => l[0] === t && l[1] === f); if (i > -1) ls.splice(i, 1); }, ls };
}

t('define memanggil mount otomatis bila tidak managed; body dijalankan sekali', () => {
  const pm = PM.create(fakeG()); let runs = 0;
  const inst = pm.define('a', () => { runs++; });
  assert.strictEqual(runs, 1); assert.ok(pm.isMounted('a')); assert.ok(inst && typeof inst.unmount === 'function');
});
t('managed=true: define tidak mount; mount manual', () => {
  const pm = PM.create(fakeG()); pm.managed = true; let runs = 0;
  assert.strictEqual(pm.define('a', () => { runs++; }), null);
  assert.strictEqual(runs, 0); assert.ok(!pm.isMounted('a'));
  pm.mount('a'); assert.strictEqual(runs, 1);
});
t('unmount memanggil disposer dalam urutan terbalik', () => {
  const pm = PM.create(fakeG()); const order = [];
  pm.define('a', env => { env.dispose(() => order.push(1)); env.own(() => order.push(2)); env.dispose(() => order.push(3)); });
  assert.strictEqual(pm.unmount('a'), true); assert.deepStrictEqual(order, [3, 2, 1]);
  assert.strictEqual(pm.unmount('a'), false, 'unmount kedua tidak melakukan apa-apa');
});
t('timeout: berjalan sebelum unmount, tidak berjalan sesudahnya', () => {
  const G = fakeG(), pm = PM.create(G); let fired = 0, late = 0;
  pm.define('a', env => { env.setTimeout(() => fired++, 10); env.setTimeout(() => late++, 20); });
  assert.strictEqual(G._timers.size, 2);
  pm.unmount('a'); assert.strictEqual(G._timers.size, 0, 'timer dibatalkan');
  G.runTimers(); assert.strictEqual(fired + late, 0);
});
t('timeout mengirim argumen tambahan dan clearTimeout bekerja', () => {
  const G = fakeG(), pm = PM.create(G); const got = [];
  pm.define('a', env => { env.setTimeout((x, y) => got.push(x, y), 1, 'p', 'q'); const id = env.setTimeout(() => got.push('x'), 1); env.clearTimeout(id); });
  G.runTimers(); assert.deepStrictEqual(got, ['p', 'q']);
});
t('interval berhenti setelah unmount', () => {
  const G = fakeG(), pm = PM.create(G); let c = 0;
  pm.define('a', env => { env.setInterval(() => c++, 5); });
  G.runInts(); assert.strictEqual(c, 1);
  pm.unmount('a'); assert.strictEqual(G._ints.size, 0); G.runInts(); assert.strictEqual(c, 1);
});
t('loop rAF yang menjadwal ulang dirinya berhenti setelah unmount', () => {
  const G = fakeG(), pm = PM.create(G); let ticks = 0;
  pm.define('a', env => { (function loop() { env.requestAnimationFrame(loop); ticks++; })(); });
  assert.strictEqual(ticks, 1); G.runFrames(); G.runFrames(); assert.strictEqual(ticks, 3);
  pm.unmount('a'); assert.strictEqual(G._frames.size, 0, 'rAF tertunda dibatalkan');
  G.runFrames(); assert.strictEqual(ticks, 3, 'tidak ada tick baru');
});
t('rAF yang sudah dijadwalkan lalu callback-nya berjalan setelah dead tidak memanggil fungsi', () => {
  const G = fakeG(), pm = PM.create(G); let c = 0, cb;
  pm.define('a', env => { env.requestAnimationFrame(() => c++); });
  cb = [...G._frames.values()][0]; pm.unmount('a'); cb(1); assert.strictEqual(c, 0);
});
t('addEventListener (window) dan on(target) dilepas saat unmount; removeEventListener manual juga bekerja', () => {
  const G = fakeG(), pm = PM.create(G), doc = fakeTarget(); const h = () => {};
  pm.define('a', env => { env.addEventListener('resize', h); env.addEventListener('x', () => {}); env.on(doc, 'visibilitychange', h); env.removeEventListener('x', env._ignore); });
  assert.strictEqual(G._listeners.length, 2); assert.strictEqual(doc.ls.length, 1);
  pm.unmount('a'); assert.strictEqual(G._listeners.length, 0); assert.strictEqual(doc.ls.length, 0);
});
t('on() mengembalikan fungsi pelepas yang melepas satu listener', () => {
  const G = fakeG(), pm = PM.create(G), doc = fakeTarget(); let off;
  pm.define('a', env => { off = env.on(doc, 'click', () => {}); });
  assert.strictEqual(doc.ls.length, 1); off(); assert.strictEqual(doc.ls.length, 0);
  pm.unmount('a');
});
t('own() memanggil fungsi berhenti-langganan saat unmount (mis. UT.Events.on, PD.subscribe)', () => {
  const pm = PM.create(fakeG()); let subs = 1;
  pm.define('a', env => { const unsub = () => { subs--; }; assert.strictEqual(env.own(unsub), unsub); });
  pm.unmount('a'); assert.strictEqual(subs, 0);
});
t('own() setelah unmount langsung memanggil pelepas', () => {
  const pm = PM.create(fakeG()); let env0, called = 0;
  pm.define('a', env => { env0 = env; }); pm.unmount('a');
  env0.own(() => called++); assert.strictEqual(called, 1);
});
t('observe() memanggil disconnect saat unmount', () => {
  const pm = PM.create(fakeG()); let dc = 0;
  pm.define('a', env => { env.observe({ disconnect() { dc++; } }); });
  pm.unmount('a'); assert.strictEqual(dc, 1);
});
t('mount dua kali berturut-turut: unmount otomatis dulu, tidak ada registrasi ganda', () => {
  const G = fakeG(), pm = PM.create(G); let disposed = 0;
  pm.managed = true; pm.define('a', env => { env.setInterval(() => {}, 1); env.dispose(() => disposed++); });
  pm.mount('a'); pm.mount('a'); assert.strictEqual(disposed, 1); assert.strictEqual(G._ints.size, 1);
});
t('error di body: registrasi sebagian dibersihkan, error diteruskan, modul tidak tercatat mounted', () => {
  const G = fakeG(), pm = PM.create(G); let disposed = 0;
  assert.throws(() => pm.define('a', env => { env.setInterval(() => {}, 1); env.dispose(() => disposed++); throw new Error('boom'); }), /boom/);
  assert.strictEqual(disposed, 1); assert.strictEqual(G._ints.size, 0); assert.ok(!pm.isMounted('a'));
});
t('error di satu disposer tidak menghentikan disposer lain', () => {
  const pm = PM.create(fakeG()); let ok = 0;
  pm.define('a', env => { env.dispose(() => { ok++; }); env.dispose(() => { throw new Error('x'); }); env.dispose(() => { ok++; }); });
  pm.unmount('a'); assert.strictEqual(ok, 2);
});
t('modul berbeda tidak saling mengganggu', () => {
  const G = fakeG(), pm = PM.create(G); pm.managed = true; let a = 0, b = 0;
  pm.define('a', env => { env.setInterval(() => a++, 1); }); pm.define('b', env => { env.setInterval(() => b++, 1); });
  pm.mount('a'); pm.mount('b'); pm.unmount('a'); G.runInts(); assert.strictEqual(a, 0); assert.strictEqual(b, 1);
});
t('mount modul yang tidak dikenal melempar error', () => {
  assert.throws(() => PM.create(fakeG()).mount('zzz'), /tidak dikenal/);
});

console.log(n + ' tes lulus');

