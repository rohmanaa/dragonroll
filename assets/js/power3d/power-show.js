/* Power-3D untuk halaman Power (powerup.html): pratinjau 3D hidup per power-up.
   Mesin = PowerRenderer (Three.js, modul ES). Modul ini dimuat malas lewat import() dari halaman; bila WebGL/impor gagal,
   halaman memakai tampilan lama (ItemArt). KEY_TO_POWER3D memetakan gameKey power-up game -> id item 3D.
   Peta lengkap 17 power-up (7 lama + 10 Batch 2-3 berkunci identik): sword->iron_sword, feather->feather, tnt->tnt, totem->totem, grass->ender_pearl, potion_odd->potion_red, potion_even->potion_blue.
   Power baru cukup menambah baris di peta ini (item 3D lain sudah ada di PowerCatalog.js). */
import { PowerRenderer } from './PowerRenderer.js';
import { PowerSound } from './PowerSound.js';

export const KEY_TO_POWER3D = { sword: 'iron_sword', feather: 'feather', tnt: 'tnt', totem: 'totem', grass: 'ender_pearl', potion_odd: 'potion_red', potion_even: 'potion_blue',
  /* Batch 2-3: gameKey = id model 3D */
  diamond_sword: 'diamond_sword', netherite_sword: 'netherite_sword', wooden_shield: 'wooden_shield', golden_apple: 'golden_apple', fire_charge: 'fire_charge',
  ice_crystal: 'ice_crystal', blaze_core: 'blaze_core', trident: 'trident', dragon_crystal: 'dragon_crystal', nether_star: 'nether_star' };
export const supports = (gameKey) => Object.prototype.hasOwnProperty.call(KEY_TO_POWER3D, gameKey);

/* host: elemen kosong tempat kanvas disisipkan. opts.quality: 'low'|'medium'|'high'. Melempar bila WebGL tidak tersedia. */
export function mount(host, opts) {
  const pr = new PowerRenderer(host, { transparent: true, quality: opts && opts.quality, sound: !!(opts && opts.sound) });
  pr.start();
  return {
    show(gameKey) { return supports(gameKey) ? pr.show(KEY_TO_POWER3D[gameKey]) : false; },
    activate() { return pr.activate(); },
    setSound(on, vol) { pr.setSound(on); if (vol != null) PowerSound.setVolume(vol); },
    start() { pr.start(); }, stop() { pr.stop(); },
    destroy() { try { pr.stop(); pr.dispose && pr.dispose(); } catch (e) {} },
    renderer: pr
  };
}
