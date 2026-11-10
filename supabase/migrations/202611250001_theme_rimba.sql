-- Map baru "Rimba": daftarkan theme.rimba ke katalog SERVER (kind 'theme', gratis seperti map lain, bukan starter).
-- Terapkan SETELAH 202611110002_wallet_b2_server.sql. Aman diulang (upsert).
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('theme.rimba', 'theme', null, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;
