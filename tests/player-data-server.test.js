/* Tes mode dompet server (B5): PlayerData overlay + WalletService. Jalankan: node game/tests/player-data-server.test.js */
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
let n = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);

/* Muat item-catalog.js + player-data.js ke "browser" tiruan baru (localStorage kosong tiap panggilan). */
function boot(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls };
  if (opts.flag) w.UT_SERVER_WALLET = true;
  if (opts.flagOff) w.UT_SERVER_WALLET = false;
  w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, IC: ctx.ItemCatalog, store, ctx };
}
const ACCT = { 'ut-auth': JSON.stringify({ id: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb', username: 'tester' }) };
const loginOn = () => boot({ store: ACCT, flag: true });
const buyable = IC => IC.items.find(i => !i.starter && i.price > 0);

t('tamu: perilaku lokal tidak berubah (flag menyala sekalipun)', () => {
  const { PD, IC } = boot({ flag: true });
  assert.strictEqual(PD.serverMode(), false);
  assert.strictEqual(PD.addCurrency(0, 5).ok, true);
  assert.strictEqual(PD.grant({ coins: 10 }).ok, true);
  assert.strictEqual(PD.applyServerWallet({ coins: 9 }).ok, false);
});
t('Tahap 3: akun login tanpa flag apa pun: mode server MENYALA bawaan', () => {
  const { PD } = boot({ store: ACCT });
  assert.strictEqual(PD.serverMode(), true);
  assert.strictEqual(PD.addCurrency(5, 0).reason, 'server-wallet');
});
t('saklar darurat: localStorage ut:serverWallet=0 mematikan mode server', () => {
  const { PD } = boot({ store: Object.assign({ 'ut:serverWallet': '0' }, ACCT) });
  assert.strictEqual(PD.serverMode(), false);
  assert.strictEqual(PD.addCurrency(5, 0).ok, true);
});
t('saklar darurat: window.UT_SERVER_WALLET=false mematikan mode server', () => {
  const { PD } = boot({ store: ACCT, flagOff: true });
  assert.strictEqual(PD.serverMode(), false);
});
t('Tahap 3: data tamu TIDAK dipindah ke akun baru; saldo awal akun bersih', () => {
  const guest = JSON.stringify({ v: 1, coins: 99999, gems: 99, migration: 1 });
  const { PD, store } = boot({ store: Object.assign({ 'ularTanggaBlok:player:v1': guest }, ACCT) });
  assert.notStrictEqual(PD.coins(), 99999);
  assert.strictEqual(store['ularTanggaBlok:player:v1'], guest, 'data tamu tidak disentuh');
});
t('akun login + flag: serverMode aktif', () => assert.strictEqual(loginOn().PD.serverMode(), true));
t('flag lewat localStorage juga berlaku', () => {
  const { PD } = boot({ store: Object.assign({ 'ut:serverWallet': '1' }, ACCT) });
  assert.strictEqual(PD.serverMode(), true);
});
t('mode server: purchase/addCurrency/grant(koin,gem,item) ditolak dan saldo tidak berubah', () => {
  const { PD, IC } = loginOn(); const c0 = PD.coins(), g0 = PD.gems();
  const it = buyable(IC); assert.ok(it, 'perlu item berbayar di katalog');
  assert.strictEqual(PD.purchase(it.id).reason, 'server-wallet');
  assert.strictEqual(PD.addCurrency(999, 99).reason, 'server-wallet');
  assert.strictEqual(PD.grant({ coins: 999 }).reason, 'server-wallet');
  assert.strictEqual(PD.grant({ gems: 9 }).reason, 'server-wallet');
  assert.strictEqual(PD.grant({ item: it.id }).reason, 'server-wallet');
  assert.strictEqual(PD.coins(), c0); assert.strictEqual(PD.gems(), g0); assert.strictEqual(PD.owns(it.id), false);
});
t('mode server: grant hanya XP tetap boleh', () => {
  const { PD } = loginOn(); const r = PD.grant({ xp: 30 });
  assert.strictEqual(r.ok, true); assert.strictEqual(PD.xp(), 30);
});
t('applyServerWallet mengisi cermin saldo + notifikasi', () => {
  const { PD } = loginOn(); const seen = []; PD.subscribe(r => seen.push(r));
  const r = PD.applyServerWallet({ coins: 4321, gems: 7 });
  assert.strictEqual(r.ok, true); assert.strictEqual(PD.coins(), 4321); assert.strictEqual(PD.gems(), 7);
  assert.ok(seen.includes('server-wallet'));
});
t('applyServerWallet menolak nilai tak valid (negatif/NaN) tanpa merusak saldo', () => {
  const { PD } = loginOn(); PD.applyServerWallet({ coins: 100, gems: 2 });
  PD.applyServerWallet({ coins: -5, gems: NaN });
  assert.strictEqual(PD.coins(), 100); assert.strictEqual(PD.gems(), 2);
});
t('inventory server menggantikan lokal; item awal selalu ada; id tak dikenal diabaikan', () => {
  const { PD, IC } = loginOn(); const it = buyable(IC);
  PD.applyServerWallet({ inventory: [{ id: it.id, qty: 1 }, { id: 'item.hantu', qty: 3 }] });
  assert.strictEqual(PD.owns(it.id), true); assert.strictEqual(PD.owns('item.hantu'), false);
  IC.starters().forEach(s => assert.strictEqual(PD.owns(s.id), true));
});
t('equip item yang hilang dari inventory server kembali ke default', () => {
  const { PD, IC } = loginOn(); const it = IC.items.find(i => !i.starter && i.slot);
  PD.applyServerWallet({ inventory: [{ id: it.id, qty: 1 }] });
  assert.strictEqual(PD.equip(it.id).ok, true);
  PD.applyServerWallet({ inventory: [] });
  assert.strictEqual(PD.equippedId(it.slot), IC.defaultEquipped[it.slot]);
});
t('applyServerItem menambah item beli; non-stackable tidak menggandakan', () => {
  const { PD, IC } = loginOn(); const it = IC.items.find(i => !i.starter && i.price > 0 && !i.stackable);
  PD.applyServerItem(it.id); PD.applyServerItem(it.id);
  assert.strictEqual(PD.qty(it.id), 1);
});
t('equip tetap lokal & bekerja untuk item yang dimiliki di cermin', () => {
  const { PD, IC } = loginOn(); const it = IC.items.find(i => !i.starter && i.slot);
  assert.strictEqual(PD.equip(it.id).reason, 'belum-dimiliki');
  PD.applyServerItem(it.id); assert.strictEqual(PD.equip(it.id).ok, true);
});
t('cermin dipisah per akun: akun lain tidak mewarisi saldo', () => {
  const a = loginOn(); a.PD.applyServerWallet({ coins: 777 });
  const other = boot({ store: Object.assign({}, a.store, { 'ut-auth': JSON.stringify({ id: 'cccccccc-1111-2222-3333-dddddddddddd', username: 'lain' }) }), flag: true });
  assert.notStrictEqual(other.PD.coins(), 777);
});
t('edit devtools pada saldo lokal ditimpa server saat refresh', () => {
  const { PD, store } = loginOn(); PD.applyServerWallet({ coins: 100 });
  const k = PD.key, s = JSON.parse(store[k]); s.coins = 9999999; store[k] = JSON.stringify(s);
  PD.applyServerWallet({ coins: 100 }); assert.strictEqual(PD.coins(), 100);
});

/* ---------- WalletService dengan klien Supabase palsu ---------- */
const WS = require('../assets/js/wallet-service.js');
function svc(handlers, flag) {
  const env = flag === false ? boot({ store: Object.assign({ 'ut:serverWallet': '0' }, ACCT) }) : loginOn();
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push([name, args]); const h = handlers[name]; if (!h) return { data: null, error: { message: 'no handler ' + name } }; const d = await h(args); return d && d.__err ? { data: null, error: { message: d.__err } } : { data: d, error: null }; } };
  return Object.assign(env, { calls, S: WS.create({ PlayerData: env.PD, getClient: async () => client }) });
}
const base = { wallet_get: () => ({ coins: 1000, gems: 0 }), inventory_get: () => [] };

t('WS: mode lokal -> tidak memanggil server', async () => {
  const e = svc(base, false); const r = await e.S.buy('x');
  assert.strictEqual(r.reason, 'mode-lokal'); assert.strictEqual(e.calls.length, 0);
});
t('WS.refresh mengisi cermin dari wallet_get + inventory_get', async () => {
  const e = svc({ wallet_get: () => ({ coins: 555, gems: 3 }), inventory_get: () => [{ id: 'dice.emas', qty: 1 }] });
  const r = await e.S.refresh(); assert.strictEqual(r.ok, true);
  assert.strictEqual(e.PD.coins(), 555); assert.strictEqual(e.PD.gems(), 3);
});
t('WS.buy sukses: saldo + item masuk cermin, server hanya dikirimi id item', async () => {
  const e = svc({ buy_item: a => ({ ok: true, item: a.p_item_id, spent: 500, coins: 500, gems: 0 }) });
  const it = buyable(e.IC); const r = await e.S.buy(it.id);
  assert.strictEqual(r.ok, true); assert.strictEqual(e.PD.coins(), 500); assert.strictEqual(e.PD.owns(it.id), true);
  assert.deepStrictEqual(e.calls[0], ['buy_item', { p_item_id: it.id }]);
});
t('WS.buy ditolak server (saldo-kurang): cermin tak berubah', async () => {
  const e = svc({ buy_item: () => ({ ok: false, reason: 'saldo-kurang', kurang: 10 }) });
  e.PD.applyServerWallet({ coins: 5 }); const it = buyable(e.IC); const r = await e.S.buy(it.id);
  assert.strictEqual(r.reason, 'saldo-kurang'); assert.strictEqual(e.PD.coins(), 5); assert.strictEqual(e.PD.owns(it.id), false);
});
t('WS: tombol ditekan dua kali cepat -> hanya satu RPC', async () => {
  let resolve; const gate = new Promise(r => { resolve = r; });
  const e = svc({ buy_item: async a => { await gate; return { ok: true, item: a.p_item_id, coins: 1, gems: 0 }; } });
  const it = buyable(e.IC); const p1 = e.S.buy(it.id), p2 = e.S.buy(it.id);
  resolve(); const [a, b] = await Promise.all([p1, p2]);
  assert.strictEqual(e.calls.filter(c => c[0] === 'buy_item').length, 1);
  assert.strictEqual([a, b].filter(x => x.reason === 'sedang-diproses').length, 1);
});
t('WS: kegagalan jaringan tidak melempar & tidak mengubah saldo', async () => {
  const e = svc({ buy_item: () => ({ __err: 'Failed to fetch' }) });
  e.PD.applyServerWallet({ coins: 50 }); const r = await e.S.buy(buyable(e.IC).id);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'jaringan'); assert.strictEqual(e.PD.coins(), 50);
});
t('WS: AUTH_REQUIRED -> belum-login', async () => {
  const e = svc({ claim_daily_reward: () => ({ __err: 'AUTH_REQUIRED' }) });
  assert.strictEqual((await e.S.claimDaily()).reason, 'belum-login');
});
t('WS.claimDaily: saldo dari wallet_* dan inventory disegarkan', async () => {
  const e = svc({ claim_daily_reward: () => ({ ok: true, day: 5, type: 'dice', item: 'dice.emas', coins: 0, gems: 0, wallet_coins: 1300, wallet_gems: 50 }),
                   inventory_get: () => [{ id: 'dice.emas', qty: 1 }] });
  const r = await e.S.claimDaily();
  assert.strictEqual(r.ok, true); assert.strictEqual(e.PD.coins(), 1300); assert.strictEqual(e.PD.gems(), 50); assert.strictEqual(e.PD.owns('dice.emas'), true);
});
t('WS.claimDaily sudah-klaim: saldo tidak berubah', async () => {
  const e = svc({ claim_daily_reward: () => ({ ok: false, reason: 'sudah-klaim', seconds_to_reset: 100 }) });
  e.PD.applyServerWallet({ coins: 1200 }); const r = await e.S.claimDaily();
  assert.strictEqual(r.ok, false); assert.strictEqual(e.PD.coins(), 1200);
});
t('WS.quest*: klaim tanpa nominal dari klien, lalu saldo disegarkan dari server', async () => {
  const e = svc({ quest_claim: a => ({ ok: true, id: a.p_id, coins: 75 }), wallet_get: () => ({ coins: 1075, gems: 0 }), inventory_get: () => [] });
  const r = await e.S.questClaim('play');
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(e.calls[0], ['quest_claim', { p_id: 'play' }]); assert.strictEqual(e.PD.coins(), 1075);
});
t('WS.exchange: paket dikirim sebagai indeks, saldo dari server', async () => {
  const e = svc({ exchange_gems: () => ({ ok: true, pack: 1, spent_gems: 40, got_coins: 2500 }), wallet_get: () => ({ coins: 3500, gems: 10 }), inventory_get: () => [] });
  const r = await e.S.exchange(1);
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(e.calls[0], ['exchange_gems', { p_pack: 1 }]); assert.strictEqual(e.PD.coins(), 3500); assert.strictEqual(e.PD.gems(), 10);
});
t('WS.claimBossCpu: hanya token dikirim; duplikat tidak mengubah saldo', async () => {
  const e = svc({ claim_cpu_boss_reward: () => ({ ok: true, duplicate: true, coins: 1, gems: 1 }) });
  e.PD.applyServerWallet({ coins: 2000, gems: 20 });
  await e.S.claimBossCpu('tok-12345678'); assert.strictEqual(e.PD.coins(), 2000);
  assert.deepStrictEqual(e.calls[0], ['claim_cpu_boss_reward', { p_token: 'tok-12345678' }]);
});
t('WS.claimBossCpu sukses: saldo dari respons server', async () => {
  const e = svc({ claim_cpu_boss_reward: () => ({ ok: true, coins: 2500, gems: 30, reward_coins: 500, reward_gems: 10 }) });
  await e.S.claimBossCpu('tok-12345678'); assert.strictEqual(e.PD.coins(), 2500); assert.strictEqual(e.PD.gems(), 30);
});
t('WS.claimBossOnline: ditolak (not_winner) tidak mengubah apa pun', async () => {
  const e = svc({ claim_boss_reward: () => ({ ok: false, reason: 'not_winner' }) });
  e.PD.applyServerWallet({ coins: 10 }); const r = await e.S.claimBossOnline('room-1');
  assert.strictEqual(r.reason, 'not_winner'); assert.strictEqual(e.PD.coins(), 10);
});
t('WS.claimAchievement: saldo dari wallet_coins/wallet_gems', async () => {
  const e = svc({ claim_achievement: () => ({ ok: true, stars: 1, coins: 250, gems: 5, wallet_coins: 1250, wallet_gems: 5 }) });
  await e.S.claimAchievement('x', null); assert.strictEqual(e.PD.coins(), 1250); assert.strictEqual(e.PD.gems(), 5);
});

