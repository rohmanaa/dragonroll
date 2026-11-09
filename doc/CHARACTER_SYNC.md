# Sinkron karakter ke semua halaman

**Sumber kebenaran tampilan pemain = halaman Karakter** (`karakter.html`): rambut, mata, kulit, tubuh, outfit/gear, dan warna (dye).
Disimpan di `PlayerData` (`look`, `equipped`, `gearDye`) dan dicerminkan ke server (`player_appearance`) oleh `AppearanceService`.
Tampilan lain di game **tidak** punya data karakter sendiri — semuanya membaca dua sumber itu.

## Alur data
```
Karakter (UI) -> PD.setLook / equip / setGearDye -> notify('equip') -> AppearanceService.autoSync -> RPC appearance_save (server)
Halaman lain  -> PD.appearance()  (live: berlangganan PD)  + AppearanceService.refresh() saat dibuka (server menang)
Pemain lain   -> room_appearance_get(room)   (Room, Gameplay online)
              -> appearance_get_many(ids)    (Leaderboard; hanya pemain yang tampil di leaderboard + diri sendiri)
```

## Modul
| File | Peran |
|---|---|
| `assets/js/character-rig.js` | **GENERATED** dari `karakter.html` oleh `node tools/character-rig/build.js` (`--check` di CI). `UT.CharacterRig.create(THREE)` -> rig 3D; `portrait()` -> PNG dataURL untuk avatar 2D |
| `assets/js/character-view.js` | `make(THREE,'mine')` (live) · `make(THREE,{look,equipped,gearDye})` (pemain lain) · `mine()` · `refreshMine()` · `portrait()`. Mode lama (Steve/Alex dari `CharacterData`) hanya cadangan bila rig tidak dimuat |
| `assets/js/item-art.js` | `myFace()` / `myCharacter()` / `portraitHtml(app, frame)` — avatar 2D dari rig |
| `assets/js/appearance-service.js` | `refresh`, `pushAppearance`, `roomAppearance(roomId)`, `usersAppearance(ids)` |

Bila rig di `karakter.html` diubah (item baru, bentuk, dll.), jalankan `node tools/character-rig/build.js` dan commit hasilnya; CI gagal bila lupa.

## Dipakai di
Lobby (hero 3D + avatar), Profil, Dadu/Efek/Frame/Powerup (preview 3D), Room (avatar anggota), Gameplay (bidak pemain lokal & online, wajah HUD + frame), Leaderboard (podium top-3 + avatar baris).

## Belum / sengaja tidak
- Kategori "Skin" lama (Steve/Alex/Creeper/...) masih ada di katalog tetapi tidak lagi mengubah tampilan karakter.
- Gameplay offline: hanya kursi pemain 1 memakai karakter builder; kursi lokal lain memakai skin lama, CPU = Villager.
- Halaman Teman memakai mob dekoratif (disengaja).
