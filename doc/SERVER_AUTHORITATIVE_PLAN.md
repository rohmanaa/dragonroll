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
| C | Game lawan CPU tidak bisa diverifikasi: XP +40/+120 per match (jeda 45 dtk) dan hadiah boss CPU (500 koin + 10 gem, 5 per hari, jeda 3 menit) bisa dipanggil lewat skrip | Sedang | S5 |
| D | Hadiah boss online membaca pemenang dari `game_state` room yang ditulis klien (room palsu) | Rendah-sedang | S6 |
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

### S2 — Penghitung naik di dalam aksi server (tutup B)
- Peti dibuka lewat RPC server (mis. `open_chest`) yang menaikkan `player_stats.chests`; klaim misi lewat RPC
  yang menaikkan `missions_done`; ikut event menaikkan `events_joined`.
- Hapus `bump_player_counter` dan `bumpCounter` di `assets/js/multiplayer/progress-service.js`
  (pemanggil: `gameplay.html`, `misi.html`, `hadiah-misi.html`).
- Verifikasi: tanpa memanggil RPC lama, penghitung tetap naik saat aksi dilakukan; memanggil RPC lama gagal.
- [ ] Selesai

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

### S5 — Hadiah game lawan CPU (tutup C) — butuh keputusan
Pilih satu:
1. **Tanpa hadiah dari CPU** (paling aman, paling sederhana): XP dan hadiah boss hanya dari match online.
2. **Hadiah kecil dengan batas ketat**: turunkan nominal, batas harian lebih kecil, hanya setelah match berjalan
   minimal N giliran yang tercatat di server.
3. **Simulasi di server**: server menjalankan aturan game dari seed dan log aksi (ada `game-core.js` sebagai
   aturan murni) sebelum memberi hadiah. Paling kuat, paling besar pekerjaannya.
- [ ] Keputusan diambil
- [ ] Selesai

### S6 — Hasil boss/match online dari server (tutup D)
- `game_state` room hanya ditulis lewat `submit_game_action`; pemenang dan hadiah boss dihitung dari log aksi
  yang divalidasi server (bukan snapshot dari host).
- Syarat room sah: minimal 2 pemain berbeda yang benar-benar bergabung; satu pemain tidak bisa menjadi
  semua peserta.
- Verifikasi: room yang hanya berisi satu akun tidak bisa menghasilkan hadiah.
- [ ] Selesai

### S7 — Pengawasan dan tes
- Tes SQL untuk setiap RPC hadiah (kunci idempoten, batas harian, nilai di luar batas).
- Laporan berkala dari `wallet_ledger`: akun dengan klaim berlebihan per hari.
- Checklist rilis: migrasi berurutan dijalankan, tes lulus, tidak ada `client` pada `achievement_defs.source`.
- [ ] Selesai

## 4. Urutan yang disarankan

S1 (selesai) → S2 → S3 → S4 → S5 (setelah keputusan) → S6 → S7.
S2 dan S3 bisa dikerjakan paralel. S4 sebaiknya setelah S3, supaya tidak ada data yang kehilangan rumahnya.

## 5. Yang belum diketahui / perlu dicek saat mengerjakan

- Apakah `profile.html` dan halaman lain masih membaca nilai `skin` dan `emerald` dari perangkat untuk tampilan
  (klien lama masih mengirim `p_client_value`, sekarang diabaikan server).
- Semua pemanggil `bumpCounter` ada di tiga file di S2; pastikan tidak ada yang lain sebelum RPC dihapus.
- Hasil audit ini berasal dari membaca migrasi dan kode, belum dari menjalankan serangan sungguhan.
