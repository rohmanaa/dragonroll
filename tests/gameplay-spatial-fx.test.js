/* Phase 2 — Spatial FX: lifecycle, cleanup, seed deterministik, kualitas, reduce-motion, dan penyambungan di main.js.
   Node + stub THREE (tanpa WebGL): yang diuji adalah logika/lifecycle, bukan tampilan. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { harness } = require('./helpers/fx-harness');
const root = path.join(__dirname, '..');
const mainSrc = fs.readFileSync(path.join(root, 'src/gameplay/js/main.js'), 'utf8');
const fxSrc = fs.readFileSync(path.join(root, 'src/gameplay/js/fx.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'src/gameplay/css/gameplay.css'), 'utf8');

let count = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const QUALITY_NAV = {
  low: { navigator: { deviceMemory: 2, hardwareConcurrency: 2, userAgent: 'Android Mobile' } },
  medium: { navigator: { deviceMemory: 4, hardwareConcurrency: 4, userAgent: 'Android Mobile' } },
  high: { navigator: { deviceMemory: 6, hardwareConcurrency: 6, userAgent: 'Desktop' } },
  ultra: { navigator: { deviceMemory: 8, hardwareConcurrency: 8, userAgent: 'Desktop' } }
};
const CAP = { low: 120, medium: 220, high: 320, ultra: 450 };
function ready(options) {
  const h = harness(options);
  assert.ok(h.FX.init(h.scene));
  return h;
}
function step(h, seconds, dt) { dt = dt || 1 / 30; for (let t = 0; t < seconds; t += dt) h.FX.updateConfetti(dt); }
const particles = h => h.scene.children.filter(m => m.material && !m.material.transparent).length; /* partikel = materi bersama non-transparan */
const SAMPLE = {
  'tp-gather': { pos: { x: 1, y: 0.2, z: 2 } },
  'tp-depart': { pos: { x: 1, y: 0.2, z: 2 } },
  'tp-trail': { from: { x: 0, y: 0, z: 0 }, to: { x: 3, y: 0, z: 2 } },
  'tp-arrive': { pos: { x: 1, y: 0.2, z: 2 } },
  'tp-recover': { pos: { x: 1, y: 0.2, z: 2 } },
  'tp-residual': { pos: { x: 1, y: 0.2, z: 2 } },
  'hole-fx': { pos: { x: 0, y: 0, z: 0 }, scale: 1, dur: 2.3 },
  portal: { pos: { x: 0, y: 0, z: 0 }, yaw: 0.6, idle: 1 },
  'portal-entry': { pos: { x: 0, y: 0, z: 0 }, yaw: 0.6 },
  'portal-exit': { pos: { x: 0, y: 0, z: 0 }, yaw: 0.6 },
  distort: { pos: { x: 0, y: 0, z: 0 }, dir: 1.1 },
  'sword-slash': { pos: { x: 1, y: 0.2, z: 2 }, dir: 0.8, style: 'diagonal' },
  'weapon-charge': { pos: { x: 1, y: 0.2, z: 2 }, dur: 1.2 },
  'weapon-trail': { pos: { x: 1, y: 0.2, z: 2 }, style: 'heavy' },
  'weapon-release': { pos: { x: 1, y: 0.2, z: 2 }, style: 'heavy' },
  'combat-projectile': { from: { x: 0, y: 1, z: 0 }, to: { x: 2, y: 2, z: -1 }, dur: 0.4, style: 'charged' },
  'combat-impact': { pos: { x: 1, y: 0.2, z: 2 }, style: 'heavy' },
  'combat-defense': { pos: { x: 1, y: 0.2, z: 2 }, dir: 0.8, style: 'shield' },
  'buff-feedback': { pos: { x: 1, y: 0.2, z: 2 }, hy: 0.65, style: 'activate' },
  'reward-burst': { pos: { x: 1, y: 0.2, z: 2 }, style: 'reveal', fid: 'test-reward', seed: 7 },
  'environment-ambient': { pos: { x: 1, y: 0.2, z: 2 }, style: 'world', fid: 'test-ambient', seed: 8 },
  'world-transition': { pos: { x: 1, y: 0.2, z: 2 }, style: 'nether', fid: 'test-transition', seed: 9 },
  'result-dissolve': { pos: { x: 1, y: 0.2, z: 2 }, style: 'defeat', fid: 'test-result', seed: 10 }
};

test('semua kind Spatial FX terdaftar dan dapat dibuat', () => {
  const h = ready();
  assert.deepStrictEqual(Object.keys(h.FX.spatialKinds).sort(), Object.keys(SAMPLE).sort());
  Object.keys(SAMPLE).forEach(kind => { assert.ok(h.FX.spatial(kind, SAMPLE[kind]), kind + ' gagal dibuat'); });
  assert.strictEqual(h.FX.spatial('tidak-ada', {}), null, 'kind tak dikenal diabaikan');
  assert.strictEqual(h.FX.spatial('tp-trail', { pos: { x: 0, y: 0, z: 0 } }), null, 'trail tanpa tujuan diabaikan');
});

