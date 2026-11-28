/* UT.ModalKit — perilaku modal yang SUNGGUHAN (bukan sekadar tampilan).
   Dialog di game ini dibuka/ditutup dengan menyalakan kelas `.on` pada kontainernya. ModalKit.watch() mengamati kelas itu dan otomatis memberi:
     - fokus pindah ke dalam dialog saat dibuka (dan dikembalikan ke pemicunya saat ditutup),
     - Tab/Shift+Tab terkunci di dalam dialog (focus trap),
     - semua elemen di luar dialog diberi `inert` (tidak bisa difokus/diklik/dibaca pembaca layar) selama terbuka,
     - aria-hidden mengikuti status buka/tutup, serta role="dialog" + aria-modal bila belum ada.
   Tidak mengubah logika buka/tutup milik halaman: halaman tetap hanya menambah/melepas `.on`.
   Skrip klasik; helper murni dapat dimuat di Node (module.exports) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.ModalKit = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex^="-"])';
  var SKIP_TAG = { SCRIPT: 1, LINK: 1, STYLE: 1, TEMPLATE: 1 };

  function isVisible(n) {
    return !!(n && (n.offsetWidth || n.offsetHeight || (n.getClientRects && n.getClientRects().length)));
  }

  /* elemen yang bisa difokus di dalam root (hanya yang tampak) */
  function focusables(root) {
    if (!root || !root.querySelectorAll) return [];
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (n) {
      var ti = n.getAttribute('tabindex');
      if (ti !== null && Number(ti) < 0) return false;   // di luar urutan Tab (mis. tab non-aktif pada roving tabindex)
      return !n.hidden && !n.closest('[inert]') && isVisible(n);
    });
  }

  /* kunci Tab di dalam root. Mengembalikan true bila event ditangani. */
  function trapTab(e, root, doc) {
    if (!e || e.key !== 'Tab' || !root) return false;
    doc = doc || (typeof document !== 'undefined' ? document : null);
    var list = focusables(root), active = doc && doc.activeElement;
    if (!list.length) { e.preventDefault(); if (root.focus) root.focus(); return true; }
    var first = list[0], last = list[list.length - 1];
    if (!active || !root.contains(active)) { e.preventDefault(); first.focus(); return true; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); return true; }
    if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); return true; }
    return false;
  }

  /* beri `inert` pada semua saudara di sepanjang jalur el -> body. opts.skip(node) = true: jangan di-inert.
     Mengembalikan fungsi pemulih (hanya mencabut inert yang DIA pasang). */
  function inertOthers(el, opts) {
    opts = opts || {};
    var touched = [], node = el, body = el.ownerDocument.body, html = el.ownerDocument.documentElement;
    while (node && node !== body && node !== html) {
      var parent = node.parentNode;
      if (!parent) break;
      Array.prototype.forEach.call(parent.children || [], function (sib) {
        if (sib === node || SKIP_TAG[sib.tagName] || sib.hasAttribute('inert')) return;
        if (typeof opts.skip === 'function' && opts.skip(sib)) return;
        sib.setAttribute('inert', '');
        touched.push(sib);
      });
      node = parent;
    }
    return function restore() {
      touched.forEach(function (s) { s.removeAttribute('inert'); });
      touched = [];
    };
  }

  /* pasang perilaku modal pada kontainer dialog `el` yang dibuka lewat kelas `.on`.
     opts: initialFocus (selector), fallbackFocus() -> elemen bila pemicu sudah hilang, skipInert(node), openClass (default 'on'),
           role (default 'dialog'), labelledBy (id), onOpen(), onClose(). Mengembalikan fungsi dispose(). */
  function watch(el, opts) {
    opts = opts || {};
    if (!el) return function () {};
    var doc = el.ownerDocument, win = doc.defaultView, cls = opts.openClass || 'on';
    var opened = false, opener = null, undo = null, raf = 0;

    /* semantik dialog: role/aria-modal ditaruh pada kontainer bila tidak ada elemen ber-role dialog di dalamnya */
    var hasRole = el.getAttribute('role') === 'dialog' || !!el.querySelector('[role="dialog"]');
    if (!hasRole) {
      el.setAttribute('role', opts.role || 'dialog');
      el.setAttribute('aria-modal', 'true');
    }
    var lab = opts.labelledBy ? doc.getElementById(opts.labelledBy) : null;
    if (lab && !el.getAttribute('aria-labelledby') && !hasRole) el.setAttribute('aria-labelledby', opts.labelledBy);

    function open() {
      if (opened) return;
      opened = true;
      opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
      el.removeAttribute('aria-hidden');
      undo = inertOthers(el, { skip: opts.skipInert });
      var target = (opts.initialFocus && el.querySelector(opts.initialFocus)) || focusables(el)[0] || el;
      if (target === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      /* tunggu satu frame: kontainer baru saja berpindah dari display:none, fokus sebelum tampak akan gagal */
      raf = win.requestAnimationFrame(function () {
        raf = 0;
        if (!opened || !target.focus) return;
        if (el.contains(doc.activeElement) && doc.activeElement !== el) return;   // halaman sudah memfokuskan sesuatu di dalam dialog (mis. input): jangan direbut
        target.focus({ preventScroll: true });
      });
      if (typeof opts.onOpen === 'function') { try { opts.onOpen(el); } catch (e) { /* abaikan */ } }
    }

    function close() {
      if (!opened) return;
      opened = false;
      if (raf) { win.cancelAnimationFrame(raf); raf = 0; }
      if (undo) { undo(); undo = null; }
      el.setAttribute('aria-hidden', 'true');
      var back = opener; opener = null;
      if (!back || !back.isConnected || (back.closest && back.closest('[inert]'))) back = typeof opts.fallbackFocus === 'function' ? opts.fallbackFocus() : null;
      if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
      if (typeof opts.onClose === 'function') { try { opts.onClose(el); } catch (e) { /* abaikan */ } }
    }

    function sync() { if (el.classList.contains(cls)) open(); else close(); }
    function onKey(e) { if (opened) trapTab(e, el, doc); }

    el.addEventListener('keydown', onKey);
    var mo = new win.MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    if (!el.classList.contains(cls)) el.setAttribute('aria-hidden', 'true');
    sync();

    return function dispose() {
      mo.disconnect();
      el.removeEventListener('keydown', onKey);
      if (raf) { win.cancelAnimationFrame(raf); raf = 0; }
      if (undo) { undo(); undo = null; }
      opened = false;
    };
  }

  return { FOCUSABLE: FOCUSABLE, focusables: focusables, trapTab: trapTab, inertOthers: inertOthers, watch: watch };
});
