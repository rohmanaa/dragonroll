(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayPause) return;

  function bind(ops) {
    if (bind.done) return;
    bind.done = true;
    ops = ops || {};
    var $ = function (id) { return doc.getElementById(id); };
    var ICO_SUN = '<img src="assets/Images/icon/ui/day.webp" alt="" draggable="false">';
    var ICO_MOON = '<img src="assets/Images/icon/ui/night.webp" alt="" draggable="false">';

    function syncMusicUI() {
      var music = $('pmVol'), sfx = $('pmSfx');
      if (music) { music.value = ops.getMusicVol(); ops.paintRange(music); }
      if (sfx) { sfx.value = ops.getSfxVol(); ops.paintRange(sfx); }
    }

    function syncNight() {
      var mode = $('pmMode');
      mode.disabled = !!ops.isOnlineGuest();
      mode.setAttribute('aria-pressed', String(ops.isNight()));
      $('pmModeTxt').textContent = ops.isAutoDN()
        ? 'Auto · ' + (ops.isNight() ? 'Malam' : 'Siang')
        : (ops.isNight() ? 'Malam' : 'Siang');
      $('pmModeIco').innerHTML = ops.isNight() ? ICO_MOON : ICO_SUN;
    }

    function openPause() {
      if (ops.isPaused() || ops.isReadyRunning()) return;
      if (ops.closeHudMenu) ops.closeHudMenu();
      ops.setPaused(true);
      ops.clearTurnTimer();
      $('pmSub').textContent = ops.getMode() === 'cpu'
        ? 'Permainan dijeda · Komputer menunggu'
        : 'Permainan dijeda';
      $('pmRestart').disabled = !!ops.isOnlineGuest();
      syncNight();
      syncMusicUI();
      $('pauseMenu').hidden = false;
      $('pmResume').focus();
    }

    function closePause() {
      ops.setPaused(false);
      ops.startTurnTimer();
      $('exitConfirm').hidden = true;
      $('pauseMenu').hidden = true;
      $('btnMenu').focus();
    }

    $('pmVol').addEventListener('input', function (e) {
      ops.setMusicVol(+e.target.value);
      ops.paintRange(e.target);
    });
    $('pmSfx').addEventListener('input', function (e) {
      ops.setSfxVol(+e.target.value);
      ops.paintRange(e.target);
    });
    $('pmSfx').addEventListener('change', ops.onSfxCommit);
    $('pmMode').addEventListener('click', function () {
      ops.cycleMode();
      syncNight();
      ops.setMusicOn(true);
    });
    $('btnPause').addEventListener('click', openPause);
    $('pmResume').addEventListener('click', closePause);
    $('pmClose').addEventListener('click', closePause);
    $('pmRestart').addEventListener('click', function () {
      if (ops.isOnlineGuest()) return;
      ops.ensureAudio();
      ops.setPaused(false);
      $('exitConfirm').hidden = true;
      $('pauseMenu').hidden = true;
      ops.restart();
    });
    $('pauseMenu').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closePause();
    });
    $('exitConfirm').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) {
        $('exitConfirm').hidden = true;
        $('pmExit').focus();
      }
    });
    $('pmExit').addEventListener('click', function () {
      $('exitConfirm').hidden = false;
      $('ecNo').focus();
    });
    $('ecNo').addEventListener('click', function () {
      $('exitConfirm').hidden = true;
      $('pmExit').focus();
    });
    $('ecYes').addEventListener('click', ops.exitToRoom);
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !ops.isPlaying()) return;
      if (!$('exitConfirm').hidden) {
        $('exitConfirm').hidden = true;
        return;
      }
      if (ops.isPaused()) closePause();
      else if (ops.isWinHidden()) openPause();
    });
  }

  UT.GameplayPause = { bind: bind };
})(window, document);
