/* Ular Tangga Blok - gameplay/maps/rimba.js
   Map "Rimba" (hutan rimba + kuil pasir): papan 100 petak berkelok mengikuti layout Papan_Rimba (grid 19 x 15).
   Satu file = satu map. Skrip klasik. Dimuat SETELAH gameplay/maps/registry.js dan SEBELUM gameplay/themes.js.
   Layout (dilihat dari atas, +z = atas layar): sungai vertikal di tengah (kolom c=9), jembatan atas (petak 39) dan jembatan bawah (hiasan),
   dinding kuil pasir di belakang (atas), bukit berundak di kanan, hutan lebat di kiri, START di kiri bawah menempel petak 1.
   Jalur: lingkar kiri naik 1-12 -> masuk isi kiri 13-25 -> naik 26-38 -> jembatan atas 39 -> sisi kanan turun 49-61 -> bawah ke kiri 62-70
          -> spiral kanan 71-100 (petak 100 di bawah sarang batu besar).
   Koordinat dunia: x = c - 8.5, z = r - 6.5  (c 0..18, r 0..14; layar atas = z kecil). Pusat sel = setengah bilangan bulat, jadi floor(x),floor(z) = sel. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  if (!G.Maps) return;
  var FLAT_H = 0.6; /* tinggi permukaan petak */
  function cellXZ(c, r) { return [c - 8.5, r - 6.5]; } /* kamera game melihat ke arah -z: baris r=0 (kuil) = z terkecil = bagian atas layar */
  function rimbaSeq() {
    var s = [], c, r;
    for (r = 13; r >= 2; r--) s.push([0, r]);        /* 1-12  kiri naik dari START */
    for (c = 1; c <= 3; c++) s.push([c, 2]);         /* 13-15 masuk ke isi kiri */
    for (r = 3; r <= 10; r++) s.push([3, r]);        /* 16-23 turun di isi kiri */
    for (c = 4; c <= 5; c++) s.push([c, 10]);        /* 24-25 belok kanan */
    for (r = 9; r >= 0; r--) s.push([5, r]);         /* 26-35 naik */
    for (c = 6; c <= 8; c++) s.push([c, 0]);         /* 36-38 menuju jembatan */
    for (c = 9; c <= 18; c++) s.push([c, 0]);        /* 39-48 atas (39 = jembatan atas) */
    for (r = 1; r <= 13; r++) s.push([18, r]);       /* 49-61 kanan turun */
    for (c = 18; c >= 10; c--) s.push([c, 14]);      /* 62-70 bawah ke kiri */
    for (r = 13; r >= 2; r--) s.push([10, r]);       /* 71-82 spiral kanan naik */
    for (c = 11; c <= 17; c++) s.push([c, 2]);       /* 83-89 ke kanan */
    for (r = 3; r <= 9; r++) s.push([17, r]);        /* 90-96 turun */
    for (c = 16; c >= 13; c--) s.push([c, 9]);       /* 97-100 ke kiri, 100 di bawah sarang batu besar */
    return s;
  }
  G.Maps.register({
    key: 'rimba',
    goal: 100,
    view: { minX: -11.2, maxX: 11.2, minZ: -10.4, maxZ: 10.4 },
    pad: { x: -7.6, z: 8.7 }, /* area START kiri bawah, menempel petak 1 */
    rules: {
      ladders: { 4: 23, 18: 30, 55: 94, 64: 97 },
      snakes: { 28: 20, 33: 14, 83: 76, 92: 56, 98: 85 },
      chests: [6, 13, 26, 38, 45, 53, 60, 69, 81, 88, 95],
      mobs: [['zombie', [2]], ['creeper', [35]], ['skeleton', [47]], ['ender', [74]], ['villager', [10]]]
    },
    theme: {key:'rimba',name:'Rimba',skyTop:'#5BAAD8',skyBot:'#C4E3D0',
     tileA:0x2B78F0,tileB:0x2B78F0,ladderTile:0xE2BE3C,snakeTile:0xD9577A,goalTile:0xE6E3A6,
     wall:[0x8D5F3A,0x7B4E2B,0x946339,0x6B4424],deep:[0x8C6C47,0x6F5437,0xA58260],ground:0x3F8F36,
     sw:['#4A9A42','#8D5F3A'],label:'#FFFFFF',labelLine:'rgba(0,0,0,.85)',rail:0x6B4423,rung:0xB07A42,
     snakes:[[0x45C94B,0x1E6B22],[0x7BD96A,0x2E7D32],[0x3FB950,0x145A1E],[0x66CC55,0x2A7A2A],[0x55D060,0x1B6B2B]],
     hemi:0x6E9B62,decor:'jungle',snow:false,cloud:0xE6ECF0,flag:0xF0453A},
    /* papan: [null, {n,row,col,x,z,h}, ...] (format sama dengan GameplayVoxelGeom.buildTiles) + .extra (tinggi sel non-petak untuk terrainTop) */
    board: function board() {
      var seq = rimbaSeq(), T = [null], i, c, r, extra = {};
      for (i = 0; i < seq.length; i++) {
        var p = cellXZ(seq[i][0], seq[i][1]);
        T.push({ n: i + 1, row: seq[i][1], col: seq[i][0], x: p[0], z: p[1], h: FLAT_H });
      }
      for (c = 0; c <= 18; c++) for (r = 0; r <= 14; r++) { var q = cellXZ(c, r); extra[Math.floor(q[0]) + ',' + Math.floor(q[1])] = 0.4; }
      T.extra = extra;
      T.seqCells = seq; /* [c,r] per petak (dipakai pembangun tanah/dekor) */
      return T; /* harus 100 petak */
    }
  });
})(window);
