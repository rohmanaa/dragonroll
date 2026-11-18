/* Ular Tangga Blok — duel PVP: arena cinematic, rigged Three.js fighters, HUD versus, and FX. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var root = null, el = {}, arena = null, fighters = [null, null], closeToken = 0, resizeHandler = null, rollResolver = null, introResolver = null, introTimer = 0;
  var options = { reducedMotion: false };
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
    el.dieLabels = [mk('div', 'du-die-label', ''), mk('div', 'du-die-label', '')];
    el.dice.forEach(function (die, i) {
      var wrap = mk('div', 'du-die-wrap');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center';
      wrap.appendChild(die);
      wrap.appendChild(el.dieLabels[i]);
      el.rollStage.appendChild(wrap);
    });
    root.appendChild(el.rollStage);
    el.rollButton = mk('button', 'du-roll-button');
    el.rollButton.type = 'button';
    el.rollIcon = mk('img');
    el.rollIcon.src = 'assets/images/ui/gameplay-actions/roll.webp';
    el.rollIcon.alt = '';
    el.rollButton.appendChild(el.rollIcon);
    el.rollLabel = mk('span', null, 'ROLL DICE');
    el.rollButton.appendChild(el.rollLabel);
    var kbdHint = mk('kbd', null, 'SPACE');
    el.rollButton.appendChild(kbdHint);
    el.rollButton.addEventListener('click', function () {
      if (!rollResolver || el.rollButton.disabled) return;
      el.rollButton.disabled = true;
      el.rollLabel.textContent = 'ROLLING...';
      playSfx('roll');
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
      playSfx('land');
      el.rollStage.hidden = false;
      el.dice.forEach(function (die, i) {
        die.textContent = String(values[i]);
        die.setAttribute('data-val', String(values[i]));
        if (el.dieLabels && el.dieLabels[i]) {
          var act = ACTIONS[values[i]];
          el.dieLabels[i].textContent = act ? act[0] : '';
        }
      });
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
      el.rollStage.hidden = true; el.rollButton.hidden = true;
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
      finishIntro();
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
      }, 260);
    }
  };
  UT.GameplayDuelUI = UI;
})();
