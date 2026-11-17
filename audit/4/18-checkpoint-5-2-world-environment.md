# Checkpoint 5.2 — World & Environment FX

## Baseline

- Repository: `rohmanaa/dragonroll`
- Branch: `restruktur-fx`
- Baseline commit: `35f29d5dd91054836cbce49216d4f0a0db6a092f` (Checkpoint 5.1 pushed and synchronized)
- Audit confirmed the active map list contains World (`minecraft`) and Nether. No other environment map is active on this branch.
- Phase 4.2 and 4.3 were absent from the audited baseline; this checkpoint does not represent them as complete.

## File yang diperiksa dan diubah

- Diubah: `gameplay/js/fx.js`, `gameplay/js/main.js`, `tests/gameplay-spatial-fx.test.js`.
- Diperiksa: `gameplay/js/themes.js`, map definitions, existing Nether lavafall/particle pool, `buildWorld`, frame update, `UT.GameplayFX` lifecycle, and multiplayer spatial cue routing.

## Implementasi

- Menambahkan spatial FX ambient terbatas untuk World pollen, Nether ember, dan Dragon Energy saat Dragon aktif; menambahkan ring/debris transition cue saat map benar-benar berganti.
- Ambient memakai loop frame yang sudah ada, satu cue ringan pada interval sesuai kualitas. Tidak menambah timer, loop, objek dunia persisten, atau mengubah layout papan.
- Emisi berhenti saat Reduce Motion, tab tersembunyi, pause, atau game over. Jumlah dan partikel mengikuti quality/tier dari `UT.GameplayFX`.
- Pergantian map membersihkan spatial FX sebelumnya dan pool WFX sebelum membangun map baru. Semua efek baru memakai lifecycle tracking, fid/seed, dan cue multiplayer yang ada; jaringan hanya membawa kind/style/posisi/identity.
- Tidak menambah biome/map yang belum didukung dan tidak mengubah aturan/gameplay.

## Hasil pengujian

- `node --check gameplay/js/fx.js`, `gameplay/js/main.js`, dan `tests/gameplay-spatial-fx.test.js` — lulus.
- `node tests/gameplay-spatial-fx.test.js` — 38 lulus, termasuk variasi World/Nether/Dragon, transition, seeded identity, quality, Reduce Motion, visibility, cleanup, dan regression spatial.
- `node tests/gameplay-fx-core.test.js` — 16 lulus.
- `node tests/gameplay-fx-lifecycle.test.js` — 13 lulus.
- `node tests/gameplay-fx-cue.test.js` — 26 lulus.
- `node tests/gameplay-mob-landing-resolve.test.js` — lulus.
- `node tests/power-rules.test.js` — 17 lulus.
- `git diff --check` — lulus.
- Browser/device physical run and live multiplayer session were unavailable; no result for those is claimed.

## Masalah ditemukan dan penyelesaian

- Pool WFX lama tidak mempunyai pembersihan khusus saat peta berubah. Transisi kini mereset pool dan `GameplayFX.clearSpatial()` sebelum world dibangun ulang.
- Untuk menghindari emisi berulang dari klien, ambient dikirim host sebagai cue ringan; klien merender cue saja.

## Batasan tersisa

- Forest, desert, snow, End, dan biome lain tidak aktif sebagai map pada branch ini; FX tidak ditambahkan untuk map yang tidak tersedia.
- Ambient hanya berupa burst kecil berkala, bukan emitter berkelanjutan; ini menjaga batas partikel dan mencegah pertumbuhan objek.
- Visual langsung pada browser/perangkat dan dua klien multiplayer belum dapat diuji dalam sesi ini.

## Commit

- Implementasi: `345541eff4c378bf151dc3ab099047a6c3e1456f`
- Audit ini ditambahkan dalam commit dokumentasi sesudah commit implementasi.
