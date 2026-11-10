-- Host keluar room: host baru dipilih ACAK di antara pemain asli (bukan bot) yang masih di dalam room,
-- bukan lagi selalu pemain pertama. Tidak ada pemain asli tersisa = room dihapus.
-- Perubahan host ditulis di baris game_rooms (host_id + players[].kind), sehingga langganan realtime
-- langsung mengabarkan ke semua klien tanpa perlu refresh.
create or replace function public.leave_game_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_players jsonb;
  v_new_host uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then return false; end if;
  if v_room.status = 'playing' then raise exception 'GAME_IN_PROGRESS'; end if;
  if not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  select coalesce(jsonb_agg(p order by ord), '[]'::jsonb) into v_players
  from jsonb_array_elements(v_room.players) with ordinality as e(p, ord)
  where p->>'id' <> v_uid::text;

  if jsonb_array_length(v_players) = 0 then
    delete from public.game_rooms where id = p_room_id;
    return true;
  end if;

  if v_room.host_id = v_uid then
    select (p->>'id')::uuid into v_new_host
    from jsonb_array_elements(v_players) as e(p)
    where coalesce(p->>'kind', '') <> 'bot'
    order by random() limit 1;
    if v_new_host is null then
      delete from public.game_rooms where id = p_room_id;   -- hanya bot yang tersisa
      return true;
    end if;
    v_players := (
      select jsonb_agg(case when p->>'id' = v_new_host::text
        then jsonb_set(p, '{kind}', '"host"'::jsonb, true)
        else p end order by ord)
      from jsonb_array_elements(v_players) with ordinality as e(p, ord)
    );
  else
    v_new_host := v_room.host_id;
  end if;

  update public.game_rooms
  set players = v_players, host_id = v_new_host, revision = revision + 1, updated_at = now()
  where id = p_room_id;
  return true;
end;
$$;

grant execute on function public.leave_game_room(uuid) to authenticated;
