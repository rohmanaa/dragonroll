# Checkpoint 1.3 — FX Cue Identity, Deterministic Seed & Multiplayer Compatibility

## Status dan baseline

- Repository: `rohmanaa/dragonroll`, branch kerja `restruktur-fx`
- Baseline: `b02fc588b7cfaf2675fd6bc404fcc561d1a62a0b` (setelah Checkpoint 1.1 `3ef0d08` dan 1.2 `257685b`/`f8e845f`)
- Commit implementasi dan tes: `4e12ece632e26e9945700d41cd41ace86612c158`
- Baseline tes dijalankan sebelum perubahan: semua tes FX/gameplay yang relevan lulus.
- Scope: hanya identitas cue FX, seed visual, dedup, dan debugging. Tidak ada efek visual baru.

## File yang diaudit

`gameplay/js/main.js` (blok multiplayer: `mpCue`, `mpRunCue`, `mpRunFeedbackCue`, `onMpCue`, `MPFB`, `MP_SEQ`, `MP_CUE_CHAIN`, `spawnConfetti`, `spawnExplosion`, `enderHole`, `hitBlastFx`, `powerFxPawn`, `startGame`), `assets/js/multiplayer/game-sync.js`, `gameplay/js/fx.js`, `gameplay/js/particle-fx.js`, `tests/multiplayer/event-log.test.js`, serta hasil Checkpoint 1.1 dan 1.2.

## Temuan awal

- Transport cue: `game-sync.js` menyiarkan `broadcast` event `cue` apa adanya (hanya host yang mengirim, tamu hanya menerima). Tidak ada deduplikasi di transport; pengiriman ulang akan memutar efek dua kali.
- Cue FX yang ada: `confetti`, `blast`, `eport`, `pfx`, `hitfx`, `bosshfx`, `pufx`, `sfx`, `dfx`, `dmusic`, `seq`. Tidak satu pun punya ID kejadian (F10 dari audit 01).
- Seed tidak dikirim; setiap klien memakai `Math.random` sendiri (hanya visual, aman tetapi tidak reproduksi).
- `gameId` bersifat lokal per klien (`mpFixGid` menimpanya saat cue diterima). Karena itu `gameId` tidak dipakai untuk membandingkan antar klien; epoch dibandingkan hanya terhadap epoch yang pernah dilihat dari pengirim yang sama.
- F11 (`enderVictimFx`) terkonfirmasi: vignette/teks untuk pemain yang ditukar hanya dibuat lokal di host dan tidak punya cue, sehingga pemain yang ditukar di perangkat tamu tidak melihatnya. **Tidak diubah** (lihat "Di luar cakupan").
- `MP_SEQ` dan `MP_CUE_CHAIN` berfungsi sebagai pencegah mirror ganda dan antrean berurutan; dipertahankan utuh.

## Perubahan

### `UT.GameplayFX` (`gameplay/js/fx.js`)

| API | Fungsi |
|---|---|
| `cueMeta(origin, epoch)` | Membuat `{fid, seed, source}`. `fid = pengirim:epoch:sesi.urut`, contoh `hostA:3:k9x2.17`. Sesi halaman acak mencegah bentrok setelah reload; urutan monoton per halaman. Panjang ≤ 80, pengirim disanitasi. |
| `parseFid(fid)` | Menguraikan `{origin, epoch, nonce, seq}` atau `null`. |
| `acceptCue(cue)` | `true` = putar, `false` = lewati. Menolak `duplicate` (fid sudah pernah diputar; memori dibatasi 256 entri) dan `stale-epoch` (epoch lebih lama dari yang sudah terlihat dari pengirim+sesi yang sama). Cue tanpa fid valid selalu diterima. |
| `cueOptions(cue)` | Mengubah cue menjadi opsi emitter `{seed, fid, source}`; menurunkan seed dari fid bila seed tidak ada; `null` untuk cue lama. |
| `rng(seed[, index])` | PRNG deterministik (mulberry32); dengan `index` tiap partikel punya aliran sendiri. |
| `getCueLog()` / `getHistory()` | Log cue (diterima/ditolak + alasan) dan riwayat efek selesai (waktu dibuat/berakhir, kategori, sumber, seed, state, alasan). Masing-masing dibatasi 64 entri. |
| `setDebug(on)` | Mengaktifkan `console.debug`; default mati, jadi tidak ada spam di production. |

