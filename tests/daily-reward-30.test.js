/* Tes login harian 30 hari: tabel hadiah di SQL (_daily_reward_for) harus sama dengan label di klien (array R di hadiah-misi.js),
   streak ketat tetap di server, dan lobi memakai batas 30. Tes statis. Jalankan: node tests/daily-reward-30.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = p => path.join(__dirname, '..', p);
const read = p => fs.readFileSync(root(p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const sql = read('supabase/migrations/202611390001_daily_reward_30.sql');
const rows = [...sql.matchAll(/\(\s*(\d+),'(coin|gem|box|mix)',\s*(\d+),\s*(\d+)\)/g)].map(m => ({ day: +m[1], type: m[2], coins: +m[3], gems: +m[4] }));
const js = read('assets/js/pages/hadiah-misi.js');
const rBlock = js.slice(js.indexOf('const R=['), js.indexOf('function applyDaily'));
const labels = [...rBlock.matchAll(/\{t:'([^']+)'/g)].map(m => m[1]);
const num = s => +s.replace(/\./g, '');

t('SQL punya tepat 30 hari berurutan 1..30', () => {
  assert.strictEqual(rows.length, 30);
  rows.forEach((r, i) => assert.strictEqual(r.day, i + 1));
});
t('klien punya 30 label hadiah', () => assert.strictEqual(labels.length, 30));
t('label klien = nominal SQL untuk setiap hari', () => {
  rows.forEach((r, i) => {
    const l = labels[i], coin = l.match(/([\d.]+) Coin/), gem = l.match(/([\d.]+) Gem/), box = /Mystery Box/.test(l);
    assert.strictEqual(coin ? num(coin[1]) : 0, r.coins, 'koin hari ' + r.day);
    assert.strictEqual(gem ? num(gem[1]) : 0, r.gems, 'gem hari ' + r.day);
    assert.strictEqual(box, r.type === 'box', 'box hari ' + r.day);
    const kind = box ? 'box' : (coin && gem) ? 'mix' : gem ? 'gem' : 'coin';
    assert.strictEqual(kind, r.type, 'tipe hari ' + r.day);
  });
});
t('Hari 1-7 sama dengan fase 1 (pemain lama tidak dirugikan)', () => {
  const w1 = rows.slice(0, 7).map(r => [r.type, r.coins, r.gems].join());
  assert.deepStrictEqual(w1, ['coin,300,0', 'coin,500,0', 'box,0,0', 'gem,0,5', 'coin,800,0', 'gem,0,10', 'mix,2000,15']);
});
t('streak ketat: bolos > 1 hari atau putaran 30 selesai -> Hari 1; batas tabel 0..30', () => {
  assert.ok(/public\._wib_today\(\) - p_last > 1 or p_claimed >= 30 then 0/.test(sql));
  assert.ok(/check \(claimed between 0 and 30\)/.test(sql));
});
t('klaim server membaca tabel hadiah, bukan nominal dari klien', () => {
  assert.ok(/_daily_reward_for\(v_idx \+ 1\)/.test(sql));
  assert.ok(!/claim_daily_reward\(\s*\w+/.test(sql.replace('claim_daily_reward() returns', '')), 'RPC klaim tanpa argumen');
});
t('klien: state/klaim memakai DAYS=30, bukan 7', () => {
  assert.ok(/const DAYS=30/.test(js));
  assert.ok(/SD\.claimed<DAYS/.test(js) && !/claimed<7/.test(js));
});
t('lobi: lencana login memakai batas 30', () => {
  const lobby = read('data/lobby/js/lobby.js');
  assert.ok(/\(\+d\.claimed\|\|0\)<30/.test(lobby) && !/claimed\|\|0\)<7/.test(lobby));
});
t('Hari 30 memberi Frame Setia sekali; frame terdaftar di katalog klien tanpa harga (tidak dijual)', () => {
  assert.ok(/v_idx \+ 1 = 30 then[\s\S]*'frame\.setia'[\s\S]*on conflict do nothing returning item_id into v_item/.test(sql));
  assert.ok(/'item', v_item/.test(sql));
  const C = {}; new Function('window', read('assets/js/item-catalog.js'))(C);
  const f = C.ItemCatalog.byId('frame.setia');
  assert.ok(f && f.kind === 'frame' && !f.price && !f.gems && !f.starter && f.source === 'event');
  assert.strictEqual(C.ItemCatalog.cost(f), null);
  assert.ok(fs.existsSync(root('data/frame/setia.webp')));
  assert.ok(/'setia': 'gold'/.test(read('data/inventory/frame/_shared/js/frame-fx.js')));
});
t('snapshot skema memuat migrasi 30 hari', () => {
  assert.ok(read('supabase/snapshot/00_full_schema.sql').includes('202611390001_daily_reward_30.sql'));
});
console.log(n + ' tes lulus');
