# Phase 1 — FX Core Management (ringkasan)

Branch: `restruktur-fx` · Repository: `rohmanaa/dragonroll` · Tidak ada merge ke `main` atau `restruktur`.

| Checkpoint | Isi | Commit | Laporan |
|---|---|---|---|
| 1.1 | Kualitas perangkat, tier item, reduced-motion live | `3ef0d08` | `04-checkpoint-1-1.md` |
| 1.2 | Lifecycle, tracking, cleanup | `257685b` (kode), `f8e845f` (dokumen) | `05-checkpoint-1-2.md` |
| 1.3 | `fid`, seed deterministik, dedup cue, debugging | `4e12ece` | `06-checkpoint-1-3.md` |

## Arsitektur akhir

Tidak ada engine baru. Tiga modul lama tetap pemiliknya:

- `UT.GameplayFX` (`gameplay/js/fx.js`) — efek Three.js, sekaligus pengelola tipis: kualitas, tracking, cue identity, seed.
- `UT.ParticleFX` (`gameplay/js/particle-fx.js`) — partikel DOM/CSS; mendaftarkan tiap burst ke tracking `GameplayFX`.
- `UT.GameplayAudio` — tidak diubah.

`main.js` hanya menyambungkan: host membuat meta cue, tamu menyaring cue dan meneruskan opsi ke emitter.

## Lifecycle FX

`created → playing → stopping → disposed`. Efek yang selesai alami memanggil `untrack`; efek yang dihentikan memanggil `stop`. Keduanya idempoten: cleanup berjalan tepat sekali dan efek yang sudah `disposed` tidak bisa kembali `playing`. Setiap efek punya ID unik (`gameplay-fx-N`), `createdAt`, dan alasan akhir.

## Tracking dan cleanup

- `track/untrack/stop/stopAll/getActive/getHistory/timeout/dispose`; `stopAll({scope, reason})` memilah per `scope`/`category`.
- Efek dekoratif (`scope: 'visual'`) dihentikan saat reset dan saat tab tersembunyi. Tween perpindahan pawn (`await tween(...)`) tidak ikut dihentikan; hanya tween visual Ender Hole (`tweenVisual`) yang bisa dibatalkan.
- Confetti, ledakan/asap, sparks, burst DOM, timer visual, dan Ender Hole dilacak per grup. Sparks ikut dibersihkan (temuan F2 selesai). Material milik efek di-dispose; geometry dan material bersama hanya di-dispose saat `dispose()` FX.
- `pagehide` menjalankan disposal penuh; BFCache (`persisted`) hanya menghentikan visual.

## Identitas cue multiplayer

`fid = pengirim:epoch:sesi.urut`. Host menambahkannya ke cue FX; tamu menolak duplikat dan cue dari game sebelumnya, serta tetap memutar cue lama tanpa `fid`. Payload tetap ringan (primitif, < 160 byte) dan `MP_SEQ`/`MP_CUE_CHAIN` tidak berubah.

## Seed deterministik

`seed` dibuat host dari `fid` dan dikirim bersama cue partikel (`confetti`, `blast`, `eport`). Setiap partikel memakai `rng(seed, index)`, sehingga partikel ke-i sama di semua klien walau jumlah totalnya berbeda menurut tier perangkat. Seed hanya memengaruhi tampilan, tidak pernah hasil gameplay.

## Hasil regression

Lulus: `gameplay-fx-cue` (26), `gameplay-fx-lifecycle` (13), `gameplay-fx-core` (16), `aura-fx` (7), `power3d` (9), `game-core`, lima tes gameplay (boss-hit, win-result, mob-hit-panel, mob-landing-resolve, power-landing-resolve), `tests/multiplayer/event-log.test.js` (14). Seluruh suite: 70 lulus, 5 gagal; kelima kegagalan itu sudah ada di baseline `b02fc58` dan tidak terkait FX (`lobby-appearance`, `lobby-background`, `pet-registry-parity`, `profile-layout-css`, `gameplay-dice-throw-race.test.mjs`).

## Batasan yang jujur

Semua pengujian berjalan di Node dengan stub. Belum ada uji browser/WebGL, uji dua klien nyata, atau pengukuran FPS/memori di HP. Angka tier 1.1 masih titik awal. Daftar risiko lengkap ada di laporan 1.2 dan 1.3.

## Status Git

Commit implementasi 1.3: `4e12ece632e26e9945700d41cd41ace86612c158`, di atas baseline `b02fc58`. Laporan ini dan `06-checkpoint-1-3.md` ditambahkan sebagai commit dokumentasi terpisah (hash-nya tidak bisa ditulis di dalam dokumen itu sendiri); status push dan `HEAD == origin/restruktur-fx` diverifikasi setelah push dan dilaporkan di luar dokumen ini.
