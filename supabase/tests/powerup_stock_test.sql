-- Tes 202611230001_powerup_stock.sql. Jalankan sebagai superuser di DB UJI (bukan produksi) yang SUDAH memuat semua migrasi.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/powerup_stock_test.sql   (assert gagal = skrip berhenti). Saldo awal akun baru = 1000.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated, anon;

do $$ begin
  assert (select price_coins from public.item_catalog where id = 'sword') = 120;
  assert (select price_coins from public.item_catalog where id = 'feather') = 80;
  assert not exists (select 1 from public.item_catalog where kind = 'powerup' and price_coins is null), 'semua power-up berharga';
  assert not exists (select 1 from public.item_catalog where kind <> 'powerup' and id in (select item_id from public.player_powerup_use)), 'kosong';
end $$;

-- anon & tanpa login ditolak
set role anon;
do $$ begin
  begin perform public.use_powerup('sword', 'use-aaaa-0001'); assert false, 'anon harus ditolak'; exception when insufficient_privilege then null; end;
  begin perform public.buy_powerup('sword', 1, 'op-aaaa-0001'); assert false, 'anon harus ditolak'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin perform public.use_powerup('sword', 'use-aaaa-0001'); assert false; exception when others then assert sqlerrm = 'AUTH_REQUIRED', sqlerrm; end;
  begin perform public.buy_powerup('sword', 1, 'op-aaaa-0001'); assert false; exception when others then assert sqlerrm = 'AUTH_REQUIRED', sqlerrm; end;
end $$;
reset role;

-- ===== beli per jumlah =====
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'b5',   public.buy_powerup('sword', 5, 'op-bbbb-0001');      -- 5 x 120 = 600
insert into out select 'bdup', public.buy_powerup('sword', 5, 'op-bbbb-0001');      -- op_id sama: TIDAK menagih/menambah lagi
insert into out select 'b0',   public.buy_powerup('sword', 0, 'op-bbbb-0002');
insert into out select 'b100', public.buy_powerup('sword', 100, 'op-bbbb-0003');
insert into out select 'bop',  public.buy_powerup('sword', 1, 'x');
insert into out select 'bunk', public.buy_powerup('tidak-ada', 1, 'op-bbbb-0004');
insert into out select 'bnp',  public.buy_powerup('dice.tnt', 1, 'op-bbbb-0005');
insert into out select 'bnsf', public.buy_powerup('nether_star', 1, 'op-bbbb-0006'); -- 1000 > sisa 400
insert into out select 'bitem', public.buy_item('sword');                         -- jalur lama ditutup untuk power-up
reset role;
do $$ begin
  assert (select v->>'qty' from out where k='b5') = '5' and (select v->>'spent' from out where k='b5') = '600';
  assert (select v->>'duplicate' from out where k='bdup') = 'true' and (select v->>'qty' from out where k='bdup') = '5';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 400, 'ditagih sekali saja (1000-600)';
  assert (select v->>'reason' from out where k='b0') = 'jumlah-tidak-valid';
  assert (select v->>'reason' from out where k='b100') = 'jumlah-tidak-valid';
  assert (select v->>'reason' from out where k='bop') = 'op-id-tidak-valid';
  assert (select v->>'reason' from out where k='bunk') = 'tidak-tersedia';
  assert (select v->>'reason' from out where k='bnp') = 'tidak-tersedia', 'bukan power-up ditolak';
  assert (select v->>'reason' from out where k='bitem') = 'tidak-tersedia', 'buy_item menolak power-up';
  assert (select v->>'reason' from out where k='bnsf') = 'saldo-kurang' and (select v->>'kurang' from out where k='bnsf') = '600';
  assert (select qty from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000001' and item_id='sword') = 5;
end $$;

-- ===== pakai: stok dipotong satu per pemakaian =====
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'u1',   public.use_powerup('sword', 'use-bbbb-0001');
insert into out select 'udup', public.use_powerup('sword', 'use-bbbb-0001');   -- use_id sama: tidak memotong lagi
insert into out select 'u2',   public.use_powerup('sword', 'use-bbbb-0002');
reset role;
do $$ begin
  assert (select v->>'qty' from out where k='u1') = '4';
  assert (select v->>'duplicate' from out where k='udup') = 'true' and (select v->>'qty' from out where k='udup') = '4';
  assert (select v->>'qty' from out where k='u2') = '3';
end $$;

-- beli lagi SETELAH stok berkurang tidak bentrok kunci ledger (op_id baru)
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'rebuy', public.buy_powerup('sword', 1, 'op-bbbb-0007');   -- 3 -> 4, koin 400 -> 280
-- habiskan stok lalu coba lagi
insert into out select 'e1', public.use_powerup('sword', 'use-bbbb-0003');
insert into out select 'e2', public.use_powerup('sword', 'use-bbbb-0004');
insert into out select 'e3', public.use_powerup('sword', 'use-bbbb-0005');
insert into out select 'e4', public.use_powerup('sword', 'use-bbbb-0006');   -- stok 0 setelah ini
insert into out select 'e5', public.use_powerup('sword', 'use-bbbb-0007');   -- habis
insert into out select 'edup', public.use_powerup('sword', 'use-bbbb-0006'); -- ulang use_id terakhir setelah baris dihapus: tetap duplicate
insert into out select 'unk', public.use_powerup('tidak-ada', 'use-bbbb-0008');
insert into out select 'notpu', public.use_powerup('dice.tnt', 'use-bbbb-0009');
insert into out select 'badid', public.use_powerup('sword', 'x');
reset role;
do $$ begin
  assert (select v->>'qty' from out where k='rebuy') = '4' and (select v->>'ok' from out where k='rebuy') = 'true';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 280;
  assert (select v->>'qty' from out where k='e4') = '0';
  assert not exists (select 1 from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000001' and item_id='sword'), 'stok 0 = baris dihapus';
  assert (select v->>'reason' from out where k='e5') = 'stok-habis';
  assert (select v->>'duplicate' from out where k='edup') = 'true';
  assert (select v->>'reason' from out where k='unk') = 'tidak-tersedia';
  assert (select v->>'reason' from out where k='notpu') = 'tidak-tersedia';
  assert (select v->>'reason' from out where k='badid') = 'use-id-tidak-valid';
end $$;

-- ===== use_id dipakai item lain & akun lain tidak menyentuh stok orang =====
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'bf', public.buy_powerup('feather', 2, 'op-bbbb-0010');
insert into out select 'clash', public.use_powerup('feather', 'use-bbbb-0001');   -- use_id itu milik sword
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
insert into out select 'other', public.use_powerup('feather', 'use-cccc-0001');
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='clash') = 'use-id-dipakai';
  assert (select v->>'reason' from out where k='other') = 'stok-habis';
  assert (select qty from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000001' and item_id='feather') = 2, 'stok akun 1 utuh';
end $$;
rollback;
