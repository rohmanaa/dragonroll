# Dragon Roll (ular-tangga) — Peta Halaman, Flow, dan Logika

Dokumen ini hasil membaca langsung isi repo `rohmanaa/ular-tangga` (branch `main`, commit terakhir `8238ab4`).
Repo sudah dipindah GitHub ke `rohmanaa/dragonroll`.

> Catatan: `README.md` di repo sebagian sudah usang (lihat bagian 9). Dokumen ini mengikuti kode yang ada sekarang, bukan README.

---

## Aturan Aset (WAJIB DIBACA)

- **`assets/` di root repo adalah sumber utama ("air") semua aset game.** Ikon, tombol, panel, banner, panah, dan komponen UI lain diambil dari sini.
- `game/assets/` hanya **salinan siap pakai** dari root `assets/`. Jangan diedit langsung. Kalau ada aset baru atau berubah, ubah di root lalu salin ulang ke `game/assets/`.
- **Pakai ikon/komponen yang sudah ada di kit, jangan membuat sendiri** (tidak ada SVG/CSS buatan untuk panah, tombol, ikon, dll.). Cari dulu di `assets/komponen/` (mis. `stage-chapter/panah-chapter-kiri|kanan.webp` untuk panah carousel, `ikon-navigasi/panah-kembali.webp` untuk tombol kembali, `glyph-putih/` untuk glyph umum). Kalau memang belum ada, minta aset baru ditambahkan ke root `assets/`.

---

## 1. Gambaran Umum

- Game ular tangga 3D bertema voxel/Minecraft, dibuat dengan HTML + JS biasa (tanpa framework) dan Three.js (`assets/js/vendor/three.min.js`).
- Nama produk di UI: **DRAGON ROLL**. Nama internal lama: "Ular Tangga Blok".
- Semua halaman dijalankan di dalam pembungkus `play.html` (iframe). Di HP portrait iframe diputar 90° supaya halaman selalu melihat viewport landscape.
- Backend: **Supabase** (Auth, RPC, Realtime). Data pemain (koin, emerald, inventory, XP, misi, tambang) disimpan di server. `localStorage` dipakai sebagai cache.
- Semua halaman non-gameplay berbagi satu set modul di `assets/js/` dan gaya di `assets/css/`.

### Struktur folder

| Folder / file | Isi |
|---|---|
| `*.html` (root) | 22 halaman produksi (lihat bagian 3 sampai 7) |
| `assets/js/` | Modul bersama: `player-data`, `wallet-service`, `appearance-service`, `auth`, `session`, `prefs`, `prefs-sync`, `item-catalog`, `room-flow`, dll. |
| `assets/js/multiplayer/` | `client`, `room-service`, `presence`, `game-sync`, `progress-service`, `event-log` |
| `assets/js/dice-kit/` | Mesin dadu 3D bersama (dipakai `dadu.html` dan `gameplay.html`) |
| `assets/js/power3d/` | Renderer ikon power 3D |
| `gameplay/` | Modul khusus gameplay: `game-core` (aturan murni), `config`, `hud`, `ready`, `afk`, `dice-ui`, `audio`, `maps/` (world, nether), dll. |
| `hud/` | Komponen UI bersama (`button`, `card`, `currency`, `modal`, `toast`, `badge`) dan tema `fantasy` |
| `data/` | Gambar frame, ikon power 3D, `power-fx.js` |
| `supabase/` | 31 migrasi SQL, snapshot skema, tes SQL |
| `tests/` | Tes Node (game-core, power-rules, wallet, outfit, aura, multiplayer event-log, dll.) |
| `tools/` | Alat pengembang (preview karakter, desain frame, bake ikon power, simulasi balance) |
| `doc/` | Dokumentasi fitur (`SERVER_AUTHORITATIVE_PLAN`, `WALLET_SERVER_PLAN`, `SKIN_SYSTEM`, `EFEK_AURA`, dll.) |
| `audit/`, `laporan-audit.html` | Laporan audit dan tutorial Supabase |

---

## 2. Flow Utama (peta navigasi)

```
index.html ──redirect──▶ play.html?go=splash.html
                              │ (iframe)
                              ▼
                        splash.html  ── intro logo → preload aset → cek login
                              │            belum login: tombol LOGIN → modal DAFTAR/MASUK
                              ▼ (setelah login, fade ke hitam)
                          lobby.html  ◀──────────────── tombol Back/Home dari hampir semua halaman
   ┌──────────┬───────────┼────────────┬──────────────┬─────────────┐
   ▼          ▼           ▼            ▼              ▼             ▼
karakter   frame/dadu/  profile     leaderboard   hadiah-misi    shop / tambang
.html      efek/powerup .html       .html         .html          friendship / settings
                                                  (dailyreward + misi)

lobby ──MULAI!──▶ mode.html ──pilih tile──▶ room.html ──START──▶ gameplay.html
                      │                         ▲                      │
                      └── Quick Start ──(simulasi)──────────────────────┤
                                                                       ▼
                                           keluar/menang → RoomFlow.returnUrl()
                                           (room.html / mode.html / lobby.html)
```

