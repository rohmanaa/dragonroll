# Global Extraction Phase 14 — Appearance Service Assessment & Extraction

## Git baseline

- Branch: `restruktur`
- Starting `HEAD` and `origin/restruktur`: `be24017a78ab2a289015b53c6d77eead7aa49e9b`
- `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before this phase.
- Source: `assets/js/appearance-service.js`; target did not exist before extraction.

## Dependency and API audit

The classic-script UMD module publishes `UT.AppearanceService` in the browser and `module.exports` for Node. Its public factory remains `{ create, get }`. The service instance exposes `enabled`, `refresh`, `refreshThrottled`, `saveOutfit`, `renameOutfit`, `deleteOutfit`, `pushAppearance`, `roomAppearance`, `usersAppearance`, and `autoSync`.

The service receives `PlayerData` and `getClient` through its dependency object. It reads `PlayerData.serverMode()`, `appearance()`, and `subscribe()`, and mirrors server results through `applyServerWallet`, `applyServerAppearance`, and `applyServerOutfits`. Its appearance payload is passed through as the existing `look`, `equipped`, and `gearDye` structure; optional equipment slots, including Gear/Aura/Pet slots supplied by PlayerData, are not remapped. It does not change `skin.*` IDs or validate item ownership itself.

There is no direct service dependency on ItemCatalog, ItemRegistry, a Character Registry, CharacterView, or BlockyCharacter. PlayerData remains the client mirror and existing catalog/registry and renderer code remains responsible for item identity and display. Callers use the returned appearance data for their existing CharacterView/BlockyCharacter flows.

The service uses the existing lazy `UT.Multiplayer.getClient()` client and RPC calls: `inventory_get`, `appearance_get`, `appearance_save`, `outfit_list`, `outfit_save`, `outfit_rename`, `outfit_delete`, `appearance_get_many`, and `room_appearance_get`. RPC names, arguments, validation authority, endpoints, and synchronization behavior were not changed. `autoSync()` subscribes to PlayerData `equip` changes and retains its 700 ms debounce. `refreshThrottled()` retains the `sessionStorage` key `ut:app-sync`.

## Path and initialization audit

The module captures `document.currentScript.src` and resolves the lazy import with `new URL(...)`. It does not use `import.meta.url` or call `fetch` directly. Before the move, `multiplayer/client.js` resolved to `assets/js/multiplayer/client.js`; the moved script uses `../multiplayer/client.js` when `SELF` is present, preserving that exact URL. The fallback branch without `document.currentScript` retains the previous `multiplayer/client.js` specifier and page URL base. Keeping the client URL unchanged also preserves its vendor and configuration import URLs.

Nine root HTML pages load the service: `efek.html`, `friendship.html`, `gameplay.html`, `karakter.html`, `leaderboard.html`, `lobby.html`, `pet.html`, `profile.html`, and `room.html`. All load `PlayerData` before Appearance Service. The module automatically creates its singleton and attaches `autoSync()` when evaluated, so this order is significant; each script tag was updated in place without changing order.

Runtime API call sites include `assets/js/friendship-page.js`, `assets/js/pet-page.js`, `assets/js/pages/{efek,karakter,leaderboard,lobby,profile,room}.js`, and `gameplay/js/main.js`. They continue to use the same `UT.AppearanceService.get()` instance and methods, including throttled refresh, Outfit operations, remote appearance reads, and appearance pushes.

## Other references and cache behavior

- Updated path references in `tests/appearance-service.test.js`, `tests/frame-catalog-integration.test.js`, `tests/lobby-appearance.test.js`, `tests/pet-registry-parity.test.js`, and `tests/room-looks.test.js`.
- Updated the current implementation link in `audit/5/stage-8.1-character-architecture-design.md`. Other audit/design documents retain historical paths as evidence of their original state.
- `tools/blocky-character/template.js` documents the `roomAppearance` data contract but does not refer to the source path; it was unchanged.
- Updated `assets/preload-manifest.json` from `assets/js/appearance-service.js` (10,382 bytes) to `assets/js/services/appearance-service.js` (10,418 bytes).
- `sw.js` has no Appearance Service core-precache entry and uses network-first for code, caching responses by request URL. No service-worker or cache-version change was necessary.

## Decision and changes

**The extraction was safe and completed.** The source moved to `assets/js/services/appearance-service.js`. The only source change adjusts the script-relative client import while preserving both the browser URL and the no-`currentScript` fallback. All known HTML, test, preload, and current documentation-link references were updated. The global API, singleton initialization, and script order remain unchanged.

No PlayerData, ItemCatalog/ItemRegistry, Character, Gear, Outfit, Aura, renderer, Supabase/RPC, or synchronization logic was changed.

## Static verification

- Verified all nine HTML script targets resolve and `PlayerData` precedes Appearance Service.
- Verified the source differs from its original only in the adjusted client-import path and the effective URL is unchanged.
- Verified each HTML file, the five test files, and the documentation link differ only in their intended path references.
- Verified the preload key/size and that all other preload entries are unchanged.
- `git diff --cached --check` and `node --check` for the moved source and five updated test files passed.
- No test suite or browser test was run.

## Checkpoint and remaining risks

- Implementation commit: `a6e8c76fdfcd2e473fe1b816c691c481c9f3f5f9` (`refactor(js): relocate appearance service`), pushed separately before this audit commit.
- The audit is committed separately and pushed after this report is added.
- External integrations could still have hard-coded the former source URL.
- Test suites and browser behavior remain unverified, as required by this phase.
- Final `HEAD == origin/restruktur`, clean worktree, and unchanged `main` are verified after the audit push.
