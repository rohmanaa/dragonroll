# HANDOFF: Penghapusan localStorage bertahap → server (Ular Tangga Blok / Dragon Roll)

> Dokumen hidup. **Setiap perubahan pada pekerjaan ini wajib memperbarui dokumen ini (bagian 5 dan 9) lalu di-push bersama kodenya.**
> Path di repo: `doc/HANDOFF_LOCALSTORAGE.md` (repo `rohmanaa/ular-tangga`, branch `main`).
> Terakhir diperbarui: setelah Tahap 6d, 7a, 7b, dan Power-3D Batch 1 (lihat bagian 5 dan 10).

## 1. Tujuan
Game berjalan sebagai game profesional: data pemain (koin, gem, inventori, hadiah, XP, statistik, achievement, misi) **hidup di server (Supabase)**, bukan di browser. `localStorage` hanya boleh berisi cache tampilan, preferensi perangkat, dan cache sesi.

## 2. Keputusan pemilik proyek (jangan diubah tanpa bertanya)
- **Login WAJIB.** Tidak ada mode tamu yang bisa bermain (`boot-guard.js` mengalihkan ke `splash.html`).
- Kerjakan **bertahap**: satu tahap kecil per commit, dengan tes. Push **langsung ke `main`** (pemilik sudah mengizinkan). Push ke `main` memicu workflow `db-migrate` (tes lalu `supabase db push` ke produksi); tanpa file baru di `supabase/migrations/` deploy tidak mengubah database.
- Server adalah sumber kebenaran. Kalau offline/server gagal: aksi tidak tercatat, jangan menulis ke lokal sebagai cadangan.
- Bahasa: Indonesia, singkat, langsung ke inti.
- Data lama yang yatim (key `inv`, blob tamu) sudah DIHAPUS pada Tahap 7a atas persetujuan pemilik ("lanjut tahap 6 dan 7"). Hapus data pemain lain tetap butuh persetujuan.

## 3. Peta kode
- `assets/js/session.js` → `UT.Session`: **satu-satunya** pintu ke cache sesi `localStorage['ut-auth']` (`read/id/username/loggedIn/write/clear`). Dimuat PALING AWAL, sebelum `boot-guard.js`. Tanpa itu, semua pembaca menganggap belum login (gagal aman).
- `assets/js/boot-guard.js`: paksa lewat splash dan login.
- `assets/js/auth.js`: login Supabase; menulis sesi lewat `UT.Session`.
- `assets/js/player-data.js` (`PlayerData`): **cermin/cache** akun. Koin, gem, inventori, equip, outfit, XP, statistik dan nama diisi dari server (`applyServerWallet/Appearance/Outfits/Stats`). Tanpa saldo/XP awal lokal; `walletReady()` false sampai server membalas (UI menampilkan "—"). `settings()/setSettings()` memakai `UT.Prefs`. `recordMatch`/`grant` sudah DIHAPUS.
- `assets/js/prefs.js` (`UT.Prefs`, key `ut:prefs:v1`): preferensi (musik, suara, getar, grafis, ambience, dsb); salinan lokal = cache cepat.
- `assets/js/prefs-sync.js` (`UT.PrefsSync`): sinkron `UT.Prefs` ↔ server (RPC `get_my_prefs`/`set_my_prefs`, tabel `player_prefs`). Pull maks. 1x/60 dtk per tab (sessionStorage `ut:prefs-pulled`), nilai server menang, kirim debounce 800 ms, flush saat `pagehide`. Otomatis hidup di halaman yang memuat `prefs.js` untuk akun login.
- `assets/js/wallet-service.js` (`UT.WalletService`): satu-satunya pintu RPC dompet server (beli, hadiah harian, misi, iklan, boss, klaim achievement).
- `assets/js/multiplayer/*`: `room-service.js` (`submitMatchResult`), `progress-service.js` (`getMyProfile`, `claimAchievement`).
- `gameplay.html` (monolit besar): `recordMatchServer()` mengirim hasil match lalu menyalin profil server ke cache.
- `profile.html`: klaim achievement dari `SRV.claims` (server); menyalin statistik server saat dimuat; nama = username akun.
- Dokumen terkait: `doc/WALLET_SERVER_PLAN.md`, `doc/DATA_MIGRATION.md`, `doc/OUTFIT_SERVER.md`, `README.md`.
- Server: `supabase/migrations/*` (21 migrasi, sumber kebenaran), tes SQL `supabase/tests/*`. CI: `.github/workflows/db-migrate.yml`.
- `supabase/snapshot/00_full_schema.sql`: gabungan SEMUA migrasi jadi satu file untuk menyiapkan proyek Supabase BARU/kosong (tempel di SQL Editor). Dibuat otomatis: `sh tools/build-schema-snapshot.sh`. BUKAN migrasi, jangan taruh di `supabase/migrations/`. `tests/schema-snapshot.test.js` gagal bila snapshot kedaluwarsa.

