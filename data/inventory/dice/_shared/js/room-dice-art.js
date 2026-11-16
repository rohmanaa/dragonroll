import { getDice } from '../../../assets/js/renderers/dice-kit/dice-catalog.js';
import { diceThumbDataURL } from '../../../assets/js/renderers/dice-kit/dice-textures.js';

window.RoomDiceArt = {
  thumb(gameKey, px) {
    const die = getDice(gameKey);
    return die ? diceThumbDataURL(die, px) : '';
  },
};

window.dispatchEvent(new Event('room-dice-art-ready'));
