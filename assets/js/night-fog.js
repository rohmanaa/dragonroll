/* NightFog — kabut malam (3 lapis, CSS; lihat assets/css/night-fog.css). Tampil hanya saat html[data-ambience="night"].
   Pakai:  UT.NightFog.mount(host, {variant:'bottom'|'player', before:node, after:node}) -> {el, destroy()}
   'player' = kabut gelap di belakang karakter lobby: posisi mengikuti geometri latar yang sama dengan penempatan karakter (lobby.html placeHero). */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  if (UT.NightFog) return;
  var BG_W = 1672, BG_H = 941, FLOOR_Y = .79; /* sama dengan lobby.html (latar cover, telapak kaki karakter di FLOOR_Y) */

  function mount(host, o) {
    o = o || {}; host = host || document.body;
    var v = o.variant || 'bottom', el = document.createElement('div');
    el.className = 'nfog nfog-' + v; el.setAttribute('aria-hidden', 'true');
    for (var n = 1; n <= 3; n++) {
      var l = document.createElement('div'); l.className = 'nfl l' + n;
      l.appendChild(document.createElement('i')); l.appendChild(document.createElement('i')); el.appendChild(l);
    }
    if (o.before && o.before.parentNode === host) host.insertBefore(el, o.before);
    else if (o.after && o.after.parentNode === host) host.insertBefore(el, o.after.nextSibling);
    else host.appendChild(el);
    var place = null;
    if (v === 'player') {
      place = function () {
        var vw = host.clientWidth || window.innerWidth, vh = host.clientHeight || window.innerHeight, k = Math.max(vw / BG_W, vh / BG_H);
        el.style.setProperty('--fy', ((vh - BG_H * k) * .72 + FLOOR_Y * BG_H * k).toFixed(1) + 'px');
        el.style.setProperty('--fh', (vh * .45).toFixed(1) + 'px');
      };
      place(); window.addEventListener('resize', place);
    }
    return { el: el, destroy: function () { if (place) window.removeEventListener('resize', place); if (el.parentNode) el.parentNode.removeChild(el); } };
  }
  UT.NightFog = { mount: mount };
})();
