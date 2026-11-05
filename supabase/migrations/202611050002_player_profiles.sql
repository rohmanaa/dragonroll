-- Player progress (coins, gems, xp, inventory, equipped skin/dice/theme/frame, settings) tied to a
-- registered (non-anonymous) Supabase Auth account. Mirrors PlayerData's localStorage state as one jsonb document.
-- Apply in Supabase SQL Editor (or `supabase db push`). Safe to re-run.

create table if not exists public.player_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint player_profiles_state_is_object check (jsonb_typeof(state) = 'object'),
  constraint player_profiles_state_size check (pg_column_size(state) < 65536)
);

-- Server-owned timestamp: the client can never set it.
create or replace function public.player_profiles_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists player_profiles_touch on public.player_profiles;
create trigger player_profiles_touch
before insert or update on public.player_profiles
for each row execute function public.player_profiles_touch();

alter table public.player_profiles enable row level security;

-- Only the owner, and only registered accounts (anonymous multiplayer identities are excluded). No DELETE policy.
drop policy if exists player_profiles_select_own on public.player_profiles;
create policy player_profiles_select_own on public.player_profiles
  for select to authenticated
  using (auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists player_profiles_insert_own on public.player_profiles;
create policy player_profiles_insert_own on public.player_profiles
  for insert to authenticated
  with check (auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists player_profiles_update_own on public.player_profiles;
create policy player_profiles_update_own on public.player_profiles
  for update to authenticated
  using (auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

revoke all on public.player_profiles from anon;
grant select, insert, update on public.player_profiles to authenticated;
