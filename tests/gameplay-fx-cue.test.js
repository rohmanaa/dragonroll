const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { harness } = require('./helpers/fx-harness');
const root = path.join(__dirname, '..');
const mainSrc = fs.readFileSync(path.join(root, 'src/gameplay/js/main.js'), 'utf8');

const plain = value => JSON.parse(JSON.stringify(value)); /* objek dari vm context beda realm -> bandingkan sebagai data biasa */
let count = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ---------- util: harness dengan Math.random dikendalikan ---------- */
function withRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = original; }
}
function ready(options) {
  const h = harness(options);
  assert.ok(h.FX.init(h.scene), 'FX.init harus berhasil');
  return h;
}
function snapshot(h, n) {
  h.FX.updateConfetti(0.1); /* posisi setelah satu langkah = cermin kecepatan awal tiap partikel */
  return h.scene.children.slice(0, n).map(m => [m.position.x, m.position.y, m.position.z, m.scale && m.scale.value]);
}

/* ---------- util: ekstrak fungsi nyata dari main.js ---------- */
function extractFunction(src, name) {
  const match = new RegExp('(async )?function ' + name + '\\(').exec(src);
  assert.ok(match, 'fungsi ' + name + ' harus ada di main.js');
  let i = match.index + match[0].length, depth = 1;
  while (depth && i < src.length) { const ch = src[i++]; if (ch === '(') depth++; else if (ch === ')') depth--; }
  while (src[i] !== '{') i++;
  const start = match.index;
  depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i], next = src[i + 1];
    if (ch === '/' && next === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (ch === '/' && next === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('kurung tidak seimbang: ' + name);
}
function extractLine(src, startsWith) {
  const line = src.split('\n').find(l => l.startsWith(startsWith));
  assert.ok(line, 'baris ' + startsWith + ' harus ada');
  return line;
}

/* Satu "sisi" game (host atau tamu) memakai kode main.js asli untuk jalur cue FX. */
function makeSide(options) {
  const h = ready(options.harness);
  const sent = [], played = [], gameplay = { cur: 1, busy: false, players: ['a', 'b'], applied: 0 };
  const code = [
    'let ONLINE_ROOM=true,ONLINE_HOST=' + (options.host ? 'true' : 'false') + ',MP_SEQ=0,gameId=' + (options.gameId || 3) + ',MP_ID=' + JSON.stringify(options.id || 'hostA') + ',MP_SYNC=SYNC,STALE={};',
    'const FX=window.UT.GameplayFX; const THREE=window.THREE;',
    extractLine(mainSrc, 'const MP_FX_CUES='),
    extractLine(mainSrc, 'const MPFB='),
    extractLine(mainSrc, 'let MP_CUE_CHAIN='),
    'function mpRunCue(c){ RUN.push(c.k); return Promise.resolve(); }',
    'function applyGameSnapshot(){ GP.applied++; }',
    'function mpGuestTotemPrompt(){}',
    'function dragonMusicStop(){}',
    ['mpFxMeta', 'mpCue', 'spawnConfetti', 'spawnExplosion', 'mpRunFeedbackCue', 'onMpCue'].map(n => extractFunction(mainSrc, n)).join('\n'),
    'globalThis.API={spawnConfetti,spawnExplosion,mpCue,onMpCue,setGameId(v){gameId=v;},flush(){return MP_CUE_CHAIN;}};'
  ].join('\n');
  const context = {
    window: h.window, console,
    SYNC: options.noSync ? null : { sendCue(c) { sent.push(c); return Promise.resolve(); } },
    RUN: played, GP: gameplay
  };
  vm.runInNewContext(code, context, { filename: 'main.js(cue-path)' });
  return { h, sent, played, gameplay, api: context.API };
}

/* ============ Checkpoint 1.3 A: identitas FX (fid) ============ */
test('fid unik untuk ribuan kejadian dan terurai kembali', () => {
  const { FX } = harness();
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const m = FX.cueMeta(i % 3 ? 'hostA' : 'hostB', 1 + (i % 4));
    assert.ok(!seen.has(m.fid), 'fid bentrok: ' + m.fid);
    seen.add(m.fid);
    const f = FX.parseFid(m.fid);
    assert.ok(f && f.seq > 0, 'fid harus bisa diurai: ' + m.fid);
    assert.ok(m.fid.length <= 80);
  }
});

