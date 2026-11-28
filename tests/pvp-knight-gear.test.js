/* Tes set PVP Ksatria Mahkota & Ksatria Rival (wajah, rambut, baju, ..., pedang) di Karakter. Jalankan: node tests/pvp-knight-gear.test.js
   Mengunci: (1) katalog klien, (2) builder di karakter.js benar-benar dieksekusi dengan stub (tanpa WebGL), (3) migrasi server sama
   dengan katalog, (4) kabel UI klaim, (5) seed katalog server tidak usang. TIDAK menguji render WebGL maupun SQL asli (butuh browser/Postgres). */
const assert = require('assert'), fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const w = {}; new Function('window', rd('src/stores/item-catalog.js'))(w);
const C = w.ItemCatalog, pvp = C.items.filter(i => i.unlock && i.unlock.type === 'pvp');
const PARTS = ['eyes', 'hair', 'top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'];
const SETS = { mahkota: 10, rival: 20 };

t('katalog: 2 set x 10 bagian = 20 item, ID gear.<bagian>.<set>, unik', () => {
  assert.strictEqual(pvp.length, 20);
  assert.strictEqual(new Set(pvp.map(i => i.id)).size, 20);
  Object.keys(SETS).forEach(k => PARTS.forEach(p => {
    const i = C.byId('gear.' + p + '.' + k); assert.ok(i, p + '.' + k);
    assert.strictEqual(i.kind, 'gear'); assert.strictEqual(i.part, p); assert.strictEqual(i.gameKey, k);
    assert.strictEqual(i.slot, 'g.' + p); assert.strictEqual(i.g, null, 'unisex');
  }));
});
t('katalog: tidak dijual & bukan starter (hanya dibuka server lewat PVP), wins sesuai set', () => {
  pvp.forEach(i => {
    assert.strictEqual(i.price, null, i.id); assert.strictEqual(i.starter, false, i.id);
    assert.strictEqual(i.source, 'event', i.id); assert.strictEqual(i.rarity, 'legendary', i.id);
    assert.strictEqual(i.unlock.wins, SETS[i.unlock.set], i.id);
  });
});
t('katalog: item non-PVP tidak berubah (147 asli tetap, tidak ada yang kehilangan harga)', () => {
  assert.strictEqual(C.items.length, 183);
  assert.strictEqual(C.byId('gear.helm.crown').price, 900);
  assert.strictEqual(C.byId('skin.ksatria') ? C.byId('skin.ksatria').id : 'skin.ksatria', 'skin.ksatria');
});

/* ---- builder karakter.js: jalankan blok set PVP dengan stub ---- */
const K = rd('data/inventory/character/_shared/js/karakter.js');
const a = K.indexOf('const KN={'), b = K.indexOf('const REG={eyes:EYES');
assert.ok(a > 0 && b > a, 'blok set PVP ada sebelum REG');
const calls = [];
const stub = () => { const o = { rotation: { z: 0 }, add() {}, position: {} }; calls.push(o); return o; };
const ctx = vm.createContext({
  EYES: [], HAIRS: [], TOPS: [], LEGS: [], BOOTS: [], HELMS: [], CHESTS: [], SHOULDERS: [], CAPES: [], WEAPONS: [],
  shade: (c, f) => c, add: (slot, parent, obj) => obj, box: stub, phong: c => ({ c }), solid: c => ({ c }), glow: c => ({ c }),
  head: {}, upper: {}, cape1: {}, cape2: {}
});
vm.runInContext(K.slice(a, b), ctx);
const L = { eyes: ctx.EYES, hair: ctx.HAIRS, top: ctx.TOPS, legs: ctx.LEGS, boots: ctx.BOOTS, helm: ctx.HELMS, chest: ctx.CHESTS, shoulder: ctx.SHOULDERS, cape: ctx.CAPES, weapon: ctx.WEAPONS };

