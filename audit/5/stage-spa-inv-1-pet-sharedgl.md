# SPA Inventory tab → modul — Tahap 1 (Pet): renderer ke SharedGL

Branch: `spa-inv-pet` (dari `main` 8eeb2b6). Tidak di-merge ke main.

## Berubah
- `data/inventory/pet/_shared/js/pet-viewer.js`: tidak lagi `new THREE.WebGLRenderer`; memakai `UT.SharedGL.acquire('inv-pet', {canvas, shadows:false})`. Kanvas halaman diganti kanvas bersama (id/class/style/aria disalin), jadi `canvas` di viewer diperbarui ke kanvas hasil acquire. Teardown memanggil `SharedGL.release('inv-pet')`; renderer bersama TIDAK di-dispose dan tidak `forceContextLoss`.
- `pet.html`: memuat `assets/js/core/shared-gl.js` setelah `three.min.js`, sebelum `pet-viewer.js`.
- `tests/pet-viewer-lifecycle.test.js`: stub `UT.SharedGL`; assert acquire/release dan renderer tidak di-dispose.
- `tests/no-webglrenderer-outside-sharedgl.test.js` (baru): penjaga kriteria. Pelanggar tersisa: power-renderer.js, dice-renderer.js, efek.js. Pengecualian sengaja: floatingsample.js, gameplay/js/main.js, gameplay/js/duel-ui.js (dibekukan).

## Tidak berubah
gameplay.html, gameplay/, game-integration.js, player-data.js, supabase/, data/frame, ItemCatalog (147 → 167 item total sesuai baseline), API publik. Tab Pet MASIH iframe.

## Tes
- Lulus: pet-viewer-lifecycle, pet-catalog, pet-model-registry, shared-gl, inventory-tabs, inventory-module, tes penjaga baru.
- Gagal juga di baseline main (bukan dari perubahan ini): dice-registry-parity, gameplay-assets-external, pet-registry-parity (933 vs 908), power-registry-parity, dice-landing-stall, gameplay-dice-throw-race. `live-sync` flaky (lulus saat diulang).
- NOT TESTED: tampilan nyata di browser (tidak ada browser di lingkungan ini). Perlu cek manual: pratinjau 3D Pet di tab Pet (putar/seret, ganti Pet, partikel, transparansi latar).

## Belum dikerjakan (butuh keputusan)
Tab Pet sebagai modul di dokumen yang sama. CSS tab (`#tabs`, `#back`, `#title`, `#toast`, `#fade`, `html/body`, `#stage`) bentrok dengan shell inventory.css, dan ID sama (`#left`, `#grid`, `#use`...) dipakai antar tab. Opsi: Shadow DOM per tab (isolasi CSS+ID tanpa menulis ulang CSS; selector `body.*` perlu jadi `:host(.*)`, `@font-face` tetap di dokumen) atau scoping CSS manual. pet.html tetap harus jalan mandiri untuk room (`?from=room`).