### Aturan navigasi penting

- **Boot guard** (`assets/js/boot-guard.js`): halaman apa pun yang dibuka langsung tanpa lewat splash atau tanpa login dialihkan ke `splash.html?next=<halaman>`. Setelah loading, splash kembali ke halaman tujuan.
- **Frame guard** (`assets/js/frame-guard.js`): halaman yang dibuka di luar `play.html` dialihkan ke `play.html?go=<halaman>`. `?noframe=1` dipakai untuk debug.
- **`play.html?go=`** hanya menerima nama file `.html` di folder yang sama (mencegah open redirect).
- **Resume online** di `lobby.html`: bila server mencatat room `playing` yang masih memuat pemain ini (tab ditutup/refresh), lobby otomatis `location.replace` ke `room.html?...&role=guest&code=XXXX`. Dilewati bila `sessionStorage['ut-mp-exited']` cocok (baru keluar lewat menu).
- Tombol "+" di bar mata uang: Emerald → `tambang.html?from=<halaman>`, Coin → `shop.html?coin=1`.

---

## 3. Halaman Pintu Masuk dan Pembungkus

### `index.html`
- **Isi:** hanya `<script>location.replace('play.html?go=splash.html')</script>` (plus `<noscript>` refresh). Tidak ada landing page.
- **Flow:** langsung ke `play.html`.

### `play.html` (pembungkus iframe)
- **Isi:** satu `<iframe id="f">`, overlay awan "memuat" (`#ov`), dan pemutar musik/SFX.
- **Logika:**
  - Membaca `?go=` (default `splash.html`), memuat ke iframe.
  - **Layar memuat antar-halaman:** overlay muncul saat halaman keluar (`pagehide`/`beforeunload`), hilang setelah halaman baru siap (font, gambar, latar ter-decode; minimal tampil 0,7 detik). `splash.html` punya loading sendiri sehingga overlay dibuat "quiet".
  - **Musik latar** dimiliki pembungkus supaya tidak putus antar halaman: 4 lagu (`sunset_plains`, `community`, `first_light_particles`, `rainy`) bergantian. `gameplay.html` = musik dimatikan (gameplay punya musik sendiri).
  - Volume dari `UT.Prefs` (`musicVol` default 30, `sfxVol` default 100), toggle musik/suara dari `PlayerData.settings()`.
  - **Klik tombol:** pool 4 audio `button-click.mp3`, diekspos sebagai `window.UTShell.click`.
- **Navigasi:** tidak punya UI sendiri.

### `splash.html`
- **Isi:** logo intro, bar loading (persen + label), dadu berputar, tombol **LOGIN**, modal auth (tab **DAFTAR** / **MASUK**, username + password).
- **Logika:**
  1. Intro logo 2,4 detik (hanya saat start dingin, tanpa `?next`) + suara `dragon-studio.mp3`.
  2. `UT_Preload.runAuto(ASSETS)` memuat kode, gambar, audio, data. Label berubah: "Memuat game", "Memuat gambar", "Memuat musik & suara", "Menyiapkan dunia".
  3. Cek akun: `UT.Auth.check()`. Sudah login → "Halo, <username>" → lanjut. Belum → tombol LOGIN → `UT.Auth.signUp` / `signIn`.
  4. Fade ke hitam, `sessionStorage['ut:booted']='1'`, lalu `location.replace(dest)`. `dest` = `?next=` yang lolos regex `.html`, atau `lobby.html`.
- **Aturan akun:** username 3–16 karakter (huruf, angka, underscore), password minimal 6. Username dipetakan ke email internal `<username>@dragonroll-game.com` (tidak pernah dikirimi email; "Confirm email" di Supabase harus dimatikan).

---

## 4. Lobby dan Pemilihan Mode

### `lobby.html` — Menu utama
- **Isi:** scene 3D pulau melayang dengan karakter pemain (animasi idle, ketuk untuk lompat/aksi acak). HUD: kartu profil (avatar + frame, level, XP bar, nama, bendera), bar Emerald dan Coin, tombol **MAIL**, **SETTINGS**, **LEADERBOARD**, grup koleksi (**Karakter, Frame, Dadu, Efek, Power-up**), **Toko**, **Teman**, **Hadiah & Misi**, **Tambang**, dan tombol besar **MULAI!**.
- **Navigasi (peta `ACT`):**

