# Global Extraction Phase 22 — ItemArt Renderer

## Scope and baseline

- Scope: relocate the existing ItemArt helper without renaming or changing its implementation.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `a3e2e8fc9a0c2200b8d6af3a0041001834f41fd9`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Module and loading pattern

The module was found at `assets/js/item-art.js` and moved to `assets/js/renderers/item-art.js` with its filename unchanged. It is a synchronous classic-script IIFE, not an ES module: it has no `import`/`export` and assigns `window.ItemArt` once per evaluation.

The existing public global API was preserved without modification:

`character`, `face`, `frame`, `dice`, `theme`, `powerup`, `aura`, `forItem`, `palette`, `textureUrl`, `loadSkinTexture`, `resolveSkinId`, and `makeSkinTexture`.

At evaluation, the module captures `window.ItemCatalog`, initializes its definitions and private `texCache`, and installs `window.ItemArt`. The cache stores texture-loading promises keyed by skin ID; it remains private to that script evaluation. The module registers no events and reads/writes no local or session storage.

## Consumers and dependencies

All ten HTML script consumers were found and updated. Each loaded the classic script exactly once; `ItemCatalog` remains earlier in the script sequence:

- `dadu.html`
- `efek.html`
- `frame.html`
- `gameplay.html`
- `friendship.html`
- `lobby.html`
- `mode.html`
- `powerup.html`
- `profile.html`
- `room.html`

The complete external-script sequence of each page is unchanged apart from the ItemArt `src`. The pages' later consumers still execute after the ItemArt script. `mode.html` and `room.html` load `CharacterData` after ItemArt, but the optional `UT.CharacterData` lookup occurs when rendering is called, after those scripts load. `PlayerData` is also only consulted by render methods when invoked; it is not required at ItemArt evaluation.

Direct API consumers include:

- `assets/js/pages/dadu.js`: `ItemArt.dice`.
- `assets/js/pages/efek.js`: `ItemArt.aura`.
- `assets/js/pages/frame.js`: `ItemArt.frame`.
- `assets/js/pages/powerup.js`: `ItemArt.powerup` fallback.
- `assets/js/pages/lobby.js` and `assets/js/pages/profile.js`: `ItemArt.face`.
- `assets/js/pages/room.js`: `ItemArt.character`, `dice`, and `theme`.
- `gameplay/js/main.js`: `window.ItemArt.loadSkinTexture` and `makeSkinTexture`.

`ItemArt` consumes `ItemCatalog` methods (`byId`, `fallbackSkinId`, and `skinTexture`) and item fields supplied by the existing catalog/manifest chain. It does not access `ItemRegistry` directly. `ItemCatalog` is present before ItemArt on every HTML consumer; registry/index/manifest order was not changed. `PlayerData` is consulted by the `frame` renderer at call time. No ItemCatalog, Registry, PlayerData, or item manifest files were changed.

`inventory.html` does not load ItemArt itself. `assets/js/pages/inventory.js` creates per-category iframes for `frame.html`, `dadu.html`, `efek.html`, and `powerup.html`; those existing child pages load ItemArt once each. `shop.html` and its controller do not directly load or call ItemArt. `friendship.html` and `mode.html` load the helper but no direct API call was found in their page controllers.

No test, fixture, or test configuration refers to `item-art.js` or `ItemArt`; no tests were changed. The `splash.js` preloader's `ASSETS` list is an additional active loader reference and was updated. It prefetches response bytes through `UT_Preload`; it does not evaluate the script. `assets/preload-manifest.json` was also updated. No explicit ItemArt path exists in `sw.js`, so the service worker was not changed.

Active path comments in `assets/js/character-data.js`, `tools/character-data/template.js`, and `gameplay/js/skin-uv.js` now point to the new location. Historical audit records were left unchanged.

## Relative URLs and data dependencies

