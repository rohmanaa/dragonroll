/* profile.js — dipindah dari blok script inline (profile.html). Tahap 3 SPA: dibungkus modul UT.PageModule ('profile').
   Halaman mandiri otomatis mount; unmount() melepas rAF, listener, langganan, dan renderer WebGL bersama (SharedGL). */
UT.PageModule.define('profile', function(env) {
if(UT.ProfileTabs)UT.ProfileTabs.mount('profil',env);
const {setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame, addEventListener, removeEventListener} = env;
const $ = s => document.querySelector(s);
const PD = window.PlayerData, IC = window.ItemCatalog, AR = window.ItemArt;
const SV = () => PD.serverMode(), WS = () => window.UT && UT.WalletService && UT.WalletService.get();
const SET = () => PD.settings();
const fmt = n => Number(n).toLocaleString('id-ID');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
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
const LANG = {en: 'English', id: 'Indonesia', de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português', ru: 'Русский', hi: 'हिन्दी', zh: '简体中文'};
const frameSrc = () => { const f = IC.byId(PD.equippedId('frame')); return f && f.image ? f.image : 'data/frame/frame-default.webp'; };

/* ---- dompet ---- */
function showWallet() { const ok = PD.walletReady(); $('#v-em').textContent = ok ? fmt(PD.gems()) : '—'; $('#v-co').textContent = ok ? fmt(PD.coins()) : '—'; }
$('#cur-co').onclick = () => nav('shop.html?coin=1');
$('#cur-em').onclick = () => nav('tambang.html?from=profile.html');
/* tombol kembali: lobby sudah SPA — gunakan UT.Spa.go bila tersedia */
$('#back').onclick = () => { snd(); if (UT.Spa && UT.Spa.go) { UT.Spa.go('lobby.html'); } else { nav('lobby.html'); } };
/* event listener keydown dan resize didaftarkan via env.own agar dibersihkan saat unmount */
env.own(addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (UT.Spa && UT.Spa.go) UT.Spa.go('lobby.html');
    else nav('lobby.html');
  }
}));

/* ---- kiri: tab ---- */
const TABS = [['akun', 'Akun', 'profil-bulat.webp'], ['koleksi', 'Koleksi', 'tas-kulit.webp'], ['statistik', 'Statistik', 'grafik-batang.webp']];
$('#menu').innerHTML = TABS.map(([k, n, ic]) => `<button class="mb" data-k="${k}" aria-label="${n}"><div class="ic"><img src="${G}${ic}" alt=""></div><div class="lb">${n}</div></button>`).join('');
function tab(k) { document.querySelectorAll('.mb').forEach(b => b.classList.toggle('on', b.dataset.k === k)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + k)); }
$('#menu').onclick = e => { const b = e.target.closest('.mb'); if (b) { snd(); tab(b.dataset.k); } };
tab('akun');

/* ---- tengah: karakter 3D terpasang (BlockyCharacter dari PlayerData) di atas pedestal ---- */
let R = null, webOk = typeof THREE !== 'undefined' && !!(window.UT && UT.BlockyCharacter);
/* rafId untuk cleanup rAF */
let rafId = 0;
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
      scene.add(new THREE.AmbientLight(0xffffff, .7), new THREE.HemisphereLight(0xcfeaff, 0x6a9a50, .6));
      const sun = new THREE.DirectionalLight(0xfff2d8, .9); sun.position.set(6, 12, 8); scene.add(sun);
      const holder = new THREE.Group(); scene.add(holder);
      R = {r, scene, cam, holder, cv, ch: null};
      /* resize observer: pakai env.own agar dibersihkan */
      const ro = new ResizeObserver(sizeGL);
      ro.observe(cv);
      env.own(function () { ro.disconnect(); });
      /* mulai loop rAF */
      rafId = requestAnimationFrame(loop);
    } catch (e) {
      webOk = false; R = null;
      console.warn('[profil] WebGL tidak tersedia', e);
      buildChar();
      return;
    }
  }
  if (R.ch) R.holder.remove(R.ch.root);
  const ch = UT.BlockyCharacter.create(THREE); ch.loadFromPlayer(); ch.setMode('idle'); ch.tick(.016);
  const w = new THREE.Group(); w.scale.setScalar(3.7); w.position.y = 0; w.add(ch.root); R.holder.add(w); R.ch = ch; R.w = w; frameCam();
  try {
    if (UT.AuraView && UT.AuraFX) {
      if (!R.aura) R.aura = UT.AuraView.create(R.scene, R.cam);
      R.scene.updateMatrixWorld(true);
      R.aura.only(ch.root, UT.AuraView.equippedKey());
    }
  } catch (e) {}
}
/* kamera: karakter setinggi PODIUM.h px (ukuran stage 1920x1080) dengan TAPAK KAKI tepat di PODIUM.y */
const PODIUM = {f: 678 / 900, h: 430};
function frameCam() {
  if (!R || !R.w) return; R.scene.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(R.w), s = b.getSize(new THREE.Vector3());
  const art = $('#art'), H = R.cv.clientHeight || art.clientHeight || 900;
  const f = PODIUM.f;
  const tn = Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2));
  const vis = s.y * H / PODIUM.h, d = (vis / 2) / tn, z = d + s.z * .5;
  let ly = b.min.y + (f - .5) * vis;
  const put = () => { R.cam.position.set(0, ly, z); R.cam.lookAt(0, ly, 0); R.cam.updateProjectionMatrix(); R.cam.updateMatrixWorld(true); };
  put();
  const p = new THREE.Vector3(0, b.min.y, 0).project(R.cam);
  ly += (p.y - (1 - 2 * f)) * (z * tn); put();
}
function sizeGL() {
  if (!R) return;
  const w = R.cv.clientWidth, h = R.cv.clientHeight;
  if (!w || !h) return;
  R.r.setPixelRatio(SET().graphics === 'ultra' ? Math.min(devicePixelRatio, 2) : SET().graphics === 'high' ? Math.min(devicePixelRatio, 1.5) : 1);
  R.r.setSize(w, h, false);
  R.cam.aspect = w / h;
  R.cam.updateProjectionMatrix();
}
let lt = null;
function loop(t) {
  /* cek env.disposed agar loop berhenti setelah unmount */
  if (env.disposed) return;
  rafId = requestAnimationFrame(loop);
  if (!R || !R.ch || document.hidden) return;
  t /= 1000; const dt = lt == null ? .016 : Math.min(.05, Math.max(0, t - lt)); lt = t;
  R.ch.tick(dt); if (R.aura) R.aura.update(dt);
  R.r.render(R.scene, R.cam);
}

