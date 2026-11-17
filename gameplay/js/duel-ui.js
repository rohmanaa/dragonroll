/* Ular Tangga Blok — gameplay/js/duel-ui.js
   TAMPILAN DUEL PVP (overlay DOM): Hearts, Momentum, dadu, banner ronde, teks damage, kartu hasil.
   Tidak berisi aturan (lihat duel-core.js) dan tidak menyentuh THREE/pion; efek 3D (hit, guncangan, aksi pion)
   dipanggil oleh main.js lewat helper yang sudah ada. Hormati prefers-reduced-motion lewat CSS. */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var root = null, el = {};
  var NAMES = { 1: 'Defense', 2: 'Regeneration', 3: 'Attack', 4: 'Critical', 5: 'Lifesteal', 6: 'Berserk' };

  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function hearts(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<span class="du-h' + (i < n ? '' : ' off') + '">\u2665</span>'; return s; }
  function moms(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return s; }

  function build() {
    if (root) return;
    root = mk('div', 'du'); root.id = 'duelUI'; root.hidden = true; root.setAttribute('aria-live', 'polite');
    ['l', 'r'].forEach(function (k, i) {
      var side = mk('div', 'du-side du-' + k);
      el['name' + i] = mk('div', 'du-name'); el['hp' + i] = mk('div', 'du-hp'); el['mom' + i] = mk('div', 'du-mom');
      side.appendChild(el['name' + i]); side.appendChild(el['hp' + i]); side.appendChild(el['mom' + i]); root.appendChild(side);
    });
    el.banner = mk('div', 'du-banner'); root.appendChild(el.banner);
    var dice = mk('div', 'du-dice');
    [0, 1].forEach(function (i) { var d = mk('div', 'du-die'); el['die' + i] = d; d.appendChild(mk('b', null, '-')); d.appendChild(mk('span', null, '\u00a0')); dice.appendChild(d); });
    root.appendChild(dice);
    el.pops = mk('div', 'du-pops'); root.appendChild(el.pops);
    el.card = mk('div', 'du-card'); el.card.hidden = true; root.appendChild(el.card);
    document.body.appendChild(root);
  }

  var UI = {
    open: function (o) {
      build(); o = o || {}; var n = o.names || ['P1', 'P2'], c = o.css || [];
      [0, 1].forEach(function (i) { el['name' + i].textContent = n[i]; el['name' + i].style.setProperty('--pc', c[i] || '#ffd45a'); });
      el.card.hidden = true; el.card.innerHTML = ''; el.banner.textContent = ''; UI.dice(null);
      UI.state([3, 3], [0, 0]); root.hidden = false; root.classList.remove('out'); void root.offsetWidth; root.classList.add('in');
    },
    state: function (hp, mom, max) { build(); max = max || 3; [0, 1].forEach(function (i) { el['hp' + i].innerHTML = hearts(hp[i], max); el['mom' + i].innerHTML = moms(mom[i], max); }); },
    banner: function (t, cls) { build(); el.banner.textContent = t; el.banner.className = 'du-banner' + (cls ? ' ' + cls : ''); },
    dice: function (vals, rolling) {
      build();
      [0, 1].forEach(function (i) {
        var d = el['die' + i]; d.className = 'du-die' + (rolling ? ' roll' : '');
        d.firstChild.textContent = rolling ? (1 + Math.floor(Math.random() * 6)) : (vals ? vals[i] : '-');
        d.lastChild.textContent = (!rolling && vals) ? NAMES[vals[i]] : '\u00a0';
      });
    },
    pop: function (side, text, cls) {
      build(); var p = mk('div', 'du-pop ' + (cls || ''), text); p.style[side === 0 ? 'left' : 'right'] = '14%'; el.pops.appendChild(p);
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1100);
    },
    shake: function () { build(); root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); },
    result: function (title, lines) {
      build(); el.card.innerHTML = ''; el.card.appendChild(mk('b', null, title));
      (lines || []).forEach(function (l) { el.card.appendChild(mk('div', null, l)); }); el.card.hidden = false;
    },
    close: function () { if (!root) return; root.classList.add('out'); setTimeout(function () { if (root) { root.hidden = true; root.classList.remove('in', 'out'); } }, 260); }
  };
  UT.GameplayDuelUI = UI;
})();
