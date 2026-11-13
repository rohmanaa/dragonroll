-- Dompet server, TAHAP B2 (sisi server). Terapkan SETELAH 202611110001_wallet_b1.sql.
--
-- Isi:
--   1. item_catalog  : harga & aturan item di SERVER (disalin dari game/assets/js/item-catalog.js lewat
--                      game/tools/wallet/gen-item-seed.js; klien tidak bisa menentukan harga).
--   2. player_inventory + buy_item(item_id) + inventory_get() : beli di toko, saldo & inventory SATU transaksi.
--   3. claim_boss_reward(room_id): hadiah boss ke PEMENANG sebenarnya (bukan host), sekali per room, batas harian.
--   4. claim_achievement: reward kini juga masuk dompet server (idempoten per bintang).
--
-- PENTING (jangan dicampur): klien MASIH memakai saldo lokal (PlayerData) sampai tahap B2c memasangnya.
-- Selama itu dompet server terisi (achievement, boss) tetapi belum dibaca klien. Saat klien beralih ke saldo server,
-- panggilan PD.addCurrency lokal untuk achievement WAJIB dihentikan agar tidak dihitung dua kali.
-- Batas kepercayaan: pemenang room diambil dari game_state yang ditulis HOST (sampai tahap C: validasi server),
-- karena itu hadiah boss dibatasi per hari. BUKAN anti-cheat penuh.

-- ============ 1. Katalog item di server ============
create table if not exists public.item_catalog (
  id          text primary key,
  kind        text not null,
  price_coins integer check (price_coins is null or price_coins > 0),
  starter     boolean not null default false,
  stackable   boolean not null default false
);
alter table public.item_catalog enable row level security;
revoke all on public.item_catalog from anon, authenticated;

