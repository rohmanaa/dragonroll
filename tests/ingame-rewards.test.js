/* Tes reward in-game: pool Chest (koin/XP/Power), koin tiga-6, dan migrasi pembayaran server. Jalankan: node tests/ingame-rewards.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
global.window = global; require('../src/gameplay/js/config.js');
const CFG = global.UT.Gameplay.Config, root = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const main = root('src/gameplay/js/main.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  - ' + name); };

t('pool Chest total 1000 dan memuat coin, xp, power', () => {
  assert.strictEqual(CFG.CHEST_POOL.reduce((a, r) => a + r.w, 0), 1000);
  ['coin', 'xp', 'power'].forEach(id => assert.ok(CFG.CHEST_POOL.some(r => r.id === id && r.w > 0), id));
  assert.strictEqual(new Set(CFG.CHEST_POOL.map(r => r.id)).size, CFG.CHEST_POOL.length);
});
t('setiap id di pool punya penanganan di applyChestReward (selain empty)', () => {
  const fn = main.slice(main.indexOf('async function applyChestReward'), main.indexOf('/* CHEST-REWARD:END */'));
  CFG.CHEST_POOL.filter(r => r.id !== 'empty').forEach(r => assert.ok(new RegExp("case '" + r.id + "'").test(fn), 'tanpa case: ' + r.id));
});
t('nominal: rentang koin/XP valid, tiga-6 = 10 koin, pagar klien ≤ batas server', () => {
  ['coins', 'xp'].forEach(k => { const [a, b] = CFG.CHEST_AMOUNT[k]; assert.ok(a > 0 && b >= a); });
  assert.strictEqual(CFG.TRIPLE_SIX_COINS, 10);
  const sql = root('supabase/migrations/202611340001_match_ingame_bonus.sql');
  assert.ok(sql.includes('c_ingame_coin_online constant int := ' + CFG.INGAME_CAP.coins));
  assert.ok(sql.includes('c_ingame_xp_online   constant int := ' + CFG.INGAME_CAP.xp));
});
t('tiga-6 memberi koin lewat msAdd (hanya manusia, dibatasi)', () => {
  assert.ok(/msAdd\(p,'coins',UT\.Gameplay\.Config\.TRIPLE_SIX_COINS\|0\)/.test(main));
  const f = main.match(/function msAdd[^\n]+/)[0]; assert.ok(f.includes('p.cpu') && f.includes('INGAME_CAP'));
});
t('stats ke server membawa ingame_coins & ingame_xp; layar hasil menampilkan belakangan', () => {
  assert.ok(main.includes('ingame_coins:mm.coins|0,ingame_xp:mm.xp|0'));
  assert.ok(main.includes('animateWinReward(m.gameId,\'coins\'') && main.includes('animateWinReward(m.gameId,\'xp\''));
  assert.ok(/WIN_COINS\.ingame\|0/.test(main));
});
t('migrasi: server membatasi per match & kuota harian, hasil dipisah', () => {
  const sql = root('supabase/migrations/202611340001_match_ingame_bonus.sql');
  ["_clamp_json_int(p_stats, 'ingame_coins'", "_clamp_json_int(p_stats, 'ingame_xp'", 'c_coin_daily_cap - v_today - v_coins',
    "'ingame_coins', v_ig_coin", "'ingame_xp'", 'v_gain := v_gain + v_ig_xp'].forEach(s => assert.ok(sql.includes(s), s));
  assert.ok(/grant execute on function public\.submit_match_result/.test(sql));
});
console.log(n + ' tes lulus');

