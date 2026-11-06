# Rencana dompet server (coins/gems)

Status: **B1 selesai, B2 sisi server selesai, B3 dan B4 sisi server selesai (B4 belum di-push/diterapkan). Klien B5 terpasang di balik flag (default MATI); lihat bagian "B5 klien" di bawah.**
Migrasi: `202611110001_wallet_b1.sql`, `202611110002_wallet_b2_server.sql`, `202611110003_wallet_b3_daily_quest_exchange.sql`, `202611110004_wallet_b4_caps.sql`. Tes: `supabase/tests/wallet_b1_test.sql`, `wallet_b2_test.sql`, `wallet_b3_test.sql`, `wallet_b4_test.sql`.

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
| Tukar gem -> koin (10->500, 40->2.500, 120->10.000) | `PD.addCurrency` di `shop.html`, `profile.html`, `leaderboard.html`, `inventory.html` (berlabel mock tetapi berjalan; mode tamu menambah gem gratis) |

Chest: pool di `config.js` tidak punya entri koin/XP/gem, jadi kemungkinan bukan sumber pemasukan (belum pasti: config bisa ditimpa di tempat lain).

Pengeluaran: toko (`shop.html` -> `PD.purchase`), koin; "hadiahkan item" ke teman palsu (Budi, Sari, Rafi, Nina) memotong koin lokal lewat `PD.addCurrency` (akan dimatikan untuk akun login). Pemakaian gem belum ditemukan.

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
- **B3 (server selesai, klien belum):** hari server tetap **WIB (Asia/Jakarta)** untuk daily reward dan misi (`_wib_today()`, tanggal tidak pernah dari klien; `last_claim_date` bertipe date). RPC: `daily_reward_get`, `claim_daily_reward` (tabel 7 hari di server, kunci ledger per tanggal), `quest_get/quest_track/quest_claim/quest_claim_all/quest_claim_bonus` (nominal di server; progres 'play'/'win' dilaporkan klien, maks 375 koin/hari), `exchange_gems(pack)` (paket tetap). "Hadiahkan item" tidak punya RPC (teman palsu).
- **B4 (server selesai, klien belum):** batas harian (hari WIB) untuk hadiah yang tidak bisa diverifikasi. `claim_cpu_boss_reward(token)`: boss lawan CPU 500 koin + 10 gem, idempoten per token match, maks 5/hari, jarak minimal 180 detik. `claim_boss_reward` (online) dipindah ke hari WIB (batas 10/hari tetap). `reward_caps_get()` untuk UI. **Chest bukan sumber pemasukan:** `CHEST_POOL` aktif (`game/gameplay/config.js`) tidak punya entri koin/XP/gem dan tidak ditimpa di tempat lain; cabang 'coin'/'xp'/'gems' di `applyChestReward` adalah kode mati (di B5 jangan panggil `PD.grant` untuk akun login). Progres misi play/win tetap dilaporkan klien, dibatasi tujuan misi (maks 375 koin/hari).
- **B5 (cutover klien, menggantikan B2c):** SEMUA jalur pindah ke server sekaligus di balik flag: `buy_item`, `claim_boss_reward`, `claim_achievement`, daily, misi, tukar gem, dan `wallet_get` sebagai sumber saldo. Memindahkan sebagian saja membuat hadiah hilang (saldo lokal ditimpa server) atau terhitung dua kali. Hadiahkan item dimatikan untuk akun login. UI daily/misi menampilkan "reset 00.00 WIB" + hitung mundur dari `seconds_to_reset`. Mode tamu tetap lokal.
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
- Daily reward, misi, dan tukar gem sudah ada di server (B3) tetapi klien masih lokal sampai B5.

## B5 klien (terpasang, flag mati secara default)
- **Flag:** `window.UT_SERVER_WALLET = true` atau `localStorage['ut:serverWallet']='1'`. Aktif hanya untuk akun login; tamu tetap lokal. Nyalakan HANYA setelah migrasi B1-B4 diterapkan di Supabase.
- **`assets/js/wallet-service.js`** (`UT.WalletService.get()`): satu-satunya pintu ke RPC dompet. Klien hanya mengirim id/token/indeks paket. Satu RPC per aksi sekaligus; gagal jaringan -> `{ok:false, reason:'jaringan'}`.
- **`PlayerData` mode server:** coins/gems/inventory = cermin dari respons server (`applyServerWallet`, `applyServerItem`). `purchase`, `addCurrency`, dan `grant` (koin/gem/item) ditolak dengan `reason:'server-wallet'`; XP, equip, nama, pengaturan tetap lokal.
- **Halaman:** shop (buy, tukar gem; hadiahkan item dimatikan), profile (achievement: server sudah mengkredit, klien hanya sinkron), inventory, leaderboard (tukar gem), dailyreward (status & klaim dari server, hitung mundur WIB), misi (quest_get/track/claim), lobby (refresh saldo), gameplay (hadiah boss -> `claim_boss_reward` / `claim_cpu_boss_reward`; progres misi -> `quest_track` per match, idempoten lewat token `recordMatch`).
- **Tes:** `node game/tests/player-data-server.test.js`.
- **Belum:** `play.html`, `room.html`, `friendship.html`, `mode.html`, `splash.html` hanya membaca saldo (tidak diubah). Kebijakan impor saldo lama dari localStorage belum diputuskan (saat flag menyala, saldo lokal ditimpa server). Uji manual end-to-end di Supabase nyata belum dilakukan.

## B6: emerald dari iklan berhadiah (terpasang; verifikasi iklan = CATATAN/ditunda)
- **Server:** `claim_ad_reward(token)` (+5 emerald, maks 5/hari WIB, jeda 60 detik, idempoten per token) dan `ad_reward_get()`. Migrasi `202611120001_wallet_b6_ad_reward.sql`, tes `supabase/tests/wallet_b6_test.sql` (belum dijalankan; sandbox tanpa `psql`).
- **Klien:** `assets/js/ads-service.js` (`UT.Ads`), `WalletService.claimAd/adGet`, modal Toko Emerald di `shop.html` (`?emerald=1` dari halaman lain). Tamu: simulasi lokal dengan batas sama.
- **Provider iklan masih SIMULASI** (overlay 5 detik). Produksi: `UT.Ads.setProvider({ show: () => sdk.showRewarded().then(ok => ({ completed: !!ok })) })`.

### TODO / CATATAN: verifikasi iklan di server (ditunda)
- **Celah sekarang:** token klaim dibuat klien, jadi server tidak tahu iklan benar-benar ditonton. Batas harian hanya membatasi kerugian: maks 25 emerald/hari/akun (= 1.250 koin lewat tukar gem).
- **Perbaikan yang direncanakan (server-side verification, mis. AdMob SSV):** jaringan iklan memanggil balik endpoint server (Edge Function) dengan tanda tangan yang diverifikasi; server menyimpan token/transaction_id ke tabel "iklan terverifikasi"; `claim_ad_reward` hanya menerima token yang ada di tabel itu (sekali pakai, terikat ke user). Token klien dikirim ke SDK sebagai custom data agar callback bisa dicocokkan.
- **Sebelum rilis publik:** pasang provider nyata, lalu kerjakan verifikasi di atas, atau turunkan `c_gems`/`c_daily` bila belum sempat.
- **Keputusan ekonomi yang masih terbuka:** angka 5 emerald x 5 iklan/hari belum dibandingkan dengan kurs tukar (10 gem = 500 koin).