| Tombol | Tujuan |
|---|---|
| Profil | `profile.html` |
| Karakter / Frame / Dadu / Efek / Power-up | `karakter.html` / `frame.html` / `dadu.html` / `efek.html` / `powerup.html` |
| Leaderboard | `leaderboard.html` |
| Toko | `shop.html` |
| Teman | `friendship.html` |
| Hadiah & Misi | `hadiah-misi.html` |
| Tambang | `tambang.html?from=lobby.html` |
| Settings | `settings.html` |
| MULAI! (dan panah) | `mode.html` |
| MAIL, "Hadiah gratis" | toast "segera hadir" (belum ada) |

- **Logika:**
  - Data dibaca dari `PlayerData` (skin terpasang, frame, mata uang, nama, XP). Event `currencyChanged`, `skinChanged`, `frameChanged` memperbarui tampilan.
  - **Level/XP:** `lvInfo(xp)` — level 1 butuh 400 XP, tiap level berikutnya +100 XP (`400 + 100*(L-1)`), maksimum level 999. Bila XP server lebih tinggi (main di perangkat lain), XP server dipakai.
  - Saat dibuka: `Multiplayer.Progress.dailyLogin()` (mencatat login harian ke server) dan cek resume room online.
  - Saldo tampil "—" sampai server membalas (`PD.walletReady()`).
  - Pengaturan Grafik "Rendah" mematikan bayangan dan resolusi 1x. Suasana (siang/malam/ikut sistem) mengubah pencahayaan scene.

### `mode.html` — Pilih Mode
- **Isi:** carousel **peta** (loop, geser/swipe, panah, dots) lalu dua kartu besar:
  - **QUICK START** (ungu): tile **SOLO** (flip → 2/3/4 pemain) dan **TEAM** (2 vs 2).
  - **CREATE ROOM** (hijau): tile **VS COMPUTER** (2/3/4 peserta), **MULTI PLAYER** (satu perangkat, gantian, 2/3/4 pemain), **CREATE ROOM** (online; flip → SOLO atau TEAM).
- **Peta:** diambil dari `ItemCatalog` (item `kind:'theme'`) — World (Minecraft) dan Nether, ditambah kartu **The End** yang terkunci (SOON, tidak bisa dipilih). Pilihan peta disimpan di `UT.Prefs['roomMap']`.
- **Logika:**
  - Hanya satu tile yang flip terbuka pada satu waktu.
  - **Quick Start** memanggil `ranked(format, n)`: menampilkan modal "MENCARI LAWAN…" selama 2,4 detik (**simulasi**, bukan matchmaking nyata), lalu "LAWAN DITEMUKAN!" dan `RoomFlow.launch(cfg)` langsung ke gameplay. Lawan dibuat palsu (`Lawan 1`, dst.).
  - **Create Room** memanggil `RoomFlow.navigate('room', {mode, format, count})` ke `room.html`.
  - Fungsi `quickJoin(format)` (mencari room publik via `RoomService.quickJoin`) sudah ditulis di file, tetapi **tidak dipanggil dari tile mana pun** saat ini.
  - Mulai membuka presence (`status:'lobby'`) untuk fitur teman.

### `room.html` — Game Room (persiapan sebelum main)
- **Parameter URL:** `?mode=vsc|local|online&format=solo|team&count=2..4[&role=guest&code=XXXXXX][&invite=<uuid>]`.
- **Isi:** kolom kiri **Equipment** (skin, frame, dadu, efek), **Power Loadout** (pilih sampai 5 power), **Map Information**; kolom kanan **Player Room** (daftar pemain, tombol **ROOM ACCESS** / **INVITE**, **READY**, **START GAME**). Modal pilih item, modal Invite Friend (privat/publik, kode, link, daftar teman), drawer "Undang Teman" (teman online / pemain online).
- **Logika per mode:**
  - **vsc / local (offline):** pemain dibuat di klien (Bot atau Pemain 2..n). Semua otomatis siap. START → `RoomFlow.launch`.
  - **online:** host membuat room di server (`RoomService.createRoom`, kode 6 karakter acak, awalnya privat, `maxPlayers` 2 untuk solo / 4 untuk team). Tamu masuk lewat `joinRoom({code})`. Room disinkronkan realtime (`applyRemoteRoom`).
    - Host: bisa mengubah akses Privat/Publik, membuka slot (`setSlots`), menyalin kode/link, mengundang teman.
    - **Syarat START (`check()`):** online team harus 4 pemain dan tim 2 vs 2; online solo minimal 2 pemain; kamu harus READY; semua pemain lain harus READY. START hanya aktif untuk host.
    - START online → `RoomService.startRoom(id, {roomConfig})`; semua klien yang melihat status `playing` + `game_state.roomConfig` otomatis meluncurkan gameplay.
    - Pemain online **tidak** mengirim power loadout (`powers: []`) dan memakai skin/dadu dari akun masing-masing.
  - **Team offline:** host bisa memindah pemain antar tim (maks 2 per tim).
  - Tombol keluar: `RoomService.leaveRoom`; bila game sedang berjalan ditolak (`GAME_IN_PROGRESS`).
  - Tamu bisa mengirim permintaan teman ke pemain lain (`sendFriendRequest`).

