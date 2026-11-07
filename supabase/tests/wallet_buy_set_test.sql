-- Tes migrasi 202611140001_buy_set.sql. Jalankan sebagai superuser di DB UJI (bukan produksi) yang SUDAH memuat
-- migrasi sampai 202611140001 (minimal wallet B1 + B2: item_catalog, player_inventory, buy_item, _wallet_apply).
-- Semua assertion memakai `assert`; kegagalan menghentikan skrip (psql -v ON_ERROR_STOP=1).
-- Harga yang dipakai (dari katalog): boots.cloth 60, acc.bow 80, acc.belt 80, acc.scarf 100, acc.glasses 120,
-- helm.beret 150, helm.crown 900. Saldo awal akun baru = 1000.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'), ('aaaaaaaa-0000-0000-0000-000000000002'), ('aaaaaaaa-0000-0000-0000-000000000003');
create temp table out(k text, v jsonb);
grant all on out to authenticated, anon;

-- ===== anon & tanpa login ditolak =====
set role anon;
do $$ begin
  begin perform public.buy_set(array['gear.acc.bow']); assert false, 'anon harus ditolak';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin perform public.buy_set(array['gear.acc.bow']); assert false, 'tanpa uid harus ditolak';
  exception when others then assert sqlerrm = 'AUTH_REQUIRED', 'dapat ' || sqlerrm; end;
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.player_wallet), 'penolakan tidak boleh membuat dompet';
end $$;

-- ===== beli set: atomik, koin dipotong SEKALI =====
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into out select 'set1', public.buy_set(array['gear.boots.cloth', 'gear.acc.bow', 'gear.acc.belt']);   -- 60+80+80 = 220
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='set1') = 'true', 'set sah harus ok';
  assert (select (v->>'spent')::int from out where k='set1') = 220, 'total dihitung server';
  assert (select (v->>'coins')::int from out where k='set1') = 780, 'saldo 1000-220';
  assert (select jsonb_array_length(v->'items') from out where k='set1') = 3;
  assert (select jsonb_array_length(v->'skipped') from out where k='set1') = 0;
  assert (select count(*) from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 3, '3 item masuk';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 780;
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001' and reason='buy_set') = 1, 'SATU baris ledger untuk satu set';
  assert (select delta_coins from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001' and reason='buy_set') = -220;
end $$;

-- ===== item sudah dimiliki dilewati & tidak ditagih =====
set role authenticated;
insert into out select 'set2', public.buy_set(array['gear.boots.cloth', 'gear.acc.scarf']);   -- cloth sudah dimiliki; hanya scarf 100
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='set2') = 'true';
  assert (select (v->>'spent')::int from out where k='set2') = 100, 'hanya scarf yang ditagih';
  assert (select v->'items' from out where k='set2') = '["gear.acc.scarf"]'::jsonb;
  assert (select v->'skipped' from out where k='set2') = '["gear.boots.cloth"]'::jsonb;
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 680;
end $$;

-- semua sudah dimiliki -> ok, spent 0, tidak ada ledger baru
set role authenticated;
insert into out select 'set3', public.buy_set(array['gear.boots.cloth', 'gear.acc.bow', 'gear.acc.scarf']);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='set3') = 'true', 'semua dimiliki bukan kegagalan';
  assert (select (v->>'spent')::int from out where k='set3') = 0;
  assert (select (v->>'coins')::int from out where k='set3') = 680, 'saldo tidak berubah';
  assert (select jsonb_array_length(v->'items') from out where k='set3') = 0;
  assert (select jsonb_array_length(v->'skipped') from out where k='set3') = 3;
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001' and reason='buy_set') = 2, 'tidak ada ledger baru';
end $$;

