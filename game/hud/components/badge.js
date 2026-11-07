/* Ular Tangga Blok — hud/components/badge.js (Stage 4.0.8: komponen Badge / Tag reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: app.js -> hud/ui-core.js -> hud/components/badge.js.
   Mendaftar ke registry UT.Hud (dibuat di ui-core.js); TIDAK membuat registry kedua.
   Pakai:  var el = UT.Hud.create('badge', { label:'Owned', variant:'success', size:'md' });
           parent.appendChild(el);
   Opsi: label (teks), variant (default|success|warning|danger|info; tak valid -> default),
         size (sm|md|lg; tak valid -> md), className, ariaLabel (hanya dipasang bila diberikan).
   Hasil: <span class="ut-badge ut-badge-<variant> ut-badge-<size>">label</span>.
   Badge hanya informasi: tanpa role, tanpa tabindex, tanpa click handler. Label selalu lewat textContent
   (tidak ada penyisipan HTML). Tidak ada state bersama: tiap panggilan create() membuat elemen baru.
   Stylesheet hud/components/badge.css dimuat otomatis (di samping badge.js) bila belum ada;
   halaman juga boleh memasang <link> sendiri dengan id="ut-badge-css". */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  /* Dependensi wajib: gagal jelas & aman, tanpa membuat fallback registry. */
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] badge.js: UT.Hud belum tersedia. Muat hud/ui-core.js sebelum hud/components/badge.js.');
    }
    return;
  }
  /* Idempotent: registrasi pertama dipertahankan. */
  if (UT.Hud.has('badge')) return;

  var VARIANTS = ['default', 'success', 'warning', 'danger', 'info'];
  var SIZES = ['sm', 'md', 'lg'];
  var CSS_ID = 'ut-badge-css';

  function pick(value, list, fallback) {
    return list.indexOf(value) !== -1 ? value : fallback;
  }

  /* Muat badge.css (satu kali) dari folder yang sama dengan badge.js. */
  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/badge\.js(\?.*)?$/, 'badge.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  function create(opts) {
    opts = opts || {};
    var variant = pick(opts.variant, VARIANTS, 'default');
    var size = pick(opts.size, SIZES, 'md');
    var el = doc.createElement('span');

    el.className = 'ut-badge ut-badge-' + variant + ' ut-badge-' + size;
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    }
    if (opts.ariaLabel) el.setAttribute('aria-label', String(opts.ariaLabel));
    el.textContent = opts.label == null ? '' : String(opts.label); /* textContent: label tidak pernah dibaca sebagai HTML */
    return el;
  }

  UT.Hud.register('badge', {
    create: create,
    variants: VARIANTS.slice(),
    sizes: SIZES.slice()
  });
})(window, document);
