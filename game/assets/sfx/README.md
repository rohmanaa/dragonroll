# SFX — Ular Tangga Blok

Struktur: `assets/sfx/<kategori>/<nama>.<ext>` (nama kebab-case, maksimal 3 kata).
Semua path file gameplay dikumpulkan di **satu tabel `FILE`** di `gameplay/audio.js`; ganti/menambah file cukup ubah baris di sana.
Halaman UI memakai `assets/js/app.js` (map `SFX`), dan daftar preload di `loading.html`, `splash.html`, `play.html`.

| Folder | File | Dipakai untuk | Fungsi (`sfx.*`) |
|---|---|---|---|
| `ui/` | `button-click.mp3` | klik tombol semua halaman | `UT.Audio 'button'` |
| | `chest-reward.mp3` | buka peti/hadiah di UI | `UT.Audio 'chest'` |
| | `power-claim.mp3` | beli/claim berhasil, power-up | `UT.Audio 'power'` |
| | `game-lose.mp3` | kalah | `UT.Audio 'kalah'` |
| `dice/` | `dice-roll.mp3` | lempar dadu (fade saat angka muncul) | `roll` / `rollStop` |
| `board/` | `pawn-hop.mp3` | pion melompat tiap langkah | `hop` |
| | `ladder-up.mp3` | naik tangga | `naiktangga` |
| | `snake-bite.mp3` | dicaplok ular | `caplokular` |
| | `block-100.mp3` | tiba di Block 100 | `hundred` |
| | `move-back.mp3`, `snake-bite-alt.mp3` | *belum dipakai* | — |
| `reward/` | `chest-open.mp3` / `chest-close.mp3` | peti di board | `chest` / `chestClose` |
| | `power-reward.mp3` | hadiah power-up / hadiah Dragon | `rewardpower` |
| `powerup/` | `sword-use.mp3` | *belum dipakai* (Pedang) | — |
| `win/` | `Firework_launch.ogg` | Firework visual (`UT.FireworkFX`), 1x per event | `firework` |
| `mob/` | `mob-punch.mp3` | mob menghantam (lapis pukulan) | `hit` |
| | `player-hurt.mp3` | pemain kena hit (creeper, skeleton, melee) | `playerHurt` |
| | `creeper-fuse.mp3` | creeper menyala | `creeper` |
| | `skeleton-shoot.mp3` | skeleton menembak | `skeltonSh` |
| | `enderman-teleport.mp3` | enderman teleport | `enderman` |
| | `creeper-explosion.mp3`, `creeper-hiss.mp3`, `enderman-alt.mp3`, `mob-hit-alt.mp3` | *belum dipakai* | — |
| `dragon/` | `dragon-idle.mp3` | naga muncul / bertengger / saat diserang | `dragonSpawn`, `dragonIdle` |
| | `dragon-hurt.mp3` / `dragon-death.mp3` | naga kena / kalah | `dragonHurt` / `dragonDeath` |
| | `earthquake.mp3` | gempa saat gunung runtuh | `quakeStart` / `quakeStop` |
| | `tower-rise.mp3` | tower naik | `towerRise` / `towerStop` |
| | `crystal-appear.mp3` | End Crystal muncul | `crystalAppear` |
| | `crystal-break.mp3` | crystal hancur | `crystalBreak` |
| *(root `sfx/`)* | `notification.mp3` | notif undangan teman (muncul lagi tiap 10 dtk, maks 3x) | `UT.Audio 'notif'` |
| *(root `sfx/`)* | `dragon-areana-up-before-crystal.mp3` | Dragon Arena naik setelah gempa, sebelum tower/crystal (Awakening) | `arenaUp` / `arenaStop` |
| *(root `sfx/`)* | `setalah-hancurkan-crsytal.mp3` | semua 4 Crystal hancur (READY); fallback = fanfare sintetis | `crystalsCleared` |
| | `../new sound/dragonAwakening.mp3` | Awakening lama (tidak dipakai; fallback sintetis bila gagal) | `dragonAwakening` |

Catatan: semua sfx file menghormati tombol mute dan punya fallback bunyi sintetis bila file gagal diputar.

## Folder `assets/new sound/` (pengganti SFX sintetis)

Dirujuk di `gameplay/audio.js` lewat `NS='../new sound/'`. Fungsi sintetis lama tetap jadi fallback bila file gagal diputar.

| File | Fungsi (`sfx.*`) | Dipakai untuk |
|---|---|---|
| `hiss.mp3` | `hiss` | desis ular sebelum menggigit |
| `chomp.mp3` | `chomp` | ular menggigit |
| `gulp.mp3` | `gulp` | ular menelan |
| `ladder.mp3` | `ladder` | pion memanjat tangga (animasi `climb`) |
| `pop.mp3` | `pop` | pop umum (+ Feather/Potion/Totem/Grass) |
| `bounce.mp3` | `bounce` | memantul / giliran hangus / ledakan TNT |
| `win.mp3` | `win` | tiba di Block 100 |
| `win2.mp3` | `victory` | layar menang (`celebrate`) |
| `shuffle.mp3` | `shuffleTick` | tiap pergantian angka di meter dadu spesial |
| `villager.mp3` | `villager` | Villager membantu (maju 5 blok) |
