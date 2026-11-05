// Jalankan: node --test tests/multiplayer/
const test = require('node:test');
const assert = require('node:assert/strict');
const EventLog = require('../../game/assets/js/multiplayer/event-log.js');

const FAST = { GAP_WAIT_MS: 5, RETRY_BASE_MS: 2, RETRY_MAX_MS: 10, RETRY_MAX_ATTEMPTS: 4 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Server palsu: seq atomik, idempoten per (player, clientEventId), fan-out ke subscriber.
function makeServer() {
  const events = [], subs = new Set(), seen = new Map();
  const server = {
    events,
    insert(player, type, payload, cid) {
      const key = player + ':' + cid;
      if (cid && seen.has(key)) return seen.get(key);
      const row = { seq: events.length + 1, player_id: player, type, payload, client_event_id: cid };
      events.push(row); if (cid) seen.set(key, row);
      subs.forEach(s => s.deliver(row));
      return row;
    },
    transport(player) {
      const state = { failNext: 0, dropDelivery: false, permanent: false, submits: [] };
      return {
        state,
        submit: async (room, type, payload, cid) => {
          state.submits.push(cid);
          if (state.failNext > 0) { state.failNext--; throw new Error('network down'); }
          if (state.permanent) throw new Error('ROOM_ACCESS_DENIED');
          return server.insert(player, type, payload, cid);
        },
        fetchAfter: async (room, after, limit) => events.filter(e => e.seq > after).slice(0, limit),
        subscribe: (room, onRow, onStatus) => {
          const sub = { deliver: row => { if (!state.dropDelivery) onRow(row); } };
          subs.add(sub); state.onStatus = onStatus;
          setTimeout(() => onStatus && onStatus('SUBSCRIBED'), 0);
          return () => subs.delete(sub);
        }
      };
    }
  };
  return server;
}
function client(server, player, extra = {}) {
  const got = [], errors = [];
  const transport = server.transport(player);
  const log = EventLog.create(Object.assign({
    roomId: 'r1', transport, constants: FAST, onEvent: r => got.push(r.seq), onError: e => errors.push(e)
  }, extra));
  return { log, got, errors, transport };
}

test('dua klien memutar urutan identik dan pengirim juga memutar lewat log', async () => {
  const s = makeServer(), a = client(s, 'A'), b = client(s, 'B');
  await a.log.start(); await b.log.start();
  await Promise.all([a.log.submit('roll', { v: 1 }), b.log.submit('roll', { v: 2 }), a.log.submit('move', { to: 3 })]);
  await sleep(20);
  assert.deepEqual(a.got, [1, 2, 3]);
  assert.deepEqual(b.got, [1, 2, 3]);
});

test('event datang tidak berurutan: ditahan lalu diputar berurutan', async () => {
  const s = makeServer(), a = client(s, 'A', { transport: { submit() {}, fetchAfter: async () => [], subscribe: () => () => {} } });
  [3, 1, 2].forEach(n => a.log.receive({ seq: n }));
  assert.deepEqual(a.got, [1, 2, 3]);
  assert.equal(a.log.pendingCount(), 0);
});

test('duplikat diabaikan', async () => {
  const s = makeServer(), a = client(s, 'A');
  [1, 1, 2, 2, 1, 3].forEach(n => a.log.receive({ seq: n }));
  assert.deepEqual(a.got, [1, 2, 3]);
});

test('gap memicu backfill dari server', async () => {
  const s = makeServer(), a = client(s, 'A'), b = client(s, 'B');
  await a.log.start(); await b.log.start();
  b.transport.state.dropDelivery = true;           // B kehilangan broadcast
  await a.log.submit('sfx', {}); await a.log.submit('sfx', {}); await a.log.submit('sfx', {});
  b.transport.state.dropDelivery = false;
  await a.log.submit('sfx', {});                   // event 4 sampai ke B -> gap (1-3 hilang)
  await sleep(40);
  assert.deepEqual(b.got, [1, 2, 3, 4]);
});

test('reconnect (SUBSCRIBED lagi) mengejar event yang terlewat', async () => {
  const s = makeServer(), a = client(s, 'A'), b = client(s, 'B');
  await a.log.start(); await b.log.start();
  b.transport.state.dropDelivery = true;
  await a.log.submit('toast', {}); await a.log.submit('toast', {});
  b.transport.state.dropDelivery = false;
  b.transport.state.onStatus('SUBSCRIBED');
  await sleep(20);
  assert.deepEqual(b.got, [1, 2]);
});

test('backfill besar dipaging sampai habis', async () => {
  const s = makeServer();
  for (let i = 0; i < 25; i++) s.insert('X', 'sfx', {}, null);
  const c = client(s, 'A', { constants: Object.assign({}, FAST, { BACKFILL_LIMIT: 10 }) });
  await c.log.start();
  assert.equal(c.got.length, 25);
  assert.deepEqual(c.got, Array.from({ length: 25 }, (_, i) => i + 1));
});

test('kirim gagal sementara: retry dengan clientEventId yang sama, tanpa duplikat event', async () => {
  const s = makeServer(), a = client(s, 'A');
  await a.log.start();
  a.transport.state.failNext = 2;
  const row = await a.log.submit('roll', { v: 5 });
  assert.equal(row.seq, 1);
  assert.equal(s.events.length, 1);
  const ids = a.transport.state.submits;
  assert.equal(ids.length, 3);
  assert.ok(ids.every(x => x === ids[0]));
});

test('retry setelah respons hilang tidak menggandakan event (idempoten server)', async () => {
  const s = makeServer(), a = client(s, 'A');
  await a.log.start();
  const t = a.transport, orig = t.submit; let first = true;
  t.submit = async (...args) => { const r = await orig(...args); if (first) { first = false; throw new Error('timeout setelah tersimpan'); } return r; };
  const row = await a.log.submit('move', { to: 9 });
  assert.equal(s.events.length, 1);
  assert.equal(row.seq, 1);
});

test('error permanen tidak di-retry dan ditolak', async () => {
  const s = makeServer(), a = client(s, 'A');
  a.transport.state.permanent = true;
  await assert.rejects(a.log.submit('roll', {}), /ROOM_ACCESS_DENIED/);
  assert.equal(a.transport.state.submits.length, 1);
});

test('retry habis: promise ditolak setelah batas percobaan', async () => {
  const s = makeServer(), a = client(s, 'A');
  a.transport.state.failNext = 99;
  await assert.rejects(a.log.submit('roll', {}), /network down/);
  assert.equal(a.transport.state.submits.length, 4);
});

test('urutan kirim satu klien terjaga walau item pertama perlu retry', async () => {
  const s = makeServer(), a = client(s, 'A');
  await a.log.start();
  a.transport.state.failNext = 1;
  const p1 = a.log.submit('roll', { n: 1 }), p2 = a.log.submit('move', { n: 2 });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.ok(r1.seq < r2.seq);
  assert.deepEqual(s.events.map(e => e.payload.n), [1, 2]);
});

test('handler onEvent yang melempar error tidak memutus log', async () => {
  const s = makeServer(), errors = [], got = [];
  const t = s.transport('A');
  const log = EventLog.create({ roomId: 'r1', transport: t, constants: FAST,
    onEvent: r => { got.push(r.seq); if (r.seq === 2) throw new Error('boom'); }, onError: e => errors.push(e) });
  [1, 2, 3].forEach(n => log.receive({ seq: n }));
  assert.deepEqual(got, [1, 2, 3]);
  assert.equal(errors.length, 1);
});

test('stop menghentikan pemutaran dan menolak antrean kirim', async () => {
  const s = makeServer(), a = client(s, 'A');
  await a.log.start();
  a.log.stop();
  a.log.receive({ seq: 1 });
  assert.deepEqual(a.got, []);
});

test('konstanta Totem 15 detik', () => {
  assert.equal(EventLog.CONSTANTS.TOTEM_TIMEOUT_MS, 15000);
});
