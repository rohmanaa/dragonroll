# Checkpoint 2.3 — Portal & Spatial Distortion

Branch `restruktur-fx` · baseline `cef4413` · kode `7883f2d`.

## Temuan audit (baseline)
- Portal yang ada di game (`addPortalFX`, portal Block 100) adalah dekorasi/lingkungan: glow ungu dan partikel diam. Itu Environment FX dan di luar cakupan phase ini, tidak disentuh.
- **Tidak ada kejadian gameplay yang membuka/menutup portal atau memasukkan pion ke portal.** Aturan melarang mengubah gameplay, jadi tidak ada pemicu baru yang ditambahkan.

## Implementasi
`portal(pos, {yaw, scale, idle})` mengembalikan handle `{id, close(), stop(), enter(), exit()}`:
- Opening 0,5 dtk, idle (default 2,5 dtk, maksimum 12), closing 0,4 dtk; `close()` memperpendek idle.
- Bentuk dan kedalaman: disc gelap di belakang, tiga cincin berlapis dengan kedalaman berbeda (energy ring) berputar berlawanan arah, dan bingkai voxel (8 saat Low/Reduce, 12 selain itu).
- Portal particles: percik mengorbit dan terhisap ke pusat; percik saat membuka dan menutup; cincin kolaps saat menutup.
- `portal-entry`: serpihan dan cincin tertarik ke pusat. `portal-exit`: serpihan keluar searah normal portal + cincin melebar.

`distort(pos, {dir, scale, dur})`: titik pusat = `pos`, arah = `dir` (yaw).
- Energy ripple: tiga cincin tanah bergantian, berbentuk elips memanjang searah `dir`.
- Spatial wave: cincin tegak lurus `dir` yang bergerak searah `dir`.
- Distortion ring: cincin miring berdenyut.
- Vortex pull: serpihan berputar ke titik pusat. Dimensional fragment: kubus lebih besar yang hanyut searah `dir`. Energy collapse: cincin menyempit + percik terakhir.

Ringan: paling banyak 6 mesh bertransparansi + partikel dalam kuota; tanpa shader khusus (MeshBasicMaterial, additive, `depthWrite:false`), jadi aman untuk perangkat mobile. Opacity puncak ≤ 0,9 (diuji).

Satu-satunya pemakaian gameplay: `distort` di titik tengah saat Ender Swap (2.2). `portal` tersedia lewat `UT.GameplayFX.spatial('portal', …)` dan cue `spfx`, tetapi belum dipicu oleh gameplay mana pun.

## Pengujian
Portal: bentuk (≥ 8 mesh), buka → idle → tutup, `close()` dua kali, `stop()`, `enter/exit`, tidak ada sisa. Distorsi: pusat dan elips searah `dir`. Plus semua tes lifecycle/seed/kualitas/Reduce Motion untuk kedua kind. THREE r128 asli headless lulus.

## Risiko tersisa
- Portal belum punya pemicu gameplay (keputusan produk di luar Phase 2).
- Tampilan belum dilihat di browser; kedalaman portal perlu dinilai mata dari sudut kamera game.

## Commit
`7883f2dcbcb8edfeded7c8e9caa67b847d15e584`.