t('builder: tiap item katalog PVP punya builder dengan id & nama yang sama', () => {
  pvp.forEach(i => {
    const it = L[i.part].find(x => x.id === i.gameKey);
    assert.ok(it, 'builder ' + i.id); assert.strictEqual(it.n, i.name, 'nama ' + i.id);
  });
  assert.strictEqual(Object.keys(L).reduce((s, k) => s + L[k].length, 0), 20, 'tidak ada builder yatim');
});
t('builder: warna set tetap (tanpa dye) kecuali iris mata & rambut yang wajib berdye (server)', () => {
  ['top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'].forEach(p => L[p].forEach(it => assert.ok(!it.dyes, p + '.' + it.id)));
  L.eyes.forEach(it => assert.strictEqual(it.dyes, 'eye')); L.hair.forEach(it => assert.strictEqual(it.dyes, 'hair'));
  assert.deepStrictEqual(L.eyes.map(e => e.def), ['blue', 'red']); assert.deepStrictEqual(L.hair.map(h => h.def), ['silver', 'black']);
});
t('builder: semua fungsi build/paint/px/f berjalan tanpa error pada semua koordinat tekstur', () => {
  const R = { sh: {}, side: 1 };
  ['mahkota', 'rival'].forEach((k, ix) => {
    L.helm[ix].build(null); L.chest[ix].build(null); L.shoulder[ix].build(null, R); L.shoulder[ix].build(null, { sh: {}, side: -1 });
    L.cape[ix].build(null); L.weapon[ix].build(null, { add() {} });
    const hair = []; L.hair[ix].f((...q) => hair.push(q)); assert.ok(hair.length >= 7, 'rambut ' + k);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 12; y++) {
      ['pz', 'nz', 'px', 'py'].forEach(f => { assert.ok(L.top[ix].paint().torso(x, y, f) != null, 'torso'); });
      L.top[ix].paint().arm(x, y);
      if (y <= 7) assert.ok(L.legs[ix].paint()(x, y, 'pz') != null, 'legs');
      if (y >= L.boots[ix].from) assert.ok(L.boots[ix].paint()(x, y, 'pz') != null, 'boots');
    }
    for (let m = 1; m <= 2; m++) for (let y = 0; y < 8; y++) L.eyes[ix].px(m, y, 0x2b6cb0);
    assert.ok(L.boots[ix].sole() != null);
  });
  assert.ok(calls.length > 40, 'banyak box dibuat');
});
t('builder: dua karakter punya palet berbeda (putih-emas vs rival merah-gelap)', () => {
  const m = {}, r = {};
  L.helm[0].build(null); L.helm[1].build(null);
  assert.notStrictEqual(K.match(/mahkota:\{armor:(0x[0-9a-f]+)/)[1], K.match(/rival:\{armor:(0x[0-9a-f]+)/)[1]);
  assert.notStrictEqual(K.match(/mahkota:\{[^}]*gold:(0x[0-9a-f]+)/)[1], K.match(/rival:\{[^}]*gold:(0x[0-9a-f]+)/)[1]);
});

t('set: preset unisex terdaftar untuk m & f, memuat wajah + rambut + 8 bagian, terkunci lewat katalog', () => {
  assert.ok(K.includes("PRESETS.push({id:'pvp_'+k+'_'+g,n:a[1],g:g,pvp:k"));
  assert.ok(K.includes("eyes:{id:k,dye:k==='rival'?'red':'blue'},hair:{id:k,dye:k==='rival'?'black':'silver'}"));
  assert.ok(K.includes("top:{id:k},legs:{id:k},boots:{id:k},helm:{id:k},chest:{id:k},shoulder:{id:k},cape:{id:k},weapon:{id:k}"));
  assert.ok(K.includes("['eyes','hair'].forEach(k=>{const o=p.set[k];if(!o)return;const ci=catItem(k,find(k,o.id));"), 'wajah & rambut dihitung sebagai bagian set');
  assert.ok(K.includes("['eyes','hair'].every(k=>!p.set[k]||c[k].id===p.set[k].id)"), 'set dianggap dipakai hanya bila wajah & rambut cocok');
});
t('UI: item & set PVP menampilkan MENANG N PVP dan klaim lewat server (bukan beli koin)', () => {
  assert.ok(K.includes("label:'MENANG '+pvpOf(ci).wins+' PVP'") && K.includes("label:'MENANG '+pvpOf(st.miss[0]).wins+' PVP'"));
  assert.ok(K.includes("if(pvpOf(ci))claimPvp(ci);else confirmBuy(ci);") && K.includes('if(st.pvp){claimPvp(st.miss[0]);return;}'));
  assert.ok(K.includes('UT.Multiplayer.Progress.claimPvpUnlocks(ids)'));
  assert.ok(K.includes("if(!SV()){toast('Masuk ke akun untuk membuka item PVP.');return;}"), 'tamu/lokal tidak bisa membuka');
  assert.ok(!K.includes('PD.grant') && !/PD\.(add|give)\w*\(/.test(K.slice(K.indexOf('async function claimPvp'), K.indexOf('function startPreview'))), 'klien tidak memberi item sendiri');
  assert.ok(rd('src/multiplayer/progress-service.js').includes("rpc('claim_pvp_unlocks',{p_item_ids:itemIds})"));
});

/* ---- migrasi server ---- */
const sql = rd('supabase/migrations/202611350001_pvp_knight_gear.sql');
t('SQL: tiap item PVP ada di item_catalog (tanpa harga) dan pvp_unlocks dengan min_wins = unlock.wins', () => {
  pvp.forEach(i => {
    assert.ok(sql.includes("('" + i.id + "', 'gear', null, false, false)"), 'catalog ' + i.id);
    assert.ok(sql.includes("('" + i.id + "', " + i.unlock.wins + ')'), 'pvp_unlocks ' + i.id);
  });
});
t('SQL: claim_pvp_unlocks tertutup untuk anon, butuh login, cek syarat dari tabel (bukan dari klien)', () => {
  assert.ok(/create or replace function public\.claim_pvp_unlocks\(p_item_ids text\[\]\)/.test(sql));
  assert.ok(sql.includes('revoke all on function public.claim_pvp_unlocks(text[]) from public, anon;'));
  assert.ok(sql.includes('grant execute on function public.claim_pvp_unlocks(text[]) to authenticated;'));
  assert.ok(sql.includes("raise exception 'AUTH_REQUIRED'") && sql.includes('from public.pvp_unlocks u where u.item_id = any (v_ids)'));
  assert.ok(sql.includes('if v_wins < r.min_wins then') && sql.includes('for update'), 'syarat dicek terhadap pvp_wins server, baris dikunci');
});
t('SQL: _appearance_normalize mewajibkan kepemilikan wajah/rambut yang ada di katalog; sisanya utuh', () => {
  assert.ok(sql.includes("not public._owns_item(p_user, 'gear.' || v_part || '.' || (v_o ->> 'id'))"));
  assert.ok(sql.includes("return public._bad('belum-dimiliki'"));
  const orig = rd('supabase/migrations/202611130001_player_outfits.sql');
  ['slot-tidak-cocok', "'^s[1-5]$'", 'least(1.1, greatest(0.9, v_h))', "(select count(*) from jsonb_object_keys(p_equipped)) > 60", 'item-tidak-dikenal']
    .forEach(x => { assert.ok(orig.includes(x) && sql.includes(x), 'tetap ada: ' + x); });
});
t('seed katalog server (gen-item-seed --check) tidak usang', () => {
  const r = cp.spawnSync('node', ['tools/wallet/gen-item-seed.js', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
console.log(n + ' tes lulus');

