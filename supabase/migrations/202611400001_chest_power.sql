-- Chest bisa memberi POWER (masuk stok akun, player_inventory.qty +1, maks 999) + hadiah Diamond dibesarkan.
--   * Peluang Power per chest: Kayu 5% | Perak 12% | Emas 20% | Diamond 35%. Jenis Power diundi dari item_catalog (kind 'powerup') dengan
--     bobot ~ 1/harga: Power murah lebih sering, Power mahal (Nether Star dst.) langka. Rata-rata nilai ~146 koin.
--   * Hadiah Diamond: 1000-1400 koin + 3 gem + 200 XP (sebelumnya 800-1200 koin + 2 gem + 150 XP). Hadiah lain tidak berubah.
--   * Respons chest_collect / chest_buy menambah 'power' (id item atau null). Mendefinisi ulang _chest_roll, chest_collect, chest_buy.

create or replace function public._chest_roll(p_kind text) returns jsonb
language plpgsql volatile as $$
declare v_c int; v_g int := 0; v_x int; v_pc numeric; v_pw text;
begin
  if p_kind = 'wood' then
    v_c := 50 + floor(random() * 51)::int;  v_x := 10; v_pc := 0.05;
  elsif p_kind = 'silver' then
    v_c := 150 + floor(random() * 101)::int; v_x := 25; v_pc := 0.12;
    if random() < 0.10 then v_g := 1; end if;
  elsif p_kind = 'gold' then
    v_c := 350 + floor(random() * 151)::int; v_x := 60; v_g := 1; v_pc := 0.20;
  elsif p_kind = 'diamond' then
    v_c := 1000 + floor(random() * 401)::int; v_x := 200; v_g := 3; v_pc := 0.35;
  else
    raise exception 'BAD_CHEST_KIND';
  end if;
  if random() < v_pc then   -- undian berbobot 1/harga (perlombaan eksponensial: kunci = -ln(u) * harga, terkecil menang)
    select id into v_pw from public.item_catalog
     where kind = 'powerup' and price_coins is not null
     order by (-ln(1 - random())) * price_coins limit 1;
  end if;
  return jsonb_build_object('coins', v_c, 'gems', v_g, 'xp', v_x, 'power', v_pw);
end;
$$;
revoke all on function public._chest_roll(text) from public, anon, authenticated;

create or replace function public.chest_collect(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.player_chest; v_rw jsonb; v_w jsonb; v_xp int; v_pw text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into v_c from public.player_chest where id = p_id and user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_c.status = 'collected' then return jsonb_build_object('ok', false, 'reason', 'sudah-diambil'); end if;
  if v_c.status <> 'opening' then return jsonb_build_object('ok', false, 'reason', 'belum-dibuka'); end if;
  if v_c.open_ready_at > now() then return jsonb_build_object('ok', false, 'reason', 'belum-siap'); end if;

  v_rw := public._chest_roll(v_c.kind);
  v_xp := (v_rw ->> 'xp')::int;
  v_w := public._wallet_apply(v_uid, (v_rw ->> 'coins')::bigint, (v_rw ->> 'gems')::bigint, 'chest', 'collect:' || p_id);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-diambil'); end if;

  v_pw := v_rw ->> 'power';
  if v_pw is not null then   -- Power hadiah masuk stok akun (maks 999 per jenis)
    insert into public.player_inventory(user_id, item_id, qty) values (v_uid, v_pw, 1)
      on conflict (user_id, item_id) do update set qty = least(999, public.player_inventory.qty + 1);
  end if;

  update public.player_chest set status = 'collected', collected_at = now() where id = p_id;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats
     set chests = chests + 1, xp = xp + v_xp, level = public.level_from_xp(xp + v_xp), updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'id', p_id, 'kind', v_c.kind,
           'coins', (v_rw ->> 'coins')::int, 'gems', (v_rw ->> 'gems')::int, 'xp', v_xp, 'power', v_pw,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_collect(bigint) from public, anon;
grant execute on function public.chest_collect(bigint) to authenticated;

create or replace function public.chest_buy(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_p record; v_wal public.player_wallet; v_id bigint; v_rw jsonb; v_xp int; v_w jsonb; v_pw text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_p from public._chest_shop() where kind = p_kind;
  if not found then raise exception 'BAD_CHEST_KIND'; end if;
  perform public._wallet_ensure(v_uid);
  select * into v_wal from public.player_wallet where user_id = v_uid for update;

  if v_wal.coins < v_p.coins then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if;
  if v_wal.gems  < v_p.gems  then return jsonb_build_object('ok', false, 'reason', 'gem-kurang'); end if;

  insert into public.player_chest(user_id, kind, source, status, collected_at)
    values (v_uid, p_kind, 'shop', 'collected', now()) returning id into v_id;

  v_rw := public._chest_roll(p_kind);
  v_xp := (v_rw ->> 'xp')::int;
  perform public._wallet_apply(v_uid, -v_p.coins, -v_p.gems, 'chest_buy', 'buy:' || v_id);
  v_w := public._wallet_apply(v_uid, (v_rw ->> 'coins')::bigint, (v_rw ->> 'gems')::bigint, 'chest', 'collect:' || v_id);

  v_pw := v_rw ->> 'power';
  if v_pw is not null then   -- Power hadiah masuk stok akun (maks 999 per jenis)
    insert into public.player_inventory(user_id, item_id, qty) values (v_uid, v_pw, 1)
      on conflict (user_id, item_id) do update set qty = least(999, public.player_inventory.qty + 1);
  end if;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats
     set chests = chests + 1, xp = xp + v_xp, level = public.level_from_xp(xp + v_xp), updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', v_id, 'price_coins', v_p.coins, 'price_gems', v_p.gems,
           'coins', (v_rw ->> 'coins')::int, 'gems', (v_rw ->> 'gems')::int, 'xp', v_xp, 'power', v_pw,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.chest_buy(text) from public, anon;
grant execute on function public.chest_buy(text) to authenticated;
