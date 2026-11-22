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
  /* thumbnail kartu = crop fokus-pet (tanpa makhluk latar) dari ilustrasi penuh; bila berkas crop gagal dimuat, pakai ilustrasi penuh (item.image) */
  const CARD_ROOT = 'assets/images/ui/pet/card/';
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

  const EYE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="#fff"/></svg>';
  const IC_GEM = 'assets/images/ui/gem-medal-icons/berlian-hijau.webp', IC_COIN = 'assets/images/ui/hud/ikon-koin-emas.webp';

  /* bar bawah kartu = tombol aksi: harga (belum dimiliki) -> beli; GUNAKAN / LEPAS (sudah dimiliki) */
  function actionBar(item, owned, used) {
    if (used) return '<button class="pc-pr used" type="button" data-act="use">LEPAS</button>';
    if (owned) return '<button class="pc-pr own" type="button" data-act="use">GUNAKAN</button>';
    const cost = costOf(item);
    if (!cost) return '<button class="pc-pr no" type="button" disabled>TIDAK DIJUAL</button>';
    const gems = cost.gems > 0;
    return `<button class="pc-pr" type="button" data-act="use"><b>${format(gems ? cost.gems : cost.coins)}</b><img src="${gems ? IC_GEM : IC_COIN}" alt=""></button>`;
  }

  /* kartu pet: nama, thumbnail, bar aksi; warna kartu = tier; klik kartu / ikon mata = pratinjau 3D (modal), ikon info = detail */
  /* Grid hanya dibangun ulang bila isinya benar-benar berubah (dimiliki / dipakai / harga). Sebelumnya setiap draw() membuang semua kartu:
     thumbnail berkedip dan ketukan yang sedang berjalan bisa hilang saat saldo / inventori / sinkron akun memicu draw().
     Penanda pilihan (.sel) dipasang terpisah lewat markSelected() agar tidak ikut memaksa rebuild. */
  let lastGridHtml = '';
  function drawGrid() {
    const equipped = PD.equippedId('pet');
    const html = PETS.map((item) => {
      const owned = PD.owns(item.id);
      const used = equipped === item.id;
      const rar = RARITY[item.rarity] ? item.rarity : 'common';
      const state = used ? 'dipakai' : owned ? 'dimiliki' : 'belum dimiliki';
      const check = used ? '<img class="ck" src="assets/images/ui/white-glyphs/centang.webp" alt="">' : '';
      return `<article class="pc r-${rar}${owned ? ' own' : ''}${used ? ' used' : ''}" data-id="${item.id}"><div class="pc-sel">`
        + `<div class="pc-top" role="group" aria-label="${item.name}, ${RARITY[rar][0]}, tier ${item.tier}, ${state}">`
        + `<span class="pc-nm">${item.name}</span>`
        + `<span class="pc-th"><img src="${CARD_ROOT + item.gameKey.replace(/_/g, '-')}.webp" data-fb="${item.image || IMAGE_ROOT + item.gameKey + '/' + item.gameKey + '.png'}" alt="" decoding="async">${check}</span></div>`
        + `${actionBar(item, owned, used)}</div>`
        + `<button class="pc-ic pc-eye" type="button" data-act="preview" aria-label="Pratinjau ${item.name}" title="Pratinjau">${EYE_SVG}</button>`
        + `<button class="pc-ic pc-det" type="button" data-act="detail" aria-label="Detail ${item.name}" title="Detail"><img src="assets/images/ui/white-glyphs/seru-bulat.webp" alt=""></button>`
        + `</article>`;
    }).join('');
    if (html !== lastGridHtml) {
      $('#grid').innerHTML = html;
      lastGridHtml = html;
    }
    markSelected();
  }

  function markSelected() {
    const id = selected && selected.id;
    $('#grid').querySelectorAll('.pc').forEach((card) => card.classList.toggle('sel', card.dataset.id === id));
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
      addInfoRow(body, 'Peran', detail.role || item.role);
      addInfoRow(body, 'Skill', detail.skill && detail.skill.name);
      addInfoRow(body, 'Efek skill', detail.skill && detail.skill.effect);
      addInfoRow(body, 'Batas', detail.skill && detail.skill.limit);
    } else {
      addInfoRow(body, 'Peran', item.role);
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

  function draw() {
    if (env.disposed) return;
    const equipped = PD.equippedId('pet');
    if (!selected || !PETS.some((item) => item.id === selected.id)) {
      selected = PETS.find((item) => item.id === equipped) || PETS[0];
    }
    drawGrid();
    updatePreview();
    showWallet();
  }

  /* isi modal pratinjau + minta viewer 3D memuat pet terpilih (tanpa membangun ulang grid) */
  function updatePreview() {
    if (env.disposed || !selected) return;
    const detail = metadata.get(selected.gameKey);
    const rarity = RARITY[selected.rarity] || RARITY.common;
    $('#nm').textContent = selected.name;
    $('#rar').textContent = `${rarity[0]} · Tier ${selected.tier}`;
    $('#rar').style.color = rarity[1];
    $('#ds').textContent = detail ? detail.lore : selected.desc;
    $('#petGl').setAttribute('aria-label', `Pratinjau 3D ${selected.name}`);
    if (window.PetViewer) window.PetViewer.select(selected.gameKey);
    renderDetails(selected);
  }

  /* Muat semua modul model 3D saat browser senggang, supaya pratinjau pet mana pun langsung tampil
     (dulu modul baru diunduh baru saat kartu diketuk, jadi modal sempat kosong). */
  function prewarmModels() {
    const registry = window.UT && window.UT.PetModelRegistry;
    if (!registry || typeof registry.load !== 'function') return;
    const run = () => {
      if (env.disposed) return;
      PETS.forEach((item) => {
        if (registry.hasModule(item.gameKey)) registry.load(item.gameKey).catch(() => {});
      });
    };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1500 });
    else env.setTimeout(run, 400);
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

  function openInfo() {
    renderDetails(selected || PETS[0]);
    $('#petInfoTitle').textContent = `Detail ${(selected || PETS[0]).name}`;
    $('#petInfo').showModal();
    env.requestAnimationFrame(() => { $('#petInfoBody').scrollTop = 0; });
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

  function openPreview() {
    $('#pv').classList.add('on');
    $('#pv').setAttribute('aria-hidden', 'false');
    $('#pvClose').focus({ preventScroll: true });
  }

  function closePreview() {
    $('#pv').classList.remove('on');
    $('#pv').setAttribute('aria-hidden', 'true');
  }

  /* ketuk tombol bar bawah = beli/pakai/lepas; ikon info = detail; ikon mata ATAU badan kartu = pratinjau 3D.
     Pratinjau: pilih -> isi modal + minta viewer -> baru buka modal (tanpa membangun ulang grid), jadi tampil langsung. */
  $('#grid').addEventListener('click', (event) => {
    const card = event.target.closest('.pc');
    const item = card && PETS.find((pet) => pet.id === card.dataset.id);
    if (!item) return;
    const btn = event.target.closest('[data-act]');
    const act = btn ? btn.dataset.act : 'preview';
    selected = item;
    snd('button');
    if (act === 'use') {
      runAction(item);
      return;
    }
    markSelected();
    updatePreview();
    if (act === 'detail') openInfo();
    else openPreview();
  });
  /* geser baris kartu: roda mouse / Shift + roda = ke samping; tahan + seret mouse = geser (touch tetap pan bawaan) */
  const gridEl = $('#grid');
  gridEl.addEventListener('error', (event) => {
    const img = event.target;
    if (img && img.tagName === 'IMG' && img.dataset.fb && img.getAttribute('src') !== img.dataset.fb) img.src = img.dataset.fb;
  }, true);
  gridEl.addEventListener('wheel', (event) => {
    if (gridEl.scrollWidth <= gridEl.clientWidth) return;
    const d = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!d) return;
    event.preventDefault();
    /* kanvas 1920x1080 diskalakan (transform), jadi 1px layar = 1/k px scrollLeft; sama seperti perhitungan seret di bawah */
    const k = Math.min(innerWidth / 1920, innerHeight / 1080) || 1;
    gridEl.scrollLeft += d * (event.deltaMode === 1 ? 32 : 1) / k;
  }, { passive: false });
  let drag = null;
  let dragged = false;
  gridEl.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, left: gridEl.scrollLeft, moving: false };
  });
  gridEl.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const k = Math.min(innerWidth / 1920, innerHeight / 1080) || 1;
    const dx = (event.clientX - drag.x) / k;
    if (!drag.moving) {
      if (Math.abs(dx) < 6) return;
      drag.moving = true;
      gridEl.classList.add('drag');
      try { gridEl.setPointerCapture(event.pointerId); } catch (e) { /* abaikan */ }
    }
    gridEl.scrollLeft = drag.left - dx;
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moving) {
      dragged = true;
      env.setTimeout(() => { dragged = false; }, 0);
      try { gridEl.releasePointerCapture(event.pointerId); } catch (e) { /* abaikan */ }
    }
    gridEl.classList.remove('drag');
    drag = null;
  }
  gridEl.addEventListener('pointerup', endDrag);
  gridEl.addEventListener('pointercancel', endDrag);
  gridEl.addEventListener('dragstart', (event) => event.preventDefault());
  gridEl.addEventListener('click', (event) => {
    if (!dragged) return;
    event.stopPropagation();
    event.preventDefault();
  }, true);
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

  /* skala kanvas 1920x1080 + sisa layar di luar kanvas (--hub-ex/--hub-ey) agar bingkai #pmodal penuh sampai tepi layar */
  function fit() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080) || 1, st = $('#stage');
    st.style.transform = `scale(${k})`;
    st.style.setProperty('--hub-ex', Math.max(0, (innerWidth / k - 1920) / 2).toFixed(1) + 'px');
    st.style.setProperty('--hub-ey', Math.max(0, (innerHeight / k - 1080) / 2).toFixed(1) + 'px');
  }
  /* transparansi panel (Pengaturan, Prefs 'panelTransparency'): 0% pekat .. 70%; bawaan 16% */
  function applyPanelAlpha() {
    try {
      let t = parseInt(window.UT.Prefs.get('panelTransparency', 16), 10);
      if (!isFinite(t)) t = 16;
      document.documentElement.style.setProperty('--panel-a', (1 - Math.max(0, Math.min(70, t)) / 100).toFixed(2));
    } catch (e) { /* abaikan */ }
  }
  applyPanelAlpha();
  try { if (window.UT.Prefs && window.UT.Prefs.on) env.own(window.UT.Prefs.on((n) => { if (n === 'panelTransparency') applyPanelAlpha(); })); } catch (e) { /* abaikan */ }
  env.addEventListener('resize', fit);
  selected = PETS.find((item) => PD.isEquipped(item.id)) || PETS[0];
  draw();
  showWallet();
  fit();
  prewarmModels();
  refreshAccount();
  void loadMetadata();
  document.documentElement.classList.add('ut-ready');
});
