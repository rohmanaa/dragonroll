-- Keluar dari game yang sedang berjalan / sudah selesai.
-- Sebelumnya gameplay hanya pindah halaman, sehingga room lama tetap 'playing' dengan semua pemain
-- masih tercatat sebagai anggota (leave_game_room menolak GAME_IN_PROGRESS) dan bisa terbuka lagi.
create or replace function public.exit_game_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_players jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then return false; end if;
  if not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then return false; end if;

  select coalesce(jsonb_agg(p order by ord), '[]'::jsonb) into v_players
  from jsonb_array_elements(v_room.players) with ordinality as e(p, ord)
  where p->>'id' <> v_uid::text;

  if jsonb_array_length(v_players) = 0 then
    delete from public.game_rooms where id = p_room_id;
    return true;
  end if;

  -- host keluar saat game berjalan -> game host-authoritative berakhir; room ditandai selesai.
  update public.game_rooms
  set players = v_players,
      status = case when v_room.status = 'playing' and v_room.host_id = v_uid then 'finished' else v_room.status end,
      revision = revision + 1,
      updated_at = now()
  where id = p_room_id;
  return true;
end;
$$;

grant execute on function public.exit_game_room(uuid) to authenticated;
