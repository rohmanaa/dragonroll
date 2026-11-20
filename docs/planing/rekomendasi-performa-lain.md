# Rekomendasi Performa di Luar SPA

Hasil analisis awal (2026-11-19). Status tiap butir dicatat supaya tidak dikerjakan
dua kali.

## Sudah selesai (di `main`)

| Butir | Rincian |
| --- | --- |
| DPR 2 → 1,5 | `gameplay/js/main.js`, `karakter.js`, `pet-viewer.js`, `floatingsample.js` |
| `antialias` mati di HP | Kondisi: `navigator.maxTouchPoints>0` dan UA `Mobi\|Android\|iPhone\|iPad`. Dipasang di gameplay, karakter, lobby, profil, aura (`efek.js`), pet, tambang, duel (`duel-ui.js`), floatingsample. Desktop tetap antialias |
| Latar `.webp` 1672×941 → 1280×720, kualitas 78 | Sudah di `main` (29 file, 6,0 → 3,0 MB); hash media diregenerasi; SW dinaikkan |

## Ditolak setelah diukur

**Lazy-load manifest inventory di lobby.** Total manifest aura dan karakter yang
dimuat lobby hanya ±9 KB (aura) plus beberapa KB karakter; hematnya kecil.
`lobby.js` memakai `ItemCatalog.byId` untuk frame, aura, dan karakter yang
sedang dipakai, sehingga menunda manifest mengubah urutan inisialisasi dan
berisiko item yang dipakai tidak tampil. Bobot 1 MB script lobby sebagian besar
`three.min.js` (±590 KB), `blocky-character.js` (±64 KB), `aura-fx.js`
(±61 KB), `character-data.js` (±50 KB), `item-catalog.js` (±44 KB). Jangan
dikerjakan ulang kecuali ada ukuran baru yang menunjukkan manfaat.

## Belum dikerjakan (urutan prioritas)

1. **Satu renderer / SPA.** Dikerjakan lewat `spa-*.md`.
2. **Pakai satu build three.js.** Repo punya `three.min.js` (≈590 KB, dipakai
   halaman) dan `three.r170.module.min.js`. Pastikan halaman memakai versi yang
   sama dan tidak memuat keduanya; hitung dampak bila pindah ke modul ES dengan
   tree-shaking (butuh bundler atau import map, perubahan besar). Tahap awal:
   audit `grep -rn "three" *.html` untuk memastikan tidak ada pemuatan ganda.
3. **Sisa DPR dan antialias di kanvas 2D/efek.** `assets/js/splash-fx.js` dan
   `assets/js/podium-fx.js` memakai `Math.min(2, devicePixelRatio)`; turunkan ke
   1,5 bila kanvasnya besar dan lihat dampaknya.
4. **`renderer` offscreen.** `character-face.js` (baris ±21) dan `karakter.js`
   (baris ±1097) membuat renderer `antialias:true, preserveDrawingBuffer:true`
   untuk render gambar sekali pakai. Pertimbangkan satu renderer offscreen
   bersama atau render ke `WebGLRenderTarget` pada renderer utama.
5. **Latar lebar lain.** Masih ada gambar >1280 px (mis. 1893×831, 1450×130,
   2752×1536). Periksa pemakaian sebenarnya (ukuran tampil) sebelum diperkecil;
   jangan mengecilkan yang dipakai sebagai koordinat tetap (lihat tabel `BG` di
   `profile.js` dan `BG_W/BG_H` di `night-fog.js`; keduanya aman jika rasio sama).
6. **Parse awal skrip.** Bila perlu, `defer`/`async` untuk skrip non-kritis atau
   pemisahan `character-data.js` (50 KB) yang hanya dipakai di Karakter. Ukur
   dulu dengan Chrome Performance panel.
7. **Profiling nyata di HP.** Sebelum perubahan besar berikutnya, rekam
   Performance profile di HP menengah (Lobby dan satu perpindahan halaman) dan
   simpan angkanya di `docs/planing/` sebagai baseline.

## Catatan

- Setiap perubahan aset/kode: naikkan `VERSION` di `sw.js`, regenerasi
  `assets/media-hash.json` dan `assets/preload-manifest.json` (lihat
  `README.md` utama).
- Preset kualitas yang sudah ada (`power-config.js`, `dice-catalog.js`, grafik
  4 tingkat di Settings) adalah mekanisme resmi; jangan menduplikasi logika
  kualitas di tempat lain.