test('tiap efek terlacak (kategori spatial, scope visual) dan selesai alami tanpa sisa', () => {
  Object.keys(SAMPLE).forEach(kind => {
    const h = ready();
    h.FX.spatial(kind, SAMPLE[kind]);
    const active = h.FX.getActive().filter(e => e.metadata.category === 'spatial');
    assert.strictEqual(active.length, 1, kind);
    assert.strictEqual(active[0].metadata.scope, 'visual');
    assert.strictEqual(active[0].state, 'playing');
    step(h, 6);
    assert.strictEqual(h.FX.getActive().length, 0, kind + ': masih ada efek terlacak');
    assert.strictEqual(h.scene.children.length, 0, kind + ': mesh tertinggal di scene');
    const ended = h.FX.getHistory().filter(e => e.category === 'spatial');
    assert.strictEqual(ended.length, 1, kind);
    assert.strictEqual(ended[0].reason, 'completed');
  });
});

test('stop(id) menghentikan satu efek: scene bersih, materi efek di-dispose, idempoten', () => {
  const h = ready();
  const ctl = h.FX.spatial('distort', SAMPLE.distort);
  step(h, 0.5);
  assert.ok(h.scene.children.length > 0);
  const mats = h.scene.children.map(m => m.material).filter(m => m.transparent);
  assert.ok(h.FX.stop(ctl.id, 'tes'));
  assert.strictEqual(h.FX.stop(ctl.id), false);
  assert.strictEqual(h.scene.children.length, 0);
  assert.strictEqual(h.FX.getActive().length, 0);
  mats.forEach(m => assert.strictEqual(m.disposeCount, 1, 'materi efek harus di-dispose tepat sekali'));
  step(h, 3);
  assert.strictEqual(h.scene.children.length, 0, 'tidak ada partikel muncul lagi setelah stop');
});

test('stopAll({scope:"spatial"}) dan stopAll({scope:"visual"}) membersihkan semuanya (Reset)', () => {
  ['spatial', 'visual'].forEach(scope => {
    const h = ready();
    Object.keys(SAMPLE).forEach(kind => h.FX.spatial(kind, SAMPLE[kind]));
    step(h, 0.4);
    assert.ok(h.FX.stopAll({ scope, reason: 'reset' }) > 0);
    assert.strictEqual(h.FX.getActive().length, 0, scope);
    assert.strictEqual(h.scene.children.length, 0, scope);
    step(h, 4);
    assert.strictEqual(h.scene.children.length, 0, scope + ': tidak boleh ada yang muncul lagi');
  });
});

test('tab tersembunyi saat efek aktif menghentikan semua efek spasial', () => {
  const h = ready();
  Object.keys(SAMPLE).forEach(kind => h.FX.spatial(kind, SAMPLE[kind]));
  step(h, 0.3);
  h.document.hidden = true; h.document.dispatch('visibilitychange');
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
});

test('dispose() membersihkan efek aktif dan semua resource bersama; efek baru ditolak', () => {
  const h = ready();
  h.FX.spatial('portal', SAMPLE.portal); h.FX.spatial('hole-fx', SAMPLE['hole-fx']);
  step(h, 0.5);
  const shared = new Set();
  h.scene.children.forEach(m => { shared.add(m.geometry); });
  assert.ok(h.FX.dispose());
  assert.strictEqual(h.scene.children.length, 0);
  assert.strictEqual(h.FX.getActive().length, 0);
  shared.forEach(g => assert.ok(g.disposeCount >= 1, 'geometri bersama harus di-dispose'));
  assert.strictEqual(h.FX.spatial('distort', SAMPLE.distort), null);
});

test('game over / reset di tengah efek tidak meninggalkan timer atau listener', () => {
  const h = ready();
  const before = h.timers.size;
  Object.keys(SAMPLE).forEach(kind => h.FX.spatial(kind, SAMPLE[kind]));
  h.FX.stopAll({ scope: 'visual', reason: 'reset' });
  assert.strictEqual(h.timers.size, before, 'efek spasial tidak memakai timer');
  h.FX.dispose();
  assert.strictEqual((h.windowListeners.pagehide || []).length, 0, 'listener pagehide dilepas');
  assert.strictEqual((h.document.listeners.visibilitychange || []).length, 0, 'listener visibility dilepas');
});

test('seed deterministik: seed sama -> posisi sama; seed beda -> beda; tidak memakai Math.random saat berseed', () => {
  const snap = (seed, kind) => {
    const h = ready();
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random dipakai padahal seed ada'); };
    try { h.FX.spatial(kind, Object.assign({ seed }, SAMPLE[kind])); step(h, 0.3); } finally { Math.random = original; }
    return JSON.stringify(h.scene.children.map(m => [m.position.x, m.position.y, m.position.z].map(v => Math.round(v * 1e6))));
  };
  ['tp-depart', 'tp-arrive', 'tp-trail', 'hole-fx', 'portal', 'distort', 'portal-exit', 'sword-slash', 'combat-projectile', 'combat-impact', 'combat-defense'].forEach(kind => {
    assert.strictEqual(snap(12345, kind), snap(12345, kind), kind + ' seed sama harus identik');
    assert.notStrictEqual(snap(12345, kind), snap(99999, kind), kind + ' seed beda harus berbeda');
  });
});

test('partikel ke-i sama di semua klien walau jumlah total berbeda menurut kualitas', () => {
  const first = quality => {
    const h = ready(QUALITY_NAV[quality]);
    h.FX.spatial('tp-depart', Object.assign({ seed: 777 }, SAMPLE['tp-depart']));
    return h.scene.children.filter(m => !m.material.transparent).slice(0, 4).map(m => [m.position.x, m.position.y, m.position.z]);
  };
  const low = first('low'), ultra = first('ultra');
  low.forEach((p, i) => assert.deepStrictEqual(p, ultra[i], 'partikel ' + i));
});

