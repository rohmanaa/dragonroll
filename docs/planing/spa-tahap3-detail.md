# SPA Tahap 3 - Migrasi Halaman Lain

Prasyarat: tahap 2 selesai dan terverifikasi di HP. Satu halaman = satu
rilis kecil: modul, route, test, SW, commit sendiri. Jangan memigrasikan dua
halaman sekaligus.

## 1. Resep per halaman (ulangi untuk tiap halaman)

1. **Inventaris halaman.** Daftar `<script>` di `<nama>.html`, CSS yang dimuat,
   global yang dipakai/diekspor, `location.href`, handler `pageshow`, timer,
   listener, `UT.Events.on`, `PD.subscribe`, WebGL (renderer sendiri?).
2. **Ekstrak templat.** Isi `<body>` khusus halaman → `view.html` (atau string
   modul). Skrip inline dipindah ke file (pola `tools/extract-inline.py`).
3. **Bungkus skrip** jadi `UT.PageModule.define('<nama>', body)` sesuai tahap 1
   (bayangan `setTimeout`/`rAF`/`addEventListener`, ganti `UT.Events.on`,
   `PD.subscribe`, `document.addEventListener`, observer; `env.dispose` untuk
   sisanya).
4. **WebGL:** ganti `new THREE.WebGLRenderer` dengan `UT.SharedGL.acquire`.
   Aturan sama seperti Lobby: bersihkan semua geometri/material/tekstur di
   `unmount`.
5. **Daftarkan route** di shell, ganti `location.href='<nama>.html'` dari halaman
   SPA lain dengan `UT.Router.go('<nama>')`.
6. **Pertahankan halaman mandiri** (`<nama>.html` tetap berfungsi, `managed=false`).
7. **Test:** perbarui test yang membaca skripnya; tambah satu tes cleanup bila ada
   perilaku khusus.
8. **Verifikasi:** smoke test headless (buka rute, pindah ke dan dari rute lain
   20x, tanpa error konsol), cek memori, cek HP.
9. **Rilis:** naikkan `VERSION` SW, regenerasi manifest, commit
   `feat(spa): migrasi <nama>`. Perbarui tabel status di bawah.

## 2. Urutan dan catatan per halaman

Jumlah `<script>` dan pemakaian three dari `*.html` saat ini.

### Gelombang A - memakai WebGL (manfaat terbesar)

| Halaman | Script | Catatan |
| --- | --- | --- |
| `profile.html` | 19 | Renderer sendiri di `assets/js/pages/profile.js` (baris ±53, `sizeGL`); ada tabel `BG` ukuran latar 1672/1893 |
| `efek.html` | 17 | `data/inventory/aura/_shared/js/efek.js`; aura-fx |
| `pet.html` | 25 | `pet-viewer.js` (renderer, DPR, `premultipliedAlpha`); punya test `pet-viewer-lifecycle` (gagal sejak baseline; periksa dulu) |
| `tambang.html` | 16 | `data/mining/js/tambang.js`; ukuran kanvas dihitung sendiri, `setPixelRatio(1)`; menerima `?from=` |
| `dadu.html` | 16 | Renderer dadu lewat `dice-kit`; kualitas via preset di `dice-catalog.js` |
| `powerup.html` | 13 | `power-3d/power-renderer.js`; preset di `power-config.js` |
| `leaderboard.html` | 16 | podium 3D (`podium-fx.js`) |
| `friendship.html` | 18 | cek penggunaan three |
| `efek`/`floatingsample` | 17 / 3 | `floatingsample.html` hanya contoh; boleh dibiarkan mandiri |

Renderer dadu dan power punya opsi `transparent`, `powerPreference`, dan skala
piksel sendiri; `SharedGL.acquire(owner, opts)` harus bisa menerimanya tanpa
membuat renderer baru (opsi yang tak bisa diubah sesudah dibuat, seperti
`antialias`, dicatat di dokumen keputusan).

### Gelombang B - tanpa WebGL (mudah)

`shop`, `mode`, `inventory`, `hadiah-misi`, `chest`, `mail`, `settings`, `room`,
`frame`.
Catatan: `chest` memakai `chest-service` dan teks `lobby.html`/`lobby.js` di
testnya; `settings` punya tes preferensi (`settings-prefs`); `room` memakai
`room-modal-bridge.js`.

### Tidak dimigrasikan di tahap ini

`gameplay.html` (47 script, `gameplay/js/main.js` 4000+ baris) dan `play.html`,
`splash.html`, `index.html`. Mereka tetap halaman penuh (`location.href`) dan
router menangani keluar-masuk dengan memuat halaman biasa. Keputusan memasukkan
gameplay ke SPA diambil terpisah (lihat `spa-tahap4-detail.md`).

## 3. Navigasi lintas halaman

- Satu peta rute tunggal (`UT.Router.register`) menggantikan peta `ACT` di
  `lobby.js` dan sejenisnya. Aksi yang belum dimigrasikan jatuh ke
  `location.href` (router punya `go('x.html')` untuk halaman penuh).
