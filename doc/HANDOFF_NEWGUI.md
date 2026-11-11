# HANDOFF — Memindahkan GUI baru (newgui) ke game Dragon Roll (dragonroll)

Dokumen ini untuk AI/developer yang melanjutkan pekerjaan. Baca seluruhnya sebelum menyentuh kode.
Terakhir diperbarui: 11 Nov 2026 (room selesai). Pemilik proyek: rohmanaa (bahasa kerja: Indonesia).

---

## 1. Dua repo dan perannya

| Repo | URL | Peran |
|---|---|---|
| **dragonroll** | `https://github.com/rohmanaa/ular-tangga` (sudah diganti nama jadi `rohmanaa/dragonroll`; URL lama masih redirect) | **Game asli = sumber SEMUA data & logika.** 22 halaman, gameplay 3D (Three.js), multiplayer Supabase, 34 migrasi SQL, PWA, tes Node. Statis tanpa build step. |
| **newgui** | `https://github.com/rohmanaa/newgui` | **Mockup UI terbaru yang disukai pemilik.** Murni tampilan (~4.100 baris): satu HTML + satu CSS + satu JS per halaman, kanvas tetap 1920x1080 yang diskalakan. Data TIRUAN di `localStorage` (kunci `dragonroll:*`), login simulasi. Tidak ada gameplay, tidak ada Supabase. |

**Konsep inti:** `dragonroll` = data/backend/gameplay (tidak diubah isinya). `newgui` = kulit tampilan baru.
Pekerjaan = **memindahkan tampilan newgui ke dragonroll halaman demi halaman**, mengganti data tiruan dengan layanan asli dragonroll.

### Keputusan pemilik (jangan diubah tanpa tanya)
1. Arah: **newgui -> dragonroll** (dragonroll jadi basis). BUKAN `git merge` (struktur beda total, konflik di mana-mana). Ini **port**: salin HTML/CSS/aset, ganti data tiruan.
2. Data item (dadu, frame, karakter, efek, power-up) semua dari dragonroll (`ItemCatalog`, `PlayerData`, server). Data newgui dibuang.
3. **Hero** di newgui (pemanah, pejuang, dll. di `heroes.js`) hanya **placeholder** — jangan dipakai. Karakter asli = editor blocky 3D milik dragonroll (`UT.BlockyCharacter`).
4. Di halaman Karakter newgui ada **kolom slot (kotak ±6) di samping karakter** -> dipakai untuk **aksesoris** (dragonroll punya aksesoris multi-pilih). Dikerjakan saat porting karakter.html.
5. **Gameplay tidak diubah.** Nanti hanya HUD dan feedback.
6. Fitur baru di newgui yang belum ada di dragonroll: **Pet**, **Chest** (peti beli pakai Emerald), Mail, Guild/Celengan (SOON). Chest wajib diundi di **server** (RPC baru); branch `stage4-chest-*` di dragonroll sudah merintis. Pet belum punya data/server sama sekali.
7. Strategi sinkron: **polling ringan tanpa migrasi** (lihat bagian 4), bukan Supabase Realtime.

---

## 2. Status pekerjaan

Branch kerja: **`ui-newgui`** di repo dragonroll (dibuat dari `main` commit `e8b422c`). **Jangan push ke `main` langsung.**
CI (`.github/workflows/db-migrate.yml`) menjalankan `supabase db push` ke **PRODUKSI** saat push ke `main` (setelah tes lulus). Branch lain & PR hanya menjalankan tes. Jangan menyentuh `supabase/migrations/` kecuali memang perlu RPC baru, dan itu harus melalui review.

| Langkah | Status |
|---|---|
| 1. Aset UI + CSS ke `assets/ng/` | Selesai untuk lobby (27 file). Halaman lain: salin aset yang dipakai saja |
| 2. `lobby` (commit `5f3ad06`) | **Selesai, belum dicek visual di browser** |
| 3. `live-sync.js` | Selesai (7 tes) |
| 4a. `mode` | **Selesai (belum dicek visual di browser)** — peta dari `RoomFlow.maps()` + The End terkunci; Quick Start masih simulasi (sama seperti sebelumnya); Create Room -> `RoomFlow.navigate('room',...)` |
| 4b. `room` | **Selesai (belum dicek visual di browser)** — logika room lama dipertahankan (RoomService/Presence/PlayerData/RoomFlow, power per map, avatar wajah+frame); tampilan newgui; drawer undang teman jadi modal; semua tes lulus; sw v65 |
| 5. `settings`, `shop`, `splash`(login asli) | Belum |
| 6. karakter (slot aksesoris), frame, dadu, efek, powerup | Belum |
| 7a. `tambang` | **Selesai (belum dicek visual di browser)** — pulau 3D asli (mine-island) di atas + 3 kartu gaya newgui; data/aksi lewat `MineService`; konfirmasi biaya untuk Buka/Upgrade; sw v66. Aset bersama `page.css`/`sub.css` sudah ada di `assets/ng/css/` |
| 7b. profile, leaderboard, friendship, misi (hadiah-misi) | Belum |
| 8. Chest (butuh RPC server), Pet (butuh data+server), Mail | Belum |
| 9. gameplay: hanya HUD/feedback | Terakhir |

