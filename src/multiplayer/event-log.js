// Langkah 2: klien event log multiplayer (classic script, tanpa ES module).
// Semua aksi lewat submit(); semua klien (termasuk pengirim) memutar log yang sama dengan urutan seq yang sama.
// Transport bersifat pluggable agar bisa diuji tanpa Supabase. Tidak mengubah gameplay: modul ini belum dipasang ke gameplay.html (Langkah 3).
(function (root) {
  'use strict';

  var CONSTANTS = {
    TOTEM_TIMEOUT_MS: 15000,       // keputusan: Totem otomatis terpakai bila tidak ada keputusan 15 detik (belum dipakai di langkah ini)
    GAP_WAIT_MS: 400,              // tunggu event yang tertahan sebelum minta backfill
    BACKFILL_LIMIT: 200,
    RETRY_BASE_MS: 300,
    RETRY_MAX_MS: 5000,
    RETRY_MAX_ATTEMPTS: 8
  };

  // Error yang tidak berguna di-retry (kirim ulang tidak akan mengubah hasil).
  var PERMANENT_ERRORS = ['AUTH_REQUIRED', 'ROOM_ACCESS_DENIED', 'INVALID_EVENT_TYPE', 'INVALID_PAYLOAD',
    'PAYLOAD_TOO_LARGE', 'PRIVATE_FIELD_NOT_ALLOWED', 'ROOM_NOT_PLAYING'];

  function errText(e) { return String((e && (e.message || e.code)) || e || ''); }
  function isPermanent(e) {
    var t = errText(e);
    for (var i = 0; i < PERMANENT_ERRORS.length; i++) if (t.indexOf(PERMANENT_ERRORS[i]) !== -1) return true;
    return false;
  }
  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  // options: { roomId, transport, onEvent(row), startSeq?, selfId?, onError?, timers?: {set,clear}, constants? }
  // transport: { submit(roomId,type,payload,clientEventId)->Promise<row>,
  //              fetchAfter(roomId,afterSeq,limit)->Promise<row[]>,
  //              subscribe(roomId,onRow,onStatus)->unsubscribe }   (onStatus('SUBSCRIBED'|'CLOSED'|'ERROR'))
  function createEventLog(options) {
    var C = Object.assign({}, CONSTANTS, options.constants || {});
    var setT = (options.timers && options.timers.set) || function (f, ms) { return setTimeout(f, ms); };
    var clearT = (options.timers && options.timers.clear) || function (h) { clearTimeout(h); };
    var roomId = options.roomId, transport = options.transport;
    var lastSeq = Number(options.startSeq) || 0;
    var pending = {};            // seq -> row (tertahan karena ada gap)
    var gapTimer = null, backfilling = false, rerun = false, stopped = false, unsub = null;
    var queue = [], sending = false;   // antrean kirim, berurutan per klien

    function report(e, where) { try { if (options.onError) options.onError(e, where); } catch (_) {} }

    function apply(row) {
      lastSeq = row.seq;
      try { options.onEvent(row); } catch (e) { report(e, 'onEvent'); } // handler yang error tidak boleh memutus log
    }
    function drain() {
      while (pending[lastSeq + 1]) { var r = pending[lastSeq + 1]; delete pending[lastSeq + 1]; apply(r); }
      var keys = Object.keys(pending);
      for (var i = 0; i < keys.length; i++) if (Number(keys[i]) <= lastSeq) delete pending[keys[i]];
      if (!Object.keys(pending).length && gapTimer) { clearT(gapTimer); gapTimer = null; }
    }
    function scheduleGapBackfill() {
      if (gapTimer || stopped) return;
      gapTimer = setT(function () { gapTimer = null; backfill(); }, C.GAP_WAIT_MS);
    }
    function receive(row) {
      if (stopped || !row || typeof row.seq !== 'number') return;
      if (row.seq <= lastSeq) return;                 // duplikat / sudah diputar
      if (row.seq === lastSeq + 1) { apply(row); drain(); return; }
      pending[row.seq] = row;                          // ada gap: tahan, minta backfill bila tidak segera terisi
      scheduleGapBackfill();
    }
    function backfill() {
      if (stopped) return Promise.resolve();
      if (backfilling) { rerun = true; return Promise.resolve(); }
      backfilling = true;
      var loop = function () {
        return transport.fetchAfter(roomId, lastSeq, C.BACKFILL_LIMIT).then(function (rows) {
          rows = (rows || []).slice().sort(function (a, b) { return a.seq - b.seq; });
          for (var i = 0; i < rows.length; i++) receive(rows[i]);
          if (rows.length >= C.BACKFILL_LIMIT && !stopped) return loop();
        });
      };
      return loop().catch(function (e) { report(e, 'backfill'); scheduleGapBackfill(); })
        .then(function () { backfilling = false; if (rerun) { rerun = false; return backfill(); } });
    }

    function start() {
      unsub = transport.subscribe(roomId, receive, function (status) {
        if (status === 'SUBSCRIBED') backfill();       // awal dan setiap reconnect: kejar yang terlewat
      });
      return backfill();
    }
    function stop() {
      stopped = true;
      if (gapTimer) { clearT(gapTimer); gapTimer = null; }
      if (typeof unsub === 'function') { try { unsub(); } catch (_) {} }
      queue.forEach(function (q) { q.reject(new Error('EVENT_LOG_STOPPED')); }); queue = [];
    }

    // Kirim aksi. clientEventId dibuat sekali per aksi sehingga retry idempoten di server.
    function submit(type, payload) {
      return new Promise(function (resolve, reject) {
        queue.push({ type: type, payload: payload || {}, id: uuid(), resolve: resolve, reject: reject, attempt: 0 });
        pump();
      });
    }
    function pump() {
      if (sending || stopped || !queue.length) return;
      sending = true;
      var item = queue[0];
      transport.submit(roomId, item.type, item.payload, item.id).then(function (row) {
        queue.shift(); sending = false; item.resolve(row); pump();
      }, function (e) {
        item.attempt++;
        if (isPermanent(e) || item.attempt >= C.RETRY_MAX_ATTEMPTS) {
          queue.shift(); sending = false; item.reject(e); pump(); return;
        }
        var wait = Math.min(C.RETRY_MAX_MS, C.RETRY_BASE_MS * Math.pow(2, item.attempt - 1));
        setT(function () { sending = false; pump(); }, wait);   // item tetap di kepala antrean (urutan terjaga)
      });
    }

    return { start: start, stop: stop, submit: submit, receive: receive, backfill: backfill,
             getLastSeq: function () { return lastSeq; }, pendingCount: function () { return Object.keys(pending).length; } };
  }

  // Transport Supabase (memakai window.UT.Multiplayer.getClient dari client.js).
  function createSupabaseTransport(MP) {
    function unwrap(res) { if (res.error) throw res.error; return res.data; }
    return {
      submit: function (roomId, type, payload, clientEventId) {
        return MP.getClient().then(function (c) {
          return c.rpc('submit_game_action', { p_room_id: roomId, p_type: type, p_payload: payload, p_client_event_id: clientEventId });
        }).then(unwrap);
      },
      fetchAfter: function (roomId, afterSeq, limit) {
        return MP.getClient().then(function (c) {
          return c.from('game_events').select('*').eq('room_id', roomId).gt('seq', afterSeq).order('seq', { ascending: true }).limit(limit);
        }).then(unwrap);
      },
      subscribe: function (roomId, onRow, onStatus) {
        var channel = null, closed = false, clientRef = null;
        MP.getClient().then(function (c) {
          if (closed) return;
          clientRef = c;
          channel = c.channel('game-events:' + roomId);
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: 'room_id=eq.' + roomId },
            function (p) { if (p && p.new) onRow(p.new); });
          channel.subscribe(function (status) { if (onStatus) onStatus(status === 'SUBSCRIBED' ? 'SUBSCRIBED' : status === 'CLOSED' ? 'CLOSED' : 'ERROR'); });
        }).catch(function (e) { if (onStatus) onStatus('ERROR'); console.error('[multiplayer] event-log subscribe failed', e); });
        return function () { closed = true; if (channel && clientRef) clientRef.removeChannel(channel); };
      }
    };
  }

  var api = { create: createEventLog, createSupabaseTransport: createSupabaseTransport, CONSTANTS: CONSTANTS, isPermanentError: isPermanent };
  root.UT = root.UT || {};
  root.UT.Multiplayer = root.UT.Multiplayer || {};
  root.UT.Multiplayer.EventLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