- Parameter yang sudah dipakai: `?from=karakter.html`, `?coin=1`. Terjemahkan ke
  parameter rute dan pertahankan perilaku tombol "kembali" ke halaman asal.

## 4. Status migrasi (perbarui tiap rilis)

| Halaman | Gelombang | Status | Commit | Catatan |
| --- | --- | --- | --- | --- |
| lobby | pilot | - | - | tahap 2 |
| karakter | pilot | - | - | tahap 2 |
| profile | A | Selesai (kode & test) | `66a65d7` | SW v297-v300; smoke browser LULUS; cleanup aura diperbaiki (`AuraView.clearAll`, v300); cek HP belum; UT.PageModule + UT.SharedGL |
| efek | A | Ditunda | - | efek/frame/dadu/powerup/pet = TAB di `inventory.html` (iframe `?embed=inv`, `inventory-bridge.js`); migrasikan bersama `inventory` sebagai satu keputusan desain |
| pet | A | - | - | |
| tambang | A | Selesai (kode & test) | (commit ini) | SW v301; PageModule + SharedGL; `?from=` dibaca dari `UT.Spa.current()`; LiveSync, pulau 3D, interval, listener dilepas saat unmount; renderer TIDAK di-dispose (bersama); smoke browser (MineService di-stub, 3D jalan) LULUS; cek HP belum |
| dadu | A | - | - | |
| powerup | A | - | - | |
| leaderboard | A | Selesai (kode & test) | (commit ini) | SW v298-v299; smoke browser (Chromium headless, 20 putaran) LULUS; tanpa renderer WebGL sendiri; PodiumFX.mount pindah ke leaderboard.js (+unmount); LiveSync dilepas saat unmount; cek HP belum |
| friendship | A | Selesai (kode & test) | (commit ini) | SW v302; PageModule (tanpa WebGL sendiri); memperbaiki bug lama `#home` (halaman mandiri melempar TypeError, daftar teman tidak pernah dimuat); smoke browser LULUS; cek HP belum |
| shop | B | Selesai (kode & test) | (commit ini) | SW v304; PageModule (tanpa WebGL); `?coin`/`?tab`/`?emerald` dibaca dari `UT.Spa.current()`; penjaga `window.__curSub` dihapus; smoke browser LULUS; cek HP belum |
| mode | B | Selesai (kode & test) | (commit ini) | SW v305; PageModule (tanpa WebGL); `#view` -> `#mapview` (bentrok dengan shell); `UT.RoomFlow` lewat `UT.Spa.go`; Presence dimulai `app.js` (blok module inline tidak jalan di shell); smoke browser LULUS; cek HP belum |
| inventory | B | - | - | |
| hadiah-misi | B | Selesai (kode & test) | (commit ini) | SW v306; PageModule (tanpa WebGL); `?tab=` dibaca dari `UT.Spa.current()`; `history.replaceState` dimatikan di shell; penjaga `window.__curSub` dihapus; LiveSync `wallet`+`ach` dilepas; smoke browser BELUM dijalankan (Chrome tidak tersedia di sesi ini); cek HP belum |
| chest | B | Selesai (kode & test) | (commit ini) | SW v307; PageModule (tanpa WebGL); listener klik dokumen lewat `env.on`; boot tidak menunggu event `load` di shell; LiveSync `wallet` dilepas; smoke browser BELUM dijalankan; cek HP belum |
| mail | B | Selesai (kode & test) | (commit ini) | SW v309; PageModule (tanpa WebGL); `?from=` dibaca dari `UT.Spa.current()`; polling 30 dtk + listener + langganan dilepas; smoke browser BELUM dijalankan; cek HP belum |
| settings | B | Selesai (kode & test) | (commit ini) | SW v310; PageModule (tanpa WebGL); tombol Fullscreen/Normal diperbaiki lewat `UT.Display`; versi game via `UT.Version.apply`; smoke browser BELUM dijalankan; cek HP belum |
| room | B | Selesai (kode, test, smoke) | (commit ini) | SW v312; PageModule (tanpa WebGL sendiri); parameter dibaca dari `UT.Spa.current().url`; spa-host memuat `<script type=module>` lewat `import()`; modul multiplayer dimuat `room.js`; smoke browser LULUS; cek HP belum |
| frame | B | - | - | |

## 5. Kriteria selesai tahap 3

- Semua halaman gelombang A dan B berjalan di bawah router dan renderer bersama.
- Tidak ada pembuatan `WebGLRenderer` di luar `SharedGL` (kecuali offscreen satu
  kali pakai yang didokumentasikan).
- Pindah antar halaman SPA tidak memuat ulang `three.min.js`.
- Seluruh test: tidak ada kegagalan baru dibanding baseline.
- Diverifikasi di HP.

## 6. Catatan verifikasi (profile + leaderboard)

