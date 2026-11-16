/* Lobi harus menampilkan tampilan/outfit AKTIF akun dari server tanpa membuka halaman Karakter dulu. Jalankan: node tests/lobby-appearance.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const PG = require("./_page");
const h = PG.readFileSync(path.join(__dirname, '../lobby.html'), 'utf8');
const raw = fs.readFileSync(path.join(__dirname, '../lobby.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
t('lobi memuat stylesheet layout sebelum override halaman, sekali saja', () => {
  const base = raw.indexOf('href="assets/css/pages/lobby-legacy.css"'), overrides = raw.indexOf('href="assets/css/pages/lobby.css"');
  assert.ok(base > 0 && overrides > base, 'stylesheet layout harus dimuat sebelum override lobby');
  assert.strictEqual((raw.match(/href="assets\/css\/pages\/lobby\.css"/g) || []).length, 1, 'lobby.css dimuat lebih dari sekali');
  assert.ok(fs.existsSync(path.join(__dirname, '../assets/css/pages/lobby-legacy.css')), 'stylesheet layout tidak ada');
});
t('service worker: kode cache-first, tapi saat mengunduh (belum di cache) melewati cache browser; pembaruan menunggu restart', () => {
  assert.ok(/fetch\(r,\s*same\s*\?\s*\{\s*cache:\s*'no-cache'\s*\}/.test(sw), 'unduhan pertama harus revalidasi, bukan cache browser basi');
  assert.ok(/CODE\.test\(u\.pathname\)/.test(sw) && /c\.match\(key,\s*\{\s*ignoreSearch:\s*same\s*\}\)/.test(sw), 'HTML/JS/CSS dilayani dari cache lebih dulu');
  assert.ok(!/skipWaiting\(\)/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')), 'tanpa skipWaiting: versi baru aktif setelah aplikasi dibuka ulang');
});
t('lobi memuat appearance-service.js setelah wallet-service.js', () => {
  const w = h.indexOf('assets/js/services/wallet-service.js'), a = h.indexOf('assets/js/services/appearance-service.js');
  assert.ok(w > 0 && a > w, 'urutan skrip salah');
});
t('lobi memanggil AppearanceService.refreshThrottled() hanya untuk akun server', () => {
  assert.ok(/UT\.AppearanceService\.get\(\)/.test(h)); assert.ok(/A\.refreshThrottled\(\)/.test(h));
  assert.ok(/PD\.serverMode&&PD\.serverMode\(\)&&UT\.AppearanceService/.test(h), 'hanya akun server');
});
t('frame profil di lobi dimuat dan di-upgrade ke animasi FrameFX', () => {
  assert.ok(h.indexOf('data/inventory/frame/_shared/js/frame-fx.js') > 0, 'frame-fx.js tidak dimuat');
  assert.ok(/function applyFrame\(\)[\s\S]*?FrameFX\.upgrade\(im\)/.test(h), 'frame lobi tidak di-upgrade');
  const profile = PG.readFileSync(path.join(__dirname, '../profile.html'), 'utf8');
  assert.ok(/FrameFX\.upgrade\(profileFrame\)/.test(profile), 'frame profil tidak di-upgrade');
});
t('profil, efek, dan leaderboard juga menarik tampilan aktif dari server dan menggambar ulang', () => {
  ['profile', 'efek', 'leaderboard'].forEach(f => {
    const x = PG.readFileSync(path.join(__dirname, '../' + f + '.html'), 'utf8');
    assert.ok(/refreshThrottled\(\)/.test(x), f + ': tidak memanggil refreshThrottled');
    assert.ok(/r==='server-appearance'\|\|r==='server-outfits'/.test(x), f + ': tidak menggambar ulang saat tampilan dari server masuk');
    assert.ok(x.indexOf('assets/js/services/appearance-service.js') > 0, f + ': appearance-service.js tidak dimuat');
  });
});
t('karakter & avatar dibangun ulang saat tampilan/outfit dari server masuk', () => {
  const m = h.match(/PD\.subscribe\(r=>\{if\(r==='equip'[^\n]*\}\);/);
  assert.ok(m, 'handler subscribe tidak ditemukan');
  assert.ok(m[0].indexOf("'server-appearance'") > 0 && m[0].indexOf("'server-outfits'") > 0);
  assert.ok(m[0].indexOf('buildHero()') > 0 && m[0].indexOf('renderAvatar()') > 0);
});
t('alasan notifikasi yang dipakai lobi benar-benar dikirim PlayerData', () => {
  const pd = PG.readFileSync(path.join(__dirname, '../assets/js/player-data.js'), 'utf8');
  assert.ok(pd.indexOf("notify('server-appearance')") > 0 && pd.indexOf("notify('server-outfits')") > 0);
});
console.log(n + ' tes lulus');
