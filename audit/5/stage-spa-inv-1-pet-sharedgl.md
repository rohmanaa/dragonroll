# SPA Inventory tab â†’ modul â€” Tahap 1 (Pet): renderer ke SharedGL

Branch: `spa-inv-pet` (dari `main` 8eeb2b6). Tidak di-merge ke main.

## Berubah
- `data/inventory/pet/_shared/js/pet-viewer.js`: tidak lagi `new THREE.WebGLRenderer`; memakai `UT.SharedGL.acquire('inv-pet', {canvas, shadows:false})`. Kanvas halaman diganti kanvas bersama (id/class/style/aria disalin), jadi `canvas` di viewer diperbarui ke kanvas hasil acquire. Teardown memanggil `SharedGL.release('inv-pet')`; renderer bersama TIDAK di-dispose dan tidak `forceContextLoss`.
- `pet.html`: memuat `src/core/shared-gl.js` setelah `three.min.js`, sebelum `pet-viewer.js`.
- `tests/pet-viewer-lifecycle.test.js`: stub `UT.SharedGL`; assert acquire/release dan renderer tidak di-dispose.
- `tests/no-webglrenderer-outside-sharedgl.test.js` (baru): penjaga kriteria. Pelanggar tersisa: power-renderer.js, dice-renderer.js, efek.js. Pengecualian sengaja: floatingsample.js, src/gameplay/js/main.js, src/gameplay/js/duel-ui.js (dibekukan).

## Tidak berubah
gameplay.html, gameplay/, game-integration.js, player-data.js, supabase/, data/frame, ItemCatalog (147 â†’ 167 item total sesuai baseline), API publik. Tab Pet MASIH iframe.

## Tes
- Lulus: pet-viewer-lifecycle, pet-catalog, pet-model-registry, shared-gl, inventory-tabs, inventory-module, tes penjaga baru.
- Gagal juga di baseline main (bukan dari perubahan ini): dice-registry-parity, gameplay-assets-external, pet-registry-parity (933 vs 908), power-registry-parity, dice-landing-stall, gameplay-dice-throw-race. `live-sync` flaky (lulus saat diulang).
- NOT TESTED: tampilan nyata di browser (tidak ada browser di lingkungan ini). Perlu cek manual: pratinjau 3D Pet di tab Pet (putar/seret, ganti Pet, partikel, transparansi latar).

## Belum dikerjakan (butuh keputusan)
Tab Pet sebagai modul di dokumen yang sama. CSS tab (`#tabs`, `#back`, `#title`, `#toast`, `#fade`, `html/body`, `#stage`) bentrok dengan shell inventory.css, dan ID sama (`#left`, `#grid`, `#use`...) dipakai antar tab. Opsi: Shadow DOM per tab (isolasi CSS+ID tanpa menulis ulang CSS; selector `body.*` perlu jadi `:host(.*)`, `@font-face` tetap di dokumen) atau scoping CSS manual. pet.html tetap harus jalan mandiri untuk room (`?from=room`).

## Tambahan: pemanasan tab (prioritas pemilik: pindah tab tanpa loading)
- `src/views/inventory.js`: setelah tab pertama selesai dimuat, tab lain dimuat satu per satu di latar belakang (kelas `.warm`: display:block, opacity 0, tidak bisa diklik; setelah selesai kembali display:none). Batas tunggu 6 dtk per tab. Dilewati bila `saveData` atau `deviceMemory < 4`.
- `assets/css/pages/inventory.css`: `.view.warm`, `.view.warm.on`.
- `sw.js`: VERSION v314 â†’ v315 (aset cache-first).
- NOT TESTED di browser: beban memori/GPU saat 4 iframe dimuat berurutan (tiap iframe masih membuat konteks WebGL sendiri sampai tabnya jadi modul).

## Tahap 1b: tab Pet jadi VIEW (tanpa iframe) â€” menggantikan pemanasan sebagai solusi utama
Keputusan pemilik: tab harus semudah halaman lain (seperti Lobby/Karakter), bukan iframe yang "dipanaskan". Pet kini view di play.html.
- Pola: sama dengan view lain (UT.PageModule + spa-host loader); CSS/DOM Pet dipasang hanya saat Pet aktif dan dilepas saat pergi, jadi TIDAK ada bentrok CSS/ID dengan shell Inventory (Shadow DOM tidak diperlukan).
- `src/core/inv-tabs.js` (baru): daftar tab + markup bar tab bersama (dipakai inventory.js & pet-page.js); `VIEW_TABS = {pet:'pet.html'}`.
- `assets/css/inv-tabbar.css` (baru): bar tab + latar/grid mode view, semua selector di bawah `#invtabs` / `body.inv-view`.
- `pet-page.js` â†’ modul 'pet'; `pet-viewer.js` â†’ modul 'pet-viewer' (state per-mount; unmount = release SharedGL). Semua timer/listener/langganan lewat env; callback async setelah unmount dijaga `env.disposed`.
- `spa-host.js`: `pet.html` = view; `inventory-bridge.js` dilewati; `canon()` mengubah `inventory.html?tab=pet` (atau tab terakhir = pet) langsung ke view pet. `frame-guard.js`, `play.js` (prefetch) mengenal pet.
- `inventory.js`: di shell, membuka tab Pet = `UT.Spa.go('pet.html')`, bukan iframe. Mandiri (tanpa shell) tetap iframe.
- Mode mandiri / embed / room (`pet.html?from=room`) tidak berubah (modul auto-mount saat skrip dimuat).
- `sw.js` v316; `assets/preload-manifest.json` diregenerasi.
- Tes: spa-host (canon), pet-view (baru), pet-viewer-lifecycle, inventory-tabs/module, aura-registry-parity diperbarui. Seluruh suite = 6 kegagalan yang sama dengan baseline main (pesan identik).
- NOT TESTED di browser: tampilan view Pet (posisi bar tab, latar, judul "Inventory"), pindah Lobbyâ†”Petâ†”tab lain berulang kali (mount/unmount viewer, SharedGL), tombol kembali/Esc.
- Pemanasan tab (v315) tetap ada untuk tab iframe yang tersisa (frame, dadu, efek, power); hilang saat tab-tab itu dijadikan view.


