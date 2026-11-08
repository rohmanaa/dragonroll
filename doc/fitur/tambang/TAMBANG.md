# Fitur Tambang (penambang emerald pasif)

> Dokumen hidup. Setiap selesai satu pekerjaan, ubah `[ ]` jadi `[x]` di bagian **Checklist** lalu commit.
> Prompt untuk AI lain yang melanjutkan ada di `PROMPT_LANJUTAN.md` (folder yang sama).
> Catatan lokasi: folder dokumen repo ini bernama `doc/` (bukan `docs/`), jadi file ini ada di `doc/fitur/tambang/`.

## 1. Ringkasan
Halaman baru `tambang.html`: tiga slot tambang. Tiap slot berisi satu penambang (karakter voxel, wajah berbeda dari karakter pemain)
yang menggali batu emerald, menghasilkan Emerald secara pasif per jam, disimpan di peti (chest) dengan kapasitas terbatas.
Pemain mengumpulkan (collect) Emerald dari peti ke dompet, membuka slot dengan Coin, dan meng-upgrade kecepatan, kapasitas,
serta memakai Percepat (boost) dengan Coin.

## 2. Aturan wajib (dari permintaan)
- **Semua data & hitungan di SERVER (Supabase).** Tanpa localStorage sebagai sumber data, tanpa mockup, tanpa angka hardcode di klien.
  Klien hanya menampilkan hasil RPC. Angka ekonomi ada di konstanta SQL (`c_*`) dan dikirim balik lewat `mine_get()` supaya UI tidak punya salinan sendiri.
- Waktu dipercaya dari server (`now()`), bukan jam perangkat. Penambahan Emerald memakai `_wallet_apply` (ledger idempoten), sama seperti dompet lain.
- Semua slot **terkunci** di awal. Penambang hanya muncul setelah slot dibuka.

## 3. Navigasi
| Dari | Tombol | Tujuan |
|---|---|---|
| Lobby | tombol **TAMBANG** (baru) | `tambang.html?from=lobby` |
| Semua halaman yang punya "+ Emerald" (`data-buy="gem"`) | `+` di samping Emerald | `tambang.html?from=<halaman asal>` (lihat catatan) |
| Tambang | **Back** (kiri atas) | kembali ke halaman asal (`from`); bila tidak ada `from` -> `lobby.html` |
| Tambang | **Home** (kanan atas, paling kanan) | `lobby.html` |

Contoh: dibuka dari Karakter -> `tambang.html?from=karakter.html` -> Back kembali ke `karakter.html`. Dibuka dari Lobby -> Back ke `lobby.html`.
`from` hanya diterima bila berupa nama file `.html` yang ada di daftar putih di klien (cegah open-redirect).

Catatan: sebelumnya "+ Emerald" membuka `shop.html?emerald=1` (modal tonton iklan). Keputusan pemilik: mulai sekarang menuju Tambang.
Panel iklan tetap ada di Toko. Dari Toko sendiri, "+ Emerald" tetap membuka modal iklan (bukan loncat ke Tambang).

## 4. Ekonomi (diseimbangkan ulang: peti awal 5, upgrade mahal)
Alasan: Emerald adalah alat tukar tertinggi, jadi produksi dibuat kecil dan sink Coin dibuat berat.
Acuan nilai: 10 Gem = 500 Coin (1 Gem ~ 50 Coin). Iklan = 5 Gem x maks 5/hari (25/hari). Boss CPU = 10 Gem x maks 5/hari.
Semua angka ada di fungsi `_mine_*` (migrasi `202611180001_tambang.sql`, lalu ditimpa oleh `202611190001_tambang_rebalance.sql`).

| Slot | Buka (Coin) | Dasar Emerald/jam (Lv1) | Penambang |
|---|---|---|---|
| 1 | 1.500 | 0.20 | skin NPC alex |
| 2 | 7.500 | 0.30 | skin NPC zombie |
| 3 | 30.000 | 0.50 | skin NPC skeleton |