t('WS.questTrack: hanya tipe dikirim; questGet menambah ok:true', async () => {
  const q = { day: '2026-11-06', seconds_to_reset: 100, quests: [], bonus: { reward: 100, status: 'locked' } };
  const e = svc({ quest_track: () => q, quest_get: () => q });
  const r = await e.S.questTrack('win'); assert.deepStrictEqual(e.calls[0], ['quest_track', { p_type: 'win' }]); assert.strictEqual(r.bonus.reward, 100);
  assert.strictEqual((await e.S.questGet()).ok, true);
});
t('WS.questTrack mode lokal -> tidak memanggil server', async () => {
  const e = svc(base, false); assert.strictEqual((await e.S.questTrack('play')).reason, 'mode-lokal'); assert.strictEqual(e.calls.length, 0);
});
t('WS.claimBossOnline: sukses memperbarui saldo, id room dikirim apa adanya', async () => {
  const e = svc({ claim_boss_reward: () => ({ ok: true, coins: 3000, gems: 40, reward_coins: 500, reward_gems: 10 }) });
  await e.S.claimBossOnline('11111111-2222-3333-4444-555555555555');
  assert.strictEqual(e.PD.coins(), 3000); assert.deepStrictEqual(e.calls[0], ['claim_boss_reward', { p_room_id: '11111111-2222-3333-4444-555555555555' }]);
});
t('WS.dailyGet mengembalikan status server', async () => {
  const e = svc({ daily_reward_get: () => ({ claimed: 2, claimed_today: false, next_day: 3, seconds_to_reset: 500, box: 0 }) });
  const r = await e.S.dailyGet(); assert.strictEqual(r.ok, true); assert.strictEqual(r.next_day, 3);
});