test('fid tidak bergantung pada nama efek dan tidak bentrok antar pemain atau sesi halaman', () => {
  const a = withRandom(0.11, () => harness().FX);
  const b = withRandom(0.87, () => harness().FX);
  const x = a.cueMeta('p1', 1), y = b.cueMeta('p1', 1); /* pengirim, game, dan urutan sama, sesi halaman beda */
  assert.notStrictEqual(x.fid, y.fid);
  assert.notStrictEqual(a.cueMeta('p1', 1).fid, a.cueMeta('p2', 1).fid);
  assert.ok(!/confetti|blast|eport/i.test(x.fid), 'fid bukan nama efek');
  const dirty = a.cueMeta('p:1/<x>', 2);
  assert.ok(a.parseFid(dirty.fid), 'pengirim dengan karakter aneh tetap menghasilkan fid valid');
  assert.strictEqual(a.cueMeta(null, 'abc').fid.split(':')[0], 'host');
});

/* ============ Checkpoint 1.3 B: seed deterministik ============ */
test('rng(seed, index) deterministik, dalam rentang [0,1), dan berbeda per index/seed', () => {
  const { FX } = harness();
  const a = FX.rng(123, 5), b = FX.rng(123, 5), c = FX.rng(123, 6), d = FX.rng(124, 5);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepStrictEqual(sa, sb);
  sa.forEach(v => assert.ok(v >= 0 && v < 1));
  assert.notDeepStrictEqual(sa, [c(), c(), c()]);
  assert.notDeepStrictEqual(sa, [d(), d(), d()]);
});

test('confetti dengan seed sama identik antar klien dan tidak memanggil Math.random', () => {
  const one = ready(), two = ready();
  const pos = new one.window.THREE.Vector3(1, 0, 2);
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random tidak boleh dipakai saat seed ada'); };
  try {
    one.FX.spawnConfetti(pos, null, { seed: 777, fid: 'a:1:x.1', source: 'a' });
    two.FX.spawnConfetti(pos, null, { seed: 777, fid: 'a:1:x.1', source: 'a' });
  } finally { Math.random = original; }
  const s1 = snapshot(one, 200), s2 = snapshot(two, 200);
  assert.strictEqual(s1.length, 110);
  assert.deepStrictEqual(s1, s2);
  const three = ready();
  three.FX.spawnConfetti(pos, null, { seed: 778 });
  assert.notDeepStrictEqual(snapshot(three, 200), s1, 'seed beda -> variasi beda');
});

test('partikel ke-i tetap sama walau skala perangkat (jumlah partikel) berbeda', () => {
  const low = ready({ navigator: { deviceMemory: 2 } }), high = ready({ navigator: { deviceMemory: 8, hardwareConcurrency: 8 } });
  assert.strictEqual(low.FX.quality(), 'low');
  assert.notStrictEqual(high.FX.quality(), 'low');
  const pos = new low.window.THREE.Vector3(0, 0, 0);
  low.FX.spawnConfetti(pos, null, { seed: 42 });
  high.FX.spawnConfetti(pos, null, { seed: 42 });
  const sl = snapshot(low, 1000), sh = snapshot(high, 1000);
  assert.ok(sl.length < sh.length, 'perangkat lemah membuat lebih sedikit partikel');
  assert.deepStrictEqual(plain(sl), plain(sh.slice(0, sl.length)));
});

test('ledakan: api dan asap berseed sama konsisten walau jumlah api per perangkat berbeda', () => {
  const low = ready({ navigator: { deviceMemory: 2 } }), mid = ready();
  const pos = new low.window.THREE.Vector3(0, 0, 0);
  low.FX.spawnExplosion(pos, 'ender', null, { seed: 9 });
  mid.FX.spawnExplosion(pos, 'ender', null, { seed: 9 });
  const fireLow = low.FX.n(45), fireMid = mid.FX.n(45), smokeLow = low.FX.n(27.5), smokeMid = mid.FX.n(27.5);
  assert.ok(fireLow < fireMid);
  const a = snapshot(low, fireLow + smokeLow), b = snapshot(mid, fireMid + smokeMid);
  assert.deepStrictEqual(plain(a.slice(0, fireLow)), plain(b.slice(0, fireLow)), 'api sama');
  assert.deepStrictEqual(plain(a.slice(fireLow, fireLow + 5)), plain(b.slice(fireMid, fireMid + 5)), 'asap sama (namespace indeks sendiri)');
});