Kecepatan (upgrade `speed`, Lv1-Lv5): pengali `1.00 / 1.25 / 1.50 / 1.75 / 2.00`. Biaya naik ke Lv2..Lv5 (Coin): `1.200 / 3.500 / 9.000 / 20.000`, dikali `1.0 / 1.5 / 2.0` untuk slot 1/2/3.

Kapasitas peti (upgrade `cap`, Lv1-Lv5): `5 / 8 / 12 / 16 / 20` Emerald. Biaya ke Lv2..Lv5 (Coin): `1.000 / 3.000 / 7.500 / 18.000`, dikali faktor slot yang sama.

Percepat (boost): pengali 2x selama 4 jam, biaya `400 / 600 / 900` Coin untuk slot 1/2/3, tidak bisa ditumpuk, maks 2x per slot per hari WIB.

Perkiraan hasil per hari (dikumpulkan tiap hari, tanpa boost; peti membatasi hasil):
- Semua Lv1: slot 1 = 4,8, slot 2 = 5 (peti penuh), slot 3 = 5 -> sekitar **15 Emerald/hari**. Peti 5 penuh dalam 25 / 17 / 10 jam, jadi ambil 1-2x sehari.
- Semua Lv5: peti 20, laju 0.4 / 0.6 / 1.0 per jam -> 9,6 + 14,4 + 20 = sekitar **44 Emerald/hari**.
- Total Coin untuk memaksimalkan semuanya: buka 39.000 + speed 33.700 x 4,5 = 151.650 + kapasitas 29.500 x 4,5 = 132.750, kira-kira **323 ribu Coin**.
- Emerald berbentuk bilangan bulat di dompet. Peti menghitung desimal (mis. 2,4), tombol Ambil memindahkan bagian bulat, sisa pecahan tetap di peti.

Batas keseimbangan: peti penuh berhenti produksi, boost dibatasi per hari, semua pembelian idempoten di ledger.

## 5. Desain database (migrasi baru, urutan setelah `202611150001_player_prefs.sql`)
File: `supabase/migrations/202611180001_tambang.sql` (+ `202611190001_tambang_rebalance.sql` untuk angka ekonomi terbaru). Setelah itu wajib `sh tools/build-schema-snapshot.sh` (tes snapshot gagal bila lupa).

Tabel `player_mines` (satu baris per user per slot):
`user_id, slot (1..3), speed_lv, cap_lv, stock numeric (isi peti saat stock_at), stock_at timestamptz, boost_until timestamptz null, boost_day date, boost_count int, collect_seq int, created_at`.
RLS aktif, tanpa policy -> tabel tidak bisa diakses langsung; hanya lewat RPC `security definer`.

Hitung produksi "malas" (lazy): saat ada aksi, server menyelesaikan (`_mine_settle`) isi peti = `min(kapasitas, stock + laju x jam_berlalu)`, dengan bagian waktu di dalam `boost_until` dihitung 2x. Tidak butuh cron.

RPC (semua `authenticated`, `revoke` dari `public, anon`):
| RPC | Fungsi |
|---|---|
| `mine_get()` | Konfigurasi ekonomi + status 3 slot: terkunci?, level, laju/jam efektif, isi peti, kapasitas, waktu boost, sisa jatah boost, biaya berikutnya. Menyelesaikan (settle) tanpa menulis. |
| `mine_unlock(p_slot)` | Kurangi Coin (ledger `mine_unlock`, ref `slot:N`), buat baris slot. Idempoten. |
| `mine_upgrade(p_slot, p_kind)` | `speed` atau `cap`. Kurangi Coin, naikkan level (ref `slot:N:kind:level` -> tidak bisa dobel). Settle dulu agar laju lama dihitung sampai saat ini. |
| `mine_boost(p_slot)` | Kurangi Coin, set `boost_until`, batasi 2x/hari WIB dan tidak bisa saat masih aktif. |
| `mine_collect(p_slot)` | Settle, ambil bagian bulat, tambah Emerald lewat `_wallet_apply` (reason `mine_collect`, ref `slot:N:seq`), sisakan pecahan. Return saldo baru. |