/* ---------- Iklan berhadiah ---------- */
const ADS = require('../assets/js/ads-service.js');
t('Ads: iklan selesai -> token valid untuk server, unik tiap tayangan', async () => {
  const A = ADS.create({ provider: { show: async () => ({ completed: true }) } });
  const a = await A.show(), b = await A.show();
  assert.strictEqual(a.ok, true); assert.ok(/^[A-Za-z0-9_-]{8,64}$/.test(a.token)); assert.notStrictEqual(a.token, b.token);
});
t('Ads: ditutup sebelum selesai -> tidak ada token', async () => {
  const A = ADS.create({ provider: { show: async () => ({ completed: false }) } });
  assert.deepStrictEqual(await A.show(), { ok: false, reason: 'dibatalkan' });
});
t('Ads: tanpa provider / provider error / tayangan ganda', async () => {
  assert.strictEqual((await ADS.create({}).show()).reason, 'tidak-tersedia');
  assert.strictEqual((await ADS.create({ provider: { show: async () => { throw new Error('x'); } } }).show()).reason, 'gagal');
  let go; const gate = new Promise(r => { go = r; });
  const A = ADS.create({ provider: { show: async () => { await gate; return { completed: true }; } } });
  const p1 = A.show(), p2 = A.show(); go(); const [x, y] = await Promise.all([p1, p2]);
  assert.strictEqual([x, y].filter(r => r.reason === 'sedang-diproses').length, 1);
});
t('Ads: completed harus tepat true (nilai truthy lain ditolak)', async () => {
  assert.strictEqual((await ADS.create({ provider: { show: async () => ({ completed: 'yes' }) } }).show()).ok, false);
});
t('WS.claimAd: hanya token dikirim; emerald dari respons server', async () => {
  const e = svc({ claim_ad_reward: () => ({ ok: true, coins: 1000, gems: 5, reward_gems: 5, sisa_hari_ini: 4 }) });
  const r = await e.S.claimAd('ad-abcd1234'); assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(e.calls[0], ['claim_ad_reward', { p_token: 'ad-abcd1234' }]); assert.strictEqual(e.PD.gems(), 5);
});
t('WS.claimAd: batas harian/terlalu cepat/duplikat tidak mengubah saldo', async () => {
  for (const resp of [{ ok: false, reason: 'daily_cap' }, { ok: false, reason: 'terlalu-cepat', tunggu_detik: 30 }, { ok: true, duplicate: true, coins: 1, gems: 99 }]) {
    const e = svc({ claim_ad_reward: () => resp }); e.PD.applyServerWallet({ coins: 10, gems: 2 });
    await e.S.claimAd('ad-abcd1234'); assert.strictEqual(e.PD.gems(), 2);
  }
});
t('WS.claimAd/adGet: mode lokal tidak memanggil server', async () => {
  const e = svc(base, false);
  assert.strictEqual((await e.S.claimAd('ad-abcd1234')).reason, 'mode-lokal'); assert.strictEqual((await e.S.adGet()).reason, 'mode-lokal'); assert.strictEqual(e.calls.length, 0);
});
t('WS.adGet: status sisa jatah dari server', async () => {
  const e = svc({ ad_reward_get: () => ({ gems: 5, cap: 5, left: 3, tunggu_detik: 0 }) });
  const r = await e.S.adGet(); assert.strictEqual(r.ok, true); assert.strictEqual(r.left, 3);
});
t('akun server: PD.addCurrency(0,5) tetap ditolak (emerald hanya lewat claimAd)', () => {
  const { PD } = loginOn(); assert.strictEqual(PD.addCurrency(0, 5).reason, 'server-wallet'); assert.strictEqual(PD.gems(), 0);
});