---

## 5. Halaman Koleksi / Inventory

Lima halaman ini berbagi satu template (tab navigasi `NAV` antar kategori: Karakter, Frame, Dadu, Efek, Power-up). Hampir seluruh kodenya sama; yang berbeda hanya `PAGE` (kategori aktif) dan renderer preview.

### Pola umum (frame, dadu, efek, powerup)
- **Isi:** bar atas (Back, judul, Emerald, Coin), panel preview 3D/gambar (`#show`), info item (nama, rarity, deskripsi), baris "Terbaru", grid kartu item, tombol aksi (`#use`).
- **Status kartu:** `Digunakan` / `Gunakan` (dimiliki), harga Coin (terkunci tapi dijual), `Tidak dijual` (terkunci, tidak dijual).
- **Item yang belum dimiliki tetap tampil dan bisa di-preview.** Beli lewat modal **Konfirmasi** (cek Coin). Bila Coin kurang muncul modal "Coin tidak cukup" dengan tombol **Dapatkan Coin** (→ `shop.html`).
- **Beli:** akun login memakai `WalletService.buy(id)` (server); fallback lokal `PD.purchase(id)`. Setelah beli langsung di-equip (`PD.equip`), kecuali power-up.
- **Power-up** adalah consumable: tidak bisa di-equip, hanya menampilkan jumlah dimiliki (`×N`). Tidak dijual di toko; didapat dari gameplay atau hadiah.

### `karakter.html`
- Halaman terbesar setelah gameplay (1860 baris). Editor karakter blocky 3D.
- **Tab kategori:** Gender, Kulit, Mata, Rambut, Baju, Celana, Sepatu, Kepala (helm), Zirah, Bahu, Jubah, Senjata, Aksesori (multi-pilih), Tubuh, **Set**.
- **Fitur:** pewarnaan (dye), ganti pose, putar 360°, simpan foto, preview item terkunci.
- **Beli Set:** modal "Beli Set <nama>?" berisi daftar item dan total harga; server memvalidasi lewat RPC `buy_set` (maks 20 item unik per set).
- **Outfit pribadi:** tombol "Simpan tampilan" (tersimpan di server lewat `AppearanceService`, ada batas slot `PD.outfitLimit`), kelola (ganti nama, hapus). Outfit hanya cocok dengan gender yang sama.

### `frame.html`
- Frame foto profil. Kategori aktif `frame`. Preview gambar `.webp` frame.

### `dadu.html`
- Skin dadu. Preview memakai **Dice Kit** (`DiceKit.thumb` untuk kartu, `DiceKit.mount` untuk preview 3D dengan fisika kocok-lempar). Ada 20 dadu (katalog di `assets/js/dice-kit/DiceCatalog.js`).

### `efek.html`
- Efek/aura. Memakai `BlockyCharacter` dan `AuraFX` (aura voxel 3D) untuk preview di karakter. (README lama menyebut halaman ini kosong; sekarang sudah berisi aura.)

### `powerup.html`
- Daftar 17 power-up dan jumlah yang dimiliki. Menekan item memutar efek visual (`PowerFX`) dan menampilkan catatan efek. Ada renderer ikon 3D (`P3D`).

---

## 6. Halaman Ekonomi, Hadiah, dan Sosial

### `shop.html` — Toko
- Hanya menjual **Coin** (item kosmetik dibeli di halaman koleksi masing-masing).
- **Panel Beli Coin:** tukar Emerald → Coin: **10 → 500**, **40 → 2.500**, **120 → 10.000** (paket ke-3 ditandai "best"). Akun login memakai `WalletService.exchange(i)`.
- **Panel Emerald:** "Tonton Iklan" (`UT.Ads.show()`), dapat +N Emerald. Provider iklan bawaan adalah **simulasi** (overlay hitung mundur); nominal ditentukan server (`claim_ad_reward`), klien hanya mengirim token unik per tayangan.
- `?coin=1` men-scroll dan menyorot panel Coin.

### `tambang.html` — Tambang Emerald (pasif, server-side)
- **Isi:** 3 slot tambang. Header menampilkan ringkasan produksi total per jam.
- **Aksi per slot** (semua lewat RPC `mine_*` di `MineService`): **Buka** (bayar Coin), **Ambil** emerald dari peti (`mine_collect`), **Percepat** (boost; punya batas harian dan pengali `boost_mult`), upgrade **Kecepatan** (Lv 1–5) dan upgrade **Peti** (kapasitas, Lv 1–5).
- **Logika tampilan:** klien memperkirakan stok (`est`) dari `stock + rate*waktu` supaya angka berjalan mulus; kebenaran tetap dari server. Boost habis → sinkron ulang `mine_get`.
- **Navigasi:** Back ke halaman asal (`?from=`), tombol Home ke lobby, tombol "+" Coin ke toko.
- Dokumentasi: `doc/fitur/tambang/TAMBANG.md`.

