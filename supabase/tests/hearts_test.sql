-- Tes migrasi 202611410001_hearts.sql. Jalankan di DB UJI (bukan produksi) yang SUDAH memuat migrasi sampai 202611410001:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/hearts_test.sql      Kegagalan assert menghentikan skrip.
-- Catatan: now() konstan di dalam satu transaksi, jadi selisih waktu diatur lewat UPDATE regen_at (bukan menunggu).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('eeeeeeee-0000-0000-0000-0000000000a1'), ('eeeeeeee-0000-0000-0000-0000000000a2');
create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- ===== akun A: awal 5 hati, penuh (tanpa hitung mundur); dua match -> 3 hati =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000a1',false);
insert into out select 'g0', public.hearts_get();
insert into out select 'c1', public.hearts_consume();
insert into out select 'c2', public.hearts_consume();
reset role;
do $$ begin
  assert (select (v->>'hearts')::int from out where k='g0') = 5, 'awal 5 hati';
  assert (select (v->>'max')::int from out where k='g0') = 5;
  assert (select (v->>'regen_secs')::int from out where k='g0') = 300, '1 hati per 5 menit';
  assert (select v->'next_in_secs' from out where k='g0') = 'null'::jsonb, 'penuh: tanpa hitung mundur';
  assert (select v->>'ok' from out where k='c1') = 'true';
  assert (select (v->>'hearts')::int from out where k='c1') = 4;
  assert (select (v->>'next_in_secs')::int from out where k='c1') = 300, 'turun dari penuh: hitungan mulai 5 menit penuh';
  assert (select (v->>'hearts')::int from out where k='c2') = 3;
  assert (select hearts from public.player_hearts where user_id='eeeeeeee-0000-0000-0000-0000000000a1') = 3;
end $$;

-- ===== isi ulang malas: stok 1, regen_at 7 menit lalu -> 2 hati, 3 menit lagi hati berikutnya =====
update public.player_hearts set hearts = 1, regen_at = now() - interval '7 minutes' where user_id='eeeeeeee-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000a1',false);
insert into out select 'g7m', public.hearts_get();
insert into out select 'c3', public.hearts_consume();
reset role;
do $$ begin
  assert (select (v->>'hearts')::int from out where k='g7m') = 2, '1 + floor(7/5) = 2 hati';
  assert (select (v->>'next_in_secs')::int from out where k='g7m') = 180, '3 menit menuju hati berikutnya';
  assert (select (v->>'hearts')::int from out where k='c3') = 1, 'dipakai 1 dari 2';
  assert (select (v->>'next_in_secs')::int from out where k='c3') = 180, 'sisa menit isi ulang tidak hilang saat memakai hati';
end $$;

-- ===== isi ulang tidak melewati 5: stok 3, 60 menit lalu =====
update public.player_hearts set hearts = 3, regen_at = now() - interval '60 minutes' where user_id='eeeeeeee-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000a1',false);
insert into out select 'gcap', public.hearts_get();
insert into out select 'c4', public.hearts_consume();
reset role;
do $$ begin
  assert (select (v->>'hearts')::int from out where k='gcap') = 5, 'dibatasi 5';
  assert (select v->'next_in_secs' from out where k='gcap') = 'null'::jsonb;
  assert (select (v->>'hearts')::int from out where k='c4') = 4;
  assert (select (v->>'next_in_secs')::int from out where k='c4') = 300, 'sudah penuh lewat isi ulang: hitungan mulai dari sekarang';
end $$;

-- ===== habis: 0 hati ditolak, tidak negatif; hitung mundur tetap dikirim =====
update public.player_hearts set hearts = 0, regen_at = now() - interval '1 minute' where user_id='eeeeeeee-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000a1',false);
insert into out select 'c0', public.hearts_consume();
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='c0') = 'false';
  assert (select v->>'reason' from out where k='c0') = 'hati-habis';
  assert (select (v->>'next_in_secs')::int from out where k='c0') = 240, '4 menit lagi';
  assert (select hearts from public.player_hearts where user_id='eeeeeeee-0000-0000-0000-0000000000a1') = 0, 'tidak berubah / tidak negatif';
end $$;

-- ===== stok > 5 (disiapkan untuk hadiah): tidak ada isi ulang, hitungan baru mulai saat turun di bawah 5 =====
update public.player_hearts set hearts = 6, regen_at = now() - interval '60 minutes' where user_id='eeeeeeee-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000a1',false);
insert into out select 'g6', public.hearts_get();
insert into out select 'c6', public.hearts_consume();
insert into out select 'c5', public.hearts_consume();
insert into out select 'c4b', public.hearts_consume();
reset role;
do $$ begin
  assert (select (v->>'hearts')::int from out where k='g6') = 6, 'stok 6 dibiarkan';
  assert (select (v->>'hearts')::int from out where k='c6') = 5;
  assert (select (v->>'hearts')::int from out where k='c5') = 4;
  assert (select (v->>'next_in_secs')::int from out where k='c5') = 300;
  assert (select (v->>'hearts')::int from out where k='c4b') = 3;
end $$;

-- ===== akun B terpisah: tetap 5 =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000a2',false);
insert into out select 'gB', public.hearts_get();
reset role;
do $$ begin
  assert (select (v->>'hearts')::int from out where k='gB') = 5, 'akun lain tidak ikut berubah';
  assert (select count(*) from public.player_hearts) >= 2;
end $$;

rollback;
\echo 'hearts_test: semua lulus'
