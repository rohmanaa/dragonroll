# Audit 4 — Tahap 1: Audit FX existing + Core FX Standard

Branch: `fx/phase1-audit-core-standard` (dari `main` @ 12ecb91). `main` tidak diubah.
Dasar: dokumen "Dragon Roll — RPG Visual Effects Design & Implementation Standard" (fase 1 & 2).

## 0. Izin & batasan

- `STRUKTUR.md` / `README.md`: `gameplay.html` dan `gameplay/` **dibekukan sampai ada izin khusus**. Izin untuk menyentuh `gameplay/js/fx.js` diberikan pemilik proyek pada sesi ini (Mon 2026-11-16). File lain di `gameplay/` tidak disentuh.
- Perubahan aset → aturan di STRUKTUR.md (naikkan `VERSION` di `sw.js`, jalankan `tools/gen-preload-manifest.py`). **Belum dilakukan**: sw.js/manifest perlu di-bump bila `fx.js` dipakai langsung di PWA cache; lihat §6.

## 1. Inventaris engine (sudah ada — tidak perlu engine baru)

| Lapisan | Lokasi | Fungsi | Batas / cleanup |
|---|---|---|---|
| 3D mesh partikel | `gameplay/js/fx.js` (`UT.GameplayFX`) | konfeti, ledakan (api/ender), sparkle; update dari loop `main.js` (baris ±2401, ±6179) | tanpa batas sebelum audit ini; satu `Mesh` per partikel |
| 3D instanced pool | `main.js` `burstCubes` / `WFX` (InstancedMesh, n=150) | debu/serpihan blok, api, lava | pool tetap 150 — sudah sesuai standar pooling |
| 3D inline (efek khusus) | `main.js` `enderHole`, `enderSwapAnim`, `PORTALS`, `DFX` (Dragon), trap/power ghost | Ender Pearl, portal, boss | geometry/material dibuat per panggilan, di-dispose di akhir tween |
| 2D DOM partikel | `gameplay/js/particle-fx.js` (`UT.ParticleFX`) | `burstAt`, cap 60 live / 20 per burst, cleanup `animationend`, hormati reduced-motion (live) | baik |
| Lapisan 2D di atasnya | `firework-fx.js`, `creeper-fx.js`, `data/power/power-fx.js` | efek berlapis lewat `ParticleFX.burstAt` | ikut cap engine |
| Aura 3D | `assets/js/renderers/aura-fx.js` (873 baris) + `aura-view.js` | aura karakter, punya `quality` (`low`/`high`) | `PAURA.clearAll()` saat reset |
| Tween | `main.js` `tween(dur, fn, ease)` (array `tweens`, dijalankan di `frame`) | semua animasi | tidak ada cancel; guard manual `gid`/`STALE` |
| Audio | `gameplay/js/audio.js` (`UT.GameplayAudio`) + `UT.PowerSound` | file SFX + fallback beep sintetis, `sfxV`, `muted`, `limited()` | lihat §3 |
| Multiplayer cue | `main.js` `mpCue` / `mpRunFeedbackCue` (`confetti`, `blast`, `eport`, `pfx`, `hitfx`, …) | host kirim cue, tamu memutar FX lokal | hanya koordinat/kunci — tidak mengirim partikel (sesuai standar) |

Kesimpulan: sudah ada **tiga** sistem partikel (3D mesh, 3D instanced, 2D DOM) + AuraFX. Menambah engine keempat akan melanggar larangan "engine FX duplikat". Core FX Standard harus dibangun di atas keempatnya.

## 2. Temuan (diverifikasi dari kode)

| # | Temuan | Dampak | Status |
|---|---|---|---|
| F1 | `fx.js` `clearConfetti()` tidak membersihkan `sparks`: sparkle tetap di scene dan material per-partikel tidak di-dispose saat game direset (`main.js` ±5753 hanya memanggil `clearConfetti`) | partikel tertinggal / kebocoran material | **Diperbaiki** (`clearConfetti` kini membersihkan sparks + dispose) |
| F2 | `fx.js` tanpa batas jumlah partikel: tiap `spawnConfetti` 110 mesh, `spawnExplosion` 58 mesh, `sparkle` 14 mesh (+14 material). Spawn beruntun menumpuk | risiko FPS di HP kelas menengah | **Diperbaiki** (batas keras `MAX_LIVE=600`) |
| F3 | Kualitas grafis hanya dipakai AuraFX (`AuraView.quality()`); FX 3D di `fx.js` tidak punya skala kualitas | tidak ada Low/Medium untuk ledakan/konfeti | **API disediakan** `setQuality()`; **belum dihubungkan** (lihat §5) |
| F4 | `reduce` di `main.js` dibaca sekali saat load (`const reduce = matchMedia(...).matches`); `particle-fx.js` membaca live | perubahan pengaturan OS saat game jalan tidak diikuti FX 3D | Dicatat → Tahap 3 |
| F5 | `creeper-fx.js` dimuat di `gameplay.html` tetapi **tidak dipanggil** dari `main.js` (headernya mengatakan "BELUM terhubung") | modul orphan; ledakan Creeper memakai efek lama | Dicatat → Tahap 3/4 (jangan dihapus, belum ada pengganti) |
| F6 | `audio.js` `fileSfx` membuat `new Audio()` per pemutaran (tanpa pool); `preload()` hanya menghangatkan cache | variasi/jumlah suara bersamaan tidak dibatasi selain `limited()` | Dicatat → Tahap 3 |
| F7 | Cue multiplayer `eport`/`blast`/`confetti` tidak membawa ID event; tidak ada dedup di sisi tamu | FX bisa diputar dobel bila cue dikirim ulang | Dicatat → Tahap 3 (perlu verifikasi di `assets/js/multiplayer/game-sync.js`) |
| F8 | `enderHole` membuat geometry+material baru per panggilan (di-dispose di akhir tween — benar) tetapi tween tidak bisa dibatalkan saat game berganti | grup FX hidup sampai tween selesai (≤2,3 dtk), bukan bocor permanen | Dicatat |
| F9 | Efek besar ada inline di `main.js` (6249 baris): `enderHole`, portal, `DFX`, trap | sulit diuji/diperluas | Dicatat → dipecah bertahap saat Tahap 3+, bukan sekarang |

