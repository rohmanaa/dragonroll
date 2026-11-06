-- Dompet server, TAHAP B6: emerald dari iklan berhadiah (rewarded ad). Terapkan SETELAH 202611110004_wallet_b4_caps.sql.
--
--   claim_ad_reward(token): +5 emerald per klaim (nominal DI SERVER, klien tidak mengirim jumlah).
--     Idempoten per token (kunci ledger (user, 'ad', token)), maks 5 klaim per hari WIB, jarak minimal 60 detik.
--   ad_reward_get(): sisa jatah hari ini + hitung mundur reset, untuk UI.
--
-- BATAS KEPERCAYAAN: token dibuat oleh klien, jadi server TIDAK tahu iklan benar-benar ditonton. Batas harian dan
-- jarak hanya MEMBATASI kerugian (maks 5 x 5 = 25 emerald/hari/akun). Untuk menutup celah ini sepenuhnya, jaringan iklan
-- harus memanggil balik server (server-side verification, mis. AdMob SSV): server memasukkan token ke tabel "iklan
-- terverifikasi" dan claim_ad_reward hanya menerima token yang ada di sana. Belum dikerjakan; ubah c_* di bawah bila perlu.

create or replace function public.claim_ad_reward(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems     constant bigint := 5;    -- emerald per iklan
  c_daily    constant int    := 5;    -- batas klaim per akun per hari WIB
  c_gap_secs constant int    := 60;   -- jarak minimal antar klaim
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
  perform 1 from public.player_wallet where user_id = v_uid for update;     -- serialisasi: batas tidak bisa dilompati paralel

  if exists (select 1 from public.wallet_ledger where user_id = v_uid and reason = 'ad' and ref_key = p_token) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim');
  end if;

  select count(*), max(created_at) into v_n, v_last
    from public.wallet_ledger where user_id = v_uid and reason = 'ad' and created_at >= v_start;
  if v_n >= c_daily then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'cap', c_daily, 'seconds_to_reset', public._secs_to_wib_reset());
  end if;
  if v_last is not null and now() < v_last + make_interval(secs => c_gap_secs) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => c_gap_secs)) - now()))::int;
    return jsonb_build_object('ok', false, 'reason', 'terlalu-cepat', 'tunggu_detik', v_wait);
  end if;

  v_res := public._wallet_apply(v_uid, 0, c_gems, 'ad', p_token);
  return v_res || jsonb_build_object('reward_gems', c_gems, 'sisa_hari_ini', c_daily - v_n - 1,
                                     'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.claim_ad_reward(text) from public, anon;
grant execute on function public.claim_ad_reward(text) to authenticated;

create or replace function public.ad_reward_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems constant bigint := 5; c_daily constant int := 5; c_gap_secs constant int := 60;
  v_uid uuid := auth.uid(); v_start timestamptz := public._wib_day_start(); v_n int; v_last timestamptz; v_wait int := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*), max(created_at) into v_n, v_last
    from public.wallet_ledger where user_id = v_uid and reason = 'ad' and created_at >= v_start;
  if v_last is not null and now() < v_last + make_interval(secs => c_gap_secs) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => c_gap_secs)) - now()))::int;
  end if;
  return jsonb_build_object('gems', c_gems, 'cap', c_daily, 'left', greatest(c_daily - v_n, 0), 'tunggu_detik', v_wait,
                            'tz', 'Asia/Jakarta', 'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.ad_reward_get() from public, anon;
grant execute on function public.ad_reward_get() to authenticated;
