# Hati / nyawa (tahap 1)

- Tiap pemain punya **5 hati** (default). **1 hati terpakai tiap match dimulai** (semua mode, termasuk "Mulai ulang"/"Main lagi" di gameplay). Terisi lagi otomatis **1 hati / 5 menit** sampai penuh.
- **Server yang menentukan** (`supabase/migrations/202611410001_hearts.sql`: `hearts_get`, `hearts_consume`). Isi ulang dihitung malas dari jam server (tanpa cron). Angka hanya di `_hearts_max()` & `_hearts_regen_secs()`.
- Stok boleh **> 5** (disiapkan untuk hadiah teman/chest); isi ulang otomatis hanya berjalan saat < 5.
- Klien: `assets/js/services/hearts-service.js` (status + proyeksi hitung mundur), `assets/js/hearts-gate.js` (modal "Hati habis" + `spend()`/`guard()`), dipakai `RoomFlow.launch`, tombol Ready/Start di room, Quick Start, dan gameplay. HUD lobi (`hud-profil.webp` sudah memuat 5 slot; hanya hati terisi digambar, aset `assets/images/ui/white-glyphs/hati-garis.webp`, tanpa SVG): hati < 5 = hitung mundur, tepat 5 = READY, > 5 = +N (`data/lobby/js/lobby.js`); chip sisa hati + hitung mundur di room (kanan atas, `#hrt` di `assets/js/pages/room.js`).
- Kebijakan: hanya `hati-habis` yang memblokir. Gagal jaringan/belum login = lolos; tamu/lokal = tanpa batas.
- Tes: `tests/hearts-service.test.js`, `tests/room-flow-spa.test.js`, `supabase/tests/hearts_test.sql` (DB uji).

## Tahap 2 — kirim hati ke teman (migrasi `202611420001_hearts_friends.sql`)
- Halaman Pertemanan: tombol hati di tiap baris teman (`hati-garis.webp`). Normal `+1`, emas `+2`, sudah dikirim hari ini `✓` (redup).
- 1 hati / hari / teman (hari = tanggal Asia/Jakarta), maksimal 25 teman berbeda per hari. Server: `hearts_friends()` (status), `hearts_send(friend)`.
- Penerima langsung +1 hati tanpa klaim; boleh > 5 (isi ulang otomatis tetap berhenti di 5; hadiah tidak hilang saat sedang isi ulang).
- Pengirim dapat fee Emerald lewat `_wallet_apply(reason 'heart_gift')`: 1; bila penerima tidak aktif >= 30 hari: 2 dan ikon teman itu emas.
- "Aktif terakhir" = `player_hearts.last_seen_at` (disentuh `hearts_get`/`hearts_friends`, maks. 1x/jam) -> `auth.users.last_sign_in_at` -> `created_at`.
- Angka (25, fee 1/2, 30 hari) hanya di fungsi `_hg_*` pada migrasi.
- Tes: `supabase/tests/hearts_friends_test.sql`, `tests/hearts-service.test.js`, `tests/friendship-module.test.js`.

## Belum dikerjakan
- Hati dari chest.
