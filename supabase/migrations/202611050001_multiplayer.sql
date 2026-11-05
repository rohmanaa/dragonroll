-- Ular Tangga Blok: anonymous multiplayer foundation
-- Apply this file in the Supabase SQL Editor or with Supabase CLI migrations.
-- Browser clients use Supabase Anonymous Auth (auth.uid()); never expose service_role.

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6,8}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  is_public boolean not null default false,
  format text not null default 'solo' check (format in ('solo', 'team')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players smallint not null default 4 check (max_players between 2 and 4),
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array'),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  game_state jsonb,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_public_waiting_idx
  on public.game_rooms (format, created_at)
  where is_public = true and status = 'waiting';

create index if not exists game_rooms_host_idx on public.game_rooms (host_id);

alter table public.game_rooms enable row level security;

drop policy if exists "room members can read their room" on public.game_rooms;
create policy "room members can read their room"
  on public.game_rooms for select to authenticated
  using (players @> jsonb_build_array(jsonb_build_object('id', (select auth.uid())::text)));

revoke all on public.game_rooms from anon, authenticated;
grant select on public.game_rooms to authenticated;

create or replace function public.create_game_room(
  p_code text,
  p_name text,
  p_is_public boolean default false,
  p_format text default 'solo',
  p_max_players integer default 4,
  p_config jsonb default '{}'::jsonb
) returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_name text := left(trim(coalesce(p_name, '')), 24);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name = '' then raise exception 'PLAYER_NAME_REQUIRED'; end if;
  delete from public.game_rooms where status = 'waiting' and updated_at < now() - interval '24 hours';
  if p_code !~ '^[A-Z0-9]{6,8}$' then raise exception 'INVALID_ROOM_CODE'; end if;
  if p_format not in ('solo', 'team') then raise exception 'INVALID_FORMAT'; end if;
  if p_max_players < 2 or p_max_players > 4 then raise exception 'INVALID_CAPACITY'; end if;
  if p_format = 'team' and p_max_players <> 4 then raise exception 'TEAM_ROOM_REQUIRES_FOUR_PLAYERS'; end if;

  insert into public.game_rooms(code, host_id, is_public, format, max_players, config, players)
  values (
    p_code, v_uid, coalesce(p_is_public, false), p_format, p_max_players,
    coalesce(p_config, '{}'::jsonb),
    jsonb_build_array(jsonb_build_object(
      'id', v_uid::text, 'name', v_name, 'ready', true,
      'team', case when p_format = 'team' then 1 else 0 end,
      'joined_at', now()
    ))
  ) returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.join_game_room(
  p_code text,
  p_name text
) returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_name text := left(trim(coalesce(p_name, '')), 24);
  v_team integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name = '' then raise exception 'PLAYER_NAME_REQUIRED'; end if;

  select * into v_room from public.game_rooms
    where code = upper(trim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status = 'waiting' and v_room.updated_at < now() - interval '10 minutes' then raise exception 'ROOM_EXPIRED'; end if;

  if exists (select 1 from jsonb_array_elements(v_room.players) p where p->>'id' = v_uid::text) then
    return v_room;
  end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_JOINABLE'; end if;
  if jsonb_array_length(v_room.players) >= v_room.max_players then raise exception 'ROOM_FULL'; end if;

  if v_room.format = 'team' then
    select t into v_team
    from (values (1), (2)) teams(t)
    order by (select count(*) from jsonb_array_elements(v_room.players) p where (p->>'team')::integer = t), t
    limit 1;
    if (select count(*) from jsonb_array_elements(v_room.players) p where (p->>'team')::integer = v_team) >= 2 then
      raise exception 'ROOM_FULL';
    end if;
  end if;

  update public.game_rooms
  set players = players || jsonb_build_array(jsonb_build_object(
        'id', v_uid::text, 'name', v_name, 'ready', false, 'team', v_team, 'joined_at', now()
      )),
      updated_at = now()
  where id = v_room.id
  returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.quick_join_game_room(
  p_name text,
  p_format text default 'solo'
) returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_name text := left(trim(coalesce(p_name, '')), 24);
  v_team integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name = '' then raise exception 'PLAYER_NAME_REQUIRED'; end if;
  if p_format not in ('solo', 'team') then raise exception 'INVALID_FORMAT'; end if;

  select * into v_room
  from public.game_rooms r
  where r.is_public = true and r.status = 'waiting' and r.format = p_format
    and r.updated_at > now() - interval '2 minutes'
    and jsonb_array_length(r.players) < r.max_players
    and not (r.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text)))
  order by r.created_at asc
  limit 1
  for update skip locked;

  if not found then raise exception 'NO_PUBLIC_ROOM_AVAILABLE'; end if;

  if v_room.format = 'team' then
    select t into v_team
    from (values (1), (2)) teams(t)
    order by (select count(*) from jsonb_array_elements(v_room.players) p where (p->>'team')::integer = t), t
    limit 1;
    if (select count(*) from jsonb_array_elements(v_room.players) p where (p->>'team')::integer = v_team) >= 2 then
      raise exception 'ROOM_FULL';
    end if;
  end if;

  update public.game_rooms
  set players = players || jsonb_build_array(jsonb_build_object(
        'id', v_uid::text, 'name', v_name, 'ready', false, 'team', v_team, 'joined_at', now()
      )),
      updated_at = now()
  where id = v_room.id
  returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.set_game_player_ready(
  p_room_id uuid,
  p_ready boolean
) returns public.game_rooms
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
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;

  update public.game_rooms r
  set players = (
        select jsonb_agg(case when p->>'id' = v_uid::text
          then jsonb_set(p, '{ready}', to_jsonb(coalesce(p_ready, false)), true)
          else p end order by ord)
        from jsonb_array_elements(r.players) with ordinality as e(p, ord)
      ),
      updated_at = now()
  where r.id = p_room_id
  returning * into v_room;
  return v_room;
