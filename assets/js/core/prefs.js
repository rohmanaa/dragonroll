/* UT.Prefs — SATU tempat untuk preferensi pemain (suara, kamera, auto-roll, siang/malam, map room, power room, cermin ambience).
   Tahap 2 penghapusan localStorage: menggantikan sepuluh key terpisah (ut-musicvol, ut-musicon, ut-sfxvol, ut-auto, ut-malam,
   ut-autoroll, ut-cam, ut-room-map, ut-room-powers:v1, ut-ambience) dengan SATU objek di localStorage["ut:prefs:v1"].

   API (sinkron, aman dipanggil sebelum DOM siap):
     UT.Prefs.get(nama, bawaan)   -> nilai tersimpan, atau `bawaan` bila belum ada
     UT.Prefs.set(nama, nilai)    -> simpan; nilai undefined/null menghapus nama itu
     UT.Prefs.all()               -> salinan seluruh objek
     UT.Prefs.on(fn)              -> fn(nama, nilai) tiap set(); mengembalikan fungsi untuk berhenti
     UT.Prefs.setBackend(b)       -> b = { load():objek|null, save(objek) } : tempat memasang penyimpanan server nanti.
                                     Bila backend dipasang, localStorage TIDAK dipakai lagi (hanya cadangan memori).

   Dibaca ulang dari penyimpanan pada setiap get(), jadi play.html (pembungkus) dan iframe gameplay.html tidak saling basi.
   MIGRASI: tiap muat, key lama yang masih ada diimpor ke objek (nilai yang sudah ada di objek TIDAK ditimpa), lalu key lama dihapus. */
(function (g) {
  'use strict';
  var UT = g.UT = g.UT || {};
  if (UT.Prefs) return;
  var KEY = 'ut:prefs:v1';

  /* nama baru -> [key lama, pembaca nilai lama]. Pembaca mengembalikan undefined bila nilai lama tidak valid. */
  function num(s) { var n = parseInt(s, 10); return isFinite(n) ? n : undefined; }
  function json(s) { try { var o = JSON.parse(s); return (o && typeof o === 'object') ? o : undefined; } catch (e) { return undefined; } }
  var LEGACY = {
    musicVol:   ['ut-musicvol', num],
    musicOn:    ['ut-musicon', function (s) { return s !== '0'; }],
    sfxVol:     ['ut-sfxvol', num],
    autoDN:     ['ut-auto', function (s) { return s === '1'; }],
    night:      ['ut-malam', function (s) { return s === '1'; }],
    autoRoll:   ['ut-autoroll', function (s) { return s === '1'; }],
    cam:        ['ut-cam', json],
    roomMap:    ['ut-room-map', function (s) { return s || undefined; }],
    roomPowers: ['ut-room-powers:v1', json],
    ambience:   ['ut-ambience', json]
  };

  var backend = null, mem = {}, subs = [];

  function ls() { try { return g.localStorage || null; } catch (e) { return null; } }
  function readStore() {
    if (backend) { try { var b = backend.load(); return (b && typeof b === 'object') ? b : mem; } catch (e) { return mem; } }
    var s = ls();
    if (!s) return mem;
    try { return json(s.getItem(KEY)) || {}; } catch (e) { return mem; }
  }
  function writeStore(o) {
    mem = o;
    if (backend) { try { backend.save(o); } catch (e) {} return; }
    var s = ls();
    if (!s) return;
    try { s.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }

  /* impor key lama (idempoten). Hanya menyentuh localStorage; dilewati bila backend dipasang. */
  function migrate() {
    var s = ls(); if (!s || backend) return;
    var o = null, changed = false;
    Object.keys(LEGACY).forEach(function (name) {
      var key = LEGACY[name][0], raw = null;
      try { raw = s.getItem(key); } catch (e) { return; }
      if (raw === null) return;
      if (o === null) o = readStore();
      if (!(name in o)) { var v = LEGACY[name][1](raw); if (v !== undefined) { o[name] = v; changed = true; } }
      try { s.removeItem(key); } catch (e) {}
    });
    if (changed) writeStore(o);
  }

  UT.Prefs = {
    get: function (name, def) {
      var o = readStore();
      return (name in o && o[name] !== undefined && o[name] !== null) ? o[name] : def;
    },
    set: function (name, value) {
      var o = Object.assign({}, readStore());
      if (value === undefined || value === null) delete o[name]; else o[name] = value;
      writeStore(o);
      subs.slice().forEach(function (fn) { try { fn(name, value); } catch (e) {} });
      return true;
    },
    all: function () { return JSON.parse(JSON.stringify(readStore())); },
    on: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; },
    setBackend: function (b) { backend = (b && typeof b.load === 'function' && typeof b.save === 'function') ? b : null; },
    _migrate: migrate, KEY: KEY, LEGACY_KEYS: Object.keys(LEGACY).map(function (k) { return LEGACY[k][0]; })
  };
  migrate();
})(typeof window !== 'undefined' ? window : this);
