# Dragon Roll — Global Extraction Phase 8

## Status

`prefs-sync.js` was relocated to `assets/js/core/prefs-sync.js`. The module remains self-starting and keeps its browser and CommonJS exports. One relative dynamic-import path was adjusted so `multiplayer/client.js` resolves to the same URL after relocation. Test suites and browser tests were not run.

## 1. Git baseline

| Check | Result |
|---|---|
| Branch | `restruktur` |
| Phase 7 migration | `7f70c1e8344ed21dee945bd33fa97fc0c4c11950` |
| Phase 7 final HEAD | `cb9debc6b2e5685d305db7dab6c5be3b609832b3` |
| Starting `HEAD` | `cb9debc6b2e5685d305db7dab6c5be3b609832b3` |
| Starting `origin/restruktur` after fetch | `cb9debc6b2e5685d305db7dab6c5be3b609832b3` |
| Starting worktree | Clean |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |

The Phase 7 migration and final audit commits were present. Branch, remote, and clean-worktree checks passed before changes. `main` was not checked out or modified.

## 2. Dependency and runtime audit

### Module, API, and startup

`prefs-sync.js` is a classic IIFE. It publishes `UT.PrefsSync` synchronously in the browser and `module.exports` in Node. Its returned API is `{ create, KEYS }`; browser startup later adds `UT.PrefsSync.instance`.

In the browser it self-starts: if the document is loading, it schedules `boot()` after `DOMContentLoaded`; otherwise it schedules `boot()` with `setTimeout`. `boot()` exits unless both `UT.Prefs` and `UT.Session` are available, creates the sync instance, and, for logged-in sessions, starts the preference listener, registers a `pagehide` flush, and performs a throttled pull. The startup and lifecycle logic were not changed.

The module depends on:

- `UT.Prefs` for `all()`, `set()`, and `on()`.
- `UT.Session.loggedIn()` to determine whether account synchronization is enabled.
- `UT.Multiplayer.getClient()` or the lazy-loaded client module.

`assets/js/core/prefs.js` and `assets/js/session.js` remain unchanged. The current live-sync module is `assets/js/core/live-sync.js`; no direct `UT.LiveSync` or `prefs-sync.js` dependency was found.

### Pages and script order

The 22 HTML consumers are:

`dadu.html`, `efek.html`, `frame.html`, `friendship.html`, `gameplay.html`, `hadiah-misi.html`, `inventory.html`, `karakter.html`, `leaderboard.html`, `lobby.html`, `mail.html`, `mode.html`, `old/dailyreward.html`, `old/misi.html`, `pet.html`, `play.html`, `powerup.html`, `profile.html`, `room.html`, `settings.html`, `shop.html`, and `tambang.html`.

On all 22 pages, `session.js` precedes `prefs.js`, and `prefs.js` immediately precedes `prefs-sync.js`. The external scripts remain classic, blocking scripts with no `async` or `defer`; only the `prefs-sync.js` `src` changed. `splash.html` does not load `prefs-sync.js`.

### Storage and network contracts

- `prefs-sync.js` accesses `sessionStorage` only for the existing per-tab throttle key `ut:prefs-pulled`.
- Preference values continue to flow through `UT.Prefs`; no direct local-storage key or migration code changed.
- The server calls remain `get_my_prefs` and `set_my_prefs`, with their existing payloads and behavior.
- No RPC, endpoint, Supabase, or data contract changed.

### Path-sensitive dynamic import

The module reads `document.currentScript.src` into `SELF`. Before relocation, `new URL('multiplayer/client.js', SELF)` resolved to `/assets/js/multiplayer/client.js`. With the new script URL under `/assets/js/core/`, using that same relative string would incorrectly resolve to `/assets/js/core/multiplayer/client.js`.

