# Stage 8.1 — Desain Arsitektur Karakter

## Status dan batas audit

**Status: DESIGN COMPLETE / IMPLEMENTATION NOT STARTED.** Dokumen ini hanya merancang arsitektur dan rencana migrasi. Tidak ada source code, ID, gameKey, database, RPC, localStorage, atau struktur folder yang diubah.

Audit memeriksa implementasi pada branch `restruktur`, laporan Stage 1–8.0 di `audit/5/`, serta halaman, modul, manifest, migrasi Supabase, dan tes yang dirujuk di bawah.

| Pemeriksaan Git awal | Hasil |
|---|---|
| Branch | `restruktur` |
| HEAD | `1aec123abb99f64817138969e018574ee34098d3` |
| `origin/restruktur` | sama dengan HEAD |
| `main` dan `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Worktree | bersih |

Tes otomatis, jsdom, tes SQL, dan browser nyata **tidak dijalankan**: tahap ini audit/desain saja dan tidak mengubah perilaku. Tidak ada klaim verifikasi visual, animasi, audio, atau gameplay.

## Keputusan glossary yang dipertahankan

Keputusan berikut berasal dari instruksi Stage 8.1 dan glossary Stage 8.0:

- Nama kategori UI: **Karakter**.
- Kategori visual: **Aura**; istilah teknis `AuraFX` dan `AuraView` tetap.
- Kategori perlengkapan: **Perlengkapan**.
- Set kombinasi: **Outfit**.
- Pilihan papan: **Peta**.
- Nama mata uang UI: **Koin**; **Emerald** tetap.
- `skin.*`, `kind: skin`, dan `equipped.skin` belum diganti pada tahap ini. Migrasi ke `character` hanya rancangan.
- `look.skin` adalah warna kulit bernilai `s1`–`s5`; bukan ID karakter dan tidak boleh dimigrasikan bersama `skin.*`.

## 1. Kondisi arsitektur saat ini

### Katalog dan definisi identitas

[item-catalog.js](../../assets/js/item-catalog.js) memiliki enam item `kind: skin`, seluruhnya `renderer: 'palette'` dan `texture: null`:

| ID sekarang | Nama | gameKey | Rarity | Harga katalog | Status |
|---|---|---|---|---:|---|
| `skin.steve` | Steve | `steve` | common | 0 | starter/default |
| `skin.alex` | Alex | `alex` | common | 0 | starter |
| `skin.creeper` | Creeper | `creeper` | common | 0 | starter |
| `skin.zombie` | Zombie | `zombie` | common | 0 | starter |
| `skin.skeleton` | Skeleton | `skeleton` | rare | 300 Koin | bukan starter |
| `skin.ender` | Enderman | `ender` | epic | 700 Koin | bukan starter; featured |

Harga dan status tersebut juga tercermin pada seed `item_catalog` di [202611110002_wallet_b2_server.sql](../../supabase/migrations/202611110002_wallet_b2_server.sql) dan snapshot schema. `claim_daily_reward()` memberikan `skin.ender` pada klaim ke-7; `buy_item()` secara umum mendukung item dengan harga.

Belum ada kategori atau manifest `skin`/`character` di [ItemRegistry](../../assets/js/item-registry.js). Katalog masih membangun enam item Skin dari builder legacy. Registry lain mendaftarkan manifest per item lewat `data/inventory/<kategori>/<gameKey>/manifest.js` dan index kategori, kemudian [ItemCatalog](../../assets/js/item-catalog.js) mengadopsi metadata sambil menyediakan fallback legacy. Adapter karakter sebaiknya mengikuti pola itu dan tidak mengambil alih kepemilikan atau transaksi.

Model dasar bukan file aset per item. [character-data.js](../../assets/js/character-data.js) menyimpan geometri voxel yang diekstrak dari `gameplay.html` oleh `tools/character-data/build.js`. Grup `player` memiliki model untuk enam `gameKey` di atas serta `villager`; Villager juga berfungsi sebagai NPC/CPU dan tidak tercatat sebagai item karakter di ItemCatalog. [CharacterView](../../assets/js/character-view.js) memahami key/ID Skin dan rig khusus (mis. Ender/Creeper), tetapi belum menerapkan `look` dan Gear pemain.

### State pemain, Appearance, Perlengkapan, dan Outfit

[player-data.js](../../assets/js/player-data.js) adalah state client tunggal. Bentuk relevan:

- `inventory`: map ID item ke jumlah dan metadata lokal.
- `equipped`: map slot ke ID item; saat ini slot karakter adalah `skin`.
- `look`: gender, `skin` (`s1`–`s5`), mata, rambut, dan ukuran tubuh.
- `gearDye`: warna untuk item Gear.
- `outfits`: set Gear yang tersimpan.

Default `skin.steve` dan starter lain mengikuti ItemCatalog. Key localStorage saat ini `ularTanggaBlok:player:v1` dan suffix akun; `SCHEMA` serta `MIGRATION_VERSION` saat ini 1.

Halaman [karakter.js](../../assets/js/pages/karakter.js) memuat dan menyimpan `look` serta Gear melalui `PD.setLook`, `PD.equip`/`PD.unequip`, dan `PD.setGearDye`. Tab bernama “Kulit” di halaman ini memilih **warna** `look.skin`, bukan item `skin.*`. Tidak ditemukan pemilih atau tombol beli untuk enam item `skin.*` di halaman Karakter. [inventory.js](../../assets/js/pages/inventory.js) juga belum memiliki tab Karakter; Shop utama hanya memuat peti, Koin, Emerald, dan riwayat. Server menyediakan pembelian umum dan hadiah Enderman, tetapi jalur UI beli Skeleton/Enderman sebagai item katalog belum ditemukan.

Gear tetap `kind: gear` dengan slot `g.*`; validasi server saat ini menilai kepemilikan dan gender Gear, bukan kompatibilitas dengan model karakter tertentu. Outfit adalah domain terpisah: `player_outfits` menyimpan maksimal lima set Gear berisi gender, bagian pakaian/aksesori, dan dye. Outfit tidak menyimpan ID karakter, `look`, atau Aura. Perubahan ini tidak diperlukan untuk migrasi identitas karakter.

### Appearance server dan transaksi

[appearance-service.js](../../assets/js/services/appearance-service.js) mengambil `inventory_get`, lalu `appearance_get`, dan memuat Outfit. Jika Appearance belum ada di server, klien mengirim keadaan lokal melalui `appearance_save(p_look, p_equipped, p_gear_dye)`. Perubahan equip lokal disinkronkan dengan debounce; PlayerData tetap menjadi cermin state client, sedangkan server memvalidasi.

Di Supabase:

- `item_catalog.id` dan `kind` mendefinisikan katalog server.
- `player_inventory` menyimpan kepemilikan dengan FK ke katalog.
- `player_appearance.equipped` menyimpan slot equip sebagai JSON; `look` dan `gear_dye` disimpan terpisah.
- `_item_equip_slot()` memetakan `kind: skin` ke slot `skin`; `_appearance_normalize()` memeriksa slot, katalog, dan kepemilikan.
- Outfit memiliki tabel/RPC sendiri dan tidak memuat item karakter.

Tidak ditemukan kebutuhan untuk mengubah tabel/RPC Outfit. Migrasi identitas akan menyentuh katalog, inventori, normalisasi Appearance, RPC Appearance, seed/hadiah, serta snapshot schema.

### Selection, renderer, Lobby, Room, dan Gameplay

Saat ini ada dua jalur visual yang tidak setara:

1. **Renderer identitas voxel:** [CharacterData](../../assets/js/character-data.js), [CharacterView](../../assets/js/character-view.js), dan [ItemArt](../../assets/js/item-art.js) dapat memilih model lewat `skin.<gameKey>`/`gameKey`.
2. **Renderer Appearance pemain:** [BlockyCharacter](../../assets/js/blocky-character.js), yang dihasilkan oleh `tools/blocky-character/build.js` dari `karakter.html`, membangun tampilan dari `look` dan Gear. `loadFromPlayer()` dan `loadFromData()` tidak membaca `equipped.skin`.

[CharacterFace](../../assets/js/character-face.js), Lobby dan Profile memakai `BlockyCharacter` untuk wajah/model utama sehingga modern 3D tersebut mengabaikan identitas `equipped.skin`. Fallback ItemArt/thumbnail masih dapat membaca `equipped.skin`, dan jalur pawn lama Gameplay memakai `gameKey`; akibatnya tampilan bisa berbeda menurut renderer/fallback.

Alur online memakai `room_appearance_get`: [room.js](../../assets/js/pages/room.js) mengirim Appearance sebelum permainan; [gameplay main.js](../../gameplay/js/main.js) memakai `loadFromData(look, equipped, gear_dye)` untuk pemain lain dan `loadFromPlayer()` untuk pemain lokal. Kedua jalur `BlockyCharacter` tetap hanya menggunakan `look` dan Gear. `game-integration.js` dan [room-flow.js](../../assets/js/room-flow.js) masih memakai `equipped.skin`, `kind: skin`, dan daftar `skins` berbasis `gameKey` untuk konfigurasi permainan.

Aura sudah terpisah dari identitas dan Appearance. `equipped.aura` dibaca oleh AuraView dan satu AuraFX engine bersama menempel pada root karakter di Lobby/Gameplay. Pertahankan jalur tersebut; jangan salin renderer atau efek ke manifest karakter.

### Public profile dan room payload

[room.js](../../assets/js/pages/room.js) membentuk `characterSkinId` dari `PD.equippedId('skin')` (ID penuh seperti `skin.steve`). RPC `set_game_public_profile` menyaring kunci yang diizinkan dan panjang string, tetapi tidak memvalidasi ID melalui katalog. Tes SQL contoh mengirim nilai pendek `steve`, sehingga bentuk nilai kontrak lama belum konsisten. `characterSkinId` adalah bagian `public_profile` pada data room, bukan sumber Appearance; `room_appearance_get` mengambil `player_appearance` terpisah. Pencarian tidak menemukan konsumen Gameplay aktif untuk `characterSkinId`.

Ada pula ketidaksesuaian `effectId` pada payload profil publik: `room.js` membacanya dari slot `effect`, sedangkan state equip Aura menggunakan slot `aura`. Jangan menganggap field tersebut sebagai kontrak sinkronisasi Aura.

## 2. Diagram hubungan saat ini

```text
ItemCatalog (skin.*, kind=skin, gameKey)
  |                         \
  |                          +--> ItemArt / CharacterData / CharacterView
  |                               (sebagian tampilan memakai identitas skin)
  v
