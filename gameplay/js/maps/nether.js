/* Ular Tangga Blok - gameplay/js/maps/nether.js
   Satu file = satu map. Skrip klasik (tanpa import/export). Dimuat SETELAH gameplay/js/maps/registry.js
   dan SEBELUM gameplay/js/themes.js. Mendaftar lewat UT.Gameplay.Maps.register({...}).
   Isi definisi:
     theme     data tampilan (warna, langit, dekor, ...) - isi PERSIS seperti yang dulu di themes.js
     goal/boss petak akhir dan jenis fase boss (Nether = 120, Wither)
     board     fungsi pembuat papan sendiri (tanpa ini: papan serpentine 10x10)
     view      kotak tampilan kamera LOCK; props dekor; rules ular/tangga/chest/mob per map
     onlyMobs  mob yang hanya aktif di map ini (blaze). Dibaca config.js -> MOB_THEME_ONLY
   Urutan pendaftaran = urutan di THEMES (menentukan seed dunia dan tema default). */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  if (!G.Maps) return;
  G.Maps.register({
    key: 'nether',
    onlyMobs: ['blaze', 'ghast', 'strider', 'magma_cube', 'piglin', 'piglin_brute', 'hoglin', 'zoglin', 'zombified_piglin'],
    goal: 120,
    boss: 'wither', /* fase Wither belum dibuat: sementara tiba di petak 120 = menang */
    view: { minX: -8.7, maxX: 15.6, minZ: -10.6, maxZ: 6.0 }, /* kotak yang harus terlihat utuh (area Start + seluruh papan + benteng 5x5 di kanan atas) */
    rules: {
      ladders: { 5: 26, 20: 46, 40: 64, 59: 88, 78: 106, 100: 116 },
      snakes: { 28: 3, 50: 18, 66: 36, 82: 61, 102: 80, 118: 94 },
      chests: [9, 17, 33, 52, 57, 72, 92, 96, 110],
      mobs: [['zombified_piglin', [10]], ['strider', [12]], ['magma_cube', [19]], ['ender', [31]], ['hoglin', [38]],
             ['piglin', [43]], ['blaze', [55]], ['zoglin', [62]], ['ghast', [91]], ['piglin_brute', [112]]] /* maksimal 1 petak per mob; strider = penolong maju 3 petak */
    },
    props: [
      ["ghast",-3,10,-1],["ghast",9,11,5.5],["ghast",2,10,-9.5]
    ], /* ghast melayang di atas lava: ['ghast', x, y, z] */
    /* Papan 120 petak berkelok (redesain): satu jalan selebar 1 petak di 7 lajur yang menyambung lewat tikungan, di atas pulau-pulau biome
       dengan sungai lava di sela lajur. Crimson (1-34, kiri bawah) -> Warped (35-70) -> Soul Sand Valley + tulang (71-97) -> Basalt Deltas (98-119) naik ke
       Benteng Nether di kanan atas; 120 = gerbang benteng (Wither).
       Mengembalikan [null, {n,row,col,x,z,h,bio}, ...] (format sama dengan GameplayVoxelGeom.buildTiles) + properti:
         .island  {"cx,cz": {x,z,h,bio,edge}}   sel darat non-petak (cx,cz = floor(x),floor(z))
         .extra   {"cx,cz": tinggi}              dipakai gameplay.html untuk terrainTop (rel tangga, dsb.)
         .fort    {x0,x1,z0,z1,y}                tapak Benteng
         .falls   [[petak, dx, dz]]              petak di tepi sungai lava / laut lava untuk air terjun lava */
    board: function board() {
      /* sel grid gx 0..19 (x = gx-7.5), gz 0..12 (z = 4.5-gz); langkah gerak: [arah, jumlah] dari petak 1 di (3,0) */
      var MV = [['R',4],['U',1],['R',4],['D',1],['R',4],['U',2],
                ['L',3],['U',1],['L',4],['D',1],['L',7],['U',2],
                ['R',4],['D',1],['R',2],['U',1],['R',8],['U',2],
                ['L',2],['D',1],['L',2],['U',1],['L',3],['U',1],['L',3],['D',1],['L',4],['U',2],
                ['R',9],['D',1],['R',3],['U',1],['R',2],['U',2],
                ['L',4],['U',1],['L',3],['D',1],['L',5],['U',2],
                ['R',1],['D',1],['R',2],['U',1],['R',8]];
      var DIR = { R: [1, 0], L: [-1, 0], U: [0, 1], D: [0, -1] };
      var P = [[3, 0]], cx = 3, cz = 0, i, j, k;
      MV.forEach(function (m) { for (var s = 0; s < m[1]; s++) { cx += DIR[m[0]][0]; cz += DIR[m[0]][1]; P.push([cx, cz]); } });
      var N = P.length; /* harus 120 */
      function hsh(a, b, s) { var v = Math.sin(a * 12.9898 + b * 78.233 + s * 37.719) * 43758.5453; return v - Math.floor(v); }
      function bioOf(n) { return n <= 34 ? 'crimson' : (n <= 70 ? 'warped' : (n <= 97 ? 'soul' : 'basalt')); }
      /* tinggi petak: naik turun halus mengikuti biome, selisih antar petak berurutan kecil (maks 0.2) */
      var AN = [[1, 0.2], [17, 0.45], [34, 0.6], [50, 1.05], [70, 1.4], [85, 1.0], [97, 1.45], [110, 1.95], [120, 2.35]], hs = [0];
      for (i = 1; i <= N; i++) {
        var a = 0; while (a < AN.length - 2 && i > AN[a + 1][0]) a++;
        var u = Math.max(0, Math.min(1, (i - AN[a][0]) / (AN[a + 1][0] - AN[a][0])));
        hs.push(AN[a][1] + (AN[a + 1][1] - AN[a][1]) * u + 0.07 * Math.sin(i * 1.3));
      }
      for (i = 2; i <= N; i++) hs[i] = Math.max(hs[i - 1] - 0.2, Math.min(hs[i - 1] + 0.2, hs[i]));
      var T = [null], cellN = {};
      for (i = 1; i <= N; i++) {
        var g = P[i - 1], x = g[0] - 7.5, z = 4.5 - g[1];
        T.push({ n: i, row: g[1], col: g[0] - 3, x: x, z: z, h: Math.round(hs[i] * 20) / 20, bio: bioOf(i) });
        cellN[g[0] + ',' + g[1]] = i;
      }
      /* sel darat: semua sel dalam jarak 1 dari jalan (sela lajur = darat atau sungai lava), tepi luar tidak rata */
      /* Benteng 5x5 (rasio 1:1), digeser ke kanan: celah 3 sel dari petak 120 (gx 14) dijembatani jalan batu selebar 1 sel (BRIDGE) setinggi lantai benteng.
         Sumbu tengah benteng sejajar petak 120 (gz 12 = z -7.5) sehingga jembatan masuk lurus ke tengah halaman. */
      var FORT = { gx0: 18, gx1: 22, gz0: 10, gz1: 14 }, BRIDGE = { gx0: 15, gx1: 17, gz: 12 };
      function inFort(gx, gz) { return gx >= FORT.gx0 && gx <= FORT.gx1 && gz >= FORT.gz0 && gz <= FORT.gz1; }
      function nearest(gx, gz, R) { var best = 0, bd = 1e9; for (var dx = -R; dx <= R; dx++) for (var dz = -R; dz <= R; dz++) { var n = cellN[(gx + dx) + ',' + (gz + dz)]; if (n) { var d = dx * dx + dz * dz + n * 1e-4; if (d < bd) { bd = d; best = n; } } } return best ? { n: best, d: Math.sqrt(Math.round(bd)) } : null; }
      var isl = {}, extra = {};
      for (var gx = -1; gx <= 21; gx++) for (var gz = -2; gz <= 14; gz++) {
        var key = gx + ',' + gz; if (cellN[key] || inFort(gx, gz) || (gx <= 2 && gz <= 1)) continue;
        var nb = nearest(gx, gz, 2); if (!nb) continue;
        var cheb = 9; for (var q = 1; q <= 2 && cheb === 9; q++) for (var dx2 = -q; dx2 <= q; dx2++) for (var dz2 = -q; dz2 <= q; dz2++) if (Math.max(Math.abs(dx2), Math.abs(dz2)) === q && cellN[(gx + dx2) + ',' + (gz + dz2)]) cheb = Math.min(cheb, q);
        var inner = gx >= 1 && gx <= 15 && gz >= 0 && gz <= 12, land = false, r = hsh(gx, gz, 3);
        if (cheb === 1) {
          if (inner) land = !((gz % 2 === 1) && hsh(gx * 0.5, gz * 1.3, 7) > 0.6 && hsh(gx, gz, 11) > 0.25); /* sela lajur: sebagian jadi sungai lava */
          else land = r > 0.3;
        } else if (cheb === 2) land = hsh(gx, gz, 5) > 0.74;
        if (!land) continue;
        var th = T[nb.n].h - 0.3 + (hsh(gx, gz, 9) - 0.5) * 0.14 - (cheb === 2 ? 0.25 : 0);
        isl[key] = { x: gx - 7.5, z: 4.5 - gz, h: Math.max(0.05, Math.round(th * 20) / 20), bio: T[nb.n].bio, edge: false };
      }
      for (gx = BRIDGE.gx0; gx <= BRIDGE.gx1; gx++) isl[gx + ',' + BRIDGE.gz] = { x: gx - 7.5, z: 4.5 - BRIDGE.gz, h: 2.3, bio: 'basalt', edge: false, bridge: true }; /* jalan batu ke gerbang benteng (tinggi = lantai benteng fh) */
      function landAt(a, b) { return !!(isl[a + ',' + b] || cellN[a + ',' + b] || inFort(a, b)); }
      Object.keys(isl).forEach(function (kk) { var p = kk.split(','), a = +p[0], b = +p[1]; isl[kk].edge = !(landAt(a + 1, b) && landAt(a - 1, b) && landAt(a, b + 1) && landAt(a, b - 1)); extra[kk] = isl[kk].h; });
      var fh = 2.3; for (gx = FORT.gx0; gx <= FORT.gx1; gx++) for (gz = FORT.gz0; gz <= FORT.gz1; gz++) extra[gx + ',' + gz] = fh;
      /* air terjun lava dari tepi petak ke lava di bawahnya (tersebar merata di sepanjang jalan) */
      var falls = [], D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 4; i < N - 3; i += 11) {
        var cand = null;
        for (k = 0; k < 9 && !cand; k++) {
          var n2 = Math.min(N - 3, i + k), g2 = P[n2 - 1];
          for (j = 0; j < 4; j++) { var ax = g2[0] + D4[j][0], az = g2[1] + D4[j][1]; if (!landAt(ax, az) && T[n2].h > 0.45 && ax >= -1) { cand = [n2, D4[j][0], -D4[j][1]]; break; } } /* dz dunia = -dgz */
        }
        if (cand) falls.push(cand);
      }
      T.island = isl; T.extra = extra; T.falls = falls;
      T.fort = { x0: FORT.gx0 - 7.5 - 0.5, x1: FORT.gx1 - 7.5 + 0.5, z0: 4.5 - FORT.gz1 - 0.5, z1: 4.5 - FORT.gz0 + 0.5, y: fh };
      return T;
    },
    theme: {key:'nether',name:'Nether',skyTop:'#2a0606',skyBot:'#8a2410',
     tileA:0x8A2B2B,tileB:0x6E2222,ladderTile:0xFFD07A,snakeTile:0xFF7A3A,goalTile:0xE8B84A,
     wall:[0x5A1818,0x4A1212,0x6A1E1E,0x3A0D0D],deep:[0x2A0A0A,0x3A1010,0x1E0707],ground:0x7A2424,
     sw:['#8A2B2B','#3A0D0D'],label:'#FFE3B0',labelLine:'rgba(40,5,5,.9)',rail:0x2A1A12,rung:0x5A3A22,
     snakes:[[0xFF7A1A,0xFFD23F],[0xC0392B,0xFF9A5A],[0xE0561A,0xFFC070],[0x8A1E1E,0xFF8A5A],[0xFFA31A,0xFFE08A],[0xB02A2A,0xFF7A7A],[0xD8481A,0xFFB070]],
     hemi:0xFF8A5A,decor:'nether',snow:false,ember:0xFFA23A,cloud:0x6A2A22,flag:0x3AA8F0}
  });
})(window);
