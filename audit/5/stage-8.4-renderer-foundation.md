# Dragon Roll — Stage 8.4: Renderer Foundation & Rig Adapter

## Status

**IMPLEMENTASI FONDASI SELESAI; renderer halaman dan Gameplay belum diintegrasikan.**
`BlockyCharacter` tetap API renderer yang dipakai pemanggil lama. `CharacterData`
menyimpan definisi geometri dan metadata rig enam karakter, sementara adapter
membuat base rig terartikulasi tanpa mengubah pilihan renderer halaman.
`CharacterView` tetap tersedia.

Tidak ada migrasi ID, perubahan PlayerData, Look, Gear, Outfit, Aura, ownership,
transaksi, database/RPC, aturan Gameplay, `makePawn()`, atau script konsumen halaman.

## 1. Git dan checkpoint

| Pemeriksaan | Hasil |
|---|---|
| Branch | `restruktur` |
| Baseline sebelum Stage 8.4 | `618e00f7` (Stage 8.3) |
| Awal checkpoint Rig Adapter | `0ef446e3ec40d987e3706081a25b864e3e34c791`; sama dengan `origin/restruktur` |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Checkpoint 1 — generator | `0ef446e3ec40d987e3706081a25b864e3e34c791`; sudah di-push |
| Checkpoint 2 — Rig Adapter | `06ec773ba15b7331f1239712eabaedfb30db6036`; sudah di-push ke `origin/restruktur` |
| Audit | Commit terpisah setelah checkpoint implementasi; SHA akhir dicatat pada hasil penyelesaian |

`main` dan `origin/main` tidak diubah. Pemeriksaan akhir branch, kesamaan HEAD
dengan remote, worktree bersih, dan hash audit dilakukan setelah commit laporan.

## 2. Sumber otoritatif dan generator

### BlockyCharacter

Generator lama mencari section bernomor di `karakter.html`, tetapi halaman itu
tidak memiliki marker tersebut. `assets/js/pages/karakter.js` adalah implementasi
editor Karakter yang berbeda, bukan sumber API reusable `UT.BlockyCharacter`.
Sumber reusable yang dipilih adalah `tools/blocky-character/template.js`;
`tools/blocky-character/build.js` memvalidasi marker sumber, factory, API lama,
dan seluruh action sebelum menulis `assets/js/blocky-character.js`.

Generator mendukung `--check` untuk membuktikan asset hasil generate identik
dengan template. Generator hanya dijalankan setelah validasi sumber/paritas
berhasil. API/action yang dipertahankan mencakup `create`, `loadFromPlayer`,
`loadFromData`, `loadPreset`, `setMode`, `jump`, `tick`, `act`, `setTool`,
`bow`, `bowReleaseAt`, `setBowAim`, `strikes`, `acting`, `config`, `airborne`,
dan `height`; termasuk action `spinball`, `toss`, `dribble`, `throw`, `mine`,
serta action lain yang sudah ada.

### CharacterData

`gameplay.html` memuat `gameplay/js/main.js`; fungsi pembentuk model aktif berada
di modul tersebut, bukan inline di HTML. `tools/character-data/extract.js`
sekarang mengambil definisi dari modul aktif itu dan menormalkan CRLF sebelum
mengekstrak fungsi. Metadata rig diletakkan di `tools/character-data/build.js`
sebagai bagian definisi model, lalu ditulis oleh template generator. Dengan
demikian metadata tidak hilang saat CharacterData diregenerasi dan tidak
disalin ke manifest Character Registry.

```text
tools/blocky-character/template.js
            | build.js: validasi kontrak + --check
            v
assets/js/blocky-character.js
            |
            +-- createBaseRig(...) -> CharacterRigAdapter

gameplay/js/main.js -> character-data/extract.js
            |         + metadata rig di character-data/build.js
            v
tools/character-data/template.js -> assets/js/character-data.js
```

## 3. Desain Rig Adapter

`UT.CharacterData.get('player', key).rig` menyediakan definisi rig. API baru
`UT.CharacterRigAdapter.resolve(key)` memeriksa metadata tanpa membuat mesh;
`create(THREE, key, opts)` menghasilkan root, node per bagian dengan pivot,
bounds/ukuran per bagian, anchors, capabilities, batasan anchor fisik, dan
`dispose()`. `UT.BlockyCharacter.createBaseRig(THREE, key, opts)` adalah pintu
komposisi tambahan; tidak dipanggil oleh halaman atau Gameplay pada tahap ini.