### `hadiah-misi.html` — Hadiah Harian + Misi Harian
- Satu halaman dengan dua tab di kiri (**Hadiah**, **Misi**). Isi kedua tab ditulis langsung di file ini (bukan iframe), dengan kode yang sama seperti `dailyreward.html` dan `misi.html`. Kedua halaman itu juga masih bisa dibuka sendiri dan mengenali `?embed=1` (mode transparan bila dibenamkan).

### `dailyreward.html` — Hadiah Harian (7 hari)
- **Isi:** kalender 7 hari, peti 3D, hitung mundur reset, tombol Lihat Detail.
- **Hadiah:**

| Hari | Hadiah |
|---|---|
| 1 | 50 Gem |
| 2 | 1.000 Coin |
| 3 | Mystery Box ×1 |
| 4 | Dadu Rumput ×1 |
| 5 | Dadu Emas ×1 |
| 6 | 2.000 Coin |
| 7 | Skin Epic Enderman (permanen) |

Bila dadu atau skin sudah dimiliki, hadiah diganti kompensasi (dadu → Coin, skin → Gem); nominalnya ditentukan server.

- **Logika:** status klaim hanya dari server (`daily_reward_get`). Satu klaim per hari; kartu berstatus `done` / `now` / `wait`. Hari yang benar-benar bisa diklaim hanya `now`.

### `misi.html` — Misi Harian
- **3 misi** (`assets/js/quest-data.js`): **Login Harian** (goal 1, hadiah 50 Coin), **Mainkan Permainan** (selesaikan 1 pertandingan, 75), **Raih Kemenangan** (menangkan 3 pertandingan, 150). **Bonus** menyelesaikan semua: 100.
- **Logika:** progres, klaim, dan reset (hari WIB) seluruhnya di server (`quest_get`, `quest_claim*`). Tombol **Klaim** per misi, **Klaim Semua**, dan **Klaim Bonus**.

### `profile.html` — Profil
- **Layout 3 kolom:** kiri karakter 3D + kartu pemain (tombol simpan foto, ganti pose, putar 360°); tengah **Informasi** (nama dengan tombol ubah, ID pengguna dengan tombol salin, level/XP, peringkat), **Koleksi**, **Aktivitas** (riwayat); kanan **Achievement**.
- **Achievement:** 15 achievement × 3 bintang (misalnya "Sang Legenda": menangkan pertandingan, target 500/1000/2000). Progres dari server (`get_my_profile`); klaim divalidasi server (`claim_achievement`).
- **Logika:** Level/XP dari `PlayerData`; menang/main/streak, peringkat, riwayat dari server. Bila belum pernah main, profil menampilkan data kosong tanpa membuat sesi baru.

### `leaderboard.html` — Peringkat
- **Isi:** podium 3 teratas (karakter 3D), kartu "Posisi Kamu", tab **Global / Teman / Mingguan**, tabel `# | Pemain | Skor | Rank`, tombol hadiah.
- **Logika:** `RoomService.getLeaderboard(scope, 50)` dengan scope `global` / `friends` / `weekly`. Tampilan avatar peserta diambil dari `AppearanceService`.

### `friendship.html` — Teman & Sosial
- **Isi:** hero, tab **Online** (dengan jumlah), **Semua**, **Permintaan** (dengan jumlah), kotak pencarian, tombol **Tambah Teman**, daftar kartu teman.
- **Logika:** `listFriends` / `listRequests` dari server; status online dari **Presence** (`lobby` → "Di lobi", status lain → sibuk). Terima/tolak permintaan (`acceptFriendRequest`). Tombol main di kartu teman → `room.html?mode=online&format=solo&count=4&invite=<id teman>`, yang membuat room lalu mengirim undangan.
- Catatan: angka awal Emerald di HTML (`120`) hanya placeholder; langsung ditimpa saldo asli.

### `settings.html` — Pengaturan
- **Grafik:** Tinggi / Rendah.
- **Suara:** slider dan toggle **Musik**, slider dan toggle **Efek suara**, toggle **Getar**.
- **Suasana:** Siang / Malam / Sistem.
- **Logika:** disimpan lewat `PD.setSettings` dan `UT.Prefs` (disinkronkan ke server oleh `PrefsSync`: RPC `get_my_prefs` / `set_my_prefs`, jadi ikut akun lintas perangkat). Tombol Back kembali ke halaman asal (dari `document.referrer`) atau lobby.

