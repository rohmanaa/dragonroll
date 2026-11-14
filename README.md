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