Yang **sudah baik**: `burstCubes` memakai InstancedMesh pool; `particle-fx.js` punya cap + cleanup terpusat + guard reduced-motion; cue multiplayer hanya mengirim posisi/kunci; efek gagal ditelan `try/catch`; `enderSwapAnim` punya cabang reduce-motion; `sfx` dihormati lewat `muted`/`sfxV`.

## 3. Audio

Aset: `assets/audio/sfx/mob/enderman-teleport.mp3` dipetakan sebagai `sfx.endermanTp` (juga `sfx.enderman()` dipakai di `enderSwapAnim`). Ikuti aturan standar: pakai file asli dulu, fallback beep. Volume ikut `sfxV`/`muted`; suara aksi pemain lain diturunkan `MP_SFX_GAIN=0.6`. Belum ada standar varian suara (F6).

## 4. Core FX Standard — keputusan (Fase 2)

Berlaku untuk semua FX baru; **tidak** mengganti API lama.

- **Lifecycle konseptual** per efek: `id · type · source · target · position · duration · quality · audio` + `play / update / stop / dispose`. Diterapkan sebagai konvensi pada modul yang ada (mis. `UT.GameplayFX` = `init/update*/clear*`), bukan class baru.
- **Timing**: ikuti tabel standar (micro 80–180 ms, hit 150–350, skill 300–700, teleport 900–1600, summon 600–1200, reward 500–1200, cinematic 1000–2000). Ender swap saat ini ±2,3 dtk (0,7+0,7+0,5+0,4) — sedikit di atas target teleport; **tidak diubah** (timeline sudah dipakai cue online).
- **Quality**: `low / medium / high / ultra` → pengali partikel 0.4 / 0.7 / 1 / 1 (diimplementasikan di `fx.js`). L1–L4 (kompleksitas visual) dicatat di katalog FX, tidak mengubah gameplay.
- **Event contract**: gameplay event = sumber kebenaran; FX dipicu dari event; cue multiplayer hanya `{k, pid/pos, seed?}`; tiap cue sebaiknya membawa `id` untuk dedup (F7, belum ada).
- **Perf**: partikel 3D wajib lewat batas global (`MAX_LIVE`), instancing/pool untuk yang sering; dispose geometry/material; hentikan semua FX saat reset (`clearConfetti`/`clearFX`/`PAURA.clearAll`).
- **Arsitektur data**: katalog FX per item tetap di `data/` (mis. `data/power/power-fx.js`); `assets/` hanya aset bersama.

## 5. Perubahan kode pada checkpoint ini

Hanya `gameplay/js/fx.js` (+ tes baru):
1. `clearConfetti()` juga membersihkan `sparks` (F1).
2. Batas `MAX_LIVE = 600` pada konfeti+blast+sparks (F2).
3. `setQuality(q)` + `stats()`; default `high` = jumlah partikel lama (110 / 58 / 14), sehingga perilaku tampilan **tidak berubah** (F3).
4. `tests/gameplay-fx-core.test.js` (baru).

`setQuality` **sengaja belum dipanggil** dari `main.js`: menghubungkannya ke pengaturan grafis akan mengurangi partikel pada pengguna "low" — keputusan visual untuk Tahap 3.

## 6. Pengujian (benar-benar dijalankan)

- Baseline sebelum perubahan (`main`): 71 tes Node → **69 lulus, 2 gagal** — `tests/pet-registry-parity.test.js` dan `tests/gameplay-dice-throw-race.test.mjs` (sudah gagal sebelum perubahan, tidak terkait FX; tidak diperbaiki di sini).
- Tes baru `tests/gameplay-fx-core.test.js`: 6 skenario lulus dengan three.min.js asli (tanpa render). Tes yang sama **gagal** pada `fx.js` lama (membuktikan tes menangkap F1/F2).
- Suite akhir (setelah perubahan): 72 tes → **70 lulus, 2 gagal** (dua kegagalan yang sama seperti baseline; tidak ada regresi baru).
- **Belum diuji**: browser nyata, HP (mobile), FPS/profiling, multiplayer dua klien, reduce-motion di perangkat. Itu masuk Tahap 3 dan Tahap terakhir.
- Belum dilakukan: bump `VERSION` di `sw.js` dan `python3 tools/gen-preload-manifest.py` (`fx.js` berubah → cache PWA bisa menyajikan versi lama). Perlu dilakukan sebelum rilis; tidak dikerjakan agar checkpoint ini tetap sekecil mungkin.

## 7. Rekomendasi Tahap 2 (Teleport/Ender/Enderman)

1. Beri `id` event pada cue `eport`/`blast` + dedup di tamu (F7) — verifikasi dulu di `game-sync.js`.
2. Hubungkan `setQuality` ke pengaturan grafis (butuh keputusan Anda).
3. Pindahkan `enderHole`/swap ke modul tersendiri (`gameplay/js/spatial-fx.js`) memakai engine yang ada, dengan tes cleanup & reduce-motion.
4. Pakai ulang `UT.GameplayFX`/`ParticleFX` untuk ledakan portal ungu-hitam; jangan buat engine baru.
