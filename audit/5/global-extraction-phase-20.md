# Global Extraction Phase 20 — Shop Page

## Scope and baseline

- Scope: relocate only the Shop page controller and update required references.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `f983c27e1a20a84ffacfe6da66fb7d9af675e08e`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Consumer and dependency audit

Active references found before implementation:

| Consumer | Use |
| --- | --- |
| `shop.html` | Loads the controller once, after the shared script stack and `UT.App.init({page:'shop'})`. |
| `tests/shop-render.test.js` | Reads the controller and asserts the page's controller script path. |
| `assets/preload-manifest.json` | Contains the controller's preload path and byte size. |

Repository search found no other runtime, loader, or configuration consumers. Historical audit notes in `audit/5/` mention the former path; they were left intact as historical records.

The controller is a classic-script IIFE and exports no global. Its direct dependencies are:

- `window.PlayerData`: `settings`, `serverMode`, `walletReady`, `gems`, `coins`, `addCurrency`, and `subscribe`.
- `UT.WalletService`: `get()` and the returned wallet's `history(20)`, `exchange(index)`, and `refresh()`.
- `UT.Audio.play`, `UT.Events.on('currencyChanged', ...)`, and `UT.LiveSync.add/start`.
- The existing Shop DOM and browser globals (`location`, `URLSearchParams`, `requestAnimationFrame`, event listeners, and timers).
- `UT.App.init({page:'shop'})` is called by the existing inline script before the controller.

The controller does not directly reference `ItemCatalog`, `UT.ItemRegistry`, Inventory, `AppearanceService`, or other item ownership/equip APIs. The Shop page's existing registry, manifest, index, and catalog scripts remain in place and in their original order.

## Relocation and compatibility

- Moved `assets/js/shop-page.js` to `assets/js/pages/shop-page.js`.
- Updated the single active HTML script reference in `shop.html`.
- Updated the controller read path and script-path assertion in `tests/shop-render.test.js`; no test assertion or behavior was otherwise changed.
- Updated the preload key from `assets/js/shop-page.js` to `assets/js/pages/shop-page.js`.
- The controller content remained unchanged; its working-tree size is `12,166` bytes and its SHA-256 remained `606993662ECAEFB1733E3AD136308FA7212EFCD37360BF7BEF3E8988FB12ACCF`.
- The preload JSON remains valid, its new entry is `assets/js/pages/shop-page.js: 12166`, and every other key/value entry is unchanged.

No dynamic or script-relative module loading exists in the controller: no `import`, `fetch()`, `new URL()`, `document.currentScript`, or `import.meta.url`. The `IC` prefix (`assets/ng/komponen/`) is used for document-relative image URLs, and the back button navigates to document-relative `lobby.html`; neither is resolved relative to the JavaScript file. `URLSearchParams(location.search)` reads the current page query. These effective URLs therefore remain unchanged after the move.

The external script sequence in `shop.html` is unchanged except for the controller path. The controller remains loaded once, after the shared dependencies and `UT.App.init`. No service-worker cache list references the controller, so `sw.js` was not changed.

## Files changed

Implementation checkpoint:

- `assets/js/shop-page.js` → `assets/js/pages/shop-page.js` (100% rename; no content change).
- `shop.html` (controller path only).
- `tests/shop-render.test.js` (controller paths only).
- `assets/preload-manifest.json` (controller path only; size remains 12,166 bytes).

Audit checkpoint:

- `audit/5/global-extraction-phase-20.md`.

Intentionally unchanged: `ItemCatalog`, Item Registry, PlayerData, wallet and other services, item manifests and category indexes, Inventory, AppearanceService, Shop CSS/UI, `sw.js`, and historical audit notes.

## Static verification

- Full repository search: no active runtime reference remains at `assets/js/shop-page.js`; remaining matches are historical audit notes.
- `shop.html`: exactly one new controller path; external script order matches baseline with only that path substituted.
- Relative loading and document-relative URL targets: unchanged; no script-relative loading mechanism found.
- Preload JSON: parses; only the Shop key changed; byte count equals the moved file.
- Test file comparison: only the controller path references changed.
- `node --check assets/js/pages/shop-page.js`: passed.
- `git diff --check` and staged `git diff --cached --check`: passed.
- Test suite and browser tests were not run, as required for the extraction phase.

No unresolved relocation risk was found. Full behavioral testing remains deferred until the global extraction phases are complete.

## Git checkpoints and verification

- Implementation commit: `c214f90499f622222417ee56f78763878c53f066`; pushed to `origin/restruktur`.
- Audit report creation commit: its full hash and the verification snapshot at that checkpoint will be recorded by the required report-only follow-up commit.
- Preflight baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`; neither was changed.
- Final `HEAD`, `origin/restruktur`, clean worktree, remote tips, and commit availability will be recorded in the follow-up verification snapshot. The final report-only follow-up's own hash is reported separately because it cannot be embedded in the commit that creates it.