PlayerData
  |-- inventory[skin.*]          (cermin kepemilikan)
  |-- equipped.skin = skin.*     (pilihan karakter lama)
  |-- look.skin = s1..s5         (warna kulit; domain appearance)
  |-- equipped[g.*] + gearDye
  |-- outfits[]                  (set Gear, bukan identitas/Look/Aura)
  |
  +--> AppearanceService --> appearance_save/get --> Supabase
  |                              player_inventory
  |                              player_appearance
  |                              player_outfits
  |
  +--> BlockyCharacter.loadFromPlayer/loadFromData
  |       (look + Gear; tidak membaca equipped.skin)
  |       + AuraView --> AuraFX bersama
  |
  +--> game-integration / room-flow --> gameplay config `skins` (gameKey)
          +--> jalur pawn legacy memakai skin key
          +--> jalur BlockyCharacter memakai look + Gear

Room public_profile.characterSkinId (metadata terpisah; bukan Appearance)
```

## 3. Peta aliran data yang diminta

| Tahap | Sumber/fungsi aktual | Temuan dan potensi duplikasi |
|---|---|---|
| 1. Memperoleh karakter | Starter dari `ItemCatalog.starters()`; Enderman dari `claim_daily_reward`; pembelian server melalui `buy_item` | Empat Skin starter lokal; server memiliki data keenam Skin. Tidak ditemukan UI katalog untuk membeli/menjelajahi item Skin di Shop/Inventory/Karakter. |
| 2. Menyimpan kepemilikan | `PlayerData.inventory`; server `player_inventory` | PlayerData adalah cermin client; server otoritatif untuk akun. Jangan menambah collection/ownership store baru. |
| 3. Memilih karakter | API `PD.equip(id)` dan slot `equipped.skin` tersedia | Tidak ada pemilih item karakter aktif di `karakter.js`; halaman itu hanya mengubah warna `look.skin` dan Gear. Gameplay tetap membaca slot lama. |
| 4. Memuat `look` | `PD.look()`; `AppearanceService.refresh()` / `applyServerAppearance()` | `look.skin` adalah warna s1–s5. Tidak boleh dipetakan ke `character.*`. |
| 5. Menerapkan Perlengkapan | `PD.gearLook()`, `BlockyCharacter.loadFromPlayer/loadFromData()` | Gear memakai slot `g.*` dan `gearDye`; kompatibilitas server berbasis gender. Model karakter tidak menjadi sumber kepemilikan Gear. |
| 6. Menyimpan/memanggil Outfit | `PD.outfits()`; RPC `outfit_save/list/rename/delete`; `player_outfits` | Data set saat ini hanya Gear/aksesori/dye. Tidak ada ID karakter, Look, atau Aura. |
| 7. Menerapkan Aura | `equipped.aura` → `AuraView` → `AuraFX` | Satu sistem bersama; Appearance server mengirim slot Aura. Tidak perlu memasukkan Aura ke Character Registry atau Outfit. |
| 8. Sinkron Appearance | `AppearanceService.pushAppearance/refresh`; RPC `appearance_save/get` | Server memvalidasi kepemilikan/slot; Appearance mencakup `equipped`, `look`, `gear_dye`. |
| 9. Lobby | `lobby.js`, `CharacterFace`, `BlockyCharacter`; `refreshThrottled()` | Model utama membaca Look/Gear, bukan `equipped.skin`; fallback ItemArt dapat membaca Skin lama. |
| 10. Room dan Gameplay | `room.js` mem-push Appearance; `room_appearance_get`; `gameplay main.js` `applyOnlineLooks()` | Model modern remote/local membaca Look/Gear; jalur legacy dan room config tetap membawa gameKey Skin. Perbedaan renderer perlu diselesaikan saat implementasi. |

## 4. Batas tanggung jawab domain

| Domain | Tanggung jawab saat ini | Batas target |
|---|---|---|
| A. Character Definition | Belum ada Registry khusus; identitas berada di enam item `skin.*` dan pemetaan model `CharacterData.player` | Definisi stabil: ID, gameKey, nama/deskripsi, rarity/harga/status katalog, dan referensi `baseModelKey`. Tidak menyimpan state pemain, geometri, Look, Gear, Outfit, atau efek Aura. |
| B. Character Appearance | `PlayerData.look` dan `gearDye`; gender, warna kulit, mata, rambut, ukuran tubuh | Tetap menjadi konfigurasi penampilan pemain. `look.skin` tetap warna kulit. Character Definition dapat menentukan model dasar, tetapi bukan pemilik data Appearance. |
| C. Character Selection | `PlayerData.inventory` + `equipped.skin`, default/fallback `skin.steve` | Tetap satu state PlayerData. Slot target `equipped.character`; pemilihan/validasi memakai item yang dimiliki. |
| D. Perlengkapan | `kind: gear`, slot `g.*`, dye, gender; renderer mengaplikasikan Gear | Registry/aturan Gear tetap terpisah. Integrasi model karakter hanya menjadi konteks renderer; jangan duplikasi item, slot, ownership, atau aturan server. |
| E. Outfit | Set Gear di PlayerData dan `player_outfits` | Tetap paket Gear. Jangan mengubah payload/tabel agar berisi karakter/Look/Aura tanpa keputusan produk terpisah. |
| F. Aura | Slot opsional `aura`, AuraView dan AuraFX | Tetap domain mandiri yang ditempel ke root Character oleh renderer/scene bersama. |
| G. Model dan Renderer | CharacterData hasil ekstraksi, CharacterView, BlockyCharacter, CharacterFace, ItemArt, serta jalur Gameplay lama | Registry hanya memberi identitas/referensi model. Satu adapter presentasi merangkai definisi karakter + Look + Gear; renderer tidak dimasukkan ke manifest dan sistem bersama tidak digandakan. |

## 5. Usulan arsitektur target

```text
data/inventory/character/<gameKey>/manifest.js
                    |
