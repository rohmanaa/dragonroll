/* shop-preview.js — preview HIDUP untuk modal Toko (memakai renderer yang sama dengan halaman Inventory):
   dadu = DiceKit 3D (fisika lempar), skin = UT.CharacterView 3D, aura = UT.AuraFX di atas BlockyCharacter, power = Power-3D,
   frame = ItemArt + FrameFX (kanvas beranimasi otomatis). Semua jalur punya cadangan ItemArt bila WebGL/modul tidak ada.
   API: UT.ShopPreview.mount(host, item) -> dispose()   |   UT.ShopPreview.diceThumb(item) -> html <img> atau ''
   Hanya satu preview 3D aktif sekaligus; pemanggil wajib memanggil dispose() saat modal ditutup. */
(function (g) {
  'use strict';
  var UT = g.UT = g.UT || {};
  if (UT.ShopPreview) return;
  var OWNER = 'shop-prev';

  function fallback(host, item) { try { host.innerHTML = g.ItemArt ? g.ItemArt.forItem(item.id) : ''; } catch (e) { host.innerHTML = ''; } return function () {}; }

  /* adegan three.js di atas kanvas bersama (UT.SharedGL): putar dengan geser, loop sendiri, dispose lengkap */
  function scene3d(host, setup) {
    var T = g.THREE, S = UT.SharedGL;
    if (!T || !S) throw new Error('3d-tidak-ada');
    var acq = S.acquire(OWNER, { shadows: false }), r = acq.renderer, cv = acq.canvas;
    host.innerHTML = ''; host.appendChild(cv);
    cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(36, 1, .1, 100);
    scene.add(new T.AmbientLight(0xffffff, .5), new T.HemisphereLight(0xcfeaff, 0x6a9a50, .4));
    var sun = new T.DirectionalLight(0xfff2d8, .7); sun.position.set(6, 12, 8); scene.add(sun);
    var holder = new T.Group(); scene.add(holder);
    var st = { rot: 0, vel: 0, drag: false, lx: 0, moved: 0, raf: 0, dead: false, upd: null, tap: null }, ls = [];
    function on(t, ev, fn) { t.addEventListener(ev, fn); ls.push(function () { t.removeEventListener(ev, fn); }); }
    on(cv, 'pointerdown', function (e) { st.drag = true; st.moved = 0; st.lx = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    on(cv, 'pointermove', function (e) { if (st.drag) { st.vel = (e.clientX - st.lx) * .012; st.rot += st.vel; st.moved += Math.abs(e.clientX - st.lx); st.lx = e.clientX; } });
    function up() { st.drag = false; } on(cv, 'pointerup', up); on(cv, 'pointercancel', up);
    on(cv, 'click', function () { if (st.moved < 6 && st.tap) try { st.tap(); } catch (e) {} });
    function fit() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      r.setPixelRatio(Math.min(g.devicePixelRatio || 1, 1.5)); r.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    var ro = g.ResizeObserver ? new g.ResizeObserver(fit) : null; if (ro) ro.observe(host); fit();
    var last = 0;
    function loop(now) {
      if (st.dead) return; st.raf = g.requestAnimationFrame(loop);
      var t = (now || 0) / 1000, dt = Math.min(.05, Math.max(0, t - last)); last = t;
      if (!st.drag) { st.vel *= .95; st.rot += st.vel + .008; }
      holder.rotation.y = st.rot;
      if (st.upd) st.upd(dt, t);
      r.render(scene, cam);
    }
    st.raf = g.requestAnimationFrame(loop);
    var extra = setup({ T: T, scene: scene, cam: cam, holder: holder, st: st });
    return function () {
      st.dead = true; g.cancelAnimationFrame(st.raf);
      ls.forEach(function (f) { f(); }); try { if (ro) ro.disconnect(); } catch (e) {}
      try { if (extra) extra(); } catch (e) {}
      try { scene.traverse(function (o) { try { if (o.geometry) o.geometry.dispose(); } catch (_) {} if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { try { if (m.map) m.map.dispose(); m.dispose(); } catch (_) {} }); }); } catch (e) {}
      try { UT.SharedGL.release(OWNER); } catch (e) {}
      try { if (cv.parentNode === host) host.removeChild(cv); } catch (e) {}
    };
  }

  function skin(host, item) {
    return scene3d(host, function (c) {
      var CV = UT.CharacterView; if (!CV) throw new Error('character-view');
      var G = CV.make(c.T, item.id, 'idle'), pivot = new c.T.Group(); pivot.add(G); c.holder.add(pivot); /* anim() mengatur posisi G sendiri: pusatkan lewat pivot */
      c.scene.updateMatrixWorld(true);
      var bb = new c.T.Box3().setFromObject(G), h = Math.max(.5, bb.max.y - bb.min.y);
      pivot.position.y = -(bb.min.y + bb.max.y) / 2;
      c.cam.position.set(0, 0, (h / 2) / Math.tan(c.cam.fov * Math.PI / 360) * 1.3); c.cam.lookAt(0, 0, 0);
      c.st.upd = function (dt, t) { if (G.userData && G.userData.anim) G.userData.anim(t); };
    });
  }

  function aura(host, item) {
    return scene3d(host, function (c) {
      var FX = UT.AuraFX, BC = UT.BlockyCharacter; if (!FX || !BC) throw new Error('aura-fx');
      var ch = BC.create(c.T); ch.loadFromPlayer(); ch.setMode('idle'); ch.tick(.016);
      var w = new c.T.Group(); w.scale.setScalar(2.5); w.add(ch.root); c.holder.add(w);
      c.scene.updateMatrixWorld(true);
      var bb = new c.T.Box3().setFromObject(ch.root), hh = bb.max.y - bb.min.y; w.position.y += .14 - bb.min.y;
      c.scene.updateMatrixWorld(true);
      var sys = new FX.AuraSystem(c.scene, c.cam, { quality: FX.detectQuality ? FX.detectQuality() : 'low' });
      var a = sys.attach(ch.root, item.gameKey, {}, { height: hh > .1 ? hh : ch.height() * 2.5 });
      c.cam.position.set(0, 4.2, 15); c.cam.lookAt(0, 3.2, 0);
      c.st.upd = function (dt) { ch.tick(dt); sys.update(dt); };
      c.st.tap = function () { if (a && a.jump) a.jump(); };
      return function () { try { sys.dispose(); } catch (e) {} };
    });
  }

  function dice(host, item, done) {
    var kit = null, dead = false, off = null;
    function go() {
      if (dead || kit) return;
      if (!g.DiceKit || !g.DiceKit.has(item.gameKey)) { fallback(host, item); return; }
      try {
        host.innerHTML = '';
        kit = g.DiceKit.mount(host, { diceId: item.gameKey, quality: 'auto', camScale: .95, sound: false, sharedGL: OWNER + '-dice' });
        kit.rollWhenReady();
        host.addEventListener('click', roll);
      } catch (e) { kit = null; fallback(host, item); }
    }
    function roll() { try { if (kit) kit.roll(); } catch (e) {} }
    if (g.DiceKit) go(); else { fallback(host, item); g.addEventListener('dicekit-ready', go, { once: true }); off = function () { g.removeEventListener('dicekit-ready', go); }; }
    return function () { dead = true; if (off) off(); host.removeEventListener('click', roll); try { if (kit) kit.dispose(); } catch (e) {} kit = null; };
  }

  /* Power: 3D hidup + SFX (mengikuti Pengaturan -> Suara) + FX. Efek & suara berjalan OTOMATIS sekali saat preview dibuka, ketuk = ulangi.
     Power tanpa model 3D / WebGL gagal: gambar ItemArt + partikel 2D UT.PowerFX (data/power/power-fx.js), sama seperti halaman Power. */
  function soundOn() { try { return !g.PlayerData || g.PlayerData.settings().sound !== false; } catch (e) { return true; } }
  function fx2d(host, item) { try { if (g.UT && g.UT.PowerFX) g.UT.PowerFX.playAtElement(item.gameKey, host); } catch (e) { /* abaikan */ } }
  function power(host, item) {
    var inst = null, dead = false, timer = 0, box = g.document.createElement('div');
    box.style.cssText = 'position:absolute;inset:0'; host.innerHTML = ''; host.appendChild(box);
    function act() { try { if (inst) { inst.setSound(soundOn()); inst.activate(); } else fx2d(host, item); } catch (e) { /* abaikan */ } }
    function plain() { fallback(host, item); host.addEventListener('click', act); timer = g.setTimeout(act, 450); }
    import('./power-3d/power-show.js').then(function (m) {
      if (dead) return;
      if (!m.supports(item.gameKey)) { plain(); return; }
      inst = m.mount(box, { quality: 'low' }); inst.setSound(soundOn());
      if (inst.show(item.gameKey)) { inst.start(); host.addEventListener('click', act); timer = g.setTimeout(act, 450); } else { inst = null; plain(); }
    }).catch(function () { if (!dead) { inst = null; plain(); } });
    return function () {
      dead = true; g.clearTimeout(timer); host.removeEventListener('click', act);
      try { if (inst) { inst.setSound(false); inst.destroy(); } } catch (e) { /* abaikan */ } inst = null;
    };
  }

  function mount(host, item) {
    if (!host || !item) return function () {};
    try {
      if (item.kind === 'skin') return skin(host, item);
      if (item.kind === 'aura') return aura(host, item);
      if (item.kind === 'dice') return dice(host, item);
      if (item.kind === 'powerup') return power(host, item);
    } catch (e) { if (g.console) g.console.warn('[ShopPreview]', e); }
    return fallback(host, item); /* frame & cadangan: ItemArt (FrameFX menganimasikan frame otomatis) */
  }

  function diceThumb(item) {
    try { if (item && item.kind === 'dice' && g.DiceKit && g.DiceKit.has(item.gameKey)) { var u = g.DiceKit.thumb(item.gameKey, 160); if (u) return '<img class="dthumb" src="' + u + '" alt="" draggable="false">'; } } catch (e) {}
    return '';
  }

  UT.ShopPreview = { mount: mount, diceThumb: diceThumb };
})(window);
