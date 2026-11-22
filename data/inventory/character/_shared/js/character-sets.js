/* character-sets.js — DATA SET (preset tampilan) bawaan, satu sumber untuk Karakter (karakter.js) dan Toko (shop-page.js).
   Skrip klasik, global: UT.CharacterSets = { male:[{id,n,set}], female:[{id,n,set}] }.
   Set PVP (terkunci, tidak dijual) tetap didefinisikan di karakter.js. Harga/kepemilikan dibaca dari ItemCatalog ('gear.<slot>.<id>'). */
(function () {
  'use strict';
  var UT = window.UT = window.UT || {};
  var gear = function (o) { return o; };
  var M = [
    {id:'citizen',n:'🙂 Warga',set:gear({top:{id:'tee',dye:'blue'},legs:{id:'pants',dye:'navy'},boots:{id:'shoes',dye:'brown'}})},
    {id:'knight',n:'🛡️ Ksatria',set:gear({top:{id:'tunic',dye:'red'},legs:{id:'pants',dye:'navy'},boots:{id:'tall',dye:'brown'},
      chest:{id:'plate',dye:'steel'},shoulder:{id:'pad',dye:'steel'},cape:{id:'long',dye:'red'},weapon:{id:'sword',dye:'steel'},accessories:[{id:'belt',dye:'brown'}]})},
    {id:'mage',n:'🧙 Penyihir',set:gear({top:{id:'robe',dye:'purple'},legs:{id:'pants',dye:'purple'},boots:{id:'cloth',dye:'black'},
      helm:{id:'wizard',dye:'purple'},weapon:{id:'staff',dye:'blue'}})},
    {id:'farmer',n:'🌾 Petani',set:gear({top:{id:'overall',dye:'blue'},legs:{id:'pants',dye:'blue'},boots:{id:'shoes',dye:'brown'},helm:{id:'straw',dye:'straw'}})},
    {id:'explorer',n:'🧭 Petualang',set:gear({top:{id:'vest',dye:'green'},legs:{id:'pants',dye:'brown'},boots:{id:'tall',dye:'brown'},
      accessories:[{id:'belt',dye:'brown'},{id:'pack',dye:'brown'},{id:'goggles',dye:'bronze'}]})},
    {id:'noble',n:'👑 Bangsawan',set:gear({top:{id:'coat',dye:'navy'},legs:{id:'formal',dye:'black'},boots:{id:'shoes',dye:'black'},
      helm:{id:'crown',dye:'gold'},cape:{id:'short',dye:'navy'},accessories:[{id:'belt',dye:'black'}]})}
  ];
  var F = [];
  var FP = function (id, n, set) { F.push({ id: id, n: n, set: gear(set) }); };
  FP('citizen','🙂 Warga',{top:{id:'blouse',dye:'white'},legs:{id:'skirt',dye:'navy'},boots:{id:'mary',dye:'black'},accessories:[{id:'bow',dye:'red'}]});
  FP('knight','🛡️ Ksatria',{top:{id:'tunic',dye:'purple'},legs:{id:'tights',dye:'black'},boots:{id:'knee',dye:'black'},
    chest:{id:'valk',dye:'steel'},shoulder:{id:'gem',dye:'steel'},cape:{id:'long',dye:'purple'},weapon:{id:'rapier',dye:'steel'},accessories:[{id:'belt',dye:'black'}]});
  FP('mage','🧙 Penyihir',{top:{id:'robe',dye:'navy'},legs:{id:'tights',dye:'black'},boots:{id:'knee',dye:'black'},
    helm:{id:'wizard',dye:'navy'},weapon:{id:'wand',dye:'pink'},accessories:[{id:'earrings',dye:'gold'}]});
  FP('farmer','🌾 Petani',{top:{id:'sundress',dye:'yellow'},legs:{id:'bare'},boots:{id:'sandal',dye:'tan'},helm:{id:'straw',dye:'straw'}});
  FP('explorer','🧭 Petualang',{top:{id:'vest',dye:'green'},legs:{id:'shorts',dye:'brown'},boots:{id:'tall',dye:'brown'},
    accessories:[{id:'belt',dye:'brown'},{id:'goggles',dye:'bronze'},{id:'purse',dye:'brown'}]});
  FP('princess','👑 Putri',{top:{id:'dress',dye:'pink'},legs:{id:'tights',dye:'white'},boots:{id:'mary',dye:'pink'},
    helm:{id:'tiara',dye:'gold'},cape:{id:'short',dye:'pink'},accessories:[{id:'necklace',dye:'gold'},{id:'earrings',dye:'gold'},{id:'gloves',dye:'white'}]});
  FP('fairy','🧚 Peri',{top:{id:'sundress',dye:'mint'},legs:{id:'bare'},boots:{id:'flat',dye:'mint'},
    helm:{id:'flowers',dye:'pink'},cape:{id:'wings',dye:'lilac'},weapon:{id:'wand',dye:'mint'},accessories:[{id:'earrings',dye:'gold'}]});
  UT.CharacterSets = { male: M, female: F };
})();
