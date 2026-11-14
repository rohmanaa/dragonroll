# Dragon Roll — Stage 8.3: Character Renderer Integration Design

## Status

**DESAIN SAJA — belum ada perubahan renderer atau source produksi.** Arah yang telah disetujui untuk tahap ini adalah `BlockyCharacter` sebagai basis renderer utama pemain, Character Registry sebagai sumber identitas, dan `CharacterData` sebagai sumber definisi model dasar. `CharacterView` tetap tersedia sementara untuk kompatibilitas. Desain ini tidak mengubah ID, PlayerData, animasi, aset, database, RPC, `makePawn()`, atau UI.

Stage 8.2 mempertahankan kontrak aktif `kind: skin`, ID `skin.<gameKey>`, slot `equipped.skin`, dan alias profil `characterSkinId`. `canonicalId: character.<gameKey>` masih metadata rencana, bukan ID runtime. `look.skin` tetap warna kulit `s1`–`s5`.

## 1. Kondisi Git dan batas audit

| Pemeriksaan | Hasil |
|---|---|
| Branch | `restruktur` |
| HEAD awal | `ff25d842b48a635a0ddee3045bd4a6b4342c0a05` |
| `origin/restruktur` awal | sama dengan HEAD |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Worktree awal | bersih |
| Ruang lingkup perubahan | laporan audit ini saja; source produksi tidak diubah |

Audit Stage 8.0, 8.1, dan 8.2 dibaca, kemudian diverifikasi terhadap implementasi aktual. Perbedaan antara renderer, halaman, dan kontrak lama didasarkan pada source saat ini, bukan diasumsikan dari laporan terdahulu.

## 2. Ringkasan arsitektur saat ini

Saat ini identitas dan penampilan belum dirender sebagai satu presentasi:

- Registry kategori karakter di Stage 8.2 tetap memakai `key/kind: skin`. Manifest berisi `visual.baseModelKey`, tetapi adapter ItemCatalog sengaja tidak menambahkan field itu ke objek item publik lama.
- `PlayerData.equipped.skin` memilih ID item `skin.*`; `PlayerData.look` dan `gearLook()` menyimpan penampilan serta Gear secara terpisah.
- `UT.BlockyCharacter` membangun satu rig blocky humanoid umum. `loadFromPlayer()` membaca Look dan Gear; `loadFromData()` membaca Look, Gear, dan dye. Keduanya tidak membaca `equipped.skin` dan tidak menggunakan `CharacterData`.
- `UT.CharacterData` menyediakan model voxel berbasis box dan `mesh()`/`svg()`/`face()`. Model mempunyai bounds, tetapi tidak menamai bagian tubuh atau mengekspos rig/anchor/kapabilitas.
- Source `CharacterData` menyatakan datanya diekstrak dari `gameplay.html` melalui `tools/character-data/build.js` dan `extract.js`; metadata rig yang ditambahkan hanya ke file hasil generate berisiko hilang saat regenerasi.
- `UT.CharacterView` memilih model lewat `skin.*` atau `gameKey`, lalu membangun rig dari box dengan aturan pemisahan dan rig yang tersimpan privat di modul itu. Ia belum menerapkan PlayerData Look atau Gear.
- `CharacterFace` merender `BlockyCharacter` ke PNG untuk avatar. Remote appearance mencakup `equipped.skin`, tetapi fungsi render belum memakai slot tersebut.
- Gameplay memulai pawn dari model palette lama. Jalur modern dapat menggantinya dengan `BlockyCharacter`, tetapi renderer baru hanya menerima Look/Gear. Karena itu model awal dan pawn modern dapat berbeda identitasnya.

### Diagram aliran aktual

```text
ItemRegistry manifest (skin.*; visual.baseModelKey)
             |
             +--> ItemCatalog adapter (objek publik lama)
                            |
                            +--> PlayerData inventory / equipped.skin
                                      |                         \
                                      |                          +--> game config `skins` / gameKey
                                      |                                  +--> pawn palette lama memilih model
                                      |
                                      +--> AppearanceService --> Supabase `player_appearance`
                                                look / equipped / gear_dye
                                                        |
                       +--------------------------------+--------------------+
                       |                                |                    |
                 BlockyCharacter                   CharacterFace         room/game
                 Look + Gear saja                  Look + Gear saja      Appearance data
                 identitas diabaikan               identitas diabaikan   skin slot tersedia

CharacterData --> CharacterView --> fallback miner di Tambang
             \--> ItemArt / model preview

AuraView / AuraFX tetap terpisah dan menempel pada root karakter.
Outfit tetap menyimpan set Gear, bukan identitas, Look, atau Aura.
```

### Diagram target desain

```text
PlayerData.equipped.skin (lokal)       server appearance.equipped.skin (remote)
                 \                                      /
                  +--> resolver legacy identity / ItemCatalog
                              |
                  ItemRegistry manifest.visual.baseModelKey
                              |
                 CharacterData model + rig adapter
                              |
         BlockyCharacter: base geometry + Look/Gear + dye
                              |
                rig-capable animation/actions
                              |
         Lobby / Profile / Room / Gameplay / preview

PlayerData tetap satu state client; server tetap otoritas ownership/appearance.
Outfit dan Aura tetap domain terpisah; Aura hanya menjadi overlay pada root.
```

