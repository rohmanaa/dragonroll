# GAMEPLAY_EXTRACTION_MAP — Stage 4.1.1

Status: audit + mapping + boundary + dokumentasi saja. **Tidak ada logic yang dipindahkan.**
`game/gameplay.html` tetap **source of truth**. Tidak ada file implementasi gameplay baru, tidak ada perubahan behavior.
Nomor baris mengacu pada `gameplay.html` pada HEAD `ded3992` (`stage4.0: add gameplay HUD feedback`, 2034 baris). Nomor baris akan bergeser setiap ada edit; nama function/konstanta adalah rujukan yang stabil.

## 0. Temuan struktural yang menentukan strategi extraction

1. **Seluruh gameplay berada di dalam satu IIFE** `(function(){ 'use strict'; ... })();` (±baris 364–2033). Artinya **tidak ada variable global sungguhan**. `scene`, `players`, `busy`, `cur`, `gameId`, `world`, `TILES`, `THEMES`, `sfx`, dst. adalah closure-local. Konsekuensi: setiap file hasil extraction nanti tidak bisa melihat variable tersebut kecuali ada mekanisme berbagi (mis. namespace `UT.Gameplay.*` atau parameter/injeksi). **Mekanisme berbagi ini harus diputuskan sebelum extraction pertama**, bukan saat extraction.
2. Pola yang sudah ada dan terbukti aman: `gameplay/hud.js` (`UT.GameplayHUD`) = classic script tanpa `import/export`, dipanggil lewat jembatan `hud(f,...a)` (try/catch, aman jika tidak termuat). Pola ini kandidat acuan untuk file berikutnya.
3. Urutan `<script>` saat ini: `boot-guard.js` (head) → Three.js r128 (CDN) → guard `__NO_THREE` → `item-catalog.js` → `player-data.js` → `game-integration.js` → `app.js` (`UT.App.init({page:'gameplay'})`) → `gameplay/hud.js` → script inline utama.
4. Ada `return` di tengah IIFE (`catch(err){ showBootErr(); return; }`, baris ±495) bila WebGL gagal. Extraction yang memecah IIFE harus mempertahankan perilaku "berhenti total bila renderer gagal".
5. Ada penanda `/*TEST-HOOK*/` (baris ±2030) di dalam IIFE. Belum ada kode di bawahnya; tetap dipertahankan.
6. Urutan deklarasi penting: `mobOn()` (±403) membaca `theme` yang baru dideklarasikan di ±605 (`let theme`). Aman karena dipanggil belakangan dan dijaga `typeof theme!=='undefined'`, tetapi urutan ini **harus dipertahankan** saat dipecah.

## 1. Marker yang wajib dipertahankan

| Marker | Status di file | Lokasi | Catatan |
|---|---|---|---|
| `/*GEOM-START*/` | ada | ±520 | membuka blok primitif geometri voxel |
| `/*GEOM-END*/` | ada | ±579 | menutup blok; isi: `FACES`, `CORNERS`, `EDGES`, `makeBatch`, `addBox`, `addOBox` |
| `/*LOGIC-END*/` | ada | ±439 | menutup blok data/aturan awal (`ROW_H` … `mcBlock`) |
| `/*LOGIC-START*/` | **tidak ada** | — | sudah hilang sebelum Stage 4.0.9 (lihat `game/laporan-audit.html`, bagian Audit HUD). **Tidak ditambahkan di sub-step ini** (akan mengubah `gameplay.html`). Dicatat sebagai discrepancy terhadap instruksi marker. |
| `/*TEST-HOOK*/` | ada | ±2030 | bukan marker wajib dari instruksi, tetapi ada di file; jangan dihapus |

Catatan: blok `GEOM-START/END` hanya berisi **primitif** geometri. Builder yang memakainya (`buildBatch`, `buildMcTerrain`, `addOak`, `buildLadders`, `buildSnakes`, `buildWorld`, dll.) berada **di luar** marker. Pemindahan blok GEOM tidak otomatis memindahkan builder tersebut.

