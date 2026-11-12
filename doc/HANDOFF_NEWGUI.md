# HANDOFF — Memindahkan GUI baru (newgui) ke game Dragon Roll (dragonroll)

Dokumen ini untuk AI/developer yang melanjutkan pekerjaan. Baca seluruhnya sebelum menyentuh kode.
Terakhir diperbarui: 12 Nov 2026 (lobby, mode, room, tambang, settings, shop, friendship, mail, leaderboard, hadiah-misi selesai; tambang: gua di dalam kartu). Pemilik proyek: rohmanaa (bahasa kerja: Indonesia).

---

## 0. Ringkas (baca ini dulu)

- **Tugas:** pindahkan tampilan `newgui` ke `dragonroll`, satu halaman per commit, di branch **`ui-newgui`** (jangan push ke `main`: CI deploy DB ke produksi).
- **Sudah selesai:** `lobby`, `mode`, `room`, `tambang`, `settings`, `shop`, `friendship`, `mail`, `leaderboard`, `hadiah-misi` (verifikasi visual shop dan uji transaksi Supabase nyata masih perlu dilakukan).
- **Berikutnya:** `splash` (login asli), lalu karakter/frame/dadu/efek/powerup, profile, Chest/Pet, terakhir HUD gameplay.
- **Cara kerja yang terbukti:** pertahankan skrip logika lama halaman dragonroll (RPC, PlayerData, tes), ganti hanya markup + CSS + fungsi render ke gaya newgui. Detail di bagian 5.
- **Sebelum push:** `for f in tests/*.test.js tests/multiplayer/*.test.js; do node "$f" || echo FAIL $f; done`, bump `VERSION` di `sw.js`, jalankan `python3 tools/gen-preload-manifest.py`.
- **Pemilik:** rohmanaa, bahasa kerja Indonesia. Jangan pernah menulis token GitHub ke repo atau dokumen.

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

| Langkah | Status | Commit / catatan |
|---|---|---|
| 1. Aset UI + CSS ke `assets/ng/` | Berjalan: salin hanya aset yang dipakai halaman | CSS bersama: `common.css`, `bg.css`, `page.css`, `sub.css`; per halaman: `lobby.css`, `mode.css`, `room.css`, `tambang.css`, `shop.css`, `friendship.css` |
| 2. `lobby` | **Selesai** | `5f3ad06` |
| 3. `live-sync.js` | Selesai (7 tes) | — |
| 4a. `mode` | **Selesai** | `af2b477` |
| 4b. `room` | **Selesai** | `7a63258`, sw v65 |
| 5a. `settings` | **Selesai** (belum dites di browser; pemilik menguji manual) | `100cb08` + penyempurnaan, sw v68. Desain newgui + pilihan bahasa (pref `lang`, hanya menyimpan pilihan). Tanpa `LiveSync` (tidak menampilkan saldo/XP); repaint lewat `UT.Prefs.on` supaya pref hasil `PrefsSync.pull` ikut tampil. `ambience.js` tetap dimuat karena dipakai `UT.Ambience` (grafik/suasana) |
| 5b. `shop` | **Selesai** | Coin lewat `WalletService.exchange`; riwayat lewat `WalletService.history`; saldo memakai `LiveSync`. Chest dan iklan Emerald tetap nonaktif sampai dukungan server siap; sw v73 |
| 5c. `splash` (login asli) | Selesai | `splash.css` newgui apa adanya |
| 6a. `frame` | **Selesai** | `b605864`; animasi `FrameFX` aktif + sayap Phoenix/Surgawi tidak kepotong (sw v79–v80) |
| 6b. `dadu` | **Selesai** (belum dicek visual di browser) | sw v82 |
| 6c. `efek` | **Selesai** (belum dicek visual di browser) | sw v83 |
| 6d. `powerup` | **Selesai** (belum dicek visual & belum dites di browser) | sw v87. Tampilan newgui (template frame/dadu/efek, CSS sendiri `assets/ng/css/powerup.css`) |
| 6e. karakter (slot aksesoris) | Belum | — |
| 7a. `tambang` | **Selesai** | `99e098a` lalu diubah: gua 3D masuk ke dalam tiap kartu (sw v84) |
| 7b. `leaderboard` | **Selesai** (belum dicek di browser pengguna) | sw v89 |
| 7b'. `hadiah-misi` | **Selesai** (tab Hadiah + Misi + Pencapaian) | sw v92 |
| 7b''. profile | Selesai | `profile.css` newgui apa adanya (+ blok <style> kecil di profile.html) |
| 7c. `friendship` | **Selesai** | Tampilan NewGUI; teman, permintaan, ajakan bermain, avatar, saldo, dan statistik posisi/level/kemenangan memakai layanan Dragon Roll. Like nonaktif sampai tersedia dukungan server; tidak ada statistik tiruan. sw v74 |
| 8a. `mail` | **Selesai** (migrasi `202611260001_player_mail.sql` BELUM diterapkan ke Supabase mana pun; lihat catatan) | sw v88 |
| 8b. Chest (butuh RPC server), Pet (butuh data+server) | Belum | — |
| 9. gameplay: hanya HUD/feedback | Terakhir | — |

