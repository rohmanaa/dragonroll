/* profile.js — panel PROFIL di dalam hub (assets/js/pages/account.js + UT.AccountHub). Dibungkus modul UT.PageModule ('profil');
   hub yang me-mount/unmount-nya saat tab Profil dipilih/ditinggalkan. Kerangka modal, tab, tombol X, dan Esc dikelola hub.
   Halaman mandiri otomatis mount; unmount() melepas rAF, listener, langganan, dan renderer WebGL bersama (SharedGL). */
UT.PageModule.define('profil', function(env) {
const {setTimeout, clearTimeout, addEventListener} = env;
const $ = s => document.querySelector(s);
const PD = window.PlayerData, IC = window.ItemCatalog, AR = window.ItemArt;
const SV = () => PD.serverMode(), WS = () => window.UT && UT.WalletService && UT.WalletService.get();
const SET = () => PD.settings();
const fmt = n => Number(n).toLocaleString('id-ID');
const K = 'assets/images/ui/', G = K + 'white-glyphs/';
const buzz = () => { try { if (SET().vibration && navigator.vibrate) navigator.vibrate(15); } catch (e) {} };
const snd = n => { try { if (SET().sound) UT.Audio.play(n || 'button'); } catch (e) {} };
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1800); }
/* navigasi: di shell (play.html) SEMUA target lewat UT.Spa.go (view atau iframe) agar shell tidak ditinggalkan, sama seperti lobby/karakter;
   halaman mandiri (tanpa UT.Spa): fade + location.href */
const nav = u => {
  if (UT.Spa && UT.Spa.go) { UT.Spa.go(u); return; }
  const f = $('#fade');
  if (f) f.classList.add('on');
  setTimeout(() => { location.href = u; }, 330);
};
/* halaman yang sudah ada (sama dengan BUILT di lobby); lainnya = toast */
const BUILT = ['karakter.html', 'mode.html', 'settings.html', 'room.html', 'hadiah-misi.html', 'shop.html', 'profile.html', 'frame.html', 'dadu.html', 'efek.html', 'powerup.html', 'leaderboard.html', 'friendship.html', 'tambang.html', 'mail.html', 'pet.html'];
const go = u => BUILT.includes(u.split('?')[0]) ? nav(u) : toast('Segera hadir');

/* ---- data: PlayerData (level/XP/skin/koleksi) + server get_my_profile (menang/main/streak, peringkat, misi) ---- */
let SRV = null;
const PROF = {uid: '—', rank: null,
 get joined() { try { return new Date(PD.joinedAt()).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}); } catch (e) { return '—'; } },
 get win() { return SRV ? SRV.wins : PD.stats().wins; }, get play() { return SRV ? SRV.plays : PD.stats().plays; }, get streak() { return SRV ? SRV.streak : PD.stats().streak; }};
const pname = () => PD.profile().name;
const eqSkin = () => IC.byId(PD.equippedId('skin')) || IC.byId('skin.steve');
const owned = k => PD.ownedItems().filter(o => o.item.kind === k).length;
const total = k => IC.items.filter(i => i.kind === k && !i.off).length;
const MIS = () => ((SRV && SRV.counters) || {}).missions_done || 0;

/* Esc dan tombol Tutup dikelola hub (UT.AccountHub): kembali ke halaman asal, bukan hanya ke lobby. */

/* ---- tengah: karakter 3D terpasang (BlockyCharacter dari PlayerData) di atas pedestal ---- */
let R = null, webOk = typeof THREE !== 'undefined' && !!(window.UT && UT.BlockyCharacter);
function buildChar() {
  if (env.disposed) return;
  const art = $('#art');
  if (!webOk) { art.innerHTML = `<div class="noweb">${AR.face(eqSkin().id)}</div>`; return; }
  if (!R) {
    try {
      art.innerHTML = '';
      /* Pakai SharedGL agar renderer dipakai bersama antar halaman SPA */
      const acquired = UT.SharedGL.acquire('profile', {alpha: true, shadows: false});
      const r = acquired.renderer, cv = acquired.canvas;
      art.appendChild(cv);
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1, .1, 100);
      scene.add(new THREE.AmbientLight(0xffffff, .3), new THREE.HemisphereLight(0xb9cdf0, 0x4a3a62, .3));
      const sun = new THREE.DirectionalLight(0xffe2b0, .78); sun.position.set(7, 9, 6); scene.add(sun);
      const rim = new THREE.DirectionalLight(0x8fb4ff, .35); rim.position.set(-8, 5, -6); scene.add(rim);
      const holder = new THREE.Group(); scene.add(holder);
      R = {r, scene, cam, holder, cv, ch: null};
      /* resize observer: pakai env.own agar dibersihkan */
      const ro = new ResizeObserver(sizeGL);
      ro.observe(cv);
      env.own(function () { ro.disconnect(); });
    } catch (e) {
      webOk = false; R = null;
      console.warn('[profil] WebGL tidak tersedia', e);
      buildChar();
      return;
    }
  }
  const sig = JSON.stringify([PD.look(), PD.gearLook()]);
  if (R.ch && R.sig === sig) { renderOnce(); return; }   /* tampilan sama: pakai karakter yang sudah ada, tidak dibuat/dijepret ulang */
  R.sig = sig;
  if (R.ch) R.holder.remove(R.ch.root);
  const ch = UT.BlockyCharacter.create(THREE); ch.loadFromPlayer(); ch.setMode('pose1'); ch.tick(.016);
  const w = new THREE.Group(); w.scale.setScalar(3.7); w.position.y = 0; w.rotation.set(0, -.55, .05); w.add(ch.root); R.holder.add(w); R.ch = ch; R.w = w; frameCam(); renderOnce();
  /* jaga-jaga bila tekstur wajah/outfit selesai dimuat sesudahnya */
  [120, 500].forEach(ms => setTimeout(renderOnce, ms));
}
/* kamera: FOTO dada-kepala (setengah atas badan, tanpa aura), sedikit serong seperti pose siap tempur. Wajah & outfit mengikuti skin yang dipakai (PlayerData). */
function frameCam() {
  if (!R || !R.w) return; R.scene.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(R.w), s = b.getSize(new THREE.Vector3());
  const h = s.y * .46, cy = b.max.y - h * .5 + s.y * .02;
  const asp = (R.cv.clientWidth / Math.max(1, R.cv.clientHeight)) || 1;
  const tn = Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2));
  const d = Math.max(h / 2 / tn, (s.x * .62) / (tn * asp)) + s.z * .5;
  R.cam.position.set(0, cy, d); R.cam.lookAt(0, cy, 0); R.cam.updateProjectionMatrix(); R.cam.updateMatrixWorld(true);
}
function sizeGL() {
  if (!R) return;
  const w = R.cv.clientWidth, h = R.cv.clientHeight;
  if (!w || !h) return;
  R.r.setPixelRatio(SET().graphics === 'ultra' ? Math.min(devicePixelRatio, 2) : SET().graphics === 'high' ? Math.min(devicePixelRatio, 1.5) : 1);
  R.r.setSize(w, h, false);
  R.cam.aspect = w / h;
  R.cam.updateProjectionMatrix();
  frameCam(); renderOnce();
}
/* FOTO diam: karakter tidak bergerak (tanpa loop rAF). Dirender sekali setelah dipasang, lalu ulang hanya saat ukuran/skin berubah. */
function renderOnce() {
  if (env.disposed || !R || !R.ch) return;
  R.ch.tick(.016); R.r.render(R.scene, R.cam);
}
/* cleanup WebGL: lepas SharedGL, buang geometri/material/aura */
env.own(function () {
  try { UT.SharedGL.release('profile'); } catch (e) {}
  if (R) {
    /* AuraView tidak punya dispose(): clearAll() = despawn semua aura (pool/efek dilepas), baru geometri scene dibuang di bawah */
    try { if (R.aura && R.aura.clearAll) R.aura.clearAll(); } catch (e) {}
    try { if (R.ch && R.ch.root) R.holder.remove(R.ch.root); } catch (e) {}
    try {
      /* buang semua geometri dan material di scene */
      R.scene.traverse(function (obj) {
        try { if (obj.geometry) obj.geometry.dispose(); } catch (_) {}
        if (obj.material) {
          var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(function (m) { try { if (m.map) m.map.dispose(); m.dispose(); } catch (_) {} });
        }
      });
    } catch (e) {}
    R = null;
  }
  document.documentElement.classList.remove('pf-wide');
});