/* cleanup WebGL: lepas SharedGL, buang geometri/material/aura */
env.own(function () {
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
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

/* ---- kanan: AKUN ---- */
function drawAvatar() {
  const s = eqSkin(), face = (UT.CharacterFace && UT.CharacterFace.html('')) || AR.face(s.id);
  $('#avatar').innerHTML = `<span class="fc">${face}</span><img class="frm" src="${frameSrc()}" alt="" draggable="false" decoding="async">`;
  const profileFrame = $('#avatar .frm'); if (profileFrame && window.FrameFX) try { FrameFX.upgrade(profileFrame); } catch (e) {}
}
function drawAkun() {
  const L = PD.levelInfo(), pct = L.xpMax ? Math.min(100, L.xpIn / L.xpMax * 100) : 0, un = UT.Session.username();
  $('#hnm').textContent = pname();
  $('#hid').innerHTML = `ID ${esc(PROF.uid)}<br>Bergabung ${esc(PROF.joined)}`;
  $('#lvn').textContent = L.level; $('#lvp').textContent = pct.toFixed(1) + '%';
  $('#xpnote').textContent = `${fmt(L.xpIn)} / ${fmt(L.xpMax)} XP · butuh ${fmt(L.xpMax - L.xpIn)} XP lagi ke Level ${L.level + 1}`;
  requestAnimationFrame(() => requestAnimationFrame(() => { $('#lvf').style.width = pct + '%'; }));
  const lang = LANG[(UT.Prefs && UT.Prefs.get('lang', 'en'))] || 'English';
  $('#info').innerHTML = [['Nama', esc(pname()), 'name'], ['ID Pengguna', esc(PROF.uid), 'copy'], ['Akun', un ? '@' + esc(un) : '-'], ['Bergabung', esc(PROF.joined)], ['Bahasa', lang]]
    .map(([a, b, t]) => `<div class="ir${t ? ' tap' : ''}"${t ? ` data-t="${t}"` : ''}><span>${a}</span><b>${b}</b></div>`).join('');
  drawAvatar();
}
$('#info').onclick = e => {
  const r = e.target.closest('.ir[data-t]'); if (!r) return; snd();
  if (r.dataset.t === 'copy') { try { navigator.clipboard && navigator.clipboard.writeText(PROF.uid); } catch (x) {} toast('ID pengguna disalin'); return; }
  const un = UT.Session.username();
  if (un) { toast('Nama mengikuti username akunmu: ' + un); return; }
  const v = (prompt('Nama baru (3–12 karakter)', pname()) || '').trim();
  if (!v) return; if (v.length < 3 || v.length > 12) { toast('Nama 3–12 karakter'); return; }
  PD.setName(v); draw(); toast('Nama diperbarui');
};

/* ---- kanan: KOLEKSI (dimiliki / total katalog) ---- */
const KOL=[["Karakter","skin","item-icons/helm-ksatria.webp","#e5604e","karakter.html"],["Frame","frame","feature-icons/frame.webp","#e89a52","inventory.html?tab=frame"],["Dadu","dice","feature-icons/dadu.webp","#3fc6a8","inventory.html?tab=dadu"],["Efek","aura","gem-medal-icons/kristal-api.webp","#d26f9c","inventory.html?tab=efek"],["Power-up","powerup","gem-medal-icons/petir-ungu.webp","#4db3e6","inventory.html?tab=power"],["Pet","pet","lobby/pet.webp","#b07cff","pet.html"]];
function drawKol() {
  $('#kol').innerHTML = KOL.map(([n, k, ic, c, u]) => { const a = owned(k), t = Math.max(total(k), a); return `<button class="kr" data-u="${u}" style="--c:${c}"><div class="ic"><img src="${K}${ic}" alt=""></div><div class="nm">${n}</div><i><b data-w="${t ? Math.min(100, a / t * 100) : 0}"></b></i><em>${a}/${t}</em></button>`; }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.kr b').forEach(b => { b.style.width = b.dataset.w + '%'; })));
}
$('#kol').onclick = e => { const b = e.target.closest('.kr'); if (b) { snd(); go(b.dataset.u); } };

/* ---- kanan: STATISTIK (server get_my_profile; offline = data lokal / "—") ---- */
function drawStat() {
  const w = PROF.win, p = PROF.play, wr = p ? Math.round(w / p * 100) : 0;
  const row = (ic, label, v, u, bar) => `<${u ? 'button' : 'div'} class="sr"${u ? ` data-u="${u}"` : ''}><div class="ic"><img src="${ic}" alt=""></div><div class="nm">${label}</div>${bar != null ? `<i class="bar"><b data-w="${bar}"></b></i>` : ''}<div class="v">${v}</div></${u ? 'button' : 'div'}>`;
  const rk = PROF.rank ? '#' + fmt(PROF.rank) + (PROF.rank === 1 ? `<img src="${K}item-icons/mahkota.webp" alt="">` : '') : '—';
  $('#sg').innerHTML =
    row(K + 'item-icons/podium.webp', 'Peringkat Global', rk, 'leaderboard.html') +
    row(K + 'item-icons/pedang-silang.webp', 'Rasio Kemenangan', wr + '%<small>' + w + '/' + p + '</small>', null, wr) +
    row(K + 'item-icons/gulungan-misi.webp', 'Misi', MIS() + `<img class="go" src="${G}segitiga-kanan.webp" alt="">`, 'hadiah-misi.html') +
    row(K + 'item-icons/piala.webp', 'Win / Lose', w + ' / ' + Math.max(0, p - w)) +
    row(K + 'gem-medal-icons/petir-emas.webp', 'Win Streak', PROF.streak);
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.sr i.bar b').forEach(b => { b.style.width = b.dataset.w + '%'; })));
}
$('#sg').onclick = e => { const b = e.target.closest('button.sr'); if (b) { snd(); go(b.dataset.u); } };

function draw() { drawAkun(); drawKol(); drawStat(); showWallet(); }

/* ---- sinkron: event, dompet, tampilan server, get_my_profile ---- */
env.own(UT.Events.on('currencyChanged', showWallet));
env.own(UT.Events.on('skinChanged', () => { draw(); buildChar(); }));
env.own(UT.Events.on('frameChanged', () => { drawAvatar(); }));
['inventoryChanged'].forEach(n => env.own(UT.Events.on(n, () => { drawKol(); })));
if (UT.CharacterFace && UT.CharacterFace.watch) env.own(UT.CharacterFace.watch(() => { drawAvatar(); buildChar(); }));
try {
  env.own(PD.subscribe(r => {
    if (env.disposed) return;
    if (r === 'server-wallet' || r === 'storage' || r === 'pageshow') showWallet();
    if(r==='server-appearance'||r==='server-outfits'){ draw(); buildChar(); }
  }));
} catch (e) {}
try { const A = SV() && UT.AppearanceService && UT.AppearanceService.get(); if (A) A.refreshThrottled().catch(() => {}); } catch (e) {}
if (SV() && WS()) WS().refresh().then(r => { if (env.disposed) return; if (r && r.ok) showWallet(); });
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
/* gambar latar: n = 16:9 (profile-bg.webp), w = layar lebar (profile-bg-wide.webp). x,y = titik tengah permukaan atas podium (px gambar), pw = lebar podium */
const BG = {n: {w: 1672, h: 941, x: 628, y: 676, pw: 517}, w: {w: 1893, h: 831, x: 792, y: 618, pw: 525}};
function fit() {
  const vw = innerWidth, vh = innerHeight, k = Math.min(vw / 1920, vh / 1080), wide = vw / vh >= 2, B = wide ? BG.w : BG.n;
  $('#stage').style.transform = 'scale(' + k + ')';
  document.documentElement.classList.toggle('pf-wide', wide);
  /* latar = cover penuh layar; titik podium dihitung ke koordinat stage supaya kaki karakter tepat di atas batu */
  const sc = Math.max(vw / B.w, vh / B.h), sx = (B.x - B.w / 2) * sc / k + 960, sy = (B.y - B.h / 2) * sc / k + 540, r = B.pw * sc / k / 594;
  const art = $('#art'); art.style.left = (sx - 400 - 290) + 'px'; art.style.top = (sy - 678) + 'px';
  PODIUM.h = 430 * r; if (R && R.w) frameCam();
}
env.own(addEventListener('resize', fit));
fit();
draw();
buildChar();
/* tandai dokumen sudah siap */
document.documentElement.classList.add('ut-ready');
});
