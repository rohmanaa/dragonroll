-- Dadu: daftarkan 23 skin dadu (koleksi Dragon Roll) ke katalog SERVER.
-- Harga/starter dibaca server dari item_catalog (bukan dari klien/localStorage/hardcode di gameplay). Aman diulang (upsert).
-- Sumber kebenaran: assets/js/item-catalog.js -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
-- Harga dadu baru adalah usulan berdasarkan rarity/tier; ubah di item-catalog.js lalu jalankan gen-item-seed.js --write dan terapkan ulang.
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('dice.amethyst', 'dice', 450, false, false),
  ('dice.copper', 'dice', 150, false, false),
  ('dice.diamond', 'dice', 450, false, false),
  ('dice.dragon', 'dice', 3500, false, false),
  ('dice.emas', 'dice', 900, false, false),
  ('dice.emerald', 'dice', 450, false, false),
  ('dice.ender', 'dice', 1800, false, false),
  ('dice.frost', 'dice', 900, false, false),
  ('dice.iron', 'dice', 200, false, false),
  ('dice.klasik', 'dice', null, true, false),
  ('dice.lapis', 'dice', 250, false, false),
  ('dice.magma', 'dice', 900, false, false),
  ('dice.netherite', 'dice', 1800, false, false),
  ('dice.obsidian', 'dice', 500, false, false),
  ('dice.prismarine', 'dice', 900, false, false),
  ('dice.quartz', 'dice', 900, false, false),
  ('dice.redstone', 'dice', 500, false, false),
  ('dice.rumput', 'dice', 100, false, false),
  ('dice.sculk', 'dice', 1800, false, false),
  ('dice.stone', 'dice', 100, false, false),
  ('dice.tnt', 'dice', 200, false, false),
  ('dice.void', 'dice', 1800, false, false),
  ('dice.wood', 'dice', 100, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;