Yang belum diverifikasi pada lobby: karakter 3D di atas pedestal (posisi/ukuran), tampilan di HP. Dites hanya lewat jsdom tanpa WebGL (tanpa error JS).
Sisa di lobby: Hadiah gratis, Chest, Pet = toast "segera hadir"; teks misi netral "Buka untuk lihat progres" (progres asli belum disambung); dadu di tangan karakter (aksi toss/dribble/dll.) belum ada, aksi lobby tinggal 6.

---

### Catatan per halaman yang sudah dipasang

**`lobby`** — frame avatar profil memakai `FrameFX` agar glow dan partikel animasi muncul seperti di halaman Profil. Titik merah Mail (`#mailDot`) dari `MailService.summary()` lewat `LiveSync` (`pullMail`, minGap 40 dtk). Belum diverifikasi: karakter 3D di atas pedestal (posisi/ukuran) dan tampilan di HP (dites hanya lewat jsdom tanpa WebGL). Sisa: Hadiah gratis, Chest, Pet = toast "segera hadir"; teks misi netral "Buka untuk lihat progres" (progres asli belum disambung); dadu di tangan karakter (aksi toss/dribble/dll.) belum ada, aksi lobby tinggal 6.

**`mode`** — peta dari `RoomFlow.maps()` + The End terkunci; Create Room -> `RoomFlow.navigate('room', ...)`. **Quick Start masih simulasi** (2,4 dtk "mencari lawan" lalu pemain palsu), sama seperti halaman lama. Menyambungkan ke `RoomService.quickJoin` mengubah alur main, jadi butuh keputusan pemilik (lihat "Pertanyaan terbuka").

**`room`** — logika lama dipertahankan utuh (RoomService, Presence, PlayerData, RoomFlow, power per map, avatar wajah+frame dari server, `loadLooks`). Perubahan tampilan: drawer "Undang Teman" jadi modal (`#dr`, kelas `html.dro` tetap dipakai), modal pilih item pakai kisi `.it`, tombol KELUAR menggantikan tombol ✕ (-> lobby), tombol kembali -> mode. Power Loadout memakai lima slot; slot membuka modal pilihan gaya NewGUI, dengan stok inventori, batas bawa, dan batas map tetap mengikuti Dragon Roll. Ikon Efek memakai kristal api seperti referensi. Pilihan disimpan saat tombol SELESAI ditekan. `wallet-service.js` + `LiveSync` ditambah supaya stok power ikut segar. Panel Power Loadout tetap aktif di mode online (perilaku lama); `cfg()` tetap mengirim `powers: []` untuk online.
- **Bug lama (belum diperbaiki):** `skinGo()` memanggil `RF.navigate('karakter.html')`, tetapi `RoomFlow.navigate` hanya mengenal `'room'|'mode'|'back'|'home'`, jadi tombol ganti Karakter di room jatuh ke `lobby.html`. Perbaiki saat porting `karakter`.

