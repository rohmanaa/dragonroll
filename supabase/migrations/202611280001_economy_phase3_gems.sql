-- Ekonomi fase 3: harga emerald (tier atas), tier berharga landai, tambang dibeli emerald, kurs seragam, hadiah boss online.
-- Aman dijalankan ulang (create or replace / update). Data pemain tidak diubah: hanya harga & biaya ke depan.
-- JANGAN edit blok seed tangan: jalankan node tools/wallet/gen-item-seed.js --write.

-- 1. Kolom harga emerald. Satu item hanya boleh memakai satu mata uang.
alter table public.item_catalog add column if not exists price_gems integer check (price_gems is null or price_gems > 0);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'item_catalog_one_currency') then
    alter table public.item_catalog add constraint item_catalog_one_currency check (price_coins is null or price_gems is null);
  end if;
end $$;

-- 2. Harga baru dadu/frame/aura (sumber: assets/js/item-catalog.js TIER_PRICE)
-- BEGIN TIER PRICE SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)
update public.item_catalog c set price_coins = v.c, price_gems = v.g
from (values
  ('aura.amethyst', 5600, null),
  ('aura.celestial', null, 320),
  ('aura.dragon', null, 220),
  ('aura.electric', 3200, null),
  ('aura.emerald', 3200, null),
  ('aura.ender', 5600, null),
  ('aura.flame', 1800, null),
  ('aura.frost', 1800, null),
  ('aura.nature', 1000, null),
  ('aura.nether', 5600, null),
  ('aura.ocean', 5600, null),
  ('aura.sculk', null, 150),
  ('aura.shadow', null, 150),
  ('aura.solar', null, 150),
  ('aura.stone', 1000, null),
  ('dice.amethyst', 4000, null),
  ('dice.copper', 1000, null),
  ('dice.diamond', 4000, null),
  ('dice.dragon', null, 320),
  ('dice.emas', 2000, null),
  ('dice.emerald', 4000, null),
  ('dice.ender', null, 220),
  ('dice.frost', null, 150),
  ('dice.iron', 1000, null),
  ('dice.lapis', 2000, null),
  ('dice.magma', null, 150),
  ('dice.netherite', null, 220),
  ('dice.obsidian', 4000, null),
  ('dice.prismarine', null, 150),
  ('dice.quartz', null, 150),
  ('dice.redstone', 4000, null),
  ('dice.rumput', 500, null),
  ('dice.sculk', null, 220),
  ('dice.stone', 500, null),
  ('dice.tnt', 1000, null),
  ('dice.void', null, 220),
  ('dice.wood', 500, null),
  ('frame.amethyst', 6600, null),
  ('frame.celestial', null, 660),
  ('frame.copper', 1500, null),
  ('frame.cosmic', null, 840),
  ('frame.diamond', 4600, null),
  ('frame.dragon', null, 410),
  ('frame.ender', null, 250),
  ('frame.gold', 3200, null),
  ('frame.iron', 2200, null),
  ('frame.nether', 9500, null),
  ('frame.phoenix', null, 520),
  ('frame.stone', 1000, null),
  ('frame.storm', null, 320)
) as v(id, c, g)
where c.id = v.id;
-- END TIER PRICE SEED

