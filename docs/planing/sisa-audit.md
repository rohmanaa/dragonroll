# Sisa Audit (belum dikerjakan)

- Toko dan beli/jual: `shop-page.js`, RPC beli set/dadu/pet/frame, `buy-set-sql.integration.test.js`. Periksa harga dari server, saldo tidak bisa negatif, jual tidak bisa ganda.
- Chest: `202611330001_chest_system.sql` sampai `202611470001_chest_shop_gems.sql`. Periksa peluang drop dan klaim ganda.
- Tambang: `202611360001_tambang_upgrade_koin.sql`, `202611490001_tambang_world.sql`, `mine-service`. Periksa laju koin dan klaim offline.
- Hearts: `202611410001_hearts.sql`, `202611440001_hearts_friends.sql`. Periksa pemulihan dan kiriman antar teman.
- Hadiah harian 30 hari dan hadiah misi: `202611390001_daily_reward_30.sql`, `hadiah-misi`.
- Alur game: gangguan koneksi saat room selesai, klaim pemenang ganda, AFK.