**`tambang`** — 3 kartu gaya newgui; **gua 3D asli (`mine-island.js`) ditaruh DI DALAM tiap kartu** (keputusan pemilik: bukan satu pulau di atas). Satu renderer WebGL tersembunyi (`#cv`, `display:none`) merender 3 viewport berjajar lewat `isl.renderViews(renderer,vw,vh)` (kamera tiap viewport menghadap guanya, unit gua lain disembunyikan sementara), lalu tiap potongan disalin dengan `drawImage` ke kanvas 2D `.cvv` di jendela `.win` kartunya (satu konteks WebGL, bukan tiga). Ukuran buffer mengikuti skala layar (`viewSize()`/`bindViews()`). Permintaan pemilik: **ketiga gua sama tinggi/sejajar (h=6, fz=-3) dan diapit tebing tinggi kiri-kanan seperti gua tengah** (`FLANK` di `mine-island.js` = tebing pembatas di luar gua 1 & 3 + lantai batu); **jendela selebar card (tepi ke tepi), serba batu (tanpa rumput hijau, tanpa pohon, tanpa tiang bendera), tidak goyang** (`isl.still=true`: pulau tidak melayang, lampu tidak berayun, tanpa getaran; latar jendela batu gelap). Pemilihan slot (`isl.pick/select`, chip label, efek DOM emerald/Zzz) dihapus karena tiap kartu punya gua sendiri; `+N Emerald` muncul di jendela kartu. Semua aksi lewat `MineService` (server menentukan hasil). Modal konfirmasi biaya untuk Buka/Upgrade dan dialog "Coin tidak cukup" -> Toko; Percepat/Ambil langsung. `ambience.js` tidak dimuat. Tes `mine-island.test.js` diubah mengikuti ini (cek `renderViews` + `drawImage`, tambah tes viewport). Terverifikasi lewat Chromium (WebGL swiftshader) dengan `MineService` tiruan.

**`shop`** — tampilan dari newgui; saldo tetap dari `PlayerData`, pertukaran paket Emerald→Coin dan riwayat tetap memakai `WalletService` server. Tab Chest hanya placeholder nonaktif (undian butuh RPC server); iklan Emerald tetap “Segera hadir”, tanpa simulasi reward lokal. Saldo disegarkan lewat `LiveSync`.

**`friendship`** — tampilan dari newgui; daftar teman/permintaan, accept/decline/remove, pencarian, Presence, ajakan bermain, dan avatar aktif tetap memakai RoomService, Presence, AppearanceService, dan FrameAvatar asli. Posisi, level, dan kemenangan berasal dari leaderboard teman server; statistik tanpa pertandingan ditampilkan `—`. Saldo memakai PlayerData + LiveSync. Tombol like nonaktif (`—`) sampai dukungan server tersedia; tidak ada data teman tiruan.

**`frame`** — GUI baru (kolom kiri preview + nama/rarity/deskripsi, kanan grid kartu 6 kolom + tombol aksi, modal konfirmasi beli). Data dari `ItemCatalog` (kind `frame`, tanpa item `off`) + `PlayerData` (`owns`/`isEquipped`/`equip`); beli lewat `WalletService.buy` (mode server) atau `PD.purchase`; gambar frame dari `ItemArt.frame()` (wajah skin yang dipakai di dalam bingkai). Item belum dimiliki tetap tampil (terkunci) dan bisa di-preview. `UT.Events` + `LiveSync` (saldo). CSS: `assets/ng/css/karakter.css` (template koleksi, dipakai juga nanti oleh karakter/dadu/efek) + `frame.css`. Dites jsdom (14 kartu, tanpa galat JS); belum dicek visual di browser. sw v67.