## 4. Key storage yang masih ada (kode aktif)
- **localStorage:** `ut-auth` (hanya via `UT.Session`), `ut:prefs:v1` (via `UT.Prefs`), blob `ularTanggaBlok:player:v1[:acct:<id>]` (cache `PlayerData`), cadangan `:corrupt:` (dipangkas otomatis).
- **sessionStorage:** `ut:booted`, `ut:fadein`, `ut-config`, `ut-room`, `ut-multiplayer-room`, `ut-mp-exited` (status navigasi sementara, bukan data pemain).
- `audit-theme` hanya di halaman audit (abaikan). `player-data.js` menghapus tanpa syarat key legacy: `inv`, `shop`, `modeScreen`, `lobbyGift`, `ut-dadu`, `ut-tema2`, `ut:quest`, `ut-dragon-win`, `ut-mp-active`, `ut:serverWallet`, `ut:adLocal:*`, `ularTanggaBlok:achClaimed:v1*`; untuk akun login juga blob tamu `ularTanggaBlok:player:v1` (tanpa `:acct:`) beserta cadangan `:corrupt:`-nya (pengaturan tamu diimpor sekali ke `UT.Prefs`).

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
| 6d | Blob `PlayerData` jadi cache murni: hapus saldo/XP awal lokal (1000 koin palsu); `walletReady()`; UI "—" sampai server membalas lalu otomatis diperbarui | SELESAI | `f0aa404` |
| 7a | Hapus key legacy yatim (`inv`, `ut:quest`, dll) tanpa syarat dan blob tamu akun login; impor pengaturan tamu ke `UT.Prefs` sekali | SELESAI | `76b6f5e` |
| 7b | Pengaturan lintas perangkat: migrasi `202611150001_player_prefs.sql` (tabel + RPC `get_my_prefs`/`set_my_prefs`, daftar putih kunci, maks 8 KB), `prefs-sync.js`, tes SQL + tes klien | SELESAI (kode); migrasi ikut deploy produksi saat push | lihat `git log` (commit "Tahap 7b") |
| Power-3D B1 | 5 power pertama memakai model 3D baru + nama baru (lihat bagian 10) | SELESAI (kode, belum diuji visual) | lihat `git log` (commit "Power-3D Batch 1") |
| 8 (opsional) | Tes browser otomatis (Playwright) untuk login, match, klaim; pindahkan state room di `sessionStorage` (`ut-room`, `ut-config`) ke server bila diinginkan | BELUM | - |

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
2. Login akun baru → saldo tampil "—" sebentar lalu 1000 dari server (bukan angka lokal), nama = username, avatar muncul.
3. Main 1 match lawan CPU sampai selesai (jeda ≥ 45 detik antar match, kalau tidak server mengabaikan) → toast XP/poin, angka profil, dan leaderboard cocok.
4. Klaim 1 achievement → saldo naik; reload profil → bintang tetap.
5. Ubah pengaturan musik → pindah halaman → tetap; login akun lain di perangkat yang sama → pengaturan sama (preferensi perangkat).
6. Logout dari profil → kembali ke splash; halaman game tidak bisa dibuka lagi.
7. Ubah pengaturan musik di perangkat A, login akun yang sama di perangkat/peramban B → pengaturan ikut (maks. 1 menit; reload B setelah menunggu). Cek tabel `player_prefs` terisi di Supabase.
8. Reload di tiap halaman utama (lobi, toko, profil, room) → tetap login, data benar.

