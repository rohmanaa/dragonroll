# Global Extraction Phase 12 — App.js Assessment & Extraction

## Git preflight

- Branch: `restruktur`
- Starting `HEAD` and `origin/restruktur`: `713b1c992a6df9cad3f4255cbc213614883d3c9d`
- `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before this phase.
- The source existed at `assets/js/app.js`; `assets/js/core/app.js` did not exist.

## Dependency and public API audit

`app.js` is a classic script (not an ES module) that initializes the existing `window.UT` namespace. Its public surface includes:

- `UT.version` and `UT.PAGES`.
- `UT.App.page`, `ready`, `options`, and idempotent `init(options)`.
- `UT.Router.build`, `go`, `replace`, `getParams`, and generated `to*` helpers.
- `UT.State` facade methods for PlayerData, ItemCatalog, player state, settings, profile, equipment, ownership, page, and config.
- `UT.Events.NAMES`, `on`, `off`, `once`, and `emit`. Existing emitted events include `appReady` and `profileChanged` in addition to the events listed in `NAMES`.
- `UT.Audio` source and playback/volume controls.
- `UT.UI.toast`, `modal`, `closeModal`, and `setLoading`.
- `UT.Utils.safe`, `clamp`, and `isObject`.

The source reads `PlayerData` during initialization and its facade methods, and reads `UT.Prefs.get('sfxVol', 100)` lazily when audio plays. It has no direct dependency on `UT.Session`, `UT.PrefsSync`, `UT.LiveSync`, `WalletService`, `AppearanceService`, or HUD APIs. Page scripts consume the global APIs exposed by App; this migration preserves those APIs and event names.

Path/lifecycle inspection found no `document.currentScript`, `import.meta.url`, `fetch`, or other script-relative URLs. The source does contain a dynamic import of `multiplayer/presence.js`. Its specifier was adjusted from `./multiplayer/presence.js` to `../multiplayer/presence.js` so the moved file still imports the exact URL `assets/js/multiplayer/presence.js`. Audio and router paths are document-relative and remain unchanged.

## HTML consumers and initialization order

There are 21 HTML script consumers: 19 root pages (`dadu.html`, `efek.html`, `frame.html`, `friendship.html`, `gameplay.html`, `hadiah-misi.html`, `inventory.html`, `karakter.html`, `leaderboard.html`, `lobby.html`, `mail.html`, `mode.html`, `pet.html`, `powerup.html`, `profile.html`, `room.html`, `settings.html`, `shop.html`, and `tambang.html`) and the archived `old/dailyreward.html` and `old/misi.html`.

In each page, App remains in its original script position after `PlayerData`, `Prefs`, and `PrefsSync`, and before page initialization code. `UT.App.init()` occurs after the App script in the root pages; `gameplay.html` initializes through `gameplay/js/app-init.js`, which remains after App. HUD and page scripts remain after App where previously ordered that way. App does not directly consume `live-sync.js`, `WalletService`, `AppearanceService`, or HUD, so their relative positions do not constrain this move.

The two archived pages are nested under `old/`; their App script URLs were changed to `../assets/js/core/app.js` to resolve to the root module. Other archived asset references were not changed and may retain their pre-existing nested-path issues.

## Files and dependency updates

| Old path | New path | Update |
|---|---|---|
| `assets/js/app.js` | `assets/js/core/app.js` | Moved the single source file; changed only the dynamic-import specifier to preserve its effective URL. |
| 19 root HTML consumers | `assets/js/core/app.js` | Updated each script `src` in place, preserving script order. |
| `old/dailyreward.html`, `old/misi.html` | `../assets/js/core/app.js` | Updated nested script URLs to resolve to the root module. |
| `assets/js/pages/splash.js` | `assets/js/core/app.js` | Updated the asset list used by the splash preloader. |
| `assets/preload-manifest.json` | `assets/js/core/app.js` | Replaced the old key with the new key and exact 13,155-byte size. |
| `tests/room-looks.test.js` | `assets/js/core/app.js` | Updated its source-path assertion; test logic is unchanged. |

No compatibility alias was added: all known HTML, preload, and test references were updated, and a wrapper would create an unnecessary second load path. Historical audit text may still mention the old path.

`sw.js` was not changed. App is not in its core precache list; JavaScript uses the existing network-first strategy and is cached by requested URL. The strategy and cache version remain unchanged.

## Decision

**The extraction was safe and completed.** The broad global API remains a classic script and its initialization order is unchanged. The only internal path-sensitive operation was preserved at the same effective URL. No PlayerData, ItemCatalog, preference storage, Supabase/RPC, gameplay, UI, or business logic was changed.

## Static verification

- Verified all 21 HTML references resolve to the moved source, including the two nested archived references.
- Verified each HTML file differs from its baseline only in the App script path.
- Verified the moved source differs from the original only in the adjusted dynamic-import specifier, and the old/new import URLs are identical.
- Verified the preload key and byte size match the moved file; all other manifest entries are unchanged.
- Verified the splash preloader and source-path assertion use the new path.
- `node --check assets/js/core/app.js` and `node --check tests/room-looks.test.js` passed.
- `git diff --cached --check` passed.
- No test suite or browser test was run.

## Checkpoint and remaining risks

- Implementation commit: `4b2be66e03bf2d3cfecf8d5998f8858b7913fb43` (`refactor(js): relocate app bootstrap`), pushed to `origin/restruktur` before the audit commit.
- The audit is committed separately and pushed after this report is added.
- External integrations could still have hard-coded the former `assets/js/app.js` URL.
- The archived pages' other nested asset paths were not repaired or browser-tested.
- Final `HEAD == origin/restruktur`, clean worktree, and unchanged `main` are verified after the audit push.
