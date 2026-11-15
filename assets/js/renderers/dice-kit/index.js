/* Dice Kit — mesin dadu Dragon Roll (fisika kocok-lempar, material prosedural, partikel/aura/suara).
   Modul ES lokal (bukan CDN). SATU modul bersama: dipakai dadu.html (preview Inventory) DAN gameplay.html (dadu gameplay) lewat window.DiceKit.
   Hanya VISUAL: angka hasil ditentukan game (roll(forcedValue)); kit hanya menampilkan lemparan yang berakhir di angka itu.
   Kepemilikan, harga & equip tetap dari katalog SERVER; kit ini hanya tahu cara menampilkan dadu berdasarkan gameKey. */
import { DiceRenderer } from './DiceRenderer.js';
import { getDice, DICE_CATALOG } from './DiceCatalog.js';
import { diceThumbDataURL } from './DiceTextures.js';

/* Preset panggung dadu transparan (tanpa arena, jatuh dari atas ke tengah). Dipakai bersama preview & gameplay agar gerak/ukuran identik. */
const STAGE = Object.freeze({ transparent: true, arena: false, bounds: { x: 1.3, z: 1.1 }, idleZ: 0, camScale: 0.38, lookY: 0.8, drop: true });

window.DiceKit = {
  has: (key) => !!getDice(key),
  keys: () => DICE_CATALOG.map((d) => d.id),
  thumb: (key, px) => { const d = getDice(key); return d ? diceThumbDataURL(d, px) : ''; }, // gambar kubus statis berwarna asli
  create: (container, opts) => new DiceRenderer(container, opts),
  STAGE,
  /** Dadu 3D asli di panggung transparan (preset STAGE + opsi). Dipakai dadu.html dan gameplay.html. */
  mount: (container, opts) => new DiceRenderer(container, Object.assign({}, STAGE, opts || {})),
};
window.dispatchEvent(new Event('dicekit-ready'));
