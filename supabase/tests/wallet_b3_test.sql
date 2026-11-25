-- Tes migrasi 202611110003_wallet_b3_daily_quest_exchange.sql. Jalankan sebagai superuser di DB UJI (bukan produksi)
-- yang SUDAH memuat migrasi sampai 202611110003. Kegagalan assert menghentikan skrip (psql -v ON_ERROR_STOP=1).
-- Pergantian hari disimulasikan dengan memundurkan last_claim_date / day sebagai superuser (now() tetap dalam transaksi).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- Simulasi pergantian hari: mundurkan tanggal klaim terakhir DAN kunci ledger harian sebanyak n hari (now() tetap dalam transaksi).
create function pg_temp.skip_days(u uuid, n int) returns void language sql as $f$
  update public.player_daily_reward set last_claim_date = last_claim_date - n where user_id = u;
  update public.wallet_ledger set ref_key = ((ref_key::date) - n)::text
   where user_id = u and reason = 'daily' and ref_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
$f$;

-- ===== DAILY REWARD =====
-- Siklus 30 hari; hadiah tiap hari dibaca dari _daily_reward_for (bukan di-hardcode, jadwal sengaja berubah di migrasi ekonomi).
insert into out select 'r' || n, jsonb_build_object('type', r.type, 'coins', r.coins, 'gems', r.gems)
  from generate_series(1, 4) n, lateral public._daily_reward_for(n) r;
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'd1', public.claim_daily_reward();          -- hari 1
insert into out select 'd1again', public.claim_daily_reward();     -- hari yang sama: ditolak
insert into out select 'get_after', public.daily_reward_get();
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='d1') = 'true' and (select v->>'day' from out where k='d1') = '1', 'hari 1 harus ok';
  assert (select gems from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = (select (v->>'gems')::bigint from out where k='r1'), 'hari 1 = gems sesuai jadwal';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 1000 + (select (v->>'coins')::bigint from out where k='r1'), 'hari 1 = koin sesuai jadwal';
  assert (select v->>'reason' from out where k='d1again') = 'sudah-klaim', 'klaim ganda sehari ditolak';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 1000 + (select (v->>'coins')::bigint from out where k='r1'), 'klaim ganda tidak mengubah koin';
  assert (select (v->>'claimed_today')::boolean from out where k='get_after'), 'status harus claimed_today';
  assert (select (v->>'seconds_to_reset')::int from out where k='get_after') between 1 and 86400, 'hitung mundur 1..86400 detik';
end $$;

-- hari berikutnya: lanjut streak (hari 2), lalu hari 3 = Mystery Box
select pg_temp.skip_days('bbbbbbbb-0000-0000-0000-000000000001', 1);
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'd2', public.claim_daily_reward();
reset role;
select pg_temp.skip_days('bbbbbbbb-0000-0000-0000-000000000001', 1);
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'd3', public.claim_daily_reward();
reset role;
do $$ begin
  assert (select v->>'day' from out where k='d2') = '2', 'streak berlanjut ke hari 2';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 1000 + (select (v->>'coins')::bigint from out where k='r1') + (select (v->>'coins')::bigint from out where k='r2'), 'hari 2 = koin sesuai jadwal';
  assert (select v->>'type' from out where k='d3') = 'box' and (select v->>'type' from out where k='r3') = 'box', 'hari 3 = box';
  assert (select box from public.player_daily_reward where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 1;
end $$;

-- lewat >1 hari (3 hari): putaran mulai lagi dari hari 1
select pg_temp.skip_days('bbbbbbbb-0000-0000-0000-000000000001', 3);
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'get_gap', public.daily_reward_get();
insert into out select 'd_reset', public.claim_daily_reward();
reset role;
do $$ begin
  assert (select (v->>'next_day')::int from out where k='get_gap') = 1, 'lewat sehari -> next_day 1';
  assert (select v->>'day' from out where k='d_reset') = '1', 'streak putus -> hari 1';
end $$;

-- hari 4: hadiah sesuai jadwal (gems)
update public.player_daily_reward set claimed = 3 where user_id='bbbbbbbb-0000-0000-0000-000000000001';
insert into out select 'w0', jsonb_build_object('c', coins, 'g', gems) from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.skip_days('bbbbbbbb-0000-0000-0000-000000000001', 1);
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'd4', public.claim_daily_reward();
reset role;
do $$ begin
  assert (select v->>'day' from out where k='d4') = '4' and (select (v->>'duplicate')::boolean from out where k='d4') = false;
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = (select (v->>'c')::bigint from out where k='w0') + (select (v->>'coins')::bigint from out where k='r4'), 'hari 4 = koin sesuai jadwal';
  assert (select gems from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = (select (v->>'g')::bigint from out where k='w0') + (select (v->>'gems')::bigint from out where k='r4'), 'hari 4 = gems sesuai jadwal';
end $$;

-- hari 30: frame eksklusif pertama dalam urutan yang belum dimiliki masuk inventory
update public.player_daily_reward set claimed = 29 where user_id='bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.skip_days('bbbbbbbb-0000-0000-0000-000000000001', 1);
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'd30', public.claim_daily_reward();
reset role;
do $$ begin
  assert (select v->>'day' from out where k='d30') = '30', 'hari 30';
  assert (select v->>'item' from out where k='d30') is not null, 'hari 30 memberi frame eksklusif';
  assert exists (select 1 from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000001' and item_id = (select v->>'item' from out where k='d30')), 'frame hari 30 masuk inventory';
end $$;

-- ===== MISI =====
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into out select 'q_early', public.quest_claim('login');       -- belum ada progres
insert into out select 'q_track', public.quest_track('login');
-- reward misi dibaca dari respons server (nilainya sengaja berubah di migrasi ekonomi), bukan di-hardcode
insert into out select 'rw', jsonb_build_object(
  'login', (select (e->>'reward')::int from jsonb_array_elements(v->'quests') e where e->>'id'='login'),
  'play',  (select (e->>'reward')::int from jsonb_array_elements(v->'quests') e where e->>'id'='play'),
  'win',   (select (e->>'reward')::int from jsonb_array_elements(v->'quests') e where e->>'id'='win'),
  'bonus', (v->'bonus'->>'reward')::int, 'bgems', (v->'bonus'->>'gems')::int)
  from out where k='q_track';
insert into out select 'q_claim', public.quest_claim('login');       -- +50
insert into out select 'q_dup', public.quest_claim('login');         -- ganda
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='q_early') = 'belum-selesai';
  assert (select (v->>'coins')::int from out where k='q_claim') = (select (v->>'login')::int from out where k='rw'), 'misi login = reward login';
  assert (select v->>'reason' from out where k='q_dup') = 'sudah-klaim';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000002') = 1000 + (select (v->>'login')::int from out where k='rw'), 'misi login = reward login sekali';
end $$;
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
select public.quest_track('win'); select public.quest_track('win'); select public.quest_track('win'); select public.quest_track('win'); -- maks 3
insert into out select 'q_all', public.quest_claim_all();            -- play 75 + win 150
-- bonus baru terbuka bila SEMUA misi harian (kini 8) diklaim; quest_track hanya menandai login/play/win,
-- jadi misi lain ditandai sudah diklaim langsung sebagai superuser (tanpa hadiah koin)
reset role;
update public.player_quest set claimed = (select array_agg(id::text) from public._quest_defs()) where user_id='bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into out select 'q_bonus', public.quest_claim_bonus();        -- bonus
insert into out select 'q_bonus2', public.quest_claim_bonus();
reset role;
do $$ begin
  assert (select (v->>'coins')::int from out where k='q_all') = (select (v->>'play')::int + (v->>'win')::int from out where k='rw'), 'claim_all = reward play + win';
  assert (select (v->>'ok')::boolean from out where k='q_bonus');
  assert (select v->>'reason' from out where k='q_bonus2') = 'sudah-klaim';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000002') = 1000 + (select (v->>'login')::int + (v->>'play')::int + (v->>'win')::int + (v->>'bonus')::int from out where k='rw'), 'total misi + bonus';
  assert (select prog_win from public.player_quest where user_id='bbbbbbbb-0000-0000-0000-000000000002') = 3, 'progres win dibatasi 3';
end $$;
-- hari WIB berganti: misi direset
update public.player_quest set day = day - 1 where user_id='bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into out select 'q_new', public.quest_get();
reset role;
do $$ begin
  assert (select v #>> '{quests,0,status}' from out where k='q_new') = 'todo', 'hari baru -> misi todo lagi';
  assert (select v #>> '{bonus,status}' from out where k='q_new') = 'locked';
end $$;
-- jenis tidak dikenal ditolak
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.quest_track('boss'); assert false, 'jenis tak dikenal harus ditolak';
  exception when others then assert sqlerrm = 'BAD_QUEST_TYPE', sqlerrm; end;
end $$;
reset role;

-- ===== TUKAR GEM =====
update public.player_wallet set gems = 45 where user_id='bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into out select 'x1', public.exchange_gems(1);                -- 40 gem -> 2000
insert into out select 'x2', public.exchange_gems(1);                -- sisa 5 gem: kurang
insert into out select 'x3', public.exchange_gems(7);                -- paket tidak valid
reset role;
do $$ begin
  assert (select (v->>'got_coins')::int from out where k='x1') = 2000, 'paket 1: 40 gem -> 2.000 koin';
  assert (select gems from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000002') = 5, 'gem berkurang 40';
  assert (select v->>'reason' from out where k='x2') = 'gem-kurang', 'gem kurang ditolak';
  assert (select v->>'reason' from out where k='x3') = 'paket-tidak-valid';
  assert (select count(*) from public.wallet_ledger where user_id='bbbbbbbb-0000-0000-0000-000000000002' and reason='exchange') = 1, 'penolakan tidak menulis ledger';
end $$;
update public.player_wallet set gems = 20 where user_id='bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
select public.exchange_gems(0); select public.exchange_gems(0);      -- dua kali berturut-turut boleh (ref berurutan)
reset role;
do $$ begin
  assert (select count(*) from public.wallet_ledger where user_id='bbbbbbbb-0000-0000-0000-000000000002' and reason='exchange') = 3;
  assert (select gems from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000002') = 0;
end $$;

-- ===== AKSES =====
set role authenticated;
do $$ begin
  begin perform 1 from public.player_daily_reward; assert false, 'klien tidak boleh membaca tabel langsung';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.player_quest; assert false, 'klien tidak boleh membaca tabel langsung';
  exception when insufficient_privilege then null; end;
  begin perform public._wib_today(); assert false, 'fungsi internal tidak boleh dipanggil klien';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.claim_daily_reward(); assert false, 'anon tidak boleh klaim';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
\echo 'wallet_b3_test: SEMUA LULUS'
