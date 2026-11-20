# SPA Tahap 4 - Pembersihan, Service Worker, Dokumentasi

Prasyarat: tahap 3 selesai.

## 1. Titik masuk

- Ubah `splash.html`/`index.html` agar mengarah ke `app.html#/lobby` (setelah
  pemilik setuju). Pertahankan redirect lama (`lobby.html` → `app.html#/lobby`)
  supaya tautan dan bookmark lama tetap hidup.
- `manifest.webmanifest`: perbarui `start_url` ke shell SPA.
- Electron (`package.json`/`main.js`): pastikan jendela memuat shell SPA.

## 2. Service worker

- Precache: shell (`app.html`), `router.js`, `shared-gl.js`, `page-module.js`,
  templat halaman, `three.min.js`.
- Fallback offline untuk navigasi: kembalikan `app.html`.
- Pastikan pembaruan inkremental media (`media-hash.json`) tetap bekerja.
- Naikkan `VERSION`, regenerasi manifest, jalankan
  `tests/sw-incremental-media.test.js` dan test transisi.

## 3. Pembersihan kode

- Hapus jalur "halaman mandiri" yang tidak dipakai lagi, hanya setelah semua
  halaman terverifikasi (simpan di branch/tag `pre-spa-cleanup`).
- Hapus peta `ACT`/`location.href` yang sudah digantikan router.
- Hapus handler `pageshow`/bfcache yang tak lagi relevan; pertahankan bila halaman
  penuh (gameplay) masih memakainya.
- Satukan duplikasi: deklarasi `isMobile`/antialias, hitung DPR, dan preset
  kualitas ke satu helper (`UT.SharedGL.setQuality`).
- Cek `tools/` dan `tests/` yang mereferensikan file yang dihapus.

## 4. Gameplay (keputusan terpisah)

`gameplay.html` (47 script) dan `gameplay/js/main.js` (4000+ baris) punya
renderer sendiri (`antialias`, DPR 1,5). Pilihan:

1. Tetap halaman penuh. Router keluar ke `gameplay.html`, dan kembali ke
   `app.html#/lobby`. Paling aman; konteks GPU baru hanya saat main.
2. Jadikan modul SPA. Perlu pemecahan `main.js` (kode global, loop game,
   multiplayer/Supabase, audio) dan pengujian ketat. Kerjakan hanya bila
   pengukuran menunjukkan pembuatan konteks saat masuk game masih terasa berat.

Usulan: pilihan 1.

## 5. Dokumentasi

- `README.md`: cara menjalankan SPA, struktur shell/router/modul.
- `STRUKTUR.md`: tambahkan bagian arsitektur SPA dan tempat file baru.
- `docs/planing/README.md`: perbarui tabel status.
- Catat angka akhir pengukuran (lihat `spa-tahap2-detail.md`, bagian 5).

## 6. Kriteria selesai

- Aplikasi dimulai dari shell SPA; tautan lama tetap bekerja.
- Seluruh test: tidak ada kegagalan baru dibanding baseline (idealnya 5 yang
  lama juga diperbaiki atau dicatat penyebabnya).
- Pengukuran akhir lebih baik dari baseline di HP uji.
- Dokumentasi dan tabel status mutakhir.
