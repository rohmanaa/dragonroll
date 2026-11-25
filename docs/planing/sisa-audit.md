# Sisa Audit (hasil 26 Nov 2026)

Dari membaca fungsi di database lokal (skema snapshot terbaru). Belum diuji ke Supabase live.

## Aman (server yang menentukan)
- Tambang: waktu dari server, kapasitas gudang dan batas offline, drop harian dibatasi (koin 5, emerald 2, power 1 per hari).
- `exchange_gems`: kurs tetap (10 emerald = 500 koin, dst), dompet dikunci.
- `buy_powerup`: harga dari katalog server, jumlah 1-99, idempoten lewat `op_id`.
- `chest_buy`, `chest_open_now`: harga dan hadiah dari server, saldo dikunci.
- `claim_achievement`: `p_client_value` diabaikan (tapi lihat catatan statistik di `audit-ekonomi.md`).

## Temuan
1. (sedang-tinggi) `claim_ad_reward`: token apa pun 8-64 karakter diterima. 5 emerald x 5 kali/hari = 25 emerald/hari per akun tanpa verifikasi iklan. Akun anonim tidak terbatas. 25 emerald = 1.250 koin lewat `exchange_gems`.
2. (sedang) `claim_cpu_boss_reward`: token apa pun diterima, 100 koin x 3/hari = 300 koin/hari tanpa main sama sekali. Ini melewati aturan baru "CPU maksimal 5 hasil/hari" dan lebih besar dari jatah match CPU (maks 200 koin/hari).
3. (rendah) XP dari chest: `chest_buy` memberi 10/25/60/200 XP dan chest harian juga. Diamond (25 emerald) = 200 XP + sekitar 1.350 nilai koin + 35% power, sedikit lebih untung dari menukar emerald langsung. Bertentangan dengan "XP hanya online" bila dianggap XP.
4. (rendah) `bump_player_counter('chests')` dilaporkan klien (maks 150/hari); menggerakkan misi "peti" (120 koin) dan achievement peti.
5. (info) Syarat chest harian dihitung dari `player_match_history`. Sejak aturan baru, hasil CPU tetap menulis riwayat (maks 5/hari), jadi chest kayu dan perak bisa diklaim dari CPU; emas (10 main) butuh online.

## Saran
- Iklan: verifikasi sisi server (SSV jaringan iklan lewat Edge Function), atau turunkan hadiah dan batasi akun baru.
- Boss CPU: hapus klaim ini, atau masukkan ke jatah 5x/hari CPU yang sama.
- XP chest: nolkan XP dari `chest_buy` dan chest harian, atau putuskan tetap boleh.
- Counter peti: naikkan dari `chest_buy`/`chest_collect` di server, bukan dari klien.

## Belum diaudit
- `hearts_send`, `mail_claim`, `claim_daily_reward` (30 hari), `quest_claim_bonus`, `buy_item`, `buy_set` (tes `wallet_buy_set` lulus), `claim_boss_reward` (online), alur room (koneksi putus, AFK, klaim ganda).
