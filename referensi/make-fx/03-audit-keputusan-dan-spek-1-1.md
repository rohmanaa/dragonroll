# Dragon Roll â€” Audit 03: Verifikasi, Keputusan K1â€“K4, Spek Checkpoint 1.1

Simpan sebagai: `audit/4/03-keputusan-dan-spek-1-1.md`
Melanjutkan: `01-audit-fx-core-standard.md` dan `02-referensi-visual-vs-teknis.md`
Tanggal: 16 Nov 2026 Â· Basis: `main` @ `12ecb91` Â· Mode: **read-only** (repo tidak diubah)

**Aturan pemakaian bersama (dipertahankan)**
- Visual (tampilan, warna, urutan, angka) â†’ `dragon_roll_rpg_fx_mockup.html` + `dragon-roll-fx.html`
- Teknis (cara membangun tanpa merusak arsitektur) â†’ audit 01/02 + kode repo
- Bentrok: gameplay & arsitektur repo menang; mockup menang untuk tampilan.

## 1. Verifikasi temuan audit 01 ke kode repo

| Temuan | Hasil cek | Bukti |
|---|---|---|
| F1 `tween()` tanpa handle/cancel | âœ… Terkonfirmasi | `main.js:3823` hanya `tweens.push({...,res})` |
| F2 `sparks` tidak ikut `clearConfetti` | âœ… Terkonfirmasi | `fx.js:67` hanya mengosongkan `confetti` dan `blasts`; `sparks` (baris 14) tidak disentuh. Dipanggil sekali di `main.js:5753` (reset) |
| F4 `ParticleFX.configure()` tidak dipanggil | âœ… Terkonfirmasi | hanya definisi di `particle-fx.js:96`, tidak ada pemanggil di `src/gameplay/js/` |
| F7 `const reduce` dibaca sekali | âœ… Terkonfirmasi | `main.js:228`; `RMQ` live ada di `main.js:2282` |
| F13 swap 2,3 dtk, durasi "TETAP" | âœ… Ada di `enderSwapAnim` (`main.js:4229`), dipanggil dengan guard `gid!==gameId â†’ STALE` di `main.js:4993` |

**Koreksi kecil untuk audit 01 (F6):** deteksi perangkat (`hardwareConcurrency`/`deviceMemory`) tidak hanya di `dice-throw.js`. Ada juga di `dice-kit/dice-renderer.js:18`, `aura-fx.js:52`, `power-3d/power-config.js:17`, `scene-bg.js:79`. Artinya sudah ada **empat** heuristik terpisah; `FX.quality()` sebaiknya mengacu satu sumber, bukan menambah yang kelima. Dipilih saat 1.1: salin pola `power-config.js` (paling dekat dengan FX gameplay), jangan refactor yang lain.
Catatan: folder `audit/` belum ada di repo; dibuat saat checkpoint pertama di-commit.

## 2. Keputusan yang diusulkan (K1â€“K4)

K2 butuh keputusan pemilik karena memengaruhi ritme giliran. Lainnya usulan default yang bisa langsung dipakai.

**K1 â€” Dua sumbu kualitas â†’ pisahkan. (usulan: setuju)**
Jumlah partikel = `dasar Ã— tier_item Ã— skala_perangkat`, lalu `min(hasil, QMAX)`.
- `tier_item` (L1â€“L4): dibaca dari `data/` katalog; default L2 bila tidak ada.
- `skala_perangkat` (low/medium/high/ultra): dari `FX.quality()`.

**K2 â€” Durasi swap. (butuh keputusan Anda)**

| Opsi | Durasi | Dampak |
|---|---|---|
| A. Biarkan | 2,3 dtk | Nol risiko; di atas target standar (0,9â€“1,6) |
| B. Samakan FX Lab | Â±1,85 dtk | Jeda giliran âˆ’0,45 dtk; masih di atas target |
| C. Ikuti standar | â‰¤1,6 dtk | Ritme giliran berubah paling besar |

Rekomendasi: **A untuk Tahap 1** (tidak ada yang disentuh), putuskan B/C di awal Tahap 2 setelah diuji di HP. Standar menyebut durasi sebagai target, bukan batas wajib, jadi A tidak melanggar.

**K3 â€” Audio. (usulan: setuju)** Tetap `UT.GameplayAudio` (file asli â†’ beep cadangan). Audio sintetis FX Lab hanya referensi karakter bunyi.

