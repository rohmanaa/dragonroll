# Global Extraction Phase 30 — Power3D Atomic Relocation

Status: **Complete — static verification only**
Scope: relocation of the 14-module Power3D group; Phase 31 was not started.

## 1. Baseline and implementation checkpoint

| Ref / state | Baseline |
|---|---|
| Branch | `restruktur` |
| `HEAD` and `origin/restruktur` before implementation | `4450c2ce57433ccb5dd94b3bb04551228ef33c7a` |
| `main` and `origin/main` before implementation | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Worktree before implementation | Clean |

Implementation commit: `9fda0a69e9a1e281e4dfbe7fb44c42f3676f1626` (`refactor(power): relocate Power3D renderer`). The commit contains the atomic module relocation and all implementation-scope reference updates. No operation changed or merged into `main`.

## 2. Relocated module inventory

All 14 files moved with unchanged names and contents from `assets/js/power3d/` to `assets/js/renderers/power3d/`. The byte sizes below are unchanged; total size is **116,224 bytes**.

| File | Old path | New path | Bytes |
|---|---|---|---:|
| `PowerAnimation.js` | `assets/js/power3d/PowerAnimation.js` | `assets/js/renderers/power3d/PowerAnimation.js` | 6,924 |
| `PowerAura.js` | `assets/js/power3d/PowerAura.js` | `assets/js/renderers/power3d/PowerAura.js` | 7,840 |
| `PowerCatalog.js` | `assets/js/power3d/PowerCatalog.js` | `assets/js/renderers/power3d/PowerCatalog.js` | 11,010 |
| `PowerConfig.js` | `assets/js/power3d/PowerConfig.js` | `assets/js/renderers/power3d/PowerConfig.js` | 2,713 |
| `PowerEffects.js` | `assets/js/power3d/PowerEffects.js` | `assets/js/renderers/power3d/PowerEffects.js` | 25,396 |
| `PowerGeometry.js` | `assets/js/power3d/PowerGeometry.js` | `assets/js/renderers/power3d/PowerGeometry.js` | 18,376 |
| `PowerLighting.js` | `assets/js/power3d/PowerLighting.js` | `assets/js/renderers/power3d/PowerLighting.js` | 3,579 |
| `PowerMaterials.js` | `assets/js/power3d/PowerMaterials.js` | `assets/js/renderers/power3d/PowerMaterials.js` | 6,086 |
| `PowerParticles.js` | `assets/js/power3d/PowerParticles.js` | `assets/js/renderers/power3d/PowerParticles.js` | 8,016 |
| `PowerRegistry.js` | `assets/js/power3d/PowerRegistry.js` | `assets/js/renderers/power3d/PowerRegistry.js` | 859 |
| `PowerRenderer.js` | `assets/js/power3d/PowerRenderer.js` | `assets/js/renderers/power3d/PowerRenderer.js` | 11,730 |
| `PowerSound.js` | `assets/js/power3d/PowerSound.js` | `assets/js/renderers/power3d/PowerSound.js` | 9,327 |
| `power-overlay.js` | `assets/js/power3d/power-overlay.js` | `assets/js/renderers/power3d/power-overlay.js` | 3,018 |
| `power-show.js` | `assets/js/power3d/power-show.js` | `assets/js/renderers/power3d/power-show.js` | 1,350 |

The old directory is absent; no compatibility alias or duplicate module remains. Git recognizes all 14 moves as 100% renames. No module implementation or sibling import was edited.

## 3. References updated

### Runtime and data

- `gameplay/js/power3d-loader.js`: updated the idle dynamic import and active path comment. Idle scheduling, promise/catch behavior, `UT.PowerOverlay` / `UT.PowerSound` assignment, and 2D fallback are unchanged.
- `assets/js/pages/powerup.js`: updated its lazy `power-show.js` import and active path comment. State guard and ItemArt fallback are unchanged.
- `data/inventory/power/index.js`: updated all nine `CATEGORY.assets` locators. Registry metadata and manifest semantics are unchanged.
- `gameplay/js/audio.js` and `data/power/power-fx.js`: updated active path comments only.

### Tooling and documentation