**`dadu`** — template sama dengan `frame` (kolom kiri preview + nama/rarity/deskripsi singkat (kalimat pertama), kanan grid kartu + tombol aksi, modal beli). Data dari `ItemCatalog` (kind `dice`, tanpa item `off`) + `PlayerData`; beli lewat `WalletService.buy`/`PD.purchase`, langsung dipakai. Preview = dadu 3D asli `DiceKit.mount` di `#fpv` (fisika kocok-lempar, suara mengikuti pref `sfxVol`/`sound`); klik preview atau klik kartu = lempar (tanpa tombol Coba Lempar) (angka hanya visual). Kartu = `DiceKit.thumb` (warna asli); bila kit belum siap/gagal dimuat dipakai `ItemArt.dice` (SVG) dan preview SVG statis. `draw()` tidak menyentuh `#fpv` selama `KIT` aktif. Kanvas preview 700px (supaya efek tidak kepotong) + `CAM_SCALE=.628` = dadu 1,3x dari ukuran semula; ukuran dadu diatur lewat `camScale`, bukan ukuran kanvas. CSS: `assets/ng/css/dadu.css` (+ karakter.css, frame.css). Dites jsdom dengan dan tanpa stub `DiceKit` (23 kartu, tanpa galat JS); fisika/WebGL asli belum dicek di browser. sw v82.

**`efek`** — template sama dengan `frame`/`dadu`, tanpa tombol coba. Data: `ItemCatalog` kind `aura` (15 aura, tanpa item `off`, hanya yang ada di `UT.AuraFX.AURAS`) + kartu pertama **Tanpa Efek** (pseudo-item `__none`, selalu dimiliki; dipakai = slot `aura` kosong; GUNAKAN pada kartu ini = `PD.unequip('aura')`). Pakai/beli seperti frame (`PD.equip`, `WalletService.buy`/`PD.purchase`, langsung dipakai). Preview = karakter pemain 3D (`UT.BlockyCharacter.loadFromPlayer`, tampilan akun dari `AppearanceService`) + `UT.AuraFX.AuraSystem`, berputar pelan, geser = putar, ketuk = aura melompat; memilih kartu hanya `setAura`/`despawn` (karakter tidak dibuat ulang). Tanpa WebGL: preview SVG `ItemArt.aura`. Rarity aura memakai 7 tingkat (uncommon/mythic/divine ditambahkan ke peta label). Kartu = `ItemArt.aura`. CSS: `assets/ng/css/efek.css`; aset baru `glyph-putih/bintang-kilau.webp`. Dites jsdom (16 kartu; jalur dengan stub THREE/AuraFX); posisi/ukuran karakter dan efek aura asli belum dicek di browser (konstanta `FXSCALE`, `CY`, `DIST` di `efek.html`). sw v83.

**`powerup`** — template sama dengan `frame`/`dadu`/`efek`. Data: `ItemCatalog` kind `powerup` tanpa item `off` (baris `KINDS.forEach(k=>CI[k]=IC.items.filter(i=>i.kind===k&&!i.off))` dan `IC.powerMapNote(i.id)` tetap ada karena dibaca `tests/power-rules.test.js`); stok dari `PlayerData.qty` (kartu ×N, ×0 = terkunci). Beli per jumlah (stepper 1–99) lewat `WalletService.buyPowerup` (mode server, opId unik) atau `PD.purchase` (lokal); item tanpa harga = "TIDAK DIJUAL" (tetap bisa diketuk -> toast). Preview 3D `assets/js/power3d/power-show.js` dimuat malas ke `#p3d` di dalam `#fpv` (importmap tetap di head, dibaca `tests/power3d.test.js`); gagal/tanpa WebGL -> ikon 2D katalog + animasi putar efek + `UT.PowerFX`. Ikon kartu = `item.icon` katalog (bukan ikon contoh newgui). Dompet: + gem -> tambang, + coin -> shop. Id `#art` sengaja tidak dipakai (bentrok dengan `karakter.css`); wadah preview `#pa`.

