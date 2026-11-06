-- Uji SQL roll_game_dice. Prasyarat sama dengan game_events_test.sql (stub auth + migrasi 202611050001, 202611060001, 202611100001).
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

-- Setup: A (host) buat room, B join, keduanya ready, A start. C bukan anggota.
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
set role authenticated;
select (create_game_room('DICEROOM','Alpha',false,'solo',2,'{}'::jsonb)).id as room_id \gset
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select (join_game_room('DICEROOM','Beta')).id is not null as joined \gset
select set_game_player_ready(:'room_id', true) is not null as ready \gset
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
select start_game_room(:'room_id', '{}'::jsonb) is not null as started \gset

-- D1: undian host untuk dirinya: 1..6, tercatat sebagai event roll dengan src=server.
select gen_random_uuid() as cid \gset
select (roll_game_dice(:'room_id', null, :'cid')).id as eid \gset
select __chk((select (payload->>'v')::int between 1 and 6 and payload->>'src' = 'server' and payload->>'pid' = :'A' and type = 'roll'
              from game_events where id = :eid), 'D1 event roll server valid') \g /dev/null

-- D2: idempoten: client_event_id yang sama mengembalikan event yang sama, seq tidak bertambah.
select (roll_game_dice(:'room_id', null, :'cid')).id = :eid as same \gset
select __chk(:'same', 'D2 idempoten') \g /dev/null
select __chk((select count(*) from game_events where room_id = :'room_id') = 1, 'D2 tidak ada event baru') \g /dev/null

-- D3: jeda minimum: undian baru langsung setelahnya ditolak, setelah jeda lolos.
select __err(format('select roll_game_dice(%L, null, gen_random_uuid())', :'room_id'), 'ROLL_TOO_FAST') \g /dev/null
reset role;
update public.game_rooms set last_dice_at = now() - interval '2 seconds' where id = :'room_id';
set role authenticated;
select (roll_game_dice(:'room_id', :'B', gen_random_uuid())).seq as s2 \gset
select __chk(:s2 = 2, 'D3 seq berlanjut 2') \g /dev/null
select __chk((select payload->>'pid' from game_events where room_id = :'room_id' and seq = 2) = :'B', 'D3 pid = tamu B') \g /dev/null

-- D4: tamu tidak boleh mengundi untuk pemain lain; non-anggota ditolak; target di luar room ditolak.
reset role;
update public.game_rooms set last_dice_at = now() - interval '2 seconds' where id = :'room_id';
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
set role authenticated;
select __err(format('select roll_game_dice(%L, %L, gen_random_uuid())', :'room_id', :'A'), 'ROLL_FOR_OTHER_NOT_ALLOWED') \g /dev/null
select set_config('request.jwt.claim.sub', :'C', false) \g /dev/null
select __err(format('select roll_game_dice(%L, null, gen_random_uuid())', :'room_id'), 'ROOM_ACCESS_DENIED') \g /dev/null
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
select __err(format('select roll_game_dice(%L, %L, gen_random_uuid())', :'room_id', :'C'), 'ROLL_TARGET_NOT_IN_ROOM') \g /dev/null

-- D5: event roll tidak bisa dipalsukan lewat jalur submit_game_action.
select __err(format('select submit_game_action(%L, %L, %L::jsonb, null)', :'room_id', 'roll', '{"v":6}'), 'ROLL_EVENT_SERVER_ONLY') \g /dev/null

-- D6: distribusi sehat: 600 undian menghasilkan semua angka 1..6 (server, tanpa jeda lewat reset waktu).
reset role;
do $$
declare i int; r public.game_events; seen int[] := '{}'; v int; rid uuid;
begin
  select id into rid from public.game_rooms where code = 'DICEROOM';
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  for i in 1..600 loop
    update public.game_rooms set last_dice_at = null where id = rid;
    set local role authenticated;
    r := public.roll_game_dice(rid, null, gen_random_uuid());
    reset role;
    v := (r.payload->>'v')::int;
    if v < 1 or v > 6 then raise exception 'ASSERT FAILED: nilai % di luar 1..6', v; end if;
    if not (v = any(seen)) then seen := seen || v; end if;
  end loop;
  if array_length(seen, 1) <> 6 then raise exception 'ASSERT FAILED: hanya muncul % angka berbeda', array_length(seen, 1); end if;
end $$;

-- D7: ruang yang belum/tidak sedang bermain ditolak.
reset role;
update public.game_rooms set status = 'finished', last_dice_at = null where id = :'room_id';
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
set role authenticated;
select __err(format('select roll_game_dice(%L, null, gen_random_uuid())', :'room_id'), 'ROOM_NOT_PLAYING') \g /dev/null
reset role;
select 'roll_game_dice_test: OK';
