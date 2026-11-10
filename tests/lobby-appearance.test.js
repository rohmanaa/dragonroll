/* Lobi harus menampilkan tampilan/outfit AKTIF akun dari server tanpa membuka halaman Karakter dulu. Jalankan: node tests/lobby-appearance.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const h = fs.readFileSync(path.join(__dirname, '../lobby.html'), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
t('lobi memuat appearance-service.js setelah wallet-service.js', () => {
  const w = h.indexOf('assets/js/wallet-service.js'), a = h.indexOf('assets/js/appearance-service.js');
  assert.ok(w > 0 && a > w, 'urutan skrip salah');
});
t('lobi memanggil AppearanceService.refreshThrottled() hanya untuk akun server', () => {
  assert.ok(/UT\.AppearanceService\.get\(\)/.test(h)); assert.ok(/A\.refreshThrottled\(\)/.test(h));
  assert.ok(/PD\.serverMode&&PD\.serverMode\(\)&&UT\.AppearanceService/.test(h), 'hanya akun server');
});
t('profil, efek, dan leaderboard juga menarik tampilan aktif dari server dan menggambar ulang', () => {
  ['profile', 'efek', 'leaderboard'].forEach(f => {
    const x = fs.readFileSync(path.join(__dirname, '../' + f + '.html'), 'utf8');
    assert.ok(/refreshThrottled\(\)/.test(x), f + ': tidak memanggil refreshThrottled');
    assert.ok(/r==='server-appearance'\|\|r==='server-outfits'/.test(x), f + ': tidak menggambar ulang saat tampilan dari server masuk');
    assert.ok(x.indexOf('assets/js/appearance-service.js') > 0, f + ': appearance-service.js tidak dimuat');
  });
});
t('karakter & avatar dibangun ulang saat tampilan/outfit dari server masuk', () => {
  const m = h.match(/PD\.subscribe\(r=>\{if\(r==='equip'[^\n]*\}\);/);
  assert.ok(m, 'handler subscribe tidak ditemukan');
  assert.ok(m[0].indexOf("'server-appearance'") > 0 && m[0].indexOf("'server-outfits'") > 0);
  assert.ok(m[0].indexOf('buildHero()') > 0 && m[0].indexOf('renderAvatar()') > 0);
});
t('alasan notifikasi yang dipakai lobi benar-benar dikirim PlayerData', () => {
  const pd = fs.readFileSync(path.join(__dirname, '../assets/js/player-data.js'), 'utf8');
  assert.ok(pd.indexOf("notify('server-appearance')") > 0 && pd.indexOf("notify('server-outfits')") > 0);
});
console.log(n + ' tes lulus');
