/* Power-3D untuk halaman Power (powerup.html): pratinjau 3D hidup per power-up.
   Mesin = PowerRenderer (Three.js, modul ES). Modul ini dimuat malas lewat import() dari halaman; bila WebGL/impor gagal,
   halaman memakai tampilan lama (ItemArt). Registry visual.modelKey memetakan gameKey ke PowerCatalog;
   PowerRegistry menyediakan peta fallback untuk halaman lama tanpa manifest. */
import { PowerRenderer } from './PowerRenderer.js';
import { PowerSound } from './PowerSound.js';
import { KEY_TO_POWER3D, power3dKey } from './PowerRegistry.js';

export { KEY_TO_POWER3D };
export const supports = (gameKey) => !!power3dKey(gameKey);

/* host: elemen kosong tempat kanvas disisipkan. opts.quality: 'low'|'medium'|'high'. Melempar bila WebGL tidak tersedia. */
export function mount(host, opts) {
  const pr = new PowerRenderer(host, { transparent: true, quality: opts && opts.quality, sound: !!(opts && opts.sound) });
  pr.start();
  return {
    show(gameKey) { const key = power3dKey(gameKey); return key ? pr.show(key) : false; },
    activate() { return pr.activate(); },
    setSound(on, vol) { pr.setSound(on); if (vol != null) PowerSound.setVolume(vol); },
    start() { pr.start(); }, stop() { pr.stop(); },
    destroy() { try { pr.stop(); pr.dispose && pr.dispose(); } catch (e) {} },
    renderer: pr
  };
}