## 2. Tabel extraction map

Risk: Low = hampir tanpa dependency keluar; Medium = bergantung pada state/DOM/scene tapi satu arah; High = banyak dependency dua arah atau menyentuh async/state utama.

| Area | Existing Location (gameplay.html) | Target File | Dependencies | Risk |
|---|---|---|---|---|
| CONFIG: pemain & konstanta | `PLAYER_DEFS` (±405), `ROW_H` (±395), `DMG` (±398), `DICE` (±1873), `LOBBY_URL` (±1865) | `config.js` | PLAYER_DEFS: dibaca `startGame`, `readLobbyConfig`. DICE: dibaca `applyDice`, `readLobbyConfig`, `btnDice`. | Low |
| CONFIG: konfigurasi lobby | `readLobbyConfig()` (±1988), `CFG` (±2021) | `config.js` | `URLSearchParams`, `sessionStorage['ut-config']`, `PLAYER_DEFS`, `THEMES`, `DICE`. Hasilnya dipakai blok boot (`applyDice`, `night`, `buildWorld`, `startGame`). | Medium |
| RULES: papan | `LADDERS` (±396), `SNAKES` (±397), `CREEPERS`/`ENDERS` (±398), `CHESTS` (±404), `MOBT` (±399), `MOBBACK` (±402) | `rules.js` | Dibaca oleh `playTurn`, `buildLadders`, `buildSnakes`, `buildMobs`, `mcBlock`, `tileBlock`, `buildWorld`. Data murni. | Low |
| RULES: lookup mob | `mobOn(n)` (±403) | `rules.js` | `MOBT` + **`theme.key`** (variable scene/tema) → **MIXED** (lihat bagian 5) | Medium |
| RULES: power-up | `PUN` (±1584), `startPU()` (±1585) | `rules.js` | `PUN` dibaca `showPUCard`, `renderChips`, `usePU`. `startPU` memakai `Math.random`. Data/pure-ish. | Low |
| RULES: power-up (eksekusi) | `giveChest`, `usePU` (±1586–1629) | — (tidak diekstrak) | `players`, `cur`, `busy`, `gameOver`, `gameId`, DOM `#puCard`, `renderChips`, `setMsg`, `hud`, `sfx`, `showAttackCard`, `hitDragon`-adjacent state | High — MIXED |
| RULES: urutan giliran/overshoot/tiga-6/menang | `playTurn` (±1754), `doRoll` (±1818), `finishGame` (±1840), `beginTurn`/`nextTurn` (±1661–1672) | `game-core.js` (jauh nanti) | State (`players`, `cur`, `busy`, `gameOver`, `gameId`, `mode`, `paused`, `focus`), DOM, `sfx`, `hud`, animasi (`walk`, `climb`, `bite`, `fly`, `hopTo`, `sleep`) | High — MIXED |
| THEME: definisi | `THEMES` (±451–490): `minecraft`, `rumput`, `gurun`, `salju`, `hutan`, `nether` | `themes.js` | Data murni + hex. Dibaca `buildWorld`, `applyLook`, `buildMcTerrain`, `addWideFar`, `tileColor`, `tileBlock`, `buildLabels`, `buildLadders`, `buildSnakes`, `readLobbyConfig`, `chooseTheme`, `mobOn` (via `theme`). | Low |
| THEME: state & penerapan | `theme`, `themeKey`, `worldToken` (±605), `chooseTheme` (±1866), `applyPendingTheme` (±1658), `applyLook` (±1067), `night`, `setNight` (±1871), `updateNightUI` (±1062) | — (tidak diekstrak) | `document.documentElement.style`, DOM tombol, `localStorage['ut-malam'/'ut-tema2']`, `scene`, `renderer`, `hemi`, `sun`, `snow`, `nightObjs`, `torchMeshes`, `buildWorld` | High — MIXED |
| WORLD builder | `buildWorld(key)` (±1204) | — | `TILES`, `THEMES`, `world`/`sky`, `makeBatch`, `buildBatch`, semua `add*`, `buildLadders`, `buildSnakes`, `buildLabels`, `buildMobs`, `decorate`, `applyLook`, `fontReady`, `worldToken`, DOM `#btnTheme`, `localStorage`, `Math.random`/`rnd` | High — MIXED |
| GEOMETRY: primitif (dalam marker) | `FACES`, `CORNERS`, `EDGES`, `makeBatch`, `addBox`, `addOBox` (±521–578) | `voxel-geom.js` | THREE (`Color`), `makeBatch` dipakai hampir semua builder; `addBox` memakai `THREE.Color` saja. Tidak menyentuh DOM/state. | Low–Medium |
| GEOMETRY: RNG helper | `seed`, `rnd`, `jit`, `pick` (±515–518) | `voxel-geom.js` (atau `config.js`) | `seed` adalah state mutable bersama; **urutan panggilan `rnd()` menentukan tampilan dunia**. Memecah/menukar urutan pemanggil mengubah hasil dunia. | Medium |
| GEOMETRY: batch→mesh | `MAT`, `LINE_MAT`, `buildBatch` (±580–600), `disposeGroup` (±606), `fadeable`, `item`, `fades`, `updateFades` (±614–648) | `voxel-geom.js` (sebagian) | THREE, `camera`, `scene` groups (`world`,`sky`), `fades[]` dibaca `updateFades` di loop. | Medium |
| GEOMETRY: papan & tile | `TILES` (±413), `terrainTop`, `topAt` (±419–426), `slotPos`, `PAD`, `SLOT` (±441–450), `tileColor` (±770), `tileBlock` (±1055), `mcBlock` (±427) | — | `TILES` dibaca game core, pawn, world, camera. `slotPos` → THREE.Vector3. `mcBlock` memakai `Math.random`+`LADDERS`/`SNAKES`/`mobOn`/`MOBCOL` → **MIXED** | Medium |
| GEOMETRY: terrain/dekor | `buildMcTerrain`, `addWideFar`, `addMcFar`, `addMcEnv`, `decorate`, `mcH`, `hAt`, `lift`, `BIO`, `addOak/Cactus/Palm/Pyramid/Pine/Snowman/Igloo/JungleTree/Cave/Mushroom/Hill/Pillar/Portal/McHouse/Bamboo/Animal/NetherTree/Ghast`, `makeCloud` (±649–926, 1123–1132) | `voxel-geom.js` / modul dekor (jauh nanti) | `addBox`, `makeBatch`, `rnd`, `THEMES`, `TILES`, `PAD`, `lift`. Banyak, seragam, tanpa DOM. Ukuran besar. | Medium |
| GEOMETRY: tangga & ular | `buildLadders` (±927), `makeSnakeHead` (±952), `buildSnakes` (±981), `labelTexture`/`buildLabels` (±1025–1050) | — | `TILES`, `LADDERS`/`SNAKES`, `THEMES`, `scene`, `world`, `fadeable`, DOM `canvas` (`labelTexture`), `document.fonts`. Mengisi `LADINFO`/`SNAKEINFO` yang dipakai `climb`, `bite`, loop. | High — MIXED |
| DICE UI | `PIPS`, `dieEl`/`dieScene`, face builder (±1403–1409), `DIE_T` (±1410), `dX`/`dY`, `showDie(v,anim)` (±1412), `DICE`, `applyDice` (±1873–1883), `btnDice` handler | `dice-ui.js` | DOM `#die`, `#dieScene`, `#btnDice`, CSS vars (`documentElement.style`), `localStorage['ut-dadu']`. `showDie` dipanggil `doRoll`/`startGame`. Tidak menyentuh THREE/state permainan. | Low–Medium |
| FX | `confetti`, `CONF_GEO`, `CONF_MATS`, `spawnConfetti`, `clearConfetti` (±1423–1435); `sparks`, `SPARK_GEO`, `sparkle` (±1161–1169); salju (`snow`, dibuat di `applyLook`, diupdate di `frame` ±1958); ember (`buildWorld` ±1270); `explode` (±1474); `tween`/`tweens` | `fx.js` | `scene`, THREE, `frame` (update tiap frame), `players`/`dragon` posisi (pemanggil). `tween` menyatukan semua animasi async (dipakai pawn, dragon, ular, mob). | Medium (confetti/sparks) / High (`tween`) |
| CAMERA | `cam`, `goal`, `camTarget`, `baseDist`, `isTopDown`, `pan`, `panGoal`, `PAN_MAX`, `clamp`, `onResize`, `resetCam`, `togglePov`, `panBy`, handler pointer/wheel (±1489–1557) | `camera.js` | DOM `#c`, `window` resize, `scene` `camera` (THREE), `renderer`, `focus`, `players` (`resetCam`), `btnCam`, `btnPov`; diupdate di `frame` (±1933–1950). Pointer event: `pointerdown/move/up/cancel`, `wheel`, `contextmenu`. | Medium–High |
| PAWN | `makePawn(d)` (±1286), `lump` (±1317), `faceURL`/`FC`/`FURL` (±1568–1583), `hopTo` (±1325), `glide` (±1330), `faceCamera` (±1343), `walk` (±1674), `fly` (±1199), `teleport` (±1481) | `pawn.js` | `makePawn`: THREE, `addBox`, `makeBatch`, `jit`, `PLAYER_DEFS` entry. `hopTo`/`glide`: `tween`, `TILES`, `focus`. `walk`/`fly`: `slotPos`, `players`, `sfx`. `faceURL` memakai canvas 2D untuk ikon HUD (bukan THREE). | Medium (`makePawn`) / High (`walk`, `hopTo`, `teleport`) |
| WORLD / MOB: model | `addCreeper`, `addEnderman`, `addSkeleton`, `addZombie`, `addWarden`, `addVillager`, `addBlaze`, `makeChest` (±649–660, 1090–1140) | `voxel-geom.js` atau modul mob (jauh nanti) | `addBox`, `makeBatch`, THREE. Murni geometri. | Low–Medium |
| WORLD / MOB: instance & animasi | `MOBOBJ`, `CHESTOBJ`, `buildMobs(th)` (±1142), `mobReact`, `openChest`, `updateMobs(dt,t)` (±1170–1198) | — | `world`, `TILES`, `mobOn`, `MOBT`, `CHESTS`, `players`, `camera`, `sparkle`, dipanggil dari `playTurn` dan `frame`. | High — MIXED |
| DRAGON | `wingMesh`, `makeDragon`, `dragon`, `resetDragon`, `hitDragon`, `explode`, `teleport` (±1437–1488) | `dragon.js` | `makeDragon`: THREE, `makeBatch`, `addBox`, `TILES[100]`. `hitDragon`: `p.dhp`, `DMG`, `setMsg`, `hud`, `showAttackCard`, `sfx`, `hopTo`, `tween`, `renderChips`, `spawnConfetti`. `D.y0/dy/shk/wR/wL/mats` dibaca `frame`. | Medium (`makeDragon`, `resetDragon`) / High (`hitDragon` MIXED) |
| AUDIO: musik | `bgMusic`, `musicOn`, `musicVol`, `MUSIC`, `ensureMusic`, `playMusic`, `stopMusic`, `setMusicVol`, `setMusicOn` (±376–392), `syncMusicUI` (±1893) | `audio.js` | `Audio` API, `localStorage['ut-musicon','ut-musicvol']`, DOM `#pmVol`, `#btnSnd`. Dipakai oleh handler pointer pertama (±2028), `btnSnd`, `pmDay/pmNight`. | Low–Medium |
| AUDIO: SFX | `actx`, `muted`, `ensureAudio`, `beep`, `noise`, `sfx` (±1350–1402) | `audio.js` | `AudioContext`/`webkitAudioContext`, `new Audio('assets/sfx/…')` dengan fallback `beep`. `muted` dibaca `btnSnd`. `sfx.*` dipanggil dari `hitDragon`, `playTurn`, `doRoll`, `usePU`, dll. | Low–Medium |
| HUD | `gameplay/hud.js` (sudah terpisah, `UT.GameplayHUD`) + `hud()` (±1565) + `renderChips` (±1630) + `setMsg` (±1563) + `showAttackCard`/`showPUCard` (±1593–1610) + `setRoll` (±1567) | `hud.js` (sudah ada) | `renderChips`/`showAttackCard`/`showPUCard` membaca `players`, `cur`, `PUN`, `busy`, `gameOver`, DOM `#players`, `#scores`, `#pus`, `#puCard`; tidak diekstrak. | Sudah selesai (hud.js); sisanya MIXED |
| GAME CORE | `players`, `cur`, `busy`, `gameOver`, `gameId`, `mode`, `pendingTheme`, `paused`, `STALE`, `startGame`, `beginTurn`, `nextTurn`, `doRoll`, `playTurn`, `finishGame`, `celebrate`, `climb`, `bite`, `poseHead`, `resetSnakes` (±1559–1863) | `game-core.js` | Semua area lain. Pusat dependency. | High — MIXED (terakhir) |
| LOOP | `last`, `frame(now)` (±1923–1987) + boot (±2021–2033) | `loop.js` | `tweens`, `cam`/`goal`/`pan`, `camTarget`, `focus`, `players`, `SNAKEINFO`, `snow`, `dragon`, `confetti`, `updateMobs`, `updateFades`, `renderer`, `scene`, `camera`. Mengonsumsi hampir semua area → mengekstraknya paling akhir. | High |

