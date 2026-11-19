-- Sistem Chest harian. Idempotent (create or replace / if not exists).
--   1. Chest harian: Kayu (main 1 game), Silver (3 game), Gold (10 game); tiap jenis maksimal 1x per hari WIB.
--      Jumlah game hari ini dihitung SERVER dari player_match_history (hari WIB) -> klien tidak melaporkan apa pun.
--   2. Penyimpanan: maksimal 10 chest. Maksimal 3 chest diproses (timer) bersamaan; sisanya antre di penyimpanan.
--   3. Membuka chest butuh waktu tunggu (Kayu 10 mnt, Silver 1 jam, Gold 4 jam). Boleh dipercepat dengan gem
--      (biaya = 1 gem per 30 menit tersisa, minimal 1).
--   4. Hadiah (koin/gem/XP) diundi di server saat chest diambil. Kunci idempoten dompet = 'chest' + id chest.
--   5. Setiap chest yang diambil menambah player_stats.chests (misi harian "Buka Peti" + achievement Peti).
-- Nominal dan waktu HANYA di _chest_defs / _chest_roll / _chest_skip_cost di bawah. Power belum jadi hadiah (tahap lanjut).

-- ============ 1. Tabel ============
create table if not exists public.player_chest_daily (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  day        date not null,
  claimed    text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.player_chest_daily enable row level security;
revoke all on public.player_chest_daily from anon, authenticated;

create table if not exists public.player_chest (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('wood', 'silver', 'gold')),
  source          text not null default 'daily',
  status          text not null default 'stored' check (status in ('stored', 'opening', 'collected')),
  created_at      timestamptz not null default now(),
  open_started_at timestamptz,
  open_ready_at   timestamptz,
  collected_at    timestamptz
);
create index if not exists player_chest_user_idx on public.player_chest (user_id, status);
alter table public.player_chest enable row level security;
revoke all on public.player_chest from anon, authenticated;
revoke all on sequence public.player_chest_id_seq from anon, authenticated;

-- ============ 2. Definisi (urutan tampil) ============
create or replace function public._chest_defs() returns table(ord int, kind text, need_plays int, open_secs int)
language sql immutable as $$
  select * from (values
    (1, 'wood',   1,   600),
    (2, 'silver', 3,  3600),
    (3, 'gold',  10, 14400)
  ) v(ord, kind, need_plays, open_secs)
$$;
revoke all on function public._chest_defs() from public, anon, authenticated;

-- Biaya gem untuk melewati sisa waktu: 1 gem per 30 menit (dibulatkan ke atas), minimal 1.
create or replace function public._chest_skip_cost(p_secs int) returns int
language sql immutable as $$
  select case when coalesce(p_secs, 0) <= 0 then 0 else greatest(1, ceil(p_secs / 1800.0)::int) end
$$;
revoke all on function public._chest_skip_cost(int) from public, anon, authenticated;

-- Undi hadiah. Kayu 50-100 koin | Silver 150-250 koin, 10% +1 gem | Gold 350-500 koin + 1 gem. XP 10/25/60.
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
  else
    raise exception 'BAD_CHEST_KIND';
  end if;
  return jsonb_build_object('coins', v_c, 'gems', v_g, 'xp', v_x);
end;
$$;
revoke all on function public._chest_roll(text) from public, anon, authenticated;

-- ============ 3. Helper ============
-- Jumlah game yang tercatat hari ini (WIB).
create or replace function public._chest_plays_today(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.player_match_history h
   where h.user_id = p_user
     and h.created_at >= (public._wib_today()::timestamp at time zone 'Asia/Jakarta')
$$;
revoke all on function public._chest_plays_today(uuid) from public, anon, authenticated;

-- Pastikan baris harian ada dan reset klaim bila hari WIB berganti; kunci baris.
create or replace function public._chest_roll_day(p_user uuid) returns public.player_chest_daily
language plpgsql security definer set search_path = public as $$
declare v_d public.player_chest_daily; v_today date := public._wib_today();
begin
  insert into public.player_chest_daily(user_id, day) values (p_user, v_today) on conflict (user_id) do nothing;
  update public.player_chest_daily set day = v_today, claimed = '{}', updated_at = now()
   where user_id = p_user and day <> v_today;
  select * into v_d from public.player_chest_daily where user_id = p_user for update;
  return v_d;
end;
$$;
revoke all on function public._chest_roll_day(uuid) from public, anon, authenticated;

-- Status lengkap untuk klien (read-only; baris harian sudah di-roll oleh pemanggil).
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
           'open_secs', d.open_secs,
           'seconds_left', case when c.status = 'opening' then greatest(0, ceil(extract(epoch from (c.open_ready_at - now())))::int) else d.open_secs end,
           'skip_cost', case when c.status = 'opening'
                             then public._chest_skip_cost(greatest(0, ceil(extract(epoch from (c.open_ready_at - now())))::int)) else 0 end
         ) order by c.id), '[]'::jsonb)
    into v_list
    from public.player_chest c join public._chest_defs() d on d.kind = c.kind
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

