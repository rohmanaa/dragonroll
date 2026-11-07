# Multiplayer Implementation State

> Recovery document. Update this file in every checkpoint commit. Treat the latest committed version as the source of truth when resuming after a context loss.

## Current checkpoint

- **Checkpoint:** 7 — Hardening and deployment
- **Status:** Supabase browser config committed; runtime validation pending migration application and deployment
- **Working branch:** `feature/supabase-multiplayer`
- **Repository:** https://github.com/dqmrafi/ular-tangga
- **Base branch:** `main`
- **Checkpoint 0 commit:** `76e71e67233116936f8c27b4c6c5241efffb275f`
- **Checkpoint 1 commit:** `5e55393291dc70fa1535900339a6b8ef4c91253f`
- **Current implementation/config commit:** `298be2d441bd3377decf58cfb2693da3b671d6df`
- **Application code changed:** Yes — Supabase foundation and private-room UI integration.
- **Tests run:** No runtime tests. No Supabase project credentials/config are available in the repository.

## Goal and scope

Implement anonymous multiplayer rooms for Ular Tangga using the existing static frontend and Supabase. Support private room creation/invite-code join, public room creation/Quick Join, synchronized lobby state, and synchronized gameplay.

Out of scope: user accounts/profile/shop/inventory, friends/chat/rankings, and a custom backend server.

## Repository and engine contracts

See the verified source-flow analysis and integration implications in `MULTIPLAYER_PLAN.md`. Key facts: `room.html` currently simulates online behavior; `RoomFlow.launch(cfg)` stores `ut-room` before navigation; gameplay state is closure-private inside `gameplay.html`; `doRoll()` and `playTurn()` are the central authoritative engine path.

## Architecture decisions

1. Vercel serves static files; no Vercel Function is required.
2. Supabase Postgres stores durable room/game snapshots.
3. Supabase Realtime provides row-change notifications and Presence.
4. Anonymous Supabase Auth provides an auth UUID without a registration UI; no profile/shop integration.
5. Browser uses only the public anon/publishable key. Never expose service_role.
6. Mutations use Postgres RPC functions with row locking and member/host validation.
7. Host-authoritative game simulation remains the intended prototype model.

## Checkpoint history

| Checkpoint | Description | Status | Commit |
|---|---|---|---|
| 0 | Planning docs and branch baseline | Complete | `76e71e67233116936f8c27b4c6c5241efffb275f` |
| 1 | Trace room/game contracts | Complete | `5e55393291dc70fa1535900339a6b8ef4c91253f` |
| 2 | Supabase schema/client foundation | Committed; runtime validation pending Supabase project | `1040e240d5b6a94523a12a0ba5fb29033221da05` |
| 3 | Private room lifecycle | Committed; runtime validation pending | `5c7cbbd8df3e727c583f85c36bd188f21daa7399` |
| 4 | Public rooms and Quick Join | Committed; runtime validation pending | `1b2461cb0c60958763cc0f1b76520dde3a93c35c` |
| 5 | Realtime lobby | Committed; runtime validation pending | `f4f37e7ede9a6849968930b017d6f7f11f660c9a` |
| 6 | Gameplay synchronization | Committed; runtime validation pending | `3d6ee1b7873e8dfebeecf2e282ded0f5ebfedada` |
| 7 | Hardening and deployment | Code committed; live Supabase validation pending | `113810753b0bb1eb26634e59a7d0bedbca9df435` |
| 8 | Configure supplied Supabase project | Public browser URL/publishable key committed; migration and live tests pending | `298be2d441bd3377decf58cfb2693da3b671d6df` |

## SQL migration repair after first Supabase execution

