# HANDOFF: Penghapusan localStorage bertahap → server (Ular Tangga Blok / Dragon Roll)

> Dokumen hidup. **Setiap perubahan pada pekerjaan ini wajib memperbarui dokumen ini (bagian 5 dan 9) lalu di-push bersama kodenya.**
> Path di repo: `doc/HANDOFF_LOCALSTORAGE.md` (repo `rohmanaa/ular-tangga`, branch `main`).
> Terakhir diperbarui: setelah penambahan snapshot skema SQL (di atas commit `75827d8`).

## 1. Tujuan
Game berjalan sebagai game profesional: data pemain (koin, gem, inventori, hadiah, XP, statistik, achievement, misi) **hidup di server (Supabase)**, bukan di browser. `localStorage` hanya boleh berisi cache tampilan, preferensi perangkat, dan cache sesi.

## 2. Keputusan pemilik proyek (jangan diubah tanpa bertanya)
- **Login WAJIB.** Tidak ada mode tamu yang bisa bermain (`boot-guard.js` mengalihkan ke `splash.html`).
- Kerjakan **bertahap**: satu tahap kecil per commit, dengan tes. Push **langsung ke `main`** (pemilik sudah mengizinkan). Push ke `main` memicu workflow `db-migrate` (tes lalu `supabase db push` ke produksi); tanpa file baru di `supabase/migrations/` deploy tidak mengubah database.
- Server adalah sumber kebenaran. Kalau offline/server gagal: aksi tidak tercatat, jangan menulis ke lokal sebagai cadangan.
- Bahasa: Indonesia, singkat, langsung ke inti.
- Data lama yang yatim (key `inv`, blob tamu bertanda `migration: 0`) **sengaja tidak dihapus**. Menghapusnya butuh persetujuan pemilik.

## 3. Peta kode
- `assets/js/session.js` → `UT.Session`: **satu-satunya** pintu ke cache sesi `localStorage['ut-auth']` (`read/id/username/loggedIn/write/clear`). Dimuat PALING AWAL, sebelum `boot-guard.js`. Tanpa itu, semua pembaca menganggap belum login (gagal aman).
- `assets/js/boot-guard.js`: paksa lewat splash dan login.
- `assets/js/auth.js`: login Supabase; menulis sesi lewat `UT.Session`.
- `assets/js/player-data.js` (`PlayerData`): **cermin/cache** akun. Koin, gem, inventori, equip, outfit, XP, statistik dan nama diisi dari server (`applyServerWallet/Appearance/Outfits/Stats`). `settings()/setSettings()` memakai `UT.Prefs`. `recordMatch`/`grant` sudah DIHAPUS.
- `assets/js/prefs.js` (`UT.Prefs`, key `ut:prefs:v1`): preferensi perangkat (musik, suara, getar, grafis, ambience, dsb).
- `assets/js/wallet-service.js` (`UT.WalletService`): satu-satunya pintu RPC dompet server (beli, hadiah harian, misi, iklan, boss, klaim achievement).
- `assets/js/multiplayer/*`: `room-service.js` (`submitMatchResult`), `progress-service.js` (`getMyProfile`, `claimAchievement`).
- `gameplay.html` (monolit besar): `recordMatchServer()` mengirim hasil match lalu menyalin profil server ke cache.
- `profile.html`: klaim achievement dari `SRV.claims` (server); menyalin statistik server saat dimuat; nama = username akun.
- Dokumen terkait: `doc/WALLET_SERVER_PLAN.md`, `doc/DATA_MIGRATION.md`, `doc/OUTFIT_SERVER.md`, `README.md`.
- Server: `supabase/migrations/*` (20 migrasi, sumber kebenaran), tes SQL `supabase/tests/*`. CI: `.github/workflows/db-migrate.yml`.
- `supabase/snapshot/00_full_schema.sql`: gabungan SEMUA migrasi jadi satu file untuk menyiapkan proyek Supabase BARU/kosong (tempel di SQL Editor). Dibuat otomatis: `sh tools/build-schema-snapshot.sh`. BUKAN migrasi, jangan taruh di `supabase/migrations/`. `tests/schema-snapshot.test.js` gagal bila snapshot kedaluwarsa.

