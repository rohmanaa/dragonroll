-- Tampilan aktif pemain lain untuk Leaderboard/Teman (kosmetik saja: look, equipped, gear_dye).
-- Hanya pemain yang tampil di leaderboard (punya baris player_stats dengan plays > 0) atau dirimu sendiri; maks 50 id per panggilan.
-- Tabel player_appearance tetap tertutup (RLS, tanpa grant); akses hanya lewat fungsi ini, appearance_get, dan room_appearance_get.
create or replace function public.appearance_get_many(p_user_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'look', a.look, 'equipped', a.equipped, 'gear_dye', a.gear_dye) order by a.user_id)
    from public.player_appearance a
    where a.user_id = any ((coalesce(p_user_ids, '{}'::uuid[]))[1:50])
      and (a.user_id = v_uid
           or exists (select 1 from public.player_stats s where s.user_id = a.user_id and s.plays > 0))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.appearance_get_many(uuid[]) from public, anon;
grant execute on function public.appearance_get_many(uuid[]) to authenticated;
