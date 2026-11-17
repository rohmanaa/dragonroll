/* Ular Tangga Blok — duel PVP: arena cinematic, rigged Three.js fighters, HUD versus, and FX. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var root = null, el = {}, arena = null, fighters = [null, null], closeToken = 0, resizeHandler = null, rollResolver = null, introResolver = null, introTimer = 0;
  var options = { reducedMotion: false };
  var ACTIONS = {
    1: ['DEFENSE', 'BLOCK 1 DAMAGE'],
    2: ['REGENERATION', 'RESTORE 1 HEART'],
    3: ['ATTACK', 'DEAL 1 DAMAGE'],
    4: ['CRITICAL', 'DEAL 2 DAMAGE · +2 MOMENTUM'],
    5: ['LIFESTEAL', 'DAMAGE 1 · HEAL 1'],
    6: ['BERSERK', 'DEAL 2 · PIERCE DEFENSE']
  };

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function hearts(n, max) {
    var s = '';
    for (var i = 0; i < max; i++) s += '<span class="du-heart' + (i < n ? ' on' : '') + '">&#9829;</span>';
    return s;
  }
  function moms(n, max) {
    var s = '';
    var filled = Math.round(n / max * 5);
    for (var i = 0; i < 5; i++) s += '<i class="' + (i < filled ? 'on' : '') + '"></i>';
    return s;
  }
  function finishIntro() {
    if (introTimer) clearTimeout(introTimer);
    introTimer = 0;
    if (el.skipButton) el.skipButton.hidden = true;
    if (root) root.classList.remove('intro');
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
      stats.appendChild(el['name' + i]); stats.appendChild(el['hp' + i]); stats.appendChild(momentum);
      side.appendChild(avatar); side.appendChild(stats); top.appendChild(side);
    });
    var title = mk('div', 'du-title');
    title.appendChild(mk('b', null, 'PVP CLASH'));
    el.banner = mk('span', 'du-banner', 'ROUND 1');
    title.appendChild(el.banner); top.appendChild(title); root.appendChild(top);

    var arena = mk('div', 'du-arena');
    el.scene = mk('div', 'du-scene');
    arena.appendChild(el.scene);
    [0, 1].forEach(function (i) {
      var fighter = mk('section', 'du-fighter du-fighter-' + i);
      el['fighter' + i] = fighter;
      el['action' + i] = mk('div', 'du-action');
      el['actionName' + i] = mk('b', null, 'READY');
      el['actionDesc' + i] = mk('span');
      el['action' + i].appendChild(el['actionName' + i]); el['action' + i].appendChild(el['actionDesc' + i]);
      fighter.appendChild(el['action' + i]); arena.appendChild(fighter);
    });
    el.versus = mk('div', 'du-versus', 'VS'); arena.appendChild(el.versus);
    root.appendChild(arena);

    el.log = mk('div', 'du-log', 'THE CLASH BEGINS');
    root.appendChild(el.log);
    el.rollStage = mk('div', 'du-roll-stage');
    el.dice = [mk('div', 'du-die', '—'), mk('div', 'du-die', '—')];
    el.dice.forEach(function (die) { el.rollStage.appendChild(die); });
    root.appendChild(el.rollStage);
    el.rollButton = mk('button', 'du-roll-button');
    el.rollButton.type = 'button';
    el.rollIcon = mk('img');
    el.rollIcon.src = 'assets/images/ui/gameplay-actions/roll.webp';
    el.rollIcon.alt = '';
    el.rollButton.appendChild(el.rollIcon);
    el.rollLabel = mk('span', null, 'ROLL DICE');
    el.rollButton.appendChild(el.rollLabel);
    el.rollButton.addEventListener('click', function () {
      if (!rollResolver || el.rollButton.disabled) return;
      el.rollButton.disabled = true;
      el.rollLabel.textContent = 'ROLLING...';
      var resolve = rollResolver;
      rollResolver = null;
      resolve(true);
    });
    root.appendChild(el.rollButton);
    el.skipButton = mk('button', 'du-skip');
    el.skipButton.type = 'button';
    el.skipButton.setAttribute('aria-label', 'Lewati animasi duel');
    el.skipImage = mk('img');
    el.skipImage.src = 'gameplay/assets/duel/hud-skip.webp';
    el.skipImage.alt = '';
    el.skipButton.appendChild(el.skipImage);
    el.skipButton.hidden = true;
    el.skipButton.addEventListener('click', finishIntro);
    root.appendChild(el.skipButton);
    el.pops = mk('div', 'du-pops'); root.appendChild(el.pops);
    el.flash = mk('div', 'du-flash'); root.appendChild(el.flash);
    el.choose = mk('div', 'du-choose'); el.choose.hidden = true; root.appendChild(el.choose);
    el.card = mk('div', 'du-card'); el.card.hidden = true; root.appendChild(el.card);
    document.body.appendChild(root);
  }

  function resizeArena() {
    if (!arena) return;
    var rect = el.scene.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    var height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    arena.renderer.setSize(width, height, false);
    arena.camera.aspect = width / height;
    arena.camera.updateProjectionMatrix();
  }
  function ensureArena() {
    if (arena) return arena;
    var T = window.THREE;
    if (!T || !T.WebGLRenderer || !UT.BlockyCharacter || !UT.BlockyCharacter.create) {
      console.error('[duel] Three.js atau rig karakter tidak tersedia');
      return null;
    }
    try {
      var scene = new T.Scene();
      var camera = new T.PerspectiveCamera(36, 1, 0.1, 40);
      camera.position.set(0, 1.75, 6.4); camera.lookAt(0, 1.05, 0);
      scene.add(new T.HemisphereLight(0xe9dcff, 0x22132c, 1.7));
      var key = new T.DirectionalLight(0xffe6c6, 2.1); key.position.set(-2.8, 5, 4); scene.add(key);
      var rim = new T.PointLight(0xffb64e, 2.3, 10); rim.position.set(0, 2.8, -1.5); scene.add(rim);
      var floor = new T.Mesh(new T.CircleGeometry(2.7, 48), new T.MeshBasicMaterial({
        color: 0x5d321a, transparent: true, opacity: 0.32, depthWrite: false
      }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.035; scene.add(floor);
      var ring = new T.Mesh(new T.RingGeometry(2.1, 2.16, 48), new T.MeshBasicMaterial({
        color: 0xffc35b, transparent: true, opacity: 0.78, side: T.DoubleSide, depthWrite: false
      }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.02; scene.add(ring);
      var renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = 'du-scene-canvas';
      renderer.domElement.setAttribute('aria-label', 'Karakter duel 3D');
      el.scene.appendChild(renderer.domElement);
      arena = { scene: scene, camera: camera, renderer: renderer, elapsed: 0 };
      return arena;
    } catch (e) {
      console.error('[duel] Gagal membuat arena Three.js', e);
      return null;
    }
  }
  function disposeTree(rootNode) {
    if (!rootNode || !rootNode.traverse) return;
    rootNode.traverse(function (node) {
      if (node.geometry && node.geometry.dispose) node.geometry.dispose();
      var materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
      materials.forEach(function (material) {
        if (material.map && material.map.dispose) material.map.dispose();
        if (material.dispose) material.dispose();
      });
    });
  }
  function clearFighters() {
    if (!arena) return;
    fighters.forEach(function (fighter, i) {
      if (!fighter) return;
      arena.scene.remove(fighter.root);
      disposeTree(fighter.root);
      fighters[i] = null;
    });
  }
  function makeFighters(specs) {
    clearFighters();
    if (!Array.isArray(specs)) return;
    var currentArena = ensureArena();
    if (!currentArena) return;
    specs.slice(0, 2).forEach(function (spec, i) {
      try {
        var character = UT.BlockyCharacter.create(window.THREE);
        if (spec && spec.config) character.apply(spec.config, true);
        else if (spec && Number.isInteger(spec.preset)) character.loadPreset(spec.preset);
        else if (spec && spec.local) character.loadFromPlayer();
        else character.loadPreset(i);
        character.tick(0.016);
        var model = character.root;
        model.scale.multiplyScalar(0.86);
        var baseScale = model.scale.clone();
        var direction = i === 0 ? 1 : -1;
        var x = i === 0 ? -1.38 : 1.38;
        model.rotation.y = i === 0 ? Math.PI / 2 : -Math.PI / 2;
        model.position.set(x - direction * 1.05, 0, 0);
        model.scale.set(baseScale.x * 0.18, baseScale.y * 0.18, baseScale.z * 0.18);
        currentArena.scene.add(model);
        fighters[i] = {
          character: character, root: model, baseScale: baseScale, x: x, direction: direction,
          intro: 0, action: '', actionTime: 0, actionDuration: 0, hitTime: 0, heavyHit: false
        };
      } catch (e) {
        console.error('[duel] Gagal menyiapkan karakter ' + i, e);
      }
    });
  }
  function renderArena(dt) {
    if (!arena || !root || root.hidden) return;
    arena.elapsed += dt;
    fighters.forEach(function (fighter) {
      if (!fighter) return;
      fighter.character.tick(dt);
      fighter.intro = Math.min(0.72, fighter.intro + dt);
      fighter.actionTime += dt;
      fighter.hitTime = Math.max(0, fighter.hitTime - dt);
      var introProgress = options.reducedMotion ? 1 : Math.min(1, fighter.intro / 0.72);
      var ease = 1 - Math.pow(1 - introProgress, 3);
      var lunge = 0;
      if (fighter.action === 'attack' && fighter.actionTime < fighter.actionDuration) {
        var phase = fighter.actionTime / fighter.actionDuration;
        if (phase > 0.34 && phase < 0.72) lunge = Math.sin((phase - 0.34) / 0.38 * Math.PI) * 0.26;
      }
      var hitProgress = fighter.heavyHit ? 0.68 : 0.38;
      var hit = fighter.hitTime ? Math.sin((1 - fighter.hitTime / hitProgress) * Math.PI) * (fighter.heavyHit ? 0.72 : 0.24) : 0;
      fighter.root.position.x = fighter.x - fighter.direction * (1.05 * (1 - ease)) + fighter.direction * lunge - fighter.direction * hit;
      fighter.root.position.y = Math.sin(introProgress * Math.PI) * 0.07;
      var scale = 0.18 + ease * 0.82;
      fighter.root.scale.set(fighter.baseScale.x * scale, fighter.baseScale.y * scale, fighter.baseScale.z * scale);
      fighter.root.rotation.z = hit * (fighter.direction > 0 ? -0.55 : 0.55);
    });
    arena.renderer.render(arena.scene, arena.camera);
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

  var UI = {
    open: function (o) {
      build(); finishIntro(); o = o || {}; closeToken++;
      var names = o.names || ['P1', 'P2'], css = o.css || [], faces = o.faces || [];
      options.reducedMotion = !!o.reducedMotion;
      [0, 1].forEach(function (i) {
        el['name' + i].textContent = names[i];
        el['name' + i].style.setProperty('--pc', css[i] || '#ffd45a');
        if (faces[i]) el['face' + i].src = faces[i];
        else el['face' + i].removeAttribute('src');
      });
      el.card.hidden = true; el.card.innerHTML = ''; el.choose.hidden = true; el.choose.innerHTML = '';
      el.rollStage.hidden = true; el.rollButton.hidden = false;
      el.dice.forEach(function (die) { die.textContent = '—'; });
      el.rollButton.disabled = true; el.rollLabel.textContent = 'ROLL DICE';
      el.log.textContent = 'THE CLASH BEGINS'; el.versus.textContent = 'VS';
      UI.state([3, 3], [0, 0]); UI.actions([0, 0]);
      document.body.classList.add('duel-active');
      root.hidden = false; root.classList.remove('out', 'selecting', 'shake', 'intro', 'result');
      void root.offsetWidth; root.classList.add('in', 'intro');
      makeFighters(o.fighters);
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
      if (options.reducedMotion) return Promise.resolve();
      el.skipButton.hidden = false;
      return new Promise(function (resolve) {
        introResolver = resolve;
        introTimer = setTimeout(finishIntro, 900);
      });
    },
    waitForRoll: function (round) {
      build();
      el.rollLabel.textContent = 'ROLL DICE · ROUND ' + round;
      el.rollButton.disabled = false;
      el.rollStage.hidden = true;
      return new Promise(function (resolve) {
        if (rollResolver) rollResolver(false);
        rollResolver = resolve;
      });
    },
    revealRolls: function (values) {
      build();
      el.rollStage.hidden = false;
      el.dice.forEach(function (die, i) { die.textContent = String(values[i]); });
      el.rollStage.classList.remove('rolling');
      void el.rollStage.offsetWidth;
      el.rollStage.classList.add('rolling');
      return new Promise(function (resolve) {
        setTimeout(function () { el.rollStage.classList.remove('rolling'); resolve(); }, options.reducedMotion ? 0 : 620);
      });
    },
    state: function (hp, mom, max) {
      build(); max = max || 3;
      [0, 1].forEach(function (i) {
        el['hp' + i].innerHTML = hearts(hp[i], max);
        el['mom' + i].innerHTML = moms(mom[i], max);
        el['mom' + i].setAttribute('aria-label', 'Momentum ' + mom[i] + ' dari ' + max);
      });
    },
    actions: function (vals) {
      build();
      [0, 1].forEach(function (i) {
        var action = ACTIONS[vals[i]];
        el['actionName' + i].textContent = action ? action[0] : 'READY';
        el['actionDesc' + i].textContent = action ? action[1] : 'ROLLING COMBAT DICE';
        el['action' + i].className = 'du-action' + (vals[i] === 4 ? ' critical' : vals[i] === 6 ? ' berserk' : '');
      });
    },
    act: function (side, type, duration) {
      var fighter = fighters[side];
      if (!fighter || !fighter.character.act) return;
      fighter.character.act(type, duration);
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
      var target = el['fighter' + side];
      target.classList.remove('hit', 'heavy', 'block');
      void target.offsetWidth;
      target.classList.add('hit');
      if (cls) target.classList.add(cls);
      if (fighters[side]) {
        fighters[side].hitTime = cls === 'heavy' ? 0.68 : 0.38;
        fighters[side].heavyHit = cls === 'heavy';
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
    result: function (title, lines) {
      build(); root.classList.add('result'); el.card.innerHTML = '';
      el.rollStage.hidden = true; el.rollButton.hidden = true;
      el.card.appendChild(mk('b', null, title));
      (lines || []).forEach(function (line) { el.card.appendChild(mk('div', null, line)); });
      el.card.hidden = false;
    },
    close: function () {
      if (!root) return;
      finishIntro();
      if (rollResolver) { var resolve = rollResolver; rollResolver = null; resolve(false); }
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
      }, 260);
    }
  };
  UT.GameplayDuelUI = UI;
})();
