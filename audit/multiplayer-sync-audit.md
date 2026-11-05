# Audit sinkronisasi multiplayer (host vs tamu)

Tanggal: 2026-11-05. Metode: baca kode (`game/gameplay.html`, `assets/js/multiplayer/game-sync.js`, `assets/js/room-flow.js`, `room.html`, `MULTIPLAYER_STATE.md`).
**Belum ada uji runtime dua klien** (MULTIPLAYER_STATE: "No runtime tests"; Supabase live belum divalidasi), jadi semua temuan = dari kode, bukan dari pengamatan.

## Prinsip target (dari permintaan)
1. **Hak aksi sama**: host dan tamu punya hak yang sama di gameplay (roll, pakai power, keputusan Totem, dll). Host hanya "menjalankan mesin" (host-authoritative), bukan punya hak lebih.
2. **Presentasi identik**: animasi, efek, suara, toast/HUD harus tampil sama di semua klien.
3. **Personal = milik akun** ("akunku/akunmu"): pilihan dadu, skin, frame, loadout power, suara/teks menang-kalah, reward. Satu akun tidak boleh menimpa/ikut menerima milik akun lain.
4. **Peran host** (boleh beda): pengaturan ruangan (siang/malam, mulai/keluar ruangan).

## Cara kerja sekarang
Host menjalankan seluruh engine. Ke tamu hanya dikirim: (a) **snapshot** state JSON (posisi, skor, power, giliran, dll) dan (b) **4 jenis cue** animasi: `roll`, `walk`, `climb`, `bite` (`mpCue`, `mpRunCue`). Selain itu tamu hanya melihat hasil akhir dari snapshot (pion "loncat" ke posisi baru).

## Temuan

### P0 — hak/akun tidak adil atau salah
| # | Temuan | Bukti |
|---|---|---|
| 1 | **Reward diberikan ke akun host**, bukan ke pemenang. Untuk pemain online `p.cpu=false`, jadi `settleDragonDefeat` selalu `PlayerData.grant` di perangkat host, walau pemenangnya tamu atau host kalah. Tamu tidak pernah dapat reward (`finishGame(w,true)` tidak settle). | `settleDragonDefeat` (`!p.cpu` → grant), `finishGame(p,fromRemote)` |
| 2 | **Teks & suara menang/kalah tidak personal online.** "Kamu menang/kalah" dan `sfx.defeat` hanya untuk `mode==='cpu'`; online semua melihat "X menang", penonton kalah tidak dapat suara kalah, pemenang tamu tidak dapat fanfare. | `isPlayerDefeat`, `finishGame`, `celebrate` |
| 3 | **Keputusan Totem diambil di layar host** walau korbannya tamu (`askTotem` → `totemModal` jalan di klien yang menyimulasikan = host). Tamu tidak bisa memilih (hak tidak sama) atau pilihannya dibuat host. | `askTotem`, `totemModal` |
| 4 | **Skin/dadu/frame akun tidak dipakai online.** `room.html` mengunci online ke `skin:'steve'`, `dice:'klasik'`, `frame:null`; `frameOf` online = `frame.default`; `skinKeys` mengisi sisa slot dengan skin urutan katalog. Pilihan akun tiap pemain tidak dikirim ke klien lain. | `room.html:299-302`, `room-flow.js skinKeys`, `frameOf` |
| 5 | **Toast "Giliran kamu" bisa muncul berulang online** karena `applyGameSnapshot` memanggil `beginTurn()` di tiap snapshot (siang/malam, loadout, publish lain). **Sudah diperbaiki di commit ini** (sekali per giliran, via `TOAST_P`). Efek samping yang sama (Roll aktif lagi/`busy=false` di tengah animasi tak-ter-cue) masih berisiko, lihat #9. | `applyGameSnapshot` → `beginTurn` |