data/inventory/character/index.js
                    |
              ItemRegistry
                    |
        CharacterCatalog adapter
          |                     \
          v                      v
  ItemCatalog API lama      CharacterDefinition
  (projection/fallback)           |
          |                       |
          +---- PlayerData -------+----> CharacterPresentation adapter
                 |                       (resolver/composer; bukan state store)
                 |                           |
        inventory/equipped.character        +--> player renderer
        look + gearDye + gear slots          +--> AuraView/AuraFX overlay
        Outfit (tetap terpisah)              +--> preview/fallback adapters
                                             |
                      Lobby / Profile / Room / Gameplay

Server: katalog + inventory + appearance + RPC tetap otoritatif.
```

### Rekomendasi Registry dan renderer

**Rekomendasi: Character Registry menyimpan identitas karakter saja; bukan gerbang Registry untuk seluruh sistem penampilan.** Look, Gear, Outfit, Aura, renderer, dan ownership tetap domain masing-masing. Komposisi visual dapat memakai adapter tipis, tetapi adapter itu tidak menyimpan state kedua.

Untuk enam identitas berbeda (termasuk Creeper dan Enderman), hanya mengganti label/kind sambil membiarkan `BlockyCharacter` mengabaikan identitas tidak cukup. Ada dua jalur visual sekarang:

1. Perluas player renderer bersama berbasis `BlockyCharacter` agar dapat menerima `baseModelKey` dari Character Definition sekaligus Look/Gear; ini menjaga satu runtime utama untuk pemain dan Gameplay, tetapi membutuhkan integrasi rig/geometri yang teruji.
2. Jadikan `CharacterView` basis player dan tambahkan dukungan Look/Gear; renderer itu sudah memilih model `CharacterData`, tetapi saat ini belum menerapkan Look/Gear dan berisiko membuat renderer pakaian baru.

**Usulan untuk implementasi nanti:** pertahankan `BlockyCharacter` sebagai jalur runtime Appearance/animasi pemain, dan buat adapter menuju model dasar `CharacterData` tanpa menyalin sistem Aura atau membuat sumber geometri kedua. Sebelum implementasi, pengguna perlu menyetujui bahwa item karakter memang menentukan model dasar (mis. Enderman/Creeper), bukan hanya ikon/label. Kontrak akhir pemilihan renderer adalah keputusan yang belum dikunci.

`CharacterFace`, Lobby, Profile, Room, dan Gameplay harus menerima identitas karakter yang sama melalui adapter; fallback ItemArt/CharacterView perlu memetakan ID canonical ke key yang sama. NPC Villager tetap jalur NPC, bukan otomatis item karakter yang dimiliki.

## 6. Usulan struktur folder dan integrasi katalog

```text
data/inventory/character/
  index.js
  steve/manifest.js
  alex/manifest.js
  creeper/manifest.js
  zombie/manifest.js
  skeleton/manifest.js
  ender/manifest.js
