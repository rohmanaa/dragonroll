-- Set PVP: Ksatria Mahkota & Ksatria Rival (wajah, rambut, baju, celana, sepatu, mahkota, zirah, bahu, jubah, pedang).
-- Terapkan SETELAH 202611310001_pvp_wins_unlock.sql (butuh pvp_unlocks, player_stats.pvp_wins) dan 202611130001_player_outfits.sql.
-- Aman diulang (upsert / create or replace).
--
--   * 20 item gear baru di item_catalog: tidak dijual (price_coins null), bukan starter. Dibuka HANYA lewat claim_pvp_unlocks
--     setelah pvp_wins server >= min_wins (record_pvp_win sudah dibatasi harian). Klien tidak mengirim syarat/jumlah.
--   * claim_pvp_unlocks(p_item_ids): klaim banyak item sekaligus (satu set) dalam SATU transaksi; item yang syaratnya belum
--     terpenuhi dilaporkan di 'locked' (dengan min_wins), yang sudah dimiliki di 'already'.
--   * _appearance_normalize: wajah (eyes) & rambut (hair) yang ADA di katalog kini wajib dimiliki. Sebelumnya hanya dicek bentuk
--     datanya, sehingga id wajah terkunci bisa disimpan lewat appearance_save tanpa memiliki. Mata/rambut dasar (tidak ada di katalog)
--     tetap gratis.
--   * Angka min_wins di sini harus sama dengan unlock.wins di src/stores/item-catalog.js (PVP_SETS); itu hanya info tampilan.

insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('gear.boots.mahkota', 'gear', null, false, false),
  ('gear.boots.rival', 'gear', null, false, false),
  ('gear.cape.mahkota', 'gear', null, false, false),
  ('gear.cape.rival', 'gear', null, false, false),
  ('gear.chest.mahkota', 'gear', null, false, false),
  ('gear.chest.rival', 'gear', null, false, false),
  ('gear.eyes.mahkota', 'gear', null, false, false),
  ('gear.eyes.rival', 'gear', null, false, false),
  ('gear.hair.mahkota', 'gear', null, false, false),
  ('gear.hair.rival', 'gear', null, false, false),
  ('gear.helm.mahkota', 'gear', null, false, false),
  ('gear.helm.rival', 'gear', null, false, false),
  ('gear.legs.mahkota', 'gear', null, false, false),
  ('gear.legs.rival', 'gear', null, false, false),
  ('gear.shoulder.mahkota', 'gear', null, false, false),
  ('gear.shoulder.rival', 'gear', null, false, false),
  ('gear.top.mahkota', 'gear', null, false, false),
  ('gear.top.rival', 'gear', null, false, false),
  ('gear.weapon.mahkota', 'gear', null, false, false),
  ('gear.weapon.rival', 'gear', null, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;

update public.item_catalog set gender = null where id in (select item_id from (values
  ('gear.boots.mahkota'),
  ('gear.boots.rival'),
  ('gear.cape.mahkota'),
  ('gear.cape.rival'),
  ('gear.chest.mahkota'),
  ('gear.chest.rival'),
  ('gear.eyes.mahkota'),
  ('gear.eyes.rival'),
  ('gear.hair.mahkota'),
  ('gear.hair.rival'),
  ('gear.helm.mahkota'),
  ('gear.helm.rival'),
  ('gear.legs.mahkota'),
  ('gear.legs.rival'),
  ('gear.shoulder.mahkota'),
  ('gear.shoulder.rival'),
  ('gear.top.mahkota'),
  ('gear.top.rival'),
  ('gear.weapon.mahkota'),
  ('gear.weapon.rival')
) as v(item_id));

insert into public.pvp_unlocks(item_id, min_wins) values
  ('gear.boots.mahkota', 10),
  ('gear.boots.rival', 20),
  ('gear.cape.mahkota', 10),
  ('gear.cape.rival', 20),
  ('gear.chest.mahkota', 10),
  ('gear.chest.rival', 20),
  ('gear.eyes.mahkota', 10),
  ('gear.eyes.rival', 20),
  ('gear.hair.mahkota', 10),
  ('gear.hair.rival', 20),
  ('gear.helm.mahkota', 10),
  ('gear.helm.rival', 20),
  ('gear.legs.mahkota', 10),
  ('gear.legs.rival', 20),
  ('gear.shoulder.mahkota', 10),
  ('gear.shoulder.rival', 20),
  ('gear.top.mahkota', 10),
  ('gear.top.rival', 20),
  ('gear.weapon.mahkota', 10),
  ('gear.weapon.rival', 20)
on conflict (item_id) do update set min_wins = excluded.min_wins;

-- ============ claim_pvp_unlocks: klaim satu set sekaligus ============
-- Hasil ok     : {ok:true, wins, granted:[id baru], already:[id sudah dimiliki], locked:[{item_id, min_wins}]}
-- Hasil gagal  : {ok:false, reason:'tidak-tersedia'} bila daftar kosong/null, > 40 id, ada elemen null, atau ada id yang bukan item PVP.
create or replace function public.claim_pvp_unlocks(p_item_ids text[])
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_max   constant int := 40;
  v_uid     uuid := auth.uid();
  v_ids     text[];
  v_wins    int;
  v_granted text[] := '{}';
  v_already text[] := '{}';
  v_locked  jsonb  := '[]'::jsonb;
  r         record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0 or cardinality(p_item_ids) > c_max
     or exists (select 1 from unnest(p_item_ids) x where x is null) then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  select array_agg(distinct x order by x) into v_ids from unnest(p_item_ids) x;
  if (select count(*) from public.pvp_unlocks where item_id = any (v_ids)) <> cardinality(v_ids) then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select pvp_wins into v_wins from public.player_stats where user_id = v_uid for update;

  for r in select u.item_id, u.min_wins from public.pvp_unlocks u where u.item_id = any (v_ids) order by u.item_id loop
    if v_wins < r.min_wins then
      v_locked := v_locked || jsonb_build_array(jsonb_build_object('item_id', r.item_id, 'min_wins', r.min_wins));
    elsif exists (select 1 from public.player_inventory where user_id = v_uid and item_id = r.item_id) then
      v_already := v_already || r.item_id;
    else
      insert into public.player_inventory(user_id, item_id) values (v_uid, r.item_id) on conflict do nothing;
      v_granted := v_granted || r.item_id;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'wins', v_wins, 'granted', to_jsonb(v_granted), 'already', to_jsonb(v_already), 'locked', v_locked);
end;
$$;
revoke all on function public.claim_pvp_unlocks(text[]) from public, anon;
grant execute on function public.claim_pvp_unlocks(text[]) to authenticated;

-- ============ _appearance_normalize: wajah & rambut katalog wajib dimiliki ============
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
      -- wajah/rambut yang ada di katalog (mis. set PVP) hanya boleh dipakai bila dimiliki; yang tidak ada di katalog = dasar penampilan (gratis)
      if exists (select 1 from public.item_catalog c where c.id = 'gear.' || v_part || '.' || (v_o ->> 'id') and c.kind = 'gear')
         and not public._owns_item(p_user, 'gear.' || v_part || '.' || (v_o ->> 'id')) then
        return public._bad('belum-dimiliki', 'gear.' || v_part || '.' || (v_o ->> 'id'));
      end if;
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