## 3. Dependency per kandidat

Format: nama → dependency yang diperlukan.

- **`makePawn(d)`** → THREE; `makeBatch`/`addBox`/`jit`/`rnd`; skin config (`d.key`, `d.hex`, palet `PP` di dalam function); `PLAYER_DEFS` entry; `buildBatch`. Tidak menyentuh state permainan.
- **`hopTo` / `glide` / `walk`** → `tween`/`tweens`; `TILES`; `slotPos`; `focus`; `sfx.hop`; `p.pawn`. `walk` juga memanggil `renderChips`-adjacent state (`players`).
- **`showDie` / `applyDice`** → DOM (`#die`, `#dieScene`, `#btnDice`); `DIE_T`; `dX`/`dY`; `localStorage['ut-dadu']`; `documentElement.style`. Tidak menyentuh THREE.
- **`hitDragon`** → `dragon.userData` (`dy`, `shk`, `mats`, `wR`, `wL`, `y0`); `DMG`; `p.dhp`; `setMsg`; `hud(...)`; `showAttackCard` (DOM); `renderChips` (DOM); `sfx`; `hopTo`; `tween`; `spawnConfetti`; `scene`.
- **`updateMobs`** → `MOBOBJ`, `CHESTOBJ`, `players[].pawn`, `camera.position`, `sparks`; dipanggil dari `frame`.
- **`buildWorld`** → hampir seluruh area geometri + tema + DOM (`#btnTheme`) + `localStorage['ut-tema2']`.
- **`onResize` / `resetCam`** → `window`, `renderer`, `camera`, `cam`/`goal`, `players`.
- **`frame`** → lihat baris LOOP di tabel.

