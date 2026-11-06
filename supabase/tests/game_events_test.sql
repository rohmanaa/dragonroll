-- Uji SQL game_events. Jalankan di Postgres dengan stub auth (lihat game/laporan-audit.html, bagian event log multiplayer).
-- Variabel psql tidak diinterpolasi di dalam $$, jadi asersi memakai helper __chk / __err.
-- Peran dipasang lewat request.jwt.claim.sub + SET ROLE authenticated. Gagal = psql berhenti dengan error.
\set ON_ERROR_STOP on
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'
\pset tuples_only on
reset role;
create or replace function public.__chk(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function public.__err(q text, pat text) returns void language plpgsql as $$
declare m text;
begin
  begin execute q; exception when others then m := sqlerrm; end;
  if m is null then raise exception 'ASSERT FAILED: expected error % but none', pat; end if;
  if m not like '%' || pat || '%' then raise exception 'ASSERT FAILED: expected % got %', pat, m; end if;
end $$;
grant execute on function public.__chk(boolean,text), public.__err(text,text) to authenticated;
insert into auth.users(id) values (:'A'),(:'B'),(:'C') on conflict do nothing;

-- Setup: A buat room, B join, keduanya ready, A start.
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
set role authenticated;
select (create_game_room('TESTROOM','Alpha',false,'solo',2,'{}'::jsonb)).id as room_id \gset
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select (join_game_room('TESTROOM','Beta')).id is not null as joined \gset
select set_game_player_ready(:'room_id', true) is not null as ready \gset
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
select start_game_room(:'room_id', '{}'::jsonb) is not null as started \gset

-- T1: seq berurutan dari dua pemain berbeda (host bukan server).
select (submit_game_action(:'room_id','move','{"to":4}'::jsonb, gen_random_uuid())).seq as s1 \gset
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select (submit_game_action(:'room_id','turn_begin','{"t":2}'::jsonb, gen_random_uuid())).seq as s2 \gset
select (submit_game_action(:'room_id','move','{"to":6}'::jsonb, null)).seq as s3 \gset
select __chk(:s1 = 1 and :s2 = 2 and :s3 = 3, 'T1 seq harus 1,2,3') \g /dev/null

-- T2: idempoten.
select gen_random_uuid() as cid \gset
select (submit_game_action(:'room_id','toast','{"k":"x"}'::jsonb, :'cid')).seq as i1 \gset
select (submit_game_action(:'room_id','toast','{"k":"x"}'::jsonb, :'cid')).seq as i2 \gset
select (submit_game_action(:'room_id','toast','{"k":"y"}'::jsonb, null)).seq as i3 \gset
select __chk(:i1 = :i2, 'T2a kirim ulang -> seq sama') \g /dev/null
select __chk(:i3 = :i1 + 1, 'T2b seq berikutnya tidak loncat') \g /dev/null

-- T3: penolakan.
select __err(format('select submit_game_action(%L,%L,%L::jsonb,null)', :'room_id', 'hack', '{}'), 'INVALID_EVENT_TYPE') \g /dev/null
select __err(format('select submit_game_action(%L,%L,%L::jsonb,null)', :'room_id', 'sfx', '{"coins":999}'), 'PRIVATE_FIELD_NOT_ALLOWED') \g /dev/null
select __err(format('select submit_game_action(%L,%L,%L::jsonb,null)', :'room_id', 'sfx', jsonb_build_object('x', repeat('a', 5000))::text), 'PAYLOAD_TOO_LARGE') \g /dev/null

-- T4: bukan anggota (C) tidak bisa kirim maupun baca.
select set_config('request.jwt.claim.sub', :'C', false) \g /dev/null
select __err(format('select submit_game_action(%L,%L,%L::jsonb,null)', :'room_id', 'sfx', '{}'), 'ROOM_ACCESS_DENIED') \g /dev/null
select count(*) as c_events from game_events \gset
select count(*) as c_rooms from game_rooms \gset
select __chk(:c_events = 0 and :c_rooms = 0, 'T4 non-member tidak boleh membaca event/room') \g /dev/null

-- T5: anggota membaca log room-nya, kontigu mulai dari 1; tulis langsung ke tabel ditolak.
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select count(*) as n, min(seq) as mn, max(seq) as mx from game_events where room_id = :'room_id' \gset
select __chk(:n = :mx and :mn = 1, 'T5a log kontigu dari 1') \g /dev/null
select __err(format('insert into game_events(room_id,seq,player_id,type) values (%L, 999, %L, %L)', :'room_id', :'B', 'sfx'), 'permission denied') \g /dev/null

-- T6: profil publik hanya whitelist, tanpa data privat.
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
select (set_game_public_profile(:'room_id','{"diceId":"diamond","characterSkinId":"steve","coins":500,"inventory":["x"]}'::jsonb)).players::text as pl \gset
select (e->'public_profile'->>'diceId' = 'diamond'
        and not (e->'public_profile' ? 'coins') and not (e->'public_profile' ? 'inventory')) as prof_ok
  from jsonb_array_elements(:'pl'::jsonb) e where e->>'name' = 'Alpha' \gset
select __chk(:'prof_ok'::boolean, 'T6 diceId tersimpan, data privat dibuang') \g /dev/null

-- T7: reward idempoten per akun per game.
select claim_game_reward(:'room_id','g1') as r1 \gset
select claim_game_reward(:'room_id','g1') as r2 \gset
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select claim_game_reward(:'room_id','g1') as r3 \gset
select __chk(:'r1'::boolean and not :'r2'::boolean and :'r3'::boolean, 'T7 klaim pertama true, ulang false, akun lain true') \g /dev/null
select set_config('request.jwt.claim.sub', :'C', false) \g /dev/null
select __err(format('select claim_game_reward(%L,%L)', :'room_id', 'g1'), 'ROOM_ACCESS_DENIED') \g /dev/null

-- T8: room waiting menolak event baru.
reset role;
insert into game_rooms(code, host_id, players, status) values ('WAITROOM', :'A', jsonb_build_array(jsonb_build_object('id', :'A')), 'waiting') returning id as wid \gset
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
set role authenticated;
select __err(format('select submit_game_action(%L,%L,%L::jsonb,null)', :'wid', 'sfx', '{}'), 'ROOM_NOT_PLAYING') \g /dev/null

reset role;
drop function public.__chk(boolean,text);
drop function public.__err(text,text);
select 'SQL_ALL_PASS';