**K4 â€” Glow. (usulan: setuju)** Mockup dipakai untuk warna & komposisi; bloom/glow di game dikurangi dan tidak boleh menutup pion/papan (standar Â§1). Flash layar: satu kali, alfa maks 0,28 (sama dengan FX Lab).

## 3. Spesifikasi angka Checkpoint 1.1 (nilai awal, diuji di game)

Sumber angka: FX Lab (`QM`, `QMAX`, `N()`, reduce Ã—0,4). Perbedaan untuk game: tiap partikel `fx.js` adalah satu `Mesh`, jadi batas aktif dibuat lebih rendah daripada Canvas 2D.

| Tier perangkat | Skala `FX.n` | Batas aktif (usulan) | Catatan |
|---|---|---|---|
| low | Ã—0,5 | 120 | HP lemah (`cores â‰¤2` atau `mem â‰¤2`) |
| medium | Ã—1,0 | 220 | **= perilaku sekarang** (confetti 110, ledakan 58) â†’ tanpa regresi visual |
| high | Ã—1,3 | 320 | sama dengan L3 FX Lab |
| ultra | Ã—1,6 | 450 | hanya bila pengguna memilih |

Aturan:
- `FX.n(base) = max(1, round(base Ã— skala Ã— (reduced ? 0.4 : 1)))`
- `FX.reduced()` membaca `matchMedia` **live** (listener `change`), bukan nilai sekali baca.
- Reduce-motion: partikel Ã—0,4, tanpa shake, flash diganti border statis (sama FX Lab).
- Swap Ender Pearl (2 ledakan = 116 mesh) dibatasi oleh batas aktif, bukan dikurangi manual.
- `ParticleFX.configure({maxParticles,maxBurst})` dipanggil sekali dari `FX.quality()` (default sekarang 60/20 tetap = medium).

## 4. Rincian kerja per checkpoint

**1.1 Dasar kualitas & reduce** (file: `src/gameplay/js/fx.js`, 1 baris sambungan di `main.js`, test baru)
- Tambah `FX.quality()`, `FX.n()`, `FX.reduced()` di `UT.GameplayFX`; ekspor tetap kompatibel.
- Sambungkan `ParticleFX.configure()`.
- `main.js:228` tidak ditulis ulang: ganti bertahap hanya di pemakai FX yang disentuh.
- Test baru `tests/gameplay-fx-core.test.js`: tierâ†’skala, reduce live, batas aktif, `n()` minimal 1. Jalankan ulang baseline `aura-fx`, `power3d`, `game-core`.

**1.2 Lifecycle**
- `clearConfetti()` ikut mengosongkan `sparks` (dispose material tiap spark, karena materialnya dibuat per partikel).
- `FX.track/stopAll`; `enderHole` didaftarkan agar ikut dibuang saat reset (kini tertinggal maks 2,3 dtk).
- `visibilitychange â†’ stopAll()` (pola FX Lab); jangan menghentikan tween yang ditunggu `await` gameplay, supaya `p.pos`/`slotPos` tetap diselesaikan.

**1.3 Cue `fid`**
- `fid = gameId:seq`; cue tanpa `fid` tetap diterima (kompatibel mundur).
- Perlu dicek di 1.3: apakah `enderVictimFx` (F11) tampil di klien yang ditukar.

## 5. Batasan dan yang belum diverifikasi

- Gerak/FPS/memori runtime dan uji dua klien **belum** dinilai (tidak ada browser/perangkat di sini). Angka tier di Â§3 adalah titik awal, wajib diuji di HP & desktop sebelum dianggap final.
- Test suite penuh belum dijalankan ulang di sesi ini; hasil PASS `aura-fx`, `power3d`, `game-core` diambil dari audit 01.
- Mockup dibaca dari kode, belum dibuka di browser.
- Tidak menyentuh: aturan damage, gerak, dadu, giliran, penyelesaian swap. Setelah perubahan aset: naikkan `VERSION` di `sw.js` dan jalankan `python3 tools/gen-preload-manifest.py`.

## 6. Langkah berikutnya

1. Konfirmasi K2 (A/B/C) â€” atau setujui rekomendasi A.
2. Kerjakan 1.1 di branch baru (bukan `main`), mis. `fx-core-1-1`, dari `main` @ `12ecb91`.
3. Laporan 1.1 di `audit/4/04-checkpoint-1-1.md`, commit + push setelah test lolos.