Diagram target adalah usulan alur, bukan perilaku yang sudah tersedia.

## 3. API dan batas modul yang ditemukan

| Modul/API yang ada | Tanggung jawab saat ini | Batas integrasi |
|---|---|---|
| `ItemRegistry.shared().getItem(id)` / `getCategory()` | Membaca manifest terdaftar, termasuk `visual.baseModelKey`. | Key kategori dan kind tetap `skin`; belum menerima ID runtime `character.*`. |
| `ItemCatalog.byId()`, `byGameKey()`, `fallbackSkinId()` | API katalog kompatibel untuk item legacy. | Objek ItemCatalog sengaja tidak membawa `baseModelKey`; jangan mengubah bentuk publiknya hanya untuk renderer. |
| `PlayerData.equippedId('skin')`, `equippedSkin()`, `look()`, `gearLook()` | State pemain: identitas lama, Look, dan Gear. | `equippedSkin()` hanya alias baca dari slot `skin`, bukan state kedua. |
| `CharacterData.get/list/svg/face/mesh()` | Definisi model dan pembentukan mesh/SVG. | Tidak ada pemetaan semantic bones, anchor Gear, atau capability map. `get()` memberi `null` untuk key yang tidak dikenal. |
| `CharacterView.make(THREE, skin, emote)` | Renderer identitas berbasis CharacterData; `userData.anim(t)` dan `setEmote()`. | Rig dan pemisahan box bersifat internal; tidak mendukung PlayerData Look/Gear atau locomotion walk/run. |
| `UT.BlockyCharacter.create(THREE, opts)` | Renderer penampilan pemain; methods `loadFromPlayer`, `loadFromData`, `loadPreset`, `setMode`, `jump`, `act`, `tick`, `setTool`, dan akses hand/action. | `opts` belum dipakai untuk identitas. Tidak ada input `baseModelKey` atau konsumsi CharacterData. |
| `CharacterFace.url/urlData/urlPreset()` | Menghasilkan PNG kepala pemain, remote appearance, atau preset dengan renderer offscreen. | Pemuatan identitas belum ada; cache lokal `url()` saat ini menandatangani Look/Gear, bukan `equipped.skin`. |

**Prinsip desain:** jangan membuat katalog ownership, state pilihan, atau sumber geometri baru. Resolusi identitas memakai ID yang sudah dikenal ItemCatalog; Registry hanya memasok metadata model. Rig dan kemampuan visual sebaiknya menjadi metadata/adapter model, bukan disalin ke setiap manifest karakter tanpa kebutuhan yang terbukti.

## 4. Analisis enam model CharacterData

Bounds dihitung dari box model `CharacterData.get('player', gameKey)` dalam evaluasi Node VM read-only. Angka ini adalah unit data gameplay sebelum skala `CharacterView` (`SCALE = 6.6`) atau penempatan pawn; bukan hasil pengukuran browser.

| Karakter | Box | Bounds lebar × tinggi × dalam | Rig di CharacterView | Temuan bentuk |
|---|---:|---|---|---|
| Steve | 21 | `0.50 × 0.83 × 0.327` | humanoid | Kepala, torso, dua lengan, dua kaki; warna kulit, rambut, mata, baju, dan celana telah menjadi warna box. |
| Alex | 21 | `0.50 × 0.83 × 0.327` | humanoid | Bounds sama dengan Steve; warna/model detail berbeda, termasuk rambut oranye dan pakaian hijau. |
| Zombie | 21 | `0.50 × 0.83 × 0.327` | humanoid | Proporsi dasar humanoid sama, tetapi palet kulit hijau dan detail kepala/pakaian merupakan identitas model. |
| Skeleton | 21 | `0.50 × 0.83 × 0.327` | humanoid | Bounds dan jumlah box sama; detail kepala, torso rusuk, dan anggota tubuh berwarna tulang membentuk identitasnya. |
| Creeper | 14 | `0.32 × 0.79 × 0.312` | creeper | Empat kaki, torso bertingkat, kepala persegi, tanpa lengan/tangan humanoid. Rig CharacterView mengelompokkan kaki untuk gerak hop. |
| Enderman | 10 | `0.30 × 1.12 × 0.317` | ender | Siluet sempit dan jauh lebih tinggi; lengan/kaki panjang dan kepala di atas torso. Rig CharacterView memakai pivot berbeda. |

CharacterView saat ini membedakan `humanoid`, `creeper`, `ender`, dan `villager` melalui tabel privat. Model dasar keenam karakter tidak menyediakan nama bone. CharacterData `player.villager` ada tetapi bukan item Character di ItemCatalog; ia dipakai sebagai CPU/NPC.

### Implikasi ke BlockyCharacter