test('sparkle dan DOM burst ParticleFX memakai seed yang sama secara konsisten', () => {
  const one = ready(), two = ready(), three = ready();
  const pos = new one.window.THREE.Vector3(0, 0, 0);
  one.FX.sparkle(pos, null, { seed: 5 }); two.FX.sparkle(pos, null, { seed: 5 });
  assert.deepStrictEqual(snapshot(one, 30), snapshot(two, 30));
  const style = h => h.document.getElementById('fx-layer').children.map(n => JSON.stringify(n.style));
  one.ParticleFX.burstAt(50, 60, { count: 10, seed: 31 });
  two.ParticleFX.burstAt(50, 60, { count: 10, seed: 31 });
  three.ParticleFX.burstAt(50, 60, { count: 10, seed: 32 });
  assert.ok(style(one).length === 10);
  assert.deepStrictEqual(style(one), style(two));
  assert.notDeepStrictEqual(style(one), style(three));
});

test('tanpa seed perilaku lama dipertahankan (Math.random) dan metadata efek memuat fid/seed/sumber', () => {
  const h = ready();
  let calls = 0;
  const original = Math.random;
  Math.random = () => { calls++; return original(); };
  try { h.FX.spawnConfetti(new h.window.THREE.Vector3(0, 0, 0)); } finally { Math.random = original; }
  assert.ok(calls > 100, 'tanpa seed tetap acak');
  assert.strictEqual(h.FX.getActive()[0].metadata.seed, undefined);
  h.FX.clearConfetti();
  h.FX.spawnExplosion(new h.window.THREE.Vector3(0, 0, 0), 'ender', null, { seed: 3, fid: 'hostA:3:ab.9', source: 'hostA' });
  const md = h.FX.getActive()[0];
  assert.deepStrictEqual([md.metadata.fid, md.metadata.seed, md.metadata.source, md.state], ['hostA:3:ab.9', 3, 'hostA', 'playing']);
  assert.ok(md.createdAt > 0);
});

/* ============ Checkpoint 1.3 C: dedup, kompatibilitas mundur, cue basi ============ */
test('cue duplikat ditolak, cue baru diterima, dan alasan tercatat', () => {
  const { FX } = harness();
  const m = FX.cueMeta('hostA', 3), cue = { k: 'confetti', fid: m.fid, seed: m.seed };
  assert.strictEqual(FX.acceptCue(cue), true);
  assert.strictEqual(FX.acceptCue(cue), false);
  assert.strictEqual(FX.acceptCue(Object.assign({}, cue)), false);
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: FX.cueMeta('hostA', 3).fid }), true);
  const log = FX.getCueLog();
  assert.deepStrictEqual(plain(log.map(e => e.status + ':' + e.reason)), ['accepted:new', 'rejected:duplicate', 'rejected:duplicate', 'accepted:new']);
  assert.strictEqual(log[0].source, 'hostA');
  assert.strictEqual(log[0].k, 'confetti');
});

test('cue dari game sebelumnya (epoch lebih lama) ditolak, tetapi pengirim lain dan sesi baru tidak terpengaruh', () => {
  const { FX } = harness();
  const newer = FX.cueMeta('hostA', 4), older = FX.cueMeta('hostA', 3), other = FX.cueMeta('hostB', 1);
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: newer.fid }), true);
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: older.fid }), false);
  assert.strictEqual(FX.getCueLog().pop().reason, 'stale-epoch');
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: other.fid }), true);
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: 'hostA:1:zzzz.1' }), true, 'sesi halaman lain (nonce beda) punya urutan epoch sendiri');
});

test('daftar dedup dibatasi sehingga memori tidak tumbuh tanpa batas', () => {
  const { FX } = harness();
  const first = FX.cueMeta('hostA', 1);
  assert.strictEqual(FX.acceptCue({ fid: first.fid }), true);
  for (let i = 0; i < 400; i++) FX.acceptCue({ fid: FX.cueMeta('hostA', 1).fid });
  assert.ok(FX.getCueLog().length <= 64);
  assert.strictEqual(FX.acceptCue({ fid: first.fid }), true, 'entri tertua sudah dilupakan (batas 256)');
});

