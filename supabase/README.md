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

## Event log (Langkah 2)

`supabase/migrations/202611060001_game_events.sql` menambah `game_events` (log berurutan per room), RPC `submit_game_action`, `set_game_public_profile`, `claim_game_reward`. Terapkan setelah `202611050001_multiplayer.sql` dan pastikan `game_events` ada di Realtime publication. Detail dan hasil uji: `audit/multiplayer-step2-event-log.md`.
