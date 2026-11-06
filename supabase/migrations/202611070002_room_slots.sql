-- Host membuka slot terkunci pada room online (Solo): 2 -> 3 -> 4 pemain.
create or replace function public.set_game_room_slots(p_room_id uuid, p_max_players integer)
returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_id <> v_uid then raise exception 'HOST_ONLY'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  if v_room.format = 'team' then raise exception 'TEAM_ROOM_FIXED_AT_FOUR'; end if;
  if p_max_players < 2 or p_max_players > 4 then raise exception 'INVALID_CAPACITY'; end if;
  if p_max_players < jsonb_array_length(v_room.players) then raise exception 'SLOT_IN_USE'; end if;
  update public.game_rooms set max_players = p_max_players, updated_at = now()
  where id = p_room_id returning * into v_room;
  return v_room;
end;
$$;
grant execute on function public.set_game_room_slots(uuid,integer) to authenticated;
