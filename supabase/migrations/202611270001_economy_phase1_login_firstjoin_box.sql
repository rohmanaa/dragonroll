-- Ekonomi fase 1 (lihat EKONOMI_PLAN.md 4.6 dan 4.9). Idempotent (create or replace).
--   1. Login 7 hari baru: tanpa dadu/skin, nominal lebih kecil. Mystery Box (hari 3) kini bisa dibuka.
--   2. open_mystery_box(): memakai 1 box, hadiah acak (koin/gem) ditentukan SERVER.
--   3. Hadiah first join: surat reward 500 koin + 20 gem untuk akun BARU (dibuat sejak c_cutoff), sekali per akun (dedupe 'first-join').
-- Akun lama tidak mendapat first join (hanya surat sambutan lama seperti sebelumnya).
--
-- Tabel hadiah login (= array R di dailyreward.html):
--   1: 300 koin | 2: 500 koin | 3: Mystery Box | 4: 5 gem | 5: 800 koin | 6: 10 gem | 7: 2.000 koin + 15 gem

create or replace function public.claim_daily_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := public._wib_today();
  v_r     public.player_daily_reward;
  v_idx   int;
  v_dc    bigint := 0;
  v_dg    bigint := 0;
  v_type  text;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;    -- serialisasi klaim per akun
  insert into public.player_daily_reward(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_r from public.player_daily_reward where user_id = v_uid for update;

  if v_r.last_claim_date = v_today then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;

  v_idx := public._daily_effective_claimed(v_r.claimed, v_r.last_claim_date);   -- 0..6

  case v_idx
    when 0 then v_type := 'coin'; v_dc := 300;
    when 1 then v_type := 'coin'; v_dc := 500;
    when 2 then v_type := 'box';
    when 3 then v_type := 'gem';  v_dg := 5;
    when 4 then v_type := 'coin'; v_dc := 800;
    when 5 then v_type := 'gem';  v_dg := 10;
    else        v_type := 'mix';  v_dc := 2000; v_dg := 15;
  end case;

  -- Kunci idempoten per tanggal WIB: klaim kedua di hari yang sama tidak mungkin, walau logika streak salah.
  v_res := public._wallet_apply(v_uid, v_dc, v_dg, 'daily', v_today::text);
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;

  update public.player_daily_reward
     set claimed = v_idx + 1, last_claim_date = v_today, box = box + (case when v_type = 'box' then 1 else 0 end),
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'day', v_idx + 1, 'type', v_type, 'item', null, 'duplicate', false,
                            'coins', v_dc, 'gems', v_dg, 'box', v_type = 'box',
                            'wallet_coins', (v_res ->> 'coins')::bigint, 'wallet_gems', (v_res ->> 'gems')::bigint,
                            'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.claim_daily_reward() from public, anon;
grant execute on function public.claim_daily_reward() to authenticated;

-- Buka 1 Mystery Box. Peluang (per 100): 40% 500 koin | 30% 1.000 koin | 15% 2.000 koin | 10% 3 gem | 4% 8 gem | 1% 20 gem.
-- Nilai harapan ±1,0 rb koin + ±0,5 gem. Hasil diundi di server; kunci idempoten dompet = id acak per pembukaan.
create or replace function public.open_mystery_box() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_r   public.player_daily_reward;
  v_n   int := floor(random() * 100)::int;      -- 0..99
  v_dc  bigint := 0;
  v_dg  bigint := 0;
  v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into v_r from public.player_daily_reward where user_id = v_uid for update;
  if not found or v_r.box <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'tidak-ada-box');
  end if;

  if    v_n < 40 then v_dc := 500;
  elsif v_n < 70 then v_dc := 1000;
  elsif v_n < 85 then v_dc := 2000;
  elsif v_n < 95 then v_dg := 3;
  elsif v_n < 99 then v_dg := 8;
  else                v_dg := 20;
  end if;

  v_res := public._wallet_apply(v_uid, v_dc, v_dg, 'mystery_box', gen_random_uuid()::text);
  update public.player_daily_reward set box = box - 1, updated_at = now() where user_id = v_uid;

  return jsonb_build_object('ok', true, 'coins', v_dc, 'gems', v_dg, 'box', v_r.box - 1,
                            'wallet_coins', (v_res ->> 'coins')::bigint, 'wallet_gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.open_mystery_box() from public, anon;
grant execute on function public.open_mystery_box() to authenticated;

-- mail_list: surat sambutan lama tetap; akun BARU juga mendapat hadiah first join (sekali, dedupe 'first-join').
create or replace function public.mail_list(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100); v_mails jsonb;
  c_cutoff constant timestamptz := timestamptz '2026-11-13 00:00:00+07';   -- akun dibuat sejak ini = akun baru
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._mail_send(v_uid, 'system', 'Selamat datang di Dragon Roll',
    'Lempar dadu, kalahkan lawan, dan kumpulkan koleksi karakter. Selamat bersenang-senang!', 0, 0, 'welcome', null);
  if exists (select 1 from auth.users u where u.id = v_uid and u.created_at >= c_cutoff) then
    perform public._mail_send(v_uid, 'reward', 'Hadiah Pemain Baru',
      'Terima kasih sudah bergabung! Ini bekal awalmu. Emerald bisa dipakai untuk membuka tambang.', 500, 20, 'first-join', null);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'kind', kind, 'title', title, 'body', body,
           'coins', reward_coins, 'gems', reward_gems,
           'at', created_at, 'expires_at', expires_at,
           'read', read_at is not null, 'claimed', claimed_at is not null) order by created_at desc, id), '[]'::jsonb)
    into v_mails
    from (select * from public.player_mail
           where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now())
           order by created_at desc, id limit v_lim) t;
  return jsonb_build_object('ok', true, 'mails', v_mails,
    'unread',  (select count(*) from public.player_mail where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now()) and read_at is null),
    'pending', (select count(*) from public.player_mail where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now()) and kind = 'reward' and claimed_at is null));
end;
$$;
revoke all on function public.mail_list(int) from public, anon;
grant execute on function public.mail_list(int) to authenticated;
