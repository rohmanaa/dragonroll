/* Tes klien tambang (tanpa jaringan): pembungkus RPC, penolakan lokal, tidak dobel, cermin saldo, kegagalan tidak melempar. */
const assert = require('assert');
const { create } = require('../assets/js/mine-service.js');

function setup(handlers, opts) {
  opts = opts || {};
  const calls = [], wallet = [];
  const PD = { serverMode: () => opts.enabled !== false, applyServerWallet: o => wallet.push(o) };
  const client = { rpc: async (name, args) => { calls.push([name, args]); const h = handlers[name]; if (!h) return { data: null, error: { message: 'no handler ' + name } }; return h(args); } };
  return { svc: create({ PlayerData: PD, getClient: async () => client }), calls, wallet };
}

(async () => {
  // get: memanggil mine_get, menyegarkan saldo
  let s = setup({ mine_get: async () => ({ data: { ok: true, coins: 900, gems: 3, slots: [] }, error: null }) });
  let r = await s.svc.get();
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(s.calls[0], ['mine_get', {}]);
  assert.deepStrictEqual(s.wallet[0], { coins: 900, gems: 3 });

  // mode lokal / belum login
  s = setup({}, { enabled: false });
  assert.strictEqual((await s.svc.get()).reason, 'mode-lokal');
  assert.strictEqual((await s.svc.collect(1)).reason, 'mode-lokal');
  assert.strictEqual(s.calls.length, 0, 'tidak memanggil server saat mode lokal');
  s = setup({ mine_get: async () => ({ data: null, error: { message: 'AUTH_REQUIRED' } }) });
  assert.strictEqual((await s.svc.get()).reason, 'belum-login');

  // validasi lokal: slot dan jenis tidak valid tidak sampai ke server
  s = setup({});
  assert.strictEqual((await s.svc.unlock(0)).reason, 'slot-tidak-valid');
  assert.strictEqual((await s.svc.collect('x')).reason, 'slot-tidak-valid');
  assert.strictEqual((await s.svc.upgrade(1, 'rate')).reason, 'jenis-tidak-valid');
  assert.strictEqual(s.calls.length, 0);

  // argumen RPC benar + cermin saldo untuk aksi
  s = setup({
    mine_collect: async a => ({ data: { ok: true, collected: 2, coins: 500, gems: 7 }, error: null }),
    mine_upgrade: async a => ({ data: { ok: false, reason: 'saldo-kurang' }, error: null }),
    mine_boost: async a => ({ data: { ok: true, coins: 350, gems: 7 }, error: null }),
    mine_unlock: async a => ({ data: { ok: true, coins: 500, gems: 0 }, error: null })
  });
  r = await s.svc.collect(2); assert.strictEqual(r.collected, 2); assert.deepStrictEqual(s.calls[0], ['mine_collect', { p_slot: 2 }]);
  r = await s.svc.upgrade(1, 'cap'); assert.strictEqual(r.reason, 'saldo-kurang'); assert.deepStrictEqual(s.calls[1], ['mine_upgrade', { p_slot: 1, p_kind: 'cap' }]);
  r = await s.svc.boost(3); assert.strictEqual(r.ok, true);
  r = await s.svc.unlock(1); assert.strictEqual(r.ok, true);
  assert.strictEqual(s.wallet.length, 3, 'hasil tanpa saldo (gagal) tidak menyentuh cermin');

  // klik cepat: permintaan kedua ditolak selagi yang pertama berjalan
  let release; const gate = new Promise(res => { release = res; });
  s = setup({ mine_collect: async () => { await gate; return { data: { ok: true, collected: 1, coins: 1, gems: 1 }, error: null }; } });
  const p1 = s.svc.collect(1), p2 = s.svc.collect(1);
  assert.strictEqual((await p2).reason, 'sedang-diproses');
  release(); assert.strictEqual((await p1).ok, true);
  assert.strictEqual(s.calls.length, 1, 'hanya satu RPC terkirim');
  assert.strictEqual((await s.svc.collect(1)).ok, true, 'setelah selesai bisa lagi');

  // kegagalan jaringan tidak melempar
  s = setup({ mine_collect: async () => { throw new Error('offline'); } });
  r = await s.svc.collect(1); assert.deepStrictEqual([r.ok, r.reason], [false, 'jaringan']);

  console.log('ok - mine-service');
  console.log('1 tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