test('cache epoch multiplayer dibatasi untuk banyak sesi pengirim', () => {
  const { FX } = harness();
  for (let i = 0; i < 257; i++) {
    const nonce = 's' + i.toString(36);
    assert.strictEqual(FX.acceptCue({ fid: 'hostA:5:' + nonce + '.1' }), true);
  }
  assert.strictEqual(FX.acceptCue({ fid: 'hostA:4:s0.2' }), true, 'epoch tertua dilupakan setelah batas sesi terlampaui');
});

test('cue lama tanpa fid atau dengan fid tak dikenal tetap diterima dan diputar tiap kali', () => {
  const { FX } = harness();
  const old = { k: 'confetti', x: 1, y: 2, z: 3 };
  assert.strictEqual(FX.acceptCue(old), true);
  assert.strictEqual(FX.acceptCue(old), true);
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: 'bukan-format-kami' }), true);
  assert.strictEqual(FX.acceptCue({ k: 'blast', fid: 42 }), true);
  assert.strictEqual(FX.acceptCue(null), true);
  assert.strictEqual(FX.cueOptions(old), null);
  assert.strictEqual(FX.cueOptions(null), null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(FX.cueOptions({ seed: 5 }))), { seed: 5 }, 'seed saja tanpa fid tetap dipakai');
});

test('payload baru: cueOptions membaca fid + seed, dan menurunkan seed dari fid bila seed tidak ada', () => {
  const { FX } = harness();
  const m = FX.cueMeta('hostA', 2);
  const full = FX.cueOptions({ fid: m.fid, seed: m.seed });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(full)), { seed: m.seed, fid: m.fid, source: 'hostA' });
  assert.strictEqual(FX.cueOptions({ fid: m.fid }).seed, m.seed, 'seed turunan sama dengan seed pengirim');
  assert.strictEqual(FX.cueOptions({ fid: m.fid, seed: 'x' }).seed, m.seed, 'seed bukan angka diabaikan');
});

/* ============ Jalur cue nyata di main.js (host -> jaringan -> tamu) ============ */
test('host mengirim fid+seed ringan, memakai seed yang sama secara lokal, dan tamu menghasilkan visual identik', async () => {
  const host = makeSide({ host: true });
  const guest = makeSide({ host: false, id: 'guestB' });
  const pos = new host.h.window.THREE.Vector3(1, 0, 2);
  host.api.spawnConfetti(pos);
  assert.strictEqual(host.sent.length, 1);
  const payload = JSON.parse(JSON.stringify(host.sent[0]));
  assert.strictEqual(payload.k, 'confetti');
  assert.ok(payload.fid && typeof payload.seed === 'number');
  assert.strictEqual(host.h.FX.getActive()[0].metadata.seed, payload.seed, 'host memakai seed yang sama dengan yang dikirim');
  guest.api.onMpCue(payload);
  await guest.api.flush();
  assert.strictEqual(guest.h.FX.getActive().length, 1);
  assert.strictEqual(guest.h.FX.getActive()[0].metadata.fid, payload.fid);
  assert.strictEqual(guest.h.FX.getActive()[0].metadata.source, 'hostA');
  assert.deepStrictEqual(snapshot(guest.h, 200), snapshot(host.h, 200));
});

test('cue blast duplikat di tamu tidak menghasilkan FX ganda', async () => {
  const host = makeSide({ host: true }), guest = makeSide({ host: false });
  host.api.spawnExplosion(new host.h.window.THREE.Vector3(0, 0, 0), 'ender');
  const payload = JSON.parse(JSON.stringify(host.sent[0]));
  assert.strictEqual(payload.kind, 'ender');
  guest.api.onMpCue(payload);
  guest.api.onMpCue(JSON.parse(JSON.stringify(payload)));
  guest.api.onMpCue(payload);
  await guest.api.flush();
  assert.strictEqual(guest.h.FX.getActive().filter(e => e.metadata.type === 'explosion').length, 1);
});

test('payload lama tanpa fid/seed tetap diputar di tamu baru (tanpa dedup)', async () => {
  const guest = makeSide({ host: false });
  const legacy = { k: 'confetti', x: 0, y: 0, z: 0 };
  guest.api.onMpCue(legacy);
  guest.api.onMpCue(Object.assign({}, legacy));
  await guest.api.flush();
  const groups = guest.h.FX.getActive();
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].metadata.seed, undefined);
});

