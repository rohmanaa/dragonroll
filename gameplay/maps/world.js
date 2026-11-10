/* Ular Tangga Blok - gameplay/maps/world.js
   Satu file = satu map. Skrip klasik (tanpa import/export). Dimuat SETELAH gameplay/maps/registry.js
   dan SEBELUM gameplay/themes.js. Mendaftar lewat UT.Gameplay.Maps.register({...}).
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
    theme: {key:'minecraft',name:'World',skyTop:'#4A8FC9',skyBot:'#AFCFE2',
     tileA:0x5A9E3C,tileB:0x5A9E3C,ladderTile:0xE2BE3C,snakeTile:0xD9577A,goalTile:0xE6E3A6,
     wall:[0x8A5B33,0x7B4E2B,0x946339,0x6B4424],deep:[0x7A7A7A,0x6A6A6A,0x8A8A8A],ground:0x4A8F33,
     sw:['#5FAE3E','#8A5B33'],label:'#FFFFFF',labelLine:'rgba(0,0,0,.85)',rail:0x6B4423,rung:0xB07A42,
     snakes:[[0x45C94B,0x1E6B22],[0x7BD96A,0x2E7D32],[0x3FB950,0x145A1E],[0x66CC55,0x2A7A2A],[0x55D060,0x1B6B2B],[0x8FE070,0x3A8A2A],[0x2FAF45,0x105A20]],
     hemi:0x7C9C6E,decor:'mc',snow:false,cloud:0xE6ECF0,flag:0xF0453A}
  });
})(window);