end;
$$;

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
    v_new_host := (v_players->0->>'id')::uuid;
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
  set players = v_players, host_id = v_new_host, updated_at = now()
  where id = p_room_id;
  return true;
end;
$$;

create or replace function public.start_game_room(
  p_room_id uuid,
  p_game_state jsonb default '{}'::jsonb
) returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_id <> v_uid then raise exception 'HOST_ONLY'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  v_count := jsonb_array_length(v_room.players);
  if v_count < 2 then raise exception 'MINIMUM_TWO_PLAYERS'; end if;
  if v_room.format = 'team' and (v_count <> 4
    or (select count(*) from jsonb_array_elements(v_room.players) p where (p->>'team')::integer = 1) <> 2
    or (select count(*) from jsonb_array_elements(v_room.players) p where (p->>'team')::integer = 2) <> 2) then
    raise exception 'TEAM_ROOM_REQUIRES_TWO_V_TWO';
  end if;
  if exists (select 1 from jsonb_array_elements(v_room.players) p where coalesce((p->>'ready')::boolean, false) = false) then
    raise exception 'PLAYERS_NOT_READY';
  end if;

  update public.game_rooms
  set status = 'playing', game_state = coalesce(p_game_state, '{}'::jsonb),
      revision = revision + 1, updated_at = now()
  where id = p_room_id
  returning * into v_room;
  return v_room;
end;
$$;

create or replace function public.update_game_state(
  p_room_id uuid,
  p_game_state jsonb,
  p_expected_revision bigint
) returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.game_rooms
  set game_state = p_game_state,
      status = case when p_game_state->'snapshot'->>'gameOver' = 'true' then 'finished' else status end,
      revision = revision + 1, updated_at = now()
  where id = p_room_id and host_id = v_uid and status = 'playing'
    and revision = p_expected_revision
  returning * into v_room;
  if not found then
    if exists (select 1 from public.game_rooms where id = p_room_id and host_id = v_uid and status = 'playing') then
      raise exception 'REVISION_CONFLICT';
    end if;
    raise exception 'HOST_ONLY_OR_ROOM_NOT_PLAYING';
  end if;
  return v_room;
end;
$$;

grant execute on function public.create_game_room(text,text,boolean,text,integer,jsonb) to authenticated;
grant execute on function public.join_game_room(text,text) to authenticated;
grant execute on function public.quick_join_game_room(text,text) to authenticated;
grant execute on function public.set_game_player_ready(uuid,boolean) to authenticated;
grant execute on function public.leave_game_room(uuid) to authenticated;
grant execute on function public.start_game_room(uuid,jsonb) to authenticated;
grant execute on function public.update_game_state(uuid,jsonb,bigint) to authenticated;

-- Enable Postgres Changes for realtime subscriptions.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'game_rooms'
  ) then
    alter publication supabase_realtime add table public.game_rooms;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication not found; enable Realtime for public.game_rooms in Supabase dashboard';
end $$;

create or replace function public.set_game_room_visibility(
  p_room_id uuid,
  p_is_public boolean
) returns public.game_rooms
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.game_rooms
  set is_public = coalesce(p_is_public, false), updated_at = now()
  where id = p_room_id and host_id = v_uid and status = 'waiting'
  returning * into v_room;
  if not found then raise exception 'HOST_ONLY_OR_ROOM_NOT_WAITING'; end if;
  return v_room;
end;
$$;
grant execute on function public.set_game_room_visibility(uuid,boolean) to authenticated;

create or replace function public.heartbeat_game_room(p_room_id uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.game_rooms set updated_at = now() where id = p_room_id and host_id = v_uid and status in ('waiting','playing');
 return found;
end; $$;
revoke all on function public.create_game_room(text,text,boolean,text,integer,jsonb) from public, anon;
revoke all on function public.join_game_room(text,text) from public, anon;
revoke all on function public.quick_join_game_room(text,text) from public, anon;
revoke all on function public.set_game_player_ready(uuid,boolean) from public, anon;
revoke all on function public.leave_game_room(uuid) from public, anon;
revoke all on function public.start_game_room(uuid,jsonb) from public, anon;
revoke all on function public.update_game_state(uuid,jsonb,bigint) from public, anon;
revoke all on function public.set_game_room_visibility(uuid,boolean) from public, anon;
revoke all on function public.heartbeat_game_room(uuid) from public, anon;
grant execute on function public.heartbeat_game_room(uuid) to authenticated;
