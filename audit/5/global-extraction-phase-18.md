# Global Restructure — Phase 18: Friendship Page Extraction

## Baseline and decision

- Branch: `restruktur`
- Phase 17 baseline `HEAD` and `origin/restruktur` at preflight: `df6e9e3b535aa0a7dabe7cda8eff49a282ef3414`
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean at preflight.
- Moved `assets/js/friendship-page.js` to `assets/js/pages/friendship-page.js`, preserving the page-specific module location decision.

## Consumers and script order

The only active HTML script consumer is `friendship.html`. It loads the shared page dependencies, calls `UT.App.init({page:'friendship'})`, and then loads the Friendship page controller. Only the controller's `src` changed; the order and inline initializer remain in place.

The source path was also present in `assets/preload-manifest.json`. No test, tool, configuration, or active documentation directly references the module path. Historical audit records were left unchanged.

## Dynamic Presence import

Before relocation, the controller evaluated `import('./multiplayer/presence.js')` immediately when its classic script ran. It does not use `document.currentScript`, `import.meta.url`, `new URL()`, or a URL fallback. The import promise starts Presence with `{ status: 'lobby', requireSession: true }`, registers `render` through `onChange`, and retains its existing catch/log behavior.

The specifier is now `../multiplayer/presence.js`. Relative URL resolution confirms that both the former script URL and the new script URL resolve the import to:

`assets/js/multiplayer/presence.js`

`assets/js/core/app.js` independently imports the same Presence module using its own relative path. The Friendship import still resolves to that same module URL, so module identity and the existing shared Presence API are preserved.

## Page API and behavior

The controller remains an IIFE and adds no exported API or global. It continues to consume the existing `PlayerData`, `UT.Multiplayer.RoomService`, `UT.Multiplayer.Presence`, `UT.Multiplayer.getClient`, `UT.WalletService`, `UT.AppearanceService`, `UT.CharacterFace`, `FrameAvatar`, `UT.Events`, and `UT.LiveSync` contracts. No authentication, friend request/list, online status, Supabase/RPC, UI, or persistence logic was changed.

## Preload and cache

The preload entry changed from `assets/js/friendship-page.js` (16,909 bytes) to `assets/js/pages/friendship-page.js` (16,910 bytes, measured from the moved file). Other preload entries were not changed as part of this extraction.

`sw.js` was not changed. The module is not in its small `CORE` list; non-media code follows the existing network-first strategy. No cache-version or strategy change was required.

## Static verification

- Confirmed `friendship.html` is the only active HTML caller and still loads the page controller once.
- Compared the complete HTML against baseline with only the controller `src` normalized; script and inline initialization order is unchanged.
- Compared the moved module against baseline; the only source change is the relative Presence import specifier.
- Resolved the old and new import URLs and confirmed both target `assets/js/multiplayer/presence.js`.
- Confirmed the preload JSON is valid, the new path and exact size are present, and no other preload entries changed as part of this extraction.
- Confirmed no current runtime reference remains to `assets/js/friendship-page.js`.
- `node --check assets/js/pages/friendship-page.js` passed.
- `git diff --check` passed.
- No test suite or browser test was run.

## Files changed and intentionally untouched

The implementation checkpoint changes only:

1. `assets/js/friendship-page.js` → `assets/js/pages/friendship-page.js`, with the one relative import adjustment.
2. `friendship.html`, updating its controller `src` in place.
3. `assets/preload-manifest.json`, updating the module key and byte size.

No Presence implementation, `assets/js/core/app.js`, other multiplayer modules, test files, CSS, page markup, PlayerData, Supabase/RPC, wallet, authentication, or service-worker behavior was changed.

## Remaining risks

There is no URL fallback in the existing module; import failures continue to follow the existing promise catch/log path. The moved controller has no compatibility alias at its former path because the known runtime caller and preload now use the new path.

## Git checkpoints

- Implementation commit: `03bd895` (`refactor(pages): extract friendship page`), pushed to `origin/restruktur`.
- This report is committed separately; its commit hash and final Git verification are included in the Phase 18 completion result.
