/* UT.AccountHub — Profil · Teman · Pesan · Peringkat · Misi · Pengaturan dalam SATU halaman penuh (profile.html), BUKAN modal.
   - Tab berpindah DI TEMPAT: panel lama di-unmount, panel baru dimuat ke #pane (CSS + DOM + skrip + modul), tanpa pindah halaman, tanpa fade,
     bingkai modal/tab/tombol X tetap. Hanya SATU panel yang ada di DOM pada satu waktu, jadi id yang sama (#list, #md, #toast, ...) tidak bentrok.
   - Sumber isi panel: Profil = <template id="tpl-profil"> di profile.html; Teman/Pesan/Peringkat/Misi/Pengaturan = isi #stage dari friendship.html / mail.html /
     leaderboard.html / hadiah-misi.html / settings.html (halaman itu tetap jadi sumber; dibuka langsung di browser ia dialihkan ke profile.html?tab=...).
   - Perilaku halaman: tombol Kembali (kiri atas) pindah ke halaman asal; Esc juga kembali (bila ada dialog dalam yang terbuka, Esc menutup dialog itu dulu).
     Tidak ada latar gelap, perangkap fokus, `inert`, atau tutup-dengan-klik-luar. Tab berstandar WAI-ARIA (panah kiri/kanan, Home/End, roving tabindex).
     Dialog KECIL di dalam panel (#md, #confirm, #lang) tetap modal sungguhan dan dibungkus UT.ModalKit.
   - URL: ?tab=profil|teman|pesan|peringkat|misi|setelan (+ &from=halaman-asal untuk tujuan tombol Kembali; &sub=hadiah|misi|ach = sub-tab panel Misi). Ganti tab memakai replaceState (tidak menambah riwayat).
   Skrip klasik. Helper murni (pageOf, tabOf, canon, hubUrl, homeUrl, ...) dapat dimuat di Node (module.exports) untuk tes. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.AccountHub = api; }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';

  var IC = 'assets/images/ui/';
  var TABS = [
    { key: 'profil',  label: 'Profil',     icon: IC + 'item-icons/helm-ksatria.webp',   module: 'profil',     app: 'profile',    page: null },
    { key: 'teman',   label: 'Teman',      icon: IC + 'feature-icons/friends.webp',     module: 'friendship', app: 'friendship', page: 'friendship.html' },
    { key: 'pesan',   label: 'Pesan',      icon: IC + 'item-icons/surat-segel.webp',    module: 'mail',       app: 'mail',       page: 'mail.html' },
    { key: 'peringkat', label: 'Peringkat', icon: IC + 'item-icons/podium.webp',         module: 'leaderboard', app: 'leaderboard', page: 'leaderboard.html' },
    { key: 'misi',    label: 'Misi',       icon: IC + 'item-icons/gulungan-misi.webp',  module: 'hadiah-misi', app: 'hadiahmisi', page: 'hadiah-misi.html' },
    { key: 'setelan', label: 'Pengaturan', icon: IC + 'item-icons/gir.webp',            module: 'settings',   app: 'settings',   page: 'settings.html' }
  ];
  var BY = {};
  TABS.forEach(function (t) { BY[t.key] = t; });
  var PAGE_TAB = { 'profile.html': 'profil', 'friendship.html': 'teman', 'mail.html': 'pesan', 'leaderboard.html': 'peringkat', 'hadiah-misi.html': 'misi', 'settings.html': 'setelan' };
  var DIALOGS = [['#md', '#m-no,#m-ok'], ['#confirm', '#cf-no'], ['#lang', null], ['#frmd', '#frx']];   // [selector kontainer dialog dalam panel, fokus awal]
  var SKIP_CSS = /(^|\/)(page|bg|common|profile-tabs|account-hub)\.css$/;     // sudah dimuat halaman hub (statis)
  var SKIP_JS = /(^|\/)(page-shell|profile-tabs|hub-redirect|room-modal-bridge|inventory-bridge|frame-guard|boot-guard)\.js$/;

  /* ================= helper murni ================= */
  function pageOf(url) {
    var m = /^([A-Za-z0-9_-]+\.html)(?:[?#]|$)/.exec(String(url || ''));
    return m ? m[1] : '';
  }
  function queryOf(url) {
    var s = String(url || ''), i = s.indexOf('?');
    return i < 0 ? '' : s.slice(i).split('#')[0];
  }
  function param(url, name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(queryOf(url));
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
  }
  /* tab dari URL: ?tab= menang; tanpa itu, dari nama halaman (friendship.html -> teman); default profil */
  function tabOf(url) {
    var t = param(url, 'tab');
    if (BY[t]) return t;
    return PAGE_TAB[pageOf(url)] || 'profil';
  }
  /* tujuan tombol Kembali yang aman: halaman .html lokal, bukan halaman hub/splash/index/play */
  function validFrom(f) {
    return f && /^[a-z0-9_-]+\.html(\?[^#]*)?$/i.test(f) && !/^(profile|friendship|mail|leaderboard|hadiah-misi|settings|splash|index|play)\.html/i.test(f) ? f : '';
  }
  /* sub = sub-tab isi panel (panel Misi: hadiah | misi | ach); hanya huruf kecil, selain itu dibuang */
  function hubUrl(key, from, sub) {
    return 'profile.html?tab=' + (BY[key] ? key : 'profil') + (validFrom(from) ? '&from=' + encodeURIComponent(from) : '') + (/^[a-z]{1,12}$/.test(sub || '') ? '&sub=' + sub : '');
  }
  /* friendship.html / mail.html / leaderboard.html / hadiah-misi.html / settings.html -> profile.html?tab=...; URL lain (termasuk profile.html) tidak diubah */
  function canon(url) {
    var p = pageOf(url);
    if (!PAGE_TAB[p] || p === 'profile.html') return url;
    /* hadiah-misi.html?tab=hadiah|misi|ach: ?tab= milik halaman lama = sub-tab (?sub=) di hub; tanpa ?tab= = Hadiah Harian seperti dulu */
    return hubUrl(PAGE_TAB[p], param(url, 'from'), p === 'hadiah-misi.html' ? (param(url, 'tab') || 'hadiah') : '');
  }
  /* tujuan tombol Kembali: ?from= yang valid; bila tidak ada, halaman asal (referrer sama-origin yang valid); selain itu lobby */
  function homeUrl(url, referrer, origin) {
    var f = validFrom(param(url, 'from'));
    if (f) return f;
    try {
      var r = new URL(referrer);
      if (origin && r.origin === origin) {
        var n = r.pathname.split('/').pop();
        if (validFrom(n)) return n + r.search;
      }
    } catch (e) { /* referrer kosong/tidak valid */ }
    return 'lobby.html';
  }

  var api = {
    TABS: TABS, pageOf: pageOf, queryOf: queryOf, param: param, tabOf: tabOf, validFrom: validFrom, hubUrl: hubUrl, canon: canon, homeUrl: homeUrl,
    open: function () { return null; }, handle: function () { return false; }, query: function () { return ''; }, active: function () { return null; }
  };
  if (!G || !G.document) return api;   // Node: hanya helper murni

  /* ================= browser ================= */
  var D = G.document, active = null;

  function el(tag, id, cls) {
    var n = D.createElement(tag);
    if (id) n.id = id;
    if (cls) n.className = cls;
    return n;
  }
  function warn(msg, e) { try { (G.console || console).error(msg, e); } catch (_) { /* abaikan */ } }
  function rm(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }

  /* ---- pemuat skrip/halaman (sama pola dengan UT.Spa, tapi untuk panel di dalam hub) ---- */
  var scripts = Object.create(null), pages = Object.create(null);
  function keyOf(src) { try { return new G.URL(src, G.location.href).pathname; } catch (e) { return src; } }
  function loadScripts(list, mods) {
    mods = mods || {};
    return Promise.all(list.map(function (src) {
      var k = keyOf(src);
      if (!scripts[k]) {
        var already = Array.prototype.some.call(D.scripts || [], function (s) { return s.src && keyOf(s.src) === k; });
        if (already) scripts[k] = Promise.resolve();
        else if (mods[src]) {
          scripts[k] = import(new G.URL(src, G.location.href).href).catch(function (e) { delete scripts[k]; warn('[AccountHub] gagal memuat modul ' + src, e); });
        } else {
          scripts[k] = new Promise(function (res) {
            var s = D.createElement('script');
            s.src = src; s.async = false;
            s.onload = res;
            s.onerror = function () { delete scripts[k]; warn('[AccountHub] gagal memuat ' + src); res(); };
            D.head.appendChild(s);
          });
        }
      }
      return scripts[k];
    }));
  }
  function parse(html) {
    var doc = new G.DOMParser().parseFromString(html, 'text/html'), p = { css: [], js: [], mods: {}, html: '', cls: doc.body.className || '' };
    Array.prototype.forEach.call(doc.querySelectorAll('head link[rel~="stylesheet"]'), function (l) {
      var h = l.getAttribute('href');
      if (h && !SKIP_CSS.test(h.split('?')[0])) p.css.push(h);
    });
    Array.prototype.forEach.call(doc.querySelectorAll('head script[src], body script[src]'), function (s) {
      var src = s.getAttribute('src');
      if (!src || SKIP_JS.test(src.split('?')[0])) return;
      if ((s.getAttribute('type') || '').toLowerCase() === 'module') p.mods[src] = 1;
      p.js.push(src);
    });
    var stage = doc.getElementById('stage');
    if (stage) {
      Array.prototype.forEach.call(stage.querySelectorAll('script'), rm);
      p.html = stage.innerHTML;
    }
    return p;
  }
  function fetchPage(page) {
    if (pages[page]) return pages[page];
    return (pages[page] = G.fetch(page).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + page);
      return r.text();
    }).then(parse).catch(function (e) { delete pages[page]; throw e; }));
  }
  function getSource(tab) {
    if (tab.page) return fetchPage(tab.page);
    var tpl = D.getElementById('tpl-profil');
    if (!tpl) return Promise.reject(new Error('template Profil tidak ditemukan'));
    return Promise.resolve({ css: (tpl.getAttribute('data-css') || '').split(/\s+/).filter(Boolean), js: [], mods: {}, html: tpl.innerHTML, cls: 'pf' });
  }

  /* ================= open ================= */
  function open(env, url) {
    var UT = G.UT, PM = UT.PageModule, MK = UT.ModalKit;
    if (active) active.destroy();
    var stage = D.getElementById('stage');
    if (!stage || !PM) return null;

    var from = validFrom(param(url, 'from')), queryString = queryOf(url);
    var prevManaged = PM.managed;
    PM.managed = true;   // halaman mandiri: modul panel TIDAK boleh mount sendiri saat skripnya dimuat; hub yang memasangnya

    var disposed = false, closing = false, busy = false, want = null, cur = null, curKey = '';

    /* ---- kerangka halaman ---- */
    var hub = el('div', 'phub'); hub.setAttribute('role', 'region'); hub.setAttribute('aria-labelledby', 'phub-title');
    var frame = el('div', 'pmodal'); frame.setAttribute('aria-hidden', 'true');   // bingkai kartu halaman (nama id lama dipertahankan untuk CSS)
    var title = el('h2', 'phub-title', 'sr-only');
    var tabs = el('nav', 'ptabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Profil, Teman, Pesan, Peringkat, Misi, Pengaturan');
    var pane = el('div', 'pane'); pane.setAttribute('role', 'tabpanel'); pane.tabIndex = -1;
    var xbtn = el('button', 'pclose'); xbtn.type = 'button'; xbtn.setAttribute('aria-label', 'Tutup');
    var xi = D.createElement('img'); xi.src = 'assets/images/ui/buttons-and-controls/tombol-tutup-bulat.webp'; xi.alt = ''; xbtn.appendChild(xi);

    var tabBtns = {};
    TABS.forEach(function (t) {
      var b = el('button', 'ptab-' + t.key, 'ptab'); b.type = 'button'; b.dataset.k = t.key;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'pane'); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1;
      var ic = D.createElement('img'); ic.className = 'ic'; ic.src = t.icon; ic.alt = '';
      var sp = D.createElement('span'); sp.textContent = t.label;
      var ul = D.createElement('img'); ul.className = 'ul'; ul.src = IC + 'navigation-icons/garis-bawah-tab-emas.webp'; ul.alt = '';
      b.appendChild(ic); b.appendChild(sp); b.appendChild(ul);
      tabs.appendChild(b); tabBtns[t.key] = b;
    });
    [frame, title, tabs, pane, xbtn].forEach(function (n) { hub.appendChild(n); });
    stage.appendChild(hub);
    stage.classList.add('has-hub');

    /* ---- kartu PENUH selebar/setinggi layar: kanvas 1920x1080 diskalakan (k) dan dipusatkan; sisa layar di luar kanvas (layar lebih lebar/
       tinggi dari 16:9) dihitung dalam satuan kanvas lalu dipakai CSS (--hub-ex/--hub-ey) untuk melebarkan bingkai kartu ke tepi layar ---- */
    function fitFrame() {
      var vw = G.innerWidth || 1920, vh = G.innerHeight || 1080, k = Math.min(vw / 1920, vh / 1080) || 1;
      stage.style.setProperty('--hub-ex', Math.max(0, (vw / k - 1920) / 2).toFixed(1) + 'px');
      stage.style.setProperty('--hub-ey', Math.max(0, (vh / k - 1080) / 2).toFixed(1) + 'px');
    }
    fitFrame();
    /* transparansi panel (Pengaturan -> slider): 0% = pekat, maks 70%; disimpan di UT.Prefs 'panelTransparency' */
    function applyPanelAlpha() {
      try {
        var t = parseInt(UT.Prefs.get('panelTransparency', 16), 10);
        if (!isFinite(t)) t = 16;
        D.documentElement.style.setProperty('--panel-a', (1 - Math.max(0, Math.min(70, t)) / 100).toFixed(2));
      } catch (e) { /* abaikan */ }
    }
    applyPanelAlpha();
    var offPrefs = null;
    try { if (UT.Prefs && UT.Prefs.on) offPrefs = UT.Prefs.on(function (n) { if (n === 'panelTransparency') applyPanelAlpha(); }); } catch (e) { /* abaikan */ }
    G.addEventListener('resize', fitFrame);
    G.addEventListener('orientationchange', fitFrame);

    /* ---- util ---- */
    function dialogOpen() { return !!pane.querySelector('#md.on,#confirm.on,#lang.on,#frmd.on'); }
    function feedback() {
      try {
        var S = G.PlayerData && G.PlayerData.settings();
        if (S && S.sound && UT.Audio) UT.Audio.play('button');
        if (S && S.vibration && G.navigator.vibrate) G.navigator.vibrate(15);
      } catch (e) { /* abaikan */ }
    }
    function setActiveTab(key) {
      TABS.forEach(function (t) {
        var on = t.key === key, b = tabBtns[t.key];
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      pane.setAttribute('aria-labelledby', 'ptab-' + key);
      pane.setAttribute('data-tab', key);
      title.textContent = BY[key].label;
    }
    function syncUrl(key) {
      var u = hubUrl(key, from);
      try {
        if (UT.Spa && UT.Spa.viewActive) G.history.replaceState({ spa: u }, '', (G.location.pathname || 'play.html') + '?go=' + encodeURIComponent(u));
        else G.history.replaceState(G.history.state, '', u);
      } catch (e) { /* abaikan */ }
    }

    /* ---- panel: lepas & pasang ---- */
    function enhanceDialogs(rec) {
      DIALOGS.forEach(function (d) {
        var node = pane.querySelector(d[0]);
        if (!node) return;
        var box = node.querySelector('#box');
        if (box && !box.getAttribute('role')) { box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'mt'); }
        rec.watchers.push(MK.watch(node, {
          initialFocus: d[1],
          fallbackFocus: function () { return tabBtns[rec.key]; },
          skipInert: function (n) { return n.id === 'fade'; }
        }));
      });
    }
    function cleanup(rec) {
      rec.watchers.forEach(function (off) { try { off(); } catch (e) { /* abaikan */ } });
      rec.links.forEach(rm);
      rec.added.forEach(function (c) { D.body.classList.remove(c); });
    }
    function leave() {
      var rec = cur;
      if (!rec) return;
      cur = null; curKey = '';
      try { PM.unmount(rec.tab.module); } catch (e) { warn('[AccountHub] unmount gagal', e); }
      cleanup(rec);
      pane.textContent = '';
    }
    function enter(key) {
      var tab = BY[key];
      return getSource(tab).then(function (src) {
        if (disposed) return;
        var rec = { tab: tab, key: key, links: [], added: [], watchers: [] }, waits = [];
        src.css.forEach(function (href) {
          var l = D.createElement('link');
          l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-hub', key);
          waits.push(new Promise(function (r) { l.onload = l.onerror = r; G.setTimeout(r, 4000); }));
          D.head.appendChild(l); rec.links.push(l);
        });
        return Promise.all(waits).then(function () {
          if (disposed) { cleanup(rec); return; }
          pane.innerHTML = src.html;   // HTML dari halaman milik game sendiri (same-origin), bukan input pengguna
          String(src.cls || '').split(/\s+/).filter(Boolean).forEach(function (c) {
            if (!D.body.classList.contains(c)) { D.body.classList.add(c); rec.added.push(c); }
          });
          return loadScripts(src.js, src.mods);
        }).then(function () {
          if (disposed) { pane.textContent = ''; cleanup(rec); return; }
          cur = rec; curKey = key;
          enhanceDialogs(rec);
          try { if (UT.App && UT.App.setPage) UT.App.setPage(tab.app); } catch (e) { /* abaikan */ }
          try { PM.mount(tab.module); }
          catch (e) { leave(); throw e; }
        }).catch(function (e) { cleanup(rec); throw e; });
      });
    }
    function showError(key, err) {
      warn('[AccountHub] panel gagal dimuat: ' + key, err);
      pane.textContent = '';
      var box = el('div', null, 'perr'); box.setAttribute('role', 'alert');
      var msg = D.createElement('p'); msg.textContent = 'Gagal memuat ' + BY[key].label + '.';
      var btn = D.createElement('button'); btn.type = 'button'; btn.className = 'perr-btn'; btn.textContent = 'Coba lagi';
      btn.addEventListener('click', function () { select(key, true); });
      box.appendChild(msg); box.appendChild(btn); pane.appendChild(box);
      btn.focus({ preventScroll: true });
    }

    /* satu transisi pada satu waktu; permintaan baru saat sibuk diambil yang terakhir */
    function select(key, silent) {
      if (disposed || !BY[key]) return;
      if (!busy && curKey === key && cur) return;
      want = key;
      if (busy) return;
      busy = true;
      (function next() {
        var k = want; want = null;
        if (!k || disposed || (curKey === k && cur)) { busy = false; pane.classList.remove('loading'); pane.removeAttribute('aria-busy'); return; }
        if (!silent) feedback();
        silent = true;
        setActiveTab(k);
        pane.classList.add('loading'); pane.setAttribute('aria-busy', 'true');
        leave();
        enter(k).then(function () { if (!disposed) syncUrl(k); }, function (e) { if (!disposed) showError(k, e); })
          .then(function () { if (want) next(); else { busy = false; pane.classList.remove('loading'); pane.removeAttribute('aria-busy'); } });
      })();
    }

    /* ---- kembali ke halaman asal ---- */
    function close() {
      if (closing || disposed) return;
      closing = true;
      feedback();
      var to = homeUrl(url, D.referrer, G.location.origin);
      if (UT.Spa && UT.Spa.go) { UT.Spa.go(to); G.setTimeout(function () { closing = false; }, 1500); }
      else {
        var f = D.getElementById('fade'); if (f) f.classList.add('on');
        G.setTimeout(function () { G.location.href = to; }, 330);
      }
    }
    /* ---- pendengar ---- */
    function onKeydown(e) {
      if (disposed) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (e.defaultPrevented || dialogOpen()) return;   // dialog dalam panel menutup dirinya dulu (logikanya milik panel)
        e.preventDefault(); close();
      }
    }
    function onTabsKey(e) {
      var i = TABS.findIndex(function (t) { return t.key === curKey || (!curKey && tabBtns[t.key].tabIndex === 0); }), n = TABS.length, j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      if (j < 0) return;
      e.preventDefault();
      tabBtns[TABS[j].key].focus({ preventScroll: true });
      select(TABS[j].key);
    }
    TABS.forEach(function (t) { tabBtns[t.key].addEventListener('click', function () { select(t.key); }); });
    tabs.addEventListener('keydown', onTabsKey);
    xbtn.addEventListener('click', close);
    D.addEventListener('keydown', onKeydown, true);

    function destroy() {
      if (disposed) return;
      leave();
      disposed = true;
      D.removeEventListener('keydown', onKeydown, true);
      G.removeEventListener('resize', fitFrame);
      G.removeEventListener('orientationchange', fitFrame);
      if (offPrefs) { try { offPrefs(); } catch (e) { /* abaikan */ } }
      stage.style.removeProperty('--hub-ex'); stage.style.removeProperty('--hub-ey');
      rm(hub);
      stage.classList.remove('has-hub');
      PM.managed = prevManaged;
      if (active === inst) active = null;
    }

    var inst = { select: select, close: close, destroy: destroy, query: function () { return queryString; }, key: function () { return curKey; } };
    active = inst;
    if (env && typeof env.own === 'function') env.own(destroy);

    var first = tabOf(url);
    setActiveTab(first);
    select(first, true);
    /* fokus awal: tab aktif */
    G.requestAnimationFrame(function () { if (!disposed && tabBtns[first]) tabBtns[first].focus({ preventScroll: true }); });
    return inst;
  }
  api.open = open;
  api.handle = function (url) {   // dipanggil UT.Spa.go: pindah tab di tempat alih-alih memuat ulang halaman
    if (!active) return false;
    var p = pageOf(url);
    if (!PAGE_TAB[p]) return false;
    active.select(tabOf(canon(url)));
    return true;
  };
  api.query = function () { return active ? active.query() : ''; };
  api.active = function () { return active; };
  return api;
});
