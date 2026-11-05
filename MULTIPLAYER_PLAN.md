# Multiplayer Lobby Implementation Plan

## Goal

Add anonymous online multiplayer to the existing Ular Tangga game while preserving the current frontend, game engine, and non-multiplayer features.

The application is a static frontend deployed on Vercel. Supabase is the only multiplayer backend. Do not introduce a custom Node server, Vercel Functions, Edge Functions, Redis, Socket.IO, or another backend service unless a concrete requirement later proves Supabase insufficient.

## Product scope

### In scope

- Anonymous players; no account registration or profile/shop/inventory integration.
- Create a private room and share its room code or invite URL.
- Join a private room using a room code or invite URL.
- Create a public room.
- Quick Join: find and join an available public room automatically.
- Lobby player list, host identity, ready state, and start-game flow.
- Synchronize the active game between browsers.
- Handle player disconnect/reconnect sufficiently for a usable prototype.
- Deploy the static frontend on Vercel and configure Supabase environment values.

### Explicitly out of scope

- User accounts, authentication tied to an existing profile, shop, inventory, or player-data features.
- Friends/social graph, chat, ranking, matchmaking rating, moderation tools, and spectator mode.
- Payments or other application backend features.
- Anti-cheat guarantees or competitive-grade authoritative game hosting.

## Existing application constraints

The repository is a static HTML/CSS/JavaScript application, not a framework-based frontend. The existing room UI and game engine should be retained where practical.

Relevant existing files discovered during repository review:

- `game/lobby.html`
- `game/room.html`
- `game/gameplay.html`
- `game/assets/js/room-flow.js`
- `game/assets/js/player-data.js`
- `game/assets/js/game-integration.js`
- `game/gameplay/` game-engine modules

The current room flow already presents online/offline, private/public, room code, invite, player list, ready, and start concepts. However, room state, player state, guest readiness, and host start behavior are currently simulated in browser-local JavaScript. Public/private selection is not backed by matchmaking, and separate browsers do not share lobby or gameplay state.

Keep `player-data.js` and unrelated shop/profile functionality out of this implementation. Multiplayer identity must be separate and anonymous.

## Architecture

### Hosting and services

- **Vercel:** static frontend hosting only.
- **Supabase Postgres:** durable room/lobby snapshot and current game snapshot.
- **Supabase Realtime:** lobby/game notifications and presence.
- **Browser client:** connects directly to Supabase using the public anon/publishable key.
- **No server-side secret in the browser:** the Supabase service-role key must never be exposed to Vercel client assets.

### Anonymous identity

Generate a random client-side player ID and retain it in browser storage for reconnect continuity. Ask for or generate a display name using the existing UI conventions. This identity is not an authenticated Supabase user and must not be treated as proof of identity.

Use a random, sufficiently unguessable room code. Do not rely on a short predictable random number alone.

### Initial data model

Start with one primary table, `game_rooms`, and avoid premature normalization:

- `id`: UUID primary key.
- `code`: unique room code.
- `host_id`: anonymous player ID of the host.
- `is_public`: whether Quick Join may discover the room.
- `status`: `waiting`, `playing`, or `finished`.
- `players`: JSONB lobby player snapshot (ID, display name, ready state, and any minimal game-required player attributes).
- `game_state`: JSONB game snapshot; nullable until a game starts.
- `created_at` and `updated_at`: timestamps.

The exact JSON contracts must be finalized after tracing the existing `room-flow.js`, `game-integration.js`, and gameplay engine interfaces. Do not duplicate profile/shop data.

### Concurrency and room operations

Room creation, joining, leaving, readiness changes, host transfer, Quick Join, and game start must not depend on stale client snapshots.

Use small Postgres RPC functions for operations that require atomic validation, especially:

- Join by room code: validate room is joinable and has capacity, then add the player atomically.
- Quick Join: select and join one waiting public room atomically, avoiding overfilling or double-joining.
- Start game: validate host and minimum player requirements before changing room status.

Prefer a minimal set of narrowly scoped RPCs over adding a separate application server. Final function signatures and validation rules are a later implementation checkpoint.

