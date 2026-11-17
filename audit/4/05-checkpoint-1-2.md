# Checkpoint 1.2 — FX Lifecycle, Tracking & Cleanup

## Status dan baseline

- Repository: `rohmanaa/dragonroll`
- Branch kerja: `restruktur-fx`
- Baseline: `3ef0d08bd38727928ea0fe13a38f18bfb717ce1e` — Checkpoint 1.1
- Commit implementasi dan tes: `257685b`
- Scope perubahan hanya lifecycle/cleanup visual. Perubahan lokal yang sudah ada pada `STRUKTUR.md` tidak disentuh dan tidak di-commit.

## File yang diaudit

- `gameplay/js/fx.js`
- `gameplay/js/particle-fx.js`
- `gameplay/js/main.js`
- `gameplay/js/dice-throw.js`
- `assets/js/renderers/power-3d/power-config.js`
- `assets/js/renderers/power-3d/power-overlay.js`
- `assets/js/renderers/power-3d/power-renderer.js`
- `assets/js/renderers/aura-view.js`
- `assets/js/renderers/aura-fx.js`
- `gameplay/js/firework-fx.js`
- `gameplay.html` (urutan pemuatan skrip)
- Tes FX core dan regression yang relevan.

## Temuan sebelum perubahan

- `GameplayFX.track()` sebelumnya hanya menerima objek dengan `update`, menyimpan referensi dalam array, dan tidak menyediakan ID, scope, status lifecycle, atau cleanup otomatis.
- `ParticleFX` menghapus partikel melalui satu listener `animationend`, tetapi burst tidak dapat dihentikan per-grup dan listener/layer tidak memiliki API pelepasan.
- `clearConfetti()` aktual sudah menghapus confetti, ledakan/asap, dan sparks; material spark individual juga di-dispose. Namun emitter belum dilacak per-grup, sementara geometry/material bersama memang harus tetap hidup selama dipakai.
- Ender Hole memakai `tween(EH_LIFE, ...)` 2,3 detik dan membersihkan geometry/material saat selesai alami, tetapi tidak dapat dihentikan saat reset atau tab disembunyikan.
- Efek hit, napas naga, sorak pawn, dan ledakan Wither memiliki timeout visual yang belum terdaftar untuk cleanup.
- Power Overlay memiliki dua timeout internal dan renderer yang dipakai ulang, tetapi belum memiliki stop/dispose publik. Stop eksplisit dapat meninggalkan flag resume sehingga renderer berpotensi hidup lagi setelah perubahan visibility.
- `AuraView.clearAll()` sudah membersihkan aura saat reset dengan fade; disposal sistem aura belum dipanggil saat halaman gameplay benar-benar ditinggalkan.
- Firework dan fallback PowerFX memakai `ParticleFX`; sistem api/asap naga memiliki pool lokal dengan `DFX.clear()` yang sudah dipakai saat reset.

## File yang diubah

- `gameplay/js/fx.js`
- `gameplay/js/particle-fx.js`
- `gameplay/js/main.js`
- `assets/js/renderers/power-3d/power-overlay.js`
- `assets/js/renderers/power-3d/power-renderer.js`
- `tests/gameplay-fx-lifecycle.test.js`
- `audit/4/05-checkpoint-1-2.md`

## Implementasi lifecycle

`UT.GameplayFX` kini menyediakan:

- `track(effect, metadata)` — ID unik dan transisi `created` → `playing`.
- `untrack(id)` — menyelesaikan efek alami ke status `disposed`.
- `stop(id)` — transisi `stopping` → `disposed`, stop/cleanup idempoten.
- `stopAll({scope})` — menghentikan efek berdasarkan `scope` atau `category`; tanpa opsi menghentikan seluruh efek terdaftar.
- `getActive()` — snapshot ID, state, dan metadata untuk debugging/pengujian.
- `timeout(callback, delay, metadata, onStop)` — timeout visual yang terdaftar dan dapat dibatalkan.
- `dispose()` — menghentikan efek, melepaskan listener, serta dispose resource yang memang dimiliki FX.

