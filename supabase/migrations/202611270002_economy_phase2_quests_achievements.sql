-- Ekonomi fase 2 (EKONOMI_PLAN.md 4.7 dan 4.8). Idempotent.
--   1. Misi harian jadi 8. Misi baru (dadu/tangga/naga/peti/skill) dihitung SERVER dari selisih counter seumur hidup
--      (player_stats) terhadap baseline yang dicatat saat hari WIB berganti -> klien tidak melaporkan apa pun untuk misi ini.
--      Hadiah: 100/150/250/120/120/200/120/120 koin = 1.180. Bonus semua selesai: 300 koin + 3 gem.
--   2. Achievement: target dan hadiah naik per kelas kesulitan; 'papan' -> Penyelesai Misi, 'skin' -> Kolektor (total koleksi);
--      baru: Pemburu Boss, Teman, Level. Nominal klaim tetap dihitung server (claim_achievement).

-- ============ 1. Misi harian ============
alter table public.player_stats add column if not exists quests_done int not null default 0 check (quests_done >= 0);
alter table public.player_quest add column if not exists base jsonb not null default '{}'::jsonb;

-- Definisi misi (urutan tampil). Nominal HANYA di sini.
create or replace function public._quest_defs() returns table(ord int, id text, goal int, reward int)
language sql immutable as $$
  select * from (values
    (1, 'login',  1, 100), (2, 'play', 1, 150), (3, 'win', 3, 250),
    (4, 'dice',  30, 120), (5, 'ladder', 5, 120), (6, 'dragon', 3, 200), (7, 'chest', 3, 120), (8, 'skill', 3, 120)
  ) v(ord, id, goal, reward)
$$;
revoke all on function public._quest_defs() from public, anon, authenticated;

-- Counter seumur hidup yang dipakai misi turunan.
create or replace function public._quest_stats(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'dice',   coalesce(s.dice_rolls, 0), 'ladder', coalesce(s.ladders, 0), 'dragon', coalesce(s.dragon_hits, 0),
    'chest',  coalesce(s.chests, 0),     'skill',  coalesce(s.skills_used, 0))
  from (select 1) x left join public.player_stats s on s.user_id = p_user
$$;
revoke all on function public._quest_stats(uuid) from public, anon, authenticated;

create or replace function public._quest_roll(p_user uuid) returns public.player_quest
language plpgsql security definer set search_path = public as $$
declare v_q public.player_quest; v_today date := public._wib_today();
begin
  insert into public.player_quest(user_id, day) values (p_user, v_today) on conflict (user_id) do nothing;
  update public.player_quest
     set day = v_today, prog_login = 0, prog_play = 0, prog_win = 0, claimed = '{}', bonus = false,
         base = public._quest_stats(p_user), updated_at = now()
   where user_id = p_user and day <> v_today;
  update public.player_quest set base = public._quest_stats(p_user)       -- baris baru / baris hari ini dari sebelum migrasi ini
   where user_id = p_user and base = '{}'::jsonb;
  select * into v_q from public.player_quest where user_id = p_user for update;
  return v_q;
end;
$$;
revoke all on function public._quest_roll(uuid) from public, anon, authenticated;

-- Progres satu misi (sudah dibatasi tujuan).
create or replace function public._quest_prog(p_q public.player_quest, p_id text, p_goal int, p_now jsonb) returns int
language sql stable as $$
  select least(p_goal, case p_id
    when 'login' then p_q.prog_login when 'play' then p_q.prog_play when 'win' then p_q.prog_win
    else greatest(0, coalesce((p_now ->> p_id)::int, 0) - coalesce((p_q.base ->> p_id)::int, 0)) end)
$$;
revoke all on function public._quest_prog(public.player_quest, text, int, jsonb) from public, anon, authenticated;

create or replace function public._quest_json(p_q public.player_quest) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_now jsonb := public._quest_stats(p_q.user_id); v_list jsonb; v_all boolean;
begin
  select jsonb_agg(jsonb_build_object('id', d.id, 'goal', d.goal, 'reward', d.reward,
           'progress', public._quest_prog(p_q, d.id, d.goal, v_now),
           'status', case when d.id = any(p_q.claimed) then 'claimed'
                          when public._quest_prog(p_q, d.id, d.goal, v_now) >= d.goal then 'ready' else 'todo' end) order by d.ord),
         bool_and(d.id = any(p_q.claimed))
    into v_list, v_all
    from public._quest_defs() d;
  return jsonb_build_object('day', p_q.day, 'seconds_to_reset', public._secs_to_wib_reset(), 'quests', v_list,
    'bonus', jsonb_build_object('reward', 300, 'gems', 3,
      'status', case when p_q.bonus then 'claimed' when v_all then 'ready' else 'locked' end));
