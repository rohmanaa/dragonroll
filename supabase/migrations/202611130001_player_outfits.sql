-- Outfit pribadi + tampilan aktif di SERVER. Terapkan SETELAH 202611120001_wallet_b6_ad_reward.sql
-- (butuh item_catalog + player_inventory dari B2 dan is_game_room_member dari 202611060001).
--
-- Isi:
--   1. item_catalog.gender : gender tiap item gear ('m' | 'f' | null = semua). Diisi dari katalog klien lewat
--                            tools/wallet/gen-item-seed.js (blok GEAR GENDER SEED di bawah; jangan edit tangan).
--   2. player_outfits      : maksimal 5 slot per pemain (slot 0..4), data tervalidasi SERVER.
--   3. player_appearance   : tampilan aktif (look, equipped, gearDye) supaya ikut ke perangkat lain dan bisa dilihat
--                            pemain lain di room multiplayer.
--
-- Aturan (mengikuti pola wallet B1/B2): tabel RLS aktif + tanpa akses langsung untuk klien; semua lewat RPC
-- security definer yang memakai auth.uid(). Validasi satu pintu di fungsi internal _outfit_normalize /
-- _appearance_normalize; data yang ditolak tidak menulis apa pun (tidak ada simpan setengah).
-- Kepemilikan: item dimiliki bila item starter ATAU ada di player_inventory (starter tidak disimpan di inventory server).
-- Bentuk data outfit sama dengan PlayerData klien (assets/js/player-data.js, cleanOutfitData):
--   { gender:'m'|'f', top|legs|boots|helm|chest|shoulder|cape|weapon:{id, dye?}, accessories:[{id, dye?}] }

-- ============ 1. Gender item ============
alter table public.item_catalog add column if not exists gender text check (gender is null or gender in ('m', 'f'));

-- BEGIN GEAR GENDER SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)
update public.item_catalog c set gender = v.g
from (values
  ('gear.acc.beard', 'm'),
  ('gear.acc.belt', null),
  ('gear.acc.bow', 'f'),
  ('gear.acc.earrings', 'f'),
  ('gear.acc.glasses', null),
  ('gear.acc.gloves', null),
  ('gear.acc.goggles', null),
  ('gear.acc.mustache', 'm'),
  ('gear.acc.necklace', 'f'),
  ('gear.acc.pack', null),
  ('gear.acc.purse', 'f'),
  ('gear.acc.scarf', null),
  ('gear.boots.cloth', null),
  ('gear.boots.flat', 'f'),
  ('gear.boots.knee', 'f'),
  ('gear.boots.mary', 'f'),
  ('gear.boots.none', null),
  ('gear.boots.sandal', null),
  ('gear.boots.shoes', null),
  ('gear.boots.tall', null),
  ('gear.cape.long', null),
  ('gear.cape.short', null),
  ('gear.cape.wings', 'f'),
  ('gear.chest.bodice', 'f'),
  ('gear.chest.leather', null),
  ('gear.chest.plate', null),
  ('gear.chest.valk', 'f'),
  ('gear.helm.beret', 'f'),
  ('gear.helm.crown', null),
  ('gear.helm.flowers', 'f'),
  ('gear.helm.knight', null),
  ('gear.helm.ribbon', 'f'),
  ('gear.helm.straw', null),
  ('gear.helm.tiara', 'f'),
  ('gear.helm.wizard', null),
  ('gear.legs.bare', null),
  ('gear.legs.formal', 'm'),
  ('gear.legs.lskirt', 'f'),
  ('gear.legs.pants', null),
  ('gear.legs.shorts', null),
  ('gear.legs.skirt', 'f'),
  ('gear.legs.tights', 'f'),
  ('gear.shoulder.gem', 'f'),
  ('gear.shoulder.leather', null),
  ('gear.shoulder.pad', null),
  ('gear.shoulder.ruffle', 'f'),
  ('gear.shoulder.spiked', 'm'),
  ('gear.top.blouse', 'f'),
  ('gear.top.cardigan', 'f'),
  ('gear.top.coat', 'm'),
  ('gear.top.dress', 'f'),
  ('gear.top.overall', null),
  ('gear.top.robe', null),
  ('gear.top.sundress', 'f'),
  ('gear.top.tee', null),
  ('gear.top.tunic', null),
  ('gear.top.vest', null),
  ('gear.weapon.axe', 'm'),
  ('gear.weapon.parasol', 'f'),
  ('gear.weapon.rapier', 'f'),
  ('gear.weapon.staff', null),
  ('gear.weapon.sword', null),
  ('gear.weapon.wand', 'f')
) as v(id, g)
where c.id = v.id;
-- END GEAR GENDER SEED

