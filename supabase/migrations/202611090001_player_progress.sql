-- Progres pemain nyata untuk halaman Profil (menggantikan angka mockup di profile.html).
-- Terapkan SETELAH 202611080001_player_stats.sql.
--
-- Isi:
--   1. Kolom counter baru di player_stats (peti, naga, tangga, ular, skill, dadu, login, dst).
--   2. player_match_history  -> modal "Riwayat".
--   3. achievement_defs + player_achievement_claims -> achievement & klaim reward anti-dobel.
--   4. submit_match_result v2 (kompatibel: parameter baru punya default).
--   5. bump_player_counter, record_daily_login, get_my_profile, get_match_history, claim_achievement.
--
-- Model kepercayaan sama dengan migrasi sebelumnya: klien melaporkan, server membatasi (clamp per match,
-- idempoten per match_id, 1 match / 45 detik). BUKAN anti-cheat; jangan pakai untuk hadiah bernilai uang.
-- Dompet (coins/gems) masih lokal di PlayerData; server hanya mencatat klaim agar tidak bisa diklaim dua kali.

-- ============ 1. Counter baru ============
alter table public.player_stats
  add column if not exists chests            int  not null default 0 check (chests >= 0),
  add column if not exists dragon_hits       int  not null default 0 check (dragon_hits >= 0),
  add column if not exists ladders           int  not null default 0 check (ladders >= 0),
  add column if not exists snakes            int  not null default 0 check (snakes >= 0),
  add column if not exists skills_used       int  not null default 0 check (skills_used >= 0),
  add column if not exists dice_rolls        int  not null default 0 check (dice_rolls >= 0),
  add column if not exists login_days        int  not null default 0 check (login_days >= 0),
  add column if not exists login_streak      int  not null default 0 check (login_streak >= 0),
  add column if not exists best_login_streak int  not null default 0 check (best_login_streak >= 0),
  add column if not exists last_login_date   date,
  add column if not exists skill_wins        text[] not null default '{}',   -- skill berbeda yang pernah dipakai saat menang
  add column if not exists missions_done     int  not null default 0 check (missions_done >= 0),
  add column if not exists events_joined     int  not null default 0 check (events_joined >= 0);

-- ============ 2. Riwayat match ============
create table if not exists public.player_match_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  match_id   text not null check (char_length(match_id) between 1 and 80),
  won        boolean not null,
  mode       text not null default 'cpu' check (mode in ('cpu', 'online')),
  players    int,
  xp_gain    int not null default 0,
  points     int not null default 0,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index if not exists player_match_history_user_idx
  on public.player_match_history (user_id, created_at desc);
alter table public.player_match_history enable row level security;
revoke all on public.player_match_history from anon, authenticated;

-- ============ 3. Achievement ============
create table if not exists public.achievement_defs (
  id           text primary key,
  source       text not null check (source in ('server', 'client')),  -- client = nilai dari dompet/inventori lokal
  stat         text not null,
  tiers        int[] not null check (cardinality(tiers) = 3),
  reward_coins int[] not null default '{250,750,2000}' check (cardinality(reward_coins) = 3),
  reward_gems  int[] not null default '{5,10,25}'      check (cardinality(reward_gems) = 3),
  sort         int not null default 0
);
-- Sama persis dengan ACH di profile.html.
insert into public.achievement_defs (id, source, stat, tiers, sort) values
  ('peti',     'server', 'chests',            '{10,50,200}',     1),
  ('naga',     'server', 'dragon_hits',       '{3,10,30}',       2),
  ('aktif',    'server', 'plays',             '{10,50,200}',     3),
  ('menang',   'server', 'wins',              '{3,50,200}',      4),
  ('tangga',   'server', 'ladders',           '{10,50,150}',     5),
  ('ular',     'server', 'snakes',            '{10,50,150}',     6),
  ('skill',    'server', 'skills_used',       '{10,50,200}',     7),
  ('dadu',     'server', 'dice_rolls',        '{50,250,1000}',   8),
  ('papan',    'server', 'plays',             '{5,50,200}',      9),
  ('login',    'server', 'best_login_streak', '{3,7,30}',       10),
  ('streak',   'server', 'best_streak',       '{2,5,10}',       11),
  ('skin',     'client', 'skins',             '{2,10,25}',      12),
  ('emerald',  'client', 'emerald',           '{10,100,500}',   13),
  ('strategi', 'server', 'skill_wins',        '{2,5,10}',       14),
  ('legenda',  'server', 'wins',              '{500,1000,2000}', 15)