Error mengikuti pola dompet: `{ok:false, reason:...}` untuk kasus normal (`terkunci`, `sudah-dibuka`, `level-maks`, `saldo-kurang`, `boost-aktif`, `batas-harian`, `peti-kosong`), `AUTH_REQUIRED` untuk belum login.

## 6. Klien
- `assets/js/mine-service.js` (`UT.MineService`): pembungkus RPC seperti `wallet-service.js` (satu permintaan per kunci, tidak melempar saat jaringan gagal, menyegarkan cermin saldo lewat `PlayerData.applyServerWallet`). Bisa dimuat di Node untuk tes.
- `tambang.html`: pola halaman sama dengan `shop.html`/`karakter.html` (frame-guard, session, boot-guard, `ut-curbar` Coin/Emerald, tombol Back bergaya `#back`).
- Adegan 3D (three.js lokal) memakai `UT.CharacterView.make(THREE, key, emote)`; tiga penambang memakai skin NPC berbeda dari skin yang dipakai pemain.
  - Terkunci: bilik gelap + gembok + harga buka.
  - Aktif: penambang berdiri, ayun beliung ke batu emerald; partikel emerald kecil dan ikon emerald melayang di atas kepala; emote `cheer` saat peti baru terisi / selesai collect.
  - Peti penuh: penambang **duduk** istirahat dengan emote senang (animasi tambahan di halaman, bukan mengubah `character-view.js`; jika perlu pose duduk, tambahkan emote `sit` terpisah dan catat di dokumen ini).
  - Batu: voxel batu abu + bijih emerald; pecah kecil tiap ayunan.
- Panel tiap slot: Emerald/jam, isi peti `x / kapasitas`, bar peti, hitung mundur penuh, tombol Collect, Upgrade Kecepatan, Upgrade Kapasitas, Percepat (menampilkan sisa waktu boost).
- Ringkasan atas: total Emerald/jam semua slot dan perkiraan Emerald/hari.
- Saat tab kembali aktif dan tiap ~30 detik panggil `mine_get()` (sumber kebenaran); animasi hitungan isi peti hanya interpolasi tampilan dari angka server.

## 7. Berkas yang akan dibuat / diubah
Baru: `tambang.html`, `assets/js/mine-service.js`, `supabase/migrations/202611180001_tambang.sql`, `supabase/tests/tambang_test.sql`, `tests/mine-service.test.js`, dokumen ini.
Ubah: `lobby.html` (tombol TAMBANG + ACT), halaman dengan `data-buy="gem"` (arah ke Tambang jika diputuskan), `assets/js/app.js` (daftar `UT.Router.toTambang`), `sw.js`/preload manifest bila halaman perlu masuk daftar, `supabase/snapshot/00_full_schema.sql`, `README.md` (baris halaman).

## 8. Keputusan terbuka (tanyakan ke pemilik sebelum diubah)
- [x] "+ Emerald" di semua halaman: DIPUTUSKAN pemilik -> menuju Tambang (`tambang.html?from=<halaman>`). Panel iklan tetap ada di Toko (dibuka dari Toko saja).
- [ ] Skin NPC final untuk 3 penambang (sementara: pilih dari `UT.CharacterData.list('player')` yang berbeda dari skin pemain). Opsi lanjutan: karakter baru `penambang` dengan helm tambang.
- [x] Angka ekonomi di bagian 4: pemilik minta peti awal 5 dan harga lebih mahal (sudah diterapkan).
- [ ] Terapkan migrasi ke proyek Supabase produksi (dilakukan pemilik, bukan AI).

## 9. Checklist pekerjaan
Dokumentasi & desain
- [x] Riset pola repo (dompet server, RPC idempoten, navigasi, CharacterView)
- [x] Tulis dokumen fitur + ekonomi + desain (file ini)
- [x] Tulis prompt lanjutan (`PROMPT_LANJUTAN.md`)