- User reported SQL Editor error at line 389 (`syntax error at or near then`).
- Removed the accidental duplicate SQL fragment appended after the final permission grant; the migration now ends after the heartbeat RPC grants (388 lines).
- Corrected `create_game_room` room-code regex to `^[A-Z0-9]{6,8}# Multiplayer Implementation State

> Recovery document. Update this file in every checkpoint commit. Treat the latest committed version as the source of truth when resuming after a context loss.

## Current checkpoint

- **Checkpoint:** 7 — Hardening and deployment
- **Status:** Supabase browser config committed; runtime validation pending migration application and deployment
- **Working branch:** `feature/supabase-multiplayer`
- **Repository:** https://github.com/dqmrafi/ular-tangga
- **Base branch:** `main`
- **Checkpoint 0 commit:** `76e71e67233116936f8c27b4c6c5241efffb275f`
- **Checkpoint 1 commit:** `5e55393291dc70fa1535900339a6b8ef4c91253f`
- **Current implementation/config commit:** `298be2d441bd3377decf58cfb2693da3b671d6df`
- **Application code changed:** Yes — Supabase foundation and private-room UI integration.
- **Tests run:** No runtime tests. No Supabase project credentials/config are available in the repository.

## Goal and scope

Implement anonymous multiplayer rooms for Ular Tangga using the existing static frontend and Supabase. Support private room creation/invite-code join, public room creation/Quick Join, synchronized lobby state, and synchronized gameplay.

Out of scope: user accounts/profile/shop/inventory, friends/chat/rankings, and a custom backend server.

## Repository and engine contracts

See the verified source-flow analysis and integration implications in `MULTIPLAYER_PLAN.md`. Key facts: `room.html` currently simulates online behavior; `RoomFlow.launch(cfg)` stores `ut-room` before navigation; gameplay state is closure-private inside `gameplay.html`; `doRoll()` and `playTurn()` are the central authoritative engine path.

## Architecture decisions

1. Vercel serves static files; no Vercel Function is required.
2. Supabase Postgres stores durable room/game snapshots.
3. Supabase Realtime provides row-change notifications and Presence.
4. Anonymous Supabase Auth provides an auth UUID without a registration UI; no profile/shop integration.
5. Browser uses only the public anon/publishable key. Never expose service_role.
6. Mutations use Postgres RPC functions with row locking and member/host validation.
7. Host-authoritative game simulation remains the intended prototype model.

## Checkpoint history

| Checkpoint | Description | Status | Commit |
|---|---|---|---|
| 0 | Planning docs and branch baseline | Complete | `76e71e67233116936f8c27b4c6c5241efffb275f` |
| 1 | Trace room/game contracts | Complete | `5e55393291dc70fa1535900339a6b8ef4c91253f` |
| 2 | Supabase schema/client foundation | Committed; runtime validation pending Supabase project | `1040e240d5b6a94523a12a0ba5fb29033221da05` |
| 3 | Private room lifecycle | Committed; runtime validation pending | `5c7cbbd8df3e727c583f85c36bd188f21daa7399` |
| 4 | Public rooms and Quick Join | Committed; runtime validation pending | `1b2461cb0c60958763cc0f1b76520dde3a93c35c` |
| 5 | Realtime lobby | Committed; runtime validation pending | `f4f37e7ede9a6849968930b017d6f7f11f660c9a` |
| 6 | Gameplay synchronization | Committed; runtime validation pending | `3d6ee1b7873e8dfebeecf2e282ded0f5ebfedada` |
| 7 | Hardening and deployment | Code committed; live Supabase validation pending | `113810753b0bb1eb26634e59a7d0bedbca9df435` |
| 8 | Configure supplied Supabase project | Public browser URL/publishable key committed; migration and live tests pending | `298be2d441bd3377decf58cfb2693da3b671d6df` |

 with a properly closed SQL string.
- Commit: `293f10ac3fc6606135caed5c99eede4cae3552c1`.
- User should rerun the complete corrected migration. It is designed to be rerunnable (`create table/index if not exists`, policy drop/create, and `create or replace function`), but confirm the actual result in Supabase.

## Post-checkpoint static audit

- Guest power-up buttons previously invoked `usePU()` locally, changing only the guest's local game state. Added a `power_request` Broadcast event: the guest submits its player ID and power key, and the host verifies current turn ownership and remaining power before executing the existing engine path. The resulting stable-turn snapshot is then persisted and broadcast as before.
- Corrected the migration's room-code regex operator from `!` to `!~`.

- Found a blocking PL/pgSQL syntax typo in `create_game_room`: the room-code validation operator was `!` instead of PostgreSQL's `!~` regex-not-match operator. Corrected before any real project migration was applied.
- Re-read the complete RPC list and confirmed each security-definer mutation has PUBLIC/anon execution revoked at migration end and authenticated execution granted.
- Reviewed the gameplay snapshot bridge. It synchronizes stable-turn player positions, turn index, dice counters, powers, crystal/boss flags, and finish state. Mid-turn animations/decisions are not represented; this remains a release validation risk, especially Totem/chest/boss interaction phases.
- Live SQL/browser tests remain unrun: no project credentials or two-browser runtime are available.

## Checkpoint 7 changes

- SQL hardening: corrected `LIMIT 1 FOR UPDATE SKIP LOCKED` ordering; added stale-room checks/pruning, active-game leave guard, finished-room status on terminal snapshots, host heartbeat, and revocation of default `PUBLIC`/`anon` execution for security-definer RPCs.
- `room-service.js`: host heartbeat every 30 seconds while connected; heartbeat stops on unsubscribe/host transfer. Static review caught and fixed a stale variable reference in the host-transfer heartbeat cleanup path.
- Room state now carries the server status through the UI so Ready/Start controls stay hidden after the room starts or finishes; the setup path no longer overrides that status-based visibility.
- `client.js` imports the tracked `config.example.js`, avoiding an ignored/untracked config file in static Vercel deployments.
- Configured `assets/js/multiplayer/config.example.js` with the user-provided Supabase project URL and publishable key. No secret/service-role key was supplied or added.
- `room-flow.js`, `room.html`, `game-integration.js`, and `gameplay.html`: online rooms no longer send account inventory, equipped cosmetics, or power-up selections; neutral defaults are used.
- `supabase/README.md`: documented Vercel root directory (``), public browser config, Anonymous Auth, and live test checklist.

## Checkpoint 6 changes

- `gameplay.html`: JSON snapshot/apply bridge; host-only simulation; guest roll requests; room seat identity/name mapping; turn, position, power, crystal/boss, and finish snapshots; online turn order is deterministic.
- `assets/js/multiplayer/game-sync.js`: Realtime Broadcast roll-intent/snapshot transport; snapshots persist via revision-checked RPC.
- `assets/js/game-integration.js`: online games preserve the room creator's shared skin/map/dice selections rather than substituting guest inventory cosmetics.
- `room.html`: passes room ID/revision/latest persisted snapshot into gameplay.

## Checkpoint 5 changes

- `room.html`: room host role is derived from the current backend host ID; waiting-room host state is restored from session storage after refresh; the host start button now calls the database start RPC; guests transition into gameplay when the Realtime room row reports `playing` with the host's room configuration; explicit leave clears the saved room reference.
- `assets/js/multiplayer/room-service.js`: start-room RPC wrapper and member-scoped room recovery read.
- SQL `start_game_room` validates host, minimum players, team balance, and all-ready before transitioning the room to `playing`.

## Checkpoint 4 changes

- `assets/js/multiplayer/room-service.js`: visibility update and atomic Quick Join wrappers.
- `supabase/migrations/202611050001_multiplayer.sql`: host-only `set_game_room_visibility` RPC. Existing `quick_join_game_room` uses row locking and `SKIP LOCKED`.
- `room.html`: ROOM ACCESS modal controls persisted private/public visibility; friend/demo invitation UI is hidden and replaced by room-code/link sharing.
- `mode.html`: online room tile offers Create Solo/Team and Quick Join Solo/Team. Quick Join joins through RPC, then opens the existing room page.
- `supabase/README.md`: public room setup/behavior notes.

## Checkpoint 3 changes

- `assets/js/multiplayer/room-service.js`: create/join/ready/leave RPC calls and room-row Realtime + Presence subscription.
- `room.html`: online mode creates private rooms or joins by invite code through Supabase; roster/readiness render from backend rows; fake guest readiness/start timers are removed from the active online flow; host empty slots share a room link. Local VS Computer/hot-seat setup remains local.

## Checkpoint 2 changes

- `supabase/migrations/202611050001_multiplayer.sql`: `game_rooms` schema, indexes, RLS select policy, anonymous-auth RPCs for create/join/Quick Join/ready/leave/start/game-state update, revision conflict guard, and Realtime publication setup.
- `assets/js/multiplayer/config.example.js`: public URL/key template.
- `assets/js/multiplayer/client.js`: lazy Supabase JS v2 client bootstrap and anonymous sign-in helper.
- `supabase/README.md`: Supabase project, Anonymous Auth, SQL, and static deployment setup.
- `.gitignore`: excludes local `config.js` so local public project configuration is not accidentally committed.

No room UI, gameplay engine, player-data, or shop/profile files have been modified in this checkpoint.

## Validation log

- Reviewed room integration anchors and matched client RPC names to the migration.
- Follow-up source review found the initial online render can run before the async room request returns; added a null-player guard to the room readiness check/render path.
- Static source review only; no browser/Supabase runtime validation is possible without a configured Supabase project.
- Re-read the existing room flow, gameplay bootstrap, turn engine, and finish path.
- Reviewed the migration and client bootstrap statically.
- Confirmed no service-role key or real project credentials are included.
- Not yet run against Supabase: project URL/key and Supabase project are not provisioned in this repository context.
- No browser test/build was run.

## Known limitations / risks

- Runtime SQL validation and anonymous sign-in require a real Supabase project with Anonymous Auth enabled. The first migration execution failed on an appended duplicate fragment; a corrected migration is now committed and awaiting rerun.
- This schema deliberately stores the roster in JSONB for a minimal prototype. Revisit only if concurrency/query requirements require normalization.
- The SQL RPCs require review/test against Supabase's deployed Postgres version and role grants before production use.
- Anonymous Auth is abuseable without rate limits/CAPTCHA; this is a prototype identity model, not verified identity.
- Room expiry is best-effort: host heartbeat, stale filters, and create-time pruning are implemented; there is no scheduled server cleanup job.
- Realtime publication may need manual enablement in the Supabase dashboard if the migration role cannot alter publication.
- The browser SDK is loaded from esm.sh at runtime; a later hardening pass may pin/version-host the dependency locally if desired.
- Mid-turn guest decisions (Totem prompt, chest choice, boss/arena phase choices) still need real two-browser UX validation. The host currently runs the authoritative engine and owns these prompts; guest-triggered power-ups and rolls are routed to the host.

## Exact next action

Repository implementation and static review are complete to the prototype scope. Before calling this production-ready, configure a Supabase project and run the real acceptance pass:  enable Anonymous Auth in the supplied Supabase project, apply `supabase/migrations/202611050001_multiplayer.sql`, deploy `` as the Vercel root, and run the multi-browser checklist in `supabase/README.md`. The public project URL/publishable key are already committed in the browser config. Fix runtime issues discovered and record actual browser/SQL results here. Prototype limits: anonymous roll broadcasts are not anti-cheat, the host browser must stay connected to advance gameplay, and abrupt guest disconnect cleanup is best-effort.
