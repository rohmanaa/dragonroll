/* Shared GL (SPA tahap 2) — satu WebGLRenderer + satu <canvas> untuk seluruh sesi.
   - acquire(owner, opts): halaman meminta renderer. State renderer direset ke default tiap acquire, jadi tidak ada kebocoran
     antar halaman (clear color, shadow map, tone mapping, viewport, scissor, autoClear, render target).
     opts.canvas  : <canvas> milik halaman; diganti kanvas bersama (id/class/style/aria disalin, posisi di DOM sama).
     opts.shadows : bool (bawaan true) -> shadowMap.enabled.  opts.onContextLost / opts.onContextRestored: callback pemilik.
   - release(owner): lepas milik halaman (kanvas dicabut dari DOM, daftar render dibuang, kanvas dibersihkan). Renderer TETAP hidup.
   - offscreen(): satu renderer kedua (preserveDrawingBuffer) untuk render ke gambar; dibuat sekali, dipakai ulang.
   - setQuality({maxPixelRatio, shadows}) · owner() · stats()
   Antialias hanya bisa ditentukan saat konteks dibuat: mati di HP, hidup di desktop (sama seperti sebelumnya).
   Skrip klasik; dapat dimuat di browser (window.UT.SharedGL) maupun Node (module.exports) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.SharedGL = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function isMobile(G) {
    try {
      var n = G.navigator || {};
      return n.maxTouchPoints > 0 && /Mobi|Android|iPhone|iPad/i.test(n.userAgent || '');
    } catch (e) { return false; }
  }

  function create(deps) {
    deps = deps || {};
    var G = deps.G || (typeof window !== 'undefined' ? window : globalThis);
    var T = function () { return deps.THREE || G.THREE; };
    var D = function () { return deps.document || G.document; };

    var renderer = null, canvas = null, defaults = null;
    var cur = null;                       // { owner, opts }
    var off = null;                       // renderer offscreen
    var q = { maxPixelRatio: 0, shadows: null };
    var stat = { created: 0, acquires: 0, releases: 0, lost: 0, restored: 0 };

    function snapshotDefaults(r, THREE) {
      defaults = {
        toneMapping: r.toneMapping, toneMappingExposure: r.toneMappingExposure,
        outputEncoding: r.outputEncoding, outputColorSpace: r.outputColorSpace,
        sortObjects: r.sortObjects, localClippingEnabled: r.localClippingEnabled,
        shadowType: THREE.PCFSoftShadowMap
      };
    }

    function build() {
      var THREE = T();
      if (!THREE || !THREE.WebGLRenderer) throw new Error('SharedGL: THREE belum dimuat');
      canvas = D().createElement('canvas');
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile(G), alpha: true });
      stat.created++;
      snapshotDefaults(renderer, THREE);
      canvas.addEventListener('webglcontextlost', function (e) {
        stat.lost++;
        try { e.preventDefault(); } catch (_) { /* abaikan */ }
        if (cur && typeof cur.opts.onContextLost === 'function') { try { cur.opts.onContextLost(); } catch (_) { /* abaikan */ } }
      });
      canvas.addEventListener('webglcontextrestored', function () {
        stat.restored++;
        if (cur && typeof cur.opts.onContextRestored === 'function') { try { cur.opts.onContextRestored(); } catch (_) { /* abaikan */ } }
      });
    }

    /* kembalikan semua state yang boleh diubah halaman ke nilai awal */
    function reset(opts) {
      var THREE = T(), r = renderer;
      try { r.setRenderTarget(null); } catch (_) { /* abaikan */ }
      r.setClearColor(0x000000, 0);
      r.autoClear = true;
      if (r.setScissorTest) r.setScissorTest(false);
      if (r.setViewport && canvas) { try { r.setViewport(0, 0, canvas.width || 1, canvas.height || 1); } catch (_) { /* abaikan */ } }
      r.toneMapping = defaults.toneMapping;
      r.toneMappingExposure = defaults.toneMappingExposure;
      if ('outputEncoding' in r) r.outputEncoding = defaults.outputEncoding;
      if ('outputColorSpace' in r) r.outputColorSpace = defaults.outputColorSpace;
      r.sortObjects = defaults.sortObjects;
      r.localClippingEnabled = defaults.localClippingEnabled;
      r.shadowMap.type = defaults.shadowType;
      r.shadowMap.enabled = opts.shadows !== false && q.shadows !== false;
      if (q.maxPixelRatio > 0 && r.setPixelRatio) {
        r.setPixelRatio(Math.min((G.devicePixelRatio || 1), q.maxPixelRatio));
      } else if (r.setPixelRatio) {
        r.setPixelRatio(1);
      }
      void THREE;
    }

    /* kanvas halaman diganti kanvas bersama di posisi yang sama; atribut penting disalin */
    function place(pageCanvas) {
      if (!pageCanvas || pageCanvas === canvas) return;
      var par = pageCanvas.parentNode;
      if (pageCanvas.id) canvas.id = pageCanvas.id; else canvas.removeAttribute('id');
      canvas.className = pageCanvas.className || '';
      var st = pageCanvas.getAttribute && pageCanvas.getAttribute('style');
      if (st) canvas.setAttribute('style', st); else canvas.removeAttribute('style');
      var al = pageCanvas.getAttribute && pageCanvas.getAttribute('aria-label');
      if (al) canvas.setAttribute('aria-label', al); else canvas.removeAttribute('aria-label');
      if (par) par.replaceChild(canvas, pageCanvas);
    }

    function detach() {
      if (!canvas) return;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas.removeAttribute('id'); canvas.removeAttribute('style'); canvas.className = '';
    }

    function release(owner) {
      if (!cur || cur.owner !== owner) return false;
      cur = null;
      stat.releases++;
      try {
        renderer.setRenderTarget(null);
        if (renderer.renderLists && renderer.renderLists.dispose) renderer.renderLists.dispose();
        renderer.clear();
      } catch (_) { /* abaikan */ }
      detach();
      return true;
    }

    function acquire(owner, opts) {
      if (!owner) throw new Error('SharedGL.acquire: owner wajib');
      opts = opts || {};
      if (cur && cur.owner !== owner) release(cur.owner);   // satu pemilik pada satu waktu
      if (cur && cur.owner === owner) release(owner);
      if (!renderer) build();
      stat.acquires++;
      reset(opts);
      cur = { owner: owner, opts: opts };
      place(opts.canvas);
      return { renderer: renderer, canvas: canvas };
    }

    function offscreen(opts) {
      if (off) return off;
      var THREE = T();
      if (!THREE || !THREE.WebGLRenderer) throw new Error('SharedGL: THREE belum dimuat');
      opts = opts || {};
      off = new THREE.WebGLRenderer({ antialias: opts.antialias !== false, alpha: true, preserveDrawingBuffer: true });
      stat.created++;
      return off;
    }

    function setQuality(patch) {
      patch = patch || {};
      if (typeof patch.maxPixelRatio === 'number') q.maxPixelRatio = patch.maxPixelRatio;
      if (typeof patch.shadows === 'boolean') q.shadows = patch.shadows;
      if (renderer && cur) {
        if (q.maxPixelRatio > 0) renderer.setPixelRatio(Math.min((G.devicePixelRatio || 1), q.maxPixelRatio));
        if (q.shadows !== null) renderer.shadowMap.enabled = q.shadows;
      }
    }

    return {
      acquire: acquire,
      release: release,
      offscreen: offscreen,
      setQuality: setQuality,
      owner: function () { return cur ? cur.owner : null; },
      stats: function () { return { created: stat.created, acquires: stat.acquires, releases: stat.releases, lost: stat.lost, restored: stat.restored, owner: cur ? cur.owner : null }; }
    };
  }

  var api = create();
  api.create = create;
  return api;
});
