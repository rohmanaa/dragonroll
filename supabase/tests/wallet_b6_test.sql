-- Tes migrasi 202611120001_wallet_b6_ad_reward.sql. Jalankan di DB UJI (bukan produksi) yang SUDAH memuat migrasi sampai
-- 202611120001: psql -v ON_ERROR_STOP=1 -f supabase/tests/wallet_b6_test.sql. Kegagalan assert menghentikan skrip.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('dddddddd-0000-0000-0000-000000000001'), ('dddddddd-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated;
create function pg_temp.age_ledger(u uuid, secs int) returns void language sql as $f$
  update public.wallet_ledger set created_at = created_at - make_interval(secs => secs) where user_id = u and reason = 'ad';
$f$;

-- ===== klaim sah, token sama, terlalu cepat, token tidak valid =====
set role authenticated; select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',false);
insert into out select 'a1', public.claim_ad_reward('ad-aaaa-0001');
insert into out select 'a1again', public.claim_ad_reward('ad-aaaa-0001');
insert into out select 'a2fast', public.claim_ad_reward('ad-aaaa-0002');
insert into out select 'bad', public.claim_ad_reward('x');
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='a1') = 'true';
  assert (select gems  from public.player_wallet where user_id='dddddddd-0000-0000-0000-000000000001') = 5, '+5 emerald';
  assert (select coins from public.player_wallet where user_id='dddddddd-0000-0000-0000-000000000001') = 1000, 'koin tidak berubah';
  assert (select v->>'reason' from out where k='a1again') = 'sudah-klaim';
  assert (select v->>'reason' from out where k='a2fast') = 'terlalu-cepat';
  assert (select (v->>'tunggu_detik')::int from out where k='a2fast') between 1 and 60;
  assert (select v->>'reason' from out where k='bad') = 'token-tidak-valid';
  assert (select count(*) from public.wallet_ledger where user_id='dddddddd-0000-0000-0000-000000000001' and reason='ad') = 1;
end $$;

-- ===== batas harian: klaim 2..5 sah, ke-6 ditolak =====
do $$ declare i int; begin
  for i in 2..5 loop
    perform pg_temp.age_ledger('dddddddd-0000-0000-0000-000000000001', 600);
    perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',false);
    set local role authenticated;
    insert into out select 'cap' || i, public.claim_ad_reward('ad-bbbb-000' || i);
    reset role;
    assert (select v->>'ok' from out where k='cap' || i) = 'true', 'klaim ' || i || ' harus sah';
  end loop;
end $$;
select pg_temp.age_ledger('dddddddd-0000-0000-0000-000000000001', 600);
set role authenticated; select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000001',false);
insert into out select 'cap6', public.claim_ad_reward('ad-bbbb-0006');
insert into out select 'get', public.ad_reward_get();
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='cap6') = 'daily_cap';
  assert (select gems from public.player_wallet where user_id='dddddddd-0000-0000-0000-000000000001') = 25, 'maks 25 emerald/hari';
  assert (select (v->>'left')::int from out where k='get') = 0;
end $$;

-- ===== akun lain tidak terpengaruh; tanpa login ditolak =====
set role authenticated; select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000002',false);
insert into out select 'other', public.claim_ad_reward('ad-aaaa-0001');   -- token sama dengan akun 1, akun beda -> sah
reset role;
do $$ begin assert (select v->>'ok' from out where k='other') = 'true'; end $$;
set role authenticated; select set_config('request.jwt.claim.sub','',false);
do $$ begin
  begin perform public.claim_ad_reward('ad-cccc-0001'); assert false, 'harus gagal';
  exception when others then assert sqlerrm like '%AUTH_REQUIRED%' or sqlerrm like '%invalid input%', sqlerrm; end;
end $$;
reset role;
rollback;