BlockyCharacter memiliki skeleton/koordinat humanoid tetap: torso, kepala, lengan dengan siku/pergelangan, dan kaki dengan lutut. Ia membuat mesh dasar dan kosmetik sendiri dari config Look/Gear. Meneruskan `baseModelKey` saja tidak cukup: dibutuhkan pemetaan geometry CharacterData ke bagian/pivot yang bisa dianimasikan, termasuk kebijakan untuk model tanpa lengan dan model Ender.

Jangan menjadikan geometri awal BlockyCharacter dan geometri CharacterData dua lapisan badan penuh sekaligus. Adapter perlu menghasilkan satu base rig yang konsisten, kemudian memasang kosmetik di anchor rig itu.

## 5. Rekomendasi kompatibilitas Look dan Gear

**Rekomendasi umum:** Look/Gear tetap data pemain yang sudah tersimpan. Jika model tidak mendukung suatu bagian, renderer boleh tidak menggambar bagian itu, tetapi jangan menghapus/unequip atau mengubah ownership. Saat pemain kembali ke model yang kompatibel, data Gear tetap dapat dipulihkan. Penekanan visual pada identitas khusus dan aturan Gear per karakter masih membutuhkan persetujuan produk.

Legenda slot Gear: `top`, `legs`, `boots`, `helm`, `chest`, `shoulder`, `cape`, `weapon`, dan `acc.*`. `Outfit` hanya memuat pilihan Gear/dye yang telah ada; tidak menyimpan Character.

| Karakter | Look: skin, mata, rambut, gender, body | `helm` / aksesori kepala | `top` / `chest` / `shoulder` | `legs` / `boots` | `cape` | `weapon` | `acc.*` |
|---|---|---|---|---|---|---|---|
| Steve | Rekomendasi: semua Look aktif; petakan skin/eye/hair ke bagian model yang sesuai. Pertahankan gender/body scaling yang sekarang. | Anchor humanoid standar. | Anchor torso standar. | Anchor kaki standar. | Anchor punggung standar. | Tangan kanan/kiri humanoid. | Anchor humanoid; uji setiap aksesori. |
| Alex | Sama dengan Steve; pilih apakah model dasar Alex atau Look pemain yang menentukan rambut/warna pakaian karena keduanya sudah terlukis di base boxes. | Anchor humanoid standar. | Anchor torso standar. | Anchor kaki standar. | Anchor punggung standar. | Tangan humanoid. | Anchor humanoid; uji aksesori. |
| Zombie | Rekomendasi: kunci skin/eye/hair dan proporsi gender/body agar palet/detail Zombie tetap terbaca; Look tersimpan tidak dihapus. | Boleh melalui anchor humanoid, tetapi jangan menutupi kepala/identitas tanpa whitelist. | Fit humanoid tersedia; whitelist agar baju/armor tidak menghapus siluet Zombie. | Fit humanoid tersedia; uji sepatu dan celana pada proporsi model. | Anchor punggung standar setelah uji clipping. | Tangan tersedia; pertahankan fungsi aksi jika rig mendukungnya. | Whitelist; kepala/wajah perlu tetap terlihat. |
| Skeleton | Rekomendasi: kunci skin/eye/hair dan gender/body; bentuk tulang/rusuk tetap menjadi identitas dasar. | Hanya item yang teruji; jangan menutupi skull/mata secara default. | Armor/chest/shoulder sebagai attachment terpilih; sembunyikan garment yang menutupi rusuk/tulang bila merusak siluet. | Fit sepatu/celana per-item; pertahankan bagian tulang yang menentukan identitas. | Dapat memakai anchor punggung humanoid setelah uji. | Lengan humanoid tersedia, tetapi grip/pose perlu uji khusus. | Whitelist, terutama aksesori kepala/wajah. |
| Creeper | Rekomendasi: jangan menerapkan skin/eye/hair/gender/body humanoid; pertahankan palet dan bentuk Creeper. | Hanya attachment khusus di kepala; jangan gunakan helmet humanoid tanpa fit. | `top`/armor/shoulder tidak memiliki anchor lengan; hanya attachment custom yang tidak menutupi wajah/torso. | Empat kaki tidak cocok dengan dua slot kaki/sepatu manusia; sembunyikan kecuali ada adaptasi per-item. | Attachment khusus pada torso; tidak ada anchor cape saat ini. | Sembunyikan slot senjata: model tidak memiliki tangan. | Hanya attachment khusus yang terdefinisi; jangan pasang ke lengan yang tidak ada. |
| Enderman | Rekomendasi: pertahankan warna/fitur Enderman serta proporsi tinggi; jangan gunakan gender/body scaling humanoid tanpa uji. | Perlu anchor/skala kepala Enderman; jangan memakai ukuran helm manusia secara otomatis. | Perlu fitting per rig agar torso/shoulder tetap sesuai tubuh sempit. | Perlu anchor dan panjang khusus; ukuran sepatu/celana standar berisiko melayang/clipping. | Anchor belakang dan panjang cape perlu disesuaikan terhadap lengan/tubuh tinggi. | Tangan ada pada model, tetapi grip dan animasi lengan panjang harus diuji. | Perlu whitelist dan anchor; hindari aksesori yang menutup mata bercahaya. |

