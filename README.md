# Ular Tangga Blok

Game ular tangga bertema voxel/Minecraft. Jalankan lewat server lokal (mis. `python3 -m http.server`) lalu buka `index.html`.

## Halaman
| File | Fungsi |
|---|---|
| `index.html` | Halaman pembuka. "Main Sekarang" -> `splash.html` |
| `ular tangga.html` | Beranda aplikasi (profil, koin, ringkasan, pintasan) |
| `inventory.html` | Koleksi item yang dimiliki (cari, filter, urut, gunakan) |
| `skins.html` | Pratinjau & terapkan skin karakter |
| `shop.html` | Toko dengan koin virtual (tanpa uang sungguhan) |
| `lobby.html` | Pilih mode, skin, tema, dadu -> `gameplay.html` |
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