Dependency lintas-kategori:

| Kategori | Dependency |
|---|---|
| DOM | `#c`, `#die`, `#dieScene`, `#btnRoll`, `#btnCam`, `#btnPov`, `#btnTheme`, `#btnDice`, `#btnNight`, `#btnSnd`, `#btnMenu`, `#players`, `#scores`, `#pus`, `#msg`, `#turnName`, `#puCard`, `#pcEmoji/#pcName/#pcWho/#pcDesc`, `#win`, `#winTitle`, `#winText`, `#btnAgain`, `#btnToMenu`, `#pauseMenu`, `#pmResume/#pmExit/#pmVol/#pmDay/#pmNight/#pmCpu`, `#exitConfirm`, `#ecYes/#ecNo`, `#nDay/#nNight` |
| THREE | `THREE` (CDN r128), `renderer`, `scene`, `camera`, `hemi`, `sun`, `world`, `sky`, `dragon`, `MAT`, `LINE_MAT` |
| Storage | `localStorage`: `ut-musicon`, `ut-musicvol`, `ut-dadu`, `ut-malam`, `ut-tema2`; `sessionStorage`: `ut-config` |
| Eksternal (window) | `window.UT.GameplayHUD`, `window.UT.App` (dipanggil di luar IIFE), `window.__NO_THREE`, `AudioContext`/`webkitAudioContext` |
| Aset | `assets/music/community.mp3`, `assets/music/rainy.mp3`, `assets/sfx/*` |
| Navigasi | `loading.html?to=lobby` (`LOBBY_URL`), query `mode`/`skins`/`theme`/`dice`/`night` |

