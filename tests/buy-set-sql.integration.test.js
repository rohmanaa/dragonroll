/* Tes integrasi buy_set: klien ASLI (WalletService + PlayerData) terhadap SQL ASLI di Postgres uji.
   Tidak jalan tanpa PSQL_CMD (DB uji dengan migrasi sampai 202611140001), jadi aman di CI biasa. Contoh:
     PSQL_CMD="psql -X -q -At -v ON_ERROR_STOP=1 -d ulartangga_test" node tests/buy-set-sql.integration.test.js
   Isi: (1) [dihapus di Tahap 3c: paritas dengan PlayerData.purchaseSet lokal]; (2) klien server memakai WalletService.buySet -> cermin cocok dengan DB; (3) dua buy_set paralel tidak menagih dua kali. */
if (!process.env.PSQL_CMD) { console.log('dilewati: set PSQL_CMD untuk menjalankan tes integrasi buy_set'); process.exit(0); }
const assert = require('assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs'), path = require('path'), vm = require('vm');
const WS = require('../assets/js/wallet-service.js');

function q(sql) {
  return new Promise((res, rej) => {
    const p = spawn('sh', ['-c', process.env.PSQL_CMD]); let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? res(out.trim()) : rej(new Error(err.trim() || ('psql exit ' + code))));
    p.stdin.end(sql);
  });
}
const lit = v => Array.isArray(v) ? 'ARRAY[' + v.map(lit).join(',') + ']::text[]' : v === null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
async function asUser(uid, call) {
  const out = await q("set role authenticated; set request.jwt.claim.sub = '" + uid + "'; select to_jsonb(" + call + ");");
  return JSON.parse(out);
}
const users = [];
async function newUser() { const id = crypto.randomUUID(); await q("insert into auth.users(id) values ('" + id + "')"); users.push(id); return id; }
async function dbState(uid) {
  const w = await q("select coins from public.player_wallet where user_id='" + uid + "'");
  const inv = await q("select coalesce(string_agg(item_id, ',' order by item_id), '') from public.player_inventory where user_id='" + uid + "'");
  const led = await q("select count(*) from public.wallet_ledger where user_id='" + uid + "'");
  return { coins: w === '' ? null : +w, inv: inv ? inv.split(',') : [], ledger: +led };
}

function boot(opts) {
  opts = opts || {}; const store = Object.assign({}, opts.store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls }; if (opts.flag) w.UT_SERVER_WALLET = true; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, IC: ctx.ItemCatalog };
}
const gear = IC => IC.items.filter(i => i.kind === 'gear' && !i.starter && i.price > 0 && !i.stackable).map(i => i.id).sort();
const pick = r0 => { const r = JSON.parse(JSON.stringify(r0)); return { ok: r.ok, reason: r.reason || null, spent: r.spent == null ? null : +r.spent, kurang: r.kurang == null ? null : +r.kurang,
  items: r.items ? r.items.slice().sort() : null, skipped: r.skipped ? r.skipped.slice().sort() : null, coins: r.coins == null ? null : +r.coins }; };

const queue = []; const t = (n, f) => queue.push([n, f]);
const G = gear(boot().IC);
const starter = boot().IC.items.find(i => i.kind === 'gear' && i.starter).id;
const dice = boot().IC.items.find(i => i.kind === 'dice' && !i.starter && i.price > 0).id;
const cheap = boot().IC.items.filter(i => i.kind === 'gear' && !i.starter && i.price > 0).sort((a, b) => a.price - b.price).map(i => i.id);

const SCEN = [
  ['set biasa', [], [G[0], G[1], G[2]]],
  ['sebagian dimiliki', [G[0]], [G[0], G[1]]],
  ['semua dimiliki', [G[0], G[1]], [G[0], G[1]]],
  ['saldo kurang', [], G.slice(0, 12)],
  ['bukan gear', [], [G[0], dice]],
  ['starter', [], [G[0], starter]],
  ['tak dikenal', [], [G[0], 'gear.tidak-ada']],
  ['powerup', [], [G[0], 'tnt']],
  ['id berulang', [], [G[0], G[0], G[0]]],
  ['kosong', [], []],
  ['elemen null', [], [G[0], null]],
  ['21 unik', [], G.slice(0, 21)],
  ['20 unik (saldo kurang)', [], G.slice(0, 20)],
  ['25 mentah, 3 unik', [], new Array(25).fill(0).map((_, i) => cheap[i % 3])],
  ['201 mentah', [], new Array(201).fill(cheap[0])]
];
/* Tahap 3c: blok PARITAS (PlayerData.purchaseSet lokal vs buy_set) dihapus bersama jalur lokal. Skenario SCEN di atas dipakai sebagai dokumentasi aturan buy_set; aturan itu diuji di supabase/tests/wallet_buy_set_test.sql. */

