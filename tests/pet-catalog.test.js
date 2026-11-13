/* Tes katalog Pet: 7 pet = kind 'pet' (slot opsional 'pet'), id sama dengan supabase/pet_catalog.sql, harga koin T1-T4 / emerald T5-T7,
   migrasi + seed server sinkron, dan beli/kepemilikan/pakai lewat jalur yang sama dengan aura.
   Jalankan: node tests/pet-catalog.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const w = {}; new Function('window', rd('assets/js/item-catalog.js'))(w); const IC = w.ItemCatalog;
const pets = IC.items.filter(i => i.kind === 'pet').sort((a, b) => a.tier - b.tier);
const MIG = 'supabase/migrations/202611290001_pet_catalog.sql';

/* ---- sumber metadata: supabase/pet_catalog.sql (id, tier, harga) ---- */
const meta = [...rd('supabase/pet_catalog.sql').matchAll(/\(\s*'(\w+)',\s*(\d+),\s*'(\w+)',\s*'([^']+)'[\s\S]*?'\s*,\s*'(coin|emerald)'\s*,\s*(\d+)\s*\)/g)]
  .map(m => ({ id: m[1], tier: +m[2], tierName: m[3], name: m[4], cur: m[5], amount: +m[6] }));

t('tabel metadata memuat 7 pet (pengurai tes bekerja)', () => { assert.strictEqual(meta.length, 7); });
t('7 pet di katalog klien; id, nama, tier, rarity sama dengan pet_catalog.sql', () => {
  assert.strictEqual(pets.length, 7);
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];
  meta.forEach(m => {
    const it = IC.byId('pet.' + m.id); assert.ok(it, m.id);
    assert.strictEqual(it.gameKey, m.id); assert.strictEqual(it.name, m.name);
    assert.strictEqual(it.tier, m.tier); assert.strictEqual(it.rarity, order[m.tier - 1]); assert.strictEqual(m.tierName.toLowerCase(), it.rarity);
  });
});
t('pet dijual (bukan starter/stackable), kind pet, slot opsional "pet", tanpa pet bawaan', () => {
  pets.forEach(p => { assert.ok(!p.starter && !p.stackable, p.id); assert.strictEqual(p.slot, 'pet'); assert.strictEqual(p.kind, 'pet'); assert.ok(IC.cost(p), p.id); });
  assert.ok(IC.optionalSlots().indexOf('pet') >= 0 && IC.optionalSlots().indexOf('aura') >= 0, 'aura tetap slot opsional');
  assert.strictEqual(IC.defaultEquipped.pet, undefined, 'tidak ada pet bawaan');
  assert.strictEqual(IC.KIND_META.pet.slot, 'pet');
});
t('harga klien = pet_catalog.sql: koin T1-T4, emerald T5-T7, tepat satu mata uang, naik per tier', () => {
  meta.forEach(m => {
    const c = IC.cost(IC.byId('pet.' + m.id));
    if (m.cur === 'coin') { assert.deepStrictEqual(c, { coins: m.amount, gems: null }, m.id); assert.ok(m.tier <= 4); }
    else { assert.deepStrictEqual(c, { coins: null, gems: m.amount }, m.id); assert.ok(m.tier >= 5); }
  });
  const coin = pets.filter(p => p.price > 0).map(p => p.price), gem = pets.filter(p => p.gems > 0).map(p => p.gems);
  assert.deepStrictEqual(coin.slice().sort((a, b) => a - b), coin); assert.deepStrictEqual(gem.slice().sort((a, b) => a - b), gem);
  /* aturan kurs 50 koin/emerald: emerald tier pertama >= koin tier koin terakhir / 50 (tak ada jalan pintas koin -> emerald -> pet) */
  assert.ok(gem[0] >= coin[coin.length - 1] / 50);
});
t('id item unik dan tidak bentrok dengan kind lain (katalog tetap memuat dadu/frame/aura)', () => {
  assert.strictEqual(new Set(IC.items.map(i => i.id)).size, IC.items.length);
  assert.strictEqual(IC.items.filter(i => i.kind === 'aura').length, 15);
});