/* ---------- Beli set atomik (tahap c): WalletService.buySet + PlayerData.purchaseSet ---------- */
const gearBuyable = (IC, k) => IC.items.filter(i => i.kind === 'gear' && !i.starter && i.price > 0 && !i.stackable).slice(0, k);

t('WS.buySet sukses: satu RPC buy_set, saldo + SEMUA item masuk cermin, server hanya dikirimi daftar id', async () => {
  const e = svc({ buy_set: a => ({ ok: true, items: a.p_item_ids, skipped: [], spent: 220, coins: 780, gems: 0 }) });
  const [a, b] = gearBuyable(e.IC, 2).map(i => i.id); const r = await e.S.buySet([a, b]);
  assert.strictEqual(r.ok, true); assert.strictEqual(e.PD.coins(), 780);
  assert.strictEqual(e.PD.owns(a), true); assert.strictEqual(e.PD.owns(b), true);
  assert.deepStrictEqual(e.calls.map(c => c[0]), ['buy_set']);
  assert.deepStrictEqual(e.calls[0][1], { p_item_ids: [a, b] });
});
t('WS.buySet: item "skipped" (sudah dimiliki di server) ikut menyembuhkan cermin usang', async () => {
  const [a, b] = gearBuyable(boot().IC, 2).map(i => i.id);
  const e = svc({ buy_set: () => ({ ok: true, items: [b], skipped: [a], spent: 80, coins: 920, gems: 0 }) });
  assert.strictEqual(e.PD.owns(a), false); await e.S.buySet([a, b]);
  assert.strictEqual(e.PD.owns(a), true); assert.strictEqual(e.PD.owns(b), true);
});
t('WS.buySet: ditolak server (saldo-kurang/tidak-tersedia/terlalu-banyak) -> cermin tak berubah sama sekali', async () => {
  for (const resp of [{ ok: false, reason: 'saldo-kurang', kurang: 10 }, { ok: false, reason: 'tidak-tersedia' }, { ok: false, reason: 'terlalu-banyak' }]) {
    const e = svc({ buy_set: () => resp }); e.PD.applyServerWallet({ coins: 5 });
    const ids = gearBuyable(e.IC, 2).map(i => i.id); const r = await e.S.buySet(ids);
    assert.strictEqual(r.reason, resp.reason); assert.strictEqual(e.PD.coins(), 5);
    ids.forEach(id => assert.strictEqual(e.PD.owns(id), false));
  }
});
t('WS.buySet: koneksi putus -> {ok:false, reason:jaringan}, tidak melempar, tidak ada item/saldo berubah', async () => {
  const e = svc({ buy_set: () => ({ __err: 'Failed to fetch' }) }); e.PD.applyServerWallet({ coins: 50 });
  const ids = gearBuyable(e.IC, 3).map(i => i.id); const r = await e.S.buySet(ids);
  assert.strictEqual(r.reason, 'jaringan'); assert.strictEqual(e.PD.coins(), 50);
  ids.forEach(id => assert.strictEqual(e.PD.owns(id), false));
});
t('WS.buySet: mode lokal tidak memanggil server; ditekan dua kali (atau bareng buy) -> hanya satu RPC', async () => {
  const l = svc(base, false); assert.strictEqual((await l.S.buySet(['x'])).reason, 'mode-lokal'); assert.strictEqual(l.calls.length, 0);
  let resolve; const gate = new Promise(r => { resolve = r; });
  const e = svc({ buy_set: async a => { await gate; return { ok: true, items: a.p_item_ids, skipped: [], spent: 1, coins: 1, gems: 0 }; }, buy_item: () => ({ ok: true, item: 'x', coins: 1, gems: 0 }) });
  const ids = gearBuyable(e.IC, 2).map(i => i.id);
  const p1 = e.S.buySet(ids), p2 = e.S.buySet(ids), p3 = e.S.buy(ids[0]); resolve();
  const rs = await Promise.all([p1, p2, p3]);
  assert.strictEqual(e.calls.length, 1); assert.strictEqual(rs.filter(x => x.reason === 'sedang-diproses').length, 2);
});
t('WS.buySet: argumen bukan array -> dikirim sebagai daftar kosong (server yang menolak)', async () => {
  const e = svc({ buy_set: a => ({ ok: false, reason: 'tidak-tersedia', got: a.p_item_ids }) });
  await e.S.buySet(null); assert.deepStrictEqual(e.calls[0][1], { p_item_ids: [] });
});

