/**
 * DiceEffects.js — DiceEffects untuk THREE r170 (dadu.html & panel DiceKit).
 * Seluruh logika ada di DiceEffectsCore.js (bebas versi THREE); dice-throw.js memakainya dengan THREE game.
 */
import * as THREE from '../vendor/three.r170.module.min.js';
import { createDiceEffects, LANDING_RECIPES, IDLE_RECIPES } from './DiceEffectsCore.js';

export const DiceEffects = createDiceEffects(THREE);
export { LANDING_RECIPES, IDLE_RECIPES };
