-- Tahap S2 (doc/SERVER_AUTHORITATIVE_PLAN.md): penghitung naik di dalam aksi server.
--
--   * missions_done: naik di dalam quest_claim / quest_claim_all (server), bukan lagi dikirim klien.
--   * events_joined: tidak punya pemanggil di klien; jenis ini dihapus dari bump_player_counter.
--   * chests: peti dibuka di dalam game yang berjalan di browser (tidak ada aksi server yang bisa dijadikan sumber),
--     jadi jenis ini TETAP dilaporkan klien lewat bump_player_counter, dengan batas harian ketat (150/hari WIB).
--     Penutupan tuntas menunggu verifikasi game di server (opsi simulasi, lihat S5 di dokumen).
-- Klien lama yang masih memanggil bump_player_counter('missions_done'|'events_joined') akan mendapat BAD_KIND dan
-- mengabaikannya (pemanggilnya sudah dibungkus catch).

create or replace function public.quest_claim(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q public.player_quest; v_reward bigint; v_ready boolean; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_id not in ('login', 'play', 'win') then raise exception 'BAD_QUEST_ID'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  if p_id = any(v_q.claimed) then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  v_ready := case p_id when 'login' then v_q.prog_login >= 1 when 'play' then v_q.prog_play >= 1 else v_q.prog_win >= 3 end;
  if not v_ready then return jsonb_build_object('ok', false, 'reason', 'belum-selesai'); end if;
  v_reward := case p_id when 'login' then 50 when 'play' then 75 else 150 end;

  v_w := public._wallet_apply(v_uid, v_reward, 0, 'quest', v_q.day::text || ':' || p_id);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  update public.player_quest set claimed = array_append(claimed, p_id), updated_at = now() where user_id = v_uid;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats set missions_done = missions_done + 1, updated_at = now() where user_id = v_uid;   -- dihitung server, bukan klien
  return jsonb_build_object('ok', true, 'id', p_id, 'coins', v_reward,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim(text) from public, anon;
grant execute on function public.quest_claim(text) to authenticated;

create or replace function public.quest_claim_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q public.player_quest; v_id text; v_reward bigint; v_sum bigint := 0; v_n int := 0;
  v_w jsonb; v_ready boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  foreach v_id in array array['login', 'play', 'win'] loop
    continue when v_id = any(v_q.claimed);
    v_ready := case v_id when 'login' then v_q.prog_login >= 1 when 'play' then v_q.prog_play >= 1 else v_q.prog_win >= 3 end;
    continue when not v_ready;
    v_reward := case v_id when 'login' then 50 when 'play' then 75 else 150 end;
    v_w := public._wallet_apply(v_uid, v_reward, 0, 'quest', v_q.day::text || ':' || v_id);
    if not (v_w ->> 'duplicate')::boolean then
      v_sum := v_sum + v_reward; v_n := v_n + 1;
      update public.player_quest set claimed = array_append(claimed, v_id), updated_at = now() where user_id = v_uid;
    end if;
  end loop;

  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'tidak-ada-yang-siap'); end if;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats set missions_done = missions_done + v_n, updated_at = now() where user_id = v_uid;   -- dihitung server, bukan klien
  return jsonb_build_object('ok', true, 'count', v_n, 'coins', v_sum,
                            'wallet_coins', (select coins from public.player_wallet where user_id = v_uid),
                            'wallet_gems',  (select gems  from public.player_wallet where user_id = v_uid));
end;
$$;
revoke all on function public.quest_claim_all() from public, anon;
grant execute on function public.quest_claim_all() to authenticated;

-- ============ bump_player_counter: hanya 'chests' ============
create or replace function public.bump_player_counter(p_kind text, p_amount int default 1)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_cap_chests constant int := 150;   -- batas per hari WIB
  v_uid uuid := auth.uid();
  v_amt int := coalesce(p_amount, 1);
  v_day date := (now() at time zone 'Asia/Jakarta')::date;
  v_used int;
  v_val int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind <> 'chests' then raise exception 'BAD_KIND'; end if;
  if v_amt not between 1 and 20 then raise exception 'BAD_AMOUNT'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.player_counter_daily(user_id, day, kind) values (v_uid, v_day, p_kind) on conflict do nothing;
  select total into v_used from public.player_counter_daily
    where user_id = v_uid and day = v_day and kind = p_kind for update;

  v_amt := least(v_amt, c_cap_chests - v_used);
  if v_amt <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'kind', p_kind, 'cap', c_cap_chests);
  end if;

  update public.player_counter_daily set total = total + v_amt where user_id = v_uid and day = v_day and kind = p_kind;
  update public.player_stats set chests = chests + v_amt, updated_at = now() where user_id = v_uid;
  select chests into v_val from public.player_stats where user_id = v_uid;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'value', v_val, 'added', v_amt);
end;
$$;
revoke all on function public.bump_player_counter(text, int) from public, anon;
grant execute on function public.bump_player_counter(text, int) to authenticated;