---

## 7. Gameplay

### `gameplay.html` (6.776 baris, halaman terbesar)

**Cara masuk:** `RoomFlow.launch(cfg)` membuat URL `gameplay.html?mode=&skins=&theme=&dice=` dan menyimpan konfigurasi lengkap di `sessionStorage` (`ut-config`, `ut-room`). `readLobbyConfig()` memvalidasi semuanya (mode `cpu|2|3|4`, skin, tema, dadu, `night`).

**Mode:**
- `cpu` = 1 lawan Computer (selalu karakter Villager).
- `2`/`3`/`4` = jumlah pemain (lokal bergantian, atau online).

**Alur satu pertandingan:**
1. **Layar Siap (`gameplay/ready.js`):** kartu tertutup sebanyak jumlah pemain; tiap pemain memilih kartu bergantian (maks 10 detik per pemain, kalau diam dipilihkan acak). Angka di balik kartu menentukan **urutan giliran**.
2. **Giliran:** pemain menekan **Roll** (atau tombol **Auto**, jeda 900 ms). Timer AFK (`gameplay/afk.js`) otomatis melempar bila pemain diam; timer ditahan saat tab tersembunyi atau overlay "Putar HP" tampil.
3. **Lempar dadu:** dadu 3D (Dice Kit) dengan hasil yang sudah ditentukan `gameplay.html` (supaya aturan seperti Ramuan atau Pasti 6 tetap berlaku).
4. **Gerak + efek petak:** pion berjalan, lalu efek petak dijalankan (ular, tangga, mob, peti).
5. **Menang/kalah:** panel hasil, konfeti, lalu catat statistik ke server.
6. **Keluar:** `menu jeda → keluar` → `RoomFlow.exitGame()` kembali ke asal masuk (room / mode / lobby).

**Aturan papan (`gameplay/game-core.js`, aturan murni tanpa DOM, bisa dites di Node):**
- Dadu 1–6. Angka **6** = giliran tambahan.
- **Tiga kali 6 berturut-turut** = giliran hangus (tanpa bergerak).
- Melewati petak akhir = **memantul** (`akhir − kelebihan`).
- **Tangga** (naik): 8→26, 20→41, 36→55, 51→72, 71→91.
- **Ular** (turun): 17→4, 32→12, 47→27, 62→44, 98→77.
- Tanpa rantai: sekali naik/turun, tidak berlanjut ke ular/tangga berikutnya.
- Petak akhir: **World = 100** (Ender Dragon), **Nether = 120** (Wither).

**Isi papan (`gameplay/config.js`):**
- **Mob** di petak: Zombie (2), Creeper (30), Skeleton (38), Enderman (53), Villager (85), Blaze (66, hanya di Nether). Mob jahat memundurkan pemain (Skeleton 1, Zombie 1, Blaze 3, Warden 10, dst.). Peta Nether punya mob tambahan (Piglin, Hoglin, Ghast, dll.).
- **Peti (Chest)** di petak 6, 11, 22, 60, 64, 82, 89. Reward acak berbobot: kosong 15%, maju 1–3 langkah 19%, mundur 1–3 langkah 5%, "Pasti 6" 9%, tambah roll 15%, bonus +2 pada dadu berikutnya 19%, meluncur ke tangga terdekat 9%, meluncur ke ular terdekat 9%. (Power sengaja 0% dari peti.)

**Power-up (17 power, datanya di `UT.Gameplay.Config.PUR`):**
Iron/Diamond/Netherite Sword (serang musuh dekat, mundur 2/3/5), Wooden Shield (tahan 1 serangan), TNT (pemain terdepan mundur 6), Feather (giliran tambahan), Golden Apple (+3 pada dadu berikutnya), Totem (pilih pakai saat kena ular/mob/serangan), Ender Pearl (tukar posisi dengan pemain terdepan), Ramuan Ganjil / Genap (dadu berikutnya ganjil/genap), Fire Charge, Ice Crystal (bekukan pemain terdepan satu giliran), Blaze Core (semua musuh di depan mundur 2), Trident, Dragon Crystal (meluncur ke tangga terdekat atau maju 6), Nether Star (semua musuh mundur 3 + giliran tambahan). Sebagian power tidak bisa dipakai saat fase boss (`boss:false`).

