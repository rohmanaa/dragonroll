/* Ular Tangga Blok — hud/components/card.js (Stage 4.0.4: komponen Card reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: app.js -> hud/ui-core.js -> hud/components/button.js -> card.js.
   Mendaftar ke registry UT.Hud (dibuat di ui-core.js); TIDAK membuat sistem UI kedua.
   Pakai:  var el = UT.Hud.create('card', { variant:'elevated', padding:'md', children:[node1, node2] });
           parent.appendChild(el);
   Opsi: variant (default|elevated|outlined|flat), padding (none|sm|md|lg), className, ariaLabel, role,
         children (HTMLElement atau HTMLElement[]). Hasil: HTMLElement kelas ut-card ut-card-<variant> ut-card-p-<padding>.
   Card bukan tombol: tidak clickable dan tidak diberi role otomatis. Tidak ada API HTML string / innerHTML;
   isi hanya lewat DOM (children). API title/description sengaja TIDAK ada (audit: layout isi tiap halaman berbeda).
   Stylesheet hud/components/card.css dimuat otomatis (di samping card.js) bila belum ada;
   halaman juga boleh memasang <link> sendiri dengan id="ut-card-css". */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  /* Dependensi wajib: gagal jelas & aman, tanpa membuat fallback registry. */
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] card.js: UT.Hud belum tersedia. Muat hud/ui-core.js sebelum hud/components/card.js.');
    }
    return;
  }
  /* Idempotent: registrasi pertama dipertahankan. */
  if (UT.Hud.has('card')) return;

  var VARIANTS = ['default', 'elevated', 'outlined', 'flat'];
  var PADDINGS = ['none', 'sm', 'md', 'lg'];
  var CSS_ID = 'ut-card-css';

  function pick(value, list, fallback) {
    return list.indexOf(value) !== -1 ? value : fallback;
  }

  /* Muat card.css (satu kali) dari folder yang sama dengan card.js. */
  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/card\.js(\?.*)?$/, 'card.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  function isElement(n) { return !!n && n.nodeType === 1; }

  function create(opts) {
    opts = opts || {};
    var variant = pick(opts.variant, VARIANTS, 'default');
    var padding = pick(opts.padding, PADDINGS, 'md');
    var el = doc.createElement('div');

    el.className = 'ut-card ut-card-' + variant + ' ut-card-p-' + padding;
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    }
    if (typeof opts.role === 'string' && opts.role) el.setAttribute('role', opts.role); /* hanya bila diminta */
    if (opts.ariaLabel) el.setAttribute('aria-label', String(opts.ariaLabel));

    /* children: HTMLElement atau HTMLElement[] — hanya node elemen yang diterima, tidak pernah string HTML. */
    var kids = opts.children;
    if (isElement(kids)) kids = [kids];
    if (Array.isArray(kids)) {
      kids.forEach(function (k) { if (isElement(k)) el.appendChild(k); });
    }
    return el;
  }

  UT.Hud.register('card', {
    create: create,
    variants: VARIANTS.slice(),
    paddings: PADDINGS.slice()
  });
})(window, document);
