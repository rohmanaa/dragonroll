-- Nama teman = username akun SAAT INI, bukan salinan teks lama.
-- Sebelumnya friendships.friend_name disimpan sekali saat pertemanan dibuat (nama kiriman klien, bisa 'Player-XXXX' bila saat itu
-- masih tamu) dan tidak pernah diperbarui, lalu daftar "teman online" memakainya. Fungsi ini menghitung nama dari auth.users
-- dengan aturan yang sama seperti player_stats_enforce_name (202611090002): akun game -> username dari email internal.
-- friendships.friend_name tetap ada sebagai cadangan bila akun tidak punya username (mis. pemain anonim).
-- Terapkan SETELAH 202611070003_friendships.sql.

create or replace function public.list_my_friends()
returns table (friend_id uuid, friend_name text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return query
  select f.friend_id,
         left(coalesce(
           case when lower(u.email) like '%@dragonroll-game.com' then
             case when nullif(btrim(coalesce(u.raw_user_meta_data ->> 'username', '')), '') is not null
                   and lower(btrim(u.raw_user_meta_data ->> 'username')) = split_part(lower(u.email), '@', 1)
                  then btrim(u.raw_user_meta_data ->> 'username')
                  else split_part(u.email, '@', 1) end
           end,
           nullif(btrim(f.friend_name), ''), 'Player'), 24)
  from public.friendships f
  left join auth.users u on u.id = f.friend_id
  where f.user_id = auth.uid()
  order by 2;
end; $$;

revoke all on function public.list_my_friends() from public, anon;
grant execute on function public.list_my_friends() to authenticated;