**Fase Boss (petak akhir):**
- **World — Ender Dragon:** pemain pertama yang tiba di Block 100 memicu *Dragon Awakening* (arena naik, tower naik, End Crystal muncul, naga spawn; kontrol terkunci selama animasi; hanya 1× per game). Pemain harus menghancurkan **6 End Crystal** (Crystal n hancur bila melempar angka n, urutan bebas), baru boleh menyerang naga (damage per angka dadu × `DMG` = 5). Di fase ini pemain manusia memakai **Special Dice**: tahan tombol Roll, angka berputar 1→6, lepas untuk memilih angka. Hadiah mengalahkan naga: **500 Coin + 10 Emerald**, 1× per game, divalidasi server (`serverBossClaim`, ada batas harian dan token anti-ganda).
- **Nether — Wither:** kamera menyorot benteng, 6 Skeleton Hitam muncul (Skeleton n mati bila melempar n), tembok runtuh, jembatan muncul, lalu **Wither 120 HP**. Mekanik dadu tahan-lepas sama. Skeleton dan Wither tidak menyerang balik. (Komentar di `gameplay/maps/nether.js` yang menyebut fase Wither belum dibuat sudah usang.)

**Online (host-authoritative):**
- Host menjalankan engine; tamu mengirim niat lewat Realtime broadcast (`roll_request`, `power_request`); host menyimpan snapshot ke server dan semua klien menerapkannya (`makeGameSnapshot` / `applyGameSnapshot`).
- Tamu menjalankan animasi sendiri (kamera, musik, SFX) tetapi state selalu dari host. Pemain yang keluar diubah jadi auto (`left`/`auto`) dan bisa bergabung lagi.
- Menu jeda: tombol siang/malam dinonaktifkan untuk tamu.

**Statistik dan hadiah:** hasil dicatat sekali per match (token unik; lawan CPU atau online saja). Yang dicatat per pemain: dadu, tangga, ular, skill, pukulan ke naga, peti. Menambah XP, peringkat, dan progres achievement/misi di server.

**Kamera dan UI:**
- Preset kamera **Free / Front / Top / POV Bidak** (default Free: yaw 0, pitch 1.0, zoom 0.905, pan x −0.01, z 0.15). Mode **ANGLE** (kamera bebas) atau **LOCK** (terkunci di tengah papan), tombol **FOLLOW**.
- Pinch/scroll zoom dibatasi 0.4 sampai 1.5.
- HUD: kartu pemain (kiri atas), tombol suara/menu (kanan atas), banner event (tengah atas), inventori power-up (kiri bawah), panel giliran + dadu + tombol Roll/Auto (kanan bawah), emote di atas pion (lokal + sinkron online), menu jeda (lanjut, siang/malam, keluar dengan konfirmasi).
- Modul HUD terpisah: `gameplay/hud.js`, `gameplay/hud-scale.js`, `gameplay/feedback.js`, `gameplay/particle-fx.js`, `gameplay/fx.js`.

---

## 8. Halaman Pendukung / Non-Produksi

| File | Fungsi |
|---|---|
| `floatingsample.html` | Sampel mandiri pulau melayang (kamera pinch/wheel). Bukan bagian alur game |
| `hud/theme/preview.html` | Preview tema **Fantasy Gold** (tombol Beli Coin dan Emerald). Tema dicoba di lobi lewat `hud/theme/lobby-fantasy.css`, mudah dicabut |
| `tools/character-preview.html` | Preview `UT.CharacterData` |
| `tools/frame-design/Character_Frames.html` | Alat desain frame karakter |
| `tools/power-icons/bake.html` | Membuat ikon power 3D (render 192 px) |
| `tools/sim/balance.js` | Simulasi balance memakai `game-core.js` dengan RNG ber-seed |
| `tools/build-schema-snapshot.sh`, `gen-preload-manifest.py` | Skrip build snapshot skema dan manifest preload |
| `referensi/voxel-fx-lab-refined.html` | Lab efek voxel (referensi) |
| `audit/tutorial-supabase.html` | Tutorial membuat Supabase sendiri (proyek, login email tanpa konfirmasi, migrasi SQL, Realtime, URL + kunci, akun uji, query cek) |
| `laporan-audit.html` (8.028 baris) | Laporan audit: multiplayer dan Supabase, responsif, power/FX/audio, dadu bersama, fitur naga |
| `sw.js`, `manifest.webmanifest` | Service worker dan PWA manifest ("Dragon Roll") |

---

## 9. Lapisan Data dan Layanan

