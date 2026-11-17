# SFX — Ular Tangga Blok

Struktur: `assets/audio/sfx/<kategori>/<nama>.<ext>` (nama kebab-case, maksimal 3 kata).
Semua path file gameplay dikumpulkan di **satu tabel `FILE`** di `gameplay/js/audio.js`; ganti/menambah file cukup ubah baris di sana.
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
| `win/` | `firework-launch.ogg` | Firework visual (`UT.FireworkFX`), 1x per event | `firework` |
| `mob/` | `mob-punch.mp3` | mob menghantam (lapis pukulan) | `hit` |
| | `player-hurt.mp3` | pemain kena hit (creeper, skeleton, melee) | `playerHurt` |
| | `creeper-fuse.mp3` | creeper menyala | `creeper` |
| | `skeleton-shoot.mp3` | skeleton menembak | `skeltonSh` |
| | `enderman-teleport.mp3` | enderman teleport | `enderman` |
| | `creeper-explosion.mp3`, `creeper-hiss.mp3`, `enderman-alt.mp3`, `mob-hit-alt.mp3` | *belum dipakai* | — |
| `dragon/` | `naga-bumper.mp3` | suara naga ±1 dtk pada intro logo `splash.html` (taruh file dari Pixabay di sini; bila belum ada, intro tetap jalan tanpa suara) | — |
| `dragon/` | `dragon-idle.mp3` | naga muncul / bertengger / saat diserang | `dragonSpawn`, `dragonIdle` |
| | `dragon-hurt.mp3` / `dragon-death.mp3` | naga kena / kalah | `dragonHurt` / `dragonDeath` |
| | `earthquake.mp3` | gempa saat gunung runtuh | `quakeStart` / `quakeStop` |
| | `tower-rise.mp3` | tower naik | `towerRise` / `towerStop` |
| | `crystal-appear.mp3` | End Crystal muncul | `crystalAppear` |
| | `crystal-break.mp3` | crystal hancur | `crystalBreak` |
| `assets/audio/sfx/` | `notification.mp3` | notif undangan teman (muncul lagi tiap 10 dtk, maks 3x) | `UT.Audio 'notif'` |
| `assets/audio/sfx/` | `dragon-arena-up-before-crystal.mp3` | Dragon Arena naik setelah gempa, sebelum tower/crystal (Awakening) | `arenaUp` / `arenaStop` |
| `assets/audio/sfx/` | `setalah-hancurkan-crystal.mp3` | semua 4 Crystal hancur (READY); fallback = fanfare sintetis | `crystalsCleared` |
| `assets/audio/sfx/` | `dragon-awakening.mp3` | Awakening lama (tidak dipakai; fallback sintetis bila gagal) | `dragonAwakening` |

Catatan: semua sfx file menghormati tombol mute dan punya fallback bunyi sintetis bila file gagal diputar.

## Audio Pet

Tujuh belas SFX yang hanya dipakai Pet berada di `data/inventory/pet/<gameKey>/sfx/`; path kanonisnya tercatat di manifest Pet. Empat SFX shared berada di `assets/audio/sfx/pet/`:

| File | Pemakaian shared |
|---|---|
| `storm-wolf-zap.mp3` | Storm Wolf |
| `inferno-dragon-fire.mp3` | Inferno Dragon |
| `celestial-kitsune-bell.mp3` | Celestial Kitsune |
| `celestial-kitsune-shine.mp3` | Celestial Kitsune |

`tools/normalize-sfx.py` mencakup SFX shared, SFX Pet-owned, dan SFX gameplay. Musik tetap di `assets/audio/music/` karena tidak ada musik khusus Pet.

## File SFX tambahan di `assets/audio/sfx/`

Nama file ini disimpan langsung di `assets/audio/sfx/` dan tetap memakai fallback sintetis bila file gagal diputar.

| File | Fungsi (`sfx.*`) | Dipakai untuk |
|---|---|---|
| `hiss.mp3` | `hiss` | desis ular sebelum menggigit |
| `chomp.mp3` | `chomp` | ular menggigit |
| `gulp.mp3` | `gulp` | ular menelan |
| `ladder.mp3` | `ladder` | pion memanjat tangga (animasi `climb`) |
| `pop.mp3` | `pop` | pop umum |
| `bounce.mp3` | `bounce` | memantul / giliran hangus |
| `win.mp3` | `win` | tiba di Block 100 |
| `win2.mp3` | `victory` | layar menang (`celebrate`) |
| `shuffle.mp3` | `shuffleTick` | tiap pergantian angka di meter dadu spesial |
| `villager.mp3` | `villager` | Villager membantu (maju 5 blok) |

## Identitas Suara Power

Katalog saat ini memiliki 17 Power. Tiap game key memakai resep SFX tersendiri di `assets/js/renderers/power-3d/power-sound.js`; aktivasi dan efek utama memakai fase terpisah, termasuk efek khas Power saat jebakan terpicu. Suara tidak mengambil musik atau ledakan Creeper sebagai fallback. Penggunaan berulang mendapat variasi pitch kecil ±2%.

| Lapisan | Rentang sasaran |
|---|---:|
| Aktivasi | 0,2–0,5 dtk |
| Slash / impact | 0,2–0,7 dtk |
| Ledakan | 0,5–1,2 dtk |
| Efek magic | 0,5–1,5 dtk |
| Efek legendary | 1–2,5 dtk |

SFX berbasis file disimpan di `assets/audio/sfx/powerup/` dan dirujuk dari tabel `FILE` di `gameplay/js/audio.js`. Nama sumber disederhanakan menjadi kebab-case:

| File | Lapisan | Power |
|---|---|---|
| `sword-unsheathing.mp3` | Aktivasi (maks. 0,44 dtk) | Iron Sword |
| `sword-slice.mp3` | Impact (maks. 0,68 dtk) | Iron Sword |
| `metal-whoosh-hit.mp3` | Impact (maks. 0,68 dtk) | Diamond Sword |
| `wind-magic.mp3` | Aktivasi (0,2 dtk) | Feather |
| `long-whoosh.mp3` | Action (0,5 dtk) | Feather |
| `epic-whoosh.mp3` | Finish (0,3 dtk, volume lapisan 28%) | Feather |
| `explosion-fx.mp3` | Ledakan awal (0,8 dtk) | TNT |
| `deep-explosion.mp3` | Bass / boom (1,3 dtk) | TNT |
| `debris-break.mp3` | Debris akhir (0,6 dtk; mulai pada 1 dtk) | TNT |

Feather memakai volume 68%, pitch dasar 1,1 dengan variasi ±2%, dan satu sparkle sintetis bereverb ringan pada finish. Power tanpa layer file memakai suara sintetis unik berbasis material/elemen; file pedang dan Feather yang gagal diputar kembali ke resep sintetis Power yang sama.

TNT berbunyi fuse sintetis singkat saat dipasang; saat terpicu, tiga layer ledakan dipitch pada 0,9 dan selesai sekitar 1,7 dtk. Boom mendapat bass shelf +6 dB, kompresor antardistorsi, dan reverb medium; debris akhir sedikit lebih pelan. Layer dan resep TNT berbeda dari Blaze Core.
