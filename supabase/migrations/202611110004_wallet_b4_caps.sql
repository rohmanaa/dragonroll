-- Dompet server, TAHAP B4 (HANYA SERVER, klien belum disentuh). Terapkan SETELAH 202611110003_wallet_b3_daily_quest_exchange.sql.
--
-- Tujuan: hadiah yang TIDAK bisa diverifikasi server (game jalan di browser) diberi batas harian per akun, supaya
-- skrip/devtools tidak bisa mencetak koin tanpa batas. Hari = WIB (Asia/Jakarta), sama dengan daily reward & misi.
--
-- Isi:
--   1. claim_cpu_boss_reward(token): hadiah mengalahkan boss di match lawan CPU (500 koin + 10 gem, = Config.DRAGON_REWARD).
--      Satu klaim per token match (idempoten), maks 5 per hari WIB, jarak antar klaim minimal 180 detik
--      (satu match penuh dengan fase boss makin lama dari itu; lihat game/doc/BALANCE_DURASI_BOSS.md).
--   2. claim_boss_reward (B2, match online) dipindah ke hari WIB; batas 10/hari tetap.
--   3. reward_caps_get(): sisa jatah hari ini + hitung mundur reset, untuk UI.
--
-- Chest BUKAN sumber pemasukan: CHEST_POOL aktif (game/gameplay/config.js) tidak punya entri koin/XP/gem, dan tidak ada
-- penimpaan lain di repo. Cabang 'coin'/'xp'/'gems' di applyChestReward (gameplay.html) hanyalah kode mati, jadi tidak ada
-- RPC chest. Di B5 cabang itu harus tidak memanggil PD.grant untuk akun login, supaya config yang berubah nanti tidak
-- membuka celah baru.
--
-- Batas kepercayaan: ini membatasi kerugian, BUKAN anti-cheat. Pemain nakal tetap bisa mengklaim sampai batas harian
-- (maks 5 x 500 koin + 5 x 10 gem lawan CPU). Validasi penuh = tahap C. Batas (c_daily, c_gap_secs) ada di fungsi; ubah di sana.

create or replace function public._wib_day_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
$$;
revoke all on function public._wib_day_start() from public, anon, authenticated;

-- ============ 1. Hadiah boss lawan CPU ============
create or replace function public.claim_cpu_boss_reward(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_coins    constant bigint := 500;   -- = Config.DRAGON_REWARD.coins di klien
  c_gems     constant bigint := 10;    -- = Config.DRAGON_REWARD.gems
  c_daily    constant int    := 5;     -- batas klaim per akun per hari WIB
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

-- ============ 2. claim_boss_reward (online): hari WIB ============
-- Sama dengan versi 202611110002; satu-satunya perubahan: awal hari = 00.00 WIB (bukan 00.00 UTC).
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

-- ============ 3. Sisa jatah hari ini (untuk UI) ============
create or replace function public.reward_caps_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_cpu_daily constant int := 5; c_online_daily constant int := 10;
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