Yang belum diverifikasi pada lobby: karakter 3D di atas pedestal (posisi/ukuran), tampilan di HP. Dites hanya lewat jsdom tanpa WebGL (tanpa error JS).
Sisa di lobby: Hadiah gratis, Chest, Mail, Pet = toast "segera hadir"; teks misi netral "Buka untuk lihat progres" (progres asli belum disambung); dadu di tangan karakter (aksi toss/dribble/dll.) belum ada, aksi lobby tinggal 6.

---

## 3. Arsitektur dragonroll yang wajib dipahami

- Semua halaman jalan **di dalam iframe `play.html`**. Guard: `assets/js/frame-guard.js`, `session.js`, `boot-guard.js` (di `<head>` paling awal). Halaman dibuka tanpa splash/login dialihkan ke `splash.html?next=...`. `?noframe=1` untuk debug.
- Data klien: **`PlayerData`** (`assets/js/player-data.js`) = single source of truth (saldo, inventory, item terpasang, profil, XP, settings). Cache `localStorage` per akun (`ularTanggaBlok:player:v1:acct:<id>`); saldo mulai 0/"—" sampai `PD.walletReady()`.
- Server (Supabase, semua mutasi lewat **RPC**, klien tidak pernah kirim nominal):
  - `WalletService` (`wallet-service.js`): `refresh()`, `buy`, `exchange`, `daily*`, `quest*`, dll.
  - `AppearanceService`: tampilan/outfit aktif (`refreshThrottled()` maks 1x/20 dtk).
  - `multiplayer/progress-service.js` (`getMyProfile`, `dailyLogin`), `multiplayer/room-service.js` (room, teman, leaderboard), `presence.js`, `game-sync.js`.
  - `mine-service.js` (tambang), `prefs-sync.js`.
- Event UI: `UT.Events` (`currencyChanged`, `skinChanged`, `frameChanged`, `inventoryChanged`, ...) dijembatani dari `PD.subscribe` oleh `assets/js/app.js`. Alasan notifikasi PlayerData: `equip`, `pageshow`, `storage`, `server-wallet`, `server-appearance`, `server-outfits`.
- Urutan muat skrip (lihat `lobby.html` sebagai contoh yang benar): item-catalog -> character-data -> item-art -> player-data -> three -> blocky-character -> character-face -> aura-fx -> aura-view -> wallet-service -> appearance-service -> app.js -> hud/ui-core.js -> live-sync.js -> `UT.App.init({page:'...'})`. `UT.PAGES` di `app.js` daftar halaman yang dikenal.
- Karakter asli: `UT.BlockyCharacter.create(THREE)` -> `loadFromPlayer()`; `tick(dt)`, `act('flip'|'roll'|'backflip'|'spin'|'wave'|'cheer'|...)`, `jump()`, `setMode('run'|'idle')`. Wajah avatar: `UT.CharacterFace.mount(el, fallback)`.
- Hari reset misi = WIB; level: 400 XP level 1, +100 per level, maks 999.
- Referensi lengkap alur & logika semua halaman: **`README.md` di repo newgui** (hasil membaca kode dragonroll; lebih akurat daripada README dragonroll yang sebagian usang).

### Struktur newgui yang perlu tahu
- `game/` = halaman (`*.html`, `css/`, `js/`). `assets/komponen/` (root) = **sumber utama aset**; `game/assets/` = salinan. Catatan: 2 file (`tombol-dan-kontrol/tile-menu-bawah.webp`, `tombol-play-lobby.webp`) hanya ada di `game/assets/`, tidak di root — ambil dari sana.
- newgui memakai nama halaman `mission.html`; di dragonroll namanya `hadiah-misi.html` (gabungan `dailyreward` + `misi`).
- Aturan aset newgui: pakai komponen yang sudah ada di kit (jangan bikin SVG/CSS panah/tombol sendiri).
- `layout contoh( bukan UI ref ).html` dan `assets/penerapan/*.png` = referensi desain, bukan kode.

