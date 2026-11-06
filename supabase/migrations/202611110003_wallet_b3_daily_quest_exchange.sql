-- Dompet server, TAHAP B3 (HANYA SERVER, klien belum disentuh). Terapkan SETELAH 202611110002_wallet_b2_server.sql.
--
-- Isi:
--   1. Hari server tetap WIB (Asia/Jakarta): _wib_today(). Tanggal TIDAK pernah diterima dari klien.
--   2. Daily reward 7 hari: player_daily_reward + daily_reward_get() + claim_daily_reward(). Tabel hadiah ada di server.
--   3. Misi harian: player_quest + quest_get/quest_track/quest_claim/quest_claim_all/quest_claim_bonus. Nominal di server.
--   4. Tukar gem -> koin dengan paket tetap: exchange_gems(pack). (Pengganti PD.addCurrency lokal di shop/profile/
--      leaderboard/inventory yang kodenya berlabel mock tetapi berjalan.)
--
-- "Hadiahkan item ke teman" TIDAK punya RPC: temannya palsu (Budi/Sari/Rafi/Nina), jadi dimatikan di klien untuk akun login.
--
-- PENTING (jangan dicampur): klien MASIH memakai saldo lokal sampai B5. Selama itu dompet server terisi tapi belum dibaca.
-- Saat B5, SEMUA jalur pemasukan/pengeluaran lokal pindah sekaligus (daily, misi, tukar gem, achievement, boss, toko);
-- memindahkan sebagian saja = hadiah hilang (saldo lokal ditimpa) atau terhitung dua kali.
-- Batas kepercayaan: progres misi 'play'/'win' dilaporkan klien (lawan CPU tidak bisa diverifikasi). Kerugian dibatasi
-- oleh tujuan misi (maks 375 koin/hari lewat nominal server); pembatasan lebih ketat = B4.

-- ============ 1. Hari server (WIB) ============
create or replace function public._wib_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;
revoke all on function public._wib_today() from public, anon, authenticated;

create or replace function public._secs_to_wib_reset() returns int
language sql stable as $$
  select ceil(extract(epoch from
    (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '1 day') - (now() at time zone 'Asia/Jakarta')))::int
$$;
revoke all on function public._secs_to_wib_reset() from public, anon, authenticated;

-- ============ 2. Daily reward ============
create table if not exists public.player_daily_reward (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  claimed         int  not null default 0 check (claimed between 0 and 7),   -- hari yang sudah diklaim di putaran ini
  last_claim_date date,                                                      -- tanggal WIB klaim terakhir (DATE, bukan timestamp)
  box             int  not null default 0 check (box >= 0),                  -- Mystery Box (hari 3); belum ada konsumen di klien
  updated_at      timestamptz not null default now()
);
alter table public.player_daily_reward enable row level security;
revoke all on public.player_daily_reward from anon, authenticated;

-- Hari putaran yang sah SEKARANG (tanpa menulis). Sama dengan sync() di dailyreward.html, tetapi pakai jam server.
create or replace function public._daily_effective_claimed(p_claimed int, p_last date) returns int
language sql stable as $$
  select case when p_last is null then 0
              when public._wib_today() - p_last > 1 or p_claimed >= 7 then 0   -- lewat sehari / putaran selesai -> mulai Hari 1
              else p_claimed end
$$;
revoke all on function public._daily_effective_claimed(int, date) from public, anon, authenticated;

create or replace function public.daily_reward_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_r public.player_daily_reward; v_today date := public._wib_today(); v_eff int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_r from public.player_daily_reward where user_id = v_uid;
  if not found then v_r.claimed := 0; v_r.last_claim_date := null; v_r.box := 0; end if;
  v_eff := public._daily_effective_claimed(v_r.claimed, v_r.last_claim_date);
  return jsonb_build_object(
    'claimed', case when v_r.last_claim_date = v_today then v_r.claimed else v_eff end,  -- jumlah hari yang tampak diklaim
    'claimed_today', coalesce(v_r.last_claim_date = v_today, false),
    'next_day', case when v_r.last_claim_date = v_today then null else v_eff + 1 end,     -- 1..7, null bila sudah klaim hari ini
    'today', v_today, 'tz', 'Asia/Jakarta', 'seconds_to_reset', public._secs_to_wib_reset(), 'box', v_r.box);
