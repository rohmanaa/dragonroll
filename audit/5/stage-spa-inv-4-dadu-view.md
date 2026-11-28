# SPA Inventory tab â†’ view â€” Tahap 4 (Dadu) + DiceKit ke SharedGL (opt-in)

Branch: `spa-inv-dadu` (bertumpu pada spa-inv-efek cb673ad; main masih 29bafbd). Pola: stage 1-3.

## Berubah
- `data/inventory/dice/_shared/js/dadu.js` â†’ modul `UT.PageModule` 'dadu'. Timer, `keydown`/`resize`, `dicekit-ready`, `UT.Events.on`, `PD.subscribe`, LiveSync lewat env; callback async & `mountKit` dijaga `env.disposed`. Unmount: `KIT.dispose()` (animasi, fisika, listener, partikel) lalu renderer bersama dilepas.
- `src/renderers/dice-kit/dice-renderer.js`: opsi BARU `sharedGL` (nama pemilik). Bila diberikan dan `UT.SharedGL` ada â†’ renderer + kanvas dipinjam dari SharedGL (`acquire`), dan `dispose()` memanggil `release` (TIDAK `renderer.dispose()`). TANPA opsi ini jalur lama utuh (renderer sendiri) â€” gameplay.html (dibekukan) memakai DiceKit yang sama dan bisa punya beberapa instance sekaligus, sedangkan SharedGL hanya satu pemilik; gameplay.html/index.js tidak diubah dan tidak meminta SharedGL.
- `dadu.html`: `page-module.js`, `inv-tabs.js`, `shared-gl.js` (sebelum dice-kit), `inv-tabbar.css`. Tab Dadu memanggil `DiceKit.mount(..., {sharedGL:'inv-dadu'})`.
- Routing: `inv-tabs.js` VIEW_TABS, `spa-host.js` (VIEWS + INV_VIEW_TABS), `frame-guard.js`, `play.js` prefetch. `sw.js` v319; preload manifest diregenerasi.
- Perilaku yang berbeda di mode SharedGL (kecil): `powerPreference:'high-performance'` dan `antialias` mengikuti konteks bersama (antialias mati di HP, hidup di desktop).
- Penjaga `no-webglrenderer-outside-sharedgl`: dice-renderer.js masuk daftar MODE_GANDA (jalur mandiri gameplay disengaja; jalur SharedGL wajib ada). Pelanggar murni tersisa: power-renderer.js.

## Tes
- Baru: `tests/dadu-view.test.js` (statis, termasuk jalur mandiri gameplay tidak berubah). Diperbarui: spa-host (contoh non-view kini powerup.html; canon dadu), frame/pet/efek-view, inventory-module, penjaga WebGLRenderer.
- Seluruh suite: 6 kegagalan yang sama dengan baseline main; pesan kegagalan tes dice/gameplay identik dengan baseline (jadi tes-tes itu TIDAK memverifikasi perubahan ini).
- NOT TESTED di browser: pratinjau dadu 3D (lempar saat klik pratinjau / ganti dadu, suara, partikel), pindah Daduâ†”Efekâ†”Frameâ†”Pet berulang (acquire/release SharedGL), gameplay.html (dadu mandiri) â€” wajib dicek tidak berubah.

## Sisa
powerup masih iframe (+ power-renderer.js). Setelah itu: hapus iframe + pemanasan dari inventory.js.

