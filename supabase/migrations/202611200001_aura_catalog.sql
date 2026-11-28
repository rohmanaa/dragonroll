-- Aura karakter (kategori Efek): daftarkan 15 aura ke katalog SERVER + izinkan slot 'aura' pada tampilan aktif.
-- Terapkan SETELAH 202611130001_player_outfits.sql (butuh _item_equip_slot) dan 202611170001_dice_catalog.sql. Aman diulang.
-- Harga/starter dibaca server dari item_catalog (bukan dari klien/localStorage). Beli lewat buy_item (dompet server), pilihan aura
-- aktif tersimpan di player_appearance.equipped['aura'] dan ikut ke perangkat lain / dilihat pemain di room (room_appearance_get).
-- Sumber kebenaran: assets/js/item-catalog.js -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('aura.amethyst', 'aura', 1800, false, false),
  ('aura.celestial', 'aura', 10000, false, false),
  ('aura.dragon', 'aura', 6500, false, false),
  ('aura.electric', 'aura', 1000, false, false),
  ('aura.emerald', 'aura', 1000, false, false),
  ('aura.ender', 'aura', 1800, false, false),
  ('aura.flame', 'aura', 600, false, false),
  ('aura.frost', 'aura', 600, false, false),
  ('aura.nature', 'aura', 300, false, false),
  ('aura.nether', 'aura', 1800, false, false),
  ('aura.ocean', 'aura', 1800, false, false),
  ('aura.shadow', 'aura', 3500, false, false),
  ('aura.sculk', 'aura', 3500, false, false),
  ('aura.solar', 'aura', 3500, false, false),
  ('aura.stone', 'aura', 300, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;

-- Slot equip per item: tambah kind 'aura' -> slot 'aura' (satu aura aktif, boleh kosong).
create or replace function public._item_equip_slot(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select case c.kind
    when 'skin' then 'skin' when 'dice' then 'dice' when 'theme' then 'theme' when 'frame' then 'frame' when 'aura' then 'aura'
    when 'gear' then case when split_part(c.id, '.', 2) = 'acc' then 'g.acc.' || split_part(c.id, '.', 3) else 'g.' || split_part(c.id, '.', 2) end
  end
  from public.item_catalog c where c.id = p_id;
$$;
revoke all on function public._item_equip_slot(text) from public, anon, authenticated;
