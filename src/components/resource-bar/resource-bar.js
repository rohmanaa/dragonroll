/* Dragon Roll â€” src/components/resource-bar/resource-bar.js (komponen Resource Bar reusable: Emerald & Coin)
   Skrip klasik (tanpa import/export/type=module). Urutan muat: ui-core.js -> resource-bar.js -> kode halaman.
   Mendaftar ke registry UT.Hud; memakai komponen 'plus-button' bila sudah dimuat (muat plus-button.js lebih dulu).
   Komponen hanya MENAMPILKAN angka; sumber data tetap PlayerData (halaman yang mengisi teks lewat setValue / #<valueId>).

   Dua cara pakai:
   1) Imperatif:  var bar = UT.Hud.create('resource-bar', { type:'gem', valueId:'v-em', onClick:fn, ariaLabel:'Emerald, buka Tambang' });
                  parent.appendChild(bar);  bar.setValue('1 250');
   2) Deklaratif (HTML tetap, id & data-act milik halaman dipertahankan):
                  <div id="cur-em" data-rbar="gem" data-value-id="v-em" data-act="tambang" aria-label="Emerald, buka Tambang"></div>
                  UT.Hud.get('resource-bar').hydrate(root)   // idempoten; otomatis dijalankan sekali saat skrip dimuat
   Opsi/atribut: type|data-rbar (gem|coin), valueId|data-value-id, plus (false|data-plus="0" => tanpa tombol +), value, className, ariaLabel, onClick.
   Ikon: assets/images/ui/gem-medal-icons/berlian-hijau.webp (gem), assets/images/ui/hud/ikon-koin-emas.webp (coin), dipecahkan relatif
   terhadap lokasi skrip ini, jadi aman dipakai dari halaman/folder mana pun.
   Stylesheet resource-bar.css dimuat otomatis di samping resource-bar.js. */
(function (win, doc) {
  'use strict';

  var UT = win.UT;
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') {
    if (win.console && win.console.error) {
      win.console.error('[UT.Hud] resource-bar.js: UT.Hud belum tersedia. Muat src/components/ui-core.js sebelum resource-bar.js.');
    }
    return;
  }
  if (UT.Hud.has('resource-bar')) return;

  var TYPES = ['gem', 'coin'];
  var ICONS = { gem: 'berlian-hijau.webp', coin: 'ikon-koin-emas.webp' };
  var ICON_DIR = { gem: 'gem-medal-icons/', coin: 'hud/' };
  var LABELS = { gem: 'Emerald', coin: 'Coin' };
  var CSS_ID = 'ut-rbar-css';
  var SCRIPT_SRC = (doc.currentScript && doc.currentScript.src) || '';

  function pick(value, list, fallback) { return list.indexOf(value) !== -1 ? value : fallback; }

  function ensureStyles(script) {
    if (doc.getElementById(CSS_ID)) return;
    var src = script && script.src;
    if (!src) return;
    var href = src.replace(/resource-bar\.js(\?.*)?$/, 'resource-bar.css');
    if (href === src) return;
    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.id = CSS_ID;
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }
  ensureStyles(doc.currentScript);

  /* ../../images/ui/... relatif terhadap folder komponen ini (src/components/resource-bar/) */
  function iconUrl(type) {
    var rel = '../../images/ui/' + ICON_DIR[type] + ICONS[type];
    if (!SCRIPT_SRC) return 'assets/images/ui/' + ICON_DIR[type] + ICONS[type];
    try { return new win.URL(rel, SCRIPT_SRC).href; } catch (e) { return 'assets/images/ui/' + ICON_DIR[type] + ICONS[type]; }
  }

  function addClasses(el, str) {
    if (typeof str !== 'string') return;
    str.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
  }

  /* Membangun isi ke dalam elemen `el` (host). Mengembalikan el. */
  function build(el, o) {
    var type = pick(o.type, TYPES, 'gem');
    el.classList.add('ut-rbar', 'ut-rbar-' + type);
    addClasses(el, o.className);

    var interactive = typeof o.onClick === 'function' || o.interactive !== false;
    if (interactive) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      el.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); el.click(); }
      });
    } else {
      el.classList.add('ut-rbar-static');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'status');
    }
    if (o.ariaLabel && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', String(o.ariaLabel));
    else if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', LABELS[type]);
    if (typeof o.onClick === 'function') el.addEventListener('click', function (e) { o.onClick.call(el, e); });

    if (o.plus !== false) {
      var plus = UT.Hud.create('plus-button', { size: 'sm', decorative: true, className: 'ut-rbar-plus' });
      if (plus) el.appendChild(plus);
    }

    var num = doc.createElement('span');
    num.className = 'ut-rbar-num';
    if (o.valueId) num.id = String(o.valueId);
    num.textContent = o.value == null ? 'â€”' : String(o.value);
    el.appendChild(num);

    var img = doc.createElement('img');
    img.className = 'ut-rbar-icon';
    img.alt = ''; img.draggable = false;
    img.src = o.icon || iconUrl(type);
    el.appendChild(img);

    el.setValue = function (v) {
      var t = v == null ? 'â€”' : String(v);
      if (num.textContent === t) return;
      var had = num.textContent && num.textContent !== 'â€”';
      num.textContent = t;
      if (had) { num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump'); }
    };
    el.valueEl = num;
    return el;
  }

  function create(opts) {
    opts = opts || {};
    return build(doc.createElement('div'), opts);
  }

  /* Ubah host deklaratif [data-rbar] menjadi resource bar (sekali per elemen). id/data-act/aria-label host dipertahankan. */
  function hydrate(root) {
    root = root || doc;
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    var hosts = root.querySelectorAll('[data-rbar]'), n = 0;
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      if (h.__utRbar) continue;
      h.__utRbar = true;
      build(h, {
        type: h.getAttribute('data-rbar'),
        valueId: h.getAttribute('data-value-id'),
        plus: h.getAttribute('data-plus') !== '0',
        interactive: h.getAttribute('data-static') !== '1',
        value: h.getAttribute('data-value')
      });
      n++;
    }
    return n;
  }

  UT.Hud.register('resource-bar', { create: create, hydrate: hydrate, types: TYPES.slice() });
  if (typeof doc.querySelectorAll === 'function') {
    hydrate(doc);   /* host yang sudah ter-parse di atas skrip ini langsung jadi (id #v-xx siap dipakai kode halaman) */
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { hydrate(doc); });   /* host di bawahnya */
  }
})(window, document);