test('batas partikel aktif per kualitas (Low 120 / Medium 220 / High 320 / Ultra 450) selalu dihormati', () => {
  Object.keys(CAP).forEach(q => {
    const h = ready(QUALITY_NAV[q]);
    assert.strictEqual(h.FX.quality(), q);
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      ['tp-arrive', 'tp-depart', 'tp-gather', 'hole-fx', 'distort', 'portal-exit'].forEach(k => h.FX.spatial(k, Object.assign({ tier: 'L4' }, SAMPLE[k])));
      step(h, 0.05); peak = Math.max(peak, particles(h));
    }
    assert.ok(peak > 0, q + ': harus ada partikel');
    assert.ok(peak <= CAP[q], q + ': puncak ' + peak + ' melebihi ' + CAP[q]);
    step(h, 6);
    assert.strictEqual(h.scene.children.length, 0, q + ': harus bersih setelah selesai');
  });
});

test('tier item L1<L2<L3<L4 menaikkan jumlah partikel (batas kualitas tetap)', () => {
  const counts = ['L1', 'L2', 'L3', 'L4'].map(tier => {
    const h = ready(QUALITY_NAV.high);
    h.FX.spatial('tp-arrive', Object.assign({ tier }, SAMPLE['tp-arrive']));
    return particles(h);
  });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2] && counts[2] < counts[3], counts.join(','));
});

test('Reduce Motion mengurangi partikel dan efek tetap bersih (hidup & berubah saat dijalankan)', () => {
  const run = reduced => {
    const h = ready({ reducedMotion: reduced });
    ['tp-arrive', 'tp-depart', 'hole-fx', 'distort', 'portal'].forEach(k => h.FX.spatial(k, SAMPLE[k]));
    let peak = 0;
    for (let i = 0; i < 40; i++) { step(h, 0.05); peak = Math.max(peak, particles(h)); }
    step(h, 6);
    assert.strictEqual(h.scene.children.length, 0);
    return peak;
  };
  const normal = run(false), reduced = run(true);
  assert.ok(reduced < normal * 0.6, 'reduce ' + reduced + ' vs normal ' + normal);
  const h = ready({ reducedMotion: true });
  h.FX.spatial('hole-fx', SAMPLE['hole-fx']); step(h, 1);
  h.setMotion(false); /* perubahan live tidak boleh membuat error */
  step(h, 3);
  assert.strictEqual(h.scene.children.length, 0);
});

test('tidak ada flash menyilaukan: opacity maksimum semua mesh efek <= 0.9 sepanjang waktu', () => {
  const h = ready({ tier: 'L4' });
  Object.keys(SAMPLE).forEach(k => h.FX.spatial(k, Object.assign({ tier: 'L4' }, SAMPLE[k])));
  let max = 0;
  for (let i = 0; i < 150; i++) { step(h, 0.04); h.scene.children.forEach(m => { if (m.material && m.material.transparent && m.visible !== false) max = Math.max(max, m.material.opacity); }); }
  assert.ok(max > 0 && max <= 0.9, 'opacity puncak ' + max);
});

test('efek mengikuti posisi pion aktual (follow) tanpa menyimpan referensi setelah selesai', () => {
  const h = ready();
  const pawn = { position: { x: 0, y: 0, z: 0 } };
  const ctl = h.FX.spatial('tp-recover', { pos: pawn.position, follow: () => pawn.position });
  step(h, 0.1);
  const start = h.scene.children.filter(m => !m.material.transparent).map(m => m.position.x);
  pawn.position.x = 5;
  step(h, 0.3);
  const after = h.scene.children.filter(m => !m.material.transparent).map(m => m.position.x);
  assert.ok(Math.min.apply(null, after) > Math.max.apply(null, start) + 3, 'partikel harus ikut ke x=5');
  step(h, 3);
  assert.strictEqual(h.scene.children.length, 0);
  assert.ok(ctl.id);
});

test('weapon trail merekam gerak anchor dan cleanup otomatis', () => {
  const h = ready();
  const hand = { x: 0, y: 1, z: 0 };
  h.FX.spatial('weapon-trail', { pos: hand, follow: () => hand, dur: 0.72, style: 'heavy', seed: 88 });
  step(h, 0.08);
  hand.x = 1;
  step(h, 0.08);
  const segments = h.scene.children.filter(m => m.material.transparent && m.visible);
  assert.ok(segments.length > 0, 'trail harus terbentuk di antara posisi anchor');
  assert.ok(segments.some(m => m.position.x > 0 && m.position.x < 1));
  step(h, 1);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
});

test('follow yang melempar error tidak merusak loop; efek tetap selesai', () => {
  const h = ready();
  h.FX.spatial('tp-gather', { pos: { x: 1, y: 0, z: 1 }, follow: () => { throw new Error('pion hilang'); } });
  step(h, 1);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
});

