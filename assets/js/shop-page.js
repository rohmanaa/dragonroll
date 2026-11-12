(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const PD = window.PlayerData;
  const WS = () => window.UT && UT.WalletService && UT.WalletService.get();
  const SV = () => !!(PD.serverMode && PD.serverMode());
  const fmt = value => Number(value || 0).toLocaleString('id-ID');
  const IC = 'assets/ng/komponen/';
  const TABS = ['chest', 'coin', 'emerald', 'history'];
  const PACKS = [
    { coins: 500, gems: 10, name: 'Koin Kecil', image: 'gold-koin-sedikit.webp', color: '#ffd04a' },
    { coins: 2500, gems: 40, name: 'Tumpukan Koin', image: 'gold-tumpukan.webp', color: '#ffb02a' },
    { coins: 10000, gems: 120, name: 'Kantong Koin', image: 'gold-kantong.webp', color: '#ff8f1f', best: true }
  ];
  const CHESTS = [
    { name: 'Peti Kayu', image: 'paket-chest/peti-kayu.webp' },
    { name: 'Peti Perak', image: 'paket-chest/peti-perak.webp' },
    { name: 'Peti Emas', image: 'paket-chest/peti-emas.webp' },
    { name: 'Peti Legendaris', image: 'paket-chest/peti-legendaris.webp' }
  ];
  const WMSG = {
    'saldo-kurang': 'Coin tidak cukup.',
    'gem-kurang': 'Emerald tidak cukup.',
    'sudah-dimiliki': 'Item sudah dimiliki.',
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
    achievement: 'Pencapaian'
  };
  const SFX = { click: 'button', select: 'button', open: 'button', error: 'button', coin: 'button' };
  const query = new URLSearchParams(location.search);

  let tab = query.has('emerald') || query.get('tab') === 'gem' ? 'emerald'
    : query.has('coin') || query.get('tab') === 'coin' ? 'coin'
      : TABS.includes(query.get('tab')) ? query.get('tab') : 'chest';
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
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 1800);
  }
  function renderCurrency() {
    $('#v-em').textContent = PD.walletReady() ? fmt(PD.gems()) : '—';
    $('#v-co').textContent = PD.walletReady() ? fmt(PD.coins()) : '—';
  }
  function pulse(selector) {
    const el = $(selector);
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
        <div class="pic"><i class="glow"></i><i class="sp a"></i><i class="sp b"></i><i class="sp c"></i><i class="sp d"></i><i class="sp e"></i><img src="${IC}paket-gold/${pack.image}" alt=""></div>
        <div class="amt">+${fmt(pack.coins)} Coin</div>
        <button class="btn buy" data-i="${index}" aria-label="Tukar ${pack.gems} Emerald menjadi ${fmt(pack.coins)} Coin">
          <img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt="">
          <span><img src="${IC}ikon-gem-medali/berlian-hijau.webp" alt="">${pack.gems}</span>
        </button>
      </div>`;
    }).join('');
  }

  function renderChest() {
    return CHESTS.map(chest => `<div class="card chest fx" style="--g:#6e8fe8">
      <div class="nm">${chest.name}</div>
      <div class="pic"><i class="glow"></i><i class="sp a"></i><i class="sp b"></i><i class="sp c"></i><i class="sp d"></i><i class="sp e"></i><img src="${IC}${chest.image}" alt=""></div>
      <div class="amt sm"><small>Fitur belum tersedia</small></div>
      <button class="btn buy soon" type="button" disabled>
        <img src="${IC}tombol-dan-kontrol/tombol-abu-polos.webp" alt=""><span>SEGERA HADIR</span>
      </button>
    </div>`).join('');
  }

  function renderEmerald() {
    return `<div class="card fx" style="--g:#38e070">
      <div class="nm">Emerald</div>
      <div class="pic"><i class="glow"></i><img src="${IC}ikon-gem-medali/berlian-hijau.webp" alt=""></div>
      <div class="amt sm"><small>Hadiah iklan belum tersedia</small></div>
      <button class="btn buy soon" id="adbtn" type="button" disabled>
        <img src="${IC}tombol-dan-kontrol/tombol-abu-polos.webp" alt=""><span>SEGERA HADIR</span>
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

  function render() {
    renderTabs();
    const cards = $('#cards');
    cards.classList.toggle('history-view', tab === 'history');
    cards.innerHTML = tab === 'coin' ? renderCoin()
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
        const icon = currency === 'Coin' ? 'hud/ikon-koin-emas.webp' : 'ikon-gem-medali/berlian-hijau.webp';
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
  $('#back').addEventListener('click', () => { playSound('click'); location.href = 'lobby.html'; });
  $('#home').addEventListener('click', () => { playSound('click'); location.href = 'lobby.html'; });
  $('#mx').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

  try {
    if (!window.__curSub) {
      window.__curSub = 1;
      PD.subscribe(reason => {
        if (reason === 'server-wallet' || reason === 'storage' || reason === 'pageshow') renderCurrency();
      });
    }
  } catch (e) {}
  if (UT.Events) UT.Events.on('currencyChanged', renderCurrency);

  render();
  renderCurrency();
  document.documentElement.classList.add('ut-ready');

  if (query.has('emerald') || query.get('tab') === 'gem') gemShop();
  if (SV() && WS()) {
    const wallet = WS();
    wallet.refresh().then(result => {
      if (result.ok) renderCurrency();
      else toast(WMSG[result.reason] || 'Tidak dapat memuat saldo.');
    });
    if (UT.LiveSync) {
      UT.LiveSync.add('wallet', () => wallet.refresh());
      UT.LiveSync.start({ interval: 20000 });
    }
  }
})();