**`mail`** — kotak masuk **otoritatif server**: `supabase/migrations/202611260001_player_mail.sql` (tabel `player_mail`, RLS tanpa akses langsung, semua lewat RPC `mail_summary/list/read/read_all/claim/claim_all/delete`; hadiah masuk dompet lewat `_wallet_apply` dengan kunci idempoten `('mail', <id surat>)` -> klaim ganda mustahil). Klien: `assets/js/mail-service.js` (`UT.MailService`, pola sama dengan `MineService`: `{ok,reason}`, tidak melempar, klaim/klaim-semua berbagi satu kunci `inflight`, saldo hasil klaim -> `PD.applyServerWallet`; tes `tests/mail-service.test.js`). Halaman `mail.html` + `assets/ng/css/mail.css`: tab Semua/Hadiah/Sistem, Baca Semua, Klaim Semua, modal isi surat, hapus (surat berhadiah yang belum diklaim tidak bisa dihapus), muat ulang tiap 30 dtk saat terlihat. **Tanpa akun login halaman hanya menampilkan ajakan masuk; tidak ada surat/dompet tiruan.** Lobby: tombol Mail -> `mail.html?from=lobby.html`; `tambang.html` menerima `?from=mail.html`. Aset baru: `ikon-item/kado-merah.webp`, `glyph-putih/surat-terbuka.webp`. Surat dibuat hanya oleh server/admin: `select public._mail_send(<user_id>,'reward'|'system',judul,isi,coin,gem,dedupe_key,kedaluwarsa)` atau `_mail_send_all(...)` (dedupe_key wajib) lewat SQL Editor; surat sambutan dibuat otomatis sekali per akun saat `mail_list` pertama. **PENTING:** migrasi baru ikut deploy ke PRODUKSI saat masuk `main` (CI `db-migrate.yml`); review dulu. `supabase/snapshot/00_full_schema.sql` sudah dibangun ulang. Diverifikasi lewat Chromium dengan `MailService` tiruan (3 surat, modal, klaim semua, tanpa galat JS); **belum dites terhadap Supabase nyata** (RPC belum ada di server). `mail` ditambahkan ke `UT.PAGES`, presence, dan suara tombol di `app.js`.

**`leaderboard`** — tampilan newgui (tab kiri Global/Teman/Mingguan, podium 3 teratas, kartu "Posisi Kamu", tabel `# | Pemain | Skor | Menang`, tombol Hadiah). Data tetap dari `RoomService.getLeaderboard(scope,50)` (RPC `get_leaderboard`), avatar pemain lain dari `AppearanceService.usersAppearance`, baris sendiri dari `PlayerData`; cache per tab 20 dtk, `LiveSync` (`wallet`, `board`). **Perbedaan dari halaman lama:** podium 3D (karakter `BlockyCharacter` di atas gambar latar + papan nama) diganti podium HTML dengan avatar wajah + bingkai (`FrameAvatar`), seperti desain newgui; kolom "Rank" tier (Bronze…Master) di mockup TIDAK dipakai karena tier tiruan, diganti kolom Menang dari server. Tombol Hadiah = "segera hadir" tanpa nominal. Aset baru: `ikon-gem-medali/medali-1..3`, `glyph-putih/grup-pengguna`, `jam-bulat`. `tests/lobby-appearance.test.js` (membaca teks `leaderboard.html`: `refreshThrottled()`, handler `server-appearance/outfits`, `appearance-service.js`) tetap lulus. Diverifikasi lewat Chromium dengan `getLeaderboard` tiruan (12 baris, tanpa galat JS).

