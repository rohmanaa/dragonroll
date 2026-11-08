# Ular Tangga Blok

Game ular tangga bertema voxel/Minecraft. Jalankan lewat server lokal (mis. `python3 -m http.server`) lalu buka `index.html`.

## Halaman
| File | Fungsi |
|---|---|
| `index.html` | Halaman pembuka. "Main Sekarang" -> `splash.html` |
| `ular tangga.html` | Beranda aplikasi (profil, koin, ringkasan, pintasan) |
| `karakter.html` | Karakter: baju, celana, sepatu, helm, zirah, bahu, jubah, senjata, aksesori. Item terkunci bisa di-preview, beli pakai coin |
| `frame.html` / `dadu.html` | Frame profil & skin dadu: semua item tampil, terkunci bisa di-preview, beli pakai coin |
| `efek.html` | Efek/aura: kerangka kosong (belum ada item efek di game) |
| `powerup.html` | Power-up (pedang, bulu, TNT, dll): jumlah yang dimiliki |
| `hadiah-misi.html` | Hadiah Harian + Misi Harian, tab di kiri (memuat `dailyreward.html` & `misi.html` dengan `?embed=1`; keduanya transparan saat embed dan memakai satu latar milik `hadiah-misi.html`) |
| `skins.html` | Pratinjau & terapkan skin karakter |
| `shop.html` | Toko khusus beli Coin (tukar Emerald); Emerald (tonton iklan) di panel terpisah |
| `lobby.html` | Menu utama: Karakter, Frame, Dadu, Efek, Power-up, Leaderboard, Toko, Teman, Hadiah & Misi, Mulai -> mode |
| `gameplay.html` | Game 3D (logika asli tidak diubah) |
| `ular-tangga.html` | Versi monolit lama (tidak diubah, tidak ditautkan) |

## Kode bersama (`assets/js/`, gaya di `assets/css/`)
- `item-catalog.js` : satu-satunya sumber harga & metadata item.
- `player-data.js` : saldo, inventory, item aktif; `localStorage["ularTanggaBlok:player:v1"]`.
- `item-art.js`, `app-ui.js`, `navigation.js` : gambar SVG item, toast/modal, bottom nav.
- `game-integration.js` : memastikan gameplay hanya memakai skin/tema/dadu yang dimiliki.

Data hanya tersimpan di browser yang dipakai (tanpa akun/server).

## Karakter & mob
- `assets/js/character-data.js` (`UT.CharacterData`) = model karakter pemain/mob gameplay; `character-view.js` = karakter 3D di halaman. Lihat `doc/CHARACTER_DATA.md`.
- `assets/js/mob-view.js` (`UT.MobView`) = mob dekoratif reusable (kupu-kupu + bunga di Teman, ayam di Hadiah Harian). Lihat `doc/MOB_VIEW.md`.
- Skin PNG sudah dihapus; semua skin memakai model voxel yang sama dengan gameplay.

## Dadu 3D bersama (Dice Kit)
- `assets/js/dice-kit/` = SATU mesin dadu 3D (fisika kocok-lempar, material/tekstur skin, partikel/aura, suara) yang dipakai `dadu.html` (preview Inventory) dan `gameplay.html` (dadu gameplay) lewat `window.DiceKit.mount()` dengan preset panggung yang sama (`DiceKit.STAGE`).
- Di gameplay kubus CSS lama sudah dihapus. `gameplay/dice-ui.js` (`UT.GameplayDiceUI`) memasang canvas 3D di `#dieScene`; angka hasil tetap ditentukan `gameplay.html` dan dikirim ke kit (`roll(forcedValue)`), jadi aturan (Ramuan, Pasti 6, tiga 6, multiplayer) tidak berubah. `showDie(v,true)` mengembalikan Promise yang selesai saat dadu mendarat.
- Efek tatakan (`dice-pad.js`) dipicu benturan dadu 3D (`UT.DicePadFX.impact`); suara dadu mengikuti tombol Suara & slider SFX gameplay.

