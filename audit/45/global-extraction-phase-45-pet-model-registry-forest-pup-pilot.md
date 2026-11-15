# Global Extraction Phase 45 — Pet Model Registry & Forest Pup Pilot

## 1. Baseline Git

- Branch: `restruktur`.
- Phase 45 baseline: `05982e92d1213a3ad25ef9a7e2010451117f30c9`.
- At baseline, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched; the worktree was clean.
- Baseline `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- The shared viewer remains at `assets/js/pet-viewer.js`; it was not relocated.

## 2. Registry implementation

Added `assets/js/renderers/pet-model-registry.js` with an explicit literal mapping for all seven `gameKey` values:

| `gameKey` | Explicit module URL | Active in Phase 45 |
|---|---|---|
| `forest_pup` | `data/inventory/pet/forest_pup/model.js` | Yes |
| `copper_golem` | `data/inventory/pet/copper_golem/model.js` | No |
| `crystal_axolotl` | `data/inventory/pet/crystal_axolotl/model.js` | No |
| `arcane_owl` | `data/inventory/pet/arcane_owl/model.js` | No |
| `storm_wolf` | `data/inventory/pet/storm_wolf/model.js` | No |
| `inferno_dragon` | `data/inventory/pet/inferno_dragon/model.js` | No |
| `celestial_kitsune` | `data/inventory/pet/celestial_kitsune/model.js` | No |

The registry exposes only key recognition, active-module status, builder registration, lazy script loading, and a selection-generation guard. It stores no catalog or Pet metadata. Unknown and inactive keys are rejected before creating a script element; URLs are never derived from caller input. In-flight requests are deduplicated, successful builders are cached, and failed loads or missing expected registration reject explicitly. Duplicate or out-of-request registrations are rejected.

## 3. Forest Pup extraction

- Added `data/inventory/pet/forest_pup/model.js`; it registers one builder and creates no Three.js objects or DOM state during registration.
- Removed the inline `petPup()` implementation and its `PETS` entry now has no inline builder. The six other builders remain inline and were not changed.
- The Forest Pup builder receives global Three.js, shared geometry/material/timing helpers, and the viewer-owned particle emitter through a context. It does not duplicate helpers or particle code.
- A source comparison confirmed the extracted geometry, animation, and burst body match the baseline exactly, excluding comments and the injected-context setup.
- The model returns the existing handle shape: `{ root, cam: { y, d }, tick(t, dt), burst() }`.

## 4. Viewer and page integration

- `window.PetViewer.select(gameKey)` and its page-controller call remain unchanged.
- Forest Pup requests its builder only when selected. The selection guard prevents a stale load from building or replacing a newer choice. Repeated selection of the active or pending key does not rebuild or reload it.
- The previous model is disposed and particles cleared before a changed selection. The six inline Pets still use their existing synchronous builders.
- Load/build failures are caught and reported through `console.error`; the WebGL-unavailable fallback remains unchanged.
- `pet.html` loads ItemRegistry and Pet manifests/index, ItemCatalog and PlayerData, Three.js, the model registry, PetViewer, and the page controller in the required order. Each script appears once.
- Pet manifests, metadata, ItemCatalog/ItemRegistry APIs, PNGs, SFX paths, audio resolver, and legacy `referensi/` app were not changed.

## 5. Tests added or updated

- Added `tests/pet-model-registry.test.js` for the seven-key allowlist, single active module, unknown/inactive-key rejection, load deduplication/cache, registration mismatch and duplicate errors, lazy builder invocation and handle shape, selection invalidation, and manifest-backed audio ownership.
- Updated `tests/pet-registry-parity.test.js`: removed source slicing tied to `PETS` and inline builder markers. The audio contract now probes the full viewer source in a VM, preserving checks for manifest mapping, registry-order independence, missing SFX/Registry fallback, and synthesized sound slots. Manifest/catalog/SFX/preload and page-order checks remain.
- Updated `tests/pet-catalog.test.js` for registry inclusion and script order.
- Updated the four Service Worker version assertions in `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, and `tests/power-registry-parity.test.js`.
- No test suite, browser test, benchmark, or runtime test was run, as required for this extraction phase.

## 6. Preload and Service Worker

- Ran the official `tools/gen-preload-manifest.py` generator.
- Preload entries increased from **830 to 832**, adding exactly:
  - `assets/js/renderers/pet-model-registry.js`
  - `data/inventory/pet/forest_pup/model.js`
- No prior preload key was removed. The only existing entry whose byte count changed was `assets/js/pet-viewer.js`; all **832** paths exist and have byte counts matching disk.
- The Service Worker version changed only from `ut-pwa-v193` to `ut-pwa-v194`. `CORE`, cache strategy, and fetch handling are unchanged.
- The existing global preload still fetches all manifest files; the Pet model script is executed and the model built only when selected.

## 7. Static verification

- `node --check` passed for the changed viewer, registry, model, tests, and `sw.js`.
- `git diff --check` passed.
- Verified the exact preload key delta and every entry's byte count.
- Verified the `pet.html` dependency subsequence and single inclusion of each required script.
- Verified the Forest Pup model body against its inline baseline.
- Confirmed `petPup()` and the old `viewerSlice()` test helper are absent from active implementation/test code.
- Confirmed no Pet manifest, catalog, SFX, PNG, or reference-app file changed.

## 8. Implementation files changed

1. `assets/js/pet-viewer.js`
2. `assets/js/renderers/pet-model-registry.js` (new)
3. `data/inventory/pet/forest_pup/model.js` (new)
4. `pet.html`
5. `assets/preload-manifest.json`
6. `sw.js`
7. `tests/pet-model-registry.test.js` (new)
8. `tests/pet-registry-parity.test.js`
9. `tests/pet-catalog.test.js`
10. `tests/aura-registry-parity.test.js`
11. `tests/character-registry-parity.test.js`
12. `tests/dice-registry-parity.test.js`
13. `tests/power-registry-parity.test.js`

## 9. Remaining scope and risks

- Six Pet builders remain inline by design; later pilot phases can extract them individually using the same injected context and registry contract.
- Global preload continues to transfer the model file under the existing offline-first policy. Only script execution/model construction is selection-lazy.
- Runtime behavior was not exercised in a browser or test suite in this phase. Full integration testing remains deferred to the post-extraction test phase.

## 10. Git checkpoints

- Implementation commit: `288ba5f78b8124f42193fa4120ce216b69318155`.
- Audit report is committed separately. Its commit hash and final remote/worktree verification are recorded in the completion message because a commit cannot contain its own object hash.

**Target status: COMPLETED — PET MODEL REGISTRY ESTABLISHED, FOREST PUP PILOT EXTRACTED.**