/* ---- tengah: AKUN ---- */
const EMO = ['😎', '🔥', '🐉', '⚔️', '👑', '🛡️', '🎲', '🍀', '😈', '🤖', '🦊', '🐺', '🌟', '💎', '😴', '🥷', '🧙', '🏆', '💀', '🌈', '😂', '🥶', '🌋', '🐍'];
/* 3 emoji "siapa dirimu" disimpan lokal (UT.Prefs 'profileEmoji'); belum disinkronkan ke server */
const emo = () => { let a = null; try { a = UT.Prefs.get('profileEmoji', null); } catch (e) {} if (!Array.isArray(a)) a = ['😎', '🔥', '🐉']; return [0, 1, 2].map(i => a[i] || EMO[i]); };
function drawAkun() {
  const L = PD.levelInfo();
  $('#hnm').textContent = pname();
  $('#hid').textContent = `ID ${PROF.uid} · Bergabung ${PROF.joined}`;
  const lvn = $('#lvn'); lvn.textContent = L.level; lvn.classList.toggle('w3', String(L.level).length >= 3);
  const e = emo(); document.querySelectorAll('.eb').forEach((b, i) => { b.textContent = e[i]; b.setAttribute('aria-label', 'Emoji ' + (i + 1)); });
  $('#rk-v').textContent = PROF.rank ? '#' + fmt(PROF.rank) : '—';
  $('#rk-p').textContent = SRV && SRV.points != null ? fmt(SRV.points) : '—';
}
function drawPet() {
  const id = PD.equippedId('pet'), it = id && IC.byId(id), el = $('#pet');
  el.classList.toggle('empty', !it);
  el.querySelector('.pimg').style.backgroundImage = `url(${it ? (it.image || 'data/inventory/pet/items/' + it.gameKey + '/' + it.gameKey + '.png') : K + 'lobby/pet.webp'})`;
  el.querySelector('.pnm').textContent = it ? it.name : 'Belum ada pet';
}
$('#pet').onclick = () => { snd(); go('pet.html'); };
$('#rank').onclick = () => { snd(); go('leaderboard.html'); };
$('#hid').onclick = () => {
  snd();
  if (!PROF.uid || PROF.uid === '—') { toast('ID belum tersedia'); return; }
  const ok = () => toast('ID pengguna disalin'), fail = () => toast('Gagal menyalin ID');
  try { navigator.clipboard.writeText(PROF.uid).then(ok, fail); } catch (x) { fail(); }
};
$('#pen').onclick = () => {
  snd(); const un = UT.Session.username();
  if (un) { toast('Nama mengikuti username akunmu: ' + un); return; }
  const v = (prompt('Nama baru (3–12 karakter)', pname()) || '').trim();
  if (!v) return; if (v.length < 3 || v.length > 12) { toast('Nama 3–12 karakter'); return; }
  PD.setName(v); draw(); toast('Nama diperbarui');
};
/* pemilih emoji: tap salah satu dari 3 emoji -> pilih pengganti */
let eSlot = 0;
$('#egrid').innerHTML = EMO.map(x => `<button class="ecell" type="button">${x}</button>`).join('');
document.querySelectorAll('.eb').forEach(b => { b.onclick = () => { snd(); eSlot = +b.dataset.i; $('#epick').classList.add('on'); }; });
$('#egrid').onclick = ev => { const c = ev.target.closest('.ecell'); if (!c) return; snd(); const a = emo(); a[eSlot] = c.textContent; try { UT.Prefs.set('profileEmoji', a); } catch (e) {} $('#epick').classList.remove('on'); drawAkun(); };
$('#epick').onclick = ev => { if (ev.target === $('#epick')) $('#epick').classList.remove('on'); };