test('tamu lama mengabaikan field baru: cue lain tanpa fid dan cue dengan fid tambahan tetap berjalan', async () => {
  const guest = makeSide({ host: false });
  guest.api.onMpCue({ k: 'roll', pid: 'p1', v: 4, fid: 'hostA:3:ab.1' });
  guest.api.onMpCue({ k: 'walk', pid: 'p1', from: 1, to: 3 });
  await guest.api.flush();
  assert.deepStrictEqual(guest.played, ['roll', 'walk'], 'cue gameplay-presentasi lewat jalur lama');
});

test('cue terlambat/basi dilewati tanpa menyentuh state gameplay atau antrean animasi', async () => {
  const host = makeSide({ host: true, gameId: 4 }), guest = makeSide({ host: false });
  host.api.spawnConfetti(new host.h.window.THREE.Vector3(0, 0, 0));
  const fresh = JSON.parse(JSON.stringify(host.sent[0]));
  host.api.setGameId(3);
  host.api.spawnConfetti(new host.h.window.THREE.Vector3(0, 0, 0));
  const late = JSON.parse(JSON.stringify(host.sent[1]));
  const before = JSON.stringify(guest.gameplay);
  guest.api.onMpCue(fresh);
  guest.api.onMpCue(late);
  await guest.api.flush();
  assert.strictEqual(guest.h.FX.getActive().length, 1, 'hanya cue game terbaru yang diputar');
  assert.strictEqual(JSON.stringify(guest.gameplay), before, 'state gameplay tak berubah');
  assert.deepStrictEqual(guest.played, []);
  assert.strictEqual(guest.h.FX.getCueLog().pop().reason, 'stale-epoch');
});

test('cue yang datang setelah FX di-dispose tidak membuat efek atau melempar error', async () => {
  const host = makeSide({ host: true }), guest = makeSide({ host: false });
  host.api.spawnConfetti(new host.h.window.THREE.Vector3(0, 0, 0));
  guest.h.FX.dispose();
  guest.api.onMpCue(JSON.parse(JSON.stringify(host.sent[0])));
  await guest.api.flush();
  assert.strictEqual(guest.h.FX.getActive().length, 0);
  assert.strictEqual(guest.h.scene.children.length, 0);
});

test('mpCue memberi fid otomatis pada cue FX lain, dan tidak pada cue non-FX', () => {
  const host = makeSide({ host: true });
  host.api.mpCue({ k: 'hitfx', pid: 'p1' });
  host.api.mpCue({ k: 'bosshfx', dmg: 3 });
  host.api.mpCue({ k: 'pufx', key: 'shield', cls: 'x' });
  host.api.mpCue({ k: 'walk', pid: 'p1', from: 1, to: 2 });
  host.api.mpCue({ k: 'roll', pid: 'p1', v: 3 });
  const fids = host.sent.slice(0, 3).map(c => c.fid);
  fids.forEach(f => assert.ok(f && host.h.FX.parseFid(f)));
  assert.strictEqual(new Set(fids).size, 3);
  assert.strictEqual(host.sent[3].fid, undefined);
  assert.strictEqual(host.sent[4].fid, undefined);
});

test('payload jaringan hanya berisi nilai primitif kecil (tanpa partikel mentah atau objek Three.js)', () => {
  const host = makeSide({ host: true });
  host.api.spawnConfetti(new host.h.window.THREE.Vector3(1, 2, 3));
  host.api.spawnExplosion(new host.h.window.THREE.Vector3(1, 2, 3), 'ender');
  host.api.mpCue({ k: 'hitfx', pid: 'p1' });
  const allowed = new Set(['k', 'x', 'y', 'z', 'kind', 'fid', 'seed', 'pid', 's']);
  host.sent.forEach(c => {
    Object.keys(c).forEach(key => {
      assert.ok(allowed.has(key), 'field tak terduga di payload: ' + key);
      assert.ok(['string', 'number', 'undefined'].includes(typeof c[key]), key + ' harus primitif');
    });
    const json = JSON.stringify(c);
    assert.ok(json.length < 160, 'payload harus ringan: ' + json.length);
    assert.ok(!/"(m|v|r|life|position|geometry|material)"/.test(json));
  });
});

test('mode offline atau bukan host: tidak ada seed/fid, tidak ada cue, dan efek lokal tetap acak seperti dulu', () => {
  const solo = makeSide({ host: true, noSync: true });
  solo.api.spawnConfetti(new solo.h.window.THREE.Vector3(0, 0, 0));
  assert.strictEqual(solo.sent.length, 0);
  const guest = makeSide({ host: false });
  guest.api.spawnConfetti(new guest.h.window.THREE.Vector3(0, 0, 0));
  assert.strictEqual(guest.sent.length, 0, 'tamu tidak menyiarkan cue');
  assert.strictEqual(guest.h.FX.getActive()[0].metadata.seed, undefined);
});