Smoke browser: `CHROME=/path/ke/chrome N=20 python3 -I tools/smoke-spa-pages.py` (Lobby -> Profil -> Peringkat -> Tambang -> Teman -> Lobby x20; MineService di-stub supaya pulau 3D tambang benar-benar dirender).
Hasil (Chromium 153 headless, SwiftShader): 0 konteks WebGL baru, three.min.js 0x dimuat ulang, 0 error konsol, hanya lobby yang ter-mount
di akhir, tidak ada CSS/DOM/kelas `pf-wide` tersisa, tugas LiveSync `board` terlepas, Back kembali ke lobby, dan tombol Coin/Gem ke Shop/Tambang
(halaman non-view) tidak meninggalkan shell `play.html`. Memori JS 11.0 -> 17.2 MB setelah 60 pindah rute (tanpa GC paksa): belum bisa
dibedakan dari noise, ukur ulang di HP. Waktu mount lobby (~1,9 dtk) adalah render perangkat lunak (SwiftShader), bukan angka HP.
Temuan: tombol Coin/Gem Profil dan Peringkat tertutup panel kanan/`#board` (bug lama, juga di halaman mandiri) -> `.cur{z-index}` ditambahkan.
Belum: cek di HP fisik.

### Review kode `spa-tahap3` (2026-11-20)

- Hasil: profile sesuai resep (PageModule, SharedGL, cleanup, route, halaman mandiri tetap jalan). Test Node: 84 lulus, 5 gagal = baseline lama (tanpa regresi baru).
- Diperbaiki (SW v300): `profile.js` memanggil `R.aura.dispose()` / `R.ch.dispose()` yang tidak ada di `AuraView` / `BlockyCharacter` (tidak pernah jalan). Sekarang `R.aura.clearAll()` dipanggil sebelum geometri scene dibuang; tes `profile-module` menjaganya.
- Branch `spa-tahap3` tertinggal dari `main` (sudah di-merge ke `main`); pekerjaan lanjutan dikerjakan dari `main`.
- Masih terbuka: cek HP fisik, ukur ulang memori di HP (11,0 -> 17,2 MB di headless belum bisa dibedakan dari noise).

### Tambang (tahap 3-3, SW v301)

- `data/mining/js/tambang.js` dibungkus `UT.PageModule.define('tambang')`; `tambang.html` memuat `shared-gl.js` + `page-module.js` sebelum controller. Route: `spa-host.js` (VIEWS), `frame-guard.js`, prefetch di `play.js`.
- Renderer: `UT.SharedGL.acquire('tambang', {canvas: #cv, shadows:false})`; cleanup memanggil `SharedGL.release` dan `isl.dispose()` (kini membuang tekstur juga) - TIDAK memanggil `renderer.dispose()` (dulu di `pagehide`; berbahaya karena renderer dipakai bersama).
- Dibuang saat unmount: 2 `setInterval`, rAF, `resize`/`pagehide`/`visibilitychange`, langganan `PD.subscribe` (penjaga `window.__curSub` dihapus: akan membuat langganan tidak terpasang pada kunjungan kedua), LiveSync (`wallet` + `stop`).
- `?from=`: di shell `location.search` milik `play.html`, jadi dibaca dari URL rute aktif (`UT.Spa.current().url`). Back dari tambang ke Profil terverifikasi.
- Callback async (`load`, `act`, `loop`) dijaga `env.disposed` agar tidak menyentuh DOM halaman berikutnya.
- Hasil smoke (Chromium headless, SwiftShader, 20 putaran, 4 view): 0 konteks WebGL baru, three.min.js 0x dimuat ulang, 0 error konsol, memori 13,6 -> 11,7 MB, kanvas `#cv` dan CSS/DOM tambang tidak tersisa, tugas LiveSync `mine`/`wallet` milik lobby tetap berjalan.
- Test Node baru: `tests/tambang-module.test.js` (10 tes). `spa-host.test.js` diperluas. Test lama (`mine-island`, `mine-service`, `live-sync`) tetap lulus.
- Belum: cek HP fisik; ukur memori di HP.
- Urutan berikutnya: efek/frame/dadu/powerup/pet = tab di `inventory.html` (ditunda, lihat tabel); `friendship` (Gelombang A), lalu Gelombang B.

### Friendship (tahap 3-4, SW v302)

