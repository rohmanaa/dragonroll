/* SPA Host (tahap 2) — shell play.html merender halaman "view" (Lobby, Karakter) langsung di #view tanpa iframe,
   sehingga pindah Lobby <-> Karakter tidak memuat ulang dokumen, three.min.js, maupun membuat konteks WebGL baru.
   Halaman lain tetap berjalan di <iframe id="f"> (jalur lama) sampai tahap 3.

   API (UT.Spa):
     mount({frame, view, hooks}) -> pasang shell (dipanggil play.js)          hooks: { leave(kind), ready(name, isView) }
     start(url)                  -> true bila url dirender sebagai view; false = pemanggil memuat url di iframe
     go(url, opts)               -> pindah rute; view atau iframe. opts: {replace, history:'none', kind}
     canView(url) · viewName(url) · viewActive · page · current()
   Syarat view: halaman terdaftar (VIEWS), sudah lewat splash + login (sama dengan boot-guard), bukan ?noframe=1, bukan ?from=room,
   dan viewport tidak sedang diputar (HP portrait: play.html memutar iframe 90°, trik itu tidak bisa dipakai untuk view -> tetap iframe).
   Skrip klasik; dapat dimuat di browser (window.UT.Spa) maupun Node (module.exports) untuk tes; create(deps) menerima stub. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Spa = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var VIEWS = { 'lobby.html': 'lobby', 'karakter.html': 'karakter', 'profile.html': 'profile', 'tambang.html': 'tambang', 'friendship.html': 'friendship', 'shop.html': 'shop', 'mode.html': 'mode', 'hadiah-misi.html': 'hadiah-misi', 'mail.html': 'mail', 'settings.html': 'settings', 'leaderboard.html': 'leaderboard', 'room.html': 'room', 'inventory.html': 'inventory', 'pet.html': 'pet', 'frame.html': 'frame', 'efek.html': 'efek', 'dadu.html': 'dadu' };
    var HUB_TABS = { 'friendship.html': 'teman', 'mail.html': 'pesan', 'settings.html': 'setelan' };   // halaman yang kini panel di hub profile.html
    var INV_VIEW_TABS = { frame: 'frame.html', dadu: 'dadu.html', efek: 'efek.html', pet: 'pet.html' };   // tab Inventory yang sudah jadi view (sinkron dengan UT.InvTabs.VIEW_TABS)
  var BASE_CSS = ['assets/css/common.css'];                       // halaman biasa memuat ini lewat UT.PageShell.renderBase()
  var SKIP_JS = /(^|\/)(page-shell|hub-redirect|room-modal-bridge|inventory-bridge|frame-guard|boot-guard)\.js$/;
  var ROTATED = '(orientation:portrait) and (pointer:coarse)';    // sama dengan aturan rotasi di play.css

  function pageOf(url) {
    var m = /^([A-Za-z0-9_-]+\.html)(?:[?#]|$)/.exec(String(url || ''));
    return m ? m[1] : '';
  }
  function viewName(url) { return VIEWS[pageOf(url)] || null; }

  /* ================= loader browser: ambil HTML halaman, pasang CSS/DOM/skrip ================= */
  function makeLoader(G) {
    var D = G.document, cache = {}, scripts = Object.create(null);

    function key(src) { try { return new G.URL(src, G.location.href).pathname; } catch (e) { return src; } }
    Array.prototype.forEach.call(D.scripts || [], function (s) { if (s.src) scripts[key(s.src)] = Promise.resolve(); });

    function parse(html) {
      var doc = new G.DOMParser().parseFromString(html, 'text/html');
      var p = { css: [], styles: [], js: [], mods: {}, sbg: null, html: '', cls: '', title: doc.title || '' };
      Array.prototype.forEach.call(doc.querySelectorAll('head link[rel~="stylesheet"], head style, head script[src], body script[src]'), function (el) {
        var tag = el.tagName;
        if (tag === 'LINK') { p.css.push(el.getAttribute('href')); return; }
        if (tag === 'STYLE') { p.styles.push(el.textContent); return; }
        var src = el.getAttribute('src');
        if (SKIP_JS.test(src.split('?')[0])) return;
        if (/(^|\/)scene-bg\.js$/.test(src.split('?')[0]) && el.hasAttribute('data-auto')) {
          var c = { preset: el.getAttribute('data-preset') || 'full' };
          [['data-lights', 'lights'], ['data-clouds-set', 'cloudSet'], ['data-cloud-slow', 'cloudSlow'], ['data-image', 'image'], ['data-image-day', 'imageDay'], ['data-image-night', 'imageNight']].forEach(function (a) {
            if (el.getAttribute(a[0])) c[a[1]] = el.getAttribute(a[0]);
          });
          p.sbg = c;
        }
        if ((el.getAttribute('type') || '').toLowerCase() === 'module') p.mods[src] = 1;   // ES module: dimuat lewat import(), bukan <script> klasik
        p.js.push(src);
      });
      Array.prototype.forEach.call(doc.body.querySelectorAll('script'), function (s) { s.parentNode.removeChild(s); });
      p.html = doc.body.innerHTML;
      p.cls = doc.body.className || '';
      return p;
    }

    function fetchPage(page) {
      if (cache[page]) return Promise.resolve(cache[page]);
      return G.fetch(page).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + page);
        return r.text();
      }).then(function (html) { return (cache[page] = parse(html)); });
    }

    function inDoc(k) {   // skrip yang sudah ada di dokumen (mis. dimuat dinamis oleh halaman) tidak diunduh ulang
      return Array.prototype.some.call(D.scripts || [], function (s) { return s.src && key(s.src) === k; });
    }

    function loadScripts(list, mods) {
      var ps = [];
      mods = mods || {};
      list.forEach(function (src) {
        var k = key(src);
        if (!scripts[k] && mods[src]) {
          scripts[k] = import(new G.URL(src, G.location.href).href).catch(function (e) {
            delete scripts[k]; if (G.console) console.warn('[Spa] gagal memuat modul', src, e);
          });
        } else if (!scripts[k] && inDoc(k)) {
          scripts[k] = Promise.resolve();
        }
        if (!scripts[k]) {
          scripts[k] = new Promise(function (res) {
            var s = D.createElement('script');
            s.src = src; s.async = false;                  // unduh paralel, eksekusi berurutan
            s.onload = res;
            s.onerror = function () { delete scripts[k]; if (G.console) console.warn('[Spa] gagal memuat', src); res(); };
            D.head.appendChild(s);
          });
        }
        ps.push(scripts[k]);
      });
      return Promise.all(ps);
    }

    /* enter: pasang CSS (tunggu siap) -> DOM -> skrip. Hasil: fungsi leave() yang melepas CSS/DOM/kelas body/latar. */
    function enter(name, url, view) {
      return fetchPage(pageOf(url)).then(function (p) {
        var nodes = [], waits = [], added = [], sbg = null;
        BASE_CSS.concat(p.css).forEach(function (href) {
          var l = D.createElement('link');
          l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-spa', name);
          waits.push(new Promise(function (r) { l.onload = l.onerror = r; G.setTimeout(r, 4000); }));
          D.head.appendChild(l); nodes.push(l);
        });
        p.styles.forEach(function (css) {
          var s = D.createElement('style'); s.setAttribute('data-spa', name); s.textContent = css;
          D.head.appendChild(s); nodes.push(s);
        });
        function leave() {
          if (sbg && sbg.destroy) { try { sbg.destroy(); } catch (e) { /* abaikan */ } }
          view.innerHTML = '';
          added.forEach(function (c) { D.body.classList.remove(c); });
          nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        }
        return Promise.all(waits).then(function () {
          view.innerHTML = p.html;
          (p.cls || '').split(/\s+/).filter(Boolean).forEach(function (c) { if (!D.body.classList.contains(c)) { D.body.classList.add(c); added.push(c); } });
          return loadScripts(p.js, p.mods);
        }).then(function () {
          if (p.sbg && G.UT && G.UT.SceneBG) sbg = G.UT.SceneBG.mount(view, p.sbg);
          if (p.title) D.title = p.title;
          return leave;
        });
      });
    }
    /* prepare: siapkan halaman SEBELUM dibuka (ambil+parse HTML, unduh+jalankan skrip). Aman: skrip halaman hanya mendefinisikan modul
       (PageModule.managed=true -> tidak mount); DOM dan CSS baru dipasang saat enter(). */
    function prepare(page) {
      return fetchPage(page).then(function (p) { return loadScripts(p.js, p.mods); });
    }
    return { enter: enter, prepare: prepare };
  }

  /* ================= host ================= */
  function create(deps) {
    deps = deps || {};
    var G = deps.G || (typeof window !== 'undefined' ? window : globalThis);
    var UT = function () { return G.UT || {}; };
    var PM = function () { return deps.PageModule || UT().PageModule; };
    var GL = function () { return deps.SharedGL || UT().SharedGL; };

    var frame = null, view = null, hooks = {}, loader = deps.loader || null, frameUrl = null;
    var navId = 0, current = null, initialUrl = '', broken = {};   // broken: halaman yang gagal jadi view -> selamanya lewat iframe (cegah loop frame-guard)
    var api = { viewActive: false, page: '' };

    function warn(msg, e) { try { (G.console || console).error(msg, e); } catch (_) { /* abaikan */ } }

    function supported() {
      try { if (G.matchMedia && G.matchMedia(ROTATED).matches) return false; } catch (e) { /* abaikan */ }
      try {
        if (/[?&]noframe=1/.test(G.location.search || '')) return false;
        if (G.sessionStorage.getItem('ut:booted') !== '1') return false;               // sama dengan boot-guard
        if (!(UT().Session && UT().Session.loggedIn())) return false;
      } catch (e) { return false; }
      return true;
    }
    function canView(url) { return !!viewName(url) && !broken[pageOf(url)] && !/[?&]from=room(&|$)/.test(String(url)) && supported(); }

    /* fade-in sinematik setelah splash (flag ut:fadein): logikanya ada di boot-guard.js; di halaman iframe ia jalan sendiri, di view dipanggil di sini */
    function playFadeIn() {
      try {
        if (!G.document || G.sessionStorage.getItem('ut:fadein') !== '1') return;
        var s = G.document.createElement('script'); s.src = 'assets/js/boot-guard.js'; G.document.head.appendChild(s);
      } catch (e) { /* abaikan */ }
    }

    function frameName() {
      try { return (frame.contentWindow.location.pathname.split('/').pop() || ''); } catch (e) { return ''; }
    }
    function blankFrame() {
      if (!frame) return;
      try { if (frame.contentWindow.location.href !== 'about:blank') frame.contentWindow.location.replace('about:blank'); }
      catch (e) { try { frame.src = 'about:blank'; } catch (_) { /* abaikan */ } }
    }
    function showFrame(on) { if (frame) frame.classList.toggle('off', !on); }
    function showView(on) { if (view) view.hidden = !on; }

    function pushHistory(url, opts) {
      if (opts.history === 'none') return;
      var nested = /[?&]nested=1(&|$)/.test(G.location.search || '');
      var link;
      if (G.UT && G.UT.PrettyUrl && G.UT.PrettyUrl.shouldUsePretty()) {
        var page = pageOf(url);
        var token = G.UT.PrettyUrl.getToken();
        var uuid = G.UT.PrettyUrl.genUuid();
        link = G.UT.PrettyUrl.buildUrl(page, token, uuid);
        if (nested) link += '?nested=1';
      } else {
        link = (G.location.pathname || 'play.html') + '?' + (nested ? 'nested=1&' : '') + 'go=' + encodeURIComponent(url);
      }
      try {
        if (opts.replace) G.history.replaceState({ spa: url }, '', link);
        else G.history.pushState({ spa: url }, '', link);
      } catch (e) { /* abaikan */ }
    }

    /* lepas view aktif: unmount modul -> lepas renderer bersama -> buang CSS/DOM halaman */
    function teardown() {
      var c = current;
      if (!c) return;
      current = null;
      try { PM().unmount(c.name); } catch (e) { warn('[Spa] unmount gagal', e); }
      try { GL().release(c.name); } catch (e) { warn('[Spa] release GL gagal', e); }
      try { c.leave(); } catch (e) { warn('[Spa] leave gagal', e); }
      showView(false);
    }

    function enterFrame(url) {
      api.viewActive = false; api.page = pageOf(url);
      showFrame(true);
      if (!frame) return;
      var u = frameUrl ? frameUrl(url) : url;   // HP portrait: iframe memuat shell bersarang (play.html?nested=1&go=...)
      try { frame.contentWindow.location.replace(u); } catch (e) { frame.src = u; }   // replace: tidak menambah riwayat sendiri
    }

    function enterView(name, url, id) {
      api.viewActive = true; api.page = pageOf(url);
      blankFrame(); showFrame(false);
      if (!loader) loader = makeLoader(G);
      return loader.enter(name, url, view).then(function (leave) {
        if (id !== navId) { leave(); return; }
        current = { name: name, url: url, leave: leave };
        showView(true);
        var A = UT().App;
        if (A) { if (!A.ready) A.init({ page: name }); else if (A.setPage) A.setPage(name); }
        PM().mount(name);
        playFadeIn();
        if (hooks.ready) hooks.ready(name, true);
      }).catch(function (e) {
        if (id !== navId) return;
        warn('[Spa] view gagal, pakai iframe', e);
        broken[pageOf(url)] = 1;
        teardown();
        enterFrame(url);
      });
    }

    /* inventory.html bagi tab yang sudah jadi view (Pet) = langsung view-nya: tab dari ?tab=, atau tab terakhir (sessionStorage) bila tanpa ?tab= */
    /* Profil · Teman · Pesan · Pengaturan = SATU halaman (hub profile.html, modul 'profile'): friendship/mail/settings.html dialihkan ke
       profile.html?tab=... (mempertahankan ?from=). Sinkron dengan UT.AccountHub.canon. */
    function hubCanon(url) {
      var tab = HUB_TABS[pageOf(url)];
      if (!tab) return url;
      var m = /[?&]from=([^&#]*)/.exec(String(url));
      return 'profile.html?tab=' + tab + (m ? '&from=' + m[1] : '');
    }
    function canon(url) {
      url = hubCanon(url);
      if (pageOf(url) !== 'inventory.html') return url;
      var m = /[?&]tab=([a-z]+)/.exec(String(url)), tab = m ? m[1] : '';
      /* tab terakhir yang diingat TIDAK dipakai lagi: Inventory kini hanya Power-up/Ore/Log (bukan view); tombol Inventory selalu membuka inventory.html */
      var pg = INV_VIEW_TABS[tab];
      return pg && !broken[pg] && canView(pg) ? pg : url;
    }

    function go(url, opts) {
      opts = opts || {};
      url = canon(url);
      /* hub Profil/Teman/Pesan/Pengaturan sudah terbuka: pindah tab DI TEMPAT (tanpa teardown, fade, atau memuat ulang view) */
      if (current && current.name === 'profile' && (pageOf(url) === 'profile.html' || HUB_TABS[pageOf(url)])) {
        var H = UT().AccountHub;
        if (H && H.handle && H.handle(url)) return Promise.resolve(true);
      }
      var id = ++navId, name = viewName(url), toView = !!name && canView(url);
      if (hooks.leave) hooks.leave(opts.kind || 'delay');
      pushHistory(url, opts);
      teardown();
      if (!toView) { enterFrame(url); return Promise.resolve(false); }
      return enterView(name, url, id).then(function () { return true; });
    }

    function start(url) {
      initialUrl = url;
      try { G.history.replaceState({ spa: url }, ''); } catch (e) { /* abaikan */ }
      if (!canView(url)) return false;
      go(url, { history: 'none', kind: 'quiet' });
      return true;
    }

    function install(o) {
      frame = o.frame; view = o.view; hooks = o.hooks || {}; frameUrl = typeof o.frameUrl === 'function' ? o.frameUrl : null;
      if (PM()) PM().managed = true;
      G.addEventListener('popstate', function (e) {
        var u = e.state && e.state.spa;
        if (u) go(u, { history: 'none' });
      });
      try {
        var mq = G.matchMedia(ROTATED), onRot = function () { if (api.viewActive && current && !canView(current.url)) go(current.url, { history: 'none', kind: 'quiet' }); };
        if (mq.addEventListener) mq.addEventListener('change', onRot); else if (mq.addListener) mq.addListener(onRot);
      } catch (e) { /* abaikan */ }
    }

    /* preload(url): siapkan view di latar (idle) agar saat dibuka tinggal pasang DOM+mount. Mengembalikan Promise<boolean>. */
    var prepared = Object.create(null);
    function preload(url) {
      var name = viewName(url), pg = pageOf(url);
      if (!name || !canView(url) || prepared[pg]) return Promise.resolve(false);
      prepared[pg] = 1;
      if (!loader) loader = makeLoader(G);
      if (!loader.prepare) return Promise.resolve(false);
      return loader.prepare(pg).then(function () { return true; }, function (e) { delete prepared[pg]; warn('[Spa] preload gagal ' + pg, e); return false; });
    }

    api.mount = install;
    api.preload = preload;
    api.start = start;
    api.go = go;
    api.canView = canView;
    api.viewName = viewName;
    api.pageOf = pageOf;
    api.canon = canon;
    api.current = function () { return current ? { name: current.name, url: current.url } : null; };
    api.initialUrl = function () { return initialUrl; };
    return api;
  }

  var api = create();
  api.create = create;
  api.pageOf = pageOf;
  api.viewName = viewName;
  return api;
});
