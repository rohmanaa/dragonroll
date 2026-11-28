/* Tes pembukaan chest sinematik (core/chest-reveal.js): jadwal murni, urutan hadiah, skala drama per jenis, mode kurangi-gerakan, dan kabel halaman/aset.
   Jalankan: node tests/chest-reveal.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const R = require('../src/core/chest-reveal.js');
const root = p => path.join(__dirname, '..', p), read = p => fs.readFileSync(root(p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  - ' + name); };
const full = k => ({ kind: k, coins: 420, gems: 2, xp: 60, power: 'sword' });

t('urutan hadiah: Coin -> Emerald -> XP -> Power (Power selalu terakhir), nol tidak ditampilkan', () => {
  assert.deepStrictEqual(R.plan('gold', full('gold')).rewards.map(x => x.t), ['coin', 'gem', 'xp', 'power']);
  assert.deepStrictEqual(R.plan('wood', { coins: 80, gems: 0, xp: 10, power: null }).rewards.map(x => x.t), ['coin', 'xp']);
  assert.deepStrictEqual(R.plan('wood', { coins: 80 }).rewards.map(x => x.t), ['coin']);
});
t('makin mahal jenisnya makin dramatis: antisipasi & partikel naik Kayu < Perak < Emas < Diamond', () => {
  const k = ['wood', 'silver', 'gold', 'diamond'].map(x => R.plan(x, full(x)));
  for (let i = 1; i < k.length; i++) { assert.ok(k[i].anticipation > k[i - 1].anticipation); assert.ok(k[i].particles > k[i - 1].particles); assert.ok(k[i].burst > k[i - 1].burst); }
});
t('jadwal berurutan: jatuh -> antisipasi (3 tingkat goyang) -> ledakan -> judul -> hadiah berjarak -> tombol OK', () => {
  const p = R.plan('diamond', full('diamond'));
  assert.deepStrictEqual(p.stages.map(s => s.cls), ['s1', 's2', 's3']);
  assert.ok(p.stages[0].at >= p.drop && p.stages[0].at < p.stages[1].at && p.stages[1].at < p.stages[2].at && p.stages[2].at < p.burst);
  assert.ok(p.burst < p.title && p.title < p.rewards[0].at);
  p.rewards.forEach((x, i) => { if (i) assert.ok(x.at > p.rewards[i - 1].at); });
  assert.ok(p.okAt > p.rewards[p.rewards.length - 1].at);
  assert.ok(p.okAt < 9000, 'tidak boleh terlalu lama sebelum bisa ditutup');
});
t('kurangi gerakan: tanpa jatuh/goyang/partikel dan jauh lebih singkat', () => {
  const a = R.plan('gold', full('gold')), b = R.plan('gold', full('gold'), { reduced: true });
  assert.strictEqual(b.stages.length, 0); assert.strictEqual(b.particles, 0); assert.strictEqual(b.anticipation, 0); assert.ok(b.okAt < a.okAt / 3);
});
t('jenis tak dikenal jatuh ke Kayu; angka tak valid diabaikan', () => {
  assert.strictEqual(R.plan('xyz', { coins: 'abc', gems: -3, xp: 5.9 }).kind, 'wood');
  assert.deepStrictEqual(R.plan('wood', { coins: 'abc', gems: -3, xp: 5.9 }).rewards.map(x => [x.t, x.v]), [['xp', 5]]);
});
t('play() aman tanpa DOM (Node): tidak melempar dan mengembalikan kendali', () => {
  const c = R.play(full('gold'), {}); assert.ok(typeof c.skip === 'function' && typeof c.close === 'function'); c.skip(); c.close();
});
t('kabel: Inventory & Shop memuat css + js reveal SEBELUM skrip halaman dan memanggil play(); SFX yang dipakai ada', () => {
  for (const [html, js] of [['inventory.html', 'src/views/inventory.js'], ['shop.html', 'src/views/shop-page.js']]) {
    const h = read(html);
    assert.ok(h.includes('src/styles/components/chest-reveal.css'), html + ' css');
    assert.strictEqual((h.match(/assets\/js\/core\/chest-reveal\.js/g) || []).length, 1, html + ' js tepat sekali');
    assert.ok(h.indexOf('chest-reveal.js') < h.indexOf(js), html + ' urutan');
    assert.ok(read(js).includes('UT.ChestReveal.play'), js);
  }
  const app = read('src/core/app.js');
  ['chest', 'bounce', 'pop', 'power'].forEach(s => {
    const m = app.match(new RegExp("\\n\\s*" + s + ": '([^']+)'")); assert.ok(m, 'SFX tak terdaftar: ' + s);
    assert.ok(fs.existsSync(root('assets/audio/sfx/' + m[1])), 'file SFX hilang: ' + m[1]);
  });
  Object.values(R.KINDS).forEach(k => assert.ok(fs.existsSync(root('assets/images/ui/chest-packs/' + k.im + '.webp')), k.im));
  ['hud/ikon-koin-emas', 'gem-medal-icons/berlian-hijau'].forEach(i => assert.ok(fs.existsSync(root('assets/images/ui/' + i + '.webp')), i));
});
t('css: hormati prefers-reduced-motion, tombol OK baru bisa diklik saat selesai, overlay di atas semua', () => {
  const c = read('src/styles/components/chest-reveal.css');
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(c) && /\.crv\.done \.crv-ok\{[^}]*pointer-events:auto/.test(c) && /\.crv\{[^}]*z-index:9999/.test(c));
  ['s1', 's2', 's3', 'burst', 'open', 'titled', 'done'].forEach(s => assert.ok(c.includes('.crv.' + s), 'kelas ' + s));
});
console.log(n + ' tes lulus');