## 4. Audit variable (semua closure-local di IIFE; tidak diubah)

| Kelompok | Variable |
|---|---|
| CONFIG | `PLAYER_DEFS`, `ROW_H`, `DMG`, `LADDERS`, `SNAKES`, `CREEPERS`, `ENDERS`, `MOBT`, `MOBCOL`, `MOBNAME`, `MOBBACK`, `CHESTS`, `THEMES`, `DICE`, `PUN`, `PAD`, `SLOT`, `MUSIC`, `LOBBY_URL`, `CFG`, `PIPS`, `DIE_T`, `PAN_MAX`, `FC` |
| STATE | `players`, `cur`, `busy`, `gameOver`, `gameId`, `mode`, `pendingTheme`, `paused`, `focus`, `lastSkins`, `diceKey`, `night`, `muted` |
| THREE.JS | `renderer`, `scene`, `camera`, `hemi`, `sun`, `world`, `sky`, `dragon`, `MAT`, `LINE_MAT`, `CONF_GEO`, `CONF_MATS`, `SPARK_GEO`, `theme`, `themeKey`, `worldToken`, `clouds`, `snow`, `LADINFO`, `SNAKEINFO`, `MOBOBJ`, `CHESTOBJ`, `nightObjs`, `torchMeshes`, `fades`, `sparks`, `confetti`, `TILES`, `lump` |
| DOM | `cv` (`#c`), `dieEl`, `dieScene`, `coarse`, `reduce` (media query) |
| AUDIO | `bgMusic`, `musicOn`, `musicVol`, `actx`, `muted`, `sfx` |
| ANIMATION | `tweens`, `cam`, `goal`, `camTarget`, `pan`, `panGoal`, `baseDist`, `isTopDown`, `dX`, `dY`, `last`, `seed`, `STALE`, pointer: `ptrs`, `pinch`, `twist`, `rotating` |
| GAMEPLAY | `players[].{pos,sixes,dhp,pu,bonus,extra,p4,shield,score,cpu}` |

