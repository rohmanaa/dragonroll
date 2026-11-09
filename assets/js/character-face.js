/* assets/js/character-face.js — wajah/kepala karakter pemain (UT.BlockyCharacter, sama dengan halaman Karakter) sebagai gambar PNG.
   Pengganti AR.face(equippedId('skin')) untuk avatar HUD. Render sekali per tampilan (cache by look+gear), satu renderer bersama.
   Butuh (dimuat lebih dulu): three.min.js, item-catalog.js, player-data.js, blocky-character.js.
   API:
     UT.CharacterFace.url()        -> data URL PNG kepala pemain ('' bila WebGL/THREE tidak ada -> pakai fallback lama)
     UT.CharacterFace.urlPreset(n) -> idem untuk tampilan siap pakai n (pemain lain / CPU)
     UT.CharacterFace.html(cls)    -> '<img ...>' siap dipasang ('' bila gagal)
     UT.CharacterFace.mount(el,fb) -> isi el dengan wajah; fb() dipanggil (hasilnya HTML) bila gagal
     UT.CharacterFace.watch(fn)    -> panggil fn() saat tampilan/gear berubah (equip/pageshow/storage) */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.CharacterFace) return;
  var SIZE = 192, R = null, scene, cam;

  function init() {
    if (R) return R;
    var T = win.THREE;
    if (!T || !UT.BlockyCharacter || !win.PlayerData) return null;
    try {
      var r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(SIZE, SIZE); r.setClearColor(0x000000, 0);
      scene = new T.Scene();
      scene.add(new T.AmbientLight(0xffffff, .75), new T.HemisphereLight(0xcfeaff, 0x7a9a60, .55));
      var sun = new T.DirectionalLight(0xfff2d8, .9); sun.position.set(2, 4, 5); scene.add(sun);
      cam = new T.PerspectiveCamera(30, 1, .1, 60);
      R = { r: r, T: T };
    } catch (e) { R = null; }
    return R;
  }

  function signature() {
    var PD = win.PlayerData;
    try { return JSON.stringify([PD.look(), PD.gearLook()]); } catch (e) { return ''; }
  }

  var cache = {};
  function render(sig, load) {
    if (cache[sig]) return cache[sig];
    if (!init()) return '';
    var T = R.T, out = '', ch = null;
    try {
      ch = UT.BlockyCharacter.create(T); load(ch); ch.tick(0.016); /* pose rig baru terpasang setelah tick pertama */
      scene.add(ch.root); scene.updateMatrixWorld(true);
      var bb = new T.Box3().setFromObject(ch.root), h = bb.max.y - bb.min.y;
      var ty = bb.min.y + h * .885, d = h * 1.0, yaw = .28, pit = .06; /* kepala ~ 88% tinggi; bidikan sedikit serong */
      cam.position.set(Math.sin(yaw) * Math.cos(pit) * d, ty + Math.sin(pit) * d, Math.cos(yaw) * Math.cos(pit) * d);
      cam.lookAt(0, ty, 0);
      R.r.render(scene, cam);
      out = R.r.domElement.toDataURL('image/png');
    } catch (e) { out = ''; }
    try { if (ch) scene.remove(ch.root); } catch (e) {}
    if (typeof out === 'string' && out.length > 100) {
      var ks = Object.keys(cache); if (ks.length > 24) delete cache[ks[0]]; /* batasi memori */
      return (cache[sig] = out);
    }
    return '';
  }
  /* kepala pemain (PlayerData) */
  function url() { return render('me|' + signature(), function (ch) { ch.loadFromPlayer(); }); }
  /* kepala pemain lain dari server: d = {look, equipped, gear_dye} (baris room_appearance_get) */
  function urlData(d) { if (!d) return ''; var k; try { k = JSON.stringify([d.look, d.equipped, d.gear_dye || d.gearDye]); } catch (e) { return ''; } return render('d|' + k, function (ch) { ch.loadFromData(d.look, d.equipped, d.gear_dye || d.gearDye); }); }
  /* kepala tampilan siap pakai n (pemain lain / CPU) */
  function urlPreset(n) { n = Math.abs(n | 0); return render('p|' + n, function (ch) { ch.loadPreset(n); }); }

  function html(cls) {
    var u = url(); if (!u) return '';
    return '<img class="' + (cls || 'cface') + '" src="' + u + '" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain;image-rendering:auto">';
  }
  function mount(el, fb) {
    if (!el) return;
    var h = html(); el.innerHTML = h || (fb ? fb() : '');
  }
  function watch(fn) {
    try { if (win.PlayerData && win.PlayerData.subscribe) win.PlayerData.subscribe(function (r) { if (r === 'equip' || r === 'pageshow' || r === 'storage' || r === 'server-appearance') fn(); }); } catch (e) {}
    win.addEventListener('pageshow', function (e) { if (e.persisted) fn(); });
  }
  UT.CharacterFace = { url: url, urlPreset: urlPreset, urlData: urlData, html: html, mount: mount, watch: watch };
})(window);
