/* game-dialog.js — dialog bergaya game yang dipakai bersama (modal "Unduh Data", modal "Ketentuan Layanan").
   Skrip klasik. Gaya: assets/css/components/game-dialog.css (dimuat otomatis di samping skrip ini bila belum ada).
   Semua teks lewat textContent (tanpa HTML string).

     var d = UT.GameDialog.open({
       title: 'Unduh Data', message: '...', sub: '...', badge: '40.5MB', progress: null,   // progress: null = sembunyi, 0..1 = tampil
       closable: true,                                                                      // tombol X + Escape
       buttons: [{ label: 'Unduh', tone: 'blue', onClick: function (d) {...}, keepOpen: true }],  // tone: blue | green | yellow | red
       onClose: function () {}
     });
     d.set({ message, sub, badge, progress, title, closable, buttons })   // ubah sebagian isi
     d.close();  d.isOpen();  d.el  */
(function (G) {
  'use strict';
  var UT = G.UT = G.UT || {};
  if (UT.GameDialog) return;
  var D = G.document;
  /* warna tombol = komponen .ut-gl (button.css), tanpa gambar */
  var BTN = { blue: 'ut-c-b', green: 'ut-c-g', yellow: 'ut-c-y', red: 'ut-c-r' };
  var CSS_ID = 'gd-css', SELF = (D && D.currentScript && D.currentScript.src) || '';
  var open = [];

  function ensureCss() {
    if (!D || D.getElementById(CSS_ID)) return;
    /* gaya modal kit (.ut-mk) + tombol (.ut-gl) dimuat dulu bila halaman belum memuatnya, lalu game-dialog.css */
    function link(id, rel) { if (D.getElementById(id)) return; var l = D.createElement('link'); l.rel = 'stylesheet'; l.id = id; l.href = SELF ? new G.URL(rel, SELF).href : rel.replace(/^(\.\.\/)+/, 'assets/'); D.head.appendChild(l); }
    if (!D.querySelector('link[href*="modal-kit.css"]')) link('gd-kit-css', '../../components/modal/modal-kit.css');
    if (!D.querySelector('link[href*="button/button.css"]')) link('gd-btn-css', '../../components/button/button.css');
    link(CSS_ID, '../../css/components/game-dialog.css');
  }
  function el(tag, cls, text) { var n = D.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function create(opts) {
    opts = opts || {};
    ensureCss();
    var st = { closable: opts.closable !== false, buttons: [] };
    var ov = el('div', 'gd-ov'), dlg = el('div', 'gd-dlg ut-mk');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var head = el('div', 'gd-head ut-mk-t'), x = el('button', 'gd-x ut-mk-x ut-gl ut-c-r'); x.type = 'button'; x.setAttribute('aria-label', 'Tutup');
    var body = el('div', 'gd-body'), msg = el('p', 'gd-msg'), sub = el('p', 'gd-sub'), badge = el('div', 'gd-badge');
    var bar = el('div', 'gd-bar'), fill = el('i'); bar.appendChild(fill);
    var btns = el('div', 'gd-btns');
    body.appendChild(msg); body.appendChild(sub); body.appendChild(badge); body.appendChild(bar); body.appendChild(btns);
    dlg.appendChild(head); dlg.appendChild(x); dlg.appendChild(body); ov.appendChild(dlg);
    var isOpen = false, closedCb = typeof opts.onClose === 'function' ? opts.onClose : null, prevFocus = null;

    function setButtons(list) {
      st.buttons = list || []; btns.textContent = '';
      st.buttons.forEach(function (b) {
        var n = el('button', 'gd-btn ut-gl ' + (BTN[b.tone] || BTN.blue)); n.type = 'button'; n.disabled = !!b.disabled;
        n.appendChild(el('span', '', b.label || ''));
        n.addEventListener('click', function () { if (n.disabled) return; if (typeof b.onClick === 'function') b.onClick(api); if (!b.keepOpen) api.close(); });
        btns.appendChild(n);
      });
    }
    function set(p) {
      p = p || {};
      if ('title' in p) { head.textContent = p.title || ''; ov.setAttribute('aria-label', p.title || 'Dialog'); }
      if ('message' in p) msg.textContent = p.message || '';
      if ('sub' in p) sub.textContent = p.sub || '';
      if ('badge' in p) badge.textContent = p.badge || '';
      if ('progress' in p) {
        if (p.progress == null) bar.hidden = true;
        else { bar.hidden = false; fill.style.width = Math.max(0, Math.min(100, p.progress * 100)) + '%'; }
      }
      if ('closable' in p) { st.closable = !!p.closable; x.hidden = !st.closable; }
      if ('buttons' in p) setButtons(p.buttons);
    }
    function onKey(e) { if (e.key === 'Escape' && st.closable && open[open.length - 1] === api) { e.stopPropagation(); api.close(); } }
    function close() {
      if (!isOpen) return; isOpen = false;
      D.removeEventListener('keydown', onKey, true);
      var i = open.indexOf(api); if (i >= 0) open.splice(i, 1);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
      if (closedCb) { var f = closedCb; closedCb = null; try { f(api); } catch (e) { if (G.console) console.error('[GameDialog] onClose', e); } }
    }
    x.addEventListener('click', function () { if (st.closable) close(); });
    var api = { el: ov, set: set, close: close, isOpen: function () { return isOpen; } };
    set({ title: opts.title, message: opts.message, sub: opts.sub, badge: opts.badge, progress: opts.progress == null ? null : opts.progress, closable: st.closable, buttons: opts.buttons });
    prevFocus = D.activeElement; isOpen = true; open.push(api);
    D.body.appendChild(ov); D.addEventListener('keydown', onKey, true);
    var first = btns.querySelector('button:not([disabled])'); if (first && first.focus) first.focus();
    return api;
  }

  /* Dulu memuat gambar bingkai; kini no-op (API dipertahankan untuk pemanggil lama). */
  function preload() {
    var urls = [];   /* modal kit = CSS murni, tidak ada gambar yang perlu dimuat */
    return new Promise(function (res) {
      if (!urls.length) return res();
      var left = urls.length, done = function () { if (--left <= 0) res(); };
      urls.forEach(function (u) { var i = new G.Image(); i.onload = i.onerror = done; i.src = u; });
      setTimeout(res, 1200);
    });
  }
  UT.GameDialog = { open: create, preload: preload, any: function () { return open.length > 0; }, closeAll: function () { open.slice().forEach(function (d) { d.close(); }); } };
})(typeof window !== 'undefined' ? window : this);