on conflict (id) do update
  set source = excluded.source, stat = excluded.stat, tiers = excluded.tiers, sort = excluded.sort;
alter table public.achievement_defs enable row level security;
revoke all on public.achievement_defs from anon, authenticated;
grant select on public.achievement_defs to authenticated;
drop policy if exists "read achievement defs" on public.achievement_defs;
create policy "read achievement defs" on public.achievement_defs for select to authenticated using (true);

create table if not exists public.player_achievement_claims (
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievement_defs(id) on delete cascade,
  claimed        int  not null default 0 check (claimed between 0 and 3),
  updated_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.player_achievement_claims enable row level security;
revoke all on public.player_achievement_claims from anon, authenticated;

-- ============ Helper ============
create or replace function public._clamp_json_int(j jsonb, k text, hi int)
returns int language plpgsql immutable as $$
begin
  return least(greatest(coalesce((j ->> k)::int, 0), 0), hi);
exception when others then
  return 0;
end;
$$;

create or replace function public.player_stat_value(s public.player_stats, p_stat text)
returns bigint language sql immutable as $$
  select case p_stat
    when 'chests'            then s.chests
    when 'dragon_hits'       then s.dragon_hits
    when 'plays'             then s.plays
    when 'wins'              then s.wins
    when 'ladders'           then s.ladders
    when 'snakes'            then s.snakes
    when 'skills_used'       then s.skills_used
    when 'dice_rolls'        then s.dice_rolls
    when 'best_login_streak' then s.best_login_streak
    when 'best_streak'       then s.best_streak
    when 'skill_wins'        then cardinality(s.skill_wins)
    else 0
  end::bigint;
$$;

-- ============ 4. submit_match_result v2 ============
-- p_stats contoh: {"dice":24,"ladders":3,"snakes":2,"skills":4,"dragon_hits":1,"skill_ids":["pedang","totem"]}
-- Tiap angka di-clamp per match. p_mode: 'cpu' | 'online' (default: online bila p_room_id ada).
drop function if exists public.submit_match_result(text, boolean, text, bigint, uuid);
create or replace function public.submit_match_result(
  p_match_id text,
  p_won boolean,
  p_name text,
  p_xp_total bigint default 0,
  p_room_id uuid default null,
  p_mode text default null,
  p_players int default null,
  p_stats jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_name  text := left(btrim(coalesce(p_name, '')), 24);
  v_wk    date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_rows  integer;
  v_s     public.player_stats;
  v_won   boolean := coalesce(p_won, false);
  v_pts   int := case when coalesce(p_won, false) then 100 else 10 end;
  v_xp    bigint;
  v_mode  text := case when p_mode in ('cpu', 'online') then p_mode
                       when p_room_id is not null then 'online' else 'cpu' end;
  v_dice  int := public._clamp_json_int(p_stats, 'dice', 300);
  v_lad   int := public._clamp_json_int(p_stats, 'ladders', 60);
  v_snk   int := public._clamp_json_int(p_stats, 'snakes', 60);
  v_skl   int := public._clamp_json_int(p_stats, 'skills', 100);
  v_drg   int := public._clamp_json_int(p_stats, 'dragon_hits', 100);
  v_ids   text[] := '{}';
  v_swins text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or char_length(p_match_id) not between 1 and 80 then raise exception 'BAD_MATCH_ID'; end if;
  if v_name = '' then v_name := 'Player'; end if;
  if p_room_id is not null and not public.is_game_room_member(p_room_id) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  insert into public.player_match_results(user_id, match_id) values (v_uid, p_match_id)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  insert into public.player_stats(user_id, name) values (v_uid, v_name) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  if v_s.last_match_at is not null and v_s.last_match_at > now() - interval '45 seconds' then
    return jsonb_build_object('ok', true, 'ignored', 'too_fast');
  end if;

  if v_s.week_key <> v_wk then v_s.week_key := v_wk; v_s.week_points := 0; end if;
  v_xp := greatest(v_s.xp, least(greatest(coalesce(p_xp_total, 0), 0), 1000000));

  -- skill unik yang dipakai saat MENANG (untuk achievement "Ahli Strategi")
  v_swins := v_s.skill_wins;
  if v_won and p_stats is not null and jsonb_typeof(p_stats -> 'skill_ids') = 'array' then
    select coalesce(array_agg(left(x, 30)), '{}') into v_ids
    from (select jsonb_array_elements_text(p_stats -> 'skill_ids') as x limit 8) q
    where btrim(x) <> '';
    select coalesce(array_agg(x order by x), '{}') into v_swins
    from (select distinct x from unnest(v_s.skill_wins || v_ids) as x limit 40) q;
  end if;

  update public.player_stats set
    name          = v_name,
    xp            = v_xp,
    level         = public.level_from_xp(v_xp),
    plays         = v_s.plays + 1,
    wins          = v_s.wins + (case when v_won then 1 else 0 end),
    streak        = case when v_won then v_s.streak + 1 else 0 end,
    best_streak   = greatest(v_s.best_streak, case when v_won then v_s.streak + 1 else 0 end),
    points        = v_s.points + v_pts,
    week_key      = v_s.week_key,
    week_points   = v_s.week_points + v_pts,
    dice_rolls    = v_s.dice_rolls + v_dice,
    ladders       = v_s.ladders + v_lad,
    snakes        = v_s.snakes + v_snk,
    skills_used   = v_s.skills_used + v_skl,
    dragon_hits   = v_s.dragon_hits + v_drg,
    skill_wins    = v_swins,
    last_match_at = now(),
    updated_at    = now()
  where user_id = v_uid;

  insert into public.player_match_history(user_id, match_id, won, mode, players, xp_gain, points, detail)
  values (v_uid, p_match_id, v_won, v_mode, case when p_players between 1 and 8 then p_players end,
          (v_xp - v_s.xp)::int, v_pts,
          jsonb_build_object('dice', v_dice, 'ladders', v_lad, 'snakes', v_snk, 'skills', v_skl, 'dragon_hits', v_drg))
  on conflict do nothing;

  -- simpan 50 riwayat terakhir saja
  delete from public.player_match_history h
  where h.user_id = v_uid
    and h.id not in (select id from public.player_match_history
                     where user_id = v_uid order by created_at desc, id desc limit 50);

  return jsonb_build_object('ok', true, 'duplicate', false, 'points', v_pts);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) to authenticated;

-- ============ 5a. Counter di luar match (peti, misi, event) ============
create or replace function public.bump_player_counter(p_kind text, p_amount int default 1)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_amt int := coalesce(p_amount, 1);
  v_val int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind not in ('chests', 'missions_done', 'events_joined') then raise exception 'BAD_KIND'; end if;
  if v_amt not between 1 and 20 then raise exception 'BAD_AMOUNT'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;

  update public.player_stats set
    chests        = chests        + case when p_kind = 'chests'        then v_amt else 0 end,
    missions_done = missions_done + case when p_kind = 'missions_done' then v_amt else 0 end,
    events_joined = events_joined + case when p_kind = 'events_joined' then v_amt else 0 end,
    updated_at    = now()
  where user_id = v_uid;

  select case p_kind when 'chests' then chests when 'missions_done' then missions_done else events_joined end
    into v_val from public.player_stats where user_id = v_uid;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'value', v_val);
