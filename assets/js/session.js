/* UT.Session — SATU pintu ke sesi login yang di-cache di localStorage["ut-auth"] ({id, username}).
   Tahap 6e: boot-guard.js, player-data.js, auth.js, dan profile.html tidak lagi membaca/menulis key itu sendiri.
   Skrip klasik kecil tanpa dependensi, dimuat PALING AWAL (sebelum boot-guard.js). Ini hanya cache tampilan:
   kebenaran sesi tetap dari Supabase Auth (auth.js -> check()). Tanpa session.js, semua pembaca menganggap "belum login". */
(function (g) {
  'use strict';
  var UT = g.UT = g.UT || {};
  if (UT.Session) return;
  var KEY = 'ut-auth';
  function read() {
    try {
      var a = JSON.parse(g.localStorage.getItem(KEY) || 'null');
      return (a && typeof a === 'object' && !Array.isArray(a)) ? a : null;
    } catch (e) { return null; }
  }
  /* id akun yang valid (dipakai sebagai bagian kunci penyimpanan per akun); '' = belum login */
  function id() { var a = read(); return (a && typeof a.id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(a.id)) ? a.id : ''; }
  function username() { var a = read(); return (a && typeof a.username === 'string') ? a.username : ''; }
  function write(u) { try { g.localStorage.setItem(KEY, JSON.stringify(u)); return true; } catch (e) { return false; } }
  function clear() { try { g.localStorage.removeItem(KEY); } catch (e) {} }
  UT.Session = { KEY: KEY, read: read, id: id, username: username, loggedIn: function () { return !!read(); }, write: write, clear: clear };
})(typeof window !== 'undefined' ? window : this);
