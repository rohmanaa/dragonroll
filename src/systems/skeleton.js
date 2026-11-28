/* skeleton.js — sistem "item memuat" ala COC: kerangka UI langsung tampil, tiap gambar item yang belum tiba menampilkan placeholder kilap,
   lalu fade-in saat gambarnya siap. Berlaku otomatis untuk SEMUA <img> (juga yang dibuat JS belakangan) lewat MutationObserver.
   - Gambar yang sudah ada di cache/langsung siap TIDAK berkedip: placeholder baru muncul bila gambar masih belum siap setelah DELAY ms.
   - Dikecualikan: img di #ov / #gl (layar muat) dan yang bertanda data-no-sk.
   - Gambar gagal dimuat -> placeholder dilepas (tidak berputar selamanya).
   Ditambahkan ke setiap halaman lewat UT.PageShell.renderBase (opsi skeleton, bawaan aktif). Gaya: src/styles/components/skeleton.css.
   Skrip klasik; di Node (module.exports) untuk tes: create(deps). Batasan: gambar tanpa ukuran dari CSS (0x0 saat memuat) tidak menampakkan kotak placeholder. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; if (!root.UT.Skeleton) { root.UT.Skeleton = api.create({}); root.UT.Skeleton.create = api.create; } }
})(typeof window !== 'undefined' ? window : null, function (G) {
  'use strict';
  var DELAY = 90, SKIP = '#ov,#gl,[data-no-sk]';

  function create(deps) {
    var g = deps.G || G || {}, doc = deps.document || g.document, delay = deps.delay == null ? DELAY : deps.delay;
    var timer = 0, queue = [], started = false, mo = null;

    function eligible(img) {
      if (!img || img.tagName !== 'IMG' || img.__utSk) return false;
      if (img.complete && (img.naturalWidth > 0 || !img.getAttribute || !img.getAttribute('src'))) return false;
      try { if (img.closest && img.closest(SKIP)) return false; } catch (e) {}
      return true;
    }
    function finish(img, shown) {
      img.removeEventListener('load', img.__utSk.onLoad); img.removeEventListener('error', img.__utSk.onErr);
      var cl = img.classList; cl.remove('ut-sk');
      if (shown) {
        cl.add('ut-sk-in');
        var done = function () { cl.remove('ut-sk-in'); img.removeEventListener('animationend', done); };
        img.addEventListener('animationend', done); setTimeout(done, 400);
      }
      img.__utSk = null;
    }
    function watch(img) {
      var st = img.__utSk = { shown: false };
      st.onLoad = function () { finish(img, st.shown); };
      st.onErr = function () { finish(img, false); };
      img.addEventListener('load', st.onLoad); img.addEventListener('error', st.onErr);
      queue.push(img); if (!timer) timer = setTimeout(flush, delay);
    }
    /* setelah DELAY: gambar yang masih belum siap mendapat placeholder; yang sudah siap dilepas tanpa efek */
    function flush() {
      timer = 0; var list = queue; queue = [];
      list.forEach(function (img) {
        var st = img.__utSk; if (!st) return;
        if (img.complete) { finish(img, false); return; }
        st.shown = true; img.classList.add('ut-sk');
      });
    }
    function scan(node) {
      if (!node || node.nodeType !== 1) return;
      if (node.tagName === 'IMG') { if (eligible(node)) watch(node); return; }
      if (node.querySelectorAll) Array.prototype.forEach.call(node.querySelectorAll('img'), function (im) { if (eligible(im)) watch(im); });
    }
    function start() {
      if (started || !doc) return; started = true;
      var Obs = g.MutationObserver; if (!Obs) return;
      mo = new Obs(function (recs) {
        recs.forEach(function (r) {
          Array.prototype.forEach.call(r.addedNodes || [], scan);
          if (r.type === 'attributes' && r.target && r.target.tagName === 'IMG') { var im = r.target; if (!im.__utSk && eligible(im)) watch(im); }
        });
      });
      var begin = function () { try { mo.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] }); scan(doc.documentElement); } catch (e) {} };
      if (doc.documentElement) begin(); else doc.addEventListener('DOMContentLoaded', begin, { once: true });
    }
    function stop() { if (mo) { mo.disconnect(); mo = null; } started = false; }
    return { start: start, stop: stop, scan: scan, flush: flush, eligible: eligible };
  }
  return { create: create };
});
if (typeof window !== 'undefined' && window.UT && window.UT.Skeleton) window.UT.Skeleton.start();
