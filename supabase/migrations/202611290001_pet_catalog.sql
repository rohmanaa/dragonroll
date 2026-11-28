-- Pet: daftarkan 7 pet ke katalog SERVER (kind 'pet') + izinkan slot 'pet' pada tampilan aktif.
-- Terapkan SETELAH 202611130001_player_outfits.sql (butuh _item_equip_slot), 202611200001_aura_catalog.sql (versi _item_equip_slot sebelumnya)
-- dan 202611280001_economy_phase3_gems.sql (kolom price_gems + buy_item harga emerald). Aman diulang (upsert / create or replace).
-- Beli lewat buy_item (dompet server: koin T1-T4, emerald T5-T7), kepemilikan lewat inventory server, pilihan pet aktif tersimpan di
-- player_appearance.equipped['pet'] (ikut ke perangkat lain dan terlihat pemain lain lewat room_appearance_get) — jalur yang sama dengan aura.
-- Metadata & skill pet ada di supabase/pet_catalog.sql (tabel pet_catalog, hanya-baca); file ini hanya urusan jual-beli & equip.
-- Sumber kebenaran harga: assets/js/item-catalog.js (TIER_PRICE) -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
-- BEGIN PET SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)
insert into public.item_catalog(id, kind, price_coins, price_gems, starter, stackable) values
  ('pet.arcane_owl', 'pet', 60000, null, false, false),
  ('pet.celestial_kitsune', 'pet', null, 6000, false, false),
  ('pet.copper_golem', 'pet', 9000, null, false, false),
  ('pet.crystal_axolotl', 'pet', 25000, null, false, false),
  ('pet.forest_pup', 'pet', 3000, null, false, false),
  ('pet.inferno_dragon', 'pet', null, 3000, false, false),
  ('pet.storm_wolf', 'pet', null, 1500, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, price_gems = excluded.price_gems, starter = excluded.starter, stackable = excluded.stackable;
-- END PET SEED

-- Slot equip per item: tambah kind 'pet' -> slot 'pet' (satu pet aktif, boleh kosong). Semua kind lama dipertahankan.
create or replace function public._item_equip_slot(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select case c.kind
    when 'skin' then 'skin' when 'dice' then 'dice' when 'theme' then 'theme' when 'frame' then 'frame' when 'aura' then 'aura' when 'pet' then 'pet'
    when 'gear' then case when split_part(c.id, '.', 2) = 'acc' then 'g.acc.' || split_part(c.id, '.', 3) else 'g.' || split_part(c.id, '.', 2) end
  end
  from public.item_catalog c where c.id = p_id;
$$;
revoke all on function public._item_equip_slot(text) from public, anon, authenticated;
