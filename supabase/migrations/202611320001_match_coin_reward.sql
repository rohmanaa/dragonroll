-- Koin hadiah per pertandingan (menang DAN kalah), dibayar server di submit_match_result.
-- Sebelumnya match hanya memberi XP + poin; koin hanya dari boss/level/misi.
--   * Online terverifikasi: menang +40, kalah +15 koin. Lawan CPU / room tak terverifikasi: menang +10, kalah +5.
--   * Batas 300 koin/hari WIB dari match (ledger reason 'match'); jeda 45 detik antar match tetap berlaku.
--   * Hasil dikembalikan di 'reward_coins' (klien hanya menampilkan). Ubah angka lewat konstanta c_coin_* di bawah.
-- Terapkan SETELAH 202611190003 dan migrasi wallet (butuh _wallet_apply/_wallet_ensure/_wib_day_start).

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
  c_coin_win       constant bigint := 40;   -- koin match online terverifikasi (menang)
  c_coin_loss      constant bigint := 15;   -- koin match online terverifikasi (kalah) - kalah tetap dapat koin
  c_coin_win_cpu   constant bigint := 10;   -- lawan CPU / room tak terverifikasi
  c_coin_loss_cpu  constant bigint := 5;
  c_coin_daily_cap constant bigint := 300;  -- batas total koin dari match per akun per hari WIB (anti-farming)
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
  v_coins  bigint := 0;
  v_today  bigint;
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

  -- Koin match: menang ATAU kalah dapat koin (kalah lebih kecil). Server menentukan nominal; ref_key = id match -> tidak bisa dobel.
  v_coins := case when v_online then (case when v_won then c_coin_win else c_coin_loss end)
                  else (case when v_won then c_coin_win_cpu else c_coin_loss_cpu end) end;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select coalesce(sum(delta_coins), 0) into v_today from public.wallet_ledger
    where user_id = v_uid and reason = 'match' and created_at >= public._wib_day_start();
  v_coins := greatest(least(v_coins, c_coin_daily_cap - v_today), 0);
  if v_coins > 0 then perform public._wallet_apply(v_uid, v_coins, 0, 'match', v_key); end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'won', v_won, 'online', v_online,
                            'points', v_pts, 'xp_gain', (v_xp - v_s.xp)::int, 'reward_coins', v_coins);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) to authenticated;