### P1 — animasi/efek/suara tidak sinkron (tamu hanya lihat hasil)
Tidak ada cue untuk semua ini (host-only):
- **Suara**: `sfx.bounce`, `sfx.hundred`, `sfx.win`, `sfx.victory`, `sfx.defeat`, `sfx.pop`, `sfx.naiktangga` (gigitan ular), `sfx.rewardpower`, `dragonMusicStart`, dll. Hanya `hop`/`ladder`/dadu yang ikut karena berada di dalam `walk/climb/roll`.
- **Toast/HUD**: `fb('event',…)` / `hud('showResult',…)`: Naik Tangga, Kena Ular, Memantul, Tiga kali 6, Hadiah, Tiba di Benteng, dll.
- **Efek visual**: pantulan melewati GOAL, ular tanpa `SNAKEINFO` (`hopTo`), mob di petak (`resolveMobAt`), buka chest (`giveChest`, kartu reward), efek Power (`usePU`: pedang, bulu, ramuan, TNT, `powerFxPawn`, `puFx`), konfeti/kembang api (`celebrate`), fase boss (`awakenWither/awakenDragon/gatherArena/crystalRoll/hitDragon/witherPhase`: animasi, kamera, musik).
- Pion tamu yang berpindah tanpa cue **teleport** lewat `pawn.position.set` dari snapshot.

### P2 — keandalan & kelengkapan
| # | Temuan |
|---|---|
| 6 | Cue lewat Realtime `broadcast` **tanpa nomor urut/ack** dan `self:false`; cue yang hilang/terlambat = animasi tidak ada, lalu snapshot menimpa. Tidak ada pemulihan. |
| 7 | **AFK/auto-roll dimatikan online** (`startTurnTimer: if(ONLINE_ROOM) return`): pemain diam atau putus koneksi menahan semua orang. Hanya `host_left` yang ditangani; tamu putus tidak. |
| 8 | **Urutan giliran** online = urutan room (layar Ready/kocok dilewati). Konsisten, tapi beda pengalaman dari mode offline. |
| 9 | Snapshot yang tiba saat host menjalankan animasi tak-ter-cue memanggil `beginTurn()` + `busy=false` di tamu → tombol Roll bisa aktif di tengah aksi. Perlu dipastikan lewat uji dua klien. |
| 10 | Tamu tidak mematikan tombol Roll lokal setelah mengirim `roll_request` (host mengabaikan duplikat, tapi UI tidak memberi umpan balik sampai cue datang). |
| 11 | Auto roll tamu: perlu verifikasi jalur `submitRoll` (di luar cakupan baca ini). |
| 12 | Belum diaudit: quest/misi, leaderboard, kemenangan yang dicatat di `ut-dragon-win`, pause per klien. |

## Yang sudah benar
- Loadout power per akun (`loadout` broadcast) dan panel Power menampilkan milik pemain lokal.
- Nama pemain dari room; hak roll/power dicek ke `networkId` di host.
- Mahkota host dan `.me` outline pemain lokal.

## Usulan perbaikan (urut)
1. **Reward & hasil personal (P0 #1-2)**: tiap klien menghitung hasil untuk akunnya sendiri dari snapshot `gameOver/winnerIndex`; reward hanya ke pemenang (atau kebijakan lain), idempoten per `gameId`/room; teks "Kamu menang/kalah" + `sfx.victory/defeat` berdasarkan `p.networkId===MP_ID`.
2. **Totem (P0 #3)**: host mengirim `ask_totem {pid}`; modal muncul di klien pemilik akun, jawaban dikirim balik (dengan batas waktu).
3. **Skin/dadu/frame per akun (P0 #4)**: tiap pemain mengirim `{skin,frame,dice}` saat masuk room; semua klien me-render sesuai itu. (Keputusan: dadu yang tampil = milik pelempar atau milik tiap penonton?)
4. **Bus presentasi (P1)**: bungkus `sfx.*`, `fb/hud`, `puFx/powerFxPawn`, konfeti/kembang api, fase boss dalam satu helper yang di host sekaligus menyiarkan `{k:'sfx'|'toast'|'fx'|…}` bernomor urut; tamu memutar berurutan. Ganti teleport snapshot dengan cue untuk setiap perpindahan pion.
5. **Keandalan (P2)**: nomor urut + resend cue, AFK/auto-roll online, deteksi tamu putus, `busy` tidak dipaksa false saat cue berjalan.
6. **Uji dua klien** (dua browser/akun) setelah migrasi Supabase aktif; tulis skenario uji per item di atas.
