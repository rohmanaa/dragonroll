/* Ular Tangga Blok — hud/components/toast.js (Stage 4.0.7: komponen Toast reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: app.js -> hud/ui-core.js -> hud/components/toast.js.
   Mendaftar ke registry UT.Hud (dibuat di ui-core.js); TIDAK membuat sistem toast global kedua.
   Pakai:  var t = UT.Hud.create('toast', { message: 'Berhasil disimpan', variant: 'success' });
           t.show();  t.isVisible();  t.hide();
   Opsi: message (teks), variant ('info' | 'success' | 'warning' | 'error'; selain itu -> 'info'),
         duration (ms; 0 = tidak hilang otomatis; angka positif = timeout; invalid/negatif -> 1600),
         className (kelas tambahan pada akar), ariaLabel (nama aksesibel, opsional).
   API instance: show(), hide(), isVisible(), setMessage(text), element (akar .ut-toast). show/hide/setMessage mengembalikan instance.
   Hubungan dengan UT.UI.toast (app.js): UT.UI.toast adalah singleton yang terikat ke #toast milik halaman (satu elemen, satu timer);
   ia tidak bisa menampung banyak instance, varian, hide() maupun isVisible(). Karena itu DOM/timer-nya TIDAK dipakai ulang
   (memanggilnya akan menyalakan #toast legacy, bukan instance ini) dan UT.UI.toast tidak diubah. Yang dibagi: kelas dasar .ut-toast
   + kelas state .on (kontrak yang sama dengan UT.UI.toast / base.css), serta default durasi (1600ms) milik toast legacy.
   Keamanan: message selalu lewat textContent; tidak ada penyisipan HTML string.
   Isolasi: tidak memakai #toast/.toast/.on milik halaman. Tiap instance punya akar, state, dan satu timer sendiri. Akar hanya ada
   di DOM saat tampil, di dalam SATU host bersama (.ut-toast-stack, dibuat saat toast pertama tampil, dibuang saat kosong).
   Tidak ada listener dokumen sama sekali, jadi tidak ada listener yang bisa menumpuk.
   Stylesheet hud/components/toast.css dimuat otomatis (di samping toast.js) bila belum ada;
   halaman juga boleh memasang <link> sendiri dengan id="ut-toast-css". */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  /* Dependensi wajib: gagal jelas & aman, tanpa membuat fallback registry. */
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] toast.js: UT.Hud belum tersedia. Muat hud/ui-core.js sebelum hud/components/toast.js.');
    }
    return;
  }
  /* Idempotent: registrasi pertama dipertahankan. */
  if (UT.Hud.has('toast')) return;

  var CSS_ID = 'ut-toast-css';
  var DEFAULT_DURATION = 1600;        /* sama dengan toast() legacy di halaman */
  var MAX_DURATION = 2147483647;      /* batas setTimeout; lebih dari ini akan langsung terpicu */
  var VARIANTS = ['info', 'success', 'warning', 'error'];
  var stackEl = null;                 /* host bersama; ada hanya selama ada toast yang tampil */

  /* Muat toast.css (satu kali) dari folder yang sama dengan toast.js. */
  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/toast\.js(\?.*)?$/, 'toast.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  function el(tag, cls) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function normVariant(v) {
    return (typeof v === 'string' && VARIANTS.indexOf(v) !== -1) ? v : 'info';
  }

  /* 0 = permanen; angka hingga (finite) positif = timeout; selain itu (NaN, string, negatif, Infinity, null) = default. */
  function normDuration(d) {
    if (typeof d !== 'number' || !isFinite(d) || d < 0) return DEFAULT_DURATION;
    if (d === 0) return 0;
    return Math.min(d, MAX_DURATION);
  }

  /* Satu host bersama; dibuat ulang bila terlepas dari dokumen. */
  function getStack() {
    if (stackEl && stackEl.parentNode) return stackEl;
    stackEl = el('div', 'ut-toast-stack');
    (doc.body || doc.documentElement).appendChild(stackEl);
    return stackEl;
  }

  function releaseStack() {
    if (stackEl && !stackEl.firstChild) {
      if (stackEl.parentNode) stackEl.parentNode.removeChild(stackEl);
      stackEl = null;
    }
  }

  function create(opts) {
    opts = opts || {};
    var variant = normVariant(opts.variant);
    var duration = normDuration(opts.duration);

    /* ---- struktur (DOM API saja) ---- */
    var root = el('div', 'ut-toast ut-toast-hud ut-toast-' + variant);
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) root.classList.add(c); });
    }
    /* Aksesibilitas: error = alert (assertive); lainnya = status (polite). Tanpa tabindex: toast tidak pernah merebut fokus. */
    if (variant === 'error') {
      root.setAttribute('role', 'alert');
    } else {
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
    }
    root.setAttribute('aria-atomic', 'true');
    if (opts.ariaLabel != null && String(opts.ariaLabel).trim() !== '') {
      root.setAttribute('aria-label', String(opts.ariaLabel));
    }
    var msgEl = el('span', 'ut-toast-message');
    root.appendChild(msgEl);

    /* ---- state per instance ---- */
    var visible = false;
    var timer = null;
    var api = { element: root };

    function clearTimer() {
      if (timer !== null) { win.clearTimeout(timer); timer = null; }
    }

    function setMessage(m) {
      msgEl.textContent = m == null ? '' : String(m); /* textContent: pesan tidak pernah dibaca sebagai HTML */
    }

    function show() {
      clearTimer(); /* show ulang selalu mengganti timer lama: tidak ada timer ganda */
      if (!visible) {
        visible = true;
        getStack().appendChild(root);
        root.classList.add('on');
      }
      if (duration > 0) {
        timer = win.setTimeout(function () { timer = null; hide(); }, duration);
      }
      return api;
    }

    function hide() {
      clearTimer();
      if (!visible) return api; /* hide ganda: no-op */
      visible = false;
      root.classList.remove('on');
      if (root.parentNode) root.parentNode.removeChild(root);
      releaseStack();
      return api;
    }

    api.show = show;
    api.hide = hide;
    api.isVisible = function () { return visible; };
    api.setMessage = function (m) { setMessage(m); return api; };

    setMessage(opts.message);
    return api;
  }

  UT.Hud.register('toast', { create: create });
})(window, document);
