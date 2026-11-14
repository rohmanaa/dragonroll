/* Ular Tangga Blok — gameplay/js/level-up.js
   Modal "Naik Level" (referensi: referensi/newgui/assets/penerapan/CyJ1Oe.png).
   Skrip klasik (tanpa import/export). Dimuat dari gameplay.html; CSS: gameplay/css/level-up.css (z-index tinggi).
   Pakai:  UT.LevelUp.show({ level: 3, rewards: [{icon:'assets/...webp', amount:60, label:'Energi'}], note: 'Energi maks naik ke 60', onClose: fn })
   - level   : wajib, angka level baru.
   - rewards : opsional; bagian "HADIAH" disembunyikan bila kosong (tidak ada hadiah karangan).
   - note    : opsional; teks cyan di bawah hadiah.
   Aman: semua teks lewat textContent. Satu modal aktif; panggilan baru menggantikan yang lama. Escape/Enter/klik Lanjut menutup. */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.LevelUp) return;

  var root = null, prevFocus = null, onCloseCb = null, keyFn = null;

  function mk(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Lencana perisai merah + sayap + panji + pita (SVG vektor: tajam di ukuran besar). */
  var BADGE_SVG =
    '<svg viewBox="0 0 580 440" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<defs>' +
    '<linearGradient id="luWing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfc6c0"/></linearGradient>' +
    '<linearGradient id="luGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset=".6" stop-color="#f5a623"/><stop offset="1" stop-color="#d9760f"/></linearGradient>' +
    '<linearGradient id="luRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5233f"/><stop offset="1" stop-color="#a3122c"/></linearGradient>' +
    '</defs>' +
    '<g id="luWingL" fill="url(#luWing)" stroke="#a89c96" stroke-width="3" stroke-linejoin="round">' +
    '<path d="M215 215 L20 20 L50 175 L8 150 L60 232 L18 235 L90 290 L60 308 L150 335 L215 300Z"/>' +
    '</g>' +
    '<use href="#luWingL" transform="translate(580 0) scale(-1 1)"/>' +
    '<path d="M205 70 L240 30 L262 120 L215 130Z" fill="#2b5cc4" stroke="#17327a" stroke-width="3"/>' +
    '<path d="M375 70 L340 30 L318 120 L365 130Z" fill="#2b5cc4" stroke="#17327a" stroke-width="3"/>' +
    '<path d="M240 330 L290 440 L340 330 L335 250 L245 250Z" fill="url(#luRed)" stroke="url(#luGold)" stroke-width="10" stroke-linejoin="round"/>' +
    '<path d="M290 40 C350 75 415 80 440 85 C440 190 425 275 290 345 C155 275 140 190 140 85 C165 80 230 75 290 40Z" fill="url(#luGold)" stroke="#b86a0c" stroke-width="4"/>' +
    '<path d="M290 70 C340 98 392 104 414 108 C414 195 402 258 290 318 C178 258 166 195 166 108 C188 104 240 98 290 70Z" fill="url(#luRed)" stroke="#ffe27a" stroke-width="5"/>' +
    '<path d="M290 12 L325 40 L308 72 L272 72 L255 40Z" fill="#e5233f" stroke="url(#luGold)" stroke-width="8" stroke-linejoin="round"/>' +
    '</svg>';

  function sparks(host) {
    for (var i = 0; i < 18; i++) {
      var s = doc.createElement('i');
      s.style.left = (Math.random() * 100).toFixed(1) + '%';
      s.style.top = (Math.random() * 85).toFixed(1) + '%';
      s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
      s.style.animationDuration = (2.4 + Math.random() * 2.4).toFixed(2) + 's';
      host.appendChild(s);
    }
  }

  function close() {
    if (!root) return;
    var el = root, cb = onCloseCb;
    root = null; onCloseCb = null;
    if (keyFn) { doc.removeEventListener('keydown', keyFn, true); keyFn = null; }
    el.classList.remove('is-in');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) { /* abaikan */ }
    prevFocus = null;
    if (typeof cb === 'function') { try { cb(); } catch (e) { if (win.console) win.console.error('[LevelUp] onClose', e); } }
  }

  function show(opts) {
    opts = opts || {};
    var lv = Math.floor(+opts.level);
    if (!isFinite(lv) || lv < 1) return false;
    if (root) { var old = root; root = null; if (old.parentNode) old.parentNode.removeChild(old); if (keyFn) doc.removeEventListener('keydown', keyFn, true); }

    prevFocus = doc.activeElement;
    onCloseCb = opts.onClose;

    var m = mk('div', 'lu-modal');
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'luTitle');
    var sp = mk('div', 'lu-modal__spark'); sp.setAttribute('aria-hidden', 'true'); sparks(sp); m.appendChild(sp);

    var t = mk('h2', 'lu-modal__title', 'Kamu naik level!'); t.id = 'luTitle'; m.appendChild(t);

    var b = mk('div', 'lu-modal__badge');
    b.innerHTML = BADGE_SVG; /* konstanta statis milik kita, bukan input pengguna */
    b.appendChild(mk('div', 'lu-modal__lvl-label', 'LEVEL'));
    b.appendChild(mk('div', 'lu-modal__lvl-num', String(lv)));
    m.appendChild(b);

    var rw = Array.isArray(opts.rewards) ? opts.rewards.filter(function (r) { return r && r.icon; }).slice(0, 5) : [];
    var rs = mk('section', 'lu-modal__rewards'); rs.hidden = !rw.length;
    rs.appendChild(mk('h3', null, 'Hadiah'));
    var sl = mk('div', 'lu-modal__slots');
    rw.forEach(function (r) {
      var s = mk('div', 'lu-modal__slot'), im = doc.createElement('img');
      im.src = String(r.icon); im.alt = r.label ? String(r.label) : ''; im.draggable = false; s.appendChild(im);
      if (r.amount != null) s.appendChild(mk('b', null, String(r.amount)));
      sl.appendChild(s);
    });
    rs.appendChild(sl); m.appendChild(rs);

    m.appendChild(mk('p', 'lu-modal__note', opts.note ? String(opts.note) : ''));

    var btn = mk('button', 'lu-modal__continue', 'Lanjut'); btn.type = 'button';
    btn.addEventListener('click', close);
    m.appendChild(btn);

    keyFn = function (e) {
      if (!root) return;
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); }
    };
    doc.addEventListener('keydown', keyFn, true);

    root = m;
    doc.body.appendChild(m);
    win.requestAnimationFrame(function () { win.requestAnimationFrame(function () { m.classList.add('is-in'); try { btn.focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }); });
    return true;
  }

  UT.LevelUp = { show: show, close: close, isOpen: function () { return !!root; } };
})(window, document);