end;
$$;
revoke all on function public.daily_reward_get() from public, anon;
grant execute on function public.daily_reward_get() to authenticated;

-- Tabel hadiah (= array R di dailyreward.html):
--   1: 50 gem | 2: 1000 koin | 3: Mystery Box | 4: dice.rumput (duplikat -> 100 koin) | 5: dice.emas (dup -> 300 koin)
--   6: 2000 koin | 7: skin.ender (dup -> 100 gem)
create or replace function public.claim_daily_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := public._wib_today();
  v_r     public.player_daily_reward;
  v_idx   int;
  v_dc    bigint := 0;
  v_dg    bigint := 0;
  v_item  text;
  v_type  text;
  v_dup   boolean := false;
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
    when 0 then v_type := 'gem';  v_dg := 50;
    when 1 then v_type := 'coin'; v_dc := 1000;
    when 2 then v_type := 'box';
    when 3 then v_type := 'dice'; v_item := 'dice.rumput';
    when 4 then v_type := 'dice'; v_item := 'dice.emas';
    when 5 then v_type := 'coin'; v_dc := 2000;
    else        v_type := 'skin'; v_item := 'skin.ender';
  end case;

  if v_item is not null then
    v_dup := exists (select 1 from public.player_inventory where user_id = v_uid and item_id = v_item);
    if v_dup then
      case v_item when 'dice.rumput' then v_dc := 100; when 'dice.emas' then v_dc := 300; else v_dg := 100; end case;
    end if;
  end if;

  -- Kunci idempoten per tanggal WIB: klaim kedua di hari yang sama tidak mungkin, walau logika streak salah.
  v_res := public._wallet_apply(v_uid, v_dc, v_dg, 'daily', v_today::text);
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;

  if v_item is not null and not v_dup then
    insert into public.player_inventory(user_id, item_id) values (v_uid, v_item) on conflict (user_id, item_id) do nothing;
  end if;

  update public.player_daily_reward
     set claimed = v_idx + 1, last_claim_date = v_today, box = box + (case when v_type = 'box' then 1 else 0 end),
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'day', v_idx + 1, 'type', v_type, 'item', v_item, 'duplicate', v_dup,
                            'coins', v_dc, 'gems', v_dg, 'box', v_type = 'box',
                            'wallet_coins', (v_res ->> 'coins')::bigint, 'wallet_gems', (v_res ->> 'gems')::bigint,
                            'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.claim_daily_reward() from public, anon;
grant execute on function public.claim_daily_reward() to authenticated;

-- ============ 3. Misi harian (reset 00.00 WIB, sama dengan daily reward) ============
create table if not exists public.player_quest (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  day        date not null,
  prog_login int  not null default 0 check (prog_login between 0 and 1),
  prog_play  int  not null default 0 check (prog_play  between 0 and 1),
  prog_win   int  not null default 0 check (prog_win   between 0 and 3),
  claimed    text[] not null default '{}',
  bonus      boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.player_quest enable row level security;
revoke all on public.player_quest from anon, authenticated;

-- Pastikan baris ada, reset bila hari WIB berganti, kunci baris. Dipanggil di awal tiap RPC misi.
create or replace function public._quest_roll(p_user uuid) returns public.player_quest
language plpgsql security definer set search_path = public as $$
declare v_q public.player_quest; v_today date := public._wib_today();
begin
  insert into public.player_quest(user_id, day) values (p_user, v_today) on conflict (user_id) do nothing;
  update public.player_quest
     set day = v_today, prog_login = 0, prog_play = 0, prog_win = 0, claimed = '{}', bonus = false, updated_at = now()
   where user_id = p_user and day <> v_today;
  select * into v_q from public.player_quest where user_id = p_user for update;
  return v_q;
end;
$$;
revoke all on function public._quest_roll(uuid) from public, anon, authenticated;

create or replace function public._quest_json(p_q public.player_quest) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'day', p_q.day, 'seconds_to_reset', public._secs_to_wib_reset(),
    'quests', jsonb_build_array(
      jsonb_build_object('id','login','goal',1,'reward',50,  'progress',p_q.prog_login,
        'status', case when 'login' = any(p_q.claimed) then 'claimed' when p_q.prog_login >= 1 then 'ready' else 'todo' end),
      jsonb_build_object('id','play', 'goal',1,'reward',75,  'progress',p_q.prog_play,
        'status', case when 'play'  = any(p_q.claimed) then 'claimed' when p_q.prog_play  >= 1 then 'ready' else 'todo' end),
      jsonb_build_object('id','win',  'goal',3,'reward',150, 'progress',p_q.prog_win,
        'status', case when 'win'   = any(p_q.claimed) then 'claimed' when p_q.prog_win   >= 3 then 'ready' else 'todo' end)),
    'bonus', jsonb_build_object('reward', 100,
      'status', case when p_q.bonus then 'claimed'
                     when p_q.claimed @> array['login','play','win'] then 'ready' else 'locked' end))