| Model | Tipe / bagian rig | Bounds sumber (lebar × tinggi × dalam) | Catatan |
|---|---|---:|---|
| Steve | humanoid: head, torso, dua lengan, dua kaki | `0.50 × 0.83 × 0.327` | Geometri dari `CharacterData.player.steve` |
| Alex | humanoid | `0.50 × 0.83 × 0.327` | Mempertahankan model sumber Alex |
| Zombie | humanoid | `0.50 × 0.83 × 0.327` | Mempertahankan warna dan detail model Zombie |
| Skeleton | humanoid | `0.50 × 0.83 × 0.327` | Mempertahankan box dan detail berwarna tulang dari `makePawn()` |
| Creeper | creeper: head, torso, empat kaki | `0.32 × 0.79 × 0.312` | Gait empat kaki; tidak memiliki lengan atau anchor tangan humanoid |
| Enderman | ender: head, torso, dua lengan, dua kaki | `0.30 × 1.12 × 0.317` | Mempertahankan bagian panjang dan proporsi tinggi |

Nilai bounds diambil dari definisi Gameplay; tes memeriksa bounds hasil mesh
terhadap sumber dengan toleransi `0.002`. Model pemain Skeleton yang menjadi
sumber saat ini adalah model `makePawn()` berpalet/detail tulang, bukan geometri
mob `addSkeleton()` yang terpisah. Adapter tidak mengganti atau mengarang model
baru: bentuk sumber yang ada tetap dipertahankan.

Metadata mencakup jenis rig, bagian dan indeks box, pivot, anchor kepala/torso/
punggung serta anggota tubuh bila tersedia, capability locomotion/action, dan
anchor fisik untuk perlengkapan. `gearConstraints.availableAnchors` hanya
mendeskripsikan anchor yang ada; ini bukan whitelist Gear atau aturan equip.
Look, Gear, Outfit, dan Aura tidak diterapkan atau diubah.

`CharacterData.player.villager` tetap merupakan data NPC/CPU dan tidak mendapat
rig item Karakter. Model tidak dikenal menghasilkan alasan kegagalan eksplisit;
fallback hanya digunakan jika pemanggil menyebut `fallbackKey` secara eksplisit.

## 4. Kompatibilitas dan batas integrasi

- `UT.CharacterData` mempertahankan API lama `list`, `get`, `svg`, `face`,
  `mesh`, `SEATS`, dan `groups`; `get()` hanya mendapat metadata `rig` aditif.
- `UT.BlockyCharacter.create()` beserta API publik yang sudah dipakai halaman dan
  Gameplay tidak diganti. `createBaseRig()` adalah API tambahan.
- `CharacterView` dan seluruh pemanggilnya tidak diubah.
- Rig adapter membangun satu mesh per bagian rig di dalam base rig yang
  dikembalikan. Ia tidak ditempelkan ke root renderer lama pada tahap ini; tidak
  ada dua geometri badan yang ditumpuk saat runtime halaman.
- Belum ada sinkronisasi identitas Karakter dengan Look/Gear, adaptasi animasi
  per rig, whitelist perlengkapan, atau perubahan perilaku fallback halaman.
- `CharacterData` harus dimuat sebelum pemanggilan `createBaseRig()`. Tidak ada
  HTML/script chain yang diubah; kegagalan adapter yang belum tersedia dilaporkan
  eksplisit sebagai `rig-adapter-unavailable`.
- `assets/preload-manifest.json` tidak diubah: kedua file JS yang berubah bukan
  entri preload pada manifest. Versi Service Worker dinaikkan ke `ut-pwa-v182`
  agar cache kode lama dibersihkan; ekspektasi versi pada tes parity Aura,
  Character, Dice, dan Power ikut diperbarui.

## 5. File yang dibuat/diubah

### Checkpoint 1 — generator BlockyCharacter

- Diubah: `tools/blocky-character/build.js`,
  `tools/blocky-character/template.js`, `assets/js/blocky-character.js`,
  `tests/blocky-actions.test.js`.
- Dibuat: `tests/blocky-character-generator.test.js`.
- Tujuan: menetapkan template sebagai sumber, validasi API/action, pemeriksaan
  paritas deterministik, dan menjaga tes runtime mengikuti pemisahan modul aktif.

### Checkpoint 2 — CharacterData dan Rig Adapter

- Diubah: `tools/character-data/build.js`, `tools/character-data/extract.js`,
  `tools/character-data/template.js`, `assets/js/character-data.js`,
  `tools/blocky-character/build.js`, `tools/blocky-character/template.js`,
  `assets/js/blocky-character.js`, `sw.js`,
  `tests/aura-registry-parity.test.js`,
  `tests/character-registry-parity.test.js`,
  `tests/dice-registry-parity.test.js`,
  `tests/power-registry-parity.test.js`.