/* ---- kanan: KOLEKSI (dimiliki / total katalog) ---- */
const KOL=[["Karakter","skin","item-icons/helm-ksatria.webp","#e5604e","karakter.html"],["Frame","frame","feature-icons/frame.webp","#e89a52","#frame"],["Dadu","dice","feature-icons/dadu.webp","#3fc6a8","inventory.html?tab=dadu"],["Efek","aura","gem-medal-icons/kristal-api.webp","#d26f9c","inventory.html?tab=efek"],["Power-up","powerup","gem-medal-icons/petir-ungu.webp","#4db3e6","inventory.html?tab=power"],["Pet","pet","lobby/pet.webp","#b07cff","pet.html"]];
function drawKol() {
  $('#kol').innerHTML = KOL.map(([n, k, ic, c, u]) => { const a = owned(k), t = Math.max(total(k), a); return `<button class="kr" data-u="${u}" style="--c:${c}"><div class="ic"><img src="${K}${ic}" alt=""></div><div class="nm">${n}</div><em>${a}/${t}</em></button>`; }).join('');
}
$('#kol').onclick = e => { const b = e.target.closest('.kr'); if (b) { snd(); if (b.dataset.u === '#frame') frameOpen(); else go(b.dataset.u); } };

/* ---- kanan: STATISTIK (server get_my_profile; offline = data lokal / "—") ---- */
function drawStat() {
  const w = PROF.win, p = PROF.play, wr = p ? Math.round(w / p * 100) : 0;
  const row = (ic, label, v, u) => `<${u ? 'button' : 'div'} class="sr"${u ? ` data-u="${u}"` : ''}><div class="ic"><img src="${ic}" alt=""></div><div class="nm">${label}</div><div class="v">${v}</div></${u ? 'button' : 'div'}>`;
  const rk = PROF.rank ? '#' + fmt(PROF.rank) + (PROF.rank === 1 ? `<img src="${K}item-icons/mahkota.webp" alt="">` : '') : '—';
  $('#sg').innerHTML =
    row(K + 'item-icons/podium.webp', 'Peringkat', rk, 'leaderboard.html') +
    row(K + 'item-icons/pedang-silang.webp', 'Rasio Kemenangan', wr + '%<small>' + w + '/' + p + '</small>') +
    row(K + 'item-icons/gulungan-misi.webp', 'Misi', MIS() + `<img class="go" src="${G}segitiga-kanan.webp" alt="">`, 'hadiah-misi.html') +
    row(K + 'item-icons/piala.webp', 'Win / Lose', w + ' / ' + Math.max(0, p - w)) +
    row(K + 'gem-medal-icons/petir-emas.webp', 'Win Streak', PROF.streak) +
    row(K + 'item-icons/gulungan-pena.webp', 'Main', p);
}
$('#sg').onclick = e => { const b = e.target.closest('button.sr'); if (b) { snd(); go(b.dataset.u); } };


