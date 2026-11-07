/* Ular Tangga Blok — hud/components/modal.js (Stage 4.0.6: komponen Modal reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: app.js -> hud/ui-core.js -> hud/components/modal.js.
   Mendaftar ke registry UT.Hud (dibuat di ui-core.js); TIDAK membuat sistem UI kedua.
   Pakai:  var m = UT.Hud.create('modal', { title:'Reward', content: someElement });
           m.open();  m.isOpen();  m.close();
   Opsi: title (teks), content (HTMLElement | HTMLElement[] | string teks), className, ariaLabel (nama dialog bila title kosong),
         closeOnBackdrop (default true), closeOnEscape (default true), showClose (default true), closeLabel (default 'Tutup'),
         onOpen, onClose (masing-masing dipanggil tepat sekali per siklus open/close yang valid).
   API instance: open(), close(), isOpen(), setContent(content), setTitle(title), element (akar .ut-modal).
   Keamanan: title/string selalu lewat textContent; tidak ada penyisipan HTML string. Isi kaya = HTMLElement buatan pemanggil.
   Isolasi: tidak memakai #modal/#mx/#mb/.ov/.box milik halaman; tiap instance punya state sendiri dan ditempel ke <body>
   hanya saat terbuka (dilepas saat ditutup). Beberapa modal terbuka bertumpuk: Escape hanya menutup yang paling atas.
   Fokus (sederhana, tanpa focus trap): saat open -> tombol close (atau elemen fokusable pertama); saat close -> elemen pemicu.
   Stylesheet hud/components/modal.css dimuat otomatis (di samping modal.js) bila belum ada;
   halaman juga boleh memasang <link> sendiri dengan id="ut-modal-css". */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  /* Dependensi wajib: gagal jelas & aman, tanpa membuat fallback registry. */
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] modal.js: UT.Hud belum tersedia. Muat hud/ui-core.js sebelum hud/components/modal.js.');
    }
    return;
  }
  /* Idempotent: registrasi pertama dipertahankan. */
  if (UT.Hud.has('modal')) return;

  var CSS_ID = 'ut-modal-css';
  var FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex^="-"])';
  var seq = 0;      /* penghitung id title unik per instance */
  var stack = [];   /* modal yang sedang terbuka (paling atas = terakhir); hanya untuk urutan Escape */

  /* Muat modal.css (satu kali) dari folder yang sama dengan modal.js. */
  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/modal\.js(\?.*)?$/, 'modal.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  function isElement(n) { return !!n && n.nodeType === 1; }

  function el(tag, cls) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function safeCall(fn, self) {
    if (typeof fn !== 'function') return;
    try { fn.call(self, self); }
    catch (err) { if (win.console && win.console.error) win.console.error('[UT.Hud] modal callback error:', err); }
  }

  function create(opts) {
    opts = opts || {};
    var closeOnBackdrop = opts.closeOnBackdrop !== false;
    var closeOnEscape = opts.closeOnEscape !== false;
    var showClose = opts.showClose !== false;
    var fallbackLabel = opts.ariaLabel ? String(opts.ariaLabel) : 'Dialog';

    var titleId = 'ut-modal-title-' + (++seq);
    while (doc.getElementById(titleId)) titleId = 'ut-modal-title-' + (++seq);

    /* ---- struktur (DOM API saja) ---- */
    var root = el('div', 'ut-modal');
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) root.classList.add(c); });
    }
    var backdrop = el('div', 'ut-modal-backdrop');
    var dialog = el('div', 'ut-modal-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    var closeBtn = null;
    if (showClose) {
      closeBtn = el('button', 'ut-modal-close');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', opts.closeLabel ? String(opts.closeLabel) : 'Tutup');
      closeBtn.textContent = '\u2715';
      dialog.appendChild(closeBtn);
    }

    var header = el('div', 'ut-modal-header');
    var titleEl = el('h2', 'ut-modal-title');
    titleEl.id = titleId;
    header.appendChild(titleEl);
    dialog.appendChild(header);

    var body = el('div', 'ut-modal-body');
    dialog.appendChild(body);

    root.appendChild(backdrop);
    root.appendChild(dialog);

    /* ---- state per instance ---- */
    var opened = false;
    var trigger = null;
    var api = { element: root };

    function setTitle(t) {
      var text = t == null ? '' : String(t);
      titleEl.textContent = text; /* textContent: title tidak pernah dibaca sebagai HTML */
      header.hidden = text === '';
      if (text === '') {
        dialog.removeAttribute('aria-labelledby');
        dialog.setAttribute('aria-label', fallbackLabel);
      } else {
        dialog.removeAttribute('aria-label');
        dialog.setAttribute('aria-labelledby', titleId);
      }
    }

    function setContent(content) {
      while (body.firstChild) body.removeChild(body.firstChild);
      var items = Array.isArray(content) ? content : [content];
      items.forEach(function (c) {
        if (isElement(c)) {
          body.appendChild(c);
        } else if (typeof c === 'string' || typeof c === 'number') {
          var p = el('p', 'ut-modal-text');
          p.textContent = String(c); /* string = teks aman */
          body.appendChild(p);
        } /* null/undefined/tipe lain: diabaikan */
      });
    }

    function onKeydown(e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (!opened || stack[stack.length - 1] !== api) return; /* hanya modal paling atas */
      if (closeOnEscape) close();
    }
    function onBackdropClick(e) {
      if (e.target === backdrop && closeOnBackdrop) close();
    }
    function onCloseClick() { close(); }

    function open() {
      if (opened) return api; /* open ganda: tidak ada callback kedua */
      opened = true;
      var active = doc.activeElement;
      trigger = (active && active !== doc.body && active !== doc.documentElement) ? active : null;
      (doc.body || doc.documentElement).appendChild(root);
      stack.push(api);
      doc.addEventListener('keydown', onKeydown);
      backdrop.addEventListener('click', onBackdropClick);
      if (closeBtn) closeBtn.addEventListener('click', onCloseClick);
      /* fokus: tombol close; bila tidak ada, elemen fokusable pertama di dalam dialog; bila tidak ada, biarkan */
      var target = closeBtn || dialog.querySelector(FOCUSABLE);
      if (target && typeof target.focus === 'function') target.focus();
      safeCall(opts.onOpen, api);
      return api;
    }

    function close() {
      if (!opened) return api; /* close ganda: tidak ada callback kedua */
      opened = false;
      var i = stack.indexOf(api);
      if (i !== -1) stack.splice(i, 1);
      doc.removeEventListener('keydown', onKeydown);
      backdrop.removeEventListener('click', onBackdropClick);
      if (closeBtn) closeBtn.removeEventListener('click', onCloseClick);
      if (root.parentNode) root.parentNode.removeChild(root);
      var t = trigger; trigger = null;
      if (t && t.isConnected !== false && doc.contains(t) && typeof t.focus === 'function') t.focus();
      safeCall(opts.onClose, api);
      return api;
    }

    api.open = open;
    api.close = close;
    api.isOpen = function () { return opened; };
    api.setContent = function (c) { setContent(c); return api; };
    api.setTitle = function (t) { setTitle(t); return api; };

    setTitle(opts.title);
    setContent(opts.content);
    return api;
  }

  UT.Hud.register('modal', { create: create });
})(window, document);
