/* Page Module (SPA tahap 1) — bungkus skrip halaman jadi modul dengan mount/unmount.
   - define(name, body): body(env) = isi skrip halaman lama. Bila UT.PageModule.managed bukan true (halaman mandiri),
     define langsung memanggil mount sehingga perilaku halaman sama seperti sebelum dibungkus.
   - env melacak semua registrasi halaman (timer, interval, rAF, listener, langganan) dan melepasnya saat unmount.
     Setelah unmount, callback yang masih tertunda TIDAK dijalankan dan loop rAF yang menjadwal ulang dirinya berhenti.
   - Skrip klasik ES5/ES2015 tanpa DOM wajib; dapat dimuat di browser (window.UT.PageModule) maupun Node (module.exports)
     untuk tes — pola sama dengan item-registry.js.
   API: create(G) · define · mount · unmount · isMounted · managed
   env: setTimeout/clearTimeout · setInterval/clearInterval · requestAnimationFrame/cancelAnimationFrame ·
        addEventListener/removeEventListener (target window) · on(target,type,fn,opt) · own(off) · observe(obs) · dispose(fn) */
(function (root, factory) {
  var api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.PageModule = api; }
})(typeof window !== 'undefined' ? window : null, function (defaultG) {
  'use strict';

  function logError(G, msg, e) {
    try { (G.console || console).error(msg, e); } catch (_) { /* abaikan */ }
  }

  function makeEnv(G) {
    var dead = false, disposers = [], timers = {}, intervals = {}, frames = {}, listeners = [];

    function own(off) {
      if (typeof off !== 'function') return off;
      if (dead) { try { off(); } catch (_) { /* abaikan */ } return off; }
      disposers.push(off);
      return off;
    }

    var env = {
      get disposed() { return dead; },
      own: own,
      dispose: own,

      setTimeout: function (fn) {
        if (dead) return 0;
        var args = Array.prototype.slice.call(arguments, 2), id;
        id = G.setTimeout(function () {
          delete timers[id];
          if (!dead) fn.apply(G, args);
        }, arguments[1]);
        timers[id] = 1;
        return id;
      },
      clearTimeout: function (id) { delete timers[id]; G.clearTimeout(id); },

      setInterval: function (fn) {
        if (dead) return 0;
        var args = Array.prototype.slice.call(arguments, 2), id;
        id = G.setInterval(function () { if (!dead) fn.apply(G, args); }, arguments[1]);
        intervals[id] = 1;
        return id;
      },
      clearInterval: function (id) { delete intervals[id]; G.clearInterval(id); },

      requestAnimationFrame: function (fn) {
        if (dead) return 0;
        var id = G.requestAnimationFrame(function (t) {
          delete frames[id];
          if (!dead) fn(t);
        });
        frames[id] = 1;
        return id;
      },
      cancelAnimationFrame: function (id) { delete frames[id]; G.cancelAnimationFrame(id); },

      on: function (target, type, fn, opt) {
        if (dead || !target) return function () {};
        target.addEventListener(type, fn, opt);
        var rec = { target: target, type: type, fn: fn, opt: opt };
        listeners.push(rec);
        return function () { off(rec); };
      },
      addEventListener: function (type, fn, opt) { return env.on(G, type, fn, opt); },
      removeEventListener: function (type, fn, opt) {
        for (var i = 0; i < listeners.length; i++) {
          var r = listeners[i];
          if (r.target === G && r.type === type && r.fn === fn) { off(r); return; }
        }
        G.removeEventListener(type, fn, opt);
      },

      observe: function (obs) {
        if (obs && typeof obs.disconnect === 'function') own(function () { obs.disconnect(); });
        return obs;
      }
    };

    function off(rec) {
      var i = listeners.indexOf(rec);
      if (i < 0) return;
      listeners.splice(i, 1);
      try { rec.target.removeEventListener(rec.type, rec.fn, rec.opt); } catch (_) { /* abaikan */ }
    }

    env._kill = function () {
      if (dead) return;
      dead = true;
      Object.keys(timers).forEach(function (id) { G.clearTimeout(+id); });
      Object.keys(intervals).forEach(function (id) { G.clearInterval(+id); });
      Object.keys(frames).forEach(function (id) { G.cancelAnimationFrame(+id); });
      timers = {}; intervals = {}; frames = {};
      listeners.slice().forEach(off);
      for (var i = disposers.length - 1; i >= 0; i--) {
        try { disposers[i](); } catch (e) { logError(G, '[PageModule] disposer gagal', e); }
      }
      disposers = [];
    };

    return env;
  }

  function create(G) {
    G = G || defaultG;
    var defs = {}, live = {};
    var api = {
      managed: false,

      define: function (name, body) {
        if (typeof body !== 'function') throw new Error('PageModule.define: body harus fungsi (' + name + ')');
        defs[name] = body;
        if (!api.managed) return api.mount(name);
        return null;
      },

      mount: function (name) {
        var body = defs[name];
        if (!body) throw new Error('PageModule.mount: modul tidak dikenal (' + name + ')');
        if (live[name]) api.unmount(name);
        var env = makeEnv(G);
        var inst = { name: name, env: env, unmount: function () { return api.unmount(name); } };
        live[name] = inst;
        try { body(env); }
        catch (e) {
          if (live[name] === inst) delete live[name];
          env._kill();
          throw e;
        }
        return inst;
      },

      unmount: function (name) {
        var inst = live[name];
        if (!inst) return false;
        delete live[name];
        inst.env._kill();
        return true;
      },

      isMounted: function (name) { return !!live[name]; }
    };
    return api;
  }

  var api = create(defaultG);
  api.create = create;
  return api;
});
