# Supabase setup — Ular Tangga multiplayer

## Required Supabase project settings

1. Use the supplied Supabase project (`fxtecbxuoyavdvpcylht`).
2. In **Authentication → Providers → Anonymous**, enable anonymous sign-ins.
3. Apply `supabase/migrations/202611050001_multiplayer.sql` in the SQL Editor (or with Supabase CLI).
4. Confirm `public.game_rooms` is enabled for Realtime. The migration attempts to add it to `supabase_realtime`; if publication permissions prevent that, enable it from Database → Publications / Realtime settings.
5. The public project URL and publishable key are already configured in `game/assets/js/multiplayer/config.example.js`. If the key is rotated, update that file and commit the new public key. This key is designed to be public; never use the service_role/secret key.
6. In Vercel, import the GitHub repository and set **Root Directory** to `game`, **Framework Preset** to `Other`, **Build Command** to none, and **Output Directory** to `.`. The site is static; no Vercel Functions or server environment variables are needed.

## Anonymous player identity

The browser calls `supabase.auth.signInAnonymously()` on first multiplayer use. Supabase persists the anonymous session in browser storage and exposes its UUID through `auth.uid()`. No registration or profile/shop linkage is involved. Anonymous Auth must be enabled or this call will fail.

## SQL model

`game_rooms` stores the room code, host, visibility, format/capacity, player roster, room config, game snapshot, and monotonically increasing revision.

All mutations are RPC-based. RLS allows authenticated room members to read their room. The RPC functions perform row locking and host/member checks. The browser key is the anon/publishable key, not service_role.

## Notes

- Anonymous Auth users are real Supabase Auth records. Configure Supabase Auth rate limits / CAPTCHA according to expected traffic; anonymous identities can be abused at scale.
- This is not strong identity or anti-cheat. Clearing browser storage creates a new anonymous player identity.
- Waiting rooms heartbeat every 30 seconds while the host page is connected. Quick Join only sees rooms with a recent heartbeat; private joins reject stale rooms after 10 minutes. Old waiting rooms are pruned when a new room is created. This is best-effort browser lifecycle cleanup, not a guaranteed server scheduler.

## Public rooms and Quick Join

A room owner can switch a waiting room between private and public from **ROOM ACCESS**. Public rooms become discoverable by Quick Join; private rooms remain joinable by code. The mode selector offers Quick Join Solo and Quick Join Team. Quick Join is an atomic database RPC and joins one compatible waiting public room.

## Multiplayer data boundary

Online room config does not upload PlayerData profile names, inventory, equipped cosmetics, or power-up ownership. Anonymous Auth generates a separate display name (Player-XXXX). Online games use neutral default cosmetics and no inventory-backed power-ups. The selected map is retained as a game setting only.

## Deployment and test checklist

- [ ] Enable Anonymous Auth.
- [ ] Apply the SQL migration and verify `game_rooms` is in the Realtime publication.
- [ ] Put the public Supabase URL and anon/publishable key in `config.example.js`.
- [ ] Deploy `game/` as the Vercel project root.
- [ ] Test private invite code, invalid code, Ready, host start, public toggle, Quick Join Solo/Team, simultaneous Quick Join, refresh/reconnect, and turns in two browsers.
- [ ] Test special dice, power/tile effects, Ender Dragon, Nether/Wither, game finish, and host/guest refresh during a game.
- [ ] Review Supabase Auth rate limits/CAPTCHA and database logs before public release.

The host browser is authoritative and must stay connected during a match. This is a lightweight anonymous prototype, not anti-cheat or a dedicated server.

## Player account data (progress sync)

Migration `supabase/migrations/202611050002_player_profiles.sql` creates `public.player_profiles` (one jsonb `state` per registered account; RLS = owner only, anonymous multiplayer identities excluded, no DELETE).
Run it in the SQL Editor **before** relying on cloud sync. Without it the game keeps working from localStorage (sync just logs a warning).

`game/assets/js/cloud-sync.js` behaviour:
- Login: server row exists -> server wins (local copy is backed up to `ularTanggaBlok:player:v1:backup:*`, last 3 kept). No row -> local data is uploaded once (local data is never deleted).
- If this device's local data belongs to a different account, a new account starts from a fresh state (old data backed up).
- Saves are debounced (2.5 s) and flushed on tab hide/close. Offline/error -> stays local and retries later.
- Conflict rule is last-write-wins per account. Client-side state is not anti-cheat: a user can edit their own row.
