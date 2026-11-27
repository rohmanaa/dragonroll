# Audit Ekonomi & Alur Game

Sumber: `supabase/migrations/` (terutama `202611340001_match_ingame_bonus.sql`, `202611300001_level_up_rewards.sql`, `202611270002_economy_phase2_quests_achievements.sql`).

## Yang sudah baik
- Mutasi lewat RPC `security definer`; dompet dikunci `for update` sehingga klaim paralel tidak melompati batas.
- Batas koin dari match 300/hari (WIB) lewat `wallet_ledger`; batas iklan dan boss juga ada.
- Hasil match online diverifikasi server (pemenang dari snapshot room, `p_won` klien diabaikan).
- Idempotensi lewat `player_match_results` dan `player_room_credits`.

## Temuan 1 (tinggi): XP tanpa batas harian, hadiah level-up melewati batas koin
- `submit_match_result` hanya dibatasi jeda 45 detik; XP lawan CPU = 30 + `ingame_xp` (maks 30) = 60 per kirim.
- Untuk match tanpa room, `match_id` dari klien dan `p_won` dipercaya.
- `claim_level_rewards` membayar koin dan emerald per level tanpa batas harian.
- Perkiraan: level 10 = 7.200 XP (~1,5 jam kirim berulang); level 50 = 137.200 XP (~29 jam). Hadiah kumulatif sampai level 50 kira-kira 76 ribu koin + 175 emerald.
- Akun anonim diizinkan, jadi tidak ada hambatan membuat akun baru.

## Temuan 2 (tinggi): statistik achievement dari klien dibayar emerald
- `dice`, `ladders`, `snakes`, `skills`, `dragon_hits`, `skill_ids` hanya di-clamp per kirim (`_clamp_json_int`), tidak dibatasi total.
- Match CPU: `wins` dan `streak` ikut naik dari klaim klien.
- Achievement (`dadu`, `tangga`, `ular`, `skill`, `naga`, `menang`, `streak`, `aktif`, `strategi`) membayar koin dan emerald dari `player_stats`.

## Catatan 3 (rendah): dua tes gagal di sandbox
- `tests/dice-landing-stall.test.mjs` dan `tests/gameplay-dice-throw-race.test.mjs`: `THREE.MeshStandardMaterial is not a constructor`.
- Kemungkinan masalah harness (THREE tidak termuat penuh di Node); belum dipastikan apakah juga terjadi di mesin Rans.

Keterbatasan: semua dari membaca kode. Belum ada uji terhadap database live.
