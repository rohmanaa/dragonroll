-- Tahap S1 (doc/SERVER_AUTHORITATIVE_PLAN.md): tutup dua celah hasil audit.
--
-- 1) claim_achievement memercayai p_client_value untuk achievement bersumber 'client' (skin, emerald): siapa pun yang
--    memanggil RPC langsung bisa mengklaim semua bintang. Sekarang nilainya dihitung server:
--      skins   = jumlah item kind 'skin' di player_inventory
--      emerald = gems di player_wallet
--    Definisi 'skin' dan 'emerald' dipindah ke source 'server'. Signature fungsi TIDAK berubah (klien lama tetap jalan).
-- 2) bump_player_counter dipanggil klien tanpa batas (maks 20 per panggilan). Sekarang ada batas harian per jenis
--    (hari WIB). Ini PENGETATAN SEMENTARA; perbaikan tuntas = penghitung naik di dalam RPC server (Tahap S2).

update public.achievement_defs set source = 'server' where id in ('skin', 'emerald');

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

  -- Semua nilai dihitung SERVER. p_client_value tetap ada di signature (klien lama tetap jalan) tapi DIABAIKAN.
  v_val := case v_def.stat
             when 'skins'   then (select count(*) from public.player_inventory i
                                    join public.item_catalog c on c.id = i.item_id
                                   where i.user_id = v_uid and c.kind = 'skin')::bigint
             when 'emerald' then coalesce((select w.gems from public.player_wallet w where w.user_id = v_uid), 0)
             else public.player_stat_value(v_s, v_def.stat)
           end;
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

-- ============ bump_player_counter: batas harian ============
create table if not exists public.player_counter_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  kind    text not null,
  total   int  not null default 0 check (total >= 0),
  primary key (user_id, day, kind)
);
alter table public.player_counter_daily enable row level security;
revoke all on public.player_counter_daily from anon, authenticated;

create or replace function public.bump_player_counter(p_kind text, p_amount int default 1)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_cap_chests  constant int := 150;   -- batas per hari WIB
  c_cap_missions constant int := 30;
  c_cap_events  constant int := 10;
  v_uid uuid := auth.uid();
  v_amt int := coalesce(p_amount, 1);
  v_day date := (now() at time zone 'Asia/Jakarta')::date;
  v_cap int;
  v_used int;
  v_val int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind not in ('chests', 'missions_done', 'events_joined') then raise exception 'BAD_KIND'; end if;
  if v_amt not between 1 and 20 then raise exception 'BAD_AMOUNT'; end if;
  v_cap := case p_kind when 'chests' then c_cap_chests when 'missions_done' then c_cap_missions else c_cap_events end;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.player_counter_daily(user_id, day, kind) values (v_uid, v_day, p_kind) on conflict do nothing;
  select total into v_used from public.player_counter_daily
    where user_id = v_uid and day = v_day and kind = p_kind for update;   -- serialisasi: batas tidak bisa dilompati paralel

  v_amt := least(v_amt, v_cap - v_used);
  if v_amt <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'kind', p_kind, 'cap', v_cap);
  end if;

  update public.player_counter_daily set total = total + v_amt where user_id = v_uid and day = v_day and kind = p_kind;
  update public.player_stats set
    chests        = chests        + case when p_kind = 'chests'        then v_amt else 0 end,
    missions_done = missions_done + case when p_kind = 'missions_done' then v_amt else 0 end,
    events_joined = events_joined + case when p_kind = 'events_joined' then v_amt else 0 end,
    updated_at    = now()
  where user_id = v_uid;

  select case p_kind when 'chests' then chests when 'missions_done' then missions_done else events_joined end
    into v_val from public.player_stats where user_id = v_uid;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'value', v_val, 'added', v_amt);
end;
$$;
revoke all on function public.bump_player_counter(text, int) from public, anon;
grant execute on function public.bump_player_counter(text, int) to authenticated;
