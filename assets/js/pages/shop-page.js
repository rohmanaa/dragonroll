/* shop-page.js — Tahap 3 SPA: dibungkus UT.PageModule ('shop'). Halaman mandiri otomatis mount; unmount() melepas timer, listener,
   langganan (PlayerData, Events) dan LiveSync. Callback async dijaga env.disposed (DOM view sudah dibuang saat callback selesai). */
UT.PageModule.define('shop', function (env) {
  'use strict';
  const { setTimeout, clearTimeout, requestAnimationFrame, addEventListener } = env;

  const $ = (selector, root = document) => root.querySelector(selector);
  const PD = window.PlayerData;
  const WS = () => window.UT && UT.WalletService && UT.WalletService.get();
  const SV = () => !!(PD.serverMode && PD.serverMode());
  const fmt = value => Number(value || 0).toLocaleString('id-ID');
  const IC = 'assets/images/ui/';
  const TABS = ['frame', 'power', 'chest', 'coin', 'emerald'];
  /* tab katalog -> kind ItemCatalog; harga & kepemilikan dari katalog/PlayerData, transaksi tetap lewat WalletService (server) */
  const KIND = { skin: 'skin', frame: 'frame', power: 'powerup' };
  const RCOL = { common: '#9aa4b8', uncommon: '#62d07a', rare: '#4da3ff', epic: '#b46bff', legendary: '#ffb02a', mythic: '#ff5a7a', divine: '#fff2a8' };
  const EYE = `<img src="${IC}white-glyphs/mata.webp" alt="">`;
  const PACKS = [
    { coins: 500, gems: 10, name: 'Koin Kecil', image: 'gold-koin-sedikit.webp', color: '#ffd04a' },
    { coins: 2000, gems: 40, name: 'Tumpukan Koin', image: 'gold-tumpukan.webp', color: '#ffb02a' },
    { coins: 6000, gems: 120, name: 'Kantong Koin', image: 'gold-kantong.webp', color: '#ff8f1f' }
  ];
  const CHESTS = [
    { kind: 'wood', name: 'Peti Kayu', image: 'chest-packs/peti-kayu.webp', gems: 2 },
    { kind: 'silver', name: 'Peti Perak', image: 'chest-packs/peti-perak.webp', gems: 5 },
    { kind: 'gold', name: 'Peti Emas', image: 'chest-packs/peti-emas.webp', gems: 12 },
    { kind: 'diamond', name: 'Peti Diamond', image: 'chest-packs/peti-diamond.webp', gems: 25, color: '#4de8e0' }
  ];
  const WMSG = {
    'saldo-kurang': 'Coin tidak cukup.',
    'gem-kurang': 'Emerald tidak cukup.',
    penuh: 'Penyimpanan chest penuh (10/10). Ambil chest dulu.',
    'sudah-dimiliki': 'Item sudah dimiliki.',
    'terlalu-banyak': 'Set terlalu besar.',
    'tidak-tersedia': 'Item tidak tersedia.',
    'mode-lokal': 'Toko hanya tersedia setelah login.',
    jaringan: 'Tidak dapat terhubung ke server.',
    'belum-login': 'Silakan login ulang.',
    'sedang-diproses': 'Transaksi sedang diproses.'
  };
  const HLAB = {
    buy: 'Beli item',
    buy_set: 'Beli set gear',
    buy_power: 'Beli power-up',
    daily: 'Hadiah harian',
    boss: 'Hadiah Ender Dragon',
    boss_cpu: 'Hadiah lawan CPU',
    mine_unlock: 'Buka tambang',
    mine_upgrade: 'Upgrade tambang',
    mine_collect: 'Hasil tambang',
    mine_boost: 'Boost tambang',
    exchange: 'Tukar Emerald ke Coin',
    ad: 'Hadiah iklan',
    quest: 'Hadiah misi',
    quest_bonus: 'Bonus misi',
    achievement: 'Pencapaian',
    chest_buy: 'Beli chest',
    chest: 'Hadiah chest',
    chest_skip: 'Percepat chest'
  };
  const SFX = { click: 'button', select: 'button', open: 'button', error: 'button', coin: 'button' };
  /* di shell (play.html) location.search milik shell (?go=...): parameter halaman (?coin=1, ?tab=, ?emerald) diambil dari URL rute aktif */
  const search = () => {
    const c = UT.Spa && UT.Spa.current && UT.Spa.current();
    if (c && c.name === 'shop') { const i = c.url.indexOf('?'); return i < 0 ? '' : c.url.slice(i).split('#')[0]; }
    return location.search;
  };
  const query = new URLSearchParams(search());
  /* di shell SEMUA target lewat UT.Spa.go (view atau iframe) agar shell tidak ditinggalkan; halaman mandiri: pindah halaman biasa */
  const nav = url => { if (UT.Spa && UT.Spa.go) { UT.Spa.go(url); return; } location.href = url; };

  let tab = query.has('emerald') || query.get('tab') === 'gem' ? 'emerald'
    : query.has('coin') || query.get('tab') === 'coin' ? 'coin'
      : TABS.includes(query.get('tab')) ? query.get('tab') : 'frame';
  let busy = false;
  let modalTimer = 0;
  let mOpen = false;

  function fit() {
    /* skala kanvas 1920x1080 + sisa layar di luar kanvas (--hub-ex/--hub-ey): bingkai & latar #pmodal penuh sampai tepi layar (sama dengan pet.html) */
    const k = Math.min(innerWidth / 1920, innerHeight / 1080) || 1, st = $('#stage');
    st.style.transform = `scale(${k})`;
    st.style.setProperty('--hub-ex', Math.max(0, (innerWidth / k - 1920) / 2).toFixed(1) + 'px');
    st.style.setProperty('--hub-ey', Math.max(0, (innerHeight / k - 1080) / 2).toFixed(1) + 'px');
  }
  addEventListener('resize', fit);
  fit();
  /* transparansi panel (Pengaturan -> slider, Prefs 'panelTransparency'): 0% pekat .. 70%; bawaan 16% — sama seperti hub/pet/dadu/efek */
  function applyPanelAlpha() {
    try {
      let t = parseInt(UT.Prefs.get('panelTransparency', 16), 10);
      if (!isFinite(t)) t = 16;
      document.documentElement.style.setProperty('--panel-a', (1 - Math.max(0, Math.min(70, t)) / 100).toFixed(2));
    } catch (e) { /* abaikan */ }
  }
  applyPanelAlpha();
  try { if (UT.Prefs && UT.Prefs.on) env.own(UT.Prefs.on(n => { if (n === 'panelTransparency') applyPanelAlpha(); })); } catch (e) { /* abaikan */ }

  function playSound(name) {
    if (!PD.settings().sound) return;
    try { UT.Audio.play(SFX[name] || 'button'); } catch (e) {}
  }
  function buzz() {
    if (PD.settings().vibration && navigator.vibrate) navigator.vibrate(15);
  }
  function toast(message) {
    if (env.disposed) return;
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 1800);
  }
  function renderCurrency() {
    if (env.disposed) return;
    $('#v-em').textContent = PD.walletReady() ? fmt(PD.gems()) : '—';
    $('#v-co').textContent = PD.walletReady() ? fmt(PD.coins()) : '—';
  }
  function pulse(selector) {
    const el = $(selector);
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    })[char]);
  }

  function renderTabs() {
    document.querySelectorAll('.tabb').forEach(button => {
      const active = button.dataset.k === tab;
      button.classList.toggle('on', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function renderCoin() {
    return PACKS.map((pack, index) => {
      return `<div class="card${index === 2 ? ' fx' : ''}${index === 2 && query.has('coin') ? ' hl' : ''}" style="--g:${pack.color}">
        ${pack.best ? `<img class="rib" src="${IC}banner-label/pita-badge-biru.webp" alt=""><span class="rt">BEST</span>` : ''}
        <div class="nm">${pack.name}</div>
        <div class="pic"><i class="glow"></i><i class="sp a"></i><i class="sp b"></i><i class="sp c"></i><i class="sp d"></i><i class="sp e"></i><img src="${IC}gold-packs/${pack.image}" alt=""></div>
        <div class="amt">+${fmt(pack.coins)} Coin</div>
        <button class="btn buy ut-gl ut-c-g" data-i="${index}" aria-label="Tukar ${pack.gems} Emerald menjadi ${fmt(pack.coins)} Coin">
          <img src="${IC}buttons-and-controls/tombol-hijau-polos.webp" alt="">
          <span><img src="${IC}gem-medal-icons/berlian-hijau.webp" alt="">${pack.gems}</span>
        </button>
      </div>`;
    }).join('');
  }

  function renderChest() {
    return CHESTS.map(chest => `<div class="card chest fx" style="--g:${chest.color || '#6e8fe8'}">
      <div class="nm">${chest.name}</div>
      <div class="pic"><i class="glow"></i><i class="sp a"></i><i class="sp b"></i><i class="sp c"></i><i class="sp d"></i><i class="sp e"></i><img src="${IC}${chest.image}" alt=""></div>
      <div class="amt sm"><small>Langsung dibuka · bisa dapat Power</small></div>
      <button class="btn buy ut-gl ut-c-g" data-chest="${chest.kind}" aria-label="Beli ${chest.name} seharga ${fmt(chest.gems || chest.coins)} ${chest.gems ? 'Emerald' : 'Coin'}">
        <img src="${IC}buttons-and-controls/${chest.gems ? 'tombol-biru-polos' : 'tombol-hijau-polos'}.webp" alt="">
        <span><img src="${IC}${chest.gems ? 'gem-medal-icons/berlian-hijau' : 'hud/ikon-koin-emas'}.webp" alt="">${fmt(chest.gems || chest.coins)}</span>
      </button>
    </div>`).join('');
  }

  function renderEmerald() {
    return `<div class="card fx" style="--g:#38e070">
      <div class="nm">Emerald</div>
      <div class="pic"><i class="glow"></i><img src="${IC}gem-medal-icons/berlian-hijau.webp" alt=""></div>
      <div class="amt sm"><small>Hadiah iklan belum tersedia</small></div>
      <button class="btn buy soon ut-gl ut-c-d" id="adbtn" type="button" disabled>
        <img src="assets/images/buttons/tombol-abu-polos.webp" alt=""><span>SEGERA HADIR</span>
      </button>
    </div>`;
  }

  function renderHistory() {
    return `<section class="history-panel">
      <div class="history-head"><div class="nm">Riwayat Transaksi</div><p>20 transaksi Coin dan Emerald terakhir.</p></div>
      <button class="history-button ut-gl ut-c-y" id="histbtn" type="button">Lihat Riwayat</button>
      <div id="histlist" role="list" aria-live="polite"></div>
    </section>`;
  }

  /* ----- tab item katalog: kartu panjang bergulir ke samping, tanpa tombol beli (pelat harga = area ketuk) ----- */
  const IC_ = () => window.ItemCatalog;
  function shopItems(key) {
    const C = IC_();
    if (!C) return [];
    return C.items.filter(it => it.kind === KIND[key] && !it.off && C.cost(it))
      .sort((a, b) => (C.RARITY[a.rarity] ? C.RARITY[a.rarity].rank : 0) - (C.RARITY[b.rarity] ? C.RARITY[b.rarity].rank : 0) || (a.price || 0) - (b.price || 0));
  }
  function artOf(it) {
    try {
      const real = window.UT && UT.ShopPreview ? UT.ShopPreview.diceThumb(it) : '';
      return real || (window.ItemArt ? ItemArt.forItem(it.id) : '');
    } catch (e) { return ''; }
  }
  /* preview hidup di modal (3D/animasi); dibuang saat modal ditutup/diganti */
  let pvStop = null;
  function stopPreview() { if (pvStop) { try { pvStop(); } catch (e) {} pvStop = null; } }
  function startPreview(it) {
    stopPreview();
    const host = $('#mb .pvh');
    if (host && window.UT && UT.ShopPreview) pvStop = UT.ShopPreview.mount(host, it);
  }
  env.own(stopPreview);
  function priceHtml(it, qty) {
    const cost = IC_().cost(it);
    const gem = cost.gems != null;
    return `${fmt((gem ? cost.gems : cost.coins) * (qty || 1))}<img src="${IC}${gem ? 'gem-medal-icons/berlian-hijau' : 'hud/ikon-koin-emas'}.webp" alt="">`;
  }
  function renderItems(key) {
    const list = shopItems(key);
    if (!list.length) return '<div class="hempty">Belum ada item untuk dijual.</div>';
    return list.map(it => {
      const art = it.kind === 'frame' && it.image ? `<img class="setimg" src="${escapeHtml(it.image)}" alt="" draggable="false" decoding="async">` : artOf(it); /* kartu Set/Frame = foto statis; preview hidup hanya di modal */
      const power = it.kind === 'powerup';
      const owned = !power && PD.owns(it.id);
      const qty = power ? PD.qty(it.id) : 0;
      return `<div class="card item fx k-${key} r-${it.rarity || 'common'}" style="--g:${RCOL[it.rarity] || RCOL.common}">
        <div class="nm">${escapeHtml(it.name)}</div>
        <div class="pic"><i class="glow"></i><div class="art">${art}</div></div>
        ${qty > 0 ? `<span class="chip" aria-label="Dimiliki ${qty}">×${qty}</span>` : ''}
        ${art ? `<button class="eye ut-gl ut-c-b sm" type="button" data-pv="${escapeHtml(it.id)}" aria-label="Lihat ${escapeHtml(it.name)}">${EYE}</button>` : ''}
        <button class="plate ut-gl ${owned ? 'ut-c-d own' : 'ut-c-g'}" type="button" data-buy="${escapeHtml(it.id)}" ${owned ? 'disabled' : ''} aria-label="${owned ? 'Sudah dimiliki' : 'Beli ' + escapeHtml(it.name)}">
          ${owned ? 'Dimiliki' : priceHtml(it)}
        </button>
      </div>`;
    }).join('');
  }

  function preview(id) {
    const it = IC_().byId(id);
    if (!it) return;
    const rar = IC_().RARITY[it.rarity];
    openModal(`<h2>${escapeHtml(it.name)}</h2><div class="pv" style="--g:${RCOL[it.rarity] || RCOL.common}"><div class="pvh"></div></div>
      ${rar ? `<div class="rar" style="color:${RCOL[it.rarity] || RCOL.common}">${escapeHtml(rar.label)}</div>` : ''}
      <p class="ds">${escapeHtml(it.desc || '')}</p>`, () => startPreview(it));
  }

  function confirmBuy(id) {
    const it = IC_().byId(id);
    if (!it || busy) return;
    const power = it.kind === 'powerup';
    let qty = 1;
    openModal(`<h2>${escapeHtml(it.name)}</h2><div class="pv sm" style="--g:${RCOL[it.rarity] || RCOL.common}"><div class="pvh"></div></div>
      <p>${escapeHtml(it.desc || '')}</p>
      ${power ? '<div class="qty"><button class="ut-gl ut-c-d" type="button" id="q-dn" aria-label="Kurangi">−</button><b id="q-n">1</b><button class="ut-gl ut-c-d" type="button" id="q-up" aria-label="Tambah">+</button></div>' : ''}
      <div class="mrow"><button class="btn ut-gl ut-c-r" type="button" id="m-no"><img src="${IC}buttons-and-controls/tombol-merah-polos.webp" alt=""><span>Batal</span></button><button class="btn ut-gl ut-c-g" type="button" id="m-ok"><img src="${IC}buttons-and-controls/tombol-hijau-polos.webp" alt=""><span id="m-pr">${priceHtml(it)}</span></button></div>`, () => {
      startPreview(it);
      const sync = () => {
        if (power) $('#q-n').textContent = qty;
        $('#m-pr').innerHTML = priceHtml(it, qty);
      };
      if (power) {
        $('#q-dn').addEventListener('click', () => { qty = Math.max(1, qty - 1); sync(); });
        $('#q-up').addEventListener('click', () => { qty = Math.min(99, qty + 1); sync(); });
      }
      $('#m-no').addEventListener('click', closeModal);
      $('#m-ok').addEventListener('click', () => buyItem(it, qty));
    });
  }

  async function buyItem(it, qty) {
    if (busy) return;
    if (!SV() || !WS()) { toast(WMSG['mode-lokal']); playSound('error'); return; }
    busy = true;
    try {
      const power = it.kind === 'powerup';
      const result = power ? await WS().buyPowerup(it.id, qty) : await WS().buy(it.id);
      if (env.disposed) return;
      if (!result || !result.ok) {
        toast(WMSG[result && result.reason] || 'Transaksi gagal.');
        playSound('error');
        if (result && result.reason === 'gem-kurang') setTimeout(gemShop, 300);
        return;
      }
      closeModal();
      renderCurrency();
      pulse(IC_().cost(it).gems != null ? '#cur-em' : '#cur-co');
      playSound('coin');
      buzz();
      toast('Berhasil dibeli!');
      const keep = $('#cards').scrollLeft;
      render();
      $('#cards').scrollLeft = keep;
    } finally {
      busy = false;
    }
  }

  /* ----- tab Set: paket gear siap pakai (data bersama dengan Karakter: character-sets.js). Harga = total item yang BELUM dimiliki;
     transaksi atomik lewat WalletService.buySet (RPC buy_set): semua item masuk atau tidak sama sekali ----- */
  /* ikon WebP per set (assets/images/ui/item-icons); set tanpa entri memakai helm-ksatria */
  const SET_ICON = { citizen: 'toko', knight: 'helm-ksatria', mage: 'ramuan-ungu', farmer: 'ramuan-hijau', explorer: 'sepatu-sayap', noble: 'panji-pedang', princess: 'mahkota', fairy: 'helm-sayap' };
  const SET_SLOTS = ['top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'];
  function setGender() {
    try { const a = PD.appearance && PD.appearance(); return a && a.look && a.look.gender === 'f' ? 'f' : 'm'; } catch (e) { return 'm'; }
  }
  function setParts(p) {
    const C = IC_(), out = [];
    const add = id => { const ci = C.byId(id); if (ci) out.push(ci); };
    SET_SLOTS.forEach(k => { const o = p.set[k]; if (o && o.id !== 'none') add('gear.' + k + '.' + o.id); });
    ['eyes', 'hair'].forEach(k => { const o = p.set[k]; if (o) add('gear.' + k + '.' + o.id); });
    (p.set.accessories || []).forEach(a => add('gear.acc.' + a.id));
    return out;
  }
  function setList() {
    const S = window.UT && UT.CharacterSets;
    if (!S || !IC_()) return [];
    return (setGender() === 'f' ? S.female : S.male).map(p => {
      const parts = setParts(p);
      const miss = parts.filter(ci => !PD.owns(ci.id));
      const full = parts.reduce((a, ci) => a + (ci.price > 0 ? ci.price : 0), 0);
      return {
        p, parts, miss, full,
        total: miss.reduce((a, ci) => a + (ci.price > 0 ? ci.price : 0), 0),
        sellable: miss.every(ci => ci.price > 0 && ci.source === 'shop')
      };
    }).filter(s => s.full > 0 && (s.miss.length === 0 || s.sellable)).sort((a, b) => a.full - b.full);
  }
  function renderSets() {
    const list = setList();
    if (!list.length) return '<div class="hempty">Belum ada set untuk dijual.</div>';
    return list.map(s => {
      const owned = s.miss.length === 0;
      const icon = SET_ICON[s.p.id] || 'helm-ksatria', name = escapeHtml(s.p.n.replace(/^\S+\s/, ''));
      return `<div class="card item fx k-set r-rare" style="--g:${RCOL.rare}">
        <div class="nm">${name}</div>
        <div class="pic"><i class="glow"></i><div class="art"><img class="setimg" src="data/frame/karakter/${s.p.id}-${setGender()}.webp" onerror="this.onerror=null;this.src='${IC}item-icons/${icon}.webp'" alt="" draggable="false"></div></div>
        <span class="chip" aria-label="Dimiliki ${s.parts.length - s.miss.length} dari ${s.parts.length} bagian">${s.parts.length - s.miss.length}/${s.parts.length}</span>
        <button class="plate ut-gl ${owned ? 'ut-c-d own' : 'ut-c-g'}" type="button" data-set="${escapeHtml(s.p.id)}" ${owned ? 'disabled' : ''} aria-label="${owned ? 'Set sudah dimiliki' : 'Beli set ' + name}">
          ${owned ? 'Dimiliki' : `${fmt(s.total)}<img src="${IC}hud/ikon-koin-emas.webp" alt="">`}
        </button>
      </div>`;
    }).join('');
  }
  function confirmBuySet(id) {
    const s = setList().find(x => x.p.id === id);
    if (!s || !s.miss.length || busy) return;
    const name = escapeHtml(s.p.n.replace(/^\S+\s/, ''));
    const coin = `<img src="${IC}hud/ikon-koin-emas.webp" alt="">`;
    const rows = s.miss.map(ci => `<div class="srow"><span>${escapeHtml(ci.name)}</span><span>${coin}${fmt(ci.price)}</span></div>`).join('');
    openModal(`<h2>Beli Set ${name}?</h2>
      <div class="slist">${rows}</div>
      <p>Bagian yang sudah kamu miliki tidak ditagih. Pakai set-nya di menu Karakter.</p>
      <div class="mrow"><button class="btn ut-gl ut-c-r" type="button" id="m-no"><img src="${IC}buttons-and-controls/tombol-merah-polos.webp" alt=""><span>Batal</span></button><button class="btn ut-gl ut-c-g" type="button" id="m-ok"><img src="${IC}buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>${fmt(s.total)}${coin}</span></button></div>`, () => {
      $('#m-no').addEventListener('click', closeModal);
      $('#m-ok').addEventListener('click', () => buySetNow(s));
    });
  }
  async function buySetNow(s) {
    if (busy) return;
    if (!SV() || !WS()) { toast(WMSG['mode-lokal']); playSound('error'); return; }
    busy = true;
    try {
      const result = await WS().buySet(s.miss.map(ci => ci.id));
      if (env.disposed) return;
      if (!result || !result.ok) {
        toast(WMSG[result && result.reason] || 'Transaksi gagal.');
        playSound('error');
        return;
      }
      closeModal();
      renderCurrency();
      pulse('#cur-co');
      playSound('coin');
      buzz();
      toast('Set berhasil dibeli!');
      const keep = $('#cards').scrollLeft;
      render();
      $('#cards').scrollLeft = keep;
    } finally {
      busy = false;
    }
  }

  function render() {
    if (env.disposed) return;
    renderTabs();
    const cards = $('#cards');
    cards.classList.toggle('history-view', tab === 'history');
    cards.innerHTML = KIND[tab] ? renderItems(tab)
      : tab === 'set' ? renderSets()
      : tab === 'coin' ? renderCoin()
      : tab === 'emerald' ? renderEmerald()
        : tab === 'history' ? renderHistory()
          : renderChest();
  }

  function setTab(key) {
    if (!TABS.includes(key)) return;
    tab = key;
    render();
    playSound('select');
  }

  async function loadHistory() {
    const box = $('#histlist');
    const button = $('#histbtn');
    if (!box || !button) return;
    if (!SV() || !WS()) {
      box.innerHTML = '<div class="hempty">Riwayat tersedia setelah login ke akun.</div>';
      return;
    }

    button.disabled = true;
    button.textContent = 'Memuat…';
    const result = await WS().history(20);
    if (env.disposed) return;
    button.disabled = false;
    button.textContent = 'Muat Ulang';
    if (!result || !result.ok) {
      box.innerHTML = `<div class="hempty">${result && result.reason === 'belum-login'
        ? 'Sesi berakhir, login ulang.' : 'Tidak dapat terhubung ke server.'}</div>`;
      return;
    }
    if (!result.items.length) {
      box.innerHTML = '<div class="hempty">Belum ada transaksi.</div>';
      return;
    }

    box.innerHTML = result.items.map(item => {
      const date = new Date(item.at);
      const time = isNaN(date) ? '' : date.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      const amount = (value, currency) => {
        const n = Number(value) || 0;
        if (!n) return '';
        const icon = currency === 'Coin' ? 'hud/ikon-koin-emas.webp' : 'gem-medal-icons/berlian-hijau.webp';
        return `<span class="${n > 0 ? 'up' : 'dn'}"><img src="${IC}${icon}" alt="">${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}</span>`;
      };
      return `<div class="hr" role="listitem">
        <div class="hl"><b>${escapeHtml(HLAB[item.reason] || item.reason)}</b><small>${escapeHtml(time)}</small></div>
        <div class="ha">${amount(item.coins, 'Coin')}${amount(item.gems, 'Emerald')}</div>
      </div>`;
    }).join('');
  }

  const modal = $('#modal');
  /* modal sungguhan: fokus masuk & kembali ke pemicu, Tab terkunci, elemen luar inert (UT.ModalKit); dibuka/ditutup lewat kelas .show */
  try { if (UT.ModalKit) env.own(UT.ModalKit.watch(modal, { openClass: 'show', labelledBy: 'modal-title', initialFocus: '#mx' })); } catch (e) { /* abaikan */ }
  function openModal(html, init) {
    if (env.disposed) return;
    clearTimeout(modalTimer);
    stopPreview();
    $('#mb').innerHTML = html;
    /* judul dipindah ke .ut-mk-t (anak langsung kotak modal kit) */
    const heading = $('#mb h2');
    $('#modal-title').textContent = heading ? heading.textContent : '';
    if (heading) heading.remove();
    modal.style.display = 'grid';
    requestAnimationFrame(() => modal.classList.add('show'));
    mOpen = true;
    playSound('open');
    if (init) init();
    $('#mx').focus();
  }
  function closeModal() {
    if (!mOpen) return;
    mOpen = false;
    stopPreview();
    modal.classList.add('closing');
    modal.classList.remove('show');
    clearTimeout(modalTimer);
    modalTimer = setTimeout(() => {
      if (!mOpen) {
        modal.style.display = 'none';
        modal.classList.remove('closing');
      }
    }, 250);
  }
  function gemShop() {
    openModal('<h2>Tambah Emerald</h2><p>Segera hadir.</p><button class="pack ut-gl ut-c-d" disabled><span>Soon</span><span>⏳</span></button>');
  }

  async function exchange(index) {
    if (busy) return;
    const pack = PACKS[index];
    if (!pack) return;
    busy = true;
    try {
      const result = SV() ? await WS().exchange(index) : PD.addCurrency(pack.coins, -pack.gems);
      if (env.disposed) return;
      if (!result || !result.ok) {
        toast(WMSG[result && result.reason] || 'Transaksi gagal.');
        playSound('error');
        if (result && result.reason === 'gem-kurang') setTimeout(gemShop, 300);
        return;
      }
      renderCurrency();
      pulse('#cur-co');
      playSound('coin');
      buzz();
      toast('Berhasil! +' + fmt(pack.coins) + ' Coin');
    } finally {
      busy = false;
    }
  }

  /* Chest yang dibeli langsung terbuka: layar pembukaan SINEMATIK bersama (core/chest-reveal.js); angka dompet baru disegarkan saat hadiah tampil. */
  function revealChest(chest, r) {
    UT.ChestReveal.play(Object.assign({}, r, { kind: chest.kind }), {
      onRewards: () => { renderCurrency(); pulse('#cur-co'); if (r.gems > 0) pulse('#cur-em'); }
    });
  }

  async function buyChest(kind) {
    if (busy) return;
    const chest = CHESTS.find(item => item.kind === kind);
    if (!chest) return;
    if (!SV() || !WS()) { toast(WMSG['mode-lokal']); playSound('error'); return; }
    busy = true;
    try {
      const result = await WS().chestBuy(kind);
      if (env.disposed) return;
      if (!result || !result.ok) {
        toast(WMSG[result && result.reason] || 'Transaksi gagal.');
        playSound('error');
        if (result && result.reason === 'gem-kurang') setTimeout(gemShop, 300);
        return;
      }
      renderCurrency();
      pulse(chest.gems ? '#cur-em' : '#cur-co');
      revealChest(chest, result);
    } finally {
      busy = false;
    }
  }

  $('#mb').addEventListener('click', event => {
    const go = event.target.closest('[data-go]');
    if (go) { playSound('click'); nav(go.dataset.go); }
  });
  $('#tabs').addEventListener('click', event => {
    const button = event.target.closest('.tabb');
    if (button) setTab(button.dataset.k);
  });
  /* geser baris kartu (tab Set / Frame / Power / Chest): roda mouse (vertikal/horizontal) -> ke samping; seret mouse / jari / pena + momentum.
     Kanvas 1920x1080 diskalakan (transform): 1px layar = 1/k px scrollLeft, k dari ukuran tampil #cards. Daftar vertikal (#histlist, .slist)
     dan tampilan riwayat dibiarkan memakai gulir bawaannya. Ketukan biasa tetap = klik kartu; seretan tidak dianggap klik. */
  (function () {
    const g = $('#cards');
    if (!g) return;
    const scale = () => { const w = g.offsetWidth, r = g.getBoundingClientRect(); return w && r.width ? r.width / w : 1; };
    const vertical = target => !!(target && target.closest && target.closest('#histlist, .slist'));
    let drag = null, dragged = false, fling = 0, raf = 0;
    const stopFling = () => { fling = 0; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    g.addEventListener('wheel', event => {
      if (g.classList.contains('history-view') || vertical(event.target) || g.scrollWidth <= g.clientWidth) return;
      const d = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!d) return;
      event.preventDefault();
      stopFling();
      g.scrollLeft += d * (event.deltaMode === 1 ? 32 : 1) / scale();
    }, { passive: false });
    g.addEventListener('pointerdown', event => {
      if ((event.pointerType === 'mouse' && event.button !== 0) || g.classList.contains('history-view') || vertical(event.target)) return;
      if (g.scrollWidth <= g.clientWidth) return;
      stopFling();
      drag = { id: event.pointerId, x: event.clientX, left: g.scrollLeft, moving: false, lx: event.clientX, lt: performance.now(), v: 0 };
    });
    g.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const k = scale(), dx = (event.clientX - drag.x) / k;
      if (!drag.moving) {
        if (Math.abs(dx) < 6) return;
        drag.moving = true;
        g.classList.add('drag');
        try { g.setPointerCapture(event.pointerId); } catch (e) { /* abaikan */ }
      }
      const now = performance.now(), dt = Math.max(1, now - drag.lt);
      drag.v = .8 * drag.v + .2 * ((drag.lx - event.clientX) / k / dt * 16); /* px scrollLeft per frame (16 ms) */
      drag.lx = event.clientX; drag.lt = now;
      g.scrollLeft = drag.left - dx;
    });
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moving) {
        dragged = true;
        setTimeout(() => { dragged = false; }, 0);
        try { g.releasePointerCapture(event.pointerId); } catch (e) { /* abaikan */ }
        if (event.type === 'pointerup' && performance.now() - drag.lt < 80 && Math.abs(drag.v) > 1) { /* lepas sambil bergerak = momentum */
          fling = drag.v;
          const step = () => { fling *= .95; g.scrollLeft += fling; if (Math.abs(fling) > .4 && !env.disposed) raf = requestAnimationFrame(step); else raf = 0; };
          raf = requestAnimationFrame(step);
        }
      }
      g.classList.remove('drag');
      drag = null;
    }
    g.addEventListener('pointerup', endDrag);
    g.addEventListener('pointercancel', endDrag);
    g.addEventListener('dragstart', event => event.preventDefault());
    g.addEventListener('click', event => { if (!dragged) return; event.stopPropagation(); event.preventDefault(); }, true);
  })();
  $('#cards').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.id === 'histbtn') {
      loadHistory();
      playSound('click');
    } else if (button.dataset.pv) {
      playSound('click');
      preview(button.dataset.pv);
    } else if (button.dataset.buy) {
      playSound('click');
      confirmBuy(button.dataset.buy);
    } else if (button.dataset.set) {
      playSound('click');
      confirmBuySet(button.dataset.set);
    } else if (button.dataset.chest) {
      buyChest(button.dataset.chest);
    } else if (button.dataset.i !== undefined) {
      exchange(Number(button.dataset.i));
    }
  });
  $('#cur-em').addEventListener('click', () => setTab('emerald'));
  $('#cur-co').addEventListener('click', () => setTab('coin'));
  [['#cur-em', 'emerald'], ['#cur-co', 'coin']].forEach(([selector, key]) => {
    $(selector).addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setTab(key);
      }
    });
  });
  $('#back').addEventListener('click', () => { playSound('click'); nav('lobby.html'); });
  $('#mx').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

  /* penjaga window.__curSub dihapus: dengan SPA langganan harus dipasang tiap mount dan dilepas saat unmount */
  try {
    env.own(PD.subscribe(reason => {
      if (reason === 'server-wallet' || reason === 'storage' || reason === 'pageshow') renderCurrency();
    }));
  } catch (e) {}
  if (UT.Events) env.own(UT.Events.on('currencyChanged', renderCurrency));

  render();
  renderCurrency();
  addEventListener('dicekit-ready', () => { if (tab === 'dice') { const keep = $('#cards').scrollLeft; render(); $('#cards').scrollLeft = keep; } });
  document.documentElement.classList.add('ut-ready');

  if (query.has('emerald') || query.get('tab') === 'gem') gemShop();
  if (SV() && WS()) {
    const wallet = WS();
    wallet.refresh().then(result => {
      if (env.disposed) return;
      if (result.ok) renderCurrency();
      else toast(WMSG[result.reason] || 'Tidak dapat memuat saldo.');
    });
    if (UT.LiveSync) {
      UT.LiveSync.add('wallet', () => wallet.refresh());
      UT.LiveSync.start({ interval: 20000 });
      /* LiveSync bersifat global: lepas tugas halaman ini dan hentikan saat keluar (halaman berikut memulai ulang sendiri) */
      env.own(() => { UT.LiveSync.remove('wallet'); UT.LiveSync.stop(); });
    }
  }
});
