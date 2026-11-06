-- Dadu dari server, tahap 3B+: modifier dadu (Pasti 6, Ganjil, Genap, Special Dice) ikut diundi/divalidasi server dan tercatat di log.
-- Terapkan setelah 202611100002_roll_game_dice.sql. Menggantikan roll_game_dice versi 3 argumen dengan versi 5 argumen.
--
-- Batas yang disengaja:
--  * Server tidak tahu apakah pemain memang punya flag Pasti 6/Ganjil/Genap atau sedang di Block 100 untuk Special Dice;
--    ia hanya mengundi di himpunan angka yang sesuai mode dan mencatat `mode` di payload event (jadi terlihat di log).
--  * Server belum tahu aturan giliran, jadi belum bisa mencegah host meminta undian lagi (butuh tahap 3C).

drop function if exists public.roll_game_dice(uuid, uuid, uuid);

create or replace function public.roll_game_dice(
  p_room_id uuid,
  p_player_id uuid default null,
  p_client_event_id uuid default null,
  p_mode text default 'normal',
  p_value int default null
) returns public.game_events
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_room public.game_rooms;
  v_event public.game_events;
  v_value int;
  v_mode text := coalesce(p_mode, 'normal');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_mode not in ('normal', 'lucky', 'odd', 'even', 'special') then raise exception 'INVALID_DICE_MODE'; end if;
  if v_mode = 'special' and (p_value is null or p_value < 1 or p_value > 6) then raise exception 'INVALID_DICE_VALUE'; end if;
  v_target := coalesce(p_player_id, v_uid);

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
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

  v_value := case v_mode
    when 'lucky'   then 6
    when 'odd'     then (array[1, 3, 5])[1 + floor(random() * 3)::int]
    when 'even'    then (array[2, 4, 6])[1 + floor(random() * 3)::int]
    when 'special' then p_value
    else 1 + floor(random() * 6)::int
  end;

  update public.game_rooms
    set event_seq = event_seq + 1, last_dice_at = now()
    where id = p_room_id
    returning * into v_room;
  insert into public.game_events(room_id, seq, player_id, type, payload, client_event_id)
    values (p_room_id, v_room.event_seq, v_uid, 'roll',
            jsonb_build_object('v', v_value, 'pid', v_target::text, 'src', 'server', 'mode', v_mode),
            p_client_event_id)
    returning * into v_event;
  return v_event;
end;
$$;
revoke all on function public.roll_game_dice(uuid, uuid, uuid, text, int) from public, anon;
grant execute on function public.roll_game_dice(uuid, uuid, uuid, text, int) to authenticated;
