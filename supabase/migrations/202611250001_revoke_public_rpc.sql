-- Hardening: RPC sosial & room hanya untuk pengguna login (authenticated). Default Postgres memberi EXECUTE ke PUBLIC,
-- sehingga role anon masih bisa memanggilnya. Fungsi sudah memeriksa auth.uid(); ini lapisan tambahan. Idempoten.
revoke all on function public.add_friend(uuid, text, text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.send_friend_request(uuid, text, text, text) from public, anon;
revoke all on function public.accept_friend_request(uuid, text) from public, anon;
revoke all on function public.decline_friend_request(uuid) from public, anon;
revoke all on function public.exit_game_room(uuid) from public, anon;
revoke all on function public.set_game_room_slots(uuid, integer) from public, anon;
grant execute on function public.add_friend(uuid, text, text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.send_friend_request(uuid, text, text, text) to authenticated;
grant execute on function public.accept_friend_request(uuid, text) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
grant execute on function public.exit_game_room(uuid) to authenticated;
grant execute on function public.set_game_room_slots(uuid, integer) to authenticated;
