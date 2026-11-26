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
/* Item hadiah (source 'event', mis. 15 frame Login 30 hari) disembunyikan sampai dimiliki: tidak ada spoiler di daftar maupun hitungan koleksi. */
const shown = i => !i.off && (i.source !== 'event' || PD.owns(i.id));
const total = k => IC.items.filter(i => i.kind === k && shown(i)).length;
const MIS = () => ((SRV && SRV.counters) || {}).missions_done || 0;

/* Esc dan tombol Tutup dikelola hub (UT.AccountHub): kembali ke halaman asal, bukan hanya ke lobby. */

/* ---- kiri: FOTO karakter (gambar statis, bukan kanvas WebGL hidup) ----
   Foto dijepret SEKALI lewat renderer offscreen (SharedGL.offscreen) lalu disimpan di localStorage bersama tanda tangan tampilan+pose.
   Membuka profil berikutnya langsung menampilkan gambar itu: tanpa membangun karakter 3D, tanpa WebGL. Foto dibuat ulang hanya bila
   tampilan/perlengkapan/pose berubah. Pose = bentuk badan diam (bukan animasi) yang dipilih lewat tombol Pose. */
let webOk = typeof THREE !== 'undefined' && !!(window.UT && UT.BlockyCharacter && UT.SharedGL);
const PHOTO_KEY = 'ut.profilePhoto.v1', PHOTO_VER = 1;
const POSES = () => (UT.BlockyCharacter && UT.BlockyCharacter.poses) || [{id: 'pose1', n: 'Siap Tempur'}];
function poseId() { let v = 'pose1'; try { v = UT.Prefs.get('profilePose', 'pose1'); } catch (e) {} return POSES().some(p => p.id === v) ? v : 'pose1'; }
const lookSig = () => JSON.stringify([PD.look(), PD.gearLook()]);
const photoSig = pose => lookSig() + '|' + pose + '|v' + PHOTO_VER;
function readPhoto() { try { const o = JSON.parse(localStorage.getItem(PHOTO_KEY) || 'null'); return o && o.sig && o.url ? o : null; } catch (e) { return null; } }
function writePhoto(sig, url) { try { localStorage.setItem(PHOTO_KEY, JSON.stringify({sig, url})); } catch (e) { /* penuh/diblokir: foto tetap tampil, hanya tidak di-cache */ } }

/* jepret satu foto: kind 'bust' (dada-kepala, foto profil) atau 'full' (seluruh badan, pratinjau modal Pose) -> dataURL (webp/png, latar transparan) */
function shoot(pose, kind, W, H) {
  const ch = UT.BlockyCharacter.create(THREE); ch.loadFromPlayer(); ch.setMode(pose);
  for (let i = 0; i < 80; i++) ch.tick(.05);   /* pose dicapai bertahap oleh renderer: tick berulang agar bentuk akhirnya yang dijepret */
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, W / H, .1, 100);
  sc.add(new THREE.AmbientLight(0xffffff, .3), new THREE.HemisphereLight(0xb9cdf0, 0x4a3a62, .3));
  const sun = new THREE.DirectionalLight(0xffe2b0, .78); sun.position.set(7, 9, 6); sc.add(sun);
  const rim = new THREE.DirectionalLight(0x8fb4ff, .35); rim.position.set(-8, 5, -6); sc.add(rim);
  const w = new THREE.Group(); w.scale.setScalar(3.7); w.rotation.set(0, -.55, .05); w.add(ch.root); sc.add(w);
  sc.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3());
  const tn = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), asp = W / H;
  let cy, d;
  if (kind === 'full') { cy = (bb.min.y + bb.max.y) / 2; d = Math.max(sz.y * .56 / tn, (sz.x * .62) / (tn * asp)) + sz.z * .5; }
  else { const h = sz.y * .46; cy = bb.max.y - h * .5 + sz.y * .02; d = Math.max(h / 2 / tn, (sz.x * .62) / (tn * asp)) + sz.z * .5; }
  cam.position.set(0, cy, d); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
  const r = UT.SharedGL.offscreen();
  r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0); r.render(sc, cam);
  const url = r.domElement.toDataURL('image/webp', .92);
  sc.traverse(function (o) {
    try { if (o.geometry) o.geometry.dispose(); } catch (_) {}
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { try { if (m.map) m.map.dispose(); m.dispose(); } catch (_) {} });
  });
  return url;
}
const HERO_W = 980, HERO_H = 992;   /* 2x dari #art (490x496) */
let heroUrl = '', heroTimers = [];
function showPhoto(url) {
  if (env.disposed || !url || url === heroUrl) return;
  heroUrl = url;
  const art = $('#art');
  let im = art.querySelector('img.phot');
  if (!im) { art.innerHTML = ''; im = new Image(); im.className = 'phot'; im.alt = ''; im.draggable = false; im.decoding = 'async'; art.appendChild(im); }
  im.src = url;
}
function buildChar(force) {
  if (env.disposed) return;
  const art = $('#art');
  heroTimers.forEach(clearTimeout); heroTimers = [];
  if (!webOk) { art.innerHTML = `<div class="noweb">${AR.face(eqSkin().id)}</div>`; return; }
  const pose = poseId(), sig = photoSig(pose), c = readPhoto();
  if (!force && c && c.sig === sig) { showPhoto(c.url); return; }   /* tampilan & pose sama dengan foto tersimpan: pakai gambar, tanpa render */
  const snap = () => {
    if (env.disposed || sig !== photoSig(poseId())) return;
    try { const u = shoot(pose, 'bust', HERO_W, HERO_H); showPhoto(u); writePhoto(sig, u); }
    catch (e) { webOk = false; console.warn('[profil] foto karakter gagal', e); art.innerHTML = `<div class="noweb">${AR.face(eqSkin().id)}</div>`; }
  };
  snap();
  /* jaga-jaga bila tekstur wajah/outfit selesai dimuat sesudahnya: jepret ulang sekali dua kali, lalu foto terakhir yang disimpan */
  [400, 1200].forEach(ms => heroTimers.push(setTimeout(snap, ms)));
}
env.own(function () { heroTimers.forEach(clearTimeout); document.documentElement.classList.remove('pf-wide'); });

