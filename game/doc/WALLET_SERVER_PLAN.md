# Rencana dompet server (coins/gems)

Status: **B1 selesai (fondasi), B2-B4 belum.** Migrasi: `supabase/migrations/202611110001_wallet_b1.sql`. Tes: `supabase/tests/wallet_b1_test.sql`.

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
- **B2:** `buy_item(item_id)` dengan harga dari katalog di server (inventory juga server); reward boss dan achievement lewat server, dikaitkan ke pemenang sebenarnya (bukan host).
- **B3:** daily reward dan misi pindah ke server (jam server, bukan jam HP).
- **B4:** chest dan hadiah lawan CPU diberi batas harian per akun (tidak bisa diverifikasi karena game jalan di browser).
- Klien: `PlayerData` jadi cache/cermin saldo server untuk akun login; `shop.html`, `dailyreward.html`, `quest-data.js` memanggil RPC.

## Cara menerapkan B1
1. Jalankan `202611110001_wallet_b1.sql` di Supabase SQL Editor (setelah `202611100004`).
2. Uji (opsional, DB uji, bukan produksi): `psql -v ON_ERROR_STOP=1 -f supabase/tests/wallet_b1_test.sql` (butuh `auth.users` dan `auth.uid()`).
3. Cek manual: login sebagai pemain, panggil `select public.wallet_get();` -> `{coins:1000, gems:0}`.

## Batasan yang diketahui
- Hasil match lawan CPU dan chest tetap tidak terverifikasi (browser); karena itu B4 memakai batas harian.
- Daily reward dan inventory masih lokal sampai B2/B3.
