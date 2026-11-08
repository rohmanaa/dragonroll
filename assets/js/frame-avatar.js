/* Frame avatar bersama (Leaderboard, Teman, dll).
   Membungkus HTML avatar yang sudah ada dengan gambar frame (data/frame/*.webp dari ItemCatalog).
   Lubang frame = 46.4% lebar gambar (26.8%-73.2%) -> wajah 50% kotak (sedikit masuk di bawah border), kotak frame 150% ukuran avatar.
   Butuh: item-catalog.js (dan player-data.js untuk FrameAvatar.mine()). */
(function (g) {
  'use strict';
  var C = g.ItemCatalog, PD = g.PlayerData, DEFAULT = 'frame.default';
  var css = '.fa{position:relative;display:inline-block;flex:none;width:calc(var(--fs,4rem)*1.5);height:calc(var(--fs,4rem)*1.5);line-height:0;vertical-align:middle}' +
    '.fa-in{position:absolute;left:50%;top:50%;width:calc(var(--fs,4rem)*.75);height:calc(var(--fs,4rem)*.75);translate:-50% -50%}' +
    '.fa-in>*{width:100%!important;height:100%!important;box-sizing:border-box}' +
    '.fa-img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:contain;pointer-events:none;-webkit-user-drag:none;user-select:none}';
  try { var st = document.createElement('style'); st.id = 'frame-avatar-css'; st.textContent = css; document.head.appendChild(st); } catch (e) {}

  function src(id) { var it = C && C.byId(id); return (it && it.kind === 'frame' && it.image) ? it.image : 'data/frame/frame-default.webp'; }
  function mine() { try { return (PD && PD.equippedId('frame')) || DEFAULT; } catch (e) { return DEFAULT; } }
  /* inner = HTML avatar lama (mis. <span class="av">..</span>); size = ukuran avatar lama (mis. '4rem'). */
  function wrap(inner, size, frameId) {
    return '<span class="fa" style="--fs:' + size + '"><span class="fa-in">' + inner + '</span>' +
      '<img class="fa-img" src="' + src(frameId || DEFAULT) + '" alt="" draggable="false" decoding="async"></span>';
  }
  g.FrameAvatar = { wrap: wrap, mine: mine, src: src, DEFAULT: DEFAULT, GOLD: 'frame.gold' };
})(window);