`cam`/`goal`, `muted`, dan `night` ada di lebih dari satu kelompok karena dibaca lintas area (ditulis di kelompok utamanya).

## 5. Klasifikasi function besar

| Klasifikasi | Function |
|---|---|
| PURE | `rnd` (mutasi `seed`; pure setelah seed), `pick`, `clamp`, `lerp`, `mixHex`, `terrainTop`, `topAt`, `mcH`, `hAt`, `startPU` (acak), `sleep`, `FACES`/`CORNERS`/`EDGES` (data) |
| STATEFUL | `rnd` (`seed`), `tween` (`tweens`), `setMusicVol`, `setMusicOn`, `setNight` |
| DOM | `showDie`, `applyDice`, `renderChips`, `showPUCard`, `showAttackCard`, `syncMusicUI`, `syncPauseNight`, `openPause`, `closePause`, `setMsg`, `setRoll`, `updateNightUI`, `faceURL` |
| THREE.JS | `makeBatch`, `addBox`, `addOBox`, `buildBatch`, `makeSnakeHead`, `makeChest`, `makeCloud`, semua `add*` dekor/mob, `labelTexture`, `wingMesh`, `makeDragon`, `buildLadders`, `buildSnakes`, `buildLabels`, `makePawn`, `slotPos` |
| ANIMATION | `hopTo`, `glide`, `faceCamera`, `fly`, `walk`, `climb`, `bite`, `poseHead`, `explode`, `teleport`, `spawnConfetti`, `sparkle`, `updateMobs`, `updateFades`, `frame`, `resetSnakes` |
| GAMEPLAY | `startGame`, `beginTurn`, `nextTurn`, `doRoll`, `playTurn`, `finishGame`, `celebrate`, `giveChest`, `usePU`, `hitDragon` |
| **MIXED** (jangan diekstrak di tahap ini) | lihat daftar di bawah |

