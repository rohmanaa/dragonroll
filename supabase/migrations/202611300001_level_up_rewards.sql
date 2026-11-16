-- Hadiah naik level: koin tiap level + emerald (gems) di level kelipatan 5/10.
-- Server = otoritas. Klien hanya memanggil claim_level_rewards() setelah progres level tersinkron; nominal dihitung di sini.
--  * Tidak mengubah submit_match_result / fungsi XP yang ada (risiko rendah, mudah di-rollback).
--  * Idempoten: tiap level dibayar tepat sekali per akun (wallet_ledger unik per user+reason+ref_key, plus penanda player_level_reward).
--  * Lompat beberapa level sekaligus -> semua level yang terlewat dibayar dalam satu panggilan.
--  * Pemain lama TIDAK dibayar mundur: penanda diisi dengan level mereka saat migrasi ini jalan.
-- Rumus hadiah per level L (>= 2):  koin = 100 + 50*L (x2 bila L kelipatan 10);  gems = 25 bila L kelipatan 10, 10 bila kelipatan 5, selain itu 0.

create table if not exists public.player_level_reward (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  last_level int  not null default 1 check (last_level >= 1),
  updated_at timestamptz not null default now()
);
alter table public.player_level_reward enable row level security;
revoke all on public.player_level_reward from anon, authenticated;

-- Pemain lama: tandai level sekarang sebagai "sudah dibayar" (tanpa hadiah mundur).
insert into public.player_level_reward(user_id, last_level)
select user_id, level from public.player_stats
on conflict (user_id) do nothing;

-- Hadiah satu level (murni; tidak ada akses tabel).
create or replace function public._level_reward(p_level int, out coins bigint, out gems bigint)
language sql immutable as $$
  select ((100 + 50 * p_level) * case when p_level % 10 = 0 then 2 else 1 end)::bigint,
         (case when p_level % 10 = 0 then 25 when p_level % 5 = 0 then 10 else 0 end)::bigint;
$$;
revoke all on function public._level_reward(int) from public, anon, authenticated;

create or replace function public.claim_level_rewards() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_cur   int;
  v_last  int;
  v_l     int;
  v_c     bigint;
  v_g     bigint;
  v_res   jsonb;
  v_tc    bigint := 0;
  v_tg    bigint := 0;
  v_lv    jsonb  := '[]'::jsonb;
  v_coins bigint;
  v_gems  bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select level into v_cur from public.player_stats where user_id = v_uid;
  if v_cur is null then
    return jsonb_build_object('ok', true, 'levels', v_lv, 'reward_coins', 0, 'reward_gems', 0);
  end if;

  perform public._wallet_ensure(v_uid);
  insert into public.player_level_reward(user_id, last_level) values (v_uid, 1) on conflict (user_id) do nothing;
  select last_level into v_last from public.player_level_reward where user_id = v_uid for update;   -- serialisasi klaim paralel

  v_l := v_last + 1;
  while v_l <= v_cur loop
    select r.coins, r.gems into v_c, v_g from public._level_reward(v_l) r;
    v_res := public._wallet_apply(v_uid, v_c, v_g, 'level_up', v_l::text);
    if coalesce((v_res->>'duplicate')::boolean, false) = false then
      v_tc := v_tc + v_c; v_tg := v_tg + v_g;
      v_lv := v_lv || jsonb_build_array(jsonb_build_object('level', v_l, 'coins', v_c, 'gems', v_g));
    end if;
    v_l := v_l + 1;
  end loop;

  update public.player_level_reward set last_level = greatest(last_level, v_cur), updated_at = now() where user_id = v_uid;

  select coins, gems into v_coins, v_gems from public.player_wallet where user_id = v_uid;
  return jsonb_build_object('ok', true, 'levels', v_lv, 'reward_coins', v_tc, 'reward_gems', v_tg,
                            'wallet_coins', v_coins, 'wallet_gems', v_gems);
end;
$$;
revoke all on function public.claim_level_rewards() from public, anon;
grant execute on function public.claim_level_rewards() to authenticated;
