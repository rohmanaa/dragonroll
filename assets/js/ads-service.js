/* Iklan berhadiah (rewarded ad) — lapisan tipis di atas penyedia iklan.
   Kontrak provider:  provider.show() -> Promise<{completed:boolean}>   (completed=true hanya bila iklan ditonton sampai selesai)
   Layanan ini hanya menghasilkan TOKEN klaim unik per tayangan; nominal hadiah ditentukan SERVER (claim_ad_reward).
   Provider bawaan = SIMULASI (overlay hitung mundur) untuk pengembangan. Untuk produksi pasang SDK nyata:
       UT.Ads.setProvider({ show: () => adSdk.showRewarded().then(ok => ({ completed: !!ok })) });
   Catatan keamanan: sampai server memverifikasi lewat callback jaringan iklan (SSV), token ini belum bukti iklan ditonton;
   server hanya membatasi jumlah klaim (lihat supabase/migrations/202611120001_wallet_b6_ad_reward.sql). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.Ads = api.create({ provider: api.mockProvider() }); root.UT.AdsFactory = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function makeToken() {   /* cocok dengan ^[A-Za-z0-9_-]{8,64}$ di server */
    var r = '', abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 10; i++) r += abc.charAt(Math.floor(Math.random() * abc.length));
    return 'ad-' + Date.now().toString(36) + '-' + r;
  }

  /* Provider simulasi: overlay layar penuh, tombol Tutup aktif setelah `secs` detik. Menutup lebih awal = tidak selesai. */
  function mockProvider(secs) {
    secs = secs || 5;
    return {
      mock: true,
      show: function () {
        return new Promise(function (resolve) {
          if (typeof document === 'undefined') return resolve({ completed: true });
          var left = secs, el = document.createElement('div');
          el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Iklan simulasi');
          el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b1020;color:#fff;display:grid;place-items:center;text-align:center;font:700 3rem/1.3 system-ui,sans-serif';
          el.innerHTML = '<div><div style="opacity:.7;font-size:2rem">IKLAN SIMULASI (mode pengembangan)</div>' +
            '<div id="ut-ad-n" style="font-size:9rem;margin:2rem 0">' + left + '</div>' +
            '<button id="ut-ad-x" style="font:inherit;padding:1rem 3rem;border-radius:1.5rem;border:0;background:#445;color:#aab">Tutup</button></div>';
          document.body.appendChild(el);
          var n = el.querySelector('#ut-ad-n'), x = el.querySelector('#ut-ad-x');
          function done(ok) { clearInterval(t); el.remove(); resolve({ completed: ok }); }
          var t = setInterval(function () {
            left--; n.textContent = Math.max(left, 0);
            if (left <= 0) { x.textContent = 'Ambil Hadiah'; x.style.background = '#2fa84f'; x.style.color = '#fff'; clearInterval(t); }
          }, 1000);
          x.addEventListener('click', function () { done(left <= 0); });
        });
      }
    };
  }

  function create(deps) {
    var provider = (deps && deps.provider) || null, busy = false;
    return {
      setProvider: function (p) { provider = p; },
      isMock: function () { return !!(provider && provider.mock); },
      /* Tayangkan iklan. -> {ok:true, token} bila selesai; {ok:false, reason:'dibatalkan'|'tidak-tersedia'|'sedang-diproses'|'gagal'} */
      show: async function () {
        if (!provider || typeof provider.show !== 'function') return { ok: false, reason: 'tidak-tersedia' };
        if (busy) return { ok: false, reason: 'sedang-diproses' };
        busy = true;
        try {
          var r = await provider.show();
          return (r && r.completed === true) ? { ok: true, token: makeToken() } : { ok: false, reason: 'dibatalkan' };
        } catch (e) { return { ok: false, reason: 'gagal' }; }
        finally { busy = false; }
      }
    };
  }
  return { create: create, mockProvider: mockProvider, makeToken: makeToken };
});