Perubahan pada API yang sudah ada (kompatibel mundur): `stop(id, reason)`, `untrack(id, reason)`, `stopAll({scope, reason})`; `getActive()` kini juga menyertakan `createdAt` dan `reason`. Alasan yang dipakai: `completed`, `stopped`, `stopAll`, `clear`, `visibility-hidden`, `pagehide-bfcache`, `dispose`, atau alasan dari pemanggil (mis. `reset`).

Emitter `spawnConfetti(pos, tier, opts)`, `spawnExplosion(pos, kind, tier, opts)`, `sparkle(pos, tier, opts)` menerima `opts = {seed, fid, source}`. Tiap partikel memakai `rng(seed, index)`; asap ledakan memakai namespace indeks sendiri. Dampaknya: partikel ke-i identik di semua klien walau **jumlah** partikel berbeda karena skala perangkat (Checkpoint 1.1). Tanpa `opts.seed` urutan panggilan acak sama seperti sebelumnya.

### `UT.ParticleFX` (`gameplay/js/particle-fx.js`)

`burstAt(x, y, {seed})` memakai `GameplayFX.rng(seed, i)` per partikel (arah, ukuran, durasi, rotasi, jeda). `fid/seed/source` masuk ke metadata tracking.

### `gameplay/js/main.js`

- `mpFxMeta()` membuat meta hanya bila klien adalah host room online.
- `mpCue()` menambahkan `fid` otomatis ke cue FX (`MP_FX_CUES`). `confetti`, `blast`, `eport` membawa juga `seed`, dan host memakai **seed yang sama** untuk render lokalnya.
- `onMpCue()` (tamu) memanggil `FX.acceptCue(c)` sebelum masuk ke `MP_CUE_CHAIN`; duplikat/basi dilewati tanpa menyentuh antrean atau state.
- `mpRunFeedbackCue()` meneruskan `FX.cueOptions(c)` ke `spawnConfetti`, `spawnExplosion`, dan `enderHole`.
- `enderHole(pos, scale, meta)` memakai seed untuk 70 partikel terhisap; metadata tracking diperluas. `EH_LIFE = 2.3` tidak berubah.

### Format cue (kompatibel mundur)

```
lama : {k:'confetti', x, y, z}
baru : {k:'confetti', x, y, z, fid:'hostA:3:k9x2.17', seed:2891736411}
```

Tamu lama mengabaikan field tambahan. Tamu baru yang menerima cue lama memutarnya tanpa dedup dan dengan acak seperti dulu. Payload hanya berisi string/angka kecil (diuji < 160 byte); tidak ada partikel atau objek Three.js.

### Aset

`sw.js` `VERSION` dinaikkan ke `ut-pwa-v224` dan `tools/gen-preload-manifest.py` dijalankan ulang (aturan di `STRUKTUR.md`).

## Hasil pengujian