t('PD.purchaseSet (tamu): sukses = satu penulisan, koin dipotong sekali, semua item masuk', () => {
  const { PD, IC } = boot(); const its = gearBuyable(IC, 3), total = its.reduce((a, i) => a + i.price, 0);
  const c0 = PD.coins(), r = PD.purchaseSet(its.map(i => i.id));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.spent, total); assert.strictEqual(PD.coins(), c0 - total);
  its.forEach(i => assert.strictEqual(PD.owns(i.id), true));
});
t('PD.purchaseSet: saldo kurang tidak menulis apa pun (termasuk item yang terjangkau)', () => {
  const { PD, IC } = boot(); const its = gearBuyable(IC, 40); PD.addCurrency(-PD.coins() + 100, 0);
  const cheap = its.find(i => i.price <= 100), pricey = its.find(i => i.price > 300);
  const r = PD.purchaseSet([cheap.id, pricey.id]);
  assert.strictEqual(r.reason, 'saldo-kurang'); assert.strictEqual(r.kurang, cheap.price + pricey.price - 100);
  assert.strictEqual(PD.coins(), 100); assert.strictEqual(PD.owns(cheap.id), false); assert.strictEqual(PD.owns(pricey.id), false);
});
t('PD.purchaseSet: dimiliki dilewati & tidak ditagih; semua dimiliki -> ok spent 0', () => {
  const { PD, IC } = boot(); const [a, b] = gearBuyable(IC, 2); PD.purchase(a.id); const c0 = PD.coins();
  const r = PD.purchaseSet([a.id, b.id]);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.spent, b.price); assert.strictEqual(JSON.stringify(r.skipped), JSON.stringify([a.id])); assert.strictEqual(JSON.stringify(r.items), JSON.stringify([b.id]));
  assert.strictEqual(PD.coins(), c0 - b.price);
  const again = PD.purchaseSet([a.id, b.id]);
  assert.strictEqual(again.ok, true); assert.strictEqual(again.spent, 0); assert.strictEqual(PD.coins(), c0 - b.price);
});
t('PD.purchaseSet: satu item tidak dijual menolak seluruh set (bukan gear / starter / tak dikenal / null)', () => {
  const { PD, IC } = boot(); const [a] = gearBuyable(IC, 1), c0 = PD.coins();
  const starterGear = IC.items.find(i => i.kind === 'gear' && i.starter), dice = IC.items.find(i => i.kind === 'dice' && !i.starter && i.price > 0);
  [[starterGear.id], [dice.id], ['gear.tidak-ada'], [null], [5]].forEach(bad => {
    assert.strictEqual(PD.purchaseSet([a.id].concat(bad)).reason, 'tidak-tersedia');
  });
  assert.strictEqual(PD.coins(), c0); assert.strictEqual(PD.owns(a.id), false);
});
t('PD.purchaseSet: id berulang digabung; kosong/bukan array ditolak; batas 20 unik dan 200 mentah', () => {
  const { PD, IC } = boot(); const its = gearBuyable(IC, 21), a = its[0];
  const r = PD.purchaseSet([a.id, a.id, a.id]); assert.strictEqual(r.spent, a.price); assert.strictEqual(PD.qty(a.id), 1);
  assert.strictEqual(PD.purchaseSet([]).reason, 'tidak-tersedia'); assert.strictEqual(PD.purchaseSet(null).reason, 'tidak-tersedia');
  assert.strictEqual(PD.purchaseSet(its.map(i => i.id)).reason, 'terlalu-banyak');
  assert.notStrictEqual(PD.purchaseSet(its.slice(0, 20).map(i => i.id)).reason, 'terlalu-banyak');
  assert.strictEqual(PD.purchaseSet(new Array(201).fill(a.id)).reason, 'terlalu-banyak');
  const r25 = boot().PD.purchaseSet(new Array(25).fill(0).map((_, i) => its[i % 3].id)); assert.strictEqual(r25.ok, true);
});
t('PD.purchaseSet: akun server ditolak (harus lewat WalletService.buySet)', () => {
  const { PD, IC } = loginOn(); const c0 = PD.coins();
  assert.strictEqual(PD.purchaseSet(gearBuyable(IC, 2).map(i => i.id)).reason, 'server-wallet'); assert.strictEqual(PD.coins(), c0);
});

(async () => {
  for (const [name, fn] of queue) { await fn(); n++; console.log('ok -', name); }
  console.log(n + ' tes lulus');
})().catch(e => { console.error('GAGAL:', e && e.stack || e); process.exit(1); });