### Realtime and gameplay authority

- Use Supabase Realtime Presence for online connection awareness, not as the only durable source of player membership.
- Use Realtime notifications/Broadcast or database change subscriptions to distribute committed lobby/game updates.
- Persist important state transitions in Postgres so reconnecting clients can recover.
- Use a host-authoritative prototype model: the host coordinates dice rolls, turn progression, and resulting game-state updates; guests consume the synchronized state. Validate host ownership for writes where feasible.
- Avoid allowing every client to independently write the full game snapshot.
- Define reconnect and stale-player cleanup behavior before implementing it. Presence is ephemeral; persisted room membership needs an explicit policy.

### Security baseline

- Enable Row Level Security on exposed tables.
- Use the anon/publishable key in the browser.
- Never ship the service-role key.
- Restrict room reads/writes to the intended room operations and participants as far as the anonymous model permits.
- Treat anonymous player IDs supplied by browsers as untrusted input. This prototype does not provide strong identity or anti-cheat guarantees.
- Keep Supabase credentials in Vercel environment configuration and local development configuration; do not commit secrets.

## Verified integration findings

The existing room/game contract was traced in Checkpoint 1. The room router stores the full room config in sessionStorage under `ut-room` before gameplay navigation. Gameplay state is closure-private inside `game/gameplay.html`; its authoritative state is held in `players[]`, `cur`, and related per-player fields. `doRoll()` is the single dice entry point and `playTurn()` owns movement, tile effects, chests, boss phases, and turn advancement. The engine currently supports local hot-seat play; all seats are human except the VS Computer mode.

Consequences for multiplayer implementation:

- Preserve the existing engine and add a narrow bridge rather than rewriting the engine.
- Use host-authoritative simulation: guests send roll intents, host executes existing game logic.
- Publish serializable snapshots at stable state boundaries; never attempt to serialize Three.js objects or animation state.
- Apply room player display names to generated engine players.
- Coordinate or disable the independent ready-card shuffle for online play.
- Reconnect must reconstruct the local scene, then apply the latest persisted snapshot.
- Interactive mid-turn decisions (notably Totem, chest reward, and boss phases) are a known synchronization risk and require explicit handling and multi-client validation.

## Implementation checkpoints

Each checkpoint must end with an updated `MULTIPLAYER_STATE.md` and a Git commit on the working branch. The state file is the recovery handoff: record the commit SHA, completed work, changed files, validation performed, known issues, decisions, and the exact next action.

### Checkpoint 0 — Planning and repository baseline

- Add this plan and the state file.
- Create a dedicated working branch from the current `main`.
- Do not modify application code or run application tests in this checkpoint.

**Acceptance:** both documents are committed on the feature branch; `main` remains unchanged.

### Checkpoint 1 — Trace existing room/game contracts

- Inspect the full room flow, URL parameter contract, player model, game initialization, turn progression, dice handling, and end-game behavior.
- Identify the narrowest integration points and existing UI states to preserve.
- Document the proposed client-side multiplayer service boundary and exact game-state payload.
- Do not yet implement the Supabase integration until the contract is understood.

**Acceptance:** state document records the verified call flow, data contract, integration files, and any unresolved questions.

### Checkpoint 2 — Supabase schema and client foundation

- [x] Add Supabase browser client initialization.
- [x] Add SQL migration for room schema, indexes, RLS, RPCs, and Realtime publication.
- [x] Add anonymous Supabase Auth identity with persisted browser session.
- [x] Add setup instructions and an ignored local browser config file template.
- [ ] Validate migration against a real Supabase project and browser session.

**Acceptance:** schema/setup instructions are reproducible; no service-role secret is committed; static app can initialize the client safely. Runtime validation is pending Supabase project configuration.

### Checkpoint 3 — Private room lifecycle

- [x] Add browser-side create/join/ready/leave service and Realtime subscription.
- [x] Replace active online-room local fake membership/readiness with Supabase-backed room rows.
- [x] Preserve existing room equipment/power/map UI and share private room code/link.
- [ ] Validate two independent browser sessions against a configured Supabase project.

