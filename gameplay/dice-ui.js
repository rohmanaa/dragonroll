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

  /* Bayangan sisi KIRI: hitung normal tiap muka setelah rotasi akhir (tilt CSS rotateX(-28) rotateY(38) + rotasi dadu), muka yang menghadap kiri layar digelapkan. */
  var TILT_X = -28, TILT_Y = 38, FACE_N = { 1: [0, 0, 1], 6: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0], 5: [0, -1, 0], 2: [0, 1, 0] };
  function rotX(n, d) { var a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c]; }
  function rotY(n, d) { var a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; }
  function shade(fs, v) {
    for (var k = 0; k < fs.length; k++) {
      var f = fs[k], id = +f.className.match(/f([1-6])/)[1];
      var n = rotX(rotY(rotX(rotY(FACE_N[id], dY), dX + 90), TILT_Y), TILT_X);
      var left = n[2] > 0 ? Math.max(0, Math.min(0.5, -n[0] * 0.55)) : 0; /* x<0 = menghadap kiri */
      f.style.setProperty('--sh', ((id === v ? 0 : 0.2) + left).toFixed(2));
    }
  }

  /* Skin: muka dadu memakai tekstur asli dari DiceSkin (sama dengan preview Inventory); tanpa modul -> warna datar bawaan. */
  function setSkin(key) {
    if (!dieEl && !init()) return;
    var S = win.UT && win.UT.DiceSkin, ok = false;
    try { ok = !!(S && key && S.has(key)); } catch (e) { ok = false; }
    var fs = dieEl.querySelectorAll('.face');
    for (var k = 0; k < fs.length; k++) {
      var id = +fs[k].className.match(/f([1-6])/)[1], url = '';
      if (ok) { try { url = S.face(key, id); } catch (e) { url = ''; } }
      fs[k].style.backgroundImage = url ? 'url(' + url + ')' : '';
    }
    dieEl.classList.toggle('tex', ok);
  }

  function showDie(v, anim) {
    if (!dieEl && !init()) return;
    if (!DIE_T[v]) return; /* hanya 1..6; nilai lain diabaikan (hasil tetap ditentukan gameplay) */
    var tx = DIE_T[v][0], ty = DIE_T[v][1];
    var ax = Math.ceil((dX - tx) / 360) + (anim ? 2 : 0), ay = Math.ceil((dY - ty) / 360) + (anim ? 2 : 0);
    dX = tx + 360 * ax; dY = ty + 360 * ay;
    dieEl.style.transition = anim ? 'transform 1.18s cubic-bezier(.15,.7,.2,1)' : 'none';
    dieEl.style.transform = 'rotateX(' + (dX + 90) + 'deg) rotateY(' + dY + 'deg)'; /* +90: muka hasil dibawa ke ATAS kubus (bukan depan/samping) */
    var fs = dieEl.querySelectorAll('.face'); /* muka hasil tetap terang; muka lain digelapkan sedikit */
    for (var k = 0; k < fs.length; k++) fs[k].classList.toggle('dim', !fs[k].classList.contains('f' + v));
    shade(fs, v);
    if (anim && dieScene) { dieScene.classList.remove('hop'); void dieScene.offsetWidth; dieScene.classList.add('hop'); }
  }

  UT.GameplayDiceUI = {
    init: init,
    setSkin: setSkin,
    showDie: showDie,
    roll: function (v) { showDie(v, true); },
    setValue: function (v) { showDie(v, false); },
    reset: function () { showDie(1, false); }
  };
})(window, document);
