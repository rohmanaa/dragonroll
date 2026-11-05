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
