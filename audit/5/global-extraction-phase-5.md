# Dragon Roll — Global JavaScript Extraction Phase 5

Status: `achievement-data.js` relocated without changing its source contents or public API. The page script order is unchanged. Preload metadata now points to the new path. `sw.js` was not changed because application code is network-first and the relocated module is not in the service-worker CORE list. Test suites and browser tests were not run.

## 1. Git baseline

| Check | Result |
|---|---|
| Branch | `restruktur` |
| Phase 4 final checkpoint | `75944181d6eaae869a3d02c4ae9a9aedfbff64c7` |
| Phase 4 audit | `audit/5/global-extraction-phase-4.md` exists and was reviewed |
| Starting `HEAD` | `75944181d6eaae869a3d02c4ae9a9aedfbff64c7` |
| Starting `origin/restruktur` after fetch | `75944181d6eaae869a3d02c4ae9a9aedfbff64c7` |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Starting worktree | Clean |

The Phase 4 report's `27fd5d0` is its initial audit checkpoint; Phase 4's final pushed commit was `75944181...`. The current branch and remote matched that final checkpoint. `main` was not checked out or modified.

## 2. Candidate re-audit

The candidate remained safe for an isolated path migration:

- The source is a UMD/IIFE module. It exposes the same `UT.Achievement` object in the browser and `module.exports` in Node.
- Public exports remain `ACH`, `REW`, `CLS`, `stats`, `info`, and `reward`.
- It has no static or dynamic imports, relative asset URLs, `document.currentScript`, `import.meta.url`, `fetch`, worker, or directory-sensitive path behavior.
- The only active page script caller was `hadiah-misi.html`; the direct test consumer was `tests/achievement-data.test.js`.
- The preload manifest contained the old path at 4,417 bytes. The target path was not already present.
- A repository-wide search found no generator or additional active consumer requiring the old path. The historical Phase 4 audit intentionally retains its original inventory/path record.

## 3. Migration

| Old path | New path | Bytes | Result |
|---|---|---:|---|
| `assets/js/achievement-data.js` | `assets/js/data/achievement-data.js` | 4,417 | 100% rename; file contents unchanged |

Updated references:

- `hadiah-misi.html`: changed only the script `src`. The module remains between `quest-data.js` and `app.js`; script order is unchanged.
- `tests/achievement-data.test.js`: changed only the CommonJS `require` path; test logic was not edited.
- `assets/preload-manifest.json`: replaced the old key with `assets/js/data/achievement-data.js`, retaining the exact 4,417-byte value. All other manifest entries and values were preserved.

No compatibility alias was added: all active consumers were updated, and the old source file no longer exists. No duplicate module remains.

## 4. Preload and service-worker contract

- The preloader reads `assets/preload-manifest.json`, then fetches each listed URL.
- The current `sw.js` uses network-first handling for same-origin non-media code requests and caches successful responses by request URL. The new preload URL is therefore cached under its new path after the normal online preload/fetch.
- `assets/js/data/achievement-data.js` is not in the explicit `sw.js` CORE list. No CORE URL or caching strategy changed.
- `sw.js` remains at version `ut-pwa-v185`; no version bump was needed for this path-only update under the existing network-first behavior. The updated preloader manifest fetches the new module URL, while the old cached URL can remain harmlessly unused.
- The three unrelated preload byte-size mismatches documented in Phase 4 were intentionally not repaired: `blocky-character.js` (64,282 listed / 64,432 actual), `character-data.js` (38,603 / 50,120), and `item-catalog.js` (41,712 / 42,707).

## 5. Static verification

- Confirmed the source at the new path is byte-for-byte identical to the Phase 4 source (4,417 bytes; same Git blob hash).
- Confirmed the old source path is absent and the new path exists.
- Compared both HTML and test files with the Phase 4 versions: only the required path string changed in each.
- Compared parsed preload objects: the only difference is the old-to-new key replacement; the new entry size is 4,417 bytes.
- Verified every preload path exists. No missing paths were found; the three historical size mismatches remain unchanged.
- Confirmed `sw.js` is unchanged and remains at `ut-pwa-v185`.
- Reviewed the migration diff, path references, and `git diff --check`; no changes were made to protected data, Gameplay, HUD, Supabase/RPC, or unrelated modules.
- No old active path reference remains in HTML, JavaScript, tests, tools, or preload data. Audit documents retain the old path only to record the migration history.

## 6. Tests not run

No test suite, test-file execution, browser test, or Gameplay run was performed, as required. Static equivalence and path checks are not a claim that tests passed.

## 7. Commit and push

| Checkpoint | Commit | Push |
|---|---|---|
| Module relocation and direct references | `9ba448a1ef2a74baddf1f876432418b48ee02fbc` (`refactor(js): relocate achievement data module`) | Pushed to `origin/restruktur` |
| Phase 5 audit | Saved in this report; committed separately after the implementation checkpoint | Push status and final HEAD recorded in the delivery summary |

## 8. Remaining risk and follow-up

- No application API, data format, server authority, or runtime ordering was intentionally changed.
- Existing clients with the previous page/module cached may continue using the old cached URL until they fetch the updated page; after the new module is fetched online, the service worker caches the new URL normally.
- The three preload byte-size mismatches are pre-existing and remain a separate maintenance task.
- No other JavaScript module was moved in this checkpoint. Stop here pending the next phase instruction.
