# Global Restructure — Phase 19: Pet Page Extraction

## Baseline and decision

- Branch: `restruktur`
- Baseline `HEAD` and `origin/restruktur` at preflight: `ca5b35251aa140cb41d980bfd966374499b07cec`
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean at preflight.
- Moved the page controller from `assets/js/pet-page.js` to `assets/js/pages/pet-page.js`.

## Consumers and references audited

- `pet.html` is the only active HTML consumer. Its controller script remains after `pet-viewer.js`.
- The preload manifest contains the page controller path.
- Three tests refer to the controller path: `tests/pet-ui.test.js`, `tests/pet-registry-parity.test.js`, and `tests/pet-catalog.test.js`. Their paths were updated without changing assertions or test behavior.
- No active tools, loader configuration, or documentation directly references the old implementation path. Historical audit documents were left unchanged.
- The seven Pet item manifests contain existing Pet data and asset metadata; no manifest or category index was changed.

## Pet Viewer relationship and script order

`pet.html` loads Item Registry, the seven Pet manifests, the Pet category index, and ItemCatalog before PlayerData and the page services. It then loads the shared application scripts, Three.js, `assets/js/pet-viewer.js`, and finally the Pet Page controller. The existing sequence is unchanged except for the controller `src`.

The page calls `window.PetViewer.select(selected.gameKey)` when drawing a selected Pet. The viewer continues to expose `window.PetViewer.select(id)` and reads Pet SFX metadata from the existing Registry/manifests. The viewer source, Pet assets, category index, and all seven manifests remain unchanged.

The controller remains an IIFE and creates no public global. It continues to use the existing `PlayerData`, `ItemCatalog`, `UT.WalletService`, `UT.AppearanceService`, `UT.Multiplayer`, `UT.Audio`, `UT.Events`, and `UT.LiveSync` APIs. Pet ownership/equip, purchases, account synchronization, and UI event behavior were not changed.

## Relative URLs and dynamic loading

The controller has one relative module import. The existing conditional remains: when `UT.Multiplayer.getClient` is unavailable, `loadMetadata()` imports the multiplayer client. `loadMetadata()` is invoked at page initialization, and import errors continue through the existing metadata error/retry UI path.

- Before relocation: `import('./multiplayer/client.js')` from `assets/js/pet-page.js`.
- After relocation: `import('../multiplayer/client.js')` from `assets/js/pages/pet-page.js`.
- Both resolve to `assets/js/multiplayer/client.js`.

No `document.currentScript`, `import.meta.url`, `new URL()`, or direct `fetch()` path handling is used by the controller. Image and component paths remain document-relative (`assets/ng/pet3d/` and `assets/ng/komponen/`), so their effective URLs are unchanged. The imported client module itself was not moved; its own vendor/config relative imports are unaffected.

## Preload and cache

The preload entry changed from `assets/js/pet-page.js` (15,865 bytes) to `assets/js/pages/pet-page.js` (15,866 bytes, measured from the moved file). Other entries in the Phase 19 baseline manifest are unchanged.

`sw.js` was not changed. The page module is not in the service worker's small `CORE` list; non-media code uses the existing network-first strategy. No cache-version or strategy change was needed.

## Static verification

- Confirmed `pet.html` has one Pet Page script after Three.js and Pet Viewer.
- Compared the complete HTML against baseline with only the controller path normalized; script order is unchanged.
- Compared the moved controller against baseline; its only source change is the relative client import path.
- Resolved the old and new import URLs and confirmed both target `assets/js/multiplayer/client.js`.
- Confirmed all three affected test files differ only by controller path references.
- Confirmed Pet Viewer, the Pet category index, and all seven manifests are unchanged.
- Confirmed the preload path and exact byte size; all other current entries are unchanged.
- Confirmed no current runtime reference remains to `assets/js/pet-page.js`.
- `node --check` passed for the moved controller and three affected test files.
- `git diff --check` passed.
- No test suite or browser test was run.

## Files changed and intentionally untouched

The implementation checkpoint changes six files: the controller move with its one import-path adjustment, `pet.html`, the three tests listed above, and `assets/preload-manifest.json`.

`assets/js/pet-viewer.js`, `assets/js/multiplayer/client.js`, Pet manifests/index, ItemCatalog, PlayerData, wallet/ownership/persistence logic, Supabase/RPC, styles, and `sw.js` were intentionally untouched.

## Remaining risks

There is no URL-base fallback in the controller; conditional import failures continue to follow the existing metadata error and retry path. No compatibility alias was added because all known active callers now use the new path.

## Git verification and checkpoints

The implementation commit is `194c7dacfc2ee219000740d6a4cd467917fd60eb` and was pushed to `origin/restruktur`.

The audit report is committed separately. Its full commit hash and final Git verification are added in the post-commit hash-record update so the report does not contain an incorrect self-referential hash.
