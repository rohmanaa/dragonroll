/* Tes klien Tambang World (tanpa jaringan): pembungkus RPC tambang_*, penolakan lokal, tidak dobel, cermin saldo, kegagalan tidak melempar. */
const assert = require('assert');
const { create } = require('../src/tambang/js/tambang-service.js');

function setup(handlers, opts) {
  opts = opts || {};
  const calls = [], wallet = [];
  const PD = { serverMode: () => opts.enabled !== false, applyServerWallet: o => wallet.push(o) };
  const client = { rpc: async (name, args) => { calls.push([name, args]); const h = handlers[name]; if (!h) return { data: null, error: { message: 'no handler ' + name } }; return h(args); } };
  return { svc: create({ PlayerData: PD, getClient: async () => client }), calls, wallet };
}
const ok = d => ({ data: d, error: null });

(async () => {
  // get: memanggil tambang_get, menyegarkan saldo
  let s = setup({ tambang_get: async () => ok({ ok: true, coins: 900, gems: 3, mines: [] }) });
  let r = await s.svc.get();
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(s.calls[0], ['tambang_get', {}]);
  assert.deepStrictEqual(s.wallet[0], { coins: 900, gems: 3 });

  // mode lokal / belum login
  s = setup({}, { enabled: false });
  assert.strictEqual((await s.svc.get()).reason, 'mode-lokal');
  assert.strictEqual((await s.svc.claim()).reason, 'mode-lokal');
  assert.strictEqual(s.calls.length, 0, 'tidak memanggil server saat mode lokal');
  s = setup({ tambang_get: async () => ({ data: null, error: { message: 'AUTH_REQUIRED' } }) });
  assert.strictEqual((await s.svc.get()).reason, 'belum-login');

  // validasi lokal: slot / jenis tidak valid tidak sampai ke server (5 tambang: 1..5)
  s = setup({});
  assert.strictEqual((await s.svc.unlock(0)).reason, 'slot-tidak-valid');
  assert.strictEqual((await s.svc.unlock(6)).reason, 'slot-tidak-valid');
  assert.strictEqual((await s.svc.boost('x')).reason, 'slot-tidak-valid');
  assert.strictEqual((await s.svc.upgrade(1, 'rate')).reason, 'jenis-tidak-valid');
  assert.strictEqual((await s.svc.liftUpgrade('speed')).reason, 'jenis-tidak-valid');
  assert.strictEqual((await s.svc.gudangUpgrade('day')).reason, 'jenis-tidak-valid');   // server tidak punya batas klaim harian
  assert.strictEqual((await s.svc.hire('lift')).reason, 'jenis-tidak-valid');
  assert.strictEqual((await s.svc.sell('goods', 'copper', 0)).reason, 'jumlah-tidak-valid');
  assert.strictEqual(s.calls.length, 0);

  // argumen RPC benar + cermin saldo (dari hasil langsung maupun dari state)
  s = setup({
    tambang_unlock: async () => ok({ ok: true, coins: 500, gems: 12 }),
    tambang_upgrade: async () => ok({ ok: false, reason: 'saldo-kurang' }),
    tambang_manager: async () => ok({ ok: true, state: { coins: 100, gems: 9 } }),
    tambang_lift_upgrade: async () => ok({ ok: true, coins: 40, gems: 9 }),
    tambang_gudang_upgrade: async () => ok({ ok: true, coins: 30, gems: 9 }),
    tambang_hire: async () => ok({ ok: true, coins: 20, gems: 9 }),
    tambang_sell: async () => ok({ ok: true, coins: 2000, gems: 9 }),
    tambang_sell_all: async () => ok({ ok: true, coins: 3000, gems: 10 }),
    tambang_claim: async () => ok({ ok: true }),
    tambang_sweep: async () => ok({ ok: true }),
    tambang_work: async () => ok({ ok: true })
  });
  assert.strictEqual((await s.svc.unlock(2)).ok, true);
  assert.strictEqual((await s.svc.upgrade(2, 'speed')).reason, 'saldo-kurang');
  assert.strictEqual((await s.svc.manager(5)).ok, true);
  await s.svc.liftUpgrade('spd'); await s.svc.gudangUpgrade('off'); await s.svc.hire('forest');
  await s.svc.sell('goods', 'copper', 3); await s.svc.sell('ore', 'coal'); await s.svc.sellAll();
  await s.svc.claim(); await s.svc.sweep(); await s.svc.work();
  assert.deepStrictEqual(s.calls.map(c => c[0]), ['tambang_unlock', 'tambang_upgrade', 'tambang_manager', 'tambang_lift_upgrade', 'tambang_gudang_upgrade', 'tambang_hire', 'tambang_sell', 'tambang_sell', 'tambang_sell_all', 'tambang_claim', 'tambang_sweep', 'tambang_work']);
  assert.deepStrictEqual(s.calls[0][1], { p_slot: 2 });
  assert.deepStrictEqual(s.calls[6][1], { p_grp: 'goods', p_item: 'copper', p_qty: 3 });
  assert.deepStrictEqual(s.calls[7][1], { p_grp: 'ore', p_item: 'coal' }, 'tanpa qty = jual semua');
  assert.deepStrictEqual(s.wallet[0], { coins: 500, gems: 12 });
  assert.deepStrictEqual(s.wallet[1], { coins: 100, gems: 9 }, 'saldo dari state ikut dicerminkan');

  // tidak dobel: aksi kedua saat yang pertama berjalan ditolak
  let release; const gate = new Promise(res => { release = res; });
  s = setup({ tambang_claim: async () => { await gate; return ok({ ok: true, coins: 1, gems: 1 }); } });
  const p1 = s.svc.claim(), p2 = await s.svc.claim();
  assert.strictEqual(p2.reason, 'sedang-diproses');
  release(); assert.strictEqual((await p1).ok, true);
  assert.strictEqual(s.calls.length, 1);

  // kegagalan jaringan tidak melempar
  s = setup({ tambang_sweep: async () => { throw new Error('offline'); } });
  r = await s.svc.sweep();
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'jaringan');

  console.log('ok - tambang-service: RPC, validasi, cermin saldo, anti-dobel, tanpa lempar');
})().catch(e => { console.error(e); process.exit(1); });

