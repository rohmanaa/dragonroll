# Peta Folder

Ringkasan isi folder dan fitur yang menggunakannya. Path ditulis sesuai nama di Git.

## assets/
- `assets/audio/music/` — musik halaman dan gameplay; nama lama: `assets/music/`.
- `assets/audio/sfx/` — efek suara `board/`, `dice/`, `dragon/`, `mob/`, `pet/`, `powerup/`, `reward/`, `ui/`, dan `win/`; nama lama: `assets/sfx/` dan `assets/new sound/`.
- `src/components/` — komponen UI reusable; dipakai: `ui-core.js`, `button/` (preload; termasuk gaya glossy `.ut-gl .ut-c-*`), `tabs/` (tab atas/segmented/underline gaya Guild, `preview.html` untuk lihat semua; dipakai Tambang); belum dipakai: `badge/`, `card/`, `currency/`, `modal/`, `toast/`, `theme/` (dulu `hud/`).
- `assets/css/base/` — reset dan aturan dasar semua halaman.
- `assets/css/components/` — gaya komponen bersama.
- `assets/css/pages/` — gaya khusus halaman; tiga file `*-legacy.css` berasal dari `legacy-pages/`.
- `assets/css/utilities/` — kelas gaya utilitas bersama.
- `assets/fonts/` — font lokal untuk halaman aplikasi.
- `assets/icons/` — ikon bersama yang bukan ikon gambar halaman.
- `assets/images/background/` — latar halaman seperti lobby, profil, dan toko; `clouds/` berisi tekstur awan.
- `assets/images/buttons/` — tekstur tombol dan kontrol; nama lama: `assets/images/tombol/`.
- `assets/images/effects/` — tekstur efek visual dan kabut.
- `assets/images/icon/` — ikon halaman dalam kategori `audio/`, `currency/`, `emblem/`, `items/`, `lobby/`, `mode/`, `profile/`, `rank/`, `tabler/`, dan `ui/`; `lobby/chest.webp` dahulu `invenotry.webp`, `mode/calendar.webp` dahulu `calndar.webp`, dan `mode/mode-khusus.webp` dahulu `modekhsusus.webp`.
- `assets/images/ui/` — gambar UI bersama; juga memuat `assets/ng/komponen/` yang digabung ke sini.
- `assets/images/ui/achievement/` dan `leaderboard/` — ikon pencapaian, podium, dan papan peringkat.
- `assets/images/ui/banner-label/` — banner judul, hasil, dan boss untuk gameplay.
- `assets/images/ui/buttons-and-controls/` — gambar tombol dan kontrol gameplay; nama lama: `tombol-dan-kontrol/`.
- `assets/images/ui/character-portraits/` — potret karakter untuk UI.
- `assets/images/ui/chest-packs/` — gambar paket peti pada toko.
- `assets/images/ui/feature-icons/` dan `mode/` — ikon mode dan fitur; nama lama `new-icon/` dan `freinds.webp`.
- `assets/images/ui/gem-medal-icons/` — ikon gem dan medali; nama lama: `ikon-gem-medali/`.
- `assets/images/ui/gold-packs/` — gambar paket koin emas pada toko.
- `assets/images/ui/hud/` — gambar panel status dan tombol HUD gameplay.
- `assets/images/ui/item-icons/` — ikon item untuk gameplay dan katalog.
- `assets/images/ui/language-flags/`, `navigation-icons/`, dan `settings-icons/` — bendera, navigasi, dan ikon pengaturan.
- `assets/images/ui/lobby/`, `logo/`, dan `menu-pause/` — dekorasi lobby, logo/pemuatan, dan panel jeda.
- `assets/images/ui/missions/` — ikon dan panel misi.
- `assets/images/ui/panel-dialog/`, `slot-equipment/`, dan `stage-chapter/` — dialog, slot perlengkapan Power, serta ikon chapter gameplay.
- `assets/images/ui/white-glyphs/` — glyph putih untuk HUD dan tombol; nama lama: `glyph-putih/`.
- `src/core/` — utilitas inti aplikasi.
- `src/data/` — data statis untuk halaman.
- `src/multiplayer/` — layanan dan UI multiplayer.
- `src/views/` — skrip halaman aplikasi.
- `src/renderers/` — `dice-kit/` untuk dadu dan `power-3d/` untuk efek Power 3D; dahulu `power3d/`.
- `src/services/` — layanan aplikasi dan integrasi data.
- `src/systems/` — sistem UI dan gameplay bersama.
- `src/systems/game-dialog.js` + `assets/css/components/game-dialog.css` — dialog bergaya game (bingkai, header, X bulat, tombol polos) yang dipakai bersama; modal Unduh Data dan Ketentuan Layanan memakainya.
- `src/systems/update-service.js` — cek/unduh/restart pembaruan dengan konfirmasi pemain (hanya dari Lobby); `src/services/tos-service.js` — persetujuan Ketentuan Layanan/Privasi (server untuk akun, localStorage untuk tamu); halaman isinya `tos.html`.
- `src/vendor/` — pustaka pihak ketiga; `three-addons/` berisi add-on Three.js, nama upstream dipertahankan.

## data/
- `data/inventory/<kategori>/` — kategori item pemain: `aura/`, `character/`, `dice/`, `frame/`, `pet/`, dan `power/`. Item berada di folder gameKey/ID; kode dan gaya kategori bersama berada di `_shared/`.
- `data/inventory/pet/items/<gameKey>/` — manifest, model, gambar, dan SFX khusus Pet.
- Manifest item inventori berada di `data/inventory/<kategori>/<item>/` dan dipertahankan tetap.
- `data/frame/*.webp` — gambar frame yang path-nya dipertahankan karena dirujuk katalog/DB.
- `data/power/3d/` dan `data/power/power-fx.js` — aset dan efek Power yang path-nya dipertahankan karena dirujuk katalog/DB atau gameplay.
- `data/lobby/` — data dan fungsi khusus halaman Lobby; fitur/halaman tetap di bawah `data/`, bukan `data/inventory/`.
- `data/mining/` — data serta halaman Tambang; nama lama: `data/tambang/`; fitur/halaman tetap di bawah `data/`, bukan `data/inventory/`.
- `data/` hanya menampung kode/aset per fitur atau halaman, bukan kategori item pemain.

referensi/ = mockup, tidak dipakai aplikasi, jangan diubah