/* ---- modal FRAME: pilih / beli frame foto profil. Data = ItemCatalog (kind 'frame'); pakai/beli lewat PlayerData + WalletService ---- */
const FRR = {common: ['Biasa', '#cfc8ea'], rare: ['Langka', '#4db3e6'], epic: ['Epik', '#b07cff'], legendary: ['Legendaris', '#ffd45a']};
const FRW = {'saldo-kurang': 'Coin tidak cukup.', 'gem-kurang': 'Emerald tidak cukup.', 'sudah-dimiliki': 'Frame sudah dimiliki.', 'tidak-tersedia': 'Frame tidak tersedia.', 'jaringan': 'Tidak dapat terhubung ke server.', 'belum-login': 'Silakan login ulang.', 'sedang-diproses': 'Sedang diproses...'};
const frList = () => IC.items.filter(i => i.kind === 'frame' && !i.off);
const frSell = i => !!i && ((typeof i.price === 'number' && i.price > 0) || (typeof i.gems === 'number' && i.gems > 0)) && !i.starter;
const frPrice = n => n >= 1000 ? (n / 1000).toLocaleString('id-ID', {maximumFractionDigits: 1}) + 'k' : fmt(n);
let frSel = null, frBusy = false, frOk = null;
const frOpen = () => $('#frmd').classList.contains('on');
function drawFrame() {
  if (env.disposed || !frOpen()) return;
  const L = frList();
  if (!frSel || !L.includes(frSel)) frSel = L.find(i => PD.isEquipped(i.id)) || L.find(i => PD.owns(i.id)) || L[0] || null;
  $('#frgrid').innerHTML = L.map(x => {
    const m = PD.owns(x.id), on = PD.isEquipped(x.id);
    return `<button class="fslot ${on ? 'st-used' : m ? 'st-own' : 'st-lock'}${x === frSel ? ' sel' : ''}" type="button" data-id="${x.id}" aria-label="${x.name} — ${on ? 'dipakai' : m ? 'dimiliki' : frSell(x) ? 'beli ' + frPrice(x.gems > 0 ? x.gems : x.price) : 'tidak dijual'}"><div class="th">${AR.frame(x.id)}</div>${on ? `<img class="ck" src="${G}centang.webp" alt="">` : ''}</button>`;
  }).join('');
  const b = $('#fract'), sp = b.querySelector('span'), f = frSel;
  if (!f) { b.style.display = 'none'; $('#frnm').textContent = 'Frame'; $('#frds').textContent = 'Belum ada frame.'; $('#frart').innerHTML = ''; return; }
  b.style.display = '';
  const m = PD.owns(f.id), on = PD.isEquipped(f.id), sell = frSell(f), r = FRR[f.rarity] || FRR.common;
  $('#frart').innerHTML = AR.frame(f.id);
  $('#frnm').textContent = f.name;
  $('#frrar').textContent = r[0]; $('#frrar').style.color = r[1];
  $('#frds').textContent = f.desc + (m ? '' : (sell ? ' Belum dimiliki — ini hanya preview, beli untuk memakainya.' : ' Belum dimiliki dan tidak dijual. Hanya preview.'));
  if (on) { b.dataset.mode = 'used'; b.disabled = true; sp.textContent = 'DIPAKAI'; }
  else if (m) { b.dataset.mode = 'equip'; b.disabled = false; sp.textContent = 'PAKAI'; }
  else if (sell) { b.dataset.mode = 'buy'; b.disabled = false; sp.textContent = 'BELI ' + frPrice(f.gems > 0 ? f.gems : f.price) + (f.gems > 0 ? ' EMERALD' : ' COIN'); }
  else { b.dataset.mode = 'no'; b.disabled = true; sp.textContent = 'TIDAK DIJUAL'; }
}
function frameOpen() { const m = $('#frmd'); m.classList.add('on'); m.setAttribute('aria-hidden', 'false'); drawFrame(); }
function frameClose() { const m = $('#frmd'); m.classList.remove('on'); m.setAttribute('aria-hidden', 'true'); $('#frcf').classList.remove('on'); }
async function frameBuy(f) {
  if (frBusy) return; frBusy = true;
  try {
    const r = SV() ? await WS().buy(f.id) : PD.purchase(f.id);
    if (!r || !r.ok) { toast(FRW[r && r.reason] || 'Pembelian gagal.'); return; }
    snd('power'); buzz(); try { PD.equip(f.id); } catch (e) {}
    toast('Pembelian berhasil!');
  } finally { frBusy = false; drawFrame(); drawKol(); }
}
function frameAct() {
  const f = frSel; if (!f) return; const mode = $('#fract').dataset.mode;
  if (mode === 'equip') {
    const r = PD.equip(f.id);
    if (r && r.ok) { toast(f.name + ' dipakai'); snd(); buzz(); } else toast('Gagal memakai item.');
    drawFrame(); drawKol(); return;
  }
  if (mode !== 'buy') return;
  if (!PD.walletReady()) { toast('Menunggu saldo dari server...'); return; }
  const gem = f.gems > 0, need = gem ? f.gems : f.price, have = gem ? PD.gems() : PD.coins(), cur = gem ? 'Emerald' : 'Coin';
  if (have < need) { toast(`${cur} tidak cukup. Kurang ${fmt(need - have)}.`); return; }
  $('#frcft').textContent = `Beli ${f.name} seharga ${fmt(need)} ${cur}?`;
  frOk = () => frameBuy(f); $('#frcf').classList.add('on');
}
$('#frbtn').onclick = () => { snd(); frameOpen(); };
$('#frx').onclick = () => { snd(); frameClose(); };
$('#frmd').onclick = e => { if (e.target.id === 'frmd') frameClose(); };
$('#frgrid').onclick = e => { const c = e.target.closest('.fslot'); if (!c) return; const f = frList().find(x => x.id === c.dataset.id); if (!f) return; frSel = f; snd(); drawFrame(); };
$('#fract').onclick = () => { snd(); frameAct(); };
$('#frcf-no').onclick = () => { snd(); $('#frcf').classList.remove('on'); };
$('#frcf-ok').onclick = () => { snd(); $('#frcf').classList.remove('on'); const f = frOk; frOk = null; if (f) f(); };
{ const q = (UT.Spa && UT.Spa.current && UT.Spa.current()); const u = (q && q.url) || location.search; if (/[?&]frame=1\b/.test(u)) setTimeout(frameOpen, 0); }