- **Bug lama ditemukan dan diperbaiki:** `friendship-page.js` memanggil `$('#home').addEventListener(...)`, padahal `#home` dihapus dari `friendship.html` (commit `bd12764`). Akibatnya TypeError, dan semua baris sesudahnya TIDAK pernah jalan: `load()`, tombol Coin/Gem, dialog, aksi daftar, langganan dompet, LiveSync. Terverifikasi di browser pada `main` sebelum perbaikan (daftar kosong + `pageerror`); sesudahnya 0 error. Sekarang `#home` dijaga (`if (homeBtn)`), dan tes `friendship-module` menjaganya.
- Halaman ini tidak membuat `WebGLRenderer` sendiri (avatar lewat `UT.CharacterFace`), jadi tidak memakai `SharedGL`; hanya `UT.PageModule`.
- Dilepas saat unmount: `setInterval` 20 dtk, timer retry/toast, `resize`/`keydown`/`visibilitychange`, langganan `PD.subscribe` + `Events.on` + `Presence.onChange`, LiveSync (`wallet` + `stop`). Presence global sengaja TIDAK dihentikan (lobby/room memakainya).
- `render`/`toast`/`renderCurrency`/`loadData` dijaga `env.disposed` karena DOM view sudah dibuang saat callback async selesai.
- Navigasi: semua lewat `nav()` -> `UT.Spa.go` (Back ke lobby, Gem ke tambang `?from=friendship.html`, Coin ke shop, ajak main ke `room.html?...invite=`). Back dari tambang kembali ke friendship terverifikasi.
- Hasil smoke (Chromium headless, 20 putaran, 5 view): 0 konteks WebGL baru, three.min.js 0x dimuat ulang, 0 error konsol, memori 12,8 -> 11,8 MB, tombol Back/Gem/Coin bisa diketuk.
- Belum: uji alur teman dengan akun server sungguhan (smoke memakai login palsu, jadi daftar teman, Presence, dan tombol MAIN/TERIMA tidak teruji); cek HP fisik.
- Urutan berikutnya: Gelombang B (shop, mode, inventory, hadiah-misi, chest, mail, settings, room, frame); inventory bersama efek/pet/dadu/powerup/frame sebagai satu keputusan desain.

### Popup undangan teman (SW v303)

- `assets/js/multiplayer/presence.js`: tombol GABUNG/TOLAK pada popup undangan sebelumnya memakai gradien CSS; kini memakai aset `tombol-hijau-polos.webp` / `tombol-merah-polos.webp` (gaya inline karena popup muncul di halaman tanpa `page.css`). Drawer "Undang Teman" di `room.html` sudah memakai aset gambar sejak awal.
- GABUNG kini pindah lewat `UT.Spa.go` bila ada shell (sebelumnya `location.href` meninggalkan `play.html`); fallback `location.href` untuk halaman biasa/iframe.
- Tes: `tests/presence-invite-ui.test.js`. Diverifikasi di browser (harness dengan Presence di-stub): kedua gambar termuat, GABUNG memanggil `UT.Spa.go('room.html?...&code=...')`.

### Shop (tahap 3-5, Gelombang B, SW v304)

- `assets/js/pages/shop-page.js` dibungkus `UT.PageModule.define('shop')`; `shop.html` memuat `page-module.js` sebelum skrip halaman. Route: `spa-host.js` (VIEWS) dan `frame-guard.js`; prefetch `shop.html` di `play.js` sudah ada.
- Tanpa WebGL sendiri, jadi tidak memakai `SharedGL`.
- Parameter `?coin=1`, `?tab=`, `?emerald` dibaca dari URL rute aktif (`UT.Spa.current().url`) karena `location.search` di shell milik `play.html`.
- Navigasi (Back, tombol `data-go` di modal) lewat `nav()` -> `UT.Spa.go`; `location.href` hanya fallback halaman mandiri.
- Dilepas saat unmount: timer modal/toast, `resize`/`keydown`, langganan `PD.subscribe` + `Events.on`, LiveSync (`wallet` + `stop`). Penjaga `window.__curSub` dihapus (akan membuat langganan tidak terpasang pada kunjungan kedua).
- Callback async (riwayat, tukar Coin, beli chest, `wallet.refresh`) dijaga `env.disposed`.
- `tests/spa-host.test.js`: contoh halaman non-view diganti dari `shop.html` ke `mode.html` (shop kini view). Test baru `tests/shop-module.test.js` (9 tes). Seluruh test: sama dengan baseline (5 gagal lama).
- `tools/smoke-spa-pages.py` mencakup shop: tombol Coin dari profile/leaderboard/tambang/friendship membuka tab Coin di view (shell tetap), `?emerald` membuka modal, Riwayat, Back ke lobby, tanpa sisa DOM/CSS/kelas. Batas tunggu "bisa diketuk" dinaikkan 4 -> 12 dtk (render perangkat lunak lambat; `tambang#cur-em` sebelumnya gagal karena waktu, bukan overlap).
- Hasil smoke (Chromium headless, 20 putaran, 6 view): 0 konteks WebGL baru, three.min.js 0x dimuat ulang, 0 error konsol, memori 10,6 -> 11,8 MB, mount shop ~26 ms.
- Belum: transaksi sungguhan (tukar Coin, beli chest, riwayat) dengan akun server; cek HP fisik.
- Urutan berikutnya: `mode`, `hadiah-misi`, `chest`, `mail`, `settings`, `room`, `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Mode (tahap 3-6, Gelombang B, SW v305)

- `assets/js/pages/mode.js` dibungkus `UT.PageModule.define('mode')`; `mode.html` memuat `page-module.js` sebelum skrip halaman. Route: `spa-host.js` (VIEWS) dan `frame-guard.js`; prefetch `mode.html` di `play.js` sudah ada. Tanpa WebGL sendiri (peta = gambar/SVG), jadi tidak memakai `SharedGL`.
- **Bentrok id (temuan):** `mode.html` punya `<div id="view">` (area geser peta) padahal `play.html` sudah punya `#view` (wadah view shell). `document.querySelector('#view')` di mode.js akan menangkap wadah shell: geser di mana pun di halaman mengganti peta, dan CSS `#view{...}` ikut menata wadah shell. Diganti `#mapview` (HTML, CSS, JS); tes `mode-module` menjaganya. **Aturan untuk halaman berikutnya: jangan ada `id="view"`, `id="f"`, `id="ov"` di halaman yang di-view-kan.**
- **`UT.RoomFlow` lewat shell (temuan):** `navigate`/`launch`/`exitGame` memakai `location.href`; di view itu memuat ulang seluruh `play.html`. Kini lewat `go(url)`: `UT.Spa.go` bila ada (shell), `location.href` bila tidak (halaman mandiri; juga di dalam iframe, karena `UT.Spa` hanya ada di window shell). `launch` menyetel `ut:nav-heavy` SEBELUM pindah; hook `leave` di `play.js` kini membaca flag itu dan memakai overlay `now` (tirai awan seketika) untuk gameplay yang diluncurkan dari view. Tes baru `tests/room-flow-spa.test.js` (6 tes, `vm` dengan `UT.Spa` ada/tidak ada).
- **Presence:** blok `<script type="module">` inline di `mode.html` (memulai Presence `status:'lobby'`) TIDAK dijalankan host SPA (hanya `script[src]` yang dimuat). `'mode'` ditambahkan ke daftar halaman di `app.js` yang memulai Presence (`start()` idempoten, jadi halaman mandiri yang memulainya dua kali aman). Blok module dibiarkan agar halaman mandiri tidak berubah.
- Navigasi: Back -> lobby, Coin -> `shop.html?coin=1`, Gem -> `tambang.html?from=mode.html` (Back dari tambang kembali ke mode, terverifikasi), pilih room -> `room.html?...` (non-view, tetap di shell). Fade 330 ms hanya untuk halaman mandiri; di shell `nav()` langsung jalan karena view langsung dilepas.
- Dilepas saat unmount: simulasi Quick Start (timer `tm`), timer toast, `pointerup`/`keydown`/`resize`/`pageshow` (window), `pointerdown` (document, lewat `env.on`), langganan `PD.subscribe` + `Events.on`, LiveSync (`wallet` + `stop`).
- Test: `tests/mode-module.test.js` (12 tes), `tests/room-flow-spa.test.js` (6 tes); `tests/spa-host.test.js` memakai `room.html` sebagai contoh halaman non-view (mode kini view). Seluruh test: sama dengan baseline (5 gagal `.test.js` lama + 2 `.test.mjs` yang juga gagal sebelum perubahan).
- Smoke (`CHROME=... N=20 python3 -I tools/smoke-spa-pages.py`, Chromium 157 headless, SwiftShader, 7 view): LULUS. 0 konteks WebGL baru, three.min.js 0x dimuat ulang, 0 error konsol, memori 11,0 -> 11,9 MB, mount mode ~31 ms (maks 59). Blok mode di smoke memeriksa: `#view` tunggal, 3 peta/3 titik/5 tile/12 opsi; panah (WORLD -> NETHER -> THE END terkunci + toast -> WORLD); geser di peta mengganti peta, geser DI LUAR peta tidak; satu tile terbuka sekaligus, Escape menutup; Quick Start membuka modal dan BATAL menutupnya; Quick Start Team sampai "LAWAN DITEMUKAN" dan `game:start` (dicegat) membawa konfigurasi benar (ranked, team, 4 pemain, map); Coin -> Toko tab coin (view), Gem -> Tambang `?from=mode.html` dan Back kembali ke mode, Back -> lobby; VS Computer -> `room.html?mode=vsc&format=solo&count=2` di iframe dan shell tidak ditinggalkan; tidak ada sisa DOM/CSS/kelas `dm`.
- Belum: cek HP fisik (dan jalur HP portrait yang tetap iframe); peluncuran gameplay sungguhan dari Quick Start di browser (smoke mencegat `game:start`; rute `UT.Spa.go('gameplay.html?...')` + overlay `now` hanya diuji unit/statis); Presence dengan sesi server sungguhan (smoke memakai login palsu tanpa jaringan).
- Urutan berikutnya: `hadiah-misi`, `chest`, `mail`, `settings`, `room` (memakai `room-modal-bridge.js`; `RoomFlow` sudah siap lewat shell), `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Hadiah-misi (tahap 3-7, Gelombang B, SW v306)

- `assets/js/pages/hadiah-misi.js` dibungkus `UT.PageModule.define('hadiah-misi')`; `hadiah-misi.html` memuat `page-module.js` sebelum skrip halaman. Route: `spa-host.js` (VIEWS), `frame-guard.js`, prefetch `hadiah-misi.html` -> lobby di `play.js`. Tanpa WebGL sendiri, jadi tidak memakai `SharedGL`. Efek partikel hadiah (`UT.ParticleFX`) tetap dari `particle-fx.js` yang dimuat host.
- `?tab=misi|ach` dibaca dari URL rute aktif (`UT.Spa.current().url`), bukan `location.search` milik `play.html`.
- **`history.replaceState('?tab=')` dimatikan di shell** (di shell URL milik `play.html?go=...`; mengubahnya merusak reload). Halaman mandiri dan iframe tetap memakainya.
- Navigasi (Back, Gem -> `tambang.html?from=hadiah-misi.html`, Coin -> `shop.html?coin=1`) lewat `nav()` -> `UT.Spa.go` di shell; fade 330 ms + `location.href` hanya fallback mandiri.
- Dilepas saat unmount: `setInterval` hitung mundur reset (1 dtk), timer toast, `resize`/`keydown`/`visibilitychange`, langganan `PD.subscribe` + `Events.on` (penjaga `window.__curSub` dihapus), LiveSync (`wallet` + `ach`, lalu `stop`).
- Callback async (`reloadD`, `claimDay`, `reloadQ`, `srvClaim`, `loadSP`, `claimAch`, `wallet.refresh`) dijaga `env.disposed`.
- Test: `tests/hadiah-misi-module.test.js` (11 tes); `tests/spa-host.test.js` diperluas; pola regex `frame-guard` di `tests/mode-module.test.js` dilonggarkan (daftar halaman bertambah). Seluruh test: sama dengan baseline (5 gagal lama).
- `tools/smoke-spa-pages.py` kini ikut memutar `hadiah-misi` (pemanasan, 20 putaran, tombol bisa diketuk, `mounted_akhir`), tetapi **belum dijalankan** (tidak ada Chrome/Chromium di sesi ini). Jalankan di mesin dengan Chrome: `CHROME=... N=20 python3 -I tools/smoke-spa-pages.py`.
- Belum: smoke browser; klaim sungguhan (hadiah harian, misi, pencapaian) dengan akun server; cek HP fisik. Blok smoke khusus hadiah-misi (tab, klaim, Back/Gem/Coin) belum ditulis.
- Urutan berikutnya: `chest`, `mail`, `settings`, `room` (memakai `room-modal-bridge.js`), `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Chest (tahap 3-8, Gelombang B, SW v307)

- `assets/js/pages/chest.js` dibungkus `UT.PageModule.define('chest')`; `chest.html` memuat `page-module.js` sebelum skrip halaman. Route: `spa-host.js`, `frame-guard.js`, prefetch `chest.html` -> lobby di `play.js`. Tanpa WebGL sendiri.
- **Listener global:** `document.addEventListener('click')` (delegasi tombol CLAIM/BUKA/CEPAT/AMBIL) dan `visibilitychange` kini lewat `env.on(document, ...)`; kalau tidak, tiap kunjungan menambah handler klik dan satu klik memicu aksi server berkali-kali.
- **Boot di shell:** versi lama menunggu `window 'load'` bila server belum siap; di shell dokumen sudah `load` sehingga event itu tidak datang lagi. Kini `document.readyState==='complete'` menjalankan boot langsung.
- Navigasi (Back, Gem -> `tambang.html?from=chest.html`, Coin -> `shop.html?coin=1`) lewat `nav()` -> `UT.Spa.go` di shell; fade + `location.href` hanya fallback mandiri.
- Dilepas saat unmount: ticker 1 dtk, timer toast, `resize`/`pageshow`/klik/`visibilitychange`, langganan `PD.subscribe` + `Events.on` (penjaga `window.__curSub` dihapus), LiveSync (`wallet` + `stop`). Callback async (`reload`, `act`) dan `render`/`modal`/`toast` dijaga `env.disposed`.
- Test: `tests/chest-module.test.js` (10 tes); `chest-service.test.js` tetap lulus; `spa-host.test.js` diperluas. Seluruh test sama dengan baseline (5 gagal lama).
- `tools/smoke-spa-pages.py` ikut memutar `chest` tetapi BELUM dijalankan (tidak ada Chrome di sesi ini). Belum: aksi chest sungguhan (BUKA, CEPAT, AMBIL) dengan akun server; cek HP fisik.
- Urutan berikutnya: `mail`, `settings`, `room` (memakai `room-modal-bridge.js`), `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Mail (tahap 3-9, Gelombang B, SW v309)

- `assets/js/pages/mail.js` dibungkus `UT.PageModule.define('mail')`; `mail.html` memuat `page-module.js` sebelum skrip halaman. Route: `spa-host.js`, `frame-guard.js`, prefetch `mail.html` -> lobby di `play.js`. Tanpa WebGL sendiri.
- `?from=` (tujuan tombol Back; lobby memakai `mail.html?from=lobby.html`) dibaca dari URL rute aktif (`UT.Spa.current().url`), bukan `location.search` milik `play.html`. Daftar `BUILT` tetap menjadi daftar putih tujuan.
- Navigasi (Back, Home, Gem -> `tambang.html?from=mail.html`, Coin -> `shop.html?coin=1`) lewat `nav()` -> `UT.Spa.go` di shell; fade + `location.href` hanya fallback mandiri.
- Dilepas saat unmount: polling `setInterval` 30 dtk, timer toast, `resize`/`keydown`/`visibilitychange`, langganan `PD.subscribe` + `Events.on` (penjaga `window.__curSub` dihapus). Halaman ini tidak memakai LiveSync.
- Callback async (`load`, `claim`, `remove`, `readAll`, `claimAll`, `wallet.refresh`) dijaga `env.disposed`.
- Test: `tests/mail-module.test.js` (8 tes); `spa-host.test.js` diperluas; pola `frame-guard` di `chest-module.test.js` dilonggarkan. Seluruh test sama dengan baseline (5 gagal lama).
- `tools/smoke-spa-pages.py` ikut memutar `mail` tetapi BELUM dijalankan (tidak ada Chrome di sesi ini). Belum: klaim/hapus surat sungguhan dengan akun server; cek HP fisik.
- Urutan berikutnya: `settings` (tes `settings-prefs`; ingat panggil `UT.Version.apply(root)` saat mount agar versi game tampil), `room` (memakai `room-modal-bridge.js`), `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Settings + perbaikan Fullscreen/Normal (tahap 3-10, Gelombang B, SW v310)

- **Akar masalah tombol Fullscreen/Normal:** `settings-electron.js` (satu-satunya kode yang memasang handler `[data-display]`) TIDAK pernah dimuat di `settings.html`, sehingga tombol tidak berbuat apa-apa; di web/PWA memang belum ada implementasi sama sekali (hanya jalur Electron). File itu dihapus dan diganti `assets/js/core/display-mode.js` (`UT.Display`): Electron lewat `electronAPI.setFullscreen/getFullscreen` (preload + `main.js` tidak berubah), web/PWA lewat Fullscreen API pada dokumen paling atas (shell `play.html`; iframe punya `allow="fullscreen"`). Status disinkronkan lewat `fullscreenchange`/`resize` (mis. tombol Esc). Tidak didukung (iPhone Safari): tombol dinonaktifkan dan toast menjelaskan. Masuk fullscreen di web wajib gestur pengguna, jadi mode tidak dipulihkan otomatis saat game dibuka lagi (Electron selalu mulai fullscreen, sesuai `main.js`). Gaya tombol aktif memakai `.on` (sama dengan segmen Grafik) plus `.active`.
- `assets/js/pages/settings.js` dibungkus `UT.PageModule.define('settings')`; `settings.html` memuat `display-mode.js` dan `page-module.js` sebelum skrip halaman. Route: `spa-host.js`, `frame-guard.js`, prefetch `settings.html` -> lobby di `play.js`.
- Back/Escape: di shell memakai `?from=` (daftar putih nama halaman) dari URL rute aktif, bila tidak ada ke lobby (`document.referrer` di shell selalu `play.html`). Halaman mandiri tetap memakai referrer. Keluar akun tetap `location.replace('splash.html')` (di shell menggantikan seluruh `play.html`, memang diinginkan).
- Dilepas saat unmount: `resize`/`keydown`, timer toast, langganan `Ambience.on`, `Prefs.on`, dan `UT.Display.on`. Versi game (`[data-app-version]`) diisi ulang tiap mount lewat `UT.Version.apply(document)`.
- Test: `tests/display-mode.test.js` (10 tes: web, iframe -> dokumen atas, ditolak, tidak didukung, PWA fullscreen, on/off, Electron, wiring settings); `settings-prefs.test.js` tetap lulus; `spa-host.test.js` diperluas. Seluruh test sama dengan baseline (5 gagal lama).
- Belum: uji tombol di browser nyata (Chrome desktop, Android Chrome, PWA terpasang) dan di Electron sungguhan; smoke browser; cek HP. Catatan: saat PWA terpasang memakai `display_override: fullscreen` (manifest), `exitFullscreen` tidak berlaku; tombol Normal tidak akan mengubah apa pun di mode itu.
- Urutan berikutnya: `room` (memakai `room-modal-bridge.js`), `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Room (tahap 3-11, Gelombang B, SW v312)

- `assets/js/pages/room.js` dibungkus `UT.PageModule.define('room')`; `room.html` memuat `page-module.js` sebelum skrip halaman. Route: `spa-host.js` (VIEWS), `frame-guard.js`; prefetch `room.html` -> gameplay/mode di `play.js` sudah ada. Tanpa WebGL sendiri (kepala karakter lewat `UT.CharacterFace`, memakai three bersama), jadi tidak memakai `SharedGL`.
- **spa-host kini mendukung `<script type="module" src>`** (dimuat lewat `import()` relatif ke dokumen; dedupe per URL) dan tidak mengunduh ulang skrip yang sudah ada di dokumen (`inDoc`). Dipakai `room-dice-art.js` (import dice-kit). Blok `<script type=module>` INLINE tetap tidak dijalankan host.
- **Modul multiplayer:** blok inline di `room.html` (import `room-service.js` + `presence.js`, lalu event `ut:multiplayer-ready`) tidak jalan di shell. `room.js` memuatnya sendiri lewat `import('../multiplayer/room-service.js')` bila `UT.Multiplayer.RoomService` belum ada; flag `started` mencegah setup ganda dengan event mandiri.
- **Parameter room** (`?mode=&format=&count=&role=&code=&invite=`) dibaca dari URL rute aktif. Mode tak valid -> `UT.Spa.go('mode.html',{replace:true})` (fallback `location.replace`).
- **Tautan undangan/tamu** memakai `roomUrl()` (`.../room.html`): di shell `location.pathname` = `play.html`, jadi tautan lama akan salah.
- **`loadFace`** tidak lagi memuat ulang `three.min.js`/`blocky-character.js`/`character-face.js` bila sudah ada di dokumen (di shell three sudah dimuat Lobby).
- Dilepas saat unmount: langganan realtime room (`unsub`, juga dipakai `leave`), `Presence.onChange`, `Events.on('inventoryChanged')`, `CharacterFace.watch`, LiveSync (`wallet` + `stop`), kelas html `dro` dan `mp-online`, timer, `resize`/`keydown`/`message`/`pagehide`. `setupOnline` berhenti bila halaman ditinggalkan saat menunggu server (setelah `ensurePlayer` dan `createRoom/joinRoom`); `toast` dijaga `env.disposed`.
- Modal bersarang `#pageModal` (Dadu/Karakter/Frame/Efek/Power-up `?from=room`) tetap iframe bersarang (bukan view; `canView` menolak `from=room`).
- Test: `tests/room-module.test.js` (15 tes); `tests/spa-host.test.js` dan `display-mode.test.js` disesuaikan (non-view contoh: `inventory.html`). Seluruh test: sama dengan baseline.
- Smoke (`tools/smoke-spa-pages.py`, Chromium headless, SwiftShader, N=20, 12 view): LULUS. 0 konteks WebGL baru, three.min.js 0x dimuat ulang, 0 error konsol. Blok room: view di shell, 2 pemain (Kamu + Bot), 4 slot equipment, 5 slot Power, modal Power/Dadu terbuka dan tertutup dengan Escape, START -> `game:start` (type room, mode vsc, 2 pemain), Back -> mode, KELUAR -> lobby, tanpa sisa DOM/CSS/kelas; mode online: `UT.Multiplayer.RoomService`/`Presence` dimuat di shell, kelas `mp-online` dilepas. Heap setelah GC paksa, 25 putaran room<->lobby: 9,6 -> 9,8 MB (tanpa kebocoran; mail 8,3 -> 9,2 MB sebagai pembanding).
- Belum: setup room online dengan akun/server sungguhan (create/join, realtime, Ready/Start, undangan Presence); cek HP fisik.
- Urutan berikutnya: `frame`; lalu `inventory` bersama efek/pet/dadu/powerup.

### Perbaikan: tombol modal Totem masih CSS (SW v311)

- **Gejala:** saat memakai Totem, modal "Pakai Totem?" menampilkan tombol "Pakai Totem" sebagai gradasi hijau CSS, bukan aset gambar.
- **Penyebab:** `gameplay/css/hud-mockup.css` punya `.tm-bt .tm-y { background: linear-gradient(...) !important }` (spesifisitas 0,2,0) yang mengalahkan `.tm-bt button { background: url(tombol-hijau-polos.webp) !important }` (0,1,1) di bawahnya. Tombol "Tidak" (`.tm-n`) sudah benar karena punya aturan `background-image: url(...)` sendiri.
- **Perbaikan:** aturan gradasi dihapus; `.tm-bt .tm-y` kini `background-image: url(tombol-hijau-polos.webp) !important` (Pakai = hijau, Tidak = biru, tidak diubah).
- **Tes:** `tests/totem-buttons-assets.test.js` (4 tes; terbukti gagal pada CSS lama) menjaga tidak ada gradasi `!important` pada `.tm-y`/`.tm-n` dan aset gambar ada.
- **Belum:** verifikasi visual di browser (tidak ada Chrome di sesi ini); modal Totem pada layar tamu online memakai kode yang sama (`totemModal`), tetapi belum dicek. Aturan tema di `gameplay-overrides.css` (baris 112-113) dan warna dasar `gameplay.css` tetap ada sebagai cadangan, tertimpa `hud-mockup.css`.
