/* RoomFlow di shell SPA: navigate/launch/exitGame lewat UT.Spa.go (shell tidak ditinggalkan); tanpa UT.Spa (mandiri / di iframe) tetap location.href. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'src/multiplayer/room-flow.js'), 'utf8');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }

function load(withSpa) {
  const calls = [], store = {};
  const loc = { href: 'about:start' };
  const sb = {
    UT: { Prefs: { get: (k, d) => d, set() {} } },
    ItemCatalog: { items: [{ kind: 'theme', gameKey: 'minecraft', id: 't1' }, { kind: 'skin', gameKey: 'steve' }], byId: () => null },
    PlayerData: { equippedId: () => null },
    CustomEvent, URLSearchParams, Object, JSON,
    sessionStorage: { setItem: (k, v) => { store[k] = v; }, getItem: k => (k in store ? store[k] : null) },
    location: loc
  };
  sb.window = sb; sb.dispatchEvent = () => true;
  if (withSpa) sb.UT.Spa = { go: u => { calls.push(u); return Promise.resolve(true); } };
  vm.runInNewContext(src, sb);
  return { RF: sb.UT.RoomFlow, calls, loc, store };
}

(async () => {
  await t('navigate room/back/mode lewat UT.Spa.go; location.href tidak berubah', () => {
    const { RF, calls, loc } = load(true);
    RF.navigate('room', { mode: 'vsc', format: 'solo', count: 2 });
    RF.navigate('back');
    RF.navigate('mode');
    assert.deepStrictEqual(calls, ['room.html?mode=vsc&format=solo&count=2', 'lobby.html', 'mode.html']);
    assert.strictEqual(loc.href, 'about:start');
  });
  await t('navigate room membawa role & code (guest online)', () => {
    const { RF, calls } = load(true);
    RF.navigate('room', { mode: 'online', format: 'team', count: 4, role: 'guest', code: 'ABC123' });
    assert.strictEqual(calls[0], 'room.html?mode=online&format=team&count=4&role=guest&code=ABC123');
  });
  await t('launch: gameplay lewat UT.Spa.go, ut:nav-heavy disetel SEBELUM pindah, konfigurasi tersimpan', () => {
    const { RF, calls, loc, store } = load(true);
    RF.launch({ type: 'ranked', mode: 'online', format: 'solo', count: 2, players: [{ name: 'A' }, { name: 'B' }] });
    assert.strictEqual(calls.length, 1);
    assert(/^gameplay\.html\?mode=2&skins=/.test(calls[0]), calls[0]);
    assert.strictEqual(store['ut:nav-heavy'], '1');
    assert(store['ut-room'] && store['ut-config']);
    assert.strictEqual(loc.href, 'about:start');
  });
  await t('hati: launch lewat UT.HeartsGate.spend - habis = tidak pindah & tidak menyimpan config; ok = pindah seperti biasa', async () => {
    const cfg = { type: 'ranked', mode: 'online', format: 'solo', count: 2, players: [{ name: 'A' }, { name: 'B' }] };
    function loadGate(ok) {
      let spent = 0;
      // gerbang dipasang di sandbox yang sama dengan RoomFlow: muat ulang dengan UT.HeartsGate
      const calls = [], store = {}, loc = { href: 'about:start' };
      const sb = { UT: { Prefs: { get: (k, d) => d, set() {} }, HeartsGate: { spend: () => { spent++; return Promise.resolve(ok); } }, Spa: { go: u => { calls.push(u); return Promise.resolve(true); } } },
        ItemCatalog: { items: [{ kind: 'theme', gameKey: 'minecraft', id: 't1' }, { kind: 'skin', gameKey: 'steve' }], byId: () => null }, PlayerData: { equippedId: () => null },
        CustomEvent, URLSearchParams, Object, JSON, Promise, sessionStorage: { setItem: (k, v) => { store[k] = v; }, getItem: k => (k in store ? store[k] : null) }, location: loc };
      sb.window = sb; sb.dispatchEvent = () => true; vm.runInNewContext(src, sb);
      return { RF: sb.UT.RoomFlow, calls, store, spent: () => spent };
    }
    const blocked = loadGate(false);
    assert.strictEqual(await blocked.RF.launch(cfg), false);
    assert.strictEqual(blocked.spent(), 1); assert.strictEqual(blocked.calls.length, 0); assert.strictEqual(blocked.store['ut-room'], undefined);
    const allowed = loadGate(true);
    assert.strictEqual(await allowed.RF.launch(cfg), true);
    assert.strictEqual(allowed.spent(), 1); assert.strictEqual(allowed.calls.length, 1);
    assert(/^gameplay\.html\?mode=2&skins=/.test(allowed.calls[0]), allowed.calls[0]); assert(allowed.store['ut-room']);
    // tanpa gerbang (tamu/halaman tanpa skrip hati): tetap langsung dan sinkron
    const plain = load(true); assert.strictEqual(plain.RF.launch(cfg), true); assert.strictEqual(plain.calls.length, 1);
  });
  await t('exitGame kembali ke mode.html (Quick Start) lewat UT.Spa.go', () => {
    const { RF, calls, store } = load(true);
    store['ut-room'] = JSON.stringify({ type: 'ranked', mode: 'online', format: 'solo', count: 2 });
    RF.exitGame();
    assert.deepStrictEqual(calls, ['mode.html']);
  });
  await t('tanpa UT.Spa (halaman mandiri / iframe): location.href seperti semula', () => {
    const a = load(false);
    a.RF.navigate('room', { mode: 'local', format: 'solo', count: 3 });
    assert.strictEqual(a.loc.href, 'room.html?mode=local&format=solo&count=3');
    a.RF.navigate('back'); assert.strictEqual(a.loc.href, 'lobby.html');
    a.RF.navigate('mode'); assert.strictEqual(a.loc.href, 'mode.html');
    a.RF.launch({ type: 'ranked', mode: 'online', format: 'solo', count: 2, players: [{}, {}] });
    assert(/^gameplay\.html\?/.test(a.loc.href));
  });
  await t('UT.Spa tanpa go (objek setengah jadi) tetap jatuh ke location.href', () => {
    const a = load(false); a.RF.navigate('back'); assert.strictEqual(a.loc.href, 'lobby.html');
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });

