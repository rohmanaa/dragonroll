# Duel PVP online (2026-11-18)

**Masalah:** `duelCheck` melewati semua room online (`ONLINE_ROOM`), jadi dua bidak pemain di petak yang sama tidak memicu duel; duel hanya jalan offline / vs CPU.

**Keputusan (user):** tiap pemain yang duel menekan ROLL sendiri.

## Alur online (host-authoritative)
- Hanya **host** menjalankan `duelCheck`. Tamu tidak menjalankan aturan duel.
- Dadu tiap sisi diundi server: `serverRoll` -> `roll_game_dice` (host mengundi atas nama pemain; sisi CPU atas nama host). Gagal -> duel dibatalkan, tidak ada fallback `Math.random`.
- Tampilan: host membungkus `UT.GameplayDuelUI` (`mpDuelUI`) sehingga tiap panggilan (`open/intro/banner/log/state/actions/act/impact/pop/shake/revealRolls/result/close`) juga dikirim sebagai cue `duel`. Tamu memutar ulang UI yang sama dari pemain lokalnya (`mpRunDuelCue`, `duelOpenOpts`).
- Ronde: host kirim cue `wait`; pemain manusia yang duel menekan ROLL. Tamu -> event broadcast `duel_roll` (`GameSync.sendDuelRoll`) -> `onMpDuelRoll` di host. Host menunggu maks 12 dtk (`DUEL_ROLL_MS`); CPU/AUTO/pemain keluar/timeout jalan otomatis. Host kirim cue `go` (diproses di luar antrean cue) lalu undi dadu.
- Penonton melihat tombol terkunci "MENUNGGU PEMAIN...". Knockback loser dicerminkan lewat cue `seq` `duelKnock`. Pemenang tamu mencatat `recordPvpWin` sendiri lewat cue `won`.
- Offline tidak berubah (satu tombol ROLL, `Math.random`).

## Batasan
- Pemilihan lawan saat >1 lawan di petak yang sama: hanya pemain di layar host yang memilih; yang lain/AUTO acak (pilihan tidak dicerminkan).
- Tidak ada fallback bila koneksi realtime putus di tengah duel selain timeout 12 dtk per ronde dan pengaman 17 dtk di tamu.
- Belum diuji di browser/Supabase sungguhan; hanya `node --check`, `tests/duel-online-wiring.test.js` (statis), `tests/duel-ui.test.js` (lockRoll).
