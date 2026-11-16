# Dragon Roll — Audit FX & Core FX Standard (Tahap 1)

Tanggal: 16 Nov 2026 · Branch dasar: `main` @ `12ecb91` · Mode: **read-only** (tidak ada file repo yang diubah)
Simpan sebagai: `audit/4/01-audit-fx-core-standard.md`

## 0. Ruang lingkup & batasan

- Sumber: standar FX (dokumen spesifikasi) + kode repo `rohmanaa/dragonroll`.
- `gameplay.html` dan `gameplay/` berstatus **dibekukan** di `STRUKTUR.md`. Pemilik repo menyatakan bagian gameplay sudah diizinkan. Audit ini hanya membaca; perubahan nanti tetap minimal.
- **Belum diverifikasi** (tidak bisa dijalankan di sini): FPS nyata di HP/desktop, kebocoran memori runtime, perilaku multiplayer dua klien, seluruh suite test. Yang sudah dijalankan: `aura-fx`, `power3d`, `game-core` → semuanya PASS.

## 1. Inventaris FX yang ada

| Keluarga | File | Teknologi | Catatan |
|---|---|---|---|
| Gameplay 3D | `gameplay/js/fx.js` | Three.js (Mesh kubus) | confetti (110), explosion (36 api + 22 asap, varian `ender`), sparkle (14). Geometri & material dibagi, dibuat sekali. |
| Gameplay 3D inline | `gameplay/js/main.js` | Three.js + `tween()` | `enderHole`, `enderSwapAnim`, `teleport`, `bossHitFx`, `fireFx`, shake via kelas `hf-shake`, aura pawn. FX masih bercampur di `main.js` (6249 baris). |
| Gameplay 2D | `gameplay/js/particle-fx.js` (+ `creeper-fx`, `firework-fx`, `data/power/power-fx.js`) | DOM/CSS | Engine ringan: cap 60 total / 20 per burst, cleanup terpusat via `animationend`, patuh reduced-motion (live). |
| Kit renderer | `aura-fx.js` (873 baris), `power-3d/power-particles.js`, `dice-kit/dice-effects-core.js` | Three.js | Sudah ada pooling + dispose; dice punya `quality:'auto'`. |
| UI / lobi | `podium-fx.js`, `splash-fx.js`, `frame-fx.js` | DOM/Canvas | Di luar gameplay; tidak diubah di tahap awal. |
| Audio | `gameplay/js/audio.js` (`UT.GameplayAudio`) | WebAudio + file SFX | File asli dulu, fallback beep sintetis; volume via `setSfxVolume`. |
| Tween | `tween()` di `main.js` baris ~3823 | Array + Promise, dijalankan di loop animasi | Sederhana, tanpa handle/cancel. |

Tidak ada engine partikel ganda yang bersaing: DOM `ParticleFX` (layer 2D) dan Three.js `GameplayFX` (layer 3D) punya peran berbeda. **Kesimpulan: engine sekarang bisa dikembangkan; tidak perlu engine baru.**

## 2. Temuan

Tingkat: 🔴 perlu tindakan · 🟡 sebaiknya · 🟢 sudah baik

**Cleanup & lifecycle**
- 🔴 F1 — `tween()` tidak punya handle/cancel. Tween lama tidak dibersihkan saat game baru; keamanan bergantung pada guard `gid!==gameId → STALE` di tiap pemanggil. `enderHole` adalah tween "fire-and-forget" tanpa guard; objeknya baru dibuang saat tween selesai (maks 2,3 dtk), jadi bisa tertinggal sebentar setelah reset.
- 🟡 F2 — `clearConfetti()` (membersihkan confetti + blasts) hanya dipanggil di satu tempat (`main.js:5753`, reset). `sparks` (sparkle) tidak ikut dibersihkan oleh `clearConfetti`. Jalur akhir game/pindah scene perlu diverifikasi.
- 🟢 F3 — Disposal Three.js: `enderHole` dan `sparkle` membuang geometry/material; `aura-fx` & `dice-effects` punya dispose + pool.

**Performa & kualitas**
- 🔴 F4 — Tidak ada level kualitas global (Low/Medium/High/Ultra). Jumlah partikel `fx.js` tetap (110 / 58 per ledakan). Swap Ender Pearl memicu 2 ledakan (116 mesh) sekaligus. `ParticleFX.configure()` ada tetapi **tidak dipanggil siapa pun**.
- 🟡 F5 — Tidak ada pooling di `fx.js`: tiap partikel = `new THREE.Mesh`; `sparkle` membuat `MeshBasicMaterial` baru per partikel (14 per panggilan). Aman karena di-dispose, tetapi menambah GC di HP.
- 🟢 F6 — Seed deteksi perangkat sudah ada di `dice-throw.js` (mobile, `hardwareConcurrency`, `deviceMemory`) → bisa dipakai ulang untuk kualitas global.

**Accessibility**
- 🔴 F7 — Reduce-motion tidak seragam. `main.js:228` membaca `const reduce` **sekali saat load** (tidak berubah bila pengguna mengganti pengaturan), sedangkan `RMQ` (baris 2282) dan `ParticleFX` membaca live. `aura-fx.js`, `power-particles.js`, `dice-effects-core.js` tidak punya referensi reduce sendiri (dice menerima `opt.reduce` dari pemanggil) — perlu diverifikasi per modul.
- 🟡 F8 — Screen shake memakai satu kelas `hf-shake` (360 ms) untuk hit boss dan hit pemain; belum berskala dengan tingkat damage (standar §C).

