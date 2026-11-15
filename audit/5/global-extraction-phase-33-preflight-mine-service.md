# Global Extraction Phase 33 — Mine Service Relocation Preflight Audit

## 1. Baseline Git

| Ref / state | Verified value |
|---|---|
| Branch | `restruktur` |
| `HEAD` | `623c9fe63d5c9c6c5f2970912309ef02403c58b6` |
| `origin/restruktur` | `623c9fe63d5c9c6c5f2970912309ef02403c58b6` |
| Remote `refs/heads/restruktur` | `623c9fe63d5c9c6c5f2970912309ef02403c58b6` |
| `main`, `origin/main`, remote `refs/heads/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Initial worktree | Clean |

The requested baseline matched exactly.

## 2. Inventory and source-path discrepancy

| Requested/current path | Actual state | Actual bytes |
|---|---|---:|
| `assets/js/mine-service.js` | Does not exist at this baseline | — |
| `assets/js/services/mine-service.js` | Exists; current implementation and active path | 4,706 |
| `assets/js/pages/tambang.js` | Exists; page controller | 15,795 |
| `tambang.html` | Exists; page and script loader | 2,898 |
| `tests/mine-service.test.js` | Exists; imports the current target | 3,825 |
| `assets/preload-manifest.json` | Exists; target entry is 4,706 bytes | 39,451 |

The runtime relocation has already been completed. `git log --follow` identifies implementation commit `d6e8818aa9a0eebf167871ce97b45997635f16bd` (`refactor(services): extract mine service`); the existing Phase 16 report records the same move. This audit therefore assesses the current target and does not repeat the move.

## 3. Responsibility and API contract

`assets/js/services/mine-service.js` is a server-authoritative Tambang RPC adapter. It validates slot/action inputs, calls the mine RPCs, prevents concurrent mutating actions through a per-instance in-flight lock, maps errors to `{ok:false, reason}`, and mirrors returned `coins`/`gems` to `PlayerData.applyServerWallet()`. It does not calculate economic results; the server does.

The classic-script IIFE publishes `window.UT.MineService`; under Node it also exports the same API with `module.exports` for the focused test. Public surface:

- `MineService.create(deps)` returns `enabled`, `get`, `unlock`, `upgrade`, `boost`, and `collect`.
- `MineService.get()` returns the cached browser instance when `PlayerData` is available.
- The browser instance uses `PlayerData.serverMode()` to gate operations and `PlayerData.applyServerWallet()` to mirror server balances.
- RPCs are `mine_get`, `mine_unlock({p_slot})`, `mine_upgrade({p_slot,p_kind})`, `mine_boost({p_slot})`, and `mine_collect({p_slot})`.

Evaluation publishes the API and captures `document.currentScript.src`; it does not initiate an RPC or install timers, event listeners, or storage handlers. There is no `import.meta.url`, `fetch()`, direct `localStorage` use, or static ES-module import in this service.

## 4. Caller and dependency map

### Active runtime

- `tambang.html` is the only active HTML script loader for Mine Service. The service is a synchronous classic `<script>` with no `async`, `defer`, or module type.
- The page loads `PlayerData` and `WalletService` before Mine Service, then loads `core/app.js`, initializes `UT.App`, and loads `assets/js/pages/tambang.js`. The service therefore publishes its global before the page controller uses it.
- `assets/js/pages/tambang.js` is the only active direct `UT.MineService` consumer found. It obtains the browser instance and calls `get`, `collect`, `unlock`, `boost`, and `upgrade`. The controller owns UI, display estimates, and user feedback; it does not replace server authority.
- The service's `getClient` dependency uses an already-present `UT.Multiplayer.getClient` when available. Otherwise, it lazily loads the shared multiplayer client.
- `assets/js/multiplayer/client.js` imports the repository's pinned Supabase client, loads its configuration, and publishes `UT.Multiplayer.getClient`. Mine Service itself neither imports Supabase nor owns client configuration, session storage, or RPC transport.
- `WalletService` is a separate page-level dependency. The Tambang controller also references `UT.WalletService` and `UT.LiveSync` for wallet refresh behavior; Mine Service only mirrors balances returned by its own RPCs through PlayerData.

### Tests, preload, service worker, and documentation

- `tests/mine-service.test.js` imports `create` from `../assets/js/services/mine-service.js` and tests it with fake PlayerData and RPC dependencies. This is a test consumer, not a second runtime implementation.
- `assets/preload-manifest.json` contains `assets/js/services/mine-service.js` with the exact current size, 4,706 bytes. No old-path manifest entry exists.
- `sw.js` contains no Mine Service path or special cache entry. Its current version is `ut-pwa-v188`; this audit makes no cache/version recommendation because the target path is already active.
- `referensi/newgui/README.md` describes the service/RPCs, and `referensi/newgui/game/js/tambang.js` mentions the server MineService in archived prototype commentary. Neither is an active runtime caller.
- Historical audit reports retain the earlier source path as evidence and are not active references.
- `assets/js/pages/shop-page.js` maps `mine_*` RPC names to wallet-history labels; it does not call the Mine Service API. Supabase migrations, snapshot SQL, and `supabase/tests/tambang_test.sql` define or exercise the server RPCs, not the JavaScript module.

## 5. Dynamic import and path resolution

When `UT.Multiplayer.getClient` is unavailable, the service uses:

`new URL('../multiplayer/client.js', SELF)` followed by `import(clientUrl.href)`.

For the current script URL under `assets/js/services/mine-service.js`, this resolves to `assets/js/multiplayer/client.js`, which exists. This is the intended shared client location and is independent of the page URL.

If `document.currentScript.src` is empty, the existing fallback is `new URL('multiplayer/client.js', window.location.href)`. On root-level `tambang.html`, that resolves to `/multiplayer/client.js`, not `/assets/js/multiplayer/client.js`. The active synchronous classic-script tag normally supplies `currentScript`; the fallback edge case is pre-existing and was not changed by this read-only audit.

## 6. Target-folder evaluation and risk

The target `assets/js/services/` is architecturally appropriate: Mine Service is a shared service adapter, not dynamic item content or a content-owned data implementation. `data/` is not appropriate. The target directory and file already exist and are the canonical active location.

**Decision: READY WITH CONDITIONS** — the service boundary and target folder are appropriate, and the relocation is already complete at the audited baseline. Do not perform another source-to-target move in Phase 34. If a later phase was intended to relocate the old path, it must be re-scoped as a no-op/current-state verification rather than creating a duplicate or compatibility copy.

Conditions and risks:

1. Preserve the synchronous classic-script contract and `document.currentScript.src` capture if the script path or loader ever changes.
2. Preserve the effective dynamic client URL `assets/js/multiplayer/client.js`; moving the service again requires recalculating the relative URL.
3. Keep the existing empty-`currentScript` fallback behavior unchanged unless a separate task explicitly authorizes fixing it.
4. An adjacent, pre-existing Tambang page path discrepancy was found: `tambang.html` references `assets/js/live-sync.js`, which is absent; the existing file is `assets/js/core/live-sync.js`. This is outside the Mine Service relocation and was not changed. The service itself does not depend on LiveSync.

## 7. Static verification and scope

- Confirmed the requested source path is absent, the target exists, and the target's actual size is 4,706 bytes.
- Parsed the preload manifest and confirmed the target entry equals the file's byte count; verified that no old-path key exists.
- Confirmed the only active direct global API consumer is `assets/js/pages/tambang.js`; current HTML and test imports point to the target.
- Checked Tambang script ordering and verified Mine Service remains a synchronous classic script.
- Resolved the dynamic import URL statically against the current script URL and confirmed the multiplayer client file exists.
- Confirmed `sw.js` has no Mine Service path-specific reference.
- `node --check` passed for the service, page controller, and test source. The test file was not executed.
- `git diff --check` passed with a clean worktree before report creation.
- No test suite, browser test, benchmark, or runtime test was run.
- **No runtime, HTML, test, preload, service-worker, data, or documentation file other than this new audit report was changed.**
