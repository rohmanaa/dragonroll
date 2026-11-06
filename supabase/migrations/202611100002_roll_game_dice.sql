-- Tahap 1 anti-curang dadu (3B): angka dadu diundi SERVER, bukan Math.random() di browser host.
-- Hasil dicatat sebagai event 'roll' di game_events, jadi semua pemain bisa melihat log yang sama.
-- Tidak mengubah tabel/RPC lain. Terapkan setelah 202611060001_game_events.sql.
--
-- Batas yang disengaja (ditutup di tahap 3C, server menjalankan game penuh):
--  * Server belum tahu giliran siapa; ia hanya memastikan pemanggil anggota room dan target pemain anggota room.
--  * Host masih bisa memanggil fungsi ini lagi dengan p_client_event_id baru untuk "mengulang" undian.
--    Jeda minimum antar-undian per room (di bawah) hanya memperlambat itu, tidak mencegahnya.
--  * Modifier dadu (Pasti 6, Ganjil, Genap, Special Dice) masih diterapkan di klien setelah undian.

-- Waktu undian terakhir per room, untuk jeda minimum.
alter table public.game_rooms add column if not exists last_dice_at timestamptz;

-- Mengundi 1-6 untuk p_player_id (default: pemanggil), mencatatnya sebagai event 'roll', mengembalikan barisnya.
-- Idempoten: p_client_event_id yang sama dari pemanggil yang sama mengembalikan event lama (angka tidak diundi ulang).
create or replace function public.roll_game_dice(
  p_room_id uuid,
  p_player_id uuid default null,
  p_client_event_id uuid default null
) returns public.game_events
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_room public.game_rooms;
  v_event public.game_events;
  v_value int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_target := coalesce(p_player_id, v_uid);

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
  -- Hanya host yang boleh mengundi untuk pemain lain (host menjalankan giliran tamu dan pemain AUTO).
  if v_target <> v_uid and v_room.host_id is distinct from v_uid then
    raise exception 'ROLL_FOR_OTHER_NOT_ALLOWED';
  end if;
  if not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_target::text))) then
    raise exception 'ROLL_TARGET_NOT_IN_ROOM';
  end if;

  if p_client_event_id is not null then
    select * into v_event from public.game_events
      where room_id = p_room_id and player_id = v_uid and client_event_id = p_client_event_id;
    if found then return v_event; end if;
  end if;

  if v_room.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  if v_room.last_dice_at is not null and v_room.last_dice_at > now() - interval '700 milliseconds' then
    raise exception 'ROLL_TOO_FAST';
  end if;

  v_value := 1 + floor(random() * 6)::int;

  update public.game_rooms
    set event_seq = event_seq + 1, last_dice_at = now()
    where id = p_room_id
    returning * into v_room;
  insert into public.game_events(room_id, seq, player_id, type, payload, client_event_id)
    values (p_room_id, v_room.event_seq, v_uid, 'roll',
            jsonb_build_object('v', v_value, 'pid', v_target::text, 'src', 'server'),
            p_client_event_id)
    returning * into v_event;
  return v_event;
end;
$$;
revoke all on function public.roll_game_dice(uuid, uuid, uuid) from public, anon;
grant execute on function public.roll_game_dice(uuid, uuid, uuid) to authenticated;

-- Event 'roll' tidak lagi boleh ditulis klien lewat jalur umum, supaya angka dadu di log hanya berasal dari server.
create or replace function public.submit_game_action(
  p_room_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_client_event_id uuid default null
) returns public.game_events
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_event public.game_events;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.game_event_type_allowed(p_type) then raise exception 'INVALID_EVENT_TYPE'; end if;
  if p_type = 'roll' then raise exception 'ROLL_EVENT_SERVER_ONLY'; end if;
  if jsonb_typeof(v_payload) <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if pg_column_size(v_payload) > 4096 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if v_payload ?| array['coins','coin','gems','gem','xp','inventory','email','purchases'] then
    raise exception 'PRIVATE_FIELD_NOT_ALLOWED';
  end if;

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  if p_client_event_id is not null then
    select * into v_event from public.game_events
      where room_id = p_room_id and player_id = v_uid and client_event_id = p_client_event_id;
    if found then return v_event; end if;
  end if;

  if v_room.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;

  update public.game_rooms set event_seq = event_seq + 1 where id = p_room_id
    returning * into v_room;
  insert into public.game_events(room_id, seq, player_id, type, payload, client_event_id)
    values (p_room_id, v_room.event_seq, v_uid, p_type, v_payload, p_client_event_id)
    returning * into v_event;
  return v_event;
end;
$$;
revoke all on function public.submit_game_action(uuid,text,jsonb,uuid) from public, anon;
grant execute on function public.submit_game_action(uuid,text,jsonb,uuid) to authenticated;
