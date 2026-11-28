-- Login harian 30 hari (dari 7 hari). Idempotent (create or replace / drop constraint if exists).
--   * Streak KETAT: bolos 1 hari (tanggal WIB) -> kembali ke Hari 1. Aturan ini sudah ada di _daily_effective_claimed; hanya batas putaran 7 -> 30.
--   * Hari 1-7 TIDAK berubah (nominal sama dengan fase 1), jadi pemain yang sedang di tengah putaran lama tidak dirugikan:
--     akun dengan claimed = 7 yang login tanpa bolos kini lanjut ke Hari 8, bukan mulai dari 1.
--   * Setelah Hari 30 putaran mulai lagi dari Hari 1.
--   * Tabel hadiah ada di SATU tempat: _daily_reward_for(hari). Klien (assets/js/pages/hadiah-misi.js, array R) hanya label tampilan;
--     tests/daily-reward-30.test.js memastikan keduanya sama. Tipe: coin | gem | box (Mystery Box, +1 box) | mix (koin + gem).
--
--   Hari : hadiah
--    1: 300 koin        2: 500 koin        3: Mystery Box     4: 5 gem          5: 800 koin       6: 10 gem        7: 2.000 koin + 15 gem
--    8: 400 koin        9: 600 koin       10: 8 gem          11: 1.000 koin    12: Mystery Box   13: 12 gem      14: 3.000 koin + 20 gem
--   15: 500 koin       16: 700 koin       17: 10 gem         18: 1.200 koin    19: Mystery Box   20: 15 gem      21: 4.000 koin + 25 gem
--   22: 600 koin       23: 800 koin       24: 12 gem         25: FRAME         26: Mystery Box   27: 18 gem      28: 3.000 koin + 20 gem
--   29: 2.000 koin     30: 6.000 koin + 50 gem
--   (Hari 25 sekarang = 1 Frame eksklusif, hadiah tersendiri; kalau semua frame sudah dimiliki diganti 1.500 koin. Lihat bawah.)
--
-- Frame Hari 25: ada 15 frame hadiah (urutan di _daily_frame_order). Tiap kali pemain mencapai Hari 25 dia mendapat frame
-- pertama dalam urutan yang BELUM dimilikinya: putaran ke-1 = Naga Api, ke-2 = Batu Tua, dst. Setelah semuanya dimiliki,
-- Hari 25 diganti 1.500 koin (nominal lama Hari 25). Harga null + bukan starter = tidak bisa dibeli di Toko; hanya claim_daily_reward yang memberikannya.
-- (Sumber kebenaran katalog klien: assets/js/item-catalog.js; tools/wallet/gen-item-seed.js --check menjaganya sama.)
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('frame.nagaapi', 'frame', null, false, false),
  ('frame.batutua', 'frame', null, false, false),
  ('frame.perunggu', 'frame', null, false, false),
  ('frame.tembagaukir', 'frame', null, false, false),
  ('frame.peraksayap', 'frame', null, false, false),
  ('frame.emasrubi', 'frame', null, false, false),
  ('frame.kristalsafir', 'frame', null, false, false),
  ('frame.zamrudrambat', 'frame', null, false, false),
  ('frame.rubikerajaan', 'frame', null, false, false),
  ('frame.batusenja', 'frame', null, false, false),
  ('frame.bintangsafir', 'frame', null, false, false),
  ('frame.hutanzamrud', 'frame', null, false, false),
  ('frame.mahkotarubi', 'frame', null, false, false),
  ('frame.bayanganender', 'frame', null, false, false),
  ('frame.sayapsurgawi', 'frame', null, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;

create or replace function public._daily_frame_order() returns text[]
language sql immutable as $$
  select array[
  'frame.nagaapi',
  'frame.batutua',
  'frame.perunggu',
  'frame.tembagaukir',
  'frame.peraksayap',
  'frame.emasrubi',
  'frame.kristalsafir',
  'frame.zamrudrambat',
  'frame.rubikerajaan',
  'frame.batusenja',
  'frame.bintangsafir',
  'frame.hutanzamrud',
  'frame.mahkotarubi',
  'frame.bayanganender',
  'frame.sayapsurgawi'
  ]
$$;
revoke all on function public._daily_frame_order() from public, anon, authenticated;

alter table public.player_daily_reward drop constraint if exists player_daily_reward_claimed_check;
alter table public.player_daily_reward add constraint player_daily_reward_claimed_check check (claimed between 0 and 30);

-- Hari putaran yang sah SEKARANG (tanpa menulis): lewat sehari (WIB) atau putaran 30 hari selesai -> mulai Hari 1.
create or replace function public._daily_effective_claimed(p_claimed int, p_last date) returns int
language sql stable as $$
  select case when p_last is null then 0
              when public._wib_today() - p_last > 1 or p_claimed >= 30 then 0
              else p_claimed end
$$;
revoke all on function public._daily_effective_claimed(int, date) from public, anon, authenticated;

-- Tabel hadiah 30 hari -> (tipe, koin, gem). Hari di luar 1..30 jatuh ke Hari 1.
create or replace function public._daily_reward_for(p_day int) returns table(type text, coins bigint, gems bigint)
language sql immutable as $$
  select v.type, v.coins::bigint, v.gems::bigint
    from (values
      ( 1,'coin',  300,  0), ( 2,'coin',  500,  0), ( 3,'box',     0,  0), ( 4,'gem',     0,  5), ( 5,'coin',  800,  0),
      ( 6,'gem',     0, 10), ( 7,'mix',  2000, 15), ( 8,'coin',  400,  0), ( 9,'coin',  600,  0), (10,'gem',     0,  8),
      (11,'coin', 1000,  0), (12,'box',     0,  0), (13,'gem',     0, 12), (14,'mix',  3000, 20), (15,'coin',  500,  0),
      (16,'coin',  700,  0), (17,'gem',     0, 10), (18,'coin', 1200,  0), (19,'box',     0,  0), (20,'gem',     0, 15),
      (21,'mix',  4000, 25), (22,'coin',  600,  0), (23,'coin',  800,  0), (24,'gem',     0, 12), (25,'frame',   0,  0),
      (26,'box',     0,  0), (27,'gem',     0, 18), (28,'mix',  3000, 20), (29,'coin', 2000,  0), (30,'mix',  6000, 50)
    ) as v(day, type, coins, gems)
   where v.day = case when p_day between 1 and 30 then p_day else 1 end
$$;
revoke all on function public._daily_reward_for(int) from public, anon, authenticated;

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
  v_item  text := null;
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

  v_idx := public._daily_effective_claimed(v_r.claimed, v_r.last_claim_date);   -- 0..29

  select r.type, r.coins, r.gems into v_type, v_dc, v_dg from public._daily_reward_for(v_idx + 1) r;

  -- Hari 25 (type 'frame'): frame eksklusif pertama dalam urutan yang belum dimiliki; semua sudah dimiliki -> 1.500 koin.
  if v_type = 'frame' then
    select t.f into v_item
      from unnest(public._daily_frame_order()) with ordinality as t(f, n)
     where not exists (select 1 from public.player_inventory i where i.user_id = v_uid and i.item_id = t.f)
     order by t.n limit 1;
    if v_item is null then v_dc := 1500; end if;
  end if;

  -- Kunci idempoten per tanggal WIB: klaim kedua di hari yang sama tidak mungkin, walau logika streak salah.
  v_res := public._wallet_apply(v_uid, v_dc, v_dg, 'daily', v_today::text);
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;

  update public.player_daily_reward
     set claimed = v_idx + 1, last_claim_date = v_today, box = box + (case when v_type = 'box' then 1 else 0 end),
         updated_at = now()
   where user_id = v_uid;

  if v_item is not null then
    insert into public.player_inventory(user_id, item_id) values (v_uid, v_item) on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'day', v_idx + 1, 'type', v_type, 'item', v_item, 'duplicate', false,
                            'coins', v_dc, 'gems', v_dg, 'box', v_type = 'box',
                            'wallet_coins', (v_res ->> 'coins')::bigint, 'wallet_gems', (v_res ->> 'gems')::bigint,
                            'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.claim_daily_reward() from public, anon;
grant execute on function public.claim_daily_reward() to authenticated;