`BlockyCharacter` saat ini hanya memvalidasi Gear yang dimiliki dan cocok dengan gender dari Look; belum ada compatibility-by-character. Tidak ada manifest yang membatasi slot Gear untuk model tertentu. Perilaku fallback/hide yang dijelaskan di atas adalah rekomendasi presentasi, bukan validasi server atau aturan ownership baru.

### Aturan Look yang belum diputuskan

Model dasar Steve/Alex/Zombie/Skeleton sudah mengandung warna dan detail wajah/pakaian. Look pemain juga mengandung skin, mata, rambut, gender, dan ukuran tubuh. Untuk setiap model perlu keputusan apakah Look mengganti detail dasar, hanya diterapkan ke subset bagian, atau ditampilkan sebagai opsi terbatas. Untuk Creeper/Enderman, memaksakan seluruh Look humanoid berisiko menghilangkan identitas model.

## 6. Desain animasi

| Kelompok | Tersedia di BlockyCharacter | Tersedia di CharacterView | Desain integrasi |
|---|---|---|---|
| Locomotion | `setMode('idle'|'walk'|'run')`, `tick(dt)`, `jump()`. `setMode` selain walk/run pada praktiknya menjadi idle. | Emote idle dan lompatan/hop dalam pose; tidak ada API locomotion walk/run. | Pertahankan API locomotion Gameplay BlockyCharacter. Gerak kaki manusia tidak boleh dipaksakan ke Creeper; rig lain memerlukan pemetaan capability/pose. |
| Gameplay | `act()` mengenali `attack`, `bow`, `block`, `sad`, `cheer`, `wave`, `flip`, `backflip`, `spin`, `roll`, `mine`; source BlockyCharacter yang dimuat juga memuat `spinball`, `toss`, `dribble`, `throw`. `setTool`, `setBowAim`, `strikes`, dan `acting` tersedia. | Emote `mine` dan pose lain; bukan action engine Gameplay. | Pertahankan nama/semantik API yang dipanggil Gameplay. Aksi yang memerlukan tangan harus punya capability/alternatif rig; gameplay event/hasil tidak boleh bergantung pada animasi sukses. |
| Sosial | `wave`, `cheer`, `sad` melalui `act()`; Lobby juga memakai flip/roll/backflip/spin dan jump. Tidak ada action bernama `dance` atau `victory`. | `idle`, `wave`, `dance`, `victory`, `cheer`, `laugh`, `mine`, `sit`, `celebrate`; tidak ada locomotion API. | Tidak menambahkan emote baru dalam desain. Jangan menyamakan `victory` CharacterView dengan state baru; Gameplay saat ini memakai cheer/sad. |
| Result / hit | `cheer`/`sad` dipakai untuk hasil menang/kalah. `block` dipakai baik untuk bertahan maupun sebagai reaksi terkena hit. Tidak ada action `hit` terpisah. | Ada victory/celebrate, tidak ada API hit Gameplay. | Pertahankan pemetaan yang ada; jangan menambah `hit`/`defeat` tanpa kebutuhan dan keputusan. |

Panggilan aktual termasuk aksi serangan/panah, pertahanan dan reaksi efek di `gameplay/js/main.js`; Lobby menjadwalkan animasi hero; Tambang memakai `mine`/`wave`. Skeleton humanoid berpotensi memakai pose lengan dengan penyesuaian. Creeper tidak dapat menjalankan pose lengan/weapon; Enderman memerlukan range/offset berbeda. Untuk aksi unsupported, rekomendasi adalah skip visual action atau pose fallback yang didefinisikan rig, tanpa menggagalkan gameplay.

### Ketergantungan generator yang harus diselesaikan lebih dahulu

`assets/js/blocky-character.js` menyatakan bahwa ia dibuat oleh `tools/blocky-character/build.js`. Namun, generator yang ada mencari marker bagian bernomor di `karakter.html`; file `karakter.html` sekarang memuat `assets/js/pages/karakter.js` sebagai script eksternal dan tidak berisi marker bagian tersebut. Simulasi ekstraksi read-only mengikuti regex/alur generator berhenti dengan `section 1 missing`, sebelum file ditulis. Selain itu, `tools/blocky-character/template.js` hanya mencantumkan daftar aksi dasar, sedangkan asset `blocky-character.js` aktif mencantumkan aksi dadu `spinball/toss/dribble/throw`.

Karena itu, jangan mengedit file generated atau menjalankan generator sebagai langkah integrasi sebelum sumber otoritatif, generator, template, dan daftar aksi diselaraskan. Tambahkan pemeriksaan paritas generator agar perubahan pada halaman/editor tidak diam-diam menghapus API yang dipakai Lobby/Gameplay.

## 7. Matriks integrasi halaman

