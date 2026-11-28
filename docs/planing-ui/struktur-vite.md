# Rencana Struktur Folder ala Vue + Vite (JS biasa)

Status: draf, belum dieksekusi. Keputusan Rans (26 Nov 2026): folder dan path ala Vue/Vite, tetap JS biasa (tanpa framework Vue, tanpa berkas .vue).

## Kondisi sekarang (hasil pemindaian)
- Shell satu halaman `play.html` + `UT.Spa` (`src/core/spa-host.js`) sudah memuat 17 halaman sebagai view. Di luar shell: Splash, Gameplay, Tambang, Power-up, Index/TOS. Halaman `.html` lama di root masih ada (24 berkas).
- Kode bersama di `assets/js` (105 berkas, tanpa vendor); aset item di `data/`; game di `gameplay/` + `gameplay.html`; dunia tambang di `tambang-world/`.
- 856 tag `<script src>` klasik di halaman; 9 `type="module"`. Hanya 32 dari 105 berkas JS yang memakai `import/export`. Kode berbagi namespace global `window.UT`.
- Jalur buka: PWA (`sw.js` + `manifest.webmanifest` + `tools/gen-preload-manifest.py`), Electron (`main.js` memuat `index.html`, paket `**/*`), dan hosting statis.
- Konsekuensi untuk Vite: `vite build` tidak menyalin atau membundel `<script src>` klasik. Manfaat penuh Vite baru ada setelah skrip dijadikan ES module, jadi rencana dibagi bertahap.

## Struktur target
```
src/
  index.html  play.html  splash.html  gameplay.html  tambang.html  powerup.html  tos.html   (entri Vite)
  views/        <- src/views/*      (satu berkas per view SPA: shop.js, profile.js, ...)
  components/   <- src/components/*    (css + js per komponen: modal, tabs, button, ...)
  services/     <- src/services/*
  core/         <- src/core/*       (spa-host, page-shell, app, chest-reveal, ...)
  stores/       <- player-data.js, item-catalog.js, inventory-bridge.js
  systems/  renderers/  multiplayer/  data/ (katalog JS)
  styles/       <- assets/css/*
  gameplay/     <- gameplay/*   (HATI-HATI; dikerjakan terakhir)
  main.js       <- boot-guard, pwa, preloader, landscape
public/                    (disalin apa adanya ke dist/)
  sw.js  manifest.webmanifest  media-hash.json  icons/  audio/  fonts/  images/  data/
electron/main.js  electron/preload.js
supabase/  tests/  tools/  docs/   (tetap di root)
vite.config.js  package.json
```
Aset yang path-nya dibentuk saat runtime (`data/inventory/<kategori>/<id>/...`, gambar item, SFX) tetap statis di `public/` dan tidak di-import, sesuai aturan repo: `assets/` hanya UI statis, gambar item di `data/`.

## Fase
**Fase 0: persiapan.** Catat baseline: tes Node (tes merah yang sudah ada dicatat di `README.md` folder ini), daftar URL halaman, ukuran cache SW. Bekukan perubahan fitur selama pemindahan (pekerjaan modal kit dan hub menyentuh berkas yang sama).

**Fase 1: pindah folder dengan skrip otomatis (tanpa Vite).** `tools/restructure.py` memindahkan berkas dengan `git mv` dan memperbarui semua referensi: `src=`/`href=`, `import`, `url()` di CSS, string path di JS, `sw.js`, `manifest`, `gen-preload-manifest.py`, tes. Per domain, tiap domain diakhiri tes: styles -> components -> core/services/stores -> views -> renderers/systems/multiplayer -> data -> gameplay (terakhir).

**Fase 2: Vite sebagai dev server + build MPA.** `vite.config.js`: `root: 'src'`, `publicDir: '../public'`, `base: './'` (agar `file://` Electron dan PWA tetap jalan), `build.outDir: '../dist'`, `rollupOptions.input` berisi 7 entri di atas. Skrip klasik disalin dengan `vite-plugin-static-copy` sehingga urutan muat tidak berubah. `package.json`: `dev`, `build`, `preview`, `electron` (memuat `dist/`), `electron:build`.

**Fase 3: ES module bertahap (opsional, manfaat terbesar).** Per view: ganti banyak tag `<script>` menjadi satu entry module, pakai `import` antar berkas, `window.UT` tetap sebagai jembatan sementara. Three.js lewat npm. Hasil: minify, hash nama berkas, tree-shaking.

**Fase 4: PWA di atas build.** `sw.js` dan `gen-preload-manifest.py` membaca `dist/`; naikkan `VERSION`; uji pembaruan SW dari versi lama.

## Risiko dan penjagaan
- Path rusak di mana pun (856 tag, CSS, string runtime): skrip pindah + tes `image-paths` dan tes lain tiap domain; pemeriksa tautan yang gagal bila ada referensi mati.
- Service worker menyajikan cache lama: naikkan `VERSION`, uji dari instalasi lama; media permanen `ut-media` dijaga lewat `media-hash.json`.
- Electron: `directories`/`files` di `package.json` dan `loadFile` harus menunjuk `dist/`.
- `gameplay/` sensitif: dikerjakan terakhir; tes dadu/gameplay dijalankan di mesin Rans (2 tes dadu gagal di sandbox saya).
- Tes (127 berkas) punya path keras: diperbarui bersama skrip pindah.
- Jangan ubah ID, harga, atau kunci penyimpanan saat memindahkan aset (aturan `STRUKTUR.md`); `STRUKTUR.md` diperbarui di akhir.

## Kriteria selesai per fase
- Fase 1: semua tes lulus (kecuali yang sudah merah sebelumnya), tiap halaman terbuka lewat server statis biasa, tidak ada 404 di konsol.
- Fase 2: `npm run dev` dan `npm run build` jalan; `dist/` bisa dibuka lewat `file://` dan di Electron.
- Fase 3: tiap view yang dikonversi memuat satu entry module dan lolos tes.
- Fase 4: SW baru menggantikan SW lama tanpa cache basi.

## Keputusan Rans (26 Nov 2026)
1. Langsung di `main`, tanpa cabang. Konsekuensi: tidak boleh ada commit lain ke `main` selama satu fase berjalan (bekukan sesi lain, atau tarik dan gabung sebelum tiap push). Tiap fase diakhiri satu push setelah tes hijau.
2. Fase 3 (ES module) dikerjakan sekarang, bukan setelah rilis.
3. Folder logika halaman bernama `views/`.
4. Mulai sekarang, tidak menunggu bagian 3-4 (hub, modal kit). Pekerjaan UI baru harus ditunda atau diarahkan ke path baru setelah Fase 1.