## 9. Catatan keputusan / temuan
- `CHEST_POOL` aktif tidak punya hadiah Coin/XP/Emerald; cabang itu kode mati dan sudah dihapus. Peti tidak memberi currency.
- Server menolak hasil match yang datang < 45 detik setelah match sebelumnya (`too_fast`) dan mengabaikan `xpTotal` dari klien (XP dihitung server).
- Nama akun ditentukan server dari username (trigger `player_stats_enforce_name`); UI "Ubah nama" ditolak untuk akun login.
- Pengaturan kini milik PERANGKAT (sama untuk semua akun di perangkat itu), bukan per akun.
- Impor legacy dihapus: data tamu lama tidak dipindah ke akun (saldo server mulai dari nol).
- Snapshot skema: 20 migrasi digabung ke `supabase/snapshot/00_full_schema.sql`. Diuji di Postgres tersemat dengan stub `auth.users`/`auth.uid()`/peran Supabase: 0 error di database kosong, jumlah objek identik dengan menjalankan 20 migrasi satu per satu (19 tabel, 135 kolom, 73 fungsi, 5 policy, 1 trigger, 30 indeks), dan menjalankannya ulang juga 0 error. Tes tersebut BUKAN pengganti CI (Supabase asli + `supabase/tests`). Snapshot sengaja di luar `supabase/migrations/` agar CI tidak menerapkan duplikat ke produksi.
- Perubahan klien Tahap 1–6e tidak butuh tabel/fungsi SQL baru: semua RPC yang dipakai sudah ada di migrasi 202611050001–202611140001.
- 6d: server sudah memberi saldo awal 1000 koin akun baru (`c_start_coins` di `_wallet_ensure`); klien tidak lagi menyimpan angka itu sendiri. Halaman yang tidak memanggil `WalletService.refresh` (mode, friendship) memakai cache terakhir; halaman pertama setelah login (lobi) yang menyinkronkan.
- 7a: pembersihan menghapus `inv` dan blob tamu permanen; hanya berjalan untuk akun login (tanpa akun blob tamu dibiarkan karena dipakai halaman login).
- 7b: preferensi = cache lokal + server. Konflik: nilai server menang saat pull; kunci yang hanya ada lokal naik ke server. Kunci klien `prefs-sync.js` harus sama dengan `c_keys` di migrasi (dijaga `tests/prefs-sync.test.js`). Snapshot skema sudah dibuat ulang (21 migrasi). Tes SQL `supabase/tests/player_prefs_test.sql` lulus di Postgres tersemat (stub auth); CI Supabase asli belum diverifikasi saat dokumen ini ditulis.
- Riwayat log perubahan dokumen ini: dibuat setelah Tahap 6e; ditambah catatan snapshot skema; ditambah Tahap 6d, 7a, 7b.