**`hadiah-misi`** — tampilan newgui `mission.html` dengan tiga tab: **HADIAH** (kartu login 7 hari), **MISI** (3 misi harian + bonus), dan **PENCAPAIAN** (15 achievement x 3 bintang, daftar bisa di-scroll); badge merah = jumlah yang siap diklaim. Semua tetap SERVER lewat `UT.WalletService`: `dailyGet/claimDaily` (hari WIB, nominal/item ditentukan server; duplikat skin/dadu dikonversi server) dan `questGet/questTrack('login')/questClaim/questClaimAll/questClaimBonus`; teks/ikon misi dari `UT.Quest.DEFS` (`quest-data.js`). Tanpa akun login halaman hanya menampilkan ajakan masuk (tanpa data tiruan; kunci `dragonroll:mission:demo` newgui tidak dipakai). Hero 3D ayam + peti 3D halaman lama dihapus (tidak ada di desain newgui; `three.min.js`/`floating-island.js` tidak dimuat lagi di halaman ini). Parameter `?tab=misi|daily` membuka Misi, selain itu Hadiah (default lama). CSS `assets/ng/css/mission.css`; aset baru di `misi/`, `ikon-item/` (kalender, pedang-silang, piala, gulungan-pena, koin-tumpuk, helm-sayap), `ikon-gem-medali/` (berlian-biru, kantong-koin), `glyph-putih/` (dadu, centang). **Pencapaian:** data asli dari `get_my_profile` (`UT.Multiplayer.Progress.getMyProfile`: counters/plays/wins/best_streak/claims; skin & emerald dari perangkat) dan klaim lewat `Progress.claimAchievement` (+ `PD.applyServerWallet`); data contoh newgui (6 achievement) dibuang. Definisi, target, nominal tampilan, dan rumus status dipindah ke berkas bersama `assets/js/achievement-data.js` (`UT.Achievement`, tes `tests/achievement-data.test.js`). **`profile.html` masih punya salinan sendiri (`ACH`, `REW`, `achInfo`)** — saat porting `profile`, pakai `UT.Achievement` supaya tidak ganda. `?tab=ach` membuka tab ini. Muat ulang tiap 30 dtk lewat `LiveSync` + saat tab aktif lagi. `misi.html` dan `dailyreward.html` lama tidak disentuh. Diverifikasi lewat Chromium dengan `WalletService` tiruan (klaim hari, klaim misi, pindah tab, tanpa galat JS).

**`profile`** — GUI baru newgui (tab Akun/Koleksi/Statistik; Pencapaian sudah di hadiah-misi). Data asli: `PlayerData` (nama, level/XP, skin/frame terpasang, koleksi dimiliki/total katalog) + server `get_my_profile` (ID, peringkat, menang/main/streak, misi selesai). Karakter tengah = `BlockyCharacter` 3D dari PlayerData di atas pedestal SVG (drag untuk putar, Aura ikut). Avatar = wajah skin + frame `FrameFX`. Ketuk ID = salin; ketuk Nama = ubah (hanya bila belum punya username). Tidak ada unggah foto (belum ada server), Riwayat dan Ubah-skin-di-profil dihapus (skin diatur di Karakter), Keluar akun hanya di Pengaturan. Dites jsdom (3 tab, 5 koleksi, 5 statistik, tanpa galat JS); belum dicek visual (posisi/ukuran karakter 3D, tampilan HP). sw v97.

**`splash`** — GUI baru newgui (gua + hero + bar loading, logo + TAP TO START, dialog Login dan Sign up). Logika asli dipertahankan: bar = progres byte nyata `UT_Preload.runAuto` (+ daftar aset penting), `PlayerData.snapshot()`, cek sesi `UT.Auth.check()`, login/daftar lewat `UT.Auth.signIn/signUp` (username + password; tidak ada email, Remember me, atau Lupa password karena tidak ada di server), `?next=` + `ut:booted`/`ut:fadein` untuk guard. Bila dialihkan guard di tengah sesi (`next` + booted) = mode cepat tanpa bar dan tanpa TAP. Intro logo studio + sfx dihapus. Diuji Chromium nyata dengan Supabase ditiru (loading, login salah, sign up, TAP TO START); login sungguhan ke server belum dicoba. sw v100.

