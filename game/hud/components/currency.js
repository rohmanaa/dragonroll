/* Ular Tangga Blok — hud/components/currency.js (Stage 4.0.5: komponen Currency reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: app.js -> hud/ui-core.js -> hud/components/currency.js.
   Mendaftar ke registry UT.Hud (dibuat di ui-core.js); TIDAK membuat sistem UI kedua.
   Pakai:  var el = UT.Hud.create('currency', { type:'coin', value:8450, size:'lg' });
           parent.appendChild(el);
   Opsi: type (gem|coin; lainnya -> gem), value (angka / string angka), size (sm|md|lg; lainnya -> md),
         className, ariaLabel.
   Hasil: <span class="ut-currency ut-currency-<type> ut-currency-<size>">
            <span class="ut-currency-icon"><svg/></span><span class="ut-currency-value">…</span></span>
   Komponen hanya MENAMPILKAN value yang diberikan (apa adanya, tanpa format ribuan; pemanggil yang memformat).
   Tidak membaca/menulis PlayerData maupun localStorage. Bukan elemen interaktif: tanpa tabindex, tanpa role.
   Semua isi dibuat lewat DOM/SVG API + textContent; tidak ada HTML string.
   Stylesheet hud/components/currency.css dimuat otomatis (di samping currency.js) bila belum ada;
   halaman juga boleh memasang <link> sendiri dengan id="ut-currency-css". */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  /* Dependensi wajib: gagal jelas & aman, tanpa membuat fallback registry. */
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] currency.js: UT.Hud belum tersedia. Muat hud/ui-core.js sebelum hud/components/currency.js.');
    }
    return;
  }
  /* Idempotent: registrasi pertama dipertahankan. */
  if (UT.Hud.has('currency')) return;

  var TYPES = ['gem', 'coin'];
  var SIZES = ['sm', 'md', 'lg'];
  var CSS_ID = 'ut-currency-css';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function pick(value, list, fallback) {
    return list.indexOf(value) !== -1 ? value : fallback;
  }

  /* Muat currency.css (satu kali) dari folder yang sama dengan currency.js. */
  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/currency\.js(\?.*)?$/, 'currency.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  /* Helper SVG (DOM API). */
  function svgEl(name, attrs) {
    var n = doc.createElementNS(SVG_NS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  /* Ikon dibuat dari DOM API; bentuk & warna sama dengan ikon gem/coin yang sudah dipakai halaman (hasil audit). */
  function buildIcon(type) {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', focusable: 'false', 'aria-hidden': 'true' });
    svg.innerHTML = (type === 'coin') ? '<path d="M12 12V.24A11.76 11.76 0 0 0 .24 12z" fill="#ffd12b"/><path d="M12 12h11.76A11.76 11.76 0 0 0 12 .24z" fill="#ffb800"/><path d="M12 12v11.76A11.76 11.76 0 0 0 23.76 12z" fill="#ffd12b"/><path d="M12 12H.24A11.76 11.76 0 0 0 12 23.76z" fill="#ffb800"/><circle cx="12" cy="12" r="8.75" fill="#ff8a00"/><g fill="#ffb901"><circle cx="18.90" cy="12.00" r=".6"/><circle cx="16.88" cy="16.88" r=".6"/><circle cx="12.00" cy="18.90" r=".6"/><circle cx="7.12" cy="16.88" r=".6"/><circle cx="5.10" cy="12.00" r=".6"/><circle cx="7.12" cy="7.12" r=".6"/><circle cx="12.00" cy="5.10" r=".6"/><circle cx="16.88" cy="7.12" r=".6"/></g><path d="M12 7.2l3.9 4.8-3.9 4.8-3.9-4.8z" fill="#ffd12b" stroke="#ffd12b" stroke-width="1" stroke-linejoin="round"/>' : '<path d="M3.34 7L12 2l0 4.3-4.94 2.85z" fill="#62e178"/><path d="M12 2l8.66 5-3.72 2.15L12 6.3z" fill="#47d85f"/><path d="M20.66 7v10l-3.72-2.15v-5.7z" fill="#3dcb55"/><path d="M20.66 17L12 22v-4.3l4.94-2.85z" fill="#32a643"/><path d="M12 22l-8.66-5 3.72-2.15L12 17.7z" fill="#2a8d3a"/><path d="M3.34 17V7l3.72 2.15v5.7z" fill="#37b44c"/><path d="M12 6.3l4.94 2.85v5.7L12 17.7l-4.94-2.85v-5.7z" fill="#a7e6b1"/><path d="M12 6.3l4.94 2.85L12 12 7.06 9.15z" fill="#c4f2cc" opacity=".7"/>'; /* ikon baru: koin emas (4 kuadran + berlian) / emerald heksagon */
    return svg;
  }

  function create(opts) {
    opts = opts || {};
    var type = pick(opts.type, TYPES, 'gem');
    var size = pick(opts.size, SIZES, 'md');

    var el = doc.createElement('span');
    el.className = 'ut-currency ut-currency-' + type + ' ut-currency-' + size;
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    }
    if (opts.ariaLabel) el.setAttribute('aria-label', String(opts.ariaLabel));

    var icon = doc.createElement('span');
    icon.className = 'ut-currency-icon';
    icon.appendChild(buildIcon(type));

    var val = doc.createElement('span');
    val.className = 'ut-currency-value';
    val.textContent = opts.value == null ? '0' : String(opts.value); /* textContent: value tidak pernah dibaca sebagai HTML */

    el.appendChild(icon);
    el.appendChild(val);
    return el;
  }

  UT.Hud.register('currency', {
    create: create,
    types: TYPES.slice(),
    sizes: SIZES.slice()
  });
})(window, document);
