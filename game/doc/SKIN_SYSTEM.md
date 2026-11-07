> **DIHAPUS (Stage 4.2.2):** skin PNG (hero, knight, ninja_red, pejabat, sakura, warden) dan folder `data/skins/` sudah dihapus. Semua skin kini memakai model voxel `UT.CharacterData` (lihat `CHARACTER_DATA.md`). Isi dokumen di bawah hanya riwayat; `skinPng()` tidak ada lagi. Kode PNG di `gameplay.html` (`PNG_DEFS`, `loadSkin3D`) dan `gameplay/skin-uv.js` kini tidak terpakai dan sengaja dibiarkan (gameplay tidak diubah).

# Skin System (Tahap 3.2) — fondasi skin karakter berbasis PNG

PNG adalah **texture**, bukan model baru. Satu model karakter voxel dapat memakai banyak PNG.

```
PNG Skin → Skin Catalog → PlayerData (owned) → Inventory → Equipped Skin → Gameplay Character
(data/skins)  (item-catalog.js)  (player-data.js)               (equipped.skin)    (DEFERRED)
```

| Hal | Isi |
|---|---|
| Supported format | PNG (RGBA atau palet ber-transparansi), latar transparan, pixel-art tanpa smoothing |
| Supported template | **64×64, layout skin Minecraft modern** (anggota badan kiri terpisah). Hasil audit 6 PNG yang ada. Ukuran lain ditolak oleh `ItemArt.loadSkinTexture` (`ukuran-tidak-didukung`). Layout klasik 64×32 belum didukung (tidak ditemukan di project) |
| Texture location | `game/data/skins/` — di catalog ditulis relatif: `data/skins/<nama>.png` |
| Catalog | `game/assets/js/item-catalog.js` (satu-satunya sumber; tidak ada katalog skin kedua) |
| Ownership | `PlayerData` — `inventory["skin.<key>"]` |
| Equipped state | `PlayerData` — `equipped.skin` (ID canonical, mis. `skin.hero`); alias baca-saja `PlayerData.equippedSkin()` |
| Preview | Inventory, Shop, Profile — satu helper `ItemArt` (`face()` / `character()`); crop texture, `image-rendering: pixelated` |
| Gameplay renderer | **Existing / deferred** — `gameplay.html` tidak diubah |
| Fallback | skin default `skin.steve` (`ItemCatalog.fallbackSkinId()`) |

## Hasil audit `game/data/skins/*.png`

| File | Ukuran | Mode | Template | Lengan |
|---|---|---|---|---|
| hero.png | 64×64 | RGBA | Minecraft modern | classic |
| knight.png | 64×64 | RGBA | Minecraft modern | slim (3 px) |
| ninja_red.png | 64×64 | P (palet + transparansi) | Minecraft modern | classic |
| pejabat.png | 64×64 | RGBA | Minecraft modern | classic |
| sakura.png | 64×64 | RGBA | Minecraft modern | slim (3 px) |
| warden.png | 64×64 | RGBA | Minecraft modern | classic |

Lengan `slim` ditentukan dari piksel yang transparan pada kolom lengan (audit), disimpan sebagai `arms: 'slim'` di catalog. Tidak ada PNG non-skin di folder ini.

## Skin lama (legacy)

`steve`, `alex`, `creeper`, `zombie`, `skeleton`, `ender` tetap ada: `renderer: 'palette'`, `texture: null`. Tidak ada PNG palsu. Skin dari halaman UI lama (explorer-neon, dst.) tetap UNMAPPED seperti di `DATA_MIGRATION.md`.

## Metadata skin PNG di catalog

`skinPng(gameKey, name, file, extra)` menghasilkan `{ id: 'skin.<key>', kind: 'skin', texture: 'data/skins/<file>', renderer: 'png', arms, price: null, rarity: 'common', starter: false }`.

- `price: null` = ekonomi belum ditentukan → tidak dijual di Shop dan tidak bisa dibeli (`PlayerData.purchase` menolak). Sama seperti Power-Up.
- `rarity: 'common'` hanyalah default netral UI, **bukan** rarity sungguhan.
- Karena bukan starter dan tidak dijual, skin PNG **tidak otomatis dimiliki**; kepemilikan diberi lewat `PlayerData.grant({ item: 'skin.hero' })` (reward/event) sampai ekonominya ditentukan.

## Menambah skin baru

1. Taruh PNG 64×64 di `game/data/skins/` (nama konsisten, mis. `forest_knight.png`).
2. Tambah satu baris di `item-catalog.js`: `skinPng('forest_knight', 'Forest Knight', 'forest_knight.png')` (tambah `{ arms: 'slim' }` bila lengannya 3 px).
3. Beri kepemilikan lewat `PlayerData` (mis. `grant`).

Renderer/preview tidak perlu diubah. Path harus relatif, berakhiran `.png`, tanpa URL, drive Windows, `..`, atau spasi (divalidasi saat catalog dimuat; path buruk hanya mencatat `console.error` dan skin tampil dengan fallback).

## Validasi & fallback

`ItemArt.loadSkinTexture(id)` → Promise yang **selalu resolve**: `{ ok, usedId, fallback, reason, image?, width?, height? }`. Alasan gagal: `path-tidak-valid`, `gagal-dimuat` (404/korup), `ukuran-tidak-didukung`, `bukan-png` (signature bukan PNG, bila `fetch` bisa dipakai). `ItemArt.resolveSkinId(id)` mengembalikan `id` bila OK, selain itu `skin.steve`.

- Kepemilikan dan `equipped.skin` **tidak pernah dihapus** karena PNG gagal.
- Preview SVG menggambar skin cadangan sebagai alas di bawah crop PNG, jadi PNG hilang tidak menghasilkan karakter kosong.
- `ItemArt.makeSkinTexture(THREE, image)` menyiapkan texture three.js dengan `NearestFilter` tanpa mipmap, untuk tahap integrasi gameplay.

## Status integrasi gameplay: DEFERRED

- `gameplay.html` dan renderer karakter tidak diubah. Gameplay hanya mengenal skin `palette`.
- `game-integration.js` (jembatan, bukan logika game) hanya meneruskan skin `palette`. Skin PNG yang terpasang digantikan skin cadangan `steve` **hanya untuk konfigurasi gameplay**; `equipped.skin` di PlayerData tidak berubah.
- Lobby (hero 3D) dan model 3D lain masih memakai palet cadangan untuk skin PNG; Inventory, Shop, dan Profile menampilkan preview PNG.
- Target berikutnya: `PlayerData.equippedSkin()` → gameplay config → character renderer → `ItemArt.loadSkinTexture` + `makeSkinTexture`.

## Di luar cakupan Tahap 3.2

Upload/custom skin, SFX (`README_AUDIO.md` tidak diubah), dan modularisasi gameplay.
