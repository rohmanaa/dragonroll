-- Teman nyata: daftar teman disimpan per pemain (dua arah). Status online datang dari Realtime Presence.
create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  friend_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "read own friends" on public.friendships;
create policy "read own friends" on public.friendships for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create or replace function public.add_friend(p_friend_id uuid, p_friend_name text, p_my_name text)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_fn text := left(trim(coalesce(p_friend_name,'')),24); v_mn text := left(trim(coalesce(p_my_name,'')),24);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_friend_id = v_uid then raise exception 'CANNOT_ADD_SELF'; end if;
  if v_fn = '' or v_mn = '' then raise exception 'NAME_REQUIRED'; end if;
  if not exists (select 1 from auth.users where id = p_friend_id) then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.friendships(user_id, friend_id, friend_name) values (v_uid, p_friend_id, v_fn)
    on conflict (user_id, friend_id) do update set friend_name = excluded.friend_name;
  insert into public.friendships(user_id, friend_id, friend_name) values (p_friend_id, v_uid, v_mn)
    on conflict (user_id, friend_id) do update set friend_name = excluded.friend_name;
  return true;
end; $$;

create or replace function public.remove_friend(p_friend_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.friendships where (user_id = auth.uid() and friend_id = p_friend_id) or (user_id = p_friend_id and friend_id = auth.uid());
  return true;
end; $$;

grant execute on function public.add_friend(uuid,text,text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
