# HANDOFF: Penghapusan localStorage bertahap → server (Ular Tangga Blok / Dragon Roll)

> Dokumen hidup. **Setiap perubahan pada pekerjaan ini wajib memperbarui dokumen ini (bagian 5 dan 9) lalu di-push bersama kodenya.**
> Path di repo: `doc/HANDOFF_LOCALSTORAGE.md` (repo `rohmanaa/ular-tangga`, branch `main`).
> Terakhir diperbarui: sinkron dengan `main` `07e6395` (Tahap 1-7b selesai; Power-3D Batch 1-3 selesai, lihat bagian 10).

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
| Power-3D B1-B3 | 17 power-up memakai model 3D baru; ikon webp lama dihapus; 10 power baru terdaftar di server (lihat bagian 10) | SELESAI | `5dce9e1`, `8228dea`, `dc1cacc` |
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

## 10. Power-3D (mengganti power-up lama dengan item 3D) — status per `main` `07e6395`
Sumber awal: `power-3d-fixed.zip` dari pemilik (penampil Three.js: 15 item, aura, partikel, animasi aktivasi). Keputusan pemilik: **ganti penuh dengan item dari zip itu, dikerjakan bertahap; webp lama di-takedown; kemampuan mengikuti power lama dan disesuaikan seperlunya.**

**Status: Batch 1, 2, dan 3 SELESAI (17 power-up total).**
- Batch 1 (`5dce9e1`, oleh Claude): 5 power lama diberi model 3D + nama baru, dengan cadangan ke tampilan lama.
- Setelah itu dikerjakan di sisi lain (bukan oleh dokumen ini; baca `git log 5dce9e1..HEAD`): `8228dea` ikon webp lama diganti hasil render model 3D, model 3D ramuan ditambah, `data/power/*.webp` DIHAPUS; `dc1cacc` Batch 2-3 = 10 power baru; `29fd414` takedown sementara Iron Sword dan Netherite Sword; `a3f6a4a` power per map; `e76e869` efek Power di tengah layar.

**Peta kode**
- Mesin: `assets/js/power3d/*.js` (`PowerRenderer`, `PowerCatalog`, `PowerSound`, `power-show.js`). Three lokal: `assets/js/vendor/three.r170.module.min.js` + `assets/js/vendor/three-addons/{utils,geometries,environments}/`; importmap di halaman yang memakainya (`three`, `three/addons/`).
- `KEY_TO_POWER3D` di `power-show.js` = peta gameKey → model 3D (17 baris). Power baru: tambah baris di sini + `PowerCatalog.js`.
- Ikon 2D: dirender dari model 3D oleh `tools/power-icons/bake.py` (butuh playwright + Chromium) ke `data/power/3d/<gameKey>.png`; satu-satunya sumber path ikon adalah `POWER_ICON` di `assets/js/item-catalog.js`. Setelah menambah power: `python3 tools/power-icons/bake.py <key>` agar ikon lain tidak berubah.
- Katalog klien: `assets/js/item-catalog.js` (daftar power, nama, `off:true` untuk takedown, batas per map). Aturan main: `gameplay/config.js` (`C.PUR`) + `usePU` di `gameplay.html`.
- Server: `supabase/migrations/202611210001_power_catalog_batch2.sql` mendaftarkan 10 power baru ke `item_catalog` (kind `powerup`, harga null, upsert). Server hanya memegang kepemilikan/jumlah, bukan aturan. Seed dibangkitkan `tools/wallet/gen-item-seed.js` (jalankan `--check` sebelum deploy).

**Catatan keputusan**
- ID/gameKey power lama TIDAK diganti (`sword`, `feather`, `tnt`, `totem`, `grass`, `potion_odd`, `potion_even`); dipetakan ke model 3D `iron_sword`, `feather`, `tnt`, `totem`, `ender_pearl`, `potion_red`, `potion_blue`. Mengganti ID butuh migrasi SQL yang memindahkan inventori; hanya bila pemilik meminta.
- Iron Sword dan Netherite Sword sedang di-takedown (`off:true`): tidak tampil di halaman Power/Room, tidak dipilih, tidak dipakai CPU/pemain; data tetap utuh dan bisa dihidupkan lagi dengan menghapus `off`.
- Power per map: Ice Crystal, Wooden Shield, Golden Apple hanya di World; Blaze Core, Fire Charge hanya di Nether.
- **Jebakan di petak** (TNT, Fire Charge, Blaze Core; `kind:'trap'` di `PUR`, `boss:false`): pemasang memilih petak 1–6 di depan lewat bar `#trapBar` (−/+/Pasang/Batal, bawaan petak ke-3; Batal = stok utuh), CPU memilih sendiri. Musuh yang MENDARAT tepat di petak itu memicu (`trapCheck` dipanggil dari `resolveTileAt`): ia dan pemain dalam `radius` (1/0/2) selain pemasang mundur `back` (6/3/2); Wooden Shield/Totem menahan per korban; pemasang kebal; sekali pakai; maks 2 jebakan aktif per pemain; terlihat semua pemain. `TRAPS` ikut snapshot multiplayer (host = sumber kebenaran), permintaan tamu membawa `tile`; dibersihkan saat game baru. Power serang langsung lain (Trident, Ice Crystal, Nether Star, pedang, Ender Pearl) tidak berubah. Tes: `power-rules.test.js`. Belum diuji: multiplayer online nyata dan tampilan di perangkat sungguhan.
- Halaman Power memuat 3D secara malas; bila WebGL/impor gagal memakai tampilan lama. Ketuk pratinjau = aktifkan animasi, geser = putar.
- Tes: `tests/power3d.test.js` (peta, jalur impor, nama, aturan lama utuh) dan tes game-core; `game-core.test.js` sempat usang karena papan diubah (tangga 3-22 dihapus, ular 17 turun ke 4) dan sudah disesuaikan.

