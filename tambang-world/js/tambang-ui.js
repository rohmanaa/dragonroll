/* tambang-ui.js — kanvas 1920x1080 (skala + rotasi potret), scroll layer, drag & snap, HUD ala dragonroll.
   Hook untuk game: TambangMW.ui.setCurrency({ coin, gem }); event window 'tambang:back' / 'tambang:home'. */
(function () {
  'use strict';
  const MW = window.TambangMW, Wd = MW.world, $ = (id) => document.getElementById(id);
  const canvas = $('tambang-gl'), stage = $('tambang-stage'), toastEl = $('tambang-toast'), dock = $('tambang-dock');
  const N = MW.LAYERS - 1, MIN = 0, SW = 1920, SH = 1080;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let showSlots = false, drag = null, pan = null, liftTimer = 0, toastTimer = 0;

  MW.buildWorld(canvas);
  const camera = Wd.camera, renderer = Wd.renderer, Snap = MW.Snap;
  if (Wd.viewW !== 32) MW.setViewW(32);

  /* ---------- fit stage: skala; ponsel potret → diputar 90° (seperti rig layar repo) ---------- */
  const view = { k: 1, rot: false, cx: 0, cy: 0 };
  function fit() {
    const W = window.innerWidth, H = window.innerHeight;
    view.rot = H > W; view.cx = W / 2; view.cy = H / 2;
    view.k = view.rot ? Math.min(H / SW, W / SH) : Math.min(W / SW, H / SH);
    stage.style.transform = (view.rot ? 'rotate(90deg) ' : '') + 'scale(' + view.k + ')';
    const bw = Math.round(clamp(SW * view.k * Math.min(window.devicePixelRatio || 1, 2), 640, 2560)), bh = Math.round(bw * 9 / 16);
    renderer.setPixelRatio(1); renderer.setSize(bw, bh, false);
  }
  window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit); fit();
  /* koordinat pointer layar → piksel stage (pusat 0,0) */
  function st(e) {
    const dx = e.clientX - view.cx, dy = e.clientY - view.cy;
    return view.rot ? { u: dy / view.k, v: -dx / view.k } : { u: dx / view.k, v: dy / view.k };
  }
  const inStage = (s) => Math.abs(s.u) <= SW / 2 && Math.abs(s.v) <= SH / 2;

  /* ---------- toast & modal ---------- */
  function toast(msg, bad) {
    toastEl.textContent = msg; toastEl.dataset.bad = bad ? '1' : '0'; toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2400);
  }
  const md = $('tambang-md');
  $('tambang-reset').addEventListener('click', () => ask('Reset Tambang', 'Semua objek kembali ke susunan awal.<br>Lanjutkan?', 'BATAL', 'RESET', () => { $('tambang-fade').classList.add('on'); setTimeout(() => location.reload(), 360); }));
  const D = MW.data, fmt = (n) => Number(n).toLocaleString('id-ID'), f1 = (n) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), f2 = (n) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ORI = 'images/tambang-kristal-heksagon.webp', EM = 'images/tambang-berlian-hijau.webp', CN = 'images/tambang-ikon-koin-emas.webp';
  /* navigasi: Kembali ke halaman asal (?from=, daftar putih seperti repo), Home ke lobby, Coin ke toko. Di luar game hanya memicu event. */
  const FROM_OK = ['lobby', 'karakter', 'frame', 'dadu', 'efek', 'powerup', 'profile', 'leaderboard', 'friendship', 'shop', 'mode', 'misi', 'hadiah-misi', 'dailyreward', 'settings', 'mail'];
  const FROM = (() => { const f = new URLSearchParams(location.search).get('from') || '', m = /^([a-z-]+)\.html$/.exec(f); return m && FROM_OK.indexOf(m[1]) >= 0 ? f : 'lobby.html'; })();
  function nav(name, url) {
    D.feedback();
    const ev = new CustomEvent('tambang:' + name, { cancelable: true, detail: { url: url } });
    if (window.dispatchEvent(ev) && window.UT) location.href = url; else if (window.UT === undefined) toast('Pratinjau: tombol ini membuka ' + url, false);
  }
  $('tambang-back').addEventListener('click', () => nav('back', FROM));
  $('tambang-home').addEventListener('click', () => nav('home', 'lobby.html'));
  $('tambang-cur-co').addEventListener('click', () => nav('shop', 'shop.html?coin=1'));

  /* ---------- mata uang: saldo asli (PlayerData) atau tiruan lokal ---------- */
  function paintCur(bumpEl) {
    const rd = D.wallet.ready();
    const co = fmt(D.wallet.coins()), em = fmt(D.wallet.gems());
    $('tambang-v-co').textContent = rd ? co : '—'; $('tambang-v-em').textContent = rd ? em : '—';
    $('tambang-v-co').style.fontSize = co.length > 6 ? '34px' : ''; $('tambang-v-em').style.fontSize = em.length > 6 ? '34px' : '';
    if (bumpEl) { bumpEl.classList.remove('bump'); void bumpEl.offsetWidth; bumpEl.classList.add('bump'); }
  }
  MW.ui = { toast: toast };
  D.wallet.subscribe(() => { paintCur(); if (typeof tickCard === 'function') tickCard(); });
  paintCur();

  /* ---------- HUD ---------- */
  const sum = $('tambang-sum'), tiles = Array.from(document.querySelectorAll('.tambang-tile')), upB = $('tambang-up'), dnB = $('tambang-down');
  let shown = -1;
  function refreshCount() {
    const f = Snap.slots.filter(s => s.occupied).length; sum.dataset.cnt = f + ' / ' + Snap.slots.length;
    if (shown >= 0) paintSum(shown);
  }
  function paintSum(i) {
    if (i === 0) { sum.innerHTML = '<b>Base Camp</b> · Gudang · Furnace · Hutan · Permukaan'; return; }
    sum.innerHTML = 'Mine <b>' + String(i).padStart(2, '0') + '</b> · ' + MW.NAMES[i] + ' · −' + (i * 35) + ' m'; }
  function setHud(i) {
    if (i === shown) return; shown = i; paintSum(i);
    stage.dataset.layer = i;
    tiles.forEach((t, k) => {
      const on = +t.dataset.i === i; t.classList.toggle('on', on);
      t.firstElementChild.src = 'images/tambang-tile-stage-' + (on ? 'aktif' : 'biasa') + '.webp';
    });
    upB.disabled = i === MIN; dnB.disabled = i >= maxNav(); tiles.forEach((t) => t.classList.toggle('lk', +t.dataset.i > maxNav())); prodB.style.display = i === 0 ? 'none' : '';
  }

  /* ---------- navigasi layer ---------- */
  function maxNav() { let u = 0; if (D.ready) for (let k = 0; k < D.slots.length && D.slots[k].unlocked; k++) u++; return Math.min(N, u + 1); }
  function lockedMsg() { const m = maxNav(); toast('Buka Tambang ' + m + ' dulu untuk lanjut ke tambang berikutnya.', true); }
  function goTo(i) {
    if (i > maxNav()) { lockedMsg(); i = maxNav(); }
    i = clamp(i, MIN, N); Wd.sT = i;
    if (Wd.cur !== i) { Wd.cur = i; if (typeof buildCard === 'function') buildCard(); }
  }
  MW.goTo = goTo;
  function bump(dir) { Wd.s += dir * 0.09; toast(dir < 0 ? 'Batas atas: Base Camp' : 'Batas bawah: dasar Mystery Mine', false); }
  function step(d) { const n = Wd.cur + d; if (n > maxNav() && n <= N) { lockedMsg(); return; } if (n < MIN || n > N) { bump(d); return; } goTo(n); }
  tiles.forEach((t) => t.addEventListener('click', () => goTo(+t.dataset.i)));
  upB.addEventListener('click', () => step(-1)); dnB.addEventListener('click', () => step(1));
  window.addEventListener('keydown', (e) => {
    if (md.classList.contains('on')) { if (e.key === 'Escape') md.classList.remove('on'); return; }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { step(1); e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
    else if (e.key === 'Home') goTo(MIN); else if (e.key === 'End') goTo(N);
  });
  let wLock = 0, wLastAbs = 0, wAcc = 0;
  $('tambang-wrap').addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now(), dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1), a = Math.abs(dy);
    if (now < wLock) { if (a <= wLastAbs * 1.2) wLock = Math.max(wLock, now + 120); wLastAbs = a; return; }
    wAcc += dy; wLastAbs = a;
    if (Math.abs(wAcc) >= 24) { const d = wAcc > 0 ? 1 : -1; wAcc = 0; wLock = now + 520; step(d); }
  }, { passive: false });

  /* ---------- koordinat dunia ---------- */
  const ray = new THREE.Raycaster(), v3 = new THREE.Vector3();
  function ndc(e) { const s = st(e); return { x: s.u / (SW / 2), y: -s.v / (SH / 2) }; }
  function worldXY(e) { const n = ndc(e); camera.updateMatrixWorld(); v3.set(n.x, n.y, 0).unproject(camera); return { x: v3.x, y: v3.y }; }
  function overDock(e) { const r = dock.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }

  let bldHit = null;
  function pickBuilding(e) {
    const Z = Wd.layers[0]; if (Wd.cur !== 0) return null;
    ray.setFromCamera(ndc(e), camera);
    const hits = ray.intersectObjects(Z.sub.Buildings.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.bid) o = o.parent; if (o) return o.userData.bid; }
    return null;
  }
  const PICK = ['Chests', 'Workers', 'Carts', 'Decorations', 'Minerals'];
  function pick(e) {
    const cands = [];
    Wd.layers.forEach(L => { if (Math.abs(L.index - Wd.s) < 1.0) PICK.forEach(k => L.sub[k].children.forEach(c => { if (c.userData.kind) cands.push(c); })); });
    ray.setFromCamera(ndc(e), camera);
    const hits = ray.intersectObjects(cands, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.kind) o = o.parent; if (o && cands.indexOf(o) >= 0) return o; }
    return null;
  }

  /* ---------- drag objek ---------- */
  function startDrag(obj, e, fromDock) {
    const u = obj.userData, p = worldXY(e), prev = u.slot || null;
    if (u.kind === 'worker' && u.w) { MW.detach(obj); MW.setWorkerMode(obj, 'idle', { dir: u.w.dir }); }
    if (u.kind === 'cart' && u.pusher) { u.pusher.parent && u.pusher.parent.remove(u.pusher); u.pusher = null; }
    if (u.aux) { u.aux.parent && u.aux.parent.remove(u.aux); u.aux = null; }
    Wd.scene.attach(obj);
    const off = fromDock ? { x: 0, y: -0.5 } : { x: obj.position.x - p.x, y: obj.position.y - p.y };
    drag = { obj: obj, prev: prev, off: off, kind: u.kind, fromDock: fromDock, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
    obj.position.z = 1.4; obj.position.x = p.x + off.x; obj.position.y = p.y + off.y; obj.rotation.set(0, 0, 0);
    Snap.showMarkers(true, u.kind); stage.classList.add('dragging');
  }
  function moveDrag(e) {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    const p = worldXY(e); drag.obj.position.x = p.x + drag.off.x; drag.obj.position.y = p.y + drag.off.y;
    drag.out = drag.moved && (overDock(e) || !inStage(st(e)));
    dock.classList.toggle('del', !!drag.out);
  }
  function removeObject(o) { Snap.release(o); MW.detach(o); if (o.parent) o.parent.remove(o); }
  function autoPlace(obj, kind) {
    const free = Snap.slots.filter(s => s.layer === Wd.cur && !s.occupied && s.allow.indexOf(kind) >= 0).sort((a, b) => Math.abs(a.x - 16) - Math.abs(b.x - 16));
    if (!free.length) return { ok: false, reason: 'Semua slot tipe ini di Mine ' + Wd.cur + ' sudah terisi' };
    let last = null;
    for (const s of free) { const r = Snap.place(obj, kind, s.x, s.y); if (r.ok) return r; last = r; }
    return last;
  }
  function endDrag(e) {
    if (!drag) return;
    const d = drag, o = d.obj; drag = null; stage.classList.remove('dragging'); dock.classList.remove('del');
    Snap.showMarkers(showSlots);
    const clickOnly = !d.moved;
    if (d.fromDock && clickOnly) {
      const r = autoPlace(o, d.kind);
      if (r.ok) toast('Ditempatkan di ' + r.slot.id, false); else { removeObject(o); toast(r.reason || 'Tidak bisa ditempatkan', true); }
      refreshCount(); return;
    }
    if (!d.fromDock && clickOnly) {
      if (d.prev) d.prev.host.attach_(o, d.prev);
      if (d.kind === 'chest') {
        o.userData.pop = 1; const tp = o.userData.type;
        const wp = new THREE.Vector3(); o.getWorldPosition(wp); wp.y += 0.9; MW.debris.spawn(wp, MW.CHEST_DEF[tp].lock, 8);
      }
      refreshCount(); return;
    }
    if (d.out) { removeObject(o); toast('Objek dilepas dari tambang', false); refreshCount(); return; }
    const r = Snap.place(o, d.kind, o.position.x, o.position.y);
    if (r.ok) toast('Terkunci di ' + r.slot.id, false);
    else if (d.prev) { d.prev.host.attach_(o, d.prev); toast(r.reason + '. Kembali ke slot semula', true); }
    else { removeObject(o); toast(r.reason, true); }
    refreshCount();
  }
  function updateMarkers(t) {
    if (!drag) { if (showSlots) Snap.slots.forEach(s => { s.marker.material.opacity = 0.35 + Math.sin(t * 3) * 0.1; }); return; }
    const near = Snap.nearest(drag.kind, drag.obj.position.x, drag.obj.position.y);
    Snap.slots.forEach(s => {
      if (!s.marker.visible) return;
      const isN = s === near;
      s.marker.material.color.set(s.occupied && s.object !== drag.obj ? 0xff6a6a : isN ? 0x9dff9d : 0x66e0ff);
      s.marker.material.opacity = isN ? 0.95 : 0.4; s.marker.scale.y = isN ? 0.26 : 0.16;
    });
  }

  /* ---------- pan vertikal ---------- */
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const o = null; /* taruh/seret objek dinonaktifkan (dock dihapus) */ canvas.setPointerCapture(e.pointerId);
    if (o) { startDrag(o, e, false); return; }
    bldHit = pickBuilding(e);
    const s = st(e); pan = { v0: s.v, u0: s.u, s0: Wd.s, axis: null, last: s.v, lt: performance.now(), vel: 0 };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) { moveDrag(e); return; }
    if (!pan) return;
    const s = st(e), now = performance.now();
    if (!pan.axis && Math.hypot(s.u - pan.u0, s.v - pan.v0) > 12) pan.axis = 'v';
    if (!pan.axis) return;
    const ns = clamp(pan.s0 - (s.v - pan.v0) / SH, MIN - 0.12, maxNav() + 0.12);
    pan.vel = (-(s.v - pan.last) / SH) / Math.max(0.008, (now - pan.lt) / 1000);
    pan.last = s.v; pan.lt = now; Wd.s = ns; Wd.sT = ns;
  });
  const endPan = (e) => {
    if (drag && e.pointerId === drag.id) { moveDrag(e); endDrag(e); return; }
    if (!pan) return;
    if (pan.axis !== 'v') { pan = null; const bh = bldHit; bldHit = null; if (bh) openBuilding(bh); return; }
    bldHit = null;
    const base = Math.round(pan.s0), dlt = Wd.s - pan.s0, dirn = Math.abs(dlt) > 0.01 ? Math.sign(dlt) : Math.sign(pan.vel);
    const tgt = (Math.abs(dlt) > 0.1 || Math.abs(pan.vel) > 1) ? clamp(base + dirn, MIN, maxNav()) : clamp(Math.round(Wd.s), MIN, maxNav()); pan = null;
    if (Wd.s < MIN - 0.02) bump(-1); else if (Wd.s > maxNav() + 0.02) { if (maxNav() < N) lockedMsg(); else bump(1); }
    goTo(tgt); Wd.sT = tgt;
  };
  canvas.addEventListener('pointerup', endPan); canvas.addEventListener('pointercancel', endPan);

  /* ---------- dock ---------- */
  function endChipDrag(ev, mv, up) {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (!drag) return;
    moveDrag(ev);
    if (drag.moved && !inStage(st(ev))) { removeObject(drag.obj); drag = null; stage.classList.remove('dragging'); dock.classList.remove('del'); Snap.showMarkers(showSlots); refreshCount(); toast('Objek dilepas dari tambang', false); }
    else endDrag(ev);
  }
  document.querySelectorAll('.tambang-chip').forEach(ch => {
    ch.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return; e.preventDefault();
      const obj = MW.createObject(ch.dataset.spec, Wd.cur); Wd.scene.add(obj);
      startDrag(obj, e, true);
      const mv = (ev) => moveDrag(ev), up = (ev) => endChipDrag(ev, mv, up);
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    ch.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault();
      const obj = MW.createObject(ch.dataset.spec, Wd.cur); Wd.scene.add(obj);
      const r = autoPlace(obj, obj.userData.kind);
      if (r.ok) toast('Ditempatkan di ' + r.slot.id, false); else { removeObject(obj); toast(r.reason || 'Tidak bisa ditempatkan', true); }
      refreshCount();
    });
  });
  const tgW = $('tambang-slotwrap'), tg = $('tambang-tg');
  function toggleSlots() { showSlots = !showSlots; tg.classList.toggle('on', showSlots); tgW.setAttribute('aria-checked', showSlots); Snap.showMarkers(showSlots); }
  tgW.addEventListener('click', toggleSlots);
  tgW.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSlots(); } });


  /* ---------- panel produksi (slot 1..3 = layer 1..3), logika dari data/mining/js/tambang.js ---------- */
  const card = $('tambang-card'), prodB = $('tambang-prod'), liftB = $('tambang-liftb'); let cardOpen = false, cardFor = -1, panel = 'prod';
  const dur = (s) => { s = Math.max(0, Math.round(s)); if (s < 60) return s <= 1 ? '<1m' : s + 'd'; const m = Math.floor(s / 60), h = Math.floor(m / 60); return h >= 24 ? Math.floor(h / 24) + ' hr ' + (h % 24) + 'j' : h ? h + 'j ' + (m % 60) + 'm' : m + 'm'; };
  const q = (sel) => card.querySelector(sel);
  const ore = (k) => D.ORES[k];
  const mixHTML = (m) => Object.keys(m || {}).map((k) => '<span class="tambang-ore"><i style="background:' + ore(k).c + '"></i>' + ore(k).n.replace('Ore ', '') + ' ' + Math.round(m[k] * 100) + '%</span>').join('');
  function liftHTML() {
    const l = D.lift();
    if (!l.on) return '<div class="hd tambang-ttl">LIFT</div><img class="gm" src="images/tambang-gembok-besar.webp" alt=""><div class="msg">Lift terkunci.<small>Buka lift untuk mengangkut ore dari Tambang 2–6 ke gudang.</small></div><button class="tambang-btn opn" data-lift="unlock"><img src="images/tambang-tombol-kuning-polos.webp" alt=""><span><img src="' + CN + '" alt="">' + fmt(l.unlock_cost) + '</span></button>';
    const up = (a, label, lv, mx, cost) => cost == null ? '<button class="tambang-up" data-lift="' + a + '" disabled><b>' + label + ' MAKS</b><small>Lv ' + lv + '/' + mx + '</small></button>' : '<button class="tambang-up" data-lift="' + a + '"><b>' + label + ' Lv ' + (lv + 1) + '</b><small><img src="' + CN + '" alt="">' + fmt(cost) + '</small></button>';
    const last = D.lastLoad();
    return '<div class="hd tambang-ttl">LIFT</div><div class="sb">Muatan Lv ' + l.cap_lv + ' · Kecepatan Lv ' + l.spd_lv + '</div>'
      + '<div class="pill"><img src="' + ORI + '" alt=""><b class="bt">' + fmt(l.cap) + '</b></div><div class="st">ore per angkut · kecepatan ×' + l.spd + '</div>'
      + '<div class="st">Muatan terakhir:<div class="tambang-mix">' + (last ? mixHTML(Object.keys(last).reduce((o, k) => { const t = Object.keys(last).reduce((a, x) => a + last[x], 0) || 1; if (last[k]) o[k] = last[k] / t; return o; }, {})) : '—') + '</div></div>'
      + '<div class="tambang-ups">' + up('cap', 'Muatan', l.cap_lv, 5, l.next_cap_cost) + up('spd', 'Kecepatan', l.spd_lv, 3, l.next_spd_cost) + '</div>';
  }
  function cardHTML(i) {
    const s = D.slots[i - 1]; if (!s) return '<div class="msg">Memuat…</div>';
    if (!s.unlocked) return '<div class="hd tambang-ttl">TAMBANG ' + i + '</div><img class="gm" src="images/tambang-gembok-besar.webp" alt=""><div class="msg">Buka supaya penambang mulai menggali.<small>' + f2(s.base_rate) + ' /jam (Lv1)</small></div><button class="tambang-btn opn" data-a="unlock"><img src="images/tambang-tombol-kuning-polos.webp" alt=""><span><img src="' + CN + '" alt="">' + fmt(s.unlock_cost) + '</span></button>';
    const up = (a, label, lv, cost) => cost == null ? '<button class="tambang-up" data-a="' + a + '" disabled><b>' + label + ' MAKS</b><small>Lv ' + lv + '/5</small></button>' : '<button class="tambang-up" data-a="' + a + '"><b>' + label + ' Lv ' + (lv + 1) + '</b><small><img src="' + CN + '" alt="">' + fmt(cost) + '</small></button>';
    return '<div class="hd tambang-ttl">TAMBANG ' + i + '</div><div class="sb">Kec. Lv ' + s.speed_lv + ' · Peti Lv ' + s.cap_lv + '</div>'
      + '<div class="tambang-mix">' + mixHTML(s.mix) + '</div><div class="pill"><img src="' + ORI + '" alt=""><b class="bt"></b></div>'
      + '<div class="tambang-rt"><img src="' + ORI + '" alt=""><b class="rv"></b><small>/jam</small><span class="tambang-bst">⚡ x' + D.config.boost_mult + '</span></div>'
      + '<div class="tambang-bar"><i></i></div><div class="tambang-eta"></div>'
      + '<div class="tambang-rstw"><span class="tambang-rst"></span></div><div class="tambang-acts">'
      + '<button class="tambang-btn y" data-a="boost"><img src="images/tambang-tombol-biru-polos.webp" alt=""><span><b class="bl2">Percepat</b><small class="bs"></small></span></button></div>'
      + '<div class="tambang-ups">' + up('speed', 'Kecepatan', s.speed_lv, s.next_speed_cost) + up('cap', 'Peti', s.cap_lv, s.next_cap_cost) + '</div>'
      + (s.mgr ? '<div class="tambang-mgr on"><b>👔 Manager aktif</b><small>Percepat oleh manager · istirahat 5 mnt</small></div>' : '<button class="tambang-mgr" data-a="manager"><b>👔 Rekrut Manager</b><small>Boost &amp; istirahat 5 mnt (bukan 10) · <img src="' + EM + '" alt="">' + fmt(s.mgr_cost) + '</small></button>');
  }
  const CLOSE = '<button class="tambang-x" data-x="1" aria-label="Tutup"></button>';
  function buildCard() {
    const i = Wd.cur; cardFor = i;
    if (Wd.cur < 1 && panel !== 'lift') { card.hidden = true; return; }
    if (panel === 'lift') { card.hidden = !cardOpen; card.innerHTML = CLOSE + liftHTML(); tickCard(); return; }
    card.hidden = !cardOpen; card.innerHTML = CLOSE + cardHTML(i); tickCard();
  }
  function tickCard() {
    const i = Wd.cur; if (!D.ready || card.hidden || Wd.cur < 1) return;
    if (panel === 'lift') { const co2 = D.wallet.coins(); card.querySelectorAll('[data-lift]').forEach((b) => { const l = D.lift(), a = b.dataset.lift, c = a === 'unlock' ? l.unlock_cost : a === 'cap' ? l.next_cap_cost : l.next_spd_cost; b.classList.toggle('poor', c != null && co2 < c); }); return; }
    const s = D.slots[i - 1]; if (!s || !s.unlocked) { card.classList.add('locked'); return; }
    card.classList.remove('locked');
    const st = D.status(i), bl = D.boostLeft(i), bOn = bl > 0;
    card.classList.toggle('full', st === 'full'); card.classList.toggle('boost', bOn);
    if (s.boost.active && !bOn && !tickCard.re) { tickCard.re = 1; D.load().finally(() => { tickCard.re = 0; buildCard(); }); }
    const v = D.est(i);
    q('.rv').textContent = f2(D.rate(i)); q('.tambang-bar i').style.width = Math.min(100, v / s.cap * 100) + '%';
    q('.bt').textContent = f1(v) + ' / ' + fmt(s.cap);
    const rs = D.restOf(i);
    q('.tambang-eta').textContent = rs.resting ? 'Istirahat · lanjut ' + dur(rs.left / 1000) : v >= s.cap - 1e-6 ? 'Peti penuh! Menunggu lift' : 'Penuh dalam ' + dur(Math.max(0, s.full_in_secs - (performance.now() - s.at) / 1000));
    q('.tambang-rst').textContent = rs.resting ? (rs.kind === 'sleep' ? '😴 Tidur' : '🍖 Makan') + ' · lanjut ' + dur(rs.left / 1000) : '⛏ Kerja · istirahat ' + dur(rs.left / 1000) + ' lagi';
    card.classList.toggle('rest', !!rs.resting);
    const bb = q('[data-a="boost"]');
    if (!s.mgr) { bb.disabled = false; q('.bl2').textContent = 'Percepat'; q('.bs').textContent = 'Perlu Manager'; }
    else if (bOn) { bb.disabled = true; q('.bl2').textContent = 'Aktif'; q('.bs').textContent = '⚡ ' + dur(bl); }
    else if (s.boost.left_today <= 0) { bb.disabled = true; q('.bl2').textContent = 'Percepat'; q('.bs').textContent = 'Habis hari ini'; }
    else { bb.disabled = false; q('.bl2').textContent = 'Percepat'; q('.bs').innerHTML = '<img src="' + CN + '" alt="">' + fmt(s.boost.cost); }
    const co = D.wallet.ready() ? D.wallet.coins() : Infinity;
    card.querySelectorAll('.tambang-mgr[data-a]').forEach((b) => b.classList.toggle('poor', D.wallet.gems() < s.mgr_cost));
    card.querySelectorAll('.y,.tambang-up').forEach((b) => { const a = b.dataset.a, c = a === 'boost' ? (s.mgr ? s.boost.cost : null) : a === 'speed' ? s.next_speed_cost : s.next_cap_cost; b.classList.toggle('poor', c != null && co < c); });
  }
  function openPanel(which) {
    if (cardOpen && panel === which) cardOpen = false; else { cardOpen = true; panel = which; }
    prodB.setAttribute('aria-expanded', cardOpen && panel === 'prod'); liftB.setAttribute('aria-expanded', cardOpen && panel === 'lift'); buildCard();
  }
  prodB.addEventListener('click', () => { openPanel('prod'); }); liftB.addEventListener('click', () => openPanel('lift'));
  MW.ui.openPanel = openPanel;
  /* modal konfirmasi (sub.css #md) */
  let okFn = null;
  function ask(t, x, noL, okL, ok) { md.classList.remove('bld'); if (typeof bldOpen !== 'undefined') bldOpen = null; $('tambang-mt').textContent = t; $('tambang-mx').innerHTML = x; q2('tambang-m-no').textContent = noL; q2('tambang-m-ok').textContent = okL; okFn = ok; $('tambang-m-ok').style.display = okL ? '' : 'none'; md.classList.add('on'); }
  const q2 = (id) => $(id).querySelector('span');
  $('tambang-m-no').addEventListener('click', () => { okFn = null; md.classList.remove('on'); });
  $('tambang-m-ok').addEventListener('click', () => { const f = okFn; okFn = null; md.classList.remove('on'); if (f) f(); });
  function pre(i, a) {
    if (a === 'boost') { const sb = D.slots[i - 1]; if (!sb.mgr) { toast(D.MSG['perlu-manager'], true); return; } act(i, a); return; }
    if (a === 'manager') { const sm = D.slots[i - 1]; if (!sm || sm.mgr) return; if (D.wallet.gems() < sm.mgr_cost) { ask('Emerald tidak cukup', 'Manager Tambang ' + i + ' butuh ' + fmt(sm.mgr_cost) + ' Emerald.<br>Saldo kamu ' + fmt(D.wallet.gems()) + ' Emerald.', 'TUTUP', '', null); return; } ask('Rekrut Manager', 'Rekrut Manager Tambang ' + i + '<br>seharga ' + fmt(sm.mgr_cost) + ' Emerald?<br><small style="font-size:26px;color:#b9b1d3">Manager menjalankan Percepat (boost) dan memperpendek istirahat pekerja jadi 5 menit (bukan 10).</small>', 'BATAL', 'REKRUT', () => act(i, a)); return; }
    if (a === 'unlock' && D.slots[i - 1].can_unlock === false) { toast(D.MSG['buka-berurutan'], true); return; }
    const s = D.slots[i - 1], c = a === 'unlock' ? s.unlock_cost : a === 'speed' ? s.next_speed_cost : s.next_cap_cost, nm = a === 'speed' ? 'Kecepatan' : 'Peti';
    if (c == null) { act(i, a); return; }
    const bal = D.wallet.coins();
    if (D.wallet.ready() && bal < c) { ask('Koin tidak cukup', 'Butuh ' + fmt(c) + ' Koin' + (a === 'unlock' ? ' untuk membuka tambang ini.' : ' untuk upgrade ' + nm + '.') + '<br>Saldo kamu ' + fmt(bal) + ' Koin.', 'TUTUP', '', null); return; }
    ask('Konfirmasi', a === 'unlock' ? 'Buka Tambang ' + i + '<br>seharga ' + fmt(c) + ' Koin?' : 'Upgrade ' + nm + ' ke Lv ' + ((a === 'speed' ? s.speed_lv : s.cap_lv) + 1) + '<br>seharga ' + fmt(c) + ' Koin?', 'BATAL', a === 'unlock' ? 'BUKA' : 'UPGRADE', () => act(i, a));
  }
  function workerOf(i) { let w = null; const L = Wd.layers[i]; L.sub.Workers.children.forEach((c) => { if (c.userData.prodSlot === i) w = c; }); return w; }
  async function act(i, a) {
    D.feedback(); const r = await D.act(i, a);
    if (!r || !r.ok) { buildCard(); toast(D.MSG[r && r.reason] || 'Gagal. Coba lagi.', true); return; }
    buildCard(); paintCur(a === 'manager' ? $('tambang-cur-em') : $('tambang-cur-co'));
    const w = workerOf(i), wp = new THREE.Vector3(); if (w) { w.getWorldPosition(wp); wp.y += 1.2; }
    if (false) {
    } else if (a === 'unlock') { toast('Tambang ' + i + ' dibuka!'); if (w) MW.debris.spawn(wp, 0x2fe07a, 16); }
    else if (a === 'manager') { toast('Manager bergabung! Boost aktif & istirahat jadi 5 menit 👔'); const L0 = Wd.layers[i]; if (L0 && L0.mgr) { L0.mgr.getWorldPosition(wp); wp.y += 1.4; MW.debris.spawn(wp, 0x2fe07a, 16); } }
    else if (a === 'boost') toast('Percepat aktif ⚡'); else toast('Upgrade berhasil!');
  }
  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { cardOpen = false; prodB.setAttribute('aria-expanded', 'false'); liftB.setAttribute('aria-expanded', 'false'); buildCard(); return; }
    const lb = e.target.closest('[data-lift]'); if (lb && !lb.disabled) { liftPre(lb.dataset.lift); return; }
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    pre(Wd.cur, b.dataset.a);
  });
  function liftPre(a) {
    const l = D.lift(), c = a === 'unlock' ? l.unlock_cost : a === 'cap' ? l.next_cap_cost : l.next_spd_cost, nm = a === 'unlock' ? 'Buka Lift' : a === 'cap' ? 'Upgrade Muatan Lift' : 'Upgrade Kecepatan Lift';
    if (c == null) return;
    if (D.wallet.coins() < c) { ask('Koin tidak cukup', 'Butuh ' + fmt(c) + ' Koin.<br>Saldo kamu ' + fmt(D.wallet.coins()) + ' Koin.', 'TUTUP', '', null); return; }
    ask('Konfirmasi', nm + '<br>seharga ' + fmt(c) + ' Koin?', 'BATAL', 'YA', async () => { D.feedback(); const r = await D.liftAct(a); if (!r.ok) { toast(D.MSG[r.reason] || 'Gagal', true); return; } syncLift(); buildCard(); paintCur($('tambang-cur-co')); toast(a === 'unlock' ? 'Lift dibuka!' : 'Lift di-upgrade!'); });
  }
  let trip = null;
  function startTrip(pl) { trip = { n: pl.n, ores: pl.ores, mine: pl.mine, ph: 'up' }; Wd.lift.setLoad(0, 1, null); Wd.lift.goTo(pl.mine); }
  const powN = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  function tripStep() {
    if (!trip) return; const lf = Wd.lift;
    if (Math.abs(lf.y - lf.target) >= 0.4 || lf.layer !== (trip.ph === 'up' ? trip.mine : 0)) return;
    if (trip.ph === 'up') { lf.setLoad(trip.n, D.lift().cap, trip.ores); lf.goTo(0); trip.ph = 'down'; return; }
    const tr = D.deliver(), n = trip.n; trip = null; lf.setLoad(0, 1, null); paintGudang(true); rerender();
    const dp = tr && tr.drops, bonus = dp ? [dp.coin ? '+' + fmt(dp.coin) + ' Koin' : '', dp.gem ? '+' + fmt(dp.gem) + ' Emerald' : '', dp.power.length ? '🎁 Power ' + dp.power.map(powN).join(', ') : ''].filter(Boolean) : [];
    if (bonus.length) { paintCur($('tambang-cur-co')); MW.debris.spawn(new THREE.Vector3(28.6, MW.GROUND + 2.5, 1.8), 0xffd24d, 18); toast('✨ Hadiah langka! ' + bonus.join(' · '), false); }
    else if (tr && !(Wd.cur === 0 && md.classList.contains('on'))) toast('Lift tiba di Gudang · +' + fmt(n) + ' ore', false);
    setTimeout(() => { if (!trip) lf.goTo(0); }, 900);
  }
  setInterval(() => {
    if (!D.ready) return;
    const ev = D.tick();
    if (ev.catchup) {
      const r = ev.catchup; trip = null; Wd.lift.setLoad(0, 1, null); paintGudang(true); buildCard(); rerender();
      const parts = []; if (r.ore > 0) parts.push('+' + fmt(r.ore) + ' ore'); if (r.wood > 0) parts.push('+' + fmt(r.wood) + ' kayu'); if (r.smelted > 0) parts.push(fmt(r.smelted) + ' dilebur'); if (r.coin > 0) parts.push('✨ +' + fmt(r.coin) + ' Koin'); if (r.gem > 0) parts.push('+' + fmt(r.gem) + ' Emerald'); if (r.power > 0) parts.push(r.power + ' Power-up'); paintCur();
      toast('Selama offline ' + dur(r.mins * 60) + (r.capped ? ' (maks)' : '') + ': ' + (parts.join(' · ') || 'belum ada hasil'), false); return;
    }
    if (ev.smelted.length) {
      const n = D.furnace().n; Wd.layers[0].burst = 1;
      MW.debris.spawn(new THREE.Vector3(7.2 + 3.8 * Math.floor(Math.random() * n) + 1.4, MW.GROUND + 1.6, 1.6), 0xff9a3a, 8);
      paintGudang(); rerender();
    }
    if (ev.sweepDue && !trip && !document.hidden) { const pl = D.sweepPlan(); if (pl) { startTrip(pl); paintGudang(); rerender(); } }
  }, 1000);
  window.addEventListener('pagehide', () => D.save()); document.addEventListener('visibilitychange', () => { if (document.hidden) D.save(); });
  function syncLift() { const l = D.lift(); Wd.lift.setLocked(!l.on); Wd.lift.speedMul = l.spd; if (!trip) Wd.lift.goTo(0); if (!l.on) Wd.lift.setLoad(0, 1, null); }
  setInterval(() => { if (!document.hidden) tickCard(); }, 500);
  setInterval(() => { if (!document.hidden && D.ready) D.load().then(buildCard); }, 30000);
  D.load().then((r) => { if (r && r.ok === false) toast(D.MSG[r.reason] || 'Gagal memuat tambang.', true); buildCard(); });

  /* ---------- gudang (ore mentah), boost semua, bubble di atas pekerja ---------- */
  const gB = $('tambang-gudang');
  function paintGudang(bump) { const g0 = D.gudang(); $('tambang-gcnt').textContent = fmt(g0.used) + '/' + fmt(g0.cap); if (bump) { gB.classList.remove('bump'); void gB.offsetWidth; gB.classList.add('bump'); } }
  /* ---------- modal bangunan: Gudang / Tungku / Hutan ---------- */
  const IC = { gem: 'images/tambang-berlian-hijau.webp', coin: 'images/tambang-ikon-koin-emas.webp' };
  const cell = (c, n, v) => '<span class="tambang-cell' + (v ? '' : ' z') + '"><i style="background:' + c + '"></i>' + n + '<b>' + fmt(v) + '</b></span>';
  const stat = (lbl, v, mx, warn) => '<div class="tambang-stat' + (warn ? ' warn' : '') + '"><small>' + lbl + '</small><b>' + fmt(v) + '<em> / ' + fmt(mx) + '</em></b>' + bar(v, mx) + '</div>';
  const oreRow = (k, inv) => '<span class="tambang-ore"><i style="background:' + ore(k).c + '"></i>' + ore(k).n.replace('Ore ', '') + '<b>' + fmt(inv[k]) + '</b></span>';
  const GOODN = { copper: 'Batang Copper', iron: 'Batang Iron', gold: 'Batang Emas', lapis: 'Lapis Lazuli', amethyst: 'Amethyst', diamond: 'Diamond' }, GOODC = { copper: '#e0804a', iron: '#d6d0c8', gold: '#ffd24d', lapis: '#3a5fe0', amethyst: '#b06cff', diamond: '#6fe8ff' };
  let gtab = 'peti';
  const bar = (v, mx) => '<div class="tambang-bar" style="width:auto;margin:6px 0"><i style="width:' + Math.min(100, v / Math.max(1, mx) * 100) + '%"></i></div>';
  function gudangHTML() {
    const g = D.gudang(), inv = D.inv(), gd = D.goods();
    const vals = '<div class="tambang-vals"><span class="tambang-val"><img src="' + IC.gem + '" alt="">' + fmt(D.wallet.gems()) + '</span><span class="tambang-val"><img src="' + IC.coin + '" alt="">' + fmt(D.wallet.coins()) + '</span></div>';
    const tabs = '';
    if (gtab === 'hutan') return vals + forestSec();
    if (gtab === 'up') {
      const pips = (lv, mx) => '<span class="tambang-pips">' + Array.from({ length: mx }, (_, i) => '<i' + (i < lv ? ' class="on"' : '') + '></i>').join('') + '</span>';
      const row = (k, nm, desc, cur, nx, cost, lv, mx) => '<div class="tambang-rec up"><div class="nm">' + nm + pips(lv, mx) + '<span class="cur">' + cur + (nx != null ? ' <em>→ ' + nx + '</em>' : ' <em>MAKS</em>') + '</span><small>' + desc + '</small></div>' + (cost == null ? '<button class="go" disabled>MAKS</button>' : '<button class="go' + (D.wallet.coins() < cost ? ' poor' : '') + '" data-gup="' + k + '"><img src="' + IC.coin + '" alt="">' + fmt(cost) + '</button>') + '</div>';
      return vals + '<div class="tambang-sec"><h4>UPGRADE GUDANG <small>dibayar Koin</small></h4>'
        + row('cap', 'Kapasitas peti', 'Muatan otomatis dari lift & hutan', fmt(g.cap) + ' item', g.next_cap == null ? null : fmt(g.next_cap), g.next_cap_cost, g.cap_lv, 5)
        + row('off', 'Waktu offline', 'Pekerja tetap jalan saat kamu pergi', g.off_h + ' jam', g.next_off == null ? null : g.next_off + ' jam', g.next_off_cost, g.off_lv, 2) + '</div>';
    }
    const full = g.used >= g.cap, dr = D.drops(), ready = g.used > 0;
    return '<div class="tambang-stats">' + stat('PETI GUDANG', g.used, g.cap, full) + '</div>'
      + '<button class="tambang-bigbtn claim" data-claim="1"' + (ready ? '' : ' disabled') + '>' + (ready ? 'KLAIM KE INVENTORI' : 'GUDANG KOSONG') + '</button>'
      + '<p class="tambang-note">' + (full ? '⚠ Peti penuh — pengangkutan berhenti sampai kamu klaim.' : 'Lift & penebang mengisi otomatis' + (g.transit ? ' · di lift: ' + fmt(g.transit) : '') + '.') + '</p>'
      + '<div class="tambang-sec"><h4>ORE MENTAH <small>antre dilebur</small></h4><div class="tambang-cells">' + ['copper', 'iron', 'gold'].map((k) => cell(ore(k).c, ore(k).n.replace('Ore ', ''), inv[k])).join('') + '</div></div>'
      + '<div class="tambang-sec"><h4>HASIL LEBUR</h4><div class="tambang-cells">' + ['copper', 'iron', 'gold'].map((k) => cell(GOODC[k], GOODN[k].replace('Batang ', ''), gd[k])).join('') + '</div></div>'
      + '<div class="tambang-sec"><h4>PERMATA <small>tidak dilebur</small></h4><div class="tambang-cells">' + ['lapis', 'amethyst', 'diamond'].map((k) => cell(GOODC[k], GOODN[k].replace(' Lazuli', ''), gd[k])).join('') + '</div></div>'
      + '<div class="tambang-sec"><h4>BAHAN BAKAR <small>cadangan ' + g.keep.wood + ' kayu · ' + g.keep.coal + ' batu bara tidak ikut diklaim</small></h4><div class="tambang-cells two">' + cell('#8a5a2b', 'Kayu', D.wood()) + cell('#3a3a44', 'Batu Bara', inv.coal) + '</div></div>'
      + '<p class="tambang-note">Inventori ' + fmt(g.bag) + ' item · Offline: Gudang tetap bekerja maks ' + g.off_h + ' jam</p>';
  }
  function invHTML() {
    const bg = D.bag(), pl = D.sellPlan(), W = D.SELL, rows = [];
    const price = (pr) => (pr.c ? fmt(pr.c) + ' Koin' : '') + (pr.g ? fmt(pr.g) + ' Emerald' : '');
    const row = (grp, k, nm, col, q) => { if (q < 1) return; const pr = W[grp][k];
      rows.push('<div class="tambang-rec up"><div class="nm"><i class="tambang-dot" style="background:' + col + '"></i>' + nm + ' × ' + fmt(q) + '<span class="cur" style="font-size:24px">' + price(pr) + ' <em>/ buah</em></span></div><button class="go" data-sell="' + grp + ':' + k + '">JUAL</button></div>'); };
    Object.keys(GOODN).forEach((k) => row('goods', k, GOODN[k], GOODC[k], bg.goods[k]));
    ['copper', 'iron', 'lapis', 'gold', 'amethyst', 'diamond', 'coal'].forEach((k) => row('ore', k, ore(k).n, ore(k).c, bg.inv[k]));
    row('wood', 'wood', 'Kayu', '#8a5a2b', bg.wood);
    const pw = D.powers(), pk = Object.keys(pw).filter((k) => pw[k] > 0);
    const vals = '<div class="tambang-vals"><span class="tambang-val"><img src="' + IC.gem + '" alt="">' + fmt(D.wallet.gems()) + '</span><span class="tambang-val"><img src="' + IC.coin + '" alt="">' + fmt(D.wallet.coins()) + '</span></div>';
    return vals + (pl.n ? '<button class="tambang-bigbtn claim" data-sellall="1">JUAL SEMUA · +' + (pl.coins ? fmt(pl.coins) + ' Koin' : '') + (pl.coins && pl.gems ? ' ' : '') + (pl.gems ? '+' + fmt(pl.gems) + ' Emerald' : '') + '</button>' : '')
      + '<div class="tambang-sec"><h4>BARANG <small>' + fmt(D.gudang().bag) + ' item</small></h4>' + (rows.length ? rows.join('') : '<p class="tambang-note">Inventori kosong.<br>Klaim hasil dari Gudang dulu, lalu jual di sini.</p>') + '</div>'
      + (pk.length ? '<div class="tambang-sec"><h4>POWER-UP <small>hadiah langka · belum bisa dijual</small></h4><div class="tambang-cells">' + pk.map((k) => cell('#ffd24d', powN(k), pw[k])).join('') + '</div></div>' : '');
  }
  function forestSec() {
    const f = D.forest(), open = f.workers > 0;
    return '<div class="tambang-sec"><h4>HUTAN · ' + (open ? 'penebang ' + f.workers + ' / ' + f.max : 'belum dibuka') + '</h4>'
      + '<p>' + (open ? 'Pohon berdiri ' + f.up + ' / ' + f.total + ' · +' + f.yield + ' kayu per pohon, tumbuh lagi ±' + f.regrow_min + ' menit.' : 'Buka hutan dengan mempekerjakan penebang pertama. Kayu dipakai sebagai bahan bakar Furnace.') + '</p></div>'
      + (f.next_cost == null ? '<button class="tambang-bigbtn" disabled>Penebang MAKS</button>' : '<button class="tambang-bigbtn' + (D.wallet.coins() < f.next_cost ? ' poor' : '') + '" data-hire="1">' + (open ? 'Tambah penebang' : 'Buka Hutan') + ' · ' + fmt(f.next_cost) + ' Koin</button>');
  }
  function tungkuHTML() {
    const inv = D.inv(), fu = D.fuelUnits(), fn = D.furnace(), act = D.smeltActive(), rg = D.restGlobal();
    const rows = Object.keys(D.RECIPES).map((id) => { const r = D.RECIPES[id];
      return '<div class="tambang-rec"><img src="' + r.ic + '" alt=""' + (r.fl ? ' style="filter:' + r.fl + '"' : '') + '><div class="nm">' + ore(r.ore).n + ' × ' + fmt(inv[r.ore]) + '<small>+' + r.qty + ' ' + r.n + ' · bakar ' + r.fuel + '</small></div></div>'; }).join('');
    const up = fn.next_cost == null ? '<button class="tambang-bigbtn" disabled>Furnace MAKS (3)</button>' : '<button class="tambang-bigbtn' + (D.wallet.coins() < fn.next_cost ? ' poor' : '') + '" data-furn="1">Bangun Furnace ke-' + (fn.n + 1) + ' · ' + (fn.next_cost === 0 ? 'GRATIS' : fmt(fn.next_cost) + ' Koin') + '</button>';
    const st = fn.n < 1 ? 'Bangun furnace; tukang bakar datang sendiri.' : rg.resting ? 'Tukang bakar ' + (rg.kind === 'sleep' ? 'tidur 😴' : 'makan 🍖') + ' · lanjut ' + dur(rg.left / 1000) : act ? 'Melebur otomatis 🔥 · antre ' + fmt(D.smeltQueue()) + ' ore' : (D.smeltQueue() < 1 ? 'Menunggu ore dari lift.' : 'Bahan bakar kurang — tunggu penebang kirim kayu.');
    return '<div class="tambang-sec" style="margin-top:0"><h4>FURNACE ' + fn.n + ' / ' + fn.max + '</h4><p>' + st + '</p></div>' + up
      + '<div class="tambang-sec"><h4>BAHAN BAKAR · tenaga ' + fmt(fu) + '</h4><p>Kayu ' + fmt(D.wood()) + ' (×' + D.FUEL.wood + ') · Batu bara ' + fmt(inv.coal) + ' (×' + D.FUEL.coal + '). Hasil masuk Gudang lalu di-Klaim.</p></div>'
      + '<div class="tambang-sec"><h4>RESEP · otomatis</h4>' + rows + '</div>';
  }
  const BLD = { gudang: ['Gudang', () => { gtab = 'peti'; return gudangHTML(); }], inventori: ['Inventori', invHTML], gupgrade: ['Upgrade Gudang', () => { gtab = 'up'; return gudangHTML(); }], hutan: ['Hutan', () => { gtab = 'hutan'; return gudangHTML(); }], tungku: ['Furnace', tungkuHTML] };
  let bldOpen = null;
  function openBuilding(bid) { if (!BLD[bid]) return; ask(BLD[bid][0], BLD[bid][1](), 'TUTUP', '', null); md.classList.add('bld'); bldOpen = bid; $('tambang-m-no').addEventListener('click', clearBld, { once: true }); }
  function clearBld() { bldOpen = null; }
  function rerender() { if (bldOpen && md.classList.contains('on')) $('tambang-mx').innerHTML = BLD[bldOpen][1](); }
  MW.ui.onWood = function (n) { toast('+' + n + ' kayu'); paintGudang(true); rerender(); };
  $('tambang-mx').addEventListener('click', (e) => {
        if (e.target.closest('[data-claim]')) {
      const r = D.claim(); D.feedback();
      if (!r.ok) toast(D.MSG[r.reason] || 'Gagal', true); else { toast('+' + fmt(r.moved) + ' item masuk inventori'); MW.debris.spawn(new THREE.Vector3(28.6, MW.GROUND + 2, 1.8), 0x2fe07a, 14); }
      paintGudang(true); rerender(); return;
    }
    const sl = e.target.closest('[data-sell]');
    if (sl) { const q = sl.dataset.sell.split(':'), r = D.sellItem(q[0], q[1]); D.feedback(); if (r.ok) { toast('Terjual ' + fmt(r.n) + ' · +' + (r.coins ? fmt(r.coins) + ' Koin' : '') + (r.gems ? ' +' + fmt(r.gems) + ' Emerald' : '')); paintCur(); } else toast(D.MSG[r.reason] || 'Gagal', true); rerender(); return; }
    if (e.target.closest('[data-sellall]')) { const r = D.sellAll(); D.feedback(); if (r.ok) { toast('Terjual ' + fmt(r.n) + ' barang · +' + (r.coins ? fmt(r.coins) + ' Koin' : '') + (r.gems ? ' +' + fmt(r.gems) + ' Emerald' : '')); paintCur(); MW.debris.spawn(new THREE.Vector3(16, MW.GROUND + 2, 2), 0xffd24d, 20); } else toast(D.MSG[r.reason] || 'Gagal', true); rerender(); return; }
    const gu = e.target.closest('[data-gup]');
    if (gu && !gu.disabled) { const r = D.gudangUp(gu.dataset.gup); D.feedback(); if (r.ok) { toast('Gudang di-upgrade!'); paintCur($('tambang-cur-co')); } else toast(D.MSG[r.reason] || 'Koin tidak cukup', true); paintGudang(); rerender(); return; }
    if (e.target.closest('[data-furn]')) {
      const fn = D.furnace(); if (fn.next_cost == null) return;
      if (D.wallet.coins() < fn.next_cost) { toast('Koin tidak cukup', true); return; }
      const r = D.furnaceUp(); if (r.ok) { toast(D.furnace().n === 1 ? 'Furnace pertama dibangun (gratis)!' : 'Furnace baru dibangun!'); paintCur($('tambang-cur-co')); MW.debris.spawn(new THREE.Vector3(7.2 + 3.8 * (D.furnace().n - 1) + 0.0, MW.GROUND + 1.5, 1.4), 0xff9a3a, 16); } else toast(D.MSG[r.reason] || 'Gagal', true); rerender(); return;
    }
    if (e.target.closest('[data-hire]')) {
      const f = D.forest(); if (f.next_cost == null) return;
      if (D.wallet.coins() < f.next_cost) { toast('Koin tidak cukup', true); return; }
      const r = D.hire(); if (r.ok) { toast(D.forest().workers === 1 ? 'Hutan dibuka! Penebang pertama bergabung' : 'Penebang baru bergabung!'); paintCur($('tambang-cur-co')); } else toast(D.MSG[r.reason] || 'Gagal', true); rerender();
    }
  });
  gB.addEventListener('click', () => openBuilding('gudang'));
  $('tambang-inv').addEventListener('click', () => openBuilding('inventori')); $('tambang-furn').addEventListener('click', () => openBuilding('tungku')); $('tambang-gup').addEventListener('click', () => openBuilding('gupgrade')); $('tambang-forest').addEventListener('click', () => openBuilding('hutan'));
  $('tambang-mclose').addEventListener('click', () => $('tambang-m-no').click());
  $('tambang-boostall').addEventListener('click', () => {
    const p = D.boostPlan();
    if (!p.n) { toast(D.slots.some((x) => x.unlocked && x.mgr) ? 'Tidak ada tambang yang bisa dipercepat' : D.MSG['perlu-manager'], true); return; }
    if (D.wallet.coins() < p.cost) { ask('Koin tidak cukup', 'Boost semua (' + p.n + ' tambang) butuh ' + fmt(p.cost) + ' Koin.<br>Saldo kamu ' + fmt(D.wallet.coins()) + ' Koin.<br><small style="font-size:26px;color:#b9b1d3">Beberapa tambang tetap dipercepat sesuai saldo bila kamu lanjut dari tombol Percepat per tambang.</small>', 'TUTUP', '', null); return; }
    ask('Boost Semua', 'Percepat ' + p.n + ' tambang ×' + D.config.boost_mult + '<br>seharga ' + fmt(p.cost) + ' Koin?', 'BATAL', 'PERCEPAT', async () => { D.feedback(); const r = await D.boostAll(); buildCard(); paintCur($('tambang-cur-co')); toast(r.ok ? 'Boost aktif di ' + r.n + ' tambang ⚡' : D.MSG['saldo-kurang'], !r.ok); });
  });
  const bubB = $('tambang-bub-b'), bubU = $('tambang-bub-u'); let bubMode = '';
  bubB.addEventListener('click', () => { const i = Wd.cur, s = D.slots[i - 1]; if (!s || !s.unlocked) return; if (D.boostLeft(i) > 0) { toast('Percepat masih aktif', false); return; } pre(i, 'boost'); });
  bubU.addEventListener('click', () => { if (!cardOpen || panel !== 'prod') openPanel('prod'); });
  const lockEl = $('tambang-lock'), lockT = $('tambang-lock-t'), lockBtn = $('tambang-lock-btn');
  lockBtn.addEventListener('click', () => { if (Wd.cur >= 1) pre(Wd.cur, 'unlock'); });
  function paintLock() {
    const i = Wd.cur, s = D.ready && i >= 1 ? D.slots[i - 1] : null, on = !!(s && !s.unlocked);
    if (lockEl.classList.contains('on') !== on) lockEl.classList.toggle('on', on);
    if (on) {
      lockT.textContent = 'TAMBANG ' + i;
      const cu = s.can_unlock !== false, lb = lockBtn.lastElementChild, h = cu ? '🔓 BUKA · ' + fmt(s.unlock_cost) + ' Koin' : '🔒 Buka Tambang ' + (i - 1) + ' dulu';
      if (lb.textContent !== h) lb.textContent = h;
      lockBtn.classList.toggle('poor', !cu || D.wallet.coins() < s.unlock_cost); lockBtn.classList.toggle('wait', !cu);
    }
    const pl = prodB.lastElementChild, want = on ? (s.can_unlock !== false ? '🔓 BUKA' : '🔒 TERKUNCI') : 'PRODUKSI';
    if (pl.textContent !== want) pl.textContent = want; prodB.classList.toggle('open', on && s.can_unlock !== false);
  }
  function updateBubbles() {
    paintLock();
    const i = Wd.cur, w = D.ready && Wd.cur >= 1 && Math.abs(Wd.s - Wd.cur) < 0.12 && !drag && !pan ? workerOf(i) : null, s = D.slots[i - 1];
    if (!w || !s) { bubB.hidden = bubU.hidden = true; return; }
    const v = new THREE.Vector3(); w.getWorldPosition(v); v.y += 2.75; v.project(camera);
    const px = (v.x + 1) / 2 * SW, py = (1 - v.y) / 2 * SH;
    bubB.hidden = bubU.hidden = false;
    if (!s.unlocked) { bubB.hidden = bubU.hidden = true; return; }
    if (false) { bubB.hidden = true; bubU.className = 'tambang-bub k'; bubU.innerHTML = '<img src="images/tambang-gembok.webp" alt="">'; bubMode = 'k'; bubU.style.transform = 'translate(' + (px - 34) + 'px,' + (py - 34) + 'px)'; return; }
    if (bubMode === 'k') { bubU.className = 'tambang-bub u'; bubU.innerHTML = '<img src="images/tambang-panah-kembali.webp" alt="">'; bubMode = ''; }
    bubB.classList.toggle('off', D.boostLeft(i) > 0 || s.boost.left_today <= 0);
    bubB.style.transform = 'translate(' + (px - 78) + 'px,' + (py - 34) + 'px)'; bubU.style.transform = 'translate(' + (px + 10) + 'px,' + (py - 34) + 'px)';
  }
  paintGudang(); syncLift();
  D.wallet.subscribe(() => paintGudang());

  /* ---------- loop ---------- */
  let last = performance.now(), T = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
    if (!pan || pan.axis !== 'v') Wd.s += (Wd.sT - Wd.s) * (1 - Math.exp(-dt * 6.5));
    Wd.cx += (Wd.cxT - Wd.cx) * (1 - Math.exp(-dt * 10));
    setHud(clamp(Math.round(Wd.s), MIN, N));
    MW.tick(dt, T); updateMarkers(T); updateBubbles();
    tripStep();
    renderer.render(Wd.scene, camera);
  }
  Wd.sT = 0; Wd.s = 0; refreshCount(); setHud(0);
  requestAnimationFrame(frame);
  window.__mw = MW;
})();
