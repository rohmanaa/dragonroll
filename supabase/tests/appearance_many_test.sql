-- Tes migrasi 202611220001_appearance_many.sql. Jalankan di DB UJI yang SUDAH memuat semua migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values
  ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002'), ('bbbbbbbb-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000004'), ('bbbbbbbb-0000-0000-0000-000000000005');
insert into public.player_appearance(user_id, look, equipped, gear_dye)
  select u, '{"gender":"f"}'::jsonb, '{}'::jsonb, '{}'::jsonb
  from unnest(array['bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000003',
                    'bbbbbbbb-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000005']::uuid[]) u;
-- u1 berteman dengan u2; u3 mengirim permintaan ke u1; u4 ada di leaderboard; u5 tidak berhubungan sama sekali
insert into public.friendships(user_id, friend_id, friend_name) values ('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Dua');
insert into public.friend_requests(from_id, to_id, from_name) values ('bbbbbbbb-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001','Tiga');
insert into public.player_stats(user_id, name, plays) values ('bbbbbbbb-0000-0000-0000-000000000004', 'Empat', 3)
  on conflict (user_id) do update set plays = 3;

set role authenticated; select set_config('request.jwt.claim.sub','',false);
do $$ declare ok boolean := false; begin
  begin perform public.appearance_get_many(array['bbbbbbbb-0000-0000-0000-000000000002']::uuid[]); exception when others then ok := sqlerrm = 'AUTH_REQUIRED'; end;
  assert ok, 'tanpa login harus AUTH_REQUIRED';
end $$;

select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
do $$ declare r jsonb; begin
  r := public.appearance_get_many(array['bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000003',
        'bbbbbbbb-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000005']::uuid[]);
  assert jsonb_array_length(r) = 4, 'diri, teman, pengirim permintaan, pemain leaderboard';
  assert not (r @> '[{"user_id":"bbbbbbbb-0000-0000-0000-000000000005"}]'::jsonb), 'orang asing tertutup';
  assert public.appearance_get_many(null) = '[]'::jsonb, 'null -> kosong';
end $$;
reset role;
rollback;
