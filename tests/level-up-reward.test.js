/* Tes hadiah naik level (sisi klien): WalletService.claimLevelRewards + hook modal di gameplay/js/main.js.
   Nominal dihitung SERVER (supabase/migrations/202611300001_level_up_rewards.sql, diuji supabase/tests/level_up_rewards_test.sql);
   tes ini memastikan klien tidak menghitung nominal sendiri, mencerminkan saldo dari balasan server, dan ikon hadiah ada.
   Jalankan: node tests/level-up-reward.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const WS = require(path.join(ROOT, 'src/services/wallet-service.js'));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok - ' + name); };
const mk = (reply, opts) => { const calls = [], mirrored = [];
  const PD = { serverMode: () => !(opts && opts.local), applyServerWallet: o => mirrored.push(o) };
  const svc = WS.create({ PlayerData: PD, getClient: async () => ({ rpc: async (name, args) => { calls.push([name, args]); return reply instanceof Error ? { error: reply } : { data: reply }; } }) });
  return { svc, calls, mirrored }; };

(async () => {
  await t('claimLevelRewards: memanggil RPC claim_level_rewards TANPA argumen (klien tidak mengirim nominal/level)', async () => {
    const { svc, calls } = mk({ ok: true, levels: [], reward_coins: 0, reward_gems: 0 }); await svc.claimLevelRewards();
    assert.deepStrictEqual(calls, [['claim_level_rewards', {}]]);
  });
  await t('claimLevelRewards: ada hadiah -> saldo PlayerData dicerminkan dari angka server', async () => {
    const { svc, mirrored } = mk({ ok: true, levels: [{ level: 5, coins: 350, gems: 10 }], reward_coins: 350, reward_gems: 10, wallet_coins: 1800, wallet_gems: 10 });
    const r = await svc.claimLevelRewards(); assert.strictEqual(r.ok, true); assert.deepStrictEqual(mirrored, [{ coins: 1800, gems: 10 }]);
  });
  await t('claimLevelRewards: tanpa hadiah (klaim ulang) -> tidak menyentuh cermin saldo', async () => {
    const { svc, mirrored } = mk({ ok: true, levels: [], reward_coins: 0, reward_gems: 0 }); await svc.claimLevelRewards(); assert.deepStrictEqual(mirrored, []);
  });
  await t('claimLevelRewards: mode lokal/tamu -> {ok:false, reason:mode-lokal} tanpa RPC', async () => {
    const { svc, calls } = mk({ ok: true }, { local: true }); assert.deepStrictEqual(await svc.claimLevelRewards(), { ok: false, reason: 'mode-lokal' }); assert.strictEqual(calls.length, 0);
  });
  await t('claimLevelRewards: gagal jaringan / belum login tidak melempar', async () => {
    assert.strictEqual((await mk(new Error('AUTH_REQUIRED')).svc.claimLevelRewards()).reason, 'belum-login');
    assert.strictEqual((await mk(new Error('fetch failed')).svc.claimLevelRewards()).reason, 'jaringan');
  });
  await t('claimLevelRewards: panggilan bersamaan tidak ganda (sedang-diproses)', async () => {
    const { svc, calls } = mk({ ok: true, levels: [], reward_coins: 0, reward_gems: 0 }); const [a, b] = await Promise.all([svc.claimLevelRewards(), svc.claimLevelRewards()]);
    assert.strictEqual(calls.length, 1); assert.ok([a, b].some(x => x.reason === 'sedang-diproses'));
  });
  await t('main.js: modal Naik Level memanggil helper hadiah; nominal hanya dari balasan server (tanpa rumus di klien)', async () => {
    const m = rd('gameplay/js/main.js'); assert.ok(/showLevelUpWithRewards\(a\.level,m\.gameId\)/.test(m)); assert.ok(!/UT\.LevelUp\.show\(\{level:a\.level\}\)/.test(m));
    const h = /async function showLevelUpWithRewards[\s\S]*?\n}\n/.exec(m)[0];
    assert.ok(/claimLevelRewards/.test(h) && /r\.reward_coins/.test(h) && /r\.reward_gems/.test(h)); assert.ok(!/\b50\s*\*|\*\s*50\b|100\s*\+/.test(h), 'tidak ada rumus hadiah di klien');
    assert.ok(/catch\(e\)\{ console\.warn\('\[level-up\] klaim hadiah gagal'/.test(h), 'gagal klaim -> modal tetap tampil');
  });
  await t('Ikon hadiah: main.js mengirim kind coins/gems; CSS level-up.css memetakan ke ikon mata uang existing (path relatif CSS benar, file WEBP ada)', async () => {
    const m = rd('gameplay/js/main.js'); assert.ok(/kind:'coins'/.test(m) && /kind:'gems'/.test(m));
    const css = rd('gameplay/css/level-up.css'); const want = { coins: 'assets/images/ui/hud/ikon-koin-emas.webp', gems: 'assets/images/ui/gem-medal-icons/berlian-hijau.webp' };
    Object.keys(want).forEach(k => { const r = new RegExp('\\.lu-modal__ic--' + k + ' \\{[^}]*url\\(([^)]+)\\)').exec(css); assert.ok(r, k);
      const f = path.join(ROOT, 'gameplay/css', r[1]); assert.strictEqual(path.relative(ROOT, f).replace(/\\/g, '/'), want[k]); assert.strictEqual(fs.readFileSync(f).slice(8, 12).toString(), 'WEBP', k); });
  });
  await t('Latar slot hadiah = slot-terpilih.webp (aset existing, path relatif CSS benar)', async () => {
    const css = rd('gameplay/css/level-up.css'), m = /\.lu-modal__slot \{[^}]*url\(([^)]+)\)/.exec(css); assert.ok(m, 'CSS slot memakai url()');
    const f = path.join(ROOT, 'gameplay/css', m[1]); assert.ok(fs.existsSync(f), m[1] + ' -> ' + f); assert.strictEqual(path.basename(f), 'slot-terpilih.webp');
    assert.strictEqual(fs.readFileSync(f).slice(8, 12).toString(), 'WEBP');
  });
  await t('gameplay.html memuat level-up.js dan wallet-service.js (UT.LevelUp / UT.WalletService tersedia)', async () => {
    const h = rd('gameplay.html'); assert.ok(h.includes('gameplay/js/level-up.js')); assert.ok(/assets\/js\/services\/wallet-service\.js/.test(h));
  });
  console.log('\n' + n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });

