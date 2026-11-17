# Checkpoint 5.3 — UI & Game Feedback FX

## Baseline

- Repository: `rohmanaa/dragonroll`
- Branch: `restruktur-fx`
- Baseline commit: `f667f3243bd37163057834f59fbf26f3ce8b0b93` (Checkpoint 5.2 pushed and synchronized)
- Existing UI already provided hover/press states, selected-player and turn indicators, dice display, toast/modal transitions, victory fireworks, and Reduce Motion CSS. This checkpoint preserves those systems rather than duplicating them.
- Phase 4.2 and 4.3 were absent from the audited baseline and are not represented as complete.

## File yang diperiksa dan diubah

- Diubah: `gameplay/css/gameplay.css`, `gameplay/js/fx.js`, `gameplay/js/main.js`, `tests/gameplay-spatial-fx.test.js`.
- Diperiksa: `gameplay/css/win-screen.css`, gameplay modal/turn/dice styles, `gameplay/js/feedback.js`, `gameplay/js/level-up.js`, and victory/result flow.

## Implementasi

- Memperhalus pressed feedback tombol gameplay dengan skala 0,98 tanpa mengubah ukuran/layout; transform dan transisi tombol dinonaktifkan untuk `prefers-reduced-motion`.
- Kalah tidak lagi memakai confetti, ledakan Ender, atau animasi hop kemenangan. Pawn pemain lokal mendapat pose sedih dan `result-dissolve` berupa voxel kecil yang meluruh halus; efek memiliki fid/seed, tier L1, lifecycle spatial, dan tidak mengubah opacity/skala pawn.
- Efek kemenangan, suara, fireworks, turn/player status, dice display, notifikasi, modal transitions, dan animasi level-up yang sudah tersedia tetap dipakai. Tidak ada perubahan pada hasil dadu, reward, ekonomi, layout, atau gameplay.

## Hasil pengujian

- `node --check` untuk `gameplay/js/fx.js`, `gameplay/js/main.js`, dan `tests/gameplay-spatial-fx.test.js` — lulus.
- `node tests/gameplay-spatial-fx.test.js` — 40 lulus; termasuk defeat/victory branching, flash alpha, UI states, Reduce Motion, lifecycle, dan multiplayer cue regression.
- `node tests/gameplay-fx-core.test.js` — 16 lulus.
- `node tests/gameplay-fx-lifecycle.test.js` — 13 lulus.
- `node tests/gameplay-fx-cue.test.js` — 26 lulus.
- `git diff --check` — lulus.
- Local server mengembalikan HTTP 200, tetapi browser flow gameplay diarahkan ke `play.html`/`splash.html` dan tetap menampilkan loading 0% setelah 3 detik. Karena UI game tidak terbuka, visual runtime desktop/mobile tidak diklaim telah diuji.

## Masalah ditemukan dan penyelesaian

- Jalur kalah sebelumnya tetap memutar confetti dan hop pada pawn pemenang CPU, lalu menambahkan ledakan pada pawn CPU. Jalur kini dihentikan sebelum animasi kemenangan; feedback kalah dipindahkan ke pawn pemain lokal dengan dissolve kecil.
- Tombol gameplay sudah memiliki hover/press, tetapi press hanya bergeser vertikal. Ditambahkan skala halus dan override Reduce Motion; layout tetap.

## Batasan tersisa

- Browser smoke test tidak mencapai halaman game karena splash tetap loading; desktop/mobile fisik dan multiplayer dua klien live belum diuji.
- Reward/daily/quest/achievement server live tidak diklaim teruji; tes mencakup jalur integrasi statis dan lifecycle FX lokal.
- Phase 4.2/4.3 tidak termasuk pekerjaan Phase 5 dan masih belum tercatat selesai pada branch.

## Commit

- Implementasi: `69bcd5b7cc7bd66e2dbc05c2d45e218d7010c048`
- Audit ini ditambahkan dalam commit dokumentasi sesudah commit implementasi.
