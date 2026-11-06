/* Ular Tangga Blok — app.js (Tahap 2: Shared App Shell)
   Namespace global bersama "UT". Skrip klasik (tanpa import/export/type=module).
   Urutan muat: item-catalog.js -> player-data.js -> [game-integration.js] -> app.js -> kode halaman.
   PlayerData tetap source of truth; UT.State hanya facade. */
window.UT = window.UT || {};

(function (UT, win, doc) {
  'use strict';

  UT.App = UT.App || {};
  UT.Router = UT.Router || {};
  UT.State = UT.State || {};
  UT.Events = UT.Events || {};
  UT.Audio = UT.Audio || {};
  UT.UI = UT.UI || {};
  UT.Utils = UT.Utils || {};

  UT.version = 'tahap2';
  UT.PAGES = ['index', 'lobby', 'mode', 'gameplay', 'shop', 'inventory', 'leaderboard', 'profile', 'friendship', 'dailyreward', 'misi', 'room'];

  /* ================= Utils ================= */
  UT.Utils.safe = function (fn, fallback) { try { return fn(); } catch (e) { return fallback; } };
  UT.Utils.clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  UT.Utils.isObject = function (o) { return !!o && typeof o === 'object' && !Array.isArray(o); };

  /* ================= Events (event bus) ================= */
  var handlers = {};
  UT.Events.NAMES = ['skinChanged', 'diceChanged', 'currencyChanged', 'inventoryChanged', 'settingsChanged', 'modeChanged', 'frameChanged'];
  UT.Events.on = function (name, fn) {
    if (typeof fn !== 'function') return function () {};
    (handlers[name] = handlers[name] || []).push(fn);
    return function () { UT.Events.off(name, fn); };
  };
  UT.Events.off = function (name, fn) {
    if (!handlers[name]) return;
    if (!fn) { delete handlers[name]; return; }
    handlers[name] = handlers[name].filter(function (f) { return f !== fn; });
  };
  UT.Events.once = function (name, fn) {
    var off = UT.Events.on(name, function (d) { off(); fn(d); });
    return off;
  };
  UT.Events.emit = function (name, data) {
    (handlers[name] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) { if (win.console) console.error('[UT.Events]', name, e); }
    });
  };

  /* ================= State (facade; tidak menyimpan data sendiri) ================= */
  UT.State.getPlayerData = function () { return win.PlayerData || null; };
  UT.State.getCatalog = function () { return win.ItemCatalog || null; };
  UT.State.getPlayer = function () {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.snapshot(); }, null) : null;
  };
  UT.State.getCoins = function () {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.coins(); }, 0) : 0;
  };
  UT.State.getGems = function () {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.gems(); }, 0) : 0;
  };
  UT.State.getSettings = function () {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.settings(); }, null) : null;
  };
  UT.State.getProfile = function () {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.profile(); }, null) : null;
  };
  UT.State.getEquipped = function (slot) {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.equippedId(slot); }, null) : null;
  };
  UT.State.owns = function (id) {
    var PD = win.PlayerData;
    return PD ? UT.Utils.safe(function () { return PD.owns(id); }, false) : false;
  };
  UT.State.getPage = function () { return UT.App.page || null; };
  UT.State.getConfig = function () { return win.__utConfig || null; }; /* diisi game-integration.js di gameplay */

  /* ================= Router (helper navigasi) ================= */
  UT.Router.build = function (page, params) {
    var url = String(page || '');
    if (!url) return '';
    var q = [];
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null) return;
        q.push(encodeURIComponent(k) + '=' + encodeURIComponent(Array.isArray(v) ? v.join(',') : v));
      });
    }
    if (!q.length) return url;
    var hashAt = url.indexOf('#'), hash = '';
    if (hashAt > -1) { hash = url.slice(hashAt); url = url.slice(0, hashAt); }
    return url + (url.indexOf('?') > -1 ? '&' : '?') + q.join('&') + hash;
  };
  UT.Router.go = function (page, params) {
    var url = UT.Router.build(page, params);
    if (url) win.location.href = url;
    return url;
  };
  UT.Router.replace = function (page, params) {
    var url = UT.Router.build(page, params);
    if (url) win.location.replace(url);
    return url;
  };
  UT.Router.getParams = function () {
    var out = {};
    try { new URLSearchParams(win.location.search).forEach(function (v, k) { out[k] = v; }); } catch (e) {}
    return out;
  };
  ['lobby', 'mode', 'gameplay', 'shop', 'inventory', 'leaderboard', 'profile', 'friendship', 'dailyreward'].forEach(function (p) {
    UT.Router['to' + p.charAt(0).toUpperCase() + p.slice(1)] = function (params) { return UT.Router.go(p + '.html', params); };
  });

  /* ================= UI (adapter; helper halaman lama tetap dipertahankan) ================= */
  var toastTimer = null, toastEl = null;
  UT.UI.toast = function (message, ms) {
    var el = doc.getElementById('toast'); /* pakai #toast milik halaman bila ada => tampilan tidak berubah */
    var own = !el;
    if (own) {
      if (!toastEl) { toastEl = doc.createElement('div'); toastEl.className = 'ut-toast'; (doc.body || doc.documentElement).appendChild(toastEl); }
      el = toastEl;
    }
    el.textContent = message == null ? '' : String(message);
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, ms > 0 ? ms : 1800);
    return el;
  };

  var openModals = [];
  UT.UI.modal = function (content, opts) {
    opts = opts || {};
    var ov = doc.createElement('div'); ov.className = 'ut-overlay';
    var box = doc.createElement('div'); box.className = 'ut-modal';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    if (content && content.nodeType) box.appendChild(content); else box.textContent = content == null ? '' : String(content);
    if (opts.closable !== false) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'ut-modal-close'; b.textContent = opts.closeLabel || 'Tutup';
      b.addEventListener('click', function () { UT.UI.closeModal(ov); });
      box.appendChild(b);
      ov.addEventListener('click', function (e) { if (e.target === ov) UT.UI.closeModal(ov); });
    }
    ov.appendChild(box);
    (doc.body || doc.documentElement).appendChild(ov);
    openModals.push(ov);
    return ov;
  };
  UT.UI.closeModal = function (handle) {
    var list = handle ? [handle] : openModals.slice();
    list.forEach(function (ov) {
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      openModals = openModals.filter(function (x) { return x !== ov; });
    });
  };
  UT.UI.setLoading = function (on) {
    doc.documentElement.classList.toggle('ut-loading', !!on);
    return !!on;
  };

  /* ================= Audio (fondasi; TIDAK menggantikan WebAudio gameplay) ================= */
  var SFX_BASE = 'assets/sfx/';
  var SFX = {                       /* nama logis -> file yang ADA di assets/sfx */
    button: 'ui/button-click.mp3',
    chest: 'ui/chest-reward.mp3',
    kalah: 'ui/game-lose.mp3',
    power: 'ui/power-claim.mp3',
    notif: 'notification.mp3'        /* notif undangan teman (presence.js); file di root assets/sfx/ */
  };
  var audioCache = {}, muted = false, volume = 1;
  UT.Audio.sources = SFX;
  UT.Audio.get = function (name) {
    if (!SFX[name]) return null;
    if (!audioCache[name]) {
      try { audioCache[name] = new win.Audio(SFX_BASE + SFX[name]); audioCache[name].preload = 'auto'; }
      catch (e) { return null; }
    }
    return audioCache[name];
  };
  UT.Audio.play = function (name) {
    if (muted) return false;
    /* Ketukan tombol dimainkan oleh pembungkus (play.html) bila ada: suara tetap bunyi walau halaman langsung berpindah. */
    if (name === 'button') {
      try { if (win.parent && win.parent !== win && win.parent.UTShell) { win.parent.UTShell.click(); return true; } } catch (e) {}
    }
    var a = UT.Audio.get(name); if (!a) return false;
    try {
      a.volume = volume; a.currentTime = 0;
      var p = a.play(); if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) { return false; }
  };
  UT.Audio.stop = function (name) {
    var names = name ? [name] : Object.keys(audioCache);
    names.forEach(function (n) {
      var a = audioCache[n]; if (!a) return;
      try { a.pause(); a.currentTime = 0; } catch (e) {}
    });
  };
  UT.Audio.setMuted = function (m) {
    muted = !!m;
    if (muted) UT.Audio.stop();
    return muted;
  };
  UT.Audio.isMuted = function () { return muted; };
  UT.Audio.setVolume = function (v) {
    v = +v; volume = isFinite(v) ? UT.Utils.clamp(v, 0, 1) : volume;
    Object.keys(audioCache).forEach(function (n) { audioCache[n].volume = volume; });
    return volume;
  };
  UT.Audio.getVolume = function () { return volume; };

  /* ================= App ================= */
  UT.App.page = null;
  UT.App.ready = false;
  UT.App.options = {};
  UT.App.init = function (options) {
    options = options || {};
    if (UT.App.ready) return UT.App; /* idempoten: tidak membuat ulang sistem */
    UT.App.options = options;
    UT.App.page = options.page || null;
    /* pemain online: halaman menu ikut tampil di daftar online (hanya bila sudah punya sesi; room.html & mode.html memulainya sendiri) */
    if (['lobby','shop','inventory','profile','misi','friendship','leaderboard','dailyreward'].indexOf(UT.App.page) >= 0) {
      try { import('./multiplayer/presence.js').then(function () { win.UT.Multiplayer.Presence.start({ status: 'lobby', requireSession: true }); }).catch(function () {}); } catch (e) {}
    }
    if (UT.App.page && UT.PAGES.indexOf(UT.App.page) < 0 && win.console) console.warn('[UT.App] page tidak dikenal:', UT.App.page);
    /* Jembatan PlayerData -> UT.Events (tanpa mengubah PlayerData) */
    var PD = win.PlayerData;
    if (PD && typeof PD.subscribe === 'function') {
      var last = UT.Utils.safe(function () { return PD.snapshot(); }, null);
      PD.subscribe(function (reason) {
        var now = UT.Utils.safe(function () { return PD.snapshot(); }, null);
        if (!now) return;
        if (last) {
          if (now.coins !== last.coins || now.gems !== last.gems) UT.Events.emit('currencyChanged', { coins: now.coins, gems: now.gems, reason: reason });
          if (JSON.stringify(now.inventory) !== JSON.stringify(last.inventory)) UT.Events.emit('inventoryChanged', { reason: reason });
          if (now.equipped.skin !== last.equipped.skin) UT.Events.emit('skinChanged', { id: now.equipped.skin });
          if (now.equipped.dice !== last.equipped.dice) UT.Events.emit('diceChanged', { id: now.equipped.dice });
          if (now.equipped.frame !== last.equipped.frame) UT.Events.emit('frameChanged', { id: now.equipped.frame });
          if (JSON.stringify(now.settings) !== JSON.stringify(last.settings)) UT.Events.emit('settingsChanged', { settings: now.settings, reason: reason });
          if (JSON.stringify(now.profile) !== JSON.stringify(last.profile)) UT.Events.emit('profileChanged', { profile: now.profile, reason: reason });
        }
        last = now;
      });
    }
    /* Suara ketukan tombol otomatis untuk halaman yang belum punya playSound sendiri (halaman lain sudah memanggil UT.Audio.play('button')).
       Hanya bunyi bila pengaturan "Suara" aktif. */
    if (['lobby', 'mode', 'friendship'].indexOf(UT.App.page) > -1) {
      doc.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('button,[role="button"],a[href],[data-act]') : null;
        if (!t || t.disabled) return;
        var s = UT.State.getSettings();
        if (s && s.sound === false) return;
        UT.Audio.play('button');
      }, true);
    }
    UT.App.ready = true;
    UT.Events.emit('appReady', { page: UT.App.page });
    return UT.App;
  };
})(window.UT, window, document);