/* ============ Debug dan alasan cleanup ============ */
test('riwayat efek mencatat waktu, kategori, sumber, seed, status, dan alasan cleanup', () => {
  const { FX, window } = ready();
  const pos = new window.THREE.Vector3(0, 0, 0);
  FX.spawnConfetti(pos, null, { seed: 1, fid: 'hostA:1:ab.1', source: 'hostA' });
  FX.sparkle(pos);
  FX.stopAll({ scope: 'particle', reason: 'reset' });
  FX.spawnExplosion(pos, null, null, { seed: 2, fid: 'hostA:1:ab.2', source: 'hostA' });
  FX.stopAll();
  const h = FX.getHistory();
  assert.strictEqual(h.length, 3);
  assert.deepStrictEqual(plain(h.map(e => e.reason)), ['reset', 'reset', 'stopAll']);
  assert.deepStrictEqual(plain(h.map(e => e.state)), ['disposed', 'disposed', 'disposed']);
  const first = h.find(e => e.type === 'confetti');
  assert.deepStrictEqual([first.category, first.fid, first.seed, first.source], ['particle', 'hostA:1:ab.1', 1, 'hostA']);
  assert.ok(first.createdAt > 0 && first.endedAt >= first.createdAt);
});

test('alasan cleanup untuk selesai alami, stop satuan, visibility, dan dispose', () => {
  const h = ready();
  const a = h.FX.track({}, { type: 'a', scope: 'visual' }), b = h.FX.track({}, { type: 'b', scope: 'visual' }), c = h.FX.track({}, { type: 'c', scope: 'visual' });
  h.FX.untrack(a);
  h.FX.stop(b);
  h.document.hidden = true; h.document.dispatch('visibilitychange');
  h.FX.track({}, { type: 'd', scope: 'visual' });
  h.FX.dispose();
  const reasons = {};
  h.FX.getHistory().forEach(e => { reasons[e.type] = e.reason; });
  assert.deepStrictEqual(reasons, { a: 'completed', b: 'stopped', c: 'visibility-hidden', d: 'dispose' });
});

test('debug tidak mencetak ke console secara default dan hanya aktif lewat setDebug', () => {
  const h = harness();
  const lines = [];
  h.window.console.debug = (...args) => lines.push(args);
  h.FX.acceptCue({ fid: h.FX.cueMeta('hostA', 1).fid });
  h.FX.stop(h.FX.track({}, { scope: 'visual' }));
  assert.strictEqual(lines.length, 0, 'tanpa spam console di production');
  h.FX.setDebug(true);
  h.FX.acceptCue({ fid: h.FX.cueMeta('hostA', 1).fid });
  assert.ok(lines.length >= 1);
  h.FX.setDebug(false);
  const n = lines.length;
  h.FX.acceptCue({ fid: h.FX.cueMeta('hostA', 1).fid });
  assert.strictEqual(lines.length, n);
});

test('main.js: Ender Hole menerima seed dari cue dan tidak mengubah durasi swap 2,3 dtk', () => {
  const ender = extractFunction(mainSrc, 'enderHole');
  assert.ok(ender.includes("k:'eport'") && ender.includes('fid:o.fid,seed:o.seed'));
  assert.ok(ender.includes('FX.rng(fxm.seed)'));
  assert.ok(/const EH_LIFE=2\.3;/.test(mainSrc), 'EH_LIFE tetap 2,3 dtk');
  assert.ok(extractFunction(mainSrc, 'mpRunFeedbackCue').includes('enderHole(new THREE.Vector3(c.x,c.y,c.z),c.s||1,FX&&FX.cueOptions?FX.cueOptions(c):null)'));
  assert.ok(mainSrc.includes('MP_SEQ') && mainSrc.includes('MP_CUE_CHAIN'), 'MP_SEQ dan MP_CUE_CHAIN tetap ada');
});

(async () => {
  for (const t of tests) {
    await t.fn();
    count++;
    console.log('ok - ' + t.name);
  }
  console.log('\n' + count + ' tes cue lulus');
})().catch(error => { console.error(error); process.exit(1); });