test('Portal: buka -> idle -> tutup; close() memperpendek; stop(); entry/exit; tidak ada sisa', () => {
  const h = ready();
  const portal = h.FX.spatial('portal', { pos: { x: 0, y: 0, z: 0 }, yaw: 0, idle: 5 });
  assert.ok(portal && typeof portal.close === 'function' && typeof portal.enter === 'function' && typeof portal.exit === 'function');
  step(h, 1);
  assert.ok(h.scene.children.length >= 8, 'portal punya bentuk: disc, cincin berlapis, bingkai voxel');
  assert.ok(portal.enter() && portal.exit());
  assert.ok(portal.close());
  assert.strictEqual(portal.close(), false, 'close kedua tidak berefek');
  step(h, 1.5);
  assert.strictEqual(h.FX.getActive().length, 0, 'portal tertutup dan bersih jauh sebelum idle 5 dtk habis');
  assert.strictEqual(h.scene.children.length, 0);
  const p2 = h.FX.spatial('portal', { pos: { x: 0, y: 0, z: 0 }, idle: 5 });
  step(h, 0.7);
  assert.ok(p2.stop());
  assert.strictEqual(h.scene.children.length, 0);
});

test('Spatial Distortion punya titik pusat dan arah (riak memanjang searah dir)', () => {
  const h = ready();
  h.FX.spatial('distort', { pos: { x: 2, y: 0, z: -1 }, dir: Math.PI / 2 });
  step(h, 0.5);
  const rings = h.scene.children.filter(m => m.material.transparent && m.rotation.x === -Math.PI / 2 && m.scale.x !== m.scale.y);
  assert.ok(rings.length >= 1, 'riak harus elips (memanjang searah dir)');
  rings.forEach(r => { assert.strictEqual(r.position.x, 2); assert.strictEqual(r.position.z, -1); });
});

test('Combat slash: arah yaw mengubah siluet; heavy/double/vertical memiliki bentuk berbeda', () => {
  const snapshot = (style, dir) => {
    const h = ready();
    h.FX.spatial('sword-slash', { pos: { x: 0, y: 0, z: 0 }, style, dir, seed: 912 });
    step(h, 0.08);
    return h.scene.children.filter(m => m.material.transparent).map(m => [
      Math.round(m.position.x * 100), Math.round(m.position.y * 100), Math.round(m.position.z * 100),
      Math.round(m.scale.x * 100), Math.round(m.scale.y * 100)
    ]);
  };
  const horizontal = snapshot('horizontal', 0), turned = snapshot('horizontal', Math.PI / 2);
  assert.notDeepStrictEqual(horizontal, turned, 'yaw harus memutar arah slash');
  assert.notDeepStrictEqual(horizontal, snapshot('vertical', 0), 'slash vertikal memiliki siluet berbeda');
  assert.notDeepStrictEqual(horizontal, snapshot('diagonal', 0), 'slash diagonal memiliki siluet berbeda');
  assert.notDeepStrictEqual(horizontal, snapshot('heavy', 0), 'slash berat memiliki siluet berbeda');
  assert.notDeepStrictEqual(horizontal, snapshot('heavy-diagonal', 0), 'slash berat diagonal memiliki siluet berbeda');
  assert.notDeepStrictEqual(horizontal, snapshot('double', 0), 'double slash memiliki dua lintasan');
});

test('Combat FX menggunakan lifecycle, fid/seed, reduce-motion, dan Stop All', () => {
  const h = ready();
  Object.keys(SAMPLE).filter(k => k.startsWith('combat-') || k.startsWith('weapon-') || k === 'sword-slash')
    .forEach((kind, i) => h.FX.spatial(kind, Object.assign({ fid: 'host:1:abcd.' + (i + 1), seed: 77 + i }, SAMPLE[kind])));
  assert.strictEqual(h.FX.getActive().filter(e => e.metadata.category === 'spatial').length, 7);
  assert.ok(h.FX.stopAll({ scope: 'visual', reason: 'reset' }) >= 7);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
  const reduced = ready({ reducedMotion: true });
  reduced.FX.spatial('combat-impact', { pos: { x: 0, y: 0, z: 0 }, seed: 1 });
  assert.ok(reduced.FX.getActive().length > 0, 'reduce motion must not prevent feedback');
  step(reduced, 1);
  assert.strictEqual(reduced.FX.getActive().length, 0);
  assert.strictEqual(reduced.scene.children.length, 0);
});

test('buff shield punya feedback aktivasi dan akhir dengan siluet berbeda', () => {
  const snapshot = style => {
    const h = ready();
    h.FX.spatial('buff-feedback', Object.assign({}, SAMPLE['buff-feedback'], { pos: { x: 0, y: 0, z: 0 }, style, seed: 912 }));
    step(h, 0.12);
    return h.scene.children.map(m => [
      m.material.color,
      Math.round(m.position.x * 100), Math.round(m.position.y * 100), Math.round(m.position.z * 100),
      Math.round(m.scale.x * 100), Math.round(m.scale.y * 100)
    ]);
  };
  assert.notDeepStrictEqual(snapshot('activate'), snapshot('end'));
  const src = fnBody(mainSrc, 'function powerFxPawn(key,pl,meta,origin){');
  assert.ok(src.includes("key==='wooden_shield'||key==='shield_block'"));
  assert.ok(src.includes("FX.spatial('buff-feedback'") && src.includes("key==='wooden_shield'?'activate':'end'"));
  assert.ok(src.includes('defense||guardFeedback?mpFxMeta()'), 'cue buff tetap membawa identity/seed');
});