| Konsumen | Renderer dan identitas saat ini | Look/Gear dan data yang diterima | Kesenjangan / perubahan yang diperlukan setelah desain disetujui |
|---|---|---|---|
| Lobby | Hero 3D memakai `BlockyCharacter.loadFromPlayer()`. Avatar memakai `CharacterFace`; fallback ItemArt dapat membaca `equipped.skin`. | Hero dan wajah mengikuti Look/Gear lokal. Aura dipasang terpisah pada root. | Resolusikan identitas yang sama untuk hero dan avatar; perbarui cache wajah agar perubahan `equipped.skin` mengubah hasil. |
| Profile | Podium 3D memakai `BlockyCharacter.loadFromPlayer()`. Avatar dan nama “Karakter aktif” memakai `CharacterFace`/`ItemCatalog` legacy. | Look/Gear lokal; Aura terpisah pada renderer podium. | Tiga visual (podium, wajah, label) harus menunjuk ID/model yang sama; jangan mengubah state Profile menjadi sumber karakter. |
| Room | Avatar lokal/remote memakai PNG `CharacterFace`, bukan full-body renderer. Pemain remote diambil melalui `room_appearance_get`; remote appearance menyertakan `look`, `equipped`, `gear_dye`. | `urlData()` menerima data remote, tetapi BlockyCharacter hanya membaca Look/Gear. `equipped.skin` sudah tersedia namun diabaikan. | Resolver yang sama harus membaca `equipped.skin`; gunakan `characterSkinId` publik sebagai alias/fallback kompatibilitas saja, bukan state kedua. Cache key, framing kepala, dan fallback data tidak tersedia harus diuji. |
| Gameplay lokal | `makePawn()` membuat bentuk palette berdasar `gameKey`; upgrade modern menjadi `BlockyCharacter` untuk pemain lokal. | `loadFromPlayer()` memakai Look/Gear, bukan slot karakter. | Selaraskan base model dengan slot yang sama tanpa mengubah movement, collision, aturan game, atau semantik `makePawn()`. |
| Gameplay remote | `applyOnlineLooks()` mengambil `room_appearance_get` dan memanggil `loadFromData(look,equipped,gear_dye)`; pawn awal palette diganti saat data datang. | Payload sudah membawa slot karakter tetapi loader hanya mengonsumsi Look/Gear. Jika appearance belum tersedia, jalur preset menjadi fallback sementara. | Pastikan remote pemain memakai resolver yang sama; hindari perubahan visual berbeda antara data awal, server fetch, dan retry. |
| Character Builder (`karakter.html`) | Editor memakai renderer/rig dari `assets/js/pages/karakter.js` dan mengedit Look/Gear. Tidak ada selector `equipped.skin` dalam editor saat ini. | Look/Gear diedit dan disimpan melalui PlayerData; `look.skin` adalah warna kulit. Outfit menyimpan Gear. | Katalog/pemilih Karakter harus tetap terpisah dari kontrol warna kulit dan Gear; preview terpilih memakai model base tanpa mengubah penyimpanan Look. |
| Preview katalog | `ItemArt` dapat memakai `CharacterData`; CharacterView dapat menampilkan model identity. Belum ada satu preview yang menggabungkan Registry identity + Look/Gear. | Preview karakter tidak menjadi sumber kepemilikan atau equip. | Gunakan renderer/adapter bersama sesudah integrasi, dengan fallback non-WebGL yang tidak mengganti state. |
| CPU / NPC | CPU Gameplay saat ini Villager (`NEW_CHAR_CPU=false`); ini bukan item katalog. `CharacterView` dipakai sebagai fallback miner di Tambang jika BlockyCharacter tidak tersedia. Jalur Tambang normal membuat BlockyCharacter generic dengan Look variasi; pilihan model NPC hanya berlaku pada fallback CharacterView. | Tidak memakai ownership pemain. Preset BlockyCharacter adalah penampilan generik deterministik, bukan resolver identitas. | Bedakan data preset/NPC dari identitas milik pemain; pertahankan Villager CPU sampai diputuskan lain. Konsistensikan model NPC Tambang di jalur normal dan fallback. |

### Kontrak identitas pemain remote

Sumber pilihan aktif yang paling langsung sudah tersedia dalam `player_appearance.equipped.skin`, yang dikirim oleh `room_appearance_get`. `public_profile.characterSkinId` merupakan metadata alias terpisah dan sekarang dipublikasikan dari `PD.equippedId('skin')`. Desain merekomendasikan:

1. Gunakan `equipped.skin` dari payload Appearance sebagai sumber utama identitas remote.
2. Normalisasikan nilai legacy yang dikenal melalui ItemCatalog/Registry; jangan menerima `character.*` sebagai ID runtime pada tahap ini.
3. Jika Appearance belum ada, pertahankan fallback saat ini. Jika memakai `characterSkinId` lama sebagai fallback, dokumentasikan format yang diterima (`skin.<gameKey>` dan/atau `gameKey`) dan jangan menulis dua state.
4. Pertahankan `characterSkinId` dan semua server/RPC tanpa perubahan sampai desain migrasi disetujui.

## 8. Kontrak API integrasi yang diusulkan

Semua nama/perubahan di bawah adalah desain, bukan API yang sudah ditambahkan.