### Function MIXED beserta alasannya

| Function | Campuran | Dependency yang membuatnya tidak aman dipindah |
|---|---|---|
| `mobOn(n)` | rule + variable tema | membaca `MOBT` (rule) dan `theme.key` (state scene/tema) untuk blaze hanya di tema `nether` |
| `mcBlock(n)` | geometri/warna + rule + RNG | memakai `Math.random` (bukan `rnd`), `LADDERS`, `SNAKES`, `mobOn`, `MOBCOL`; hasil warna tile berbeda tiap build |
| `buildWorld(key)` | geometri + tema + DOM + storage + state | membangun seluruh scene, menulis `#btnTheme`, `localStorage['ut-tema2']`, mengatur `worldToken`, memanggil `applyLook`, mengubah `theme` |
| `applyLook(th)` | tema + DOM + THREE | mengubah CSS var pada `documentElement`, lampu, fog, salju, bintang, obor |
| `chooseTheme` / `applyPendingTheme` | tema + state giliran | tema diterapkan hanya antar giliran (`pendingTheme`), terkait `beginTurn` |
| `buildLadders` / `buildSnakes` | geometri + rule + state | mengisi `LADINFO`/`SNAKEINFO` yang dibaca `climb`, `bite`, `frame` |
| `buildMobs` | geometri + rule + state | memakai `mobOn`, `CHESTS`, mengisi `MOBOBJ`/`CHESTOBJ` |
| `updateMobs` | animasi + state pemain | membaca `players[].pawn`, `camera`, `MOBOBJ`, `CHESTOBJ`, `sparks` |
| `hitDragon` | gameplay (damage) + DOM + animasi + audio + HUD | menulis `p.dhp`, `setMsg`, `hud`, `showAttackCard`, `renderChips`, `sfx`, `tween`, `spawnConfetti` |
| `usePU` / `giveChest` | gameplay + DOM + audio + HUD | menulis `players`, `busy`, DOM kartu, `hud`, `sfx`, `renderChips` |
| `playTurn` | gameplay + animasi + DOM + audio + HUD + async stale-guard | gerakan, tangga, ular, mob, bounce, chest, dragon, `hud(...)`, `setMsg`, `sfx`, `A()` (guard `gameId`) |
| `doRoll` | gameplay + DOM + audio + animasi | RNG dadu, `p.p4`, `showDie`, `sfx.roll`, `sleep`, `hud`, aturan tiga-6 |
| `beginTurn` | gameplay + DOM + HUD + AI CPU | blok CPU memilih power-up dan memanggil `usePU`/`doRoll` dengan `setTimeout` |
| `startGame` | state + THREE + DOM | reset `players`, `scene.remove`, `makePawn`, `resetCam`, `showDie`, `hud('reset')` |
| `renderChips` | DOM + state | membaca `players`, `cur`, `PUN`, `busy`, `gameOver`, `faceURL` |
| `frame` | loop + semua area | membaca/menulis state kamera, `tweens`, ular, salju, dragon, confetti, mob, fades |
| `onResize` / `resetCam` | THREE + DOM + state | `renderer`, `camera`, `window`, `players` |
| `walk` / `hopTo` | animasi + state + audio | `tween`, `TILES`, `focus`, `sfx.hop` |
| `bite` / `climb` | animasi + rule + state + async stale-guard | `SNAKEINFO`/`LADINFO`, `tween`, `gid` guard, `STALE` |