end;
$$;
revoke all on function public._quest_json(public.player_quest) from public, anon, authenticated;

-- quest_track tetap hanya untuk login/play/win (isi fungsi sama dengan sebelumnya).

create or replace function public.quest_claim(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q public.player_quest; v_d record; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_d from public._quest_defs() where id = p_id;
  if not found then raise exception 'BAD_QUEST_ID'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  if p_id = any(v_q.claimed) then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  if public._quest_prog(v_q, v_d.id, v_d.goal, public._quest_stats(v_uid)) < v_d.goal then
    return jsonb_build_object('ok', false, 'reason', 'belum-selesai');
  end if;

  v_w := public._wallet_apply(v_uid, v_d.reward, 0, 'quest', v_q.day::text || ':' || p_id);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  update public.player_quest set claimed = array_append(claimed, p_id), updated_at = now() where user_id = v_uid;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats set quests_done = quests_done + 1 where user_id = v_uid;
  return jsonb_build_object('ok', true, 'id', p_id, 'coins', v_d.reward,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim(text) from public, anon;
grant execute on function public.quest_claim(text) to authenticated;

create or replace function public.quest_claim_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q public.player_quest; v_d record; v_now jsonb; v_sum bigint := 0; v_n int := 0; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);
  v_now := public._quest_stats(v_uid);
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;

  for v_d in select * from public._quest_defs() order by ord loop
    continue when v_d.id = any(v_q.claimed);
    continue when public._quest_prog(v_q, v_d.id, v_d.goal, v_now) < v_d.goal;
    v_w := public._wallet_apply(v_uid, v_d.reward, 0, 'quest', v_q.day::text || ':' || v_d.id);
    if not (v_w ->> 'duplicate')::boolean then
      v_sum := v_sum + v_d.reward; v_n := v_n + 1;
      update public.player_quest set claimed = array_append(claimed, v_d.id), updated_at = now() where user_id = v_uid;
      update public.player_stats set quests_done = quests_done + 1 where user_id = v_uid;
    end if;
  end loop;

  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'tidak-ada-yang-siap'); end if;
  return jsonb_build_object('ok', true, 'count', v_n, 'coins', v_sum,
                            'wallet_coins', (select coins from public.player_wallet where user_id = v_uid),
                            'wallet_gems',  (select gems  from public.player_wallet where user_id = v_uid));
end;
$$;
revoke all on function public.quest_claim_all() from public, anon;
grant execute on function public.quest_claim_all() to authenticated;

create or replace function public.quest_claim_bonus() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.player_quest; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  if v_q.bonus then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  if exists (select 1 from public._quest_defs() d where not (d.id = any(v_q.claimed))) then
    return jsonb_build_object('ok', false, 'reason', 'terkunci');
  end if;

  v_w := public._wallet_apply(v_uid, 300, 3, 'quest_bonus', v_q.day::text);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  update public.player_quest set bonus = true, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'coins', 300, 'gems', 3,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim_bonus() from public, anon;
grant execute on function public.quest_claim_bonus() to authenticated;

-- ============ 2. Achievement ============
-- Nilai statistik baru dihitung server (juga dipakai get_my_profile). 'collection' = dadu+frame+aura+skin yang dimiliki.
create or replace function public._ach_extra(p_user uuid, p_stat text) returns bigint
language sql stable security definer set search_path = public as $$
  select case p_stat
    when 'collection' then (select count(*) from public.player_inventory i join public.item_catalog c on c.id = i.item_id
                             where i.user_id = p_user and c.kind in ('dice', 'frame', 'aura', 'skin'))
    when 'boss_wins'  then (select count(*) from public.wallet_ledger where user_id = p_user and reason = 'boss')
    when 'friends'    then (select count(*) from public.friendships where user_id = p_user)
    when 'emerald'    then coalesce((select gems from public.player_wallet where user_id = p_user), 0)
    else 0 end::bigint
$$;
revoke all on function public._ach_extra(uuid, text) from public, anon, authenticated;

-- player_stat_value: tambah quests_done dan level.
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
    when 'quests_done'       then s.quests_done
    when 'level'             then s.level
    else 0
  end::bigint;
$$;

