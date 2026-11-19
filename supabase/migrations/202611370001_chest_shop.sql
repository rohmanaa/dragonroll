-- Chest di SHOP aktif: beli chest (Kayu/Perak/Emas/Diamond) -> masuk penyimpanan chest (maks 10), dibuka lewat page Chest
-- (timer + percepat gem, hadiah diundi server saat diambil) -- sama persis dengan chest harian.
--   * Harga ada di _chest_shop() (HANYA di sini; klien hanya menampilkan). Kayu 90 koin | Perak 250 koin | Emas 600 koin | Diamond 25 gem.
--     Rata-rata hadiah sengaja di bawah harga (sink koin/gem): Kayu ~75 koin, Perak ~205 koin-setara, Emas ~475 koin-setara, Diamond ~1100 koin-setara (2 gem + 800-1200 koin).
--   * Jenis baru 'diamond': waktu buka 8 jam. Waktu buka semua jenis ada di _chest_open_secs() (chest harian tetap hanya wood/silver/gold di _chest_defs()).
--   * Pembayaran idempoten lewat dompet (reason 'chest_buy', kunci 'buy:<id chest>'); saldo/penuh dicek SEBELUM chest dibuat.
-- Mendefinisi ulang _chest_roll, _chest_json, chest_start dari 202611330001 (isi sama + dukungan 'diamond').

alter table public.player_chest drop constraint if exists player_chest_kind_check;
alter table public.player_chest add constraint player_chest_kind_check check (kind in ('wood', 'silver', 'gold', 'diamond'));

create or replace function public._chest_open_secs(p_kind text) returns int
language sql immutable as $$
  select case p_kind when 'wood' then 600 when 'silver' then 3600 when 'gold' then 14400 when 'diamond' then 28800 else 3600 end
$$;
revoke all on function public._chest_open_secs(text) from public, anon, authenticated;

create or replace function public._chest_shop() returns table(kind text, coins int, gems int)
language sql immutable as $$
  select * from (values
    ('wood',     90,  0),
    ('silver',  250,  0),
    ('gold',    600,  0),
    ('diamond',   0, 25)
  ) v(kind, coins, gems)
$$;
revoke all on function public._chest_shop() from public, anon, authenticated;

-- Undi hadiah. Kayu 50-100 koin | Silver 150-250 koin, 10% +1 gem | Gold 350-500 koin + 1 gem | Diamond 800-1200 koin + 2 gem. XP 10/25/60/150.
create or replace function public._chest_roll(p_kind text) returns jsonb
language plpgsql volatile as $$
declare v_c int; v_g int := 0; v_x int;
begin
  if p_kind = 'wood' then
    v_c := 50 + floor(random() * 51)::int;  v_x := 10;
  elsif p_kind = 'silver' then
    v_c := 150 + floor(random() * 101)::int; v_x := 25;
    if random() < 0.10 then v_g := 1; end if;
  elsif p_kind = 'gold' then
    v_c := 350 + floor(random() * 151)::int; v_x := 60; v_g := 1;
  elsif p_kind = 'diamond' then
    v_c := 800 + floor(random() * 401)::int; v_x := 150; v_g := 2;
  else
    raise exception 'BAD_CHEST_KIND';
  end if;
  return jsonb_build_object('coins', v_c, 'gems', v_g, 'xp', v_x);
end;
$$;
revoke all on function public._chest_roll(text) from public, anon, authenticated;

create or replace function public._chest_json(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_d public.player_chest_daily; v_plays int := public._chest_plays_today(p_user);
  v_daily jsonb; v_list jsonb; v_cnt int; v_open int;
begin
  select * into v_d from public.player_chest_daily where user_id = p_user;

  select jsonb_agg(jsonb_build_object(
           'kind', d.kind, 'need', d.need_plays, 'progress', least(d.need_plays, v_plays),
           'status', case when d.kind = any(coalesce(v_d.claimed, '{}')) then 'claimed'
                          when v_plays >= d.need_plays then 'ready' else 'todo' end) order by d.ord)
    into v_daily from public._chest_defs() d;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'kind', c.kind,
           'status', case when c.status = 'opening' and c.open_ready_at <= now() then 'ready' else c.status end,
           'open_secs', public._chest_open_secs(c.kind),
           'seconds_left', case when c.status = 'opening' then greatest(0, ceil(extract(epoch from (c.open_ready_at - now())))::int) else public._chest_open_secs(c.kind) end,
           'skip_cost', case when c.status = 'opening'
                             then public._chest_skip_cost(greatest(0, ceil(extract(epoch from (c.open_ready_at - now())))::int)) else 0 end
         ) order by c.id), '[]'::jsonb)
    into v_list
    from public.player_chest c
   where c.user_id = p_user and c.status <> 'collected';

  select count(*)::int, count(*) filter (where status = 'opening')::int
    into v_cnt, v_open from public.player_chest where user_id = p_user and status <> 'collected';

  return jsonb_build_object('day', coalesce(v_d.day, public._wib_today()), 'seconds_to_reset', public._secs_to_wib_reset(),
    'plays_today', v_plays, 'daily', v_daily,
    'all_claimed', coalesce((select bool_and(d.kind = any(coalesce(v_d.claimed, '{}'))) from public._chest_defs() d), false),
    'max_storage', 10, 'max_open', 3, 'count', v_cnt, 'opening', v_open, 'chests', v_list);
end;
$$;
revoke all on function public._chest_json(uuid) from public, anon, authenticated;

create or replace function public.chest_start(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.player_chest; v_open int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into v_c from public.player_chest where id = p_id and user_id = v_uid for update;
  if not found or v_c.status = 'collected' then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_c.status = 'opening' then return jsonb_build_object('ok', false, 'reason', 'sudah-dibuka'); end if;
  select count(*)::int into v_open from public.player_chest where user_id = v_uid and status = 'opening';
  if v_open >= 3 then return jsonb_build_object('ok', false, 'reason', 'slot-penuh'); end if;

  update public.player_chest
     set status = 'opening', open_started_at = now(), open_ready_at = now() + make_interval(secs => public._chest_open_secs(v_c.kind))
   where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_start(bigint) from public, anon;
grant execute on function public.chest_start(bigint) to authenticated;

-- ============ Beli chest di shop ============
create or replace function public.chest_buy(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p record; v_wal public.player_wallet; v_cnt int; v_id bigint; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_p from public._chest_shop() where kind = p_kind;
  if not found then raise exception 'BAD_CHEST_KIND'; end if;
  perform public._wallet_ensure(v_uid);
  select * into v_wal from public.player_wallet where user_id = v_uid for update;

  select count(*)::int into v_cnt from public.player_chest where user_id = v_uid and status <> 'collected';
  if v_cnt >= 10 then return jsonb_build_object('ok', false, 'reason', 'penuh'); end if;
  if v_wal.coins < v_p.coins then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if;
  if v_wal.gems  < v_p.gems  then return jsonb_build_object('ok', false, 'reason', 'gem-kurang'); end if;

  insert into public.player_chest(user_id, kind, source) values (v_uid, p_kind, 'shop') returning id into v_id;
  v_w := public._wallet_apply(v_uid, -v_p.coins, -v_p.gems, 'chest_buy', 'buy:' || v_id);
  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', v_id, 'price_coins', v_p.coins, 'price_gems', v_p.gems,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_buy(text) from public, anon;
grant execute on function public.chest_buy(text) to authenticated;
