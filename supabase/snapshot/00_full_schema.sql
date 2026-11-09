-- ============================================================================
-- DRAGON ROLL / Ular Tangga Blok — SKEMA LENGKAP SUPABASE (gabungan semua migrasi)
-- Dibuat otomatis oleh tools/build-schema-snapshot.sh dari supabase/migrations/*.sql — JANGAN diedit manual.
-- Untuk proyek Supabase BARU/KOSONG: tempel seluruh isi file ini di SQL Editor lalu Run (sekali).
-- Syarat dashboard: Authentication > Providers > Email aktif dan "Confirm email" DIMATIKAN.
-- JANGAN dijalankan di proyek yang sudah memakai migrasi (tabel sudah ada) dan JANGAN ditaruh di supabase/migrations/.
-- Isi: 24 migrasi, urut: 202611050001 s/d 202611180001
-- ============================================================================

-- ---------------------------------------------------------------------------
-- >>> 202611050001_multiplayer.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611060001_game_events.sql
-- ---------------------------------------------------------------------------
-- Langkah 2: fondasi event log multiplayer.
-- Semua aksi/kejadian ditulis sebagai event berurutan per room; semua klien memutar log yang sama.
-- "Host" = pemain biasa: setiap anggota room boleh submit event. Validasi aturan game/dadu oleh server = Tahap 2 arsitektur (bukan di sini).
-- Tidak mengubah RPC/tabel multiplayer yang sudah ada, kecuali menambah kolom game_rooms.event_seq.

alter table public.game_rooms add column if not exists event_seq bigint not null default 0;

-- Helper keanggotaan (security definer agar policy tidak rekursif).
create or replace function public.is_game_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.game_rooms r
    where r.id = p_room_id
      and r.players @> jsonb_build_array(jsonb_build_object('id', (select auth.uid())::text))
  );
$$;
revoke all on function public.is_game_room_member(uuid) from public, anon;
grant execute on function public.is_game_room_member(uuid) to authenticated;

create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  seq bigint not null check (seq > 0),
  player_id uuid not null,
  type text not null check (char_length(type) between 1 and 32),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  client_event_id uuid,
  created_at timestamptz not null default now(),
  unique (room_id, seq)
);
create unique index if not exists game_events_client_event_uidx
  on public.game_events (room_id, player_id, client_event_id) where client_event_id is not null;

alter table public.game_events enable row level security;
drop policy if exists "room members can read room events" on public.game_events;
create policy "room members can read room events"
  on public.game_events for select to authenticated
  using (public.is_game_room_member(room_id));
revoke all on public.game_events from anon, authenticated;
grant select on public.game_events to authenticated;

-- Daftar type yang dikenal (kontrak event; payload detail ditentukan Langkah 3).
create or replace function public.game_event_type_allowed(p_type text)
returns boolean language sql immutable as $$
  select p_type = any (array[
    'turn_begin','roll','move','climb','bite','power_use','sfx','toast','fx',
    'totem_ask','totem_answer','totem_timeout','game_over','reward_claim','profile'
  ]);
$$;

-- Satu-satunya jalur tulis. Atomik per room (row lock) -> seq berurutan tanpa celah/race.
-- Idempoten: client_event_id yang sama dari pemain yang sama mengembalikan event lama.
create or replace function public.submit_game_action(
  p_room_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_client_event_id uuid default null
) returns public.game_events
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_event public.game_events;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.game_event_type_allowed(p_type) then raise exception 'INVALID_EVENT_TYPE'; end if;
  if jsonb_typeof(v_payload) <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if pg_column_size(v_payload) > 4096 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  -- Data privat tidak boleh masuk log yang dilihat semua pemain.
  if v_payload ?| array['coins','coin','gems','gem','xp','inventory','email','purchases'] then
    raise exception 'PRIVATE_FIELD_NOT_ALLOWED';
  end if;

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  if p_client_event_id is not null then
    select * into v_event from public.game_events
      where room_id = p_room_id and player_id = v_uid and client_event_id = p_client_event_id;
    if found then return v_event; end if;
  end if;

  if v_room.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;

  update public.game_rooms set event_seq = event_seq + 1 where id = p_room_id
    returning * into v_room;
  insert into public.game_events(room_id, seq, player_id, type, payload, client_event_id)
    values (p_room_id, v_room.event_seq, v_uid, p_type, v_payload, p_client_event_id)
    returning * into v_event;
  return v_event;
end;
$$;
revoke all on function public.submit_game_action(uuid,text,jsonb,uuid) from public, anon;
grant execute on function public.submit_game_action(uuid,text,jsonb,uuid) to authenticated;

-- Profil publik per pemain: hanya ID cosmetic yang sedang dipakai (flexing). Tanpa data privat.
create or replace function public.set_game_public_profile(p_room_id uuid, p_profile jsonb)
returns public.game_rooms
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_clean jsonb := '{}'::jsonb;
  v_key text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'INVALID_PROFILE'; end if;
  foreach v_key in array array['characterSkinId','diceId','frameId','effectId'] loop
    if p_profile ? v_key and jsonb_typeof(p_profile->v_key) = 'string' then
      if char_length(p_profile->>v_key) > 48 then raise exception 'INVALID_PROFILE'; end if;
      v_clean := v_clean || jsonb_build_object(v_key, p_profile->>v_key);
    end if;
  end loop;

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
  if v_room.status = 'finished' then raise exception 'ROOM_FINISHED'; end if;

  update public.game_rooms r
  set players = (
        select jsonb_agg(case when p->>'id' = v_uid::text
          then jsonb_set(p, '{public_profile}', v_clean, true) else p end order by ord)
        from jsonb_array_elements(r.players) with ordinality as e(p, ord)
      ),
      updated_at = now()
  where r.id = p_room_id
  returning * into v_room;
  return v_room;
end;
$$;
revoke all on function public.set_game_public_profile(uuid,jsonb) from public, anon;
grant execute on function public.set_game_public_profile(uuid,jsonb) to authenticated;

-- Reward idempoten: dicatat sekali per akun per (room, game). Pemberian ke PlayerData tetap di klien akun itu.
create table if not exists public.game_reward_claims (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_id uuid not null,
  game_id text not null check (char_length(game_id) between 1 and 64),
  claimed_at timestamptz not null default now(),
  primary key (room_id, player_id, game_id)
);
alter table public.game_reward_claims enable row level security;
revoke all on public.game_reward_claims from anon, authenticated;

-- true = klaim baru (klien boleh memberi reward ke akunnya); false = sudah pernah diklaim.
create or replace function public.claim_game_reward(p_room_id uuid, p_game_id text)
returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_rows integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
  if v_room.status not in ('playing','finished') then raise exception 'ROOM_NOT_STARTED'; end if;
  insert into public.game_reward_claims(room_id, player_id, game_id)
    values (p_room_id, v_uid, p_game_id) on conflict do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.claim_game_reward(uuid,text) from public, anon;
grant execute on function public.claim_game_reward(uuid,text) to authenticated;

-- Realtime untuk game_events.
do $$
begin
  if not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_events') then
    alter publication supabase_realtime add table public.game_events;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication not found; enable Realtime for public.game_events in the dashboard';
end $$;


-- ---------------------------------------------------------------------------
-- >>> 202611070001_exit_game_room.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611070002_room_slots.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611070003_friendships.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611070004_friend_requests.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611080001_player_stats.sql
-- ---------------------------------------------------------------------------
-- Statistik pemain + leaderboard nyata (global / mingguan / teman).
-- Terapkan SETELAH 202611070003_friendships.sql (leaderboard teman membaca public.friendships)
-- dan 202611060001_game_events.sql (memakai public.is_game_room_member).
--
-- Model kepercayaan (prototipe): klien melaporkan "match selesai, menang/kalah". Server menghitung
-- poin sendiri dengan konstanta tetap, idempoten per match_id, dan membatasi 1 match per 45 detik.
-- Ini BUKAN anti-cheat: klien yang dimodifikasi tetap bisa mengirim hasil palsu (pelan-pelan).
-- Jangan pakai untuk hadiah bernilai uang.

create table if not exists public.player_stats (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  name          text   not null default 'Player' check (char_length(name) between 1 and 24),
  xp            bigint not null default 0 check (xp >= 0),
  level         int    not null default 1 check (level >= 1),
  plays         int    not null default 0 check (plays >= 0),
  wins          int    not null default 0 check (wins >= 0),
  streak        int    not null default 0 check (streak >= 0),
  best_streak   int    not null default 0 check (best_streak >= 0),
  points        bigint not null default 0 check (points >= 0),
  week_key      date   not null default (date_trunc('week', now() at time zone 'utc'))::date,
  week_points   bigint not null default 0 check (week_points >= 0),
  last_match_at timestamptz,
  updated_at    timestamptz not null default now()
);
create index if not exists player_stats_points_idx on public.player_stats (points desc);
create index if not exists player_stats_week_idx   on public.player_stats (week_key, week_points desc);

create table if not exists public.player_match_results (
  user_id    uuid not null references auth.users(id) on delete cascade,
  match_id   text not null check (char_length(match_id) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.player_stats enable row level security;
alter table public.player_match_results enable row level security;
revoke all on public.player_stats from anon, authenticated;
revoke all on public.player_match_results from anon, authenticated;
-- Tanpa policy & tanpa grant: tabel hanya dapat diakses lewat fungsi security definer di bawah.

-- Level dari total XP. HARUS sama dengan player-data.js: butuh 400 + 100*(L-1) XP untuk naik dari level L.
create or replace function public.level_from_xp(p_xp bigint)
returns int language plpgsql immutable as $$
declare v_level int := 1; v_left bigint := greatest(coalesce(p_xp, 0), 0);
begin
  while v_level < 999 and v_left >= 400 + 100 * (v_level - 1) loop
    v_left := v_left - (400 + 100 * (v_level - 1));
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- Catat hasil 1 match untuk pemain yang sedang login (termasuk anonim).
-- p_room_id: isi untuk match online (wajib anggota room). Kosong untuk lawan CPU.
create or replace function public.submit_match_result(
  p_match_id text,
  p_won boolean,
  p_name text,
  p_xp_total bigint default 0,
  p_room_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_name text := left(btrim(coalesce(p_name, '')), 24);
  v_wk   date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_rows integer;
  v_s    public.player_stats;
  v_pts  int := case when coalesce(p_won, false) then 100 else 10 end;
  v_xp   bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or char_length(p_match_id) not between 1 and 80 then raise exception 'BAD_MATCH_ID'; end if;
  if v_name = '' then v_name := 'Player'; end if;
  if p_room_id is not null and not public.is_game_room_member(p_room_id) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  insert into public.player_match_results(user_id, match_id) values (v_uid, p_match_id)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  insert into public.player_stats(user_id, name) values (v_uid, v_name) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  -- Batas kecepatan: hasil terlalu rapat diabaikan (token tetap terpakai, tidak diulang klien).
  if v_s.last_match_at is not null and v_s.last_match_at > now() - interval '45 seconds' then
    return jsonb_build_object('ok', true, 'ignored', 'too_fast');
  end if;

  if v_s.week_key <> v_wk then v_s.week_key := v_wk; v_s.week_points := 0; end if;
  v_xp := greatest(v_s.xp, least(greatest(coalesce(p_xp_total, 0), 0), 1000000)); -- kosmetik, tidak dipakai untuk peringkat

  update public.player_stats set
    name          = v_name,
    xp            = v_xp,
    level         = public.level_from_xp(v_xp),
    plays         = v_s.plays + 1,
    wins          = v_s.wins + (case when coalesce(p_won, false) then 1 else 0 end),
    streak        = case when coalesce(p_won, false) then v_s.streak + 1 else 0 end,
    best_streak   = greatest(v_s.best_streak, case when coalesce(p_won, false) then v_s.streak + 1 else 0 end),
    points        = v_s.points + v_pts,
    week_key      = v_s.week_key,
    week_points   = v_s.week_points + v_pts,
    last_match_at = now(),
    updated_at    = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true, 'duplicate', false, 'points', v_pts);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid) to authenticated;

-- Leaderboard. scope: 'global' (total poin), 'weekly' (poin minggu ini, reset Senin 00:00 UTC),
-- 'friends' (kamu + temanmu). Mengembalikan top-N, ditambah barismu sendiri bila di luar top-N.
create or replace function public.get_leaderboard(p_scope text, p_limit int default 50)
returns table (pos bigint, uid uuid, pname text, lvl int, score bigint, wins int, plays int, is_me boolean)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_wk  date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_lim int  := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scope is null or p_scope not in ('global', 'weekly', 'friends') then raise exception 'BAD_SCOPE'; end if;
  return query
  with base as (
    select s.user_id as b_uid, s.name as b_name, s.level as b_lvl, s.wins as b_wins, s.plays as b_plays,
           case when p_scope = 'weekly' then (case when s.week_key = v_wk then s.week_points else 0 end)
                else s.points end as b_score
    from public.player_stats s
    where s.plays > 0
      and (p_scope <> 'friends'
           or s.user_id = v_uid
           or s.user_id in (select f.friend_id from public.friendships f where f.user_id = v_uid))
  ), ranked as (
    select b.*, rank() over (order by b.b_score desc, b.b_wins desc) as b_pos
    from base b
    where p_scope <> 'weekly' or b.b_score > 0
  )
  select r.b_pos, r.b_uid, r.b_name, r.b_lvl, r.b_score, r.b_wins, r.b_plays, (r.b_uid = v_uid)
  from ranked r
  where r.b_pos <= v_lim or r.b_uid = v_uid
  order by r.b_pos, r.b_name;
end;
$$;
revoke all on function public.get_leaderboard(text, int) from public, anon;
grant execute on function public.get_leaderboard(text, int) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611090001_player_progress.sql
-- ---------------------------------------------------------------------------
-- Progres pemain nyata untuk halaman Profil (menggantikan angka mockup di profile.html).
-- Terapkan SETELAH 202611080001_player_stats.sql.
--
-- Isi:
--   1. Kolom counter baru di player_stats (peti, naga, tangga, ular, skill, dadu, login, dst).
--   2. player_match_history  -> modal "Riwayat".
--   3. achievement_defs + player_achievement_claims -> achievement & klaim reward anti-dobel.
--   4. submit_match_result v2 (kompatibel: parameter baru punya default).
--   5. bump_player_counter, record_daily_login, get_my_profile, get_match_history, claim_achievement.
--
-- Model kepercayaan sama dengan migrasi sebelumnya: klien melaporkan, server membatasi (clamp per match,
-- idempoten per match_id, 1 match / 45 detik). BUKAN anti-cheat; jangan pakai untuk hadiah bernilai uang.
-- Dompet (coins/gems) masih lokal di PlayerData; server hanya mencatat klaim agar tidak bisa diklaim dua kali.

-- ============ 1. Counter baru ============
alter table public.player_stats
  add column if not exists chests            int  not null default 0 check (chests >= 0),
  add column if not exists dragon_hits       int  not null default 0 check (dragon_hits >= 0),
  add column if not exists ladders           int  not null default 0 check (ladders >= 0),
  add column if not exists snakes            int  not null default 0 check (snakes >= 0),
  add column if not exists skills_used       int  not null default 0 check (skills_used >= 0),
  add column if not exists dice_rolls        int  not null default 0 check (dice_rolls >= 0),
  add column if not exists login_days        int  not null default 0 check (login_days >= 0),
  add column if not exists login_streak      int  not null default 0 check (login_streak >= 0),
  add column if not exists best_login_streak int  not null default 0 check (best_login_streak >= 0),
  add column if not exists last_login_date   date,
  add column if not exists skill_wins        text[] not null default '{}',   -- skill berbeda yang pernah dipakai saat menang
  add column if not exists missions_done     int  not null default 0 check (missions_done >= 0),
  add column if not exists events_joined     int  not null default 0 check (events_joined >= 0);

-- ============ 2. Riwayat match ============
create table if not exists public.player_match_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  match_id   text not null check (char_length(match_id) between 1 and 80),
  won        boolean not null,
  mode       text not null default 'cpu' check (mode in ('cpu', 'online')),
  players    int,
  xp_gain    int not null default 0,
  points     int not null default 0,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index if not exists player_match_history_user_idx
  on public.player_match_history (user_id, created_at desc);
alter table public.player_match_history enable row level security;
revoke all on public.player_match_history from anon, authenticated;

-- ============ 3. Achievement ============
create table if not exists public.achievement_defs (
  id           text primary key,
  source       text not null check (source in ('server', 'client')),  -- client = nilai dari dompet/inventori lokal
  stat         text not null,
  tiers        int[] not null check (cardinality(tiers) = 3),
  reward_coins int[] not null default '{250,750,2000}' check (cardinality(reward_coins) = 3),
  reward_gems  int[] not null default '{5,10,25}'      check (cardinality(reward_gems) = 3),
  sort         int not null default 0
);
-- Sama persis dengan ACH di profile.html.
insert into public.achievement_defs (id, source, stat, tiers, sort) values
  ('peti',     'server', 'chests',            '{10,50,200}',     1),
  ('naga',     'server', 'dragon_hits',       '{3,10,30}',       2),
  ('aktif',    'server', 'plays',             '{10,50,200}',     3),
  ('menang',   'server', 'wins',              '{3,50,200}',      4),
  ('tangga',   'server', 'ladders',           '{10,50,150}',     5),
  ('ular',     'server', 'snakes',            '{10,50,150}',     6),
  ('skill',    'server', 'skills_used',       '{10,50,200}',     7),
  ('dadu',     'server', 'dice_rolls',        '{50,250,1000}',   8),
  ('papan',    'server', 'plays',             '{5,50,200}',      9),
  ('login',    'server', 'best_login_streak', '{3,7,30}',       10),
  ('streak',   'server', 'best_streak',       '{2,5,10}',       11),
  ('skin',     'client', 'skins',             '{2,10,25}',      12),
  ('emerald',  'client', 'emerald',           '{10,100,500}',   13),
  ('strategi', 'server', 'skill_wins',        '{2,5,10}',       14),
  ('legenda',  'server', 'wins',              '{500,1000,2000}', 15)
on conflict (id) do update
  set source = excluded.source, stat = excluded.stat, tiers = excluded.tiers, sort = excluded.sort;
alter table public.achievement_defs enable row level security;
revoke all on public.achievement_defs from anon, authenticated;
grant select on public.achievement_defs to authenticated;
drop policy if exists "read achievement defs" on public.achievement_defs;
create policy "read achievement defs" on public.achievement_defs for select to authenticated using (true);

create table if not exists public.player_achievement_claims (
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievement_defs(id) on delete cascade,
  claimed        int  not null default 0 check (claimed between 0 and 3),
  updated_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.player_achievement_claims enable row level security;
revoke all on public.player_achievement_claims from anon, authenticated;

-- ============ Helper ============
create or replace function public._clamp_json_int(j jsonb, k text, hi int)
returns int language plpgsql immutable as $$
begin
  return least(greatest(coalesce((j ->> k)::int, 0), 0), hi);
exception when others then
  return 0;
end;
$$;

create or replace function public.player_stat_value(s public.player_stats, p_stat text)
returns bigint language sql immutable as $$
  select case p_stat
    when 'chests'            then s.chests
    when 'dragon_hits'       then s.dragon_hits
    when 'plays'             then s.plays
    when 'wins'              then s.wins
    when 'ladders'           then s.ladders
    when 'snakes'            then s.snakes
    when 'skills_used'       then s.skills_used
    when 'dice_rolls'        then s.dice_rolls
    when 'best_login_streak' then s.best_login_streak
    when 'best_streak'       then s.best_streak
    when 'skill_wins'        then cardinality(s.skill_wins)
    else 0
  end::bigint;
$$;

-- ============ 4. submit_match_result v2 ============
-- p_stats contoh: {"dice":24,"ladders":3,"snakes":2,"skills":4,"dragon_hits":1,"skill_ids":["pedang","totem"]}
-- Tiap angka di-clamp per match. p_mode: 'cpu' | 'online' (default: online bila p_room_id ada).
drop function if exists public.submit_match_result(text, boolean, text, bigint, uuid);
create or replace function public.submit_match_result(
  p_match_id text,
  p_won boolean,
  p_name text,
  p_xp_total bigint default 0,
  p_room_id uuid default null,
  p_mode text default null,
  p_players int default null,
  p_stats jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_name  text := left(btrim(coalesce(p_name, '')), 24);
  v_wk    date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_rows  integer;
  v_s     public.player_stats;
  v_won   boolean := coalesce(p_won, false);
  v_pts   int := case when coalesce(p_won, false) then 100 else 10 end;
  v_xp    bigint;
  v_mode  text := case when p_mode in ('cpu', 'online') then p_mode
                       when p_room_id is not null then 'online' else 'cpu' end;
  v_dice  int := public._clamp_json_int(p_stats, 'dice', 300);
  v_lad   int := public._clamp_json_int(p_stats, 'ladders', 60);
  v_snk   int := public._clamp_json_int(p_stats, 'snakes', 60);
  v_skl   int := public._clamp_json_int(p_stats, 'skills', 100);
  v_drg   int := public._clamp_json_int(p_stats, 'dragon_hits', 100);
  v_ids   text[] := '{}';
  v_swins text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or char_length(p_match_id) not between 1 and 80 then raise exception 'BAD_MATCH_ID'; end if;
  if v_name = '' then v_name := 'Player'; end if;
  if p_room_id is not null and not public.is_game_room_member(p_room_id) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  insert into public.player_match_results(user_id, match_id) values (v_uid, p_match_id)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  insert into public.player_stats(user_id, name) values (v_uid, v_name) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  if v_s.last_match_at is not null and v_s.last_match_at > now() - interval '45 seconds' then
    return jsonb_build_object('ok', true, 'ignored', 'too_fast');
  end if;

  if v_s.week_key <> v_wk then v_s.week_key := v_wk; v_s.week_points := 0; end if;
  v_xp := greatest(v_s.xp, least(greatest(coalesce(p_xp_total, 0), 0), 1000000));

  -- skill unik yang dipakai saat MENANG (untuk achievement "Ahli Strategi")
  v_swins := v_s.skill_wins;
  if v_won and p_stats is not null and jsonb_typeof(p_stats -> 'skill_ids') = 'array' then
    select coalesce(array_agg(left(x, 30)), '{}') into v_ids
    from (select jsonb_array_elements_text(p_stats -> 'skill_ids') as x limit 8) q
    where btrim(x) <> '';
    select coalesce(array_agg(x order by x), '{}') into v_swins
    from (select distinct x from unnest(v_s.skill_wins || v_ids) as x limit 40) q;
  end if;

  update public.player_stats set
    name          = v_name,
    xp            = v_xp,
    level         = public.level_from_xp(v_xp),
    plays         = v_s.plays + 1,
    wins          = v_s.wins + (case when v_won then 1 else 0 end),
    streak        = case when v_won then v_s.streak + 1 else 0 end,
    best_streak   = greatest(v_s.best_streak, case when v_won then v_s.streak + 1 else 0 end),
    points        = v_s.points + v_pts,
    week_key      = v_s.week_key,
    week_points   = v_s.week_points + v_pts,
    dice_rolls    = v_s.dice_rolls + v_dice,
    ladders       = v_s.ladders + v_lad,
    snakes        = v_s.snakes + v_snk,
    skills_used   = v_s.skills_used + v_skl,
    dragon_hits   = v_s.dragon_hits + v_drg,
    skill_wins    = v_swins,
    last_match_at = now(),
    updated_at    = now()
  where user_id = v_uid;

  insert into public.player_match_history(user_id, match_id, won, mode, players, xp_gain, points, detail)
  values (v_uid, p_match_id, v_won, v_mode, case when p_players between 1 and 8 then p_players end,
          (v_xp - v_s.xp)::int, v_pts,
          jsonb_build_object('dice', v_dice, 'ladders', v_lad, 'snakes', v_snk, 'skills', v_skl, 'dragon_hits', v_drg))
  on conflict do nothing;

  -- simpan 50 riwayat terakhir saja
  delete from public.player_match_history h
  where h.user_id = v_uid
    and h.id not in (select id from public.player_match_history
                     where user_id = v_uid order by created_at desc, id desc limit 50);

  return jsonb_build_object('ok', true, 'duplicate', false, 'points', v_pts);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) to authenticated;

-- ============ 5a. Counter di luar match (peti, misi, event) ============
create or replace function public.bump_player_counter(p_kind text, p_amount int default 1)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_amt int := coalesce(p_amount, 1);
  v_val int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind not in ('chests', 'missions_done', 'events_joined') then raise exception 'BAD_KIND'; end if;
  if v_amt not between 1 and 20 then raise exception 'BAD_AMOUNT'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;

  update public.player_stats set
    chests        = chests        + case when p_kind = 'chests'        then v_amt else 0 end,
    missions_done = missions_done + case when p_kind = 'missions_done' then v_amt else 0 end,
    events_joined = events_joined + case when p_kind = 'events_joined' then v_amt else 0 end,
    updated_at    = now()
  where user_id = v_uid;

  select case p_kind when 'chests' then chests when 'missions_done' then missions_done else events_joined end
    into v_val from public.player_stats where user_id = v_uid;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'value', v_val);
end;
$$;
revoke all on function public.bump_player_counter(text, int) from public, anon;
grant execute on function public.bump_player_counter(text, int) to authenticated;

-- ============ 5b. Login harian (hari dihitung WIB) ============
create or replace function public.record_daily_login()
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_s     public.player_stats;
  v_new   int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  if v_s.last_login_date = v_today then
    return jsonb_build_object('ok', true, 'new_day', false, 'login_streak', v_s.login_streak,
                              'best_login_streak', v_s.best_login_streak, 'login_days', v_s.login_days);
  end if;

  v_new := case when v_s.last_login_date = v_today - 1 then v_s.login_streak + 1 else 1 end;
  update public.player_stats set
    login_streak      = v_new,
    best_login_streak = greatest(v_s.best_login_streak, v_new),
    login_days        = v_s.login_days + 1,
    last_login_date   = v_today,
    updated_at        = now()
  where user_id = v_uid;

  return jsonb_build_object('ok', true, 'new_day', true, 'login_streak', v_new,
                            'best_login_streak', greatest(v_s.best_login_streak, v_new),
                            'login_days', v_s.login_days + 1);
end;
$$;
revoke all on function public.record_daily_login() from public, anon;
grant execute on function public.record_daily_login() to authenticated;

-- ============ 5c. Semua data profil dalam 1 panggilan ============
create or replace function public.get_my_profile()
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_uid  uuid := auth.uid();
  v_s    public.player_stats;
  v_rank bigint;
  v_claims jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_s from public.player_stats where user_id = v_uid;
  if not found then
    return jsonb_build_object('exists', false);
  end if;

  if v_s.plays > 0 then
    select count(*) + 1 into v_rank
    from public.player_stats o
    where o.plays > 0
      and (o.points > v_s.points or (o.points = v_s.points and o.wins > v_s.wins));
  end if;

  select coalesce(jsonb_object_agg(achievement_id, claimed), '{}'::jsonb) into v_claims
  from public.player_achievement_claims where user_id = v_uid;

  return jsonb_build_object(
    'exists', true,
    'name', v_s.name, 'level', v_s.level, 'xp', v_s.xp,
    'plays', v_s.plays, 'wins', v_s.wins, 'losses', v_s.plays - v_s.wins,
    'win_rate', case when v_s.plays > 0 then floor(v_s.wins * 100.0 / v_s.plays) else 0 end,
    'streak', v_s.streak, 'best_streak', v_s.best_streak,
    'points', v_s.points, 'week_points', case when v_s.week_key = (date_trunc('week', now() at time zone 'utc'))::date then v_s.week_points else 0 end,
    'rank', v_rank,
    'counters', jsonb_build_object(
      'chests', v_s.chests, 'dragon_hits', v_s.dragon_hits, 'ladders', v_s.ladders,
      'snakes', v_s.snakes, 'skills_used', v_s.skills_used, 'dice_rolls', v_s.dice_rolls,
      'login_days', v_s.login_days, 'login_streak', v_s.login_streak, 'best_login_streak', v_s.best_login_streak,
      'skill_wins', cardinality(v_s.skill_wins), 'missions_done', v_s.missions_done, 'events_joined', v_s.events_joined),
    'claims', v_claims
  );
end;
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- ============ 5d. Riwayat ============
create or replace function public.get_match_history(p_limit int default 20)
returns table (match_id text, won boolean, mode text, players int, xp_gain int, points int, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select h.match_id, h.won, h.mode, h.players, h.xp_gain, h.points, h.created_at
  from public.player_match_history h
  where h.user_id = auth.uid()
  order by h.created_at desc, h.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.get_match_history(int) from public, anon;
grant execute on function public.get_match_history(int) to authenticated;

-- ============ 5e. Klaim achievement ============
-- Untuk source 'client' (skin, emerald) kirim nilai saat ini lewat p_client_value; server membatasi ke tier tertinggi.
-- Mengembalikan total reward; klien yang menambahkan ke dompet lokal (PD.addCurrency).
create or replace function public.claim_achievement(p_id text, p_client_value bigint default null)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_def   public.achievement_defs;
  v_s     public.player_stats;
  v_val   bigint;
  v_stars int;
  v_cl    int;
  v_coins int := 0;
  v_gems  int := 0;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_def from public.achievement_defs where id = p_id;
  if not found then raise exception 'BAD_ACHIEVEMENT'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid;

  v_val := case when v_def.source = 'client'
                then least(greatest(coalesce(p_client_value, 0), 0), v_def.tiers[3])
                else public.player_stat_value(v_s, v_def.stat) end;
  select count(*) into v_stars from unnest(v_def.tiers) t where v_val >= t;

  insert into public.player_achievement_claims(user_id, achievement_id) values (v_uid, p_id)
    on conflict do nothing;
  select claimed into v_cl from public.player_achievement_claims
    where user_id = v_uid and achievement_id = p_id for update;

  if v_cl >= v_stars then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_claim', 'stars', v_stars, 'claimed', v_cl);
  end if;

  for i in (v_cl + 1)..v_stars loop
    v_coins := v_coins + v_def.reward_coins[i];
    v_gems  := v_gems  + v_def.reward_gems[i];
  end loop;

  update public.player_achievement_claims set claimed = v_stars, updated_at = now()
    where user_id = v_uid and achievement_id = p_id;

  return jsonb_build_object('ok', true, 'stars', v_stars, 'claimed', v_stars, 'coins', v_coins, 'gems', v_gems);
end;
$$;
revoke all on function public.claim_achievement(text, bigint) from public, anon;
grant execute on function public.claim_achievement(text, bigint) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611090002_player_display_name.sql
-- ---------------------------------------------------------------------------
-- Nama tampilan di leaderboard/profil ditentukan SERVER, bukan nama kiriman klien.
-- Terapkan SETELAH 202611090001_player_progress.sql.
--
-- Akun game dibuat dengan email internal <username-huruf-kecil>@dragonroll-game.com (lihat assets/js/auth.js).
-- Email itu unik dan tidak bisa diubah pemain (tidak ada konfirmasi email), jadi dipakai sebagai sumber nama:
--   * akun terdaftar : nama = username dari akun (huruf besar/kecil dari metadata dipakai hanya bila cocok dengan email)
--   * pemain anonim  : nama dari klien, dibersihkan (karakter kontrol dibuang, spasi dirapikan, maks 24, kosong -> 'Player')
-- Efek: nama orang lain tidak bisa ditiru lewat parameter p_name di submit_match_result.

create or replace function public.player_stats_enforce_name()
returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
  v_local text;
  v_meta  text;
  v_name  text;
begin
  select u.email, nullif(btrim(coalesce(u.raw_user_meta_data ->> 'username', '')), '')
    into v_email, v_meta
  from auth.users u where u.id = new.user_id;

  if v_email is not null and lower(v_email) like '%@dragonroll-game.com' then
    v_local := split_part(v_email, '@', 1);
    v_name  := case when v_meta is not null and lower(v_meta) = lower(v_local) then v_meta else v_local end;
  else
    v_name := regexp_replace(coalesce(new.name, ''), '[[:cntrl:]]+', '', 'g');
    v_name := btrim(regexp_replace(v_name, '\s+', ' ', 'g'));
  end if;

  new.name := left(coalesce(nullif(v_name, ''), 'Player'), 24);
  return new;
end;
$$;

drop trigger if exists player_stats_enforce_name on public.player_stats;
create trigger player_stats_enforce_name
  before insert or update of name on public.player_stats
  for each row execute function public.player_stats_enforce_name();

-- Rapikan baris yang sudah ada (memicu trigger di atas).
update public.player_stats set name = name;


-- ---------------------------------------------------------------------------
-- >>> 202611100001_secure_match_result.sql
-- ---------------------------------------------------------------------------
-- Tahap 3A: amankan pencatatan hasil match (XP, menang, poin leaderboard).
--
-- Sebelumnya submit_match_result memercayai klien: p_xp_total (sampai 1.000.000) dan p_won dipakai apa adanya,
-- jadi satu panggilan saja bisa menghasilkan level maksimal dan poin leaderboard.
--
-- Aturan baru (signature fungsi TIDAK berubah, klien lama tetap jalan):
--   * XP dihitung SERVER: menang +120, kalah +40. p_xp_total diabaikan.
--   * Match ONLINE (p_room_id terisi): room harus 'finished'; menang/kalah ditentukan dari pemenang di
--     game_state room (bukan p_won). Dikreditkan sekali per pemain per room per 3 menit.
--   * Match lawan CPU (tanpa room): XP dan statistik tetap dicatat, poin leaderboard = 0.
--   * Leaderboard hanya menampilkan pemain yang punya poin (>0), jadi pemain CPU-saja tidak muncul.
-- Batasan yang masih ada: hasil lawan CPU tidak bisa diverifikasi (game jalan di browser), hanya dibatasi
-- 1 match per 45 detik. Dompet koin/gem masih lokal (PlayerData) dan di luar cakupan migrasi ini.

create table if not exists public.player_room_credits (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  credited_at timestamptz not null default now(),
  primary key (user_id, room_id)
);
alter table public.player_room_credits enable row level security;
revoke all on public.player_room_credits from anon, authenticated;

create or replace function public.submit_match_result(
  p_match_id text,
  p_won boolean,
  p_name text,
  p_xp_total bigint default 0,
  p_room_id uuid default null,
  p_mode text default null,
  p_players int default null,
  p_stats jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  c_xp_win  constant int := 120;
  c_xp_loss constant int := 40;
  c_pts_win constant int := 100;
  c_pts_loss constant int := 10;
  v_uid    uuid := auth.uid();
  v_name   text := left(btrim(coalesce(p_name, '')), 24);
  v_wk     date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_rows   integer;
  v_s      public.player_stats;
  v_room   public.game_rooms;
  v_online boolean := false;
  v_won    boolean := coalesce(p_won, false);
  v_key    text := p_match_id;
  v_widx   int;
  v_winner text;
  v_pts    int;
  v_gain   int;
  v_xp     bigint;
  v_dice  int := public._clamp_json_int(p_stats, 'dice', 300);
  v_lad   int := public._clamp_json_int(p_stats, 'ladders', 60);
  v_snk   int := public._clamp_json_int(p_stats, 'snakes', 60);
  v_skl   int := public._clamp_json_int(p_stats, 'skills', 100);
  v_drg   int := public._clamp_json_int(p_stats, 'dragon_hits', 100);
  v_ids   text[] := '{}';
  v_swins text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_match_id is null or char_length(p_match_id) not between 1 and 80 then raise exception 'BAD_MATCH_ID'; end if;
  if v_name = '' then v_name := 'Player'; end if;

  if p_room_id is not null then
    if not public.is_game_room_member(p_room_id) then raise exception 'ROOM_ACCESS_DENIED'; end if;
    select * into v_room from public.game_rooms where id = p_room_id;
    if v_room.status <> 'finished' then
      return jsonb_build_object('ok', false, 'reason', 'room_not_finished'); -- klien boleh mencoba lagi sebentar lagi
    end if;
    v_widx := case when (v_room.game_state -> 'snapshot' ->> 'winnerIndex') ~ '^[0-9]+$'
                   then (v_room.game_state -> 'snapshot' ->> 'winnerIndex')::int end;
    v_winner := case when v_widx is not null then v_room.game_state -> 'snapshot' -> 'players' -> v_widx ->> 'networkId' end;
    if v_winner is null then
      return jsonb_build_object('ok', false, 'reason', 'no_result');
    end if;
    v_online := true;
    v_won := (v_winner = v_uid::text);   -- klaim klien (p_won) diabaikan
  end if;

  v_gain := case when v_won then c_xp_win else c_xp_loss end;
  v_pts  := case when not v_online then 0 when v_won then c_pts_win else c_pts_loss end;

  insert into public.player_stats(user_id, name) values (v_uid, v_name) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid for update;

  if v_s.last_match_at is not null and v_s.last_match_at > now() - interval '45 seconds' then
    return jsonb_build_object('ok', true, 'ignored', 'too_fast');
  end if;

  if v_online then
    perform 1 from public.player_room_credits
      where user_id = v_uid and room_id = p_room_id and credited_at > now() - interval '3 minutes';
    if found then return jsonb_build_object('ok', true, 'duplicate', true); end if;
    insert into public.player_room_credits(user_id, room_id, credited_at) values (v_uid, p_room_id, now())
      on conflict (user_id, room_id) do update set credited_at = excluded.credited_at;
    v_key := left('room:' || p_room_id::text || ':' || to_char(now() at time zone 'utc', 'YYYYMMDDHH24MISS'), 80);
  end if;

  insert into public.player_match_results(user_id, match_id) values (v_uid, v_key) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  if v_s.week_key <> v_wk then v_s.week_key := v_wk; v_s.week_points := 0; end if;
  v_xp := least(v_s.xp + v_gain, 1000000);   -- XP dari server, bukan dari klien

  v_swins := v_s.skill_wins;
  if v_won and p_stats is not null and jsonb_typeof(p_stats -> 'skill_ids') = 'array' then
    select coalesce(array_agg(left(x, 30)), '{}') into v_ids
    from (select jsonb_array_elements_text(p_stats -> 'skill_ids') as x limit 8) q
    where btrim(x) <> '';
    select coalesce(array_agg(x order by x), '{}') into v_swins
    from (select distinct x from unnest(v_s.skill_wins || v_ids) as x limit 40) q;
  end if;

  update public.player_stats set
    name          = v_name,
    xp            = v_xp,
    level         = public.level_from_xp(v_xp),
    plays         = v_s.plays + 1,
    wins          = v_s.wins + (case when v_won then 1 else 0 end),
    streak        = case when v_won then v_s.streak + 1 else 0 end,
    best_streak   = greatest(v_s.best_streak, case when v_won then v_s.streak + 1 else 0 end),
    points        = v_s.points + v_pts,
    week_key      = v_s.week_key,
    week_points   = v_s.week_points + v_pts,
    dice_rolls    = v_s.dice_rolls + v_dice,
    ladders       = v_s.ladders + v_lad,
    snakes        = v_s.snakes + v_snk,
    skills_used   = v_s.skills_used + v_skl,
    dragon_hits   = v_s.dragon_hits + v_drg,
    skill_wins    = v_swins,
    last_match_at = now(),
    updated_at    = now()
  where user_id = v_uid;

  insert into public.player_match_history(user_id, match_id, won, mode, players, xp_gain, points, detail)
  values (v_uid, v_key, v_won, case when v_online then 'online' else 'cpu' end,
          case when p_players between 1 and 8 then p_players end,
          (v_xp - v_s.xp)::int, v_pts,
          jsonb_build_object('dice', v_dice, 'ladders', v_lad, 'snakes', v_snk, 'skills', v_skl, 'dragon_hits', v_drg))
  on conflict do nothing;

  delete from public.player_match_history h
  where h.user_id = v_uid
    and h.id not in (select id from public.player_match_history
                     where user_id = v_uid order by created_at desc, id desc limit 50);

  return jsonb_build_object('ok', true, 'duplicate', false, 'won', v_won, 'online', v_online,
                            'points', v_pts, 'xp_gain', (v_xp - v_s.xp)::int);
end;
$$;
revoke all on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) from public, anon;
grant execute on function public.submit_match_result(text, boolean, text, bigint, uuid, text, int, jsonb) to authenticated;

-- Leaderboard: hanya pemain yang punya poin (pemain yang hanya melawan CPU tidak tampil).
create or replace function public.get_leaderboard(p_scope text, p_limit int default 50)
returns table (pos bigint, uid uuid, pname text, lvl int, score bigint, wins int, plays int, is_me boolean)
language plpgsql stable security definer set search_path = public, auth as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_wk  date := (date_trunc('week', now() at time zone 'utc'))::date;
  v_lim int  := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scope is null or p_scope not in ('global', 'weekly', 'friends') then raise exception 'BAD_SCOPE'; end if;
  return query
  with base as (
    select s.user_id as b_uid, s.name as b_name, s.level as b_lvl, s.wins as b_wins, s.plays as b_plays,
           case when p_scope = 'weekly' then (case when s.week_key = v_wk then s.week_points else 0 end)
                else s.points end as b_score
    from public.player_stats s
    where s.points > 0
      and (p_scope <> 'friends'
           or s.user_id = v_uid
           or s.user_id in (select f.friend_id from public.friendships f where f.user_id = v_uid))
  ), ranked as (
    select b.*, rank() over (order by b.b_score desc, b.b_wins desc) as b_pos
    from base b
    where p_scope <> 'weekly' or b.b_score > 0
  )
  select r.b_pos, r.b_uid, r.b_name, r.b_lvl, r.b_score, r.b_wins, r.b_plays, (r.b_uid = v_uid)
  from ranked r
  where r.b_pos <= v_lim or r.b_uid = v_uid
  order by r.b_pos, r.b_name;
end;
$$;
revoke all on function public.get_leaderboard(text, int) from public, anon;
grant execute on function public.get_leaderboard(text, int) to authenticated;

-- OPSIONAL (jalankan manual, tinjau dulu): XP yang sudah terlanjur dipalsukan. Batas wajar = plays * 120.
-- select user_id, name, xp, plays from public.player_stats where xp > plays * 120 + 1000 order by xp desc;


-- ---------------------------------------------------------------------------
-- >>> 202611100002_roll_game_dice.sql
-- ---------------------------------------------------------------------------
-- Tahap 1 anti-curang dadu (3B): angka dadu diundi SERVER, bukan Math.random() di browser host.
-- Hasil dicatat sebagai event 'roll' di game_events, jadi semua pemain bisa melihat log yang sama.
-- Tidak mengubah tabel/RPC lain. Terapkan setelah 202611060001_game_events.sql.
--
-- Batas yang disengaja (ditutup di tahap 3C, server menjalankan game penuh):
--  * Server belum tahu giliran siapa; ia hanya memastikan pemanggil anggota room dan target pemain anggota room.
--  * Host masih bisa memanggil fungsi ini lagi dengan p_client_event_id baru untuk "mengulang" undian.
--    Jeda minimum antar-undian per room (di bawah) hanya memperlambat itu, tidak mencegahnya.
--  * Modifier dadu (Pasti 6, Ganjil, Genap, Special Dice) masih diterapkan di klien setelah undian.

-- Waktu undian terakhir per room, untuk jeda minimum.
alter table public.game_rooms add column if not exists last_dice_at timestamptz;

-- Mengundi 1-6 untuk p_player_id (default: pemanggil), mencatatnya sebagai event 'roll', mengembalikan barisnya.
-- Idempoten: p_client_event_id yang sama dari pemanggil yang sama mengembalikan event lama (angka tidak diundi ulang).
create or replace function public.roll_game_dice(
  p_room_id uuid,
  p_player_id uuid default null,
  p_client_event_id uuid default null
) returns public.game_events
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_room public.game_rooms;
  v_event public.game_events;
  v_value int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_target := coalesce(p_player_id, v_uid);

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
  -- Hanya host yang boleh mengundi untuk pemain lain (host menjalankan giliran tamu dan pemain AUTO).
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

  v_value := 1 + floor(random() * 6)::int;

  update public.game_rooms
    set event_seq = event_seq + 1, last_dice_at = now()
    where id = p_room_id
    returning * into v_room;
  insert into public.game_events(room_id, seq, player_id, type, payload, client_event_id)
    values (p_room_id, v_room.event_seq, v_uid, 'roll',
            jsonb_build_object('v', v_value, 'pid', v_target::text, 'src', 'server'),
            p_client_event_id)
    returning * into v_event;
  return v_event;
end;
$$;
revoke all on function public.roll_game_dice(uuid, uuid, uuid) from public, anon;
grant execute on function public.roll_game_dice(uuid, uuid, uuid) to authenticated;

-- Event 'roll' tidak lagi boleh ditulis klien lewat jalur umum, supaya angka dadu di log hanya berasal dari server.
create or replace function public.submit_game_action(
  p_room_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_client_event_id uuid default null
) returns public.game_events
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_event public.game_events;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.game_event_type_allowed(p_type) then raise exception 'INVALID_EVENT_TYPE'; end if;
  if p_type = 'roll' then raise exception 'ROLL_EVENT_SERVER_ONLY'; end if;
  if jsonb_typeof(v_payload) <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if pg_column_size(v_payload) > 4096 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if v_payload ?| array['coins','coin','gems','gem','xp','inventory','email','purchases'] then
    raise exception 'PRIVATE_FIELD_NOT_ALLOWED';
  end if;

  select * into v_room from public.game_rooms where id = p_room_id for update;
  if not found or not (v_room.players @> jsonb_build_array(jsonb_build_object('id', v_uid::text))) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  if p_client_event_id is not null then
    select * into v_event from public.game_events
      where room_id = p_room_id and player_id = v_uid and client_event_id = p_client_event_id;
    if found then return v_event; end if;
  end if;

  if v_room.status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;

  update public.game_rooms set event_seq = event_seq + 1 where id = p_room_id
    returning * into v_room;
  insert into public.game_events(room_id, seq, player_id, type, payload, client_event_id)
    values (p_room_id, v_room.event_seq, v_uid, p_type, v_payload, p_client_event_id)
    returning * into v_event;
  return v_event;
end;
$$;
revoke all on function public.submit_game_action(uuid,text,jsonb,uuid) from public, anon;
grant execute on function public.submit_game_action(uuid,text,jsonb,uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611100003_dice_modes.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611100004_friend_live_names.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- >>> 202611110001_wallet_b1.sql
-- ---------------------------------------------------------------------------
-- Dompet server, TAHAP B1 (fondasi). Terapkan SETELAH 202611100004_friend_live_names.sql.
--
-- Tujuan: saldo coins/gems pemain login disimpan SERVER, bukan localStorage, supaya tidak bisa diedit lewat devtools.
-- B1 hanya fondasi: tabel, ledger anti-dobel, fungsi internal, dan RPC BACA. Belum ada RPC yang menambah/mengurangi
-- saldo dari klien (itu B2/B3: beli di toko, reward boss, achievement, daily, misi). Klien lama tetap jalan memakai
-- PlayerData lokal sampai B2 dipasang, jadi migrasi ini aman diterapkan sendirian.
--
-- Aturan:
--   * Klien TIDAK pernah mengirim nominal. Tiap jenis reward punya RPC sendiri (B2+) dengan nominal ditentukan server.
--   * Tiap perubahan saldo = 1 baris ledger dengan kunci unik (user_id, reason, ref_key) -> klaim yang sama tidak bisa dobel.
--   * Saldo tidak boleh negatif; pembelian yang melebihi saldo ditolak dan tidak menulis apa pun.
--   * Saldo awal akun baru: 1000 coins, 0 gems (sama dengan START_COINS/START_GEMS di PlayerData). Saldo lama di
--     localStorage TIDAK diimpor (itu celah); ubah c_start_coins di _wallet_ensure bila kebijakannya berubah.

-- ============ 1. Tabel ============
create table if not exists public.player_wallet (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  coins      bigint not null default 0 check (coins between 0 and 1000000000000),
  gems       bigint not null default 0 check (gems  between 0 and 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.player_wallet enable row level security;
revoke all on public.player_wallet from anon, authenticated;

create table if not exists public.wallet_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta_coins bigint not null default 0,
  delta_gems  bigint not null default 0,
  reason      text not null check (char_length(reason) between 1 and 40),
  ref_key     text not null check (char_length(ref_key) between 1 and 120),
  coins_after bigint not null,
  gems_after  bigint not null,
  created_at  timestamptz not null default now(),
  unique (user_id, reason, ref_key)
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, id desc);
alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from anon, authenticated;

-- ============ 2. Fungsi internal (TIDAK bisa dipanggil klien) ============
-- Terapkan perubahan saldo satu kali. Idempoten per (user, reason, ref_key).
-- Return {ok, duplicate, coins, gems}. Raise INSUFFICIENT_COINS / INSUFFICIENT_GEMS bila saldo kurang
-- (exception membatalkan seluruh panggilan, jadi tidak ada ledger yang tertinggal).
create or replace function public._wallet_apply(
  p_user uuid, p_dcoins bigint, p_dgems bigint, p_reason text, p_ref text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_w    public.player_wallet;
  v_rows integer;
  v_nc   bigint;
  v_ng   bigint;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reason is null or p_ref is null then raise exception 'BAD_REF'; end if;

  insert into public.player_wallet(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_w from public.player_wallet where user_id = p_user for update;  -- kunci baris: tidak ada balapan

  v_nc := v_w.coins + coalesce(p_dcoins, 0);
  v_ng := v_w.gems  + coalesce(p_dgems, 0);

  insert into public.wallet_ledger(user_id, delta_coins, delta_gems, reason, ref_key, coins_after, gems_after)
  values (p_user, coalesce(p_dcoins, 0), coalesce(p_dgems, 0), p_reason, p_ref, v_nc, v_ng)
  on conflict (user_id, reason, ref_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', true, 'duplicate', true, 'coins', v_w.coins, 'gems', v_w.gems);
  end if;

  if v_nc < 0 then raise exception 'INSUFFICIENT_COINS'; end if;
  if v_ng < 0 then raise exception 'INSUFFICIENT_GEMS'; end if;

  update public.player_wallet set coins = v_nc, gems = v_ng, updated_at = now() where user_id = p_user;
  return jsonb_build_object('ok', true, 'duplicate', false, 'coins', v_nc, 'gems', v_ng);
end;
$$;
revoke all on function public._wallet_apply(uuid, bigint, bigint, text, text) from public, anon, authenticated;

-- Buat dompet akun baru dengan saldo awal (sekali; aman dipanggil berulang).
create or replace function public._wallet_ensure(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c_start_coins constant bigint := 1000; c_start_gems constant bigint := 0;
begin
  if not exists (select 1 from public.player_wallet where user_id = p_user) then
    perform public._wallet_apply(p_user, c_start_coins, c_start_gems, 'start', 'start');
  end if;
end;
$$;
revoke all on function public._wallet_ensure(uuid) from public, anon, authenticated;

-- ============ 3. RPC baca untuk klien ============
create or replace function public.wallet_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_w public.player_wallet;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  select * into v_w from public.player_wallet where user_id = v_uid;
  return jsonb_build_object('coins', v_w.coins, 'gems', v_w.gems, 'updated_at', v_w.updated_at);
end;
$$;
revoke all on function public.wallet_get() from public, anon;
grant execute on function public.wallet_get() to authenticated;

create or replace function public.wallet_history(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'coins', delta_coins, 'gems', delta_gems, 'reason', reason, 'at', created_at) order by id desc)
    from (select * from public.wallet_ledger where user_id = v_uid order by id desc limit v_lim) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.wallet_history(int) from public, anon;
grant execute on function public.wallet_history(int) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611110002_wallet_b2_server.sql
-- ---------------------------------------------------------------------------
-- Dompet server, TAHAP B2 (sisi server). Terapkan SETELAH 202611110001_wallet_b1.sql.
--
-- Isi:
--   1. item_catalog  : harga & aturan item di SERVER (disalin dari game/assets/js/item-catalog.js lewat
--                      game/tools/wallet/gen-item-seed.js; klien tidak bisa menentukan harga).
--   2. player_inventory + buy_item(item_id) + inventory_get() : beli di toko, saldo & inventory SATU transaksi.
--   3. claim_boss_reward(room_id): hadiah boss ke PEMENANG sebenarnya (bukan host), sekali per room, batas harian.
--   4. claim_achievement: reward kini juga masuk dompet server (idempoten per bintang).
--
-- PENTING (jangan dicampur): klien MASIH memakai saldo lokal (PlayerData) sampai tahap B2c memasangnya.
-- Selama itu dompet server terisi (achievement, boss) tetapi belum dibaca klien. Saat klien beralih ke saldo server,
-- panggilan PD.addCurrency lokal untuk achievement WAJIB dihentikan agar tidak dihitung dua kali.
-- Batas kepercayaan: pemenang room diambil dari game_state yang ditulis HOST (sampai tahap C: validasi server),
-- karena itu hadiah boss dibatasi per hari. BUKAN anti-cheat penuh.

-- ============ 1. Katalog item di server ============
create table if not exists public.item_catalog (
  id          text primary key,
  kind        text not null,
  price_coins integer check (price_coins is null or price_coins > 0),
  starter     boolean not null default false,
  stackable   boolean not null default false
);
alter table public.item_catalog enable row level security;
revoke all on public.item_catalog from anon, authenticated;

-- BEGIN CATALOG SEED (dibuat oleh game/tools/wallet/gen-item-seed.js; jangan edit tangan)
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('dice.amethyst', 'dice', 450, false, false),
  ('dice.copper', 'dice', 150, false, false),
  ('dice.diamond', 'dice', 450, false, false),
  ('dice.dragon', 'dice', 3500, false, false),
  ('dice.emas', 'dice', 900, false, false),
  ('dice.emerald', 'dice', 450, false, false),
  ('dice.ender', 'dice', 1800, false, false),
  ('dice.frost', 'dice', 900, false, false),
  ('dice.iron', 'dice', 200, false, false),
  ('dice.klasik', 'dice', null, true, false),
  ('dice.lapis', 'dice', 250, false, false),
  ('dice.magma', 'dice', 900, false, false),
  ('dice.netherite', 'dice', 1800, false, false),
  ('dice.obsidian', 'dice', 500, false, false),
  ('dice.prismarine', 'dice', 900, false, false),
  ('dice.quartz', 'dice', 900, false, false),
  ('dice.redstone', 'dice', 500, false, false),
  ('dice.rumput', 'dice', 100, false, false),
  ('dice.sculk', 'dice', 1800, false, false),
  ('dice.stone', 'dice', 100, false, false),
  ('dice.tnt', 'dice', 200, false, false),
  ('dice.void', 'dice', 1800, false, false),
  ('dice.wood', 'dice', 100, false, false),
  ('feather', 'powerup', null, false, true),
  ('frame.amethyst', 'frame', 1500, false, false),
  ('frame.celestial', 'frame', 7500, false, false),
  ('frame.copper', 'frame', 350, false, false),
  ('frame.cosmic', 'frame', 8000, false, false),
  ('frame.default', 'frame', null, true, false),
  ('frame.diamond', 'frame', 1200, false, false),
  ('frame.dragon', 'frame', 4000, false, false),
  ('frame.ender', 'frame', 2500, false, false),
  ('frame.gold', 'frame', 800, false, false),
  ('frame.iron', 'frame', 500, false, false),
  ('frame.nether', 'frame', 2000, false, false),
  ('frame.phoenix', 'frame', 5500, false, false),
  ('frame.stone', 'frame', 150, false, false),
  ('frame.storm', 'frame', 3000, false, false),
  ('gear.acc.beard', 'gear', 100, false, false),
  ('gear.acc.belt', 'gear', 80, false, false),
  ('gear.acc.bow', 'gear', 80, false, false),
  ('gear.acc.earrings', 'gear', 150, false, false),
  ('gear.acc.glasses', 'gear', 120, false, false),
  ('gear.acc.gloves', 'gear', 100, false, false),
  ('gear.acc.goggles', 'gear', 200, false, false),
  ('gear.acc.mustache', 'gear', 80, false, false),
  ('gear.acc.necklace', 'gear', 200, false, false),
  ('gear.acc.pack', 'gear', 150, false, false),
  ('gear.acc.purse', 'gear', 150, false, false),
  ('gear.acc.scarf', 'gear', 100, false, false),
  ('gear.boots.cloth', 'gear', 60, false, false),
  ('gear.boots.flat', 'gear', 80, false, false),
  ('gear.boots.knee', 'gear', 150, false, false),
  ('gear.boots.mary', 'gear', null, true, false),
  ('gear.boots.none', 'gear', null, true, false),
  ('gear.boots.sandal', 'gear', 60, false, false),
  ('gear.boots.shoes', 'gear', null, true, false),
  ('gear.boots.tall', 'gear', 120, false, false),
  ('gear.cape.long', 'gear', 400, false, false),
  ('gear.cape.short', 'gear', 250, false, false),
  ('gear.cape.wings', 'gear', 900, false, false),
  ('gear.chest.bodice', 'gear', 300, false, false),
  ('gear.chest.leather', 'gear', 350, false, false),
  ('gear.chest.plate', 'gear', 700, false, false),
  ('gear.chest.valk', 'gear', 800, false, false),
  ('gear.helm.beret', 'gear', 150, false, false),
  ('gear.helm.crown', 'gear', 900, false, false),
  ('gear.helm.flowers', 'gear', 250, false, false),
  ('gear.helm.knight', 'gear', 400, false, false),
  ('gear.helm.ribbon', 'gear', 150, false, false),
  ('gear.helm.straw', 'gear', 120, false, false),
  ('gear.helm.tiara', 'gear', 600, false, false),
  ('gear.helm.wizard', 'gear', 300, false, false),
  ('gear.legs.bare', 'gear', null, true, false),
  ('gear.legs.formal', 'gear', 250, false, false),
  ('gear.legs.lskirt', 'gear', 150, false, false),
  ('gear.legs.pants', 'gear', null, true, false),
  ('gear.legs.shorts', 'gear', 80, false, false),
  ('gear.legs.skirt', 'gear', null, true, false),
  ('gear.legs.tights', 'gear', 100, false, false),
  ('gear.shoulder.gem', 'gear', 500, false, false),
  ('gear.shoulder.leather', 'gear', 200, false, false),
  ('gear.shoulder.pad', 'gear', 350, false, false),
  ('gear.shoulder.ruffle', 'gear', 250, false, false),
  ('gear.shoulder.spiked', 'gear', 450, false, false),
  ('gear.top.blouse', 'gear', null, true, false),
  ('gear.top.cardigan', 'gear', 200, false, false),
  ('gear.top.coat', 'gear', 400, false, false),
  ('gear.top.dress', 'gear', 300, false, false),
  ('gear.top.overall', 'gear', 150, false, false),
  ('gear.top.robe', 'gear', 350, false, false),
  ('gear.top.sundress', 'gear', 200, false, false),
  ('gear.top.tee', 'gear', null, true, false),
  ('gear.top.tunic', 'gear', 120, false, false),
  ('gear.top.vest', 'gear', 150, false, false),
  ('gear.weapon.axe', 'gear', 450, false, false),
  ('gear.weapon.parasol', 'gear', 200, false, false),
  ('gear.weapon.rapier', 'gear', 450, false, false),
  ('gear.weapon.staff', 'gear', 350, false, false),
  ('gear.weapon.sword', 'gear', 300, false, false),
  ('gear.weapon.wand', 'gear', 300, false, false),
  ('grass', 'powerup', null, false, true),
  ('potion_even', 'powerup', null, false, true),
  ('potion_odd', 'powerup', null, false, true),
  ('skin.alex', 'skin', null, true, false),
  ('skin.creeper', 'skin', null, true, false),
  ('skin.ender', 'skin', 700, false, false),
  ('skin.skeleton', 'skin', 300, false, false),
  ('skin.steve', 'skin', null, true, false),
  ('skin.zombie', 'skin', null, true, false),
  ('sword', 'powerup', null, false, true),
  ('theme.minecraft', 'theme', null, true, false),
  ('theme.nether', 'theme', null, false, false),
  ('tnt', 'powerup', null, false, true),
  ('totem', 'powerup', null, false, true)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;
-- END CATALOG SEED

-- ============ 2. Inventory + beli ============
create table if not exists public.player_inventory (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.item_catalog(id),
  qty         integer not null default 1 check (qty >= 1),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.player_inventory enable row level security;
revoke all on public.player_inventory from anon, authenticated;

-- Dapat dibeli bila harga > 0 dan bukan item starter (sama dengan PlayerData.purchase di klien).
create or replace function public.buy_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_it   public.item_catalog;
  v_res  jsonb;
  v_have int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_it from public.item_catalog where id = p_item_id;
  if not found or v_it.starter or v_it.price_coins is null then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- serialisasi: tidak ada beli ganda/balapan

  select qty into v_have from public.player_inventory where user_id = v_uid and item_id = p_item_id;
  if v_have is not null and not v_it.stackable then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  begin
    v_res := public._wallet_apply(v_uid, -v_it.price_coins, 0, 'buy',
               case when v_it.stackable then p_item_id || '#' || (coalesce(v_have, 0) + 1) else p_item_id end);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then
      return jsonb_build_object('ok', false, 'reason', 'saldo-kurang',
        'kurang', v_it.price_coins - (select coins from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  insert into public.player_inventory(user_id, item_id) values (v_uid, p_item_id)
    on conflict (user_id, item_id) do update set qty = public.player_inventory.qty + 1;
  return jsonb_build_object('ok', true, 'item', p_item_id, 'spent', v_it.price_coins,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;

create or replace function public.inventory_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', item_id, 'qty', qty, 'at', acquired_at) order by acquired_at, item_id)
                   from public.player_inventory where user_id = v_uid), '[]'::jsonb);
end;
$$;
revoke all on function public.inventory_get() from public, anon;
grant execute on function public.inventory_get() to authenticated;

-- ============ 3. Hadiah boss ke pemenang ============
create or replace function public.claim_boss_reward(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_coins constant bigint := 500;   -- = Config.DRAGON_REWARD di klien
  c_gems  constant bigint := 10;
  c_daily constant int    := 10;    -- batas hadiah boss per akun per hari (UTC); menahan farming lewat room palsu
  v_uid    uuid := auth.uid();
  v_room   public.game_rooms;
  v_widx   int;
  v_winner text;
  v_n      int;
  v_res    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_game_room_member(p_room_id) then raise exception 'ROOM_ACCESS_DENIED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id;
  if v_room.status <> 'finished' then return jsonb_build_object('ok', false, 'reason', 'room_not_finished'); end if;
  v_widx := case when (v_room.game_state -> 'snapshot' ->> 'winnerIndex') ~ '^[0-9]+$'
                 then (v_room.game_state -> 'snapshot' ->> 'winnerIndex')::int end;
  v_winner := case when v_widx is not null then v_room.game_state -> 'snapshot' -> 'players' -> v_widx ->> 'networkId' end;
  if v_winner is null then return jsonb_build_object('ok', false, 'reason', 'no_result'); end if;
  if v_winner <> v_uid::text then return jsonb_build_object('ok', false, 'reason', 'not_winner'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) into v_n from public.wallet_ledger
    where user_id = v_uid and reason = 'boss' and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if v_n >= c_daily then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;

  v_res := public._wallet_apply(v_uid, c_coins, c_gems, 'boss', p_room_id::text);
  return v_res || jsonb_build_object('reward_coins', c_coins, 'reward_gems', c_gems);
end;
$$;
revoke all on function public.claim_boss_reward(uuid) from public, anon;
grant execute on function public.claim_boss_reward(uuid) to authenticated;

-- ============ 4. claim_achievement -> dompet server ============
-- Sama dengan versi 202611090001 + reward dikreditkan ke dompet server (ref per jumlah bintang yang diklaim).
create or replace function public.claim_achievement(p_id text, p_client_value bigint default null)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_def   public.achievement_defs;
  v_s     public.player_stats;
  v_val   bigint;
  v_stars int;
  v_cl    int;
  v_coins int := 0;
  v_gems  int := 0;
  v_w     jsonb;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_def from public.achievement_defs where id = p_id;
  if not found then raise exception 'BAD_ACHIEVEMENT'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_s from public.player_stats where user_id = v_uid;

  v_val := case when v_def.source = 'client'
                then least(greatest(coalesce(p_client_value, 0), 0), v_def.tiers[3])
                else public.player_stat_value(v_s, v_def.stat) end;
  select count(*) into v_stars from unnest(v_def.tiers) t where v_val >= t;

  insert into public.player_achievement_claims(user_id, achievement_id) values (v_uid, p_id)
    on conflict do nothing;
  select claimed into v_cl from public.player_achievement_claims
    where user_id = v_uid and achievement_id = p_id for update;

  if v_cl >= v_stars then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_claim', 'stars', v_stars, 'claimed', v_cl);
  end if;

  for i in (v_cl + 1)..v_stars loop
    v_coins := v_coins + v_def.reward_coins[i];
    v_gems  := v_gems  + v_def.reward_gems[i];
  end loop;

  update public.player_achievement_claims set claimed = v_stars, updated_at = now()
    where user_id = v_uid and achievement_id = p_id;

  perform public._wallet_ensure(v_uid);
  v_w := public._wallet_apply(v_uid, v_coins, v_gems, 'achievement', p_id || ':' || v_cl || '-' || v_stars);

  return jsonb_build_object('ok', true, 'stars', v_stars, 'claimed', v_stars, 'coins', v_coins, 'gems', v_gems,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.claim_achievement(text, bigint) from public, anon;
grant execute on function public.claim_achievement(text, bigint) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611110003_wallet_b3_daily_quest_exchange.sql
-- ---------------------------------------------------------------------------
-- Dompet server, TAHAP B3 (HANYA SERVER, klien belum disentuh). Terapkan SETELAH 202611110002_wallet_b2_server.sql.
--
-- Isi:
--   1. Hari server tetap WIB (Asia/Jakarta): _wib_today(). Tanggal TIDAK pernah diterima dari klien.
--   2. Daily reward 7 hari: player_daily_reward + daily_reward_get() + claim_daily_reward(). Tabel hadiah ada di server.
--   3. Misi harian: player_quest + quest_get/quest_track/quest_claim/quest_claim_all/quest_claim_bonus. Nominal di server.
--   4. Tukar gem -> koin dengan paket tetap: exchange_gems(pack). (Pengganti PD.addCurrency lokal di shop/profile/
--      leaderboard/inventory yang kodenya berlabel mock tetapi berjalan.)
--
-- "Hadiahkan item ke teman" TIDAK punya RPC: temannya palsu (Budi/Sari/Rafi/Nina), jadi dimatikan di klien untuk akun login.
--
-- PENTING (jangan dicampur): klien MASIH memakai saldo lokal sampai B5. Selama itu dompet server terisi tapi belum dibaca.
-- Saat B5, SEMUA jalur pemasukan/pengeluaran lokal pindah sekaligus (daily, misi, tukar gem, achievement, boss, toko);
-- memindahkan sebagian saja = hadiah hilang (saldo lokal ditimpa) atau terhitung dua kali.
-- Batas kepercayaan: progres misi 'play'/'win' dilaporkan klien (lawan CPU tidak bisa diverifikasi). Kerugian dibatasi
-- oleh tujuan misi (maks 375 koin/hari lewat nominal server); pembatasan lebih ketat = B4.

-- ============ 1. Hari server (WIB) ============
create or replace function public._wib_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;
revoke all on function public._wib_today() from public, anon, authenticated;

create or replace function public._secs_to_wib_reset() returns int
language sql stable as $$
  select ceil(extract(epoch from
    (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '1 day') - (now() at time zone 'Asia/Jakarta')))::int
$$;
revoke all on function public._secs_to_wib_reset() from public, anon, authenticated;

-- ============ 2. Daily reward ============
create table if not exists public.player_daily_reward (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  claimed         int  not null default 0 check (claimed between 0 and 7),   -- hari yang sudah diklaim di putaran ini
  last_claim_date date,                                                      -- tanggal WIB klaim terakhir (DATE, bukan timestamp)
  box             int  not null default 0 check (box >= 0),                  -- Mystery Box (hari 3); belum ada konsumen di klien
  updated_at      timestamptz not null default now()
);
alter table public.player_daily_reward enable row level security;
revoke all on public.player_daily_reward from anon, authenticated;

-- Hari putaran yang sah SEKARANG (tanpa menulis). Sama dengan sync() di dailyreward.html, tetapi pakai jam server.
create or replace function public._daily_effective_claimed(p_claimed int, p_last date) returns int
language sql stable as $$
  select case when p_last is null then 0
              when public._wib_today() - p_last > 1 or p_claimed >= 7 then 0   -- lewat sehari / putaran selesai -> mulai Hari 1
              else p_claimed end
$$;
revoke all on function public._daily_effective_claimed(int, date) from public, anon, authenticated;

create or replace function public.daily_reward_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_r public.player_daily_reward; v_today date := public._wib_today(); v_eff int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_r from public.player_daily_reward where user_id = v_uid;
  if not found then v_r.claimed := 0; v_r.last_claim_date := null; v_r.box := 0; end if;
  v_eff := public._daily_effective_claimed(v_r.claimed, v_r.last_claim_date);
  return jsonb_build_object(
    'claimed', case when v_r.last_claim_date = v_today then v_r.claimed else v_eff end,  -- jumlah hari yang tampak diklaim
    'claimed_today', coalesce(v_r.last_claim_date = v_today, false),
    'next_day', case when v_r.last_claim_date = v_today then null else v_eff + 1 end,     -- 1..7, null bila sudah klaim hari ini
    'today', v_today, 'tz', 'Asia/Jakarta', 'seconds_to_reset', public._secs_to_wib_reset(), 'box', v_r.box);
end;
$$;
revoke all on function public.daily_reward_get() from public, anon;
grant execute on function public.daily_reward_get() to authenticated;

-- Tabel hadiah (= array R di dailyreward.html):
--   1: 50 gem | 2: 1000 koin | 3: Mystery Box | 4: dice.rumput (duplikat -> 100 koin) | 5: dice.emas (dup -> 300 koin)
--   6: 2000 koin | 7: skin.ender (dup -> 100 gem)
create or replace function public.claim_daily_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := public._wib_today();
  v_r     public.player_daily_reward;
  v_idx   int;
  v_dc    bigint := 0;
  v_dg    bigint := 0;
  v_item  text;
  v_type  text;
  v_dup   boolean := false;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;    -- serialisasi klaim per akun
  insert into public.player_daily_reward(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_r from public.player_daily_reward where user_id = v_uid for update;

  if v_r.last_claim_date = v_today then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;

  v_idx := public._daily_effective_claimed(v_r.claimed, v_r.last_claim_date);   -- 0..6

  case v_idx
    when 0 then v_type := 'gem';  v_dg := 50;
    when 1 then v_type := 'coin'; v_dc := 1000;
    when 2 then v_type := 'box';
    when 3 then v_type := 'dice'; v_item := 'dice.rumput';
    when 4 then v_type := 'dice'; v_item := 'dice.emas';
    when 5 then v_type := 'coin'; v_dc := 2000;
    else        v_type := 'skin'; v_item := 'skin.ender';
  end case;

  if v_item is not null then
    v_dup := exists (select 1 from public.player_inventory where user_id = v_uid and item_id = v_item);
    if v_dup then
      case v_item when 'dice.rumput' then v_dc := 100; when 'dice.emas' then v_dc := 300; else v_dg := 100; end case;
    end if;
  end if;

  -- Kunci idempoten per tanggal WIB: klaim kedua di hari yang sama tidak mungkin, walau logika streak salah.
  v_res := public._wallet_apply(v_uid, v_dc, v_dg, 'daily', v_today::text);
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;

  if v_item is not null and not v_dup then
    insert into public.player_inventory(user_id, item_id) values (v_uid, v_item) on conflict (user_id, item_id) do nothing;
  end if;

  update public.player_daily_reward
     set claimed = v_idx + 1, last_claim_date = v_today, box = box + (case when v_type = 'box' then 1 else 0 end),
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'day', v_idx + 1, 'type', v_type, 'item', v_item, 'duplicate', v_dup,
                            'coins', v_dc, 'gems', v_dg, 'box', v_type = 'box',
                            'wallet_coins', (v_res ->> 'coins')::bigint, 'wallet_gems', (v_res ->> 'gems')::bigint,
                            'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.claim_daily_reward() from public, anon;
grant execute on function public.claim_daily_reward() to authenticated;

-- ============ 3. Misi harian (reset 00.00 WIB, sama dengan daily reward) ============
create table if not exists public.player_quest (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  day        date not null,
  prog_login int  not null default 0 check (prog_login between 0 and 1),
  prog_play  int  not null default 0 check (prog_play  between 0 and 1),
  prog_win   int  not null default 0 check (prog_win   between 0 and 3),
  claimed    text[] not null default '{}',
  bonus      boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.player_quest enable row level security;
revoke all on public.player_quest from anon, authenticated;

-- Pastikan baris ada, reset bila hari WIB berganti, kunci baris. Dipanggil di awal tiap RPC misi.
create or replace function public._quest_roll(p_user uuid) returns public.player_quest
language plpgsql security definer set search_path = public as $$
declare v_q public.player_quest; v_today date := public._wib_today();
begin
  insert into public.player_quest(user_id, day) values (p_user, v_today) on conflict (user_id) do nothing;
  update public.player_quest
     set day = v_today, prog_login = 0, prog_play = 0, prog_win = 0, claimed = '{}', bonus = false, updated_at = now()
   where user_id = p_user and day <> v_today;
  select * into v_q from public.player_quest where user_id = p_user for update;
  return v_q;
end;
$$;
revoke all on function public._quest_roll(uuid) from public, anon, authenticated;

create or replace function public._quest_json(p_q public.player_quest) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'day', p_q.day, 'seconds_to_reset', public._secs_to_wib_reset(),
    'quests', jsonb_build_array(
      jsonb_build_object('id','login','goal',1,'reward',50,  'progress',p_q.prog_login,
        'status', case when 'login' = any(p_q.claimed) then 'claimed' when p_q.prog_login >= 1 then 'ready' else 'todo' end),
      jsonb_build_object('id','play', 'goal',1,'reward',75,  'progress',p_q.prog_play,
        'status', case when 'play'  = any(p_q.claimed) then 'claimed' when p_q.prog_play  >= 1 then 'ready' else 'todo' end),
      jsonb_build_object('id','win',  'goal',3,'reward',150, 'progress',p_q.prog_win,
        'status', case when 'win'   = any(p_q.claimed) then 'claimed' when p_q.prog_win   >= 3 then 'ready' else 'todo' end)),
    'bonus', jsonb_build_object('reward', 100,
      'status', case when p_q.bonus then 'claimed'
                     when p_q.claimed @> array['login','play','win'] then 'ready' else 'locked' end))
$$;
revoke all on function public._quest_json(public.player_quest) from public, anon, authenticated;

create or replace function public.quest_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.player_quest;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_q := public._quest_roll(v_uid);
  return public._quest_json(v_q);
end;
$$;
revoke all on function public.quest_get() from public, anon;
grant execute on function public.quest_get() to authenticated;

-- Klien hanya menyebut JENIS kejadian; progres naik 1 dan dibatasi tujuan. 'win' juga menghitung sebagai 'play' (sama dgn klien lama).
create or replace function public.quest_track(p_type text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.player_quest;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('login', 'play', 'win') then raise exception 'BAD_QUEST_TYPE'; end if;
  v_q := public._quest_roll(v_uid);
  update public.player_quest set
    prog_login = case when p_type = 'login' then 1 else prog_login end,
    prog_play  = case when p_type in ('play', 'win') then 1 else prog_play end,
    prog_win   = case when p_type = 'win' then least(prog_win + 1, 3) else prog_win end,
    updated_at = now()
  where user_id = v_uid
  returning * into v_q;
  return public._quest_json(v_q);
end;
$$;
revoke all on function public.quest_track(text) from public, anon;
grant execute on function public.quest_track(text) to authenticated;

-- Klaim satu misi. Idempoten: ref = tanggal:id (klaim kedua -> ditolak).
create or replace function public.quest_claim(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q public.player_quest; v_reward bigint; v_ready boolean; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_id not in ('login', 'play', 'win') then raise exception 'BAD_QUEST_ID'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  if p_id = any(v_q.claimed) then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  v_ready := case p_id when 'login' then v_q.prog_login >= 1 when 'play' then v_q.prog_play >= 1 else v_q.prog_win >= 3 end;
  if not v_ready then return jsonb_build_object('ok', false, 'reason', 'belum-selesai'); end if;
  v_reward := case p_id when 'login' then 50 when 'play' then 75 else 150 end;

  v_w := public._wallet_apply(v_uid, v_reward, 0, 'quest', v_q.day::text || ':' || p_id);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  update public.player_quest set claimed = array_append(claimed, p_id), updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'id', p_id, 'coins', v_reward,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim(text) from public, anon;
grant execute on function public.quest_claim(text) to authenticated;

-- Klaim semua misi yang siap (setara UT.Quest.claimAll).
create or replace function public.quest_claim_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_q public.player_quest; v_id text; v_reward bigint; v_sum bigint := 0; v_n int := 0;
  v_w jsonb; v_ready boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  foreach v_id in array array['login', 'play', 'win'] loop
    continue when v_id = any(v_q.claimed);
    v_ready := case v_id when 'login' then v_q.prog_login >= 1 when 'play' then v_q.prog_play >= 1 else v_q.prog_win >= 3 end;
    continue when not v_ready;
    v_reward := case v_id when 'login' then 50 when 'play' then 75 else 150 end;
    v_w := public._wallet_apply(v_uid, v_reward, 0, 'quest', v_q.day::text || ':' || v_id);
    if not (v_w ->> 'duplicate')::boolean then
      v_sum := v_sum + v_reward; v_n := v_n + 1;
      update public.player_quest set claimed = array_append(claimed, v_id), updated_at = now() where user_id = v_uid;
    end if;
  end loop;

  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'tidak-ada-yang-siap'); end if;
  return jsonb_build_object('ok', true, 'count', v_n, 'coins', v_sum,
                            'wallet_coins', (select coins from public.player_wallet where user_id = v_uid),
                            'wallet_gems',  (select gems  from public.player_wallet where user_id = v_uid));
end;
$$;
revoke all on function public.quest_claim_all() from public, anon;
grant execute on function public.quest_claim_all() to authenticated;

create or replace function public.quest_claim_bonus() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.player_quest; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  v_q := public._quest_roll(v_uid);

  if v_q.bonus then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  if not (v_q.claimed @> array['login', 'play', 'win']) then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;

  v_w := public._wallet_apply(v_uid, 100, 0, 'quest_bonus', v_q.day::text);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-klaim'); end if;
  update public.player_quest set bonus = true, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true, 'coins', 100,
                            'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.quest_claim_bonus() from public, anon;
grant execute on function public.quest_claim_bonus() to authenticated;

-- ============ 4. Tukar gem -> koin (paket tetap) ============
--   paket 0: 10 gem -> 500 koin | 1: 40 -> 2.500 | 2: 120 -> 10.000   (sama dengan packs di shop/profile/leaderboard/inventory)
-- Bisa diulang, jadi ref_key = nomor urut penukaran (aman karena baris dompet dikunci).
create or replace function public.exchange_gems(p_pack int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems  constant bigint[] := array[10, 40, 120];
  c_coins constant bigint[] := array[500, 2500, 10000];
  v_uid uuid := auth.uid(); v_n int; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pack is null or p_pack < 0 or p_pack > 2 then return jsonb_build_object('ok', false, 'reason', 'paket-tidak-valid'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) + 1 into v_n from public.wallet_ledger where user_id = v_uid and reason = 'exchange';

  begin
    v_res := public._wallet_apply(v_uid, c_coins[p_pack + 1], -c_gems[p_pack + 1], 'exchange', 'ex#' || v_n);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_GEMS' then
      return jsonb_build_object('ok', false, 'reason', 'gem-kurang',
        'kurang', c_gems[p_pack + 1] - (select gems from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'pack', p_pack, 'spent_gems', c_gems[p_pack + 1], 'got_coins', c_coins[p_pack + 1],
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.exchange_gems(int) from public, anon;
grant execute on function public.exchange_gems(int) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611110004_wallet_b4_caps.sql
-- ---------------------------------------------------------------------------
-- Dompet server, TAHAP B4 (HANYA SERVER, klien belum disentuh). Terapkan SETELAH 202611110003_wallet_b3_daily_quest_exchange.sql.
--
-- Tujuan: hadiah yang TIDAK bisa diverifikasi server (game jalan di browser) diberi batas harian per akun, supaya
-- skrip/devtools tidak bisa mencetak koin tanpa batas. Hari = WIB (Asia/Jakarta), sama dengan daily reward & misi.
--
-- Isi:
--   1. claim_cpu_boss_reward(token): hadiah mengalahkan boss di match lawan CPU (500 koin + 10 gem, = Config.DRAGON_REWARD).
--      Satu klaim per token match (idempoten), maks 5 per hari WIB, jarak antar klaim minimal 180 detik
--      (satu match penuh dengan fase boss makin lama dari itu; lihat game/doc/BALANCE_DURASI_BOSS.md).
--   2. claim_boss_reward (B2, match online) dipindah ke hari WIB; batas 10/hari tetap.
--   3. reward_caps_get(): sisa jatah hari ini + hitung mundur reset, untuk UI.
--
-- Chest BUKAN sumber pemasukan: CHEST_POOL aktif (game/gameplay/config.js) tidak punya entri koin/XP/gem, dan tidak ada
-- penimpaan lain di repo. Cabang 'coin'/'xp'/'gems' di applyChestReward (gameplay.html) hanyalah kode mati, jadi tidak ada
-- RPC chest. Di B5 cabang itu harus tidak memanggil PD.grant untuk akun login, supaya config yang berubah nanti tidak
-- membuka celah baru.
--
-- Batas kepercayaan: ini membatasi kerugian, BUKAN anti-cheat. Pemain nakal tetap bisa mengklaim sampai batas harian
-- (maks 5 x 500 koin + 5 x 10 gem lawan CPU). Validasi penuh = tahap C. Batas (c_daily, c_gap_secs) ada di fungsi; ubah di sana.

create or replace function public._wib_day_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
$$;
revoke all on function public._wib_day_start() from public, anon, authenticated;

-- ============ 1. Hadiah boss lawan CPU ============
create or replace function public.claim_cpu_boss_reward(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_coins    constant bigint := 500;   -- = Config.DRAGON_REWARD.coins di klien
  c_gems     constant bigint := 10;    -- = Config.DRAGON_REWARD.gems
  c_daily    constant int    := 5;     -- batas klaim per akun per hari WIB
  c_gap_secs constant int    := 180;   -- jarak minimal antar klaim
  v_uid   uuid := auth.uid();
  v_start timestamptz := public._wib_day_start();
  v_n     int;
  v_last  timestamptz;
  v_wait  int;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('ok', false, 'reason', 'token-tidak-valid');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;      -- serialisasi: cap tidak bisa dilompati paralel

  -- Token yang sama = klaim yang sama (cek lebih dulu agar kirim ulang tidak dikira "terlalu cepat").
  if exists (select 1 from public.wallet_ledger where user_id = v_uid and reason = 'boss_cpu' and ref_key = p_token) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim');
  end if;

  select count(*), max(created_at) into v_n, v_last
    from public.wallet_ledger where user_id = v_uid and reason = 'boss_cpu' and created_at >= v_start;
  if v_n >= c_daily then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'cap', c_daily, 'seconds_to_reset', public._secs_to_wib_reset());
  end if;
  if v_last is not null and now() < v_last + make_interval(secs => c_gap_secs) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => c_gap_secs)) - now()))::int;
    return jsonb_build_object('ok', false, 'reason', 'terlalu-cepat', 'tunggu_detik', v_wait);
  end if;

  v_res := public._wallet_apply(v_uid, c_coins, c_gems, 'boss_cpu', p_token);
  return v_res || jsonb_build_object('reward_coins', c_coins, 'reward_gems', c_gems, 'sisa_hari_ini', c_daily - v_n - 1);
end;
$$;
revoke all on function public.claim_cpu_boss_reward(text) from public, anon;
grant execute on function public.claim_cpu_boss_reward(text) to authenticated;

-- ============ 2. claim_boss_reward (online): hari WIB ============
-- Sama dengan versi 202611110002; satu-satunya perubahan: awal hari = 00.00 WIB (bukan 00.00 UTC).
create or replace function public.claim_boss_reward(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_coins constant bigint := 500;   -- = Config.DRAGON_REWARD di klien
  c_gems  constant bigint := 10;
  c_daily constant int    := 10;    -- batas hadiah boss online per akun per hari WIB; menahan farming lewat room palsu
  v_uid    uuid := auth.uid();
  v_room   public.game_rooms;
  v_widx   int;
  v_winner text;
  v_n      int;
  v_res    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_game_room_member(p_room_id) then raise exception 'ROOM_ACCESS_DENIED'; end if;
  select * into v_room from public.game_rooms where id = p_room_id;
  if v_room.status <> 'finished' then return jsonb_build_object('ok', false, 'reason', 'room_not_finished'); end if;
  v_widx := case when (v_room.game_state -> 'snapshot' ->> 'winnerIndex') ~ '^[0-9]+$'
                 then (v_room.game_state -> 'snapshot' ->> 'winnerIndex')::int end;
  v_winner := case when v_widx is not null then v_room.game_state -> 'snapshot' -> 'players' -> v_widx ->> 'networkId' end;
  if v_winner is null then return jsonb_build_object('ok', false, 'reason', 'no_result'); end if;
  if v_winner <> v_uid::text then return jsonb_build_object('ok', false, 'reason', 'not_winner'); end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select count(*) into v_n from public.wallet_ledger
    where user_id = v_uid and reason = 'boss' and created_at >= public._wib_day_start();
  if v_n >= c_daily then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;

  v_res := public._wallet_apply(v_uid, c_coins, c_gems, 'boss', p_room_id::text);
  return v_res || jsonb_build_object('reward_coins', c_coins, 'reward_gems', c_gems);
end;
$$;
revoke all on function public.claim_boss_reward(uuid) from public, anon;
grant execute on function public.claim_boss_reward(uuid) to authenticated;

-- ============ 3. Sisa jatah hari ini (untuk UI) ============
create or replace function public.reward_caps_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_cpu_daily constant int := 5; c_online_daily constant int := 10;
  v_uid uuid := auth.uid(); v_start timestamptz := public._wib_day_start(); v_cpu int; v_on int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) filter (where reason = 'boss_cpu'), count(*) filter (where reason = 'boss')
    into v_cpu, v_on from public.wallet_ledger
   where user_id = v_uid and reason in ('boss_cpu', 'boss') and created_at >= v_start;
  return jsonb_build_object(
    'boss_cpu_left',    greatest(c_cpu_daily - v_cpu, 0),
    'boss_online_left', greatest(c_online_daily - v_on, 0),
    'tz', 'Asia/Jakarta', 'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.reward_caps_get() from public, anon;
grant execute on function public.reward_caps_get() to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611120001_wallet_b6_ad_reward.sql
-- ---------------------------------------------------------------------------
-- Dompet server, TAHAP B6: emerald dari iklan berhadiah (rewarded ad). Terapkan SETELAH 202611110004_wallet_b4_caps.sql.
--
--   claim_ad_reward(token): +5 emerald per klaim (nominal DI SERVER, klien tidak mengirim jumlah).
--     Idempoten per token (kunci ledger (user, 'ad', token)), maks 5 klaim per hari WIB, jarak minimal 60 detik.
--   ad_reward_get(): sisa jatah hari ini + hitung mundur reset, untuk UI.
--
-- BATAS KEPERCAYAAN: token dibuat oleh klien, jadi server TIDAK tahu iklan benar-benar ditonton. Batas harian dan
-- jarak hanya MEMBATASI kerugian (maks 5 x 5 = 25 emerald/hari/akun). Untuk menutup celah ini sepenuhnya, jaringan iklan
-- harus memanggil balik server (server-side verification, mis. AdMob SSV): server memasukkan token ke tabel "iklan
-- terverifikasi" dan claim_ad_reward hanya menerima token yang ada di sana. Belum dikerjakan; ubah c_* di bawah bila perlu.

create or replace function public.claim_ad_reward(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems     constant bigint := 5;    -- emerald per iklan
  c_daily    constant int    := 5;    -- batas klaim per akun per hari WIB
  c_gap_secs constant int    := 60;   -- jarak minimal antar klaim
  v_uid   uuid := auth.uid();
  v_start timestamptz := public._wib_day_start();
  v_n     int;
  v_last  timestamptz;
  v_wait  int;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('ok', false, 'reason', 'token-tidak-valid');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;     -- serialisasi: batas tidak bisa dilompati paralel

  if exists (select 1 from public.wallet_ledger where user_id = v_uid and reason = 'ad' and ref_key = p_token) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-klaim');
  end if;

  select count(*), max(created_at) into v_n, v_last
    from public.wallet_ledger where user_id = v_uid and reason = 'ad' and created_at >= v_start;
  if v_n >= c_daily then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'cap', c_daily, 'seconds_to_reset', public._secs_to_wib_reset());
  end if;
  if v_last is not null and now() < v_last + make_interval(secs => c_gap_secs) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => c_gap_secs)) - now()))::int;
    return jsonb_build_object('ok', false, 'reason', 'terlalu-cepat', 'tunggu_detik', v_wait);
  end if;

  v_res := public._wallet_apply(v_uid, 0, c_gems, 'ad', p_token);
  return v_res || jsonb_build_object('reward_gems', c_gems, 'sisa_hari_ini', c_daily - v_n - 1,
                                     'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.claim_ad_reward(text) from public, anon;
grant execute on function public.claim_ad_reward(text) to authenticated;

create or replace function public.ad_reward_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_gems constant bigint := 5; c_daily constant int := 5; c_gap_secs constant int := 60;
  v_uid uuid := auth.uid(); v_start timestamptz := public._wib_day_start(); v_n int; v_last timestamptz; v_wait int := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*), max(created_at) into v_n, v_last
    from public.wallet_ledger where user_id = v_uid and reason = 'ad' and created_at >= v_start;
  if v_last is not null and now() < v_last + make_interval(secs => c_gap_secs) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => c_gap_secs)) - now()))::int;
  end if;
  return jsonb_build_object('gems', c_gems, 'cap', c_daily, 'left', greatest(c_daily - v_n, 0), 'tunggu_detik', v_wait,
                            'tz', 'Asia/Jakarta', 'seconds_to_reset', public._secs_to_wib_reset());
end;
$$;
revoke all on function public.ad_reward_get() from public, anon;
grant execute on function public.ad_reward_get() to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611130001_player_outfits.sql
-- ---------------------------------------------------------------------------
-- Outfit pribadi + tampilan aktif di SERVER. Terapkan SETELAH 202611120001_wallet_b6_ad_reward.sql
-- (butuh item_catalog + player_inventory dari B2 dan is_game_room_member dari 202611060001).
--
-- Isi:
--   1. item_catalog.gender : gender tiap item gear ('m' | 'f' | null = semua). Diisi dari katalog klien lewat
--                            tools/wallet/gen-item-seed.js (blok GEAR GENDER SEED di bawah; jangan edit tangan).
--   2. player_outfits      : maksimal 5 slot per pemain (slot 0..4), data tervalidasi SERVER.
--   3. player_appearance   : tampilan aktif (look, equipped, gearDye) supaya ikut ke perangkat lain dan bisa dilihat
--                            pemain lain di room multiplayer.
--
-- Aturan (mengikuti pola wallet B1/B2): tabel RLS aktif + tanpa akses langsung untuk klien; semua lewat RPC
-- security definer yang memakai auth.uid(). Validasi satu pintu di fungsi internal _outfit_normalize /
-- _appearance_normalize; data yang ditolak tidak menulis apa pun (tidak ada simpan setengah).
-- Kepemilikan: item dimiliki bila item starter ATAU ada di player_inventory (starter tidak disimpan di inventory server).
-- Bentuk data outfit sama dengan PlayerData klien (assets/js/player-data.js, cleanOutfitData):
--   { gender:'m'|'f', top|legs|boots|helm|chest|shoulder|cape|weapon:{id, dye?}, accessories:[{id, dye?}] }

-- ============ 1. Gender item ============
alter table public.item_catalog add column if not exists gender text check (gender is null or gender in ('m', 'f'));

-- BEGIN GEAR GENDER SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)
update public.item_catalog c set gender = v.g
from (values
  ('gear.acc.beard', 'm'),
  ('gear.acc.belt', null),
  ('gear.acc.bow', 'f'),
  ('gear.acc.earrings', 'f'),
  ('gear.acc.glasses', null),
  ('gear.acc.gloves', null),
  ('gear.acc.goggles', null),
  ('gear.acc.mustache', 'm'),
  ('gear.acc.necklace', 'f'),
  ('gear.acc.pack', null),
  ('gear.acc.purse', 'f'),
  ('gear.acc.scarf', null),
  ('gear.boots.cloth', null),
  ('gear.boots.flat', 'f'),
  ('gear.boots.knee', 'f'),
  ('gear.boots.mary', 'f'),
  ('gear.boots.none', null),
  ('gear.boots.sandal', null),
  ('gear.boots.shoes', null),
  ('gear.boots.tall', null),
  ('gear.cape.long', null),
  ('gear.cape.short', null),
  ('gear.cape.wings', 'f'),
  ('gear.chest.bodice', 'f'),
  ('gear.chest.leather', null),
  ('gear.chest.plate', null),
  ('gear.chest.valk', 'f'),
  ('gear.helm.beret', 'f'),
  ('gear.helm.crown', null),
  ('gear.helm.flowers', 'f'),
  ('gear.helm.knight', null),
  ('gear.helm.ribbon', 'f'),
  ('gear.helm.straw', null),
  ('gear.helm.tiara', 'f'),
  ('gear.helm.wizard', null),
  ('gear.legs.bare', null),
  ('gear.legs.formal', 'm'),
  ('gear.legs.lskirt', 'f'),
  ('gear.legs.pants', null),
  ('gear.legs.shorts', null),
  ('gear.legs.skirt', 'f'),
  ('gear.legs.tights', 'f'),
  ('gear.shoulder.gem', 'f'),
  ('gear.shoulder.leather', null),
  ('gear.shoulder.pad', null),
  ('gear.shoulder.ruffle', 'f'),
  ('gear.shoulder.spiked', 'm'),
  ('gear.top.blouse', 'f'),
  ('gear.top.cardigan', 'f'),
  ('gear.top.coat', 'm'),
  ('gear.top.dress', 'f'),
  ('gear.top.overall', null),
  ('gear.top.robe', null),
  ('gear.top.sundress', 'f'),
  ('gear.top.tee', null),
  ('gear.top.tunic', null),
  ('gear.top.vest', null),
  ('gear.weapon.axe', 'm'),
  ('gear.weapon.parasol', 'f'),
  ('gear.weapon.rapier', 'f'),
  ('gear.weapon.staff', null),
  ('gear.weapon.sword', null),
  ('gear.weapon.wand', 'f')
) as v(id, g)
where c.id = v.id;
-- END GEAR GENDER SEED

-- ============ 2. Tabel ============
create table if not exists public.player_outfits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       smallint not null check (slot between 0 and 4),
  name       text not null check (char_length(name) between 1 and 16),
  data       jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.player_outfits enable row level security;
revoke all on public.player_outfits from anon, authenticated;

create table if not exists public.player_appearance (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  look       jsonb check (look is null or jsonb_typeof(look) = 'object'),
  equipped   jsonb not null default '{}'::jsonb check (jsonb_typeof(equipped) = 'object'),
  gear_dye   jsonb not null default '{}'::jsonb check (jsonb_typeof(gear_dye) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.player_appearance enable row level security;
revoke all on public.player_appearance from anon, authenticated;

-- ============ 3. Fungsi internal (TIDAK bisa dipanggil klien) ============
create or replace function public._bad(p_reason text, p_item text default null) returns jsonb
language sql immutable as $$
  select case when p_item is null then jsonb_build_object('ok', false, 'reason', p_reason)
              else jsonb_build_object('ok', false, 'reason', p_reason, 'item', p_item) end;
$$;
revoke all on function public._bad(text, text) from public, anon, authenticated;

create or replace function public._owns_item(p_user uuid, p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.item_catalog c where c.id = p_item and c.starter)
      or exists (select 1 from public.player_inventory i where i.user_id = p_user and i.item_id = p_item);
$$;
revoke all on function public._owns_item(uuid, text) from public, anon, authenticated;

-- Satu bagian outfit: null bila sah, atau {ok:false, reason, item}. 'none' (bagian kosong) sah bila bukan item katalog.
create or replace function public._outfit_item_error(p_user uuid, p_part text, p_id text, p_gender text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_key text := 'gear.' || p_part || '.' || p_id; v_it public.item_catalog;
begin
  select * into v_it from public.item_catalog where id = v_key and kind = 'gear';
  if not found then
    if p_id = 'none' then return null; end if;
    return public._bad('item-tidak-dikenal', v_key);
  end if;
  if v_it.gender is not null and v_it.gender <> p_gender then return public._bad('gender-tidak-cocok', v_key); end if;
  if not public._owns_item(p_user, v_key) then return public._bad('belum-dimiliki', v_key); end if;
  return null;
end;
$$;
revoke all on function public._outfit_item_error(uuid, text, text, text) from public, anon, authenticated;

-- Validasi + normalisasi data outfit. Return {ok:true, data} atau {ok:false, reason, item?}.
create or replace function public._outfit_normalize(p_user uuid, p_data jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_parts constant text[] := array['top', 'legs', 'boots', 'helm', 'chest', 'shoulder', 'cape', 'weapon'];
  c_id    constant text   := '^[a-z0-9_]{1,24}$';
  v_gender text; v_out jsonb; v_k text; v_p jsonb; v_id text; v_dye text; v_err jsonb;
  v_acc jsonb; v_a jsonb; v_accs jsonb := '[]'::jsonb; v_seen text[] := '{}';
begin
  if jsonb_typeof(p_data) is distinct from 'object' then return public._bad('data-tidak-valid'); end if;
  v_gender := case when jsonb_typeof(p_data -> 'gender') = 'string' then p_data ->> 'gender' end;
  if v_gender is null or v_gender not in ('m', 'f') then return public._bad('data-tidak-valid'); end if;
  v_out := jsonb_build_object('gender', v_gender);

  foreach v_k in array c_parts loop
    v_p := p_data -> v_k;
    if v_p is null or jsonb_typeof(v_p) = 'null' then v_p := '{"id":"none"}'::jsonb; end if;
    if jsonb_typeof(v_p) <> 'object' or jsonb_typeof(v_p -> 'id') is distinct from 'string' then return public._bad('data-tidak-valid'); end if;
    v_id := v_p ->> 'id';
    if v_id !~ c_id then return public._bad('data-tidak-valid'); end if;
    v_dye := null;
    if v_p ? 'dye' and jsonb_typeof(v_p -> 'dye') <> 'null' then
      if jsonb_typeof(v_p -> 'dye') <> 'string' or (v_p ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      v_dye := v_p ->> 'dye';
    end if;
    v_err := public._outfit_item_error(p_user, v_k, v_id, v_gender);
    if v_err is not null then return v_err; end if;
    v_out := v_out || jsonb_build_object(v_k, case when v_dye is null then jsonb_build_object('id', v_id) else jsonb_build_object('id', v_id, 'dye', v_dye) end);
  end loop;

  v_acc := coalesce(nullif(p_data -> 'accessories', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_acc) <> 'array' or jsonb_array_length(v_acc) > 12 then return public._bad('data-tidak-valid'); end if;
  for v_a in select * from jsonb_array_elements(v_acc) loop
    if jsonb_typeof(v_a) <> 'object' or jsonb_typeof(v_a -> 'id') is distinct from 'string' or (v_a ->> 'id') !~ c_id then return public._bad('data-tidak-valid'); end if;
    v_id := v_a ->> 'id';
    v_dye := null;
    if v_a ? 'dye' and jsonb_typeof(v_a -> 'dye') <> 'null' then
      if jsonb_typeof(v_a -> 'dye') <> 'string' or (v_a ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      v_dye := v_a ->> 'dye';
    end if;
    if v_id = 'none' or v_id = any (v_seen) then continue; end if;   -- sama dengan klien: 'none' dan duplikat dibuang
    v_err := public._outfit_item_error(p_user, 'acc', v_id, v_gender);
    if v_err is not null then return v_err; end if;
    v_seen := v_seen || v_id;
    v_accs := v_accs || jsonb_build_array(case when v_dye is null then jsonb_build_object('id', v_id) else jsonb_build_object('id', v_id, 'dye', v_dye) end);
  end loop;
  v_out := v_out || jsonb_build_object('accessories', v_accs);
  return jsonb_build_object('ok', true, 'data', v_out);
end;
$$;
revoke all on function public._outfit_normalize(uuid, jsonb) from public, anon, authenticated;

-- Nama outfit: sama dengan klien (kontrol dan < > dibuang, spasi dirapikan, maks 16). Kosong -> null.
create or replace function public._outfit_name(p_name text) returns text
language sql immutable as $$
  select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]+', '', 'g'), '\s+', ' ', 'g')), 16), '');
$$;
revoke all on function public._outfit_name(text) from public, anon, authenticated;

-- Slot yang seharusnya dipakai sebuah item equipment (sama dengan item.slot di klien); null = tidak bisa di-equip.
create or replace function public._item_equip_slot(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select case c.kind
    when 'skin' then 'skin' when 'dice' then 'dice' when 'theme' then 'theme' when 'frame' then 'frame'
    when 'gear' then case when split_part(c.id, '.', 2) = 'acc' then 'g.acc.' || split_part(c.id, '.', 3) else 'g.' || split_part(c.id, '.', 2) end
  end
  from public.item_catalog c where c.id = p_id;
$$;
revoke all on function public._item_equip_slot(text) from public, anon, authenticated;

-- Validasi + normalisasi tampilan aktif. Return {ok:true, look, equipped, gear_dye} atau {ok:false, reason, item?}.
create or replace function public._appearance_normalize(p_user uuid, p_look jsonb, p_equipped jsonb, p_dye jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_id constant text := '^[a-z0-9_]{1,24}$';
  v_look jsonb := null; v_part text; v_o jsonb; v_h numeric := 1; v_b numeric := 1; v_body jsonb;
  v_eq jsonb := '{}'::jsonb; v_gd jsonb := '{}'::jsonb; r record; v_slot text;
begin
  if p_look is not null and jsonb_typeof(p_look) <> 'null' then
    if jsonb_typeof(p_look) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if jsonb_typeof(p_look -> 'gender') is distinct from 'string' or (p_look ->> 'gender') not in ('m', 'f') then return public._bad('data-tidak-valid'); end if;
    if jsonb_typeof(p_look -> 'skin') is distinct from 'string' or (p_look ->> 'skin') !~ '^s[1-5]$' then return public._bad('data-tidak-valid'); end if;
    v_look := jsonb_build_object('gender', p_look ->> 'gender', 'skin', p_look ->> 'skin');
    foreach v_part in array array['eyes', 'hair'] loop
      v_o := p_look -> v_part;
      if jsonb_typeof(v_o) is distinct from 'object' or jsonb_typeof(v_o -> 'id') is distinct from 'string' or jsonb_typeof(v_o -> 'dye') is distinct from 'string'
         or (v_o ->> 'id') !~ c_id or (v_o ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      v_look := v_look || jsonb_build_object(v_part, jsonb_build_object('id', v_o ->> 'id', 'dye', v_o ->> 'dye'));
    end loop;
    v_body := p_look -> 'body';
    if v_body is not null and jsonb_typeof(v_body) = 'object' then
      if jsonb_typeof(v_body -> 'height') = 'number' and (v_body ->> 'height')::numeric > 0 then v_h := (v_body ->> 'height')::numeric; end if;
      if jsonb_typeof(v_body -> 'build')  = 'number' and (v_body ->> 'build')::numeric  > 0 then v_b := (v_body ->> 'build')::numeric; end if;
    end if;
    v_look := v_look || jsonb_build_object('body', jsonb_build_object('height', least(1.1, greatest(0.9, v_h)), 'build', least(1.15, greatest(0.9, v_b))));
  end if;

  if p_equipped is not null and jsonb_typeof(p_equipped) <> 'null' then
    if jsonb_typeof(p_equipped) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if (select count(*) from jsonb_object_keys(p_equipped)) > 60 then return public._bad('data-tidak-valid'); end if;
    for r in select key, value from jsonb_each(p_equipped) loop
      if jsonb_typeof(r.value) <> 'string' then return public._bad('data-tidak-valid'); end if;
      v_slot := public._item_equip_slot(r.value #>> '{}');
      if v_slot is null or v_slot <> r.key then return public._bad('slot-tidak-cocok', r.value #>> '{}'); end if;
      if not public._owns_item(p_user, r.value #>> '{}') then return public._bad('belum-dimiliki', r.value #>> '{}'); end if;
      v_eq := v_eq || jsonb_build_object(r.key, r.value);
    end loop;
  end if;

  if p_dye is not null and jsonb_typeof(p_dye) <> 'null' then
    if jsonb_typeof(p_dye) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if (select count(*) from jsonb_object_keys(p_dye)) > 120 then return public._bad('data-tidak-valid'); end if;
    for r in select key, value from jsonb_each(p_dye) loop
      if jsonb_typeof(r.value) <> 'string' or (r.value #>> '{}') !~ c_id then return public._bad('data-tidak-valid'); end if;
      if not exists (select 1 from public.item_catalog c where c.id = r.key and c.kind = 'gear') then return public._bad('item-tidak-dikenal', left(r.key, 60)); end if;
      if not public._owns_item(p_user, r.key) then return public._bad('belum-dimiliki', r.key); end if;
      v_gd := v_gd || jsonb_build_object(r.key, r.value);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'look', v_look, 'equipped', v_eq, 'gear_dye', v_gd);
end;
$$;
revoke all on function public._appearance_normalize(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ============ 4. RPC outfit ============
create or replace function public.outfit_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slot', slot, 'name', name, 'data', data, 'updated_at', updated_at) order by slot)
                   from public.player_outfits where user_id = v_uid), '[]'::jsonb);
end;
$$;
revoke all on function public.outfit_list() from public, anon;
grant execute on function public.outfit_list() to authenticated;

-- Simpan outfit baru ke slot kosong pertama (maks 5). Semua item harus dimiliki dan cocok gender.
create or replace function public.outfit_save(p_name text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text := public._outfit_name(p_name); v_n jsonb; v_slot int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name is null then return public._bad('nama-kosong'); end if;
  perform pg_advisory_xact_lock(hashtextextended('outfit:' || v_uid::text, 0));   -- serialisasi per pemain: tidak ada slot ganda/melebihi batas
  v_n := public._outfit_normalize(v_uid, p_data);
  if not (v_n ->> 'ok')::boolean then return v_n; end if;
  select s into v_slot from generate_series(0, 4) s
    where not exists (select 1 from public.player_outfits o where o.user_id = v_uid and o.slot = s) order by s limit 1;
  if v_slot is null then return public._bad('slot-penuh'); end if;
  insert into public.player_outfits(user_id, slot, name, data) values (v_uid, v_slot, v_name, v_n -> 'data');
  return jsonb_build_object('ok', true, 'slot', v_slot, 'name', v_name, 'data', v_n -> 'data');
end;
$$;
revoke all on function public.outfit_save(text, jsonb) from public, anon;
grant execute on function public.outfit_save(text, jsonb) to authenticated;

create or replace function public.outfit_rename(p_slot int, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text := public._outfit_name(p_name); v_rows int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name is null then return public._bad('nama-kosong'); end if;
  update public.player_outfits set name = v_name, updated_at = now() where user_id = v_uid and slot = p_slot;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return public._bad('tidak-ada'); end if;
  return jsonb_build_object('ok', true, 'slot', p_slot, 'name', v_name);
end;
$$;
revoke all on function public.outfit_rename(int, text) from public, anon;
grant execute on function public.outfit_rename(int, text) to authenticated;

create or replace function public.outfit_delete(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.player_outfits where user_id = v_uid and slot = p_slot;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return public._bad('tidak-ada'); end if;
  return jsonb_build_object('ok', true, 'slot', p_slot);
end;
$$;
revoke all on function public.outfit_delete(int) from public, anon;
grant execute on function public.outfit_delete(int) to authenticated;

-- ============ 5. RPC tampilan aktif ============
-- Simpan tampilan aktif milik sendiri. Klien mengirim isi PlayerData (look, equipped, gearDye); server memvalidasi
-- kepemilikan/slot/format dan menulis seluruhnya atau tidak sama sekali.
create or replace function public.appearance_save(p_look jsonb, p_equipped jsonb, p_gear_dye jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_n := public._appearance_normalize(v_uid, p_look, p_equipped, p_gear_dye);
  if not (v_n ->> 'ok')::boolean then return v_n; end if;
  insert into public.player_appearance(user_id, look, equipped, gear_dye, updated_at)
    values (v_uid, nullif(v_n -> 'look', 'null'::jsonb), v_n -> 'equipped', v_n -> 'gear_dye', now())
    on conflict (user_id) do update set look = excluded.look, equipped = excluded.equipped, gear_dye = excluded.gear_dye, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.appearance_save(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.appearance_save(jsonb, jsonb, jsonb) to authenticated;

create or replace function public.appearance_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_a public.player_appearance;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_a from public.player_appearance where user_id = v_uid;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'look', v_a.look, 'equipped', v_a.equipped, 'gear_dye', v_a.gear_dye, 'updated_at', v_a.updated_at);
end;
$$;
revoke all on function public.appearance_get() from public, anon;
grant execute on function public.appearance_get() to authenticated;

-- Tampilan aktif semua anggota sebuah room (hanya untuk anggota room itu). Pemain tanpa data tidak muncul.
create or replace function public.room_appearance_get(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_game_room_member(p_room_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'look', a.look, 'equipped', a.equipped, 'gear_dye', a.gear_dye) order by a.user_id)
    from public.player_appearance a
    where a.user_id in (
      select (e ->> 'id')::uuid from public.game_rooms r, jsonb_array_elements(r.players) e
      where r.id = p_room_id and (e ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.room_appearance_get(uuid) from public, anon;
grant execute on function public.room_appearance_get(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611140001_buy_set.sql
-- ---------------------------------------------------------------------------
-- Beli SET gear atomik (tahap c). Terapkan SETELAH 202611130001_player_outfits.sql
-- (butuh item_catalog, player_inventory, _wallet_apply, _wallet_ensure dari B1/B2).
--
-- buy_set(p_item_ids text[]): server menghitung total dari item_catalog, memotong koin SEKALI, dan memasukkan
-- semua item belum-dimiliki dalam SATU transaksi. Semua berhasil atau semua gagal; klien tidak mengirim harga.
-- Pola mengikuti buy_item: kunci baris dompet, _wallet_apply untuk ledger, alasan penolakan sama.
--
-- Hasil ok  : {ok:true, items:[id baru], skipped:[id sudah dimiliki], spent, coins, gems}
--             semua sudah dimiliki -> ok dengan spent 0 dan items [] (tidak ada ledger).
-- Hasil gagal (tidak menulis apa pun):
--   tidak-tersedia : daftar kosong/null, elemen null, id tak dikenal, bukan gear, item starter, tanpa harga.
--                    SATU item tidak dijual menolak SELURUH set (bukan beli sebagian).
--   terlalu-banyak : > 20 id unik (dihitung setelah id berulang digabung) atau > 200 elemen mentah.
--   saldo-kurang   : total item belum dimiliki > koin, dengan nilai 'kurang'.
-- Urutan pemeriksaan (ditiru persis oleh PlayerData.purchaseSet di klien untuk tamu):
--   kosong/null -> elemen mentah > 200 -> elemen null -> gabung id, unik > 20 -> validitas katalog -> kepemilikan -> saldo.
-- Ledger: satu baris reason 'buy_set', ref_key 'set:' || md5(id baru terurut) -> retry set yang sama tidak menagih dua kali.

create or replace function public.buy_set(p_item_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_max_unique constant int := 20;
  c_max_raw    constant int := 200;
  v_uid    uuid := auth.uid();
  v_ids    text[];
  v_good   int;
  v_new    text[];
  v_skip   text[];
  v_total  bigint;
  v_coins  bigint;
  v_gems   bigint;
  v_res    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;
  if cardinality(p_item_ids) > c_max_raw then
    return jsonb_build_object('ok', false, 'reason', 'terlalu-banyak');
  end if;
  if exists (select 1 from unnest(p_item_ids) x where x is null) then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  -- id berulang digabung (anti-dobel)
  select array_agg(distinct x order by x) into v_ids from unnest(p_item_ids) x;
  if cardinality(v_ids) > c_max_unique then
    return jsonb_build_object('ok', false, 'reason', 'terlalu-banyak');
  end if;

  -- semua id harus gear yang dijual
  select count(*) into v_good from public.item_catalog
    where id = any(v_ids) and kind = 'gear' and not starter and not stackable and price_coins is not null;
  if v_good <> cardinality(v_ids) then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- kunci dompet DULU, baru baca kepemilikan

  select coalesce(array_agg(id order by id), '{}') into v_skip
    from public.item_catalog c
    where c.id = any(v_ids) and exists (select 1 from public.player_inventory i where i.user_id = v_uid and i.item_id = c.id);
  select coalesce(array_agg(id order by id), '{}') into v_new
    from public.item_catalog c
    where c.id = any(v_ids) and not (c.id = any(v_skip));

  select coins, gems into v_coins, v_gems from public.player_wallet where user_id = v_uid;

  if cardinality(v_new) = 0 then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb, 'skipped', to_jsonb(v_skip), 'spent', 0,
                              'coins', v_coins, 'gems', v_gems);
  end if;

  select sum(price_coins) into v_total from public.item_catalog where id = any(v_new);
  if v_coins < v_total then
    return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'kurang', v_total - v_coins);
  end if;

  v_res := public._wallet_apply(v_uid, -v_total, 0, 'buy_set', 'set:' || md5(array_to_string(v_new, ',')));
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  insert into public.player_inventory(user_id, item_id)
    select v_uid, unnest(v_new)
    on conflict (user_id, item_id) do nothing;

  return jsonb_build_object('ok', true, 'items', to_jsonb(v_new), 'skipped', to_jsonb(v_skip), 'spent', v_total,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_set(text[]) from public, anon;
grant execute on function public.buy_set(text[]) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611150001_player_prefs.sql
-- ---------------------------------------------------------------------------
-- Preferensi pemain di server, TAHAP 7b. Terapkan SETELAH 202611140001_buy_set.sql.
--
-- Tujuan: pengaturan (musik, suara, kamera, auto-roll, siang/malam, map & power room, ambience, pengaturan umum)
-- ikut akun ke perangkat lain. Klien (UT.Prefs) tetap menyimpan salinan lokal sebagai cache cepat; server = sumber
-- bersama lintas perangkat.
--
-- Aturan:
--   * Tabel tertutup untuk klien (RLS aktif, semua hak dicabut). Akses HANYA lewat get_my_prefs / set_my_prefs.
--   * set_my_prefs menerima objek JSON, hanya kunci yang ada di daftar putih yang disimpan, ukuran maks 8 KB.
--   * Tidak ada data uang/progres di sini: ini murni preferensi tampilan/perangkat.

create table if not exists public.player_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb
             check (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 8192),
  updated_at timestamptz not null default now()
);
alter table public.player_prefs enable row level security;
revoke all on public.player_prefs from anon, authenticated;

-- Baca preferensi akun. Return {ok, prefs, updated_at}; akun yang belum pernah menyimpan mendapat prefs = {}.
create or replace function public.get_my_prefs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.player_prefs;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.player_prefs where user_id = v_uid;
  return jsonb_build_object('ok', true, 'prefs', coalesce(v_row.prefs, '{}'::jsonb), 'updated_at', v_row.updated_at);
end;
$$;
revoke all on function public.get_my_prefs() from public, anon;
grant execute on function public.get_my_prefs() to authenticated;

-- Simpan (ganti seluruh) preferensi akun. Kunci di luar daftar putih dibuang diam-diam.
create or replace function public.set_my_prefs(p_prefs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  c_keys  constant text[] := array['settings','musicVol','musicOn','sfxVol','autoDN','night','autoRoll','cam','roomMap','roomPowers','ambience'];
  v_clean jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then raise exception 'BAD_PREFS'; end if;
  if octet_length(p_prefs::text) > 8192 then raise exception 'PREFS_TOO_LARGE'; end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_clean
    from jsonb_each(p_prefs) e where e.key = any (c_keys);
  insert into public.player_prefs(user_id, prefs, updated_at) values (v_uid, v_clean, now())
    on conflict (user_id) do update set prefs = excluded.prefs, updated_at = now();
  return jsonb_build_object('ok', true, 'prefs', v_clean);
end;
$$;
revoke all on function public.set_my_prefs(jsonb) from public, anon;
grant execute on function public.set_my_prefs(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- >>> 202611160001_frame_catalog.sql
-- ---------------------------------------------------------------------------
-- Frame profil: daftarkan 14 frame (4 lama + 10 baru) ke katalog SERVER.
-- Harga/starter dibaca server dari item_catalog (bukan dari klien/localStorage). Aman diulang (upsert).
-- Sumber kebenaran: assets/js/item-catalog.js -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('frame.amethyst', 'frame', 1500, false, false),
  ('frame.celestial', 'frame', 7500, false, false),
  ('frame.copper', 'frame', 350, false, false),
  ('frame.cosmic', 'frame', 8000, false, false),
  ('frame.default', 'frame', null, true, false),
  ('frame.diamond', 'frame', 1200, false, false),
  ('frame.dragon', 'frame', 4000, false, false),
  ('frame.ender', 'frame', 2500, false, false),
  ('frame.gold', 'frame', 800, false, false),
  ('frame.iron', 'frame', 500, false, false),
  ('frame.nether', 'frame', 2000, false, false),
  ('frame.phoenix', 'frame', 5500, false, false),
  ('frame.stone', 'frame', 150, false, false),
  ('frame.storm', 'frame', 3000, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;


-- ---------------------------------------------------------------------------
-- >>> 202611170001_dice_catalog.sql
-- ---------------------------------------------------------------------------
-- Dadu: daftarkan 23 skin dadu (koleksi Dragon Roll) ke katalog SERVER.
-- Harga/starter dibaca server dari item_catalog (bukan dari klien/localStorage/hardcode di gameplay). Aman diulang (upsert).
-- Sumber kebenaran: assets/js/item-catalog.js -> tools/wallet/gen-item-seed.js (jalankan --check sebelum deploy).
-- Harga dadu baru adalah usulan berdasarkan rarity/tier; ubah di item-catalog.js lalu jalankan gen-item-seed.js --write dan terapkan ulang.
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('dice.amethyst', 'dice', 450, false, false),
  ('dice.copper', 'dice', 150, false, false),
  ('dice.diamond', 'dice', 450, false, false),
  ('dice.dragon', 'dice', 3500, false, false),
  ('dice.emas', 'dice', 900, false, false),
  ('dice.emerald', 'dice', 450, false, false),
  ('dice.ender', 'dice', 1800, false, false),
  ('dice.frost', 'dice', 900, false, false),
  ('dice.iron', 'dice', 200, false, false),
  ('dice.klasik', 'dice', null, true, false),
  ('dice.lapis', 'dice', 250, false, false),
  ('dice.magma', 'dice', 900, false, false),
  ('dice.netherite', 'dice', 1800, false, false),
  ('dice.obsidian', 'dice', 500, false, false),
  ('dice.prismarine', 'dice', 900, false, false),
  ('dice.quartz', 'dice', 900, false, false),
  ('dice.redstone', 'dice', 500, false, false),
  ('dice.rumput', 'dice', 100, false, false),
  ('dice.sculk', 'dice', 1800, false, false),
  ('dice.stone', 'dice', 100, false, false),
  ('dice.tnt', 'dice', 200, false, false),
  ('dice.void', 'dice', 1800, false, false),
  ('dice.wood', 'dice', 100, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;


-- ---------------------------------------------------------------------------
-- >>> 202611180001_appearance_many.sql
-- ---------------------------------------------------------------------------
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