The moved module now selects `../multiplayer/client.js` when `SELF` is present. From `/assets/js/core/prefs-sync.js`, this resolves to the exact previous target `/assets/js/multiplayer/client.js`. If `SELF` is empty, the original `multiplayer/client.js` string and `w.location.href` fallback remain unchanged. A static URL-resolution check confirmed both the normal and fallback URLs are identical before and after the move. The client module itself remains at its original path, so its own relative dependencies are unaffected.

No other imports, `fetch` calls, workers, or path-dependent behavior were found in `prefs-sync.js`.

## 3. Decision and migration

The move was safe with the dynamic-import adjustment above. The global API, CommonJS export, startup timing, storage behavior, server calls, and page script order remain unchanged. No compatibility wrapper was added because all known in-repository callers were migrated; an additional classic-script wrapper would introduce another startup path without providing a need established by the audit.

| Old path | New path | Bytes | Result |
|---|---|---:|---|
| `assets/js/prefs-sync.js` | `assets/js/core/prefs-sync.js` | 5,709 → 5,783 | Relocated; only the dynamic client-module path expression changed |

Changed files:

- `assets/js/prefs-sync.js` → `assets/js/core/prefs-sync.js`.
- 22 HTML files listed above: changed only the `prefs-sync.js` script `src`.
- `tests/prefs-sync.test.js`: changed only the CommonJS `require` path; test logic was not changed.
- `assets/preload-manifest.json`: replaced the old path/5,709-byte entry with the new path/5,783-byte entry.
- `audit/5/global-extraction-phase-8.md`: this report.

`prefs.js`, `session.js`, `assets/js/core/live-sync.js`, and `sw.js` were not modified.

## 4. Preload and service-worker contract

- The new preload entry matches the measured 5,783-byte source size.
- The old entry was removed, and every path in the updated manifest exists.
- `sw.js` remains `ut-pwa-v185`. `prefs-sync.js` is not in `CORE`; same-origin non-media GET requests use network-first handling and successful responses are cached by request URL.
- The preloader fetches manifest URLs, so the new module URL is cached under its new URL after an online fetch. No cache-version or service-worker change was needed; old URL cache entries, if present, remain unused by updated pages.

## 5. Static verification

- Confirmed the old source path is absent and the new source exists.
- Confirmed all 22 HTML references use the new path and remain after `prefs.js`; all page script sequences are otherwise unchanged.
- Confirmed `tests/prefs-sync.test.js` only changed its module path.
- Compared parsed preload manifests: only removal of the old key and addition of the new key differ; the new size is 5,783 bytes and all paths exist.
- Compared dynamic-import URL resolution for old and new script locations; the resolved client URL is identical. The empty-`SELF` fallback also remains identical.
- Confirmed there are no active references to the old path. Historical audit text was intentionally retained.
- Confirmed `prefs.js`, `session.js`, `assets/js/core/live-sync.js`, and `sw.js` are unchanged.
- `git diff --check` passed.

## 6. Tests not run

No test suite, test-file execution, or browser test was performed, as required. Static URL equivalence and path checks are not a test pass.

## 7. Checkpoint

| Checkpoint | Commit | Push |
|---|---|---|
| Module relocation and direct references | `3637a78dd1fb6054fd82df945685aac11bd75b29` (`refactor(js): relocate preferences sync module`) | Pushed to `origin/restruktur` |

At the migration checkpoint push, `HEAD` and `origin/restruktur` both resolved to `3637a78dd1fb6054fd82df945685aac11bd75b29`. Final post-push verification also confirms the `restruktur` branch has `HEAD == origin/restruktur` and a clean worktree. `main` and `origin/main` remain unchanged at `aeb11acf130df4ade4acc9417f01470e40a33dbb`.

## 8. Remaining risk and follow-up

- All known in-repository callers were updated. An external or stale page that still hard-codes the old script URL may require an online refresh; no compatibility alias was added.
- `prefs.js` and `session.js` were not changed or moved. Any future relocation of either module requires its own dependency and startup-order audit.
