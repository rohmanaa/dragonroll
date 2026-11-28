# SFX — Ular Tangga Blok

Struktur: `assets/audio/sfx/<kategori>/<nama>.<ext>` (nama kebab-case, maksimal 3 kata).
Semua path file gameplay dikumpulkan di **satu tabel `FILE`** di `src/gameplay/js/audio.js`; ganti/menambah file cukup ubah baris di sana.
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

Katalog saat ini memiliki 17 Power. Tiap game key memakai resep SFX tersendiri di `src/renderers/power-3d/power-sound.js`; aktivasi dan efek utama memakai fase terpisah, termasuk efek khas Power saat jebakan terpicu. Suara tidak mengambil musik atau ledakan Creeper sebagai fallback. Penggunaan berulang mendapat variasi pitch kecil ±2%.

| Lapisan | Rentang sasaran |
|---|---:|
| Aktivasi | 0,2–0,5 dtk |
| Slash / impact | 0,2–0,7 dtk |
| Ledakan | 0,5–1,2 dtk |
| Efek magic | 0,5–1,5 dtk |
| Efek legendary | 1–2,5 dtk |

SFX berbasis file disimpan di `assets/audio/sfx/powerup/` dan dirujuk dari tabel `FILE` di `src/gameplay/js/audio.js`. Nama sumber disederhanakan menjadi kebab-case:

| File | Lapisan | Power |
|---|---|---|
| `sword-unsheathing.mp3` | Aktivasi (maks. 0,44 dtk) | Iron Sword |
| `sword-slice.mp3` | Impact (maks. 0,68 dtk) | Iron Sword |
| `metal-whoosh-hit.mp3` | Legacy impact (tidak dipakai mix Diamond Sword saat ini) | Legacy |
| `diamond-sword-crystal-unsheathe.mp3` | Aktivasi (0,3 dtk) | Diamond Sword |
| `diamond-sword-slash-whoosh.mp3` | Attack (0,4 dtk) | Diamond Sword |
| `diamond-sword-metal-impact.mp3` | Impact (0,5 dtk) | Diamond Sword |
| `diamond-sword-crystal-resonance.mp3` | Finish (0,3 dtk) | Diamond Sword |
| `wooden-shield-equip.mp3` | Aktivasi (0,3 dtk) | Wooden Shield |
| `wooden-shield-impact.mp3` | Defense saat blok (0,4 dtk) | Wooden Shield |
| `wooden-shield-resonance.mp3` | Finish setelah blok (0,3 dtk) | Wooden Shield |
| `wind-magic.mp3` | Aktivasi (0,2 dtk) | Feather |
| `long-whoosh.mp3` | Action (0,5 dtk) | Feather |
| `epic-whoosh.mp3` | Finish (0,3 dtk, volume lapisan 28%) | Feather |
| `explosion-fx.mp3` | Ledakan awal (0,8 dtk) | TNT |
| `deep-explosion.mp3` | Bass / boom (1,3 dtk) | TNT |
| `debris-break.mp3` | Debris akhir (0,6 dtk; mulai pada 1 dtk) | TNT |
| `totem-mystical-chime.mp3` | Aktivasi (0,3 dtk) | Totem |
| `totem-shield-activation.mp3` | Perlindungan (0,5 dtk) | Totem |
| `totem-magic-spell.mp3` | Resonansi akhir (0,5 dtk) | Totem |
| `golden-apple-activation.mp3` | Chime emas (0,3 dtk) | Golden Apple |
| `golden-apple-bite.mp3` | Gigitan apel (0,3 dtk) | Golden Apple |
| `golden-apple-healing.mp3` | Energi penyembuhan naik (0,7 dtk) | Golden Apple |
| `golden-apple-finish.mp3` | Sparkle emas (0,3 dtk) | Golden Apple |
| `fire-charge-ignition.mp3` | Ignition saat dipasang (0,2 dtk) | Fire Charge |
| `fire-charge-magic.mp3` | Charge energi api (0,4 dtk) | Fire Charge |
| `fire-charge-whoosh.mp3` | Launch proyektil cepat (0,4 dtk) | Fire Charge |
| `fire-charge-impact.mp3` | Impact semburan api (0,5 dtk) | Fire Charge |
| `ice-crystal-chime.mp3` | Aktivasi crystalline (0,3 dtk) | Ice Crystal |
| `ice-crystal-charge.mp3` | Energi es naik (0,4 dtk) | Ice Crystal |
| `ice-crystal-release.mp3` | Burst es tajam (0,4 dtk) | Ice Crystal |
| `ice-crystal-shatter.mp3` | Pecahan kristal saat impact (0,6 dtk) | Ice Crystal |
| `blaze-core-ignition.mp3` | Ignition api dalam (0,3 dtk) | Blaze Core |
| `blaze-core-molten.mp3` | Dengung energi molten (0,6 dtk) | Blaze Core |
| `blaze-core-eruption.mp3` | Eruption api (0,5 dtk) | Blaze Core |
| `blaze-core-resonance.mp3` | Resonansi bara akhir (0,5 dtk) | Blaze Core |
| `trident-activation.mp3` | Electric weapon charge (0,3 dtk) | Trident |
| `trident-crackle.mp3` | Crackle listrik naik (0,5 dtk) | Trident |
| `trident-whoosh.mp3` | Electric whoosh (0,4 dtk) | Trident |
| `trident-thunder.mp3` | Sambaran dan thunder (0,7 dtk) | Trident |
| `nether-star-activation.mp3` | Deep celestial bell (0,4 dtk) | Nether Star |
| `nether-star-charge.mp3` | Energi kosmik naik (0,8 dtk) | Nether Star |
| `nether-star-release.mp3` | Massive energy blast (0,7 dtk) | Nether Star |
| `nether-star-finish.mp3` | Resonansi kristal surgawi (0,8 dtk) | Nether Star |
| `potion-drink.mp3` | Minum (0,4 dtk) | Ramuan Ganjil |
| `potion-bubbling.mp3` | Gelembung pendek (0,28 dtk) | Ramuan Ganjil |
| `potion-dark-magic.mp3` | Shimmer menurun (0,6 dtk) | Ramuan Ganjil |
| `potion-even-drink.mp3` | Minum (0,4 dtk) | Ramuan Genap |
| `potion-even-healing-magic.mp3` | Efek magic cerah (0,6 dtk) | Ramuan Genap |
| `potion-even-magic-chime.mp3` | Chime naik (0,6 dtk; layer pendamping) | Ramuan Genap |

