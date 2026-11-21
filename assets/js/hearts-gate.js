/* Hearts gate — lapisan UI tipis di atas UT.HeartsService (assets/js/services/hearts-service.js), khusus browser.
   Dipakai SEMUA jalur yang memulai match: RoomFlow.launch (Quick Start / VS Computer / Create Room / Online),
   serta "Mulai ulang" & "Main lagi" di gameplay. Satu pintu = aturan hati tidak bisa terlewat di salah satu jalur.

     UT.HeartsGate.spend()   -> Promise<boolean>  potong 1 hati di server; false + modal "Hati habis" bila habis.
     UT.HeartsGate.guard()   -> boolean           cek cepat TANPA memotong (untuk tombol Ready/Start); modal bila habis.
     UT.HeartsGate.showEmpty()                    modal "Hati habis" dengan hitung mundur hidup.

   Kebijakan: hanya 'hati-habis' yang memblokir. Gagal jaringan / belum login = lolos (server tidak bisa dipastikan; hati hanya
   batas lunak, bukan mata uang), tamu/lokal = tanpa batas (HeartsService.enabled() false). */
(function (g) {
  'use strict';
  var UT = g.UT = g.UT || {};
  if (UT.HeartsGate) return;

  function svc() { try { return UT.HeartsService && UT.HeartsService.get && UT.HeartsService.get(); } catch (e) { return null; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(s) { s = Math.max(0, Math.ceil(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }

  var CSS = '#hgate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(8,5,12,.62);font-family:var(--font-body,system-ui,sans-serif)}' +
    '#hgate[hidden]{display:none}' +
    '#hgate .hg{min-width:min(86vw,360px);max-width:92vw;padding:22px 26px 20px;text-align:center;color:#fff;border-radius:16px;background:linear-gradient(180deg,#2a1f2e,#17111b);border:3px solid #f2b632;box-shadow:0 10px 40px rgba(0,0,0,.6),inset 0 0 0 2px rgba(0,0,0,.4)}' +
    '#hgate svg{width:64px;height:58px;filter:drop-shadow(0 3px 2px rgba(0,0,0,.55))}' +
    '#hgate h3{margin:8px 0 4px;font:400 28px/1.1 var(--font-title,inherit);color:#ffd45a;text-shadow:0 2px 0 rgba(0,0,0,.6)}' +
    '#hgate p{margin:4px 0;font-size:16px;line-height:1.35;color:#e9e2ee}' +
    '#hgate .hgt{display:block;margin:8px 0 14px;font:400 34px/1 var(--font-title,inherit);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.6);letter-spacing:1px}' +
    '#hgate button{min-width:140px;padding:10px 22px;border:0;border-radius:10px;font:400 22px/1 var(--font-title,inherit);color:#1a1205;background:linear-gradient(180deg,#ffe07a,#f2b632);box-shadow:0 3px 0 #9a6a10;cursor:pointer}' +
    '#hgate button:active{transform:translateY(2px);box-shadow:0 1px 0 #9a6a10}';

  var el = null, timer = 0, offChange = null;

  function build() {
    if (el) return el;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'hgate'; el.hidden = true;
    el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Hati habis');
    el.innerHTML = '<div class="hg">' +
      '<svg viewBox="0 0 32 29" aria-hidden="true"><defs><linearGradient id="hgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a7a86"/><stop offset="1" stop-color="#3a3a44"/></linearGradient></defs>' +
      '<path d="M16 27.5C6 20 1.5 14.6 1.5 8.9 1.5 4.6 4.8 1.5 8.9 1.5c3 0 5.5 1.7 7.1 4.4 1.6-2.7 4.1-4.4 7.1-4.4 4.1 0 7.4 3.1 7.4 7.4 0 5.7-4.5 11.1-14.5 18.6z" fill="url(#hgg)" stroke="#16161c" stroke-width="2" stroke-linejoin="round"/></svg>' +
      '<h3>Hati habis</h3><p id="hgmsg">Hati berikutnya terisi dalam</p><span class="hgt" id="hgt">--:--</span>' +
      '<button type="button" id="hgok">OKE</button></div>';
    document.body.appendChild(el);
    el.querySelector('#hgok').addEventListener('click', hide);
    el.addEventListener('click', function (e) { if (e.target === el) hide(); });
    return el;
  }
  function hide() {
    if (!el) return;
    el.hidden = true; clearInterval(timer); timer = 0;
    if (offChange) { offChange(); offChange = null; }
  }
  function tick() {
    var H = svc(); if (!H || !el) return;
    var s = H.snapshot(), t = el.querySelector('#hgt'), m = el.querySelector('#hgmsg');
    if (s.hearts > 0) { m.textContent = 'Hati sudah terisi! Silakan main lagi.'; t.textContent = '♥ ' + s.hearts; }
    else { m.textContent = 'Hati berikutnya terisi dalam'; t.textContent = mmss(s.nextInSecs); }
  }
  function showEmpty() {
    if (typeof document === 'undefined' || !document.body) return;
    build(); el.hidden = false; tick();
    clearInterval(timer); timer = setInterval(tick, 1000);
    var H = svc(); if (H && H.onChange && !offChange) offChange = H.onChange(tick);
    var b = el.querySelector('#hgok'); if (b && b.focus) b.focus();
  }

  /* Cek cepat dari proyeksi lokal (tanpa memotong). false = tampilkan modal. */
  function guard() {
    var H = svc();
    if (!H || !H.enabled() || H.canPlay()) return true;
    showEmpty(); return false;
  }

  /* Potong 1 hati di server. true = boleh mulai match. */
  function spend() {
    var H = svc();
    if (!H || !H.enabled()) return Promise.resolve(true);
    return H.consume().then(function (r) {
      if (r && r.ok) return true;
      if (r && r.reason === 'hati-habis') { showEmpty(); return false; }
      if (r && r.reason === 'sedang-diproses') return false;   /* ketukan ganda: permintaan pertama yang menentukan */
      return true;                                              /* jaringan/belum login: tidak bisa dipastikan -> lolos */
    }, function () { return true; });
  }

  UT.HeartsGate = { spend: spend, guard: guard, showEmpty: showEmpty, hide: hide, mmss: mmss };
})(typeof window !== 'undefined' ? window : this);