$$;
revoke all on function public._quest_json(public.player_quest) from public, anon, authenticated;

create or replace function public.quest_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.player_quest;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_q := public._quest_roll(v_uid);
  return public._quest_json(v_q);
end;
$$;
revoke all on function public.quest_get() from public, anon;
grant execute on function public.quest_get() to authenticated;

-- Klien hanya menyebut JENIS kejadian; progres naik 1 dan dibatasi tujuan. 'win' juga menghitung sebagai 'play' (sama dgn klien lama).
create or replace function public.quest_track(p_type text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.player_quest;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('login', 'play', 'win') then raise exception 'BAD_QUEST_TYPE'; end if;
  v_q := public._quest_roll(v_uid);
  update public.player_quest set
    prog_login = case when p_type = 'login' then 1 else prog_login end,
    prog_play  = case when p_type in ('play', 'win') then 1 else prog_play end,
    prog_win   = case when p_type = 'win' then least(prog_win + 1, 3) else prog_win end,
    updated_at = now()
  where user_id = v_uid
  returning * into v_q;
  return public._quest_json(v_q);
end;
$$;
revoke all on function public.quest_track(text) from public, anon;
grant execute on function public.quest_track(text) to authenticated;

-- Klaim satu misi. Idempoten: ref = tanggal:id (klaim kedua -> ditolak).
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
  return jsonb_build_object('ok', true, 'id', p_id, 'coins', v_reward,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim(text) from public, anon;
grant execute on function public.quest_claim(text) to authenticated;

-- Klaim semua misi yang siap (setara UT.Quest.claimAll).
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
  if not (v_q.claimed @> array['login', 'play', 'win']) then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;

  v_w := public._wallet_apply(v_uid, 100, 0, 'quest_bonus', v_q.day::text);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  update public.player_quest set bonus = true, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'coins', 100,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim_bonus() from public, anon;
grant execute on function public.quest_claim_bonus() to authenticated;

-- ============ 4. Tukar gem -> koin (paket tetap) ============
--   paket 0: 10 gem -> 500 koin | 1: 40 -> 2.500 | 2: 120 -> 10.000   (sama dengan packs di shop/profile/leaderboard/inventory)
-- Bisa diulang, jadi ref_key = nomor urut penukaran (aman karena baris dompet dikunci).
create or replace function public.exchange_gems(p_pack int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems  constant bigint[] := array[10, 40, 120];
  c_coins constant bigint[] := array[500, 2500, 10000];
  v_uid uuid := auth.uid(); v_n int; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pack is null or p_pack < 0 or p_pack > 2 then return jsonb_build_object('ok', false, 'reason', 'paket-tidak-valid'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) + 1 into v_n from public.wallet_ledger where user_id = v_uid and reason = 'exchange';

  begin
    v_res := public._wallet_apply(v_uid, c_coins[p_pack + 1], -c_gems[p_pack + 1], 'exchange', 'ex#' || v_n);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_GEMS' then
      return jsonb_build_object('ok', false, 'reason', 'gem-kurang',
        'kurang', c_gems[p_pack + 1] - (select gems from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'pack', p_pack, 'spent_gems', c_gems[p_pack + 1], 'got_coins', c_coins[p_pack + 1],
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.exchange_gems(int) from public, anon;
grant execute on function public.exchange_gems(int) to authenticated;
