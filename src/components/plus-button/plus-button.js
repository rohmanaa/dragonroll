/* Dragon Roll — src/components/plus-button/plus-button.js (komponen Plus Button reusable)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: ui-core.js -> plus-button.js.
   Mendaftar ke registry UT.Hud; TIDAK membuat sistem UI kedua.
   Pakai:  var el = UT.Hud.create('plus-button', { size:'md', onClick:fn, ariaLabel:'Tambah' });
   Opsi: size (sm|md|lg), color (y|g|b|r|p|t|n|d; bawaan g = hijau), onClick, className, ariaLabel,
         decorative (true => <span aria-hidden> tanpa klik; dipakai DI DALAM elemen yang sudah interaktif, mis. resource bar).
   Hasil: <button class="ut-plus ut-plus-<size> ut-gl ut-c-<color>"><svg/></button>
   Stylesheet plus-button.css dimuat otomatis di samping plus-button.js. */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] plus-button.js: UT.Hud belum tersedia. Muat src/components/ui-core.js sebelum plus-button.js.');
    }
    return;
  }
  if (UT.Hud.has('plus-button')) return;

  var SIZES = ['sm', 'md', 'lg'];
  var COLORS = ['y', 'g', 'b', 'r', 'p', 't', 'n', 'd'];
  var CSS_ID = 'ut-plus-css';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function pick(value, list, fallback) { return list.indexOf(value) !== -1 ? value : fallback; }

  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/plus-button\.js(\?.*)?$/, 'plus-button.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  function icon() {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    var p = doc.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z');
    p.setAttribute('fill', '#fff');
    p.setAttribute('stroke', '#1a1a1a');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }

  function create(opts) {
    opts = opts || {};
    var deco = !!opts.decorative;
    var el = doc.createElement(deco ? 'span' : 'button');
    el.className = 'ut-plus ut-plus-' + pick(opts.size, SIZES, 'md') + ' ut-gl ut-c-' + pick(opts.color, COLORS, 'g') + (deco ? ' ut-plus-deco' : '');
    if (typeof opts.className === 'string') {
      opts.className.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    }
    if (deco) {
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.type = 'button';
      el.setAttribute('aria-label', opts.ariaLabel ? String(opts.ariaLabel) : 'Tambah');
      if (typeof opts.onClick === 'function') {
        el.addEventListener('click', function (e) { opts.onClick.call(el, e); });
      }
    }
    el.appendChild(icon());
    return el;
  }

  UT.Hud.register('plus-button', { create: create, sizes: SIZES.slice(), colors: COLORS.slice() });
})(window, document);