---

## 4. Konsep sinkron live (lobby)

Realtime Postgres **tidak** dipakai: tabel `player_wallet`/`player_stats` tidak punya policy baca langsung (akses hanya lewat RPC security definer), jadi push butuh migrasi -> ikut deploy produksi.
Solusi: **`assets/js/live-sync.js`** (`UT.LiveSync`) — polling RPC yang sudah ada:
- `add(nama, fn, {minGap})`, `start({interval,maxInterval,minGap,immediate})`, `stop()`, `now(alasan)`, `status()`.
- Jalan tiap ~20 dtk **hanya saat tab terlihat & online**; juga saat `visibilitychange`/`focus`/`online`/`pageshow(persisted)`. Gagal -> jeda berlipat sampai 120 dtk. Tidak pernah dua putaran bersamaan. Hasil masuk lewat PlayerData -> event UI otomatis.
- Tugas yang didaftarkan lobby: `wallet` (`WalletService.refresh`), `xp` (`getMyProfile`), `appearance` (`refreshThrottled`), `friends` (`listRequests`).
- Tahap 2 (opsional, nanti): push instan via migrasi (policy select + publication realtime) — hanya setelah disetujui pemilik.

---

## 5. Resep porting satu halaman

1. Baca halaman dragonroll lama (data & RPC apa yang dipakai) + halaman newgui (tampilan). Cocokkan dengan README newgui.
2. Salin hanya aset yang dipakai ke `assets/ng/komponen/<subfolder>/` (jaga struktur subfolder). CSS ke `assets/ng/css/` dengan `url(../komponen/...)`.
3. Tulis ulang HTML halaman di root dragonroll: head dengan guard + prefs, CSS baru, skrip sesuai urutan bagian 3, `UT.App.init({page})`.
4. Ganti objek data tiruan (`PD={...localStorage...}`) dengan `PlayerData`/`WalletService`/... asli. Hapus semua kunci `dragonroll:*` mock. Pertahankan pemetaan nama halaman (mission -> hadiah-misi).
5. Pasang `UT.LiveSync` bila halaman menampilkan saldo/XP/data server.
6. Bump `VERSION` di `sw.js`; jalankan `python3 tools/gen-preload-manifest.py`.
7. Jalankan semua tes: `for f in tests/*.test.js tests/multiplayer/*.test.js; do node "$f" || echo FAIL $f; done`.
8. Commit + push ke `ui-newgui`.

### Jebakan yang sudah ditemui
- Beberapa tes **membaca teks `lobby.html`** (mis. `tests/lobby-appearance.test.js`, `blocky-actions.test.js`, `aura-view.test.js`): urutan skrip, baris `PD.subscribe(r=>{if(r==='equip'...buildHero()...renderAvatar()...})`, `bc.tick(dt);lobbyStep(dt)`, `lobbyTap();buzz()`, `UT.AuraView.create(`. Ubah tes hanya bila maksudnya memang berubah, dan catat. Halaman lain (`profile`, `efek`, `leaderboard`, `karakter`, `gameplay`) juga dicek tes serupa.
- Saldo/inventory **tidak boleh** diubah klien; selalu lewat RPC. Item katalog dari `ItemCatalog`, bukan hardcode.
- Peti newgui mengundi hadiah di klien -> harus diganti RPC server sebelum dipakai sungguhan.
- Kunci/token: **jangan pernah** commit token GitHub atau `service_role`. Klien hanya memakai kunci publishable (`assets/js/multiplayer/config.example.js`).
- Pengujian visual belum bisa dilakukan di lingkungan tanpa browser; minta pemilik membuka branch & kirim screenshot.

---

## 6. Perintah berguna

```sh
git clone https://github.com/rohmanaa/ular-tangga.git dragonroll && cd dragonroll
git checkout ui-newgui
python3 -m http.server 8000        # buka http://localhost:8000/ (service worker butuh http://localhost atau HTTPS)
node tests/live-sync.test.js
```
Remote branch dragonroll: `main` + ±50 branch fitur (a.l. `stage4-chest-feature-02-reward-pool`, `profile-real-data`, `tahap-6a-achievement-server`). Remote newgui: `main`, `lobby-panel-webp-karakter-fcubia`.