Confetti, ledakan/asap, dan spark sekarang dilacak per-grup. Penyelesaian alami menghapus tracking; stop satu ID hanya menghapus grup terkait. Spark tetap dispose material individualnya, sedangkan geometry dan material bersama tidak di-dispose sampai pemilik FX ditutup. `clearConfetti()` mencakup spark dan DOM particle.

`ParticleFX` melacak setiap burst DOM, menghapus grup saat `animationend`, menyediakan `dispose()`, melepaskan listener `animationend`, dan hanya menghapus layer ketika layer itu dibuat oleh modul.

Ender Hole terdaftar sebagai efek visual dengan cleanup geometry/material miliknya. Animasi memakai `tweenVisual()` yang dapat membatalkan hanya tween visual tersebut. Tween perpindahan bidak pada `enderSwapAnim()` tetap memakai `await tween(...)` dan tidak dibatalkan. Nilai `EH_LIFE` tetap 2,3 detik.

Reset menghentikan scope visual sebelum pawn diganti. Tab tersembunyi menghentikan efek dekoratif dan membersihkan pool partikel api/asap naga tanpa mengubah state permainan. `pagehide` pada navigasi biasa menjalankan disposal FX, Power Overlay, aura, dan listener; saat BFCache (`persisted`) efek visual dihentikan tanpa mematikan instance yang perlu dipulihkan.

Power Overlay kini melacak efek aktif, memiliki `stop()`/`dispose()`, menghapus kedua timeout, dan melepas renderer saat halaman ditinggalkan. `PowerRenderer.stop()` membersihkan status resume; pause/resume visibility tetap terpisah.

Saat pertandingan berakhir, efek kemenangan dibiarkan selesai alami agar confetti/firework tidak hilang sebelum tampil. Timeout boss yang memang dibersihkan oleh alur hasil tetap dihentikan.

## Hasil pengujian

| Perintah / pemeriksaan | Hasil |
|---|---|
| `node tests/gameplay-fx-lifecycle.test.js` | PASS — 13 tes lifecycle |
| `node tests/gameplay-fx-core.test.js` | PASS — 16 tes |
| `node tests/aura-fx.test.js` | PASS — 7 tes |
| `node tests/power3d.test.js` | PASS — 9 tes |
| `node tests/game-core.test.js` | PASS — 16 tes, 808 kombinasi ekuivalensi gerak, serta pemeriksaan mob/chest |
| `node tests/gameplay-boss-hit.test.js` | PASS |
| `node tests/gameplay-win-result.test.js` | PASS |
| `node tests/gameplay-mob-hit-panel.test.js` | PASS |
| `node tests/gameplay-mob-landing-resolve.test.js` | PASS |
| `node tests/gameplay-power-landing-resolve.test.js` | PASS |
| `node --check` untuk JS klasik yang berubah | PASS |
| `node --input-type=module --check` untuk Power Overlay | PASS |
| `git diff --check` | PASS |

Tes lifecycle mencakup ID unik, state, stop/untrack alami, scope/category, idempotensi, timeout, penghapusan sparks, perlindungan resource bersama, burst DOM, visibility, pagehide, Power Overlay, serta pemeriksaan bahwa durasi Ender Hole dan tween gameplay tetap.

## Konfirmasi gameplay, risiko, dan batasan

- Tidak ada perubahan pada aturan permainan, perhitungan dadu, pergerakan/damage pawn, giliran, protokol cue multiplayer, audio, atau durasi Ender Swap.
- Cleanup pada reset/visibility hanya menghentikan visual dan timer FX yang terdaftar. Timer gameplay, jaringan, audio, dadu, dan HUD tidak dimasukkan ke scope FX.
- Regression berjalan di Node dengan DOM/Three.js stub untuk lifecycle core; tidak ada uji browser interaktif/WebGL end-to-end pada checkpoint ini.
- Aura terpasang tetap mengikuti lifecycle `AuraView`; `clearAll()` digunakan untuk reset dan `AuraSystem.dispose()` untuk navigasi keluar. Pool tema lain tetap memakai pemilik dan cleanup lokalnya, bukan dipindahkan ke engine baru.
- Hash commit implementasi dan tes checkpoint: `257685b`. Laporan audit ditambahkan sebagai commit dokumentasi terpisah.
