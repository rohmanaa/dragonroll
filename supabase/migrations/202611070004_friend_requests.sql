-- Permintaan pertemanan (menggantikan add_friend yang langsung menambah tanpa persetujuan).
create table if not exists public.friend_requests (
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  from_name text not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
alter table public.friend_requests enable row level security;
drop policy if exists "read own requests" on public.friend_requests;
create policy "read own requests" on public.friend_requests for select to authenticated
  using (to_id = (select auth.uid()) or from_id = (select auth.uid()));
revoke all on public.friend_requests from anon, authenticated;
grant select on public.friend_requests to authenticated;

drop function if exists public.add_friend(uuid, text, text);

create or replace function public.send_friend_request(
  p_target_id uuid, p_username text, p_my_name text, p_target_name text default null
) returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := p_target_id;
  v_tname text;
  v_mn text := left(trim(coalesce(p_my_name, '')), 24);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_mn = '' then raise exception 'NAME_REQUIRED'; end if;
  if v_target is null then
    select u.id, coalesce(u.raw_user_meta_data->>'username', p_username) into v_target, v_tname
    from auth.users u
    where lower(u.raw_user_meta_data->>'username') = lower(trim(coalesce(p_username, '')))
      and coalesce(u.is_anonymous, false) = false
    limit 1;
  else
    select coalesce(u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'display_name', nullif(left(trim(coalesce(p_target_name, '')), 24), ''))
      into v_tname from auth.users u where u.id = v_target;
  end if;
  if v_target is null or v_tname is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_target = v_uid then raise exception 'CANNOT_ADD_SELF'; end if;
  if exists (select 1 from public.friendships where user_id = v_uid and friend_id = v_target) then raise exception 'ALREADY_FRIENDS'; end if;

  -- sudah ada permintaan dari dia ke kita -> langsung berteman
  if exists (select 1 from public.friend_requests where from_id = v_target and to_id = v_uid) then
    insert into public.friendships(user_id, friend_id, friend_name) values (v_uid, v_target, left(v_tname, 24))
      on conflict (user_id, friend_id) do update set friend_name = excluded.friend_name;
    insert into public.friendships(user_id, friend_id, friend_name) values (v_target, v_uid, v_mn)
      on conflict (user_id, friend_id) do update set friend_name = excluded.friend_name;
    delete from public.friend_requests where from_id = v_target and to_id = v_uid;
    return 'accepted';
  end if;

  insert into public.friend_requests(from_id, to_id, from_name) values (v_uid, v_target, v_mn)
    on conflict (from_id, to_id) do update set from_name = excluded.from_name;
  return 'sent';
end; $$;

create or replace function public.accept_friend_request(p_from_id uuid, p_my_name text)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_req public.friend_requests; v_mn text := left(trim(coalesce(p_my_name, '')), 24);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_mn = '' then raise exception 'NAME_REQUIRED'; end if;
  select * into v_req from public.friend_requests where from_id = p_from_id and to_id = v_uid;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  insert into public.friendships(user_id, friend_id, friend_name) values (v_uid, p_from_id, left(v_req.from_name, 24))
    on conflict (user_id, friend_id) do update set friend_name = excluded.friend_name;
  insert into public.friendships(user_id, friend_id, friend_name) values (p_from_id, v_uid, v_mn)
    on conflict (user_id, friend_id) do update set friend_name = excluded.friend_name;
  delete from public.friend_requests where from_id = p_from_id and to_id = v_uid;
  return true;
end; $$;

create or replace function public.decline_friend_request(p_from_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.friend_requests where from_id = p_from_id and to_id = auth.uid();
  return true;
end; $$;

grant execute on function public.send_friend_request(uuid,text,text,text) to authenticated;
grant execute on function public.accept_friend_request(uuid,text) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
