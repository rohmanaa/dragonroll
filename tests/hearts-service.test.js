/* Tes klien hati/nyawa (tanpa jaringan): proyeksi hitung mundur, pembungkus RPC, tanpa server = tanpa batas, tidak dobel, gagal tidak melempar. */
const assert = require('assert');
const { create, project } = require('../src/services/hearts-service.js');

// ---- project(): proyeksi lokal dari status server ----
const T0 = 1000000;
let p = project({ hearts: 3, max: 5, regenSecs: 300, nextAt: T0 + 120000 }, T0);
assert.deepStrictEqual([p.hearts, p.nextInSecs, p.full], [3, 120, false], 'sebelum waktunya: belum bertambah');
p = project({ hearts: 3, max: 5, regenSecs: 300, nextAt: T0 + 120000 }, T0 + 120000);
assert.deepStrictEqual([p.hearts, p.nextInSecs], [4, 300], 'tepat waktunya: +1, hitung mundur baru 5 menit');
p = project({ hearts: 3, max: 5, regenSecs: 300, nextAt: T0 + 120000 }, T0 + 120000 + 300000 + 1000);
assert.deepStrictEqual([p.hearts, p.full], [5, true], 'dua hati terisi -> penuh');
assert.strictEqual(p.nextInSecs, 0);
p = project({ hearts: 5, max: 5, regenSecs: 300, nextAt: null }, T0);
assert.deepStrictEqual([p.hearts, p.nextInSecs, p.full], [5, 0, true], 'penuh: tanpa hitung mundur');
p = project({ hearts: 7, max: 5, regenSecs: 300, nextAt: null }, T0 + 9e9);
assert.strictEqual(p.hearts, 7, 'stok > 5 dibiarkan');
p = project({ hearts: 0, max: 5, regenSecs: 300, nextAt: T0 + 5000 }, T0 + 5000 + 300000 * 10);
assert.strictEqual(p.hearts, 5, 'tidak melewati 5 lewat isi ulang');

function setup(handlers, opts) {
  opts = opts || {};
  const calls = [];
  let clock = opts.t0 || T0;
  const PD = { serverMode: () => opts.enabled !== false };
  const client = { rpc: async (name, args) => { calls.push([name, args]); const h = handlers[name]; if (!h) return { data: null, error: { message: 'no handler ' + name } }; return h(args); } };
  return { svc: create({ PlayerData: PD, getClient: async () => client, now: () => clock }), calls, tick: ms => { clock += ms; } };
}

(async () => {
  // get: memanggil hearts_get dan menyimpan status; snapshot memproyeksikan waktu
  let s = setup({ hearts_get: async () => ({ data: { ok: true, hearts: 3, max: 5, regen_secs: 300, next_in_secs: 120 }, error: null }) });
  let r = await s.svc.get();
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(s.calls[0], ['hearts_get', {}]);
  let sn = s.svc.snapshot();
  assert.deepStrictEqual([sn.hearts, sn.nextInSecs, sn.known], [3, 120, true]);
  s.tick(121000);
  sn = s.svc.snapshot();
  assert.deepStrictEqual([sn.hearts, sn.nextInSecs], [4, 299], 'hitung mundur berjalan tanpa polling');

  // onChange dipanggil saat status baru dari server
  let seen = 0; s.svc.onChange(() => seen++);
  await s.svc.get(); assert.strictEqual(seen, 1);

  // consume: ok -> hati berkurang; habis -> ok:false 'hati-habis' dan status ikut diperbarui
  s = setup({ hearts_consume: async () => ({ data: { ok: true, hearts: 4, max: 5, regen_secs: 300, next_in_secs: 300, consumed: 1 }, error: null }) });
  r = await s.svc.consume(); assert.strictEqual(r.ok, true); assert.strictEqual(s.svc.snapshot().hearts, 4);
  s = setup({ hearts_consume: async () => ({ data: { ok: false, reason: 'hati-habis', hearts: 0, max: 5, regen_secs: 300, next_in_secs: 240 }, error: null }) });
  r = await s.svc.consume(); assert.strictEqual(r.reason, 'hati-habis');
  sn = s.svc.snapshot(); assert.deepStrictEqual([sn.hearts, sn.nextInSecs], [0, 240]); assert.strictEqual(s.svc.canPlay(), false);
  s.tick(241000); assert.strictEqual(s.svc.canPlay(), true, 'setelah isi ulang boleh main lagi');

  // tanpa server (tamu/lokal): tidak ada batas, tidak memanggil jaringan
  s = setup({}, { enabled: false });
  assert.deepStrictEqual(await s.svc.consume(), { ok: true, local: true });
  assert.strictEqual((await s.svc.get()).reason, 'mode-lokal');
  assert.strictEqual(s.svc.canPlay(), true); assert.strictEqual(s.calls.length, 0);

  // belum dimuat: boleh (server tetap memutuskan di consume)
  s = setup({}); assert.strictEqual(s.svc.canPlay(), true);

  // jaringan gagal tidak melempar
  s = setup({ hearts_consume: async () => { throw new Error('network down'); } });
  r = await s.svc.consume(); assert.deepStrictEqual([r.ok, r.reason], [false, 'jaringan']);
  s = setup({ hearts_get: async () => ({ data: null, error: { message: 'AUTH_REQUIRED' } }) });
  assert.strictEqual((await s.svc.get()).reason, 'belum-login');

  // satu consume sekali jalan: panggilan kedua saat masih berjalan ditolak
  let release; const gate = new Promise(res => { release = res; });
  s = setup({ hearts_consume: async () => { await gate; return { data: { ok: true, hearts: 4, max: 5, regen_secs: 300, next_in_secs: 300 }, error: null }; } });
  const a = s.svc.consume(), b = await s.svc.consume();
  assert.strictEqual(b.reason, 'sedang-diproses'); release(); assert.strictEqual((await a).ok, true);
  assert.strictEqual(s.calls.length, 1);

  // tahap 2: kirim hati ke teman
  s = setup({ hearts_send: async a => ({ data: { ok: true, fee: 2, gold: true, sent_today: 1, limit: 25, echo: a.p_friend }, error: null }),
              hearts_friends: async () => ({ data: { ok: true, limit: 25, sent_today: 0, friends: [] }, error: null }) });
  r = await s.svc.send('abc'); assert.deepStrictEqual([r.ok, r.fee, r.gold], [true, 2, true]);
  assert.deepStrictEqual(s.calls[0], ['hearts_send', { p_friend: 'abc' }]);
  assert.strictEqual((await s.svc.friends()).limit, 25);
  s = setup({}, { enabled: false });
  assert.strictEqual((await s.svc.send('x')).reason, 'mode-lokal'); assert.strictEqual(s.calls.length, 0);
  s = setup({ hearts_send: async () => { throw new Error('down'); } });
  assert.strictEqual((await s.svc.send('x')).reason, 'jaringan');

  console.log('hearts-service: semua lulus');
})().catch(e => { console.error(e); process.exit(1); });

