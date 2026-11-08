/* Dice Kit — mesin dadu Dragon Roll (fisika kocok-lempar, material prosedural, partikel/aura/suara).
   Modul ES lokal (bukan CDN). Dipakai dadu.html lewat window.DiceKit. Hanya VISUAL: hasil angka tidak memengaruhi game.
   Kepemilikan, harga & equip tetap dari katalog SERVER; kit ini hanya tahu cara menampilkan dadu berdasarkan gameKey. */
import { DiceRenderer } from './DiceRenderer.js';
import { getDice, DICE_CATALOG } from './DiceCatalog.js';
import { diceThumbDataURL } from './DiceMaterials.js';

window.DiceKit = {
  has: (key) => !!getDice(key),
  keys: () => DICE_CATALOG.map((d) => d.id),
  thumb: (key, px) => { const d = getDice(key); return d ? diceThumbDataURL(d, px) : ''; }, // gambar kubus statis berwarna asli
  create: (container, opts) => new DiceRenderer(container, opts),
};
window.dispatchEvent(new Event('dicekit-ready'));
