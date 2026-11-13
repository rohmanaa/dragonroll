/* Ular Tangga Blok — gameplay/js/afk.js (Stage 4.1.15: timer AFK / auto-action; CP4b: hold + pending action)
   Skrip klasik (tanpa import/export). Dimuat SEBELUM gameplay/js/ready.js dan blok skrip gameplay inline.
   HANYA manajer timer: satu timer aktif per id (start dengan id yang sama menggantikan yang lama),
   tidak ada state gameplay, tidak menyentuh DOM selain MEMBACA status overlay. Aman bila dimuat berkali-kali.
     UT.GameplayAFK.start(id, ms, onTimeout, onTick) -> id   (onTick(detikSisa) tiap detik berubah)
     UT.GameplayAFK.clear(id) / clearAll() / has(id) / remaining(id) (detik) / held() (true bila sedang ditahan)
   CP4b HOLD: semua timer manajer ini DITAHAN (tidak tick, tidak menembak) selama tab tersembunyi
     (document.visibilityState==='hidden') ATAU overlay "Putar HP" (#ut-rotate.on dari landscape.js) tampil.
     Saat bebas lagi, sisa waktu dilanjutkan persis (end digeser selama ditahan). Tidak ada timer kedua.
   CP4b PENDING ACTION (generik, belum dipakai gameplay mana pun — untuk aksi masa depan yang butuh input pemain):
     var h = UT.GameplayAFK.pending.open({ id:'power-target', type:'power', owner:playerIdx, ms:15000,
                                           fallback:function(){...aksi aman...}, cleanup:function(){...tutup modal...},
                                           valid:function(){ return gid===gameId; } });
     h.complete(result)  — jalur manual; SATU-KALI: menghentikan timer, menjalankan cleanup, return true. Kedua kali -> false.
     timeout             — SATU-KALI: bila valid() (opsional) true -> fallback(), lalu cleanup(). Setelah complete(), fallback TIDAK jalan.
     h.cancel()          — batalkan tanpa fallback (cleanup tetap jalan). pending.clearAll() dipanggil dari clearAll()
                           (restart / pagehide) -> semua pending ditutup tanpa fallback. pending.current(id)/has(id) untuk cek.
     open() dengan id sama menggantikan pending lama (yang lama di-cancel tanpa fallback). Timer memakai manajer ini (id 'pending:'+id)
     sehingga ikut ditahan saat tab hidden / Putar HP. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayAFK && UT.GameplayAFK.start) return;
  var T = {}; /* id -> {h, end, last, cb, tick} */
  var heldAt = 0; /* 0 = tidak ditahan; selain itu = waktu mulai ditahan */

  function blocked() {
    try {
      if (win.document && win.document.visibilityState === 'hidden') return true;
      var ro = win.document && win.document.getElementById('ut-rotate'); /* overlay "Putar HP" (assets/js/landscape.js) */
      return !!(ro && ro.classList && ro.classList.contains('on'));
    } catch (e) { return false; }
  }
  /* Satu-satunya titik status hold: mulai ditahan -> catat; bebas -> geser end semua timer sebesar lama ditahan. */
  function sync() {
    var b = blocked(), now = Date.now();
    if (b && !heldAt) heldAt = now;
    else if (!b && heldAt) {
      var d = now - heldAt; heldAt = 0;
      Object.keys(T).forEach(function (k) { T[k].end += d; });
    }
    return !!heldAt;
  }

  function clear(id) { var t = T[id]; if (!t) return false; clearInterval(t.h); delete T[id]; return true; }
  function start(id, ms, onTimeout, onTick) {
    clear(id); sync();
    var base = heldAt || Date.now(); /* dibuat saat ditahan: dihitung mulai saat ditahan, jadi tepat ms setelah lanjut */
    var t = T[id] = { end: base + ms, last: -1, cb: onTimeout, tick: onTick };
    function step() {
      if (T[id] !== t) return;
      if (sync()) return; /* ditahan: tidak tick, tidak menembak */
      var left = Math.max(0, t.end - Date.now()), s = Math.ceil(left / 1000);
      if (s !== t.last) { t.last = s; if (t.tick) { try { t.tick(s); } catch (e) { console.error(e); } } }
      if (left <= 0) { clear(id); try { if (t.cb) t.cb(); } catch (e) { console.error(e); } }
    }
    t.h = setInterval(step, 200); step();
    return id;
  }
  function remaining(id) { var t = T[id]; return t ? Math.max(0, Math.ceil((t.end - (heldAt || Date.now())) / 1000)) : 0; }

  /* ---- Pending action generik (idempotent, satu-kali) ---- */
  var P = {}; /* id -> record */
  function settle(rec, runFallback) {
    if (rec.done) return false;
    rec.done = true; clear('pending:' + rec.id); if (P[rec.id] === rec) delete P[rec.id];
    if (runFallback) {
      var ok = true; try { if (rec.valid) ok = !!rec.valid(); } catch (e) { ok = false; }
      if (ok && rec.fallback) { try { rec.fallback(); } catch (e) { console.error(e); } }
    }
    if (rec.cleanup) { try { rec.cleanup(); } catch (e) { console.error(e); } }
    return true;
  }
  function pendingOpen(o) {
    o = o || {}; var id = String(o.id || 'pending');
    if (P[id]) settle(P[id], false); /* pengganti: yang lama ditutup tanpa fallback */
    var rec = { id: id, type: o.type || null, owner: o.owner, fallback: o.fallback, cleanup: o.cleanup, valid: o.valid, done: false };
    P[id] = rec;
    start('pending:' + id, o.ms > 0 ? o.ms : 15000, function () { settle(rec, true); });
    return {
      id: id, type: rec.type, owner: rec.owner,
      complete: function (result) { rec.result = result; return settle(rec, false); },
      cancel: function () { return settle(rec, false); },
      get done() { return rec.done; }
    };
  }
  var pending = {
    open: pendingOpen,
    has: function (id) { return !!P[id]; },
    current: function (id) { var r = P[id]; return r ? { id: r.id, type: r.type, owner: r.owner } : null; },
    clearAll: function () { Object.keys(P).forEach(function (k) { settle(P[k], false); }); }
  };

  function clearAll() { pending.clearAll(); Object.keys(T).forEach(clear); }
  try {
    win.addEventListener('pagehide', clearAll);
    win.document.addEventListener('visibilitychange', sync);
    win.addEventListener('resize', sync); win.addEventListener('orientationchange', sync);
  } catch (e) {}
  UT.GameplayAFK = { start: start, clear: clear, clearAll: clearAll, has: function (id) { return !!T[id]; }, remaining: remaining, held: sync, pending: pending };
})(window);
