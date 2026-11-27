# Rencana Perbaikan Ekonomi

Angka bertanda (usulan) perlu keputusan Rans sebelum dieksekusi.

## Keputusan Rans (26 Nov 2026) — menggantikan usulan batas XP harian
- Match online terverifikasi: XP, koin, poin, kemenangan, statistik (tidak berubah).
- Match lawan CPU (dan room online tak terverifikasi): TANPA XP, TANPA poin, tidak mengubah plays/wins/streak/statistik; hanya koin, maksimal 5 hasil per hari WIB. Hasil ke-6 dst diabaikan penuh.
- Kemenangan CPU tidak masuk leaderboard.

## Tugas 1 + 2 (SELESAI di kode, belum diterapkan ke produksi)
- Migrasi `202611510001_cpu_coins_only_online_xp.sql`: jalur CPU terpisah di `submit_match_result` (ledger reason `match_cpu`, hitung 5/hari di bawah kunci dompet).
- Klien `gameplay/js/main.js` (`recordMatchServer`): pesan "jatah CPU habis", tampilan koin saja untuk CPU, tanpa sinkron level/misi.
- Tes `supabase/tests/secure_match_result_test.sql` diperbarui (CPU tanpa statistik, 5/hari, ke-6 diabaikan, duplikat, room tak terverifikasi) dan lulus di Postgres lokal.
- Konsekuensi: statistik misi harian (dadu/tangga/naga/skill) dan achievement hanya naik dari match online.

## Tugas 2b (belum): hardening match online
- Statistik online masih dilaporkan klien (hanya di-clamp per kirim). Pertimbangkan batas harian per statistik atau hitung dari snapshot room.
- Dua akun milik orang yang sama yang main sungguhan masih lolos verifikasi room (sudah dicatat di migrasi 202611190003); pertimbangkan batas XP online harian.
- `quest_track` (play/win) masih murni laporan klien; misi 'win' bisa dipalsukan.

## Tugas 3: tes (sebagian)
- Tes SQL CPU 5/hari sudah ada (lihat atas). Tes lama `wallet_b2/b3/b4`, `tambang`, `tos` gagal di baseline (sebelum perubahan ini): perlu diperbarui terpisah.
- Tes Node: `claim_level_rewards` tidak melewati level yang dicapai dalam batas XP.
- Selidiki dua tes yang gagal (lihat `audit-ekonomi.md` catatan 3); jalankan di mesin lokal dulu.

## Tugas 4: penerapan
1. Terapkan `202611510001` ke Supabase (workflow CI `db-migrate.yml` masih dikomentari, jadi manual lewat SQL Editor atau `supabase db push`), lalu deploy klien.
2. Uji manual: main 1 match CPU, 1 match online, cek dompet dan XP.
3. Push ke `main`, terapkan ke produksi.
4. Akun yang sudah terlanjur level tinggi: periksa `wallet_ledger` (`level_up`, `achievement`) untuk lonjakan tak wajar sebelum rilis.

## Kriteria selesai
- 100 kirim `submit_match_result` berturut-turut dari satu akun tidak menaikkan XP melewati batas harian.
- Achievement tidak bisa naik dari match CPU.
- Semua tes lulus kecuali yang terbukti masalah harness.
