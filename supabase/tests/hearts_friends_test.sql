-- Tes migrasi 202611420001_hearts_friends.sql (kirim hati ke teman). DB UJI yang sudah memuat migrasi sampai 202611420001:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/hearts_friends_test.sql
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) select ('ffffffff-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 30) i;
create temp table out(k text, v jsonb);
grant all on out to authenticated;
-- A (…01) berteman dengan 02..30
insert into public.friendships(user_id, friend_id, friend_name)
  select 'ffffffff-0000-0000-0000-000000000001', ('ffffffff-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'T' || i from generate_series(2, 30) i;
-- 03 tak aktif 40 hari
insert into public.player_hearts(user_id, hearts, last_seen_at) values ('ffffffff-0000-0000-0000-000000000003', 2, now() - interval '40 days');
update auth.users set last_sign_in_at = now() - interval '40 days' where id = 'ffffffff-0000-0000-0000-000000000003';
update auth.users set last_sign_in_at = now() where id <> 'ffffffff-0000-0000-0000-000000000003';

set role authenticated; select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000001',false);
insert into out select 's2', public.hearts_send('ffffffff-0000-0000-0000-000000000002');
insert into out select 's2again', public.hearts_send('ffffffff-0000-0000-0000-000000000002');
insert into out select 's3', public.hearts_send('ffffffff-0000-0000-0000-000000000003');
insert into out select 'self', public.hearts_send('ffffffff-0000-0000-0000-000000000001');
insert into out select 'list', public.hearts_friends();
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='s2') = 'true';
  assert (select (v->>'fee')::int from out where k='s2') = 1, 'fee 1 Emerald';
  assert (select v->>'gold' from out where k='s2') = 'false';
  assert (select v->>'reason' from out where k='s2again') = 'sudah-dikirim', '1 hati / hari / teman';
  assert (select (v->>'fee')::int from out where k='s3') = 2, 'penerima tak aktif 40 hari: fee 2';
  assert (select v->>'gold' from out where k='s3') = 'true';
  assert (select v->>'reason' from out where k='self') = 'diri-sendiri';
  assert (select gems from public.player_wallet where user_id='ffffffff-0000-0000-0000-000000000001') >= 3, 'fee masuk dompet pengirim';
  assert (select hearts from public.player_hearts where user_id='ffffffff-0000-0000-0000-000000000002') = 6, 'penuh 5 + 1 = 6 (boleh > 5)';
  assert (select hearts from public.player_hearts where user_id='ffffffff-0000-0000-0000-000000000003') = 3, 'stok 2 + 1';
  assert (select (v->>'sent_today')::int from out where k='list') = 2;
  assert (select count(*) from jsonb_array_elements((select v->'friends' from out where k='list')) e where (e->>'sent_today')::boolean) = 2;
  assert (select (e->>'gold')::boolean from jsonb_array_elements((select v->'friends' from out where k='list')) e
           where e->>'friend_id' = 'ffffffff-0000-0000-0000-000000000003') = true, 'teman tak aktif -> emas';
end $$;

-- hadiah ke akun yang sedang mengisi ulang: tidak hilang oleh batas 5
update public.player_hearts set hearts = 3, regen_at = now() - interval '12 minutes' where user_id='ffffffff-0000-0000-0000-000000000003';
delete from public.hearts_gifts where receiver_id='ffffffff-0000-0000-0000-000000000003';
set role authenticated; select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000001',false);
insert into out select 's3b', public.hearts_send('ffffffff-0000-0000-0000-000000000003');
reset role;
do $$ begin
  assert (select hearts from public.player_hearts where user_id='ffffffff-0000-0000-0000-000000000003') = 6, '3 + 2 isi ulang + 1 hadiah = 6';
end $$;

-- batas harian 25 teman
set role authenticated; select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000001',false);
do $$ declare i int; r jsonb; begin
  for i in 4..26 loop perform public.hearts_send(('ffffffff-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid); end loop;
end $$;
insert into out select 'cap', public.hearts_send('ffffffff-0000-0000-0000-000000000027');
reset role;
do $$ begin
  assert (select count(*) from public.hearts_gifts where sender_id='ffffffff-0000-0000-0000-000000000001' and day = public._hg_today()) = 25;
  assert (select v->>'reason' from out where k='cap') = 'batas-harian', 'teman ke-26 ditolak';
end $$;

-- bukan teman ditolak; akun lain tidak bisa kirim atas nama A
set role authenticated; select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-000000000002',false);
insert into out select 'nf', public.hearts_send('ffffffff-0000-0000-0000-000000000005');
reset role;
do $$ begin assert (select v->>'reason' from out where k='nf') = 'bukan-teman'; end $$;

rollback;
\echo 'hearts_friends_test: semua lulus'