```

Ini usulan saja; folder belum dibuat. Bentuknya sejajar dengan `data/inventory/aura/`, `dice/`, `frame/`, `pet/`, dan `power/`.

- `index.js`: kategori Registry `key/kind: character`, fallback ke `character.steve`, urutan enam key yang sama dengan katalog, dan fungsi `register()` mengikuti pola index kategori.
- Manifest: `id: character.<gameKey>`, `kind: character`, gameKey, nama, rarity, deskripsi, `price`/`gems`, `starter`, serta `visual.baseModelKey` yang merujuk key `CharacterData.player` yang ada. Referensi model adalah key data, bukan path file baru. `assets` harus mengikuti validasi manifest; jangan mengarang path aset.
- Harga/transaksi tetap disalin hanya sebagai metadata katalog yang diproyeksikan, seperti Registry lain; server tetap menentukan harga, kepemilikan, dan hasil transaksi.
- Adapter `characterFromManifest()` di `item-catalog.js` membentuk objek kompatibel untuk API ItemCatalog. Builder enam item lama tetap fallback sampai tes paritas semua field lolos.
- API publik lama (`byId`, `byGameKey`, `items`, `defaultEquipped`, `fallbackSkinId`, `equippedSkin`) dipertahankan selama migrasi. Tambahkan alias baru hanya setelah cakupan konsumen dan semantik fallback diuji.
- Pola browser sekarang menggunakan script klasik statis: manifest dimuat sebelum index kategori dan ItemCatalog. Implementasi harus menambahkan rantai script hanya ke halaman yang membutuhkan karakter serta menjaga urutan muat dan cache/service worker. Tidak ada file aset gambar/model baru yang teridentifikasi untuk enam karakter; bila kelak ditambah, preload manifest dan SW harus ikut diperbarui.

## 7. Rencana migrasi Skin ke Character

### Identitas dan state canonical yang diusulkan

Pemetaan satu-ke-satu mempertahankan semua `gameKey`:

| Legacy | Target rancangan |
|---|---|
| `kind: skin` | `kind: character` |
| `skin.<gameKey>` | `character.<gameKey>` |
| `equipped.skin` | `equipped.character` |
| `PD.equippedId('skin')` | API canonical karakter baru; API lama menjadi alias/adapter sementara |
| `look.skin` (`s1`–`s5`) | **tidak berubah** |

`gameKey` (`steve`, `alex`, `creeper`, `zombie`, `skeleton`, `ender`) tetap. Query/game config lama `skins` serta nilai gameKey di `ut-config`, `ut-room`, dan gameplay dipertahankan sebagai format batas selama Gameplay masih mengonsumsinya.

### Strategi kompatibilitas yang direkomendasikan

Pilih **expand → migrate → contract**, bukan rename serentak atau dual-write state permanen:

1. **Expand server lebih dahulu.** Tambahkan katalog canonical `character.*` dan versi RPC kompatibilitas. RPC menerima ID/slot legacy maupun baru dan mengubahnya ke satu representasi canonical di server. Pertahankan alias legacy di batas API selama client lama masih didukung.
2. **Migrasi data dalam transaksi idempoten.** Salin/mapping kepemilikan lama ke ID canonical tanpa menggandakan entitlement; ubah key/ID slot di `player_appearance.equipped`; pertahankan semua kolom dan data lain. Tangani konflik bila ID lama dan baru sama-sama muncul dengan deduplikasi, bukan penambahan jumlah.
3. **Rilis client adapter.** Client membaca kedua bentuk, memprioritaskan `character`, menormalisasi alias ke satu item PlayerData, dan menulis bentuk canonical baru. Server menerima bentuk lama untuk client/tab lama, tetapi menyimpan satu state canonical saja.
4. **Periode kompatibilitas.** `inventory_get`, `appearance_get`, `appearance_get_many`, `room_appearance_get`, dan `buy_item` harus dapat mengadaptasi nilai legacy di batas. Bila tidak ada versi client di RPC, output alias legacy perlu dipertahankan atau diproyeksikan agar client lama tetap memahami item; client baru harus deduplikasi kedua representasi.
5. **Contract belakangan.** Hapus alias hanya setelah kebijakan dukungan client lama disetujui dan tidak ada lagi konsumen legacy. Jika aplikasi harus mendukung tab lama tanpa batas waktu, pertahankan adapter server alih-alih menghapus kontrak.

Strategi ini memakai **dual-read, canonical single-write, dan kompatibilitas input/output sementara**. Saya tidak merekomendasikan dual-write dua slot sebagai state tersimpan: `equipped.skin` dan `equipped.character` dapat bertentangan, sementara dua baris inventori menjadi sumber kepemilikan yang terlihat ganda. Proyeksi alias sementara di API bukan sumber state baru.

### Client, PlayerData, dan localStorage

- Jalankan transformasi sebelum `sanitize()` membuang/menolak ID atau slot yang tidak dikenal.
- Naikkan versi schema/migration PlayerData untuk perubahan bentuk `equipped`; saat ini nilainya 1. Pertahankan key `ularTanggaBlok:player:v1[:acct:<id>]` untuk mencegah data lokal menjadi yatim.
- Map `inventory['skin.x']` ke `inventory['character.x']`, dan `equipped.skin` ke `equipped.character`; lakukan idempoten, pertahankan `acquiredAt`/urutan, deduplikasi item non-stackable, dan jangan mengubah jumlah mata uang.
- Jika bentuk lama dan baru sama-sama ada, pilih satu entitlement dan satu equip secara deterministik; log/telemetri migrasi kegagalan harus terlihat, bukan diam-diam menghapus data.
- Jangan pernah memetakan `look.skin`; uji semua nilai `s1`–`s5` tetap identik.
- Untuk akun, server tetap sumber otoritas; localStorage hanya cermin yang diperbarui setelah sinkronisasi server. Untuk tamu/offline, migrasi lokal harus tetap menjaga ownership/equip yang telah ada.
- Pertahankan alias API/event `equippedSkin()` dan `skinChanged` sampai konsumen lama seperti `app.js`, `item-art.js`, `leaderboard.js`, `game-integration.js`, dan halaman terkait dipindahkan secara bertahap.

### Supabase, RPC, dan room

Rencana forward migration (jangan mengedit migrasi lama):

- Tambahkan `character.*` ke `item_catalog` dengan metadata yang sama; server tetap sumber harga/ownership.
- Migrasikan `player_inventory.item_id` secara transaksional. Jaga FK dan PK `(user_id, item_id)`; deduplikasi konflik agar tidak ada kepemilikan dua kali.
- Ubah `_item_equip_slot()` dan `_appearance_normalize()` untuk slot `character`, menerima `skin` lama selama masa transisi, dan memvalidasi canonical ownership.
- Migrasikan JSON `player_appearance.equipped.skin`/`skin.*` menjadi `character`/`character.*`. Jangan mengubah `player_appearance.look.skin`.
- Revisi RPC `appearance_save/get`, `appearance_get_many`, `room_appearance_get`, `inventory_get`, serta `buy_item` agar input lama tetap dapat dinormalisasi. `player_outfits` tidak perlu berubah karena tidak menyimpan identitas karakter.
- Perbarui seed generator `tools/wallet/gen-item-seed.js`, seed transaksi/hadiah yang mengandung `skin.ender` (termasuk `claim_daily_reward()`), tes SQL, lalu regenerasi `supabase/snapshot/00_full_schema.sql`. Jangan menulis ulang histori `wallet_ledger`; referensi transaksi lama tetap historis.
- Migrasikan/proyeksikan `game_rooms.players[].public_profile.characterSkinId`. Tambahkan field baru (usulan `characterId`) hanya bila disetujui; pertahankan field lama sebagai alias sementara. Tetapkan format canonical sebelum implementasi: rekomendasi nilai canonical adalah ID penuh `character.<gameKey>`, sedangkan penerimaan legacy perlu menangani nilai `skin.<gameKey>` dan nilai pendek `gameKey` yang dipakai fixture SQL.
- `room-flow`/Gameplay terus menerima gameKey di `skins` sampai kontrak gameplay diperbarui secara eksplisit; jangan mengganti query parameter/session key sebagai efek samping migrasi katalog.

### Rollback dan urutan aman

- Jangan menghapus `skin.*` alias/katalog atau data cadangan pada fase expand.
- Catat jumlah baris kepemilikan dan equip sebelum/sesudah; migrasi harus idempoten serta memeriksa orphan/FK dan konflik ID.
- Sebelum contract, rollback dilakukan lewat forward migration yang membalik mapping `character.x` ke `skin.x` dan slot `character` ke `skin`, menggunakan mapping satu-ke-satu yang sama. Hindari penghapusan data lama saat rollback masih diperlukan.
- Setelah contract, rollback perlu mengembalikan alias dan memetakan ulang data; karena itu penghapusan legacy hanya boleh dilakukan setelah persetujuan, masa observasi, dan snapshot teruji.
- Deploy server kompatibilitas sebelum client baru. Client baru tidak boleh mengirim ID/slot yang belum dikenal server lama.

## 8. Dependensi lintas halaman dan sistem

| Sistem/file | Dampak implementasi nanti |
|---|---|
| [item-catalog.js](../../assets/js/item-catalog.js), [item-registry.js](../../assets/js/item-registry.js), `data/inventory/character/` | Manifest, index kategori, adapter metadata, fallback, default slot, label kategori, dan API kompatibilitas. |
| [player-data.js](../../assets/js/player-data.js), [app.js](../../assets/js/app.js) | Ownership/equip, sanitize, schema migration, API alias, event `skinChanged`, localStorage. |
| [karakter.html](../../karakter.html), [karakter.js](../../assets/js/pages/karakter.js) | Halaman saat ini mengedit Look/Gear; perlu alur pilihan karakter terpisah dari warna `look.skin`, tanpa menjadikan item ID sebagai warna kulit. |
| [shop-page.js](../../assets/js/shop-page.js), [inventory.js](../../assets/js/pages/inventory.js) | Shop utama bukan katalog item; Inventory saat ini tidak memuat tab Karakter. Jika menambahkan UI beli/equip, gunakan jalur server dan PlayerData yang sudah ada, bukan transaksi baru. |
| [game-integration.js](../../assets/js/game-integration.js), [room-flow.js](../../assets/js/room-flow.js), [gameplay main.js](../../gameplay/js/main.js) | Pemetaan ID baru ke gameKey, ownership filter, list `skins`, server Appearance, dan perbedaan renderer modern/legacy. |
| [blocky-character.js](../../assets/js/blocky-character.js), [character-data.js](../../assets/js/character-data.js), [character-view.js](../../assets/js/character-view.js), [character-face.js](../../assets/js/character-face.js), [item-art.js](../../assets/js/item-art.js) | Resolver base model dan Look/Gear harus konsisten pada model utama, thumbnail, face, preview, fallback. `blocky-character.js` adalah hasil generate; sumber dan build script terkait harus ikut diperbarui bila diubah. |
| [lobby.js](../../assets/js/pages/lobby.js), [profile.js](../../assets/js/pages/profile.js), [room.js](../../assets/js/pages/room.js), [room-service.js](../../assets/js/multiplayer/room-service.js) | Avatar/fallback, pemuatan Appearance, public profile, dan kontrak room. |
| Aura | `AuraView`/`AuraFX` tetap shared; pastikan renderer karakter baru menyediakan root/pose yang sesuai, tanpa membuat metadata/ownership Aura kedua. |
| HTML/script loading, Service Worker, preload | Manifest kategori dimuat sebagai script statis sebelum ItemCatalog pada halaman konsumen. Periksa script order, daftar cache/precache dan tes loading saat implementasi; tidak ada aset karakter baru yang dibutuhkan oleh desain ini. |
| Supabase | `item_catalog`, `player_inventory`, `player_appearance`, fungsi validasi/RPC, reward, public profile di payload room, generator seed, tes SQL, snapshot schema. |

Tes yang perlu ditambah/diperbarui saat implementasi meliputi paritas keenam manifest dengan baseline [item-catalog-baseline.json](../../tests/fixtures/item-catalog-baseline.json), migrasi PlayerData dan localStorage, `appearance-service.test.js`, tes equip/ownership, tes script loading, game integration/room appearance, generator seed, dan tes SQL public profile/Appearance. Tidak ada hasil lulus/gagal baru dari tes tersebut pada tahap desain ini.

## 9. Risiko dan mitigasi

| Risiko | Dampak | Pencegahan yang disarankan |
|---|---|---|
| Menganggap `look.skin` sama dengan ID Skin | warna kulit hilang/berubah saat migrasi | Transformasikan hanya key `equipped` dan ID item; tes eksplisit `s1`–`s5`. |
| Hanya mengganti ID katalog | Lobby/Profile/Gameplay tetap menampilkan model generik atau model berbeda | Integrasikan identitas ke renderer utama dan adapter fallback; verifikasi model yang sama di seluruh halaman. |
| Dual-write slot/entitlement | Equip bertentangan, jumlah item atau tampilan ganda | Satu canonical server state; alias hanya di input/output compatibility layer; deduplikasi client. |
| Client baru lebih dulu daripada RPC server | `appearance_save`/pembelian ditolak | Deploy ekspansi RPC server dahulu, lalu client; uji dua format legacy/canonical. |
| `gameKey` ikut diganti | Gameplay config `skins`, room setup, `CharacterData`, dan ItemArt gagal menemukan model | Bekukan keenam gameKey; map canonical ID ke gameKey hanya pada adapter. |
| UI lama menyamakan “Kulit” dengan kategori Karakter | Pemain tidak dapat membedakan warna kulit dan model karakter | Pertahankan “Kulit” untuk `look.skin`; sediakan kategori Karakter terpisah sesuai glossary. |
| Outfit ikut diperluas tanpa versi kontrak | Data Outfit lama tidak valid atau server menolak save/load | Pertahankan Outfit sebagai set Gear; perubahan payload terpisah perlu keputusan dan migrasi sendiri. |
| Perubahan model merusak action rig/pose | Regresi Lobby dan gameplay | Jaga satu runtime utama; parity pose dan gameplay serta browser test nyata sebelum rollout. |
| Alias API/public profile tidak konsisten | Room lama menampilkan default atau gagal mengenali karakter | Tetapkan bentuk ID dan kebijakan alias; tes full ID dan gameKey legacy, jangan mengandalkan field yang tidak dikonsumsi. |
| Manifest/script tidak termuat | ItemCatalog jatuh ke fallback atau halaman mengalami 404/urutan salah | Tambahkan script statis ke entrypoint relevan; tes completeness, console/network, SW, dan cache. |

## 10. Tahapan implementasi yang disarankan

1. **Persetujuan desain:** putuskan semantik karakter/model, renderer utama, format `characterId` public profile, dan durasi kompatibilitas client lama.
2. **Baseline test/data:** simpan parity semua enam metadata/ID, server seed, aset/model key, script loading, dan perilaku renderer saat ini.
3. **Registry read-only:** buat manifest/index Character, integrasikan ke ItemCatalog dengan fallback; belum ubah PlayerData atau ID server. Buktikan paritas.
4. **Presentation adapter:** resolusikan Character Definition ke renderer bersama; buat enam model yang dipilih konsisten di Character, Lobby, Profile, Room, Gameplay, dan fallback. Aura tetap menempel melalui sistem yang sama.
5. **Client compatibility:** migrasi PlayerData/localStorage dan API alias, tambah pemilih karakter terpisah dari Look, dan UI Inventory/Shop bila disetujui. PlayerData tetap satu state client.
6. **Server expand dan data migration:** deploy RPC kompatibilitas, seed canonical, migrasi inventory/equipped/public-profile secara transaksional, tes ownership/transaksi/RPC dan rollback.
7. **Client canonical:** gunakan `character.*` dan `equipped.character`; tetap baca bentuk lama dalam masa transisi. Pertahankan gameKey di batas Gameplay.
8. **Observasi dan contract:** bandingkan telemetry/tes lama-baru, baru hapus alias setelah kebijakan kompatibilitas disetujui; regenerasi snapshot dan cek service worker/script loading.

## 11. Persetujuan yang masih diperlukan

| Status | Keputusan |
|---|---|
| CONFIRMED | UI memakai Karakter; kategori visual Aura; kategori perlengkapan Perlengkapan; Outfit; Peta; Koin; Emerald tetap. |
| CONFIRMED | `skin.*` direncanakan menjadi ID `character.*`; `equipped.skin` direncanakan menjadi slot karakter; belum diubah pada Stage 8.1. |
| CONFIRMED | `look.skin` adalah warna kulit dan tetap terpisah. |
| PROPOSED — perlu persetujuan | Character Definition menentukan model dasar `CharacterData` (Enderman/Creeper, dll.) dan bukan sekadar label/ikon. |
| PROPOSED — perlu persetujuan | Pertahankan `BlockyCharacter` sebagai runtime player renderer dan adaptasikan agar memakai model dasar Character Definition serta Look/Gear; `CharacterView` tetap renderer identitas/preview sampai dukungannya mencukupi. |
| PROPOSED — perlu persetujuan | ID canonical memakai `character.<gameKey>`; slot canonical `equipped.character`; nilai `characterId` public profile menggunakan ID penuh. |
| NEEDS CLARIFICATION | Apakah `characterSkinId` harus tetap diekspos selama masa kompatibilitas, dan berapa lama client lama didukung? Fixture SQL memakai gameKey pendek, sedangkan client sekarang mengirim `skin.<gameKey>`. |
| NEEDS CLARIFICATION | Apakah UI harus menambahkan katalog/pemilihan dan pembelian Karakter? Saat ini item katalog/seed server ada, tetapi Inventory tidak memiliki tab Karakter dan halaman Karakter tidak memilih item `skin.*`. |
| NEEDS CLARIFICATION | Apakah Outfit tetap hanya set Gear seperti kontrak sekarang? Rekomendasi desain ini: ya; Character, Look, dan Aura tidak dimasukkan ke Outfit pada migrasi identitas. |

**Batas akhir Stage 8.1:** laporan desain saja. Tidak ada Registry Karakter, migrasi identifier, perubahan database, atau implementasi UI yang dimulai.
