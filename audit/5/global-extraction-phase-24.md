# Global Extraction Phase 24 — CharacterView Renderer

## Scope and baseline

- Scope: relocate the existing CharacterView helper into the renderer domain without changing its code or runtime behavior.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `b7939a95321a908ee4c79bdd05e4932f79da551f`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Module, API, and dependencies

The actual source was `assets/js/character-view.js`; it was moved, without renaming, to `assets/js/renderers/character-view.js`. The module is a classic-script IIFE, not an ES module, and its content is byte-identical to the baseline.

It publishes the existing `UT.CharacterView` global, guarded against duplicate initialization. Its public surface is unchanged:

- `make(THREE, skinIdOrKey, emote)`
- `keyOf(skinIdOrKey)`
- `SCALE`
- `emotes`

`make()` returns a `THREE.Group` with the existing `userData.anim()` and `userData.setEmote()` callbacks. The renderer reads `UT.CharacterData` at call time (`get('player', key)` and `mesh(...)`); Three.js is supplied as an argument. Unknown keys continue to fall back to Steve, and missing character data continues to return the existing inert stub group.

CharacterView is a separate CharacterData-based articulated renderer, not a wrapper around `BlockyCharacter`. The only active API consumer found is `assets/js/pages/tambang.js`. Its existing priority is preserved:

- `makeMiner()` uses `UT.BlockyCharacter` when available.
- Only when `UT.BlockyCharacter` is unavailable does it call `UT.CharacterView.make(...)`.
- The island mount guard continues to accept either renderer.

In `tambang.html`, Three.js and CharacterData load before CharacterView; BlockyCharacter loads afterward but before `pages/tambang.js`, preserving the normal BlockyCharacter-first route and the CharacterView fallback if BlockyCharacter is unavailable. CharacterView itself does not directly reference `BlockyCharacter`, `CharacterFace`, `PlayerData`, or `ItemCatalog`; it also has no direct dependency on CharacterView-related visual helpers. The `.gameKey` input form is documented and continues to be handled by the existing `keyOf()` implementation.

## Consumers and loading

The three synchronous HTML script consumers were updated:

- `room.html`
- `tambang.html`
- `profile.html`

Their external-script sequences are unchanged apart from the CharacterView `src`. The runtime API search found only `pages/tambang.js` as a direct caller; Room and Profile load the classic script but their current page code does not call `UT.CharacterView`.

No dynamic CharacterView loader or dynamic import was found. The Room page's JavaScript dynamic loader loads CharacterFace, not CharacterView; it was not changed. `assets/js/pages/splash.js` has an additional `ASSETS` prefetch entry, updated to the new path. `UT_Preload.runAuto()` fetches assets and the preload manifest; it does not evaluate the prefetched script.

CharacterView has no static/dynamic imports, `document.currentScript`, `import.meta.url`, `new URL()`, or `fetch()`. It has no module-relative asset URLs. HTML and prefetch paths remain document-root-relative and target the same resource after the move.

## Evaluation, side effects, and cache

Evaluation remains synchronous at the same script position. The IIFE initializes `window.UT` if needed, returns if `UT.CharacterView` already exists, and otherwise installs the API. It does not create a renderer, touch storage, add event listeners, or initialize a cache at evaluation. There is no module cache or listener behavior to relocate. Rendering and animation remain on the existing `make()` call path; their implementation was not edited.

## Preload, service worker, tests, and files

`assets/preload-manifest.json` contained the old path at 11,810 bytes. The entry now uses `assets/js/renderers/character-view.js` and remains 11,810 bytes, matching the moved file. The JSON is valid and every other entry is unchanged.

No explicit CharacterView path exists in `sw.js`; it was not changed.

No test, fixture, or test configuration references `character-view.js` or `UT.CharacterView`; no tests were changed. The `tools/character-data/template.js` and generated `assets/js/character-data.js` comments mention the helper by its unchanged basename when describing partial-box geometry, not as a load path, so they remain accurate.

Implementation files changed:

- `assets/js/character-view.js` → `assets/js/renderers/character-view.js` (100% rename; no content change).
- `room.html`, `tambang.html`, and `profile.html` (script `src` only).
- `assets/js/pages/splash.js` (prefetch path only).
- `assets/preload-manifest.json` (path only; size remains 11,810 bytes).

Intentionally unchanged: `assets/js/pages/tambang.js` and its BlockyCharacter-first fallback, CharacterData, BlockyCharacter, CharacterFace, PlayerData, ItemCatalog, other renderers, consumer logic, UI/CSS, tests, tools, and `sw.js`. Historical audit documents that mention the former path were left unchanged.

## Static verification

- No old `assets/js/character-view.js` path remains in active source, HTML, tests, or configuration. Historical audit files retain their original references.
- All three HTML consumers use the new path exactly once. Their external-script sequences match the baseline after substituting only the new path.
- Tambang's dependency order remains Three.js → CharacterData → CharacterView → BlockyCharacter → Tambang page controller. Its runtime priority/fallback implementation is byte-identical to the baseline.
- Splash prefetch content is unchanged apart from the path.
- Moved module content is byte-identical: 11,810 bytes.
- Preload JSON parses, the old key is absent, the new entry is 11,810 bytes, and all other entries are unchanged.
- `node --check` passed for `assets/js/renderers/character-view.js` and `assets/js/pages/splash.js`.
- `git diff --check` and staged diff checks passed.
- Test suites and browser tests were not run, as required during extraction.

No unresolved relocation risk was found. Full visual and behavioral testing remains deferred until all global extraction phases are complete.

## Git checkpoints and verification

- Preflight baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- Implementation commit: `b2c7c9fac3cd239e91092795fc7d3cfbad90234d`; pushed to `origin/restruktur`.
- Audit report creation commit: `91dfb66296fd23ea003cc898f0a4e85efd49082b`; pushed to `origin/restruktur`.
- Verified after pushing the audit commit: `HEAD` and `origin/restruktur` both `91dfb66296fd23ea003cc898f0a4e85efd49082b`; worktree clean; branch `restruktur`.
- `main` and `origin/main` both remain `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `git ls-remote origin refs/heads/restruktur refs/heads/main` returned `91dfb66296fd23ea003cc898f0a4e85efd49082b` for `restruktur` and `aeb11acf130df4ade4acc9417f01470e40a33dbb` for `main`.
- `git merge-base --is-ancestor` confirmed implementation commit `b2c7c9fac3cd239e91092795fc7d3cfbad90234d` and audit commit `91dfb66296fd23ea003cc898f0a4e85efd49082b` are available on `origin/restruktur`.
- A report-only follow-up records the audit hash and this verification snapshot. Its own hash is reported in the phase completion message because a commit cannot include its own hash in its tree.
