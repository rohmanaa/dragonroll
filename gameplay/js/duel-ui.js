/* Ular Tangga Blok — duel PVP: arena cinematic, rigged Three.js fighters, HUD versus, and FX. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var root = null, el = {}, arena = null, fighters = [null, null], closeToken = 0, resizeHandler = null, rollResolver = null, introResolver = null, introTimer = 0, rollTick = 0;
  var ROLL_LIMIT_MS = 5000;   /* batas waktu tap ROLL: lewat 5 detik -> otomatis roll */
  var options = { reducedMotion: false };
  /* LOOK_Y: makin besar => petarung makin turun di layar (kaki menapak lantai bawah background) */
  var LOOK_Y = 0.7;
  var diceSkins = [null, null];            /* skin dadu per pemain (dari katalog DiceKit); null = bawaan */
  var DEFAULT_DICE = [
    { face: '#f4ead2', pip: '#1c2a4a', rim: '#d9b45a' },
    { face: '#34283a', pip: '#ff7a6a', rim: '#9a5cff' }
  ];
  var FACE_VAL = [2, 5, 1, 6, 3, 4];                       /* urutan muka BoxGeometry: +x,-x,+y,-y,+z,-z (sama dengan dice-throw.js) */
  var FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  var PIPS = {
    1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]],
    4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
    5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]],
    6: [[.3, .25], [.3, .5], [.3, .75], [.7, .25], [.7, .5], [.7, .75]]
  };
  var DEFEAT_T = { launch: 0.45, bounce: 0.65, sit: 1.25, hold: 2.0, stand: 2.7 };  /* detik: terpental -> jatuh -> duduk -> berdiri kalah */
  function ease3(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  var ACTIONS = {
    1: ['DEFENSE',      'BLOCK 1 DAMAGE',         'defense'],
    2: ['REGENERATION', 'RESTORE 1 HEART',         'regen'],
    3: ['ATTACK',       'DEAL 1 DAMAGE',           ''],
    4: ['CRITICAL',     'DEAL 2 DAMAGE · +2 MOM',  'critical'],
    5: ['LIFESTEAL',    'DAMAGE 1 · HEAL 1',       'lifesteal'],
    6: ['BERSERK',      'DEAL 2 · PIERCE DEFENSE', 'berserk']
  };

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function playSfx(name) {
    if (UT.PvpKnight && UT.PvpKnight.SFX && typeof UT.PvpKnight.SFX[name] === 'function') {
      try { UT.PvpKnight.SFX[name](); } catch (e) {}
    }
  }
  function hearts(n, max) {
    var s = '';
    for (var i = 0; i < max; i++) s += '<span class="du-heart' + (i < n ? ' on' : '') + '">&#9829;</span>';
    return s;
  }
  /* Animated heart update — compares old vs new state */
  function updateHearts(el, newN, oldN, max) {
    if (oldN === undefined || oldN === newN || !el.querySelectorAll) {
      el.innerHTML = hearts(newN, max);
      return;
    }
    el.innerHTML = hearts(oldN, max);
    var spans = el.querySelectorAll('.du-heart');
    for (var i = 0; i < max; i++) {
      var wasOn = i < oldN, nowOn = i < newN;
      if (wasOn && !nowOn) {
        spans[i].classList.remove('on');
        (function (span) {
          span.classList.add('break');
          setTimeout(function () { span.classList.remove('break'); }, 420);
        })(spans[i]);
      } else if (!wasOn && nowOn) {
        spans[i].classList.add('on', 'gain');
        setTimeout(function (span) { span.classList.remove('gain'); }, 350, spans[i]);
      }
    }
  }
  function moms(n, max) {
    var s = '';
    for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return s;
  }
  function updateMom(el, n, max) {
    el.innerHTML = moms(n, max);
    if (n >= max) el.classList.add('full');
    else el.classList.remove('full');
    el.setAttribute('aria-label', 'Momentum ' + n + ' dari ' + max);
  }
  function finishIntro() {
    if (introTimer) clearTimeout(introTimer);
    introTimer = 0;
    if (el.skipButton) el.skipButton.hidden = true;
    if (root) root.classList.remove('intro', 'cine');
    if (introResolver) {
      var resolve = introResolver;
      introResolver = null;
      resolve();
    }
  }

  function build() {
    if (root) return;
    root = mk('div', 'du'); root.id = 'duelUI'; root.hidden = true; root.setAttribute('aria-live', 'polite');
    var top = mk('div', 'du-top');
    [0, 1].forEach(function (i) {
      var side = mk('section', 'du-profile du-profile-' + i);
      var avatar = mk('div', 'du-avatar');
      el['face' + i] = mk('img'); el['face' + i].alt = '';
      avatar.appendChild(el['face' + i]);
      var stats = mk('div', 'du-profile-info');
      el['name' + i] = mk('div', 'du-name');
      el['hp' + i] = mk('div', 'du-hp');
      var momentum = mk('div', 'du-momentum-row');
      momentum.appendChild(mk('span', 'du-momentum-label', 'MOMENTUM'));
      el['mom' + i] = mk('div', 'du-mom');
      momentum.appendChild(el['mom' + i]);
      stats.appendChild(el['name' + i]); stats.appendChild(el['hp' + i]);
      side.appendChild(avatar); side.appendChild(stats); side.appendChild(momentum); top.appendChild(side);
    });
    var title = mk('div', 'du-title');
    title.appendChild(mk('b', null, 'PVP CLASH'));
    el.banner = mk('span', 'du-banner', 'ROUND 1');
    title.appendChild(el.banner); top.appendChild(title); root.appendChild(top);

    var arena = mk('div', 'du-arena'); el.arenaBox = arena;
    el.scene = mk('div', 'du-scene');
    arena.appendChild(el.scene);
    el.dice = []; el.dieLabels = []; el.dieSlots = [];
    [0, 1].forEach(function (i) {
      var fighter = mk('section', 'du-fighter du-fighter-' + i);
      el['fighter' + i] = fighter;
      /* slot dadu 3D (dirender di canvas arena, tepat DI ATAS panel aksi) + angka hasil */
      var slot = mk('div', 'du-die-slot'); el.dieSlots[i] = slot;
      var wrap = mk('div', 'du-die-wrap');
      el.dice[i] = mk('div', 'du-die', '—');
      el.dieLabels[i] = mk('div', 'du-die-label', '');
      wrap.appendChild(el.dice[i]); wrap.appendChild(el.dieLabels[i]);
      fighter.appendChild(slot); fighter.appendChild(wrap);
      el['action' + i] = mk('div', 'du-action');
      el['actionName' + i] = mk('b', null, 'READY');
      el['actionDesc' + i] = mk('span');
      el['action' + i].appendChild(el['actionName' + i]); el['action' + i].appendChild(el['actionDesc' + i]);
      fighter.appendChild(el['action' + i]); arena.appendChild(fighter);
    });
    el.versus = mk('div', 'du-versus'); el.versus.setAttribute('role', 'img'); el.versus.setAttribute('aria-label', 'VS'); arena.appendChild(el.versus);
    root.appendChild(arena);
    el.barTop = mk('div', 'du-bar du-bar-top'); el.barBottom = mk('div', 'du-bar du-bar-bottom');
    root.appendChild(el.barTop); root.appendChild(el.barBottom);

    el.log = mk('div', 'du-log', 'THE CLASH BEGINS');
    root.appendChild(el.log);
    el.rollButton = mk('button', 'du-roll-button');
    el.rollButton.type = 'button';
    el.rollIcon = mk('img');
    el.rollIcon.src = 'assets/images/ui/gameplay-actions/roll.webp';
    el.rollIcon.alt = '';
    el.rollButton.appendChild(el.rollIcon);
    /* tombol Roll = tombol Roll gameplay (ikon roll.webp tanpa bingkai); label kecil di bawahnya */
    el.rollLabel = mk('span', 'du-roll-label', 'ROLL DICE');
    el.rollButton.appendChild(el.rollLabel);
    el.rollTimer = mk('div', 'du-roll-timer'); el.rollTimerBar = mk('i'); el.rollTimer.appendChild(el.rollTimerBar); el.rollTimer.hidden = true;
    el.rollButton.appendChild(el.rollTimer);
    var kbdHint = mk('kbd', null, 'SPACE');
    el.rollButton.appendChild(kbdHint);
    el.rollButton.addEventListener('click', function () {
      if (!rollResolver || el.rollButton.disabled) return;
      clearRollTimer();
      el.rollButton.disabled = true;
      el.rollLabel.textContent = 'ROLLING...';
      playSfx('roll');
      startDiceTumble();
      var resolve = rollResolver;
      rollResolver = null;
      resolve(true);
    });
    /* keyboard shortcut SPACE */
    el._keyHandler = function (e) {
      if (e.repeat) return;
      if ((e.code === 'Space' || e.code === 'Enter') && !el.rollButton.disabled && rollResolver) {
        e.preventDefault();
        el.rollButton.click();
      }
    };
    window.addEventListener('keydown', el._keyHandler);
    root.appendChild(el.rollButton);
    el.skipButton = mk('button', 'du-skip');
    el.skipButton.type = 'button';
    el.skipButton.setAttribute('aria-label', 'Lewati animasi duel');
    el.skipImage = mk('img');
    el.skipImage.src = 'gameplay/assets/duel/hud-skip.webp';
    el.skipImage.alt = '';
    el.skipButton.appendChild(el.skipImage);
    el.skipButton.appendChild(mk('span', null, '▶ LEWATI'));
    el.skipButton.hidden = true;
    el.skipButton.addEventListener('click', finishIntro);
    root.appendChild(el.skipButton);
    el.pops = mk('div', 'du-pops'); root.appendChild(el.pops);
    el.flash = mk('div', 'du-flash'); root.appendChild(el.flash);
    el.choose = mk('div', 'du-choose'); el.choose.hidden = true; root.appendChild(el.choose);
    el.card = mk('div', 'du-card'); el.card.hidden = true; root.appendChild(el.card);

    el.helpButton = mk('button', 'du-help', '?');
    el.helpButton.type = 'button';
    el.helpButton.setAttribute('aria-label', 'Aturan duel PVP');
    el.helpButton.addEventListener('click', function () {
      if (el.rulesCard) el.rulesCard.hidden = !el.rulesCard.hidden;
    });
    root.appendChild(el.helpButton);

    el.rulesCard = mk('div', 'du-rules-card');
    el.rulesCard.hidden = true;
    el.rulesCard.appendChild(mk('b', null, 'ATURAN COMBAT DADU'));
    var rTable = mk('div', 'du-rules-table');
    var rulesList = [
      ['1 · DEFENSE', 'Blokir 1 damage dari serangan lawan'],
      ['2 · REGEN', 'Pulihkan 1 HP (maks 3 HP)'],
      ['3 · ATTACK', 'Berikan 1 damage ke lawan'],
      ['4 · CRITICAL', 'Berikan 2 damage & +2 Momentum'],
      ['5 · LIFESTEAL', 'Berikan 1 damage & pulihkan 1 HP'],
      ['6 · BERSERK', 'Berikan 2 damage (menembus Defense!)']
    ];
    rulesList.forEach(function (r) {
      var row = mk('div', 'du-rules-row');
      row.appendChild(mk('b', null, r[0]));
      row.appendChild(mk('span', null, r[1]));
      rTable.appendChild(row);
    });
    el.rulesCard.appendChild(rTable);
    el.rulesCard.appendChild(mk('div', 'du-rules-note', 'MOMENTUM: Penuh (3) memicu FINISHER (+1 DMG pada serangan berikutnya). Pertarungan maks 3 ronde. Seri = Sudden Death (tanpa heal). Kalah mundur 10% petak.'));
    var rClose = mk('button', 'du-rules-close', 'TUTUP');
    rClose.type = 'button';
    rClose.addEventListener('click', function () { el.rulesCard.hidden = true; });
    el.rulesCard.appendChild(rClose);
    root.appendChild(el.rulesCard);
    document.body.appendChild(root);
  }

  function resizeArena() {
    if (!arena) return;
    var rect = el.scene.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    var height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    /* canvas dibuat lebih tinggi dari kotak arena (CSS .du-scene bottom negatif) agar dadu 3D bisa berada DI BAWAH kaki petarung.
       Bingkai kamera tetap setinggi kotak arena (setViewOffset) sehingga komposisi 3D tidak berubah. */
    var box = el.arenaBox ? el.arenaBox.getBoundingClientRect() : null;
    var baseH = box && box.height ? Math.min(height, Math.round(box.height)) : height;
    arena.renderer.setSize(width, height, false);
    arena.camera.aspect = width / baseH;
    /* layar sempit (portrait): mundurkan kamera agar kedua petarung tetap masuk frame */
    arena.baseZ = Math.min(15, 7.6 * Math.max(1, 1.75 / (width / baseH)));
    if (arena.camera.setViewOffset) arena.camera.setViewOffset(width, baseH, 0, 0, width, height);
    arena.camera.updateProjectionMatrix();
    arena.W = width; arena.H = height;
    var dc = arena.dice && arena.dice.cam;
    if (dc) { dc.left = 0; dc.right = width; dc.top = height; dc.bottom = 0; dc.updateProjectionMatrix(); }
  }

  /* ── Dadu 3D per pemain (scene terpisah, kamera ortografik dalam piksel -> dadu menempel di slot DOM di atas panel aksi) ── */
  function roundedCube(T, size, r, seg) {
    var g = new T.BoxGeometry(size, size, size, seg, seg, seg), pos = g.attributes.position, nor = g.attributes.normal, h = size / 2 - r;
    var v = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
      d.copy(v).sub(c);
      if (d.lengthSq() > 1e-10) { d.normalize(); nor.setXYZ(i, d.x, d.y, d.z); pos.setXYZ(i, c.x + d.x * r, c.y + d.y * r, c.z + d.z * r); }
    }
    return g;
  }
  function pipTexture(T, n, skin) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d');
      g.fillStyle = skin.face; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = skin.rim || 'rgba(0,0,0,.3)'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
      g.fillStyle = n === 1 ? '#d02a2a' : skin.pip;
      PIPS[n].forEach(function (p) { g.beginPath(); g.arc(p[0] * 128, p[1] * 128, n === 1 ? 16 : 12, 0, 6.2832); g.fill(); });
      var t = new T.CanvasTexture(c); t.anisotropy = 4;
      return t;
    } catch (e) { return null; }
  }
  function dieMaterials(T, skin) {
    return FACE_VAL.map(function (v) {
      var tex = pipTexture(T, v, skin);
      return new T.MeshStandardMaterial({ map: tex || null, color: tex ? 0xffffff : 0xe8dcc0, roughness: skin.rough == null ? 0.45 : skin.rough, metalness: skin.metal || 0.08 });
    });
  }
  function disposeDieMats(die) {
    (die.mats || []).forEach(function (m) { if (m.map && m.map.dispose) m.map.dispose(); if (m.dispose) m.dispose(); });
  }
  function applyDiceSkin(i) {
    if (!arena || !arena.dice || !arena.dice.items[i]) return;
    var T = window.THREE, die = arena.dice.items[i], skin = diceSkins[i] || DEFAULT_DICE[i];
    disposeDieMats(die);
    die.mats = dieMaterials(T, skin);
    die.mesh.material = die.mats;
  }
  function makeDiceScene(T) {
    var scene = new T.Scene();
    var cam = new T.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
    scene.add(new T.AmbientLight(0xffffff, 0.95));
    var dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(-200, 400, 500); scene.add(dl);
    var items = [0, 1].map(function (i) {
      var geo = roundedCube(T, 1, 0.12, 4);
      var skin = diceSkins[i] || DEFAULT_DICE[i];
      var mats = dieMaterials(T, skin);
      var mesh = new T.Mesh(geo, mats);
      scene.add(mesh);
      return { mesh: mesh, geo: geo, mats: mats, mode: 'idle', t: i * 1.7, w: new T.Vector3(), q0: new T.Quaternion(), q1: new T.Quaternion(), hop: 0, size: 60, value: 0, x: 0, y: 0 };
    });
    return { scene: scene, cam: cam, items: items };
  }
  function dieTargetQuat(T, v) {
    var idx = Math.max(0, FACE_VAL.indexOf(v)), n = FACE_N[idx];
    var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(n[0], n[1], n[2]), new T.Vector3(0, 0, 1));
    var tilt = new T.Quaternion().setFromEuler(new T.Euler(-0.5, 0.5, 0));
    return tilt.multiply(q);
  }
  function startDiceTumble() {
    if (!arena || !arena.dice) return;
    var T = window.THREE;
    arena.dice.items.forEach(function (d, i) {
      d.mode = 'tumble'; d.t = 0;
      d.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 12);
      if (d.w.length() < 6) d.w.set(9, 7 + i * 2, 5);
    });
    arena.dice.tumbleAt = arena.elapsed;
  }
  function landDie(i, value) {
    if (!arena || !arena.dice) return;
    var T = window.THREE, d = arena.dice.items[i];
    d.value = value; d.q0.copy(d.mesh.quaternion); d.q1.copy(dieTargetQuat(T, value));
    d.mode = 'land'; d.t = 0;
  }
  function updateDice(dt) {
    var dc = arena.dice, T = window.THREE;
    if (!dc) return;
    var sr = el.scene.getBoundingClientRect();
    if (sr.width && sr.height && (Math.abs(sr.width - arena.W) > 1 || Math.abs(sr.height - arena.H) > 1)) { resizeArena(); }
    var tmp = arena._dq || (arena._dq = new T.Quaternion()), axis = arena._da || (arena._da = new T.Vector3());
    dc.items.forEach(function (d, i) {
      var slot = el.dieSlots && el.dieSlots[i];
      var r = slot ? slot.getBoundingClientRect() : null;
      var size = r && r.height ? Math.min(r.height, r.width || r.height) * 0.78 : 60;
      d.size = size;
      var cx = r ? r.left - sr.left + r.width / 2 : (arena.W || 640) * (i ? 0.73 : 0.27);
      var cy = r ? (arena.H || sr.height) - (r.top - sr.top + r.height / 2) : (arena.H || 360) * 0.5;
      d.t += dt;
      d.mesh.visible = !(root && root.classList.contains('intro'));
      var hop = 0, bob = 0;
      if (d.mode === 'idle') {
        axis.set(0.3, 1, 0.1).normalize(); tmp.setFromAxisAngle(axis, dt * 0.9); d.mesh.quaternion.premultiply(tmp);
        bob = Math.sin(d.t * 2.1) * size * 0.05;
      } else if (d.mode === 'tumble') {
        var wl = d.w.length(); axis.copy(d.w).normalize(); tmp.setFromAxisAngle(axis, wl * dt); d.mesh.quaternion.premultiply(tmp);
        hop = Math.abs(Math.sin(d.t * 8.5)) * size * 0.55;
      } else if (d.mode === 'land') {
        var u = Math.min(1, d.t / 0.55);
        d.mesh.quaternion.slerpQuaternions(d.q0, d.q1, ease3(u));
        hop = Math.sin(Math.PI * u) * size * 0.35 * (1 - u * 0.6) + Math.abs(Math.sin(u * 9)) * size * 0.12 * (1 - u);
        if (u >= 1) { d.mode = 'rest'; d.t = 0; }
      } else {
        d.mesh.quaternion.copy(d.q1);
        bob = Math.sin(d.t * 2.4) * size * 0.04;
      }
      d.mesh.scale.setScalar(size * (d.mode === 'rest' ? 1 + Math.sin(d.t * 3) * 0.015 : 1));
      d.mesh.position.set(cx, cy + hop + bob, 0);
    });
  }

  /* ── Debu (kubus kecil bergaya voxel) ── */
  function makeDust(T, scene) {
    var geo = new T.BoxGeometry(0.13, 0.13, 0.13), pool = [];
    for (var i = 0; i < 48; i++) {
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xcdb28a, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; scene.add(m);
      pool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 1 });
    }
    return { geo: geo, pool: pool };
  }
  function spawnDust(x, z, count, power) {
    if (!arena || !arena.dust) return;
    var n = 0;
    for (var i = 0; i < arena.dust.pool.length && n < count; i++) {
      var p = arena.dust.pool[i];
      if (p.life > 0) continue;
      var a = Math.random() * 6.2832, sp = (0.5 + Math.random() * 1.5) * power;
      p.mesh.position.set(x + Math.cos(a) * 0.3, 0.07, z + Math.sin(a) * 0.2);
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp * 0.5; p.vy = 0.7 + Math.random() * 1.5 * power;
      p.max = p.life = 0.55 + Math.random() * 0.6; p.s = 0.7 + Math.random() * 1.1;
      p.mesh.material.color.setHex(Math.random() < 0.5 ? 0xcdb28a : 0xe6d6b4);
      p.mesh.visible = true; n++;
    }
  }
  function tickDust(dt) {
    if (!arena || !arena.dust) return;
    arena.dust.pool.forEach(function (p) {
      if (p.life <= 0) return;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; p.mesh.material.opacity = 0; return; }
      var k = p.life / p.max;
      p.vy -= 3.4 * dt; p.vx *= 1 - dt * 1.6; p.vz *= 1 - dt * 1.6;
      p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.scale.setScalar(p.s * (1 + (1 - k) * 1.7));
      p.mesh.rotation.y += dt * 3; p.mesh.material.opacity = 0.78 * k;
    });
  }

  function ensureArena() {
    if (arena) return arena;
    var T = window.THREE;
    if (!T || !T.WebGLRenderer) {
      console.error('[duel] Three.js tidak tersedia');
      return null;
    }
    var hasKnight = UT.PvpKnight && typeof UT.PvpKnight.createKnight === 'function';
    var hasBlocky = UT.BlockyCharacter && UT.BlockyCharacter.create;
    if (!hasKnight && !hasBlocky) {
      console.error('[duel] Rig karakter tidak tersedia');
      return null;
    }
    try {
      var scene = new T.Scene();
      var camera = new T.PerspectiveCamera(36, 1, 0.1, 80);
      camera.position.set(0, 2.2, 7.6); camera.lookAt(0, 1.3, 0);

      /* Cinematic lighting — mockup style */
      scene.add(new T.HemisphereLight(0xb9a6e8, 0x2a1a38, 1.05));
      var key = new T.DirectionalLight(0xffe0bc, 0.95);
      key.position.set(-3, 12, 8);
      key.castShadow = true;
      key.shadow.mapSize.width = 1024; key.shadow.mapSize.height = 1024;
      scene.add(key);
      var purple = new T.PointLight(0x9a5cff, 1.1, 22, 2);
      purple.position.set(0, 4, -4); scene.add(purple);
      var fireL = new T.PointLight(0xff9a40, 0.9, 18, 2);
      fireL.position.set(-7, 2.5, 1); scene.add(fireL);
      var fireR = new T.PointLight(0xff9a40, 0.9, 18, 2);
      fireR.position.set(7, 2.5, 1); scene.add(fireR);

      /* Lingkaran lantai + ring emas dihapus (tidak ada lingkaran di sekeliling petarung) */

      /* Shadow catcher */
      try {
        var catcher = new T.Mesh(new T.PlaneGeometry(40, 20), new T.ShadowMaterial({ opacity: 0.45 }));
        catcher.rotation.x = -Math.PI / 2; catcher.position.set(0, 0.02, 2);
        catcher.receiveShadow = true; scene.add(catcher);
      } catch (se) { /* ShadowMaterial might not exist in older THREE */ }

      var renderer = new T.WebGLRenderer({ alpha: true, antialias: !(navigator.maxTouchPoints>0&&/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)), powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      if (T.PCFSoftShadowMap) renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.domElement.className = 'du-scene-canvas';
      renderer.domElement.setAttribute('aria-label', 'Karakter duel 3D');
      el.scene.appendChild(renderer.domElement);
      var dust = null, dice = null;
      try { dust = makeDust(T, scene); } catch (de) { console.error('[duel] debu gagal', de); }
      try { dice = makeDiceScene(T); } catch (dx) { console.error('[duel] dadu 3D gagal', dx); }
      arena = { scene: scene, camera: camera, renderer: renderer, elapsed: 0, W: 640, H: 360, baseZ: 9.8,
                fireL: fireL, fireR: fireR, dust: dust, dice: dice,
                cin: { px: 0, py: 2.2, pz: 7.6, lx: 0, ly: 1.3 + LOOK_Y, fov: 36, rate: 4, shake: 0, slow: 1, slowUntil: 0, focusX: 0, zoom: 0, intro: 0 } };
      return arena;
    } catch (e) {
      console.error('[duel] Gagal membuat arena Three.js', e);
      return null;
    }
  }
  function disposeTree(rootNode) {
    if (!rootNode || !rootNode.traverse) return;
    rootNode.traverse(function (node) {
      if (node.userData && node.userData.sharedWithPawn) return;   /* model bidak (klon): geometri/material milik bidak di papan, jangan dibuang */
      if (node.geometry && node.geometry.dispose) node.geometry.dispose();
      var materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
      materials.forEach(function (material) {
        if (material.map && material.map.dispose) material.map.dispose();
        if (material.dispose) material.dispose();
      });
    });
  }
  function disposeArena() {
    if (!arena) return;
    try {
      if (arena.dust) { arena.dust.geo.dispose(); arena.dust.pool.forEach(function (p) { p.mesh.material.dispose(); }); }
      if (arena.dice) arena.dice.items.forEach(function (d) { d.geo.dispose(); disposeDieMats(d); });
    } catch (e) {}
  }
  function clearRollTimer() {
    if (rollTick) { clearInterval(rollTick); rollTick = 0; }
    if (el.rollTimer) { el.rollTimer.hidden = true; el.rollTimer.classList.remove('urgent'); }
  }
  /* hitung mundur 5 detik di tombol ROLL; habis -> klik otomatis (jalur yang sama dengan tap manual, jadi online/lokal sama) */
  function startRollTimer(round) {
    clearRollTimer();
    if (!el.rollTimer) return;
    var t0 = Date.now(), bar = el.rollTimerBar || { style: {} };
    el.rollTimer.hidden = false;
    bar.style.transition = 'none'; bar.style.width = '100%'; void (bar.offsetWidth || 0);
    if (!options.reducedMotion) { bar.style.transition = 'width ' + ROLL_LIMIT_MS + 'ms linear'; bar.style.width = '0%'; }
    rollTick = setInterval(function () {
      if (!root || root.hidden || !rollResolver || el.rollButton.disabled) { clearRollTimer(); return; }
      var left = Math.max(0, ROLL_LIMIT_MS - (Date.now() - t0));
      el.rollLabel.textContent = 'ROLL DICE · ROUND ' + round + ' · ' + Math.ceil(left / 1000);
      if (left <= 2000) el.rollTimer.classList.add('urgent'); else el.rollTimer.classList.remove('urgent');
      if (options.reducedMotion) bar.style.width = (left / ROLL_LIMIT_MS * 100) + '%';
      if (left <= 0) { clearRollTimer(); el.rollButton.click(); }
    }, 100);
  }
  function clearFighters() {
    if (!arena) return;
    fighters.forEach(function (fighter, i) {
      if (!fighter) return;
      var rootNode = fighter.phys || fighter.root;
      if (arena.scene && rootNode) arena.scene.remove(rootNode);
      if (fighter.kn && fighter.kn.dispose) fighter.kn.dispose();
      else disposeTree(fighter.root);
      if (fighter.shadow) disposeTree(fighter.shadow);
      fighters[i] = null;
    });
  }
  function shadowBlob(T) {
    var g = new T.Group();
    [[0.95, 0.2], [0.62, 0.3]].forEach(function (c) {
      var m = new T.Mesh(new T.CircleGeometry(c[0], 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: c[1], depthWrite: false }));
      m.rotation.x = -Math.PI / 2; g.add(m);
    });
    g.position.y = 0.035;
    return g;
  }
  /* Karakter ASLI pemain/CPU (BlockyCharacter: skin, outfit, jubah) — ksatria hanya bila skin 'ksatria' dipakai */
  function wantsKnight(spec) { return !!(spec && (spec.skin === 'ksatria' || spec.knight)); }
  function setBasePose(f, name) {
    if (!f) return;
    if (f.kn && UT.PvpKnight && UT.PvpKnight.POSES) {
      f.base = UT.PvpKnight.POSES[name] || UT.PvpKnight.POSES.guard;
    } else if (f.character && f.character.setMode) {
      f.character.setMode({ down: 'poseDown', sit: 'poseSit', defeat: 'poseDefeat' }[name] || 'idle');
    }
  }
  function makeFighters(specs) {
    clearFighters();
    if (!Array.isArray(specs)) return;
    var currentArena = ensureArena();
    if (!currentArena) return;
    var T = window.THREE;
    var G = { homeX: 2.5 };
    var canKnight = UT.PvpKnight && typeof UT.PvpKnight.createKnight === 'function';
    var canBlocky = UT.BlockyCharacter && UT.BlockyCharacter.create;
    specs.slice(0, 2).forEach(function (spec, i) {
      try {
        var direction = i === 0 ? 1 : -1, x = i === 0 ? -G.homeX : G.homeX;
        var phys = new T.Group(), face = new T.Group();
        phys.add(face);
        face.rotation.y = i === 0 ? Math.PI / 2 : -Math.PI / 2;   /* saling berhadapan */
        var f = { phys: phys, face: face, x: x, direction: direction, side: i, groundY: 0,
                  intro: 0, action: '', actionTime: 0, actionDuration: 0, hitTime: 0, heavyHit: false,
                  flash: 0, glow: 0, idleT: i * 1.3, defeat: null, defeatDx: 0, ph: i * 1.9 };
        if (spec && spec.model) {
          /* model bidak sendiri (klon): berdiri di lantai, tengah di origin; skala disamakan dengan lawan setelah kedua petarung dibuat */
          var sm = spec.model, wrap = new T.Group();
          sm.traverse(function (n) { n.userData = n.userData || {}; n.userData.sharedWithPawn = true; });
          sm.position.set(0, 0, 0); sm.rotation.set(0, 0, 0); sm.scale.set(1, 1, 1); sm.updateMatrixWorld(true);
          var sb = new T.Box3().setFromObject(sm), sh = Math.max(0.1, sb.max.y - sb.min.y);
          sm.position.set(-(sb.min.x + sb.max.x) / 2, -sb.min.y, -(sb.min.z + sb.max.z) / 2);
          wrap.add(sm); face.add(wrap);
          f.root = wrap; f.staticModel = true; f.staticH = sh;
        } else if ((wantsKnight(spec) || !canBlocky) && canKnight) {
          var palette = i === 1 ? UT.PvpKnight.RIVAL_PAL : undefined;
          var kn = UT.PvpKnight.createKnight(T, palette ? { palette: palette } : undefined);
          kn.root.scale.setScalar(1);
          face.add(kn.root);
          f.kn = kn; f.root = kn.root;
          f.pose = UT.PvpKnight.newPose ? UT.PvpKnight.newPose() : {};
          f.base = UT.PvpKnight.POSES.guard; f.clip = null; f.clipT = 0; f.clipDur = 1;
        } else if (canBlocky) {
          var character = UT.BlockyCharacter.create(T);
          if (spec && spec.config) character.apply(spec.config, true);
          else if (spec && Number.isInteger(spec.preset)) character.loadPreset(spec.preset);
          else if (spec && spec.local) character.loadFromPlayer();
          else character.loadPreset(i);
          character.tick(0.016);
          var model = character.root;
          model.scale.multiplyScalar(1.2);
          face.add(model);
          f.character = character; f.root = model;
        } else return;
        phys.position.set(x, 0, 0);
        f.shadow = shadowBlob(T); f.shadow.position.x = x;
        currentArena.scene.add(f.shadow);
        currentArena.scene.add(phys);
        fighters[i] = f;
      } catch (e) { console.error('[duel] karakter gagal untuk fighter ' + i, e); }
    });
    /* samakan tinggi model bidak dengan lawannya (rig karakter/ksatria) supaya kedua petarung sebanding */
    fighters.forEach(function (f, i) {
      if (!f || !f.staticModel) return;
      var th = 2.1, o = fighters[1 - i];
      try {
        if (o && o.root && !o.staticModel) {
          o.phys.updateMatrixWorld(true);
          var ob = new T.Box3().setFromObject(o.root), oh = ob.max.y - ob.min.y;
          if (oh > 0.8 && oh < 6) th = oh;
        }
      } catch (e) {}
      f.root.scale.setScalar(th / f.staticH);
    });
  }

  /* Kamera sinematik: sapuan intro, punch-in saat pukulan berat, slow-mo + zoom saat KO */
  function cinPunch(side, strength, hold) {
    if (!arena || options.reducedMotion) return;
    var c = arena.cin, f = fighters[side];
    /* zoom lebih halus & kamera nyaris tidak bergeser ke samping: petarung tetap satu garis, tidak terlalu dekat */
    /* TANPA ZOOM: kamera PVP tetap di posisi dasar (hanya slow-mo & getar yang tersisa) */
    c.focusX = 0; c.zoom = 0; c.rate = 7;
    c.slow = 0.35; c.slowUntil = arena.elapsedReal + (hold || 0.3);
    setTimeout(function () { if (arena) { arena.cin.zoom = 0; arena.cin.rate = 3.2; } }, Math.round((hold || 0.3) * 1000) + 250);
  }
  function cinIntro() {
    if (!arena) return;
    var c = arena.cin;
    /* TANPA ZOOM: kamera langsung di posisi dasar (tidak ada sapuan mendekat); petarung muncul jatuh dari atas (lihat renderArena) */
    c.px = 0; c.py = 2.2; c.pz = arena.baseZ; c.lx = 0; c.ly = 1.3 + LOOK_Y; c.fov = 36; c.rate = 8; c.zoom = 0; c.intro = 0;
  }
  function stepCamera(dt) {
    var c = arena.cin, cam = arena.camera, k = 1 - Math.exp(-c.rate * dt);
    var tx = c.focusX * 0.4 * c.zoom, tz = arena.baseZ - 2.6 * c.zoom, ty = 2.2 - 0.4 * c.zoom;
    var tlx = c.focusX * 0.7 * c.zoom, tly = 1.3 + LOOK_Y - 0.1 * c.zoom, tfov = 36 - 5 * c.zoom;
    c.px += (tx - c.px) * k; c.py += (ty - c.py) * k; c.pz += (tz - c.pz) * k;
    c.lx += (tlx - c.lx) * k; c.ly += (tly - c.ly) * k; c.fov += (tfov - c.fov) * k;
    c.shake = Math.max(0, c.shake - dt * 1.8);
    var sh = c.shake * c.shake * 0.35;
    cam.position.set(c.px + (Math.random() - 0.5) * sh, c.py + (Math.random() - 0.5) * sh, c.pz);
    cam.fov = c.fov; cam.updateProjectionMatrix();
    cam.lookAt(c.lx, c.ly, 0);
  }

  function startDefeat(side) {
    var f = fighters[side];
    if (!f || f.defeat || f.defeated) return;
    if (options.reducedMotion) { f.defeated = true; f.defeatDx = -f.direction * 1.5; setBasePose(f, 'defeat'); return; }
    f.clip = null; f.defeat = { t: 0, phase: -1 };
    setBasePose(f, 'down');          /* langsung terpental; fase berikutnya diatur stepDefeat */
    playSfx('whoosh');
    cinPunch(side, 0.9, 0.55);
  }
  function stepDefeat(f, dt, t) {
    var d = f.defeat, dir = f.direction, TT = DEFEAT_T, dx = 0, y = 0, tilt = 0, phase;
    d.t += dt;
    var u;
    if (d.t < TT.launch) {
      phase = 0; u = d.t / TT.launch;
      dx = -dir * 1.5 * ease3(u); y = 1.15 * Math.sin(Math.PI * u); tilt = dir * 1.45 * ease3(u);
    } else if (d.t < TT.bounce) {
      phase = 1; u = (d.t - TT.launch) / (TT.bounce - TT.launch);
      dx = -dir * 1.5; y = 0.15 * Math.sin(Math.PI * u); tilt = dir * 1.45;
    } else if (d.t < TT.sit) {
      phase = 2; u = ease3((d.t - TT.bounce) / (TT.sit - TT.bounce));
      dx = -dir * 1.5; tilt = dir * (1.45 * (1 - u) + 0.05 * u);
    } else if (d.t < TT.hold) {
      phase = 3; dx = -dir * 1.5; tilt = dir * 0.05;
    } else if (d.t < TT.stand) {
      phase = 4; dx = -dir * 1.5; tilt = 0;
    } else {
      phase = 5; dx = -dir * 1.5;
    }
    if (phase !== d.phase) {
      d.phase = phase;
      if (phase === 0) setBasePose(f, 'down');
      else if (phase === 1) {                       /* mendarat: debu, SFX, getar */
        spawnDust(f.phys.position.x, 0, 22, 1.5);
        playSfx('thud'); playSfx('dust'); playSfx('ko');
        arena.cin.shake = 0.9; UI.shake();
      } else if (phase === 2) { setBasePose(f, 'sit'); }
      else if (phase === 3) { spawnDust(f.phys.position.x, 0, 8, 0.8); playSfx('dust'); }
      else if (phase === 4) { setBasePose(f, 'defeat'); cinPunch(f.side, 0, 0.1); }
      else if (phase === 5) { f.defeat = null; f.defeated = true; f.defeatDx = dx; }
    }
    if (d.phase < 5 && f.defeat) { f.defeatDx = dx; }
    /* badan rebah berputar di poros kaki -> kepala/badan menyapu busur (terlihat 'terikat lingkaran'). Kompensasi: titik tengah badan (~0.9) dijaga lurus di garis lantai. */
    dx += 0.9 * Math.sin(tilt);
    y += 0.2 * Math.sin(Math.min(1.5, Math.abs(tilt)));
    return { dx: dx, y: y, tilt: tilt };
  }

  function renderArena(dt) {
    if (!arena || !root || root.hidden) return;
    arena.elapsedReal = (arena.elapsedReal || 0) + dt;
    var cin = arena.cin;
    if (cin.slow < 1 && arena.elapsedReal > cin.slowUntil) cin.slow = Math.min(1, cin.slow + dt * 3);
    var rdt = dt * cin.slow;                       /* slow-mo hanya untuk aksi karakter */
    arena.elapsed += rdt;
    var t = arena.elapsed;

    /* Torch flicker for fireL / fireR */
    if (arena.fireL && arena.fireR) {
      var fl = 0.9 + Math.sin(t * 13) * 0.08 + Math.sin(t * 21) * 0.05;
      arena.fireL.intensity = 0.9 * fl;
      arena.fireR.intensity = 0.9 * (1.9 - fl + 0.1);
    }

    fighters.forEach(function (fighter) {
      if (!fighter) return;
      fighter.intro = Math.min(1.3, fighter.intro + rdt);
      fighter.actionTime += rdt;
      fighter.hitTime = Math.max(0, fighter.hitTime - rdt);
      fighter.idleT = (fighter.idleT || 0) + rdt;

      /* Intro: JATUH DARI ATAS (gravitasi: makin cepat), petarung kanan menyusul sedikit; mendarat = debu + getar + squash */
      var introProgress = options.reducedMotion ? 1 : Math.min(1, Math.max(0, (fighter.intro - fighter.side * 0.16) / 1.0));
      var dropY = options.reducedMotion ? 0 : 9 * (1 - introProgress * introProgress);
      var offX = 0;
      var walking = introProgress < 1;      /* true = masih di udara */
      var justLanded = false;
      if (!walking && !fighter.dropLanded) {
        fighter.dropLanded = true;
        if (!options.reducedMotion) { justLanded = true; spawnDust(fighter.x, 0, 14, 1.0); playSfx('thud'); playSfx('dust'); arena.cin.shake = Math.max(arena.cin.shake, 0.35); }
      }

      /* Lunge saat menyerang */
      var lunge = 0;
      if ((fighter.action === 'attack' || fighter.action === 'critical' ||
           fighter.action === 'lifesteal' || fighter.action === 'berserk') &&
           fighter.actionTime < fighter.actionDuration) {
        var phase = fighter.actionTime / fighter.actionDuration;
        if (phase > 0.3 && phase < 0.75)
          lunge = Math.sin((phase - 0.3) / 0.45 * Math.PI) * 0.5;
      }
      /* Hentakan saat kena pukul */
      var hitP = fighter.heavyHit ? 0.68 : 0.38;
      var hitRecoil = fighter.hitTime
        ? Math.sin((1 - fighter.hitTime / hitP) * Math.PI) * (fighter.heavyHit ? 0.9 : 0.35)
        : 0;

      var px = fighter.x + offX + fighter.direction * lunge - fighter.direction * hitRecoil;
      var py = dropY, tilt = 0;
      if (fighter.defeat) {
        var df = stepDefeat(fighter, rdt, t);
        px = fighter.x + df.dx; py = df.y + dropY; tilt = df.tilt;
      } else if (fighter.defeated) {
        px = fighter.x + fighter.defeatDx;
      }
      /* Kaki menapak: root-model berdiri di y=0 (tumit rig = origin); hanya idle bob yang boleh menaikkan */
      /* IDLE SIAP PERANG: memantul di ujung kaki, menggeser langkah maju-mundur & condong ke lawan (bukan sekadar diam) */
      var calm = !fighter.defeat && !fighter.defeated && !walking && !fighter.hitTime && fighter.actionTime >= fighter.actionDuration;
      fighter.idleK = (fighter.idleK || 0) + ((calm ? 1 : 0) - (fighter.idleK || 0)) * Math.min(1, rdt * 6);
      var amp = (options.reducedMotion ? 0.25 : 1) * fighter.idleK;
      var rt = fighter.idleT * 4.4 + fighter.ph;
      px += fighter.direction * Math.sin(fighter.idleT * 1.6 + fighter.ph) * 0.11 * amp;
      tilt += -fighter.direction * (0.04 + 0.04 * Math.sin(rt)) * amp;
      /* ANCANG-ANCANG -> LOMPAT (fisika sungguhan, bukan melayang): menunggu dgn kuda-kuda -> jongkok (antisipasi) -> tolakan -> parabola gravitasi -> mendarat (squash + debu) */
      var J = fighter.jmp || (fighter.jmp = { st: 'wait', t: 0, wait: 0.9 + fighter.side * 0.8 + Math.random() * 0.8, y: 0, vy: 0 });
      var JG = 17, JV = 4.9, jc = 0;
      if (justLanded) { J.st = 'land'; J.t = 0; J.y = 0; J.vy = 0; }   /* squash saat mendarat dari jatuh */
      if (options.reducedMotion || fighter.defeat || fighter.defeated) { J.st = 'wait'; J.t = 0; J.y = 0; J.vy = 0; }
      else if (J.st === 'wait') { J.t += rdt; if (calm && J.t >= J.wait) { J.st = 'prep'; J.t = 0; } }
      else if (J.st === 'prep') {
        if (!calm) { J.st = 'wait'; J.t = 0; }
        else { J.t += rdt; jc = ease3(Math.min(1, J.t / 0.42)); if (J.t >= 0.42) { J.st = 'air'; J.vy = JV; J.y = 0.001; J.t = 0; } }
      } else if (J.st === 'air') {
        J.t += rdt; J.vy -= JG * rdt; J.y += J.vy * rdt;
        jc = -0.6 * Math.max(0, Math.min(1, J.vy / JV));                  /* meregang saat naik */
        if (J.y <= 0) { J.y = 0; J.vy = 0; J.st = 'land'; J.t = 0; spawnDust(px, 0, 7, 0.6); }
      } else if (J.st === 'land') {
        J.t += rdt; var lu = Math.max(0, 1 - J.t / 0.34); jc = lu * lu;      /* squash lalu pulih */
        if (J.t >= 0.34) { J.st = 'wait'; J.t = 0; J.wait = 1.3 + Math.random() * 1.8; }
      }
      var bob = (fighter.defeat || fighter.defeated) ? 0 : J.y;            /* tidak ada lagi gerak naik-turun melayang: kaki selalu menapak kecuali saat lompat */
      fighter.phys.position.set(px, py + bob, 0);
      /* kuda-kuda: lutut menekuk/memantul DI LANTAI lewat squash; saat lompat: jongkok -> meregang -> squash mendarat */
      var sq = jc + (J.st === 'wait' ? 0.12 * (0.5 + 0.5 * Math.sin(rt)) * amp : 0);
      if (fighter.face) fighter.face.scale.set(1 + 0.06 * sq, 1 - 0.13 * sq, 1 + 0.06 * sq);
      fighter.phys.rotation.z = tilt;
      if (fighter.shadow) {
        fighter.shadow.position.x = px + (fighter.defeat ? 0 : 0);
        var lift = Math.min(1, py / 1.2), lying = Math.abs(tilt) > 0.9 ? 1.25 : 1;
        fighter.shadow.scale.set((1 - lift * 0.45) * lying, 1, (1 - lift * 0.45));
      }

      if (fighter.kn) {
        /* ── PvpKnight ── */
        var targetPose = fighter.base || UT.PvpKnight.POSES.guard;
        if (fighter.clip && !fighter.defeat) {
          fighter.clipT = Math.min(1, fighter.clipT + rdt / fighter.clipDur);
          if (typeof UT.PvpKnight.sample === 'function')
            targetPose = UT.PvpKnight.sample(fighter.clip, fighter.clipT);
          if (fighter.clipT >= 1) { fighter.clip = null; }
        } else if (!fighter.defeat && !fighter.defeated && !walking) {
          /* IDLE: napas + geser berat badan + ayun lengan — terlihat jelas saat menunggu ronde */
          var base = fighter.base || UT.PvpKnight.POSES.guard;
          var ka = options.reducedMotion ? 0.25 : 1, kr = fighter.idleT * 4.4 + fighter.ph;
          var kb = Math.sin(kr) * 0.5 + 0.5;
          targetPose = Object.assign({}, base, {
            hy: (base.hy || 0) + (0.10 + kb * 0.10) * ka,                                  /* lutut menekuk, memantul */
            tx: (base.tx || 0) + (0.10 + Math.sin(kr) * 0.04) * ka,                        /* condong ke lawan */
            ty: (base.ty || 0) + Math.sin(fighter.idleT * 0.9 + fighter.ph) * 0.12 * ka,   /* badan memutar mengintai */
            ll: (base.ll || 0) + Math.sin(kr * 0.5) * 0.32 * ka,                           /* kaki bergantian menggeser langkah */
            rl: (base.rl || 0) - Math.sin(kr * 0.5) * 0.32 * ka,
            rx: (base.rx || 0) + Math.sin(kr * 0.5 + 0.6) * 0.2 * ka,                      /* lengan pedang siaga */
            sw: (base.sw || 0) + Math.sin(fighter.idleT * 2.3 + fighter.ph) * 0.3 * ka,    /* pedang diayun-ayun */
            lx: (base.lx || 0) - 0.35 * ka + Math.sin(kr + 1) * 0.12 * ka                  /* tangan kiri terangkat (guard) */
          });
          if (J.st === 'prep' || J.st === 'land') {            /* antisipasi / mendarat: jongkok dalam, lengan ditarik ke belakang */
            targetPose = Object.assign({}, targetPose, { hy: (targetPose.hy || 0) + 0.5 * jc, tx: (targetPose.tx || 0) + 0.28 * jc, rx: (targetPose.rx || 0) + 0.9 * jc, lx: (targetPose.lx || 0) + 0.9 * jc, ll: (targetPose.ll || 0) + 0.35 * jc, rl: (targetPose.rl || 0) - 0.35 * jc });
          } else if (J.st === 'air') {                          /* di udara: lengan & pedang terangkat, kaki ditekuk */
            targetPose = Object.assign({}, targetPose, { hy: 0, tx: -0.05, rx: -2.3, lx: -1.7, sw: 3.2, ll: -0.55, rl: 0.55 });
          }
        } else if (walking) {                                   /* jatuh dari atas: lengan terangkat, kaki ditekuk */
          targetPose = Object.assign({}, UT.PvpKnight.POSES.guard, { hy: 0, tx: -0.05, rx: -2.3, lx: -1.7, sw: 3.2, ll: -0.55, rl: 0.55 });
        }
        if (typeof UT.PvpKnight.applyPose === 'function')
          UT.PvpKnight.applyPose(fighter.kn, fighter.pose, targetPose, rdt, fighter.defeat ? 14 : 10);

        if (fighter.flash > 0) {
          if (fighter.kn.setFlash) fighter.kn.setFlash(fighter.flash);
          fighter.flash = Math.max(0, fighter.flash - rdt * 4);
        } else if (fighter.kn.setFlash) fighter.kn.setFlash(0);
        if (fighter.glow > 0) {
          if (fighter.kn.setGlow) fighter.kn.setGlow(fighter.glow);
          fighter.glow = Math.max(0, fighter.glow - rdt * 2);
        } else if (fighter.kn.setGlow) fighter.kn.setGlow(0);

        /* Jubah berkibar: ayunan angin + terseret ke belakang saat melangkah / menyerang / terpental */
        var drag = Math.min(1, Math.abs(lunge) * 1.6 + (walking ? 0.5 : 0) + (fighter.defeat ? 0.9 : 0) + fighter.hitTime);
        if (fighter.kn.cape1) {
          fighter.kn.cape1.rotation.x = 0.06 + Math.sin(t * 1.9 + fighter.ph) * 0.07 + drag * 0.42;
          fighter.kn.cape1.rotation.z = Math.sin(t * 1.3 + fighter.ph) * 0.05;
        }
        if (fighter.kn.cape2) {
          fighter.kn.cape2.rotation.x = Math.sin(t * 2.6 + fighter.ph + 1.1) * 0.13 + drag * 0.3;
          fighter.kn.cape2.rotation.z = Math.sin(t * 1.7 + fighter.ph + 0.4) * 0.07;
        }
      } else if (fighter.character) {
        fighter.character.tick(rdt);
        if (walking && fighter.character.setMode) { if (fighter.mode !== 'fall') { fighter.character.setMode('idle'); fighter.mode = 'fall'; } }
        else if (!fighter.defeat && !fighter.defeated && fighter.mode !== 'idle' && fighter.character.setMode && !walking) {
          fighter.character.setMode('idle'); fighter.mode = 'idle';
        }
        if (fighter.hitTime) fighter.phys.rotation.z += (fighter.heavyHit ? 0.35 : 0.15) * Math.sin((1 - fighter.hitTime / hitP) * Math.PI) * -fighter.direction;
      }
    });
    tickDust(rdt);
    stepCamera(dt);
    if (arena.dice) updateDice(dt);
    var r = arena.renderer;
    if (r.autoClear !== undefined) r.autoClear = true;
    r.render(arena.scene, arena.camera);
    if (arena.dice && r.clearDepth) {
      r.autoClear = false; r.clearDepth();
      r.render(arena.dice.scene, arena.dice.cam);
      r.autoClear = true;
    }
  }
  function startArena() {
    if (!arena) return;
    resizeArena();
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = resizeArena;
    window.addEventListener('resize', resizeHandler);
    var last = 0;
    arena.renderer.setAnimationLoop(function (time) {
      var now = (time || 0) / 1000;
      var dt = last ? Math.min(0.05, Math.max(0, now - last)) : 0.016;
      last = now;
      renderArena(dt);
    });
  }

  /* Skin dadu pemain dari katalog DiceKit (module ES, dimuat lazy; gagal = dadu bawaan) */
  var diceCatalogP = null;
  function loadDiceSkin(key, i) {
    try {
      if (!diceCatalogP) diceCatalogP = import('../../assets/js/renderers/dice-kit/dice-catalog.js');
      diceCatalogP.then(function (m) {
        var d = m.getDice ? m.getDice(key) : null, mt = d && d.material;
        if (!mt) return;
        diceSkins[i] = { face: mt.base || '#f4ead2', pip: (mt.pip && mt.pip.color) || '#1c2a4a', rim: mt.accent || '#d9b45a', rough: mt.roughness, metal: mt.metalness };
        applyDiceSkin(i);
      }).catch(function () {});
    } catch (e) {}
  }

  var UI = {
    open: function (o) {
      build(); finishIntro(); o = o || {}; closeToken++;
      try { window.dispatchEvent(new Event('ut:duel-open')); } catch (e) {}
      var names = o.names || ['P1', 'P2'], css = o.css || [], faces = o.faces || [];
      options.reducedMotion = !!o.reducedMotion;
      diceSkins = [null, null];
      (o.dice || []).slice(0, 2).forEach(function (key, i) { if (key) loadDiceSkin(key, i); });
      [0, 1].forEach(function (i) {
        el['name' + i].textContent = names[i];
        el['name' + i].style.setProperty('--pc', css[i] || '#ffd45a');
        if (faces[i]) el['face' + i].src = faces[i];
        else el['face' + i].removeAttribute('src');
      });
      el.card.hidden = true; el.card.innerHTML = ''; el.choose.hidden = true; el.choose.innerHTML = '';
      el.rollButton.hidden = false;
      el.dice.forEach(function (die) { die.textContent = '—'; die.removeAttribute('data-val'); });
      el.dieLabels.forEach(function (lb) { lb.textContent = ''; });
      el.rollButton.disabled = true; el.rollLabel.textContent = 'ROLL DICE';
      el.log.textContent = 'THE CLASH BEGINS';
      UI.state([3, 3], [0, 0]); UI.actions([0, 0]);
      document.body.classList.add('duel-active');
      root.hidden = false; root.classList.remove('out', 'selecting', 'shake', 'intro', 'result', 'cine');
      void root.offsetWidth; root.classList.add('in', 'intro');
      if (!options.reducedMotion) root.classList.add('cine');   /* letterbox sinematik */
      makeFighters(o.fighters);
      if (arena) {
        arena.elapsedReal = 0; arena.cin.slow = 1; arena.cin.zoom = 0; arena.cin.shake = 0; arena.cin.focusX = 0;
        if (arena.dice) arena.dice.items.forEach(function (d, i) { d.mode = 'idle'; d.value = 0; applyDiceSkin(i); });
        cinIntro();
      }
      startArena();
    },
    chooseOpponent: function (foes) {
      build(); el.choose.innerHTML = ''; el.choose.appendChild(mk('b', null, 'PILIH LAWAN'));
      el.choose.hidden = false; root.classList.add('selecting');
      return new Promise(function (resolve) {
        foes.forEach(function (foe, i) {
          var button = mk('button', null, foe.name);
          button.type = 'button'; button.style.setProperty('--pc', foe.css || '#ffd45a');
          button.addEventListener('click', function () { el.choose.hidden = true; root.classList.remove('selecting'); resolve(i); }, { once: true });
          el.choose.appendChild(button);
        });
      });
    },
    intro: function () {
      build(); finishIntro();
      el.log.textContent = 'WEAPONS DRAWN · GET READY';
      root.classList.add('intro');
      if (options.reducedMotion) { root.classList.remove('cine', 'intro'); return Promise.resolve(); }
      root.classList.add('cine');
      el.skipButton.hidden = false;
      /* VS menghantam layar di tengah sinematik */
      setTimeout(function () { if (root && !root.hidden) { playSfx('hit'); UI.shake(); if (arena) arena.cin.shake = 0.5; } }, 1250);
      return new Promise(function (resolve) {
        introResolver = resolve;
        introTimer = setTimeout(finishIntro, 2400);
      });
    },
    waitForRoll: function (round) {
      build();
      el.rollLabel.textContent = 'ROLL DICE · ROUND ' + round;
      el.rollButton.disabled = false;
      if (arena && arena.dice) arena.dice.items.forEach(function (d) { d.mode = 'idle'; d.t = 0; });
      el.dice.forEach(function (die) { die.textContent = '—'; die.removeAttribute('data-val'); });
      el.dieLabels.forEach(function (lb) { lb.textContent = ''; });
      return new Promise(function (resolve) {
        if (rollResolver) rollResolver(false);
        rollResolver = resolve;
        startRollTimer(round);
      });
    },
    /* Online: kunci tombol ROLL (sudah tap / menunggu lawan / penonton). Melepas janji waitForRoll yang masih menggantung (hasil false). */
    lockRoll: function (label) {
      build(); clearRollTimer();
      el.rollButton.disabled = true;
      if (label) el.rollLabel.textContent = label;
      if (rollResolver) { var resolve = rollResolver; rollResolver = null; resolve(false); }
    },
    revealRolls: function (values) {
      build();
      var d3 = arena && arena.dice, quick = options.reducedMotion || !d3;
      if (d3 && d3.items[0].mode !== 'tumble' && !quick) startDiceTumble();   /* dadu CPU / auto-roll: tetap berguling */
      var minTumble = quick ? 0 : 520;
      return new Promise(function (resolve) {
        setTimeout(function () {
          [0, 1].forEach(function (i) {
            setTimeout(function () {
              if (!root || root.hidden) return;
              if (d3 && !quick) landDie(i, values[i]);
              else if (d3) { var d = d3.items[i]; d.value = values[i]; d.q1.copy(dieTargetQuat(window.THREE, values[i])); d.mesh.quaternion.copy(d.q1); d.mode = 'rest'; }
              playSfx('land');
              el.dice[i].textContent = String(values[i]);
              el.dice[i].setAttribute('data-val', String(values[i]));
              var act = ACTIONS[values[i]];
              el.dieLabels[i].textContent = act ? act[0] : '';
              el.dice[i].classList.remove('pop'); void el.dice[i].offsetWidth; el.dice[i].classList.add('pop');
            }, quick ? 0 : i * 140);
          });
          setTimeout(resolve, quick ? 0 : 140 + 600);
        }, minTumble);
      });
    },
    state: function (hp, mom, max) {
      build(); max = max || 3;
      [0, 1].forEach(function (i) {
        var hpEl = el['hp' + i];
        var oldHp = hpEl ? parseInt((hpEl.dataset && hpEl.dataset.hp) || hpEl._lastHp || max, 10) : max;
        if (hpEl) {
          if (hpEl.dataset) hpEl.dataset.hp = hp[i];
          hpEl._lastHp = hp[i];
        }
        updateHearts(hpEl || el['hp' + i], hp[i], oldHp, max);
        updateMom(el['mom' + i], mom[i], max);
      });
    },
    actions: function (vals) {
      build();
      [0, 1].forEach(function (i) {
        var action = ACTIONS[vals[i]];
        el['actionName' + i].textContent = action ? action[0] : 'READY';
        el['actionDesc' + i].textContent = action ? action[1] : 'ROLLING COMBAT DICE';
        var extra = action && action[2] ? ' ' + action[2] : (vals[i] === 4 ? ' critical' : vals[i] === 6 ? ' berserk' : '');
        el['action' + i].className = 'du-action' + extra;
      });
    },
    act: function (side, type, duration) {
      var fighter = fighters[side];
      if (type === 'block') playSfx('guard');
      else if (type === 'heal' || type === 'regen') playSfx('heal');
      if (!fighter) return;
      if (type === 'sad' || type === 'ko') { startDefeat(side); fighter.action = type; fighter.actionTime = 0; return; }
      if (fighter.defeat || fighter.defeated) return;

      if (fighter.kn && UT.PvpKnight && UT.PvpKnight.POSES) {
        /* ── PvpKnight pose trigger ── */
        var POSES = UT.PvpKnight.POSES;
        var CLIPS = {
          attack:    { keys: POSES.atk ? POSES.atk[0] : null, dur: 0.6 },
          lifesteal: { keys: POSES.atk ? POSES.atk[1] || POSES.atk[0] : null, dur: 0.6 },
          critical:  { keys: POSES.smite || null, dur: 1.0 },
          berserk:   { keys: POSES.holy  || null, dur: 0.9 }
        };
        var clip = CLIPS[type];
        if (clip && clip.keys) {
          fighter.clip = clip.keys; fighter.clipT = 0; fighter.clipDur = clip.dur;
          fighter.base = POSES.guard;
        } else if (type === 'block' || type === 'defense') {
          fighter.base = POSES.block || POSES.guard;
          if (fighter.kn.shield) fighter.kn.shield.visible = true;
        } else if (type === 'regen' || type === 'heal') {
          fighter.base = POSES.guard;
          fighter.glow = 0.9;
        } else if (type === 'win' || type === 'cheer') {
          fighter.base = POSES.win || POSES.guard;
        } else if (type === 'sad' || type === 'ko') {
          fighter.base = POSES.ko || POSES.hurt || POSES.guard;
        } else {
          /* dodge, etc. */
          fighter.base = POSES.dodge || POSES.guard;
        }
      } else if (fighter.character && fighter.character.act) {
        /* Karakter asli (BlockyCharacter): semua serangan = ayunan senjata */
        var map = { critical: 'attack', berserk: 'attack', lifesteal: 'attack', regen: 'cheer', heal: 'cheer', win: 'cheer' };
        fighter.character.act(map[type] || type, duration);
        if (type === 'regen' || type === 'heal') fighter.glow = 0.9;
      }

      fighter.action = type;
      fighter.actionTime = 0;
      fighter.actionDuration = duration || (type === 'attack' ? 0.75 : 0.9);
    },
    banner: function (text, cls) {
      build(); el.banner.textContent = text; el.banner.className = 'du-banner' + (cls ? ' ' + cls : '');
      root.classList.remove('intro');
    },
    log: function (text) { build(); el.log.textContent = text; },
    pop: function (side, text, cls) {
      build();
      var p = mk('div', 'du-pop ' + (cls || ''), text);
      p.style[side === 0 ? 'left' : 'right'] = '31%';
      el.pops.appendChild(p);
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1200);
    },
    impact: function (side, cls) {
      build();
      if (cls === 'block') playSfx('block');
      else if (cls === 'heavy') playSfx('crit');
      else playSfx('hit');
      var target = el['fighter' + side];
      target.classList.remove('hit', 'heavy', 'block');
      void target.offsetWidth;
      target.classList.add('hit');
      if (cls) target.classList.add(cls);
      if (fighters[side]) {
        fighters[side].hitTime = cls === 'heavy' ? 0.68 : 0.38;
        fighters[side].heavyHit = cls === 'heavy';
        var hf = fighters[side];
        if (hf.kn) {
          hf.flash = cls === 'heavy' ? 1.0 : 0.6;
          if (cls === 'block') hf.glow = 0.85;
          /* pose luka pada pukulan berat; jangan menimpa urutan kalah */
          if (cls === 'heavy' && UT.PvpKnight && UT.PvpKnight.POSES && !hf.defeat && !hf.defeated) {
            hf.base = UT.PvpKnight.POSES.hurt || UT.PvpKnight.POSES.guard;
            setTimeout(function () {
              if (fighters[side] && fighters[side].kn && !fighters[side].defeat && !fighters[side].defeated)
                fighters[side].base = UT.PvpKnight.POSES.guard;
            }, 600);
          }
        }
        if (cls === 'heavy' && !hf.defeat && !hf.defeated) { cinPunch(side, 0.7, 0.28); if (arena) arena.cin.shake = 0.6; }
        else if (cls !== 'block' && arena && !hf.defeat) arena.cin.shake = Math.max(arena.cin.shake, 0.3);
        if (!hf.defeat && !hf.defeated && arena) spawnDust(hf.phys.position.x, 0, cls === 'heavy' ? 8 : 3, 0.6);
      }
      root.classList.add('impact');
      el.flash.className = 'du-flash active';
      setTimeout(function () {
        target.classList.remove('hit', 'heavy', 'block');
        el.flash.className = 'du-flash';
        root.classList.remove('impact');
      }, 420);
    },
    shake: function () {
      build(); root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
      setTimeout(function () { if (root) root.classList.remove('shake'); }, 420);
    },
    result: function (title, lines, outcome) {
      build(); root.classList.add('result'); el.card.innerHTML = '';
      el.rollButton.hidden = true; clearRollTimer();
      if (outcome === 'win') playSfx('victory');
      else playSfx('defeat');
      /* warna kontekstual: win / lose / draw */
      var ctx = outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : outcome === 'draw' ? 'draw' : '';
      el.card.className = 'du-card' + (ctx ? ' ' + ctx : '');
      /* letter-drop title */
      var titleEl = document.createElement('b');
      titleEl.innerHTML = title.split('').map(function (c, idx) {
        return '<span style="animation-delay:' + (idx * 0.07) + 's">' +
               (c === ' ' ? '&nbsp;' : c) + '</span>';
      }).join('');
      el.card.appendChild(titleEl);
      (lines || []).forEach(function (line) { el.card.appendChild(mk('div', null, line)); });
      el.card.hidden = false;
    },
    close: function () {
      if (!root) return;
      try { window.dispatchEvent(new Event('ut:duel-close')); } catch (e) {}
      finishIntro(); clearRollTimer();
      if (rollResolver) { var resolve = rollResolver; rollResolver = null; resolve(false); }
      if (el._keyHandler) window.removeEventListener('keydown', el._keyHandler);
      el.choose.hidden = true; root.classList.remove('selecting'); root.classList.add('out');
      var token = ++closeToken;
      setTimeout(function () {
        if (!root || token !== closeToken) return;
        root.hidden = true; root.classList.remove('in', 'out', 'intro', 'result');
        document.body.classList.remove('duel-active');
        if (arena) arena.renderer.setAnimationLoop(null);
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
        clearFighters();
        root.classList.remove('cine');
      }, 260);
    }
  };
  UT.GameplayDuelUI = UI;
})();
