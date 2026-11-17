# Checkpoint 5.1 — Reward & Loot FX

## Baseline

- Repository: `rohmanaa/dragonroll`
- Branch: `restruktur-fx`
- Baseline commit: `baac617da432501148c0647295491e595ae363b6`
- Baseline audit found Phase 1–3 reports and Phase 4.1; Phase 4.2 and 4.3 were not present on this branch and are not claimed as complete here.

## File yang diperiksa dan diubah

- Diubah: `gameplay/js/fx.js`, `gameplay/js/main.js`, `assets/js/pages/hadiah-misi.js`, `hadiah-misi.html`, `tests/gameplay-spatial-fx.test.js`.
- Diperiksa: `gameplay/js/particle-fx.js`, `gameplay/css/particle-fx.css`, data achievement, layanan klaim wallet/quest, lifecycle chest, serta cue multiplayer yang sudah ada.

## Implementasi

- Menambahkan spatial `reward-burst` pada `UT.GameplayFX` untuk coin, gem, XP, chest, item, rare, dan legendary. Perbedaan siluet berasal dari bentuk token, arah gerak, warna, durasi, serta jumlah ring; tidak mengubah reward atau inventory.
- Efek chest dipicu pada pembukaan dan setelah reward chest yang sudah diproses gameplay. Karena reward pool chest tidak memiliki metadata rarity atau hadiah gem/coin, reveal chest tidak mengarang kategori/rarity.
- Menambahkan burst DOM untuk klaim daily, quest, bonus quest, dan achievement. FX hanya berjalan sesudah respons sukses server; rarity achievement dibaca dari definisi yang sudah ada. Efek membawa fid/seed deterministik, mengikuti `ParticleFX` lifecycle, kualitas, dan Reduce Motion.
- Memuat `UT.GameplayFX`/`UT.ParticleFX` yang sudah ada pada halaman Hadiah & Misi. Audio tetap melalui alur audio lama; tidak ada engine audio atau mekanisme reward baru.
- Cue chest dirender lokal pada host dan diterima sebagai cue ringan di klien; replay klien tidak memicu burst kedua. Jaringan tidak membawa partikel/objek Three.js.
- Tidak mengubah aturan, nilai/peluang reward, ekonomi, inventory, atau gameplay.

## Hasil pengujian

- `node --check` untuk `gameplay/js/fx.js`, `gameplay/js/main.js`, `assets/js/pages/hadiah-misi.js`, dan `tests/gameplay-spatial-fx.test.js` — lulus.
- `node tests/gameplay-spatial-fx.test.js` — 36 lulus, termasuk tujuh variasi reward, fid/seed, quality, Reduce Motion, replay multiplayer, cleanup, dan regression Phase 2–3.
- `node tests/gameplay-fx-core.test.js` — 16 lulus.
- `node tests/gameplay-fx-lifecycle.test.js` — 13 lulus.
- `node tests/gameplay-fx-cue.test.js` — 26 lulus.
- `git diff --check` — lulus.
- Desktop/mobile fisik, server klaim eksternal, dan dua klien multiplayer live tidak dijalankan; hasil tersebut tidak diklaim.

## Masalah ditemukan dan penyelesaian

- Pemeriksaan multiplayer menemukan replay `openChest` di klien dapat menggandakan cue reward terpisah dari host. Render lokal dibatasi ke offline/host; klien menampilkan satu cue host.
- Harness spatial mengembalikan controller (dengan ID lifecycle), bukan string ID. Regression test disesuaikan untuk memeriksa metadata fid pada efek terlacak.
- Batas burst DOM awal tidak mengikuti preset perangkat pada halaman tanpa scene Three.js. Burst kini mengonfigurasi batas `ParticleFX` lewat kualitas/tier yang disediakan `GameplayFX`.

## Batasan tersisa

- Reward chest saat ini berupa kejutan pergerakan/roll, bukan loot currency atau item; efek menyoroti pembukaan dan hasil tanpa mengubah isi reward.
- Rare/legendary memakai definisi rarity yang tersedia pada achievement. Sistem chest belum menyediakan rarity loot yang dapat dipetakan.
- Verifikasi visual browser lintas perangkat dan klaim server live masih perlu dilakukan di lingkungan runtime yang sesuai.

## Commit

- Implementasi: `58c306712c671eb540a3590917d983e65015af23`, `c2c9da658cf5f8ab6db071524b92d6bfd6009f56`
- Audit ini ditambahkan dalam commit dokumentasi sesudah commit implementasi.
