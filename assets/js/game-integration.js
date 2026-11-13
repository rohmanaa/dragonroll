/* Jembatan data pemain -> gameplay.html. Dimuat SEBELUM skrip game; tidak mengubah logika game.
   Tugas: pastikan konfigurasi awal (URL/sessionStorage "ut-config") hanya memakai skin, tema, dan
   dadu yang DIMILIKI pemain, dan isi default dari item yang sedang dipakai bila game dibuka langsung.
   gameplay.html membaca konfigurasi lewat readLobbyConfig(); di sini hanya URL/ut-config yang dinormalisasi. */
(function () {
  'use strict';
  var PD = window.PlayerData, IC = window.ItemCatalog;
  if (!PD || !IC) return;

  var MODES = ['cpu', '2', '3', '4'];
  function eqKey(slot) { var it = IC.byId(PD.equippedId(slot)); return it ? it.gameKey : null; }
  /* Tahap 3.2: skin PNG belum punya renderer di gameplay.html (DEFERRED — tahap integrasi gameplay).
     Hanya skin 'palette' (legacy) yang diteruskan; skin PNG yang dipakai/dimiliki jatuh ke skin cadangan,
     TANPA mengubah kepemilikan atau skin terpasang di PlayerData. */
  var FALLBACK_KEY = (IC.byId(IC.fallbackSkinId()) || {}).gameKey || 'steve';
  function playable(k) { var it = IC.byGameKey('skin', k); return !!it && (it.renderer === 'palette' || it.renderer === 'png'); } /* 4.1.14.9: PNG punya renderer 3D (gameplay/js/skin-uv.js); gagal muat -> palette Steve di gameplay */
  function eqSkinKey() { var it = IC.byId(PD.equippedId('skin')); return !it ? null : ((it.renderer === 'palette' || it.renderer === 'png') ? it.gameKey : FALLBACK_KEY); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  try {
    var q = new URLSearchParams(location.search), ss = null;
    try { ss = JSON.parse(sessionStorage.getItem('ut-config') || 'null'); } catch (e) { ss = null; }
    if (!ss || typeof ss !== 'object') ss = null;

    var roomCfg = null; try { roomCfg = JSON.parse(sessionStorage.getItem('ut-room') || 'null'); } catch (e) {}
    var onlineRoom = !!(roomCfg && roomCfg.mode === 'online');
    var mode = q.get('mode'); if (MODES.indexOf(mode) < 0) mode = ss && MODES.indexOf(ss.mode) > -1 ? ss.mode : 'cpu';
    var rawSkins = q.get('skins') !== null ? q.get('skins') : (ss && Array.isArray(ss.skins) ? ss.skins.join(',') : '');
    var skins = uniq(String(rawSkins).split(',').map(function (s) { return s.trim(); })
      .filter(function (k) { return k && (onlineRoom || PD.owns('skin.' + k)) && playable(k); }));
    var need = mode === 'cpu' ? 1 : +mode;
    var ownedSkins = onlineRoom ? [] : PD.ownedItems().filter(function (o) { return o.item.kind === 'skin' && (o.item.renderer === 'palette' || o.item.renderer === 'png'); })
      .sort(function (a, b) { return a.seq - b.seq; }).map(function (o) { return o.item.gameKey; });
    /* 4.1.14.10: Pemain 1 SELALU skin yang sedang equipped (equipped.skin). Sebelumnya 'ut-config' lama di sessionStorage
       (skins yang disimpan sesi sebelumnya) menimpa skin baru -> pemain tetap Steve walau sudah memakai PNG. */
    var eqk = onlineRoom ? null : eqSkinKey();
    if (eqk && !onlineRoom) skins = [eqk].concat(skins.filter(function (k) { return k !== eqk; }));
    /* Mode CPU: Computer BUKAN dari daftar skin lobi/sesi; karakter Computer ditentukan gameplay.html (Villager). Kirim hanya skin Player. */
    if (mode === 'cpu') {
      skins = skins.slice(0, 1);
    } else {
      if (onlineRoom) {
        IC.items.filter(function (it) { return it.kind === 'skin' && playable(it.gameKey); }).forEach(function (it) { if (skins.length < need && skins.indexOf(it.gameKey) < 0) skins.push(it.gameKey); });
      } else {
        ownedSkins.forEach(function (k) { if (skins.length < need && skins.indexOf(k) < 0) skins.push(k); });
      }
      skins = skins.slice(0, need);
    }

    var theme = (onlineRoom && roomCfg.map) || q.get('theme') || (ss && ss.theme) || '';
    if (!onlineRoom && !IC.byGameKey('theme', theme)) theme = eqKey('theme') || 'minecraft';   /* map tidak perlu dimiliki */
    var dice = (onlineRoom && roomCfg.dice) || q.get('dice') || (ss && ss.dice) || '';
    if (!onlineRoom && !PD.owns('dice.' + dice)) dice = eqKey('dice') || 'klasik';
    var night = q.get('night'); if (night !== '0' && night !== '1') night = ss && (ss.night === '0' || ss.night === '1') ? ss.night : null;

    var out = { mode: mode, skins: skins, theme: theme, dice: dice };
    if (night !== null) out.night = night;
    var np = new URLSearchParams({ mode: mode, skins: skins.join(','), theme: theme, dice: dice });
    if (night !== null) np.set('night', night);
    history.replaceState(null, '', location.pathname + '?' + np.toString());
    try { sessionStorage.setItem('ut-config', JSON.stringify(out)); } catch (e) {}
    window.__utConfig = out; /* untuk pengujian/diagnostik */
  } catch (e) { /* jangan pernah menghalangi game */ }
})();