| Perintah | Hasil |
|---|---|
| `node tests/gameplay-fx-cue.test.js` | PASS — 26 tes (baru) |
| `node tests/gameplay-fx-lifecycle.test.js` | PASS — 13 tes (harness dipindah ke `tests/helpers/fx-harness.js`, isi tes tidak berubah) |
| `node tests/gameplay-fx-core.test.js` | PASS — 16 tes |
| `node tests/aura-fx.test.js` | PASS — 7 tes |
| `node tests/power3d.test.js` | PASS — 9 tes |
| `node tests/game-core.test.js` | PASS |
| `gameplay-boss-hit`, `gameplay-win-result`, `gameplay-mob-hit-panel`, `gameplay-mob-landing-resolve`, `gameplay-power-landing-resolve` | PASS |
| `node --test tests/multiplayer/event-log.test.js` | PASS — 14/14 |
| `node --check` fx.js, particle-fx.js, main.js · `git diff --check` | PASS |
| Seluruh `tests/*.test.js` dan `*.test.mjs` | 70 lulus, 5 gagal (lihat bawah) |

Lima tes yang gagal juga gagal pada baseline `b02fc58` tanpa perubahan saya (diverifikasi dengan `git stash`): `lobby-appearance`, `lobby-background`, `pet-registry-parity`, `profile-layout-css`, `gameplay-dice-throw-race.test.mjs` (`THREE.MeshStandardMaterial is not a constructor`). Tidak terkait FX dan tidak diperbaiki.

Tes cue memakai kode **nyata** dari `main.js` (`mpCue`, `mpFxMeta`, `spawnConfetti`, `spawnExplosion`, `mpRunFeedbackCue`, `onMpCue`) yang diekstrak ke sandbox, dengan dua instance `GameplayFX` (host dan tamu). Uji mutasi: menonaktifkan `acceptCue` di `onMpCue` membuat tes dedup gagal.

Pemetaan terhadap daftar standar: 13 fid unik, 14 seed konsisten (termasuk lintas tier perangkat), 15 duplikat tidak memunculkan FX ganda, 16 dan 17 cue/payload lama tetap diproses, 18 payload baru diproses, 19 cue terlambat tidak mengubah state gameplay (`cur/busy/players` dan snapshot tidak tersentuh), 20 payload tanpa partikel mentah.

## Risiko yang tersisa

- **Belum ada uji browser/WebGL dan uji dua klien sungguhan.** Semua uji berjalan di Node dengan stub DOM/Three.js; konsistensi visual antar perangkat belum dinilai mata dan FPS belum diukur.
- Seed hanya diterapkan pada confetti, ledakan, sparkle, DOM burst `ParticleFX`, dan partikel Ender Hole. Efek yang diputar lewat cue `pfx` (PowerOverlay/PowerFX), `hitfx`, `bosshfx`, `pufx` mendapat `fid` untuk dedup, tetapi variasinya masih `Math.random` lokal.
- Cue yang belum punya `fid` (klien host lama) tidak bisa di-dedup.
- Aturan `stale-epoch` mengandalkan `gameId` host. Bila di masa depan `gameId` di-reset tanpa naik, cue baru dari sesi halaman yang sama bisa dianggap basi; sesi halaman baru aman karena nonce berbeda.
- `acceptCue` menyimpan 256 fid terakhir; duplikat yang datang setelah > 256 cue lain tidak terdeteksi (praktis tidak terjadi).

## Di luar cakupan (tidak diperbaiki)

- F11: `enderVictimFx` tidak punya cue, jadi pemain tamu yang ditukar tidak melihat vignette ungu. Memperbaikinya berarti menambah jenis cue/efek baru; dicatat untuk Phase berikutnya.
- `const reduce` di `main.js` masih snapshot sekali saat load dan masih dipakai `enderHole`/`powerFxPawn` (sudah dicatat di 1.1).
- Lima tes yang gagal di baseline (daftar di atas).

## Konfirmasi gameplay

Tidak ada perubahan pada aturan permainan, dadu, gerak/tween pawn, damage, giliran, ekonomi, drop rate, audio, durasi Ender Swap (`EH_LIFE = 2.3`), konfigurasi kualitas 1.1, maupun format multiplayer non-FX. `MP_SEQ`, `MP_CUE_CHAIN`, `MPFB` dan cue gameplay-presentasi (`roll`, `walk`, `climb`, `bite`) tidak diubah.
