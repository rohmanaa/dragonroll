# Rencana: semua data game bersumber dari SERVER

Tujuan: browser hanya **menampilkan** dan **meminta**. Server yang memutuskan dan menyimpan. Mengubah
`localStorage`, memanggil RPC langsung, atau memakai skrip tidak boleh menambah koin, gem, XP, item, atau
progres yang tidak didapat secara sah.

Dokumen ini adalah peta tahapan. Setiap tahap bisa dikerjakan dan di-push sendiri-sendiri.
Dokumen terkait: `WALLET_SERVER_PLAN.md`, `OUTFIT_SERVER.md`, `DATA_MIGRATION.md`, `supabase/README.md`.

## 1. Kondisi sekarang (hasil audit)

Sudah benar:
- Semua tabel Supabase memakai RLS dan tidak ada policy atau grant tulis langsung dari klien.
- Koin, gem, inventory, hadiah harian, hadiah iklan, daftar peti, beli set, tambang, outfit, tampilan,
  preferensi, hasil match, XP, leaderboard, dan klaim achievement berjalan lewat RPC `security definer`.
- `PlayerData` (localStorage) hanya cermin: nilai server menang saat disinkronkan.

Celah yang ditemukan (nomor dipakai di tahap di bawah):

| # | Celah | Tingkat | Tahap |
|---|-------|---------|-------|
| A | `claim_achievement` memercayai `p_client_value` untuk achievement `skin` dan `emerald` | Tinggi | S1 (selesai) |
| B | `bump_player_counter` dipanggil klien (maks 20 per panggilan, tanpa batas) | Sedang | S1 (batas harian), S2 (tuntas) |
| C | Game lawan CPU tidak bisa diverifikasi: XP +40/+120 per match (jeda 45 dtk) dan hadiah boss CPU (500 koin + 10 gem, 5 per hari, jeda 3 menit) bisa dipanggil lewat skrip | Sedang | S5 (selesai: nominal dikecilkan) |
| D | Hadiah boss online membaca pemenang dari `game_state` room yang ditulis klien (room palsu) | Rendah-sedang | S6 (selesai: room diverifikasi lewat log server) |
| E | State yang masih hanya lokal: `settings`, `profile.name`, `stats` dasar, data tamu | Rendah | S3, S4 |

## 2. Aturan yang berlaku di semua tahap

1. Klien tidak pernah mengirim nominal atau hasil (`coins`, `xp`, `won`, nilai statistik). Klien hanya mengirim
   niat ("buka peti X", "klaim achievement Y"); server menghitung.
2. Setiap RPC yang memberi hadiah wajib: cek `auth.uid()`, idempoten (kunci unik di `wallet_ledger`),
   batas harian, dan jeda minimum.
3. Tabel baru: `enable row level security` + `revoke all ... from anon, authenticated`. Akses hanya lewat RPC.
4. Setiap perubahan skema masuk sebagai migrasi bernomor baru di `supabase/migrations/`; migrasi lama
   tidak diedit.
5. Cache lokal boleh ada untuk kecepatan tampilan, tapi tidak boleh menjadi sumber kebenaran, dan hasil
   server selalu menimpa cache.

## 3. Tahapan

### S1 — Tutup celah A dan batasi B (SELESAI)
- Migrasi `202611190002_secure_achievement_counters.sql`:
  - `claim_achievement`: `skins` dihitung dari `player_inventory` (kind `skin`), `emerald` dari `player_wallet.gems`.
    `p_client_value` diabaikan (signature tetap).
  - `bump_player_counter`: batas harian WIB per jenis (peti 150, misi 30, event 10), tabel `player_counter_daily`.
- Yang harus dilakukan manusia: jalankan migrasi di Supabase (SQL Editor atau `supabase db push`).
- Verifikasi: panggil `claim_achievement('skin', 999999)` pada akun tanpa skin tambahan, hasilnya hanya bintang
  sesuai jumlah skin yang dimiliki.
- [ ] Migrasi sudah dijalankan di Supabase produksi.

### S2 — Penghitung naik di dalam aksi server (tutup B) — SELESAI (sebagian: peti tetap dilaporkan klien)
- Migrasi `202611190004_server_derived_counters.sql`:
  - `missions_done` naik di dalam `quest_claim` / `quest_claim_all` (server). `bumpMis` di `misi.html` dan
    `hadiah-misi.html` dibuat no-op.
  - `events_joined` dihapus dari `bump_player_counter` (tidak ada pemanggil).
  - `chests` tetap dilaporkan klien (peti dibuka di game yang berjalan di browser), batas 150 per hari WIB.
    Penutupan tuntas menunggu verifikasi game di server (opsi simulasi di S5).
