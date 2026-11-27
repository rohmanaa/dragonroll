/* Menu gameplay (dock kiri) + modal Pengaturan & Bantuan.
   Dipanggil dari main.js: UT.GameplayHudMenu.bind(ops). Tombol lama (#btnPreset, #btnFollow, #btnCam, #btnSnd, #btnPause, #btnMenu) tetap ada
   (disembunyikan CSS) dan dipakai sebagai satu-satunya logika: dock hanya memanggil ops/klik tombol itu lalu menyalin status lewat sync().
   API: bind(ops), setOpen(bool), sync(). Sebelum bind, setOpen/sync = no-op agar aman dipanggil dari main.js kapan saja. */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayHudMenu) return;

  var NOTE = {
    auto: 'Otomatis: memilih tingkat sesuai perangkat dan menurunkannya sendiri bila game terasa berat.',
    low: 'Efek sinematik dimatikan. Paling ringan untuk HP.',
    normal: 'Seimbang antara tampilan dan performa.',
    high: 'Efek visual penuh (HP: sedikit dihemat).',
    ultra: 'Kualitas tertinggi. Butuh perangkat kuat.'
  };
  var G = 'assets/images/ui/white-glyphs/';
  var ICO_DAY = G + 'matahari.webp', ICO_NIGHT = G + 'bulan.webp', ICO_ON = G + 'speaker-suara.webp', ICO_OFF = G + 'speaker-mati.webp';

  function bind(ops) {
    if (bind.done) return;
    bind.done = true;
    var $ = function (id) { return doc.getElementById(id); };
    var hm = $('hm'), tab = $('hmTab');
    if (!hm || !tab) return;
    hm.hidden = false;
    var desktop = win.matchMedia ? win.matchMedia('(min-width:900px) and (pointer:fine)') : { matches: false };
    var open = false, openedByUser = false;

    function setOpen(v) {
      open = !!v;
      hm.classList.toggle('open', open);
      tab.setAttribute('aria-expanded', String(open));
    }
    function userSet(v) { openedByUser = true; ops.setMenuOpen(v); }

    /* tombol hanya ikon: status lewat ikon/titik/redup + aria-label (tanpa teks tampil) */
    function label(id, text) { var e = $(id); e.setAttribute('aria-label', text); e.title = text; }
    function sync() {
      var guest = !!ops.isOnlineGuest();
      var cn = ops.camName(), ci = ops.camIndex();
      label('hmCam', 'Kamera: ' + cn);
      [].forEach.call($('hmPips').children, function (p, i) { p.className = i === ci ? 'on' : ''; });
      var f = !!ops.isFollow(); $('hmFollow').setAttribute('aria-pressed', String(f)); label('hmFollow', 'Ikuti bidak: ' + (f ? 'nyala' : 'mati'));
      var night = !!ops.isNight(), auto = !!ops.isAutoDN(), m = $('hmMode');
      m.querySelector('.hm-g').src = night ? ICO_NIGHT : ICO_DAY;
      m.setAttribute('data-auto', auto ? '1' : '0');
      label('hmMode', 'Suasana: ' + (auto ? 'otomatis' : (night ? 'malam' : 'siang')));
      m.disabled = guest; if (guest) m.title = 'Hanya host yang bisa mengubah suasana';
      var muted = !!ops.isMuted();
      $('hmSnd').setAttribute('aria-pressed', String(!muted)); $('hmSnd').querySelector('.hm-g').src = muted ? ICO_OFF : ICO_ON; label('hmSnd', 'Suara: ' + (muted ? 'mati' : 'nyala'));
    }

    /* ---- modal ---- */
    function showModal(id, focusId) {
      var m = $(id); if (!m) return;
      if (id === 'settingsMenu') syncSettings();
      m.hidden = false; var f = $(focusId); if (f && f.focus) f.focus();
    }
    function hideModal(id) { var m = $(id); if (m) m.hidden = true; }
    function anyModal() { return !$('settingsMenu').hidden || !$('helpMenu').hidden; }
    function syncSettings() {
      var g = ops.getGraphics(), auto = !!ops.isGraphicsAuto();
      [].forEach.call($('stGfx').querySelectorAll('button'), function (b) { var k = b.getAttribute('data-gfx'); var on = auto ? k === 'auto' : k === g; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
      $('stGfxN').textContent = auto ? NOTE.auto + ' Sekarang: ' + ({ low: 'Rendah', normal: 'Normal', high: 'Tinggi', ultra: 'Ultra' }[g] || 'Tinggi') + '.' : (NOTE[g] || NOTE.high);
      var m = $('pmVol'), s = $('pmSfx');
      if (m) { m.value = ops.getMusicVol(); ops.paintRange(m); }
      if (s) { s.value = ops.getSfxVol(); ops.paintRange(s); }
    }

    /* ---- aksi ---- */
    tab.addEventListener('click', function () { userSet(!open); });
    $('hmCam').addEventListener('click', function () { ops.camNext(); sync(); });
    $('hmFollow').addEventListener('click', function () { ops.toggleFollow(); sync(); });
    $('hmReset').addEventListener('click', function () { ops.resetCam(); });
    $('hmMode').addEventListener('click', function () { ops.cycleMode(); sync(); });
    $('hmSnd').addEventListener('click', function () { ops.toggleSound(); sync(); });
    $('hmHelp').addEventListener('click', function () { showModal('helpMenu', 'hpDone'); });
    $('hmSet').addEventListener('click', function () { showModal('settingsMenu', 'stDone'); });
    $('hmPause').addEventListener('click', function () { ops.pause(); });

    $('stGfx').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-gfx]'); if (!b) return;
      ops.setGraphics(b.getAttribute('data-gfx')); syncSettings();
    });
    ['stClose', 'stDone'].forEach(function (id) { $(id).addEventListener('click', function () { hideModal('settingsMenu'); }); });
    ['hpClose', 'hpDone'].forEach(function (id) { $(id).addEventListener('click', function () { hideModal('helpMenu'); }); });
    ['settingsMenu', 'helpMenu'].forEach(function (id) { $(id).addEventListener('click', function (e) { if (e.target === e.currentTarget) hideModal(id); }); });
    /* slider Musik/Suara (#pmVol/#pmSfx): listener-nya dipasang pause.js (id sama), di sini hanya disinkronkan saat modal dibuka */

    /* Esc menutup modal dulu (capture + preventDefault: pause.js mengabaikan Esc yang sudah ditangani) */
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !anyModal()) return;
      e.preventDefault(); hideModal('settingsMenu'); hideModal('helpMenu');
    }, true);
    /* HP: ketuk di luar dock menutupnya (desktop: tetap terbuka) */
    doc.addEventListener('pointerdown', function (e) {
      if (!open || desktop.matches || hm.contains(e.target)) return;
      ops.setMenuOpen(false);
    }, true);

    /* pasang API asli DULU (setHudMenuOpen di main.js memanggil setOpen), baru atur keadaan awal: bendera tergulung */
    UT.GameplayHudMenu.setOpen = setOpen;
    UT.GameplayHudMenu.sync = sync;
    UT.GameplayHudMenu.closeModals = function () { hideModal('settingsMenu'); hideModal('helpMenu'); };
    ops.setMenuOpen(false);
    sync();
  }

  UT.GameplayHudMenu = { bind: bind, setOpen: function () {}, sync: function () {}, closeModals: function () {} };
})(window, document);
