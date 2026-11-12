/* SceneBackground — komponen latar reusable (Stage 4).
   Pakai:  UT.SceneBG.mount(container?, {preset:'full'|'soft', clouds:5, image, effects:{...}}) -> {el, destroy()}
   Otomatis: <script src="assets/js/scene-bg.js" data-auto data-preset="soft"></script> (dipasang saat <body> ada).
   Isi: langit + gambar latar (opsional; tanpa gambar = hitam polos) + 5 awan voxel 3D melayang kiri->kanan + fog cyan + sinar emas kanan-atas + volumetric + bloom lembut.
   TIDAK memuat pulau melayang / karakter (komponen terpisah). Tanpa WebGL tambahan (murni DOM/CSS/canvas 2D). */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var DEFAULTS = {
    preset: 'full',
    image: '',  /* kosong = latar hitam polos (CSS), tanpa gambar */
    clouds: 5,
    effects: { sky: true, fog: true, sun: true, rays: true, bloom: true }
  };
  /* 5 awan: besar & dekat di atas (opacity penuh, cepat), kecil & jauh (pudar, lambat, sedikit blur).
     k = skala (x 38vh), t = posisi atas, o = opacity, d = detik 1x melintas, b = blur px, ph = fase 0..1 */
  var CLOUDS = [
    { k: 1.2,  t: '2%',  o: .95,   d: 120, b: 0,   ph: .05, seed: 3 },
    { k: .5,   t: '10%', o: .55,  d: 210, b: 1.2, ph: .62, seed: 7 },
    { k: .8,   t: '22%', o: .85,  d: 150, b: 0,   ph: .33, seed: 11 },
    { k: .38,  t: '16%', o: .5,   d: 240, b: 1.6, ph: .88, seed: 5 },
    { k: 1.0,  t: '7%',  o: .9,  d: 135, b: 0,   ph: .72, seed: 13 }
  ];

  /* Lampu latar (menyala hanya saat malam, CSS html[data-ambience="night"]). Posisi = pecahan gambar latar (x,y 0..1); r = radius cahaya (pecahan lebar gambar);
     t: 'brazier' (tungku batu bara: api + cahaya lebar) | 'lamp' (lentera kecil). Dipakai lewat data-lights="lobby" (gambar lobby-bg.webp 2752x1536). */
  var LIGHTSETS = {
    lobby: { w: 2752, h: 1536, items: [
      { x: .087, y: .600, r: .085, t: 'brazier', dl: 0 },
      { x: .917, y: .600, r: .085, t: 'brazier', dl: -.7 },
      { x: .151, y: .254, r: .036, t: 'lamp', dl: -.3 },
      { x: .411, y: .276, r: .034, t: 'lamp', dl: -1.1 },
      { x: .451, y: .313, r: .022, t: 'lamp', dl: -.5 },
      { x: .213, y: .568, r: .030, t: 'lamp', dl: -1.4 },
      { x: .279, y: .579, r: .036, t: 'lamp', dl: -.9 },
      { x: .429, y: .592, r: .028, t: 'lamp', dl: -.2 }
    ] }
  };

  function rng(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

  /* awan voxel bergaya 3D: tiap balok punya sisi atas (hangat kena matahari), depan (putih), kanan (bayangan biru-cyan) */
  function cloudSprite(seed) {
    var r = rng(seed), S = 15, cols = 9 + (r() * 4 | 0), dx = S * .55, dy = S * .4, depth = 2;
    var H = [], i, h;
    for (i = 0; i < cols; i++) { var m = 1 - Math.abs(i - (cols - 1) / 2) / (cols / 2); H.push(Math.max(1, Math.round(.7 + m * 1.7 + (r() - .5) * .9))); }
    var maxH = Math.max.apply(null, H), W = cols * S + dx * depth + 6, Ht = maxH * S + dy * depth + 8;
    var c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(Ht);
    var g = c.getContext('2d');
    function shade(hex, f) { var n = parseInt(hex.slice(1), 16), R = n >> 16, G = n >> 8 & 255, B = n & 255; function cl(v) { return Math.max(0, Math.min(255, Math.round(v))); } return 'rgb(' + cl(R * f) + ',' + cl(G * f) + ',' + cl(B * f) + ')'; }
    for (var z = depth - 1; z >= 0; z--) {
      for (var y = 0; y < maxH; y++) {
        for (i = 0; i < cols; i++) {
          h = H[i] - (z ? (r() < .5 ? 1 : 0) : 0); if (y >= h) continue;
          var x0 = 3 + i * S + (depth - 1 - z) * dx, y0 = Ht - 5 - (y + 1) * S - (depth - 1 - z) * dy, j = .97 + r() * .05;
          g.fillStyle = shade('#f3fbff', j); g.fillRect(x0, y0 + 0, S, S);                        /* depan */
          g.fillStyle = shade('#bfe3f7', j); g.beginPath(); g.moveTo(x0 + S, y0); g.lineTo(x0 + S + dx, y0 - dy); g.lineTo(x0 + S + dx, y0 + S - dy); g.lineTo(x0 + S, y0 + S); g.closePath(); g.fill(); /* kanan (teduh) */
          g.fillStyle = shade('#fffaf0', j); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx, y0 - dy); g.lineTo(x0 + S + dx, y0 - dy); g.lineTo(x0 + S, y0); g.closePath(); g.fill(); /* atas (hangat) */
        }
      }
    }
    /* AO lembut di bagian bawah + rona biru-cyan, lalu kilau emas tipis di atas */
    g.globalCompositeOperation = 'source-atop';
    var lg = g.createLinearGradient(0, 0, 0, Ht); lg.addColorStop(0, 'rgba(255,226,150,.16)'); lg.addColorStop(.45, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(96,180,235,.42)');
    g.fillStyle = lg; g.fillRect(0, 0, W, Ht);
    return c;
  }

  /* ubin bintang (canvas 2D, digambar sekali): titik kecil acak + beberapa yang lebih terang */
  var STAR_URL = '';
  function starTile() {
    if (STAR_URL) return STAR_URL;
    var c = document.createElement('canvas'); c.width = 640; c.height = 360; var g = c.getContext('2d'), r = rng(21), i, x, y, a, z;
    for (i = 0; i < 130; i++) { x = r() * 640; y = r() * 360; z = r(); a = .35 + r() * .55; g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; g.fillRect(x, y, z > .9 ? 3 : (z > .55 ? 2 : 1), z > .9 ? 3 : (z > .55 ? 2 : 1)); }
    for (i = 0; i < 9; i++) { x = r() * 640; y = r() * 360; var gr = g.createRadialGradient(x, y, 0, x, y, 7); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(180,210,255,0)'); g.fillStyle = gr; g.fillRect(x - 7, y - 7, 14, 14); }
    return (STAR_URL = c.toDataURL('image/png'));
  }

  function lowEnd() { try { return (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2; } catch (e) { return false; } }

  function mount(container, opts) {
    container = container || document.body;
    opts = opts || {};
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in opts) if (k !== 'effects') o[k] = opts[k];
    var fx = {}; for (k in DEFAULTS.effects) fx[k] = DEFAULTS.effects[k];
    if (opts.effects) for (k in opts.effects) fx[k] = opts.effects[k];

    var el = document.createElement('div'); el.className = 'sbg' + (o.preset === 'soft' ? ' soft' : '') + (lowEnd() ? ' lite' : '');
    el.setAttribute('aria-hidden', 'true');
    if (o.image) { var img = new Image(); img.className = 'sbg-img'; img.alt = ''; img.decoding = 'async'; img.draggable = false; img.src = o.image; el.appendChild(img); }
    else el.className += ' sbg-black';
    [['sky', 'sbg-sky'], ['fog', 'sbg-fog'], ['sun', 'sbg-sun'], ['rays', 'sbg-rays'], ['bloom', 'sbg-bloom']].forEach(function (p) {
      if (fx[p[0]]) { var d = document.createElement('div'); d.className = p[1]; el.appendChild(d); }
    });
    /* suasana malam (assets/js/ambience.js): bintang + bulan; tersembunyi di siang hari lewat CSS */
    if (fx.sky) { var st = document.createElement('div'); st.className = 'sbg-stars'; try { st.style.backgroundImage = 'url(' + starTile() + ')'; } catch (e) {} el.appendChild(st); var mn = document.createElement('div'); mn.className = 'sbg-moon'; el.appendChild(mn); }
    var layer = document.createElement('div'); layer.className = 'sbg-clouds';
    /* fase berbasis jam dinding -> awan melanjutkan posisinya saat pindah halaman (tidak "reset") */
    var now = Date.now() / 1000;
    /* lights (opsional) */
    var lightsEl = null, LS = o.lights && LIGHTSETS[o.lights];
    if (LS) {
      lightsEl = document.createElement('div'); lightsEl.className = 'sbg-lights';
      LS.items.forEach(function (it) {
        var d = document.createElement('i'); d.className = 'sbg-light ' + it.t; d.style.setProperty('--dl', it.dl + 's');
        d.appendChild(document.createElement('b')); lightsEl.appendChild(d); it.el = d;
      });
      el.appendChild(lightsEl);
      var place = function () {
        var vw = el.clientWidth || innerWidth, vh = el.clientHeight || innerHeight, k = Math.max(vw / LS.w, vh / LS.h);
        LS.items.forEach(function (it) {
          var px = vw / 2 + (it.x - .5) * LS.w * k, py = (vh - LS.h * k) * .72 + it.y * LS.h * k, sz = it.r * LS.w * k * 2;
          it.el.style.cssText += ';left:' + px.toFixed(1) + 'px;top:' + py.toFixed(1) + 'px;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px';
        });
      };
      place(); window.addEventListener('resize', place);
    }
    var slow = +o.cloudSlow || 1;
    var cloudList = o.cloudSet === 'far' ? CLOUDS.filter(function (c) { return c.k <= .5; }) : CLOUDS;   /* far = hanya awan kecil di kejauhan */
    cloudList.slice(0, Math.max(0, Math.min(cloudList.length, o.clouds | 0))).forEach(function (c0, n) {
      var c = {}; for (var kk in c0) c[kk] = c0[kk]; c.d = c0.d * slow;
      var cv = cloudSprite(c.seed); cv.className = 'sbg-cloud';
      var st = cv.style, pos = ((now + c.ph * c.d) % c.d);
      st.setProperty('--k', c.k); st.setProperty('--t', c.t); st.setProperty('--o', c.o); st.setProperty('--d', c.d + 's');
      st.setProperty('--b', c.b + 'px'); st.setProperty('--dl', (-pos).toFixed(2) + 's'); st.setProperty('--x', (10 + n * 19) % 80);
      layer.appendChild(cv);
    });
    el.appendChild(layer);
    container.insertBefore(el, container.firstChild);
    document.documentElement.classList.add('sbg-on');
    return { el: el, destroy: function () { if (el.parentNode) el.parentNode.removeChild(el); document.documentElement.classList.remove('sbg-on'); } };
  }

  UT.SceneBG = { mount: mount, defaults: DEFAULTS };

  /* auto-mount: <script data-auto data-preset="soft">
     Halaman yang dibuka sebagai embed (?embed=1, mis. tab di hadiah-misi.html) TIDAK memasang latar sendiri:
     latar milik halaman induk, supaya semua tab memakai satu latar yang sama. */
  var me = document.currentScript;
  var isEmbed = /[?&]embed=1/.test(location.search);
  if (me && me.hasAttribute('data-auto') && !isEmbed) {
    var cfg = { preset: me.getAttribute('data-preset') || 'full' };
    if (me.getAttribute('data-lights')) cfg.lights = me.getAttribute('data-lights');
    if (me.getAttribute('data-clouds-set')) cfg.cloudSet = me.getAttribute('data-clouds-set');
    if (me.getAttribute('data-cloud-slow')) cfg.cloudSlow = me.getAttribute('data-cloud-slow');
    if (me.getAttribute('data-image')) cfg.image = me.getAttribute('data-image');
    var go = function () { if (!document.body) return false; UT.SceneBG.instance = mount(document.body, cfg); return true; };
    if (!go()) {
      var mo = new MutationObserver(function () { if (go()) mo.disconnect(); });
      mo.observe(document.documentElement, { childList: true });
    }
  }
})();
