/* Ular Tangga Blok - src/gameplay/js/maps/world.js
   Satu file = satu map. Skrip klasik (tanpa import/export). Dimuat SETELAH src/gameplay/js/maps/registry.js
   dan SEBELUM src/gameplay/js/themes.js. Mendaftar lewat UT.Gameplay.Maps.register({...}).
   Isi definisi:
     goal      petak akhir / fase boss (World = 100, Ender Dragon)
     theme     data tampilan (warna, langit, dekor, ...) - isi PERSIS seperti yang dulu di themes.js
   Urutan pendaftaran = urutan di THEMES (menentukan seed dunia dan tema default). */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {}, G = UT.Gameplay = UT.Gameplay || {};
  if (!G.Maps) return;
  G.Maps.register({
    key: 'minecraft',
    goal: 100,
    theme: {key:'minecraft',name:'World',skyTop:'#3DA5E8',skyBot:'#BDEBF0',
     tileA:0x5A9E3C,tileB:0x5A9E3C,ladderTile:0xE2BE3C,snakeTile:0xD9577A,goalTile:0xE6E3A6,
     wall:[0x9C6B3C,0x8E6034,0xA87644,0x7D5430],deep:[0x8A8E98,0x7A7F8A,0x989CA6],ground:0x4F9E3A,
     sw:['#62BE45','#9C6B3C'],label:'#FFFFFF',labelLine:'rgba(0,0,0,.85)',rail:0x6B4423,rung:0xB07A42,
     snakes:[[0x45C94B,0x1E6B22],[0x7BD96A,0x2E7D32],[0x3FB950,0x145A1E],[0x66CC55,0x2A7A2A],[0x55D060,0x1B6B2B],[0x8FE070,0x3A8A2A],[0x2FAF45,0x105A20]],
     hemi:0x9CCB78,decor:'mc',snow:false,cloud:0xFFFFFF,flag:0xF0453A}
  });
})(window);

