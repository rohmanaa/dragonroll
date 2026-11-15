# Global Extraction Phase 28 — Dice Kit Atomic Relocation

## 1. Baseline

- Branch: `restruktur`.
- Baseline `HEAD` and fetched `origin/restruktur`: `b7d4179ba0848be9fa68153ae790dcda1314721d` (Phase 27 follow-up).
- Baseline worktree: clean.
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- Baseline `git ls-remote` matched the local remote-tracking refs.
- Implementation commit: `93bb824f3101bd9bcdd92b647e3a2c6359e60e28`, pushed to `origin/restruktur`.
- No operation changed or pushed to `main`.

## 2. Atomic module relocation and byte sizes

All 11 files moved with their original names from `assets/js/dice-kit/` to `assets/js/renderers/dice-kit/`. No file remains in the old directory and no compatibility copy/alias was created.

| File | Bytes before | Bytes after |
|---|---:|---:|
| `DiceAnimation.js` | 13,353 | 13,356 |
| `DiceCatalog.js` | 18,837 | 18,837 |
| `DiceEffects.js` | 452 | 455 |
| `DiceEffectsCore.js` | 35,777 | 35,777 |
| `DiceMaterials.js` | 2,622 | 2,625 |
| `DicePhysics.js` | 11,915 | 11,915 |
| `DiceRenderer.js` | 17,188 | 17,191 |
| `DiceTextures.js` | 15,617 | 15,617 |
| `index.js` | 1,522 | 1,522 |
| `RoomEnvironment.js` | 3,779 | 3,782 |
| `RoundedBoxGeometry.js` | 4,809 | 4,812 |
| **Total** | **125,871** | **125,889** |

The six three.js import path changes each add three characters; the other module contents are unchanged.

## 3. References updated

### Imports and loaders

- Rebasing the six Three r170 imports from `../vendor/three.r170.module.min.js` to `../../vendor/three.r170.module.min.js`:
  - `DiceAnimation.js`
  - `DiceEffects.js`
  - `DiceMaterials.js`
  - `DiceRenderer.js`
  - `RoomEnvironment.js`
  - `RoundedBoxGeometry.js`
- Sibling module imports remain unchanged and resolve within the moved directory.
- `dadu.html` and `gameplay.html` now load `assets/js/renderers/dice-kit/index.js` as a module. Static comparison against baseline confirmed the `type="module"` attributes and tag positions/order are unchanged.
- Gameplay's three dynamic imports in `gameplay/js/dice-throw.js` now target `DiceTextures.js`, `DiceCatalog.js`, and `DiceEffectsCore.js` at the new location. `new URL(..., document.baseURI)` and the existing lazy import/fallback flow are unchanged.
- `assets/js/renderers/room-dice-art.js` now imports `./dice-kit/DiceCatalog.js` and `./dice-kit/DiceTextures.js`; the adapter remains separate from `index.js` and `window.DiceKit`.
- `data/inventory/dice/index.js` updates only the `CATEGORY.assets.renderKit` locator and its explanatory path comment.
- Active location comments in `gameplay/js/dice-ui.js` and `gameplay/js/dice-pad.js` point to the new directory.
- `referensi/newgui/README.md` now documents the new location. Its existing “20 dadu” count was not changed in this path-only update.

### Tests, preload, and service worker

- Updated path references in:
  - `tests/dice-landing-stall.test.mjs`
  - `tests/dice-registry-parity.test.js`
  - `tests/dice-sound-variation.test.js`
  - `tests/room-page-modal.test.js`
- `tests/dice-registry-parity.test.js` now inventories all 11 modules, checks that the old directory is absent, protects the new DiceKit directory scope, checks the new RoomDiceArt relative imports, and validates all 11 DiceKit preload sizes.
- `assets/preload-manifest.json` replaces exactly the 11 old keys with the new keys and actual byte sizes. No unrelated preload value changed; JSON parsing succeeded; all 11 paths occur once and no old DiceKit preload key remains.
- `sw.js` changes only `VERSION` from `ut-pwa-v185` to `ut-pwa-v186`, as required for the asset relocation. Cache strategy, `CORE`, and fetch behavior are unchanged. The parity test's expected version now matches `v186`.
- `tools/gen-preload-manifest.py` needed no change. Historical audit documents and the 23 per-die manifest comments were intentionally left untouched.

## 4. Runtime contract preservation

- Moved modules were compared to their Phase 27 baseline; after normalizing only the six vendor import paths and line endings, their source matches baseline.
- `window.DiceKit` API and renderer API are unchanged. The entry remains a single canonical module URL and retains the `dicekit-ready` event.
- Gameplay still supplies its own global Three namespace to `DiceEffectsCore.createDiceEffects(THREE)`; it is not replaced with the r170 module namespace.
- Gameplay remains authoritative for roll results and forced-face alignment. DiceKit continues to render the provided result.
- Room continues using `window.RoomDiceArt.thumb()` and `room-dice-art-ready`, without loading `index.js` or `window.DiceKit`.
- Texture/face caches, material LRU behavior, listeners, `ResizeObserver`, animation loop, lazy AudioContext creation, and GPU/audio disposal were not modified.

## 5. Static verification

- Exactly 11 expected modules exist at `assets/js/renderers/dice-kit/`; the old `assets/js/dice-kit/` directory is absent.
- Static import resolution checks passed for all relative imports in the moved modules, including the six rebased vendor imports.
- Active runtime, test, tooling, preload, and current-structure documentation references use the new path. Remaining old-path mentions are historical audit material, the intentionally untouched per-die comments, or negative assertions that verify old-path absence.
- HTML loaders were compared to baseline with only the entry URL normalized; ordering and module type are unchanged.
- Gameplay import strings were compared to baseline with only target paths normalized; `document.baseURI` is unchanged.
- The preload manifest is valid JSON, contains 11 new DiceKit entries, has no old keys or duplicates, and each byte count equals the actual file size. Non-DiceKit entries match baseline.
- `sw.js` differs only by its version value, and the test assertion matches `v186`.
- `node --check` passed for all 11 moved modules and all 10 modified JavaScript files (21 files total).
- `git diff --check` passed.
- No test suite, browser test, or benchmark was run; those remain deferred until extraction phases are complete.

## 6. Risks and remaining notes

- No known relocation-specific path, import, preload, or runtime-contract risk remains after these static checks.
- Tests and browser execution were deliberately not performed, so runtime validation remains deferred by phase policy.
- The README's pre-existing dice count text remains “20” although current catalog/registry data contains 23; only the requested path was updated.

## 7. Checkpoint and final Git verification

- Implementation commit `93bb824f3101bd9bcdd92b647e3a2c6359e60e28` contains the complete relocation and related runtime/reference updates, with no audit report.
- The separate audit commit and post-push Git verification are recorded in the report-only follow-up and completion summary.
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`; neither was changed.
- No Phase 29 work was started.