**Acceptance:** two independent browser sessions can create/join the same private room and see consistent membership. Runtime validation is pending Supabase project configuration.

### Checkpoint 4 — Public rooms and Quick Join

- [x] Add host-only RPC to toggle room visibility while waiting.
- [x] Add public Quick Join RPC with row locking and `SKIP LOCKED` to avoid overfilling.
- [x] Expose public/private access controls in the room access modal.
- [x] Add Quick Join Solo/Team actions to the existing online room tile.
- [ ] Validate simultaneous Quick Join attempts against a configured Supabase project.

**Acceptance:** two or more independent sessions can discover and join a public waiting room without exceeding capacity. Runtime/race validation is pending Supabase project configuration.

### Checkpoint 5 — Realtime lobby

- [x] Subscribe to room-row changes and Presence; synchronize roster/readiness/visibility.
- [x] Add host-only start transition through the database RPC; guests navigate when the room status becomes `playing`.
- [x] Persist the host room ID in session storage to recover the same room after refresh.
- [x] Explicit host leave transfers ownership to a remaining player in the database; guest reconnect reuses the anonymous Auth session.
- [ ] Validate host transfer, refresh/reconnect, and synchronized start with multiple browsers.

**Acceptance:** lobby changes appear across browsers and recover after a page reload/reconnect. Abrupt disconnect cleanup remains a hardening item.

### Checkpoint 6 — Gameplay synchronization

- [x] Keep the existing engine host-authoritative; guests cannot execute local dice/movement simulation.
- [x] Add Realtime Broadcast for guest roll intents and host snapshots.
- [x] Persist JSON gameplay snapshots with revision checks; Three.js objects remain local.
- [x] Synchronize roster names/IDs, turns, positions, power counters, crystal/boss progress, and finish state at stable turn boundaries.
- [x] Disable independent online ready-card shuffling; use the room roster order.
- [ ] Validate normal turns, special dice, powers, boss phases, and reconnect snapshots in two browsers.

**Acceptance:** two browsers observe the same game progression and final outcome. Runtime validation remains pending Supabase configuration and multi-browser testing.

### Checkpoint 7 — Hardening and deployment

- [x] Revoke default PUBLIC/anon execution on security-definer RPCs; grant only authenticated anonymous sessions.
- [x] Add host heartbeat, stale waiting-room filtering, and stale-room pruning on create.
- [x] Mark a room finished when the host persists a terminal snapshot; prevent silent host transfer during an active match.
- [x] Keep profile/inventory/cosmetic/power-up data out of the online room payload; use anonymous names and neutral defaults.
- [x] Document static Vercel deployment with `game/` as root and tracked public Supabase config.
- [ ] Apply the SQL migration and run the full two-browser test matrix against a real Supabase project.

**Acceptance:** code and setup are committed; live acceptance remains pending a configured Supabase project and runtime test results.

## Validation strategy

Per the project workflow agreed for this task, do not spend time running tests before a checkpoint is pushed. At each checkpoint:

1. Review the diff and update the state document.
2. Commit the checkpoint.
3. Push/verify the branch commit.
4. Run only the tests or manual checks relevant to that checkpoint after push.
5. Record exact commands, outcomes, and failures in `MULTIPLAYER_STATE.md`.

For multiplayer behavior, use at least two independent browser sessions (normal + private/incognito, or two browsers). Test private invite, invalid code, full room, public Quick Join, simultaneous Quick Join attempts, readiness, host departure, refresh/reconnect, game synchronization, and finished-room behavior.

## Working rules

- Work only on `feature/supabase-multiplayer`; do not commit implementation work directly to `main`.
- Commit every completed checkpoint, not one large commit at the end.
- Update `MULTIPLAYER_STATE.md` in the same checkpoint commit as the work it describes.
- Keep changes small and aligned with the existing static frontend.
- Do not introduce extra services or abstractions without a demonstrated need.
- If a checkpoint cannot be completed, commit a truthful state update describing what is done, what failed, and the precise recovery step. Never mark unverified work as complete.
- No implementation changes are included in Checkpoint 0.
