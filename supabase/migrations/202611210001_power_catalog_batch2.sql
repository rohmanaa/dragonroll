-- Power Batch 2-3: daftarkan 10 Power baru ke katalog SERVER (kind 'powerup', consumable ber-quantity, belum dijual: harga null).
-- Terapkan SETELAH 202611110002_wallet_b2_server.sql. Aman diulang (upsert). Power lama (sword, feather, tnt, totem, grass, potion_odd, potion_even)
-- tidak berubah: id dan stok pemain tetap. Aturan main Power ada di klien (gameplay/config.js C.PUR + usePU); server hanya memegang kepemilikan/jumlah.
-- Sumber kebenaran: assets/js/item-catalog.js -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('blaze_core', 'powerup', null, false, true),
  ('diamond_sword', 'powerup', null, false, true),
  ('dragon_crystal', 'powerup', null, false, true),
  ('fire_charge', 'powerup', null, false, true),
  ('golden_apple', 'powerup', null, false, true),
  ('ice_crystal', 'powerup', null, false, true),
  ('nether_star', 'powerup', null, false, true),
  ('netherite_sword', 'powerup', null, false, true),
  ('trident', 'powerup', null, false, true),
  ('wooden_shield', 'powerup', null, false, true)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;