-- 3. buy_item: mendukung harga emerald. Selain itu sama dengan 202611230001 (power-up tetap lewat buy_powerup).
create or replace function public.buy_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_it   public.item_catalog;
  v_res  jsonb;
  v_have int;
  v_c    bigint;
  v_g    bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_it from public.item_catalog where id = p_item_id;
  if not found or v_it.starter or (v_it.price_coins is null and v_it.price_gems is null) or v_it.kind = 'powerup' then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;
  v_c := coalesce(v_it.price_coins, 0);
  v_g := coalesce(v_it.price_gems, 0);

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- serialisasi: tidak ada beli ganda/balapan

  select qty into v_have from public.player_inventory where user_id = v_uid and item_id = p_item_id;
  if v_have is not null and not v_it.stackable then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  begin
    v_res := public._wallet_apply(v_uid, -v_c, -v_g, 'buy',
               case when v_it.stackable then p_item_id || '#' || (coalesce(v_have, 0) + 1) else p_item_id end);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then
      return jsonb_build_object('ok', false, 'reason', 'saldo-kurang',
        'kurang', v_c - (select coins from public.player_wallet where user_id = v_uid));
    elsif sqlerrm = 'INSUFFICIENT_GEMS' then
      return jsonb_build_object('ok', false, 'reason', 'gem-kurang',
        'kurang', v_g - (select gems from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  insert into public.player_inventory(user_id, item_id) values (v_uid, p_item_id)
    on conflict (user_id, item_id) do update set qty = public.player_inventory.qty + 1;
  return jsonb_build_object('ok', true, 'item', p_item_id, 'spent', v_c, 'spent_gems', v_g,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;

-- buy_set (gear) memakai koin saja; gear tidak punya harga emerald, jadi tidak diubah.

-- 4. Tambang dibeli EMERALD. Naik tier landai (x1,3-1,4). Slot 1/2/3: buka 10 / 30 / 70.
--    Kecepatan Lv2..5 = 12 / 17 / 24 / 34, Peti Lv2..5 = 10 / 15 / 21 / 30, dikali 1,0 / 1,5 / 2,0 per slot. Boost tetap KOIN.
create or replace function public._mine_unlock_cost(p_slot int) returns bigint
language sql immutable as $$ select (array[10, 30, 70]::bigint[])[p_slot] $$;
create or replace function public._mine_up_cost(p_kind text, p_slot int, p_to int) returns bigint
language sql immutable as $$
  select round(
    case p_kind when 'speed' then (array[0, 12, 17, 24, 34]::numeric[])[p_to]
                when 'cap'   then (array[0, 10, 15, 21, 30]::numeric[])[p_to] end
    * (array[1.0, 1.5, 2.0]::numeric[])[p_slot])::bigint
$$;
-- Boost: lebih murah karena satu boost hanya menambah sedikit emerald (tetap koin).
create or replace function public._mine_boost_cost(p_slot int) returns bigint
language sql immutable as $$ select (array[150, 200, 300]::bigint[])[p_slot] $$;

create or replace function public.mine_unlock(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost bigint; v_gems bigint; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then return jsonb_build_object('ok', false, 'reason', 'slot-tidak-valid'); end if;
  perform public._wallet_ensure(v_uid);
  select gems into v_gems from public.player_wallet where user_id = v_uid for update;   -- serialisasi semua aksi tambang akun ini
  if exists (select 1 from public.player_mines where user_id = v_uid and slot = p_slot) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dibuka');
  end if;
  v_cost := public._mine_unlock_cost(p_slot);
  if v_gems < v_cost then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'butuh', v_cost, 'gems', v_gems); end if;
  v_res := public._wallet_apply(v_uid, 0, -v_cost, 'mine_unlock', 'slot:' || p_slot);
  insert into public.player_mines(user_id, slot) values (v_uid, p_slot);
  return v_res || jsonb_build_object('slot_data', public._mine_slot_json(v_uid, p_slot));
end;
$$;
revoke all on function public.mine_unlock(int) from public, anon;
grant execute on function public.mine_unlock(int) to authenticated;

create or replace function public.mine_upgrade(p_slot int, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_mines; v_gems bigint; v_lv int; v_cost bigint; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then return jsonb_build_object('ok', false, 'reason', 'slot-tidak-valid'); end if;
  if p_kind is null or p_kind not in ('speed', 'cap') then return jsonb_build_object('ok', false, 'reason', 'jenis-tidak-valid'); end if;
  perform public._wallet_ensure(v_uid);
  select gems into v_gems from public.player_wallet where user_id = v_uid for update;
  select * into r from public.player_mines where user_id = v_uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  v_lv := case p_kind when 'speed' then r.speed_lv else r.cap_lv end;
  if v_lv >= 5 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
  v_cost := public._mine_up_cost(p_kind, p_slot, v_lv + 1);
  if v_gems < v_cost then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'butuh', v_cost, 'gems', v_gems); end if;
  v_res := public._wallet_apply(v_uid, 0, -v_cost, 'mine_upgrade', 'slot:' || p_slot || ':' || p_kind || ':' || (v_lv + 1));
  -- selesaikan produksi dengan laju LAMA sampai sekarang, baru ganti level
  update public.player_mines set
    stock = public._mine_stock_now(r), stock_at = now(),
    speed_lv = case when p_kind = 'speed' then v_lv + 1 else speed_lv end,
    cap_lv   = case when p_kind = 'cap'   then v_lv + 1 else cap_lv end
  where user_id = v_uid and slot = p_slot;
  return v_res || jsonb_build_object('slot_data', public._mine_slot_json(v_uid, p_slot));
end;
$$;
revoke all on function public.mine_upgrade(int, text) from public, anon;
grant execute on function public.mine_upgrade(int, text) to authenticated;

-- 5. Kurs tukar emerald -> koin seragam 50 koin per emerald (tutup arbitrase dengan harga item emerald).
create or replace function public.exchange_gems(p_pack int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems  constant bigint[] := array[10, 40, 120];
  c_coins constant bigint[] := array[500, 2000, 6000];
  v_uid uuid := auth.uid(); v_n int; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pack is null or p_pack < 0 or p_pack > 2 then return jsonb_build_object('ok', false, 'reason', 'paket-tidak-valid'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) + 1 into v_n from public.wallet_ledger where user_id = v_uid and reason = 'exchange';

  begin
    v_res := public._wallet_apply(v_uid, c_coins[p_pack + 1], -c_gems[p_pack + 1], 'exchange', 'ex#' || v_n);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_GEMS' then
      return jsonb_build_object('ok', false, 'reason', 'gem-kurang',
        'kurang', c_gems[p_pack + 1] - (select gems from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'pack', p_pack, 'spent_gems', c_gems[p_pack + 1], 'got_coins', c_coins[p_pack + 1],
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.exchange_gems(int) from public, anon;
grant execute on function public.exchange_gems(int) to authenticated;

-- 6. Hadiah boss online: emerald diturunkan 10 -> 2 per menang (koin tetap 500, batas 10/hari).
create or replace function public.claim_boss_reward(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_coins constant bigint := 500;   -- = Config.DRAGON_REWARD di klien
  c_gems  constant bigint := 2;
  c_daily constant int    := 10;    -- batas hadiah boss online per akun per hari WIB; menahan farming lewat room palsu
  v_uid    uuid := auth.uid();
  v_room   public.game_rooms;
  v_widx   int;
  v_winner text;
  v_n      int;
  v_res    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_game_room_member(p_room_id) then raise exception 'ROOM_ACCESS_DENIED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id;
  if v_room.status <> 'finished' then return jsonb_build_object('ok', false, 'reason', 'room_not_finished'); end if;
  if not public._room_is_verified(p_room_id) then return jsonb_build_object('ok', false, 'reason', 'room_not_verified'); end if;
  v_widx := case when (v_room.game_state -> 'snapshot' ->> 'winnerIndex') ~ '^[0-9]+$'
                 then (v_room.game_state -> 'snapshot' ->> 'winnerIndex')::int end;
  v_winner := case when v_widx is not null then v_room.game_state -> 'snapshot' -> 'players' -> v_widx ->> 'networkId' end;
  if v_winner is null then return jsonb_build_object('ok', false, 'reason', 'no_result'); end if;
  if v_winner <> v_uid::text then return jsonb_build_object('ok', false, 'reason', 'not_winner'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) into v_n from public.wallet_ledger
    where user_id = v_uid and reason = 'boss' and created_at >= public._wib_day_start();
  if v_n >= c_daily then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;

  v_res := public._wallet_apply(v_uid, c_coins, c_gems, 'boss', p_room_id::text);
  return v_res || jsonb_build_object('reward_coins', c_coins, 'reward_gems', c_gems);
end;
$$;
revoke all on function public.claim_boss_reward(uuid) from public, anon;
grant execute on function public.claim_boss_reward(uuid) to authenticated;
