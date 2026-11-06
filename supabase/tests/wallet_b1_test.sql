-- Tes migrasi 202611110001_wallet_b1.sql. Jalankan sebagai superuser di DB KOSONG/UJI (bukan produksi).
-- Prasyarat minimal: schema auth dengan tabel auth.users(id) dan fungsi auth.uid() (di Supabase sudah ada).
-- Semua assertion memakai `assert`; kegagalan menghentikan skrip (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('aaaaaaaa-0000-0000-0000-000000000001'), ('aaaaaaaa-0000-0000-0000-000000000002');

create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- 1. Akun baru: wallet_get membuat dompet dengan saldo awal 1000/0
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'get1', public.wallet_get();
insert into out select 'get2', public.wallet_get();   -- dipanggil lagi: tidak boleh memberi saldo awal dua kali
reset role;
do $$ begin
  assert (select (v->>'coins')::int from out where k='get1') = 1000, 'saldo awal coins harus 1000';
  assert (select (v->>'gems')::int  from out where k='get1') = 0,    'saldo awal gems harus 0';
  assert (select (v->>'coins')::int from out where k='get2') = 1000, 'panggilan kedua tidak boleh menambah saldo';
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 1, 'hanya 1 baris ledger start';
end $$;

-- 2. Reward: sekali berhasil, ref yang sama = duplikat (tidak menambah)
do $$ declare r jsonb; begin
  r := public._wallet_apply('aaaaaaaa-0000-0000-0000-000000000001', 500, 10, 'dragon-defeat', 'room-1');
  assert (r->>'duplicate')::boolean = false and (r->>'coins')::int = 1500 and (r->>'gems')::int = 10, 'reward pertama harus masuk';
  r := public._wallet_apply('aaaaaaaa-0000-0000-0000-000000000001', 500, 10, 'dragon-defeat', 'room-1');
  assert (r->>'duplicate')::boolean = true and (r->>'coins')::int = 1500, 'klaim yang sama tidak boleh dobel';
  r := public._wallet_apply('aaaaaaaa-0000-0000-0000-000000000001', 500, 10, 'dragon-defeat', 'room-2');
  assert (r->>'coins')::int = 2000, 'ref berbeda = klaim sah baru';
end $$;

-- 3. Belanja melebihi saldo ditolak, saldo dan ledger tidak berubah
do $$ declare n_before int; begin
  select count(*) into n_before from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public._wallet_apply('aaaaaaaa-0000-0000-0000-000000000001', -5000, 0, 'buy', 'item-x');
    assert false, 'seharusnya ditolak';
  exception when others then
    assert sqlerrm = 'INSUFFICIENT_COINS', 'error harus INSUFFICIENT_COINS, dapat '||sqlerrm;
  end;
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 2000, 'saldo tidak boleh berubah';
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001') = n_before, 'ledger tidak boleh bertambah';
  -- belanja sah
  assert ((public._wallet_apply('aaaaaaaa-0000-0000-0000-000000000001', -300, 0, 'buy', 'item-x')->>'coins')::int) = 1700;
end $$;

-- 4. Klien tidak bisa menyentuh tabel atau fungsi internal langsung
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
do $$ begin
  begin perform 1 from public.player_wallet; assert false, 'select langsung harus ditolak';
  exception when insufficient_privilege then null; end;
  begin update public.player_wallet set coins = 999999999; assert false, 'update langsung harus ditolak';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.wallet_ledger; assert false, 'select ledger harus ditolak';
  exception when insufficient_privilege then null; end;
  begin perform public._wallet_apply('aaaaaaaa-0000-0000-0000-000000000001', 999999, 999, 'cheat', 'x'); assert false, 'fungsi internal harus ditolak';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 5. Isolasi antar akun + riwayat hanya milik sendiri
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
insert into out select 'u2', public.wallet_get();
insert into out select 'h2', public.wallet_history(50);
insert into out select 'h2lim', public.wallet_history(0);   -- batas bawah dijepit ke 1
reset role;
do $$ begin
  assert (select (v->>'coins')::int from out where k='u2') = 1000, 'akun 2 punya dompet sendiri';
  assert jsonb_array_length((select v from out where k='h2')) = 1, 'riwayat akun 2 hanya miliknya';
  assert jsonb_array_length((select v from out where k='h2lim')) = 1, 'limit dijepit minimal 1';
end $$;

-- 6. Tanpa login ditolak
set role authenticated; select set_config('request.jwt.claim.sub','',false);
do $$ begin
  begin perform public.wallet_get(); assert false, 'harus AUTH_REQUIRED';
  exception when others then assert sqlerrm = 'AUTH_REQUIRED', 'error harus AUTH_REQUIRED, dapat '||sqlerrm; end;
end $$;
reset role;

select 'WALLET B1 OK' as hasil;
rollback;
