# Global Extraction Phase 34 — Mine Service Current-State Closure

## 1. Baseline

| Ref / state | Verified value |
|---|---|
| Branch | `restruktur` |
| `HEAD` | `41a596df102c798bd21f85cee669cfac3d4b7cf8` |
| `origin/restruktur` | `41a596df102c798bd21f85cee669cfac3d4b7cf8` |
| Remote `refs/heads/restruktur` | `41a596df102c798bd21f85cee669cfac3d4b7cf8` |
| `main`, `origin/main`, remote `refs/heads/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Worktree before audit | Clean |

## 2. Current location and relocation status

- Canonical implementation: `assets/js/services/mine-service.js` — **exists**, 4,706 bytes.
- Previous source: `assets/js/mine-service.js` — **does not exist**.
- A repository file search found exactly one `mine-service.js` implementation, at the canonical path. No duplicate or compatibility copy exists.
- `assets/preload-manifest.json` contains the canonical path with byte count `4706`, matching the current file. No old-path manifest entry exists.
- The Phase 16 implementation commit `d6e8818aa9a0eebf167871ce97b45997635f16bd` and its audit record the original relocation. Phase 34 confirms that completed state; it does not repeat it.

## 3. Caller, API, and load contract

- `tambang.html` is the active script loader and uses `assets/js/services/mine-service.js`.
- The service remains a synchronous classic script (no `async`, `defer`, or module type).
- Script order remains: `PlayerData` and `WalletService`, then Mine Service, then `core/app.js` / `UT.App.init`, then `assets/js/pages/tambang.js`.
- `assets/js/pages/tambang.js` is the only active direct `UT.MineService` consumer found. It obtains the browser instance and calls `get`, `collect`, `unlock`, `boost`, and `upgrade`.
- The service publishes the existing `window.UT.MineService` API (`create` and `get`) and exports `create` for Node. Its method set and caller contract remain consistent.
- `tests/mine-service.test.js` imports `create` from `../assets/js/services/mine-service.js`.
- `referensi/newgui/README.md` documents the service/RPCs; `referensi/newgui/game/js/tambang.js` is an archived prototype reference. Neither is another active runtime caller. Historical audits retain old paths as historical evidence.

## 4. Dynamic import and URL resolution

When `UT.Multiplayer.getClient` is unavailable, the service uses `new URL('../multiplayer/client.js', SELF)` where `SELF` is captured from `document.currentScript.src`, then dynamically imports that URL. Relative to the canonical script URL, this resolves to `assets/js/multiplayer/client.js`, which exists. The loaded client publishes `UT.Multiplayer.getClient` and supplies the Supabase RPC client.

If `document.currentScript.src` is empty, the existing fallback resolves `new URL('multiplayer/client.js', window.location.href)`. On root-level `tambang.html`, this points to `/multiplayer/client.js`, not `/assets/js/multiplayer/client.js`. This is the pre-existing fallback edge case recorded in Phase 33; it remains unchanged.

## 5. Preload, service worker, and adjacent references

- The preload manifest path and 4,706-byte count match the canonical file.
- `sw.js` has no Mine Service path-specific entry; its current version is `ut-pwa-v188`.
- `tambang.html` still contains the previously identified stale `assets/js/live-sync.js` script reference. That file is absent; the existing module is `assets/js/core/live-sync.js`. This adjacent issue is recorded for a separate audit and was not changed in Phase 34. Mine Service does not depend on LiveSync.
- Searches found no active caller or manifest entry at the old Mine Service path. Remaining old-path mentions are historical audit records.

## 6. Static verification

- Confirmed canonical file exists, old source is absent, and only one implementation file is present.
- Verified `UT.MineService`, the active HTML caller, page-controller usage, test import, manifest key, and byte count.
- Verified dynamic import resolution from the canonical script URL and confirmed the target client file exists.
- Verified synchronous classic-script loading and the relative script order in `tambang.html`.
- Verified the documented fallback and stale LiveSync reference remain unchanged.
- `git diff --check` passed with a clean worktree before report creation.
- No test suite, browser test, benchmark, or runtime test was run.
- **No runtime, HTML, CSS, JavaScript, test, preload, manifest, or service-worker file was changed.**

## 7. Closure decision

**CLOSED — NO RELOCATION REQUIRED**

Mine Service has been at its canonical location since Phase 16. The current caller, test, preload manifest, API, and dynamic client import all use or resolve to that location. Do not start a Phase 34 relocation or create another copy. The empty-`document.currentScript` fallback and stale LiveSync script reference remain separate, unmodified findings.
