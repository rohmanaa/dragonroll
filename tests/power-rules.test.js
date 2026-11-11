/* Tes aturan Power (Batch 2-3): 17 Power punya nama (PUN), aturan (PUR), katalog, ikon, efek 2D, model 3D, suara, dan migrasi server.
   Jalankan: node tests/power-rules.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(root, p), 'utf8'), ex = p => fs.existsSync(path.join(root, p));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const w = { addEventListener() {} }; w.window = w; const ctx = vm.createContext(w);
vm.runInContext(rd('assets/js/item-catalog.js'), ctx);
vm.runInContext(rd('data/power/power-fx.js'), ctx);
vm.runInContext(rd('gameplay/config.js'), ctx);
const IC = ctx.ItemCatalog, pus = IC.items.filter(i => i.kind === 'powerup'), C = ctx.UT.Gameplay.Config, FX = ctx.UT.PowerFX;
const keys = Array.from(pus, i => i.gameKey); /* Array.from: array dari konteks vm -> array biasa (deepStrictEqual) */
const NEW = ['diamond_sword', 'netherite_sword', 'wooden_shield', 'golden_apple', 'fire_charge', 'ice_crystal', 'blaze_core', 'trident', 'dragon_crystal', 'nether_star'];

t('17 power di katalog; PUN dan PUR punya kunci yang sama persis', () => {
  assert.strictEqual(keys.length, 17);
  assert.deepStrictEqual(Object.keys(C.PUN).sort(), keys.slice().sort());
  assert.deepStrictEqual(Object.keys(C.PUR).sort(), keys.slice().sort());
});
t('nama di katalog = nama di PUN; tiap PUN punya [emoji, nama, deskripsi]', () => {
  pus.forEach(p => { assert.strictEqual(C.PUN[p.gameKey][1], p.name === 'Totem' ? 'Totem' : p.name, p.gameKey); assert.ok(C.PUN[p.gameKey][0] && C.PUN[p.gameKey][2], p.gameKey); });
});
t('aturan PUR valid: kind dikenal, strike/area punya target & back, strike/area/swap/freeze punya target', () => {
  const kinds = ['strike', 'area', 'swap', 'freeze', 'guard', 'totem', 'dice', 'self', 'trap'], tg = ['same', 'near', 'ahead', 'leader', 'allAhead', 'all'];
  Object.keys(C.PUR).forEach(k => {
    const R = C.PUR[k]; assert.ok(kinds.indexOf(R.kind) >= 0, k + ' kind');
    if (['strike', 'area', 'swap', 'freeze'].indexOf(R.kind) >= 0) assert.ok(tg.indexOf(R.target) >= 0, k + ' target');
    if (R.kind === 'strike' || R.kind === 'area') assert.ok(R.back > 0, k + ' back');
    if (R.kind === 'trap') { assert.ok(R.back > 0 && R.range > 0 && Number.isInteger(R.radius) && R.radius >= 0, k + ' trap'); assert.strictEqual(R.boss, false, k + ' jebakan butuh papan (bukan fase Naga)'); }
    if (R.target === 'near' || R.target === 'ahead') assert.ok(R.range > 0, k + ' range');
  });
});
t('angka aturan = deskripsi: pedang 2/3/5, TNT 6, Fire Charge 3 (<=6), Blaze Core 2, Trident 4 + maju 2, Nether Star 3 + giliran tambahan, Golden Apple +3', () => {
  const R = C.PUR;
  assert.deepStrictEqual([R.sword.back, R.diamond_sword.back, R.netherite_sword.back], [2, 3, 5]);
  assert.deepStrictEqual([R.diamond_sword.range, R.netherite_sword.range], [2, 4]);
  assert.strictEqual(R.tnt.back, 6); assert.strictEqual(R.fire_charge.back, 3); assert.strictEqual(R.fire_charge.range, 6);
  assert.strictEqual(R.blaze_core.back, 2); assert.strictEqual(R.trident.back, 4); assert.strictEqual(R.trident.self, 2);
  assert.strictEqual(R.nether_star.back, 3); assert.strictEqual(R.nether_star.extra, true); assert.strictEqual(R.golden_apple.bonus, 3);
  assert.strictEqual(R.feather.extra, true); assert.strictEqual(R.dragon_crystal.fallback, 6);
  [['sword', 'mundur 2'], ['diamond_sword', 'mundur 3'], ['netherite_sword', 'mundur 5'], ['tnt', 'mundur 6'], ['fire_charge', 'mundur 3'], ['blaze_core', 'mundur 2'], ['trident', 'mundur 4'], ['nether_star', 'mundur 3']]
    .forEach(([k, s]) => assert.ok(C.PUN[k][2].indexOf(s) >= 0, k + ' deskripsi: ' + C.PUN[k][2]));
});
t('fase Dragon: Power khusus papan (pedang, Golden Apple, Dragon Crystal, Totem) boss:false; serangan terarah/TNT/Ender Pearl/Feather boleh', () => {
  ['sword', 'diamond_sword', 'netherite_sword', 'golden_apple', 'dragon_crystal', 'totem', 'tnt', 'fire_charge', 'blaze_core'].forEach(k => assert.strictEqual(C.PUR[k].boss, false, k));
  ['grass', 'feather', 'wooden_shield', 'ice_crystal', 'trident', 'nether_star'].forEach(k => assert.strictEqual(C.PUR[k].boss, true, k));
});
t('tiap Power punya ikon 3D (file ada), efek 2D, dan peta model 3D', () => {
  const map = {}; (rd('assets/js/power3d/power-show.js').match(/KEY_TO_POWER3D\s*=\s*\{([\s\S]*?)\};/)[1]).replace(/\/\*[\s\S]*?\*\//g, '').split(',').forEach(p => { const m = p.match(/(\w+)\s*:\s*'(\w+)'/); if (m) map[m[1]] = m[2]; });
  pus.forEach(p => {
    assert.ok(p.icon && ex(p.icon), 'ikon tidak ada: ' + p.gameKey);
    assert.ok(FX.has(p.gameKey), 'efek 2D tidak ada: ' + p.gameKey);
    assert.ok(map[p.gameKey], 'peta 3D tidak ada: ' + p.gameKey);
  });
  assert.ok(FX.has('shield_block') && FX.has('totem_block'));
});
t('suara: PowerSound punya suara untuk tiap Power (gameKey dan id model 3D)', () => {
  const src = rd('assets/js/power3d/PowerSound.js'), vm_ = src.match(/const VOICE = \{([\s\S]*?)\};/)[1];
  keys.forEach(k => assert.ok(new RegExp('\\b' + k + ':').test(vm_), 'suara tidak ada: ' + k));
  ['iron_sword', 'ender_pearl', 'potion_red', 'potion_blue'].forEach(k => assert.ok(new RegExp('\\b' + k + ':').test(vm_), k));
});
t('Power baru terdaftar di server: migrasi 10 baris powerup + seed B2 sinkron', () => {
  const mig = rd('supabase/migrations/202611210001_power_catalog_batch2.sql'), b2 = rd('supabase/migrations/202611110002_wallet_b2_server.sql');
  NEW.forEach(k => { assert.ok(mig.indexOf("('" + k + "', 'powerup', null, false, true)") > 0, 'migrasi: ' + k); assert.ok(b2.indexOf("('" + k + "', 'powerup', null, false, true)") > 0, 'B2: ' + k); });
});
t('gameplay.html memakai aturan data: tanpa daftar Power tetap lama, ada importmap + loader power3d, snapshot membawa guard/frozen', () => {
  const g = rd('gameplay.html');
  assert.ok(g.indexOf('<script type="importmap">') > 0 && g.indexOf("assets/js/power3d/power-overlay.js") > 0);
  assert.ok(!/const o=\{sword:0,feather:0/.test(g), 'daftar Power tetap masih ada');
  assert.ok(g.indexOf('guard:!!p.guard,frozen:!!p.frozen') > 0 && g.indexOf("'shield','guard','frozen'") > 0);
  assert.ok(g.indexOf('function skipFrozen') > 0 && /function nextTurn\(\)\{[^}]*skipFrozen\(\)/.test(g));
});
t('takedown: Iron Sword & Netherite Sword off:true dengan catatan; data utuh (katalog, PUN/PUR, efek, ikon, migrasi server); Diamond Sword tetap aktif', () => {
  ['sword', 'netherite_sword'].forEach(k => {
    const it = IC.byId(k); assert.strictEqual(it.off, true, k); assert.ok(/TAKEDOWN|DITURUNKAN/i.test(it.offNote) && /JANGAN DIHAPUS/.test(it.offNote), k + ' catatan');
    assert.ok(C.PUN[k] && C.PUR[k] && FX.has(k) && it.icon && ex(it.icon), k + ' data harus tetap ada');
  });
  assert.ok(!IC.byId('diamond_sword').off);
  assert.deepStrictEqual(Array.from(pus.filter(i => i.off), i => i.gameKey).sort(), ['netherite_sword', 'sword']);
  assert.ok(rd('supabase/migrations/202611210001_power_catalog_batch2.sql').indexOf("'netherite_sword'") > 0);
  assert.ok(/KINDS\.forEach\(k=>CI\[k\]=IC\.items\.filter\(i=>i\.kind===k&&!i\.off\)\)/.test(rd('powerup.html')) && rd('room.html').indexOf("i.kind==='powerup'&&!i.off") > 0);
  const g = rd('gameplay.html'); assert.ok(g.indexOf('const puOn=') > 0 && g.indexOf('||!puAvail(k)) return false') > 0 && g.indexOf('const puAvail=k=>puOn(k)&&puMapOk(k)') > 0 && g.indexOf("if(!puOn(k)) return deny(") > 0);
});
t('Power per map: World = Ice Crystal/Wooden Shield/Golden Apple; Nether = Blaze Core/Fire Charge; sisanya semua map; label dan helper konsisten', () => {
  const only = { minecraft: ['golden_apple', 'ice_crystal', 'wooden_shield'], nether: ['blaze_core', 'fire_charge'] };
  Object.keys(only).forEach(m => only[m].forEach(k => { assert.deepStrictEqual(Array.from(IC.byId(k).maps), [m], k); assert.strictEqual(IC.powerOnMap(k, m), true); assert.strictEqual(IC.powerOnMap(k, m === 'nether' ? 'minecraft' : 'nether'), false, k); }));
  const flat = Object.keys(only).reduce((a, m) => a.concat(only[m]), []);
  pus.filter(i => flat.indexOf(i.gameKey) < 0).forEach(i => { assert.ok(!i.maps, i.gameKey); assert.ok(IC.powerOnMap(i.gameKey, 'minecraft') && IC.powerOnMap(i.gameKey, 'nether'), i.gameKey); });
  assert.strictEqual(IC.powerMapNote('blaze_core'), 'Hanya di Nether'); assert.strictEqual(IC.powerMapNote('ice_crystal'), 'Hanya di World'); assert.strictEqual(IC.powerMapNote('tnt'), '');
  assert.ok(IC.powerOnMap('blaze_core', null) && IC.powerOnMap('blaze_core', undefined), 'mapKey kosong = boleh');
  const mapKeys = ['minecraft', 'nether']; Object.keys(only).forEach(m => assert.ok(mapKeys.indexOf(m) >= 0));
  assert.ok(/key: 'minecraft'/.test(rd('gameplay/maps/world.js')) && /key: 'nether'/.test(rd('gameplay/maps/nether.js')), 'key map berubah?');
});
t('Power per map terpasang di Room (kunci + auto-lepas + cfg disaring), gameplay (puAvail/puMapOk, tolak sebelum konsumsi) dan halaman Power (catatan)', () => {
  const r = rd('room.html'), g = rd('gameplay.html');
  assert.ok(r.indexOf('pOk=id=>IC.powerOnMap(id,MAPKEY)') > 0 && r.indexOf('PW.equipped.filter(pOk)') > 0 && r.indexOf('.pc.dis{') > 0 && r.indexOf('Dilepas (tidak bisa di') > 0);
  assert.ok(g.indexOf('const puMapOk=') > 0 && g.indexOf('const puAvail=') > 0 && g.indexOf('if(!puMapOk(k)) return deny(') > 0);
  assert.ok(/filter\(puAvail\)/.test(g) && g.indexOf('!p.pu[k]||!puAvail(k)') > 0);
  assert.ok(rd('powerup.html').indexOf('IC.powerMapNote(i.id)') > 0);
});
t('Room: lima slot membuka modal Power dan loadout baru disimpan saat dikonfirmasi', () => {
  const r = rd('room.html');
  assert.ok(r.indexOf('id="prow"') > 0 && r.indexOf('id="pmL"') > 0);
  assert.ok(r.indexOf("const EFFECT_ICON='assets/ng/komponen/ikon-gem-medali/kristal-api.webp'") > 0);
  assert.ok(r.indexOf('Array.from({length:TMAX}') > 0 && r.indexOf('function openPowerPick()') > 0);
  assert.ok(r.indexOf('if(powerDraft.equipped.length>=TMAX)') > 0);
  assert.ok(r.indexOf('function closePowerPick(){powerDraft=null;') > 0);
  assert.ok(r.indexOf('PW.equipped=powerDraft.equipped;PW.carry=powerDraft.carry;saveP()') > 0);
});
t('Jebakan di petak: TNT radius 1 mundur 6, Fire Charge radius 0 mundur 3, Blaze Core radius 2 mundur 2; jangkauan pasang 6; terpasang di gameplay (pilih petak, pemicu saat mendarat, snapshot, tamu kirim petak)', () => {
  const R = C.PUR; [['tnt', 1, 6], ['fire_charge', 0, 3], ['blaze_core', 2, 2]].forEach(([k, rad, back]) => { assert.strictEqual(R[k].kind, 'trap', k); assert.strictEqual(R[k].radius, rad, k); assert.strictEqual(R[k].back, back, k); assert.strictEqual(R[k].range, 6, k); assert.ok(/jebakan/i.test(C.PUN[k][2]) && /jebakan/i.test(IC.byId(k).desc), k + ' deskripsi'); });
  ['sword', 'diamond_sword', 'netherite_sword', 'trident', 'nether_star', 'ice_crystal', 'grass'].forEach(k => assert.notStrictEqual(R[k].kind, 'trap', k + ' tetap serangan langsung'));
  const g = rd('gameplay.html');
  assert.ok(g.indexOf('async function trapCheck(p,gid)') > 0 && g.indexOf('if(await trapCheck(p,gid)) return;') > 0, 'pemicu di resolveTileAt');
  assert.ok(g.indexOf('function trapPick(p,k)') > 0 && g.indexOf('id="trapBar"') > 0 && g.indexOf('requestPower({playerId:MP_ID,power:k,tile:tile})') > 0 && g.indexOf('Number.isInteger(payload.tile)') > 0, 'UI pilih petak + tamu kirim petak');
  assert.ok(g.indexOf('traps:TRAPS.map(') > 0 && g.indexOf('trapsSync(s.traps)') > 0 && g.indexOf('trapsClear(); applyPendingTheme()') > 0, 'snapshot + reset');
  assert.ok(g.indexOf('const TRAP_MAX=2') > 0 && g.indexOf('q.idx!==t.owner') > 0, 'batas + pemasang kebal');
});
t('Jebakan di petak: TNT (radius 1, mundur 6), Fire Charge (radius 0, mundur 3), Blaze Core (radius 2, mundur 2); range 6; fase Naga ditolak; deskripsi sesuai angka', () => {
  const R = C.PUR;
  [['tnt', 1, 6], ['fire_charge', 0, 3], ['blaze_core', 2, 2]].forEach(([k, rad, back]) => {
    assert.strictEqual(R[k].kind, 'trap', k); assert.strictEqual(R[k].range, 6, k); assert.strictEqual(R[k].radius, rad, k); assert.strictEqual(R[k].back, back, k); assert.strictEqual(R[k].boss, false, k);
    assert.ok(C.PUN[k][2].indexOf('jebakan') >= 0 && C.PUN[k][2].indexOf('mundur ' + back) >= 0, k + ' PUN: ' + C.PUN[k][2]);
    assert.ok(/[Jj]ebakan/.test(IC.byId(k).desc) && IC.byId(k).desc.indexOf('mundur ' + back) >= 0, k + ' katalog: ' + IC.byId(k).desc);
  });
  ['trident', 'ice_crystal', 'nether_star', 'dragon_crystal', 'grass', 'feather'].forEach(k => assert.notStrictEqual(R[k].kind, 'trap', k + ' tetap serangan langsung'));
});
t('Jebakan terpasang di gameplay: bar pilih petak, pemicu saat mendarat (resolveTileAt), pemasang kebal, Shield/Totem menahan, snapshot + permintaan tamu membawa petak, bersih saat game baru', () => {
  const g = rd('gameplay.html');
  assert.ok(g.indexOf('id="trapBar"') > 0 && g.indexOf('function trapPick(') > 0 && g.indexOf('const TRAP_MAX=2') > 0);
  assert.ok(g.indexOf('q.owner!==p.idx') > 0, 'pemasang harus kebal');
  assert.ok(/async function resolveTileAt[\s\S]{0,400}await trapCheck\(p,gid\)/.test(g), 'trapCheck harus dipanggil dari resolveTileAt');
  assert.ok(/async function trapCheck[\s\S]*await puDefend\(q,gid/.test(g), 'korban bisa menahan');
  assert.ok(g.indexOf('traps:TRAPS.map(') > 0 && g.indexOf('trapsSync(s.traps)') > 0 && g.indexOf('tile:tile') > 0 && g.indexOf('payload.tile') > 0);
  assert.ok(g.indexOf('trapsClear(); applyPendingTheme()') > 0);
  assert.ok(g.indexOf("R.kind==='trap') return p.pos<GOAL-1") > 0, 'CPU hanya memasang bila ada petak di depan');
});
t('stok Power lama tetap terbaca: ID lama tidak berubah', () => {
  ['sword', 'grass', 'potion_odd', 'potion_even', 'feather', 'tnt', 'totem'].forEach(k => assert.strictEqual(IC.normalizePowerId(k), k));
  assert.strictEqual(IC.normalizePowerId('apple'), 'totem');
});
console.log(n + ' tes lulus');
