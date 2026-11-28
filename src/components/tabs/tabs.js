/* Ular Tangga Blok â€” src/components/tabs/tabs.js (komponen Tabs reusable; skrip klasik)
   Urutan muat: ui-core.js -> tabs.js. Mendaftar ke UT.Hud; memuat tabs.css otomatis dari folder yang sama.
   var t = UT.Hud.create('tabs', { kind:'top'|'seg'|'ul', items:[{id,label,icon,badge}], active:'id', onChange:fn(id) });
   parent.appendChild(t.el);  t.select('id');  Hasil: { el, select(id), get() }. */
(function (win, doc) {
  'use strict';
  var UT = win.UT;
  if (!UT || !UT.Hud || typeof UT.Hud.register !== 'function') { if (win.console) win.console.error('[UT.Hud] tabs.js: muat ui-core.js lebih dulu.'); return; }
  if (UT.Hud.has('tabs')) return;
  var CSS_ID = 'ut-tabs-css';
  (function (s) {
    if (doc.getElementById(CSS_ID) || !s || !s.src) return;
    var href = s.src.replace(/tabs\.js(\?.*)?$/, 'tabs.css'); if (href === s.src) return;
    var l = doc.createElement('link'); l.rel = 'stylesheet'; l.id = CSS_ID; l.href = href; (doc.head || doc.documentElement).appendChild(l);
  })(doc.currentScript);
  var K = { top: ['ut-tabs', 'ut-tab'], seg: ['ut-seg', 'ut-seg-i'], ul: ['ut-ul', 'ut-ul-i'] };
  function create(o) {
    o = o || {}; var k = K[o.kind] || K.top, el = doc.createElement('div'), cur = o.active, btns = {};
    el.className = k[0]; el.setAttribute('role', 'tablist');
    (o.items || []).forEach(function (it) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = k[1]; b.setAttribute('role', 'tab');
      if (it.icon) { var im = doc.createElement('img'); im.className = 'ic'; im.alt = ''; im.src = it.icon; b.appendChild(im); }
      var sp = doc.createElement('span'); sp.textContent = it.label == null ? '' : String(it.label); b.appendChild(sp);
      if (it.badge) { var bd = doc.createElement('i'); bd.className = 'bd'; bd.textContent = String(it.badge); b.appendChild(bd); }
      b.addEventListener('click', function () { select(it.id, true); });
      btns[it.id] = b; el.appendChild(b);
    });
    function select(id, fire) {
      if (!btns[id]) return; cur = id;
      Object.keys(btns).forEach(function (x) { var on = x === id; btns[x].classList.toggle('on', on); btns[x].setAttribute('aria-selected', on ? 'true' : 'false'); });
      if (fire && typeof o.onChange === 'function') o.onChange(id);
    }
    if (cur == null && o.items && o.items[0]) cur = o.items[0].id;
    select(cur, false);
    return { el: el, select: function (id) { select(id, false); }, get: function () { return cur; } };
  }
  UT.Hud.register('tabs', { create: create, kinds: Object.keys(K) });
})(window, document);