## 4. Key storage yang masih ada (kode aktif)
- **localStorage:** `ut-auth` (hanya via `UT.Session`), `ut:prefs:v1` (via `UT.Prefs`), blob `ularTanggaBlok:player:v1[:acct:<id>]` (cache `PlayerData`), cadangan `:corrupt:` (dipangkas otomatis).
- **sessionStorage:** `ut:booted`, `ut:fadein`, `ut-config`, `ut-room`, `ut-multiplayer-room`, `ut-mp-exited` (status navigasi sementara, bukan data pemain).
- `audit-theme` hanya di halaman audit (abaikan). Key legacy yang masih dibersihkan `player-data.js`: `shop`, `modeScreen`, `lobbyGift`, `ut-dadu`, `ut-tema2`, `ularTanggaBlok:achClaimed:v1*`. `inv` dibiarkan.

## 5. Status tahap
| Tahap | Isi | Status | Commit |
|---|---|---|---|
| 1 | Hapus key legacy tanpa pembaca; pangkas cadangan `:corrupt:` | SELESAI | `badfc4e` |
| 2 | Pengaturan ke `UT.Prefs` (`ut:prefs:v1`) | SELESAI | `fd7bf05`, `2f80b55` |
| 3a/3b/3c | Dompet server jadi bawaan; login wajib (tanpa sesi anonim); hapus saklar darurat dan mutasi dompet lokal | SELESAI | `9cf3e10`, `4997b54`, `76ed2e9` |
| 4a | Iklan berhadiah hanya via server | SELESAI | `0ab8e1b` |
| 4b | Hadiah harian hanya via server (hapus `inv` di dailyreward/hadiah-misi) | SELESAI | `0e7da40` |
| 4c | Misi harian hanya via server (hapus `ut:quest`) | SELESAI | `44acc9b` |
| 4d | Hadiah boss hanya via server (hapus `ut-dragon-win`) | SELESAI | `5363147` |
| 5a | Dadu dan tema dibaca dari `PlayerData` (hapus `ut-dadu`/`ut-tema2` aktif) | SELESAI | `d5de647` |
| 5b | Resume room online dari server (hapus `ut-mp-active`) | SELESAI | `9f5ce32` |
| 6a | Klaim achievement hanya dari server (`SRV.claims`); hapus penanda klaim lokal | SELESAI | `43e119c` |
| 6b | `play.html` baca pengaturan via `PlayerData` | SELESAI | `a32958e` |
| 6b-1 | XP/statistik match hanya dari server (`submit_match_result` → `applyServerStats`) | SELESAI | `4203fce` |
| 6b-2 | `grant` XP ditolak di mode server; cabang peti tidak memberi currency | SELESAI | `624de5f` |
| 6b-3 | `settings` pindah ke `UT.Prefs` (preferensi perangkat) | SELESAI | `7089f05` |
| 6b-4 | Nama akun = username server; profil menyalin statistik server | SELESAI | `74d3882` |
| 6b-5 | Hapus `PlayerData.recordMatch/grant` dan jalur hasil match lokal | SELESAI | `0c2e710` |
| 6c | Hapus impor data legacy (`inv/shop/modeScreen`) dari `PlayerData` | SELESAI | `a3614b3` |
| 6e | `UT.Session` (`session.js`) satu pintu untuk `ut-auth` | SELESAI | `4ab0e92` |
| **6d** | **Blob `PlayerData` jadi cache murni**: hapus `START_COINS/START_GEMS/START_XP` bawaan lokal, isi dari server, tampilkan keadaan "memuat" sebelum server membalas | **BELUM** | - |
| 7 (opsional) | Hapus blob tamu dan key `inv` yatim (butuh persetujuan pemilik); `UT.Prefs.setBackend` agar pengaturan ikut lintas perangkat | BELUM | - |