| API / kontrak | Tanggung jawab dan input | Output / konsumen | Fallback dan risiko kompatibilitas |
|---|---|---|---|
| Resolver identitas karakter (pure helper) | Menerima ID legacy `skin.*` (atau item legacy yang sudah di-resolve), membaca ItemCatalog dan `ItemRegistry` manifest. | `{id, gameKey, baseModelKey, fallbackReason?}` untuk renderer halaman, avatar, dan Gameplay. | ID/model tak dikenal jatuh ke fallback ItemCatalog (`skin.steve`) sambil mempertahankan Look/Gear; laporkan alasan fallback. Jangan menerima/menulis `character.*` pada tahap desain ini. |
| Model/rig adapter CharacterData | Memetakan `baseModelKey` ke box geometry, named part/pivot, ukuran, anchor Gear, dan capability yang benar-benar didukung. Bisa berbagi aturan pemisahan privat CharacterView. | Definisi model siap dibangun BlockyCharacter, tanpa menyimpan PlayerData/ownership. | Key hilang menghasilkan error/fallback yang terlihat. Mengubah `CharacterData.mesh()` atau bentuk public API perlu menjaga ItemArt/CharacterView. Rig metadata sebaiknya tidak diduplikasi di manifest kecuali ada kebutuhan katalog yang nyata. |
| `BlockyCharacter.loadFromPlayer()` (ekstensi kompatibel) | Membaca `PD.equippedId('skin')`, `PD.look()`, `PD.gearLook()` dan dye. | Mengganti base model serta appearance instance yang sama. Dipakai Lobby/Profile/Gameplay lokal. | Tanpa registry lengkap, gunakan fallback Steve dan Look/Gear lama. Pertahankan nama dan perilaku pemanggil existing; jangan membuat store pilihan karakter baru. |
| `BlockyCharacter.loadFromData(look,equipped,gearDye)` (ekstensi kompatibel) | Ambil identitas dari `equipped.skin` bersama Look/Gear/dye payload server. | Instance remote yang sama bentuknya dengan lokal. | Missing payload mengikuti fallback remote saat ini; fallback `characterSkinId` hanya bila format disetujui. Jangan mengubah RPC atau bentuk payload dalam tahap desain. |
| Preset CPU/NPC | Gunakan API preset untuk penampilan generik; base model NPC eksplisit bila kelak diperlukan, tanpa menyamar sebagai karakter yang dimiliki pemain. | Model preset untuk CPU/NPC dan fallback online. | Pertahankan Villager CPU saat ini. Jangan memakai PlayerData atau item ownership untuk NPC. Tambahan argumen/descriptor ke `loadPreset()` adalah usulan yang perlu diuji dengan pemanggil lama. |
| `CharacterFace.url()/urlData()` | Resolusi identitas sama dengan full renderer; signature cache mencakup `baseModelKey`/ID serta Look/Gear/dye. | Avatar lokal dan remote berbasis identitas yang sama. | Tanpa WebGL atau gagal render, gunakan fallback ItemArt/initials. Perubahan key cache mencegah avatar stale saat hanya karakter yang berubah. |
| Animation capability map | Memetakan action/mode yang sudah ada ke rig; tidak menciptakan aturan gameplay atau engine kedua. | BlockyCharacter memilih pose/action yang kompatibel per rig. | Aksi unsupported diabaikan/diubah hanya melalui mapping yang disetujui. API `tick`, `setMode`, `jump`, `act`, `strikes`, `bow`, dan `setTool` tetap kompatibel. |

`CharacterData` saat ini tidak menyediakan named anchors. Implementasi harus menguji apakah pemisahan box/rig privat `CharacterView` dapat dipakai bersama, lalu menetapkan satu pemilik definisi rig. Jangan menyalin model procedural ke manifest atau membuat renderer/animation engine kedua.

## 9. Lifecycle, resource, dan performa

- `CharacterData.mesh()` membuat `BufferGeometry` dan material baru dari box yang diminta. `CharacterView` dapat membuat beberapa part mesh dari subset box; tidak ada method `dispose()` pada API yang dikembalikan.
- BlockyCharacter membangun banyak mesh/material/CanvasTexture untuk Look dan Gear. `clear(slot)` membuang dan memanggil `dispose()` pada resource slot yang dibangun ulang, tetapi instance API tidak mengekspos disposal penuh untuk seluruh renderer/root.
- `CharacterFace` mempertahankan satu WebGL renderer offscreen dan cache maksimum 24 hasil, lalu hanya melepas `ch.root` dari scene setelah render. Ia tidak memanggil disposal eksplisit pada geometry/material/texture instance. Ini area verifikasi memori, bukan bukti benchmark atau kebocoran terukur.
- Cache `CharacterFace.urlData()` memasukkan objek `equipped` ke signature, tetapi `url()` lokal memakai `[look, gearLook]`; saat hanya identitas karakter berubah, signature lokal tidak berubah dan hasil PNG dapat stale setelah integrasi.
- Lobby/Profile membuat ulang model saat appearance berubah. Room dan Gameplay dapat membuat tampilan untuk banyak pengguna. Penggantian model berulang dan avatar remote perlu mengukur jumlah geometry/material/texture, cache hit, dan waktu build.
- Bounds model bervariasi: Enderman `1.12`, humanoid `0.83`, Creeper `0.79`. Gameplay modern saat ini menormalisasi pawn lewat `BlockyCharacter.height()`/target sekitar `0.92`, dan Aura memakai tinggi pawn tetap. Integrasi harus mengukur tinggi, footprint, aura, marker, kamera, seat, bayangan, hit area, dan framing wajah tanpa mengubah aturan gerak/board.
- Tidak ada benchmark FPS, draw call, waktu build, atau VRAM yang dilakukan. Jangan menyebut satu pendekatan lebih cepat tanpa pengukuran.