- `tools/power-icons/bake.html`: updated both static module imports; its Three.js import map and icon output location are unchanged.
- `tools/power-icons/bake.py`: updated the active path in its docstring only; output remains under `data/power/3d/`.
- `README.md` and `referensi/newgui/README.md`: updated the current Power3D directory description.
- Historical audits were not edited.

### Tests and service worker

- `tests/power3d.test.js`: moved catalog/source reads, directory scan, relative-import base, and Power-up lazy-import assertion to the new path; checks were retained.
- `tests/power-rules.test.js`: moved the `PowerSound` source read and loader-path assertion.
- `tests/power-registry-parity.test.js`: moved all three `pathToFileURL` imports.
- Updated the service-worker version assertions to v187 in `tests/power-registry-parity.test.js`, `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, and `tests/dice-registry-parity.test.js`.
- `sw.js`: changed only `VERSION` from `ut-pwa-v186` to `ut-pwa-v187`; cache strategy and `CORE` are unchanged.

`gameplay.html` and `powerup.html` were not changed. Their import maps remain ahead of module use, and the Gameplay loader tag remains in its existing position. `tests/gameplay-assets-external.test.js` references the loader file, whose own path did not move.

## 4. Preload manifest

`assets/preload-manifest.json` now contains the 14 new Power3D paths, with no old Power3D key. Each stored byte count matches the corresponding relocated file. The old and new manifests were compared against the implementation baseline: exactly the 14 Power3D keys were replaced, unrelated keys and values were preserved, and all 14 new paths are unique.

## 5. Runtime contract and scope

- All 14 relocated files remain ES modules; sibling-relative imports resolve from the new directory.
- Bare `three` and `three/addons/` imports continue to resolve through the existing import maps to the Three.js r170 vendor modules. No Gameplay global Three namespace was introduced.
- `PowerRenderer`, `power-show.js`, `power-overlay.js`, `PowerRegistry`, and `PowerSound` implementations and public APIs were not modified.
- Gameplay remains authoritative for Power results. Lazy loading, audio selection, `UT.PowerOverlay` / `UT.PowerSound`, 2D fallbacks, and adapter lifecycle behavior remain unchanged.
- Power manifests, ItemCatalog, PlayerData, transactions, equip state, and gameplay rules were not changed.
- The Phase 29 lifecycle finding remains: the Power-up page does not call the adapter's `destroy()` when hiding the preview. It was intentionally not fixed or changed as part of this relocation.

## 6. Changed files and diff summary

Implementation commit `9fda0a69e9a1e281e4dfbe7fb44c42f3676f1626` changes 31 paths:

- 14 pure renames into `assets/js/renderers/power3d/`.
- 17 reference/configuration/documentation/test files: `README.md`, `assets/js/pages/powerup.js`, `assets/preload-manifest.json`, `data/inventory/power/index.js`, `data/power/power-fx.js`, `gameplay/js/audio.js`, `gameplay/js/power3d-loader.js`, `referensi/newgui/README.md`, `sw.js`, `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, `tests/power-registry-parity.test.js`, `tests/power-rules.test.js`, `tests/power3d.test.js`, `tools/power-icons/bake.html`, and `tools/power-icons/bake.py`.
- Summary: 36 insertions and 36 deletions across edited content; the 14 moved modules have no content changes.

## 7. Static verification

- `node --check` passed for all 14 relocated modules and 12 related JavaScript files (26 files total). No module or test was executed.
- Resolved every relative import in the moved modules; verified `three/addons/` targets exist.
- Parsed the import maps in `gameplay.html`, `powerup.html`, and `tools/power-icons/bake.html`; verified vendor targets exist.
- Confirmed all 14 modules are in the target directory and the old directory is absent.
- Searched active runtime, data, tests, tooling, and current documentation for `assets/js/power3d`; no stale active reference remains. Matches in prior audit reports are historical and intentionally retained.
- Verified the 14 preload keys, uniqueness, exact byte counts, and that no unrelated manifest entry changed.
- Verified `sw.js` and all four version assertions use `ut-pwa-v187`.
- `git diff --check` and staged-diff checks passed.
- **Test suites, browser tests, benchmarks, and runtime tests were not run**, per the phase restriction.

## 8. Audit checkpoint and final Git verification

The audit report is committed separately from implementation. Its audit commit hash and final remote verification are recorded in the report-only follow-up; the follow-up does not include its own hash.
