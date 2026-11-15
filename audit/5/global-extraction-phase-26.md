# Global Extraction Phase 26 — AuraView Renderer

## Scope and baseline

- Scope: relocate the existing AuraView helper into `assets/js/renderers/` without changing its behavior.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `1c3fa433dcbd9d2e80d87e0993f32d52e53ab4ea`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Module, API, and evaluation

The actual source was `assets/js/aura-view.js`. It was moved, retaining its filename, to `assets/js/renderers/aura-view.js`. Its implementation is unchanged; the source header comment was updated to name the new path.

AuraView is a classic-script IIFE, not an ES module. It retains the duplicate-load guard and installs the same `window.UT.AuraView` global. Its public API remains:

- `equippedKey()`
- `keyFromEquipped(eq)`
- `quality()`
- `create(scene, camera, opts)`, returning a controller with `set`, `only`, `clear`, `clearAll`, `update`, `has`, and the `system` getter.

Evaluation initializes `window.UT` if needed, returns early if `UT.AuraView` already exists, and assigns the API. It registers no events or observers and creates no module-global cache. Each controller retains its own lazy `AuraSystem` reference and root/item list; the engine is created on first applicable `set()` call.

## Consumers and dependencies

All four active HTML script consumers were updated:

- `lobby.html`
- `profile.html`
- `gameplay.html`
- `karakter.html`

The API is called by:

- `assets/js/pages/lobby.js`: `create()`, `only()`, and `equippedKey()`.
- `assets/js/pages/profile.js`: `create()`, `only()`, and `equippedKey()`.
- `assets/js/pages/karakter.js`: `equippedKey()` and `create()`; the returned controller is updated and cleared as before.
- `gameplay/js/main.js`: `quality()`, `create()`, `keyFromEquipped()`, and `equippedKey()`.

All consumers continue to use the same `UT.AuraView` global. No consumer implementation or dynamic loader was changed. No dynamic import or other active loader path was found.

AuraView is an adapter, not the aura-effect engine. It resolves equipped item IDs through `ItemCatalog`, reads equipment/settings through `PlayerData`, validates game keys against `UT.AuraFX.AURAS`, and lazily creates `UT.AuraFX.AuraSystem` using `THREE`. AuraFX continues to own the effect catalog and engine. The AuraFX-before-AuraView relationship and all other script dependencies remain unchanged. AuraView does not directly depend on AuraData, CharacterFace, ItemArt, or another renderer.

The helper has no imports/exports, `document.currentScript`, `import.meta.url`, `new URL()`, or `fetch()` calls. The move therefore does not alter any module-relative asset resolution. It retains its existing safe behavior when the AuraFX engine or WebGL/THREE is unavailable.

## Path references, preload, and other files

`data/inventory/aura/index.js` contains the category `assets.view` locator. It was retargeted to `assets/js/renderers/aura-view.js` so the registered asset pointer does not remain stale. This is a path-only locator change; aura item manifests/data, the category behavior, and the ItemRegistry and ItemCatalog implementations were not changed.

`assets/preload-manifest.json` changed its entry from `assets/js/aura-view.js` at 4,365 bytes to `assets/js/renderers/aura-view.js` at the moved file's actual size of 4,375 bytes. The 10-byte difference is solely the longer source-header path; all other preload entries are unchanged.

The AuraView test harness and script-order assertions in `tests/aura-view.test.js`, and the AuraFX-before-AuraView assertion in `tests/aura-registry-parity.test.js`, were updated only to use the new path.

Changed files:

- `assets/js/aura-view.js` → `assets/js/renderers/aura-view.js`.
- `lobby.html`, `profile.html`, `gameplay.html`, and `karakter.html` (script path only).
- `data/inventory/aura/index.js` (`assets.view` path only).
- `assets/preload-manifest.json` (path and actual byte count).
- `tests/aura-view.test.js` and `tests/aura-registry-parity.test.js` (path references only).

Intentionally unchanged: `assets/js/aura-fx.js`, aura item manifests and effect data, `assets/js/core/item-registry.js`, ItemCatalog, PlayerData, CharacterFace, ItemArt, FrameFX, all runtime consumer implementations, UI, and `sw.js`. Historical audit reports that document the former path were left unchanged.

## Static verification

- No active source, HTML, test, or configuration reference to the old `assets/js/aura-view.js` path remains. Two historical audit reports retain the old path as historical evidence.
- The external script sequence in all four HTML consumers matches the baseline after substituting only the new AuraView path. AuraFX remains before AuraView, and each page includes the new helper once.
- The AuraView source differs from the original only in its path comment; its public API, initialization, controller lifecycle, fallbacks, and effects are unchanged.
- The category index differs only in the `assets.view` locator. Test changes are limited to module/load paths and the path-order assertion.
- Preload JSON parses, the old key is absent, the new entry matches the exact 4,375-byte file, and all other entries are unchanged.
- `node --check` passed for `assets/js/renderers/aura-view.js`, `data/inventory/aura/index.js`, `tests/aura-view.test.js`, and `tests/aura-registry-parity.test.js`.
- `git diff --check` passed.
- Test suites and browser tests were not run, as required for this extraction phase.

No unresolved relocation risk was found.

## Git checkpoints and verification

- Implementation commit: `b1dde7a33464af6f772f592e1fdf4934be928377`; pushed to `origin/restruktur`.
- Audit commit: `f6776773925bf387a8ee7369dc8599a4ac2b889c`; pushed to `origin/restruktur`.
- After the audit push, `HEAD` and `origin/restruktur` both pointed to `f6776773925bf387a8ee7369dc8599a4ac2b889c`; the worktree was clean.
- `main` and `origin/main` remain `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `git ls-remote origin refs/heads/restruktur refs/heads/main` returned `f6776773925bf387a8ee7369dc8599a4ac2b889c` for `restruktur` and the unchanged baseline for `main`.
- Both the implementation and audit commits are ancestors of `origin/restruktur`.
- The report-only follow-up commit hash and final post-follow-up synchronization are reported in the phase completion message; a commit cannot include its own hash in its tree.
