# Rekomendasi multiplayer dan setup Supabase

Tanggal: 2026-11-05. Melengkapi `multiplayer-sync-audit.md` dan `multiplayer-step2-event-log.md`.

## 1. Pakai proyek Supabase sendiri
Saat ini `game/assets/js/multiplayer/config.example.js` menunjuk ke proyek Supabase milik pihak lain. Rekomendasi: buat proyek sendiri sebelum menjalankan migrasi atau uji dua klien, agar data, kuota, dan kunci tidak bergantung pada orang lain.

Langkah:
1. supabase.com → New project (nama, password database, region terdekat, mis. Singapore).
2. Authentication → Providers → **Anonymous**: aktif (dipakai untuk room online).
3. Authentication → Providers → **Email**: aktif, **Confirm email dimatikan** (login username + password di `game/assets/js/auth.js` memetakan username ke email internal `<username>@dragonroll-game.com`).
4. SQL Editor: jalankan berurutan `202611050001_multiplayer.sql`, lalu `202611060001_game_events.sql`.
5. Database → Publications → `supabase_realtime`: pastikan `game_rooms` dan `game_events` aktif.
6. Project Settings → API: salin Project URL dan publishable/anon key ke `config.example.js`, lalu commit. **Jangan pernah** memakai key `service_role` di repo atau browser.

Query pengecekan setelah migrasi (hasil yang benar: tabel=2, fungsi=4, realtime=1, kolom=1):
```sql
select
  (select count(*) from information_schema.tables where table_name in ('game_events','game_reward_claims')) as tabel,
  (select count(*) from information_schema.routines where routine_name in ('submit_game_action','set_game_public_profile','claim_game_reward','is_game_room_member')) as fungsi,
  (select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='game_events') as realtime,
  (select count(*) from information_schema.columns where table_name='game_rooms' and column_name='event_seq') as kolom;
```

## 2. Akun uji (tidak untuk produksi)
Untuk uji dua klien, siapkan dua akun uji. Username harus 3–16 karakter huruf/angka/underscore.
- Akun A: username `omanbogel`.
- Akun B: buat satu lagi dengan pola yang sama.

Cara membuat: lewat layar login/daftar di game, atau Supabase → Authentication → Users → Add user dengan email `omanbogel@dragonroll-game.com`, centang auto-confirm.
**Password akun uji tidak ditulis di repo.** Pakai password sederhana hanya di proyek uji yang bukan produksi, dan hapus akunnya setelah selesai.

## 3. Urutan kerja yang disarankan
1. Proyek Supabase sendiri + migrasi + query pengecekan (bagian 1).
2. Tutup Langkah 2: uji dua browser/akun untuk `submit_game_action` dan Realtime `game_events`.
3. Langkah 3: ganti cue dan snapshot dengan event; profil publik (skin, dadu, frame, efek) tampil di semua layar yang menampilkan pemain lain.
4. Langkah 4: hasil personal (reward via `claim_game_reward`, teks dan suara menang/kalah, Totem ke akun korban dengan batas 15 detik).
5. Tahap server: dadu diacak dan aksi divalidasi di server (menutup risiko curang).

## 4. Keamanan
- Cabut (revoke) setiap token GitHub yang pernah ditempel di chat; pakai `gh auth login` atau Claude Code.
- Anonymous Auth bisa disalahgunakan dalam jumlah besar: atur rate limit atau CAPTCHA sebelum rilis publik.
- Risiko yang diterima sementara: selama dadu diacak di klien, anggota room secara teknis bisa mengirim hasil dadu palsu (ditutup di tahap server).
- `game_events` tumbuh selama game: rencanakan pemangkasan atau snapshot checkpoint.