function draw() { drawAkun(); drawPet(); drawKol(); drawStat(); }

/* ---- sinkron: event, dompet, tampilan server, get_my_profile ---- */
env.own(UT.Events.on('skinChanged', () => { draw(); buildChar(); }));
['inventoryChanged', 'frameChanged'].forEach(n => env.own(UT.Events.on(n, () => { drawKol(); drawPet(); drawFrame(); })));
if (UT.CharacterFace && UT.CharacterFace.watch) env.own(UT.CharacterFace.watch(() => { buildChar(); }));
try {
  env.own(PD.subscribe(r => {
    if (env.disposed) return;
    if(r==='server-appearance'||r==='server-outfits'){ draw(); buildChar(); }
  }));
} catch (e) {}
try { const A = SV() && UT.AppearanceService && UT.AppearanceService.get(); if (A) A.refreshThrottled().catch(() => {}); } catch (e) {}
(async () => {
  try {
    await import('../../../assets/js/multiplayer/client.js');
    if (env.disposed) return;
    const c = await UT.Multiplayer.getClient(), {data} = await c.auth.getSession();
    if (env.disposed) return;
    if (!data.session) return;
    PROF.uid = '#' + data.session.user.id.slice(0, 8).toUpperCase();
    await import('../../../assets/js/multiplayer/progress-service.js');
    if (env.disposed) return;
    const sp = await UT.Multiplayer.Progress.getMyProfile();
    if (env.disposed) return;
    if (sp && sp.exists) { SRV = sp; PROF.rank = sp.rank ? Number(sp.rank) : null; PD.applyServerStats({xp: sp.xp, plays: sp.plays, wins: sp.wins, streak: sp.streak, bestStreak: sp.best_streak, points: sp.points, weekPoints: sp.week_points, name: sp.name}); }
    draw();
  } catch (e) { console.warn('[profil] data server gagal', e); }
})();

/* skala kanvas 1920x1080 */
function fit() {
  const vw = innerWidth, vh = innerHeight, k = Math.min(vw / 1920, vh / 1080), wide = vw / vh >= 2;
  $('#stage').style.transform = 'scale(' + k + ')';
  document.documentElement.classList.toggle('pf-wide', wide);
  if (R && R.w) { sizeGL(); }
}
env.own(addEventListener('resize', fit));
fit();
draw();
buildChar();
/* tandai dokumen sudah siap */
document.documentElement.classList.add('ut-ready');
});