- [ ] Migrasi sudah dijalankan di Supabase produksi

### S3 — State lokal murni pindah ke server (E)
- Tabel baru `player_profiles` (nama tampilan, pengaturan inti) + RPC `get_my_profile_settings` /
  `set_my_profile_settings` dengan validasi (panjang nama, nilai enum).
- `stats` dasar dihitung dari `player_stats` server; tidak ada salinan yang bisa diedit di klien.
- `equipped`, `gearDye`, `look`, `outfits`: sudah diatur lewat `appearance_save` dan `outfit_*`; pastikan
  semua halaman membaca dari `appearance_get` (bukan `PlayerData` lokal) sebagai sumber.
- Verifikasi: hapus localStorage lalu login; semua data kembali dari server.
- [ ] Selesai

### S4 — `PlayerData` menjadi cache baca-saja
- Hapus semua jalur tulis otoritatif di `assets/js/player-data.js` (tambah koin/XP/item lokal).
  Semua perubahan lewat `wallet-service.js` / service RPC lain; hasilnya mengisi cache.
- Mode tamu/offline: hanya melihat dan bermain latihan, tanpa hadiah dan tanpa penyimpanan.
- Hapus key legacy dan dokumentasikan kunci yang tersisa.
- Verifikasi: tes `tests/` untuk `PlayerData` diperbarui (tidak ada mutasi saldo lokal); ubah localStorage lewat
  devtools lalu muat ulang, nilai kembali ke nilai server.
- [ ] Selesai

### S5 — Hadiah game lawan CPU (tutup C) — SELESAI (keputusan: hadiah kecil, batas ketat)
Keputusan: lawan CPU tetap memberi XP dan koin, tapi kecil.
- XP match CPU: menang +30, kalah +10 (online terverifikasi tetap +120 / +40). Tanpa poin leaderboard.
- Hadiah boss CPU: 100 koin, 0 gem, 3 per hari WIB, jeda 3 menit (sebelumnya 500 koin + 10 gem, 5 per hari).
- Migrasi `202611190003_cpu_reward_small_online_room_verified.sql`. Nominal UI dibaca dari balasan server.
- Batasan: hasil CPU tetap tidak bisa dibuktikan (game jalan di browser), jadi pembatasnya hanya jumlah kecil + batas
  harian + jeda. Opsi "simulasi di server" (aturan murni `game-core.js` + log aksi) tetap tersedia bila kelak diperlukan.
- [x] Keputusan diambil
- [ ] Migrasi sudah dijalankan di Supabase produksi

### S6 — Hasil boss/match online dari server (tutup D) — SELESAI (verifikasi room lewat log server)
- Fungsi `_room_is_verified(room)`: minimal 16 event `roll` (hanya bisa dibuat server lewat `roll_game_dice`), minimal 2
  akun berbeda punya event di room, dan rentang event minimal 90 detik.
- `claim_boss_reward`: menolak `room_not_verified`. `submit_match_result`: room tak terverifikasi diperlakukan seperti
  lawan CPU (XP kecil, tanpa poin leaderboard).
- Batasan: dua akun milik orang yang sama yang bermain sungguhan masih lolos (dibatasi 10 hadiah boss per hari).
  Langkah berikutnya bila perlu: pemenang dihitung dari log aksi, bukan dari `game_state.snapshot` yang ditulis host.
- [ ] Migrasi sudah dijalankan di Supabase produksi
- [ ] Diuji: room dengan satu akun tidak menghasilkan hadiah; game online 2 akun tetap mendapat hadiah

### S7 — Pengawasan dan tes
- Tes SQL untuk setiap RPC hadiah (kunci idempoten, batas harian, nilai di luar batas).
- Laporan berkala dari `wallet_ledger`: akun dengan klaim berlebihan per hari.
- Checklist rilis: migrasi berurutan dijalankan, tes lulus, tidak ada `client` pada `achievement_defs.source`.
- [ ] Selesai

## 4. Urutan yang disarankan

S1, S2, S5, S6 selesai (menunggu migrasi dijalankan) → S3 → S4 → S7.
S2 dan S3 bisa dikerjakan paralel. S4 sebaiknya setelah S3, supaya tidak ada data yang kehilangan rumahnya.

## 5. Yang belum diketahui / perlu dicek saat mengerjakan

- Apakah `profile.html` dan halaman lain masih membaca nilai `skin` dan `emerald` dari perangkat untuk tampilan
  (klien lama masih mengirim `p_client_value`, sekarang diabaikan server).
- Semua pemanggil `bumpCounter` ada di tiga file di S2; pastikan tidak ada yang lain sebelum RPC dihapus.
- Hasil audit ini berasal dari membaca migrasi dan kode, belum dari menjalankan serangan sungguhan.
