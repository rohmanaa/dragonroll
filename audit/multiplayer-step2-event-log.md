# Langkah 2 — Fondasi event log multiplayer

Branch: `mp-step2-event-log` (baseline `aaeffba`). Acuan: `multiplayer-sync-audit.md` → "Keputusan Final Produk" dan "Rencana pelaksanaan" langkah 2.
Cakupan: hanya fondasi. `gameplay.html`, `room.html`, PlayerData, katalog, audio, dan theme **tidak diubah**. Cue/snapshot lama tetap jalan (diganti di Langkah 3).

## File baru
| File | Isi |
|---|---|
| `supabase/migrations/202611060001_game_events.sql` | Tabel `game_events`, kolom `game_rooms.event_seq`, RLS, RPC `submit_game_action`, `set_game_public_profile`, `claim_game_reward`, tabel `game_reward_claims`, Realtime publication. |
| `supabase/tests/game_events_test.sql` | Uji SQL (T1–T8). |
| `game/assets/js/multiplayer/event-log.js` | `window.UT.Multiplayer.EventLog` (classic script): urutan, gap/backfill, reconnect, retry, antrean kirim; transport Supabase + transport palsu untuk uji. |
| `tests/multiplayer/event-log.test.js` | 14 uji unit (Node, `node --test`). |
| `audit/multiplayer-step2-notes.md` | Langkah 2.0 (pemetaan). |

Catatan penamaan: RPC bernama `submit_game_action` (bukan `submit_action` di audit) agar konsisten dengan RPC lain (`*_game_*`).

## Kontrak event
Baris `game_events`: `room_id, seq, player_id, type, payload(jsonb), client_event_id, created_at`.
`seq` dimulai 1 dan kontigu per room. Setiap event membawa `player_id` pengirim (diisi server dari `auth.uid()`, tidak bisa dipalsukan).
Type yang dikenal (isi payload per type ditetapkan di Langkah 3): `turn_begin, roll, move, climb, bite, power_use, sfx, toast, fx, totem_ask, totem_answer, totem_timeout, game_over, reward_claim, profile`.
Batas payload 4 KB; field privat (`coins, coin, gems, gem, xp, inventory, email, purchases`) ditolak di level atas payload.

## Aturan yang diterapkan sesuai keputusan produk
- **Host = pemain biasa**: setiap anggota room boleh `submit_game_action`; tidak ada pengecekan `host_id`.
- **Reward personal & idempoten**: `claim_game_reward(room, game_id)` → `true` hanya pada klaim pertama per akun per game; pemberian ke PlayerData tetap di klien akun itu (Langkah 4).
- **Skin tampil milik pemilik**: `set_game_public_profile` menyimpan hanya `characterSkinId, diceId, frameId, effectId` (string ≤ 48) ke `players[].public_profile`; data privat dibuang.
- **Totem 15 detik**: konstanta `TOTEM_TIMEOUT_MS = 15000` di `event-log.js` (belum dipakai).

## Hasil test (hanya yang benar-benar dijalankan)
### SQL — Postgres 16.15 lokal dengan stub `auth` (`auth.uid()` dari `request.jwt.claim.sub`), migrasi lama + baru diterapkan bersih
| Uji | Hasil |
|---|---|
| Migrasi 202611050001 + 202611060001 diterapkan tanpa error | PASS |
| T1 seq 1,2,3 dari dua pemain berbeda | PASS |
| T2 idempoten (`client_event_id` sama → seq sama; seq berikutnya tidak loncat) | PASS |
| T3 type asing, field privat, payload > 4 KB ditolak | PASS |
| T4 non-anggota tidak bisa kirim dan tidak melihat event/room | PASS |
| T5 anggota membaca log kontigu dari 1; insert langsung ke tabel ditolak | PASS |
| T6 profil publik hanya whitelist | PASS |
| T7 reward: klaim pertama true, ulang false, akun lain true, non-anggota ditolak | PASS |
| T8 room `waiting` menolak event baru | PASS |
| Konkurensi: 4 sesi paralel × 25 event ke satu room → 100 event, seq kontigu 1..105 (5 awal), tanpa duplikat | PASS |

### JS — `node --test tests/multiplayer/event-log.test.js` (Node 22)
14/14 PASS: urutan identik dua klien, event tidak berurutan, duplikat, gap → backfill, reconnect → catch-up, paging backfill, retry dengan `clientEventId` sama, retry tanpa duplikat saat respons hilang, error permanen tanpa retry, batas retry, urutan kirim terjaga, handler error tidak memutus log, stop, konstanta Totem.

### Perilaku tidak berubah
`git diff aaeffba..HEAD --stat` hanya berisi file baru + dokumen (lihat bawah).

## BELUM TERVERIFIKASI
- **Supabase asli**: RLS, RPC, dan Realtime `postgres_changes` untuk `game_events` belum dijalankan di proyek Supabase sungguhan. Uji SQL memakai Postgres lokal dengan stub `auth`; perbedaan perilaku dengan Supabase (role/grant bawaan, publication, Realtime + RLS) belum terkonfirmasi.
- **`createSupabaseTransport`**: belum dijalankan terhadap `supabase-js` sungguhan (hanya transport palsu yang diuji).
- **Dua browser/akun** end-to-end: belum (menunggu migrasi diterapkan dan Langkah 3).
- Migrasi **belum diterapkan** ke proyek produksi.

Karena item di atas belum terverifikasi, **Langkah 2 belum dianggap selesai** (sesuai aturan: PASS hanya untuk uji yang dijalankan).

## Risiko yang tersisa
- Tahap 1: dadu masih diacak di klien; anggota mana pun bisa mengirim event `roll` dengan nilai apa pun. Ditutup di Tahap 2 arsitektur (server).
- Pengiriman event dibatasi hanya ke room `playing`; `claim_game_reward` tidak memeriksa pemenang (pemenang divalidasi oleh log/aturan di Langkah 4 dan server nanti).
- `game_events` tumbuh tanpa batas selama game; perlu pemangkasan/snapshot checkpoint (Langkah 3/6).
- Anonymous Auth: identitas bisa dibuat ulang dengan menghapus storage browser (sudah tercatat di `supabase/README.md`).

## Cara menjalankan uji
```
node --test tests/multiplayer/event-log.test.js
# SQL: terapkan stub auth + 202611050001 + 202611060001, lalu supabase/tests/game_events_test.sql dengan psql
```
Terapkan migrasi di Supabase: SQL Editor → tempel `202611060001_game_events.sql` (setelah `202611050001`), lalu pastikan `game_events` aktif di Database → Publications.