## 10. Rencana implementasi bertahap

Urutan berikut mengikuti dependensi; tidak ada tahap implementasi yang dimulai di Stage 8.3.

| Fase | Ruang lingkup dan dependensi | File yang kemungkinan terdampak | Risiko utama | Tes regresi / kriteria selesai |
|---|---|---|---|---|
| 1. Sumber dan rig adapter | Tegaskan sumber otoritatif editor, template, generator, dan asset; sediakan definisi named parts/rig berbasis CharacterData. Prasyarat seluruh integrasi. | `karakter.html`, `assets/js/pages/karakter.js`, `tools/blocky-character/build.js`, `tools/blocky-character/template.js`, `assets/js/blocky-character.js`, `gameplay.html`, `tools/character-data/{build.js,extract.js,template.js}`, `assets/js/character-data.js`, `assets/js/character-view.js`. | Generator BlockyCharacter mencari marker yang tidak ada; aksi dadu di asset dan template berbeda. Metadata rig CharacterData juga harus bertahan pada regenerasi. | Tes generator deterministik/paritas, semua 6 model resolvable, named part bounds valid, action list existing tidak hilang. |
| 2. Base identity ke BlockyCharacter | Tambahkan komposisi base model pada rig utama; pertahankan entry point API lama. Bergantung fase 1. | BlockyCharacter source/generator, CharacterData, adapter resolver, tests. | Mesh ganda, ukuran/pivot salah, Steve/Alex berubah tampilan. | Snapshot/fixture geometri dan bounds enam model; old `loadFromPlayer`, `loadFromData`, preset tetap berfungsi; unknown ID fallback terukur. |
| 3. Look dan Gear per rig | Tetapkan aturan Look dan whitelist Gear tiap karakter; data tetap milik PlayerData/server. Bergantung fase 2 dan persetujuan matriks. | BlockyCharacter, CharacterData rig metadata, test fixtures Gear/Look. | Gear menutup identitas, data tersimpan terhapus, Outfit jadi sumber state lain. | Tes seluruh Look values dan slot Gear; unsupported visual tidak mengubah PlayerData/equip; restore Gear saat kembali ke model yang kompatibel. |
| 4. Animasi dan action capabilities | Petakan locomotion/action existing ke rig; bukan membuat engine kedua. Bergantung fase 2; perlu aturan Creeper/Ender disetujui. | BlockyCharacter/template, rig adapter, `tests/blocky-actions.test.js`, Gameplay fixtures. | Pose tangan pada Creeper, timing/action API berubah, animasi berbeda mengganggu aksi. | Setiap action existing dites per rig/capability; gameplay result tetap sama; action unsupported memiliki fallback eksplisit. |
| 5. Lobby dan Profile | Pakai resolver dan renderer utama untuk full model, face, label, aura anchor. Bergantung fase 2–4. | `assets/js/pages/lobby.js`, `profile.js`, `character-face.js`, HTML script chain, tests. | Model hero, foto wajah, dan label tidak selaras; aura/framing stale. | Ganti ID saja mengubah ketiga output; fallback tanpa WebGL dan aura/frame lama tetap tersedia. |
| 6. Room dan remote appearance | Gunakan `equipped.skin` server untuk wajah pemain remote; tentukan fallback `characterSkinId` tanpa dual state. Bergantung kontrak resolver dan fase 5. | `assets/js/pages/room.js`, `character-face.js`, `appearance-service.js` hanya bila perlu, tests. | Appearance belum tersedia/stale; alias format lama berbeda; cache salah. | Tes payload lengkap/kosong, retry, alias format yang disetujui, lokal/remote, dan no-WebGL. Tidak mengubah RPC pada fase ini. |
| 7. Gameplay dan NPC/CPU | Integrasikan identity ke upgrade renderer local/remote; tetapkan descriptor terpisah untuk NPC. Bergantung fase 2–4 dan kontrak remote. | `gameplay/js/main.js`, `assets/js/game-integration.js`, `assets/js/room-flow.js`, Gameplay tests. | Regresi `makePawn`, pawn scale/Aura/target, dual identity pada legacy dan modern, Villager CPU berubah. | Tes lokal/remote/CPU/NPC, identity dan appearance konsisten, aksi permainan dan pergerakan tetap baseline. Browser Gameplay nyata sebelum klaim visual. |
| 8. Preview dan kompatibilitas CharacterView | Terapkan preview katalog berbasis resolver; pertahankan CharacterView selama ada konsumen legacy. Hapus hanya setelah caller, fallback, dan rollback tidak memerlukan. | `assets/js/item-art.js`, `assets/js/character-view.js`, `assets/js/pages/tambang.js`, katalog/preview tests. | Fallback Tambang atau item art putus; ukuran model berbeda di preview. | Preview semua enam identitas dengan/ tanpa WebGL; `CharacterView` hanya dihentikan setelah tidak ada call site aktif dan tes fallback lulus. |

