# Global Extraction Phase 25 — FrameAvatar Renderer

## Scope and baseline

- Scope: relocate the existing FrameAvatar helper without changing its implementation or behavior.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `457310626e245bb02f06460ca754d2625d098535`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Module, API, and evaluation

The actual source was `assets/js/frame-avatar.js`; it was moved, with its filename unchanged, to `assets/js/renderers/frame-avatar.js`. The module is a classic-script IIFE, not an ES module. Its source is byte-identical to the baseline.

It publishes `window.FrameAvatar` with the unchanged API:

- `wrap(innerHtml, size, frameId)`
- `mine()`
- `src(frameId)`
- `DEFAULT`
- `GOLD`

At synchronous script evaluation it captures `window.ItemCatalog` and `window.PlayerData`, appends the existing `#frame-avatar-css` style element to `document.head` (inside the existing `try`), and assigns the global API. It does not have a duplicate-load guard; the three HTML consumers each load it once, as before. It adds no event listeners, cache, storage access, or dynamic renderer initialization.

`src()` reads `ItemCatalog.byId(frameId)` and uses the frame item's `image` when it is a frame; otherwise it returns the existing `data/frame/frame-default.webp` fallback. `mine()` reads `PlayerData.equippedId('frame')` and retains its existing default/error fallback. The generated wrapper contains `.fa`, `.fa-in`, and `.fa-img` markup and does not change the supplied inner avatar HTML.

## Consumers and dependencies

All three active HTML script consumers were found and updated:

- `friendship.html`
- `leaderboard.html`
- `room.html`

The FrameAvatar API is called directly by:

- `assets/js/pages/friendship-page.js`: `FrameAvatar.wrap()`.
- `assets/js/pages/leaderboard.js`: `FrameAvatar.mine()` and `FrameAvatar.wrap()`.
- `assets/js/pages/room.js`: `FrameAvatar.mine()` and `FrameAvatar.wrap()` for local, remote, and drawer avatars.

This helper is not only an Inventory consumer; no Inventory page or category loader references it. No dynamic FrameAvatar loader or dynamic import was found. `tests/room-looks.test.js` checks the existing Room wrapper call but does not refer to the script path.

FrameAvatar directly depends on the `ItemCatalog` and `PlayerData` globals captured at evaluation. All three pages load both before FrameAvatar. `ItemCatalog.byId()` is the source for frame kind/image metadata; FrameAvatar does not access `ItemRegistry` directly. No separate `FrameData` or `FrameCatalog` global/module was found; the existing frame metadata path remains through ItemCatalog and its existing registry/legacy behavior.

FrameAvatar does not call `FrameFX` directly. It supplies frame image paths and the `.fa-img` class consumed by FrameFX. FrameFX scans `img[src*="data/frame/"]`, replaces matching images with canvases, and recognizes `.fa-img` for its existing lightweight avatar rendering. `frame-fx.js` remains before FrameAvatar in all three pages. Its existing DOMContentLoaded scan, MutationObserver, and animation loop are unchanged.

The helper does not import or call CharacterFace or ItemArt. Room composes CharacterFace-produced HTML with `FrameAvatar.wrap()` at the existing call site; the wrapper treats that HTML as input. FrameFX is the only renderer-level integration found.

## URL and loading behavior

The module contains no static/dynamic imports, `document.currentScript`, `import.meta.url`, `new URL()`, or `fetch()`. `ItemCatalog` image paths and the hard-coded default path are resolved by the containing document, not relative to the helper script. The move therefore preserves their effective URLs.

All three HTML script sequences are unchanged except for the FrameAvatar `src`. The existing order of ItemCatalog, PlayerData, FrameFX, FrameAvatar, and page consumers remains intact. No Splash prefetch or other active loader path references this helper.

## Preload, service worker, tests, and files

`assets/preload-manifest.json` contained `assets/js/frame-avatar.js` at 1,971 bytes. It now contains `assets/js/renderers/frame-avatar.js` at 1,971 bytes, matching the moved file; all other entries are unchanged.

No explicit FrameAvatar path exists in `sw.js`; it was not changed.

The affected test is `tests/leaderboard-ui.test.js`, which checks that FrameFX loads before FrameAvatar. Only its path assertion was updated. No other test, fixture, or configuration contains the old path.

Implementation files changed:

- `assets/js/frame-avatar.js` → `assets/js/renderers/frame-avatar.js` (100% rename; no content change).
- `friendship.html`, `leaderboard.html`, and `room.html` (script `src` only).
- `assets/preload-manifest.json` (path only; size remains 1,971 bytes).
- `tests/leaderboard-ui.test.js` (path assertion only).

Intentionally unchanged: FrameFX, frame manifests/data, ItemCatalog, ItemRegistry, CharacterFace, ItemArt, PlayerData, all consumer implementations, `tests/room-looks.test.js`, UI/CSS, and `sw.js`. Historical audit documents mentioning the old path were left unchanged.

## Static verification

- No old `assets/js/frame-avatar.js` path remains in active source, HTML, tests, or configuration. Historical audit files retain their original references.
- All three HTML consumers load the new path exactly once. Their external-script sequences match the baseline after substituting only the new path; ItemCatalog, PlayerData, and FrameFX remain earlier.
- Direct API consumers were checked across the repository; no Inventory-only assumption or dynamic loader was found.
- FrameAvatar source is byte-identical to baseline: 1,971 bytes.
- The affected test changed only its path assertion.
- Preload JSON parses, the old key is absent, the new entry is 1,971 bytes, and all other entries are unchanged.
- `node --check` passed for `assets/js/renderers/frame-avatar.js` and `tests/leaderboard-ui.test.js`.
- `git diff --check` and staged diff checks passed.
- Test suites and browser tests were not run, as required during extraction.

No unresolved relocation risk was found. The existing wrapper markup, FrameFX observation behavior, defaults, and evaluation order are preserved.

## Git checkpoints and verification

- Preflight baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- Implementation commit: `c95f4a0d1441848a1ff7b215a41808ad204c1f7d`; pushed to `origin/restruktur`.
- Audit report creation commit: `7bba1e89310ddad3279c6ba3eb98e6606f8cbdab`; pushed to `origin/restruktur`.
- Verified after pushing the audit commit: `HEAD` and `origin/restruktur` both `7bba1e89310ddad3279c6ba3eb98e6606f8cbdab`; worktree clean; branch `restruktur`.
- `main` and `origin/main` both remain `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `git ls-remote origin refs/heads/restruktur refs/heads/main` returned `7bba1e89310ddad3279c6ba3eb98e6606f8cbdab` for `restruktur` and `aeb11acf130df4ade4acc9417f01470e40a33dbb` for `main`.
- `git merge-base --is-ancestor` confirmed implementation commit `c95f4a0d1441848a1ff7b215a41808ad204c1f7d` and audit commit `7bba1e89310ddad3279c6ba3eb98e6606f8cbdab` are available on `origin/restruktur`.
- A report-only follow-up records the audit hash and this verification snapshot. Its own hash is reported in the phase completion message because a commit cannot include its own hash in its tree.
