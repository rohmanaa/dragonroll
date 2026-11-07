/* Ular Tangga Blok — assets/js/room-flow.js
   Jembatan Mode Selection -> Game Room -> Gameplay. Skrip klasik; butuh item-catalog.js + player-data.js.
   Parameter room (sama dengan prototipe): room.html?mode=vsc|local|online&format=solo|team&count=2..4[&role=guest&code=XXXX]
   Hook (CustomEvent di window; panggil preventDefault() untuk mengambil alih router/engine):
     game:navigate  detail {to:'back'|'home'|'mode'|'room', ...params}
     game:start     detail = konfigurasi pertandingan (lihat launch()) */
(function (g) {
  'use strict';
  var UT = g.UT = g.UT || {}, IC = g.ItemCatalog, PD = g.PlayerData;
  var CFG_KEY = 'ut-config', ROOM_KEY = 'ut-room';
  var MODES = ['vsc', 'local', 'online'];

  function maps() { return IC.items.filter(function (i) { return i.kind === 'theme'; }); }   /* Map bukan item milik/dibeli: semua map bisa dimainkan siapa saja */
  function getMap() {
    var k = null, m = maps();
    try { k = UT.Prefs.get('roomMap', null); } catch (e) {}
    return m.filter(function (x) { return x.gameKey === k; })[0] ||
           m.filter(function (x) { return x.id === PD.equippedId('theme'); })[0] || m[0] || null;
  }
  function setMap(gameKey) { try { UT.Prefs.set('roomMap', gameKey); } catch (e) {} }

  /* skin tiap pemain: skin sendiri di urutan pertama, sisanya skin lain (gameplay butuh n skin) */
  function skinKeys(n, mine) {
    var all = IC.items.filter(function (i) { return i.kind === 'skin'; }).map(function (i) { return i.gameKey; });
    var out = [mine];
    all.forEach(function (k) { if (out.length < n && out.indexOf(k) < 0) out.push(k); });
    return out.slice(0, n);
  }
  function gameMode(cfg) {
    var n = Math.min(4, Math.max(2, cfg.players.length || cfg.count || 2));
    return (cfg.mode === 'vsc' && n === 2) ? 'cpu' : String(n);   /* gameplay: bot hanya 1v1 (Villager) */
  }
  function eqKey(slot) { var it = IC.byId(PD.equippedId(slot)); return it ? it.gameKey : null; }

  function navigate(to, detail) {
    var d = Object.assign({ to: to }, detail || {});
    var ev = new CustomEvent('game:navigate', { detail: d, cancelable: true });
    if (!g.dispatchEvent(ev)) return;
    if (to === 'room') {
      var q = new URLSearchParams({ mode: d.mode, format: d.format || 'solo', count: d.count || 4 });
      if (d.role) q.set('role', d.role); if (d.code) q.set('code', d.code);
      location.href = 'room.html?' + q.toString();
    } else if (to === 'mode') location.href = 'mode.html';
    else location.href = 'lobby.html';   /* back & home */
  }

  /* cfg: {type:'ranked'|'room', mode, format, privacy, host, code, players:[{name,team,kind}], powers:[id], skin, frame, dice, map} */
  function launch(cfg) {
    cfg = Object.assign({ map: (getMap() || {}).gameKey }, cfg);
    var ev = new CustomEvent('game:start', { detail: cfg, cancelable: true });
    if (!g.dispatchEvent(ev)) return;
    var mode = gameMode(cfg), online = cfg.mode === 'online', mine = online ? (cfg.skin || 'steve') : (cfg.skin || eqKey('skin') || 'steve');
    var skins = skinKeys(mode === 'cpu' ? 1 : +mode, mine), dice = online ? (cfg.dice || 'klasik') : (cfg.dice || eqKey('dice'));
    var p = new URLSearchParams({ mode: mode, skins: skins.join(',') });
    if (cfg.map) p.set('theme', cfg.map);
    if (dice) p.set('dice', dice);
    try { sessionStorage.setItem(CFG_KEY, JSON.stringify({ mode: mode, skins: skins, theme: cfg.map, dice: dice })); } catch (e) {}
    try { sessionStorage.setItem(ROOM_KEY, JSON.stringify(cfg)); } catch (e) {}   /* konfigurasi lengkap (tim, power, frame, host) untuk gameplay */
    location.href = 'gameplay.html?' + p.toString();
  }
  /* Tujuan setelah keluar gameplay, sesuai cara pemain masuk tadi:
     - type 'room' (VS Computer / Multi Player / Create Room) -> room.html dengan parameter yang sama
     - type 'ranked' (Quick Start solo) -> mode.html (area Quick Start)
     - tidak ada data -> lobby.html */
  function returnUrl() {
    var c = lastRoom();
    if (!c) return 'lobby.html';
    if (c.type === 'ranked') return 'mode.html';
    if (c.type === 'room' && MODES.indexOf(c.mode) >= 0) {
      var q = new URLSearchParams({ mode: c.mode, format: c.format || 'solo', count: (c.players && c.players.length) || c.count || 4 });
      if (c.mode === 'online' && c.host === false) { q.set('role', 'guest'); if (c.code) q.set('code', c.code); }
      return 'room.html?' + q.toString();
    }
    return 'lobby.html';
  }
  function exitGame() {
    var to = returnUrl();
    var ev = new CustomEvent('game:navigate', { detail: { to: 'exit', url: to }, cancelable: true });
    if (!g.dispatchEvent(ev)) return;
    location.href = to;
  }
  function lastRoom() { try { return JSON.parse(sessionStorage.getItem(ROOM_KEY) || 'null'); } catch (e) { return null; } }

  UT.RoomFlow = { MODES: MODES, maps: maps, getMap: getMap, setMap: setMap, navigate: navigate, launch: launch, lastRoom: lastRoom, returnUrl: returnUrl, exitGame: exitGame, gameMode: gameMode };
})(window);
