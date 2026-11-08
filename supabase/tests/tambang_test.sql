-- Tes migrasi 202611180001_tambang.sql. Jalankan di DB UJI (bukan produksi) yang SUDAH memuat migrasi sampai 202611160001:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/tambang_test.sql      Kegagalan assert menghentikan skrip.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('eeeeeeee-0000-0000-0000-000000000001'), ('eeeeeeee-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- ===== akun A: awal 1000 koin; semua slot terkunci =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'get0', public.mine_get();
insert into out select 'u1', public.mine_unlock(1);
insert into out select 'u1again', public.mine_unlock(1);
insert into out select 'u3poor', public.mine_unlock(3);
insert into out select 'u9', public.mine_unlock(9);
reset role;
do $$ declare c bigint; begin
  assert (select v->'slots'->0->>'unlocked' from out where k='get0') = 'false', 'slot 1 awal terkunci';
  assert (select jsonb_array_length(v->'slots') from out where k='get0') = 3;
  assert (select (v->'config'->>'boost_daily')::int from out where k='get0') = 2, 'konfigurasi dikirim server';
  assert (select v->>'ok' from out where k='u1') = 'true';
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 500, 'buka slot 1 = 500 koin';
  assert (select v->>'reason' from out where k='u1again') = 'sudah-dibuka';
  assert (select v->>'reason' from out where k='u3poor') = 'saldo-kurang';
  assert (select v->>'reason' from out where k='u9') = 'slot-tidak-valid';
  assert (select count(*) from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001') = 1;
end $$;

-- ===== produksi per jam + collect (10 jam x 0.20 = 2.0) =====
update public.player_mines set stock_at = now() - interval '10 hours' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'g10h', public.mine_get();
insert into out select 'c1', public.mine_collect(1);
insert into out select 'c2', public.mine_collect(1);
insert into out select 'c3locked', public.mine_collect(2);
reset role;
do $$ begin
  assert (select (v->'slots'->0->>'stock')::numeric from out where k='g10h') between 1.99 and 2.01, 'stok 10 jam ~2.0';
  assert (select v->>'collected' from out where k='c1') = '2', 'collect 2 emerald';
  assert (select gems from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 2;
  assert (select v->>'reason' from out where k='c2') = 'peti-kosong', 'collect kedua langsung = kosong';
  assert (select v->>'reason' from out where k='c3locked') = 'terkunci';
  assert (select count(*) from public.wallet_ledger where user_id='eeeeeeee-0000-0000-0000-000000000001' and reason='mine_collect') = 1, 'satu baris ledger';
end $$;

-- ===== kapasitas: 200 jam tetap maks 15 =====
update public.player_mines set stock_at = now() - interval '200 hours' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'gcap', public.mine_get();
reset role;
do $$ begin
  assert (select (v->'slots'->0->>'stock')::numeric from out where k='gcap') = 15, 'peti dibatasi kapasitas 15';
  assert (select (v->'slots'->0->>'full_in_secs')::int from out where k='gcap') = 0;
end $$;

-- ===== upgrade: laju lama dihitung dulu; koin kurang; level maks; jenis salah; terkunci =====
update public.player_wallet set coins = 500 where user_id='eeeeeeee-0000-0000-0000-000000000001';
update public.player_mines set stock = 0, stock_at = now() - interval '10 hours' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'up1', public.mine_upgrade(1, 'speed');
insert into out select 'up2poor', public.mine_upgrade(1, 'speed');
insert into out select 'upbad', public.mine_upgrade(1, 'xx');
insert into out select 'uplock', public.mine_upgrade(2, 'cap');
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='up1') = 'true';
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 100, 'speed Lv2 slot 1 = 400 koin';
  assert (select speed_lv from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1) = 2;
  assert (select stock from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1) between 1.99 and 2.01, '10 jam dihitung dengan laju LAMA 0.20';
  assert (select v->>'reason' from out where k='up2poor') = 'saldo-kurang';
  assert (select v->>'reason' from out where k='upbad') = 'jenis-tidak-valid';
  assert (select v->>'reason' from out where k='uplock') = 'terkunci';
  update public.player_mines set speed_lv = 5 where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
  update public.player_mines set speed_lv = 2 where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
end $$;

-- ===== boost: 2x selama aktif, tidak bisa ditumpuk, maks 2x per hari =====
update public.player_wallet set coins = 5000 where user_id='eeeeeeee-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'b1', public.mine_boost(1);
insert into out select 'b1again', public.mine_boost(1);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='b1') = 'true';
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 4850, 'boost slot 1 = 150 koin';
  assert (select v->>'reason' from out where k='b1again') = 'boost-aktif';
end $$;
-- 2 jam berlalu, boost masih aktif 1 jam lagi: 0.25/jam x (2 + 2x1... ) -> jam di dalam boost dihitung 2x
update public.player_mines set stock = 0, stock_at = now() - interval '2 hours', boost_until = now() + interval '1 hour' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'gboost', public.mine_get();
reset role;
do $$ begin
  assert (select (v->'slots'->0->>'stock')::numeric from out where k='gboost') between 0.99 and 1.01, '0.25 x 2 jam x 2 = 1.0';
  assert (select (v->'slots'->0->'boost'->>'active')::boolean from out where k='gboost');
end $$;
update public.player_mines set boost_until = now() - interval '1 second' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'b2', public.mine_boost(1);
reset role;
update public.player_mines set boost_until = now() - interval '1 second' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'b3', public.mine_boost(1);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='b2') = 'true', 'boost kedua hari ini';
  assert (select v->>'reason' from out where k='b3') = 'batas-harian', 'boost ketiga ditolak';
end $$;

-- ===== akun B terpisah; tabel tidak bisa dibaca langsung; tanpa login ditolak =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000002',false);
insert into out select 'bget', public.mine_get();
do $$ begin
  begin perform 1 from public.player_mines; assert false, 'tabel harus tertutup'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  begin perform public.mine_get(); assert false, 'harus ditolak'; exception when others then assert sqlerrm like '%AUTH_REQUIRED%', sqlerrm; end;
end $$;
reset role;
do $$ begin
  assert (select v->'slots'->0->>'unlocked' from out where k='bget') = 'false', 'akun B tidak ikut terbuka';
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000002') = 1000;
end $$;

rollback;
\echo 'tambang_test: semua lulus'