**Alat uji visual (berguna untuk AI lain):** lingkungan sandbox bisa menjalankan Chromium headless dengan WebGL (SwiftShader) lewat npm `@sparticuz/chromium` + `puppeteer-core` (registry npm diizinkan). Argumen: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox`. Buka halaman game dengan `?noframe=1` (kalau tidak, `frame-guard.js` mengalihkan ke `play.html`) dan isi `localStorage['ut-auth']` + `sessionStorage['ut:booted']='1'` lewat `evaluateOnNewDocument`. Jangan jalankan server HTTP di latar dalam panggilan terpisah (mati saat panggilan selesai); mulai server, uji, lalu matikan dalam satu perintah.

**Belum diverifikasi/terbuka**
- Tampilan 3D dan ikon baru belum dinilai secara visual oleh pemilik; tangkapan layar headless hanya mengonfirmasi `#show` berstatus `p3d` dan kanvas terpasang.
- Takedown Iron Sword/Netherite Sword bersifat sementara: tanyakan pemilik sebelum menghidupkan lagi atau menghapus permanen.
- Peringatan konsol "Multiple instances of Three.js" muncul karena halaman memuat Three lama dan baru berdampingan; tidak merusak, bisa dibereskan bila Three lama dipensiunkan.

## 11. Tema HUD (draf) — "Fantasy Gold"
Keputusan pemilik: arah tema HUD terinspirasi paket **GUI Pro - Fantasy RPG (LayerLab)** dengan pendekatan **ATM = Amati, Tiru, Modifikasi**. Artinya meniru semangat gayanya (bingkai emas, panel indigo, pita judul, tombol 3D, manik) lalu mengubahnya jadi milik sendiri; **file paket berbayar itu TIDAK dipakai dan TIDAK boleh di-commit** (repo ini publik; paketnya berlisensi komersial).
- File: `hud/theme/fantasy.css` (token warna di `:root`, kelas `.ft-panel/.ft-title/.ft-btn(.green|.orange|.blue)/.ft-back/.ft-pill/.ft-card/.ft-row/.ft-badge/.ft-bar`) dan `hud/theme/preview.html` (halaman contoh gaya Toko). Semua digambar dengan CSS (gradien, bayangan, clip-path): tanpa gambar pihak ketiga, ringan di HP.
- Status: **uji coba dipasang di LOBI saja** (`lobby.html` memuat `hud/theme/fantasy.css` + `hud/theme/lobby-fantasy.css`, dua <link> setelah `shared-ui.css`; cabut keduanya untuk kembali ke gaya lama). Halaman lain masih gaya navy lama (`assets/css/shared-ui.css`, `hud/components/*`, CSS inline per halaman). `lobby-fantasy.css` hanya menimpa warna/bingkai/bayangan (`.pn`, `#toko/#hadc/#tmb`, `#play`, `.ut-curbar .cur/.plus`, `#xp`, `.ov .box`), bukan tata letak. Pratinjau sudah dirender di Chromium headless dan terbaca baik.
- Temuan audit HUD: gaya lama sudah cukup konsisten (panel navy di atas latar voxel) tetapi menyimpang di Profil (panel biru terang), Misi (judul besar bergaya lain, daftar hampir hitam), ikon grid Power; 14 halaman punya `renderCurrency` sendiri dan 17 halaman punya markup/CSS mata uang sendiri.
- Rencana pemasangan (menunggu persetujuan pemilik atas tampilan draf): (1) jadikan `fantasy.css` lapisan tema yang dimuat terakhir; (2) petakan komponen `hud/components/*` dan kelas halaman ke `.ft-*` atau berikan variabel yang sama; (3) pasang bertahap per halaman (mulai Toko dan Power), cek visual dengan Chromium headless (`?noframe=1`), push per halaman; (4) rapikan duplikasi `renderCurrency` ke satu komponen.

