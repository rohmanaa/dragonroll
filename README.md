# DRAGON ROLL (Ular Tangga Blok)

Game ular tangga bertema voxel/Minecraft dengan mode solo, vs robot, dan multiplayer online (Supabase). Situs statis, tanpa build step, dan dipasang sebagai PWA.

## Menjalankan lokal

```sh
python3 -m http.server 8000
```

Buka `http://localhost:8000/` (masuk lewat `index.html` → `play.html?go=splash.html`). Service worker (`sw.js`) butuh `http://localhost` atau HTTPS, jadi jangan buka lewat `file://`.

## Halaman

| File | Fungsi |
|---|---|
| `index.html` | Pintu masuk, langsung ke splash lewat `play.html` |
| `play.html` | Pembungkus (frame) tempat halaman lain dimuat |
| `splash.html` | Layar naga + pramuat aset |
| `lobby.html` | Beranda: profil, koin, pintasan |
| `mode.html` | Pilih mode permainan |
| `room.html` | Game room multiplayer |
| `gameplay.html` | Game 3D (logika di `gameplay/`) |
| `karakter.html`, `dadu.html`, `efek.html`, `frame.html`, `powerup.html` | Koleksi & kustomisasi item |
| `shop.html` | Toko (koin/emerald virtual, bukan uang sungguhan) |
| `tambang.html` | Mini-game tambang |
| `hadiah-misi.html` | Hadiah harian, misi & pencapaian (versi lama `misi.html`/`dailyreward.html` diarsipkan di `old/`) |
| `friendship.html`, `leaderboard.html`, `profile.html`, `settings.html` | Sosial, peringkat, profil, pengaturan |
| `laporan-audit.html`, `floatingsample.html` | Dokumen audit / sampel (bukan bagian game) |

## Struktur kode

- `assets/js/` : layanan bersama (`player-data`, `wallet-service`, `item-catalog`, `auth`, `session`, `prefs`, dll.), `dice-kit/`, `power3d/`, `multiplayer/`, dan `vendor/` (three.js).
- `assets/css/` : gaya bersama.
- `gameplay/` : modul game (core, HUD, audio, efek, peta, AFK, dadu).
- `hud/` : komponen & tema HUD.
- `supabase/` : migrasi, snapshot skema, dan tes SQL. Lihat `supabase/README.md`.
- `tests/` : tes Node (`for f in tests/*.test.js; do node "$f"; done`).
- `tools/` : skrip bantu (snapshot skema, manifes pramuat, dll.).
- `doc/`, `MULTIPLAYER_PLAN.md`, `MULTIPLAYER_STATE.md` : catatan desain.

## Backend (Supabase)

Semua mutasi lewat RPC dengan pengecekan di sisi server; klien hanya memakai kunci publishable/anon (`assets/js/multiplayer/config.example.js`). Jangan pernah menaruh kunci `service_role` di repo.

Alur migrasi:

1. Tambah file di `supabase/migrations/` dengan timestamp yang **lebih besar** dari migrasi terakhir.
2. Jalankan `sh tools/build-schema-snapshot.sh` lalu commit snapshot-nya (tes `schema-snapshot` akan gagal kalau lupa).
3. Push ke `main`: CI (`.github/workflows/db-migrate.yml`) menjalankan tes lalu `supabase db push` ke produksi.

## Cache PWA

Setelah mengubah aset/kode yang harus segera segar, naikkan `VERSION` di `sw.js`.

## Struktur halaman (HTML / CSS / JS dipisah)

Halaman root (kecuali `gameplay.html`, yang punya struktur sendiri di `gameplay/`) hanya berisi markup. CSS dan JS halaman ada di:

- `assets/css/pages/<halaman>[-N].css` dan `assets/js/pages/<halaman>[-N].js` (tag dipasang di posisi yang sama dengan blok inline aslinya, jadi urutan cascade/eksekusi tidak berubah)
- Inline kecil (<300 karakter, mis. `UT.App.init({page:'x'})`) dan `importmap` tetap di HTML.
- `url()` di CSS relatif ke `assets/css/pages/` (`../../../assets/...`); `import()` dinamis di JS relatif ke `assets/js/pages/` (`../../../assets/js/...`).
- Alat: `python3 tools/extract-inline.py` (aman diulang). Penjaga: `tests/pages-split.test.js`. Tes statis yang membaca teks halaman memakai `tests/_page.js`.
- Tanpa CDN: font di `assets/fonts/` + `assets/css/fonts.css`, supabase-js di `assets/js/vendor/supabase-js-2.119.0.mjs` (dites `tests/no-cdn.test.js`).
- Setelah mengubah aset: naikkan `VERSION` di `sw.js` dan jalankan `python3 tools/gen-preload-manifest.py`.


## Mail: Catatan Perbaikan Bug (skema)

