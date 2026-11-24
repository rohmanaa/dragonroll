/* tambang-data.js — data produksi tambang pasif (5 slot = Mine 1..5 = layer 1..5), lift, gudang ore. v2: SEMUA LOKAL (localStorage); server mine_* baru 3 slot, belum dipakai.
   (komentar lama berikut tetap berlaku untuk bentuk data:) Bentuk data = hasil RPC mine_get() di repo.
   Mode server : window.UT.MineService (data/mining/js/mine-service.js) + window.PlayerData → server menjadi sumber kebenaran.
   Mode lokal  : tiruan di localStorage dengan angka yang sama dengan supabase/migrations/202611180001_tambang.sql (untuk pratinjau).
   API: D.load() D.est(i) D.boostLeft(i) D.crewOf(i) D.status(i) D.act(i,'collect'|'boost'|'unlock'|'speed'|'cap') D.wallet */
(function () {
  'use strict';
  const MW = window.TambangMW = window.TambangMW || {};
  const D = MW.data = { slots: [], config: { boost_mult: 2, boost_secs: 14400, boost_daily: 4, max_speed_lv: 5, max_cap_lv: 5 }, mode: 'lokal', ready: false, cheer: [0, 0, 0, 0, 0, 0, 0] };
  const now = () => performance.now();

  /* ---------- saldo: PlayerData bila ada, kalau tidak tiruan lokal ---------- */
  const PD = window.PlayerData, LKEY = 'tambang:local';
  let L = null;
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LKEY)); } catch (e) { return null; } };
  const lsSet = () => { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (e) { } };
  const subs = [];
  D.wallet = {
    ready: () => true,
    coins: () => L.coins,
    gems: () => L.gems,
    subscribe: (f) => { subs.push(f); if (PD && PD.subscribe) try { PD.subscribe((r) => { if (r === 'server-wallet' || r === 'storage' || r === 'pageshow') f(); }); } catch (e) { } },
    add: (c, g) => { L.coins += c || 0; L.gems += g || 0; lsSet(); subs.forEach((f) => f()); }
  };
  const settings = () => { try { return PD.settings(); } catch (e) { return {}; } };
  D.feedback = function () { try { if (settings().vibration && navigator.vibrate) navigator.vibrate(15); if (settings().sound) UT.Audio.play('button'); } catch (e) { } };

  /* ---------- ekonomi (salinan angka SQL) ---------- */
  const N = 5;
  const BASE = [0, 0.8, 1.2, 2, 3.2, 4.8, 7.2], UNLOCK = [0, 500, 2000, 6000, 15000, 40000, 100000], SMULT = [0, 1, 1.25, 1.5, 1.75, 2], CAP = [0, 15, 20, 25, 30, 40];
  const UPC = { speed: [0, 0, 400, 1000, 2500, 6000], cap: [0, 0, 300, 800, 2000, 5000] }, UPF = [0, 1, 1.5, 2, 2.5, 3, 3.5], BCOST = [0, 150, 200, 300, 450, 650, 900];
  const upCost = (k, slot, to) => Math.round(UPC[k][to] * UPF[slot]);
  /* ore tiap tambang (bobot) — semua ore MENTAH: harus dilebur dulu (tahap 2) baru jadi emerald/koin/pelengkap */
  const ORES = { copper: { n: 'Ore Copper', c: '#e0804a' }, iron: { n: 'Ore Iron', c: '#d6d0c8' }, coal: { n: 'Batu Bara', c: '#3a3a44' }, lapis: { n: 'Ore Lapis', c: '#3a5fe0' }, gold: { n: 'Ore Emas', c: '#ffd24d' }, amethyst: { n: 'Ore Amethyst', c: '#b06cff' }, diamond: { n: 'Ore Diamond', c: '#6fe8ff' } };
  const MIX = [null, { copper: 1 }, { coal: 0.5, iron: 0.5 }, { lapis: 0.5, amethyst: 0.5 }, { gold: 0.6, lapis: 0.4 }, { diamond: 0.4, gold: 0.3, amethyst: 0.3 }];
  const LIFT = { unlock: 1000, cap: [0, 20, 35, 60, 100, 160], capCost: [0, 0, 800, 2200, 6000, 15000], spd: [0, 1, 1.4, 1.9], spdCost: [0, 0, 1500, 5000] };
  D.N = N; D.ORES = ORES; D.MIX = MIX; D.LIFT = LIFT;
  /* ---- hutan, bahan bakar, peleburan (tahap 2) ---- */
  const FOREST = { trees: 6, regrowMs: 5 * 60 * 1000, wood: 4, hire: [0, 600, 1500, 4000], max: 3 };   /* penebang ke-1 = membuka hutan; maks 3 */
  const MGR = [0, 1, 2, 3, 5, 8];   /* biaya Manager per tambang (Emerald); tanpa manager produksi ×0.5 */
  /* Gudang: peti penampung (kapasitas), batas klaim harian ke inventory, waktu offline (jam). Semua upgrade pakai Koin */
  const GST = { cap: [0, 60, 120, 250, 500, 1000], capCost: [0, 0, 600, 1800, 5000, 14000], day: [0, 40, 80, 160, 320, 640], dayCost: [0, 0, 500, 1500, 4500, 12000], off: [0, 2, 3], offCost: [0, 0, 3000], fuelKeep: { wood: 10, coal: 5 } };
  const SWEEP_MS = 15000, SMELT_MS = 6000, CHOP_MS = 12000;   /* lift angkut tiap 15 dtk; 1 ore / 6 dtk / furnace; 1 pohon / 12 dtk / penebang (hitungan offline) */
  const FURN = { max: 3, cost: [0, 0, 3000, 9000], cap: 10 };   /* furnace: jumlah, biaya, kapasitas lebur per furnace per aksi */
  const FUEL = { wood: 2, coal: 4 };   /* satuan bakar per 1 barang */
  /* resep: ore -> hasil. bakar = satuan bakar. out: 'gem' (Emerald), 'coin' (Koin), atau 'good' (pelengkap) */
  const RECIPES = {
    copper: { n: 'Batang Copper', ore: 'copper', fuel: 1, out: 'good', qty: 1, ic: 'tambang-world/images/tambang-koin-tumpuk.webp', fl: 'sepia(1) hue-rotate(-20deg) saturate(2.2)' },
    iron: { n: 'Batang Iron', ore: 'iron', fuel: 1, out: 'good', qty: 1, ic: 'tambang-world/images/tambang-kristal-heksagon.webp', fl: 'grayscale(1) brightness(1.15)' },
    gold: { n: 'Batang Emas', ore: 'gold', fuel: 2, out: 'good', qty: 1, ic: 'tambang-world/images/tambang-ikon-koin-emas.webp' },
  };
  const GOODS = ['copper', 'iron', 'gold', 'lapis', 'amethyst', 'diamond'], OREK = ['coal'].concat(GOODS);
  const GEMS = ['lapis', 'amethyst', 'diamond'];   /* permata: tidak dilebur, langsung jadi barang */
  D.GEMS = GEMS;
  const emptyGoods = () => { const o = {}; GOODS.forEach((k) => { o[k] = 0; }); return o; };
  D.FOREST = FOREST; D.FURN = FURN; D.MGR = MGR; D.GST = GST; D.SWEEP_MS = SWEEP_MS; D.SMELT_MS = SMELT_MS; D.FUEL = FUEL; D.RECIPES = RECIPES;
  const emptyInv = () => { const o = {}; OREK.forEach((k) => { o[k] = 0; }); return o; };
  const mkBag = () => ({ inv: emptyInv(), goods: emptyGoods(), wood: 0 });
  const bagTotal = (b) => OREK.reduce((a, k) => a + b.inv[k], 0) + GOODS.reduce((a, k) => a + b.goods[k], 0) + b.wood;
  function rawNew() { return { coins: 1250, gems: 12, mines: {}, lift: { on: 1, cap: 1, spd: 1 }, inv: emptyInv(), t0: Date.now(), wood: 0, goods: emptyGoods(), forest: { workers: 0, trees: [] }, furn: 0, store: mkBag(), bag: mkBag(), gup: { cap: 1, day: 1, off: 1 }, claim: { d: '', n: 0 }, seen: Date.now(), transit: null, swi: 0 }; }
  /* siklus kerja/istirahat: kerja 30 mnt, istirahat 10 mnt (5 mnt bila ada Manager). Saat istirahat tidak ada produksi */
  const WORK_MS = 30 * 60000, REST_MS = 10 * 60000, REST_MGR_MS = 5 * 60000;
  D.REST = { work: WORK_MS, rest: REST_MS, restMgr: REST_MGR_MS };
  const cycOf = (r) => ({ W: WORK_MS, C: WORK_MS + (r && r.mgr ? REST_MGR_MS : REST_MS) });
  const workedTo = (t0, x, W, C) => { const d = Math.max(0, x - t0); return Math.floor(d / C) * W + Math.min(W, d % C); };
  const worked = (r, a, b) => { const c = cycOf(r), t0 = r.t0 || r.at; return Math.max(0, workedTo(t0, b, c.W, c.C) - workedTo(t0, a, c.W, c.C)); };
  const phaseAt = (t0, t, W, C) => { const d = Math.max(0, t - t0) % C; if (d < W) return { resting: false, left: W - d, kind: null }; const f = (d - W) / (C - W); return { resting: true, left: C - d, kind: f < 0.45 ? 'eat' : 'sleep' }; };
  function stockNow(r, t) { /* t = ms */
    const rate = BASE[r.slot] * SMULT[r.speed], cap = CAP[r.cap];
    const w = worked(r, r.at, t), wb = r.bu && r.bu > r.at ? worked(r, r.at, Math.min(r.bu, t)) : 0;
    return Math.min(cap, r.stock + rate * (w + wb * (D.config.boost_mult - 1)) / 3.6e6);
  }
  function slotJson(i) {
    const r = L.mines[i];
    if (!r) return { slot: i, unlocked: false, unlock_cost: UNLOCK[i], can_unlock: i === 1 || !!L.mines[i - 1], base_rate: BASE[i], mix: MIX[i] };
    const t = Date.now(), stock = stockNow(r, t), cap = CAP[r.cap], rate = BASE[i] * SMULT[r.speed], duty = WORK_MS / cycOf(r).C, left = r.bu > t ? Math.ceil((r.bu - t) / 1000) : 0;
    const day = new Date(t + 7 * 3.6e6).toISOString().slice(0, 10), used = r.bd === day ? r.bc : 0, m = D.config.boost_mult;
    let full;
    if (stock >= cap) full = 0;
    else if (left > 0) { const g = rate * m * left / 3600; full = (cap - stock) <= g ? Math.ceil((cap - stock) / (rate * m * duty) * 3600) : left + Math.ceil((cap - stock - g) / (rate * duty) * 3600); }
    else full = Math.ceil((cap - stock) / (rate * duty) * 3600);
    return { slot: i, unlocked: true, mix: MIX[i], speed_lv: r.speed, cap_lv: r.cap, mgr: !!r.mgr, mgr_cost: MGR[i], rest_secs: Math.round((r.mgr ? REST_MGR_MS : REST_MS) / 1000), stock: stock, cap: cap, rate: rate, base_rate: BASE[i], full_in_secs: full,
      boost: { active: left > 0, left_secs: left, left_today: D.config.boost_daily - used, cost: BCOST[i] },
      next_speed_cost: r.speed >= 5 ? null : upCost('speed', i, r.speed + 1), next_cap_cost: r.cap >= 5 ? null : upCost('cap', i, r.cap + 1) };
  }
  function alloc(n, mix) { /* bagi n ore menurut bobot (sisa terbesar) */
    const ks = Object.keys(mix), out = {}; let used = 0; const rem = [];
    ks.forEach((k) => { const x = n * mix[k], f = Math.floor(x); out[k] = f; used += f; rem.push([x - f, k]); });
    rem.sort((a, b) => b[0] - a[0]); for (let j = 0; used < n; j++, used++) out[rem[j % rem.length][1]]++;
    return out;
  }
  const localApi = {
    get: async () => ({ ok: true, coins: L.coins, gems: L.gems, slots: [1, 2, 3, 4, 5].map(slotJson), config: D.config }),
    act: async (i, a) => {
      const r = L.mines[i], t = Date.now();
      if (a === 'unlock') { if (r) return { ok: false, reason: 'sudah-dibuka' }; if (i > 1 && !L.mines[i - 1]) return { ok: false, reason: 'buka-berurutan' }; if (L.coins < UNLOCK[i]) return { ok: false, reason: 'saldo-kurang' }; L.coins -= UNLOCK[i]; L.mines[i] = { slot: i, speed: 1, cap: 1, stock: 0, at: t, t0: t, bu: 0, bd: '', bc: 0 }; }
      else if (!r) return { ok: false, reason: 'terkunci' };
      else if (a === 'manager') { if (r.mgr) return { ok: false, reason: 'sudah-dibuka' }; if (L.gems < MGR[i]) return { ok: false, reason: 'emerald-kurang' }; L.gems -= MGR[i]; r.stock = stockNow(r, t); r.at = t; r.t0 = t; r.mgr = 1; }
      else if (a === 'collect') {
        if (i > 1 && !L.lift.on) return { ok: false, reason: 'lift-terkunci' };
        const have = Math.floor(stockNow(r, t)); if (have < 1) return { ok: false, reason: 'peti-kosong', slot_data: slotJson(i) };
        const n = Math.min(have, i > 1 ? LIFT.cap[L.lift.cap] : Infinity), got = alloc(n, MIX[i]);
        r.stock = stockNow(r, t) - n; r.at = t; for (const k in got) L.inv[k] += got[k];
        L.lastLoad = got; lsSet(); subs.forEach((f) => f());
        return { ok: true, collected: n, ores: got, left: have - n, slot_data: slotJson(i) };
      }
      else if (a === 'boost') {
        if (!r.mgr) return { ok: false, reason: 'perlu-manager' };
        const day = new Date(t + 7 * 3.6e6).toISOString().slice(0, 10); if (r.bd !== day) { r.bd = day; r.bc = 0; }
        if (r.bu > t) return { ok: false, reason: 'boost-aktif' }; if (r.bc >= D.config.boost_daily) return { ok: false, reason: 'batas-harian' };
        if (L.coins < BCOST[i]) return { ok: false, reason: 'saldo-kurang' };
        L.coins -= BCOST[i]; r.stock = stockNow(r, t); r.at = t; r.bu = t + D.config.boost_secs * 1000; r.bc++;
      } else if (a === 'speed' || a === 'cap') {
        const k = a === 'speed' ? 'speed' : 'cap', lv = r[k]; if (lv >= 5) return { ok: false, reason: 'level-maks' };
        const c = upCost(a, i, lv + 1); if (L.coins < c) return { ok: false, reason: 'saldo-kurang' };
        L.coins -= c; r.stock = stockNow(r, t); r.at = t; r[k] = lv + 1;
      }
      lsSet(); subs.forEach((f) => f()); return { ok: true, slot_data: slotJson(i) };
    }
  };
  const serverApi = (ms) => ({
    get: () => ms.get(),
    act: (i, a) => a === 'collect' ? ms.collect(i) : a === 'unlock' ? ms.unlock(i) : a === 'boost' ? ms.boost(i) : ms.upgrade(i, a)
  });
  let API = null;
  function pickApi() {
    const ms = window.UT && UT.MineService && UT.MineService.get && UT.MineService.get();
    D.mode = 'lokal'; return localApi;
  }

  /* ---------- perkiraan tampilan (sama dengan tambang.js repo) ---------- */
  const stamp = (s) => { s.at = now(); return s; };
  D.est = (i) => { const r = L.mines[i]; return r ? Math.min(CAP[r.cap], stockNow(r, Date.now())) : 0; };
  D.restOf = (i) => { const r = L.mines[i]; if (!r) return { resting: false, left: 0, kind: null }; const c = cycOf(r); return phaseAt(r.t0 || r.at, Date.now(), c.W, c.C); };
  D.restGlobal = () => phaseAt(L.t0 || 0, Date.now(), WORK_MS, WORK_MS + REST_MS);
  D.boostLeft = (i) => { const s = D.slots[i - 1]; return s && s.unlocked ? Math.max(0, s.boost.left_secs - (now() - s.at) / 1000) : 0; };
  D.crewOf = (i) => { const s = D.slots[i - 1]; if (!s || !s.unlocked) return 1; const l = s.speed_lv || 1; return Math.min(3, 1 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0) + (D.boostLeft(i) > 0 ? 1 : 0)); };
  D.status = (i) => { const s = D.slots[i - 1]; if (!s) return 'locked'; if (!s.unlocked) return 'locked'; if (D.cheer[i] > now()) return 'cheer'; if (D.restOf(i).resting) return 'rest'; return D.est(i) >= s.cap - 1e-6 ? 'full' : 'work'; };
  D.rate = (i) => { const s = D.slots[i - 1]; return s && s.unlocked && !D.restOf(i).resting ? (D.boostLeft(i) > 0 ? s.rate * D.config.boost_mult : s.rate) : 0; };
  D.onChange = null;
  D.load = async function () {
    API = pickApi(); const r = await API.get();
    if (!r || !r.ok) return r || { ok: false, reason: 'jaringan' };
    r.slots.forEach(stamp); D.slots = r.slots; if (r.config) D.config = r.config; D.ready = true; if (D.onChange) D.onChange(); return r;
  };
  D.act = async function (i, a) {
    if (!API) API = pickApi();
    const r = await API.act(i, a);
    if (r && r.slot_data) { D.slots[i - 1] = stamp(r.slot_data); }
    else if (r && r.ok === false && r.slot_data) D.slots[i - 1] = stamp(r.slot_data);
    if (r && r.ok) { if (a === 'collect') D.cheer[i] = now() + 3200; else if (a === 'unlock') D.cheer[i] = now() + 3000; }
    if (D.onChange) D.onChange(); return r;
  };
  /* ---------- lift ---------- */
  D.lift = () => { const l = L.lift; return { on: !!l.on, cap_lv: l.cap, spd_lv: l.spd, cap: LIFT.cap[l.cap], spd: LIFT.spd[l.spd], unlock_cost: LIFT.unlock, next_cap_cost: l.cap >= 5 ? null : LIFT.capCost[l.cap + 1], next_spd_cost: l.spd >= 3 ? null : LIFT.spdCost[l.spd + 1] }; };
  D.liftAct = function (a) {
    const l = L.lift; let c;
    if (a === 'unlock') { if (l.on) return { ok: false, reason: 'sudah-dibuka' }; c = LIFT.unlock; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' }; l.on = 1; }
    else if (!l.on) return { ok: false, reason: 'lift-terkunci' };
    else if (a === 'cap') { if (l.cap >= 5) return { ok: false, reason: 'level-maks' }; c = LIFT.capCost[l.cap + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' }; l.cap++; }
    else if (a === 'spd') { if (l.spd >= 3) return { ok: false, reason: 'level-maks' }; c = LIFT.spdCost[l.spd + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' }; l.spd++; }
    L.coins -= c; lsSet(); subs.forEach((f) => f()); if (D.onChange) D.onChange(); return { ok: true };
  };
  D.lastLoad = () => L.lastLoad || null;
  D.inv = () => L.inv;
  D.invTotal = () => Object.keys(L.inv).reduce((a, k) => a + L.inv[k], 0);
  /* Boost semua: tiap tambang terbuka yang belum aktif & masih punya jatah harian, selama koin cukup */
  D.boostPlan = () => { let cost = 0, n = 0; D.slots.forEach((s) => { if (s.unlocked && s.mgr && !(D.boostLeft(s.slot) > 0) && s.boost.left_today > 0) { cost += s.boost.cost; n++; } }); return { n: n, cost: cost }; };
  D.boostAll = async function () {
    let n = 0, cost = 0;
    for (const s of D.slots.slice()) { if (!s.unlocked || !s.mgr || D.boostLeft(s.slot) > 0 || s.boost.left_today <= 0) continue; const r = await D.act(s.slot, 'boost'); if (r && r.ok) { n++; cost += s.boost.cost; } else if (r && r.reason === 'saldo-kurang') break; }
    return { ok: n > 0, n: n, cost: cost, reason: n ? null : 'saldo-kurang' };
  };
  /* hutan */
  const touch = () => { lsSet(); subs.forEach((f) => f()); };
  D.treeUp = (k) => { const t = L.forest.trees[k]; return !t.at || Date.now() >= t.at; };
  D.treeGrow = (k) => { const t = L.forest.trees[k]; return !t.at ? 1 : Math.max(0, Math.min(1, 1 - (t.at - Date.now()) / FOREST.regrowMs)); };
  D.forest = () => ({ workers: L.forest.workers, max: FOREST.max, next_cost: L.forest.workers >= FOREST.max ? null : FOREST.hire[L.forest.workers + 1], regrow_min: FOREST.regrowMs / 60000, yield: FOREST.wood, up: L.forest.trees.filter((_, k) => D.treeUp(k)).length, total: FOREST.trees });
  D.chop = (k) => { if (!D.treeUp(k) || D.storeFree() < FOREST.wood || D.restGlobal().resting) return 0; L.forest.trees[k].at = Date.now() + FOREST.regrowMs; L.store.wood += FOREST.wood; touch(); return FOREST.wood; };
  D.hire = function () {
    const f = L.forest; if (f.workers >= FOREST.max) return { ok: false, reason: 'level-maks' };
    const c = FOREST.hire[f.workers + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' };
    L.coins -= c; f.workers++; touch(); return { ok: true };
  };
  D.furnace = () => ({ n: L.furn, max: FURN.max, next_cost: L.furn >= FURN.max ? null : FURN.cost[L.furn + 1], cap: FURN.cap * L.furn, per: FURN.cap });
  D.furnaceUp = function () {
    if (L.furn >= FURN.max) return { ok: false, reason: 'level-maks' };
    const c = FURN.cost[L.furn + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' };
    L.coins -= c; L.furn++; touch(); return { ok: true };
  };
  /* ---------- gudang (peti), inventori pemain, klaim ---------- */
  const dayKey = () => new Date(Date.now() + 7 * 3.6e6).toISOString().slice(0, 10);
  const gcap = () => GST.cap[L.gup.cap];
  D.inv = () => L.store.inv; D.goods = () => L.store.goods; D.wood = () => L.store.wood; D.bag = () => L.bag;
  D.invTotal = () => bagTotal(L.store);
  D.storeUsed = () => bagTotal(L.store); D.storeFree = () => Math.max(0, gcap() - bagTotal(L.store) - (L.transit ? L.transit.n : 0));
  D.fuelUnits = () => L.store.wood * FUEL.wood + L.store.inv.coal * FUEL.coal;
  D.gudang = () => {
    if (L.claim.d !== dayKey()) { L.claim.d = dayKey(); L.claim.n = 0; }
    const g = L.gup;
    return { used: bagTotal(L.store), cap: gcap(), cap_lv: g.cap, next_cap_cost: g.cap >= 5 ? null : GST.capCost[g.cap + 1], next_cap: g.cap >= 5 ? null : GST.cap[g.cap + 1],
      day_lv: g.day, day_limit: GST.day[g.day], day_used: L.claim.n, next_day_cost: g.day >= 5 ? null : GST.dayCost[g.day + 1], next_day: g.day >= 5 ? null : GST.day[g.day + 1],
      off_lv: g.off, off_h: GST.off[g.off], next_off_cost: g.off >= 2 ? null : GST.offCost[g.off + 1], next_off: g.off >= 2 ? null : GST.off[g.off + 1], bag: bagTotal(L.bag), transit: L.transit ? L.transit.n : 0, keep: GST.fuelKeep };
  };
  D.gudangUp = function (k) {
    const g = L.gup; let c;
    if (k === 'cap') { if (g.cap >= 5) return { ok: false, reason: 'level-maks' }; c = GST.capCost[g.cap + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' }; g.cap++; }
    else if (k === 'day') { if (g.day >= 5) return { ok: false, reason: 'level-maks' }; c = GST.dayCost[g.day + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' }; g.day++; }
    else { if (g.off >= 2) return { ok: false, reason: 'level-maks' }; c = GST.offCost[g.off + 1]; if (L.coins < c) return { ok: false, reason: 'saldo-kurang' }; g.off++; }
    L.coins -= c; touch(); return { ok: true };
  };
  /* KLAIM: satu tombol. Pindahkan batangan + ore + kayu/batu bara di atas cadangan bahan bakar ke inventori, maks sisa kuota harian */
  D.claim = function () {
    const gd = D.gudang(), S = L.store, B = L.bag; let left = Infinity, moved = 0;
    if (bagTotal(S) < 1) return { ok: false, reason: 'gudang-kosong' };
    const take = (src, dst, k, keep) => { const n = Math.min(src[k] - (keep || 0), left); if (n > 0) { src[k] -= n; dst[k] = (dst[k] || 0) + n; left -= n; moved += n; } };
    GOODS.forEach((k) => take(S.goods, B.goods, k)); OREK.forEach((k) => take(S.inv, B.inv, k, k === 'coal' ? GST.fuelKeep.coal : 0));
    { const n = Math.min(S.wood - GST.fuelKeep.wood, left); if (n > 0) { S.wood -= n; B.wood += n; left -= n; moved += n; } }
    if (moved < 1) return { ok: false, reason: 'hanya-cadangan' };
    L.claim.n += moved; touch(); return { ok: true, moved: moved, left: bagTotal(S) };
  };
  /* ---------- lift otomatis: tambang -> Gudang ---------- */
  D.sweepPlan = function () {
    if (!L.lift.on || L.transit) return null;
    const free = D.storeFree(); if (free < 1) return null;
    const t = Date.now(), ids = Object.keys(L.mines).map(Number).sort((a, b) => a - b); if (!ids.length) return null;
    for (let j = 0; j < ids.length; j++) {
      const i = ids[(ids.findIndex((x) => x >= (L.swi || 0)) + j + ids.length) % ids.length], r = L.mines[i], have = Math.floor(stockNow(r, t)); if (have < 1) continue;
      const n = Math.min(have, LIFT.cap[L.lift.cap], free), got = alloc(n, MIX[i]);
      r.stock = stockNow(r, t) - n; r.at = t; L.transit = { mine: i, ores: got, n: n }; L.swi = i + 1; lsSet();
      return { mine: i, n: n, ores: got };
    }
    return null;
  };
  /* hadiah langka (gacha) tiap ore tiba di Gudang: peluang kecil per ore + batas harian */
  const DROP = { coin: { p: 0.06, max: 5 }, gem: { p: 0.015, max: 2 }, power: { p: 0.008, max: 1 } };
  const POWERS = ['sword', 'feather', 'tnt', 'totem', 'potion_odd', 'potion_even', 'grass', 'diamond_sword', 'netherite_sword', 'wooden_shield', 'golden_apple', 'fire_charge', 'ice_crystal', 'blaze_core', 'trident', 'dragon_crystal', 'nether_star'];
  D.DROP = DROP; D.POWERS = POWERS;
  D.drops = () => { if (L.drop.d !== dayKey()) L.drop = { d: dayKey(), coin: 0, gem: 0, power: 0 }; return L.drop; };
  D.powers = () => L.powers; D.powerTotal = () => Object.keys(L.powers).reduce((a, k) => a + L.powers[k], 0);
  function rollDrops(mine, n) {
    const dr = D.drops(), got = { coin: 0, gem: 0, power: [] };
    for (let k = 0; k < n; k++) {
      if (dr.coin < DROP.coin.max && Math.random() < DROP.coin.p) { const c = Math.round((40 + Math.random() * 60) * (1 + mine * 0.6)); got.coin += c; dr.coin++; L.coins += c; }
      if (dr.gem < DROP.gem.max && Math.random() < DROP.gem.p) { const g = 1 + (Math.random() < 0.3 ? 1 : 0); got.gem += g; dr.gem++; L.gems += g; }
      if (dr.power < DROP.power.max && Math.random() < DROP.power.p) { const key = POWERS[Math.floor(Math.random() * POWERS.length)]; got.power.push(key); dr.power++; L.powers[key] = (L.powers[key] || 0) + 1; }
    }
    return got;
  }
  /* harga jual per 1 barang: hasil lebur -> Koin/Emerald; ore mentah murah; kayu & batu bara receh */
  const SELL = {
    goods: { copper: { c: 20 }, iron: { c: 30 }, lapis: { c: 80 }, gold: { c: 120 }, amethyst: { c: 150 }, diamond: { c: 400 } },
    ore: { copper: { c: 5 }, iron: { c: 7 }, lapis: { c: 20 }, gold: { c: 30 }, amethyst: { c: 25 }, diamond: { c: 60 }, coal: { c: 3 } },
    wood: { wood: { c: 1 } }
  };
  D.SELL = SELL;
  const bagQ = (grp, k) => grp === 'goods' ? L.bag.goods[k] : grp === 'ore' ? L.bag.inv[k] : L.bag.wood;
  const bagSet = (grp, k, v) => { if (grp === 'goods') L.bag.goods[k] = v; else if (grp === 'ore') L.bag.inv[k] = v; else L.bag.wood = v; };
  D.sellItem = function (grp, k, n) {
    const pr = SELL[grp] && SELL[grp][k]; if (!pr) return { ok: false, reason: 'barang-tidak-ada' };
    const have = bagQ(grp, k) || 0, q = Math.min(n == null ? have : n, have); if (q < 1) return { ok: false, reason: 'inventori-kosong' };
    bagSet(grp, k, have - q); const c = (pr.c || 0) * q, g = (pr.g || 0) * q; L.coins += c; L.gems += g; touch(); return { ok: true, n: q, coins: c, gems: g };
  };
  D.sellPlan = function () { let c = 0, g = 0, n = 0; for (const grp in SELL) for (const k in SELL[grp]) { const q = bagQ(grp, k) || 0; n += q; c += q * (SELL[grp][k].c || 0); g += q * (SELL[grp][k].g || 0); } return { n: n, coins: c, gems: g }; };
  D.sellAll = function () { const p = D.sellPlan(); if (p.n < 1) return { ok: false, reason: 'inventori-kosong' }; for (const grp in SELL) for (const k in SELL[grp]) bagSet(grp, k, 0); L.coins += p.coins; L.gems += p.gems; touch(); return { ok: true, n: p.n, coins: p.coins, gems: p.gems }; };
  D.deliver = function () {
    const tr = L.transit; if (!tr) return null;
    for (const k in tr.ores) { if (GEMS.indexOf(k) >= 0) L.store.goods[k] += tr.ores[k]; else L.store.inv[k] += tr.ores[k]; }
    tr.drops = rollDrops(tr.mine, tr.n); L.dropLog = (L.dropLog || 0);
    L.transit = null; L.lastLoad = tr.ores; touch(); return tr;
  };
  /* ---------- tukang bakar otomatis ---------- */
  function smeltOne() {
    const S = L.store; if (L.furn < 1) return null;
    for (const id in RECIPES) {
      const r = RECIPES[id]; if (S.inv[r.ore] < 1 || D.fuelUnits() < r.fuel) continue;
      let need = r.fuel; const w = Math.min(S.wood, Math.ceil(need / FUEL.wood)); need -= Math.min(need, w * FUEL.wood); S.wood -= w;
      if (need > 0) S.inv.coal -= Math.ceil(need / FUEL.coal);
      S.inv[r.ore]--; S.goods[id] += r.qty; return id;
    }
    return null;
  }
  D.smeltActive = () => { if (L.furn < 1 || D.restGlobal().resting) return false; for (const id in RECIPES) { const r = RECIPES[id]; if (L.store.inv[r.ore] >= 1 && D.fuelUnits() >= r.fuel) return true; } return false; };
  D.smeltQueue = () => Object.keys(RECIPES).reduce((a, id) => a + L.store.inv[RECIPES[id].ore], 0);
  /* ---------- waktu berjalan (online) + kejar offline ---------- */
  let swT = 0, smT = 0, saveT = 0;
  D.tick = function () {
    const now = Date.now(), gap = now - (L.seen || now); const ev = { smelted: [], sweepDue: false, catchup: null };
    if (gap > 20000) { ev.catchup = D.catchup(); return ev; }
    L.seen = now; swT += gap; smT += gap;
    if (swT >= SWEEP_MS) { swT = 0; ev.sweepDue = true; }
    if (D.restGlobal().resting) smT = 0;
    else if (L.furn > 0) { const step = SMELT_MS / L.furn; let guard = 0; while (smT >= step && guard++ < 20) { smT -= step; const id = smeltOne(); if (!id) { smT = 0; break; } ev.smelted.push(id); } } else smT = 0;
    if ((saveT += gap) > 5000 || ev.smelted.length) { saveT = 0; lsSet(); if (ev.smelted.length) subs.forEach((f) => f()); }
    return ev;
  };
  D.save = () => { L.seen = Date.now(); lsSet(); };
  D.offlineReport = null;
  D.catchup = function () {
    const now = Date.now(), gap = now - (L.seen || now); L.seen = now;
    D.deliver();
    if (gap < 20000) return null;
    const eff = Math.min(gap, GST.off[L.gup.off] * 3.6e6), effW = eff * WORK_MS / (WORK_MS + REST_MS), lost = gap - eff, before = bagTotal(L.store), f0 = L.store.wood, c0 = L.coins, g0 = L.gems, p0 = D.powerTotal();
    if (lost > 0) for (const i in L.mines) { const r = L.mines[i]; r.at += lost; if (r.bu) r.bu += lost; }
    let sw = Math.floor(eff / SWEEP_MS), guard = 0; while (sw-- > 0 && guard++ < 3000) { if (!D.sweepPlan()) break; D.deliver(); }
    const ore = bagTotal(L.store) - before;
    /* hutan */
    const F = L.forest; let chops = F.workers * Math.floor(effW / CHOP_MS), allowed = 1 + Math.floor(eff / FOREST.regrowMs); const used = F.trees.map(() => 0);
    for (let k = 0, miss = 0; chops > 0 && miss < F.trees.length && D.storeFree() >= FOREST.wood; k = (k + 1) % F.trees.length) {
      const ok = used[k] < allowed && (used[k] > 0 || D.treeUp(k));
      if (!ok) { miss++; continue; } miss = 0; used[k]++; chops--; L.store.wood += FOREST.wood;
    }
    used.forEach((u, k) => { if (u > 0) F.trees[k].at = now + FOREST.regrowMs * 0.5; });
    const wood = L.store.wood - f0;
    /* peleburan */
    let steps = L.furn > 0 ? Math.floor(effW * L.furn / SMELT_MS) : 0, sm = 0; while (steps-- > 0) { if (!smeltOne()) break; sm++; }
    lsSet(); subs.forEach((f) => f());
    D.offlineReport = { mins: Math.round(eff / 60000), capped: lost > 0, ore: ore, wood: wood, smelted: sm, coin: L.coins - c0, gem: L.gems - g0, power: D.powerTotal() - p0 };
    return D.offlineReport;
  };
  D.MSG = { 'inventori-kosong': 'Inventori kosong — klaim dari Gudang dulu.', 'barang-tidak-ada': 'Barang tidak dikenal.', 'buka-berurutan': 'Buka tambang sebelumnya dulu — tambang dibuka berurutan.', 'perlu-manager': 'Boost dilakukan Manager. Rekrut Manager dulu (Emerald).', 'batas-klaim': 'Batas klaim hari ini sudah habis. Upgrade batas harian atau tunggu besok.', 'gudang-kosong': 'Peti Gudang masih kosong.', 'hanya-cadangan': 'Hanya cadangan bahan bakar yang tersisa di Gudang.', 'emerald-kurang': 'Emerald tidak cukup untuk merekrut Manager.', 'furnace-belum': 'Bangun Furnace dulu di Base Camp.', 'ore-kosong': 'Tidak ada ore untuk dilebur.', 'bahan-bakar-kurang': 'Bahan bakar kurang. Tebang kayu atau ambil batu bara.', 'resep-tidak-ada': 'Resep tidak dikenal.', 'lift-terkunci': 'Buka Lift dulu untuk mengangkut ore dari tambang ini.', 'saldo-kurang': 'Saldo tidak cukup.', 'sudah-dibuka': 'Tambang sudah dibuka.', 'level-maks': 'Sudah level maksimum.', 'boost-aktif': 'Percepat masih aktif.', 'batas-harian': 'Batas Percepat hari ini habis.', 'peti-kosong': 'Peti belum ada isinya.', 'terkunci': 'Buka tambang dulu.', 'jaringan': 'Tidak dapat terhubung ke server.', 'belum-login': 'Silakan login ulang.', 'sedang-diproses': 'Sedang diproses…', 'mode-lokal': 'Tambang butuh akun login.', 'slot-tidak-valid': 'Slot tidak valid.' };
  L = lsGet() || rawNew(); [L.store, L.bag].forEach((B) => { if (B && B.inv && B.goods) GEMS.forEach((k) => { if (B.inv[k] > 0) { B.goods[k] += B.inv[k]; B.inv[k] = 0; } }); }); if (L.gup && L.gup.off > 2) L.gup.off = 2; if (L.gup && L.gup.off < 1) L.gup.off = 1; if (!L.powers) L.powers = {}; if (!L.drop) L.drop = { d: '', coin: 0, gem: 0, power: 0 };
  { const ni = emptyInv(), ng = emptyGoods(); OREK.forEach((k) => { ni[k] = (L.inv && L.inv[k]) || 0; }); GOODS.forEach((k) => { ng[k] = (L.goods && L.goods[k]) || 0; }); L.inv = ni; L.goods = ng; }
  if (!L.store) { L.store = mkBag(); OREK.forEach((k) => { L.store.inv[k] = L.inv[k]; }); GOODS.forEach((k) => { L.store.goods[k] = L.goods[k]; }); L.store.wood = L.wood || 0; L.inv = emptyInv(); L.goods = emptyGoods(); L.wood = 0; }
  for (const k in L.mines) if (!L.mines[k].t0) L.mines[k].t0 = L.mines[k].at;
  if (!L.t0) L.t0 = Date.now();
  if (!L.bag) L.bag = mkBag(); if (!L.gup) L.gup = { cap: 1, day: 1, off: 1 }; if (!L.claim) L.claim = { d: '', n: 0 }; if (L.transit === undefined) L.transit = null; if (!L.seen) L.seen = Date.now();
  if (!L.lift) L.lift = { on: 1, cap: 1, spd: 1 }; L.lift.on = 1; if (!L.inv) L.inv = emptyInv();
  if (L.wood == null) L.wood = 0; if (!L.forest) L.forest = { workers: 0, trees: [] }; if (L.furn == null) L.furn = 0;
  for (let k = 0; k < FOREST.trees; k++) if (!L.forest.trees[k]) L.forest.trees[k] = { at: 0 };   /* at = waktu tumbuh kembali (ms); 0 = berdiri */
})();
