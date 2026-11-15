# Global Extraction Phase 47 — Crystal Axolotl Model Extraction

## 1. Baseline Git

- Branch: `restruktur`.
- Phase 47 baseline `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur`: `44b366717b4168dca1f2394b459bad03c91d5919`.
- The baseline worktree was clean.
- Baseline `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `pet.html` and the shared viewer location were preserved.

## 2. Preflight and dependencies

- The inline Crystal Axolotl builder was `petAxolotl()` in `assets/js/pet-viewer.js`, between the particle emitter and Arcane Owl builder.
- Its dependencies were the viewer's `THREE`, `bx`, `cone`, `gp`, `eye`, `oct`, `glow`, `rate`, `pick`, `rr`, and `emit`.
- Forest Pup and Copper Golem use the same registry registration pattern, injected context, and model handle. Crystal Axolotl additionally needs the already viewer-owned `cone` and `oct` helpers; both were added to the existing injected helper object. No registry or loader redesign was needed.
- No unexplained contract difference was found, so implementation proceeded.

## 3. Model extraction

- Added the canonical builder at `data/inventory/pet/crystal_axolotl/model.js`.
- The model registers `crystal_axolotl` with the existing `UT.PetModelRegistry`. Module evaluation only verifies the registry and defines/registers the builder; it does not create Three.js objects, access the DOM, or start animation.
- The builder receives `THREE`, shared viewer helpers, and the viewer-owned particle emitter through context.
- The builder body from `const R=new T.Group();` through its returned handle was compared to the baseline. It matches exactly after line-ending normalization. Geometry, colors/materials, gills, tail, crystals, glow, camera `{ y: .95, d: 6.6 }`, animation/timing, particle emission, and the 70-particle burst are unchanged.
- The result retains `{ root, cam: { y, d }, tick(t, dt), burst() }`.
- Removed `petAxolotl()` and its inline `PETS` build reference from `assets/js/pet-viewer.js`; `crystal_axolotl` now has `build: null`. There is one canonical builder.

## 4. Registry and viewer integration

- Activated the literal allowlist entry `crystal_axolotl` at `data/inventory/pet/crystal_axolotl/model.js`.
- Forest Pup and Copper Golem remain active. Arcane Owl, Storm Wolf, Inferno Dragon, and Celestial Kitsune remain explicit but inactive.
- Existing unknown/inactive-key rejection, in-flight load deduplication, registration validation, duplicate-registration rejection, successful-builder caching, and selection-generation guard were not changed.
- The existing viewer lazy-selection path loads Crystal Axolotl on demand. The public `window.PetViewer.select(gameKey)` API and the page controller are unchanged.
- `pet.html` has no Git diff; no model script was added to the page. Registry-before-viewer script order remains intact.
- Catalog metadata, manifest, SFX mapping, audio resolver, PNG, and all other Pet models were not changed.

## 5. Tests and preload

- Updated `tests/pet-model-registry.test.js` to expect three active and four inactive keys; added Crystal Axolotl URL, deduplication/cache, lazy builder invocation, injected helper, handle, and extraction assertions.
- Updated `tests/pet-registry-parity.test.js` to expect 834 preload entries and validate the new module's byte count. Existing manifest, SFX, audio, and page-order checks were retained.
- Updated only the Service Worker version assertions in `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, and `tests/power-registry-parity.test.js`.
- Ran the official `tools/gen-preload-manifest.py` generator. The manifest increased from **833 to 834** entries; the only added key is `data/inventory/pet/crystal_axolotl/model.js`, with no removed keys. All 834 paths exist and their byte counts match disk.
- Service Worker token changed only from `ut-pwa-v195` to `ut-pwa-v196`. `CORE`, cache strategy, and fetch handler are unchanged.

## 6. Changed files

1. `assets/js/pet-viewer.js`
2. `assets/js/renderers/pet-model-registry.js`
3. `data/inventory/pet/crystal_axolotl/model.js` (new)
4. `assets/preload-manifest.json`
5. `sw.js`
6. `tests/pet-model-registry.test.js`
7. `tests/pet-registry-parity.test.js`
8. `tests/aura-registry-parity.test.js`
9. `tests/character-registry-parity.test.js`
10. `tests/dice-registry-parity.test.js`
11. `tests/power-registry-parity.test.js`

## 7. Static verification and remaining risk

- `node --check` passed for all changed JavaScript sources and test files.
- `git diff --check` passed.
- The extracted builder body matched the baseline exactly after line-ending normalization.
- Verified the registry has exactly three active and four inactive Pet keys, the inline Crystal Axolotl builder is absent, `pet.html` is unchanged, and the new model is not eagerly loaded.
- Verified the preload delta, absence of removed keys, and every generated path and byte count.
- No test suite, browser test, runtime test, benchmark, or regression test was run, as required. Runtime integration therefore remains unverified in this phase.

## 8. Git checkpoints

- Implementation commit: `cbf27caa8f1af44b7c8b1525d37223fed4925383`.
- Audit commit: `41e13dedb3edda07c7eb15dca72ce301c1bab0d0`.
- After pushing the audit commit, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched at `41e13dedb3edda07c7eb15dca72ce301c1bab0d0`; the worktree was clean.
- Local `main`, `origin/main`, and remote `refs/heads/main` remained `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- A report-only follow-up records these final verification results. Its own hash is included in the completion message because a commit cannot contain its own object hash.

**Target status: COMPLETED — CRYSTAL AXOLOTL MODEL EXTRACTED, REGISTRY CONTRACT PRESERVED.**
