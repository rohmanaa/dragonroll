# Outfit pribadi + tampilan aktif di server

Migrasi: `supabase/migrations/202611130001_player_outfits.sql`. Tes: `supabase/tests/player_outfits_test.sql`.
Klien: `assets/js/player-data.js` (sumber kebenaran sisi klien), `assets/js/appearance-service.js` (pintu ke server, pola `wallet-service.js`),
UI di tab **Set** pada `karakter.html`.

## Aktif kapan
Sama dengan dompet server: **akun login + flag** (`window.UT_SERVER_WALLET = true` atau `localStorage['ut:serverWallet'] = '1'`).
Tamu / tanpa flag memakai outfit lokal di `PlayerData` (tahap a) dan tidak memanggil server. Di mode server, `PlayerData.saveOutfit/renameOutfit/deleteOutfit`
menolak (`server-mode`); UI memakai `AppearanceService` dan cermin lokal diisi dari server.

## Server
- `player_outfits(user_id, slot 0..4, name, data jsonb, updated_at)`, maks 5 per pemain. `player_appearance(user_id, look, equipped, gear_dye, updated_at)`.
- Tabel: RLS aktif, tanpa akses langsung klien. Semua lewat RPC `security definer` berbasis `auth.uid()`.
- Validasi satu pintu (`_outfit_normalize`, `_appearance_normalize`): item harus dimiliki (starter **atau** ada di `player_inventory`),
  bagian dan gender cocok (`item_catalog.gender`, diisi `tools/wallet/gen-item-seed.js`), format id/warna `^[a-z0-9_]{1,24}$`, kulit `s1..s5`,
  tubuh dibatasi 0.9–1.1 / 0.9–1.15. Data yang ditolak tidak menulis apa pun.
- RPC: `outfit_list`, `outfit_save(name, data)` (slot kosong pertama, serial per pemain), `outfit_rename`, `outfit_delete`,
  `appearance_save(look, equipped, gear_dye)`, `appearance_get`, `room_appearance_get(room_id)` (hanya anggota room).
- Alasan penolakan: `nama-kosong`, `data-tidak-valid`, `slot-penuh`, `belum-dimiliki`, `gender-tidak-cocok`, `item-tidak-dikenal`, `slot-tidak-cocok`, `tidak-ada`.

## Kebijakan sinkron tampilan aktif
- Halaman Karakter dibuka: `AppearanceService.refresh()` mengambil inventory, tampilan aktif, dan outfit; **server menang**.
  Bila server belum punya data akun itu, tampilan lokal dikirim sebagai data awal.
- Setelahnya, tiap perubahan equip/look lokal dikirim otomatis (debounce 700 ms; perubahan saat pengiriman berjalan digabung).
  Halaman yang mengganti equip (`karakter`, `dadu`, `efek`, `frame`, `powerup`, `profile`) memuat `appearance-service.js`.
- Outfit lokal yang dibuat sebelum akun beralih ke mode server **tidak** diunggah otomatis (server adalah sumber di mode server).

## Setelah mengubah harga/gender di `item-catalog.js`
`node tools/wallet/gen-item-seed.js --write`, lalu terapkan ulang migrasi B2 dan migrasi outfit (aman diulang). `--check` memeriksa kedua blok.
