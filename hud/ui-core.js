/* Ular Tangga Blok — hud/ui-core.js (Stage 4.0.2: HUD foundation)
   Registry/facade untuk komponen UI reusable. Skrip klasik (tanpa import/export/type=module).
   Urutan muat: item-catalog.js -> [item-art.js] -> player-data.js -> app.js -> hud/ui-core.js -> kode halaman.
   Aturan:
   - Layer di atas window.UT (UT.UI / UT.Audio / UT.App tidak diganti atau diduplikasi).
   - TIDAK menyimpan data pemain (coins, gems, inventory, skin, nama, statistik); sumbernya tetap PlayerData.
   - Tidak membuat komponen apa pun; komponen mendaftar sendiri lewat UT.Hud.register(...). */
window.UT = window.UT || {};

(function (UT) {
  'use strict';

  /* Idempotent: bila termuat dua kali, registry yang sudah ada tidak direset. */
  if (UT.Hud && typeof UT.Hud.register === 'function') return;

  var Hud = UT.Hud = UT.Hud || {};
  Hud.Components = Hud.Components || {};
  Hud.version = '1.0.0';

  var has = Object.prototype.hasOwnProperty;

  function validName(name) { return typeof name === 'string' && name.length > 0; }

  /* register(name, component) -> true bila terdaftar; false bila nama tidak valid, komponen kosong,
     atau nama sudah terdaftar (registrasi pertama dipertahankan, tidak ditimpa). */
  Hud.register = function (name, component) {
    if (!validName(name) || component == null) return false;
    if (has.call(Hud.Components, name)) return false;
    Hud.Components[name] = component;
    return true;
  };

  /* has(name) -> true/false; tidak pernah melempar error. */
  Hud.has = function (name) {
    return validName(name) && has.call(Hud.Components, name);
  };

  /* get(name) -> komponen terdaftar, atau null bila belum dimuat. */
  Hud.get = function (name) {
    return Hud.has(name) ? Hud.Components[name] : null;
  };

  /* list() -> nama komponen terdaftar (salinan array). */
  Hud.list = function () { return Object.keys(Hud.Components); };

  /* create(name, opts) -> memanggil component.create(opts) bila ada; null bila komponen belum dimuat. */
  Hud.create = function (name, opts) {
    var c = Hud.get(name);
    return (c && typeof c.create === 'function') ? c.create(opts) : null;
  };
})(window.UT);
