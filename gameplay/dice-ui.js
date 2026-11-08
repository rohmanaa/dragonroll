/* Gameplay Dice UI — dadu gameplay = DADU 3D ASLI dari Dice Kit (assets/js/dice-kit, modul bersama dengan preview Inventory dadu.html).
   Kubus CSS lama sudah dihapus: fisika kocok-lempar, tekstur/material skin, efek partikel/aura, dan suara semuanya dari DiceKit.
   TIDAK menentukan hasil dadu: angka final (1..6) selalu datang dari gameplay.html (random/Ramuan Ganjil-Genap/Pasti 6/6=giliran ekstra/tiga 6 tetap di sana);
   kit hanya menampilkan lemparan yang berakhir di angka itu (roll(forcedValue)).
   Classic script. Namespace: UT.GameplayDiceUI.
   API:
     init(sceneEl?)       — pasang panggung 3D di #dieScene (idempoten; menunggu modul DiceKit bila belum siap)
     showDie(v, anim)     — anim=true: kocok + lempar fisika yang berakhir di v, mengembalikan Promise (selesai saat dadu mendarat dan angka tampil)
                            anim=false: dadu diam dengan muka v di atas (mengembalikan Promise yang sudah selesai)
     roll(v) / setValue(v) / reset()  — = showDie(v,true) / showDie(v,false) / showDie(1,false)
     setSkin(gameKey)     — ganti skin dadu (material 3D)
     setSound(on) / setVolume(0..1) — ikuti pengaturan suara gameplay
     ready                — true bila dadu 3D sudah terpasang
   Guard gameId/STALE tetap di pemanggil (gameplay.html): modul ini tidak menahan state game. */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayDiceUI) return;

  var scene = null, stage = null, kit = null, failed = false;
  var want = { key: 'klasik', face: 1, sound: true, volume: 1 };
  var SIZE = 230, CX = 32, CY = 44; /* panggung 230px; titik jatuh dadu = tengah tatakan (koordinat #dieScene 64x64) */

  function zoomOf() { /* skala CSS zoom dari induk (dock) agar canvas tidak buram */
    try { var r = stage.getBoundingClientRect(); return r.width && stage.offsetWidth ? r.width / stage.offsetWidth : 1; } catch (e) { return 1; }
  }

  function pad(big) { try { var P = UT.DicePadFX; if (P && P.impact) P.impact(!!big); } catch (e) { /* abaikan */ } }

  function mount() {
    if (kit || failed || !stage || !win.DiceKit || !win.DiceKit.mount) return;
    try {
      var first = true;
      kit = win.DiceKit.mount(stage, {
        diceId: win.DiceKit.has(want.key) ? want.key : 'klasik',
        quality: 'auto',
        sound: want.sound,
        pixelScale: zoomOf(),
        onImpact: function (ev) { pad(first || ev.speed > 6); first = false; }
      });
      kit.setVolume(want.volume);
      kit.showFace(want.face);
      win.addEventListener('resize', function () { if (kit) kit.setPixelScale(zoomOf()); });
      scene.classList.add('dice3d');
      UT.GameplayDiceUI.ready = true;
      win.dispatchEvent(new Event('ut:dice3d-ready'));
    } catch (e) {
      failed = true; kit = null;
      console.error('[dice] Dice Kit gagal dipasang', e);
    }
  }

  function init(sceneEl) {
    scene = sceneEl || doc.getElementById('dieScene');
    if (!scene) return false;
    if (!stage) {
      try { if (win.getComputedStyle(scene).position === 'static') scene.style.position = 'relative'; } catch (e) { /* abaikan */ }
      stage = doc.createElement('div');
      stage.className = 'die3d';
      stage.setAttribute('aria-hidden', 'true');
      stage.style.cssText = 'position:absolute;pointer-events:none;z-index:2;width:' + SIZE + 'px;height:' + SIZE + 'px;' +
        'left:' + Math.round(CX - SIZE / 2) + 'px;top:' + Math.round(CY - SIZE * 0.598) + 'px;';
      scene.appendChild(stage);
    }
    if (win.DiceKit) mount(); else win.addEventListener('dicekit-ready', mount, { once: true });
    return true;
  }

  function showDie(v, anim) {
    if (!(v >= 1 && v <= 6)) return Promise.resolve(0); /* hanya 1..6; nilai lain diabaikan (hasil tetap ditentukan gameplay) */
    want.face = v;
    if (!kit) return Promise.resolve(v);
    if (!anim) { kit.showFace(v); return Promise.resolve(v); }
    var p = kit.roll(v);
    return p ? p.then(function () { return v; }) : Promise.resolve(v);
  }

  function setSkin(key) {
    if (!key) return;
    want.key = key;
    if (kit && win.DiceKit.has(key)) kit.equip(key);
  }

  function setSound(on) { want.sound = !!on; if (kit) kit.setSound(want.sound); }
  function setVolume(v) { v = +v; want.volume = isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); if (kit) kit.setVolume(want.volume); }

  UT.GameplayDiceUI = {
    ready: false,
    init: init,
    setSkin: setSkin,
    setSound: setSound,
    setVolume: setVolume,
    showDie: showDie,
    roll: function (v) { return showDie(v, true); },
    setValue: function (v) { return showDie(v, false); },
    reset: function () { return showDie(1, false); }
  };
})(window, document);
