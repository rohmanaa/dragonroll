-- Tes migrasi 202611110004_wallet_b4_caps.sql. Jalankan sebagai superuser di DB UJI (bukan produksi) yang SUDAH memuat
-- migrasi sampai 202611110004. Kegagalan assert menghentikan skrip (psql -v ON_ERROR_STOP=1).
-- Jarak/hari disimulasikan dengan memundurkan wallet_ledger.created_at (now() tetap dalam transaksi).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('cccccccc-0000-0000-0000-000000000001'), ('cccccccc-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated;
create function pg_temp.age_ledger(u uuid, secs int) returns void language sql as $f$
  update public.wallet_ledger set created_at = created_at - make_interval(secs => secs) where user_id = u and reason = 'boss_cpu';
$f$;

-- ===== CPU BOSS: klaim sah, ganda, terlalu cepat =====
set role authenticated; select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
insert into out select 'c1', public.claim_cpu_boss_reward('dw-aaaa-0001');
insert into out select 'c1again', public.claim_cpu_boss_reward('dw-aaaa-0001');   -- token sama
insert into out select 'c2fast', public.claim_cpu_boss_reward('dw-aaaa-0002');    -- token baru, terlalu cepat
insert into out select 'bad', public.claim_cpu_boss_reward('x');                  -- token tidak valid
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='c1') = 'true';
  assert (select coins from public.player_wallet where user_id='cccccccc-0000-0000-0000-000000000001') = 1500, '+500 koin';
  assert (select gems  from public.player_wallet where user_id='cccccccc-0000-0000-0000-000000000001') = 10,   '+10 gem';
  assert (select v->>'reason' from out where k='c1again') = 'sudah-klaim', 'token sama tidak dobel';
  assert (select v->>'reason' from out where k='c2fast') = 'terlalu-cepat', 'jarak minimal antar klaim';
  assert (select (v->>'tunggu_detik')::int from out where k='c2fast') between 1 and 180;
  assert (select v->>'reason' from out where k='bad') = 'token-tidak-valid';
  assert (select count(*) from public.wallet_ledger where user_id='cccccccc-0000-0000-0000-000000000001' and reason='boss_cpu') = 1, 'penolakan tidak menulis ledger';
end $$;

-- ===== batas harian: klaim 2..5 sah (jarak dipenuhi), ke-6 ditolak =====
do $$ declare i int; begin
  for i in 2..5 loop
    perform pg_temp.age_ledger('cccccccc-0000-0000-0000-000000000001', 600);
    perform set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
    set local role authenticated;
    insert into out select 'cap' || i, public.claim_cpu_boss_reward('dw-bbbb-000' || i);
    reset role;
    assert (select v->>'ok' from out where k='cap' || i) = 'true', 'klaim ' || i || ' harus sah';
  end loop;
end $$;
select pg_temp.age_ledger('cccccccc-0000-0000-0000-000000000001', 600);
set role authenticated; select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
insert into out select 'cap6', public.claim_cpu_boss_reward('dw-bbbb-0006');
insert into out select 'caps', public.reward_caps_get();
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='cap6') = 'daily_cap', 'klaim ke-6 hari yang sama ditolak';
  assert (select coins from public.player_wallet where user_id='cccccccc-0000-0000-0000-000000000001') = 1000 + 5*500, 'tepat 5 klaim';
  assert (select (v->>'boss_cpu_left')::int from out where k='caps') = 0, 'sisa jatah 0';
  assert (select (v->>'boss_online_left')::int from out where k='caps') = 10;
end $$;

-- hari WIB berganti (ledger mundur >1 hari): jatah pulih
select pg_temp.age_ledger('cccccccc-0000-0000-0000-000000000001', 2*86400);
set role authenticated; select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
insert into out select 'newday', public.claim_cpu_boss_reward('dw-cccc-0001');
reset role;
do $$ begin assert (select v->>'ok' from out where k='newday') = 'true', 'hari baru -> jatah pulih'; end $$;

-- ===== akun lain tidak terpengaruh; akses =====
set role authenticated; select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000002',false);
insert into out select 'other', public.claim_cpu_boss_reward('dw-dddd-0001');
reset role;
do $$ begin assert (select v->>'ok' from out where k='other') = 'true', 'cap per akun'; end $$;
set role anon;
do $$ begin
  begin perform public.claim_cpu_boss_reward('dw-eeee-0001'); assert false, 'anon tidak boleh klaim';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform public._wib_day_start(); assert false, 'fungsi internal tidak boleh dipanggil klien';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
\echo 'wallet_b4_test: SEMUA LULUS'
