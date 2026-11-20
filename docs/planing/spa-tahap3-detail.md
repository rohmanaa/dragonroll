# SPA Tahap 3 - Migrasi Halaman Lain

Prasyarat: tahap 2 selesai dan terverifikasi di HP. Satu halaman = satu
rilis kecil: modul, route, test, SW, commit sendiri. Jangan memigrasikan dua
halaman sekaligus.

## 1. Resep per halaman (ulangi untuk tiap halaman)

1. **Inventaris halaman.** Daftar `<script>` di `<nama>.html`, CSS yang dimuat,
   global yang dipakai/diekspor, `location.href`, handler `pageshow`, timer,
   listener, `UT.Events.on`, `PD.subscribe`, WebGL (renderer sendiri?).
2. **Ekstrak templat.** Isi `<body>` khusus halaman → `view.html` (atau string
   modul). Skrip inline dipindah ke file (pola `tools/extract-inline.py`).
3. **Bungkus skrip** jadi `UT.PageModule.define('<nama>', body)` sesuai tahap 1
   (bayangan `setTimeout`/`rAF`/`addEventListener`, ganti `UT.Events.on`,
   `PD.subscribe`, `document.addEventListener`, observer; `env.dispose` untuk
   sisanya).
4. **WebGL:** ganti `new THREE.WebGLRenderer` dengan `UT.SharedGL.acquire`.
   Aturan sama seperti Lobby: bersihkan semua geometri/material/tekstur di
   `unmount`.
5. **Daftarkan route** di shell, ganti `location.href='<nama>.html'` dari halaman
   SPA lain dengan `UT.Router.go('<nama>')`.
6. **Pertahankan halaman mandiri** (`<nama>.html` tetap berfungsi, `managed=false`).
7. **Test:** perbarui test yang membaca skripnya; tambah satu tes cleanup bila ada
   perilaku khusus.
8. **Verifikasi:** smoke test headless (buka rute, pindah ke dan dari rute lain
   20x, tanpa error konsol), cek memori, cek HP.
9. **Rilis:** naikkan `VERSION` SW, regenerasi manifest, commit
   `feat(spa): migrasi <nama>`. Perbarui tabel status di bawah.

## 2. Urutan dan catatan per halaman

Jumlah `<script>` dan pemakaian three dari `*.html` saat ini.

### Gelombang A - memakai WebGL (manfaat terbesar)

| Halaman | Script | Catatan |
| --- | --- | --- |
| `profile.html` | 19 | Renderer sendiri di `assets/js/pages/profile.js` (baris ±53, `sizeGL`); ada tabel `BG` ukuran latar 1672/1893 |
| `efek.html` | 17 | `data/inventory/aura/_shared/js/efek.js`; aura-fx |
| `pet.html` | 25 | `pet-viewer.js` (renderer, DPR, `premultipliedAlpha`); punya test `pet-viewer-lifecycle` (gagal sejak baseline; periksa dulu) |
| `tambang.html` | 16 | `data/mining/js/tambang.js`; ukuran kanvas dihitung sendiri, `setPixelRatio(1)`; menerima `?from=` |
| `dadu.html` | 16 | Renderer dadu lewat `dice-kit`; kualitas via preset di `dice-catalog.js` |
| `powerup.html` | 13 | `power-3d/power-renderer.js`; preset di `power-config.js` |
| `leaderboard.html` | 16 | podium 3D (`podium-fx.js`) |
| `friendship.html` | 18 | cek penggunaan three |
| `efek`/`floatingsample` | 17 / 3 | `floatingsample.html` hanya contoh; boleh dibiarkan mandiri |

Renderer dadu dan power punya opsi `transparent`, `powerPreference`, dan skala
piksel sendiri; `SharedGL.acquire(owner, opts)` harus bisa menerimanya tanpa
membuat renderer baru (opsi yang tak bisa diubah sesudah dibuat, seperti
`antialias`, dicatat di dokumen keputusan).

### Gelombang B - tanpa WebGL (mudah)

`shop`, `mode`, `inventory`, `hadiah-misi`, `chest`, `mail`, `settings`, `room`,
`frame`.
Catatan: `chest` memakai `chest-service` dan teks `lobby.html`/`lobby.js` di
testnya; `settings` punya tes preferensi (`settings-prefs`); `room` memakai
`room-modal-bridge.js`.

### Tidak dimigrasikan di tahap ini

`gameplay.html` (47 script, `gameplay/js/main.js` 4000+ baris) dan `play.html`,
`splash.html`, `index.html`. Mereka tetap halaman penuh (`location.href`) dan
router menangani keluar-masuk dengan memuat halaman biasa. Keputusan memasukkan
gameplay ke SPA diambil terpisah (lihat `spa-tahap4-detail.md`).

## 3. Navigasi lintas halaman

- Satu peta rute tunggal (`UT.Router.register`) menggantikan peta `ACT` di
  `lobby.js` dan sejenisnya. Aksi yang belum dimigrasikan jatuh ke
  `location.href` (router punya `go('x.html')` untuk halaman penuh).
- Parameter yang sudah dipakai: `?from=karakter.html`, `?coin=1`. Terjemahkan ke
  parameter rute dan pertahankan perilaku tombol "kembali" ke halaman asal.

## 4. Status migrasi (perbarui tiap rilis)

| Halaman | Gelombang | Status | Commit | Catatan |
| --- | --- | --- | --- | --- |
| lobby | pilot | - | - | tahap 2 |
| karakter | pilot | - | - | tahap 2 |
| profile | A | Selesai (kode & test) | `66a65d7` | SW v296; UT.PageModule + UT.SharedGL |
| efek | A | - | - | |
| pet | A | - | - | |
| tambang | A | - | - | |
| dadu | A | - | - | |
| powerup | A | - | - | |
| leaderboard | A | - | - | |
| friendship | A | - | - | |
| shop | B | - | - | |
| mode | B | - | - | |
| inventory | B | - | - | |
| hadiah-misi | B | - | - | |
| chest | B | - | - | |
| mail | B | - | - | |
| settings | B | - | - | |
| room | B | - | - | |
| frame | B | - | - | |

## 5. Kriteria selesai tahap 3

- Semua halaman gelombang A dan B berjalan di bawah router dan renderer bersama.
- Tidak ada pembuatan `WebGLRenderer` di luar `SharedGL` (kecuali offscreen satu
  kali pakai yang didokumentasikan).
- Pindah antar halaman SPA tidak memuat ulang `three.min.js`.
- Seluruh test: tidak ada kegagalan baru dibanding baseline.
- Diverifikasi di HP.
