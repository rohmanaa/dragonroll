# Langkah 2.0 — Audit singkat modul multiplayer yang ada

Tanggal: 2026-11-05. Metode: baca kode. Tidak ada perubahan perilaku.

## Pemetaan
| File | Peran sekarang |
|---|---|
| `game/assets/js/multiplayer/client.js` | Bootstrap klien Supabase + login anonim (ES module, set `window.UT.Multiplayer`). |
| `game/assets/js/multiplayer/config.example.js` | URL + kunci publik Supabase (module). |
| `game/assets/js/multiplayer/room-service.js` | Wrapper RPC room (buat/gabung/ready/mulai/keluar), subscribe `game_rooms` + heartbeat host. |
| `game/assets/js/multiplayer/game-sync.js` | Transport gameplay host-authoritative: Realtime `broadcast` (`roll_request`, `power_request`, `loadout`, `host_left`, `cue`, `snapshot`) + RPC `update_game_state` (hanya host, `revision`). |
| `supabase/migrations/202611050001_multiplayer.sql` | Tabel `game_rooms` + RPC room; `update_game_state` hanya untuk host. |

## Cara kerja sekarang vs target
- Sekarang: aksi tamu = broadcast intent → host menjalankan mesin → host kirim 4 jenis cue (tanpa nomor urut) + snapshot. Tidak ada log, ack, atau resend (temuan P2 #6).
- Target (audit Tahap 1): semua aksi lewat satu jalur ke log berurutan; semua klien memutar log yang sama.

## Titik sambung (Langkah 3, bukan di langkah ini)
- `GameSync.sendCue/publish/requestRoll/requestPower` → diganti `EventLog.submit(type, payload)`.
- `onCue/onSnapshot` di gameplay → diganti `onEvent(row)`; snapshot dipertahankan hanya sebagai checkpoint (bootstrap pemain yang masuk terlambat).
- Profil publik per pemain (`players[].public_profile`) dibaca dari `game_rooms.players`, menggantikan skin terkunci `steve/klasik/null` di `room.html`.

## Catatan
- `client.js` adalah ES module dari esm.sh; `event-log.js` sengaja classic script dan hanya memakai `window.UT.Multiplayer.getClient` secara lazy, jadi dimuat setelah `client.js`.
- Realtime `postgres_changes` dipakai untuk `game_events` (RLS berlaku), bukan `broadcast`, supaya event tersimpan, bernomor, dan bisa di-backfill.
