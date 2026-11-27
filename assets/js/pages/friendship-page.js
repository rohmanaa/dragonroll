/* friendship-page.js — Tahap 3 SPA: dibungkus UT.PageModule ('friendship'). Halaman mandiri otomatis mount; unmount() melepas timer,
   listener, langganan (PlayerData, Events, Presence), dan LiveSync. Callback async dijaga env.disposed. */
UT.PageModule.define('friendship', function (env) {
  'use strict';
  const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, addEventListener } = env;

  const $ = selector => document.querySelector(selector);
  const PD = window.PlayerData;
  const RS = () => window.UT && UT.Multiplayer && UT.Multiplayer.RoomService;
  const PR = () => window.UT && UT.Multiplayer && UT.Multiplayer.Presence;
  const WS = () => window.UT && UT.WalletService && UT.WalletService.get();
  const fmt = value => Number(value || 0).toLocaleString('id-ID');
  const COLORS = [0x22b8d8, 0x9a4ae0, 0xf0b030, 0x4acb58, 0xd23a32, 0x5a75d6, 0x35d3f0, 0xff7ad0];
  const EMPTY_APPEARANCE = { look: null, equipped: {}, gear_dye: {} };
  const appearanceById = Object.create(null);

  let friends = [];
  let requests = [];
  const friendStats = Object.create(null);
  let filter = 'online';
  let query = '';
  let authed = null;
  let loaded = false;
  let loadError = '';
  let loadInFlight = null;
  let statsInFlight = null;
  let appearanceInFlight = null;
  let modalAction = null;
  /* Kirim hati (tahap 2): status per teman dari server (hearts_friends) */
  const HS = () => window.UT && UT.HeartsService && UT.HeartsService.get();
  const gifts = Object.create(null);          // id(lowercase) -> { sent, gold }
  let giftInfo = { limit: 25, sent: 0, fee: 1, feeGold: 2, known: false };
  let giftBusy = false;

  /* Semua langkah muat data dibatasi waktu: janji yang menggantung (presence, getSession, RPC) tidak boleh
     membuat daftar "Memuat teman..." selamanya dan tidak boleh mengunci loadInFlight. */
  const LOAD_TIMEOUT = 12000;
  const PRESENCE_WAIT = 3000;
  function withTimeout(promise, ms, label) {
    let timer;
    const guard = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('TIMEOUT: ' + label)), ms);
    });
    return Promise.race([Promise.resolve(promise), guard]).finally(() => clearTimeout(timer));
  }
  let retryTimer = 0;

  /* di shell (play.html) SEMUA target lewat UT.Spa.go (view atau iframe) agar shell tidak ditinggalkan; halaman mandiri: pindah halaman biasa */
  const nav = url => { if (UT.Spa && UT.Spa.go) { UT.Spa.go(url); return; } location.href = url; };

  function fit() {
    $('#stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  }
  addEventListener('resize', fit);
  fit();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function colorOf(name) {
    const text = String(name || '');
    const index = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLORS.length;
    return `#${COLORS[index].toString(16).padStart(6, '0')}`;
  }

  function renderCurrency() {
    if (env.disposed) return;
    const em = $('#v-em'), co = $('#v-co');   /* tidak ada di panel hub (saldo disembunyikan di modal) */
    if (em) em.textContent = PD.walletReady() ? fmt(PD.gems()) : '—';
    if (co) co.textContent = PD.walletReady() ? fmt(PD.coins()) : '—';
  }

  function toast(message) {
    if (env.disposed) return;
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 1800);
  }

  function presenceMap() {
    const map = Object.create(null);
    try {
      (PR() ? PR().list() : []).forEach(player => {
        if (player && player.id) map[String(player.id).toLowerCase()] = player.status;
      });
    } catch (error) {
      console.warn('[friendship] gagal membaca presence', error);
    }
    return map;
  }

  function viewFriends() {
    const presence = presenceMap();
    return friends.map(friend => {
      const id = String(friend.friend_id || '');
      const name = String(friend.friend_name || 'Pemain');
      const status = presence[id.toLowerCase()];
      const online = status === 'lobby';
      const busy = status === 'room' || status === 'game';
      return {
        id,
        name,
        status: online ? 'online' : busy ? 'busy' : 'offline',
        mode: online ? 'Di lobi' : status === 'room' ? 'Di room' : status === 'game' ? 'Sedang bermain' : 'Offline'
      };
    });
  }

  function viewRequests() {
    return requests.map(request => ({
      id: String(request.from_id || ''),
      name: String(request.from_name || 'Pemain'),
      status: 'request',
      mode: 'Ingin berteman'
    }));
  }

  function avatarHtml(friend) {
    const id = String(friend.id).toLowerCase();
    const appearance = appearanceById[id] || EMPTY_APPEARANCE;
    const face = window.UT.CharacterFace;
    const image = face && face.urlData(appearance);
    const fallback = escapeHtml(friend.name.trim().slice(0, 1).toUpperCase() || '?');
    const inner = image
      ? `<img src="${image}" alt="" draggable="false">`
      : `<span>${fallback}</span>`;
    const avatar = `<div class="avc" style="width:5.2rem;height:5.2rem;background:${colorOf(friend.name)}">${inner}</div>`;
    const frameId = appearance.equipped && appearance.equipped.frame;
    return window.FrameAvatar
      ? window.FrameAvatar.wrap(avatar, '5.2rem', frameId)
      : avatar;
  }

  function giftButton(friend) {
    const g = gifts[String(friend.id).toLowerCase()];
    if (!g) return `<button class="stat lk" type="button" disabled title="Kirim hati belum tersedia" aria-label="Kirim hati belum tersedia"><img src="assets/images/ui/white-glyphs/paha-ayam.webp" alt=""><b>—</b></button>`;
    const fee = g.gold ? giftInfo.feeGold : giftInfo.fee;
    const full = giftInfo.sent >= giftInfo.limit;
    const cls = 'stat lk' + (g.gold ? ' gold' : '') + (g.sent ? ' sent' : '');
    const label = g.sent ? 'Hati sudah dikirim hari ini' : full ? 'Batas harian tercapai' : `Kirim hati ke ${friend.name} (+${fee} Emerald untukmu)`;
    return `<button class="${cls}" type="button" data-action="gift"${g.sent || full ? ' disabled' : ''} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><img src="assets/images/ui/white-glyphs/paha-ayam.webp" alt=""><b>${g.sent ? '✓' : '+' + fee}</b></button>`;
  }

  async function loadGifts() {
    const svc = HS();
    if (!authed || !svc || !svc.enabled()) return;
    const r = await svc.friends();
    if (env.disposed || !r || !r.ok) return;
    Object.keys(gifts).forEach(id => delete gifts[id]);
    (r.friends || []).forEach(row => { gifts[String(row.friend_id).toLowerCase()] = { sent: !!row.sent_today, gold: !!row.gold }; });
    giftInfo = { limit: r.limit || 25, sent: r.sent_today | 0, fee: r.fee || 1, feeGold: r.fee_gold || 2, known: true };
    render();
  }

  async function sendGift(id, name) {
    if (giftBusy) return;
    giftBusy = true;
    try {
      const r = await HS().send(id);
      if (env.disposed) return;
      if (r && r.ok) {
        const g = gifts[id.toLowerCase()] || (gifts[id.toLowerCase()] = {});
        g.sent = true; g.gold = !!r.gold;
        giftInfo.sent = r.sent_today | 0;
        toast(`Hati terkirim ke ${name}! +${r.fee} Emerald`);
        if (WS() && WS().refresh) WS().refresh().then(renderCurrency, () => {});
      } else {
        const why = { 'sudah-dikirim': 'Hari ini kamu sudah kirim hati ke teman ini.', 'batas-harian': `Batas ${giftInfo.limit} teman per hari tercapai.`,
          'bukan-teman': 'Kalian belum berteman.', 'belum-login': 'Masuk dulu untuk mengirim hati.' }[r && r.reason] || 'Gagal mengirim hati. Periksa koneksi.';
        toast(why);
        if (r && (r.reason === 'sudah-dikirim' || r.reason === 'batas-harian')) loadGifts();
      }
      render();
    } finally { giftBusy = false; }
  }

  function renderTabs(onlineCount) {
    const tabs = [
      ['online', `ONLINE <i class="bd">${onlineCount}</i>`],
      ['all', 'SEMUA'],
      ['request', `PERMINTAAN <i class="bd">${requests.length}</i>`]
    ];
    $('#tabs').innerHTML = tabs.map(([key, label]) =>
      `<button class="ut-ul-i${filter === key ? ' on' : ''}" type="button" data-filter="${key}" aria-selected="${filter === key}">${label}</button>`
    ).join('');
  }

  function emptyMessage() {
    if (authed === false) return 'Masuk ke akunmu untuk melihat teman.';
    if (!loaded) return 'Memuat teman...';
    if (loadError) return loadError;
    if (query) return 'Tidak ada teman yang cocok dengan pencarian.';
    if (filter === 'request') return 'Belum ada permintaan teman.';
    if (filter === 'online') return 'Tidak ada teman yang sedang online.';
    return 'Belum ada teman. Tekan TAMBAH TEMAN untuk mengirim permintaan.';
  }

  function render() {
    if (env.disposed) return;
    const friendRows = viewFriends();
    const requestRows = viewRequests();
    const onlineCount = friendRows.filter(friend => friend.status !== 'offline').length;
    const source = filter === 'request' ? requestRows : friendRows;
    const visible = source.filter(friend => friend.name.toLowerCase().includes(query.toLowerCase()))
      .filter(friend => filter !== 'online' || friend.status !== 'offline');

    renderTabs(onlineCount);
    $('#sum').textContent = `${friendRows.length} teman · ${onlineCount} online`;
    $('#list').innerHTML = visible.length ? visible.map((friend, index) => {
      const isRequest = filter === 'request';
      const stats = friendStats[String(friend.id).toLowerCase()] || {};
      let actions;
      if (isRequest) {
        actions = `<button class="btn sm ut-gl ut-c-g" type="button" data-action="accept" aria-label="Terima permintaan dari ${escapeHtml(friend.name)}"><img src="assets/images/ui/buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>TERIMA</span></button>
          <button class="btn sm ut-gl ut-c-r" type="button" data-action="decline" aria-label="Tolak permintaan dari ${escapeHtml(friend.name)}"><img src="assets/images/ui/buttons-and-controls/tombol-merah-polos.webp" alt=""><span>TOLAK</span></button>`;
      } else {
        const statusButton = friend.status === 'online'
          ? `<button class="btn sm ut-gl ut-c-g" type="button" data-action="invite" aria-label="Ajak ${escapeHtml(friend.name)} bermain"><img src="assets/images/ui/buttons-and-controls/tombol-hijau-polos.webp" alt=""><span>MAIN</span></button>`
          : `<button class="btn sm off ut-gl ut-c-d" type="button" disabled><img src="assets/images/buttons/tombol-abu-polos.webp" alt=""><span>${friend.status === 'busy' ? 'SIBUK' : 'OFFLINE'}</span></button>`;
        actions = statusButton;
      }
      const dotClass = isRequest ? 'request' : friend.status === 'offline' ? 'off' : friend.status === 'busy' ? 'busy' : '';
      const statHtml = isRequest ? '' : `<div class="cell"><b class="ut-pc-t">${stats.pos == null ? '—' : `#${fmt(stats.pos)}`}</b><small class="ut-pc-t">POSISI</small></div>
        <div class="cell"><b class="ut-pc-t">${stats.lvl == null ? '—' : fmt(stats.lvl)}</b><small class="ut-pc-t">LEVEL</small></div>
        <div class="stat tr" title="Kemenangan"><img src="assets/images/ui/white-glyphs/piala.webp" alt=""><b>${stats.wins == null ? '—' : fmt(stats.wins)}</b></div>
        ${giftButton(friend)}`;
      const removeButton = isRequest ? '' : `<button class="rm ut-gl ut-c-r sm" type="button" data-action="remove" aria-label="Hapus ${escapeHtml(friend.name)}"><img src="assets/images/ui/white-glyphs/tong-sampah.webp" alt=""></button>`;
      return `<article class="ut-pc fc" data-id="${escapeHtml(friend.id)}" style="animation-delay:${index * 35}ms">
        ${avatarHtml(friend)}
        <div class="ut-pc-main grow"><div class="ut-pc-nm nm">${escapeHtml(friend.name)}</div>
          <div class="ut-pc-sub sb"><span class="dot ${dotClass}"></span>${escapeHtml(friend.mode)}</div>
        </div>
        ${statHtml}<div class="actions">${actions}</div>${removeButton}
      </article>`;
    }).join('') : `<div class="empty">${escapeHtml(emptyMessage())}</div>`;
  }

  function openModal(title, content, noLabel, okLabel, onConfirm) {
    $('#mt').textContent = title;
    $('#mx').innerHTML = content;
    $('#m-no span').textContent = noLabel || '';
    $('#m-no').hidden = !noLabel;
    $('#m-ok span').textContent = okLabel || 'OK';
    $('#m-ok').disabled = false;
    $('#m-ok').classList.toggle('ut-c-r', okLabel === 'HAPUS');   /* hapus = merah, konfirmasi = hijau */
    $('#m-ok').classList.toggle('ut-c-g', okLabel !== 'HAPUS');
    $('#m-no').classList.toggle('ut-c-d', okLabel === 'HAPUS');   /* BATAL netral bila tombol aksinya sudah merah */
    $('#m-no').classList.toggle('ut-c-r', okLabel !== 'HAPUS');
    modalAction = onConfirm || null;
    $('#md').classList.add('on');
    const input = $('#mx input');
    if (input) requestAnimationFrame(() => input.focus());
  }

  function closeModal() {
    $('#md').classList.remove('on');
    modalAction = null;
  }

  const ERROR_MESSAGES = {
    USER_NOT_FOUND: 'Username tidak ditemukan.',
    CANNOT_ADD_SELF: 'Tidak bisa menambah diri sendiri.',
    ALREADY_FRIENDS: 'Kalian sudah berteman.',
    REQUEST_NOT_FOUND: 'Permintaan tidak ditemukan.'
  };
  const errorMessage = error => ERROR_MESSAGES[error && error.message] || 'Gagal. Periksa koneksi.';
  const myName = async () => (await RS().ensurePlayer()).name;

  async function loadStats() {
    if (!authed || !RS() || !RS().getLeaderboard || statsInFlight) return statsInFlight;
    statsInFlight = withTimeout(RS().getLeaderboard('friends', 100), LOAD_TIMEOUT, 'statistik').then(rows => {
      if (!Array.isArray(rows)) throw new Error('BAD_LEADERBOARD_RESPONSE');
      Object.keys(friendStats).forEach(id => delete friendStats[id]);
      rows.forEach(row => {
        const id = String(row.uid || '').toLowerCase();
        if (id) friendStats[id] = { pos: row.pos, lvl: row.lvl, wins: row.wins };
      });
      render();
    }).catch(error => {
      console.warn('[friendship] gagal memuat statistik teman', error);
    }).finally(() => {
      statsInFlight = null;
    });
    return statsInFlight;
  }

  function addFriend() {
    openModal(
      'Tambah Teman',
      `Masukkan username pemain yang ingin kamu tambahkan.<input class="field" id="friendName" type="text" maxlength="24" placeholder="Username teman" autocomplete="off">`,
      'BATAL',
      'KIRIM',
      async () => {
        const username = $('#friendName').value.trim();
        if (!username) {
          toast('Masukkan username dulu.');
          return false;
        }
        try {
          const result = await RS().sendFriendRequest({ username, myName: await myName() });
          toast(result === 'accepted' ? 'Kalian sekarang berteman!' : 'Permintaan teman dikirim!');
          load();
          return true;
        } catch (error) {
          toast(errorMessage(error));
          return false;
        }
      }
    );
  }

  async function loadAppearance() {
    if (appearanceInFlight) return appearanceInFlight;
    const ids = [...friends.map(friend => friend.friend_id), ...requests.map(request => request.from_id)]
      .filter(Boolean)
      .map(String)
      .filter(id => !appearanceById[id.toLowerCase()]);
    if (!ids.length) return;
    const service = window.UT.AppearanceService && window.UT.AppearanceService.get();
    if (!service) return;
    appearanceInFlight = withTimeout(service.usersAppearance(ids), LOAD_TIMEOUT, 'avatar').then(result => {
      if (!result || !result.ok) {
        console.warn('[friendship] tampilan avatar tidak dapat dimuat', result && result.reason);
        return;
      }
      Object.assign(appearanceById, result.byId || {});
      render();
    }).catch(error => {
      console.warn('[friendship] gagal memuat tampilan avatar', error);
    }).finally(() => {
      appearanceInFlight = null;
    });
    return appearanceInFlight;
  }

  async function loadData() {
    try {
      /* Presence hanya pelengkap (status online). Jangan biarkan ia menahan daftar teman. */
      await withTimeout(ready, PRESENCE_WAIT, 'presence').catch(error => {
        console.warn('[friendship] presence lambat, daftar teman tetap dimuat', error);
      });
      const client = await withTimeout(UT.Multiplayer.getClient(), LOAD_TIMEOUT, 'getClient');
      const { data, error } = await withTimeout(client.auth.getSession(), LOAD_TIMEOUT, 'getSession');
      if (error) throw error;
      if (env.disposed) return;
      authed = !!data.session;
      if (!authed) {
        friends = [];
        requests = [];
        loadError = '';
        loaded = true;
        render();
        return;
      }
      const [friendRows, requestRows] = await withTimeout(
        Promise.all([RS().listFriends(), RS().listRequests()]), LOAD_TIMEOUT, 'daftar teman');
      friends = Array.isArray(friendRows) ? friendRows : [];
      requests = Array.isArray(requestRows) ? requestRows : [];
      loadError = '';
      loaded = true;
      clearTimeout(retryTimer);
      render();
      loadStats();
      loadAppearance();
      loadGifts();
    } catch (error) {
      console.warn('[friendship] gagal memuat teman', error);
      loadError = 'Teman tidak dapat dimuat. Mencoba lagi...';
      loaded = true;
      render();
      /* coba lagi otomatis; pada pemuatan pertama authed masih null sehingga interval 20 dtk tidak jalan */
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (!document.hidden) load(); }, 5000);
    }
  }

  function load() {
    if (loadInFlight) return loadInFlight;
    loadInFlight = loadData().finally(() => {
      loadInFlight = null;
    });
    return loadInFlight;
  }

  const ready = import('../multiplayer/presence.js').then(async () => {
    if (!PR()) throw new Error('Presence tidak tersedia.');
    await PR().start({ status: 'lobby', requireSession: true });
    if (env.disposed) return;
    env.own(PR().onChange(render));   /* Presence global tetap hidup (lobby/room memakainya); hanya langganan halaman ini dilepas */
  }).catch(error => {
    console.warn('[friendship] presence gagal dimulai', error);
  });

  $('#q').addEventListener('input', event => {
    query = event.target.value.trim();
    render();
  });
  $('#tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    render();
  });
  $('#add').addEventListener('click', addFriend);
  $('#back').addEventListener('click', () => nav('lobby.html'));
  /* #home sudah tidak ada di friendship.html (dihapus saat redesain): dulu memasang pendengar langsung pada elemen null melempar TypeError sehingga semua pendengar & load() di bawahnya tidak pernah jalan */
  const homeBtn = $('#home'); if (homeBtn) homeBtn.addEventListener('click', () => nav('lobby.html'));
  $('#cur-em').addEventListener('click', () => nav('tambang.html?from=friendship.html'));
  $('#cur-co').addEventListener('click', () => nav('shop.html?coin=1'));
  $('#md').addEventListener('click', event => {
    if (event.target === $('#md')) closeModal();
  });
  $('#m-no').addEventListener('click', closeModal);
  $('#m-ok').addEventListener('click', async () => {
    if (!modalAction) {
      closeModal();
      return;
    }
    $('#m-ok').disabled = true;
    try {
      if (await modalAction()) closeModal();
    } catch (error) {
      console.error('[friendship] aksi dialog gagal', error);
      toast(errorMessage(error));
    } finally {
      if ($('#md').classList.contains('on')) $('#m-ok').disabled = false;
    }
  });
  env.on(document, 'keydown', event => {
    if (event.key === 'Escape' && $('#md').classList.contains('on')) closeModal();
  });

  $('#list').addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('.fc');
    const id = card && card.dataset.id;
    if (!id) return;
    const friend = [...viewFriends(), ...viewRequests()].find(row => row.id === id);
    if (!friend) return;
    const action = button.dataset.action;

    if (action === 'gift') { sendGift(id, friend.name); return; }
    if (action === 'invite') {
      nav(`room.html?mode=online&format=solo&count=4&invite=${encodeURIComponent(id)}`);
      return;
    }
    if (action === 'remove') {
      openModal('Hapus Teman', `Hapus ${escapeHtml(friend.name)} dari daftar teman?`, 'BATAL', 'HAPUS', async () => {
        try {
          await RS().removeFriend(id);
          toast('Teman dihapus.');
          load();
          return true;
        } catch (error) {
          toast(errorMessage(error));
          return false;
        }
      });
      return;
    }
    if (action === 'accept' || action === 'decline') {
      try {
        if (action === 'accept') {
          await RS().acceptFriendRequest(id, await myName());
          filter = 'online';
          toast(`${friend.name} sekarang menjadi teman!`);
        } else {
          await RS().declineFriendRequest(id);
          toast('Permintaan ditolak.');
        }
        await load();
      } catch (error) {
        toast(errorMessage(error));
      }
    }
  });

  renderCurrency();
  if (PD.subscribe) env.own(PD.subscribe(renderCurrency));
  env.own(UT.Events.on('currencyChanged', renderCurrency));
  if (PD.serverMode && PD.serverMode() && UT.WalletService && UT.LiveSync) {
    const wallet = WS();
    if (wallet) {
      UT.LiveSync.add('wallet', async () => {
        const result = await wallet.refresh();
        if (!result.ok && result.reason !== 'mode-lokal') console.warn('[friendship] gagal memperbarui saldo', result);
        return result;
      });
      UT.LiveSync.start({ interval: 20000, immediate: true });
      /* LiveSync bersifat global: lepas tugas halaman ini dan hentikan saat keluar (halaman berikut memulai ulang sendiri) */
      env.own(() => { UT.LiveSync.remove('wallet'); UT.LiveSync.stop(); });
    }
  }

  env.on(document, 'visibilitychange', () => {
    if (!document.hidden) load();
  });
  setInterval(() => {
    if (!document.hidden && authed !== false) load();
  }, 20000);
  load();
});