- Dibuat: `tests/character-rig-adapter.test.js`.
- Tidak ada file PlayerData, Registry manifest, halaman, Gameplay, server, SQL,
  Supabase, atau format Look yang berubah.

## 6. Pengujian dan hasil

### Tes otomatis terarah

| Pemeriksaan | Hasil |
|---|---|
| `node tests/blocky-character-generator.test.js` | Lulus: marker, API/action, determinisme, asset sama dengan template |
| `node tests/blocky-actions.test.js` | 16 tes lulus; action lama termasuk `spinball`, `toss`, `dribble`, `throw`, dan `bow` tersedia |
| `node tests/character-rig-adapter.test.js` | Lulus: enam model, box coverage, pivot, ukuran, bounds, disposal, Creeper, Enderman, fallback eksplisit, Three tidak tersedia |
| `node tests/character-registry-parity.test.js` | 9/9 lulus; ID, metadata, fallback, slot `equipped.skin`, dan `look.skin` tetap |
| `node tools/character-data/build.js --check` | Lulus; asset CharacterData sama dengan generator, 50,120 byte |
| `node tools/blocky-character/build.js --check` | Lulus; asset BlockyCharacter sama dengan template, 64,432 byte |
| `node --check` pada asset JS dan `sw.js` | Lulus |
| `git diff --check` | Lulus |

Paritas data dibanding checkpoint sebelum Rig Adapter mengonfirmasi geometri
semua 19 rekaman model CharacterData tidak berubah; yang ditambahkan adalah
metadata rig dan adapter. Villager tetap bukan item Character Registry.

### Suite Node penuh dan baseline

Semua file `tests/**/*.test.js` dijalankan pada checkpoint implementasi dan
diulang pada worktree baseline terpisah (`0ef446e`):

| Suite | File tes | Exit sukses | Gagal |
|---|---:|---:|---:|
| Baseline Stage 8.4 | 61 | 57 | 4 |
| Setelah checkpoint 2 | 62 | 58 | 4 |

Empat kegagalan identik pada baseline dan sesudah perubahan, sehingga tidak
disebabkan Stage 8.4:

1. `gameplay-win-result.test.js`: assertion tiga referensi gambar hasil tidak
   cocok dengan HTML saat ini.
2. `pet-catalog.test.js`: tes mengharapkan route `pet:'pet.html'` di `lobby.html`
   yang tidak ada pada baseline.
3. `power-rules.test.js`: tes tidak menemukan pemicu `trapCheck` yang
   diharapkannya di Gameplay.
4. `schema-snapshot.test.js`: gagal menjalankan `sh` (`spawnSync sh ENOENT`) pada
   environment Windows ini.

Tes baru Rig Adapter lulus. Ekspektasi versi Service Worker pada tiga tes
Registry (Aura, Dice, Power) diperbarui dari v181 ke v182 dan lulus sesudahnya.
Suite SQL bergantung pada konfigurasi eksternal; hasil proses suite tidak
membuktikan koneksi database live.

### Batas verifikasi

Semua hasil di atas adalah tes otomatis Node. Tes adapter memuat modul dalam VM
dan menggunakan Three.js yang ada di repository untuk memeriksa geometri dan
bounds. Tidak ada jsdom, browser nyata, screenshot/visual, audio, sesi Gameplay
langsung, performa FPS, atau pengujian server/Supabase live. Karena tidak ada
halaman yang memakai rig baru, hasil ini tidak menyatakan visual integrasi
halaman atau animasi rig telah tervalidasi.

## 7. Risiko dan dependensi berikutnya

Sebelum integrasi konsumen:

1. Tinjau hasil visual enam rig di browser, terutama pivot Creeper/Enderman dan
   framing Skeleton, tanpa mengubah renderer halaman pada tahap fondasi ini.
2. Tetapkan aturan Look dan Gear per rig serta tindakan visual untuk action yang
   memerlukan tangan. Data tersimpan/ownership tetap harus dipertahankan.
3. Rancang bagaimana base rig menggantikan geometri lama di `BlockyCharacter`
   dalam root yang sama; jangan menambahkan base rig di atas geometri badan lama.
4. Uji locomotion/action, tinggi/anchor Aura, dan lifecycle resource per rig
   sebelum integrasi Lobby, Profile, Room, atau Gameplay.
5. Setelah kontrak resolver dan load order disetujui, integrasikan satu konsumen
   dahulu dan pertahankan `CharacterView` sebagai fallback selama masih dipakai.
   Katalog/pembelian Karakter tetap tahap terpisah.

Stage 8.4 tidak mengambil keputusan produk tambahan tentang kompatibilitas Look,
whitelist Gear, gerakan Creeper, tinggi Enderman, migrasi ID, atau penghapusan
`CharacterView`.
