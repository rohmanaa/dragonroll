# Hati / nyawa (tahap 1)

- Tiap pemain punya **5 hati** (default). **1 hati terpakai tiap match dimulai** (semua mode, termasuk "Mulai ulang"/"Main lagi" di gameplay). Terisi lagi otomatis **1 hati / 5 menit** sampai penuh.
- **Server yang menentukan** (`supabase/migrations/202611410001_hearts.sql`: `hearts_get`, `hearts_consume`). Isi ulang dihitung malas dari jam server (tanpa cron). Angka hanya di `_hearts_max()` & `_hearts_regen_secs()`.
- Stok boleh **> 5** (disiapkan untuk hadiah teman/chest); isi ulang otomatis hanya berjalan saat < 5.
- Klien: `assets/js/services/hearts-service.js` (status + proyeksi hitung mundur), `assets/js/hearts-gate.js` (modal "Hati habis" + `spend()`/`guard()`), dipakai `RoomFlow.launch`, tombol Ready/Start di room, Quick Start, dan gameplay. HUD lobi (`hud-profil.webp` sudah memuat 5 slot; hanya hati terisi digambar, aset `assets/images/ui/white-glyphs/hati-garis.webp`, tanpa SVG): hati < 5 = hitung mundur, tepat 5 = READY, > 5 = +N (`data/lobby/js/lobby.js`); chip sisa hati + hitung mundur di room (kanan atas, `#hrt` di `assets/js/pages/room.js`).
- Kebijakan: hanya `hati-habis` yang memblokir. Gagal jaringan/belum login = lolos; tamu/lokal = tanpa batas.
- Tes: `tests/hearts-service.test.js`, `tests/room-flow-spa.test.js`, `supabase/tests/hearts_test.sql` (DB uji).

## Belum dikerjakan (tahap 2)
- Kirim hati ke teman: 1 hati/hari per teman; pengirim dapat fee 1 Emerald; penerima tidak online 1 bulan = hati jadi 2 (hati emas); batas 25 teman/hari.
- Hati dari chest.
