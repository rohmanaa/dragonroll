-- Tes migrasi 202611150001_player_prefs.sql. Jalankan sebagai superuser di DB KOSONG/UJI (bukan produksi).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- 1. Akun baru: prefs kosong
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'get0', public.get_my_prefs();
-- 2. Simpan: hanya kunci daftar putih yang masuk
insert into out select 'set1', public.set_my_prefs('{"musicVol":40,"night":true,"settings":{"music":false},"hack":"x","wallet":999}'::jsonb);
insert into out select 'get1', public.get_my_prefs();
-- 3. Simpan lagi = mengganti seluruh isi
insert into out select 'set2', public.set_my_prefs('{"sfxVol":10}'::jsonb);
insert into out select 'get2', public.get_my_prefs();
reset role;
do $$ begin
  assert (select v->'prefs' from out where k='get0') = '{}'::jsonb, 'akun baru harus prefs kosong';
  assert (select v->'prefs' from out where k='get1') = '{"musicVol":40,"night":true,"settings":{"music":false}}'::jsonb, 'kunci di luar daftar putih harus dibuang';
  assert (select v->'prefs' from out where k='get2') = '{"sfxVol":10}'::jsonb, 'set kedua mengganti seluruh isi';
end $$;

-- 4. Isolasi antar akun
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into out select 'other', public.get_my_prefs();
reset role;
do $$ begin
  assert (select v->'prefs' from out where k='other') = '{}'::jsonb, 'akun lain tidak boleh melihat prefs akun pertama';
end $$;

-- 5. Validasi: bukan objek, terlalu besar, tanpa login
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
do $$ begin
  begin perform public.set_my_prefs('[1,2]'::jsonb); assert false, 'array harus ditolak';
  exception when others then assert sqlerrm = 'BAD_PREFS', 'harus BAD_PREFS, dapat '||sqlerrm; end;
  begin perform public.set_my_prefs(null); assert false, 'null harus ditolak';
  exception when others then assert sqlerrm = 'BAD_PREFS', 'harus BAD_PREFS (null), dapat '||sqlerrm; end;
  begin perform public.set_my_prefs(jsonb_build_object('cam', repeat('x', 9000))); assert false, 'terlalu besar harus ditolak';
  exception when others then assert sqlerrm = 'PREFS_TOO_LARGE', 'harus PREFS_TOO_LARGE, dapat '||sqlerrm; end;
  assert (select v->'prefs' from out where k='get2') = '{"sfxVol":10}'::jsonb;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
set role authenticated;
do $$ begin
  begin perform public.get_my_prefs(); assert false, 'tanpa login harus ditolak';
  exception when others then assert sqlerrm = 'AUTH_REQUIRED', 'harus AUTH_REQUIRED, dapat '||sqlerrm; end;
end $$;
reset role;

-- 6. Klien tidak bisa menyentuh tabel langsung, anon tidak bisa memanggil RPC
set role authenticated;
do $$ begin
  begin perform 1 from public.player_prefs; assert false, 'authenticated tidak boleh membaca tabel langsung';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.get_my_prefs(); assert false, 'anon tidak boleh memanggil RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
