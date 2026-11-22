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
  const TABS = ['skin', 'set', 'frame', 'dice', 'aura', 'power', 'chest', 'coin', 'emerald', 'history'];
  /* tab katalog -> kind ItemCatalog; harga & kepemilikan dari katalog/PlayerData, transaksi tetap lewat WalletService (server) */
  const KIND = { skin: 'skin', frame: 'frame', dice: 'dice', aura: 'aura', power: 'powerup' };
  const RCOL = { common: '#9aa4b8', uncommon: '#62d07a', rare: '#4da3ff', epic: '#b46bff', legendary: '#ffb02a', mythic: '#ff5a7a', divine: '#fff2a8' };
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.2A4.2 4.2 0 1 1 12 7.8a4.2 4.2 0 0 1 0 8.4zm0-6.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" fill="#fff"/></svg>';
  const PACKS = [
    { coins: 500, gems: 10, name: 'Koin Kecil', image: 'gold-koin-sedikit.webp', color: '#ffd04a' },
    { coins: 2000, gems: 40, name: 'Tumpukan Koin', image: 'gold-tumpukan.webp', color: '#ffb02a' },
    { coins: 6000, gems: 120, name: 'Kantong Koin', image: 'gold-kantong.webp', color: '#ff8f1f' }
  ];
  const CHESTS = [
    { kind: 'wood', name: 'Peti Kayu', image: 'chest-packs/peti-kayu.webp', coins: 90, open: '10 menit' },
    { kind: 'silver', name: 'Peti Perak', image: 'chest-packs/peti-perak.webp', coins: 250, open: '1 jam' },
    { kind: 'gold', name: 'Peti Emas', image: 'chest-packs/peti-emas.webp', coins: 600, open: '4 jam' },
    { kind: 'diamond', name: 'Peti Diamond', image: 'chest-packs/peti-diamond.webp', gems: 25, open: '8 jam', color: '#4de8e0' }
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
      : TABS.includes(query.get('tab')) ? query.get('tab') : 'skin';
  let busy = false;
  let modalTimer = 0;
  let mOpen = false;

  function fit() {
    $('#stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  }
  addEventListener('resize', fit);
  fit();

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
        <button class="btn buy" data-i="${index}" aria-label="Tukar ${pack.gems} Emerald menjadi ${fmt(pack.coins)} Coin">
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
      <button class="btn buy" data-chest="${chest.kind}" aria-label="Beli ${chest.name} seharga ${fmt(chest.gems || chest.coins)} ${chest.gems ? 'Emerald' : 'Coin'}">
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
      <button class="btn buy soon" id="adbtn" type="button" disabled>
        <img src="assets/images/buttons/tombol-abu-polos.webp" alt=""><span>SEGERA HADIR</span>
      </button>
    </div>`;
  }

  function renderHistory() {
    return `<section class="history-panel">
      <div class="history-head"><div class="nm">Riwayat Transaksi</div><p>20 transaksi Coin dan Emerald terakhir.</p></div>
      <button class="history-button" id="histbtn" type="button">Lihat Riwayat</button>
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
  function artOf(it) { try { return window.ItemArt ? ItemArt.forItem(it.id) : ''; } catch (e) { return ''; } }
  function priceHtml(it, qty) {
    const cost = IC_().cost(it);
    const gem = cost.gems != null;
    return `<img src="${IC}${gem ? 'gem-medal-icons/berlian-hijau' : 'hud/ikon-koin-emas'}.webp" alt="">${fmt((gem ? cost.gems : cost.coins) * (qty || 1))}`;
  }
  function renderItems(key) {
    const list = shopItems(key);
    if (!list.length) return '<div class="hempty">Belum ada item untuk dijual.</div>';
    return list.map(it => {
      const art = artOf(it);
      const power = it.kind === 'powerup';
      const owned = !power && PD.owns(it.id);
      const qty = power ? PD.qty(it.id) : 0;
      return `<div class="card item fx k-${key}" style="--g:${RCOL[it.rarity] || RCOL.common}">
        <div class="nm">${escapeHtml(it.name)}</div>
        <div class="pic"><i class="glow"></i><div class="art">${art}</div></div>
        ${qty > 0 ? `<span class="chip" aria-label="Dimiliki ${qty}">×${qty}</span>` : ''}
        ${art ? `<button class="eye" type="button" data-pv="${escapeHtml(it.id)}" aria-label="Lihat ${escapeHtml(it.name)}">${EYE}</button>` : ''}
        <button class="plate${owned ? ' own' : ''}" type="button" data-buy="${escapeHtml(it.id)}" ${owned ? 'disabled' : ''} aria-label="${owned ? 'Sudah dimiliki' : 'Beli ' + escapeHtml(it.name)}">
          ${owned ? 'Dimiliki' : priceHtml(it)}
        </button>
      </div>`;
    }).join('');
  }

  function preview(id) {
    const it = IC_().byId(id);
    if (!it) return;
    const rar = IC_().RARITY[it.rarity];
    openModal(`<h2>${escapeHtml(it.name)}</h2><div class="pv" style="--g:${RCOL[it.rarity] || RCOL.common}"><div class="art">${artOf(it)}</div></div>
      <p>${rar ? escapeHtml(rar.label) + ' · ' : ''}${escapeHtml(it.desc || '')}</p>`);
  }

  function confirmBuy(id) {
    const it = IC_().byId(id);
    if (!it || busy) return;
    const power = it.kind === 'powerup';
    let qty = 1;
    openModal(`<h2>${escapeHtml(it.name)}</h2><div class="pv" style="--g:${RCOL[it.rarity] || RCOL.common}"><div class="art">${artOf(it)}</div></div>
      <p>${escapeHtml(it.desc || '')}</p>
      ${power ? '<div class="qty"><button type="button" id="q-dn" aria-label="Kurangi">−</button><b id="q-n">1</b><button type="button" id="q-up" aria-label="Tambah">+</button></div>' : ''}
      <div class="mrow"><button class="mbtn no" type="button" id="m-no">Batal</button><button class="mbtn ok" type="button" id="m-ok"><span id="m-pr">${priceHtml(it)}</span></button></div>`, () => {
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
      return `<div class="card item fx k-set" style="--g:${RCOL.rare}">
        <div class="nm">${name}</div>
        <div class="pic"><i class="glow"></i><div class="art"><img class="setimg" src="${IC}item-icons/${icon}.webp" alt=""></div></div>
        <span class="chip" aria-label="Dimiliki ${s.parts.length - s.miss.length} dari ${s.parts.length} bagian">${s.parts.length - s.miss.length}/${s.parts.length}</span>
        <button class="plate${owned ? ' own' : ''}" type="button" data-set="${escapeHtml(s.p.id)}" ${owned ? 'disabled' : ''} aria-label="${owned ? 'Set sudah dimiliki' : 'Beli set ' + name}">
          ${owned ? 'Dimiliki' : `<img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(s.total)}`}
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
      <div class="mrow"><button class="mbtn no" type="button" id="m-no">Batal</button><button class="mbtn ok" type="button" id="m-ok"><span>${coin}${fmt(s.total)}</span></button></div>`, () => {
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
  function openModal(html, init) {
    if (env.disposed) return;
    clearTimeout(modalTimer);
    $('#mb').innerHTML = html;
    const heading = $('#mb h2');
    if (heading) heading.id = 'modal-title';
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
    openModal('<h2>Tambah Emerald</h2><p>Segera hadir.</p><button class="pack" disabled><span>Soon</span><span>⏳</span></button>');
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

  /* Chest yang dibeli langsung terbuka: peti bergoyang sebentar, lalu hadiah dari server tampil. */
  /* Power hadiah (id item dari server): nama dari ItemCatalog, ikon bila ada. */
  function powerRow(id) {
    if (!id) return '';
    const it = window.ItemCatalog && ItemCatalog.byId(id);
    return `<div class="cr-rw pw">${it && it.icon ? `<img src="${escapeHtml(it.icon)}" alt="">` : ''}Power: ${escapeHtml(it ? it.name : id)} ×1</div>`;
  }

  function revealChest(chest, r) {
    const img = `<img class="cr-img" src="${IC}${chest.image}" alt="">`;
    openModal(`<h2>Membuka ${escapeHtml(chest.name)}…</h2><div class="cr">${img}</div>`);
    const row = (icon, text) => `<div class="cr-rw"><img src="${IC}${icon}.webp" alt="">${text}</div>`;
    setTimeout(() => {
      if (!mOpen) return;
      $('#mb').innerHTML = `<h2>${escapeHtml(chest.name)}</h2><div class="cr done">${img}</div>`
        + row('hud/ikon-koin-emas', `+${fmt(r.coins)} Coin`)
        + (r.gems > 0 ? row('gem-medal-icons/berlian-hijau', `+${fmt(r.gems)} Emerald`) : '')
        + (r.xp > 0 ? `<div class="cr-rw xp">+${fmt(r.xp)} XP</div>` : '')
        + powerRow(r.power);
      const heading = $('#mb h2');
      if (heading) heading.id = 'modal-title';
      renderCurrency();
      pulse('#cur-co');
      if (r.gems > 0) pulse('#cur-em');
      playSound('coin');
      buzz();
    }, 1100);
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
