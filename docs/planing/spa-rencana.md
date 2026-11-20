# Rencana Migrasi SPA (Satu Renderer WebGL)

Status: tahap 1 SELESAI (2026-11-20, branch `spa-pilot`); tahap 2-4 belum. Lihat `README.md` untuk tabel status.
Terakhir diperbarui: 2026-11-20.

## 1. Latar belakang dan tujuan

Game terasa berat di HP. Penyebab terbesar yang dicurigai: tiap pindah halaman
(12 halaman) memuat ulang `three.min.js` (±600 KB), membuat `WebGLRenderer` baru,
dan mengompilasi ulang shader. Perbaikan murah sudah masuk ke `main`:

- DPR dibatasi 1,5 dan `antialias` mati di HP (karakter, gameplay, lobby, profil,
  aura, pet, tambang, duel, floatingsample).
- Latar `.webp` diperkecil ke 1280 px (kualitas 78).

Tujuan SPA: satu halaman, satu renderer, satu konteks GPU. Pindah halaman tidak
lagi memuat ulang three.js dan tidak membuat konteks WebGL baru.

Bukan tujuan: mengubah tampilan, aturan game, atau data pemain.

## 2. Temuan dari kode (per 2026-11-20)

- Lobby (`data/lobby/js/lobby.js`, 17 KB) dan Karakter
  (`data/inventory/character/_shared/js/karakter.js`, 100 KB, 1829 baris) adalah
  skrip klasik dengan deklarasi `const`/`let`/`function` di level atas. Total 154
  deklarasi di dua file ini; nama seperti `cv`, `renderer`, `scene`, `sun` bentrok
  bila dimuat bersamaan.
- Registrasi yang harus dibersihkan saat pindah halaman:
  - lobby: 4 `addEventListener` (window), 1 `document.addEventListener`,
    3 `UT.Events.on`, 2 `PD.subscribe`, 1 `Ambience.on`, 1 `setInterval`,
    2 `setTimeout`, 1 loop `requestAnimationFrame`, plus `LiveSync` (`LS.start`).
  - karakter: 4 `requestAnimationFrame` (satu loop utama), 2 `setTimeout`,
    2-3 `addEventListener`, 1 `UT.Events.on`, 1 `PD.subscribe` (dijaga flag
    `window.__curSub`), 1 `ResizeObserver`.
- Pengembalian fungsi berhenti langganan sudah ada: `UT.Events.on` dan
  `Ambience.on` mengembalikan fungsi unsubscribe; `PD.subscribe` perlu dicek.
- Navigasi memakai `location.href` (mis. `go()` di lobby memudar 330 ms lalu
  pindah). Tidak ada handler inline `onclick=` di `lobby.html` dan `karakter.html`.
- Scene lobby (pulau, hero, mood siang/malam) dan karakter (editor dye) berbeda
  total. Satu renderer berarti satu canvas dengan adegan yang diganti per halaman.
- Service worker punya cache media permanen berbasis `assets/media-hash.json`.
  Setelah mengubah aset: naikkan `VERSION` di `sw.js` dan jalankan
  `python3 tools/gen-preload-manifest.py`.
- Aplikasi juga dibungkus Electron (`package.json`); SPA harus tetap jalan di
  keduanya.
- Test yang membaca skrip sebagai teks atau mengeksekusinya (harus tetap lulus,
  lihat bagian 6): `aura-view`, `blocky-actions`, `daily-reward-30`,
  `chest-service`, `karakter-equip` (`new Function(...)`), `pvp-knight-gear`.

- **Update dari tahap 1:** halaman dijalankan di dalam `<iframe>` oleh pembungkus
  `play.html` (musik, overlay, prefetch). Shell SPA sebaiknya memakai ulang
  pembungkus ini. Rincian di `spa-tahap1-detail.md` bagian 10 dan
  `spa-tahap2-detail.md` bagian 0.

## 3. Arsitektur target

```
index/shell.html
 ├─ three.min.js (sekali)
 ├─ UT.PageModule   → define / mount / unmount, pelacak cleanup per halaman
 ├─ UT.Router       → hash route (#/lobby, #/karakter), history, tombol Back
 ├─ UT.SharedGL     → satu WebGLRenderer + satu canvas, API acquire/release
 └─ halaman = modul { html, css, mount(root, env), unmount() }
```

Prinsip:

