# Global Extraction Phase 16 — Mine Service Extraction

## Baseline

- Branch: `restruktur`
- Baseline `HEAD` and `origin/restruktur`: `21f67f8208226b787604f8beba190eee2c3d9006`
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before implementation.
- Implementation commit: `d6e8818aa9a0eebf167871ce97b45997635f16bd` (`refactor(services): extract mine service`), pushed to `origin/restruktur` before this audit commit.

## Dependency and caller audit

`assets/js/mine-service.js` was the only runtime implementation and published the existing `UT.MineService` global. `assets/js/pages/tambang.js` consumes that API through `window.UT.MineService`; the consumer and API were not changed.

`tambang.html` loads the service after `PlayerData` and `WalletService`, and before `assets/js/pages/tambang.js`. Its script sequence is unchanged; only the service `src` changed. The service remains a classic script and continues to initialize the same global.

The test module `tests/mine-service.test.js` imports `create` from the implementation path. Its import path was updated; test logic was not changed. No maintained documentation outside historical audit reports referenced the source path. Older audit reports, including Phase 15, retain their original paths as historical evidence. The archived `referensi/newgui/README.md` was not changed.

## Dynamic multiplayer client URL

The module captures `document.currentScript.src` in `SELF` and lazily imports the multiplayer client only when `UT.Multiplayer.getClient` is unavailable.

- When `SELF` is available, the moved module resolves `../multiplayer/client.js` relative to `assets/js/services/mine-service.js`. Static URL resolution confirms the effective path remains `assets/js/multiplayer/client.js`, not `assets/js/services/multiplayer/client.js`.
- When `SELF` is empty, the pre-existing fallback remains exactly page-relative: `new URL('multiplayer/client.js', w.location.href)`. This preserves prior fallback behavior rather than introducing a new base or changing its effective URL.
- Dynamic loading, condition, lazy timing, and returned client API are unchanged.

The page-relative fallback is an existing edge case if `document.currentScript` is unavailable; this extraction deliberately preserves it per the requirement. Normal classic-script loading provides `document.currentScript`.

## Files changed

Implementation commit contains only:

1. `assets/js/mine-service.js` → `assets/js/services/mine-service.js` (rename plus the script-relative URL adjustment above).
2. `tambang.html` — updated the service script path, in place.
3. `tests/mine-service.test.js` — updated the `require` path only.
4. `assets/preload-manifest.json` — replaced the old path entry with the new path and exact current size.

No RPC names, arguments, validation, reward logic, PlayerData behavior, wallet/emerald handling, Supabase code, service API, or global name changed.

## Preload and cache review

- Before: `assets/js/mine-service.js` was listed as 4,575 bytes.
- After: `assets/js/services/mine-service.js` is listed as 4,706 bytes.
- The manifest still has 844 entries; the structured comparison confirms exactly one old-key removal and one new-key addition, with all other values unchanged.
- `sw.js` was not changed. Its core precache does not include Mine Service; code requests use the existing network-first behavior. No cache version or strategy change is required.

## Static verification

- Confirmed the old implementation path no longer exists and the new file exists at the target.
- Confirmed there are no references to the old path outside historical audits/archive. Current path references are the updated `tambang.html`, preload entry, and test import.
- Confirmed the `UT.MineService` caller in `assets/js/pages/tambang.js` is unchanged.
- Compared the Tambang script list before and after: all script order and entries are identical except for the Mine Service path. Session, PlayerData, Wallet Service, Mine Service, and Tambang page scripts retain their relative order.
- Verified URL resolution for the moved script and verified the no-`currentScript` fallback expression remains unchanged.
- Parsed the preload JSON and verified its only semantic changes are the moved path and exact 4,706-byte value.
- `node --check assets/js/services/mine-service.js` and `node --check tests/mine-service.test.js` passed. `git diff --check` passed.
- No test suite or browser test was run.

## Deliberately unchanged and remaining risks

- `assets/js/pages/tambang.js`, `PlayerData`, wallet/service code, Supabase/RPC/server authority, `sw.js`, and historical audit documents remain unchanged.
- The pre-existing page-relative fallback remains an edge case if `document.currentScript` is unavailable; changing it would alter the requested fallback behavior.
- No other extraction or refactor was performed.

## Git checkpoints

- Implementation checkpoint: `d6e8818aa9a0eebf167871ce97b45997635f16bd`, pushed to `origin/restruktur`.
- This report is committed separately and pushed after the implementation checkpoint.
- Final remote synchronization, clean-worktree status, and unchanged `main` refs are verified in the completion report.
