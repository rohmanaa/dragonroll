/* Tes sistem Chest (klien): method WalletService.chest* memanggil RPC yang benar, tanpa nominal dari klien, cermin saldo dari hasil server.
   Tes statis: tab Chest di Inventory, tombol di Lobby, aset gambar, dan migrasi. Jalankan: node tests/chest-service.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const Svc = require('../assets/js/services/wallet-service.js');
const root = p => path.join(__dirname, '..', p);
let n = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);

function fake(handlers, on) {
  const calls = [], mirrored = [];
  const PD = { applyServerWallet: o => mirrored.push(o), serverMode: () => on !== false };
  const getClient = async () => ({ rpc: async (name, args) => {
    calls.push({ name, args });
    const h = handlers[name]; if (!h) return { error: { message: 'rpc ' + name + ' tidak ada' } };
    try { return { data: await h(args || {}) }; } catch (e) { return { error: { message: e.message } }; }
  } });
  return { calls, mirrored, svc: Svc.create({ PlayerData: PD, getClient, enabled: () => on !== false }) };
}

t('tanpa akun: semua method chest mode-lokal, tidak ada panggilan server', async () => {
  const f = fake({}, false);
  for (const r of [await f.svc.chestGet(), await f.svc.chestClaimDaily('wood'), await f.svc.chestStart(1), await f.svc.chestOpenNow(1), await f.svc.chestCollect(1)])
    assert.strictEqual(r.reason, 'mode-lokal');
  assert.strictEqual(f.calls.length, 0);
});
t('chestGet: memanggil chest_get tanpa argumen', async () => {
  const f = fake({ chest_get: () => ({ ok: true, daily: [], chests: [] }) });
  const r = await f.svc.chestGet();
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(f.calls, [{ name: 'chest_get', args: {} }]);
});
t('chestClaimDaily: hanya kirim jenis chest; id dibulatkan untuk start/skip/collect', async () => {
  const f = fake({ chest_claim_daily: () => ({ ok: true }), chest_start: () => ({ ok: true }), chest_open_now: () => ({ ok: true }), chest_collect: () => ({ ok: true }) });
  await f.svc.chestClaimDaily('gold'); await f.svc.chestStart('7'); await f.svc.chestOpenNow(8.9); await f.svc.chestCollect(9);
  assert.deepStrictEqual(f.calls, [
    { name: 'chest_claim_daily', args: { p_kind: 'gold' } }, { name: 'chest_start', args: { p_id: 7 } },
    { name: 'chest_open_now', args: { p_id: 8 } }, { name: 'chest_collect', args: { p_id: 9 } }]);
});
t('chestCollect: saldo dicerminkan dari angka server', async () => {
  const f = fake({ chest_collect: () => ({ ok: true, coins: 80, gems: 0, xp: 10, wallet_coins: 1080, wallet_gems: 3 }) });
  const r = await f.svc.chestCollect(1);
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(f.mirrored, [{ coins: 1080, gems: 3 }]);
});
t('penolakan server (ok:false) tidak mengubah saldo', async () => {
  const f = fake({ chest_open_now: () => ({ ok: false, reason: 'gem-kurang', cost: 4 }) });
  const r = await f.svc.chestOpenNow(1);
  assert.strictEqual(r.reason, 'gem-kurang'); assert.strictEqual(f.mirrored.length, 0);
});
t('ketuk ganda: permintaan sama yang masih berjalan ditolak (sedang-diproses)', async () => {
  let release; const gate = new Promise(r => { release = r; });
  const f = fake({ chest_collect: async () => { await gate; return { ok: true, wallet_coins: 1, wallet_gems: 0 }; } });
  const a = f.svc.chestCollect(1), b = await f.svc.chestCollect(1);
  assert.strictEqual(b.reason, 'sedang-diproses'); release(); assert.strictEqual((await a).ok, true);
  assert.strictEqual(f.calls.length, 1);
});
t('error jaringan / AUTH_REQUIRED dipetakan, tidak melempar', async () => {
  const f = fake({ chest_start: () => { throw new Error('AUTH_REQUIRED'); }, chest_collect: () => { throw new Error('boom'); } });
  assert.strictEqual((await f.svc.chestStart(1)).reason, 'belum-login');
  assert.strictEqual((await f.svc.chestCollect(1)).reason, 'jaringan');
});
t('statis: tab Chest di Inventory memuat aset yang ada; chest.html sudah dihapus', () => {
  const ij = fs.readFileSync(root('assets/js/pages/inventory.js'), 'utf8'), ih = fs.readFileSync(root('inventory.html'), 'utf8'), lh = fs.readFileSync(root('lobby.html'), 'utf8');
  ['chest.html', 'assets/js/pages/chest.js', 'assets/css/chest.css'].forEach(f => assert.ok(!fs.existsSync(root(f)), f + ' harus sudah dihapus'));
  [...ij.matchAll(/im: '(chest-packs\/[\w\-]+)'/g)].map(m => m[1]).forEach(p => assert.ok(fs.existsSync(root('assets/images/ui/' + p + '.webp')), 'aset hilang: ' + p));
  [...(lh + ih).matchAll(/assets\/images\/ui\/[\w\-\/]+\.webp/g)].map(m => m[0]).forEach(p => assert.ok(fs.existsSync(root(p)), 'aset hilang: ' + p));
  assert.ok(ij.includes("diamond: { nm:") && ih.includes('data-k="chest"') && ih.includes('services/wallet-service.js'));
});
t('statis: Lobby = modal timeline klaim (Kayu/Silver/Gold); Inventory = slot chest yang dimiliki, ketuk untuk buka', () => {
  const lj = fs.readFileSync(root('data/lobby/js/lobby.js'), 'utf8'), lh = fs.readFileSync(root('lobby.html'), 'utf8'), ij = fs.readFileSync(root('assets/js/pages/inventory.js'), 'utf8');
  assert.ok(/id="b-chest" data-act="chest"/.test(lh) && lh.indexOf('id="b-chest"') < lh.indexOf('id="b-inv"'));
  assert.ok(!/id="grp"[\s\S]*data-act="chest"[\s\S]*id="grpt"/.test(lh), 'Chest tidak di grup lipat');
  assert.ok(/id="chestMd"/.test(lh) && /act==='chest'\)\{openChest\(\)/.test(lj) && !/chest:'chest\.html'/.test(lj));
  assert.ok(lj.includes('chestClaimDaily') && !/chestCollect|chestStart|chestOpenNow/.test(lj), 'lobby hanya mengklaim, tidak membuka');
  assert.ok(lj.includes('plays_today') && lj.includes('chestFill'), 'timeline memakai progres game dari server');
  assert.ok(ij.includes('chestCollect') && !/chestClaimDaily|chestStart|chestOpenNow|secsLeft|seconds_left|data-claim/.test(ij), 'inventory hanya membuka, tanpa klaim/timer');
  assert.ok(ij.includes("data-kind") && ij.includes('id="cact"') && ij.includes('>BUKA<') && ij.includes('Dimiliki'), 'pola Power-up: pilih slot, satu tombol BUKA, jumlah dimiliki');
  const lc = fs.readFileSync(root('assets/css/pages/lobby.css'), 'utf8');
  assert.ok(/#chestMd\{position:fixed;inset:0/.test(lc), 'backdrop fixed memenuhi layar');
  assert.ok(lh.indexOf('id="chestMd"') > lh.indexOf('id="fade"') - 900 && !/<div id="stage"[^]*<div id="chestMd"[^]*<div id="fade"/.test(lh.replace(/<div id="chestMd"[^]*?<\/div><\/div>/, '')) === true, 'modal di luar #stage');
  const tabs = require('../assets/js/core/inv-tabs.js');
  assert.deepStrictEqual(tabs.GROUPS.inv.keys, ['power', 'chest', 'ore', 'log']);
});
t('timeline Lobby: bar maju per ruas menurut jumlah game', () => {
  const lj = fs.readFileSync(root('data/lobby/js/lobby.js'), 'utf8');
  const m = lj.match(/const CPOS=\[[^\]]*\],CSTART=\d+;\nfunction chestFill[\s\S]*?return CPOS\[CPOS\.length-1\]\}/);
  assert.ok(m, 'chestFill ditemukan');
  const chestFill = new Function(m[0] + '; return chestFill;')();
  const need = [1, 3, 10];
  assert.strictEqual(chestFill(0, need), 4);
  assert.strictEqual(chestFill(1, need), 16);
  assert.strictEqual(chestFill(3, need), 50);
  assert.strictEqual(chestFill(10, need), 84);
  assert.strictEqual(chestFill(25, need), 84);
  const mid = chestFill(2, need); assert.ok(mid > 16 && mid < 50);
});
t('migrasi: chest_collect tanpa timer menerima status stored & tidak mengecek open_ready_at', () => {
  const sql = fs.readFileSync(root('supabase/migrations/202611430001_chest_no_timer.sql'), 'utf8');
  assert.ok(sql.includes("v_c.status not in ('stored', 'opening')") && !sql.includes('open_ready_at >'));
  assert.ok(sql.includes("'collect:' || p_id") && sql.includes("'duplicate'") && sql.includes('grant execute on function public.chest_collect(bigint) to authenticated'));
  assert.ok(sql.indexOf("'duplicate'") < sql.indexOf('player_inventory'));
});
t('statis: migrasi chest punya versi unik & RPC klien dikunci ke authenticated', () => {
  const files = fs.readdirSync(root('supabase/migrations')), v = files.map(f => f.split('_')[0]);
  assert.strictEqual(new Set(v).size, v.length, 'versi migrasi bentrok');
  const sql = fs.readFileSync(root('supabase/migrations/' + files.find(f => /chest_system/.test(f))), 'utf8');
  ['chest_get()', 'chest_claim_daily(text)', 'chest_start(bigint)', 'chest_open_now(bigint)', 'chest_collect(bigint)'].forEach(sig =>
    assert.ok(sql.includes('grant execute on function public.' + sig + ' to authenticated'), 'grant hilang: ' + sig));
});

t('chestBuy: hanya kirim jenis chest; saldo dicerminkan dari server; ditolak tidak mengubah saldo', async () => {
  const f = fake({ chest_buy: a => a.p_kind === 'diamond' ? { ok: false, reason: 'gem-kurang' } : { ok: true, id: 5, wallet_coins: 910, wallet_gems: 0 } });
  const ok = await f.svc.chestBuy('wood'), no = await f.svc.chestBuy('diamond');
  assert.strictEqual(ok.ok, true); assert.deepStrictEqual(f.mirrored, [{ coins: 910, gems: 0 }]);
  assert.strictEqual(no.reason, 'gem-kurang');
  assert.deepStrictEqual(f.calls.map(c => c.args), [{ p_kind: 'wood' }, { p_kind: 'diamond' }]);
  assert.strictEqual((await fake({}, false).svc.chestBuy('wood')).reason, 'mode-lokal');
});
t('shop: tombol beli aktif (tidak ada "SEGERA HADIR" di kartu chest) dan harga di klien = harga di SQL', () => {
  const js = fs.readFileSync(root('assets/js/pages/shop-page.js'), 'utf8');
  const card = js.slice(js.indexOf('function renderChest'), js.indexOf('function renderEmerald'));
  assert.ok(card.includes('data-chest') && !/SEGERA HADIR|Fitur belum tersedia/.test(card));
  const sql = fs.readFileSync(root('supabase/migrations/202611370001_chest_shop.sql'), 'utf8');
  const shop = [...sql.slice(sql.indexOf('_chest_shop()')).matchAll(/\('(\w+)',\s*(\d+),\s*(\d+)\)/g)].map(m => [m[1], +m[2], +m[3]]);
  assert.strictEqual(shop.length, 4);
  shop.forEach(([kind, coins, gems]) => {
    const m = js.match(new RegExp("kind: '" + kind + "'[^}]*?(coins|gems): (\\d+)"));
    assert.ok(m, 'kartu shop hilang: ' + kind);
    assert.strictEqual(+m[2], m[1] === 'coins' ? coins : gems, 'harga beda: ' + kind);
    assert.ok(m[1] === 'coins' ? gems === 0 : coins === 0);
  });
});
t('migrasi shop: chest_buy TERBARU langsung membuka (tanpa timer/penyimpanan), saldo dicek sebelum chest dibuat, dikunci ke authenticated', () => {
  const files = fs.readdirSync(root('supabase/migrations')).sort().filter(f => /function public\.chest_buy/.test(fs.readFileSync(root('supabase/migrations/' + f), 'utf8')));
  const sql = fs.readFileSync(root('supabase/migrations/' + files[files.length - 1]), 'utf8');
  const b = sql.slice(sql.indexOf('function public.chest_buy'));
  assert.ok(b.indexOf("'saldo-kurang'") < b.indexOf('insert into public.player_chest') && b.indexOf("'gem-kurang'") < b.indexOf('insert into public.player_chest'));
  assert.ok(b.includes("'collected'") && b.includes("'chest_buy', 'buy:'") && b.includes("'chest', 'collect:'") && b.includes('_chest_roll(p_kind)'));
  assert.ok(!/'stored'|'opening'|'penuh'|_chest_open_secs/.test(b), 'chest beli tidak boleh memakai penyimpanan/timer');
  assert.ok(sql.includes('grant execute on function public.chest_buy(text) to authenticated'));
  assert.ok(sql.includes("'coins', (v_rw ->> 'coins')::int") && sql.includes("'wallet_coins'"));
});
t('shop: chest dibeli langsung tampil hadiah (revealChest) dan tidak lagi mengarahkan ke penyimpanan', () => {
  const js = fs.readFileSync(root('assets/js/pages/shop-page.js'), 'utf8');
  assert.ok(js.includes('function revealChest') && js.includes('r.coins') && js.includes('r.xp'));
  assert.ok(!/masuk ke penyimpanan|data-go="chest\.html"/.test(js));
});

t('Power dari chest: roll berbobot 1/harga, masuk stok akun (maks 999) di collect & buy, ditampilkan di klien; Diamond dibesarkan', () => {
  const sql = fs.readFileSync(root('supabase/migrations/202611400001_chest_power.sql'), 'utf8');
  ['v_pc := 0.05', 'v_pc := 0.12', 'v_pc := 0.20', 'v_pc := 0.35', '1000 + floor(random() * 401)', 'v_g := 3',
   "kind = 'powerup'", '(-ln(1 - random())) * price_coins', "'power', v_pw"].forEach(x => assert.ok(sql.includes(x), x));
  assert.strictEqual((sql.match(/least\(999, public\.player_inventory\.qty \+ 1\)/g) || []).length, 2);   // collect + buy
  assert.ok(sql.includes('grant execute on function public.chest_collect(bigint) to authenticated') && sql.includes('grant execute on function public.chest_buy(text) to authenticated'));
  const b = sql.slice(sql.indexOf('function public.chest_buy')), c = sql.slice(sql.indexOf('function public.chest_collect'), sql.indexOf('function public.chest_buy'));
  assert.ok(c.indexOf("'duplicate'") < c.indexOf('player_inventory'), 'stok Power hanya setelah dompet non-duplikat');
  assert.ok(b.indexOf("'saldo-kurang'") < b.indexOf('insert into public.player_inventory'));
  const shop = fs.readFileSync(root('assets/js/pages/shop-page.js'), 'utf8'), ch = fs.readFileSync(root('assets/js/pages/inventory.js'), 'utf8');
  assert.ok(shop.includes('powerRow(r.power)') && ch.includes('cReward.power'));
});

(async () => {
  for (const [name, fn] of queue) { try { await fn(); n++; console.log('ok  - ' + name); } catch (e) { console.error('GAGAL - ' + name + '\n' + (e.stack || e)); process.exit(1); } }
  console.log(n + ' tes lulus');
})();
