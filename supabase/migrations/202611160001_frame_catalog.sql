-- Frame profil: daftarkan 14 frame (4 lama + 10 baru) ke katalog SERVER.
-- Harga/starter dibaca server dari item_catalog (bukan dari klien/localStorage). Aman diulang (upsert).
-- Sumber kebenaran: assets/js/item-catalog.js -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('frame.amethyst', 'frame', 1500, false, false),
  ('frame.celestial', 'frame', 8000, false, false),
  ('frame.copper', 'frame', 350, false, false),
  ('frame.cosmic', 'frame', 5000, false, false),
  ('frame.default', 'frame', null, true, false),
  ('frame.diamond', 'frame', 1200, false, false),
  ('frame.dragon', 'frame', 4000, false, false),
  ('frame.ender', 'frame', 2500, false, false),
  ('frame.gold', 'frame', 800, false, false),
  ('frame.iron', 'frame', 500, false, false),
  ('frame.nether', 'frame', 2000, false, false),
  ('frame.phoenix', 'frame', 6500, false, false),
  ('frame.stone', 'frame', 150, false, false),
  ('frame.storm', 'frame', 3000, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;
