/* Dice Skin (gameplay) — memberi muka dadu CSS tekstur ASLI yang sama dengan preview Inventory (assets/js/dice-kit/DiceTextures.js, murni canvas, tanpa three.js).
   HANYA tampilan: bentuk kubus, angka hasil, dan animasi gameplay tidak berubah. Bila modul gagal dimuat, dadu tetap memakai warna datar (--dbg/--dpip/--dedge).
   ES module. Namespace: UT.DiceSkin { has(key), face(key, value) } + event 'ut:diceskin-ready'. */
import { getDice } from '../assets/js/dice-kit/DiceCatalog.js';
import { diceFaceDataURL } from '../assets/js/dice-kit/DiceTextures.js';

const UT = (window.UT = window.UT || {});
UT.DiceSkin = {
  has: (key) => !!getDice(key),
  face: (key, value) => { const d = getDice(key); return d ? diceFaceDataURL(d, value, 128) : ''; },
};
window.dispatchEvent(new Event('ut:diceskin-ready'));
