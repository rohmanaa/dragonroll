# Character Data (data karakter bersama)

> **Catatan:** model Steve/Alex di file ini kini hanya cadangan. Karakter PEMAIN di semua halaman memakai rig halaman Karakter — lihat `doc/CHARACTER_SYNC.md`.

Satu sumber detail model voxel karakter & mob gameplay, agar halaman lain (lobby, leaderboard, profil, shop, inventory, dll.)
memakai tampilan yang sama dengan gameplay — bukan lagi wajah 8×8 sederhana.

- File: `assets/js/character-data.js` (skrip klasik, global `UT.CharacterData`, tanpa dependency; three.js hanya untuk `mesh()`)
- Sumber data: diekstrak apa adanya dari `gameplay.html` (`makePawn`, `addCreeper`, `addEnderman`, `addSkeleton`, `addZombie`, `addWarden`,
  `addVillager`, `addBlaze`, `makeHostile`). **`gameplay.html` tidak diubah** — gameplay tetap memakai kodenya sendiri.
- Regenerasi bila model di gameplay berubah: `cd game && node tools/character-data/build.js`
- Preview: `tools/character-preview.html`

## Isi
| Grup | Key |
|---|---|
| `player` | steve, alex, creeper, ender, zombie, skeleton, villager |
| `mob` | creeper, ender, skeleton, zombie, warden, villager, blaze (mob di petak papan) |
| `wild` | golem, spider, zombie, skeleton, creeper (mob liar) |

Satu box = `[x, y, z, w, h, d, '#rrggbb', noEdge, tag]` (pusat box, satuan dunia gameplay, kaki di y=0, menghadap +z).
`tag`: 0 biasa · 2 batang Blaze · 3 blok kepala 0.3 (di gameplay = 27 kubus 0.1 dengan variasi warna).

## API
```js
UT.CharacterData.list('player')                         // ['steve', ...]
UT.CharacterData.get('mob', 'warden')                   // {name, hex, css, boxes, bounds, ...}
UT.CharacterData.svg('player', 'alex', {view:'iso', size:160})   // view: front | iso | back | side; yaw/pitch bebas
UT.CharacterData.face('player', 'steve', {size:64})              // kepala saja (thumbnail/leaderboard)
UT.CharacterData.svg('mob', 'warden', {bust:true})                // bust = setengah badan atas
UT.CharacterData.mesh(THREE, 'wild', 'golem', {scale:1})         // THREE.Group (1 mesh, vertex color) untuk lobby 3D
UT.CharacterData.SEATS                                           // warna kursi Merah/Biru/Kuning/Hijau
```
Pakai di halaman: `<script src="assets/js/character-data.js"></script>` lalu masukkan hasil `svg()` ke `innerHTML`.

## Dipakai di halaman (Stage 4.2.2)
- **Model 3D** lewat `assets/js/character-view.js` → `UT.CharacterView.make(THREE, skinIdAtauKey, emote)`: Lobby, Inventory, Shop, Profil, Leaderboard (podium). Model dipecah otomatis jadi sendi (kepala+leher, mata berkedip, tangan kiri/kanan, kaki kiri/kanan, badan) lewat `mesh(..., {boxes})`. Emote: idle, wave, dance, victory, cheer, laugh, celebrate; pose berpindah halus dan bisa diganti runtime lewat `g.userData.setEmote('dance')`.
- **Wajah/gambar 2D** lewat `ItemArt.face()/character()` (otomatis memakai `UT.CharacterData`, cadangan = gambar palet lama bila skrip tidak dimuat): grid Inventory/Shop/Profil, avatar Lobby, Leaderboard (`NK` = peta pemain contoh → karakter), frame avatar, ikon hadiah skin, ilustrasi kartu `mode.html`.
- Halaman **Teman** dan **Hadiah Harian** sengaja tidak memakai karakter, melainkan mob: lihat `doc/MOB_VIEW.md`.
- Skin PNG sudah dihapus (katalog, `data/skins/`, preload). Kepemilikan/equipped lama yang menunjuk skin PNG otomatis dibuang `PlayerData.sanitize` dan kembali ke skin bawaan.
- Skin PNG di katalog tidak ada lagi, jadi `META` tidak memuat entri PNG.