1. Halaman lama tetap jalan sebagai halaman mandiri selama migrasi (kompatibel
   mundur). Modul yang sama dipakai oleh halaman mandiri maupun shell SPA.
2. Setiap modul membersihkan semua yang didaftarkannya saat `unmount`.
3. Renderer dipakai bersama. Scene, kamera, dan geometri milik halaman dibuang
   (`dispose`) saat pindah; renderer sendiri tidak dibuat ulang.
4. Pindah halaman dilakukan bertahap, satu halaman per rilis kecil.

## 4. Tahap pengerjaan

Rincian tahap 1 ada di `spa-tahap1-detail.md`.

### Tahap 1 - Modul halaman (tanpa mengubah perilaku)

Bungkus `lobby.js` dan `karakter.js` menjadi modul dengan `mount` dan `unmount`.
Halaman mandiri otomatis memanggil `mount` sehingga perilaku sama.
Selesai bila: semua test yang lulus sebelumnya tetap lulus, dua halaman
terbuka normal secara mandiri, dan `unmount` membersihkan semua registrasi.
**Status: selesai** (ceklis di `spa-tahap1-detail.md` bagian 9).

### Tahap 2 - Shell SPA dan renderer bersama

Buat `UT.Router`, `UT.SharedGL`, dan shell yang memuat Lobby dan Karakter.
Ganti `location.href` antar dua halaman itu dengan router. Ukur waktu pindah
halaman dan jumlah konteks WebGL sebelum dan sesudah.
Selesai bila: pindah Lobby ↔ Karakter tidak membuat konteks WebGL baru dan tidak
memuat ulang `three.min.js`.

### Tahap 3 - Migrasi halaman lain, satu per satu

Urutan usulan (yang memakai WebGL dulu): profil, aura/efek, pet, tambang, lalu
halaman tanpa WebGL (shop, mode, leaderboard, friendship, hadiah-misi, room,
chest, mail, settings). Tiap halaman: modul, route, test, rilis.

### Tahap 4 - Rapikan

Hapus jalur halaman mandiri yang tidak dipakai, sesuaikan service worker
(precache shell), perbarui `README.md` dan `STRUKTUR.md`.

## 5. Keputusan terbuka

- Router: hash (`#/lobby`) atau History API? Hash lebih aman untuk Electron dan
  hosting statis; History API butuh fallback server.
- Satu `index.html` baru sebagai shell, atau `lobby.html` yang diperluas?
- Gameplay (`gameplay.html`, `play.html`, `gameplay/js/main.js` 4000+ baris)
  masuk SPA atau tetap halaman terpisah? Usulan: tetap terpisah di tahap 1-3.
- Transisi antar halaman: pakai spinner gaya Inventory yang sudah ada di `main`.

## 6. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Memori bocor karena listener, timer, atau loop tidak dilepas | Semua registrasi lewat `env` yang melacak dan melepas saat `unmount`; tes unit untuk cleanup |
| Bentrok nama global antar halaman | Tiap skrip dibungkus fungsi modul |
| Test yang membaca teks sumber rusak karena pembungkusan | Jalankan seluruh test tiap langkah; sesuaikan test hanya bila memang membaca bentuk lama |
| Regresi visual tidak terdeteksi (tidak ada test render) | Tes headless Chrome untuk smoke test, plus cek manual di HP |
| Cache service worker menyajikan versi lama | Naikkan `VERSION` dan regenerasi manifest tiap rilis |
| Perilaku `pageshow`/bfcache berubah | Pindahkan logika `pageshow` ke `mount` dan event router |

## 7. Baseline test (sebelum tahap 1)

Dijalankan dengan `node tests/<nama>.test.js` pada `main`.
79 lulus, 5 gagal sejak awal (bukan akibat pekerjaan SPA):

- `dice-registry-parity`
- `gameplay-assets-external`
- `pet-registry-parity`
- `pet-viewer-lifecycle`
- `power-registry-parity`

Target: tidak ada test baru yang gagal di tiap tahap.

## 8. Ukuran keberhasilan

- Jumlah `WebGLRenderer` yang dibuat saat berpindah Lobby ↔ Karakter: 0 (setelah
  kunjungan pertama).
- `three.min.js` dimuat sekali per sesi.
- Waktu dari klik hingga halaman tujuan interaktif turun (ukur di HP uji; catat
  angka sebelum dan sesudah).
- Tidak ada kenaikan memori setelah 20 kali bolak-balik Lobby ↔ Karakter.
