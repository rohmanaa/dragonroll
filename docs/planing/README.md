# Planning Dragon Roll: Performa dan Migrasi SPA

Dokumen ini adalah titik masuk untuk siapa pun (manusia atau AI) yang melanjutkan
pekerjaan. Baca bagian "Konteks" dan "Aturan kerja" dulu, lalu kerjakan tahap
sesuai urutan.

## Daftar dokumen

| File | Isi |
| --- | --- |
| `README.md` | Konteks, aturan kerja, status tahap, perintah umum (file ini) |
| `spa-rencana.md` | Gambaran besar SPA: tujuan, temuan, arsitektur, risiko, ukuran sukses |
| `spa-tahap1-detail.md` | Tahap 1: modul halaman `UT.PageModule` untuk Lobby dan Karakter |
| `spa-tahap2-detail.md` | Tahap 2: shell SPA, router, renderer bersama (pilot Lobby ↔ Karakter) |
| `spa-tahap3-detail.md` | Tahap 3: migrasi halaman lain satu per satu |
| `spa-tahap4-detail.md` | Tahap 4: pembersihan, service worker, dokumentasi |
| `rekomendasi-performa-lain.md` | Perbaikan performa di luar SPA: yang sudah selesai, ditolak, dan tersisa |

## Konteks

- Repo: `rohmanaa/dragonroll` (game Minecraft-style "Dragon Roll", PWA dan Electron,
  skrip klasik tanpa bundler, three.js, Supabase).
- Keluhan awal: game berat di HP. Dugaan penyebab terbesar: tiap pindah halaman
  (±12 halaman) memuat ulang `three.min.js` dan membuat `WebGLRenderer` baru.
- Branch kerja SPA: `spa-pilot` (dari `main`). Jangan push langsung ke `main`
  kecuali pemilik repo meminta.
- Bahasa: kode dan komentar memakai Bahasa Indonesia; ikuti gaya yang ada.
- Menjalankan lokal: `npx http-server -p 30002` (lihat `howtorun.txt`).
- Struktur aset: lihat `STRUKTUR.md`. `gameplay.html` dan folder `gameplay/`
  boleh diubah tetapi WAJIB hati-hati.

## Aturan kerja

1. Jangan menulis token, kunci API, atau rahasia ke file, commit, atau dokumen.
   Token GitHub yang pernah ditempel di chat harus dianggap bocor dan dicabut.
2. Jangan mengubah ID item, harga, atau kunci penyimpanan.
3. Tiap perubahan aset atau kode yang dikirim ke pengguna: naikkan `VERSION` di
   `sw.js` dan jalankan `python3 tools/gen-preload-manifest.py` (perlu `git add`
   dulu karena hash diambil dari indeks git). Tes `tests/sw-incremental-media.test.js`
   menjaganya.
4. Jalankan seluruh test sebelum dan sesudah tiap langkah (bagian "Perintah umum").
   Baseline 5 test gagal sejak awal; target: tidak menambah kegagalan baru.
5. Satu tahap = satu atau beberapa commit kecil di branch; jangan gabungkan tahap.
6. Halaman mandiri yang lama harus tetap berfungsi sampai tahap 4.
7. Tidak ada test render otomatis; verifikasi visual dengan Chrome headless
   (smoke test) dan minta pemilik mengecek di HP.
8. Commit message memakai awalan gaya repo: `perf(...)`, `feat(...)`, `fix(...)`,
   `test: ...`, `ui(...)`.

## Status tahap

| Tahap | Isi | Status |
| --- | --- | --- |
| 0 | DPR 1,5, antialias mati di HP, latar `.webp` 1280 px | Selesai, sudah di `main` |
| 1 | Modul halaman (`UT.PageModule`) untuk Lobby dan Karakter | Belum dimulai (rencana siap) |
| 2 | Shell SPA, router, renderer bersama (pilot) | Belum |
| 3 | Migrasi halaman lain | Belum |
| 4 | Pembersihan, SW, dokumentasi | Belum |

Perbarui tabel ini di akhir tiap tahap.

## Perintah umum

```bash
# semua test; cetak yang gagal
for t in tests/*.test.js; do timeout 60 node $t >/dev/null 2>&1 || echo "$t"; done

# baseline gagal sejak awal (bukan akibat SPA):
#   dice-registry-parity, gameplay-assets-external, pet-registry-parity,
#   pet-viewer-lifecycle, power-registry-parity

# cek sintaks satu file JS
node --check path/ke/file.js

# setelah ubah aset/kode: naikkan VERSION di sw.js (baris 12), lalu
git add -A && python3 tools/gen-preload-manifest.py && node tests/sw-incremental-media.test.js

# server lokal
npx http-server -p 30002
```

Chrome headless tersedia di lingkungan kerja AI sebelumnya (`google-chrome`);
Playwright Python terpasang tapi browser bawaannya belum diunduh, jadi pakai
Chrome sistem lewat `executable_path`.

## Keputusan terbuka (jawab sebelum tahap 2)

1. Router: hash (`#/lobby`) atau History API. Usulan: hash.
2. Shell baru (`app.html`) atau memperluas `lobby.html`. Usulan: shell baru.
3. `gameplay.html`/`play.html` masuk SPA atau tetap terpisah. Usulan: tetap
   terpisah sampai tahap 4 selesai.
4. Transisi antar halaman: spinner gaya Inventory yang sudah ada di `main`.

Jika pemilik belum menjawab, pakai usulan di atas dan catat di bagian
"Catatan keputusan" di bawah.

## Catatan keputusan

(isi di sini saat keputusan dibuat: tanggal, keputusan, alasan)