/* ---- migrasi server ---- */
const sql = rd(MIG);
t('migrasi memuat semua pet dengan harga koin/emerald yang sama dan menyimpan kind \'pet\'', () => {
  pets.forEach(p => assert.ok(sql.indexOf("('" + p.id + "', 'pet', " + (p.price > 0 ? p.price : 'null') + ', ' + (p.gems > 0 ? p.gems : 'null') + ', false, false)') >= 0, p.id));
});
t('_item_equip_slot: pet -> slot pet, dan semua kind lama (skin, dice, theme, frame, aura, gear) dipertahankan', () => {
  const fn = sql.slice(sql.indexOf('create or replace function public._item_equip_slot'));
  ["when 'pet' then 'pet'", "when 'aura' then 'aura'", "when 'skin' then 'skin'", "when 'dice' then 'dice'", "when 'theme' then 'theme'", "when 'frame' then 'frame'", "when 'gear' then"]
    .forEach(s => assert.ok(fn.indexOf(s) >= 0, s));
  assert.ok(/revoke all on function public\._item_equip_slot\(text\) from public, anon, authenticated/.test(fn));
});
t('migrasi pet berurutan setelah migrasi harga emerald (butuh price_gems) dan aman diulang', () => {
  const names = fs.readdirSync(path.join(root, 'supabase/migrations')).sort();
  assert.ok(names.indexOf('202611290001_pet_catalog.sql') > names.indexOf('202611280001_economy_phase3_gems.sql'));
  assert.ok(/on conflict \(id\) do update/.test(sql));
});
t('seed sinkron dengan katalog klien (gen-item-seed --check)', () => {
  const r = cp.spawnSync(process.execPath, [path.join(root, 'tools/wallet/gen-item-seed.js'), '--check'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
});

/* ---- PlayerData: beli (server), miliki, pakai, lepas ---- */
function boot() {
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { addEventListener() {}, localStorage: ls }; win.window = win;
  const ctx = vm.createContext(Object.assign(win, { localStorage: ls, console, Date, JSON, Math }));
  ['session.js', 'item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(rd('assets/js/' + f), ctx));
  return { PD: ctx.PlayerData, store };
}
const own = (PD, store, ...ids) => { PD.coins(); const st = JSON.parse(store[PD.key]); ids.forEach(id => { st.inventory[id] = { qty: 1, acquiredAt: Date.now(), seq: st.nextSeq++ }; }); store[PD.key] = JSON.stringify(st); };
t('pet belum dimiliki tidak bisa dipakai; setelah dimiliki bisa dipakai, ikut appearance(), satu pet aktif, bisa dilepas', () => {
  const { PD, store } = boot();
  assert.strictEqual(PD.equip('pet.forest_pup').reason, 'belum-dimiliki');
  own(PD, store, 'pet.forest_pup', 'pet.storm_wolf');
  assert.strictEqual(PD.equip('pet.forest_pup').ok, true);
  assert.strictEqual(PD.equippedId('pet'), 'pet.forest_pup');
  assert.strictEqual(PD.appearance().equipped.pet, 'pet.forest_pup');
  assert.strictEqual(PD.equip('pet.storm_wolf').ok, true);          /* satu pet aktif: yang baru menggantikan */
  assert.strictEqual(PD.equippedId('pet'), 'pet.storm_wolf');
  assert.strictEqual(PD.unequip('pet').ok, true);
  assert.strictEqual(PD.equippedId('pet'), null);
  assert.strictEqual(PD.appearance().equipped.pet, undefined);
});
t('memakai pet tidak mengganggu aura/gear yang sedang dipakai (slot terpisah)', () => {
  const { PD, store } = boot();
  own(PD, store, 'aura.flame', 'pet.arcane_owl');
  PD.equip('aura.flame'); PD.equip('pet.arcane_owl'); PD.unequip('pet');
  assert.strictEqual(PD.equippedId('aura'), 'aura.flame');
});
t('pembelian pet lokal tanpa akun ditolak (harga dipegang server), koin maupun emerald', () => {
  const { PD } = boot();
  assert.strictEqual(PD.purchase('pet.forest_pup').ok, false);
  assert.strictEqual(PD.purchase('pet.storm_wolf').ok, false);
});
t('halaman Pet aktif berada di root, memuat viewer dan metadata server tanpa dompet localStorage demo', () => {
  const html = rd('pet.html'), page = rd('assets/js/pet-page.js');
  assert.ok(html.includes('assets/js/pet-viewer.js'));
  assert.ok(html.includes('assets/js/pet-page.js'));
  assert.ok(html.includes('UT.App.init({page:\'pet\'})'));
  assert.ok(page.includes(".from('pet_catalog')"));
  assert.ok(page.includes('WalletService'));
  assert.ok(!/localStorage/.test(page));
  pets.forEach(p => assert.ok(fs.existsSync(path.join(root, 'assets/ng/pet3d', p.gameKey + '.png')), p.gameKey));
});
t('lobby dan profil mengarah ke halaman Pet root', () => {
  assert.ok(rd('lobby.html').includes("pet:'pet.html'"));
  assert.ok(rd('profile.html').includes('"Pet","pet","lobby/pet.webp"'));
  assert.ok(!rd('lobby.html').includes('referensi/newgui/game/pet.html'));
});
console.log(n + ' tes lulus');