### Pertanyaan terbuka untuk pemilik
1. **Quick Start `mode`:** setelah ketemu room -> masuk `room.html` sebagai tamu atau langsung gameplay? Bila tak ada room publik -> buat room baru atau pakai bot setelah waktu tunggu? Dihitung ranked (XP online hanya untuk room terverifikasi) atau tidak?
2. **Ambience/suara latar:** halaman newgui yang sudah dipasang tidak memuat `assets/js/ambience.js`. Apakah suara latar harus dikembalikan?

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

### Cara praktis yang dipakai di room & tambang
- Ambil skrip halaman lama apa adanya, lalu ganti hanya: markup, selektor id (`$('#xxx')`), dan fungsi render (HTML string). Jangan menulis ulang alur RPC/state. Cara paling aman: skrip kecil (Python) yang membaca skrip lama, memakai `replace` yang **gagal keras** bila pola tidak ditemukan tepat sekali, lalu merakit `head + markup + skrip`.
- Kanvas newgui 1920x1080 diskalakan dengan `fit()` (`transform: scale`). Wadah canvas/3D yang butuh ukuran sendiri jangan memakai id `#stage` (sudah dipakai kanvas utama).
- Modal memakai kelas `on` (bukan `show`). Elemen `[hidden]` butuh `[hidden]{display:none!important}` karena `.btn` memakai `display:grid`.
- Kelas ikon di dalam `.btn`: `.btn img` menimpa semua gambar (absolute, isi penuh). Untuk ikon kecil di dalam label pakai `.btn span img{position:static;...}`.
- Aset: salin dari `newgui/assets/komponen/` (sumber utama) ke `assets/ng/komponen/<subfolder>/`; path di CSS `url(../komponen/...)`. Jangan membuat panah/tombol sendiri.
- Uji asap tanpa browser: jalankan `python3 -m http.server`, buka halaman dengan jsdom (`runScripts:'dangerously'`, `resources:'usable'`, `?noframe=1`), stub `HTMLCanvasElement.getContext` dan `UT.MineService`/`RoomService` bila perlu, lalu cek jumlah elemen yang dirender dan galat. Galat WebGL/"navigation not implemented" di jsdom normal.
- Uji visual nyata tanpa browser pengguna: Playwright Chromium sudah ada (`chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})`), `page.addInitScript` untuk melewati splash (`sessionStorage ut:booted=1`, `localStorage ut-auth={id:'test-user-0001',username:'t'}`), lalu `?noframe=1` dan screenshot. Cocok untuk halaman WebGL (tambang, lobby).
- Push dari sesi AI: repo harus ada di scope sesi (proxy git menolak push dengan 403 bila belum). Token pribadi **jangan** ditulis di dokumen atau commit.

