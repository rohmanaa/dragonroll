# Phase 5 — World, Reward & UI FX

## Status dan baseline

- Repository: `rohmanaa/dragonroll`
- Branch: `restruktur-fx`
- Baseline sebelum Phase 5: `baac617da432501148c0647295491e595ae363b6`
- Checkpoint 5.1, 5.2, dan 5.3 selesai pada branch ini; masing-masing diuji, dikomit, dipush, dan sinkron sebelum checkpoint berikutnya dimulai.
- Audit awal Phase 1–4 menemukan Phase 1–3 serta Phase 4.1 tersedia; Phase 4.2 (Elemental FX) dan Phase 4.3 (Summon/Mob/Boss FX) tidak ditemukan dan tidak diklaim selesai dalam laporan ini.

## Ringkasan implementasi

### 5.1 — Reward & Loot

- `UT.GameplayFX` mendapat komposisi reward burst coin, gem, XP, chest, item, rare, dan legendary dengan siluet/momentum berbeda.
- Chest open/reveal memakai lifecycle chest yang sudah ada. Daily, quest, bonus quest, dan achievement memakai `UT.ParticleFX` hanya setelah respons klaim sukses; rarity achievement mengikuti data yang tersedia.
- Tidak ada reward, item, nominal, peluang, atau rarity chest yang dikarang. Audio tidak membuat engine baru.

### 5.2 — World & Environment

- Ambient ringan untuk map aktif World dan Nether, serta Dragon saat boss aktif; transisi hanya saat map benar-benar berganti.
- Interval mengikuti kualitas; emisi berhenti saat Reduce Motion, tab tersembunyi, pause, atau game over. Map switch membersihkan spatial FX dan pool WFX lama.
- Menggunakan spatial cue host dengan fid/seed ringan; klien merender lokal. Tidak ada payload partikel mentah atau objek Three.js.

### 5.3 — UI & Game Feedback

- Menambahkan skala press tombol halus tanpa mengubah layout, serta menonaktifkannya pada `prefers-reduced-motion`.
- Jalur kalah kini memakai dissolve voxel halus pada pawn pemain dan tidak lagi memakai victory confetti/hop atau ledakan; victory fireworks dan feedback UI yang sudah ada dipertahankan.
- Turn/status, dice, notification, modal, dan level-up yang sudah memenuhi kebutuhan tetap memakai implementasi eksisting.

## File yang berubah

- Checkpoint 5.1: `gameplay/js/fx.js`, `gameplay/js/main.js`, `assets/js/pages/hadiah-misi.js`, `hadiah-misi.html`, `tests/gameplay-spatial-fx.test.js`.
- Checkpoint 5.2: `gameplay/js/fx.js`, `gameplay/js/main.js`, `tests/gameplay-spatial-fx.test.js`.
- Checkpoint 5.3: `gameplay/js/fx.js`, `gameplay/js/main.js`, `gameplay/css/gameplay.css`, `tests/gameplay-spatial-fx.test.js`.
- Audit: `17-checkpoint-5-1-reward-loot.md`, `18-checkpoint-5-2-world-environment.md`, `19-checkpoint-5-3-ui-feedback.md`, dan laporan Phase 5 ini.

## Pengujian dan regresi

- Spatial FX bertambah dari 36 (5.1) ke 38 (5.2) dan 40 (5.3) test lulus.
- Phase 1 core: 16 test; lifecycle: 13 test; multiplayer cue: 26 test — lulus.
- Gameplay mob landing: lulus; Power rules: 17 test — lulus.
- Syntax check JavaScript dan `git diff --check` lulus pada checkpoint terkait.
- Simulasi harness memeriksa Low/Medium/High/Ultra, tier, Reduce Motion, dedup cue, reset/game-over, visibility, cleanup, dan seed.

## Risiko dan batasan

- Browser game tidak mencapai gameplay: launcher mengarahkan ke splash yang tetap loading 0%. Desktop/mobile fisik, console runtime, dan multiplayer dua klien live tidak berhasil diuji.
- Klaim reward/quest/achievement server live tidak dijalankan; validasi jalur klaim berasal dari kode dan regression lokal.
- Environment FX hanya mencakup map World/Nether/Dragon yang didukung saat ini. Map lain tidak aktif pada branch.
- Phase 4.2 dan 4.3 masih merupakan pekerjaan terdahulu yang belum tercatat selesai; Phase 5 tidak menutup gap tersebut.

## Commit dan sinkronisasi

- 5.1 implementation: `58c306712c671eb540a3590917d983e65015af23`, `c2c9da658cf5f8ab6db071524b92d6bfd6009f56`
- 5.1 audit: `35f29d5dd91054836cbce49216d4f0a0db6a092f`
- 5.2 implementation: `345541eff4c378bf151dc3ab099047a6c3e1456f`
- 5.2 audit: `f667f3243bd37163057834f59fbf26f3ce8b0b93`
- 5.3 implementation: `69bcd5b7cc7bd66e2dbc05c2d45e218d7010c048`
- Laporan Phase 5 ini merekam hash implementasi; audit akhir dipush terpisah sebagai commit dokumentasi.
