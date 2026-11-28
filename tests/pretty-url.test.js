/* Tes UT.PrettyUrl: pemetaan slug<->halaman, format token & uuid, penolakan slug tak dikenal.
   Jalan di Node 20 (CommonJS), tidak bergantung pada global navigator. */
const assert = require('assert');
const path = require('path');
const PrettyUrl = require(path.join(__dirname, '..', 'src/core/pretty-url.js'));

/* default: DIMATIKAN -> tidak ada URL pretty; logika modul tetap diuji dengan menyalakannya manual */
assert.strictEqual(PrettyUrl.isEnabled(), false);
assert.strictEqual(PrettyUrl.shouldUsePretty({ protocol: 'https:' }), false);
assert.strictEqual(PrettyUrl.buildUrl('tambang.html', null, null, { protocol: 'https:' }), null);
PrettyUrl.setEnabled(true);

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

// Mock location untuk tes
const mockLoc = { protocol: 'https:', pathname: '/', search: '' };

(async () => {
  await t('pageToSlug: mengubah nama file .html ke slug', () => {
    assert.strictEqual(PrettyUrl.pageToSlug('lobby.html'), 'lobby');
    assert.strictEqual(PrettyUrl.pageToSlug('karakter.html'), 'karakter');
    assert.strictEqual(PrettyUrl.pageToSlug('hadiah-misi.html'), 'hadiah-misi');
    assert.strictEqual(PrettyUrl.pageToSlug('splash.html'), 'splash');
    assert.strictEqual(PrettyUrl.pageToSlug('gameplay.html'), 'gameplay');
    assert.strictEqual(PrettyUrl.pageToSlug('powerup.html'), 'powerup');
    assert.strictEqual(PrettyUrl.pageToSlug('tidak-ada.html'), 'tidak-ada'); // fallback
  });

  await t('slugToPage: mengubah slug ke nama file .html', () => {
    assert.strictEqual(PrettyUrl.slugToPage('lobby'), 'lobby.html');
    assert.strictEqual(PrettyUrl.slugToPage('karakter'), 'karakter.html');
    assert.strictEqual(PrettyUrl.slugToPage('hadiah-misi'), 'hadiah-misi.html');
    assert.strictEqual(PrettyUrl.slugToPage('splash'), 'splash.html');
    assert.strictEqual(PrettyUrl.slugToPage('gameplay'), 'gameplay.html');
    assert.strictEqual(PrettyUrl.slugToPage('powerup'), 'powerup.html');
    assert.strictEqual(PrettyUrl.slugToPage('tidak-ada'), 'tidak-ada.html'); // fallback
  });

  await t('genToken: menghasilkan token 20 karakter [a-z0-9]', () => {
    const t1 = PrettyUrl.genToken();
    assert.strictEqual(t1.length, 20);
    assert.ok(/^[a-z0-9]{20}$/.test(t1), 'format token: ' + t1);
    const t2 = PrettyUrl.genToken();
    assert.notStrictEqual(t1, t2, 'token harus acak');
  });

  await t('genUuid: menghasilkan UUID v4 valid', () => {
    const u1 = PrettyUrl.genUuid();
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(u1), 'format uuid: ' + u1);
    const u2 = PrettyUrl.genUuid();
    assert.notStrictEqual(u1, u2, 'uuid harus unik');
  });

  await t('parse: memparsing pathname pretty URL dengan benar', () => {
    const p = PrettyUrl.parse('/k3x9qwm2vbn8zr4tjd7a/lobby/c70a8395-dad8-43d5-a52d-713f6d162c10/', mockLoc);
    assert.ok(p, 'parse tidak boleh null');
    assert.strictEqual(p.token, 'k3x9qwm2vbn8zr4tjd7a');
    assert.strictEqual(p.page, 'lobby.html');
    assert.strictEqual(p.slug, 'lobby');
    assert.strictEqual(p.uuid, 'c70a8395-dad8-43d5-a52d-713f6d162c10');
  });

  await t('parse: mengembalikan null untuk pathname tidak valid', () => {
    assert.strictEqual(PrettyUrl.parse('/', mockLoc), null);
    assert.strictEqual(PrettyUrl.parse('/play.html', mockLoc), null);
    assert.strictEqual(PrettyUrl.parse('/token/page/uuid', mockLoc), null); // uuid tidak valid
    assert.strictEqual(PrettyUrl.parse('/k3x9qwm2vbn8zr4tjd7a/tidak-ada/c70a8395-dad8-43d5-a52d-713f6d162c10/', mockLoc), null); // slug tidak dikenal
    assert.strictEqual(PrettyUrl.parse('/short/page/c70a8395-dad8-43d5-a52d-713f6d162c10/', mockLoc), null); // token terlalu pendek
    // tanpa lokasi http -> null
    assert.strictEqual(PrettyUrl.parse('/k3x9qwm2vbn8zr4tjd7a/lobby/c70a8395-dad8-43d5-a52d-713f6d162c10/'), null);
  });

  await t('buildUrl: membangun URL pretty dari page, token, uuid', () => {
    const url = PrettyUrl.buildUrl('lobby.html', 'k3x9qwm2vbn8zr4tjd7a', 'c70a8395-dad8-43d5-a52d-713f6d162c10', mockLoc);
    assert.strictEqual(url, '/k3x9qwm2vbn8zr4tjd7a/lobby/c70a8395-dad8-43d5-a52d-713f6d162c10/');
  });

  await t('buildUrl: menghasilkan token/uuid otomatis bila tidak diberikan', () => {
    const url = PrettyUrl.buildUrl('karakter.html', null, null, mockLoc);
    assert.ok(/^\/[a-z0-9]{20}\/karakter\/[0-9a-f-]{36}\/$/.test(url), 'url: ' + url);
    // tanpa lokasi http -> null
    assert.strictEqual(PrettyUrl.buildUrl('karakter.html'), null);
  });

  await t('getGoFromUrl: membaca halaman dari pretty URL atau fallback ke ?go=', () => {
    const loc1 = { protocol: 'https:', pathname: '/k3x9qwm2vbn8zr4tjd7a/karakter/c70a8395-dad8-43d5-a52d-713f6d162c10/', search: '' };
    assert.strictEqual(PrettyUrl.getGoFromUrl(loc1), 'karakter.html');
    const loc2 = { protocol: 'https:', pathname: '/play.html', search: '?go=lobby.html' };
    assert.strictEqual(PrettyUrl.getGoFromUrl(loc2), 'lobby.html');
    const loc3 = { protocol: 'https:', pathname: '/', search: '' };
    assert.strictEqual(PrettyUrl.getGoFromUrl(loc3), 'splash.html');
    // tanpa lokasi http -> splash.html
    assert.strictEqual(PrettyUrl.getGoFromUrl(), 'splash.html');
  });

  await t('shouldUsePretty: true hanya untuk http/https', () => {
    assert.strictEqual(PrettyUrl.shouldUsePretty(mockLoc), true);
    assert.strictEqual(PrettyUrl.shouldUsePretty({ protocol: 'http:' }), true);
    assert.strictEqual(PrettyUrl.shouldUsePretty({ protocol: 'file:' }), false);
    assert.strictEqual(PrettyUrl.shouldUsePretty(null), false);
    assert.strictEqual(PrettyUrl.shouldUsePretty(), false);
  });

  await t('VALID_PAGES berisi semua halaman yang valid', () => {
    const expected = ['lobby.html', 'karakter.html', 'profile.html', 'tambang.html', 'friendship.html', 'shop.html', 'mode.html', 'hadiah-misi.html', 'mail.html', 'settings.html', 'leaderboard.html', 'room.html', 'inventory.html', 'pet.html', 'frame.html', 'efek.html', 'dadu.html', 'splash.html', 'gameplay.html', 'powerup.html'];
    expected.forEach(p => assert.ok(PrettyUrl.VALID_PAGES[p], 'missing: ' + p));
    assert.strictEqual(Object.keys(PrettyUrl.VALID_PAGES).length, expected.length);
  });

  await t('SLUG_TO_PAGE mapping lengkap dan konsisten', () => {
    Object.entries(PrettyUrl.SLUG_TO_PAGE).forEach(([slug, page]) => {
      assert.strictEqual(PrettyUrl.VALID_PAGES[page], slug, 'inconsistent: ' + slug + ' -> ' + page);
      assert.strictEqual(PrettyUrl.pageToSlug(page), slug);
      assert.strictEqual(PrettyUrl.slugToPage(slug), page);
    });
  });

  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