-- ===== saldo kurang: tidak menulis apa pun =====
set role authenticated;
insert into out select 'short', public.buy_set(array['gear.helm.crown', 'gear.helm.beret']);   -- 1050 > 680
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='short') = 'saldo-kurang';
  assert (select (v->>'kurang')::int from out where k='short') = 370, 'kurang = 1050-680';
  assert not exists (select 1 from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001' and item_id in ('gear.helm.crown','gear.helm.beret')),
    'tidak boleh ada item masuk, termasuk yang sebenarnya terjangkau (beret 150)';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 680, 'saldo tidak berubah';
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 3, 'ledger: start + 2 set; tidak ada baris gagal';
end $$;

-- ===== item tidak dijual menolak SELURUH set =====
set role authenticated;
insert into out select 'ns_dice',    public.buy_set(array['gear.helm.beret', 'dice.rumput']);     -- bukan gear
insert into out select 'ns_starter', public.buy_set(array['gear.helm.beret', 'gear.top.tee']);     -- starter
insert into out select 'ns_unknown', public.buy_set(array['gear.helm.beret', 'gear.tidak-ada']);   -- tak dikenal
insert into out select 'ns_power',   public.buy_set(array['gear.helm.beret', 'tnt']);              -- powerup tanpa harga
reset role;
do $$ declare kk text; begin
  foreach kk in array array['ns_dice','ns_starter','ns_unknown','ns_power'] loop
    assert (select v->>'ok' from out where out.k = kk) = 'false', kk || ' harus gagal';
    assert (select v->>'reason' from out where out.k = kk) = 'tidak-tersedia', kk || ' alasan tidak-tersedia';
  end loop;
  assert not exists (select 1 from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001' and item_id = 'gear.helm.beret'), 'item yang dijual pun tidak ikut dibeli';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 680;
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 3;
end $$;

-- ===== id berulang digabung =====
set role authenticated;
insert into out select 'dup', public.buy_set(array['gear.acc.glasses', 'gear.acc.glasses', 'gear.acc.glasses']);   -- ditagih sekali: 120
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='dup') = 'true';
  assert (select (v->>'spent')::int from out where k='dup') = 120, 'id berulang hanya ditagih sekali';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 560;
  assert (select qty from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001' and item_id='gear.acc.glasses') = 1;
end $$;

-- ===== batas jumlah & input aneh (akun 2, saldo 1000) =====
create temp table ids(n int, a text[]);
grant all on ids to authenticated;
insert into ids select 21, array_agg(id) from (select id from public.item_catalog where kind='gear' and not starter and price_coins is not null order by id limit 21) s;
insert into ids select 20, array_agg(id) from (select id from public.item_catalog where kind='gear' and not starter and price_coins is not null order by id limit 20) s;
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', false);
insert into out select 'n21', public.buy_set((select a from ids where n = 21));                      -- 21 unik
insert into out select 'n20', public.buy_set((select a from ids where n = 20));                      -- 20 unik: lolos batas
insert into out select 'raw25', public.buy_set(array_fill('gear.boots.cloth'::text, array[10]) || array_fill('gear.boots.sandal'::text, array[10])
                                               || array_fill('gear.acc.bow'::text, array[5]));        -- 25 mentah, 3 unik
insert into out select 'raw201', public.buy_set(array_fill('gear.boots.cloth'::text, array[201]));
insert into out select 'empty',  public.buy_set('{}'::text[]);
insert into out select 'nullarr', public.buy_set(null);
insert into out select 'nullel1', public.buy_set(array[null]::text[]);
insert into out select 'nullel2', public.buy_set(array['gear.acc.bow', null]);
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='n21') = 'terlalu-banyak', '21 unik ditolak';
  assert (select v->>'reason' from out where k='n20') = 'saldo-kurang', '20 unik lolos batas jumlah (gagal karena saldo)';
  assert (select v->>'ok' from out where k='raw25') = 'true' and (select (v->>'spent')::int from out where k='raw25') = 200,
    '25 id mentah tapi 3 unik tidak ditolak: 60+60+80';
  assert (select v->>'reason' from out where k='raw201') = 'terlalu-banyak', '201 elemen mentah ditolak';
  assert (select v->>'reason' from out where k='empty') = 'tidak-tersedia', 'daftar kosong ditolak';
  assert (select v->>'reason' from out where k='nullarr') = 'tidak-tersedia', 'null ditolak';
  assert (select v->>'reason' from out where k='nullel1') = 'tidak-tersedia', '[null] ditolak';
  assert (select v->>'reason' from out where k='nullel2') = 'tidak-tersedia', 'elemen null di tengah daftar ditolak';
  assert (select count(*) from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000002') = 3, 'hanya raw25 yang menulis';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000002') = 800;
end $$;

-- ===== isolasi antar pemain =====
set role authenticated; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', false);
insert into out select 'iso3', public.buy_set(array['gear.boots.cloth', 'gear.acc.bow', 'gear.acc.belt']);   -- set yang sama dengan akun 1
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='iso3') = 'true' and (select (v->>'spent')::int from out where k='iso3') = 220,
    'akun 3 membeli penuh; kepemilikan akun lain tidak membuat item "dilewati"';
  assert (select jsonb_array_length(v->'skipped') from out where k='iso3') = 0;
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000003') = 780;
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 560, 'akun 1 tak berubah';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000002') = 800, 'akun 2 tak berubah';
  assert (select count(*) from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 5;
  assert not exists (select 1 from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000003' and item_id in ('gear.acc.scarf','gear.acc.glasses')),
    'item akun 1 tidak bocor ke akun 3';
end $$;

-- ===== klien tidak bisa menyentuh tabel langsung =====
set role authenticated;
do $$ begin
  begin insert into public.player_inventory(user_id,item_id) values ('aaaaaaaa-0000-0000-0000-000000000003','gear.helm.crown'); assert false, 'insert inventory harus ditolak';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'WALLET BUY_SET OK' as hasil;
rollback;
