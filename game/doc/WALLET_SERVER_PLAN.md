# Rencana dompet server (coins/gems)

Status: **B1 selesai, B2 sisi server selesai (B2c = pemasangan klien belum), B3-B4 belum.**
Migrasi: `202611110001_wallet_b1.sql`, `202611110002_wallet_b2_server.sql`. Tes: `supabase/tests/wallet_b1_test.sql`, `wallet_b2_test.sql`.

## Masalah (hasil audit)
Semua perubahan saldo sudah lewat `PlayerData` (`assets/js/player-data.js`: `grant`, `purchase`, `addCurrency`), tapi saldo dan inventory disimpan di localStorage, jadi bisa diedit lewat devtools. Server hanya mencatat klaim (achievement, reward boss) agar tidak ganda.

| Sumber masuk | Lokasi |
|---|---|
| Saldo awal 1000 coins | `player-data.js` (START_COINS) |
| Daily reward (gem/koin/dadu/skin/power) | `dailyreward.html`; status di `localStorage['inv']`, memakai jam perangkat |
| Misi harian 50/75/150 + bonus 100 | `assets/js/quest-data.js` |
| Chest (koin/XP/gem) | `gameplay.html` `applyChestReward` |
| Kalahkan boss 500 koin + 10 gem | `gameplay.html` `settleDragonDefeat`, nominal `Config.DRAGON_REWARD`; diberikan ke akun host |
| Achievement 250/750/2000 koin, 5/10/25 gem | angka server (`claim_achievement`), saldo ditambah di klien |

Pengeluaran: toko (`shop.html` -> `PD.purchase`), hanya koin. Pemakaian gem belum ditemukan.

## Prinsip desain
- Klien tidak pernah mengirim nominal; server menentukan nominal per jenis reward.
- Setiap perubahan = 1 baris `wallet_ledger` dengan kunci unik `(user_id, reason, ref_key)` -> klaim tidak bisa dobel.
- Saldo tidak boleh negatif; belanja melebihi saldo ditolak dan tidak menulis apa pun.
- Tabel tidak bisa diakses klien langsung (RLS + revoke); hanya lewat RPC `security definer`.
- Mode tamu/offline tetap lokal dan tidak tersinkron.
- Saldo lama di localStorage tidak diimpor penuh (celah). Kebijakan impor diputuskan nanti.

## Tahap
- **B1 (selesai):** tabel `player_wallet`, `wallet_ledger`; fungsi internal `_wallet_apply` (idempoten, anti-negatif, terkunci per baris) dan `_wallet_ensure` (saldo awal 1000/0); RPC baca `wallet_get()`, `wallet_history(limit)`. Belum ada RPC tambah/kurang dari klien, jadi aman diterapkan sendirian.
- **B2 (server selesai):** tabel `item_catalog` (harga di server, disalin dari `item-catalog.js` lewat `node game/tools/wallet/gen-item-seed.js --write`; `--check` untuk CI), `player_inventory`, RPC `buy_item(item_id)` (saldo + inventory satu transaksi, anti beli ganda), `inventory_get()`, `claim_boss_reward(room_id)` (hanya PEMENANG, sekali per room, maksimal 10 per hari per akun), dan `claim_achievement` kini juga mengkredit dompet server.
- **B2c (belum):** pasang di klien: `shop.html`/`player-data.js` memanggil `buy_item` dan `wallet_get`; `gameplay.html` memanggil `claim_boss_reward` (bukan `PlayerData.grant` di perangkat host); setelah klien memakai saldo server, panggilan `PD.addCurrency` lokal untuk achievement WAJIB dihentikan agar tidak dihitung dua kali.
- **B3:** daily reward dan misi pindah ke server (jam server, bukan jam HP).
- **B4:** chest dan hadiah lawan CPU diberi batas harian per akun (tidak bisa diverifikasi karena game jalan di browser).
- Klien: `PlayerData` jadi cache/cermin saldo server untuk akun login; `shop.html`, `dailyreward.html`, `quest-data.js` memanggil RPC.

## Cara menerapkan B1
1. Jalankan `202611110001_wallet_b1.sql` di Supabase SQL Editor (setelah `202611100004`).
2. Uji (opsional, DB uji, bukan produksi): `psql -v ON_ERROR_STOP=1 -f supabase/tests/wallet_b1_test.sql` (butuh `auth.users` dan `auth.uid()`).
3. Cek manual: login sebagai pemain, panggil `select public.wallet_get();` -> `{coins:1000, gems:0}`.

## Batasan yang diketahui
- Pemenang room dibaca dari `game_state` yang ditulis host, jadi host nakal bisa memalsukannya; karena itu hadiah boss dibatasi 10/hari. Penyelesaian penuh = tahap C (validasi aturan di server).
- Achievement sumber `client` (skin, emerald) masih memakai nilai dari klien (dibatasi ke tier tertinggi).
- Harga di server harus disinkronkan ulang tiap `item-catalog.js` berubah (`gen-item-seed.js`).
- Hasil match lawan CPU dan chest tetap tidak terverifikasi (browser); karena itu B4 memakai batas harian.
- Daily reward dan inventory masih lokal sampai B2/B3.
