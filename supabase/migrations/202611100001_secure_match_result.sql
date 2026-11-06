-- Tahap 3A: amankan pencatatan hasil match (XP, menang, poin leaderboard).
--
-- Sebelumnya submit_match_result memercayai klien: p_xp_total (sampai 1.000.000) dan p_won dipakai apa adanya,
-- jadi satu panggilan saja bisa menghasilkan level maksimal dan poin leaderboard.
--
-- Aturan baru (signature fungsi TIDAK berubah, klien lama tetap jalan):
--   * XP dihitung SERVER: menang +120, kalah +40. p_xp_total diabaikan.
--   * Match ONLINE (p_room_id terisi): room harus 'finished'; menang/kalah ditentukan dari pemenang di
--     game_state room (bukan p_won). Dikreditkan sekali per pemain per room per 3 menit.
--   * Match lawan CPU (tanpa room): XP dan statistik tetap dicatat, poin leaderboard = 0.
--   * Leaderboard hanya menampilkan pemain yang punya poin (>0), jadi pemain CPU-saja tidak muncul.
-- Batasan yang masih ada: hasil lawan CPU tidak bisa diverifikasi (game jalan di browser), hanya dibatasi
-- 1 match per 45 detik. Dompet koin/gem masih lokal (PlayerData) dan di luar cakupan migrasi ini.

create table if not exists public.player_room_credits (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  credited_at timestamptz not null default now(),
  primary key (user_id, room_id)
);
alter table public.player_room_credits enable row level security;
revoke all on public.player_room_credits from anon, authenticated;

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
  c_xp_win  constant int := 120;
  c_xp_loss constant int := 40;
  c_pts_win constant int := 100;
  c_pts_loss constant int := 10;
  v_uid    uuid := auth.uid();
  v_name   text := left(btrim(coalesce(p_name, '')), 24);
  v_wk     date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_rows   integer;
  v_s      public.player_stats;
  v_room   public.game_rooms;
  v_online boolean := false;
  v_won    boolean := coalesce(p_won, false);
  v_key    text := p_match_id;
  v_widx   int;
  v_winner text;
  v_pts    int;
  v_gain   int;
  v_xp     bigint;
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

  if p_room_id is not null then
    if not public.is_game_room_member(p_room_id) then raise exception 'ROOM_ACCESS_DENIED'; end if;
    select * into v_room from public.game_rooms where id = p_room_id;
    if v_room.status <> 'finished' then
      return jsonb_build_object('ok', false, 'reason', 'room_not_finished'); -- klien boleh mencoba lagi sebentar lagi
    end if;
    v_widx := case when (v_room.game_state -> 'snapshot' ->> 'winnerIndex') ~ '^[0-9]+$'
                   then (v_room.game_state -> 'snapshot' ->> 'winnerIndex')::int end;
    v_winner := case when v_widx is not null then v_room.game_state -> 'snapshot' -> 'players' -> v_widx ->> 'networkId' end;
    if v_winner is null then
      return jsonb_build_object('ok', false, 'reason', 'no_result');
    end if;
    v_online := true;
    v_won := (v_winner = v_uid::text);   -- klaim klien (p_won) diabaikan
  end if;

  v_gain := case when v_won then c_xp_win else c_xp_loss end;
  v_pts  := case when not v_online then 0 when v_won then c_pts_win else c_pts_loss end;

  insert into public.player_stats(user_id, name) values (v_uid, v_name) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  if v_s.last_match_at is not null and v_s.last_match_at > now() - interval '45 seconds' then
    return jsonb_build_object('ok', true, 'ignored', 'too_fast');
  end if;

  if v_online then
    perform 1 from public.player_room_credits
      where user_id = v_uid and room_id = p_room_id and credited_at > now() - interval '3 minutes';
    if found then return jsonb_build_object('ok', true, 'duplicate', true); end if;
    insert into public.player_room_credits(user_id, room_id, credited_at) values (v_uid, p_room_id, now())
      on conflict (user_id, room_id) do update set credited_at = excluded.credited_at;
    v_key := left('room:' || p_room_id::text || ':' || to_char(now() at time zone 'utc', 'YYYYMMDDHH24MISS'), 80);
  end if;

  insert into public.player_match_results(user_id, match_id) values (v_uid, v_key) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  if v_s.week_key <> v_wk then v_s.week_key := v_wk; v_s.week_points := 0; end if;
  v_xp := least(v_s.xp + v_gain, 1000000);   -- XP dari server, bukan dari klien

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
  values (v_uid, v_key, v_won, case when v_online then 'online' else 'cpu' end,
          case when p_players between 1 and 8 then p_players end,
          (v_xp - v_s.xp)::int, v_pts,
          jsonb_build_object('dice', v_dice, 'ladders', v_lad, 'snakes', v_snk, 'skills', v_skl, 'dragon_hits', v_drg))
  on conflict do nothing;

  delete from public.player_match_history h
  where h.user_id = v_uid
    and h.id not in (select id from public.player_match_history
                     where user_id = v_uid order by created_at desc, id desc limit 50);

  return jsonb_build_object('ok', true, 'duplicate', false, 'won', v_won, 'online', v_online,
                            'points', v_pts, 'xp_gain', (v_xp - v_s.xp)::int);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) to authenticated;

-- Leaderboard: hanya pemain yang punya poin (pemain yang hanya melawan CPU tidak tampil).
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
    where s.points > 0
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

-- OPSIONAL (jalankan manual, tinjau dulu): XP yang sudah terlanjur dipalsukan. Batas wajar = plays * 120.
-- select user_id, name, xp, plays from public.player_stats where xp > plays * 120 + 1000 order by xp desc;
