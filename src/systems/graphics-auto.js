/* Grafik Auto — memilih tingkat grafik (low|normal|high|ultra) otomatis sesuai perangkat, lalu menurunkannya sendiri bila game berat.
   - "Auto" hanyalah preferensi LOKAL (UT.Prefs 'gfxAuto'); tingkat yang dipilih ditulis ke PlayerData.settings().graphics seperti pilihan manual,
     jadi seluruh kode yang sudah membaca graphics (aura, pet, dadu, gameplay, data-graphics) dan sinkron server tidak berubah.
   - detect(env): heuristik murni dari core CPU, RAM (deviceMemory), mobile, Save-Data. Dapat diuji di Node.
   - governor: setelah halaman tampil, ukur frame time (median) beberapa detik; bila < ±30 fps, turun satu tingkat (maks 2x per sesi,
     tidak pernah naik otomatis). Batas turun disimpan ('gfxAutoCap') sehingga detect berikutnya tidak melewatinya.
   - Klik tingkat manual di Pengaturan mematikan Auto (setEnabled(false)).
   API: create(G) · detect(env) · enabled() · setEnabled(on) · apply() · boot() · afterReady() · tier() · TIERS */
(function (root, factory) {
  var api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.GraphicsAuto = api; }
})(typeof window !== 'undefined' ? window : null, function (defaultG) {
  'use strict';

  var TIERS = ['low', 'normal', 'high', 'ultra'], PREF = 'gfxAuto', CAP = 'gfxAutoCap';
  var SLOW_MS = 34, SAMPLE_FRAMES = 90, SKIP_FRAMES = 12, MAX_DEMOTE = 2, MAX_SAMPLES = 4;

  function idx(t) { var i = TIERS.indexOf(t); return i < 0 ? 2 : i; }

  /* env: { cores, mem (GB, 0 = tidak diketahui), mobile, saveData } -> nama tingkat */
  function detect(env) {
    env = env || {};
    var cores = +env.cores || 4, mem = +env.mem || 0, mobile = !!env.mobile;
    if (env.saveData) return 'low';
    var t;
    if (mobile) {
      if ((mem && mem <= 2) || cores <= 2) t = 0;
      else if (cores <= 4 || (mem && mem <= 3)) t = 1;
      else if (cores >= 8 && mem >= 8) t = 3;
      else t = 2;
    } else {
      if (cores <= 2 || (mem && mem <= 2)) t = 1;
      else if (cores >= 8 && (mem === 0 || mem >= 8)) t = 3;
      else t = 2;
    }
    return TIERS[t];
  }

  function readEnv(G) {
    var n = G.navigator || {}, c = n.connection || {}, mobile = false;
    try { mobile = (n.maxTouchPoints > 0) && /Mobi|Android|iPhone|iPad/i.test(n.userAgent || ''); } catch (e) {}
    return { cores: n.hardwareConcurrency, mem: n.deviceMemory, mobile: mobile, saveData: !!c.saveData || /(^|-)2g$/.test(c.effectiveType || '') };
  }

  function create(G) {
    G = G || defaultG;
    var samples = 0, demoted = 0, timer = 0, booted = false;

    function UT() { return G.UT || {}; }
    function prefs() { return UT().Prefs; }
    function pd() { return G.PlayerData; }
    function getPref(k, d) { try { var v = prefs().get(k, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } }
    function setPref(k, v) { try { prefs().set(k, v); } catch (e) { /* abaikan */ } }

    var api = {
      TIERS: TIERS, detect: detect,

      enabled: function () { return getPref(PREF, false) === true; },

      /* tingkat yang sedang berlaku (hasil tulis ke PlayerData) */
      tier: function () { try { var g = pd().settings().graphics; return TIERS.indexOf(g) >= 0 ? g : 'high'; } catch (e) { return 'high'; } },

      /* tingkat yang akan dipilih Auto: heuristik, dibatasi hasil turun-sendiri sebelumnya */
      target: function () {
        var i = idx(detect(readEnv(G))), cap = getPref(CAP, null);
        if (typeof cap === 'number' && cap >= 0 && cap < i) i = cap;
        return TIERS[i];
      },

      apply: function () {
        if (!api.enabled()) return null;
        var t = api.target();
        if (t !== api.tier()) { try { pd().setSettings({ graphics: t }); } catch (e) { return null; } }
        return t;
      },

      setEnabled: function (on) {
        setPref(PREF, !!on);
        if (on) { setPref(CAP, null); demoted = 0; samples = 0; return api.apply(); }
        return null;
      },

      boot: function () { if (booted) return api.tier(); booted = true; return api.apply() || api.tier(); },

      /* turun satu tingkat; true bila berhasil */
      demote: function () {
        var i = idx(api.tier());
        if (i <= 0 || demoted >= MAX_DEMOTE) return false;
        demoted++; setPref(CAP, i - 1);
        try { pd().setSettings({ graphics: TIERS[i - 1] }); } catch (e) { return false; }
        return true;
      },

      /* ukur median frame time lalu panggil cb(ms); null bila tab tersembunyi/tak ada rAF */
      sample: function (cb) {
        var dts = [], last = 0, n = 0;
        if (!G.requestAnimationFrame) { cb(null); return; }
        (function f(t) {
          if (G.document && G.document.hidden) { cb(null); return; }
          if (last) { n++; var d = t - last; if (n > SKIP_FRAMES && d < 250) dts.push(d); }
          last = t;
          if (dts.length >= SAMPLE_FRAMES - SKIP_FRAMES) {
            dts.sort(function (a, b) { return a - b; }); cb(dts[dts.length >> 1]); return;
          }
          if (n > SAMPLE_FRAMES * 4) { cb(null); return; }
          G.requestAnimationFrame(f);
        })(0);
      },

      /* dipanggil shell tiap halaman selesai tampil: bila Auto aktif, ukur sebentar dan turunkan jika berat */
      afterReady: function () {
        if (!api.enabled() || samples >= MAX_SAMPLES || demoted >= MAX_DEMOTE || api.tier() === 'low') return;
        G.clearTimeout(timer);
        timer = G.setTimeout(function () {
          if (!api.enabled()) return;
          samples++;
          api.sample(function (ms) { if (ms && ms > SLOW_MS) api.demote(); });
        }, 2500);
      }
    };
    return api;
  }

  var api = create(defaultG);
  api.create = create;
  api.readEnv = readEnv;
  return api;
});
