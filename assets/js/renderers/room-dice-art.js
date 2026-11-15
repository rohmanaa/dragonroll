import { getDice } from './dice-kit/DiceCatalog.js';
import { diceThumbDataURL } from './dice-kit/DiceTextures.js';

window.RoomDiceArt = {
  thumb(gameKey, px) {
    const die = getDice(gameKey);
    return die ? diceThumbDataURL(die, px) : '';
  },
};

window.dispatchEvent(new Event('room-dice-art-ready'));
