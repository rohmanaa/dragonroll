-- Tes migrasi 202611180001_appearance_many.sql. Jalankan di DB UJI yang SUDAH memuat semua migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values
  ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002'), ('bbbbbbbb-0000-0000-0000-000000000003');
-- u1 & u2 punya tampilan; hanya u2 punya statistik (muncul di leaderboard). u3 tidak punya apa pun.
insert into public.player_appearance(user_id, look, equipped, gear_dye) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '{"gender":"m"}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', '{"gender":"f"}'::jsonb, '{}'::jsonb, '{}'::jsonb);
insert into public.player_stats(user_id, name, plays) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Dua', 3)
  on conflict (user_id) do update set plays = 3;

set role authenticated; select set_config('request.jwt.claim.sub','',false);
do $$ declare ok boolean := false; begin
  begin perform public.appearance_get_many(array['bbbbbbbb-0000-0000-0000-000000000002']::uuid[]); exception when others then ok := sqlerrm = 'AUTH_REQUIRED'; end;
  assert ok, 'tanpa login harus AUTH_REQUIRED';
end $$;

select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
do $$ declare r jsonb; begin
  r := public.appearance_get_many(array['bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000003']::uuid[]);
  assert jsonb_array_length(r) = 2, 'diri sendiri + pemain leaderboard';
  assert r @> '[{"user_id":"bbbbbbbb-0000-0000-0000-000000000002"}]'::jsonb, 'pemain leaderboard terbaca';
  assert public.appearance_get_many(null) = '[]'::jsonb, 'null -> kosong';
end $$;

-- u3 tidak punya statistik: u1 tidak boleh membaca tampilannya (bila ada)
reset role;
insert into public.player_appearance(user_id, look, equipped, gear_dye) values ('bbbbbbbb-0000-0000-0000-000000000003', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
do $$ begin
  assert jsonb_array_length(public.appearance_get_many(array['bbbbbbbb-0000-0000-0000-000000000003']::uuid[])) = 0, 'bukan pemain leaderboard -> tertutup';
end $$;
reset role;
rollback;