## 11. Risiko, rekomendasi, dan persetujuan yang diperlukan

### Rekomendasi

1. Jadikan `BlockyCharacter` satu-satunya basis renderer karakter pemain seperti arah yang sudah disetujui; gunakan `CharacterData` untuk geometri, bukan untuk ownership atau state pemain.
2. Pertahankan `CharacterView` sementara hanya untuk call site kompatibilitas yang masih aktif (fallback miner di Tambang); jangan menggunakannya sebagai player renderer kedua.
3. Selesaikan generator/source-of-truth mismatch sebelum perubahan pada BlockyCharacter. Jangan menjalankan build yang berpotensi mengganti asset sebelum generator parity diperbaiki.
4. Gunakan `equipped.skin` dari server Appearance sebagai identitas remote utama. Jadikan `characterSkinId` hanya fallback/alias kompatibilitas apabila formatnya disetujui.
5. Untuk slot Look/Gear yang tidak kompatibel, jangan mengubah state tersimpan; rekomendasi awal adalah menyembunyikan render bagian yang tidak didukung dan mencatat fallback, bukan unequip.
6. Pertahankan Villager sebagai CPU/NPC Gameplay sampai keputusan produk menyatakan NPC memakai katalog karakter.

### Risiko dan keputusan yang masih menunggu persetujuan

| Pertanyaan | Rekomendasi awal | Status |
|---|---|---|
| Apakah Look skin/eyes/hair/gender/body boleh mengubah identitas khusus Zombie/Skeleton/Creeper/Enderman? | Kunci atribut yang membentuk identitas khusus; simpan Look pemain tetapi tidak aplikasikan pada bagian unsupported. | **NEEDS APPROVAL** |
| Saat Gear tidak cocok dengan model, apakah bagian harus disembunyikan, diganti attachment, atau karakter tidak boleh dipilih? | Simpan equip; sembunyikan render saja sampai ada whitelist/attachment. | **NEEDS APPROVAL** |
| Apakah proporsi Enderman boleh tetap lebih tinggi di Gameplay, atau semua pawn harus dinormalisasi ke tinggi yang sama? | Pertahankan proporsi model, lalu uji marker/camera/aura/footprint; jangan menormalkan tanpa uji visual. | **NEEDS APPROVAL** |
| Apakah `characterSkinId` masih harus menjadi sumber fallback remote; format ID lama apa yang didukung? | Utamakan `equipped.skin`; pertahankan alias selama kontrak lama aktif. | **NEEDS APPROVAL** |
| Apakah CPU tetap Villager dan bagaimana identitas NPC Tambang dipilih? | Pertahankan Villager CPU; tetapkan NPC sebagai preset/model non-ownership. | **NEEDS APPROVAL** |
| Untuk Creeper, action tangan seperti attack/bow/block harus diabaikan atau diberi animasi khusus? | Jangan memaksakan lengan; pakai fallback rig hanya setelah disetujui dan diuji. | **NEEDS APPROVAL** |
| Apakah rig/capability ditempatkan di CharacterData adapter atau manifest Registry? | Letakkan bersama definisi model agar tidak menduplikasi struktur model di manifest; Registry tetap referensi identitas. | **PROPOSED** |

## 12. Verifikasi audit dan checkpoint

- Evaluasi Node VM read-only atas `CharacterData` mengonfirmasi jumlah box dan bounds enam model pada tabel di atas.
- Pemeriksaan kontrak source mengonfirmasi `equipped.skin` ada dalam PlayerData dan server Appearance, sedangkan `look.skin` tetap string warna `s1`–`s5`.
- Simulasi read-only pipeline generator BlockyCharacter menunjukkan marker section yang dicari tidak ditemukan pada `karakter.html`; proses berhenti pada section 1 sebelum ada penulisan file. Pipeline generator CharacterData dibaca, tetapi tidak dijalankan. Source produksi tetap tidak berubah.
- Tidak ada automated test suite yang dijalankan: tahap ini hanya audit/desain dan tidak mengubah behavior. Tidak ada jsdom, browser nyata, visual, audio, live Gameplay, atau benchmark performa yang dijalankan.
- Laporan ini adalah checkpoint audit-only terpisah di branch `restruktur`. Setelah commit/push, verifikasi akhir memastikan `HEAD == origin/restruktur`, worktree bersih, dan `main`/`origin/main` tetap `aeb11acf130df4ade4acc9417f01470e40a33dbb`. Hash audit disertakan pada hasil penyelesaian.

Stage 8.3 selesai sebagai desain untuk ditinjau. Tidak ada integrasi renderer atau tahap implementasi lanjutan yang dimulai.
