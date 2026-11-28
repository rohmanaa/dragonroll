/* Ular Tangga Blok — Inventory › tab Ore (hasil Tambang: ore, batang, permata, kayu).
   Isi = tas pemain di server (UT.TambangService.get -> bag). Jual per item / semua lewat service (server-authoritative).
   Tambang hanya mengisi tas lewat "Klaim" di drawer Gudang; menjual dilakukan di sini.
   Pakai: UT.InvOre.enter(hostEl) setiap tab Ore dibuka. */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.InvOre) return;
  /* katalog tampilan + harga jual per buah (cermin tambang-data.js; server yang menghitung hasil sebenarnya) */
  var CAT = [
    { grp: 'goods', sec: 'Batang & Permata', items: [['copper', 'Batang Copper', '#e0804a', 20], ['iron', 'Batang Iron', '#d6d0c8', 30], ['gold', 'Batang Emas', '#ffd24d', 120], ['lapis', 'Lapis Lazuli', '#3a5fe0', 80], ['amethyst', 'Amethyst', '#b06cff', 150], ['diamond', 'Diamond', '#6fe8ff', 400]] },
    { grp: 'ore', sec: 'Ore Mentah', items: [['copper', 'Ore Copper', '#e0804a', 5], ['iron', 'Ore Iron', '#d6d0c8', 7], ['lapis', 'Ore Lapis', '#3a5fe0', 20], ['gold', 'Ore Emas', '#ffd24d', 30], ['amethyst', 'Ore Amethyst', '#b06cff', 25], ['diamond', 'Ore Diamond', '#6fe8ff', 60], ['coal', 'Batu Bara', '#3a3a44', 3]] },
    { grp: 'wood', sec: 'Kayu', items: [['wood', 'Kayu', '#8a5a2b', 1]] }
  ];
  function iconKey(g, k) { if (g === 'wood') return 'wood'; if (k === 'coal') return 'coal'; if (g === 'ore') return 'ore-' + k; return (k === 'copper' || k === 'iron' || k === 'gold') ? 'ingot-' + k : 'gem-' + k; }
  var fmt = function (n) { return Number(n).toLocaleString('id-ID'); };
  var busy = false;
  function svc() { return UT.TambangService && UT.TambangService.get && UT.TambangService.get(); }
  function bagOf(r) { var b = (r && r.bag) || {}; return { ore: b.ore || {}, goods: b.goods || {}, wood: +b.wood || 0 }; }
  function qty(b, grp, k) { return grp === 'wood' ? b.wood : +((b[grp] || {})[k]) || 0; }
  function empty(msg) { return '<div class="cempty">' + msg + '<button class="btn ut-gl ut-c-y" type="button" data-go="tambang.html" style="position:relative;display:grid;place-items:center;margin:24px auto 0;width:300px;height:84px"><span>BUKA TAMBANG</span></button></div>'; }
  var sel = '';   /* "grp:key" slot terpilih */
  function list(b) {
    var out = [];
    CAT.forEach(function (s) { s.items.forEach(function (it) { var q = qty(b, s.grp, it[0]); if (q >= 1) out.push({ id: s.grp + ':' + it[0], grp: s.grp, key: it[0], nm: it[1], pr: it[3], q: q }); }); });
    return out;
  }
  /* pola tab Power-up/Chest: hanya grid slot (chip jumlah), tombol JUAL kanan bawah; tampilan = #cbox di inventory.css */
  function html(b, note) {
    var L = list(b), total = 0;
    if (!L.length) return '<div id="cbox">' + empty('Belum ada ore. Klaim dari Gudang di Tambang, hasilnya muncul di sini.') + '</div>';
    L.forEach(function (x) { total += x.q * x.pr; });
    var cur = L.filter(function (x) { return x.id === sel; })[0] || L[0]; sel = cur.id;
    var h = '<div id="cbox"><section id="cr"><div id="cg">';
    L.forEach(function (x) {
      h += '<button class="fslot ut-slot gray' + (x.id === sel ? ' sel' : '') + '" type="button" data-pick="' + x.id + '" aria-label="' + x.nm + ', jumlah ' + x.q + ', ketuk untuk memilih"><i class="dc">' + (UT.ItemIcon ? UT.ItemIcon.html(iconKey(x.grp, x.key)) : '') + '</i><span class="chip-n">' + (x.q > 99 ? '99+' : x.q) + '</span></button>';
    });
    h += '</div></section><div class="oinfo"><b>' + cur.nm + ' × ' + fmt(cur.q) + '</b><small>' + fmt(cur.pr) + ' Koin / buah · ' + fmt(cur.pr * cur.q) + ' Koin</small><em class="msg">' + (note || '') + '</em></div>'
      + '<button class="btn ut-gl ut-c-g" id="cact2" type="button" data-sell="' + cur.grp + ':' + cur.key + ':' + cur.q + '"><span>JUAL</span></button>'
      + '<button class="btn ut-gl ut-c-y" id="cact" type="button" data-sellall="1"><span>JUAL SEMUA · ' + fmt(total) + '</span></button></div>';
    return h;
  }
  function paint(box, r, note) { box.innerHTML = html(bagOf(r), note); }
  function enter(box) {
    if (!box) return;
    var s = svc(), PD = win.PlayerData, last = null;
    if (!s || !(PD && PD.serverMode && PD.serverMode())) { box.innerHTML = '<div id="cbox">' + empty('Masuk akun untuk melihat hasil Tambang.') + '</div>'; return; }
    box.innerHTML = '<div id="cbox"><div class="cempty">Memuat…</div></div>';
    s.get().then(function (r) { if (!r || r.ok === false) { box.innerHTML = '<div id="cbox">' + empty('Gagal memuat. Coba lagi nanti.') + '</div>'; return; } last = r; paint(box, r); }, function () { box.innerHTML = '<div id="cbox">' + empty('Gagal memuat. Coba lagi nanti.') + '</div>'; });
    if (box._iore) return; box._iore = 1;
    box.addEventListener('click', function (e) {
      var pk = e.target.closest('[data-pick]');
      if (pk) { sel = pk.dataset.pick; if (last) paint(box, last); return; }
      var sl = e.target.closest('[data-sell]'), sa = e.target.closest('[data-sellall]'); if ((!sl && !sa) || busy) return;
      busy = true; var q = sl && sl.dataset.sell.split(':');
      var p = sl ? s.sell(q[0], q[1], +q[2]) : s.sellAll();
      p.then(function (r) { busy = false; if (!r || r.ok === false) { var m = box.querySelector('.msg'); if (m) m.textContent = 'Gagal menjual. Coba lagi.'; return; } last = r; paint(box, r, 'Terjual! +' + fmt(r.earned || 0) + ' Koin'); }, function () { busy = false; });
    });
  }
  UT.InvOre = { enter: enter, CAT: CAT };
})(window, document);
