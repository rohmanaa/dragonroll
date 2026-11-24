-- Tes migrasi tambang (termasuk 202611180001, 202611190001, 202611280001, 202611360001).
-- Jalankan di DB UJI (bukan produksi) yang SUDAH memuat SEMUA migrasi:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/tambang_test.sql
-- Kegagalan assert menghentikan skrip.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('eeeeeeee-0000-0000-0000-000000000001'), ('eeeeeeee-0000-0000-0000-000000000002');
select public._wallet_ensure('eeeeeeee-0000-0000-0000-000000000001');
create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- ===== akun A: GEMS diisi 100 (cukup buka slot 1&2, tidak cukup slot 3); koin 0 =====
update public.player_wallet set gems = 100, coins = 0 where user_id='eeeeeeee-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'get0', public.mine_get();
insert into out select 'u1', public.mine_unlock(1);
insert into out select 'u1again', public.mine_unlock(1);
insert into out select 'u2', public.mine_unlock(2);
insert into out select 'u3poor', public.mine_unlock(3);
insert into out select 'u9', public.mine_unlock(9);
reset role;
do $$ declare c bigint; begin
  assert (select v->'slots'->0->>'unlocked' from out where k='get0') = 'false', 'slot 1 awal terkunci: ' || (select v->'slots'->0->>'unlocked' from out where k='get0');
  assert (select jsonb_array_length(v->'slots') from out where k='get0') = 3, '3 slot dikirim';
  assert (select (v->'config'->>'boost_daily')::int from out where k='get0') = 2, 'konfigurasi boost_daily=2';
  assert (select v->>'ok' from out where k='u1') = 'true', 'buka slot 1 ok: ' || (select v::text from out where k='u1');
  -- unlock slot 1 = 20 gems
  assert (select gems from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 80, 'buka slot 1 = 20 gems, sisa 80: ' || (select gems::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select v->>'reason' from out where k='u1again') = 'sudah-dibuka', 'buka ulang slot 1 = sudah-dibuka: ' || (select v::text from out where k='u1again');
  assert (select v->>'ok' from out where k='u2') = 'true', 'buka slot 2 ok: ' || (select v::text from out where k='u2');
  -- unlock slot 2 = 60 gems, total 80 spent, sisa 20
  assert (select gems from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 20, 'buka slot 2 = 60 gems, sisa 20: ' || (select gems::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select v->>'reason' from out where k='u3poor') = 'saldo-kurang', 'slot 3 butuh 150 gems, sisa 20: ' || (select v::text from out where k='u3poor');
  assert (select v->>'reason' from out where k='u9') = 'slot-tidak-valid', 'slot 9 tidak valid: ' || (select v::text from out where k='u9');
  assert (select count(*) from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001') = 2, '2 slot terbuka di player_mines';
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
  assert (select (v->'slots'->0->>'stock')::numeric from out where k='g10h') between 1.99 and 2.01, 'stok 10 jam ~2.0, aktual: ' || (select (v->'slots'->0->>'stock')::text from out where k='g10h');
  assert (select v->>'collected' from out where k='c1') = '2', 'collect 2 emerald: ' || (select v::text from out where k='c1');
  -- collect menambah gems
  assert (select gems from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 22, 'gems naik 2 jadi 22: ' || (select gems::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select v->>'reason' from out where k='c2') = 'peti-kosong', 'collect kedua langsung = kosong: ' || (select v::text from out where k='c2');
  assert (select v->>'reason' from out where k='c3locked') = 'terkunci', 'slot 2 terkunci: ' || (select v::text from out where k='c3locked');
  assert (select count(*) from public.wallet_ledger where user_id='eeeeeeee-0000-0000-0000-000000000001' and reason='mine_collect') = 1, 'satu baris ledger mine_collect';
end $$;

-- ===== kapasitas: 200 jam tetap maks 5 (cap Lv1 = 5) =====
update public.player_mines set stock_at = now() - interval '200 hours' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'gcap', public.mine_get();
reset role;
do $$ begin
  assert (select (v->'slots'->0->>'stock')::numeric from out where k='gcap') = 5, 'peti dibatasi kapasitas 5 (cap Lv1), aktual: ' || (select (v->'slots'->0->>'stock')::text from out where k='gcap');
  assert (select (v->'slots'->0->>'full_in_secs')::int from out where k='gcap') = 0, 'peti penuh, full_in_secs=0';
end $$;

-- ===== upgrade: dibayar KOIN (sesuai 202611360001) =====
-- speed Lv2 slot 1 = 10.000 koin, speed Lv3 = 50.000, cap Lv2 = 8.000
update public.player_wallet set coins = 20000, gems = 20 where user_id='eeeeeeee-0000-0000-0000-000000000001';
update public.player_mines set stock = 0, stock_at = now() - interval '10 hours' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'up1', public.mine_upgrade(1, 'speed');
insert into out select 'up2poor', public.mine_upgrade(1, 'speed');
insert into out select 'up3', public.mine_upgrade(1, 'speed');  -- Lv3 butuh 50.000, tidak cukup
insert into out select 'upbad', public.mine_upgrade(1, 'xx');
insert into out select 'upcap', public.mine_upgrade(1, 'cap');  -- cap Lv2 = 8.000 koin
insert into out select 'uplock', public.mine_upgrade(2, 'cap');
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='up1') = 'true', 'upgrade speed Lv2 ok: ' || (select v::text from out where k='up1');
  -- speed Lv2 slot 1 = 10.000 koin
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 10000, 'speed Lv2 slot 1 = 10.000 koin, sisa 10.000: ' || (select coins::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select speed_lv from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1) = 2, 'speed_lv jadi 2';
  -- stok dihitung dengan laju LAMA (Lv1 0.20) x 10 jam = 2.0
  assert (select stock from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1) between 1.99 and 2.01, '10 jam dihitung dengan laju LAMA 0.20, stock: ' || (select stock::text from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1);
  assert (select v->>'reason' from out where k='up2poor') = 'saldo-kurang', 'speed Lv3 butuh 50.000 koin, sisa 10.000: ' || (select v::text from out where k='up2poor');
  assert (select v->>'reason' from out where k='up3') = 'saldo-kurang', 'speed Lv3 butuh 50.000 koin: ' || (select v::text from out where k='up3');
  assert (select v->>'reason' from out where k='upbad') = 'jenis-tidak-valid', 'jenis xx tidak valid: ' || (select v::text from out where k='upbad');
  assert (select v->>'ok' from out where k='upcap') = 'true', 'upgrade cap Lv2 ok: ' || (select v::text from out where k='upcap');
  -- cap Lv2 slot 1 = 8.000 koin, sisa 2.000
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 2000, 'cap Lv2 slot 1 = 8.000 koin, sisa 2.000: ' || (select coins::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select cap_lv from public.player_mines where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1) = 2, 'cap_lv jadi 2';
  assert (select v->>'reason' from out where k='uplock') = 'terkunci', 'slot 2 terkunci: ' || (select v::text from out where k='uplock');
  -- reset speed_lv untuk tes berikutnya
  update public.player_mines set speed_lv = 2 where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
end $$;

-- ===== boost: dibayar KOIN, slot 1 = 150 (sesuai 202611280001) =====
update public.player_wallet set coins = 5000 where user_id='eeeeeeee-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'b1', public.mine_boost(1);
insert into out select 'b1again', public.mine_boost(1);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='b1') = 'true', 'boost slot 1 ok: ' || (select v::text from out where k='b1');
  -- boost slot 1 = 150 koin
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 4850, 'boost slot 1 = 150 koin, sisa 4850: ' || (select coins::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select v->>'reason' from out where k='b1again') = 'boost-aktif', 'boost kedua ditolak boost-aktif: ' || (select v::text from out where k='b1again');
end $$;
-- 2 jam berlalu, boost masih aktif 1 jam lagi: laju normal 0.20 x 2x = 0.40/jam x 2 jam = 0.8, tapi dibatasi boost
update public.player_mines set stock = 0, stock_at = now() - interval '2 hours', boost_until = now() + interval '1 hour' where user_id='eeeeeeee-0000-0000-0000-000000000001' and slot=1;
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000001',false);
insert into out select 'gboost', public.mine_get();
reset role;
do $$ begin
  -- laju boost = 0.20 x 2 = 0.40/jam. 2 jam x 0.40 = 0.8. Tapi stock dihitung dari stock_at dengan boost.
  -- _mine_stock_now: v_h = 2, v_bh = min(boost_until, now) - stock_at = 2 jam (karena boost_until > now + 1h)
  -- stock = 0 + 0.20 * (2 + 2 * (2-1)) = 0.20 * 4 = 0.8
  assert (select (v->'slots'->0->>'stock')::numeric from out where k='gboost') between 0.79 and 0.81, 'stock 2 jam boost 2x: 0.20 * 2 * 2 = 0.8, aktual: ' || (select (v->'slots'->0->>'stock')::text from out where k='gboost');
  assert (select (v->'slots'->0->'boost'->>'active')::boolean from out where k='gboost'), 'boost masih aktif';
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
  assert (select v->>'ok' from out where k='b2') = 'true', 'boost kedua hari ini ok: ' || (select v::text from out where k='b2');
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001') = 4700, 'boost kedua 150 koin, sisa 4700: ' || (select coins::text from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000001');
  assert (select v->>'reason' from out where k='b3') = 'batas-harian', 'boost ketiga ditolak batas-harian: ' || (select v::text from out where k='b3');
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
  assert (select v->'slots'->0->>'unlocked' from out where k='bget') = 'false', 'akun B slot 1 tidak terbuka: ' || (select v::text from out where k='bget');
  assert (select coins from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000002') = 1000, 'akun B koin bawaan 1000';
  assert (select gems from public.player_wallet where user_id='eeeeeeee-0000-0000-0000-000000000002') = 0, 'akun B gems 0';
end $$;

rollback;
\echo 'tambang_test: semua lulus'