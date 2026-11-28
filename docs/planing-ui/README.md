# Rencana UI & SPA — sisa pekerjaan

Dibuat 28 Nov 2026. Folder ini menggantikan `docs/planing/` (audit ekonomi, tidak disentuh) sebagai rencana kerja aktif.
Aturan tetap tiap tugas: ID, `data-*`, dan handler tidak berubah · jangan menyalin CSS komponen · tes `node tests/*.test.js` hijau ·
naikkan `VERSION` di `sw.js` (+1) · commit + push ke `main` · laporkan yang tidak bisa disamakan.

## 0. Kondisi sekarang (ringkas)

| Area | Status |
|---|---|
| Shell satu halaman (`play.html` + `UT.Spa`) | 17 halaman sudah jadi view. Di luar shell: Splash, Gameplay, Tambang, Power-up (ada tes yang menegaskan ini), Index/TOS (statis) |
| Pindah halaman mulus | Selesai untuk view biasa: view tertahan (`.pending`) sampai gambar siap; preload mendekode & memegang gambar (`spa-host.js`, SW v603) |
| Tombol & tab HUD (`ut-gl`, `.ut-tabs`) | Selesai di semua halaman, termasuk Mode & Room |
| Komponen baru | `card-panel-new` (bingkai glossy + isi gelap solid), `player-card` (baris Peringkat/Pesan/Teman), `stat-card` (kartu abu/hijau/kuning) |
| Modal kit (`ut-mk`) | Selesai: Profil, Pet, Shop, Pengaturan. Belum: lihat bagian 4 |
| Tes merah (sudah merah sebelum kerja ini) | `gameplay-loading`, `mode-module`, `page-transition-loading`, `store-card-status` |

## 1. Verifikasi di perangkat asli (kamu) — blokir untuk langkah lain

- Pindah Lobby → Toko → Profil → Mode → Lobby di HP/browser utama. Catat halaman yang masih "berantakan dulu" dan asal pindahnya.
- Pengukuran saya (tanpa GPU, 25 dtk preload): 180–440 ms sampai tampil, semua gambar siap. Sebelumnya 60–210 ms tapi 13–17 gambar menyusul.
- Selesai bila: tidak ada gambar/bingkai yang muncul menyusul di 4 rute di atas.

## 2. Pulihkan tes merah

1. Jalankan tiap tes sendiri, catat pernyataan yang gagal (`page-transition-loading` gagal di "navigation curtain handler exists").
2. Putuskan per tes: kode benar & tes usang → perbarui tes · kode regresi → perbaiki kode. Jangan melonggarkan tes tanpa alasan.
3. Selesai bila `for f in tests/*.test.js; do node $f; done` tanpa FAIL.

## 3. Hub Profil · Teman · Pesan · Pengaturan — pindah tab mulus

- `account-hub.js` `enter()` memasang CSS lalu `innerHTML` tanpa menunggu gambar; ganti dengan pola yang sama seperti `spa-host.js` (`.pending` + `settle`).
- Pertimbangkan memindahkan `settle`/`retain` ke satu modul bersama agar tidak ada dua salinan.
- Selesai bila pindah tab tidak menampilkan kartu/ikon yang muncul menyusul; tes hub tetap hijau.

## 4. Modal kit untuk sisa halaman

Resep (dari Shop/Pet): tambah `assets/components/modal/modal-kit.css` + `assets/js/core/modal-kit.js`; kotak jadi `.ut-mk` dengan `padding-top ≥ 100px`;
judul `.ut-mk-t` anak langsung; tutup `.ut-mk-x ut-gl ut-c-r` (tanpa `<img>`); `UT.ModalKit.watch(el,{openClass,labelledBy,initialFocus})` dibungkus `try` dan `env.own`.
Tombol aksi `ut-gl` sesuai warna; bila aksi merah, BATAL jadi `d` (gelap). Hapus CSS bingkai/tombol lama setelah dicek tidak dipakai halaman lain.

| Urutan | Target | File utama | Catatan |
|---|---|---|---|
| 1 | Popup bersama | `assets/js/systems/game-dialog.js`, `assets/js/hearts-gate.js`, `UT.UI.modal` di `core/app.js`, `core/chest-reveal.js` | Dipakai banyak halaman; ubah sekali, cek semua pemakai |
| 2 | Dadu, Frame | `dadu.html`, `frame.html` (`#md`: `#mt #mx #mbtns #m-no #m-ok`) | Struktur sama, kerjakan bersamaan |
| 3 | Karakter, Power-up | `karakter.html` (`#modal #box #mx #mb`), `powerup.html` (`#pv #pvBox #pvClose`) | Power-up sudah punya `ut-mk`; tinggal verifikasi |
| 4 | Room, Mode | `room.html` (`#inv #dr #pm #em`, tombol `.cmx`), `mode.html` (`#modal #mcancel`) | Ada `tests/room-page-modal.test.js`; `mode.js` harus tetap memuat `tombol-ungu-polos.webp` |
| 5 | Splash | `splash.html` (`.amodal #m-login #m-signup`) | Di luar shell; uji login/daftar |
| 6 | Gameplay | `gameplay/css/{pause,win-screen,level-up,hud-menu}.css` | Sengaja berbeda (overlay in-game) — putuskan: biarkan atau seragamkan |

Selesai bila: tiap dialog punya fokus awal, Tab terkurung, `Esc` menutup, `inert` di luar; tangkapan layar 1920×1080 & 1080×1920 sebelum/sesudah.

## 5. Keputusan terbuka (perlu jawabanmu)

1. **Power-up sebagai view?** Sekarang tab Inventory di iframe. Menjadikannya view = ubah tes `spa-host` (`viewName('powerup.html') === null`), tambah importmap three ke `play.html`, ubah `powerup.js` jadi `UT.PageModule` (±150 baris, ada 3D & audio). Kerja sedang–besar; manfaat: pindah tab Power-up tanpa iframe.
2. **Tambang & Gameplay tetap di luar shell?** Kode saat ini begitu. Tidak ada rencana mengubah.
3. **Gold Pass & Storage di Profil:** belum ada datanya (hati ada di `HeartsService`; kapasitas Gudang ada di `tambang-data.js`). Mau dihidupkan lagi sebagai kartu terpisah, atau tetap dihapus?
4. **Gambar `kartu-toko-landscape.webp`:** sudah tidak dipakai kode mana pun; hapus file? Sama untuk aset bingkai lama yang yatim.
5. **Folder `docs/planing/` lama** (audit ekonomi): hapus atau pertahankan sebagai arsip?

## 6. Urutan kerja yang disarankan

1 (kamu) → 2 → 3 → 4.1 → 4.2–4.4 → 4.5 → keputusan 5.1 → 4.6.
Tiap langkah satu commit + SW +1. Tangkapan layar & klik-uji dikerjakan per halaman sebelum commit.
