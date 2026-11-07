/* Gameplay Dice UI (Stage 4.1.10) — HANYA presentation dadu: bangun 6 muka, rotasi 3D, animasi gulir, reset tampilan.
   TIDAK menentukan hasil dadu: angka final (1..6) selalu datang dari gameplay.html (random/Ramuan Ganjil-Genap/Pasti 6/6=giliran ekstra/tiga 6 tetap di sana).
   Classic script. Namespace: UT.GameplayDiceUI.
   API:
     init(dieEl?, sceneEl?)  — bangun muka dadu di #die (idempoten, tidak membuat DOM ganda)
     showDie(v, anim)        — tampilkan muka v (1..6); anim=true -> gulir 1.05s + hop (persis perilaku lama)
     roll(v)                 — = showDie(v, true)
     setValue(v) / reset()   — = showDie(v, false) / showDie(1, false)
   Guard gameId/STALE tetap di pemanggil (gameplay.html): modul ini tidak memegang timer/callback async. */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayDiceUI) return;

  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  var DIE_T = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
  var dieEl = null, dieScene = null, dX = 0, dY = 0;

  function init(die, scene) {
    dieEl = die || doc.getElementById('die');
    dieScene = scene || doc.getElementById('dieScene');
    if (!dieEl) return false;
    if (!dieEl.querySelector('.face')) { /* jangan buat muka ganda bila init dipanggil lagi */
      for (var v = 1; v <= 6; v++) {
        var f = doc.createElement('div'); f.className = 'face f' + v;
        for (var i = 0; i < 9; i++) { var s = doc.createElement('i'); if (PIPS[v].indexOf(i) > -1) s.className = 'on'; f.appendChild(s); }
        dieEl.appendChild(f);
      }
    }
    return true;
  }

  function showDie(v, anim) {
    if (!dieEl && !init()) return;
    if (!DIE_T[v]) return; /* hanya 1..6; nilai lain diabaikan (hasil tetap ditentukan gameplay) */
    var tx = DIE_T[v][0], ty = DIE_T[v][1];
    var ax = Math.ceil((dX - tx) / 360) + (anim ? 2 : 0), ay = Math.ceil((dY - ty) / 360) + (anim ? 2 : 0);
    dX = tx + 360 * ax; dY = ty + 360 * ay;
    dieEl.style.transition = anim ? 'transform 1.05s cubic-bezier(.15,.7,.2,1)' : 'none';
    dieEl.style.transform = 'rotateX(' + dX + 'deg) rotateY(' + dY + 'deg)';
    var fs = dieEl.querySelectorAll('.face'); /* muka hasil tetap terang; muka lain digelapkan sedikit */
    for (var k = 0; k < fs.length; k++) fs[k].classList.toggle('dim', !fs[k].classList.contains('f' + v));
    if (anim && dieScene) { dieScene.classList.remove('hop'); void dieScene.offsetWidth; dieScene.classList.add('hop'); }
  }

  UT.GameplayDiceUI = {
    init: init,
    showDie: showDie,
    roll: function (v) { showDie(v, true); },
    setValue: function (v) { showDie(v, false); },
    reset: function () { showDie(1, false); }
  };
})(window, document);
