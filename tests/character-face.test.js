/* Tes pemisahan Wajah (bentuk wajah) dari Mata. Jalankan: node tests/character-face.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };

const SRC = { template: R('tools/blocky-character/template.js'), karakter: R('data/inventory/character/_shared/js/karakter.js') };
const mix = (a, b, k) => { const f = (s) => ((a >> s & 255) * (1 - k) + (b >> s & 255) * k) | 0; return f(16) << 16 | f(8) << 8 | f(0); };
const shade = (c, k) => { const f = (s) => Math.min(255, (c >> s & 255) * k) | 0; return f(16) << 16 | f(8) << 8 | f(0); };
function faces(src) {
  const a = src.indexOf('const lipC='), b = src.indexOf('/* ---- rambut ---- */');
  assert.ok(a > 0 && b > a, 'blok FACES ditemukan');
  return vm.runInNewContext(src.slice(a, b) + ';FACES', { mix, shade });
}

t('FACES identik di renderer (template) dan builder Karakter', () => {
  const sl = s => s.slice(s.indexOf('const lipC='), s.indexOf('/* ---- rambut ---- */'));
  assert.strictEqual(sl(SRC.template), sl(SRC.karakter));
  assert.strictEqual(R('assets/js/renderers/blocky-character.js'), SRC.template, 'asset runtime = template');
});
t('wajah: id unik, ada nama, klasik jadi pilihan pertama (default)', () => {
  const F = faces(SRC.template); const ids = F.map(f => f.id);
  assert.strictEqual(new Set(ids).size, ids.length); assert.strictEqual(ids[0], 'classic'); assert.ok(F.length >= 6);
  F.forEach(f => { assert.ok(/^[a-z0-9_]{1,24}$/.test(f.id)); assert.ok(f.n && typeof f.px === 'function'); });
});
t('wajah klasik = tampilan lama persis (hidung, mulut, pipi) untuk m & f', () => {
  const F = faces(SRC.template), sk = 0xe0b090, skD = shade(sk, .85);
  [false, true].forEach(fem => {
    const c = { sk, skD, fem, hD: 0x222222 };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const m = x < 4 ? x : 7 - x; let want;
      if (y === 5 && (x === 3 || x === 4)) want = skD; else if (y === 6 && (x === 3 || x === 4)) want = fem ? 0xc4565f : 0x8c4a3c;
      else if (fem && y === 5 && m === 1) want = mix(sk, 0xf08080, .4);
      assert.strictEqual(F[0].px(x, y, m, c), want, 'x' + x + ' y' + y + ' fem=' + fem);
    }
  });
});
t('wajah tidak menyentuh baris mata (y 3-4 di kolom mata) dan simetris kiri-kanan', () => {
  const F = faces(SRC.template), c = { sk: 0xe0b090, skD: shade(0xe0b090, .85), fem: false, hD: 0 };
  F.forEach(f => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const m = x < 4 ? x : 7 - x, v = f.px(x, y, m, c), w = f.px(7 - x, y, m, c);
    assert.strictEqual(v, w, f.id + ' simetris x' + x + ' y' + y);
    if (y === 3 && (m === 1 || m === 2)) assert.strictEqual(v, undefined, f.id + ' baris mata y3');
    if (y === 4 && (m === 1 || m === 2)) assert.strictEqual(v, undefined, f.id + ' baris mata y4');
  } });
});
t('builder: face terdaftar di REG/KEYMAP/normalize/DEFAULT/START dan UI Wajah + Mata terpisah', () => {
  [SRC.template, SRC.karakter].forEach(s => {
    assert.ok(s.includes('const REG={eyes:EYES,face:FACES,hair:HAIRS,'));
    assert.ok(s.includes("face:['head'],eyes:['head']"));
    assert.ok(s.includes("['face','eyes','hair','top'"));
    assert.ok(s.includes("face:{id:'classic'},\n  eyes:{id:'round'"));
    assert.ok(s.includes('const face=find(\'face\',cfg.face.id)'));
  });
  const k = SRC.karakter;
  assert.ok(k.includes("{key:'face',label:'😊 Wajah',reg:'face'}") && k.includes("{key:'eyes',label:'👁️ Mata',reg:'eyes',keepDye:true}"));
  assert.ok(k.includes("keys:['skin','face','eyes','hair','body']"));
  assert.ok(k.includes('face:cfg.face,eyes:cfg.eyes'), 'face ikut disimpan ke PlayerData');
});

/* ---- PlayerData.look: face opsional ---- */
function boot() {
  const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { addEventListener() {}, localStorage: ls }; w.window = w;
  const ctx = vm.createContext(Object.assign(w, { localStorage: ls, console, Date, JSON, Math }));
  ['core/session.js', 'item-catalog.js', 'player-data.js'].forEach(f => vm.runInContext(R('assets/js/' + f), ctx));
  return ctx.PlayerData;
}
const LOOK = { gender: 'f', skin: 's3', eyes: { id: 'lash', dye: 'blue' }, hair: { id: 'bob', dye: 'brown' }, body: { height: 1, build: 1 } };
t('PlayerData.look: face disimpan bila valid; tanpa face tetap valid (kompatibel data lama)', () => {
  const PD = boot();
  assert.strictEqual(PD.setLook({ ...LOOK, face: { id: 'smile' } }).ok, true);
  assert.strictEqual(PD.look().face.id, 'smile');
  assert.strictEqual(PD.setLook(LOOK).ok, true);
  assert.strictEqual(PD.look().face, undefined);
});
t('PlayerData.look: face tidak valid dibuang (bukan menolak seluruh look)', () => {
  const PD = boot();
  assert.strictEqual(PD.setLook({ ...LOOK, face: { id: '<b>' } }).ok, true);
  assert.strictEqual(PD.look().face, undefined);
});
t('katalog: slot eyes berlabel Mata (wajah bukan lagi nama slot mata)', () => {
  assert.ok(R('assets/js/item-catalog.js').includes("{ key: 'eyes', label: 'Mata' }"));
});
console.log(n + ' tes lulus');

/* ---- Set PVP (Ksatria Mahkota & Rival) harus ada di renderer bersama, bukan hanya di builder Karakter ---- */
(function () {
  const blk = s => { const a = s.indexOf('const KN={'), b = s.indexOf('const REG={'); return s.slice(a, b); };
  t('PVP: blok Ksatria Mahkota/Rival identik di renderer (template) dan builder Karakter', () => {
    assert.ok(SRC.template.includes('const KN={'), 'renderer punya definisi set PVP');
    assert.strictEqual(blk(SRC.template), blk(SRC.karakter));
    ['EYES', 'HAIRS', 'TOPS', 'LEGS', 'BOOTS', 'HELMS', 'CHESTS', 'SHOULDERS', 'CAPES', 'WEAPONS'].forEach(L =>
      assert.ok(SRC.template.includes(L + '.push('), L + ' terdaftar mahkota/rival'));
  });
  console.log(n + ' tes lulus (total)');
})();