test('reward chest, coin, gem, XP, item, rare, dan legendary memiliki FX terlacak serta cleanup', () => {
  ['chest', 'coin', 'gem', 'xp', 'item', 'rare', 'legendary'].forEach(style => {
    const h = ready();
    const effect = h.FX.spatial('reward-burst', { pos: { x: 1, y: 0.2, z: 2 }, style, tier: 'L4', fid: 'reward-' + style, seed: 41 });
    assert.ok(effect, style + ': FX tidak dibuat');
    const active = h.FX.getActive().find(e => e.metadata.fid === 'reward-' + style);
    assert.strictEqual(active.metadata.category, 'spatial');
    assert.strictEqual(active.metadata.fid, 'reward-' + style);
    step(h, 2);
    assert.strictEqual(h.FX.getActive().length, 0, style + ': lifecycle tidak selesai');
    assert.strictEqual(h.scene.children.length, 0, style + ': mesh tertinggal');
  });
});

test('environment FX World, Nether, dan Dragon seeded serta membersihkan semua resource', () => {
  ['world', 'nether', 'dragon'].forEach(style => {
    const h = ready();
    const effect = h.FX.spatial('environment-ambient', { pos: { x: 2, y: 3, z: -4 }, style, fid: 'ambient-' + style, seed: 58 });
    assert.ok(effect, style + ': ambient tidak dibuat');
    assert.ok(h.FX.getActive().some(e => e.metadata.fid === 'ambient-' + style));
    step(h, 2);
    assert.strictEqual(h.FX.getActive().length, 0, style + ': ambient tertinggal');
    assert.strictEqual(h.scene.children.length, 0, style + ': mesh tertinggal');
  });
  const h = ready();
  assert.ok(h.FX.spatial('world-transition', { pos: { x: 0, y: 2, z: 0 }, style: 'dragon', seed: 73, fid: 'transition-dragon' }));
  step(h, 2);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
});

test('result kalah memakai dissolve halus tanpa konfeti, sementara kemenangan tetap celebratory', () => {
  const celebrate = fnBody(mainSrc, 'async function celebrate(p){');
  const finish = fnBody(mainSrc, 'function finishGame(p,fromRemote){');
  const h = ready();
  assert.ok(h.FX.spatial('result-dissolve', { pos: { x: 0, y: 0.4, z: 0 }, style: 'defeat', tier: 'L1', fid: 'defeat-result', seed: 10 }));
  step(h, 2);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
  assert.ok(celebrate.includes('if(defeat) return;') && celebrate.includes('spawnConfetti(p.pawn.position); fireworkCelebrate(p);'), 'kemenangan mempertahankan efek perayaannya');
  assert.ok(celebrate.indexOf('if(defeat) return;') < celebrate.indexOf('hopTo('), 'kekalahan tidak memainkan animasi kemenangan');
  assert.ok(finish.includes("spFx('result-dissolve'") && finish.includes("pawnAct(loser.pawn,'sad',2.4)") && finish.includes("fid:'result-defeat-'+gameId"), 'hasil kalah memakai pawn pemain dan dissolve seeded tanpa ledakan/flash');
});

test('efek spasial dilacak menurut fid/seed/source untuk cue multiplayer', () => {
  const h = ready();
  h.FX.spatial('tp-arrive', Object.assign({ fid: 'host:1:abcd.7', seed: 42, source: 'host' }, SAMPLE['tp-arrive']));
  const e = h.FX.getActive().find(x => x.metadata.category === 'spatial');
  assert.strictEqual(e.metadata.fid, 'host:1:abcd.7'); assert.strictEqual(e.metadata.seed, 42); assert.strictEqual(e.metadata.source, 'host');
  step(h, 2);
  assert.strictEqual(h.FX.getHistory().pop().fid, 'host:1:abcd.7');
});

test('ParticleFX/efek lama tidak terganggu: confetti & ledakan berjalan berdampingan dan batas gabungan dihormati', () => {
  const h = ready(QUALITY_NAV.low);
  for (let i = 0; i < 10; i++) { h.FX.spatial('tp-arrive', SAMPLE['tp-arrive']); h.FX.spawnExplosion({ x: 0, y: 0, z: 0 }, 'ender'); h.FX.spawnConfetti({ x: 0, y: 0, z: 0 }); }
  assert.ok(particles(h) <= CAP.low, 'gabungan ' + particles(h));
  step(h, 6);
  assert.strictEqual(h.scene.children.length, 0);
  assert.strictEqual(h.FX.getActive().length, 0);
});

/* ---------- penyambungan di main.js (uji sumber, gaya tes Phase 1) ---------- */
const fnBody = (src, header) => { const i = src.indexOf(header); assert.ok(i >= 0, header); return src.slice(i, src.indexOf('\n}\n', i) + 3); };

