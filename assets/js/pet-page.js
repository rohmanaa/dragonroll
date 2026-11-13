(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const PD = window.PlayerData;
  const IC = window.ItemCatalog;
  const WS = window.UT && window.UT.WalletService;
  const AS = window.UT && window.UT.AppearanceService;
  const ITEM_ROOT = 'assets/ng/komponen/';
  const IMAGE_ROOT = 'assets/ng/pet3d/';
  const RARITY = {
    common: ['Biasa', '#cfc8ea'],
    uncommon: ['Tidak Biasa', '#6fe08a'],
    rare: ['Langka', '#4db3e6'],
    epic: ['Epik', '#b07cff'],
    legendary: ['Legendaris', '#ffd45a'],
    mythic: ['Mitos', '#ff6a5e'],
    divine: ['Ilahi', '#fff2b0']
  };
  const REASONS = {
    'saldo-kurang': 'Coin tidak cukup.',
    'gem-kurang': 'Emerald tidak cukup.',
    'sudah-dimiliki': 'Pet sudah dimiliki.',
    'tidak-tersedia': 'Pet tidak tersedia.',
    'belum-login': 'Silakan login untuk membeli Pet.',
    'jaringan': 'Tidak dapat terhubung ke server.',
    'sedang-diproses': 'Pembelian sedang diproses.',
    'mode-lokal': 'Login untuk membeli dan menyinkronkan Pet.'
  };
  const PETS = IC && Array.isArray(IC.items)
    ? IC.items.filter((item) => item.kind === 'pet').sort((a, b) => a.tier - b.tier)
    : [];
  const metadata = new Map();
  let selected = null;
  let metadataLoaded = false;
  let metadataError = null;
  let busy = false;
  let toastTimer = null;
  let confirmAction = null;

  if (!PD || !IC || !PETS.length) {
    console.error('[pet] katalog pemain tidak tersedia');
    $('#petStatus').hidden = false;
    $('#petStatus').textContent = 'Katalog Pet tidak dapat dimuat.';
    return;
  }

  function format(value) {
    return Number(value || 0).toLocaleString('id-ID');
  }

  function costOf(item) {
    return IC.cost(item);
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('on'), 2200);
  }

  function setStatus(message) {
    const element = $('#petStatus');
    element.textContent = message || '';
    element.hidden = !message;
  }

  function showWallet() {
    const ready = PD.walletReady();
    $('#v-em').textContent = ready ? format(PD.gems()) : '—';
    $('#v-co').textContent = ready ? format(PD.coins()) : '—';
  }

  function priceMarkup(item) {
    const cost = costOf(item);
    if (!cost) return '<span class="pr no">TIDAK DIJUAL</span>';
    const gems = cost.gems > 0;
    const icon = gems ? 'ikon-gem-medali/berlian-hijau.webp' : 'hud/ikon-koin-emas.webp';
    const amount = gems ? cost.gems : cost.coins;
    return `<span class="pr buy"><img src="${ITEM_ROOT + icon}" alt="">${format(amount)}</span>`;
  }

  function drawGrid() {
    const equipped = PD.equippedId('pet');
    let html = PETS.map((item) => {
      const owned = PD.owns(item.id);
      const used = equipped === item.id;
      const badge = used ? '<span class="tag">DIPAKAI</span>' : owned ? '<span class="tag own">DIMILIKI</span>' : '';
      return `<button class="fslot${selected && item.id === selected.id ? ' sel' : ''}${owned ? '' : ' lk'}" type="button" data-id="${item.id}" aria-pressed="${!!selected && item.id === selected.id}" aria-label="${item.name}, tier ${item.tier}${used ? ', dipakai' : owned ? ', dimiliki' : ', belum dimiliki'}">${badge}<div class="dc"><img src="${IMAGE_ROOT + item.gameKey}.png" alt="${item.name}" loading="lazy"></div>${owned ? '' : priceMarkup(item)}</button>`;
    }).join('');
    for (let i = PETS.length; i < 18; i++) html += '<div class="slot empty" aria-hidden="true"></div>';
    $('#grid').innerHTML = html;
  }

  function addInfoRow(container, label, value) {
    if (value == null || value === '') return;
    const row = document.createElement('div');
    const name = document.createElement('b');
    const text = document.createElement('span');
    row.className = 'pet-info-row';
    name.textContent = label;
    text.textContent = Array.isArray(value) ? value.join(', ') : String(value);
    row.append(name, text);
    container.appendChild(row);
  }

  function renderDetails(item) {
    const body = $('#petInfoBody');
    body.replaceChildren();

    const rarity = RARITY[item.rarity] || RARITY.common;
    addInfoRow(body, 'Kelangkaan', rarity[0]);
    addInfoRow(body, 'Tier', `Tier ${item.tier}`);
    const detail = metadata.get(item.gameKey);
    if (detail) {
      addInfoRow(body, 'Bahan', detail.material);
      addInfoRow(body, 'Identitas', detail.identity);
      addInfoRow(body, 'Peran', detail.role || item.role);
      addInfoRow(body, 'Keunggulan', detail.advantage);
      addInfoRow(body, 'Animasi', detail.animations);
      addInfoRow(body, 'Efek visual', detail.effects);
      addInfoRow(body, 'Suara', detail.sounds);
      addInfoRow(body, 'Cerita', detail.lore);
      addInfoRow(body, 'Skill', detail.skill && detail.skill.name);
      addInfoRow(body, 'Efek skill', detail.skill && detail.skill.effect);
      addInfoRow(body, 'Batas', detail.skill && detail.skill.limit);
    } else {
      addInfoRow(body, 'Peran', item.role);
      addInfoRow(body, 'Deskripsi', item.desc);
    }

    if (metadataError || !metadataLoaded) {
      const status = document.createElement('p');
      status.className = 'pet-info-status';
      status.textContent = metadataError
        ? 'Rincian kemampuan belum dapat dimuat. Coba lagi.'
        : 'Memuat rincian kemampuan Pet...';
      body.appendChild(status);
      if (metadataError) {
        const retry = document.createElement('button');
        retry.className = 'pet-info-retry';
        retry.type = 'button';
        retry.textContent = 'Coba lagi';
        retry.addEventListener('click', loadMetadata);
        body.appendChild(retry);
      }
    }
  }

  function renderAction(item) {
    const button = $('#use');
    const label = button.querySelector('span');
    const owned = PD.owns(item.id);
    const used = PD.equippedId('pet') === item.id;
    button.disabled = busy;
    button.classList.toggle('off', busy);
    if (owned) {
      label.textContent = used ? 'LEPAS' : 'GUNAKAN';
      return;
    }
    const cost = costOf(item);
    if (!cost) {
      label.textContent = 'TIDAK DIJUAL';
      button.disabled = true;
      button.classList.add('off');
      return;
    }
    const gems = cost.gems > 0;
    const icon = gems ? 'ikon-gem-medali/berlian-hijau.webp' : 'hud/ikon-koin-emas.webp';
    const amount = gems ? cost.gems : cost.coins;
    label.innerHTML = `<img src="${ITEM_ROOT + icon}" alt="">${format(amount)}`;
  }

  function draw() {
    const equipped = PD.equippedId('pet');
    if (!selected || !PETS.some((item) => item.id === selected.id)) {
      selected = PETS.find((item) => item.id === equipped) || PETS[0];
    }
    drawGrid();
    const detail = metadata.get(selected.gameKey);
    const rarity = RARITY[selected.rarity] || RARITY.common;
    $('#nm').textContent = selected.name;
    $('#rar').textContent = `${rarity[0]} · Tier ${selected.tier}`;
    $('#rar').style.color = rarity[1];
    $('#ds').textContent = detail ? detail.lore : selected.desc;
    $('#petGl').setAttribute('aria-label', `Pratinjau 3D ${selected.name}`);
    if (window.PetViewer) window.PetViewer.select(selected.gameKey);
    renderDetails(selected);
    renderAction(selected);
    showWallet();
  }

  async function loadMetadata() {
    metadataError = null;
    renderDetails(selected || PETS[0]);
    try {
      if (!window.UT.Multiplayer || !window.UT.Multiplayer.getClient) {
        await import('./multiplayer/client.js');
      }
      const client = await window.UT.Multiplayer.getClient();
      const { data, error } = await client
        .from('pet_catalog')
        .select('id,tier,tier_name,name,material,identity,role,skill,advantage,visual,animations,effects,sounds,lore')
        .order('tier', { ascending: true });
      if (error) throw error;
      const next = new Map((data || []).map((row) => [row.id, row]));
      const missing = PETS.filter((item) => !next.has(item.gameKey));
      if (!Array.isArray(data) || missing.length) throw new Error('Katalog metadata Pet belum lengkap.');
      metadata.clear();
      next.forEach((value, key) => metadata.set(key, value));
      metadataLoaded = true;
      metadataError = null;
      draw();
    } catch (error) {
      metadataError = error;
      console.error('[pet] gagal memuat rincian Pet dari pet_catalog', error);
      renderDetails(selected || PETS[0]);
    }
  }

  function syncAppearance() {
    if (!PD.serverMode()) return Promise.resolve(true);
    if (!AS || !AS.get()) {
      console.error('[pet] AppearanceService tidak tersedia');
      return Promise.resolve(false);
    }
    return AS.get().pushAppearance().then((result) => {
      if (result && result.ok === false) {
        console.error('[pet] gagal menyinkronkan Pet', result);
        return false;
      }
      return true;
    });
  }

  async function equip(item) {
    const result = PD.equip(item.id);
    if (!result.ok) {
      toast(result.reason === 'belum-dimiliki' ? 'Pet ini belum dimiliki.' : 'Pet gagal dipakai.');
      return;
    }
    const synced = await syncAppearance();
    draw();
    toast(synced ? `${item.name} dipakai.` : 'Pet dipakai di perangkat ini, tetapi gagal disinkronkan ke akun.');
  }

  async function unequip() {
    const result = PD.unequip('pet');
    if (!result.ok) {
      toast('Pet gagal dilepas.');
      return;
    }
    const synced = await syncAppearance();
    draw();
    toast(synced ? 'Pet dilepas.' : 'Pet dilepas di perangkat ini, tetapi gagal disinkronkan ke akun.');
  }

  function modal(title, message, cancelLabel, confirmLabel, action) {
    $('#mt').textContent = title;
    $('#mx').textContent = message;
    $('#m-no span').textContent = cancelLabel;
    $('#m-ok span').textContent = confirmLabel;
    confirmAction = action;
    $('#md').classList.add('on');
  }

  function closeModal() {
    $('#md').classList.remove('on');
    confirmAction = null;
  }

  function explainFailure(result) {
    if (!result) return 'Pembelian gagal.';
    return REASONS[result.reason] || result.message || 'Pembelian gagal.';
  }

  async function buy(item) {
    if (!PD.serverMode()) {
      toast('Login terlebih dahulu untuk membeli Pet.');
      return;
    }
    if (!PD.walletReady()) {
      toast('Menunggu saldo dari server...');
      return;
    }
    const wallet = WS && WS.get();
    if (!wallet || typeof wallet.buy !== 'function') {
      toast('Layanan pembelian Pet tidak tersedia.');
      return;
    }

    busy = true;
    draw();
    try {
      const result = await wallet.buy(item.id);
      if (!result || !result.ok) {
        toast(explainFailure(result));
        return;
      }
      const equipped = PD.equip(item.id);
      if (!equipped.ok) {
        draw();
        toast('Pet berhasil dibeli, tetapi gagal dipakai.');
        return;
      }
      const synced = await syncAppearance();
      draw();
      toast(synced ? `${item.name} dibeli dan dipakai.` : 'Pet dibeli, tetapi gagal disinkronkan ke akun.');
    } catch (error) {
      console.error('[pet] pembelian gagal', error);
      toast('Pembelian Pet gagal. Coba lagi.');
    } finally {
      busy = false;
      draw();
    }
  }

  function buySelected(item) {
    if (!PD.serverMode()) {
      toast('Login terlebih dahulu untuk membeli Pet.');
      return;
    }
    if (!PD.walletReady()) {
      toast('Menunggu saldo dari server...');
      return;
    }
    const cost = costOf(item);
    if (!cost) {
      toast('Pet ini tidak tersedia untuk dibeli.');
      return;
    }
    const gems = cost.gems > 0;
    const amount = gems ? cost.gems : cost.coins;
    const currency = gems ? 'Emerald' : 'Coin';
    const balance = gems ? PD.gems() : PD.coins();
    if (balance < amount) {
      const missing = format(amount - balance);
      const current = format(balance);
      modal(`${currency} tidak cukup`, `Kamu butuh ${missing} ${currency} lagi.\nSaldo kamu ${current} ${currency}.`, 'TUTUP', gems ? 'DAPATKAN EMERALD' : 'DAPATKAN COIN', () => {
        window.location.href = gems ? 'tambang.html?from=pet.html' : 'shop.html?coin=1';
      });
      return;
    }
    modal('Konfirmasi', `Beli ${item.name}\nseharga ${format(amount)} ${currency}?`, 'BATAL', 'BELI', () => buy(item));
  }

  $('#grid').addEventListener('click', (event) => {
    const card = event.target.closest('.fslot');
    if (!card) return;
    selected = PETS.find((item) => item.id === card.dataset.id) || selected;
    draw();
  });
  $('#use').addEventListener('click', () => {
    if (busy || !selected) return;
    if (!PD.owns(selected.id)) {
      buySelected(selected);
      return;
    }
    if (PD.equippedId('pet') === selected.id) void unequip();
    else void equip(selected);
  });
  $('#m-no').addEventListener('click', closeModal);
  $('#m-ok').addEventListener('click', () => {
    const action = confirmAction;
    closeModal();
    if (action) action();
  });
  $('#md').addEventListener('click', (event) => {
    if (event.target.id === 'md') closeModal();
  });
  $('#petInfoOpen').addEventListener('click', () => {
    renderDetails(selected || PETS[0]);
    $('#petInfo').showModal();
  });
  $('#petInfoClose').addEventListener('click', () => $('#petInfo').close());
  $('#petInfo').addEventListener('click', (event) => {
    if (event.target === $('#petInfo')) $('#petInfo').close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if ($('#md').classList.contains('on')) closeModal();
    else if ($('#petInfo').open) return;
    else window.location.href = 'lobby.html';
  });

  function navigate(url) {
    $('#fade').classList.add('on');
    setTimeout(() => { window.location.href = url; }, 330);
  }
  $('#back').addEventListener('click', () => navigate('lobby.html'));
  $('#cur-co').addEventListener('click', () => navigate('shop.html?coin=1'));
  $('#cur-em').addEventListener('click', () => navigate('tambang.html?from=pet.html'));

  window.UT.Events.on('currencyChanged', showWallet);
  window.UT.Events.on('inventoryChanged', draw);
  window.UT.Events.on('petChanged', draw);

  function refreshAccount() {
    if (!PD.serverMode()) {
      setStatus('Login untuk membeli Pet dan menyimpan Pet aktif ke akun.');
      return;
    }
    const wallet = WS && WS.get();
    const appearance = AS && AS.get();
    const tasks = [];
    if (wallet) tasks.push(wallet.refresh());
    if (appearance) tasks.push(appearance.refresh());
    Promise.all(tasks).then((results) => {
      const failure = results.find((result) => !result || result.ok === false);
      setStatus(failure ? (REASONS[failure.reason] || 'Data akun belum dapat disinkronkan.') : '');
      draw();
    }).catch((error) => {
      console.error('[pet] gagal memuat data akun', error);
      setStatus('Data akun belum dapat disinkronkan. Coba muat ulang halaman.');
    });
    if (window.UT.LiveSync && wallet && appearance) {
      window.UT.LiveSync.add('wallet', () => wallet.refresh());
      window.UT.LiveSync.add('appearance', () => appearance.refreshThrottled(20000));
      window.UT.LiveSync.start({ interval: 20000 });
    }
  }

  function fit() {
    $('#stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  }
  window.addEventListener('resize', fit);
  selected = PETS.find((item) => PD.isEquipped(item.id)) || PETS[0];
  draw();
  showWallet();
  fit();
  refreshAccount();
  void loadMetadata();
  document.documentElement.classList.add('ut-ready');
})();