Feather memakai volume 68%, pitch dasar 1,1 dengan variasi ±2%, dan satu sparkle sintetis bereverb ringan pada finish. Power tanpa layer file memakai suara sintetis unik berbasis material/elemen; file pedang dan Feather yang gagal diputar kembali ke resep sintetis Power yang sama.

Diamond Sword memakai empat layer berurutan: aktivasi 0,3 dtk, slash 0,4 dtk, impact metal 0,5 dtk, dan resonansi kristal 0,3 dtk. Volume 85%, pitch dasar 1,05 ±2%, bass ringan, serta reverb medium-light; fallback sintetisnya juga punya slash dan finish kristal. Attack/impact lebih berat dan lebih berkilau daripada Iron Sword.

Wooden Shield berbunyi equip 0,3 dtk saat dipakai; impact kayu 0,4 dtk dan resonansi pelindung 0,3 dtk hanya saat shield benar-benar memblokir serangan. Volume 80%, pitch 0,95 ±2%, impact kering dengan getaran kayu low-mid dan reverb sangat ringan (0,06 dtk).

Golden Apple memakai chime emas 0,3 dtk, gigitan renyah 0,3 dtk, healing energy yang naik 0,7 dtk, lalu sparkle 0,3 dtk. Volume 75%, pitch 1,05 ±2%, dan reverb medium-light pada lapisan magis; fallback sintetis mempertahankan urutan aktivasi, gigitan, healing, dan finish.

Fire Charge berbunyi ignition 0,2 dtk saat dipasang; ketika terpicu, energi api naik 0,4 dtk, proyektil melesat 0,4 dtk, lalu impact menyembur 0,5 dtk. Volume 85%, pitch 1,0 ±2%, reverb medium dan bara tipis. Launch dibuat cepat dengan bass ringan, berbeda dari boom TNT yang berat.

Ice Crystal memakai chime 0,3 dtk, charging 0,4 dtk, release 0,4 dtk, lalu impact 0,6 dtk dengan layer crack dan pecahan kristal. Volume 78%, pitch 1,1 ±2%, reverb medium, high-frequency jernih, dan low-end ringan agar efeknya tajam tanpa gemuruh.

Blaze Core berbunyi ignition dalam 0,3 dtk saat dipasang; saat terpicu, energi molten berdengung 0,6 dtk, eruption 0,5 dtk, lalu resonansi bara 0,5 dtk. Volume 85%, pitch 0,9 ±2%, bass kuat dan reverb medium, dengan bara serta pulse energi. Karakternya berat dan magmatik, bukan ledakan TNT.

Trident memakai charge elektrik 0,3 dtk, crackle naik 0,5 dtk, electric whoosh 0,4 dtk, lalu sambaran dengan thunder 0,7 dtk. Volume 85%, pitch 0,95 ±2%, bass medium-strong dan reverb medium; crackle listrik ditambahkan tipis agar strike tetap tajam tanpa memanjangkan thunder.

Nether Star memakai chime surgawi 0,4 dtk, cosmic charge 0,8 dtk, energy blast 0,7 dtk, lalu resonansi kristal 0,8 dtk. Lapisan ditumpangtindihkan tipis agar keseluruhan berakhir sekitar 2,5 dtk. Volume 90%, pitch 0,85 ±2%, bass kuat dengan kompresi, reverb cinematic, dan shimmer high-frequency; fallback sintetis mempertahankan empat fase kosmik ini.

TNT berbunyi fuse sintetis singkat saat dipasang; saat terpicu, tiga layer ledakan dipitch pada 0,9 dan selesai sekitar 1,7 dtk. Boom mendapat bass shelf +6 dB, kompresor antardistorsi, dan reverb medium; debris akhir sedikit lebih pelan. Layer dan resep TNT berbeda dari Blaze Core.

Totem memakai volume 75%, pitch 0,95 ±2%, resonansi EQ ringan, dan reverb medium 0,28 dtk. Saat Totem memblokir serangan, hanya layer perlindungan yang berbunyi.

Ramuan Ganjil memakai glass-pop sintetis 0,2 dtk, minum + bubbling pendek 0,4 dtk, lalu shimmer misterius menurun selama 0,6 dtk; volumenya 70%, pitch 1,0 ±1%, dengan reverb ringan.

Ramuan Genap memakai glass-pop sintetis 0,2 dtk, gulp 0,4 dtk, lalu healing magic dan bright ascending chime selama 0,6 dtk; volumenya 70%, pitch 1,1 ±2%, dengan reverb ringan. Nada akhir naik dan karakternya cerah/beruntung, kontras dengan shimmer Ramuan Ganjil. Keduanya memiliki fallback sintetis alchemy.


