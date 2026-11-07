# Peta folder icon

Semua icon `.webp` dikelompokkan per fungsi. Path di HTML: `assets/Images/icon/<grup>/<nama>.webp`.

| Folder | Isi | Dipakai di |
|---|---|---|
| `currency/` | coin, coinadd, emerald, emeraldadd | bar mata uang semua halaman |
| `ui/` | back, gear, menu, refresh, copy, edit, lock, unlock, play, start, exit, focus, day, night | tombol umum (kembali, pengaturan, salin, edit, kunci, play, bintang); Gameplay: menu, keluar, ikuti bidak (`focus`), reset kamera (`refresh`), suasana siang/malam (`day`/`night`) |
| `audio/` | sound, mute, music, sfx | Gameplay: tombol suara (`sound`/`mute`), menu jeda (volume musik `music`, suara efek `sfx`) |
| `items/` | skin, dadu, power, efek, emote | tab kategori Shop & Inventory, Profil; Gameplay: banner event (`dadu`, `power`) |
| `lobby/` | shop, inventory, invenotry, dailyreward, gift, misi, mail, hand, trophy, leader | menu Lobby, Leaderboard, Friendship, Profil; Gameplay: mahkota layar menang (`leader`), banner chest (`invenotry`) |
| `mode/` | console, modekhsusus, tutorial, calndar, kontak, robot | halaman Pilih Mode, judul Profil |
| `rank/` | 1st, 2nd, 3rd | medali podium Leaderboard (peringkat 1–3) |
| `profile/` | user, globe, camera, 360 | halaman Profil; Gameplay: preset kamera (`camera`) |

Catatan:
- Nama file `calndar`, `modekhsusus`, `invenotry` memang typo dari aslinya; tidak di-rename agar tidak memutus referensi.
- `lobby/invenotry.webp` = peti, `lobby/inventory.webp` = tas ransel.
- Path dinamis: `shop.html` & `inventory.html` (`catImg` -> `icon/items/`), `profile.html` (`RI('grup/nama')`).
- Semua icon baru berukuran 256x256 (cukup untuk tampil <= 64px di layar 3x). Jangan taruh file 1024px di sini; perkecil dulu agar loading ringan.

## Peta ikon Gameplay (`gameplay.html`, `gameplay/hud.js`)

| Elemen HUD | Aset |
|---|---|
| Ikuti bidak (`#btnFollow`) | `ui/focus` |
| Reset kamera (`#btnCam`) | `ui/refresh` |
| Preset kamera (`#btnPreset`) | `profile/camera` |
| Kunci kamera (`#btnAngle`, mode LOCK) | `ui/lock` |
| Kamera bebas (`#btnAngle`, mode ANGLE) | `ui/unlock` |
| Suara (`#btnSnd`) | `audio/sound` / `audio/mute` (ganti saat diklik) |
| Menu (`#btnMenu`) | `ui/menu` |
| Layar menang: mahkota | `lobby/leader` |
| Panel Giliran (kanan bawah): mahkota di judul | `lobby/leader` (CSS `#side .tn>h3::before`) |
| Baris pemain yang sedang giliran (kiri atas): mahkota | `lobby/leader` (CSS `#side .pr.on::after`) |
| Judul panel Power-up (kiri atas) | `items/power` (CSS `#side .pu>h3::before`) |
| Tombol Roll dadu | `items/dadu` (CSS `#side .tn #btnRoll::before`) |
| Menu jeda: Lanjutkan | `ui/play` |
| Menu jeda: slider Musik | `audio/music` + `audio/sound` |
| Menu jeda: slider Suara efek | `audio/sfx` + `audio/sound` |
| Menu jeda: Keluar | `ui/exit` |
| Menu jeda: Suasana | `ui/day` / `ui/night` |
| Banner giliran / tiga kali 6 | `items/dadu` |
| Banner chest | `lobby/invenotry` |
| Banner power (pesan teks) | `items/power` |
| Tombol Power-up | `data/power/sm/*.webp` (via `item-catalog.js`) |

Masih SVG/emoji karena belum ada aset: layar kalah, tombol tutup (X), dan banner tangga/ular/mob/naga/perisai/pantul/info.


## Tabler Icons (`tabler/`)
Icon SVG outline dari [Tabler Icons](https://tabler.io/icons) v3.50.0 (lisensi MIT), warna mengikuti `currentColor`. Sudah dipakai di tombol HUD kanan atas Gameplay (`gameplay.html`, diputihkan lewat filter CSS `.hud .btn .hi`):

| Elemen HUD | File |
|---|---|
| Ikuti bidak (`#btnFollow`) | `tabler/focus-2.svg` |
| Reset kamera (`#btnCam`) | `tabler/refresh.svg` |
| Preset kamera (`#btnPreset`) | `tabler/camera.svg` |
| Kunci kamera (`#btnAngle`, LOCK) | `tabler/lock.svg` |
| Kamera bebas (`#btnAngle`, ANGLE) | `tabler/lock-open.svg` |
| Suara nyala / mati (`#btnSnd`) | `tabler/volume.svg` / `tabler/volume-off.svg` |
| Menu (`#btnMenu`) | `tabler/menu-2.svg` |
