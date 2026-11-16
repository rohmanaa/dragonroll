# Dragon Roll — Audit 04: Checkpoint 1.1 (Dasar kualitas & reduce-motion)

Branch: `fx-core-1-1` (dari `main` @ `12ecb91`) · Melanjutkan: 01, 02, 03

## Yang diubah
| File | Perubahan |
|---|---|
| `gameplay/js/fx.js` | Tambah `quality()`, `setQuality(q\|'auto')`, `n(base)`, `cap()`, `reduced()`. Konfeti/ledakan/sparkle memakai `n()` + batas aktif. `init()` menyambungkan `ParticleFX.configure()`. `clearConfetti()` kini ikut membersihkan `sparks` (F2) |
| `tests/gameplay-fx-core.test.js` | 11 test baru |
| `sw.js` | `VERSION` ut-pwa-v223 → v224 |
| `assets/preload-manifest.json` | Digenerate ulang (`tools/gen-preload-manifest.py`) |
| `audit/4/01..04` | Dokumen audit |

## Perilaku
- **Medium (bawaan) = persis perilaku lama**: konfeti 110, ledakan 58 (36 api + 22 asap), sparkle 14. Urutan `Math.random` tidak berubah.
- Auto-deteksi: `cores ≤ 2` atau `deviceMemory ≤ 2` → `low`; selain itu `medium`. `high`/`ultra` hanya lewat `setQuality()` (belum ada UI yang memanggilnya).
- Reduce-motion dibaca live → partikel ×0,4 di `fx.js`. **Ini satu-satunya perubahan visual yang terlihat** (hanya untuk pengguna reduced-motion).
- Batas aktif (mesh): low 120 · medium 300 · high 420 · ultra 600. ParticleFX DOM: low 30/10 · medium 60/20 (= lama) · high 78/26 · ultra 96/30.
- Tidak disentuh: `main.js`, aturan gameplay, `enderSwapAnim` (K2 dibiarkan 2,3 dtk), tween, cue multiplayer.

## Verifikasi
- `tests/gameplay-fx-core.test.js`: 11/11 lulus.
- Baseline `aura-fx`, `power3d`, `game-core`: lulus. Seluruh `tests/*.test.js` dijalankan; satu gagal: `pet-registry-parity.test.js` — **gagal juga di `main`** (sudah ada sebelumnya, tidak terkait FX).
- **Belum diverifikasi:** FPS/gerak nyata di HP & desktop, tampilan di browser, uji dua klien, `*.test.mjs`.

## Catatan
- `main.js:228` (`const reduce`) belum diganti `FX.reduced()`; dilakukan bertahap di checkpoint yang menyentuh pemakainya.
- `FX.setQuality()` belum terhubung ke pengaturan pengguna; keputusan UI-nya menyusul.
- Berikutnya: 1.2 (`FX.track/stopAll`, `enderHole` terdaftar, `visibilitychange`), lalu 1.3 (`fid`).