t('KLIEN ASLI: WalletService.buySet terhadap SQL asli -> cermin cocok dengan DB; kegagalan tidak mengubah cermin', async () => {
  const uid = await newUser();
  const store = { 'ut-auth': JSON.stringify({ id: uid, username: 'tester' }) }; const { PD } = boot({ store, flag: true });
  const client = { rpc: async (name, args) => { try { return { data: await asUser(uid, 'public.' + name + '(' + Object.entries(args || {}).map(([k, v]) => k + ' => ' + lit(v)).join(',') + ')'), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; } } };
  const S = WS.create({ PlayerData: PD, getClient: async () => client });
  const r = await S.buySet([G[0], G[1], G[2]]); assert.strictEqual(r.ok, true);
  const db = await dbState(uid);
  assert.strictEqual(PD.coins(), db.coins); db.inv.forEach(id => assert.strictEqual(PD.owns(id), true)); assert.strictEqual(db.inv.length, 3);
  const bad = await S.buySet([G[3], 'gear.tidak-ada']); assert.strictEqual(bad.reason, 'tidak-tersedia');
  assert.strictEqual(PD.owns(G[3]), false); assert.deepStrictEqual(await dbState(uid), db);
  const short = await S.buySet(G.slice(3, 16)); assert.strictEqual(short.reason, 'saldo-kurang');
  assert.strictEqual(PD.coins(), db.coins); assert.deepStrictEqual(await dbState(uid), db);
  const down = WS.create({ PlayerData: PD, getClient: async () => ({ rpc: async () => ({ data: null, error: { message: 'Failed to fetch' } }) }) });
  assert.strictEqual((await down.buySet([G[5]])).reason, 'jaringan'); assert.strictEqual(PD.owns(G[5]), false); assert.deepStrictEqual(await dbState(uid), db);
});

t('KONKURENSI (deterministik): sesi 2 masuk saat sesi 1 belum commit -> menunggu kunci dompet, lalu melihat item sudah dimiliki', async () => {
  const uid = await newUser(); const ids = [G[0], G[1], G[2]];
  const price = boot().IC.items.filter(i => ids.includes(i.id)).reduce((a, i) => a + i.price, 0);
  await asUser(uid, 'public.buy_item(' + lit(G[9]) + ')');   /* dompet sudah ada: yang diuji kunci buy_set, bukan _wallet_ensure */
  const hold = q("begin; set role authenticated; set request.jwt.claim.sub = '" + uid + "'; select to_jsonb(public.buy_set(" + lit(ids) + ")); select pg_sleep(2); commit;");
  await new Promise(r => setTimeout(r, 700));
  const t0 = Date.now(); const second = pick(await asUser(uid, 'public.buy_set(' + lit(ids) + ')')); const waited = Date.now() - t0;
  const first = pick(JSON.parse((await hold).split('\n')[0]));
  assert.ok(waited > 800, 'sesi 2 harus menunggu sesi 1 (menunggu ' + waited + 'ms)');
  assert.strictEqual(first.ok, true); assert.strictEqual(first.spent, price); assert.strictEqual(first.items.length, 3);
  assert.strictEqual(second.ok, true, 'sesi 2 tidak boleh gagal sudah-dimiliki: ' + JSON.stringify(second));
  assert.strictEqual(second.spent, 0); assert.strictEqual(second.items.length, 0); assert.strictEqual(second.skipped.length, 3);
  const db = await dbState(uid); assert.strictEqual(db.inv.length, 4); assert.strictEqual(db.ledger, 3, 'start + buy_item + satu buy_set');
});

(async () => {
  let n = 0;
  try { for (const [name, fn] of queue) { await fn(); n++; console.log('ok -', name); } console.log(n + ' tes integrasi lulus'); }
  catch (e) { console.error('GAGAL:', e && e.stack || e); process.exitCode = 1; }
  finally { if (users.length) await q("delete from auth.users where id in (" + users.map(lit).join(',') + ")").catch(() => {}); }
})();