test('teleport: durasi 0,3+0,3 dan hasil posisi tidak berubah; TNT (fire===true) tanpa Spatial FX', () => {
  const body = fnBody(mainSrc, 'async function teleport(p,to,fire){');
  assert.strictEqual((body.match(/await tween\(0\.3,/g) || []).length, 2);
  assert.ok(body.includes('pw.position.copy(dest)') && body.includes('slotPos(p.idx,to)'));
  assert.ok(body.includes('const spat=fire!==true'));
  assert.ok(!/\bp\.pos\s*=/.test(body), 'teleport tidak boleh mengubah p.pos');
  ['tp-gather', 'tp-depart', 'tp-trail', 'tp-arrive', 'tp-recover', 'tp-residual'].forEach(k => assert.ok(body.includes("'" + k + "'"), k));
});

test('Ender Swap: durasi 2,3 dtk dan urutan tween (0,7 / 0,7 / 0,5 / 0,4) tidak berubah; mekanisme tukar tak berubah', () => {
  const body = fnBody(mainSrc, 'async function enderSwapAnim(p,L,a,b){');
  const tw = [...body.matchAll(/await tween\(([\d.]+),/g)].map(m => m[1]);
  assert.deepStrictEqual(tw, ['0.7', '0.7', '0.5', '0.4']);
  assert.ok(/const EH_LIFE=2\.3;/.test(mainSrc));
  assert.ok(body.includes('p.pos=b; L.pos=a;'));
  assert.ok(body.includes('slotPos(p.idx,b)') && body.includes('slotPos(L.idx,a)'));
  assert.ok(body.includes('if(reduce){ await teleport(p,b,\'ender\'); await teleport(L,a,\'ender\'); return; }'));
  assert.ok(/tint:0/.test(body) && /tint:1/.test(body), 'dua karakter memakai tint berbeda');
  assert.ok(!/tweenVisual|\.cancel\(/.test(body), 'tidak memutus tween gameplay');
});

test('cue spfx: ringan, bawa fid, whitelist kind, tamu menolak duplikat lewat acceptCue yang sudah ada', () => {
  assert.ok(/MP_FX_CUES=\{[^}]*spfx:1/.test(mainSrc));
  assert.ok(mainSrc.includes("else if(c.k==='spfx'){ spFxCue(c); }"));
  const send = fnBody(mainSrc, 'function spFx(kind,o){');
  assert.ok(send.includes('MP_SEQ===0') && send.includes("k:'spfx'") && send.includes('c.fid=f.fid'));
  assert.ok(!send.includes('follow:') && !/c\.[a-z]+=o\.follow/.test(send), 'follow (fungsi) tidak dikirim');
  assert.ok(send.includes('if(o.pid) c.pid=o.pid'));
  assert.ok(mainSrc.includes("(c.t==='weapon-trail'||c.t==='weapon-charge')&&c.pid") && mainSrc.includes('o.pos=follow.pos; o.follow=follow.follow'));
  assert.ok(/FX\.spatialKinds\[c\.t\]/.test(mainSrc));
  const worst = { k: 'spfx', t: 'tp-trail', x: -12.3, y: 0.4, z: 13.5, tx: 12.1, ty: 0.4, tz: -13.3, d: 0.5, q: -0.3, h: 0.4, fid: 'player_ab12cd:12:x7k2.123' };
  assert.ok(JSON.stringify(worst).length < 200, 'payload terburuk ' + JSON.stringify(worst).length);
  const typical = { k: 'spfx', t: 'tp-arrive', x: -2.3, y: 0.4, z: 3.5, fid: 'host:3:x7k2.12' };
  assert.ok(JSON.stringify(typical).length < 120);
  assert.ok(JSON.stringify(Object.assign({}, typical, { t: 'sword-slash', r: 0, m: 'diagonal' })).length < 120);
  const trail = { k: 'spfx', t: 'weapon-trail', x: -12.3, y: 0.4, z: 13.5, m: 'heavy', pid: 'player_ab12cd', fid: 'player_ab12cd:12:x7k2.123' };
  assert.ok(JSON.stringify(trail).length < 200, 'weapon trail cue ' + JSON.stringify(trail).length);
  const projectile = { k: 'spfx', t: 'combat-projectile', x: -12.3, y: 0.4, z: 13.5, tx: 12.1, ty: 0.4, tz: -13.3, d: 0.5, m: 'charged', fid: 'player_ab12cd:12:x7k2.123' };
  assert.ok(JSON.stringify(projectile).length < 200, 'projectile cue ' + JSON.stringify(projectile).length);
});

test('serangan Power pedang memicu slash sesuai posisi dan tipe senjata, tanpa mengubah resolusi Power', () => {
  const attack = fnBody(mainSrc, 'function swordAttackFx(attacker,target,key){');
  assert.ok(attack.includes('Math.atan2(to.x-from.x,to.z-from.z)'));
  assert.ok(attack.includes("key==='netherite_sword'?'heavy':key==='diamond_sword'?'heavy-diagonal':'horizontal'"));
  assert.ok(attack.includes("spFx('sword-slash'") && attack.includes("spFx('weapon-release'") && attack.includes("spFx('weapon-trail'"));
  const use = fnBody(mainSrc, 'async function usePU(k,cpu,tileArg){');
  assert.ok(use.includes("if(melee&&T.length&&(R.kind==='strike'||R.kind==='area')) swordAttackFx(p,T[0],k);"));
  assert.ok(use.includes('const from=q.pos,to=Math.max(1,from-R.back)'));
  assert.ok(use.includes('if(melee) await fly(q,to,0.45,1.1); else await teleport(q,to,true);'));
});

test('panah Dragon memberi charge, trail lintasan, dan impact aktual tanpa memengaruhi resolusi gameplay', () => {
  const body = fnBody(mainSrc, 'async function bowShootDragon(p,gid,onShoot){');
  assert.ok(body.includes("spFx('weapon-charge'") && body.includes("spFx('combat-projectile'") && body.includes("spFx('combat-impact'"));
  assert.ok(body.includes('await sleep(bc.bowReleaseAt(dur)*1000)'));
  assert.ok(body.includes('await tween(fl,k=>{ aimAt(); to.copy(s0).lerp(tg,k);'));
  assert.ok(body.includes('pos:dragon.position.clone()'));
  assert.ok(body.includes('finally{ world.remove(a); }'));
  assert.ok(!body.includes('damage') && !body.includes('hitTest') && !body.includes('intersect'));
});

test('projectile FX mengikuti origin/target dan menyelesaikan trail tanpa collision logic', () => {
  const h = ready();
  h.FX.spatial('combat-projectile', { from: { x: 0, y: 1, z: 0 }, to: { x: 2, y: 2, z: -1 }, dur: 0.4, seed: 33 });
  step(h, 0.14);
  const trail = h.scene.children.filter(m => !m.material.transparent);
  assert.ok(trail.length > 0);
  assert.ok(trail.some(m => m.position.x > 0 && m.position.z < 0));
  step(h, 1);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
  assert.ok(fxSrc.includes('flash.material.opacity = 0.28 *'));
  const explosion = fnBody(mainSrc, 'async function explode(p){');
  assert.ok(explosion.includes("spFx('combat-impact',{pos,style:'ground'})"));
});

test('hit feedback muncul pada pawn aktual, mengikuti cue seeded, dan screen flash <= 0.28', () => {
  const hit = fnBody(mainSrc, 'function hitBlastFx(p,meta){');
  assert.ok(hit.includes("FX.spatial('combat-impact'") && hit.includes("Object.assign({pos:impact,style:'hit'},fxMeta||{})"));
  assert.ok(hit.includes('fid:m.fid,seed:m.seed'));
  assert.ok(mainSrc.includes("hitBlastFx(q,FX&&FX.cueOptions?FX.cueOptions(c):null)"));
  const flash = cssSrc.match(/#hitFx \.hf-flash\{([^}]+)\}/);
  assert.ok(flash);
  const flashAlphas = [...flash[1].matchAll(/rgba\([^)]*,\s*([0-9.]+)\)/g)].map(m => Number(m[1]));
  assert.ok(flashAlphas.length && Math.max(...flashAlphas) <= 0.28);
  assert.ok(cssSrc.includes('rgba(255,0,0,.28)') && !cssSrc.includes('rgba(255,0,0,.45)'));
});

test('shield block dan absorption hanya dirender melalui cue defense yang sudah diproses', () => {
  const oriented = dir => {
    const h = ready();
    h.FX.spatial('combat-defense', { pos: { x: 2, y: 0.5, z: -1 }, dir, style: 'shield', seed: 445 });
    step(h, 0.04);
    const points = h.scene.children.filter(m => m.material.transparent && m.material.color === 0x14B8A6)
      .map(m => [Math.round(m.position.x * 100), Math.round(m.position.z * 100)]);
    step(h, 1);
    assert.strictEqual(h.scene.children.length, 0);
    return points;
  };
  assert.notDeepStrictEqual(oriented(0), oriented(Math.PI / 2), 'shield silhouette must face its source');
  const h = ready();
  ['shield', 'absorb'].forEach(style => {
    h.FX.spatial('combat-defense', { pos: { x: 2, y: 0.5, z: -1 }, dir: 0.7, style, fid: 'host:1:abcd.' + (style === 'shield' ? 1 : 2), seed: 445 });
  });
  assert.strictEqual(h.FX.getActive().filter(e => e.metadata.type === 'combat-defense').length, 2);
  step(h, 1);
  assert.strictEqual(h.FX.getActive().length, 0);
  assert.strictEqual(h.scene.children.length, 0);
  const powerFx = fnBody(mainSrc, 'function powerFxPawn(key,pl,meta,origin){');
  assert.ok(powerFx.includes("key==='shield_block'||key==='totem_block'"));
  assert.ok(powerFx.includes("FX.spatial('combat-defense'"));
  assert.ok(powerFx.includes("style:key==='totem_block'?'absorb':'shield'"));
  assert.ok(powerFx.includes('cue.sx=Math.round(source.x*10)/10'));
  assert.ok(powerFx.includes('Math.atan2(source.x-pos.x,source.z-pos.z)'));
  assert.ok(mainSrc.includes("powerFxPawn(c.key,q,FX&&FX.cueOptions?FX.cueOptions(c):null,source)"));
  assert.ok(mainSrc.includes("powerFxPawn(by==='guard'?'shield_block':'totem_block',q,null,p.pawn.position)"));
  assert.ok(mainSrc.includes("powerFxPawn(by==='guard'?'shield_block':'totem_block',q,null,bp)"));
});

test('cue lama eport tetap diputar; Ender Hole memasang lapisan hole-fx tanpa cue tambahan', () => {
  assert.ok(mainSrc.includes("else if(c.k==='eport'){ enderHole(new THREE.Vector3(c.x,c.y,c.z),c.s||1,"));
  const body = fnBody(mainSrc, 'function enderHole(pos,scale,meta){');
  assert.ok(body.includes("FX.spatial('hole-fx'"));
  assert.strictEqual((body.match(/mpCue\(/g) || []).length, 1, 'hanya satu cue (eport)');
});

test('audio: memakai UT.GameplayAudio (sfx) yang ada, satu suara spasial per 250 ms, tanpa aset/engine baru', () => {
  const body = fnBody(mainSrc, 'function spSound(name){');
  assert.ok(body.includes('250') && body.includes('sfx[name]()'));
  assert.ok(!/new Audio|AudioContext/.test(fxSrc) && !/new Audio|AudioContext/.test(body));
});

test('reward FX terikat pada klaim sukses dan menggunakan data rarity/reward yang tersedia', () => {
  const rewardPage = fs.readFileSync(path.join(root, 'src/views/hadiah-misi.js'), 'utf8');
  const claimDay = rewardPage.slice(rewardPage.indexOf('async function claimDay('), rewardPage.indexOf('function vHadiah('));
  const claimAch = rewardPage.slice(rewardPage.indexOf('async function claimAch('), rewardPage.indexOf('function vAch('));
  assert.ok(claimDay.indexOf('if(!r.ok)') < claimDay.indexOf('rewardBurst('), 'daily feedback harus setelah server menyetujui klaim');
  assert.ok(/r\.type==='box'/.test(claimDay) && /r\.gems>0/.test(claimDay), 'daily FX menggunakan tipe reward server');
  assert.ok(claimAch.indexOf('if(!r||!r.ok)') < claimAch.indexOf('rewardBurst('), 'achievement feedback harus setelah klaim sukses');
  assert.ok(/def&&def\[5\]==='legendaris'/.test(claimAch), 'rarity achievement mengikuti definisi yang ada');
  assert.ok(/r&&r\.ok\)onOk\(r\)/.test(rewardPage), 'quest FX hanya boleh dipanggil dari callback sukses');
  assert.ok(/applyChestReward\(p,rw,gid\)[\s\S]*?spFx\('reward-burst'/.test(mainSrc), 'chest reveal harus setelah reward yang ada diproses');
  assert.ok(/Math\.imul\(seq,2654435761\)/.test(rewardPage) && /fid:'reward-claim-'\+seq/.test(rewardPage), 'DOM burst punya seed dan fid');
  assert.ok(/PF\.configure\(\{maxParticles:FX\.limit\(\),maxBurst:FX\.n\(18,'L4'\)\}\)/.test(rewardPage), 'DOM burst mengikuti limit kualitas dan tier');
  assert.ok(/function openChest\(n\)[\s\S]*?if\(!ONLINE_ROOM\|\|ONLINE_HOST\) spFx\('reward-burst'/.test(mainSrc), 'chest replay di klien tidak memutar cue dua kali');
});

test('world FX menggunakan peta aktif, jeda kualitas, Reduce Motion, visibility, dan cleanup transisi', () => {
  const env = fnBody(mainSrc, 'function updateEnvironmentFX(dt){');
  const world = fnBody(mainSrc, 'function buildWorld(key){');
  assert.ok(env.includes("themeKey==='nether'?'nether':'world'"), 'ambient mengikuti dua map aktif');
  assert.ok(env.includes('FX.quality()') && env.includes('FX.reduced()') && env.includes('document.hidden') && env.includes('paused'), 'emisi menghormati kualitas, reduce motion, visibility, dan jeda');
  assert.ok(env.includes("spFx('environment-ambient'") && env.includes('seed') && env.includes('fid:'), 'ambient memakai cue seeded');
  assert.ok(world.includes('if(transition){ ENV_ACC=0; ENV_SEQ=0; wfxClear(); if(FX&&FX.clearSpatial) FX.clearSpatial(); }'), 'pergantian map membersihkan efek lama');
  assert.ok(world.includes("spFx('world-transition'"), 'pergantian map mengirim cue transisi');
});

test('UI mempertahankan feedback tombol, giliran, notifikasi, dadu, dan modal tanpa perubahan layout', () => {
  assert.ok(cssSrc.includes('body .btn:hover:not(:disabled)'), 'hover tombol');
  assert.ok(cssSrc.includes('body .btn:active:not(:disabled){transform:translateY(4px) scale(.98)'), 'press tombol punya feedback skala halus');
  assert.ok(cssSrc.includes('@media (prefers-reduced-motion:reduce){body .btn{transition:none}body .btn:active:not(:disabled),body .btn.small:active:not(:disabled),body .hud .btn.small:active:not(:disabled){transform:none}}'), 'press menghormati Reduce Motion');
  assert.ok(cssSrc.includes('#side .pr.on') && cssSrc.includes('hud-swap'), 'status/giliran sudah memiliki pulse/transisi');
  assert.ok(cssSrc.includes('#side .tn #rollHint'), 'hint hasil roll tersedia');
  assert.ok(cssSrc.includes('.lm-ov:not([hidden])') && cssSrc.includes('@media (prefers-reduced-motion:reduce)'), 'modal memiliki entrance dan fallback Reduce Motion');
});

test('FX spasial tidak membuat loop/engine baru dan tidak menyentuh gameplay', () => {
  assert.ok(!/requestAnimationFrame|setInterval/.test(fxSrc));
  assert.ok(!/\b(players|MP_SYNC|localStorage|hud\()/.test(fxSrc.slice(fxSrc.indexOf('Spatial FX (Phase 2)'))));
});

(async () => {
  for (const t of tests) { await t.fn(); count++; console.log('ok - ' + t.name); }
  console.log(count + ' tes spatial FX lulus');
})().catch(error => { console.error(error); process.exit(1); });


