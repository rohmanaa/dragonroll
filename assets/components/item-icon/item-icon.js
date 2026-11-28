/* Dragon Roll — assets/components/item-icon/item-icon.js
   Ikon item (gambar webp 256px di assets/images/ui/item-icons/).
   Pakai:  UT.ItemIcon.html('ore-copper')  ->  '<img class="ut-ic" src="assets/images/ui/item-icons/ore-copper.webp">'
           UT.ItemIcon.html('ingot-gold', {size:'2em'});  UT.ItemIcon.src('coal');  UT.ItemIcon.keys()
   Kunci: ore-copper|iron|gold|lapis|amethyst|diamond, coal, ingot-copper|iron|gold, gem-lapis|amethyst|diamond,
          wood, fuel, furnace, forest, lift, mine, gudang, manager, boost, sleep, food, gift, sparkle, lock, unlock, warn, lumber, time, chestfull   (alias lama: tree=forest, pickaxe=mine, bag=gudang)
   Path relatif ke halaman di root; ubah UT.ItemIcon.base bila halaman ada di subfolder. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  var KEYS = ['ore-copper', 'ore-iron', 'ore-gold', 'ore-lapis', 'ore-amethyst', 'ore-diamond', 'coal', 'ingot-copper', 'ingot-iron', 'ingot-gold',
    'gem-lapis', 'gem-amethyst', 'gem-diamond', 'wood', 'fuel', 'furnace', 'forest', 'lift', 'mine', 'gudang', 'manager', 'boost',
    'sleep', 'food', 'gift', 'sparkle', 'lock', 'unlock', 'warn', 'lumber', 'time', 'chestfull'];
  var ALIAS = { tree: 'forest', pickaxe: 'mine', bag: 'gudang' };
  var api = {
    base: 'assets/images/ui/item-icons/',
    keys: function () { return KEYS.slice(); },
    src: function (k) { k = ALIAS[k] || k; return KEYS.indexOf(k) < 0 ? '' : api.base + k + '.webp'; },
    html: function (k, o) {
      var s = api.src(k); if (!s) return '';
      return '<img class="ut-ic" src="' + s + '" alt="" draggable="false" decoding="async"' + (o && o.size ? ' style="width:' + o.size + ';height:' + o.size + '"' : '') + '>';
    }
  };
  UT.ItemIcon = api;
})(window);
