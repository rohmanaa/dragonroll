# Rencana Perbaikan Ekonomi

Angka bertanda (usulan) perlu keputusan Rans sebelum dieksekusi.

## Tugas 1: batas XP harian
Migrasi baru `202611500001_xp_daily_cap.sql`.
1. Tabel `player_xp_daily(user_id, day, xp_cpu, xp_online)` dengan hari WIB (pakai `_wib_day_start()`).
2. Di `submit_match_result`, setelah mengunci `player_wallet`, hitung sisa kuota lalu potong `v_gain`.
   - Batas XP CPU per hari: 300 (usulan).
   - Batas XP online per hari: 1.500 (usulan).
3. Jika kuota habis: match tetap dicatat (plays), XP dan koin 0, respons memuat `xp_capped: true`.
4. Klien (`gameplay`) menampilkan pesan "batas XP harian tercapai" saat `xp_capped`.

## Tugas 2: statistik achievement tidak lagi dipercaya dari klien
Migrasi baru `202611510001_achievement_stats_trust.sql`.
1. Match non-online (CPU atau room tak terverifikasi): hanya `plays` yang naik. `wins`, `streak`, `best_streak`, `dice_rolls`, `ladders`, `snakes`, `skills_used`, `dragon_hits`, `skill_wins` tidak berubah.
2. Match online terverifikasi: tambahkan batas harian per statistik (usulan: dadu 600, tangga 120, ular 120, skill 200, naga 200 per hari).
3. `skill_ids`: terima hanya id yang ada di katalog (`power_catalog`), bukan teks bebas.
4. Tahap lanjut (opsional): hitung statistik dari `game_rooms.game_state` snapshot supaya tidak ada angka dari klien sama sekali.

## Tugas 3: tes
- Tambah tes SQL di `supabase/tests/`: kirim 20 match CPU berurutan (waktu dimajukan), pastikan XP berhenti di batas, `wins` tidak naik.
- Tes Node: `claim_level_rewards` tidak melewati level yang dicapai dalam batas XP.
- Selidiki dua tes yang gagal (lihat `audit-ekonomi.md` catatan 3); jalankan di mesin lokal dulu.

## Tugas 4: penerapan
1. Terapkan migrasi ke proyek Supabase staging, jalankan tes SQL.
2. Uji manual: main 1 match CPU, 1 match online, cek dompet dan XP.
3. Push ke `main`, terapkan ke produksi.
4. Akun yang sudah terlanjur level tinggi: periksa `wallet_ledger` (`level_up`, `achievement`) untuk lonjakan tak wajar sebelum rilis.

## Kriteria selesai
- 100 kirim `submit_match_result` berturut-turut dari satu akun tidak menaikkan XP melewati batas harian.
- Achievement tidak bisa naik dari match CPU.
- Semua tes lulus kecuali yang terbukti masalah harness.