## 10. Pekerjaan paralel: Power-3D (mengganti 7 power-up lama dengan 15 item 3D) — Batch 1, 2, 3
Sumber: `power-3d-fixed.zip` dari pemilik (penampil Three.js mandiri: 15 item, aura, partikel, animasi aktivasi). Keputusan pemilik: **ganti penuh 15 item, dikerjakan 5 demi 5, kemampuan mengikuti power lama dan disesuaikan seperlunya**.
- Mesin: `assets/js/power3d/*.js` (+ `power-show.js` pembungkus). Three lokal: `assets/js/vendor/three.r170.module.min.js` dan addons `assets/js/vendor/three-addons/{utils,geometries,environments}/` (dari npm three@0.170.0). Importmap ada di `powerup.html` (`three` dan `three/addons/`).
- Pemetaan `KEY_TO_POWER3D` di `power-show.js` (id gameplay → model 3D). **Batch 1 (SELESAI kode):** sword→iron_sword, feather→feather, tnt→tnt, totem→totem, grass→ender_pearl. Nama tampil diganti (Iron Sword, Feather, TNT, Totem, Ender Pearl) di `item-catalog.js`, `gameplay/config.js`, dan teks pesan `gameplay.html`.
- **ID/gameKey lama sengaja TIDAK diganti** (`sword`, `feather`, `tnt`, `totem`, `grass`, `potion_odd`, `potion_even`): ID itu dipakai katalog server (`item_catalog`), inventori pemain, dan seluruh logika gameplay. Mengganti ID butuh migrasi SQL yang memindahkan inventori; lakukan hanya bila pemilik meminta.
- Halaman Power memuat 3D secara malas; bila WebGL/impor gagal otomatis memakai tampilan lama (`ItemArt`). Ketuk pratinjau = aktifkan animasi, geser = putar. Efek partikel 2D lama dilewati saat 3D aktif.
- **Batch 2-3 (SELESAI kode, belum diuji visual di perangkat nyata):** 10 power baru memakai gameKey = id model 3D: `diamond_sword`, `netherite_sword`, `wooden_shield`, `golden_apple`, `fire_charge`, `ice_crystal`, `blaze_core`, `trident`, `dragon_crystal`, `nether_star` (total 17 power). Rincian:
  - **Aturan = DATA**: `gameplay/config.js` → `C.PUN` (nama/deskripsi) dan `C.PUR` (kind/target/jarak/mundur/boss). `usePU`, `cpuPUValid`, `puTargets`, `puDefend`, `skipFrozen` di `gameplay.html` membaca `PUR` (tidak ada lagi daftar 7 power tetap; `startPU`/`loadoutPU` dari `PUN`). Power lama (`sword`, `tnt`, `feather`, `totem`, `grass`, `potion_odd`, `potion_even`) aturan & ID TIDAK berubah.
  - **Aturan Power baru:** Diamond Sword (musuh jarak ≤2 mundur 3) · Netherite Sword (jarak ≤4 mundur 5) · Wooden Shield (menahan 1 serangan Power otomatis, flag `p.guard`; Totem tetap pilihan) · Golden Apple (dadu berikutnya +3 lewat `p.bonus`) · Fire Charge (musuh terdekat DI DEPAN ≤6 petak mundur 3) · Ice Crystal (pemain terdepan beku: lewati giliran berikutnya, flag `p.frozen`, diproses `skipFrozen` di `nextTurn`) · Blaze Core (semua musuh di depan mundur 2) · Trident (terdepan mundur 4, pemakai maju 2 bila kena) · Dragon Crystal (meluncur ke tangga terdekat di depan, tanpa tangga maju 6 + resolusi petak) · Nether Star (semua musuh mundur 3 + giliran tambahan). Pedang/Golden Apple/Dragon Crystal/Totem ditolak di fase Naga (`boss:false`, ditolak sebelum konsumsi). Semua serangan Power bisa ditahan Wooden Shield/Totem.
  - **Multiplayer:** host yang menjalankan `usePU`; `guard` dan `frozen` ikut snapshot (`makeGameSnapshot`/`applyGameSnapshot`). Server hanya memegang kepemilikan: migrasi `202611210001_power_catalog_batch2.sql` (10 baris `item_catalog` powerup) + seed B2 disinkronkan lewat `tools/wallet/gen-item-seed.js --write`; snapshot skema dibangun ulang.
  - **Efek & suara di gameplay:** `assets/js/power3d/power-overlay.js` (model 3D + aura + partikel di atas pion; dimuat malas oleh modul kecil di `gameplay.html`, butuh importmap yang kini ada di `gameplay.html`) dengan cadangan efek 2D `data/power/power-fx.js` (kini 17 power + `shield_block`). Suara sintetis WebAudio `assets/js/power3d/PowerSound.js` (tanpa file audio; 17 power × spawn/activate/hit/disappear), dipanggil `sfx.power` di `gameplay/audio.js` (mengikuti mute/volume SFX) dan oleh `PowerRenderer` di halaman Power. File suara pedang & TNT yang sudah ada tetap dipakai.
  - **TAKEDOWN sementara (keputusan pemilik): Iron Sword (`sword`) dan Netherite Sword (`netherite_sword`)** — cukup satu pedang (Diamond Sword); keduanya akan DIGANTI item lain nanti. Ditandai `off: true` + `offNote` di `item-catalog.js`: tidak tampil di halaman Power (`CI` difilter `!i.off`) dan Room (`POWERS`), tidak masuk loadout/HUD/CPU (`puOn()` di `gameplay.html`), pemakaian ditolak sebelum konsumsi. **TIDAK DIHAPUS:** ID, baris server (`item_catalog`), stok pemain, model 3D, ikon, `PUN`/`PUR`, efek 2D & suara tetap ada. Mengaktifkan lagi/menggantinya: hapus `off` atau ganti entrinya (jangan ubah ID tanpa migrasi). Tes: `power-rules.test.js` ("takedown").
  - Ikon: `data/power/3d/<gameKey>.png` dirender `tools/power-icons/bake.py [key ...]`.
  - **Belum:** pengujian visual di perangkat nyata (hanya diuji headless Chromium software-GL), dan menghapus Ramuan Ganjil/Genap (sengaja dipertahankan sampai pemilik menyetujui penggantinya; stok pemain aman).
- Tes: `tests/power3d.test.js` (peta, jalur impor, nama, aturan lama utuh) dan `tests/power-rules.test.js` (aturan PUR, ikon, efek, suara, migrasi).
- Catatan CI: tes `game-core.test.js` sempat usang karena papan diubah orang lain (tangga 3-22 dihapus, ekor ular 17 dipindah ke 4); sudah disesuaikan ke papan sekarang (tangga 8→26, ular 17→4).
