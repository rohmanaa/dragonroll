/* Ular Tangga Blok — gameplay/hud.js (Stage 4.0.9: Gameplay HUD + event feedback)
   Skrip klasik (tanpa import/export/type=module). Dimuat dari gameplay.html SEBELUM blok skrip gameplay.
   Hanya PRESENTASI: tidak mengubah state, dadu, gerak, aturan, power, atau perhitungan naga.
   gameplay.html tetap source of truth; HUD mengikuti event yang sudah ada (bukan sebaliknya).
   Pemisahan: UT.Hud (game/hud/) = komponen UI umum; UT.GameplayHUD (file ini) = feedback khusus gameplay.
   Tidak membuat render loop, audio, atau listener dokumen. Semua timer dibersihkan oleh reset().
   API:
     UT.GameplayHUD.init({getGameId:fn, isPaused:fn})   — sekali; dipakai untuk membuang feedback basi
     UT.GameplayHUD.reset()                             — game baru/diulang: bersihkan timer + sembunyikan
     UT.GameplayHUD.showTurn(player, {extra})           — "Giliran X" / "Giliran Computer" / "Giliran tambahan!"
     UT.GameplayHUD.showEvent(kind, text, {ttl, gid})   — LEVEL 1: banner kecil non-blocking (role=status)
     UT.GameplayHUD.showPower(key, name, who, {icon,desc,gid,text})  LEVEL 1: kartu Power (ikon, pemain, nama Power, efek) di stack; text = pesan satu baris
     UT.GameplayHUD.showCombat(att, def, text, {hp,maxHp,ttl,gid}) — strip combat + bar HP naga (opsional)
     UT.GameplayHUD.showResult(title, text, {ttl, gid}) — LEVEL 2: panel penting non-blocking (role=status)
     UT.GameplayHUD.updatePlayer(player)                — sinkronkan bar HP naga bila sedang tampil
   Feedback stack (Stage 4.1.14): semua feedback LEVEL 1 masuk ke SATU .feedback-stack (kolom, gap tetap => tidak overlap).
     Item baru muncul di ATAS (slide-down), item lama bergeser turun. Prioritas hanya presentasi, state ada di HUD ini:
     NORMAL    = kind 'turn' / 'extra' (showTurn)   maksimal 1 sekaligus: yang baru menggantikan yang lama, tidak menggusur IMPORTANT
     IMPORTANT = semua kind lain (ladder, snake, mob, power, shield, dragon, chest, bounce, info)   maksimal 3; lebih dari itu, yang TERLAMA dibuang
     Kartu Power memakai data Power milik gameplay (PUN) yang dikirim lewat opts; HUD tidak punya daftar Power sendiri.
   Semua teks lewat textContent (tanpa HTML string). Elemen informasi tidak diberi role=button/tabindex. */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayHUD) return;

  var STYLE_ID = 'ut-ghud-css';
  var ICON = { turn: '🎲', extra: '✨', ladder: '🪜', snake: '🐍', mob: '👾', chest: '🎁', power: '⚡', three6: '🎲',
               bounce: '↩️', shield: '🛡️', dragon: '🐉', info: 'ℹ️' };
  /* Ikon gambar untuk banner event (aset buatan sendiri, 256px). Jenis yang tidak ada di sini tetap memakai emoji di ICON.
     Emoji juga jadi cadangan bila gambar gagal dimuat. Ikon kustom dari pemanggil (o.icon) selalu dipakai apa adanya. */
  var IMG_DIR = 'assets/Images/icon/';
  var ICON_IMG = { turn: IMG_DIR + 'items/dadu.webp', three6: IMG_DIR + 'items/dadu.webp',
                   chest: IMG_DIR + 'lobby/invenotry.webp', power: IMG_DIR + 'items/power.webp' };
  var cfg = { getGameId: null, isPaused: null };
  var root = null, stack = null, panel = null, pTitle = null, pText = null,
      combat = null, cWho = null, cText = null, cBar = null, cFill = null, cHp = null;
  var tPanel = 0, tCombat = 0;
  var NORMAL = { turn: 1, extra: 1 };
  var live = [], MAX_IMPORTANT = 3; /* entri stack, terbaru di indeks 0 (= anak pertama DOM) */
  var combatOwner = null, combatBoss = 'Ender Dragon';

  function injectStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    var s = doc.createElement('style'); s.id = STYLE_ID;
    s.textContent =
      '.ut-ghud{position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:14;' +
      'width:min(92vw,420px);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}' +
      '.ut-ghud [hidden]{display:none!important}' +
      '.ut-ghud-b,.ut-ghud-c{box-sizing:border-box;max-width:100%;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:16px;' +
      'color:#fff;font-family:var(--font-display,"Baloo 2","Nunito",sans-serif);font-weight:800;font-size:14px;line-height:1.25;text-align:left;' +
      'background:linear-gradient(#3b9cf8,#2a86ee);box-shadow:0 4px 0 rgba(0,0,0,.45),inset 0 0 0 3px #ffe36a,0 6px 14px rgba(0,0,0,.25);' +
      'overflow-wrap:anywhere;animation:utghin .22s ease-out}' +
      '.ut-ghud-b i{font-style:normal;font-size:20px;line-height:1;flex:none}' +
      '.ut-ghud-b i>img{width:26px;height:26px;display:block;object-fit:contain;pointer-events:none;-webkit-user-drag:none}' +
      '.ut-ghud-b[data-k=snake],.ut-ghud-c{background:linear-gradient(#ef5a5a,#c93636)}' +
      '.ut-ghud-b[data-k=ladder]{background:linear-gradient(#4cc46a,#2f9f4d)}' +
      '.ut-ghud-b[data-k=mob]{background:linear-gradient(#a06be0,#7b45c4)}' +
      '.ut-ghud-b[data-k=three6],.ut-ghud-b[data-k=bounce]{background:linear-gradient(#ffb23f,#ee8a14)}' +
      '.ut-ghud-b[data-k=turn],.ut-ghud-b[data-k=extra]{font-size:13px;padding:6px 12px}' +
      '.ut-ghud-c{flex-direction:column;align-items:stretch;gap:4px;width:100%}' +
      '.ut-ghud-c p{margin:0}.ut-ghud-cw{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#ffe9e9}' +
      '.ut-ghud-bar{height:12px;border-radius:6px;background:rgba(0,0,0,.4);overflow:hidden;box-shadow:inset 0 0 0 2px rgba(0,0,0,.35)}' +
      '.ut-ghud-bar b{display:block;height:100%;width:100%;background:linear-gradient(#c9a2ff,#8f5fe0);transition:width .35s ease}' +
      '.ut-ghud-hp{font-size:12px;color:#f3e8ff}' +
      '.ut-ghud-p{box-sizing:border-box;width:100%;text-align:center;padding:14px 18px 16px;border-radius:22px;color:#fff;' +
      'background:linear-gradient(#3b9cf8,#2a86ee);box-shadow:0 7px 0 rgba(0,0,0,.5),inset 0 0 0 4px #ffe36a,0 0 24px rgba(255,210,77,.55);animation:utghpop .3s ease-out}' +
      '.ut-ghud-p h4{margin:0;font-family:var(--font-display,"Baloo 2",sans-serif);font-size:20px;color:#ffe36a;text-transform:uppercase;overflow-wrap:anywhere}' +
      '.ut-ghud-p p{margin:4px 0 0;font-size:13px;font-weight:700;overflow-wrap:anywhere}' +
      '.feedback-stack{box-sizing:border-box;width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}' +
      '.ut-ghud-pw{align-items:flex-start;padding:8px 14px}.ut-ghud-pw>i{font-size:26px}.ut-ghud-pw>i .puimg{width:34px;height:34px;display:block;object-fit:contain}' +
      '.ut-ghud-pw .c{display:flex;flex-direction:column;gap:1px;min-width:0}' +
      '.ut-ghud-pw .w{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#ffe36a}' +
      '.ut-ghud-pw .t{font-size:14px}.ut-ghud-pw .e{font-size:12px;font-weight:700;color:#e0f2ff}' +
      '@keyframes utghin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}' +
      '@keyframes utghpop{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}' +
      '@media(max-width:699px){.ut-ghud{top:calc(54px + env(safe-area-inset-top,0px))}.ut-ghud-b,.ut-ghud-c{font-size:13px;padding:7px 12px}}' +
      '@media(prefers-reduced-motion:reduce){.ut-ghud-b,.ut-ghud-c,.ut-ghud-p{animation:none}.ut-ghud-bar b{transition:none}}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  function el(tag, cls, parent) {
    var e = doc.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e;
  }

  function build() {
    if (root) return true;
    if (!doc.body) return false;
    injectStyle();
    root = el('div', 'ut-ghud', doc.body);
    root.id = 'utGameplayHud';
    /* Level 1: feedback stack non-blocking (item ditambah/dibuang oleh push/expire) */
    stack = el('div', 'feedback-stack ut-ghud-stack', root);
    stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); stack.setAttribute('aria-atomic', 'false');
    /* Combat strip */
    combat = el('div', 'ut-ghud-c', root); combat.hidden = true;
    combat.setAttribute('role', 'status'); combat.setAttribute('aria-live', 'polite');
    cWho = el('p', 'ut-ghud-cw', combat); cText = el('p', '', combat);
    cBar = el('div', 'ut-ghud-bar', combat); cBar.hidden = true; cFill = el('b', '', cBar);
    cHp = el('p', 'ut-ghud-hp', combat); cHp.hidden = true;
    /* Level 2: panel penting (otomatis hilang, tidak memblokir input => role=status, bukan dialog) */
    panel = el('div', 'ut-ghud-p', root); panel.hidden = true;
    panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'assertive');
    pTitle = el('h4', '', panel); pText = el('p', '', panel);
    return true;
  }

  function stale(o) {
    if (!o || o.gid === undefined || typeof cfg.getGameId !== 'function') return false;
    try { return cfg.getGameId() !== o.gid; } catch (e) { return false; }
  }
  function ttlOf(o, d) { var t = o && +o.ttl; return t > 0 ? t : d; }

  function reduced() { try { return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }

  /* Susunan stack berubah: item yang tersisa digeser halus dari posisi lama ke posisi baru (item baru masuk lewat CSS utghin). */
  function flip(mutate) {
    var before = [], i;
    for (i = 0; i < live.length; i++) before.push([live[i], live[i].n.getBoundingClientRect().top]);
    mutate();
    if (reduced()) return;
    for (i = 0; i < before.length; i++) {
      var e = before[i][0];
      if (live.indexOf(e) < 0 || !e.n.animate) continue;
      var d = before[i][1] - e.n.getBoundingClientRect().top;
      if (d) e.n.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
    }
  }
  function removeNow(e) {
    var i = live.indexOf(e); if (i < 0) return;
    clearTimeout(e.t); live.splice(i, 1);
    if (e.n.parentNode) e.n.parentNode.removeChild(e.n);
  }
  function expire(e) {
    var i = live.indexOf(e); if (i < 0) return;
    var n = e.n; clearTimeout(e.t); live.splice(i, 1);
    function done() { flip(function () { if (n.parentNode) n.parentNode.removeChild(n); }); }
    if (reduced() || !n.animate) return done();
    n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).onfinish = done;
  }
  function clearStack() {
    for (var i = 0; i < live.length; i++) clearTimeout(live[i].t);
    live.length = 0;
    if (stack) stack.textContent = '';
  }
  function push(k, fill, ttl) {
    var normal = !!NORMAL[k], e = { n: null, normal: normal, t: 0 };
    flip(function () {
      var i;
      if (normal) { for (i = 0; i < live.length; i++) if (live[i].normal) { removeNow(live[i]); break; } }
      var n = el('div', 'ut-ghud-b'); n.setAttribute('data-k', k); fill(n);
      stack.insertBefore(n, stack.firstChild);
      e.n = n; live.unshift(e);
      if (!normal) {
        var imp = 0;
        for (i = 0; i < live.length; i++) if (!live[i].normal && ++imp > MAX_IMPORTANT) { removeNow(live[i]); i--; }
      }
    });
    e.t = setTimeout(function () { expire(e); }, ttl);
  }
  function textCard(n, icon, text, imgSrc) {
    var i = el('i', '', n); i.setAttribute('aria-hidden', 'true'); i.textContent = icon;
    if (imgSrc) { /* gambar menggantikan emoji; bila gagal dimuat, kembali ke emoji */
      var im = doc.createElement('img'); im.alt = ''; im.draggable = false; im.src = imgSrc;
      im.onerror = function () { i.textContent = icon; };
      i.textContent = ''; i.appendChild(im);
    }
    el('span', '', n).textContent = String(text);
  }
  function powerCard(n, icon, who, title, eff, key) {
    n.className += ' ut-ghud-pw';
    var i = el('i', '', n); i.setAttribute('aria-hidden', 'true'); i.textContent = icon;
    var C = UT.Gameplay && UT.Gameplay.Config; if (key && C && C.PUIMG && C.PUIMG[key] && C.setPuIcon) C.setPuIcon(i, key, icon); /* gambar Power bila ada */
    var c = el('div', 'c', n);
    if (who) el('span', 'w', c).textContent = String(who);
    el('span', 't', c).textContent = title;
    if (eff) el('span', 'e', c).textContent = eff;
  }
  function hidePanel() { clearTimeout(tPanel); tPanel = 0; if (panel) panel.hidden = true; }
  function hideCombat() { clearTimeout(tCombat); tCombat = 0; combatOwner = null; if (combat) combat.hidden = true; }

  function retrigger(node) { node.hidden = true; void node.offsetWidth; node.hidden = false; }

  var H = {
    init: function (o) {
      o = o || {};
      if (typeof o.getGameId === 'function') cfg.getGameId = o.getGameId;
      if (typeof o.isPaused === 'function') cfg.isPaused = o.isPaused;
      build();
      return H;
    },
    reset: function () {
      clearStack(); hidePanel(); hideCombat();
      return H;
    },
    showEvent: function (kind, text, o) {
      if (!text || stale(o) || !build()) return H;
      var k = ICON[kind] ? kind : 'info', icon = (o && o.icon) || ICON[k];
      var imgSrc = (o && o.icon) ? null : (ICON_IMG[k] || null);
      push(k, function (n) { textCard(n, icon, text, imgSrc); }, ttlOf(o, 2000));
      return H;
    },
    showTurn: function (p, o) {
      if (!p) return H;
      if (o && o.extra) return H.showEvent('extra', 'Giliran tambahan!', { ttl: 1600 });
      return H.showEvent('turn', p.cpu ? 'Giliran Computer' : 'Giliran ' + p.name, { ttl: 1200 });
    },
    showPower: function (key, name, who, o) {
      o = o || {};
      var icon = o.icon || ICON.power;
      if (o.text) return H.showEvent('power', String(o.text), { ttl: 1800, icon: icon, gid: o.gid }); /* pesan kustom (mis. Power ditolak): satu baris */
      if (stale(o) || !build()) return H;
      /* Kartu Power: ikon + pemain + nama Power + efek, semua dari data yang dikirim gameplay (bukan Modal Chest #puCard). */
      var eff = o.desc ? String(o.desc) : '';
      eff = eff.charAt(0).toUpperCase() + eff.slice(1);
      push('power', function (n) { powerCard(n, icon, who, 'Menggunakan ' + (name || key), eff, key); }, ttlOf(o, 2400));
      return H;
    },
    showCombat: function (att, def, text, o) {
      if (stale(o) || !build()) return H;
      cWho.textContent = (att || '') + (def ? ' → ' + def : '');
      cText.textContent = text ? String(text) : '';
      var mx = (o && o.maxHp) || 100, hp = o && typeof o.hp === 'number' ? Math.max(0, Math.min(mx, o.hp)) : null;
      combatBoss = (o && o.bossName) || 'Ender Dragon';
      if (hp === null) { cBar.hidden = true; cHp.hidden = true; }
      else {
        cFill.style.width = Math.max(0, Math.min(100, hp / mx * 100)) + '%';
        cHp.textContent = combatBoss + ': ' + hp + '/' + mx; cBar.hidden = false; cHp.hidden = false;
      }
      combatOwner = o && o.owner ? o.owner : null;
      clearTimeout(tCombat); retrigger(combat);
      tCombat = setTimeout(hideCombat, ttlOf(o, 2200));
      return H;
    },
    showResult: function (title, text, o) {
      if (!title || stale(o) || !build()) return H;
      pTitle.textContent = String(title); pText.textContent = text ? String(text) : ''; pText.hidden = !text;
      hideCombat(); /* prioritas: Result/Victory > Dragon Combat — strip combat tidak menumpuk dengan panel hasil */
      clearTimeout(tPanel); retrigger(panel);
      tPanel = setTimeout(hidePanel, ttlOf(o, 2400));
      return H;
    },
    updatePlayer: function (p) {
      /* Hanya menyegarkan bar HP naga bila combat strip sedang tampil untuk pemain ini. */
      if (!p || !combat || combat.hidden || typeof p.dhp !== 'number') return H;
      if (combatOwner !== null && combatOwner !== p.name) return H;
      var mx = p.hpMax || 100;
      cFill.style.width = Math.max(0, Math.min(100, p.dhp / mx * 100)) + '%'; cHp.textContent = combatBoss + ': ' + p.dhp + '/' + mx;
      return H;
    }
  };

  UT.GameplayHUD = H;
})(window, document);
