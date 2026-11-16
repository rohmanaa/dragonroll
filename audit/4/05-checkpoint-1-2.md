# Dragon Roll — Checkpoint 1.2: Lifecycle

Branch: `fx-core-1-2` (dari `fx-core-1-1` @ `31764b5`) · Tanggal: 16 Nov 2026
Melanjutkan: `04-checkpoint-1-1.md`

## Perubahan
**`gameplay/js/fx.js`**
- `track(handle)` / `untrack(handle)` / `stopAll()` / `activeCount()` di `UT.GameplayFX`. Handle = `{dispose()}` (opsional `stop()`).
- `stopAll()` = `clearConfetti()` (konfeti + ledakan + sparkle) + `stop`/`dispose` semua efek terdaftar. Aman dipanggil berulang; handle yang melempar error tidak menghentikan yang lain.

**`gameplay/js/main.js`** (3 titik kecil)
- `enderHole` mendaftarkan handle ke `FX.track`. Bila dibuang `stopAll`, tween tetap berjalan sampai selesai (di-await `enderSwapAnim`), tetapi berhenti menggambar. Selesai normal: `dispose` + `untrack`. Menyelesaikan sisa F1 (objek tertinggal ≤2,3 dtk setelah reset).
- `clearConfetti()` kini memanggil `FX.stopAll()` (dipakai di `startGame`).
- `visibilitychange` → tab tersembunyi memanggil `clearConfetti()`.

## Tidak disentuh
`tween()` (tanpa cancel, sengaja: `p.pos`/`slotPos`/callback `await` harus tetap selesai), durasi swap (K2 = A), aturan gameplay.

## Verifikasi
- `tests/gameplay-fx-core.test.js`: 18 test lulus (11 dari 1.1 + 7 baru).
- Baseline `aura-fx`, `power3d`, `game-core` lulus.
- Seluruh `tests/*.test.js`: hanya `pet-registry-parity` gagal (gagal juga di `main`).
- `sw.js` → v225, manifest preload digenerate ulang.

## Belum diverifikasi
- Uji manual: mulai game baru saat lubang Ender masih terbuka → lubang harus hilang seketika dan pion tetap selesai pindah.
- Perilaku visual setelah tab disembunyikan lalu dibuka saat swap berlangsung (pion tetap diselesaikan tween; lubang bisa hilang lebih awal).
- Uji dua klien, FPS di HP, test `*.test.mjs`.
