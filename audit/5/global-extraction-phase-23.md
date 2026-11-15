# Global Extraction Phase 23 — CharacterFace Renderer

## Scope and baseline

- Scope: relocate the existing CharacterFace helper to the renderer domain without changing rendering behavior.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `dd21ea888eca29d6965f15ff19a341c13965acab`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Module and loading pattern

The helper was found at `assets/js/character-face.js` and moved, with its filename preserved, to `assets/js/renderers/character-face.js`. It is a synchronous classic-script IIFE, not an ES module; it has no imports or exports. The only edit inside the helper updates its source-path comment.

The module exposes the existing `UT.CharacterFace` global with the same API:

- `url()`
- `urlPreset(n)`
- `urlData(data)`
- `html(className)`
- `mount(element, fallback)`
- `watch(callback)`

At evaluation it initializes `window.UT` if needed and returns early if `UT.CharacterFace` already exists. Otherwise it installs the API and creates closure state. WebGL renderer/scene/camera initialization is deferred until a render is requested.

## Consumers and dependencies

The five synchronous HTML consumers were found and updated:

- `gameplay.html`
- `friendship.html`
- `leaderboard.html`
- `lobby.html`
- `profile.html`

Each loads the helper once. The existing external-script sequence is unchanged except for the helper's `src`. In every page, `ItemCatalog`, `PlayerData`, Three.js, and `BlockyCharacter` remain earlier in the sequence.

`assets/js/pages/room.js` is the additional dynamic loader. `loadFace()` inserts scripts in order: Three.js, `blocky-character.js`, then CharacterFace. It is invoked by Room initialization once. The loader's new `e.src` remains document-root-relative from `room.html`; only its target path changed.

All API consumers were checked:

- `assets/js/pages/lobby.js`: `mount()` and `watch()`.
- `assets/js/pages/profile.js`: `html()` and `watch()`.
- `assets/js/pages/friendship-page.js`: `urlData()`.
- `assets/js/pages/leaderboard.js`: `html()` and `urlData()`, with its existing fallback.
- `assets/js/pages/room.js`: `html()`, `urlData()`, and `watch()`.
- `gameplay/js/main.js`: `url()`, `urlPreset()`, and `urlData()`.

The helper directly uses `window.THREE`, `UT.BlockyCharacter`, and `window.PlayerData`. `BlockyCharacter` uses `ItemCatalog` and `PlayerData` when creating/rendering a character; those globals remain available before CharacterFace is evaluated or invoked. CharacterFace and BlockyCharacter have no direct `CharacterData` or `CharacterView` reference. No direct CharacterFace dependency on other visual helpers was found.

## URLs, evaluation, and side effects

CharacterFace has no static/dynamic imports, `document.currentScript`, `import.meta.url`, `new URL()`, or `fetch()`. It creates a canvas render and returns a PNG data URL; it does not resolve assets relative to its script file. The move therefore does not change any asset URL.

Evaluation preserves the existing idempotency guard and timing. Evaluation itself does not create the WebGL renderer or add event listeners. Rendering lazily creates/reuses the renderer and caches successful PNG output in the private cache, capped at 24 entries. `watch()` subscribes to the same PlayerData events (`equip`, `pageshow`, `storage`, and `server-appearance`) and adds the same persisted-`pageshow` listener when the existing consumers call it. The API call sites and number/order of script evaluations remain unchanged. The cache, renderer lifecycle, event behavior, and fallback behavior were not edited.

## Preload, service worker, tests, and files

`assets/preload-manifest.json` contained the old path at 4,408 bytes. It now contains `assets/js/renderers/character-face.js` at 4,418 bytes, matching the moved file; the 10-byte increase is only the updated source-path comment. The JSON remains valid and every other preload entry is unchanged.

No explicit CharacterFace path exists in `sw.js`; it was not changed.

The only affected test reference is the script-order assertion in `tests/blocky-actions.test.js`; it now checks the new full path. The assertion and test behavior are unchanged. `tests/room-looks.test.js` checks the existing API/Room behavior and did not need a path change. No other test, fixture, or active configuration reference was found.

Implementation files changed:

- `assets/js/character-face.js` → `assets/js/renderers/character-face.js` (path comment only).
- `gameplay.html`, `friendship.html`, `leaderboard.html`, `lobby.html`, and `profile.html` (script `src` only).
- `assets/js/pages/room.js` (dynamic script path only).
- `assets/preload-manifest.json` (path and actual byte size).
- `tests/blocky-actions.test.js` (script-order path assertion only).

Intentionally unchanged: `CharacterData`, `CharacterView`, `BlockyCharacter`, `PlayerData`, `ItemCatalog`, other renderer modules, consumer logic, UI/CSS, and `sw.js`. Historical audit documents that mention the former path were left as historical records.

## Static verification

- No old `assets/js/character-face.js` path remains in active source, HTML, tests, or configuration. Historical audit files retain their original references.
- All five HTML consumers use the new path exactly once. Their external-script sequences match the baseline after substituting only the new path; dependencies remain before CharacterFace.
- The Room loader and CharacterFace source match their baseline contents except for the path string/comment, after normalizing checkout line endings.
- The affected test differs only in the path assertion.
- Preload JSON parses, the old key is absent, the new entry is 4,418 bytes, and all other entries are unchanged.
- `node --check` passed for `assets/js/renderers/character-face.js`, `assets/js/pages/room.js`, and `tests/blocky-actions.test.js`.
- `git diff --check` and staged diff checks passed.
- Test suites and browser tests were not run, as required during extraction.

No unresolved relocation risk was found. Full visual and behavioral testing remains deferred until all global extraction phases are complete.

## Git checkpoints and verification

- Preflight baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- Implementation commit: `21a1f495e3f8d5d3d17c6c829d9e80d4f1143221`; pushed to `origin/restruktur`.
- Audit report creation commit: `3400d8becb56ac90c9e1799aeac05b1046cfc8db`; pushed to `origin/restruktur`.
- Verified after pushing the audit commit: `HEAD` and `origin/restruktur` both `3400d8becb56ac90c9e1799aeac05b1046cfc8db`; worktree clean; branch `restruktur`.
- `main` and `origin/main` both remain `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `git ls-remote origin refs/heads/restruktur refs/heads/main` returned `3400d8becb56ac90c9e1799aeac05b1046cfc8db` for `restruktur` and `aeb11acf130df4ade4acc9417f01470e40a33dbb` for `main`.
- `git merge-base --is-ancestor` confirmed implementation commit `21a1f495e3f8d5d3d17c6c829d9e80d4f1143221` and audit commit `3400d8becb56ac90c9e1799aeac05b1046cfc8db` are available on `origin/restruktur`.
- A report-only follow-up records the audit hash and this verification snapshot. Its own hash is reported in the phase completion message because a commit cannot include its own hash in its tree.