/* ---- modal POSE: pilih pose foto profil (bentuk badan diam, bukan animasi), lihat pratinjau, lalu SIMPAN ---- */
const PO_W = 520, PO_H = 720;
let poSel = null, poShots = new Map(), poSig = '', poGen = 0;
const poOpen = () => $('#pomd').classList.contains('on');
function poShot(id) {   /* pratinjau seluruh badan, di-cache per tampilan agar membuka modal lagi tidak merender ulang */
  const sg = lookSig();
  if (sg !== poSig) { poShots = new Map(); poSig = sg; }
  if (!poShots.has(id)) poShots.set(id, shoot(id, 'full', PO_W, PO_H));
  return poShots.get(id);
}
function drawPose() {
  if (env.disposed || !poOpen()) return;
  const L = POSES(), saved = poseId();
  if (!poSel || !L.some(p => p.id === poSel)) poSel = saved;
  $('#pogrid').innerHTML = L.map(p => `<button class="fslot ${p.id === saved ? 'st-used' : 'st-own'}${p.id === poSel ? ' sel' : ''}" type="button" data-id="${p.id}" aria-label="${p.n}${p.id === saved ? ' — dipakai' : ''}"><span class="pth"></span><span class="pnm2">${p.n}</span></button>`).join('');
  const cur = L.find(p => p.id === poSel) || L[0];
  $('#ponm').textContent = cur.n;
  const b = $('#posave'), sp = b.querySelector('span');
  b.disabled = poSel === saved; sp.textContent = poSel === saved ? 'TERSIMPAN' : 'SIMPAN';
  fillPoseImgs();
}
/* gambar dibuat bertahap (satu pose per giliran) agar modal langsung muncul; yang sudah di-cache langsung terpasang */
function fillPoseImgs() {
  const gen = ++poGen, L = POSES();
  const put = id => {
    const cell = document.querySelector('#pogrid .fslot[data-id="' + id + '"] .pth');
    if (cell && !cell.firstChild) { const im = new Image(); im.alt = ''; im.draggable = false; im.src = poShot(id); cell.appendChild(im); }
    if (id === poSel) { const a = $('#poart'); a.innerHTML = ''; const im = new Image(); im.alt = ''; im.draggable = false; im.src = poShot(id); a.appendChild(im); }
  };
  put(poSel);
  const rest = L.map(p => p.id).filter(id => id !== poSel);
  const step = () => { if (env.disposed || gen !== poGen || !poOpen()) return; const id = rest.shift(); if (!id) return; try { put(id); } catch (e) {} setTimeout(step, 0); };
  setTimeout(step, 30);
}
function poseOpen() {
  if (!webOk) { toast('Pose belum bisa dipakai di perangkat ini.'); return; }
  poSel = poseId();
  const m = $('#pomd'); m.classList.add('on'); m.setAttribute('aria-hidden', 'false');
  $('#poart').innerHTML = ''; drawPose();
}
function poseClose() { const m = $('#pomd'); m.classList.remove('on'); m.setAttribute('aria-hidden', 'true'); poGen++; }
function poseSave() {
  if (!poSel || poSel === poseId()) return;
  try { UT.Prefs.set('profilePose', poSel); } catch (e) { toast('Gagal menyimpan pose.'); return; }
  snd('power'); buzz(); poseClose(); buildChar(); toast('Pose disimpan');
}
$('#pobtn').onclick = () => { snd(); poseOpen(); };
$('#pox').onclick = () => { snd(); poseClose(); };
$('#pomd').onclick = e => { if (e.target.id === 'pomd') poseClose(); };
$('#pogrid').onclick = e => { const c = e.target.closest('.fslot'); if (!c) return; poSel = c.dataset.id; snd(); drawPose(); };
$('#posave').onclick = () => { poseSave(); };

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
/* ---- kanan: FOTO pet 3D (seperti foto karakter), bukan thumbnail webp toko ----
   Model pet dibangun sekali lewat UT.PetPhoto (renderer offscreen, cahaya redup, tanpa partikel) lalu disimpan di localStorage per pet.
   Membuka profil berikutnya langsung memakai gambar itu. Jika WebGL/modelnya gagal, jatuh ke gambar thumbnail lama. */
