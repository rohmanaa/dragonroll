# Peta Folder

Ringkasan isi folder dan fitur yang menggunakannya. Path ditulis sesuai nama di Git.

## assets/
- `assets/audio/music/` — musik halaman dan gameplay; nama lama: `assets/music/`.
- `assets/audio/sfx/` — efek suara `board/`, `dice/`, `dragon/`, `mob/`, `pet/`, `powerup/`, `reward/`, `ui/`, dan `win/`; nama lama: `assets/sfx/` dan `assets/new sound/`.
- `assets/components/` — komponen UI reusable; dipakai: `ui-core.js`, `button/` (preload); belum dipakai: `badge/`, `card/`, `currency/`, `modal/`, `toast/`, `theme/` (dulu `hud/`).
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
- `assets/js/core/` — utilitas inti aplikasi.
- `assets/js/data/` — data statis untuk halaman.
- `assets/js/multiplayer/` — layanan dan UI multiplayer.
- `assets/js/pages/` — skrip halaman aplikasi.
- `assets/js/renderers/` — `dice-kit/` untuk dadu dan `power-3d/` untuk efek Power 3D; dahulu `power3d/`.
- `assets/js/services/` — layanan aplikasi dan integrasi data.
- `assets/js/systems/` — sistem UI dan gameplay bersama.
- `assets/js/vendor/` — pustaka pihak ketiga; `three-addons/` berisi add-on Three.js, nama upstream dipertahankan.

## data/
- `data/aura/` dan `data/aura/js/` — katalog dan tampilan aura.
- `data/character-page/`, `css/`, `js/` — data dan halaman karakter; nama lama: `data/karakter/`.
- `data/dice/`, `css/`, `js/` — katalog, gaya, dan skrip dadu.
- `data/frame/`, `css/`, `img/`, `js/` — katalog, gambar, dan halaman frame.
- `data/inventory/` — data inventori yang dipakai halaman Inventory dan gameplay.
- `data/inventory/aura/`, `character/`, `dice/`, `frame/`, `power/` — item inventori; nama folder item tetap berupa gameKey/ID.
- `data/lobby/` dan `data/lobby/js/` — data dan fungsi halaman Lobby.
- `data/mining/`, `css/`, `js/` — data serta halaman Tambang; nama lama: `data/tambang/`.
- `data/pet/`, `css/`, `items/`, `js/` — katalog, model, dan halaman Pet; nama item tetap berupa gameKey/ID.
- `data/power/`, `3d/`, `css/`, `js/` — katalog, aset 3D, gaya, dan skrip Power; nama aset item tetap berupa gameKey/ID.

referensi/ = mockup, tidak dipakai aplikasi, jangan diubah
