/* Tes klien Mail (tanpa jaringan): pembungkus RPC, validasi id, tidak dobel, cermin saldo, kegagalan tidak melempar. */
const assert = require('assert');
const { create } = require('../assets/js/mail-service.js');
const ID = '11111111-2222-3333-4444-555555555555';

function setup(handlers, opts) {
  opts = opts || {};
  const calls = [], wallet = [];
  const PD = { serverMode: () => opts.enabled !== false, applyServerWallet: o => wallet.push(o) };
  const client = { rpc: async (name, args) => { calls.push([name, args]); const h = handlers[name]; if (!h) return { data: null, error: { message: 'no handler ' + name } }; return h(args); } };
  return { svc: create({ PlayerData: PD, getClient: async () => client }), calls, wallet };
}
const ok = d => async () => ({ data: d, error: null });

(async () => {
  // list: memetakan surat, membatasi limit
  let s = setup({ mail_list: ok({ ok: true, unread: 2, pending: 1, mails: [
    { id: ID, kind: 'reward', title: 'Hadiah', body: 'Isi', coins: 500, gems: 2, at: '2026-11-11T00:00:00Z', read: false, claimed: false },
    { id: 'b', kind: 'aneh', title: null, body: null, coins: 'x', gems: 0, at: null, read: true, claimed: false }] }) });
  let r = await s.svc.list(9999);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.unread, 2); assert.strictEqual(r.pending, 1);
  assert.deepStrictEqual(s.calls[0], ['mail_list', { p_limit: 100 }]);
  assert.strictEqual(r.mails[0].coins, 500); assert.strictEqual(r.mails[1].kind, 'system'); assert.strictEqual(r.mails[1].coins, 0);
  s = setup({ mail_list: ok({ ok: true, mails: [] }) });
  await s.svc.list(); assert.deepStrictEqual(s.calls[0], ['mail_list', { p_limit: 50 }]);

  // mode lokal / belum login: tidak menyentuh server
  s = setup({}, { enabled: false });
  for (const f of ['list', 'summary', 'readAll', 'claimAll']) assert.strictEqual((await s.svc[f]()).reason, 'mode-lokal', f);
  assert.strictEqual((await s.svc.claim(ID)).reason, 'mode-lokal');
  assert.strictEqual(s.calls.length, 0);
  s = setup({ mail_list: async () => ({ data: null, error: { message: 'AUTH_REQUIRED' } }) });
  assert.strictEqual((await s.svc.list()).reason, 'belum-login');
  s = setup({ mail_list: async () => { throw new Error('offline'); } });
  assert.strictEqual((await s.svc.list()).reason, 'jaringan');

  // id tidak valid tidak sampai ke server
  s = setup({});
  for (const f of ['read', 'claim', 'remove']) assert.strictEqual((await s.svc[f]('bukan-uuid')).reason, 'tidak-ada', f);
  assert.strictEqual(s.calls.length, 0);

  // summary
  s = setup({ mail_summary: ok({ ok: true, unread: 3, pending: 1 }) });
  r = await s.svc.summary(); assert.deepStrictEqual([r.ok, r.unread, r.pending], [true, 3, 1]);

  // klaim: saldo server masuk ke cermin; hasil gagal tidak mengubah saldo
  s = setup({ mail_claim: ok({ ok: true, coins: 1500, gems: 4, reward: { coins: 500, gems: 2 } }) });
  r = await s.svc.claim(ID);
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(s.calls[0], ['mail_claim', { p_id: ID }]);
  assert.deepStrictEqual(s.wallet, [{ coins: 1500, gems: 4 }]);
  s = setup({ mail_claim: ok({ ok: false, reason: 'sudah-diklaim' }) });
  r = await s.svc.claim(ID); assert.strictEqual(r.reason, 'sudah-diklaim'); assert.strictEqual(s.wallet.length, 0);
  s = setup({ mail_claim_all: ok({ ok: true, count: 3, coins: 900, gems: 1, reward: { coins: 400, gems: 1 } }) });
  r = await s.svc.claimAll(); assert.strictEqual(r.count, 3); assert.deepStrictEqual(s.wallet, [{ coins: 900, gems: 1 }]);

  // tidak dobel: klaim kedua saat yang pertama masih jalan ditolak (klaim & klaim semua berbagi kunci)
  let release; const gate = new Promise(res => { release = res; });
  s = setup({ mail_claim: async () => { await gate; return { data: { ok: true, coins: 1, gems: 0 }, error: null }; }, mail_claim_all: ok({ ok: true, count: 1 }) });
  const p1 = s.svc.claim(ID);
  assert.strictEqual((await s.svc.claim(ID)).reason, 'sedang-diproses');
  assert.strictEqual((await s.svc.claimAll()).reason, 'sedang-diproses');
  release(); assert.strictEqual((await p1).ok, true);
  assert.strictEqual(s.calls.filter(c => c[0].indexOf('mail_claim') === 0).length, 1);

  // baca / hapus / baca semua
  s = setup({ mail_read: ok({ ok: true }), mail_delete: ok({ ok: false, reason: 'hadiah-belum-diklaim' }), mail_read_all: ok({ ok: true, count: 2 }) });
  assert.strictEqual((await s.svc.read(ID)).ok, true);
  assert.strictEqual((await s.svc.remove(ID)).reason, 'hadiah-belum-diklaim');
  assert.strictEqual((await s.svc.readAll()).count, 2);
  assert.deepStrictEqual(s.calls.map(c => c[0]), ['mail_read', 'mail_delete', 'mail_read_all']);

  console.log('ok - mail-service'); console.log('1 tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