The module contains no static/dynamic imports, `document.currentScript`, `import.meta.url`, or `new URL()`. Its PNG validation may call `fetch(url)` and assign `img.src = it.texture`; the URL comes from `ItemCatalog.skinTexture()`/the catalog item, not from the renderer script location. `ItemCatalog.validTexturePath()` accepts only simple relative `.png` paths and rejects schemes, drive paths, spaces, and `..`. Item `icon` and `image` URLs likewise come from the catalog and are resolved by the document. Since the module remains a classic script and the page URLs do not change, moving it does not change those effective URL bases.

Current catalog/character data has no active PNG-renderer texture entries; the existing texture loader remains unchanged for any valid catalog entry. The module's source was kept byte-identical, so all fallback, image loading, cache behavior, and rendering results remain unchanged.

## Files changed

Implementation checkpoint:

- `assets/js/item-art.js` → `assets/js/renderers/item-art.js` (100% rename; no content change).
- The ten HTML consumers listed above (script path only).
- `assets/js/pages/splash.js` (prefetch path only).
- `assets/preload-manifest.json` (path only; size remains 23,445 bytes).
- `assets/js/character-data.js`, `tools/character-data/template.js`, and `gameplay/js/skin-uv.js` (active path comments only).

Audit checkpoint:

- `audit/5/global-extraction-phase-22.md`.

Intentionally unchanged: `ItemCatalog`, ItemRegistry, all manifests/indexes, PlayerData, Shop, Inventory, consumer implementations, CSS/UI, tests, `sw.js`, and historical audit notes.

## Static verification

- Renderer source is byte-identical: 23,445 bytes; SHA-256 `2BD89EFE9E32EFFF5B517B1D9C732990C2BC0C996F865B2F35C7FAA10ADE9152`.
- All ten HTML consumers load the new path exactly once; each still loads ItemCatalog first and preserves its complete external-script sequence.
- Active splash prefetch and active documentation path references were updated. No old path remains in active source, loader, or consumer HTML; remaining matches are historical audit records.
- Preload JSON parses; only the ItemArt key changed; `assets/js/renderers/item-art.js` is listed as `23445`, matching the file size. All other entries are unchanged.
- Tests contain no ItemArt path/API reference and were not modified.
- `node --check` passed for `assets/js/renderers/item-art.js`, `assets/js/pages/splash.js`, `assets/js/character-data.js`, and `gameplay/js/skin-uv.js`.
- `tools/character-data/template.js` is intentionally not standalone JavaScript (`DATA`, `META`, and `SEATS` are generator placeholders); it compiled successfully after substituting those placeholders.
- `git diff --check` and staged `git diff --cached --check` passed.
- Test suite and browser tests were not run, as required for the extraction phase.

No unresolved relocation risk was found. Full visual and behavioral testing remains deferred until the global extraction phases are complete.

## Git checkpoints and verification

- Implementation commit: `983bf97bb075108ac9b5d003a47b7205ba2242f8`; pushed to `origin/restruktur`.
- Audit report creation commit: `9752afd0c209cec6f154eec5d95d3929b61dcda2`; pushed to `origin/restruktur`.
- Verified immediately after pushing the audit commit: `HEAD` and `origin/restruktur` both `9752afd0c209cec6f154eec5d95d3929b61dcda2`; worktree clean; branch `restruktur`.
- `main` and `origin/main` both remain `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `git ls-remote origin refs/heads/restruktur refs/heads/main` returned `9752afd0c209cec6f154eec5d95d3929b61dcda2` for `restruktur` and `aeb11acf130df4ade4acc9417f01470e40a33dbb` for `main`.
- `git merge-base --is-ancestor` confirmed both implementation commit `983bf97bb075108ac9b5d003a47b7205ba2242f8` and audit commit `9752afd0c209cec6f154eec5d95d3929b61dcda2` are available on `origin/restruktur`.
- A report-only follow-up records this audit commit and verification snapshot. Its final hash is reported in the completion message because a commit cannot include its own hash in its tree.
