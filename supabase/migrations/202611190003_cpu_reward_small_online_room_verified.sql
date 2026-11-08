-- Tahap S5 + S6 (doc/SERVER_AUTHORITATIVE_PLAN.md).
--
-- S5 (celah C): lawan CPU tetap memberi XP dan koin, tapi KECIL dan ketat:
--   * XP match CPU: menang +30, kalah +10 (online terverifikasi tetap +120 / +40).
--   * Hadiah boss CPU: 100 koin, 0 gem, maksimal 3 per hari WIB, jeda 3 menit (sebelumnya 500 koin + 10 gem, 5/hari).
--   * Jeda match 45 detik tetap berlaku.
-- S6 (celah D): hadiah/XP/poin online hanya untuk room yang TERVERIFIKASI oleh log server (game_events):
--   * event 'roll' hanya bisa dibuat server (roll_game_dice), jadi tidak bisa dipalsukan klien;
--   * minimal 16 event roll, minimal 2 pemain (akun) berbeda punya event di room itu, dan rentang waktu event
--     minimal 90 detik. Room buatan satu akun tanpa permainan nyata tidak lolos.
--   * Room tak terverifikasi: claim_boss_reward menolak ('room_not_verified'); submit_match_result memperlakukannya
--     seperti lawan CPU (XP kecil, tanpa poin leaderboard).
-- Batasan: dua akun milik orang yang sama yang bermain sungguhan masih lolos; dibatasi 10 hadiah boss per hari.
-- Catatan klien: nominal hadiah di UI dibaca dari balasan server (reward_coins / reward_gems), tidak perlu diubah.

create or replace function public._room_is_verified(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.game_events where room_id = p_room_id and type = 'roll') >= 16
    and (select count(distinct player_id) from public.game_events where room_id = p_room_id) >= 2
    and (select max(created_at) - min(created_at) from public.game_events where room_id = p_room_id) >= interval '90 seconds';
$$;
revoke all on function public._room_is_verified(uuid) from public, anon, authenticated;

create or replace function public.claim_cpu_boss_reward(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_coins    constant bigint := 100;   -- hadiah CPU kecil (online tetap 500)
  c_gems     constant bigint := 0;     -- CPU: koin saja, tanpa gem
  c_daily    constant int    := 3;     -- batas klaim per akun per hari WIB
  c_gap_secs constant int    := 180;   -- jarak minimal antar klaim
  v_uid   uuid := auth.uid();
  v_start timestamptz := public._wib_day_start();
  v_n     int;
  v_last  timestamptz;
  v_wait  int;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('ok', false, 'reason', 'token-tidak-valid');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;      -- serialisasi: cap tidak bisa dilompati paralel

  -- Token yang sama = klaim yang sama (cek lebih dulu agar kirim ulang tidak dikira "terlalu cepat").
  if exists (select 1 from public.wallet_ledger where user_id = v_uid and reason = 'boss_cpu' and ref_key = p_token) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim');
  end if;

  select count(*), max(created_at) into v_n, v_last
    from public.wallet_ledger where user_id = v_uid and reason = 'boss_cpu' and created_at >= v_start;
  if v_n >= c_daily then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'cap', c_daily, 'seconds_to_reset', public._secs_to_wib_reset());
  end if;
  if v_last is not null and now() < v_last + make_interval(secs => c_gap_secs) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => c_gap_secs)) - now()))::int;
    return jsonb_build_object('ok', false, 'reason', 'terlalu-cepat', 'tunggu_detik', v_wait);
  end if;

  v_res := public._wallet_apply(v_uid, c_coins, c_gems, 'boss_cpu', p_token);
  return v_res || jsonb_build_object('reward_coins', c_coins, 'reward_gems', c_gems, 'sisa_hari_ini', c_daily - v_n - 1);
end;
$$;
revoke all on function public.claim_cpu_boss_reward(text) from public, anon;
grant execute on function public.claim_cpu_boss_reward(text) to authenticated;

create or replace function public.reward_caps_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_cpu_daily constant int := 3; c_online_daily constant int := 10;
  v_uid uuid := auth.uid(); v_start timestamptz := public._wib_day_start(); v_cpu int; v_on int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) filter (where reason = 'boss_cpu'), count(*) filter (where reason = 'boss')
    into v_cpu, v_on from public.wallet_ledger
   where user_id = v_uid and reason in ('boss_cpu', 'boss') and created_at >= v_start;
  return jsonb_build_object(
    'boss_cpu_left',    greatest(c_cpu_daily - v_cpu, 0),
    'boss_online_left', greatest(c_online_daily - v_on, 0),
    'tz', 'Asia/Jakarta', 'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.reward_caps_get() from public, anon;
grant execute on function public.reward_caps_get() to authenticated;

create or replace function public.claim_boss_reward(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_coins constant bigint := 500;   -- = Config.DRAGON_REWARD di klien
  c_gems  constant bigint := 10;
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
  if not public._room_is_verified(p_room_id) then return jsonb_build_object('ok', false, 'reason', 'room_not_verified'); end if;   -- room palsu/tanpa permainan nyata tidak dapat hadiah
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
  c_xp_win  constant int := 120;   -- match online terverifikasi
  c_xp_loss constant int := 40;
  c_xp_win_cpu  constant int := 30;   -- lawan CPU / room tak terverifikasi: XP kecil
  c_xp_loss_cpu constant int := 10;
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
    if public._room_is_verified(p_room_id) then
      v_online := true;
      v_won := (v_winner = v_uid::text);   -- klaim klien (p_won) diabaikan
    end if;                                 -- room tak terverifikasi: diperlakukan seperti lawan CPU (XP kecil, tanpa poin leaderboard)
  end if;

  v_gain := case when v_online then (case when v_won then c_xp_win else c_xp_loss end)
                 else (case when v_won then c_xp_win_cpu else c_xp_loss_cpu end) end;
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
