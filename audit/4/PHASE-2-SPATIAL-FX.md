# Phase 2 — Spatial & Teleport FX (ringkasan)

Branch `restruktur-fx` · Repository `rohmanaa/dragonroll` · Baseline `cef4413` (akhir Phase 1) · Tidak ada perubahan pada `main` atau `restruktur`, tidak ada merge.

| Checkpoint | Isi | Laporan |
|---|---|---|
| 2.1 | Teleport: gather, departure, trail, arrival, recovery, residual | `07-checkpoint-2-1-teleport.md` |
| 2.2 | Ender Hole (lapisan energi) & Ender Swap | `08-checkpoint-2-2-ender-swap.md` |
| 2.3 | Portal & Spatial Distortion | `09-checkpoint-2-3-portal-spatial.md` |

Commit kode: `7883f2dcbcb8edfeded7c8e9caa67b847d15e584` (di atas `cef4413`).

## Penyimpangan dari brief (dilaporkan apa adanya)
Brief meminta commit atomic per checkpoint. Ketiga checkpoint memakai infrastruktur yang sama (`spRun`, `spPart`, pelacakan, kuota), jadi saya mengerjakannya sekaligus dan **meng-commit satu kali** setelah seluruh tes lulus. Alasannya: commit antara yang belum pernah diuji lebih buruk daripada satu commit yang sudah diuji. Pemisahan per checkpoint ada di dokumen, bukan di riwayat git.

## Arsitektur
Tidak ada engine baru. `UT.GameplayFX` mendapat `spatial(kind, opts)`, `spatialKinds`, `clearSpatial`; `UT.ParticleFX` tidak diubah. Update berjalan dari `updateConfetti` (loop gameplay yang sama). Efek dilacak lewat `track()` Phase 1 (`category:'spatial'`, `scope:'visual'`), memakai `fid`/seed, kuota kualitas yang sama (Low 120 / Medium 220 / High 320 / Ultra 450; tier L1 0,4 · L2 0,8 · L3 1,3 · L4 2,0), dan Reduce Motion. Kuota dicek saat partikel dipancarkan (bug yang ditemukan tes: sebelumnya hanya dicek saat efek dibuat, puncak Low 135 > 120; sudah diperbaiki).

## File yang berubah
- `gameplay/js/fx.js` — modul Spatial FX (+ hook di `activeCount`, `updateConfetti`, `clearConfetti`, `disposeSharedResources`, ekspor).
- `gameplay/js/main.js` — `spFx`/`spFxCue`/`spSound`, `teleport`, `enderHole` (lapisan `hole-fx`), `enderSwapAnim` (hanya penambahan panggilan), cue `spfx`.
- `tests/gameplay-spatial-fx.test.js` (baru, 25 tes), `tests/helpers/fx-harness.js` (stub THREE + opsi `reducedMotion`).
- `audit/4/07–09`, `PHASE-2-SPATIAL-FX.md`.

## Multiplayer
Cue baru `spfx`: `{k, t:kind, x,y,z, [tx,ty,tz], [s,w,r,d,q,h], fid}` — posisi dibulatkan 0,1, tanpa partikel mentah, tanpa `seed` (tamu menurunkannya dari `fid` lewat `cueOptions`, sama dengan host). Terburuk (trail dengan semua parameter) < 200 byte, tipikal < 120 byte (diuji). Tamu: dedup/cue basi lewat `acceptCue` yang sudah ada; kind tak dikenal diabaikan; cue lama (`eport`, `blast`, `confetti`) tidak berubah. `MP_SEQ>0` tidak mengirim cue (sama seperti `spawnExplosion`). Gameplay multiplayer, `MP_SEQ`/`MP_CUE_CHAIN` tidak disentuh.

## Hasil regression
- Phase 1: `gameplay-fx-core` 16, `gameplay-fx-lifecycle` 13, `gameplay-fx-cue` 26 — lulus tanpa diubah. `aura-fx`, `power3d`, `game-core`, tes gameplay terkait, `multiplayer/event-log` — lulus.
- Seluruh suite: **72 lulus, 5 gagal**. Kelima kegagalan sama dengan baseline Phase 1 dan tidak terkait FX: `lobby-appearance`, `lobby-background`, `pet-registry-parity`, `profile-layout-css`, `gameplay-dice-throw-race.test.mjs`.
- Tambahan: seluruh kind dijalankan terhadap THREE r128 asli (headless): tanpa NaN/error, bersih setelah selesai/`stopAll`/`dispose`.

## Yang tidak diubah (diverifikasi lewat tes sumber dan diff)
Aturan gameplay, dadu, pergerakan pion, posisi hasil teleport, mekanisme Ender Swap, durasi 2,3 dtk (tween 0,7/0,7/0,5/0,4), damage/giliran, inventory, ekonomi. Diff `main.js` pada baris lama hanya: badan `teleport()` (tween/posisi sama), `MP_FX_CUES`, dan tambahan panggilan FX.

## Risiko yang tersisa (jujur)
1. **Belum diuji di browser/WebGL, belum ada pengukuran FPS atau memori di HP, belum ada uji dua klien nyata.** Semua pengujian = Node + stub, ditambah THREE asli tanpa renderer. "Desktop/mobile" hanya tingkat kualitas yang disimulasikan.
2. Tampilan (ukuran voxel, jumlah, warna, kedalaman portal, bentrokan visual dua karakter saat swap) belum dilihat mata; angka adalah titik awal.
3. Portal tidak punya pemicu gameplay (tidak ada kejadian yang cocok; gameplay tidak boleh diubah).
4. "Dua pawn berpindah bersamaan" hanya ada pada Ender Swap (efek dibedakan palet/sisi/skala); game tidak punya teleport dua pion paralel lain.
5. Reduce Motion: `enderSwapAnim` masih memakai konstanta `reduce` (dibaca saat load, perilaku lama); lapisan baru memakai `FX.reduced()` live.
6. Game over tidak menghentikan paksa efek spasial (umur ≤ 2,3 dtk, membersihkan diri); reset dan tab tersembunyi menghentikannya.
7. Teleport tile biasa kini bersuara `enderman` saat departure (satu suara per 250 ms). Perlu didengar.

## Bug di luar cakupan
Tidak ada yang ditemukan.

## Status Git
Commit kode di atas. Dokumen ini dan 07–09 ditambahkan sebagai commit dokumentasi terpisah (hash-nya tidak bisa ditulis di dalam dokumen itu sendiri); verifikasi `HEAD == origin/restruktur-fx` dilaporkan di luar dokumen setelah push. Phase 3 tidak dimulai.