end;
$$;
revoke all on function public.bump_player_counter(text, int) from public, anon;
grant execute on function public.bump_player_counter(text, int) to authenticated;

-- ============ 5b. Login harian (hari dihitung WIB) ============
create or replace function public.record_daily_login()
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_s     public.player_stats;
  v_new   int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  if v_s.last_login_date = v_today then
    return jsonb_build_object('ok', true, 'new_day', false, 'login_streak', v_s.login_streak,
                              'best_login_streak', v_s.best_login_streak, 'login_days', v_s.login_days);
  end if;

  v_new := case when v_s.last_login_date = v_today - 1 then v_s.login_streak + 1 else 1 end;
  update public.player_stats set
    login_streak      = v_new,
    best_login_streak = greatest(v_s.best_login_streak, v_new),
    login_days        = v_s.login_days + 1,
    last_login_date   = v_today,
    updated_at        = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true, 'new_day', true, 'login_streak', v_new,
                            'best_login_streak', greatest(v_s.best_login_streak, v_new),
                            'login_days', v_s.login_days + 1);
end;
$$;
revoke all on function public.record_daily_login() from public, anon;
grant execute on function public.record_daily_login() to authenticated;

-- ============ 5c. Semua data profil dalam 1 panggilan ============
create or replace function public.get_my_profile()
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_uid  uuid := auth.uid();
  v_s    public.player_stats;
  v_rank bigint;
  v_claims jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_s from public.player_stats where user_id = v_uid;
  if not found then
    return jsonb_build_object('exists', false);
  end if;

  if v_s.plays > 0 then
    select count(*) + 1 into v_rank
    from public.player_stats o
    where o.plays > 0
      and (o.points > v_s.points or (o.points = v_s.points and o.wins > v_s.wins));
  end if;

  select coalesce(jsonb_object_agg(achievement_id, claimed), '{}'::jsonb) into v_claims
  from public.player_achievement_claims where user_id = v_uid;

  return jsonb_build_object(
    'exists', true,
    'name', v_s.name, 'level', v_s.level, 'xp', v_s.xp,
    'plays', v_s.plays, 'wins', v_s.wins, 'losses', v_s.plays - v_s.wins,
    'win_rate', case when v_s.plays > 0 then floor(v_s.wins * 100.0 / v_s.plays) else 0 end,
    'streak', v_s.streak, 'best_streak', v_s.best_streak,
    'points', v_s.points, 'week_points', case when v_s.week_key = (date_trunc('week', now() at time zone 'utc'))::date then v_s.week_points else 0 end,
    'rank', v_rank,
    'counters', jsonb_build_object(
      'chests', v_s.chests, 'dragon_hits', v_s.dragon_hits, 'ladders', v_s.ladders,
      'snakes', v_s.snakes, 'skills_used', v_s.skills_used, 'dice_rolls', v_s.dice_rolls,
      'login_days', v_s.login_days, 'login_streak', v_s.login_streak, 'best_login_streak', v_s.best_login_streak,
      'skill_wins', cardinality(v_s.skill_wins), 'missions_done', v_s.missions_done, 'events_joined', v_s.events_joined),
    'claims', v_claims
  );
end;
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- ============ 5d. Riwayat ============
create or replace function public.get_match_history(p_limit int default 20)
returns table (match_id text, won boolean, mode text, players int, xp_gain int, points int, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select h.match_id, h.won, h.mode, h.players, h.xp_gain, h.points, h.created_at
  from public.player_match_history h
  where h.user_id = auth.uid()
  order by h.created_at desc, h.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.get_match_history(int) from public, anon;
grant execute on function public.get_match_history(int) to authenticated;

-- ============ 5e. Klaim achievement ============
-- Untuk source 'client' (skin, emerald) kirim nilai saat ini lewat p_client_value; server membatasi ke tier tertinggi.
-- Mengembalikan total reward; klien yang menambahkan ke dompet lokal (PD.addCurrency).
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

  return jsonb_build_object('ok', true, 'stars', v_stars, 'claimed', v_stars, 'coins', v_coins, 'gems', v_gems);
end;
$$;
revoke all on function public.claim_achievement(text, bigint) from public, anon;
grant execute on function public.claim_achievement(text, bigint) to authenticated;
