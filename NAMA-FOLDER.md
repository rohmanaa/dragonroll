# Peta Folder

Ringkasan isi folder dan fitur yang menggunakannya. Path ditulis sesuai nama di Git.

## assets/
- `assets/audio/music/` â€” musik halaman dan gameplay; nama lama: `assets/music/`.
- `assets/audio/sfx/` â€” efek suara `board/`, `dice/`, `dragon/`, `mob/`, `pet/`, `powerup/`, `reward/`, `ui/`, dan `win/`; nama lama: `assets/sfx/` dan `assets/new sound/`.
- `src/components/` â€” komponen UI reusable; dipakai: `ui-core.js`, `button/` (preload; termasuk gaya glossy `.ut-gl .ut-c-*`), `tabs/` (tab atas/segmented/underline gaya Guild, `preview.html` untuk lihat semua; dipakai Tambang); belum dipakai: `badge/`, `card/`, `currency/`, `modal/`, `toast/`, `theme/` (dulu `hud/`).
- `assets/css/base/` â€” reset dan aturan dasar semua halaman.
- `assets/css/components/` â€” gaya komponen bersama.
- `assets/css/pages/` â€” gaya khusus halaman; tiga file `*-legacy.css` berasal dari `legacy-pages/`.
- `assets/css/utilities/` â€” kelas gaya utilitas bersama.
- `assets/fonts/` â€” font lokal untuk halaman aplikasi.
- `assets/icons/` â€” ikon bersama yang bukan ikon gambar halaman.
- `assets/images/background/` â€” latar halaman seperti lobby, profil, dan toko; `clouds/` berisi tekstur awan.
- `assets/images/buttons/` â€” tekstur tombol dan kontrol; nama lama: `assets/images/tombol/`.
- `assets/images/effects/` â€” tekstur efek visual dan kabut.
- `assets/images/icon/` â€” ikon halaman dalam kategori `audio/`, `currency/`, `emblem/`, `items/`, `lobby/`, `mode/`, `profile/`, `rank/`, `tabler/`, dan `ui/`; `lobby/chest.webp` dahulu `invenotry.webp`, `mode/calendar.webp` dahulu `calndar.webp`, dan `mode/mode-khusus.webp` dahulu `modekhsusus.webp`.
- `assets/images/ui/` â€” gambar UI bersama; juga memuat `assets/ng/komponen/` yang digabung ke sini.
- `assets/images/ui/achievement/` dan `leaderboard/` â€” ikon pencapaian, podium, dan papan peringkat.
- `assets/images/ui/banner-label/` â€” banner judul, hasil, dan boss untuk gameplay.
- `assets/images/ui/buttons-and-controls/` â€” gambar tombol dan kontrol gameplay; nama lama: `tombol-dan-kontrol/`.
- `assets/images/ui/character-portraits/` â€” potret karakter untuk UI.
- `assets/images/ui/chest-packs/` â€” gambar paket peti pada toko.
- `assets/images/ui/feature-icons/` dan `mode/` â€” ikon mode dan fitur; nama lama `new-icon/` dan `freinds.webp`.
- `assets/images/ui/gem-medal-icons/` â€” ikon gem dan medali; nama lama: `ikon-gem-medali/`.
- `assets/images/ui/gold-packs/` â€” gambar paket koin emas pada toko.
- `assets/images/ui/hud/` â€” gambar panel status dan tombol HUD gameplay.
- `assets/images/ui/item-icons/` â€” ikon item untuk gameplay dan katalog.
- `assets/images/ui/language-flags/`, `navigation-icons/`, dan `settings-icons/` â€” bendera, navigasi, dan ikon pengaturan.
- `assets/images/ui/lobby/`, `logo/`, dan `menu-pause/` â€” dekorasi lobby, logo/pemuatan, dan panel jeda.
- `assets/images/ui/missions/` â€” ikon dan panel misi.
- `assets/images/ui/panel-dialog/`, `slot-equipment/`, dan `stage-chapter/` â€” dialog, slot perlengkapan Power, serta ikon chapter gameplay.
- `assets/images/ui/white-glyphs/` â€” glyph putih untuk HUD dan tombol; nama lama: `glyph-putih/`.
- `assets/js/core/` â€” utilitas inti aplikasi.
- `assets/js/data/` â€” data statis untuk halaman.
- `assets/js/multiplayer/` â€” layanan dan UI multiplayer.
- `assets/js/pages/` â€” skrip halaman aplikasi.
- `assets/js/renderers/` â€” `dice-kit/` untuk dadu dan `power-3d/` untuk efek Power 3D; dahulu `power3d/`.
- `assets/js/services/` â€” layanan aplikasi dan integrasi data.
- `assets/js/systems/` â€” sistem UI dan gameplay bersama.
- `assets/js/systems/game-dialog.js` + `assets/css/components/game-dialog.css` â€” dialog bergaya game (bingkai, header, X bulat, tombol polos) yang dipakai bersama; modal Unduh Data dan Ketentuan Layanan memakainya.
- `assets/js/systems/update-service.js` â€” cek/unduh/restart pembaruan dengan konfirmasi pemain (hanya dari Lobby); `assets/js/services/tos-service.js` â€” persetujuan Ketentuan Layanan/Privasi (server untuk akun, localStorage untuk tamu); halaman isinya `tos.html`.
- `assets/js/vendor/` â€” pustaka pihak ketiga; `three-addons/` berisi add-on Three.js, nama upstream dipertahankan.

## data/
- `data/inventory/<kategori>/` â€” kategori item pemain: `aura/`, `character/`, `dice/`, `frame/`, `pet/`, dan `power/`. Item berada di folder gameKey/ID; kode dan gaya kategori bersama berada di `_shared/`.
- `data/inventory/pet/items/<gameKey>/` â€” manifest, model, gambar, dan SFX khusus Pet.
- Manifest item inventori berada di `data/inventory/<kategori>/<item>/` dan dipertahankan tetap.
- `data/frame/*.webp` â€” gambar frame yang path-nya dipertahankan karena dirujuk katalog/DB.
- `data/power/3d/` dan `data/power/power-fx.js` â€” aset dan efek Power yang path-nya dipertahankan karena dirujuk katalog/DB atau gameplay.
- `data/lobby/` â€” data dan fungsi khusus halaman Lobby; fitur/halaman tetap di bawah `data/`, bukan `data/inventory/`.
- `data/mining/` â€” data serta halaman Tambang; nama lama: `data/tambang/`; fitur/halaman tetap di bawah `data/`, bukan `data/inventory/`.
- `data/` hanya menampung kode/aset per fitur atau halaman, bukan kategori item pemain.

referensi/ = mockup, tidak dipakai aplikasi, jangan diubah

