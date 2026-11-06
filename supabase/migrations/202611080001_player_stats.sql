-- Statistik pemain + leaderboard nyata (global / mingguan / teman).
-- Terapkan SETELAH 202611070003_friendships.sql (leaderboard teman membaca public.friendships)
-- dan 202611060001_game_events.sql (memakai public.is_game_room_member).
--
-- Model kepercayaan (prototipe): klien melaporkan "match selesai, menang/kalah". Server menghitung
-- poin sendiri dengan konstanta tetap, idempoten per match_id, dan membatasi 1 match per 45 detik.
-- Ini BUKAN anti-cheat: klien yang dimodifikasi tetap bisa mengirim hasil palsu (pelan-pelan).
-- Jangan pakai untuk hadiah bernilai uang.

create table if not exists public.player_stats (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  name          text   not null default 'Player' check (char_length(name) between 1 and 24),
  xp            bigint not null default 0 check (xp >= 0),
  level         int    not null default 1 check (level >= 1),
  plays         int    not null default 0 check (plays >= 0),
  wins          int    not null default 0 check (wins >= 0),
  streak        int    not null default 0 check (streak >= 0),
  best_streak   int    not null default 0 check (best_streak >= 0),
  points        bigint not null default 0 check (points >= 0),
  week_key      date   not null default (date_trunc('week', now() at time zone 'utc'))::date,
  week_points   bigint not null default 0 check (week_points >= 0),
  last_match_at timestamptz,
  updated_at    timestamptz not null default now()
);
create index if not exists player_stats_points_idx on public.player_stats (points desc);
create index if not exists player_stats_week_idx   on public.player_stats (week_key, week_points desc);

create table if not exists public.player_match_results (
  user_id    uuid not null references auth.users(id) on delete cascade,
  match_id   text not null check (char_length(match_id) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.player_stats enable row level security;
alter table public.player_match_results enable row level security;
revoke all on public.player_stats from anon, authenticated;
revoke all on public.player_match_results from anon, authenticated;
-- Tanpa policy & tanpa grant: tabel hanya dapat diakses lewat fungsi security definer di bawah.

-- Level dari total XP. HARUS sama dengan player-data.js: butuh 400 + 100*(L-1) XP untuk naik dari level L.
create or replace function public.level_from_xp(p_xp bigint)
returns int language plpgsql immutable as $$
declare v_level int := 1; v_left bigint := greatest(coalesce(p_xp, 0), 0);
begin
  while v_level < 999 and v_left >= 400 + 100 * (v_level - 1) loop
    v_left := v_left - (400 + 100 * (v_level - 1));
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- Catat hasil 1 match untuk pemain yang sedang login (termasuk anonim).
-- p_room_id: isi untuk match online (wajib anggota room). Kosong untuk lawan CPU.
create or replace function public.submit_match_result(
  p_match_id text,
  p_won boolean,
  p_name text,
  p_xp_total bigint default 0,
  p_room_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_name text := left(btrim(coalesce(p_name, '')), 24);
  v_wk   date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_rows integer;
  v_s    public.player_stats;
  v_pts  int := case when coalesce(p_won, false) then 100 else 10 end;
  v_xp   bigint;
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

  -- Batas kecepatan: hasil terlalu rapat diabaikan (token tetap terpakai, tidak diulang klien).
  if v_s.last_match_at is not null and v_s.last_match_at > now() - interval '45 seconds' then
    return jsonb_build_object('ok', true, 'ignored', 'too_fast');
  end if;

  if v_s.week_key <> v_wk then v_s.week_key := v_wk; v_s.week_points := 0; end if;
  v_xp := greatest(v_s.xp, least(greatest(coalesce(p_xp_total, 0), 0), 1000000)); -- kosmetik, tidak dipakai untuk peringkat

  update public.player_stats set
    name          = v_name,
    xp            = v_xp,
    level         = public.level_from_xp(v_xp),
    plays         = v_s.plays + 1,
    wins          = v_s.wins + (case when coalesce(p_won, false) then 1 else 0 end),
    streak        = case when coalesce(p_won, false) then v_s.streak + 1 else 0 end,
    best_streak   = greatest(v_s.best_streak, case when coalesce(p_won, false) then v_s.streak + 1 else 0 end),
    points        = v_s.points + v_pts,
    week_key      = v_s.week_key,
    week_points   = v_s.week_points + v_pts,
    last_match_at = now(),
    updated_at    = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true, 'duplicate', false, 'points', v_pts);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid) to authenticated;

-- Leaderboard. scope: 'global' (total poin), 'weekly' (poin minggu ini, reset Senin 00:00 UTC),
-- 'friends' (kamu + temanmu). Mengembalikan top-N, ditambah barismu sendiri bila di luar top-N.
create or replace function public.get_leaderboard(p_scope text, p_limit int default 50)
returns table (pos bigint, uid uuid, pname text, lvl int, score bigint, wins int, plays int, is_me boolean)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_wk  date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_lim int  := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scope is null or p_scope not in ('global', 'weekly', 'friends') then raise exception 'BAD_SCOPE'; end if;
  return query
  with base as (
    select s.user_id as b_uid, s.name as b_name, s.level as b_lvl, s.wins as b_wins, s.plays as b_plays,
           case when p_scope = 'weekly' then (case when s.week_key = v_wk then s.week_points else 0 end)
                else s.points end as b_score
    from public.player_stats s
    where s.plays > 0
      and (p_scope <> 'friends'
           or s.user_id = v_uid
           or s.user_id in (select f.friend_id from public.friendships f where f.user_id = v_uid))
  ), ranked as (
    select b.*, rank() over (order by b.b_score desc, b.b_wins desc) as b_pos
    from base b
    where p_scope <> 'weekly' or b.b_score > 0
  )
  select r.b_pos, r.b_uid, r.b_name, r.b_lvl, r.b_score, r.b_wins, r.b_plays, (r.b_uid = v_uid)
  from ranked r
  where r.b_pos <= v_lim or r.b_uid = v_uid
  order by r.b_pos, r.b_name;
end;
$$;
revoke all on function public.get_leaderboard(text, int) from public, anon;
grant execute on function public.get_leaderboard(text, int) to authenticated;
