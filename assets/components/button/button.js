/* Ular Tangga Blok — assets/components/button/button.js (Stage 4.0.3: komponen Button reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: app.js -> assets/components/ui-core.js -> assets/components/button/button.js.
   Mendaftar ke registry UT.Hud (dibuat di ui-core.js); TIDAK membuat sistem UI kedua.
   Pakai:  var el = UT.Hud.create('button', { label:'Main', variant:'primary', size:'md', onClick:fn });
           parent.appendChild(el);
   Opsi: label, variant (primary|secondary|ghost|danger|yellow|green|blue|red|purple|teal|brown|dark), size (sm|md|lg), disabled, type (button|submit|reset),
         onClick, className, ariaLabel. Hasil: HTMLButtonElement dengan kelas ut-btn ut-btn-<variant> ut-btn-<size>.
   Stylesheet assets/components/button/button.css dimuat otomatis (di samping button.js) bila belum ada;
   halaman juga boleh memasang <link> sendiri dengan id="ut-btn-css". */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  /* Dependensi wajib: gagal jelas & aman, tanpa membuat fallback registry. */
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] button.js: UT.Hud belum tersedia. Muat assets/components/ui-core.js sebelum assets/components/button/button.js.');
    }
    return;
  }
  /* Idempotent: registrasi pertama dipertahankan. */
  if (UT.Hud.has('button')) return;

  var VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'yellow', 'green', 'blue', 'red', 'purple', 'teal', 'brown', 'dark'];
  var GLOSS = { yellow: 'y', green: 'g', blue: 'b', red: 'r', purple: 'p', teal: 't', brown: 'n', dark: 'd' }; /* varian glossy gaya Guild */
  var SIZES = ['sm', 'md', 'lg'];
  var TYPES = ['button', 'submit', 'reset'];
  var CSS_ID = 'ut-btn-css';

  function pick(value, list, fallback) {
    return list.indexOf(value) !== -1 ? value : fallback;
  }

  /* Muat button.css (satu kali) dari folder yang sama dengan button.js. */
  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/button\.js(\?.*)?$/, 'button.css');
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
    var variant = pick(opts.variant, VARIANTS, 'primary');
    var size = pick(opts.size, SIZES, 'md');
    var el = doc.createElement('button');

    el.type = pick(opts.type, TYPES, 'button');
    el.className = 'ut-btn ut-btn-' + variant + ' ut-btn-' + size + (GLOSS[variant] ? ' ut-gl ut-c-' + GLOSS[variant] : '');
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    }
    el.textContent = opts.label == null ? '' : String(opts.label); /* textContent: label tidak pernah dibaca sebagai HTML */
    if (opts.ariaLabel) el.setAttribute('aria-label', String(opts.ariaLabel));
    el.disabled = !!opts.disabled;
    if (typeof opts.onClick === 'function') {
      el.addEventListener('click', function (e) { opts.onClick.call(el, e); }); /* satu listener per elemen */
    }
    return el;
  }

  UT.Hud.register('button', {
    create: create,
    variants: VARIANTS.slice(),
    sizes: SIZES.slice()
  });
})(window, document);