const PET_KEY = 'ut.petPhoto.v1', PET_VER = 3, PET_W = 1036, PET_H = 860;   /* 2x dari #pet .pimg (518x430) */
let petGen = 0;
const petSig = gk => gk + '|v' + PET_VER;
function readPetPhoto() { try { const o = JSON.parse(localStorage.getItem(PET_KEY) || 'null'); return o && o.sig && o.url ? o : null; } catch (e) { return null; } }
function writePetPhoto(sig, url) { try { localStorage.setItem(PET_KEY, JSON.stringify({sig, url})); } catch (e) { /* penuh/diblokir: foto tetap tampil, hanya tidak di-cache */ } }
function drawPet() {
  const id = PD.equippedId('pet'), it = id && IC.byId(id), el = $('#pet'), im = el.querySelector('.pimg');
  el.classList.toggle('empty', !it);
  el.querySelector('.pnm').textContent = it ? it.name : 'Belum ada pet';
  const setImg = u => { if (!env.disposed) im.style.backgroundImage = `url(${u})`; };
  const thumb = it ? (it.image || 'data/inventory/pet/items/' + it.gameKey + '/' + it.gameKey + '.png') : K + 'lobby/pet.webp';
  const gen = ++petGen;
  if (!it) { setImg(thumb); return; }
  const sig = petSig(it.gameKey), c = readPetPhoto();
  if (c && c.sig === sig) { setImg(c.url); return; }   /* pet sama dengan foto tersimpan: pakai gambar, tanpa render */
  im.style.backgroundImage = 'none';
  if (typeof THREE === 'undefined' || !(window.UT && UT.PetPhoto && UT.SharedGL)) { setImg(thumb); return; }
  UT.PetPhoto.shoot(it.gameKey, PET_W, PET_H).then(u => {
    if (env.disposed || gen !== petGen) return;   /* pet diganti saat dirender: abaikan hasil lama */
    setImg(u); writePetPhoto(sig, u);
  }).catch(e => { console.warn('[profil] foto pet gagal', e); if (gen === petGen) setImg(thumb); });
}
$('#pet').onclick = () => { snd(); go('pet.html?from=profile.html'); };
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
const frList = () => IC.items.filter(i => i.kind === 'frame' && shown(i));
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
}
env.own(addEventListener('resize', fit));
fit();
draw();
buildChar();
/* tandai dokumen sudah siap */
document.documentElement.classList.add('ut-ready');
});