-- BEGIN CATALOG SEED (dibuat oleh game/tools/wallet/gen-item-seed.js; jangan edit tangan)
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('aura.amethyst', 'aura', 15000, false, false),
  ('aura.celestial', 'aura', null, false, false),
  ('aura.dragon', 'aura', null, false, false),
  ('aura.electric', 'aura', 5000, false, false),
  ('aura.emerald', 'aura', 5000, false, false),
  ('aura.ender', 'aura', 15000, false, false),
  ('aura.flame', 'aura', 2000, false, false),
  ('aura.frost', 'aura', 2000, false, false),
  ('aura.nature', 'aura', 600, false, false),
  ('aura.nether', 'aura', 15000, false, false),
  ('aura.ocean', 'aura', 15000, false, false),
  ('aura.sculk', 'aura', null, false, false),
  ('aura.shadow', 'aura', null, false, false),
  ('aura.solar', 'aura', null, false, false),
  ('aura.stone', 'aura', 600, false, false),
  ('blaze_core', 'powerup', 400, false, true),
  ('diamond_sword', 'powerup', 250, false, true),
  ('dice.amethyst', 'dice', 30000, false, false),
  ('dice.copper', 'dice', 1500, false, false),
  ('dice.diamond', 'dice', 30000, false, false),
  ('dice.dragon', 'dice', null, false, false),
  ('dice.emas', 'dice', 9000, false, false),
  ('dice.emerald', 'dice', 30000, false, false),
  ('dice.ender', 'dice', null, false, false),
  ('dice.frost', 'dice', null, false, false),
  ('dice.iron', 'dice', 1500, false, false),
  ('dice.klasik', 'dice', null, true, false),
  ('dice.lapis', 'dice', 9000, false, false),
  ('dice.magma', 'dice', null, false, false),
  ('dice.netherite', 'dice', null, false, false),
  ('dice.obsidian', 'dice', 30000, false, false),
  ('dice.prismarine', 'dice', null, false, false),
  ('dice.quartz', 'dice', null, false, false),
  ('dice.redstone', 'dice', 30000, false, false),
  ('dice.rumput', 'dice', 500, false, false),
  ('dice.sculk', 'dice', null, false, false),
  ('dice.stone', 'dice', 500, false, false),
  ('dice.tnt', 'dice', 1500, false, false),
  ('dice.void', 'dice', null, false, false),
  ('dice.wood', 'dice', 500, false, false),
  ('dragon_crystal', 'powerup', 800, false, true),
  ('feather', 'powerup', 80, false, true),
  ('fire_charge', 'powerup', 120, false, true),
  ('frame.amethyst', 'frame', 12000, false, false),
  ('frame.celestial', 'frame', null, false, false),
  ('frame.copper', 'frame', 1500, false, false),
  ('frame.cosmic', 'frame', null, false, false),
  ('frame.default', 'frame', null, true, false),
  ('frame.diamond', 'frame', 9000, false, false),
  ('frame.dragon', 'frame', null, false, false),
  ('frame.ender', 'frame', null, false, false),
  ('frame.gold', 'frame', 6000, false, false),
  ('frame.iron', 'frame', 2500, false, false),
  ('frame.nether', 'frame', 20000, false, false),
  ('frame.phoenix', 'frame', null, false, false),
  ('frame.stone', 'frame', 500, false, false),
  ('frame.storm', 'frame', null, false, false),
  ('gear.acc.beard', 'gear', 100, false, false),
  ('gear.acc.belt', 'gear', 80, false, false),
  ('gear.acc.bow', 'gear', 80, false, false),
  ('gear.acc.earrings', 'gear', 150, false, false),
  ('gear.acc.glasses', 'gear', 120, false, false),
  ('gear.acc.gloves', 'gear', 100, false, false),
  ('gear.acc.goggles', 'gear', 200, false, false),
  ('gear.acc.mustache', 'gear', 80, false, false),
  ('gear.acc.necklace', 'gear', 200, false, false),
  ('gear.acc.pack', 'gear', 150, false, false),
  ('gear.acc.purse', 'gear', 150, false, false),
  ('gear.acc.scarf', 'gear', 100, false, false),
  ('gear.boots.cloth', 'gear', 60, false, false),
  ('gear.boots.flat', 'gear', 80, false, false),
  ('gear.boots.knee', 'gear', 150, false, false),
  ('gear.boots.mary', 'gear', null, true, false),
  ('gear.boots.none', 'gear', null, true, false),
  ('gear.boots.sandal', 'gear', 60, false, false),
  ('gear.boots.shoes', 'gear', null, true, false),
  ('gear.boots.tall', 'gear', 120, false, false),
  ('gear.cape.long', 'gear', 400, false, false),
  ('gear.cape.short', 'gear', 250, false, false),
  ('gear.cape.wings', 'gear', 900, false, false),
  ('gear.chest.bodice', 'gear', 300, false, false),
  ('gear.chest.leather', 'gear', 350, false, false),
  ('gear.chest.plate', 'gear', 700, false, false),
  ('gear.chest.valk', 'gear', 800, false, false),
  ('gear.helm.beret', 'gear', 150, false, false),
  ('gear.helm.crown', 'gear', 900, false, false),
  ('gear.helm.flowers', 'gear', 250, false, false),
  ('gear.helm.knight', 'gear', 400, false, false),
  ('gear.helm.ribbon', 'gear', 150, false, false),
  ('gear.helm.straw', 'gear', 120, false, false),
  ('gear.helm.tiara', 'gear', 600, false, false),
  ('gear.helm.wizard', 'gear', 300, false, false),
  ('gear.legs.bare', 'gear', null, true, false),
  ('gear.legs.formal', 'gear', 250, false, false),
  ('gear.legs.lskirt', 'gear', 150, false, false),
  ('gear.legs.pants', 'gear', null, true, false),
  ('gear.legs.shorts', 'gear', 80, false, false),
  ('gear.legs.skirt', 'gear', null, true, false),
  ('gear.legs.tights', 'gear', 100, false, false),
  ('gear.shoulder.gem', 'gear', 500, false, false),
  ('gear.shoulder.leather', 'gear', 200, false, false),
  ('gear.shoulder.pad', 'gear', 350, false, false),
  ('gear.shoulder.ruffle', 'gear', 250, false, false),
  ('gear.shoulder.spiked', 'gear', 450, false, false),
  ('gear.top.blouse', 'gear', null, true, false),
  ('gear.top.cardigan', 'gear', 200, false, false),
  ('gear.top.coat', 'gear', 400, false, false),
  ('gear.top.dress', 'gear', 300, false, false),
  ('gear.top.overall', 'gear', 150, false, false),
  ('gear.top.robe', 'gear', 350, false, false),
  ('gear.top.sundress', 'gear', 200, false, false),
  ('gear.top.tee', 'gear', null, true, false),
  ('gear.top.tunic', 'gear', 120, false, false),
  ('gear.top.vest', 'gear', 150, false, false),
  ('gear.weapon.axe', 'gear', 450, false, false),
  ('gear.weapon.parasol', 'gear', 200, false, false),
  ('gear.weapon.rapier', 'gear', 450, false, false),
  ('gear.weapon.staff', 'gear', 350, false, false),
  ('gear.weapon.sword', 'gear', 300, false, false),
  ('gear.weapon.wand', 'gear', 300, false, false),
  ('golden_apple', 'powerup', 200, false, true),
  ('grass', 'powerup', 100, false, true),
  ('ice_crystal', 'powerup', 250, false, true),
  ('nether_star', 'powerup', 1000, false, true),
  ('netherite_sword', 'powerup', 450, false, true),
  ('pet.arcane_owl', 'pet', 60000, false, false),
  ('pet.celestial_kitsune', 'pet', null, false, false),
  ('pet.copper_golem', 'pet', 9000, false, false),
  ('pet.crystal_axolotl', 'pet', 25000, false, false),
  ('pet.forest_pup', 'pet', 3000, false, false),
  ('pet.inferno_dragon', 'pet', null, false, false),
  ('pet.storm_wolf', 'pet', null, false, false),
  ('potion_even', 'powerup', 60, false, true),
  ('potion_odd', 'powerup', 60, false, true),
  ('skin.alex', 'skin', null, true, false),
  ('skin.creeper', 'skin', null, true, false),
  ('skin.ender', 'skin', 700, false, false),
  ('skin.skeleton', 'skin', 300, false, false),
  ('skin.steve', 'skin', null, true, false),
  ('skin.zombie', 'skin', null, true, false),
  ('sword', 'powerup', 120, false, true),
  ('theme.minecraft', 'theme', null, true, false),
  ('theme.nether', 'theme', null, false, false),
  ('tnt', 'powerup', 150, false, true),
  ('totem', 'powerup', 200, false, true),
  ('trident', 'powerup', 600, false, true),
  ('wooden_shield', 'powerup', 90, false, true)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;