-- ============ 2. Tabel ============
create table if not exists public.player_outfits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       smallint not null check (slot between 0 and 4),
  name       text not null check (char_length(name) between 1 and 16),
  data       jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.player_outfits enable row level security;
revoke all on public.player_outfits from anon, authenticated;

create table if not exists public.player_appearance (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  look       jsonb check (look is null or jsonb_typeof(look) = 'object'),
  equipped   jsonb not null default '{}'::jsonb check (jsonb_typeof(equipped) = 'object'),
  gear_dye   jsonb not null default '{}'::jsonb check (jsonb_typeof(gear_dye) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.player_appearance enable row level security;
revoke all on public.player_appearance from anon, authenticated;

-- ============ 3. Fungsi internal (TIDAK bisa dipanggil klien) ============
create or replace function public._bad(p_reason text, p_item text default null) returns jsonb
language sql immutable as $$
  select case when p_item is null then jsonb_build_object('ok', false, 'reason', p_reason)
              else jsonb_build_object('ok', false, 'reason', p_reason, 'item', p_item) end;
$$;
revoke all on function public._bad(text, text) from public, anon, authenticated;

create or replace function public._owns_item(p_user uuid, p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.item_catalog c where c.id = p_item and c.starter)
      or exists (select 1 from public.player_inventory i where i.user_id = p_user and i.item_id = p_item);
$$;
revoke all on function public._owns_item(uuid, text) from public, anon, authenticated;

-- Satu bagian outfit: null bila sah, atau {ok:false, reason, item}. 'none' (bagian kosong) sah bila bukan item katalog.
create or replace function public._outfit_item_error(p_user uuid, p_part text, p_id text, p_gender text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_key text := 'gear.' || p_part || '.' || p_id; v_it public.item_catalog;
begin
  select * into v_it from public.item_catalog where id = v_key and kind = 'gear';
  if not found then
    if p_id = 'none' then return null; end if;
    return public._bad('item-tidak-dikenal', v_key);
  end if;
  if v_it.gender is not null and v_it.gender <> p_gender then return public._bad('gender-tidak-cocok', v_key); end if;
  if not public._owns_item(p_user, v_key) then return public._bad('belum-dimiliki', v_key); end if;
  return null;
end;
$$;
revoke all on function public._outfit_item_error(uuid, text, text, text) from public, anon, authenticated;

-- Validasi + normalisasi data outfit. Return {ok:true, data} atau {ok:false, reason, item?}.
create or replace function public._outfit_normalize(p_user uuid, p_data jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_parts constant text[] := array['top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'];
  c_id    constant text   := '^[a-z0-9_]{1,24}$';
  v_gender text; v_out jsonb; v_k text; v_p jsonb; v_id text; v_dye text; v_err jsonb;
  v_acc jsonb; v_a jsonb; v_accs jsonb := '[]'::jsonb; v_seen text[] := '{}';
begin
  if jsonb_typeof(p_data) is distinct from 'object' then return public._bad('data-tidak-valid'); end if;
  v_gender := case when jsonb_typeof(p_data -> 'gender') = 'string' then p_data ->> 'gender' end;
  if v_gender is null or v_gender not in ('m', 'f') then return public._bad('data-tidak-valid'); end if;
  v_out := jsonb_build_object('gender', v_gender);

  foreach v_k in array c_parts loop
    v_p := p_data -> v_k;
    if v_p is null or jsonb_typeof(v_p) = 'null' then v_p := '{"id":"none"}'::jsonb; end if;
    if jsonb_typeof(v_p) <> 'object' or jsonb_typeof(v_p -> 'id') is distinct from 'string' then return public._bad('data-tidak-valid'); end if;
    v_id := v_p ->> 'id';
    if v_id !~ c_id then return public._bad('data-tidak-valid'); end if;
    v_dye := null;
    if v_p ? 'dye' and jsonb_typeof(v_p -> 'dye') <> 'null' then
      if jsonb_typeof(v_p -> 'dye') <> 'string' or (v_p ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      v_dye := v_p ->> 'dye';
    end if;
    v_err := public._outfit_item_error(p_user, v_k, v_id, v_gender);
    if v_err is not null then return v_err; end if;
    v_out := v_out || jsonb_build_object(v_k, case when v_dye is null then jsonb_build_object('id', v_id) else jsonb_build_object('id', v_id, 'dye', v_dye) end);
  end loop;

  v_acc := coalesce(nullif(p_data -> 'accessories', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_acc) <> 'array' or jsonb_array_length(v_acc) > 12 then return public._bad('data-tidak-valid'); end if;
  for v_a in select * from jsonb_array_elements(v_acc) loop
    if jsonb_typeof(v_a) <> 'object' or jsonb_typeof(v_a -> 'id') is distinct from 'string' or (v_a ->> 'id') !~ c_id then return public._bad('data-tidak-valid'); end if;
    v_id := v_a ->> 'id';
    v_dye := null;
    if v_a ? 'dye' and jsonb_typeof(v_a -> 'dye') <> 'null' then
      if jsonb_typeof(v_a -> 'dye') <> 'string' or (v_a ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      v_dye := v_a ->> 'dye';
    end if;
    if v_id = 'none' or v_id = any (v_seen) then continue; end if;   -- sama dengan klien: 'none' dan duplikat dibuang
    v_err := public._outfit_item_error(p_user, 'acc', v_id, v_gender);
    if v_err is not null then return v_err; end if;
    v_seen := v_seen || v_id;
    v_accs := v_accs || jsonb_build_array(case when v_dye is null then jsonb_build_object('id', v_id) else jsonb_build_object('id', v_id, 'dye', v_dye) end);
  end loop;
  v_out := v_out || jsonb_build_object('accessories', v_accs);
  return jsonb_build_object('ok', true, 'data', v_out);
end;
$$;
revoke all on function public._outfit_normalize(uuid, jsonb) from public, anon, authenticated;

-- Nama outfit: sama dengan klien (kontrol dan < > dibuang, spasi dirapikan, maks 16). Kosong -> null.
create or replace function public._outfit_name(p_name text) returns text
language sql immutable as $$
  select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]+', '', 'g'), '\s+', ' ', 'g')), 16), '');
$$;
revoke all on function public._outfit_name(text) from public, anon, authenticated;

-- Slot yang seharusnya dipakai sebuah item equipment (sama dengan item.slot di klien); null = tidak bisa di-equip.
create or replace function public._item_equip_slot(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select case c.kind
    when 'skin' then 'skin' when 'dice' then 'dice' when 'theme' then 'theme' when 'frame' then 'frame'
    when 'gear' then case when split_part(c.id, '.', 2) = 'acc' then 'g.acc.' || split_part(c.id, '.', 3) else 'g.' || split_part(c.id, '.', 2) end
  end
  from public.item_catalog c where c.id = p_id;
$$;
revoke all on function public._item_equip_slot(text) from public, anon, authenticated;

-- Validasi + normalisasi tampilan aktif. Return {ok:true, look, equipped, gear_dye} atau {ok:false, reason, item?}.
create or replace function public._appearance_normalize(p_user uuid, p_look jsonb, p_equipped jsonb, p_dye jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_id constant text := '^[a-z0-9_]{1,24}$';
  v_look jsonb := null; v_part text; v_o jsonb; v_h numeric := 1; v_b numeric := 1; v_body jsonb;
  v_eq jsonb := '{}'::jsonb; v_gd jsonb := '{}'::jsonb; r record; v_slot text;
begin
  if p_look is not null and jsonb_typeof(p_look) <> 'null' then
    if jsonb_typeof(p_look) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if jsonb_typeof(p_look -> 'gender') is distinct from 'string' or (p_look ->> 'gender') not in ('m', 'f') then return public._bad('data-tidak-valid'); end if;
    if jsonb_typeof(p_look -> 'skin') is distinct from 'string' or (p_look ->> 'skin') !~ '^s[1-5]$' then return public._bad('data-tidak-valid'); end if;
    v_look := jsonb_build_object('gender', p_look ->> 'gender', 'skin', p_look ->> 'skin');
    foreach v_part in array array['eyes', 'hair'] loop
      v_o := p_look -> v_part;
      if jsonb_typeof(v_o) is distinct from 'object' or jsonb_typeof(v_o -> 'id') is distinct from 'string' or jsonb_typeof(v_o -> 'dye') is distinct from 'string'
         or (v_o ->> 'id') !~ c_id or (v_o ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      v_look := v_look || jsonb_build_object(v_part, jsonb_build_object('id', v_o ->> 'id', 'dye', v_o ->> 'dye'));
    end loop;
    v_body := p_look -> 'body';
    if v_body is not null and jsonb_typeof(v_body) = 'object' then
      if jsonb_typeof(v_body -> 'height') = 'number' and (v_body ->> 'height')::numeric > 0 then v_h := (v_body ->> 'height')::numeric; end if;
      if jsonb_typeof(v_body -> 'build')  = 'number' and (v_body ->> 'build')::numeric  > 0 then v_b := (v_body ->> 'build')::numeric; end if;
    end if;
    v_look := v_look || jsonb_build_object('body', jsonb_build_object('height', least(1.1, greatest(0.9, v_h)), 'build', least(1.15, greatest(0.9, v_b))));
  end if;

  if p_equipped is not null and jsonb_typeof(p_equipped) <> 'null' then
    if jsonb_typeof(p_equipped) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if (select count(*) from jsonb_object_keys(p_equipped)) > 60 then return public._bad('data-tidak-valid'); end if;
    for r in select key, value from jsonb_each(p_equipped) loop
      if jsonb_typeof(r.value) <> 'string' then return public._bad('data-tidak-valid'); end if;
      v_slot := public._item_equip_slot(r.value #>> '{}');
      if v_slot is null or v_slot <> r.key then return public._bad('slot-tidak-cocok', r.value #>> '{}'); end if;
      if not public._owns_item(p_user, r.value #>> '{}') then return public._bad('belum-dimiliki', r.value #>> '{}'); end if;
      v_eq := v_eq || jsonb_build_object(r.key, r.value);
    end loop;
  end if;

  if p_dye is not null and jsonb_typeof(p_dye) <> 'null' then
    if jsonb_typeof(p_dye) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if (select count(*) from jsonb_object_keys(p_dye)) > 120 then return public._bad('data-tidak-valid'); end if;
    for r in select key, value from jsonb_each(p_dye) loop
      if jsonb_typeof(r.value) <> 'string' or (r.value #>> '{}') !~ c_id then return public._bad('data-tidak-valid'); end if;
      if not exists (select 1 from public.item_catalog c where c.id = r.key and c.kind = 'gear') then return public._bad('item-tidak-dikenal', left(r.key, 60)); end if;
      if not public._owns_item(p_user, r.key) then return public._bad('belum-dimiliki', r.key); end if;
      v_gd := v_gd || jsonb_build_object(r.key, r.value);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'look', v_look, 'equipped', v_eq, 'gear_dye', v_gd);
end;
$$;
revoke all on function public._appearance_normalize(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ============ 4. RPC outfit ============
create or replace function public.outfit_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slot', slot, 'name', name, 'data', data, 'updated_at', updated_at) order by slot)
                   from public.player_outfits where user_id = v_uid), '[]'::jsonb);
end;
$$;
revoke all on function public.outfit_list() from public, anon;
grant execute on function public.outfit_list() to authenticated;

-- Simpan outfit baru ke slot kosong pertama (maks 5). Semua item harus dimiliki dan cocok gender.
create or replace function public.outfit_save(p_name text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text := public._outfit_name(p_name); v_n jsonb; v_slot int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name is null then return public._bad('nama-kosong'); end if;
  perform pg_advisory_xact_lock(hashtextextended('outfit:' || v_uid::text, 0));   -- serialisasi per pemain: tidak ada slot ganda/melebihi batas
  v_n := public._outfit_normalize(v_uid, p_data);
  if not (v_n ->> 'ok')::boolean then return v_n; end if;
  select s into v_slot from generate_series(0, 4) s
    where not exists (select 1 from public.player_outfits o where o.user_id = v_uid and o.slot = s) order by s limit 1;
  if v_slot is null then return public._bad('slot-penuh'); end if;
  insert into public.player_outfits(user_id, slot, name, data) values (v_uid, v_slot, v_name, v_n -> 'data');
  return jsonb_build_object('ok', true, 'slot', v_slot, 'name', v_name, 'data', v_n -> 'data');
end;
$$;
revoke all on function public.outfit_save(text, jsonb) from public, anon;
grant execute on function public.outfit_save(text, jsonb) to authenticated;

create or replace function public.outfit_rename(p_slot int, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text := public._outfit_name(p_name); v_rows int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name is null then return public._bad('nama-kosong'); end if;
  update public.player_outfits set name = v_name, updated_at = now() where user_id = v_uid and slot = p_slot;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return public._bad('tidak-ada'); end if;
  return jsonb_build_object('ok', true, 'slot', p_slot, 'name', v_name);
end;
$$;
revoke all on function public.outfit_rename(int, text) from public, anon;
grant execute on function public.outfit_rename(int, text) to authenticated;

create or replace function public.outfit_delete(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.player_outfits where user_id = v_uid and slot = p_slot;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return public._bad('tidak-ada'); end if;
  return jsonb_build_object('ok', true, 'slot', p_slot);
end;
$$;
revoke all on function public.outfit_delete(int) from public, anon;
grant execute on function public.outfit_delete(int) to authenticated;

-- ============ 5. RPC tampilan aktif ============
-- Simpan tampilan aktif milik sendiri. Klien mengirim isi PlayerData (look, equipped, gearDye); server memvalidasi
-- kepemilikan/slot/format dan menulis seluruhnya atau tidak sama sekali.
create or replace function public.appearance_save(p_look jsonb, p_equipped jsonb, p_gear_dye jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_n := public._appearance_normalize(v_uid, p_look, p_equipped, p_gear_dye);
  if not (v_n ->> 'ok')::boolean then return v_n; end if;
  insert into public.player_appearance(user_id, look, equipped, gear_dye, updated_at)
    values (v_uid, nullif(v_n -> 'look', 'null'::jsonb), v_n -> 'equipped', v_n -> 'gear_dye', now())
    on conflict (user_id) do update set look = excluded.look, equipped = excluded.equipped, gear_dye = excluded.gear_dye, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.appearance_save(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.appearance_save(jsonb, jsonb, jsonb) to authenticated;

create or replace function public.appearance_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_a public.player_appearance;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_a from public.player_appearance where user_id = v_uid;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'look', v_a.look, 'equipped', v_a.equipped, 'gear_dye', v_a.gear_dye, 'updated_at', v_a.updated_at);
end;
$$;
revoke all on function public.appearance_get() from public, anon;
grant execute on function public.appearance_get() to authenticated;

-- Tampilan aktif semua anggota sebuah room (hanya untuk anggota room itu). Pemain tanpa data tidak muncul.
create or replace function public.room_appearance_get(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_game_room_member(p_room_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'look', a.look, 'equipped', a.equipped, 'gear_dye', a.gear_dye) order by a.user_id)
    from public.player_appearance a
    where a.user_id in (
      select (e ->> 'id')::uuid from public.game_rooms r, jsonb_array_elements(r.players) e
      where r.id = p_room_id and (e ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.room_appearance_get(uuid) from public, anon;
grant execute on function public.room_appearance_get(uuid) to authenticated;