-- Kelas hadiah: mudah / sedang / sulit / legendaris = koin {1,2,3 bintang} dan gem {1,2,3 bintang}.
update public.achievement_defs set source = 'server', tiers = '{10,100,1000}',   reward_coins = '{500,2000,6000}',    reward_gems = '{1,5,15}'  where id = 'peti';
update public.achievement_defs set source = 'server', tiers = '{10,50,500}',     reward_coins = '{1000,4000,12000}',  reward_gems = '{3,10,30}' where id = 'naga';
update public.achievement_defs set source = 'server', tiers = '{10,100,1000}',   reward_coins = '{500,2000,6000}',    reward_gems = '{1,5,15}'  where id = 'aktif';
update public.achievement_defs set source = 'server', tiers = '{5,50,500}',      reward_coins = '{1000,4000,12000}',  reward_gems = '{3,10,30}' where id = 'menang';
update public.achievement_defs set source = 'server', tiers = '{25,250,2500}',   reward_coins = '{500,2000,6000}',    reward_gems = '{1,5,15}'  where id = 'tangga';
update public.achievement_defs set source = 'server', tiers = '{25,250,2500}',   reward_coins = '{300,1000,3000}',    reward_gems = '{0,2,5}'   where id = 'ular';
update public.achievement_defs set source = 'server', tiers = '{25,250,2500}',   reward_coins = '{500,2000,6000}',    reward_gems = '{1,5,15}'  where id = 'skill';
update public.achievement_defs set source = 'server', tiers = '{100,1000,10000}', reward_coins = '{500,2000,6000}',   reward_gems = '{1,5,15}'  where id = 'dadu';
update public.achievement_defs set source = 'server', tiers = '{7,30,100}',      reward_coins = '{1000,4000,12000}',  reward_gems = '{3,10,30}' where id = 'login';
update public.achievement_defs set source = 'server', tiers = '{3,7,15}',        reward_coins = '{1000,4000,12000}',  reward_gems = '{3,10,30}' where id = 'streak';
update public.achievement_defs set source = 'server', tiers = '{5,25,100}',      reward_coins = '{1000,4000,12000}',  reward_gems = '{3,10,30}' where id = 'strategi';
update public.achievement_defs set source = 'server', tiers = '{50,500,5000}',   reward_coins = '{500,2000,6000}',    reward_gems = '{1,5,15}'  where id = 'emerald';
update public.achievement_defs set source = 'server', tiers = '{500,1000,2000}', reward_coins = '{2000,8000,25000}',  reward_gems = '{5,25,75}' where id = 'legenda';
-- 'papan' (duplikat Pemain Aktif) -> Penyelesai Misi; 'skin' (mustahil: hanya 6 skin) -> Kolektor total koleksi.
update public.achievement_defs set source = 'server', stat = 'quests_done', tiers = '{10,100,500}', reward_coins = '{500,2000,6000}', reward_gems = '{1,5,15}' where id = 'papan';
update public.achievement_defs set source = 'server', stat = 'collection',  tiers = '{5,15,30}',   reward_coins = '{500,2000,6000}', reward_gems = '{1,5,15}' where id = 'skin';
insert into public.achievement_defs (id, source, stat, tiers, reward_coins, reward_gems, sort) values
  ('boss',  'server', 'boss_wins', '{10,100,500}', '{1000,4000,12000}', '{3,10,30}', 16),
  ('teman', 'server', 'friends',   '{1,5,20}',     '{300,1000,3000}',   '{0,2,5}',   17),
  ('level', 'server', 'level',     '{5,20,50}',    '{500,2000,6000}',   '{1,5,15}',  18)
on conflict (id) do update set source = excluded.source, stat = excluded.stat, tiers = excluded.tiers,
  reward_coins = excluded.reward_coins, reward_gems = excluded.reward_gems, sort = excluded.sort;

-- claim_achievement: nilai dihitung server; stat tambahan lewat _ach_extra. Signature tidak berubah.
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

  v_val := case when v_def.stat in ('collection', 'boss_wins', 'friends', 'emerald') then public._ach_extra(v_uid, v_def.stat)
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

-- get_my_profile: counters tambahan untuk tampilan achievement (collection, boss_wins, friends, quests_done, level sudah ada).
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
      'skill_wins', cardinality(v_s.skill_wins), 'missions_done', v_s.missions_done, 'events_joined', v_s.events_joined,
      'quests_done', v_s.quests_done, 'collection', public._ach_extra(v_uid, 'collection'),
      'boss_wins', public._ach_extra(v_uid, 'boss_wins'), 'friends', public._ach_extra(v_uid, 'friends'),
      'emerald', public._ach_extra(v_uid, 'emerald')),
    'claims', v_claims
  );
end;
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