-- ============ 4. RPC untuk klien ============
create or replace function public.chest_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  perform public._chest_roll_day(v_uid);
  return jsonb_build_object('ok', true) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_get() from public, anon;
grant execute on function public.chest_get() to authenticated;

-- Klaim chest harian -> masuk penyimpanan.
create or replace function public.chest_claim_daily(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_d public.player_chest_daily; v_def record; v_cnt int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_def from public._chest_defs() where kind = p_kind;
  if not found then raise exception 'BAD_CHEST_KIND'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_d := public._chest_roll_day(v_uid);

  if p_kind = any(v_d.claimed) then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  if public._chest_plays_today(v_uid) < v_def.need_plays then return jsonb_build_object('ok', false, 'reason', 'belum-selesai'); end if;
  select count(*)::int into v_cnt from public.player_chest where user_id = v_uid and status <> 'collected';
  if v_cnt >= 10 then return jsonb_build_object('ok', false, 'reason', 'penuh'); end if;

  insert into public.player_chest(user_id, kind, source) values (v_uid, p_kind, 'daily');
  update public.player_chest_daily set claimed = array_append(claimed, p_kind), updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'kind', p_kind) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_claim_daily(text) from public, anon;
grant execute on function public.chest_claim_daily(text) to authenticated;

-- Mulai membuka chest (timer jalan). Maksimal 3 chest diproses bersamaan.
create or replace function public.chest_start(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.player_chest; v_def record; v_open int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into v_c from public.player_chest where id = p_id and user_id = v_uid for update;
  if not found or v_c.status = 'collected' then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_c.status = 'opening' then return jsonb_build_object('ok', false, 'reason', 'sudah-dibuka'); end if;
  select count(*)::int into v_open from public.player_chest where user_id = v_uid and status = 'opening';
  if v_open >= 3 then return jsonb_build_object('ok', false, 'reason', 'slot-penuh'); end if;

  select * into v_def from public._chest_defs() where kind = v_c.kind;
  update public.player_chest
     set status = 'opening', open_started_at = now(), open_ready_at = now() + make_interval(secs => v_def.open_secs)
   where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_start(bigint) from public, anon;
grant execute on function public.chest_start(bigint) to authenticated;

-- Percepat sisa waktu dengan gem.
create or replace function public.chest_open_now(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.player_chest; v_secs int; v_cost int; v_w jsonb; v_gems bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into v_c from public.player_chest where id = p_id and user_id = v_uid for update;
  if not found or v_c.status = 'collected' then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_c.status <> 'opening' then return jsonb_build_object('ok', false, 'reason', 'belum-dibuka'); end if;

  v_secs := greatest(0, ceil(extract(epoch from (v_c.open_ready_at - now())))::int);
  if v_secs = 0 then return jsonb_build_object('ok', true, 'cost', 0) || public._chest_json(v_uid); end if;
  v_cost := public._chest_skip_cost(v_secs);

  select gems into v_gems from public.player_wallet where user_id = v_uid;
  if v_gems < v_cost then return jsonb_build_object('ok', false, 'reason', 'gem-kurang', 'cost', v_cost); end if;

  v_w := public._wallet_apply(v_uid, 0, -v_cost, 'chest_skip', 'skip:' || p_id);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-dibayar'); end if;
  update public.player_chest set open_ready_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'cost', v_cost,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_open_now(bigint) from public, anon;
grant execute on function public.chest_open_now(bigint) to authenticated;

-- Ambil hadiah chest yang timernya sudah selesai. Hadiah diundi di sini.
create or replace function public.chest_collect(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.player_chest; v_rw jsonb; v_w jsonb; v_xp int;
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

  update public.player_chest set status = 'collected', collected_at = now() where id = p_id;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats
     set chests = chests + 1, xp = xp + v_xp, level = public.level_from_xp(xp + v_xp), updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'id', p_id, 'kind', v_c.kind,
           'coins', (v_rw ->> 'coins')::int, 'gems', (v_rw ->> 'gems')::int, 'xp', v_xp,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_collect(bigint) from public, anon;
grant execute on function public.chest_collect(bigint) to authenticated;
