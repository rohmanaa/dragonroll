/* Tes AppearanceService (tahap b): outfit + tampilan aktif lewat server. Jalankan: node tests/appearance-service.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
let n = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);

function boot(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls };
  if (opts.flag) w.UT_SERVER_WALLET = true;
  w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8'), ctx));
  return { PD: ctx.PlayerData, IC: ctx.ItemCatalog, store };
}
const Svc = require('../assets/js/appearance-service.js');
const ACCT = { 'ut-auth': JSON.stringify({ id: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb', username: 'tester' }) };
const loginOn = () => boot({ store: ACCT, flag: true });
const tick = ms => new Promise(r => setTimeout(r, ms || 0));

/* Klien Supabase tiruan: handlers[name](args) -> data; semua panggilan dicatat. */
function fakeClient(handlers, delay) {
  const calls = [];
  return { calls, getClient: async () => ({ rpc: async (name, args) => {
    calls.push({ name, args });
    if (delay) await tick(delay);
    const h = handlers[name]; if (!h) return { error: { message: 'rpc ' + name + ' tidak ada' } };
    try { return { data: await h(args || {}) }; } catch (e) { return { error: { message: e.message } }; }
  } }) };
}
const base = o => Object.assign({ gender: 'm', top: { id: 'tee', dye: 'blue' }, legs: { id: 'pants' }, boots: { id: 'shoes' },
  helm: { id: 'none' }, chest: { id: 'none' }, shoulder: { id: 'none' }, cape: { id: 'none' }, weapon: { id: 'none' }, accessories: [] }, o || {});
const row = (slot, name, data) => ({ slot, name, data: data || base(), updated_at: '2026-11-07T10:00:00Z' });