Catatan khusus: **mekanisme stale-guard** (`gameId`, `STALE`, closure `A()` di `playTurn`/`bite`, cek `gid!==gameId` di `doRoll`/`beginTurn`) melintasi `game-core`, animasi, dan HUD (event HUD membawa `{gid}`). Ini harus tetap utuh dalam extraction apa pun.

## 6. Observasi (tidak diperbaiki; hanya dicatat)

- Handler `#pmDay` dan `#pmNight` didaftarkan **dua kali** (±1897–1898 dan ±1909–1910) sehingga satu klik menjalankan `setNight`/`setMusicOn` dua kali. Tidak diubah di sub-step ini (aturan: tanpa behavior change). Layak jadi catatan untuk stage cleanup terpisah.
- `/*LOGIC-START*/` tidak ada (lihat bagian 1).
- `buildWorld` dipanggil sebelum `startGame` pada boot; urutan ini bergantung pada `CFG` (`readLobbyConfig`), jadi `config.js` harus dimuat sebelum boot.
- `CREEPERS` dan `ENDERS` (±398) hanya muncul pada baris deklarasinya (hasil `grep` seluruh `gameplay.html`: 1 baris); tidak dirujuk di tempat lain. Tidak dihapus (tanpa behavior/code change), dicatat sebagai kandidat dead code untuk stage cleanup.

## 7. Urutan extraction yang disarankan (hanya saran; bukan eksekusi)

Dari risiko terendah ke tertinggi. Pemilihan satu boundary dilakukan di stage berikutnya, bukan di sini.

1. Data murni: `themes.js` (`THEMES`), `config.js` (`PLAYER_DEFS`, `DICE`, konstanta), `rules.js` (`LADDERS`, `SNAKES`, `CHESTS`, `MOBT`, `MOBBACK`, `PUN`) — **kecuali** `mobOn`.
2. `audio.js` (`sfx`, `ensureAudio`, musik): dependency satu arah, tanpa THREE.
3. `dice-ui.js`: DOM saja.
4. `voxel-geom.js` (primitif di dalam marker `GEOM-START/END`, lalu `buildBatch`): hati-hati dengan urutan `rnd()`.
5. `fx.js` (confetti/sparks), `dragon.js` (`makeDragon`, `resetDragon`), `pawn.js` (`makePawn`).
6. `camera.js`, `game-core.js`, `loop.js`: paling akhir (dependency terbanyak).

Keputusan prasyarat sebelum langkah 1: **cara berbagi variable antar file** (karena semua closure-local di IIFE).

## 8. Aturan source-of-truth

`gameplay.html` = source of truth sampai setiap extraction berikutnya melewati:

```
EXTRACT → COMMIT → PUSH → VERIFY (local HEAD == origin/main) → TEST
```

Tidak boleh ada implementasi duplikat. Jika push gagal: `COMMIT = SUCCESS`, `PUSH = FAILED`, `REMOTE CHECKPOINT = NOT SAFE` → berhenti.

## 9. Static check (Stage 4.1.1)

- [x] `gameplay.html` tidak berubah (diverifikasi dengan diff terhadap salinan sebelum edit)
- [x] tidak ada file gameplay implementation baru (hanya `game/doc/GAMEPLAY_EXTRACTION_MAP.md`)
- [x] extraction map tersedia
- [x] area utama terpetakan: config, rules, theme, geometry, dice UI, FX, camera, pawn, world/mob, dragon, game core, loop, audio, HUD
- [x] dependencies dicatat
- [x] function MIXED ditandai
- [x] marker GEOM tercatat (ada)
- [x] marker LOGIC tercatat (`LOGIC-END` ada, `LOGIC-START` tidak ada sejak sebelum 4.0.9)
- [x] tidak ada behavior change

END — STAGE 4.1.1
