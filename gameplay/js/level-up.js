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

  /* Lencana perisai merah bersayap (webp). Alamat dihitung dari base dokumen agar benar di halaman mana pun. */
  var BADGE_SRC = 'assets/ng/komponen/hud/lencana-level-sayap.webp';
  function badgeUrl() { try { return new win.URL(BADGE_SRC, doc.baseURI).href; } catch (e) { return BADGE_SRC; } }

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
    var bi = doc.createElement('img'); bi.src = badgeUrl(); bi.alt = ''; bi.draggable = false; b.appendChild(bi);
    b.appendChild(mk('div', 'lu-modal__lvl-label', 'LEVEL'));
    b.appendChild(mk('div', 'lu-modal__lvl-num' + (lv >= 100 ? ' is-long' : ''), String(lv)));
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