## 6. Cara menjalankan tes (sama dengan CI)
```
for f in tests/*.test.js; do echo "== $f"; node "$f" || exit 1; done
```
Tes SQL (`supabase/tests/*_test.sql`) hanya jalan di CI (butuh Docker/Supabase lokal). Selalu jalankan seluruh loop sebelum push. Periksa sintaks skrip inline HTML yang diubah (tidak ada tes browser otomatis).

## 7. Aturan kerja
1. Satu tahap = satu commit kecil, pesan `Tahap N...: ringkasan`, tes baru untuk perilaku baru.
2. Jangan membaca/menulis `localStorage['ut-auth']` langsung; pakai `UT.Session`. Jangan membaca blob pemain langsung; pakai `PlayerData`/`UT.Prefs`.
3. Perubahan SQL: file baru di `supabase/migrations/` (jangan ubah migrasi lama) + tes di `supabase/tests/`. Migrasi ikut ter-deploy ke produksi saat push ke `main`, jadi hati-hati. Setelah menambah migrasi, jalankan `sh tools/build-schema-snapshot.sh` dan commit snapshot-nya (tes CI akan gagal kalau lupa).
4. **Keamanan:** token GitHub/kunci yang ditempel di chat dianggap bocor. Minta pemilik mencabutnya dan membuat token baru yang dibatasi ke repo ini. Jangan menulis token ke berkas, konfigurasi git, atau memori.
5. Setelah setiap perubahan: perbarui bagian 5 (status/commit) dan bagian 9 (catatan) dokumen ini, lalu push.

## 8. Uji manual yang belum dilakukan (audit statis dan tes node saja; belum dijalankan di browser)
1. Tanpa login → semua halaman game mengalihkan ke splash. Cek konsol splash: tidak ada error "session.js belum dimuat".
2. Login akun baru → saldo awal dari server, nama = username, avatar muncul.
3. Main 1 match lawan CPU sampai selesai (jeda ≥ 45 detik antar match, kalau tidak server mengabaikan) → toast XP/poin, angka profil, dan leaderboard cocok.
4. Klaim 1 achievement → saldo naik; reload profil → bintang tetap.
5. Ubah pengaturan musik → pindah halaman → tetap; login akun lain di perangkat yang sama → pengaturan sama (preferensi perangkat).
6. Logout dari profil → kembali ke splash; halaman game tidak bisa dibuka lagi.
7. Reload di tiap halaman utama (lobi, toko, profil, room) → tetap login, data benar.

## 9. Catatan keputusan / temuan
- `CHEST_POOL` aktif tidak punya hadiah Coin/XP/Emerald; cabang itu kode mati dan sudah dihapus. Peti tidak memberi currency.
- Server menolak hasil match yang datang < 45 detik setelah match sebelumnya (`too_fast`) dan mengabaikan `xpTotal` dari klien (XP dihitung server).
- Nama akun ditentukan server dari username (trigger `player_stats_enforce_name`); UI "Ubah nama" ditolak untuk akun login.
- Pengaturan kini milik PERANGKAT (sama untuk semua akun di perangkat itu), bukan per akun.
- Impor legacy dihapus: data tamu lama tidak dipindah ke akun (saldo server mulai dari nol).
- Snapshot skema: 20 migrasi digabung ke `supabase/snapshot/00_full_schema.sql`. Diuji di Postgres tersemat dengan stub `auth.users`/`auth.uid()`/peran Supabase: 0 error di database kosong, jumlah objek identik dengan menjalankan 20 migrasi satu per satu (19 tabel, 135 kolom, 73 fungsi, 5 policy, 1 trigger, 30 indeks), dan menjalankannya ulang juga 0 error. Tes tersebut BUKAN pengganti CI (Supabase asli + `supabase/tests`). Snapshot sengaja di luar `supabase/migrations/` agar CI tidak menerapkan duplikat ke produksi.
- Perubahan klien Tahap 1–6e tidak butuh tabel/fungsi SQL baru: semua RPC yang dipakai sudah ada di migrasi 202611050001–202611140001.
- Riwayat log perubahan dokumen ini: dibuat setelah Tahap 6e (status Tahap 1–6e); menambah catatan snapshot skema.