### Jebakan yang sudah ditemui
- Beberapa tes **membaca teks `lobby.html`** (mis. `tests/lobby-appearance.test.js`, `blocky-actions.test.js`, `aura-view.test.js`): urutan skrip, baris `PD.subscribe(r=>{if(r==='equip'...buildHero()...renderAvatar()...})`, `bc.tick(dt);lobbyStep(dt)`, `lobbyTap();buzz()`, `UT.AuraView.create(`. Ubah tes hanya bila maksudnya memang berubah, dan catat. Halaman lain (`profile`, `efek`, `leaderboard`, `karakter`, `gameplay`) juga dicek tes serupa.
- Tes yang membaca **teks `room.html`**: `tests/room-looks.test.js` (urutan skrip `player-data` -> `appearance-service` -> `app.js`; fungsi `avatar(p)`, `loadLooks`, `const CROWN=`; baris `renderPlayers();renderBottom();loadLooks();` dan `FACE_DONE=true;renderEq();renderPlayers();loadLooks();`) dan `tests/power-rules.test.js` (`pOk=id=>IC.powerOnMap(id,MAPKEY)`, `PW.equipped.filter(pOk)`, `.pc.dis{`, `Dilepas (tidak bisa di`, `i.kind==='powerup'&&!i.off`). `tests/mine-island.test.js` membaca `tambang.html` (`id="stage"`, `id="cv"`, `UT.MineIsland.create`, `isl.pick(`, `isl.select(`, `isl.setCrew(i,crewOf(s))`, `const crewOf=` satu baris). Jaga string-string ini tetap ada.
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

---

## Catatan 12 Nov 2026 — aset baru lobby & podium (sw v101)
- `assets/Images/background/lobby-bg.webp` diganti dengan latar kastil voxel baru (sumber: `referensi/newgui/assets/lobby.png`, 1713x918). Titik pijak karakter di `lobby.html` disesuaikan (`BG_W=1713,BG_H=918,FLOOR_Y=.80`).
- `leaderboard.html`: podium 3 teratas memakai satu gambar `assets/ng/komponen/leaderboard/podium-juara-voxel.webp` (sumber: `referensi/newgui/Podium Juara Voxel Berkilau.png`; avatar/nama contoh sudah dibuang). Avatar, nama, skor diposisikan di atas tiap pedestal lewat `.pd.p1/.p2/.p3` di `assets/ng/css/leaderboard.css`. `podium-1/2/3.webp` lama tidak dipakai lagi di halaman ini.

## Latar baru (branch ui-newgui) — loading, tap-to-start, lobby, peta Mode
Gambar sumber (jpg) diubah ke WebP; yang lama dihapus. Semua di `assets/Images/background/`:
- `splash-loading.webp` (1920x1072) — latar layar loading (naga menyembur api). Dipakai `assets/ng/css/splash.css` (`#cave`).
- `splash-portal.webp` (1920x1072) — latar TAP TO START (portal ungu), crossfade saat `body.ready`. Menggantikan `splash-portal.jpg` (dihapus).
- `lobby-bg.webp` (2752x1536) — latar lobby baru (kastil + panggung batu). Titik pijak karakter di `lobby.html`: `FLOOR_X=.50, FLOOR_Y=.79`.
- `map-world.webp`, `map-nether.webp` (900x1206) — ilustrasi kartu peta di `mode.html` (`META[...].img`, kelas `.mimg`). THE END (terkunci) tetap SVG.
Setelah mengganti gambar: `python3 tools/gen-preload-manifest.py`, naikkan `VERSION` di `sw.js` (sekarang `ut-pwa-v102`).

## Lobby: awan jauh saja (pelan) + lampu malam
- `lobby.html` memasang scene-bg dengan `data-clouds-set="far" data-cloud-slow="1.8" data-lights="lobby"`: hanya 2 awan kecil di kejauhan (awan besar/dekat dihapus), durasi melintas x1.8 (lebih lambat).
- `data-lights="lobby"` = set lampu di `assets/js/scene-bg.js` (`LIGHTSETS.lobby`, posisi = pecahan gambar `lobby-bg.webp`): 2 tungku batu bara (api bergoyang + cahaya lebar) dan 6 lentera di dinding kastil. Menyala hanya saat `html[data-ambience="night"]` (transisi 1,2 dtk), berkedip pelan; mati saat grafis "low"/reduced-motion. CSS di `assets/css/scene-bg.css` (`.sbg-light`).
- Halaman lain tidak berubah (default awan tetap 5). Tambah titik lampu = edit `LIGHTSETS`; sw `ut-pwa-v103`.