| Modul | Peran |
|---|---|
| `session.js` | Cache sesi login di `localStorage['ut-auth']` ({id, username}). Satu pintu untuk semua pembaca sesi. Kebenaran sesi tetap dari Supabase Auth |
| `auth.js` | Daftar/masuk/cek sesi (username + password via Supabase Auth) |
| `player-data.js` (`PlayerData`) | **Single source of truth** sisi klien: saldo, inventory, item aktif, pengaturan, profil, XP. Disimpan per akun di `localStorage` (`ularTanggaBlok:player:v1:acct:<id>`). Semua saldo mulai 0 sampai server membalas (`walletReady`) |
| `wallet-service.js` | Satu-satunya pintu klien ke dompet **server**: beli item, tukar Emerald→Coin, klaim hadiah harian/misi, klaim iklan. Klien tidak pernah mengirim nominal |
| `appearance-service.js` | Outfit pribadi dan tampilan aktif di server (server menang saat refresh) |
| `mine-service.js` | RPC tambang (`mine_get/unlock/upgrade/boost/collect`) |
| `prefs.js` / `prefs-sync.js` | Preferensi lokal + sinkron ke server (debounce) |
| `item-catalog.js` | Satu-satunya sumber harga dan metadata item (skin, frame, dadu, tema/peta, power-up) |
| `room-flow.js` | Jembatan Mode → Room → Gameplay (`navigate`, `launch`, `returnUrl`, `exitGame`) |
| `multiplayer/client.js` | Bootstrap klien Supabase |
| `multiplayer/room-service.js` | Room: buat, gabung, siap, mulai, keluar, slot, leaderboard, teman |
| `multiplayer/presence.js` | Status online (`lobby`, `room`) untuk daftar teman |
| `multiplayer/game-sync.js` | Transport gameplay host-authoritative lewat Realtime |
| `multiplayer/progress-service.js` | Profil, riwayat, achievement, login harian |
| `ads-service.js` | Iklan berhadiah (provider simulasi bawaan) |

**Supabase (`supabase/migrations`, 31 file):** multiplayer, game events, room slots, friendships/requests, player stats/progress, hasil match aman, wallet (b1–b6, termasuk iklan), outfit, `buy_set`, prefs, katalog frame/dadu/aura/power, tambang, counter achievement dari server, dll.

---

## 10. Catatan Temuan (ketidakkonsistenan yang terbaca di kode)

1. **README usang:** menyebut `skins.html`, `ular tangga.html`/`ular-tangga.html`, `assets/js/app-ui.js`, dan `assets/js/navigation.js` — file-file ini **tidak ada** di repo. README juga menyebut "tanpa akun/server" padahal sekarang memakai Supabase, dan efek "kerangka kosong" padahal sudah ada aura.
2. **Quick Start = simulasi:** `ranked()` di `mode.html` memalsukan pencarian lawan; `quickJoin()` yang asli ada tetapi tidak terhubung ke tile.
3. **MAIL** dan **Hadiah gratis** di lobi hanya menampilkan toast "segera hadir". Peta **The End** terkunci (SOON).
4. **Iklan:** provider bawaan simulasi; server hanya membatasi jumlah klaim, belum memverifikasi tayangan lewat callback jaringan iklan.
5. **Komentar usang:** `gameplay/maps/nether.js` menyebut fase Wither belum dibuat, padahal `gameplay.html` sudah memiliki Finale Nether.
6. **Dua halaman, satu tampilan:** `hadiah-misi.html` menggabungkan isi `dailyreward.html` dan `misi.html`; kode UI-nya diduplikasi di ketiga file.
7. **Pola duplikasi kode:** `frame.html`, `dadu.html`, `efek.html`, `powerup.html` hampir identik (hanya `PAGE` dan renderer preview berbeda). Kandidat untuk dijadikan satu komponen bersama bila ingin merapikan.
8. **Repo pindah:** remote lama `rohmanaa/ular-tangga` masih bisa di-push lewat redirect, tetapi alamat baru adalah `rohmanaa/dragonroll`.

---

## Struktur folder `game/` (GUI baru)

Semua halaman, CSS, JS, dan aset GUI berada di `game/`. Buka lewat server statis (mis. `cd game && python3 -m http.server`) lalu `index.html`.

| File | Isi |
|---|---|
| `index.html` → `splash.html` | Loading, login/daftar (simulasi di localStorage) |
| `lobby.html`, `mode.html`, `room.html` | Menu, pilih mode, game room |
| `karakter.html` | Pilih hero (10 karakter), dipakai lewat `js/heroes.js` |
| `settings.html` | Grafik, suara, getar, suasana |
| `shop.html` | Toko: tukar Emerald → Coin (10→500, 40→2.500, 120→10.000, ke-3 BEST), tab Emerald: Tonton Iklan (simulasi, +5). `?coin=1` buka tab Coin, `?from=` untuk Back |
| `css/` | `common.css` + satu CSS per halaman |
| `js/` | `heroes.js` (daftar hero) + satu JS per halaman |
| `assets/` | Kit komponen UI. **Root `assets/` = sumber utama**; `game/assets/` = salinan siap pakai (lihat Aturan Aset) |

Belum dibuat: gameplay (tombol START/Quick Start sementara menampilkan toast "Gameplay segera hadir"), Layar Siap (kartu urutan), power-up, fase Boss (Ender Dragon / Wither), multiplayer online (butuh Supabase), serta halaman koleksi, tambang, misi, profil, leaderboard, teman.