Status: **rancangan** (belum ada kode/migrasi). Dasarnya memakai sistem Mail yang sudah ada (`supabase/migrations/202611260001_player_mail.sql`, `assets/js/mail-service.js`, `mail.html`). Surat hanya dibuat server; hadiah masuk dompet lewat `_wallet_apply` dengan kunci idempoten per surat.

### Aturan
- **Satu surat per rilis** berjudul "Catatan Perbaikan #N" berisi **maksimal 15 bug** (satu baris per bug: area + masalah singkat). Bug berlebih menunggu rilis berikutnya.
- **Dikirim ke semua pemain** dengan `_mail_send_all(judul, isi, coin, gem, 'bugfix-<N>', kedaluwarsa)`. `dedupe_key` `bugfix-<N>` membuat kirim ulang aman (tidak ganda) dan jadi penanda surat jenis ini.
- **Hadiah: koin + emerald** (`gem` di server = emerald). Usulan: 200 koin + 5 emerald per surat (batas tabel: koin ≤ 1.000.000, gem ≤ 10.000).
- **Hadiah cair saat surat dibuka (dibaca)**, tanpa tombol Klaim. Cukup satu kali per akun per surat.

### Perubahan yang dibutuhkan (saat diimplementasi)
1. Migrasi baru (timestamp > migrasi terakhir): longgarkan batas `body` dari 500 ke 1200 karakter. 15 baris × ±70 karakter ≈ 1050, tidak muat di 500.
2. RPC baru `mail_open(p_id)`: tandai dibaca; bila `dedupe_key like 'bugfix-%'` dan belum diklaim, klaim lewat `_wallet_apply(..., 'mail', id)` dalam satu transaksi. Klien memanggilnya saat surat dibuka. `mail_read_all` **tidak** memberi hadiah, supaya hadiah hanya untuk yang benar-benar membuka surat.
3. `mail.js`: pakai `mail_open` untuk surat `bugfix-*`, lalu tampilkan hadiah yang masuk (komponen `rwHtml` sudah ada).
4. Tes SQL di `supabase/tests/` (klaim ganda ditolak, `mail_read_all` tidak memberi hadiah, hadiah masuk tepat sekali), jalankan `sh tools/build-schema-snapshot.sh`, naikkan `VERSION` di `sw.js`.

### Alur rilis
1. Kumpulkan bug yang sudah diperbaiki (maks. 15), tulis ringkas.
2. Kirim lewat SQL Editor: `select public._mail_send_all('Catatan Perbaikan #N', '<15 baris>', 200, 5, 'bugfix-N', now() + interval '30 days');`
3. Surat muncul di Mail semua pemain; yang membuka mendapat hadiah.

### Daftar awal (Catatan Perbaikan #1, 15 bug)
Status "diuji" = ada tes otomatis (statis) di `tests/`. Lainnya sudah di-commit tetapi **belum diuji ulang di perangkat**.

| # | Bug yang diperbaiki | Commit | Status |
|---|---|---|---|
| 1 | Pion diam di kepala ular/dasar tangga setelah Trident, Sword/TNT, jebakan, atau Swap | `4a4be87` | diuji |
| 2 | Pion diam di kepala ular setelah teleport Enderman / efek mob | `c8d85e4` | diuji |
| 3 | Slot item di Inventory tidak bisa diklik | `1e94699` | commit |
| 4 | Pantulan melewati petak 100 memunculkan panel Crystal | `97cf89f` | commit |
| 5 | Pemain terpental TNT ke petak mob tidak kena efek mob | `ab7b2ef` | commit |
| 6 | Ender Pearl swap tidak memicu jebakan di petak tujuan | `ab221f0` | commit |
| 7 | Map World: rumah & portal Nether salah tempat / tenggelam | `9b757aa` | commit |
| 8 | Bidak melayang di atas petak | `c31a084` | commit |
| 9 | Foto profil karakter tertutup latar | `6205e5d` | commit |
| 10 | Preview frame hilang | `c0bf5c5` | commit |
| 11 | Tombol Auto roll tidak bisa diklik setelah dock dadu | `6528704` | commit |
| 12 | Layar blank dari splash ke lobby | `5905aae` | commit |
| 13 | Aura pion sendiri terpotong di gameplay | `84357ae` | commit |
| 14 | Ledakan jebakan di tengah layar & Auto roll jalan saat memilih petak jebakan | `b040a80`, `6da8ca6` | commit |
| 15 | Lantai arena berkedip (z-fighting) | `b68ccbc` | commit |

Catatan: 8 tes lama sedang gagal (`aura-catalog`, `aura-view`, `blocky-actions`, `gameplay-win-result`, `pet-catalog`, `power-rules`, `store-card-status`, `gameplay-dice-throw-race`). Itu ada sebelum perbaikan Power di atas dan perlu dicek apakah tesnya kedaluwarsa atau ada regresi sungguhan sebelum surat dikirim.
