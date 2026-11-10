/* Ular Tangga Blok — gameplay/module-bridge.js (Stage 4.1.2: Gameplay module bridge)
   Skrip klasik (tanpa import/export/type=module). Dimuat dari gameplay.html SETELAH app.js
   dan SEBELUM gameplay/hud.js serta blok skrip gameplay inline.
   HANYA namespace: tidak ada logic, data, atau state gameplay di sini.
   gameplay.html tetap source of truth; extraction dilakukan di sub-step berikutnya.
   Idempotent: aman dimuat lebih dari sekali, tidak menimpa object yang sudah ada
   (termasuk UT.GameplayHUD dan modul yang sudah terdaftar).
   Namespace (boleh kosong):
     UT.Gameplay.Config / Rules / Themes / Audio / Dice / FX /
     UT.Gameplay.Geometry / Pawn / Camera / Dragon / Core
   API minimal:
     UT.Gameplay.registerModule(name, api) — isi namespace yang masih kosong dengan api; false bila
                                              nama tidak dikenal/api bukan object/namespace sudah terisi
     UT.Gameplay.hasModule(name)           — true bila namespace sudah terisi (bukan sekadar ada)
   UT.Gameplay.Feedback — kontrak pemisahan feedback (ADAPTER tipis, bukan sistem baru):
     Feedback.short(key, name, who, opts) — Power (opts.text = pesan singkat kustom, mis. Power ditolak): banner HUD singkat (UT.GameplayHUD.showPower), BUKAN modal Chest
     Feedback.event(kind, text, opts) — event gameplay: banner HUD (UT.GameplayHUD.showEvent)
     Feedback.reward(...args)         — reward Chest: modal besar; presenter didaftarkan gameplay.html lewat
                                        Feedback.setRewardPresenter(fn). Mengembalikan false bila belum terdaftar.
   Tidak mengekspos players, scene, renderer, camera, dan tidak membuat UT.Gameplay.State. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var G = UT.Gameplay = UT.Gameplay || {};

  var NAMES = ['Config', 'Rules', 'Themes', 'Audio', 'Dice', 'FX',
               'Geometry', 'Pawn', 'Camera', 'Dragon', 'Core'];
  for (var i = 0; i < NAMES.length; i++) {
    G[NAMES[i]] = G[NAMES[i]] || {};
  }

  G.Feedback = G.Feedback || {};
  var F = G.Feedback;
  function hud() { return win.UT && win.UT.GameplayHUD; }
  if (typeof F.short !== 'function') {
    F.short = function (key, name, who, opts) {
      var H = hud();
      return H && typeof H.showPower === 'function' ? H.showPower(key, name, who, opts) : false;
    };
  }
  if (typeof F.event !== 'function') {
    F.event = function (kind, text, opts) {
      var H = hud();
      return H && typeof H.showEvent === 'function' ? H.showEvent(kind, text, opts) : false;
    };
  }
  if (typeof F.setRewardPresenter !== 'function') {
    var rewardPresenter = null;
    F.setRewardPresenter = function (fn) {
      if (typeof fn !== 'function' || rewardPresenter) return false;
      rewardPresenter = fn;
      return true;
    };
    F.reward = function () {
      return rewardPresenter ? rewardPresenter.apply(null, arguments) : false;
    };
  }

  function isModuleName(name) {
    return typeof name === 'string' && NAMES.indexOf(name) !== -1;
  }
  function isFilled(obj) {
    return !!obj && Object.keys(obj).length > 0;
  }

  if (typeof G.registerModule !== 'function') {
    G.registerModule = function (name, api) {
      if (!isModuleName(name) || !api || typeof api !== 'object') return false;
      var slot = G[name];
      if (isFilled(slot)) return false;
      for (var k in api) {
        if (Object.prototype.hasOwnProperty.call(api, k)) slot[k] = api[k];
      }
      return true;
    };
  }

  if (typeof G.hasModule !== 'function') {
    G.hasModule = function (name) {
      return isModuleName(name) && isFilled(G[name]);
    };
  }
})(window);
