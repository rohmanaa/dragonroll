/* Power-3D di gameplay: efek model 3D + aura + partikel DI ATAS pion saat Power dipakai/kena, plus suara sintetis (PowerSound).
   Satu renderer transparan dipakai ulang (dibuat saat pertama dipakai, hanya menyala selama efek). Dimuat malas oleh gameplay.html
   (window.UT.PowerOverlay). Gagal/WebGL mati -> pemanggil memakai efek 2D (UT.PowerFX). Hanya VISUAL/AUDIO: aturan Power tetap di gameplay.html (C.PUR). */
import { PowerRenderer } from './PowerRenderer.js';
import { PowerSound } from './PowerSound.js';
import { KEY_TO_POWER3D } from './power-show.js';

export { PowerSound };
/* efek khusus gameplay -> model 3D */
const ALIAS = { totem_block: 'totem', shield_block: 'wooden_shield' };
const idOf = (key) => KEY_TO_POWER3D[ALIAS[key] || key] || null;
export const supports = (key) => !!idOf(key);

/* Model power tampil SHRINK x lebih kecil dari ukuran dasar (size), tetapi canvas boleh sebesar layar (o.rect) supaya aura/partikel tidak terpotong */
const SHRINK = 1.5, BASE_DIST = 6.4;
let OV = null, t1 = 0, t2 = 0;
function overlay(size) {
  if (OV) return OV;
  const host = document.createElement('div');
  host.id = 'power3d-fx';
  host.style.cssText = 'position:fixed;left:0;top:0;width:' + size + 'px;height:' + size + 'px;pointer-events:none;z-index:60;display:none';
  document.body.appendChild(host);
  const pr = new PowerRenderer(host, { transparent: true, sound: false });
  pr.orbit.dist = BASE_DIST * SHRINK;
  OV = { host, pr };
  return OV;
}
/** playAt(key, x, y, {size}) — x,y = titik layar (px). true bila efek 3D dimulai. */
export function playAt(key, x, y, o) {
  const id = idOf(key); if (!id) return false;
  try {
    const size = Math.round((o && o.size) || 300), ov = overlay(size), pr = ov.pr;
    clearTimeout(t1); clearTimeout(t2);
    const R = o && o.rect, st = ov.host.style;  /* ukuran bisa berubah tiap pemakaian (layar/orientasi) */
    if (R) { st.translate = 'none'; st.left = R.left + 'px'; st.top = R.top + 'px'; st.width = R.width + 'px'; st.height = R.height + 'px'; }   /* canvas = 1 layar, titik efek = tengah rect */
    else { st.translate = '-50% -50%'; st.left = x + 'px'; st.top = y + 'px'; st.width = size + 'px'; st.height = size + 'px'; }
    st.display = 'block';
    pr.resize();
    /* tinggi kanvas lebih besar dari size -> kamera dimundurkan sebanding agar ukuran model di layar = (ukuran dasar / SHRINK); aspectDist = koreksi portrait milik renderer */
    pr.orbit.dist = BASE_DIST * SHRINK * ((R ? R.height : size) / size) / (pr.aspectDist || 1);
    pr.show(id);
    const a = pr.animator; a.state = 'idle'; a.t = 0; a.holder.visible = true; a.activate(); /* lewati animasi muncul: langsung beraksi */
    pr.start();
    const dur = ((a.act.duration || 1.1) + (a.hold || 0)) * 1000 + 150;
    t1 = setTimeout(() => { try { pr.disappear(); } catch (e) { /* abaikan */ } t2 = setTimeout(() => { pr.stop(); ov.host.style.display = 'none'; }, 850); }, dur);
  } catch (e) { return false; }
  return true;
}