t('tamu / akun dengan saklar darurat mati: semua method mode-lokal, tidak ada panggilan server', async () => {
  for (const b of [boot({ flag: true }), boot({ store: Object.assign({ 'ut:serverWallet': '0' }, ACCT) })]) {
    const fc = fakeClient({}), s = Svc.create({ PlayerData: b.PD, getClient: fc.getClient });
    for (const r of [await s.refresh(), await s.saveOutfit('A', base()), await s.renameOutfit(0, 'B'), await s.deleteOutfit(0), await s.pushAppearance(), await s.roomAppearance('x')])
      assert.strictEqual(r.reason, 'mode-lokal');
    assert.strictEqual(fc.calls.length, 0);
  }
});
t('mode server: PlayerData menolak mutasi outfit lokal', async () => {
  const { PD } = loginOn();
  assert.strictEqual(PD.saveOutfit('A', base()).reason, 'server-mode');
  assert.strictEqual(PD.renameOutfit(0, 'A').reason, 'server-mode');
  assert.strictEqual(PD.deleteOutfit(0).reason, 'server-mode');
  assert.deepStrictEqual(PD.outfits(), []);
});
t('saveOutfit: kirim nama+data apa adanya, lalu cermin dari outfit_list', async () => {
  const { PD } = loginOn(); let list = [];
  const fc = fakeClient({
    outfit_save: a => { list = [row(0, a.p_name, a.p_data)]; return { ok: true, slot: 0, name: a.p_name, data: a.p_data }; },
    outfit_list: () => list });
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  const r = await s.saveOutfit('Harian', base());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(fc.calls.map(c => c.name), ['outfit_save', 'outfit_list']);
  assert.strictEqual(fc.calls[0].args.p_name, 'Harian');
  assert.strictEqual(fc.calls[0].args.p_data.top.dye, 'blue');
  assert.deepStrictEqual(PD.outfits().map(o => [o.slot, o.name]), [[0, 'Harian']]);
  assert.ok(PD.outfits()[0].updatedAt > 0);
});
t('saveOutfit ditolak server: alasan diteruskan, cermin tidak berubah, tanpa outfit_list', async () => {
  const { PD } = loginOn();
  const fc = fakeClient({ outfit_save: () => ({ ok: false, reason: 'belum-dimiliki', item: 'gear.helm.crown' }), outfit_list: () => [] });
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  const r = await s.saveOutfit('Raja', base());
  assert.deepStrictEqual([r.ok, r.reason], [false, 'belum-dimiliki']);
  assert.deepStrictEqual(fc.calls.map(c => c.name), ['outfit_save']);
  assert.deepStrictEqual(PD.outfits(), []);
});
t('rename & delete: memanggil RPC lalu menyegarkan cermin', async () => {
  const { PD } = loginOn(); let list = [row(0, 'A'), row(1, 'B')];
  const fc = fakeClient({
    outfit_rename: a => { list.find(o => o.slot === a.p_slot).name = a.p_name; return { ok: true }; },
    outfit_delete: a => { list = list.filter(o => o.slot !== a.p_slot); return { ok: true }; },
    outfit_list: () => list });
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  assert.strictEqual((await s.renameOutfit(1, 'Baru')).ok, true);
  assert.deepStrictEqual(PD.outfits().map(o => o.name), ['A', 'Baru']);
  assert.strictEqual((await s.deleteOutfit(0)).ok, true);
  assert.deepStrictEqual(PD.outfits().map(o => [o.slot, o.name]), [[1, 'Baru']]);
  assert.strictEqual(fc.calls.find(c => c.name === 'outfit_rename').args.p_slot, 1);
});
t('aksi ganda cepat: yang kedua ditolak sedang-diproses', async () => {
  const { PD } = loginOn();
  const fc = fakeClient({ outfit_save: () => ({ ok: false, reason: 'slot-penuh' }), outfit_list: () => [] }, 20);
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  const [a, b] = await Promise.all([s.saveOutfit('A', base()), s.saveOutfit('B', base())]);
  assert.deepStrictEqual([a.reason, b.reason], ['slot-penuh', 'sedang-diproses']);
  assert.strictEqual(fc.calls.filter(c => c.name === 'outfit_save').length, 1);
});
t('jaringan gagal: tidak melempar; AUTH_REQUIRED -> belum-login', async () => {
  const { PD } = loginOn();
  const s1 = Svc.create({ PlayerData: PD, getClient: async () => { throw new Error('offline'); } });
  const r = await s1.saveOutfit('A', base());
  assert.deepStrictEqual([r.ok, r.reason], [false, 'jaringan']);
  assert.strictEqual((await s1.refresh()).reason, 'jaringan');
  const s3 = Svc.create({ PlayerData: PD, getClient: fakeClient({ outfit_delete: () => { throw new Error('AUTH_REQUIRED'); } }).getClient });
  assert.strictEqual((await s3.deleteOutfit(0)).reason, 'belum-login');
});
t('refresh (server punya data): inventory, tampilan aktif, dan outfit dari server; item tak dimiliki tidak dipasang', async () => {
  const { PD } = loginOn();
  const look = { gender: 'f', skin: 's3', eyes: { id: 'lash', dye: 'blue' }, hair: { id: 'bob', dye: 'brown' }, body: { height: 1.05, build: 1 } };
  const fc = fakeClient({
    inventory_get: () => [{ id: 'gear.helm.crown', qty: 1 }, { id: 'dice.rumput', qty: 1 }],
    appearance_get: () => ({ found: true, look, equipped: { 'g.helm': 'gear.helm.crown', 'g.weapon': 'gear.weapon.sword', dice: 'dice.rumput', skin: 'skin.ender' }, gear_dye: { 'gear.helm.crown': 'gold' } }),
    outfit_list: () => [row(2, 'Dari Server')] });
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  const r = await s.refresh();
  assert.deepStrictEqual([r.ok, r.pushed], [true, false]);
  assert.strictEqual(PD.look().gender, 'f');
  assert.strictEqual(PD.look().body.height, 1.05);
  assert.strictEqual(PD.gearLook()['g.helm'].id, 'gear.helm.crown');
  assert.strictEqual(PD.gearLook()['g.helm'].dye, 'gold');
  assert.strictEqual(PD.gearLook()['g.weapon'], undefined, 'sword tidak dimiliki -> tidak dipasang');
  assert.strictEqual(PD.equippedId('dice'), 'dice.rumput');
  assert.strictEqual(PD.equippedId('skin'), 'skin.steve', 'skin.ender tidak dimiliki -> skin lama tetap');
  assert.deepStrictEqual(PD.outfits().map(o => o.name), ['Dari Server']);
  assert.strictEqual(fc.calls.some(c => c.name === 'appearance_save'), false, 'server menang: tidak mengirim balik');
});
t('refresh (server belum punya data): tampilan lokal dikirim sebagai data awal', async () => {
  const { PD } = loginOn();
  PD.setLook({ gender: 'm', skin: 's2', eyes: { id: 'round', dye: 'blue' }, hair: { id: 'short', dye: 'brown' }, body: { height: 1, build: 1 } });
  PD.equip('gear.top.tee'); PD.setGearDye('gear.top.tee', 'red');
  const fc = fakeClient({ inventory_get: () => [], appearance_get: () => ({ found: false }), appearance_save: () => ({ ok: true }), outfit_list: () => [] });
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  const r = await s.refresh();
  assert.deepStrictEqual([r.ok, r.pushed], [true, true]);
  const sent = fc.calls.find(c => c.name === 'appearance_save').args;
  assert.strictEqual(sent.p_look.skin, 's2');
  assert.strictEqual(sent.p_equipped['g.top'], 'gear.top.tee');
  assert.strictEqual(sent.p_equipped.skin, 'skin.steve');
  assert.strictEqual(sent.p_gear_dye['gear.top.tee'], 'red');
  assert.strictEqual(Object.keys(sent.p_equipped).every(k => /^(skin|dice|theme|frame|g\..+)$/.test(k)), true);
});
t('pushAppearance berurutan: perubahan saat mengirim digabung, hasil akhir = terbaru', async () => {
  const { PD } = loginOn(); const seen = [];
  const fc = fakeClient({ appearance_save: a => { seen.push(a.p_equipped['g.top'] || null); return { ok: true }; } }, 15);
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  PD.equip('gear.top.tee');
  const p1 = s.pushAppearance();
  PD.unequip('g.top');
  const p2 = await s.pushAppearance();
  assert.strictEqual(p2.queued, true);
  await p1;
  assert.deepStrictEqual(seen, ['gear.top.tee', null], 'dua pengiriman berurutan, yang terakhir = keadaan terbaru');
});
t('autoSync: perubahan equip digabung (debounce); cermin server tidak dikirim balik; bisa dihentikan', async () => {
  const { PD } = loginOn(); const fc = fakeClient({ appearance_save: () => ({ ok: true }) });
  const timers = []; const fakeSet = (fn) => { timers.push(fn); return timers.length; }, fakeClear = id => { timers[id - 1] = null; };
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient, setTimeout: fakeSet, clearTimeout: fakeClear });
  const stop = s.autoSync();
  PD.equip('gear.top.tee'); PD.setGearDye('gear.top.tee', 'red'); PD.unequip('g.top');
  assert.strictEqual(timers.filter(Boolean).length, 1, 'tiga perubahan -> satu jadwal kirim');
  timers.filter(Boolean)[0](); await tick(5);
  assert.strictEqual(fc.calls.filter(c => c.name === 'appearance_save').length, 1);
  PD.applyServerAppearance({ look: null, equipped: {}, gearDye: {} });
  assert.strictEqual(timers.filter(Boolean).length, 1, 'cermin server tidak menjadwalkan kirim');
  stop(); PD.equip('gear.top.tee');
  assert.strictEqual(timers.filter(Boolean).length, 1, 'setelah stop tidak menjadwalkan lagi');
});
t('autoSync: tamu tidak mengirim apa pun', async () => {
  const { PD } = boot({ flag: true }); const fc = fakeClient({ appearance_save: () => ({ ok: true }) }); const timers = [];
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient, setTimeout: fn => timers.push(fn), clearTimeout() {} });
  s.autoSync(); PD.equip('gear.top.tee');
  assert.strictEqual(timers.length, 0);
});
t('roomAppearance: id room dikirim, daftar pemain dikembalikan', async () => {
  const { PD } = loginOn();
  const fc = fakeClient({ room_appearance_get: a => [{ user_id: 'u1', look: null, equipped: { skin: 'skin.alex' }, gear_dye: {}, room: a.p_room_id }] });
  const s = Svc.create({ PlayerData: PD, getClient: fc.getClient });
  const r = await s.roomAppearance('room-1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.players[0].equipped.skin, 'skin.alex');
  assert.strictEqual(fc.calls[0].args.p_room_id, 'room-1');
  const bad = Svc.create({ PlayerData: PD, getClient: fakeClient({ room_appearance_get: () => { throw new Error('NOT_ROOM_MEMBER'); } }).getClient });
  assert.deepStrictEqual((await bad.roomAppearance('x')).ok, false);
});
t('PlayerData.appearance(): hanya slot equip, salinan; applyServerAppearance hanya mode server', async () => {
  const g = boot({ flag: true });
  assert.strictEqual(g.PD.applyServerAppearance({}).reason, 'bukan-mode-server');
  assert.strictEqual(g.PD.applyServerOutfits([]).reason, 'bukan-mode-server');
  const a = g.PD.appearance(); a.equipped.skin = 'HACK';
  assert.strictEqual(g.PD.appearance().equipped.skin, 'skin.steve');
  assert.strictEqual(g.PD.appearance().look, null);
});

(async () => {
  for (const [name, fn] of queue) { await fn(); n++; console.log('ok - ' + name); }
  console.log('\n' + n + ' tes lulus');
})().catch(e => { console.error('GAGAL:', e && e.stack || e); process.exit(1); });
