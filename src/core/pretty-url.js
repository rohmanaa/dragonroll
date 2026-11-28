/* Pretty URL helper (kosmetik saja, bukan kunci keamanan).
   Format: /<token>/<halaman>/<uuid>
   - token: 20 karakter [a-z0-9], dibuat sekali per sesi tab (sessionStorage)
   - halaman: slug dari parameter go tanpa .html (dari registry SPA)
   - uuid: v4 baru tiap pindah halaman (crypto.randomUUID, fallback manual)
   HANYA aktif di http/https. Di Electron/file:// perilaku lama tidak berubah. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.PrettyUrl = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* DIMATIKAN (keputusan pemilik): pretty URL bermasalah, semua halaman memakai URL biasa (.html / ?go=).
     Nyalakan lagi dengan ENABLED = true (atau UT.PrettyUrl.setEnabled(true) untuk tes). */
  var ENABLED = false;
  var TOKEN_KEY = 'ut:pretty:token';
  var VALID_PAGES = {
    'lobby.html': 'lobby',
    'karakter.html': 'karakter',
    'profile.html': 'profile',
    'tambang.html': 'tambang',
    'friendship.html': 'friendship',
    'shop.html': 'shop',
    'mode.html': 'mode',
    'hadiah-misi.html': 'hadiah-misi',
    'mail.html': 'mail',
    'settings.html': 'settings',
    'leaderboard.html': 'leaderboard',
    'room.html': 'room',
    'inventory.html': 'inventory',
    'pet.html': 'pet',
    'frame.html': 'frame',
    'efek.html': 'efek',
    'dadu.html': 'dadu',
    'splash.html': 'splash',
    'gameplay.html': 'gameplay',
    'powerup.html': 'powerup'
  };

  var SLUG_TO_PAGE = {
    'lobby': 'lobby.html',
    'karakter': 'karakter.html',
    'profile': 'profile.html',
    'tambang': 'tambang.html',
    'friendship': 'friendship.html',
    'shop': 'shop.html',
    'mode': 'mode.html',
    'hadiah-misi': 'hadiah-misi.html',
    'mail': 'mail.html',
    'settings': 'settings.html',
    'leaderboard': 'leaderboard.html',
    'room': 'room.html',
    'inventory': 'inventory.html',
    'pet': 'pet.html',
    'frame': 'frame.html',
    'efek': 'efek.html',
    'dadu': 'dadu.html',
    'splash': 'splash.html',
    'gameplay': 'gameplay.html',
    'powerup': 'powerup.html'
  };

  function getLocation() {
    try { return location; } catch (e) { return null; }
  }

  function isHttp(loc) {
    if (!ENABLED) return false;
    loc = loc || getLocation();
    if (!loc) return false;
    try { return loc.protocol === 'http:' || loc.protocol === 'https:'; } catch (e) { return false; }
  }

  function getSessionStorage() {
    try { return sessionStorage; } catch (e) { return null; }
  }

  function getToken(loc) {
    if (!isHttp(loc)) return null;
    var ss = getSessionStorage();
    try {
      if (ss) {
        var t = ss.getItem(TOKEN_KEY);
        if (t && /^[a-z0-9]{20}$/.test(t)) return t;
      }
    } catch (e) {}
    var newToken = genToken();
    try { if (ss) ss.setItem(TOKEN_KEY, newToken); } catch (e) {}
    return newToken;
  }

  function genToken() {
    var arr = new Uint8Array(15);
    try { crypto.getRandomValues(arr); } catch (e) { for (var i = 0; i < 15; i++) arr[i] = Math.floor(Math.random() * 256); }
    var out = '';
    for (var i = 0; i < 15; i++) out += arr[i].toString(36).padStart(2, '0');
    return out.slice(0, 20);
  }

  function genUuid() {
    try { return crypto.randomUUID(); } catch (e) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }

  function pageToSlug(page) {
    return VALID_PAGES[page] || page.replace(/\.html$/, '');
  }

  function slugToPage(slug) {
    return SLUG_TO_PAGE[slug] || (slug + '.html');
  }

  function parse(pathname, loc) {
    if (!isHttp(loc)) return null;
    var m = /^\/([a-z0-9]{20})\/([a-z0-9-]+)\/([0-9a-f-]{36})(?:\/|$)/.exec(pathname || '');
    if (!m) return null;
    var page = slugToPage(m[2]);
    if (!VALID_PAGES[page]) return null;
    return { token: m[1], page: page, uuid: m[3], slug: m[2] };
  }

  function buildUrl(page, token, uuid, loc) {
    if (!isHttp(loc)) return null;
    var slug = pageToSlug(page);
    if (!token) token = getToken(loc);
    if (!uuid) uuid = genUuid();
    return '/' + token + '/' + slug + '/' + uuid + '/';
  }

  function getGoFromUrl(loc) {
    loc = loc || getLocation();
    var parsed = parse(loc && loc.pathname, loc);
    if (parsed) return parsed.page;
    try {
      var q = new URLSearchParams(loc && loc.search || '').get('go');
      if (q && VALID_PAGES[q]) return q;
    } catch (e) {}
    return 'splash.html';
  }

  function shouldUsePretty(loc) {
    return isHttp(loc);
  }

  return {
    getToken: getToken,
    genToken: genToken,
    genUuid: genUuid,
    pageToSlug: pageToSlug,
    slugToPage: slugToPage,
    parse: parse,
    buildUrl: buildUrl,
    getGoFromUrl: getGoFromUrl,
    shouldUsePretty: shouldUsePretty,
    setEnabled: function (v) { ENABLED = !!v; },
    isEnabled: function () { return ENABLED; },
    VALID_PAGES: VALID_PAGES,
    SLUG_TO_PAGE: SLUG_TO_PAGE
  };
});