/* Modul 'pet' (tab Pet). Mandiri/embed: mount otomatis seperti sebelumnya. Di shell (play.html): view sendiri — mount/unmount oleh UT.Spa,
   bar tab Inventory dipasang di sini, navigasi lewat UT.Spa.go, listener/timer dilepas lewat env saat unmount. */
UT.PageModule.define('pet', function (env) {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const PD = window.PlayerData;
  const IC = window.ItemCatalog;
  const WS = window.UT && window.UT.WalletService;
  const AS = window.UT && window.UT.AppearanceService;
  const IMAGE_ROOT = 'data/inventory/pet/items/';
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

  /* di shell, viewer 3D ikut di-mount/unmount bersama view (mandiri: viewer sudah mount sendiri saat skrip dimuat) */
  const MANAGED = !!(window.UT.PageModule && window.UT.PageModule.managed);
  if (MANAGED) {
    window.UT.PageModule.mount('pet-viewer');
    env.own(() => window.UT.PageModule.unmount('pet-viewer'));
  }

  function snd(name) {
    try { if (PD.settings().sound) window.UT.Audio.play(name || 'button'); } catch (e) {}
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
    env.clearTimeout(toastTimer);
    toastTimer = env.setTimeout(() => element.classList.remove('on'), 2200);
  }

  function setStatus(message) {
    if (env.disposed) return;
    const element = $('#petStatus');
    element.textContent = message || '';
    element.hidden = !message;
  }

  function showWallet() {
    if (env.disposed) return;
    const ready = PD.walletReady();
    $('#v-em').textContent = ready ? format(PD.gems()) : '—';
    $('#v-co').textContent = ready ? format(PD.coins()) : '—';
  }

  const EYE = '<svg class="pc-eye" viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/></svg>';

  function priceOf(item) {
    const cost = costOf(item);
    if (!cost) return null;
    const gems = cost.gems > 0;
    return {
      gems,
      amount: gems ? cost.gems : cost.coins,
      icon: gems ? 'assets/images/ui/gem-medal-icons/berlian-hijau.webp' : 'assets/images/ui/hud/ikon-koin-emas.webp'
    };
  }

  function barOf(item) {
    if (PD.owns(item.id)) return PD.equippedId('pet') === item.id ? { cls: 'used', html: 'LEPAS' } : { cls: 'own', html: 'GUNAKAN' };
    const price = priceOf(item);
    if (!price) return { cls: 'no', html: 'TIDAK DIJUAL', off: true };
    return { cls: 'buy', html: `<img src="${price.icon}" alt="">${format(price.amount)}` };
  }

  function drawGrid() {
    const equipped = PD.equippedId('pet');
    $('#grid').innerHTML = PETS.map((item) => {
      const owned = PD.owns(item.id);
      const used = equipped === item.id;
      const rarity = RARITY[item.rarity] || RARITY.common;
      const bar = barOf(item);
      const check = used ? '<img class="pc-ck" src="assets/images/ui/white-glyphs/centang.webp" alt="">' : '';
      const state = used ? ', dipakai' : owned ? ', dimiliki' : ', belum dimiliki';
      return `<article class="pcard${selected && item.id === selected.id ? ' sel' : ''}" style="--rc:${rarity[1]}" data-id="${item.id}">`
        + `<button class="pc-top" type="button" data-act="view" aria-label="Pratinjau ${item.name}, tier ${item.tier}${state}"><span class="pc-name">${item.name}</span>`
        + `<span class="pc-art"><img class="pic" src="${IMAGE_ROOT + item.gameKey + '/' + item.gameKey + '.png'}" alt="" loading="lazy">${check}`
        + `<img class="pc-spark" src="assets/images/ui/white-glyphs/bintang-kilau.webp" alt="">${EYE}</span></button>`
        + `<button class="pc-bar ${bar.cls}" type="button" data-act="use"${bar.off ? ' disabled' : ''}>${bar.html}</button></article>`;
    }).join('');
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
    if (env.disposed) return;
    const body = $('#petInfoBody');
    body.replaceChildren();

    const detail = metadata.get(item.gameKey);
    if (detail) {
      addInfoRow(body, 'Identitas', detail.identity);
      addInfoRow(body, 'Peran', detail.role || item.role);
      addInfoRow(body, 'Keunggulan', detail.advantage);
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
    const price = priceOf(item);
    if (!price) {
      label.textContent = 'TIDAK DIJUAL';
      button.disabled = true;
      button.classList.add('off');
      return;
    }
    label.innerHTML = `<img src="${price.icon}" alt="">${format(price.amount)}`;
  }

  function draw() {
    if (env.disposed) return;
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
        await import('../../../../../assets/js/multiplayer/client.js');
      }
      const client = await window.UT.Multiplayer.getClient();
      const { data, error } = await client
        .from('pet_catalog')
        .select('id,identity,role,skill,advantage,lore');
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
      snd('power');
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
        navigate(gems ? 'tambang.html?from=pet.html' : 'shop.html?coin=1');
      });
      return;
    }
    modal('Konfirmasi', `Beli ${item.name}\nseharga ${format(amount)} ${currency}?`, 'BATAL', 'BELI', () => buy(item));
  }

  function runAction(item) {
    if (busy || !item) return;
    if (!PD.owns(item.id)) {
      buySelected(item);
      return;
    }
    if (PD.equippedId('pet') === item.id) void unequip();
    else void equip(item);
  }

  function openPreview(item) {
    selected = item;
    draw();
    $('#pv').classList.add('on');
    $('#pv').setAttribute('aria-hidden', 'false');
    $('#pvClose').focus({ preventScroll: true });
  }

  function closePreview() {
    $('#pv').classList.remove('on');
    $('#pv').setAttribute('aria-hidden', 'true');
  }

  $('#grid').addEventListener('click', (event) => {
    const card = event.target.closest('.pcard');
    const part = event.target.closest('[data-act]');
    const item = card && PETS.find((pet) => pet.id === card.dataset.id);
    if (!item || !part) return;
    snd('button');
    if (part.dataset.act === 'use') {
      selected = item;
      runAction(item);
    } else {
      openPreview(item);
    }
  });
  $('#use').addEventListener('click', () => {
    if (busy || !selected) return;
    snd('button');
    runAction(selected);
  });
  $('#pvClose').addEventListener('click', closePreview);
  $('#pv').addEventListener('click', (event) => {
    if (event.target.id === 'pv') closePreview();
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
    env.requestAnimationFrame(() => { $('#petInfoBody').scrollTop = 0; });
  });
  $('#petInfoClose').addEventListener('click', () => $('#petInfo').close());
  $('#petInfo').addEventListener('click', (event) => {
    if (event.target === $('#petInfo')) $('#petInfo').close();
  });
  env.on(document, 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    if ($('#md').classList.contains('on')) closeModal();
    else if ($('#petInfo').open) return;
    else if ($('#pv').classList.contains('on')) closePreview();
    else navigate('lobby.html');
  });

  /* di shell semua target lewat UT.Spa.go (view atau iframe); mandiri/embed: fade 330 ms lalu pindah halaman biasa */
  function navigate(url) {
    if (MANAGED && window.UT.Spa && window.UT.Spa.go) { window.UT.Spa.go(url); return; }
    $('#fade').classList.add('on');
    env.setTimeout(() => { window.location.href = url; }, 330);
  }

  $('#back').addEventListener('click', () => navigate('lobby.html'));
  $('#cur-co').addEventListener('click', () => navigate('shop.html?coin=1'));
  $('#cur-em').addEventListener('click', () => navigate('tambang.html?from=pet.html'));

  env.own(window.UT.Events.on('currencyChanged', showWallet));
  env.own(window.UT.Events.on('inventoryChanged', draw));
  env.own(window.UT.Events.on('petChanged', draw));

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
      env.own(() => { window.UT.LiveSync.remove('wallet'); window.UT.LiveSync.remove('appearance'); window.UT.LiveSync.stop(); });
    }
  }

  function fit() {
    $('#stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  }
  env.addEventListener('resize', fit);
  selected = PETS.find((item) => PD.isEquipped(item.id)) || PETS[0];
  draw();
  showWallet();
  fit();
  refreshAccount();
  void loadMetadata();
  document.documentElement.classList.add('ut-ready');
});
