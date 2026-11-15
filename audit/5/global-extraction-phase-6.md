# Dragon Roll — Global Extraction Phase 6

## Status

`room-dice-art.js` was relocated to `assets/js/renderers/room-dice-art.js`. The module's global API and event contract were preserved. Only its relative imports changed. Test suites and browser tests were not run.

## 1. Git baseline

| Check | Result |
|---|---|
| Branch | `restruktur` |
| Phase 5 checkpoint | `a4476dbc7d9d3100e3845985cc1d712ba7313944` |
| Starting `HEAD` | `a4476dbc7d9d3100e3845985cc1d712ba7313944` |
| Starting `origin/restruktur` after fetch | `a4476dbc7d9d3100e3845985cc1d712ba7313944` |
| Starting worktree | Clean |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |

Phase 4 had identified this module as a candidate but deferred it because of the HTML, test, relative-import, and preload references. Those references were re-audited for this phase.

## 2. Candidate and dependency audit

| File / consumer | Responsibility and dependency |
|---|---|
| `assets/js/room-dice-art.js` | 322-byte ES module. Imports `getDice` and `diceThumbDataURL`; no `document.currentScript`, `import.meta.url`, `fetch`, worker, or directory-relative asset behavior. |
| `assets/js/dice-kit/DiceCatalog.js` | Unchanged source of dice records; exports `getDice`. |
| `assets/js/dice-kit/DiceTextures.js` | Unchanged procedural thumbnail implementation; exports `diceThumbDataURL` and imports `D6_FACES` from the unchanged sibling `DiceCatalog.js`. |
| `room.html` | Sole runtime script reference. The module script is loaded between `UT.App.init()` and `assets/js/pages/room.js`. |
| `assets/js/pages/room.js` | Reads `window.RoomDiceArt.thumb(it.gameKey, 96)` when available and listens for `room-dice-art-ready` to refresh equipment rendering. |
| `tests/room-page-modal.test.js` | Reads the module source and checks its relative imports and thumbnail helper. Only the module path and expected relative paths required updates. |
| `assets/preload-manifest.json` | Contained the old module path at 322 bytes; the new path was not present. |
| `sw.js` | Uses `ut-pwa-v185`; code requests use network-first handling. The module is not in the service-worker `CORE` list. |

The module still exposes `window.RoomDiceArt.thumb(gameKey, px)`, returning the procedural thumbnail for a recognized die or an empty string otherwise. It still dispatches `room-dice-art-ready` as an event with no payload. No additional active runtime caller or dynamic path reference was found. Historical audit text retains the old path as a record of the prior layout.

## 3. Decision and migration

The move was safe: both imports resolve from the new directory, the public global and event are unchanged, and the script tag remains at the same position and keeps `type="module"`. No compatibility alias was needed because the known active HTML consumer was updated.

| Old path | New path | Bytes | Change |
|---|---|---:|---|
| `assets/js/room-dice-art.js` | `assets/js/renderers/room-dice-art.js` | 324 | Relocated; only the two relative import specifiers changed |

Files changed:

- `assets/js/renderers/room-dice-art.js`: relocated module; imports now resolve through `../dice-kit/`.
- `room.html`: updated the module `src`; script type and order are unchanged.
- `tests/room-page-modal.test.js`: updated the source path and import-path expectations; test logic is unchanged.
- `assets/preload-manifest.json`: replaced the old path/322-byte entry with the new path/324-byte entry. All other entries and values are unchanged.

`DiceCatalog.js`, `DiceTextures.js`, `room.js`, `sw.js`, and other gameplay or data modules were not modified.

## 4. Cache and preload contract

- The new manifest entry matches the exact source size: 324 bytes.
- Every path in the updated preload manifest exists.
- No service-worker cache strategy or cache version change was needed: the script is handled as network-first code and is not in `CORE`. The manifest now preloads the new URL.
- Existing clients with an older cached page may still refer to the old URL until they receive the updated page. Old URL cache entries, if present, are left untouched; no compatibility alias was added.

## 5. Static verification

- Confirmed the old source file is absent and the new source file exists.
- Repository search confirmed the active HTML, test, and preload references use the new path. Historical audit records were intentionally not rewritten.
- Confirmed the new relative imports point to the existing `DiceCatalog.js` and `DiceTextures.js`.
- Compared the `room.html` diff: only the module `src` changed; its type and position are unchanged.
- Compared parsed preload manifests: the only changes are removal of the old key and addition of the new key at the actual 324-byte size.
- Verified all preload paths exist.
- Reviewed the API and event source and confirmed only import specifiers changed.
- `git diff --check` passed.
- `sw.js` and all files outside the migration scope were unchanged.

## 6. Tests not run

No test suite, test-file execution, or browser test was performed, as required. Static checks do not constitute a test pass.

## 7. Checkpoint

| Checkpoint | Commit | Push |
|---|---|---|
| Module relocation and direct references | `fb5e460d5c8b5558651f8b6060a6f61eeaf362c2` (`refactor(js): relocate room dice art renderer`) | Pushed to `origin/restruktur` |

At the migration checkpoint push, `HEAD` and `origin/restruktur` both resolved to `fb5e460d5c8b5558651f8b6060a6f61eeaf362c2`. The `main` and `origin/main` hashes remained unchanged at `aeb11acf130df4ade4acc9417f01470e40a33dbb`. This audit is committed separately after the migration checkpoint.

## 8. Remaining risk and follow-up

- No application behavior, rendering logic, public API, event payload, or script order was intentionally changed.
- If an offline client retains an older page that requests the previous module URL, behavior depends on whether that old URL remains cached. The normal online path receives the updated page and preloads the new URL.
- No other JavaScript module was moved in this phase. Select the next candidate only after a separate dependency audit.