-- END CATALOG SEED

-- ============ 2. Inventory + beli ============
create table if not exists public.player_inventory (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.item_catalog(id),
  qty         integer not null default 1 check (qty >= 1),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.player_inventory enable row level security;
revoke all on public.player_inventory from anon, authenticated;

-- Dapat dibeli bila harga > 0 dan bukan item starter (sama dengan PlayerData.purchase di klien).
create or replace function public.buy_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_it   public.item_catalog;
  v_res  jsonb;
  v_have int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_it from public.item_catalog where id = p_item_id;
  if not found or v_it.starter or v_it.price_coins is null then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- serialisasi: tidak ada beli ganda/balapan

  select qty into v_have from public.player_inventory where user_id = v_uid and item_id = p_item_id;
  if v_have is not null and not v_it.stackable then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  begin
    v_res := public._wallet_apply(v_uid, -v_it.price_coins, 0, 'buy',
               case when v_it.stackable then p_item_id || '#' || (coalesce(v_have, 0) + 1) else p_item_id end);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then
      return jsonb_build_object('ok', false, 'reason', 'saldo-kurang',
        'kurang', v_it.price_coins - (select coins from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  insert into public.player_inventory(user_id, item_id) values (v_uid, p_item_id)
    on conflict (user_id, item_id) do update set qty = public.player_inventory.qty + 1;
  return jsonb_build_object('ok', true, 'item', p_item_id, 'spent', v_it.price_coins,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;

create or replace function public.inventory_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', item_id, 'qty', qty, 'at', acquired_at) order by acquired_at, item_id)
                   from public.player_inventory where user_id = v_uid), '[]'::jsonb);
end;
$$;
revoke all on function public.inventory_get() from public, anon;
grant execute on function public.inventory_get() to authenticated;

-- ============ 3. Hadiah boss ke pemenang ============
create or replace function public.claim_boss_reward(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_coins constant bigint := 500;   -- = Config.DRAGON_REWARD di klien
  c_gems  constant bigint := 10;
  c_daily constant int    := 10;    -- batas hadiah boss per akun per hari (UTC); menahan farming lewat room palsu
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
  v_widx := case when (v_room.game_state -> 'snapshot' ->> 'winnerIndex') ~ '^[0-9]+$'
                 then (v_room.game_state -> 'snapshot' ->> 'winnerIndex')::int end;
  v_winner := case when v_widx is not null then v_room.game_state -> 'snapshot' -> 'players' -> v_widx ->> 'networkId' end;
  if v_winner is null then return jsonb_build_object('ok', false, 'reason', 'no_result'); end if;
  if v_winner <> v_uid::text then return jsonb_build_object('ok', false, 'reason', 'not_winner'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) into v_n from public.wallet_ledger
    where user_id = v_uid and reason = 'boss' and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if v_n >= c_daily then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;

  v_res := public._wallet_apply(v_uid, c_coins, c_gems, 'boss', p_room_id::text);
  return v_res || jsonb_build_object('reward_coins', c_coins, 'reward_gems', c_gems);
end;
$$;
revoke all on function public.claim_boss_reward(uuid) from public, anon;
grant execute on function public.claim_boss_reward(uuid) to authenticated;

-- ============ 4. claim_achievement -> dompet server ============
-- Sama dengan versi 202611090001 + reward dikreditkan ke dompet server (ref per jumlah bintang yang diklaim).
create or replace function public.claim_achievement(p_id text, p_client_value bigint default null)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_def   public.achievement_defs;
  v_s     public.player_stats;
  v_val   bigint;
  v_stars int;
  v_cl    int;
  v_coins int := 0;
  v_gems  int := 0;
  v_w     jsonb;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_def from public.achievement_defs where id = p_id;
  if not found then raise exception 'BAD_ACHIEVEMENT'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid;

  v_val := case when v_def.source = 'client'
                then least(greatest(coalesce(p_client_value, 0), 0), v_def.tiers[3])
                else public.player_stat_value(v_s, v_def.stat) end;
  select count(*) into v_stars from unnest(v_def.tiers) t where v_val >= t;

  insert into public.player_achievement_claims(user_id, achievement_id) values (v_uid, p_id)
    on conflict do nothing;
  select claimed into v_cl from public.player_achievement_claims
    where user_id = v_uid and achievement_id = p_id for update;

  if v_cl >= v_stars then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_claim', 'stars', v_stars, 'claimed', v_cl);
  end if;

  for i in (v_cl + 1)..v_stars loop
    v_coins := v_coins + v_def.reward_coins[i];
    v_gems  := v_gems  + v_def.reward_gems[i];
  end loop;

  update public.player_achievement_claims set claimed = v_stars, updated_at = now()
    where user_id = v_uid and achievement_id = p_id;

  perform public._wallet_ensure(v_uid);
  v_w := public._wallet_apply(v_uid, v_coins, v_gems, 'achievement', p_id || ':' || v_cl || '-' || v_stars);

  return jsonb_build_object('ok', true, 'stars', v_stars, 'claimed', v_stars, 'coins', v_coins, 'gems', v_gems,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.claim_achievement(text, bigint) from public, anon;
grant execute on function public.claim_achievement(text, bigint) to authenticated;