Server
- [x] Migrasi `202611180001_tambang.sql` (tabel `player_mines`, RLS, helper `_mine_*`, 5 RPC)
- [x] Tes SQL `supabase/tests/tambang_test.sql` (buka, upgrade, boost, batas harian, kapasitas, collect idempoten, saldo kurang)
- [x] Perbarui snapshot (`sh tools/build-schema-snapshot.sh`) dan tes snapshot lulus
- [ ] Terapkan migrasi ke Supabase produksi (oleh pemilik)

Klien
- [x] `mine-service.js` + `tests/mine-service.test.js`
- [x] `tambang.html`: layout, Back (asal) + Home, bar Coin/Emerald
- [x] Adegan 3D: 3 bilik terkunci, penambang menggali, efek emerald, emote senang, pose duduk saat peti penuh
- [x] Panel slot: collect, upgrade kecepatan/kapasitas, percepat, hitung mundur
- [x] Tombol TAMBANG di lobby
- [x] Perilaku Back berdasarkan `from` (daftar putih) + tombol Home
- [x] "+ Emerald" di halaman lain diarahkan sesuai keputusan
- [x] Tambah ke daftar halaman `app.js` (UT.PAGES + presence) dan README
- [ ] Cek apakah halaman perlu masuk daftar preload splash (belum diperiksa)

Pengujian
- [ ] Uji manual dua akun: waktu berjalan di server, tutup tab lalu buka lagi, peti terisi sesuai jam
- [ ] Uji spam klik (Collect/Upgrade dua kali cepat) tidak dobel
- [x] Uji tampilan landscape (1280x720) dan portrait (390x844) di Chromium headless dengan layanan tiruan khusus uji (tidak ikut di repo)
- [ ] Uji di perangkat sungguhan + akun login (butuh migrasi sudah diterapkan di Supabase)

## 10. Rencana ke depan (belum dijanjikan)
- Slot 4+ atau jenis bijih lain (Coin dari tambang batu).
- Event/boost iklan berhadiah untuk Percepat (butuh verifikasi iklan sisi server, lihat batas kepercayaan di `wallet_b6_ad_reward.sql`).
- Notifikasi "peti penuh" dan misi harian "kumpulkan dari tambang".
- Cosmetic penambang (helm) dari toko.

## 11. Log pekerjaan
- 2026-11-08: dokumen dibuat; desain ekonomi & RPC disusun; belum ada kode.
- 2026-11-08: migrasi `202611180001_tambang.sql` + tes `tambang_test.sql` selesai dan LULUS di Postgres 16 lokal (semua migrasi dimuat dengan stub auth Supabase); snapshot skema diperbarui (22 migrasi). Belum: klien (mine-service, tambang.html), tombol lobby, routing "+ Emerald". Migrasi BELUM diterapkan ke Supabase produksi.
- 2026-11-08 (lanjutan): `mine-service.js` + tes, `tambang.html` (3 bilik 3D per slot, penambang skin NPC alex/zombie/skeleton, emote baru `mine` dan `sit` di `character-view.js`, efek emerald melayang, Zzz saat peti penuh, cheer saat Ambil), tombol TAMBANG di lobby, semua "+ Emerald" -> `tambang.html?from=<halaman>`, Back via `from`, Home ke lobby. Cabang ini sudah menggabungkan `fix/koin-ke-toko` (route "+ Coin" ke Toko). Belum: uji nyata dengan Supabase produksi, cek preload splash, wajah penambang khusus (helm tambang), suara.
- 2026-11-08 (rebalance): peti Lv1 = 5 (5/8/12/16/20), buka slot 1.500/7.500/30.000, upgrade kecepatan 1.200-20.000, kapasitas 1.000-18.000, boost 400/600/900. Migrasi baru `202611190001_tambang_rebalance.sql`, tes SQL diperbarui dan lulus.
