/* Ular Tangga Blok — gameplay/ready.js (Ready Screen pra-game: ACAK GILIRAN)
   Skrip klasik. Dimuat SETELAH gameplay/afk.js. Hanya presentasi + state urutan; tidak memuat logic gameplay.
     UT.GameplayReady.show(players, opts) -> Promise
        players: array objek pemain existing ({name,key,css,cpu,...}); modul menulis p.turnOrder (1..n), p.ready, p.autoReady.
        opts.face(p) -> url wajah (faceURL existing) ; opts.sfx(name) opsional ; opts.seconds (batas waktu memilih per pemain, default 10)
        opts.rng(): pengganti Math.random untuk uji.
     Alur:
       1. Muncul kartu sebanyak jumlah pemain, tertutup. Angka urutan (permutasi acak 1..n) sudah tersimpan di BELAKANG tiap kartu
          (posisi kiri-kanan tidak menentukan angka: bisa 1234, 1324, 2314, 4132, dst).
       2. Pemain memilih bergantian sesuai urutan kursi awal (pemain 1 dulu). Kartu yang sudah dipilih terkunci dan sedikit terangkat.
          Komputer memilih sendiri. Bila hanya tersisa satu kartu, kartu itu otomatis jadi milik pemain terakhir (tanpa menunggu).
          Pemain manusia yang diam sampai waktu habis dipilihkan kartu acak (tidak pernah stuck).
       3. Setelah semua kartu terpilih, semua kartu ter-flip menampilkan angka (besar) + nama pemain.
       4. Layar ditutup; resolve(array pemain berurutan sesuai giliran). p.turnOrder ditulis dari angka kartu yang sama.
     UT.GameplayReady.cancel() — tutup + bersihkan semua timer (restart/unload). */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayReady && UT.GameplayReady.show) return;
  var A = function () { return UT.GameplayAFK; };
  var root = null, run = null;

  var CSS = '#readyScreen{position:fixed;inset:0;z-index:40;display:flex;overflow:auto;background:rgba(27,42,59,.78);' +
    'padding:calc(12px + env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}' +
    '#readyScreen .rd-box{margin:auto;width:min(560px,100%);background:#2a211b;border:4px solid #0f0b08;border-radius:8px;padding:14px 12px 16px;text-align:center;color:#fff;' +
    'box-shadow:inset 0 0 0 3px #6b5440;font-family:var(--font-display,inherit)}' +
    '#readyScreen .rd-sub{margin:0 0 10px;font-size:11px;opacity:.85;min-height:1.3em}' +
    '#readyScreen .rd-time{display:inline-block;min-width:54px;margin:0 0 10px;padding:6px 12px;font-size:22px;font-weight:700;background:#0f0b08;border:3px solid #6b5440;border-radius:6px;color:#fff}' +
    '#readyScreen .rd-time.low{color:#ff6b6b}' +
    /* kartu: sisi depan = penutup kartu (tertutup), sisi belakang = angka urutan + nama. flip 3D; kartu terpilih sedikit terangkat. */
    '#readyScreen .rk-grid{display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,128px));justify-content:center;gap:10px;padding-top:12px}' +
    '#readyScreen .rk{position:relative;display:block;width:100%;height:clamp(120px,30vh,176px);padding:0;border:0;background:none;perspective:700px;cursor:default;font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}' +
    '#readyScreen .rk.avail{cursor:pointer}' +
    '#readyScreen .rk:focus-visible{outline:3px solid #FFC21A;outline-offset:3px;border-radius:10px}' +
    '#readyScreen .rk-in{position:absolute;inset:0;transform-style:preserve-3d;-webkit-transform-style:preserve-3d;transform:translateY(var(--lift,0px)) rotateY(var(--rot,0deg));' +
    'transition:transform .5s cubic-bezier(.3,1.3,.5,1) var(--dl,0ms)}' +
    '#readyScreen .rk.avail:hover{--lift:-5px}' +
    '#readyScreen .rk.picked{--lift:-10px}' +
    '#readyScreen .rk.revealed{--rot:180deg}' +
    '#readyScreen .rk-f,#readyScreen .rk-b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-width:0;' +
    'border:3px solid #0b1838;border-radius:10px;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}' +
    '#readyScreen .rk-f{background:repeating-linear-gradient(45deg,#2f5fc8 0 8px,#2a54b4 8px 16px);box-shadow:inset 0 0 0 3px #5e90f0,0 6px 0 rgba(0,0,0,.28)}' +
    '#readyScreen .rk.picked .rk-f{border-color:var(--pc,#f1d04a);box-shadow:inset 0 0 0 3px #5e90f0,0 0 14px var(--pc,#f1d04a),0 12px 0 rgba(0,0,0,.22)}' +
    '#readyScreen .rk-q{font-size:clamp(34px,9vh,56px);line-height:1;font-weight:800;color:#ffd23f;text-shadow:0 3px 0 #0b1838}' +
    '#readyScreen .rk-who{display:none;flex-direction:column;align-items:center;gap:4px;max-width:100%}' +
    '#readyScreen .rk.picked .rk-q{display:none}#readyScreen .rk.picked .rk-who{display:flex}' +
    '#readyScreen .rk-av{width:44px;height:44px;border:3px solid var(--pc,#6b5440);border-radius:6px;background:#0e1b3d}' +
    '#readyScreen .rk-wn{max-width:100%;padding:0 4px;font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 2px 0 #0b1838}' +
    '#readyScreen .rk-b{transform:rotateY(180deg);background:linear-gradient(#24418a,#1d3470);border-color:var(--pc,#0b1838);box-shadow:inset 0 0 0 3px rgba(120,160,235,.3),0 0 12px var(--pc,transparent)}' +
    '#readyScreen .rk-no{font-size:clamp(52px,15vh,84px);line-height:1;font-weight:800;color:#ffd23f;text-shadow:0 4px 0 #0b1838}' +
    '#readyScreen .rk-nm{max-width:100%;padding:0 6px;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 2px 0 #0b1838}' +
    '#readyScreen .rk.first .rk-b{box-shadow:inset 0 0 0 3px rgba(255,210,63,.6),0 0 18px #FFC21A}' +
    /* flip: dua fase (depan 0->90deg, belakang -90->0deg), sudut akhir 0deg => angka tidak pernah terbalik/mirror */
    '#readyScreen .rk.revealed{--rot:0deg}' +
    '#readyScreen .rk .rk-b{transform:rotateY(-90deg);visibility:hidden;backface-visibility:visible;-webkit-backface-visibility:visible}' +
    '#readyScreen .rk.revealed .rk-f{animation:rkOut .25s ease-in var(--dl,0ms) both}' +
    '#readyScreen .rk.revealed .rk-b{animation:rkIn .25s ease-out calc(var(--dl,0ms) + .25s) both}' +
    '@keyframes rkOut{from{transform:rotateY(0);visibility:visible}99%{transform:rotateY(90deg);visibility:visible}to{transform:rotateY(90deg);visibility:hidden}}' +
    '@keyframes rkIn{from{transform:rotateY(-90deg);visibility:visible}to{transform:rotateY(0);visibility:visible}}' +
    '@media (prefers-reduced-motion:reduce){#readyScreen .rk.revealed .rk-f,#readyScreen .rk.revealed .rk-b{animation-duration:.01s}}' +
    '@media (prefers-reduced-motion:reduce){#readyScreen .rk-in{transition:none}}' +
    /* landscape pendek: kartu dikecilkan agar muat tanpa scroll */
    '@media (orientation:landscape) and (max-height:430px){#readyScreen .rd-box{padding:8px 10px 10px}#readyScreen .rd-sub{margin:2px 0 4px;font-size:10px}' +
    '#readyScreen .rd-time{margin:0 0 4px;padding:2px 10px;font-size:16px}#readyScreen .rk-grid{gap:8px;padding-top:10px}#readyScreen .rk{height:clamp(96px,36vh,140px)}' +
    '#readyScreen .rk-no{font-size:clamp(40px,13vh,60px)}#readyScreen .rk-av{width:34px;height:34px}#readyScreen .rk-nm{font-size:11px}#readyScreen .rk-wn{font-size:10px}}';

  function injectCSS() {
    if (doc.getElementById('readyCSS')) return;
    var s = doc.createElement('style'); s.id = 'readyCSS'; s.textContent = CSS; doc.head.appendChild(s);
  }
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function cancel() {
    if (run) { try { if (A()) run.ids.forEach(A().clear); } catch (e) {} var r = run; run = null; r.cancelled = true; }
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
  }

  function show(players, opts) {
    opts = opts || {};
    cancel(); injectCSS();
    var secs = opts.seconds || 10, n = players.length, ids = [], slots = [];
    var ctx = run = { ids: ids, cancelled: false };
    var rng = opts.rng || Math.random;
    function reg(id) { if (ids.indexOf(id) < 0) ids.push(id); return id; }
    function sfx(name) { if (opts.sfx) { try { opts.sfx(name); } catch (e) {} } }
    return new Promise(function (resolve) {
      players.forEach(function (p) { p.ready = false; p.autoReady = false; p.turnOrder = 0; });

      /* angka urutan acak (Fisher-Yates) dihitung SEKALI; nums[slot] = angka di belakang kartu ke-slot */
      var nums = players.map(function (p, i) { return i + 1; });
      for (var j = nums.length - 1; j > 0; j--) { var r = Math.floor(rng() * (j + 1)), t = nums[j]; nums[j] = nums[r]; nums[r] = t; }

      root = el('section'); root.id = 'readyScreen'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Acak giliran');
      var box = el('div', 'rd-box'); root.appendChild(box);
      var sub = el('div', 'rd-sub'); sub.setAttribute('aria-live', 'polite');
      var message = el('p', 'rd-msg'); sub.appendChild(message); box.appendChild(sub);
      var time = el('div', 'rd-time'); time.setAttribute('role', 'timer'); sub.appendChild(time);
      var grid = el('div', 'rk-grid'); grid.style.setProperty('--n', n); box.appendChild(grid);
      var roster = el('div', 'rd-players'); roster.setAttribute('role', 'group'); roster.setAttribute('aria-label', 'Pemain dan urutan giliran'); box.appendChild(roster);
      var rosterItems = [];

      players.forEach(function (p) {
        var card = el('div', 'rd-player'), avatar = el('img', 'rd-player-av'), details = el('div', 'rd-player-info');
        avatar.alt = '';
        try { avatar.src = opts.face ? opts.face(p) : ''; } catch (e) {}
        var name = el('span', 'rd-player-name', p.name), status = el('span', 'rd-player-state', 'Menunggu');
        details.appendChild(name); details.appendChild(status);
        card.appendChild(avatar); card.appendChild(details); roster.appendChild(card);
        rosterItems.push({ player: p, node: card, status: status });
      });

      function setMessage(text) {
        message.textContent = text;
        sub.classList.toggle('rd-picking', text.indexOf('Giliran kamu memilih') === 0);
        sub.classList.toggle('rd-shuffling', text.indexOf('Kartu diacak') === 0);
      }

      function renderRoster(active, ordered) {
        var list = ordered ? players.slice().sort(function (a, b) { return a.turnOrder - b.turnOrder; }) : players;
        list.forEach(function (p) { roster.appendChild(rosterItems[players.indexOf(p)].node); });
        rosterItems.forEach(function (item) {
          var picked = item.player.turnOrder > 0, current = !ordered && item.player === active;
          item.node.classList.toggle('act', current);
          item.status.classList.toggle('ok', picked);
          item.status.textContent = picked ? 'Giliran ' + item.player.turnOrder : current ? 'Memilih…' : 'Menunggu';
        });
      }

      function updateTimer(s) {
        time.setAttribute('aria-label', 'Sisa waktu memilih ' + s + ' detik');
        time.style.setProperty('--rd-progress', Math.max(0, Math.min(100, s / secs * 100)) + '%');
      }
      updateTimer(secs);

      for (var i = 0; i < n; i++) {
        (function (si) {
          var b = el('button', 'rk'); b.type = 'button'; b.disabled = true; b.setAttribute('aria-label', 'Kartu ' + (si + 1) + ', belum dipilih');
          b.style.setProperty('--shuffle-x', (((n - 1) / 2 - si) * 224) + 'px');
          b.style.setProperty('--shuffle-y', (-si * 5) + 'px');
          b.style.setProperty('--shuffle-swing', (si % 2 ? -70 : 70) + 'px');
          b.style.setProperty('--shuffle-rotation', (si % 2 ? -7 : 7) + 'deg');
          var inner = el('div', 'rk-in');
          var f = el('div', 'rk-f'), q = el('div', 'rk-q', '?'), who = el('div', 'rk-who'), av = el('img', 'rk-av'), wn = el('div', 'rk-wn');
          av.alt = ''; who.appendChild(av); who.appendChild(wn); f.appendChild(q); f.appendChild(who);
          var bk = el('div', 'rk-b'), no = el('div', 'rk-no', String(nums[si])), nm = el('div', 'rk-nm');
          bk.appendChild(no); bk.appendChild(nm);
          inner.appendChild(f); inner.appendChild(bk); b.appendChild(inner); grid.appendChild(b);
          var s = { i: si, num: nums[si], b: b, av: av, wn: wn, nm: nm, owner: null };
          slots.push(s);
          b.addEventListener('click', function () {
            if (ctx.cancelled || s.owner || !canPick) return;
            var p = players[turn]; if (!p || p.cpu) return;
            take(s, p, false);
          });
        })(i);
      }

      var turn = 0, canPick = false, finished = false;
      function free() { return slots.filter(function (s) { return !s.owner; }); }
      function setAvail(on) {
        canPick = on;
        slots.forEach(function (s) { var a = on && !s.owner; s.b.disabled = !a; s.b.classList.toggle('avail', a); });
      }
      function clearPickTimers() { ['pick', 'pick-cpu', 'pick-auto'].forEach(function (id) { A().clear(id); }); }
      function randomFree() { var f = free(); return f[Math.floor(rng() * f.length)]; }

      function nextPicker() {
        if (ctx.cancelled || finished) return;
        if (turn >= n) { allPicked(); return; }
        var p = players[turn], f = free();
        if (f.length === 1) { /* tinggal satu kartu: otomatis, tanpa menunggu pemain */
          setAvail(false); time.classList.remove('active'); setMessage('Kartu terakhir untuk ' + p.name); renderRoster(p, false);
          A().start(reg('pick-auto'), 700, function () { take(f[0], p, true); }); return;
        }
        if (p.cpu) {
          setAvail(false); time.classList.remove('active'); setMessage(p.name + ' sedang memilih…'); renderRoster(p, false);
          A().start(reg('pick-cpu'), 700 + Math.floor(rng() * 500), function () { take(randomFree(), p, true); }); return;
        }
        setMessage('Giliran kamu memilih — ketuk satu kartu'); time.classList.add('active'); updateTimer(secs); time.classList.remove('low'); renderRoster(p, false);
        setAvail(true);
        var fs = f[0]; if (fs) { try { fs.b.focus({ preventScroll: true }); } catch (e) {} }
        A().start(reg('pick'), secs * 1000, function () { take(randomFree(), p, true); }, function (s) {
          updateTimer(s); time.classList.toggle('low', s <= 3);
        });
      }

      function take(s, p, auto) {
        if (ctx.cancelled || finished || !s || s.owner) return;
        clearPickTimers(); setAvail(false);
        s.owner = p; p.turnOrder = s.num; p.ready = true; p.autoReady = !!auto;
        s.b.style.setProperty('--pc', p.css || '#f1d04a'); s.b.classList.add('picked');
        try { s.av.src = opts.face ? opts.face(p) : ''; } catch (e) {}
        s.wn.textContent = p.name; s.nm.textContent = p.name;
        s.b.setAttribute('aria-label', 'Kartu ' + (s.i + 1) + ', dipilih ' + p.name);
        if (!auto) sfx('pop'); else sfx('shuffleTick');
        renderRoster(null, false);
        turn++;
        A().start(reg('pick-next'), 450, nextPicker); /* jeda singkat: kartu terangkat terlihat dulu */
      }

      function allPicked() {
        if (finished) return; finished = true; setAvail(false); time.classList.remove('active'); renderRoster(null, true);
        setMessage('Membuka kartu…');
        A().start(reg('pick-flip'), 600, function () {
          if (ctx.cancelled) return;
          var ordered = players.slice().sort(function (a, b) { return a.turnOrder - b.turnOrder; });
          slots.forEach(function (s) { /* flip berurutan menurut angka: 1, 2, 3, ... */
            s.b.style.setProperty('--dl', ((s.num - 1) * 140) + 'ms'); s.b.classList.add('revealed');
            if (s.num === 1) s.b.classList.add('first');
            s.b.setAttribute('aria-label', 'Giliran ' + s.num + ': ' + s.owner.name);
          });
          sfx('revealFirst');
          setMessage('Urutan giliran sudah ditentukan!');
          renderRoster(null, true);
          A().start(reg('pick-done'), (n - 1) * 140 + 500 + 1400, function () { if (ctx.cancelled) return; cancel(); resolve(ordered); });
        });
      }

      doc.body.appendChild(root);
      renderRoster(null, false);
      var animateShuffle = true;
      try { animateShuffle = !(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
      if (animateShuffle) {
        setMessage('Kartu diacak…');
        grid.classList.add('shuf');
        A().start(reg('shuffle'), 3100, function () {
          if (ctx.cancelled) return;
          grid.classList.remove('shuf');
          nextPicker();
        });
      } else nextPicker();
    });
  }
  UT.GameplayReady = { show: show, cancel: cancel };
})(window, document);