**Multiplayer**
- 🟢 F9 — Arsitektur sudah sesuai prinsip standar: host menyiarkan *cue* ringan (`blast`, `confetti`, `eport`, `sfx`, …); partikel tidak dikirim lewat jaringan; FX tidak mengubah hasil gameplay; guard `MP_SEQ` mencegah mirror ganda.
- 🟡 F10 — Cue belum punya **ID event** (standar §7.5). Dedup hanya lewat guard `MP_SEQ` dan antrean `MP_CUE_CHAIN`. Seed tidak dikirim, jadi sebaran `Math.random` berbeda antar klien (hanya visual; dapat diterima).
- 🟡 F11 — `enderVictimFx` (vignette + teks untuk yang ditukar) tidak terlihat di daftar `MPFB`; **perlu diverifikasi** apakah pemain yang ditukar di perangkat lain melihatnya.

**Ender Pearl / Teleport (acuan kualitas pertama)**
- 🟢 F12 — Sudah mencakup sebagian besar urutan §3A: lubang hitam (inti + 2 cincin ungu + 70 partikel terhisap), kedua pion terhisap, posisi ditukar, muncul dari lubang lawan, ledakan ungu-hitam, lubang menutup, SFX `enderman`, mode reduce-motion = teleport langsung.
- 🟡 F13 — Durasi swap total **2,3 dtk** (0,7 + 0,7 + 0,5 + 0,4), di atas target teleport 0,9–1,6 dtk. Komentar kode menyebut timeline "TETAP", jadi ini keputusan desain yang perlu dikonfirmasi. Bentuk portal runtuh masih lewat skala, belum ledakan partikel dari portal itu sendiri.
- 🟡 F14 — `enderman` hanya satu file SFX tanpa variasi.

**Audio**
- 🟢 F15 — Sesuai standar: file asli dulu + fallback sintetis, volume mengikuti slider, SFX pemain lain lebih pelan (`MP_SFX_GAIN`), `rollStop` untuk loop.

**Pengujian**
- 🟡 F16 — Tidak ada test khusus untuk `gameplay/fx.js`, `enderHole`/`enderSwapAnim`, `ParticleFX`, atau kontrak cue FX. Test FX hanya ada untuk aura, power3d, dan dadu.

## 3. Usulan Core FX Standard (untuk Tahap 1 bagian 2)

Prinsip: **tambah lapisan tipis di `UT.GameplayFX`, jangan buat engine baru, jangan ubah aturan gameplay.**

1. **Lifecycle** — `FX.track({id,type,update,stop,dispose})` mendaftarkan efek aktif; `FX.stopAll()` dipanggil di reset/akhir game/pindah scene. Efek lama (`enderHole`, `sparkle`) dibungkus bertahap, bukan ditulis ulang.
2. **Quality** — `FX.quality()` mengembalikan `low|medium|high|ultra` dari preferensi + heuristik perangkat `dice-throw.js`. Fungsi `FX.n(base)` menskalakan jumlah partikel. Menyambungkan juga `ParticleFX.configure()` yang kini tidak terpakai.
3. **Reduce-motion** — satu `FX.reduced()` live (berbasis `matchMedia`), dipakai menggantikan `const reduce` secara bertahap.
4. **Timing** — tabel durasi standar dijadikan konstanta (`FX.T.micro/hit/skill/teleport/...`) sebagai target, bukan batas wajib.
5. **Kontrak cue** — tambah `fid` (ID event, mis. `gameId:seq`) dan `seed` opsional pada cue FX; klien mengabaikan `fid` yang sudah diputar. Cue lama tanpa `fid` tetap diterima (kompatibel mundur).
6. **Pooling** — pool mesh/material untuk `fx.js` (confetti/explosion/sparkle), dengan batas jumlah aktif.
7. **Tempat kode** — modul FX baru di `gameplay/js/` dengan pola `UT.*` (classic script) yang sama; FX berbasis item/identitas ke `data/` (katalog).

## 4. Risiko & hal yang tidak boleh disentuh

- Aturan damage, gerak, dadu, giliran, dan penyelesaian swap (`p.pos`, `slotPos`, callback `await`).
- Jangan hapus FX lama sebelum pengganti terbukti.
- `gameplay/` dibekukan → semua perubahan di sana minimal dan dicatat per checkpoint.
- Setelah perubahan aset: naikkan `VERSION` di `sw.js` dan jalankan `python3 tools/gen-preload-manifest.py`.

## 5. Rencana checkpoint berikutnya

| # | Checkpoint | Isi | Verifikasi |
|---|---|---|---|
| 1.1 | Dasar kualitas & reduce | `FX.quality()`, `FX.reduced()`, `ParticleFX.configure` tersambung | test unit baru + 3 test baseline |
| 1.2 | Lifecycle | `track/stopAll`, `sparks` ikut dibersihkan, `enderHole` terdaftar | test cleanup + uji manual reset game |
| 1.3 | Cue `fid` | dedup event FX, kompatibel mundur | test multiplayer FX |
| 2.x | Ender Pearl / Enderman | sesuai Tahap 2 | uji 2 klien, HP & desktop |

Setiap checkpoint: branch terpisah (bukan `main`), laporan di `audit/4/`, commit + push setelah diverifikasi.
