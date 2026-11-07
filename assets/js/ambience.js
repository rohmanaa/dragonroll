/* Ambience — suasana (siang / malam / ikuti perangkat) + level grafik, dipakai SEMUA halaman lobby.
   Sumber data: PlayerData.settings().ambience ('day'|'night'|'system') dan .graphics ('high'|'low').
   Efek: memasang atribut di <html>:  data-ambience="day|night" (hasil akhir),  data-ambience-mode="day|night|system" (pilihan),
         data-graphics="high|low".  CSS (scene-bg.css) dan scene 3D (lobby.html) bereaksi pada atribut/event ini.
   Dimuat di <head> sebelum scene-bg.js agar tidak ada kilatan siang->malam: nilai awal dibaca dari cermin localStorage 'ut-ambience',
   lalu disinkronkan dengan PlayerData begitu tersedia.
   API:  UT.Ambience.mode() / resolved() / graphics() / set({ambience,graphics}) / on(fn) -> fungsi off.
   Event: window 'ut-ambience' (detail:{mode,resolved,graphics}). */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  if (UT.Ambience) return;
  var root = document.documentElement, MIRROR = 'ut-ambience', cur = { mode: 'day', graphics: 'high' }, subs = [], last = '', mq = null;
  try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) {}

  function valid(m) { return m === 'day' || m === 'night' || m === 'system'; }
  function resolved() { return cur.mode === 'system' ? (mq && mq.matches ? 'night' : 'day') : cur.mode; }
  function readMirror() {
    try {
      var o = JSON.parse(localStorage.getItem(MIRROR) || 'null');
      if (o && valid(o.mode)) cur.mode = o.mode;
      if (o && (o.graphics === 'low' || o.graphics === 'high')) cur.graphics = o.graphics;
    } catch (e) {}
  }
  function apply() {
    var r = resolved();
    root.setAttribute('data-ambience', r);
    root.setAttribute('data-ambience-mode', cur.mode);
    root.setAttribute('data-graphics', cur.graphics);
    var sig = r + '|' + cur.mode + '|' + cur.graphics;
    if (sig === last) return; last = sig;
    var d = { mode: cur.mode, resolved: r, graphics: cur.graphics };
    subs.slice().forEach(function (f) { try { f(d); } catch (e) {} });
    try { window.dispatchEvent(new CustomEvent('ut-ambience', { detail: d })); } catch (e) {}
  }
  function fromPlayerData() {
    var PD = window.PlayerData, S = null;
    try { S = PD && PD.settings && PD.settings(); } catch (e) {}
    if (!S) return;
    if (valid(S.ambience)) cur.mode = S.ambience;
    if (S.graphics === 'low' || S.graphics === 'high') cur.graphics = S.graphics;
    try { localStorage.setItem(MIRROR, JSON.stringify(cur)); } catch (e) {}
    apply();
  }
  function hook() {
    fromPlayerData();
    var PD = window.PlayerData;
    try { if (PD && PD.subscribe) PD.subscribe(fromPlayerData); } catch (e) {}
    try { if (window.UT && UT.Events && UT.Events.on) UT.Events.on('settingsChanged', fromPlayerData); } catch (e) {}
  }

  readMirror(); apply();
  if (mq) { var onMq = function () { if (cur.mode === 'system') apply(); }; if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
  window.addEventListener('storage', function () { readMirror(); apply(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  window.addEventListener('pageshow', function () { fromPlayerData(); }); /* kembali dari halaman Pengaturan (bfcache) */

  UT.Ambience = {
    mode: function () { return cur.mode; },
    resolved: resolved,
    graphics: function () { return cur.graphics; },
    set: function (patch) {
      var PD = window.PlayerData; if (!PD || !PD.setSettings) return null;
      var n = PD.setSettings(patch); fromPlayerData(); return n;
    },
    on: function (fn) { subs.push(fn); return function () { var i = subs.indexOf(fn); if (i > -1) subs.splice(i, 1); }; }
  };
})();
