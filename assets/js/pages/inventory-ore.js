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
  var CSS = '#oreBox{width:min(720px,94vw);margin:0 auto}.iore{padding:10px 12px 24px;color:#fff;font-family:var(--ut-font-body,Nunito,sans-serif)}.iore h4{margin:14px 4px 6px;font:400 22px var(--ut-font-title,"Lilita One",sans-serif);color:#eadcc0;text-shadow:0 2px 0 #000}'
    + '.iore .r{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;border:2px solid #2b1f12;border-radius:12px;background:linear-gradient(180deg,#8d7352 0 50%,#7a6243 50% 100%)}'
    + '.iore .c{flex:none;width:48px;height:48px;display:grid;place-items:center}.iore .c .ut-ic{width:48px;height:48px}.iore .n{flex:1;min-width:0;font:400 20px/1.15 var(--ut-font-title,"Lilita One",sans-serif);text-shadow:0 2px 0 #000}.iore .n small{display:block;font:800 13px var(--ut-font-body,Nunito,sans-serif);color:#efe5d0}'
    + '.iore .ut-gl{min-width:84px;min-height:38px;padding:0 12px;font:400 17px var(--ut-font-title,"Lilita One",sans-serif);--gl-bw:3px;--gl-r:11px;--gl-ledge:4px;margin-bottom:4px;cursor:pointer}'
    + '.iore .all{display:block;width:100%;min-height:52px;margin:6px 0 10px;font-size:22px}.iore .msg{min-height:20px;margin:4px 6px;font:800 14px var(--ut-font-body,Nunito,sans-serif);color:#fff3a8;text-shadow:0 1px 0 #000}.iore .emp{text-align:center;padding:28px 10px;font:800 16px var(--ut-font-body,Nunito,sans-serif);color:#eadcc0}';
  function iconKey(g, k) { if (g === 'wood') return 'wood'; if (k === 'coal') return 'coal'; if (g === 'ore') return 'ore-' + k; return (k === 'copper' || k === 'iron' || k === 'gold') ? 'ingot-' + k : 'gem-' + k; }
  var fmt = function (n) { return Number(n).toLocaleString('id-ID'); };
  var busy = false;
  function svc() { return UT.TambangService && UT.TambangService.get && UT.TambangService.get(); }
  function bagOf(r) { var b = (r && r.bag) || {}; return { ore: b.ore || {}, goods: b.goods || {}, wood: +b.wood || 0 }; }
  function qty(b, grp, k) { return grp === 'wood' ? b.wood : +((b[grp] || {})[k]) || 0; }
  function empty(msg) { return '<div class="emp">' + msg + '<br><br><button class="ut-gl ut-c-y" type="button" data-go="tambang.html">BUKA TAMBANG</button></div>'; }
  function html(b, note) {
    var h = '', total = 0, n = 0;
    CAT.forEach(function (s) {
      var rows = '';
      s.items.forEach(function (it) { var q = qty(b, s.grp, it[0]); if (q < 1) return; total += q * it[3]; n += q;
        rows += '<div class="r"><i class="c">' + (UT.ItemIcon ? UT.ItemIcon.html(iconKey(s.grp, it[0])) : '') + '</i><div class="n">' + it[1] + ' × ' + fmt(q) + '<small>' + fmt(it[3]) + ' Koin / buah</small></div><button class="ut-gl ut-c-g" type="button" data-sell="' + s.grp + ':' + it[0] + ':' + q + '">JUAL</button></div>'; });
      if (rows) h += '<h4>' + s.sec + '</h4>' + rows;
    });
    if (!n) return empty('Belum ada ore. Klaim dari Gudang di Tambang, hasilnya muncul di sini.');
    return '<div class="iore"><button class="ut-gl ut-c-y all" type="button" data-sellall="1">JUAL SEMUA · +' + fmt(total) + ' Koin</button><div class="msg">' + (note || '') + '</div>' + h + '</div>';
  }
  function paint(box, r, note) { box.innerHTML = html(bagOf(r), note); }
  function enter(box) {
    if (!box) return; if (!doc.getElementById('iore-css')) { var st = doc.createElement('style'); st.id = 'iore-css'; st.textContent = CSS; doc.head.appendChild(st); }
    var s = svc(), PD = win.PlayerData;
    if (!s || !(PD && PD.serverMode && PD.serverMode())) { box.innerHTML = empty('Masuk akun untuk melihat hasil Tambang.'); return; }
    box.innerHTML = '<div class="emp">Memuat…</div>';
    s.get().then(function (r) { if (!r || r.ok === false) { box.innerHTML = empty('Gagal memuat. Coba lagi nanti.'); return; } paint(box, r); }, function () { box.innerHTML = empty('Gagal memuat. Coba lagi nanti.'); });
    if (box._iore) return; box._iore = 1;
    box.addEventListener('click', function (e) {
      var sl = e.target.closest('[data-sell]'), sa = e.target.closest('[data-sellall]'); if ((!sl && !sa) || busy) return;
      busy = true; var q = sl && sl.dataset.sell.split(':');
      var p = sl ? s.sell(q[0], q[1], +q[2]) : s.sellAll();
      p.then(function (r) { busy = false; if (!r || r.ok === false) { var m = box.querySelector('.msg'); if (m) m.textContent = 'Gagal menjual. Coba lagi.'; return; } paint(box, r, 'Terjual! +' + fmt(r.earned || 0) + ' Koin'); }, function () { busy = false; });
    });
  }
  UT.InvOre = { enter: enter, CAT: CAT };
})(window, document);
