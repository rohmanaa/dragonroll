/* Chest Feature 2 — harness uji (Node, tanpa dependensi). HANYA untuk verifikasi; TIDAK dimuat game.
   Menjalankan: node audit/4/chest-feature-02-harness.js
   Kode yang diuji ADALAH kode asli:
   - game/assets/js/item-catalog.js + player-data.js (dimuat apa adanya di vm dengan localStorage palsu)
   - game/gameplay/config.js (CHEST_POOL dsb.)
   - fungsi chest/doRoll/playTurn DIEKSTRAK dari game/gameplay.html (bukan salinan), dijalankan dengan stub untuk bagian 3D/DOM.
   Batas: game 3D asli (Three.js) tidak dijalankan di sini. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- util tes ---------- */
let pass = 0, fail = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n## ' + t); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- muat PlayerData asli ---------- */
function makeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, _m: m };
}
function loadWin(storage) {
  const win = { localStorage: storage, addEventListener() { }, Date, JSON, Math, console };
  win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  ['assets/js/item-catalog.js', 'assets/js/player-data.js', 'gameplay/config.js'].forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  return win;
}

/* ---------- ekstrak kode asli dari gameplay.html ---------- */
const HTML = read('gameplay.html');
function between(a, b) { const i = HTML.indexOf(a), j = HTML.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker tidak ditemukan: ' + a); return HTML.slice(i, j); }
const CHEST_SRC = between('const CHEST_LC=', "try{ fb('setRewardPresenter'");   /* CHEST_LC, chestToken, blok reward, giveChest */
const ROLL_SRC = between('async function doRoll(opt){', 'let RES_GID=-1;');
const TURN_SRC = between('async function playTurn(p,v,gid,bn){', '/* ---------- Dragon Feature 4');

/* ---------- sandbox: stub untuk 3D/DOM, kode asli untuk logika ---------- */
function makeEnv(storageIn) {
  const storage = storageIn || makeStorage();
  const win = loadWin(storage);
  const calls = { open: 0, close: 0, walk: [], climb: 0, bite: 0, teleport: 0, explode: 0, fly: 0, mobReact: 0, usePU: 0, puFx: 0, startPU: 0, showPUCard: 0, msgs: [], fbs: [], beginTurn: [], nextTurn: 0, hud: 0 };
  const noop = () => { };
  const env = {
    window: win, UT: win.UT, console, Math, Promise, Set, Object, Number, Array, JSON,
    CHESTS: win.UT.Gameplay.Config.CHESTS, LADDERS: win.UT.Gameplay.Config.LADDERS, SNAKES: win.UT.Gameplay.Config.SNAKES,
    SNAKEINFO: {}, MOBBACK: win.UT.Gameplay.Config.MOB_BACK, MOBNAME: win.UT.Gameplay.Config.MOB_NAME, PUN: win.UT.Gameplay.Config.PUN,
    mobPos: { 29: 'creeper', 53: 'ender', 38: 'skeleton', 2: 'zombie', 85: 'warden', 45: 'villager', 66: 'blaze' },
    calls,
    sfx: new Proxy({}, { get: (t, k) => k === 'roll' ? () => 1 : noop }),
    reduce: true, sleep: () => Promise.resolve(), STALE: { stale: true }, themeKey: 'overworld',
    AWK: { done: true, running: false }, DH: { on: false },
    openChest: () => { calls.open++; }, closeChest: () => { calls.close++; },
    setMsg: t => calls.msgs.push(t), fb: (...a) => { calls.fbs.push(a); return true; }, hud: () => { calls.hud++; },
    renderChips: noop, setRoll: noop, clearTurnTimer: noop, startTurnTimer: noop, showDie: noop, holdEnd: noop, focus: null,
    faceCamera: () => Promise.resolve(), hopTo: () => Promise.resolve(), slotPos: () => ({}),
    walk: async (p, from, to) => { calls.walk.push([from, to]); },
    climb: async () => { calls.climb++; }, bite: async () => { calls.bite++; }, teleport: async () => { calls.teleport++; },
    explode: async () => { calls.explode++; }, fly: async () => { calls.fly++; },
    mobReact: () => { calls.mobReact++; },
    showAttackCard: noop, awakenDragon: async () => { }, gatherArena: async () => { }, crystalRoll: async () => { },
    canAttackDragon: () => true, hitDragon: async () => { }, celebrate: async () => { }, dragonDefeatReward: async () => { }, finishGame: noop,
    /* Power: jebakan — tidak boleh dipanggil dari Chest */
    usePU: () => { calls.usePU++; }, puFx: () => { calls.puFx++; }, startPU: () => { calls.startPU++; }, showPUCard: () => { calls.showPUCard++; },
    beginTurn: (x) => { calls.beginTurn.push(!!x); }, nextTurn: () => { calls.nextTurn++; },
    specialDiceActive: () => false
  };
  env.mobOn = pos => env.mobPos[pos] || null;
  const names = Object.keys(env);
  const src = `
    let busy=false,paused=false,gameOver=false,gameId=1,cur=0,players=[];
    const walkRef=walk;
    ${CHEST_SRC}
    ${ROLL_SRC}
    ${TURN_SRC}
    return { resolveChestReward, applyChestReward, chestDiceForce, giveChest, doRoll, playTurn, CHEST_LC,
      get busy(){return busy;}, set busy(v){busy=v;}, set players(v){players=v;}, set cur(v){cur=v;}, get gameId(){return gameId;}, set gameId(v){gameId=v;} };`;
  const api = new Function(...names, src)(...names.map(n => env[n]));
  return { env, api, win, calls, storage };
}
function mkPlayer(over) { return Object.assign({ idx: 0, name: 'P1', cpu: false, pos: 0, sixes: 0, score: 0, bonus: 0, extra: false, p4: false, odd: false, even: false, lucky: false, shield: false, pawn: {} }, over || {}); }
async function withRandom(seq, fn) { /* paksa Math.random: array nilai berurutan (berulang) */
  const orig = Math.random; let i = 0; Math.random = () => seq[(i++) % seq.length];
  try { return await fn(); } finally { Math.random = orig; }
}
const slotFor = (w, ids, id) => { let s = 0; for (const r of ids) { if (r.id === id) return (s + r.w / 2) / 1000; s += r.w; } };

(async () => {
  /* =============== 1. POOL =============== */
  section('1. Reward Pool (data)');
  const base = makeEnv();
  const POOL = base.win.UT.Gameplay.Config.CHEST_POOL;
  const EXP = { empty: 100, coin: 220, xp: 130, surprise: 100, odd: 150, even: 150, lucky: 70, gems: 5, addroll: 75 };
  ok(POOL.length === 9, '9 entri reward');
  ok(POOL.reduce((a, r) => a + r.w, 0) === 1000, 'total bobot = 1000 (=100%)');
  ok(POOL.every(r => EXP[r.id] === r.w), 'bobot tiap reward sama dengan spesifikasi (persen x10)', JSON.stringify(POOL));
  ok(!POOL.some(r => /power|sword|feather|tnt|totem|potion|grass/i.test(r.id)), 'tidak ada entri Power di pool');
  ok(!('emerald' in base.win.PlayerData.snapshot()), 'tidak ada field "emerald" baru (Emerald = gems)');

  /* 1b. enumerasi 1000 slot: tiap reward muncul PERSIS sebesar bobotnya */
  const slot = {}; for (let k = 0; k < 1000; k++) { const id = base.api.resolveChestReward(() => (k + 0.5) / 1000).id; slot[id] = (slot[id] || 0) + 1; }
  ok(Object.keys(EXP).every(id => slot[id] === EXP[id]), 'enumerasi 1000 slot: jumlah per reward = bobot (resolver deterministik benar)', JSON.stringify(slot));
  ok(base.api.resolveChestReward(() => 0.9999999).id === 'addroll' && base.api.resolveChestReward(() => 0).id === 'empty', 'batas bawah/atas rnd valid');

  /* pool rusak -> aman (empty), bukan reward lain */
  { const t = makeEnv(); const pl = t.win.UT.Gameplay.Config.CHEST_POOL; pl[0].w = 99; const orig = console.error; console.error = () => { };
    const r = t.api.resolveChestReward(() => 0.5); console.error = orig; ok(r.id === 'empty', 'pool total != 1000 -> fallback aman "empty"'); }

  /* =============== 2. 10.000 RESOLUSI =============== */
  section('2. 10.000 resolusi');
  function run10k(rnd, label) {
    const cnt = {}; let invalid = 0, power = 0;
    for (let i = 0; i < 10000; i++) {
      const id = base.api.resolveChestReward(rnd).id; cnt[id] = (cnt[id] || 0) + 1;
      if (!(id in EXP)) invalid++; if (/power|sword|feather|tnt|totem|potion|grass/i.test(id)) power++;
    }
    const total = Object.values(cnt).reduce((a, b) => a + b, 0);
    console.log('  [' + label + '] total=' + total + ' invalid=' + invalid + ' power=' + power);
    let within = true;
    Object.keys(EXP).forEach(id => {
      const pexp = EXP[id] / 1000, n = cnt[id] || 0, e = pexp * 10000, sd = Math.sqrt(10000 * pexp * (1 - pexp));
      const good = Math.abs(n - e) <= 4 * sd; within = within && good;
      console.log('    ' + id.padEnd(9) + String(n).padStart(5) + '  (' + (n / 100).toFixed(2).padStart(5) + '%)  target ' + (pexp * 100).toFixed(1).padStart(4) + '%  ' + (good ? 'dalam 4σ' : 'DI LUAR 4σ'));
    });
    return { total, invalid, power, within, cnt };
  }
  const seeded = run10k(mulberry32(20261103), 'seed 20261103 (reproducible)');
  ok(seeded.total === 10000, 'seeded: 10.000 total');
  ok(seeded.invalid === 0, 'seeded: 0 reward invalid');
  ok(seeded.power === 0, 'seeded: 0 Power reward');
  ok(seeded.within, 'seeded: semua reward dalam 4σ dari target');
  const live = run10k(null, 'Math.random (tanpa seed)');
  ok(live.total === 10000 && live.invalid === 0 && live.power === 0, 'Math.random: 10.000 total, 0 invalid, 0 Power');
  ok(live.within, 'Math.random: semua reward dalam 4σ dari target');

  /* =============== 3. XP / COIN / GEMS (PlayerData asli) =============== */
  section('3. Coin / XP / Gems — PlayerData.grant asli');
  { const t = makeEnv(); const PD = t.win.PlayerData; const p = mkPlayer();
    ok(PD.snapshot().xp === 0, 'PlayerData.xp default = 0');
    const c0 = PD.coins(), g0 = PD.gems();
    await t.api.applyChestReward(p, { id: 'coin' }, 1); ok(PD.coins() === c0 + 5 && PD.gems() === g0 && PD.xp() === 0, 'Chest -> +5 Coin (gems/xp tidak berubah)');
    await t.api.applyChestReward(p, { id: 'xp' }, 1); ok(PD.xp() === 10 && PD.coins() === c0 + 5, 'Chest -> +10 XP (coin tidak berubah)');
    await t.api.applyChestReward(p, { id: 'gems' }, 1); ok(PD.gems() === g0 + 1 && PD.xp() === 10, 'Chest -> +1 Gems/Emerald');
    ok(!('emerald' in PD.snapshot()), 'state tetap tanpa field emerald');
    /* XP tersimpan: muat ulang PlayerData dari storage yang sama */
    const raw = t.storage._m.get('ularTanggaBlok:player:v1'); ok(JSON.parse(raw).xp === 10, 'XP tertulis di localStorage');
    const t2 = makeEnv(makeStorage({ 'ularTanggaBlok:player:v1': raw })); ok(t2.win.PlayerData.xp() === 10, 'XP bertahan setelah "refresh" (load ulang dari storage)');
    await t.api.applyChestReward(p, { id: 'xp' }, 1); ok(PD.xp() === 20, 'XP akumulatif (20)');
    /* save lama tanpa xp */
    const old = JSON.parse(raw); delete old.xp; const t3 = makeEnv(makeStorage({ 'ularTanggaBlok:player:v1': JSON.stringify(old) })); ok(t3.win.PlayerData.xp() === 0, 'save lama tanpa xp -> 0 (tanpa crash)');
    /* grant lama (Dragon reward) tidak terpengaruh */
    const r = PD.grant({ coins: 500, gems: 10 }); ok(r.ok && PD.xp() === 20, 'grant({coins,gems}) existing tidak mengubah xp');
    /* CPU tidak dapat currency */
    const cpu = mkPlayer({ cpu: true, name: 'CPU' }); const s0 = JSON.stringify(PD.snapshot());
    for (const id of ['coin', 'xp', 'gems']) await t.api.applyChestReward(cpu, { id }, 1);
    ok(JSON.stringify(PD.snapshot()) === s0, 'CPU: coin/xp/gems tidak mengubah PlayerData');
    /* empty: tanpa perubahan state */
    const pe = mkPlayer({ pos: 10 }); const s1 = JSON.stringify(PD.snapshot()); const rr = await t.api.applyChestReward(pe, { id: 'empty' }, 1);
    ok(JSON.stringify(PD.snapshot()) === s1 && pe.pos === 10 && !pe.extra && !pe.odd && !pe.even && !pe.lucky && rr.text === 'Kosong', 'Empty: tidak ada perubahan state, feedback "Kosong"'); }

  /* =============== 4. SURPRISE =============== */
  section('4. Surprise ±1/2/3');
  { const t = makeEnv(); const D = [-3, -2, -1, 1, 2, 3]; let allOk = true, nWalk = 0, bad = '';
    for (let pos = 1; pos <= 99; pos++) for (let di = 0; di < 6; di++) {
      const p = mkPlayer({ pos }); t.calls.walk.length = 0;
      await withRandom([(di + 0.5) / 6], () => t.api.applyChestReward(p, { id: 'surprise' }, 1));
      const exp = Math.max(1, Math.min(99, pos + D[di]));
      if (p.pos !== exp || p.pos < 1 || p.pos > 99) { allOk = false; bad = pos + '/' + D[di] + '->' + p.pos; }
      if (exp !== pos && !(t.calls.walk.length === 1 && t.calls.walk[0][0] === pos && t.calls.walk[0][1] === exp)) { allOk = false; bad = 'walk ' + pos + '/' + D[di]; }
      if (exp === pos && t.calls.walk.length !== 0) { allOk = false; bad = 'walk tak perlu ' + pos; }
      nWalk += t.calls.walk.length;
    }
    ok(allOk, 'semua 99 posisi x 6 langkah: target selalu 1..99 (clamp) & memakai walk existing', bad);
    ok(t.calls.climb + t.calls.bite + t.calls.teleport + t.calls.explode + t.calls.mobReact + t.calls.fly === 0, 'Surprise tidak memanggil climb/bite/teleport/explode/mobReact');
    /* distribusi nilai langkah */
    const seen = {}; const t2 = makeEnv(); for (let i = 0; i < 6000; i++) { const p = mkPlayer({ pos: 50 }); await t2.api.applyChestReward(p, { id: 'surprise' }, 1); seen[p.pos - 50] = (seen[p.pos - 50] || 0) + 1; }
    ok(Object.keys(seen).sort().join() === '-1,-2,-3,1,2,3'.split(',').sort().join(), 'nilai acak hanya ±1/±2/±3', JSON.stringify(seen)); }

  /* =============== 5. DADU: ODD / EVEN / LUCKY (doRoll asli) =============== */
  section('5. Odd / Even / Lucky — doRoll asli');
  function mkRoll() { /* doRoll asli, playTurn diganti perekam */
    const t = makeEnv(); const rec = [];
    const src = ROLL_SRC; const names = Object.keys(t.env);
    const env2 = Object.assign({}, t.env, { playTurn: async (p, v) => { rec.push(v); } });
    const fn = new Function(...Object.keys(env2), `let busy=false,paused=false,gameOver=false,gameId=1,cur=0,players=[]; ${CHEST_SRC} ${src}
      return { doRoll, chestDiceForce, applyChestReward, reset(p){busy=false;players=[p];cur=0;}, setP(p){players=[p];cur=0;busy=false;} };`)(...Object.keys(env2).map(k => env2[k]));
    return { fn, rec, t };
  }
  async function rolls(flag, n) {
    const { fn, rec } = mkRoll(); const out = [];
    for (let i = 0; i < n; i++) {
      const p = mkPlayer(); fn.setP(p);
      await fn.applyChestReward(p, { id: flag }, 1);
      await fn.doRoll(); const first = rec.pop();
      const flagsAfter = p.odd || p.even || p.lucky;
      fn.setP(p); await fn.doRoll(); const second = rec.pop();
      out.push({ first, second, flagsAfter });
    }
    return out;
  }
  const N = 300;
  const odd = await rolls('odd', N), even = await rolls('even', N), lucky = await rolls('lucky', N);
  ok(odd.every(r => [1, 3, 5].includes(r.first)) && new Set(odd.map(r => r.first)).size === 3, 'Odd: roll berikutnya hanya 1/3/5 (' + N + ' percobaan, ketiga nilai muncul)');
  ok(odd.every(r => !r.flagsAfter), 'Odd: flag reset setelah satu roll');
  ok(odd.some(r => r.second % 2 === 0), 'Odd: roll KEDUA kembali normal (genap muncul lagi)');
  ok(even.every(r => [2, 4, 6].includes(r.first)) && new Set(even.map(r => r.first)).size === 3, 'Even: roll berikutnya hanya 2/4/6 (' + N + ' percobaan, ketiga nilai muncul)');
  ok(even.every(r => !r.flagsAfter), 'Even: flag reset setelah satu roll');
  ok(even.some(r => r.second % 2 === 1), 'Even: roll KEDUA kembali normal (ganjil muncul lagi)');
  ok(lucky.every(r => r.first === 6), 'Lucky: roll berikutnya = 6');
  ok(lucky.every(r => !r.flagsAfter), 'Lucky: flag reset setelah dipakai');
  ok(new Set(lucky.map(r => r.second)).size > 1, 'Lucky: roll KEDUA kembali normal (bukan selalu 6)');
  /* tanpa flag: dadu normal 1..6 merata */
  { const { fn, rec } = mkRoll(); const c = {}; for (let i = 0; i < 3000; i++) { const p = mkPlayer(); fn.setP(p); await fn.doRoll(); const v = rec.pop(); c[v] = (c[v] || 0) + 1; }
    ok(Object.keys(c).sort().join('') === '123456' && Object.values(c).every(n => n > 400), 'Dadu normal tanpa flag tetap 1..6 merata', JSON.stringify(c)); }
  /* eksklusif: reward dadu baru menggantikan yang lama; Potion (p4) tidak berubah */
  { const { fn, rec } = mkRoll(); const p = mkPlayer(); await fn.applyChestReward(p, { id: 'odd' }, 1); await fn.applyChestReward(p, { id: 'lucky' }, 1);
    ok(p.lucky && !p.odd && !p.even, 'Flag dadu Chest eksklusif (reward terbaru menggantikan)');
    const q = mkPlayer({ p4: true }); fn.setP(q); await fn.doRoll(); const v = rec.pop(); ok(v >= 4 && v <= 6 && q.p4 === false, 'Potion p4 tanpa flag Chest: perilaku lama utuh (4-6, lalu reset)');
    const w = mkPlayer({ p4: true, even: true }); fn.setP(w); await fn.doRoll(); const v2 = rec.pop(); ok([2, 4, 6].includes(v2) && w.even === false && w.p4 === true, 'Flag Chest didahulukan; p4 tidak ikut terpakai (tetap tersedia)'); }

  /* =============== 6. ADD ROLL (playTurn asli) =============== */
  section('6. Add Roll — playTurn asli');
  const forceReward = id => [slotFor(1000, POOL, id)];
  async function landOnChest(rewardId, startPos, v, extra) {
    const t = makeEnv(); const p = mkPlayer(Object.assign({ pos: startPos }, extra || {})); t.api.players = [p]; t.api.cur = 0;
    t.api.busy = true;
    await withRandom(forceReward(rewardId), () => t.api.playTurn(p, v, 1, 0));
    return { t, p };
  }
  { const { t, p } = await landOnChest('addroll', 3, 3);  /* 3+3=6 = Chest */
    ok(p.pos === 6, 'Add Roll: hasil roll normal tetap diterapkan (pion di 6)');
    ok(t.calls.beginTurn.length === 1 && t.calls.beginTurn[0] === true && t.calls.nextTurn === 0, 'Add Roll: giliran yang sama dilanjutkan (beginTurn(true)), bukan nextTurn');
    ok(p.extra === false, 'Add Roll: p.extra dipakai tepat satu kali (reset setelah roll tambahan dimulai)');
    ok(t.api.CHEST_LC.rewards === 1, 'Add Roll: reward diberikan 1x'); }
  { const { t, p } = await landOnChest('coin', 3, 3);
    ok(t.calls.nextTurn === 1 && t.calls.beginTurn.length === 0 && p.pos === 6, 'Reward non-Add-Roll (Coin): giliran normal -> nextTurn'); }

  /* =============== 7. SURPRISE tidak memicu event petak tujuan (playTurn asli) =============== */
  section('7. Surprise tidak chain event (playTurn asli)');
  const chainCases = [
    { name: 'Ladder (3) dari Chest 6, -3', start: 3, v: 3, d: -3, expPos: 3, watch: 'climb' },
    { name: 'Snake (17) dari Chest 15, +2', start: 12, v: 3, d: +2, expPos: 17, watch: 'bite' },
    { name: 'Snake (62) dari Chest 59, +3', start: 56, v: 3, d: +3, expPos: 62, watch: 'bite' },
    { name: 'Mob villager (45) dari Chest 46, -1', start: 43, v: 3, d: -1, expPos: 45, watch: 'mobReact' },
    { name: 'Mob warden (85) dari Chest 82, +3', start: 79, v: 3, d: +3, expPos: 85, watch: 'mobReact' },
    { name: 'Mob blaze (66) dari Chest 64, +2', start: 61, v: 3, d: +2, expPos: 66, watch: 'mobReact' },
    { name: 'Chest 34, +1 -> 35 (hanya 1 Chest dibuka)', start: 31, v: 3, d: +1, expPos: 35, watch: 'open' }
  ];
  for (const c of chainCases) {
    const t = makeEnv(); const p = mkPlayer({ pos: c.start }); t.api.players = [p]; t.api.cur = 0; t.api.busy = true;
    const di = [-3, -2, -1, 1, 2, 3].indexOf(c.d); const seq = [slotFor(1000, POOL, 'surprise'), (di + 0.5) / 6];
    const sc0 = p.score;
    await withRandom(seq, () => t.api.playTurn(p, c.v, 1, 0));
    const watched = c.watch === 'open' ? t.calls.open : t.calls[c.watch];
    const expWatched = c.watch === 'open' ? 1 : 0; /* chest: tepat 1 kali open (milik chest asal) */
    ok(p.pos === c.expPos && watched === expWatched && p.score === sc0, c.name + ': pos=' + p.pos + ', ' + c.watch + '=' + watched + ', skor tak berubah');
  }

  /* =============== 8. CHEST GUARD & reward 1x =============== */
  section('8. Chest guard & reward sekali');
  { const t = makeEnv(); const p = mkPlayer({ pos: 6 }); const PD = t.win.PlayerData; const c0 = PD.coins();
    const r = await withRandom(forceReward('coin'), async () => {
      const a = t.api.giveChest(p, 'tokA'); const b = await t.api.giveChest(p, 'tokB'); /* saat A berjalan -> ditolak */
      const aa = await a; const c = await t.api.giveChest(p, 'tokA'); /* token sama -> ditolak */
      return { a: aa, b, c };
    });
    ok(r.a.status === 'accepted' && r.b.status === 'rejected' && r.c.status === 'rejected', 'trigger ganda (bersamaan & token sama) ditolak');
    ok(t.api.CHEST_LC.rewards === 1 && PD.coins() === c0 + 5, 'reward tepat 1x (hanya +5 Coin sekali)');
    ok(t.calls.open === 1 && t.calls.close >= 1, 'OPEN dulu lalu CLOSE; reward di antara keduanya (lifecycle Feature 1 utuh)');
    const again = await withRandom(forceReward('coin'), () => t.api.giveChest(p, 'tokC')); ok(again.status === 'accepted' && t.api.CHEST_LC.rewards === 2 && PD.coins() === c0 + 10, 'landing Chest berikutnya (token baru) tetap bekerja');
  }
  { /* reset game di tengah proses -> stale, reward tidak ganda */
    const t = makeEnv(); const p = mkPlayer({ pos: 6 }); const PD = t.win.PlayerData; const c0 = PD.coins();
    const gen = t.api; /* gameId diubah sesaat setelah giveChest dimulai */
    const r = await (async () => { const pr = gen.giveChest(p, 'tokS'); gen.gameId = 99; return pr; })();
    ok(r.status === 'stale' && PD.coins() === c0 && gen.CHEST_LC.active === false, 'game direset di tengah lifecycle -> stale, tanpa reward, guard dilepas'); }

  /* =============== 9. POWER EXCLUDED =============== */
  section('9. Power dikecualikan dari Chest');
  const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const code = noComments(CHEST_SRC);
  ok(!/\b(usePU|puFx|startPU|showPUCard|PUN)\b/.test(code), 'kode Chest (resolver/apply/giveChest) tidak mereferensikan usePU/puFx/startPU/showPUCard/PUN');
  ok(!/\.pu\b|['"](sword|feather|tnt|totem|potion|grass)['"]|\.(shield|bonus|p4)\b/.test(code), 'kode Chest tidak menyentuh inventori Power / shield / bonus / p4');
  { let any = 0; for (const id of Object.keys(EXP)) { const t = makeEnv(); const p = mkPlayer({ pos: 20 }); await t.api.applyChestReward(p, { id }, 1); any += t.calls.usePU + t.calls.puFx + t.calls.startPU + t.calls.showPUCard; }
    ok(any === 0, 'dinamis: menjalankan SEMUA 9 reward -> 0 panggilan usePU/puFx/startPU/showPUCard'); }
  { const t = makeEnv(); const p = mkPlayer({ pos: 6 }); t.api.CHEST_LC.done.clear(); let n = 0;
    for (let i = 0; i < 200; i++) { await t.api.giveChest(p, 'k' + i); n += t.calls.usePU + t.calls.puFx + t.calls.startPU + t.calls.showPUCard; }
    ok(n === 0 && t.api.CHEST_LC.rewards === 200, 'dinamis: 200 siklus giveChest nyata -> 0 Power, 200 reward (1 per siklus)'); }

  /* =============== 10. NORMAL GAMEPLAY (playTurn asli) =============== */
  section('10. Regresi gameplay normal (playTurn asli)');
  { const t = makeEnv(); const p = mkPlayer({ pos: 0 }); t.api.players = [p]; t.api.busy = true; await t.api.playTurn(p, 3, 1, 0);
    ok(p.pos === 22 && p.score === 10 && t.calls.climb === 1 && t.calls.nextTurn === 1, 'Ladder normal: 0+3 -> tangga 3->22, +10 skor, giliran lanjut'); }
  { const t = makeEnv(); const p = mkPlayer({ pos: 12 }); t.api.players = [p]; t.api.busy = true; await t.api.playTurn(p, 5, 1, 0);
    ok(p.pos === 7 && t.calls.nextTurn === 1, 'Snake normal: 12+5=17 -> ular ke 7, giliran lanjut'); }
  { const t = makeEnv(); const p = mkPlayer({ pos: 10 }); t.api.players = [p]; t.api.busy = true; await t.api.playTurn(p, 6, 1, 0);
    ok(p.pos === 16 && t.calls.beginTurn.length === 1 && t.calls.nextTurn === 0, 'Dadu 6 normal: tetap dapat roll lagi'); }
  { const t = makeEnv(); const p = mkPlayer({ pos: 10 }); t.api.players = [p]; t.api.busy = true; await t.api.playTurn(p, 2, 1, 0);
    ok(p.pos === 12 && t.calls.nextTurn === 1 && t.calls.open === 0, 'Movement normal (non-Chest): maju sesuai dadu, tanpa Chest'); }
  { const { t, p } = await landOnChest('empty', 3, 3); ok(p.pos === 6 && t.calls.nextTurn === 1 && !p.extra && t.api.CHEST_LC.active === false, 'Setelah reward Empty: turn/movement normal, guard terlepas'); }
  { const { t, p } = await landOnChest('odd', 3, 3); ok(p.odd === true && t.calls.nextTurn === 1, 'Setelah reward Odd: flag aktif, giliran normal berpindah'); }
  { /* pengacak pemain CPU: reward dadu juga bekerja, currency tidak */
    const t = makeEnv(); const PD = t.win.PlayerData; const s0 = JSON.stringify(PD.snapshot()); const p = mkPlayer({ cpu: true, pos: 3, name: 'CPU' }); t.api.players = [p]; t.api.busy = true;
    await withRandom(forceReward('coin'), () => t.api.playTurn(p, 3, 1, 0)); ok(JSON.stringify(PD.snapshot()) === s0 && p.pos === 6, 'CPU mendarat di Chest: tidak ada currency pemain, game berjalan normal'); }

  console.log('\n=== RINGKASAN: ' + pass + ' lulus, ' + fail + ' gagal ===');
  if (fail) { console.log('Gagal:\n - ' + failures.join('\n - ')); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
