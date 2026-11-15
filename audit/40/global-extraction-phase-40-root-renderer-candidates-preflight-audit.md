# Global Extraction Phase 40 — Root Renderer Candidates Preflight Audit

## 1. Baseline Git

- Active branch: `restruktur`.
- Baseline `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur`: `e85231c2486d35fc36604821c6f4b017c356c1fb`.
- Baseline local `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- Worktree was clean before the audit.
- No runtime, test, preload, or service-worker files were changed during this audit.

## 2. Executive summary

| Candidate | Recommended canonical location | Status | Main condition |
|---|---|---|---|
| `assets/js/frame-fx.js` | `assets/js/renderers/frame-fx.js` | **READY** | Move as one classic script; preserve its eight page load positions and FrameAvatar ordering. |
| `assets/js/aura-fx.js` | `assets/js/renderers/aura-fx.js` | **READY WITH CONDITIONS** | Move the generated output together with its generator, 15 manifest pointers, page paths, preload key, and path-sensitive tests. |
| `assets/js/blocky-character.js` | `assets/js/renderers/blocky-character.js` | **READY WITH CONDITIONS** | Move the generated output and update its canonical template/build target, seven HTML paths, the lazy Room loader, preload key, and tests atomically. |
| `assets/js/pet-viewer.js` | Shared viewer: `assets/js/renderers/pet-viewer.js`; item model definitions: `data/inventory/pet/<gameKey>/` | **NOT READY** | It currently combines page-lifecycle/viewer code with seven Pet-specific model builders. Agree on a split and registration/load contract before moving it. |

`assets/js/renderers/` already exists. The existing public globals and classic-script contract are the compatibility boundary; no ESM conversion, compatibility copy, alias, or duplicate initialization is recommended.

This is a read-only preflight. The only expected change from Phase 40 is this report. Test suites, browser tests, benchmarks, and runtime tests were not run.

## 3. Audit method and shared findings

The current candidate sources, generator inputs, all repository references to their paths and public globals, affected HTML script sequences, path-sensitive tests, data manifests, preload manifest, and service worker were inspected statically. The older `audit/5` reports were treated as historical context, not as the source of current path mappings.

All four runtime candidates are classic scripts and expose globals rather than ES module exports:

- AuraFX: `UT.AuraFX`.
- BlockyCharacter: `UT.BlockyCharacter`.
- FrameFX: `window.FrameFX`.
- PetViewer: `window.PetViewer`.

The generated AuraFX output has no runtime imports or exports. Its build inputs under `tools/aura-fx/src/` are ESM modules; `tools/aura-fx/build.js` bundles them into the existing classic global script. BlockyCharacter is generated verbatim from `tools/blocky-character/template.js`. A static byte comparison found the current template and runtime output identical: 64,432 bytes, SHA-256 `7F60BAF77B7BD7E1FE2D9B518CFD88975CFE94CB4193362F70EDBC6C1C8ED47C`.

No candidate uses `document.currentScript`, `import.meta.url`, `new URL()`, or runtime `import()`. The notable URL contracts are document-relative, not script-relative:

- FrameFX recognizes and returns `data/frame/<key>.webp`.
- PetViewer fetches SFX paths supplied by the Pet manifests through `UT.ItemRegistry`.
- Room lazily loads BlockyCharacter by appending a script with the literal URL `assets/js/blocky-character.js`.

The current preload manifest parses as JSON, has 830 entries, and contains all four candidates with byte counts matching their current file sizes:

| Current path | Manifest bytes | Actual bytes |
|---|---:|---:|
| `assets/js/aura-fx.js` | 59,215 | 59,215 |
| `assets/js/blocky-character.js` | 64,432 | 64,432 |
| `assets/js/frame-fx.js` | 31,305 | 31,305 |
| `assets/js/pet-viewer.js` | 50,774 | 50,774 |

`sw.js` is at `ut-pwa-v190`. None of the four paths is in `CORE` or explicitly named in the service worker. They are JavaScript requests handled by the existing network-first branch. Do not add them to `CORE` or change cache strategy as a consequence of moving them. The service worker's repository cache-version policy should be checked when a later implementation phase is authorized.

## 4. Candidate audit

### 4.1 AuraFX

**Status: READY WITH CONDITIONS**
**Recommended target:** `assets/js/renderers/aura-fx.js`

**Responsibility and API**

AuraFX is the shared procedural 3D aura engine: configuration/quality, particle pools, aura catalog, decorations, and the `AuraSystem`. It publishes `UT.AuraFX` with `AuraSystem`, `AURAS`, `getAura`, `RARITY`, `TIER`, `QUALITY`, and `detectQuality`. It requires the page's global Three.js r128.

`tools/aura-fx/build.js` reads `tools/aura-fx/src/{AuraConfig,AuraParticles,AuraCatalog,AuraDecor,AuraSystem}.js`, bundles their declared dependencies in order, and writes the generated classic script to the root `assets/js/aura-fx.js`. The ESM imports exist in those build inputs, not in the runtime bundle.

**Consumers and load order**

Direct page script consumers:

- `gameplay.html`
- `lobby.html`
- `karakter.html`
- `profile.html`
- `efek.html`

Three.js precedes AuraFX in these pages. AuraFX precedes the already-extracted `assets/js/renderers/aura-view.js` on Lobby, Profile, Character, and Gameplay. `efek.html` uses `UT.AuraFX` directly. AuraView is the indirect adapter consumer; page/controller consumers include `assets/js/pages/lobby.js`, `profile.js`, `karakter.js`, `efek.js`, and `gameplay/js/main.js`.

The 15 Aura manifests under `data/inventory/aura/<key>/manifest.js` point their `assets.renderer` field to the engine. `data/inventory/aura/index.js` repeats that locator in category metadata. These fields are path references; they do not dynamically load the renderer. `assets/js/item-catalog.js` also contains two explanatory references to the current path.

**Tests, tooling, registry, and cache**

Path/source-sensitive tests:

- `tests/aura-catalog.test.js`
- `tests/aura-fx.test.js`
- `tests/aura-registry-parity.test.js`
- `tests/aura-view.test.js`

The first three read the bundle or check page order. `aura-fx.test.js` and `aura-view.test.js` build runtime load paths from short filenames, so their path arrays/order assertions must be updated even where the full old path is not a literal.

The generator's output path, generated-file header, and console output in `tools/aura-fx/build.js` must change together with the generated file. The 15 Aura manifests, category index, five HTML paths, ItemCatalog comments, preload key, and tests are the known consumers to update. The official preload generator should regenerate the manifest only after implementation changes, with key-set comparison.

**Path, dependencies, and risks**

The candidate bundle has no script-relative asset paths, dynamic imports, or runtime fetches. Its runtime dependency is global `THREE`; AuraView must remain after AuraFX. No explicit service-worker reference exists.

Risk is medium: a stale manifest locator or generator target could leave the registry/build output pointing at the removed path, while a changed script order would break AuraView. Mitigate by changing all listed path references in one implementation checkpoint, preserving classic script order and the `UT.AuraFX` API, then statically checking generator parity, the 15 metadata locators, and preload key/size.

**Estimated implementation scope:** one generated-file move; one generator; five HTML files; 15 item manifests plus the Aura category index; ItemCatalog comments; four tests; and the preload manifest. No SW `CORE` or strategy change is indicated.

### 4.2 BlockyCharacter

**Status: READY WITH CONDITIONS**
**Recommended target:** `assets/js/renderers/blocky-character.js`

**Responsibility and API**

BlockyCharacter is the reusable Three.js voxel character rig/animation renderer. `UT.BlockyCharacter.create(THREE, opts)` returns the character instance API (rig root/hand, tick and movement, actions, tool/bow controls, player/data/preset loaders, configuration, and height). `createBaseRig(THREE, key, opts)` delegates to `UT.CharacterRigAdapter` when that optional operation is used.

The canonical source is `tools/blocky-character/template.js`; `tools/blocky-character/build.js` currently writes and parity-checks `assets/js/blocky-character.js`. The runtime file and template are presently byte-identical (see Section 3).

**Consumers and load order**

Direct script consumers:

- `gameplay.html`
- `lobby.html`
- `profile.html`
- `friendship.html`
- `leaderboard.html`
- `tambang.html`
- `efek.html`

The script loads after Three.js on the pages that create rigs, and after ItemCatalog/PlayerData where those globals are used by `create()`. `assets/js/pages/lobby.js`, `profile.js`, `tambang.js`, `efek.js`, and `gameplay/js/main.js` call the public renderer API. `assets/js/renderers/character-face.js` also calls it and documents it as a prerequisite.

Room is an additional lazy consumer: `assets/js/pages/room.js` appends scripts in this order: Three.js, BlockyCharacter, then CharacterFace. This URL is not an HTML script tag and must be included in any path migration.

BlockyCharacter accesses `ItemCatalog` and `PlayerData` when `create()` is called. `createBaseRig()` looks up `UT.CharacterRigAdapter` at call time; CharacterData provides that adapter. The editor page also publishes a separate `window.BlockyCharacter` API from `assets/js/pages/karakter.js`; it is not an alias for, or replacement of, `UT.BlockyCharacter` and must remain distinct.

**Tests, tooling, and cache**

Path-sensitive tests:

- `tests/blocky-actions.test.js`
- `tests/aura-fx.test.js`
- `tests/aura-view.test.js`
- `tests/blocky-character-generator.test.js`

The first three construct asset paths from short filenames and check script order. The generator test hard-codes the generated target. `character-rig-adapter.test.js` exercises the template/adapter rather than naming the runtime file, so no runtime-path update was found there.

Implementation must update `tools/blocky-character/build.js` target/check/error/log paths and the stale output-path note in `tools/blocky-character/template.js`, along with seven HTML paths, the Room lazy URL, the CharacterFace prerequisite comment, preload key, and the tests above. No service-worker path or `CORE` reference exists.

**Path and risks**

The runtime is a classic IIFE with no import/export, `document.currentScript`, `import.meta.url`, `new URL()`, or fetch path. Its important risks are the generator continuing to overwrite/check the removed path, Room's dynamic URL being missed, and consumers loading before required globals. The byte-identical template is positive evidence that the generator can continue to be the single source of truth after its target is changed.

Mitigate by moving the generated file only through the updated canonical build target, preserving all existing script order and `UT.BlockyCharacter`, updating the Room loader and test path arrays, and verifying byte parity and preload key/size. Do not introduce a wrapper file or alias named `window.BlockyCharacter`.

**Estimated implementation scope:** one generated-file move; generator and template note; seven HTML files; `assets/js/pages/room.js`; the CharacterFace comment; four tests; and the preload manifest.

### 4.3 FrameFX

**Status: READY**
**Recommended target:** `assets/js/renderers/frame-fx.js`

**Responsibility and API**

FrameFX is a shared procedural frame renderer. It owns 14 frame drawing/animation definitions, upgrades matching frame `<img>` elements to canvases, and runs a shared animation loop. Its classic-script global is `window.FrameFX`, exposing `keyOf`, `upgrade` (the document/root scan), `dataURL`, `frames`, and `ready`. It has an idempotency guard (`if (g.FrameFX) return`).

**Consumers and load order**

Direct script consumers:

- `friendship.html`
- `frame.html`
- `room.html`
- `lobby.html`
- `leaderboard.html`
- `karakter.html`
- `profile.html`
- `shop.html`

The helper scans existing `img[src*="data/frame/"]` elements on DOM ready and observes added nodes with a MutationObserver. Explicit `FrameFX.upgrade()` calls exist in `assets/js/pages/lobby.js` and `profile.js`. FrameAvatar's generated image elements are indirect consumers on Friendship, Leaderboard, and Room; those pages must continue loading FrameFX before `assets/js/renderers/frame-avatar.js`. The frame pages load the script after ItemCatalog, as asserted by `tests/frame-catalog-integration.test.js`.

**Tests, documentation, and cache**

Path/order-sensitive tests:

- `tests/frame-registry-parity.test.js`
- `tests/frame-catalog-integration.test.js`
- `tests/leaderboard-ui.test.js`
- `tests/lobby-appearance.test.js`

`assets/js/item-catalog.js` contains two comments naming the current script. The eight HTML paths, these four tests, the comments, and the preload key are the known update set. No generator, item manifest renderer pointer, or service-worker reference was found.

The renderer's URL contract is document-relative: it recognizes `data/frame/<name>.webp` and preserves that effective `.src` value on its replacement canvas. Moving the script itself does not change those image URLs.

**Risks and mitigation**

Risk is low to medium because the module is self-contained but globally observes the document. Preserve exactly one script inclusion per page, the `FrameFX` global/API, FrameFX-before-FrameAvatar ordering, and the document-relative frame URL. Update path references only; do not alter frame data, animation behavior, or cache policy.

**Estimated implementation scope:** one file move; eight HTML files; four tests; two ItemCatalog comments; and the preload manifest.

### 4.4 PetViewer

**Status: NOT READY for a one-file move**
**Recommended eventual split:** shared viewer/controller in `assets/js/renderers/pet-viewer.js`; Pet-specific model builders in their owning `data/inventory/pet/<gameKey>/` modules.

**Responsibility and API**

The file combines a reusable Three.js viewer/scene, camera and particle systems, input handling, audio loading/playback, and seven procedural Pet model builders plus the `PETS` definitions. It exposes only `window.PetViewer.select(id)`.

The seven model builders are selected directly by IDs held in the viewer's internal `PETS` array. The viewer also reads each Pet's `assets.sfx` from `UT.ItemRegistry.shared().getItem('pet.' + id)` and fetches those manifest paths. The current Pet manifests explicitly say that 3D visuals are not duplicated there; changing that ownership boundary is therefore an architecture change, not a path-only relocation.

**Consumers and page lifecycle**

The active root application has one script consumer, `pet.html`. It loads ItemRegistry, all seven Pet manifests and the Pet index, ItemCatalog, PlayerData/services, Three.js, PetViewer, and then `assets/js/pages/pet-page.js`. The page controller calls `window.PetViewer.select(selected.gameKey)`.

The viewer performs page-specific work at evaluation: it looks up `#fpv` and `#petGl`, attempts WebGL renderer creation, registers pointer/audio listeners and a ResizeObserver, and schedules an animation frame when the renderer is available. It therefore is not a side-effect-free module that can be preloaded or included on arbitrary pages. No `document.currentScript`, module-relative URL, or dynamic import is present. SFX `fetch()` URLs come from Pet manifests and are document-relative.

`referensi/newgui/game/pet.html` is a separate legacy/reference application that loads its own `js/pet-viewer.js` and `js/pet.js`; it is not a consumer of the root candidate and should not be repointed to it. Seven active Pet manifest comments mention the root path.

**Tests, registry, preload, and risk**

Path/source-sensitive tests:

- `tests/pet-registry-parity.test.js`
- `tests/pet-catalog.test.js`

The parity test reads and slices internal source text, checks the Pet page load order, and validates manifest-driven SFX behavior. A model/viewer split will require replacing brittle source-slice assumptions with assertions around the preserved public contract; this must not weaken SFX or registry validation.

A path-only move would touch `pet.html`, the two tests, seven manifest comments, the preload key, and the file itself. A correct ownership split additionally needs an agreed way to register/load each model definition before selection while preserving the single `PetViewer.select(id)` API and the existing manifest as the source for Pet metadata/SFX. `data/inventory/pet/index.js` currently registers item manifests only; it is not a renderer-module loader.

Risk is medium to high: script evaluation has DOM/WebGL/audio lifecycle side effects, model definitions are embedded in the viewer, and the current tests inspect internal source sections. Do not create a compatibility copy, duplicate the Pet model catalog, or change the Pet manifest/API contract as a shortcut. First settle the renderer/model boundary and exact classic-script load order; then audit that design before implementation.

**Estimated implementation scope:** at minimum, one viewer move, one HTML path, two tests, seven manifest comments, and the preload manifest. The recommended split adds seven Pet-owned model modules and a registration/load-path change whose exact files cannot be finalized until the boundary/API design is approved.

## 5. Cross-renderer dependencies and compatibility constraints

| Relationship | Existing contract to preserve |
|---|---|
| Three.js → AuraFX / BlockyCharacter / PetViewer | Continue loading the vendor classic script before each renderer. |
| AuraFX → AuraView | Keep `UT.AuraFX` assigned before `assets/js/renderers/aura-view.js` runs. |
| BlockyCharacter → CharacterFace | Keep `UT.BlockyCharacter` available before CharacterFace; Room's dynamic sequence is Three.js → BlockyCharacter → CharacterFace. |
| FrameFX → FrameAvatar | Keep FrameFX before FrameAvatar where both are loaded; the global MutationObserver upgrades the resulting frame images. |
| ItemRegistry + Pet manifests → PetViewer | Keep the seven manifests and registry available before viewer evaluation so manifest SFX mapping remains unchanged. |
| Character editor global vs renderer global | Keep `window.BlockyCharacter` in the editor separate from `UT.BlockyCharacter`; do not add a compatibility alias between them. |

There are no path-based dependencies between the four candidate files themselves. AuraFX and BlockyCharacter are used together in some page/test sequences, but do not import one another. The legacy `referensi/newgui` Pet viewer is a separate source and is not part of the root renderer migration.

## 6. Recommended implementation order

1. **FrameFX** — smallest independent path move; update all eight HTML pages, FrameAvatar ordering assertions, ItemCatalog comments, and preload in one checkpoint.
2. **AuraFX** — update the generated output path and generator together with all Aura page/data/test references; keep AuraFX before AuraView.
3. **BlockyCharacter** — update the generator/template and lazy Room loader along with HTML, test path arrays, CharacterFace prerequisite, and preload; keep `UT.BlockyCharacter`.
4. **PetViewer** — defer until the shared viewer versus Pet-owned model boundary and registration/load contract are agreed. Do not bundle this with any of the first three moves.

Separate implementation checkpoints are recommended for each ready candidate; do not combine all four into one move.

## 7. Expected implementation changes by candidate

| Candidate | Expected files / changes | Risk | Static verification for its implementation phase |
|---|---|---|---|
| FrameFX | Move to `assets/js/renderers/frame-fx.js`; update the eight HTML paths, four path/order tests, two `assets/js/item-catalog.js` comments, and preload key/size. | Low–medium: global DOM scan, image URL contract, and FrameAvatar ordering. | Verify each page has exactly one canonical script; FrameFX remains after ItemCatalog and before FrameAvatar; `data/frame/` URLs are unchanged; preload key set changes only for the move and size matches. |
| AuraFX | Move generated output to `assets/js/renderers/aura-fx.js`; update `tools/aura-fx/build.js`, five HTML paths, 15 Aura manifests, `data/inventory/aura/index.js`, ItemCatalog comments, four tests, and preload key/size. | Medium: generated path, registry pointers, global/API and AuraView order. | Verify build output equals generator result; all 15 manifest renderer pointers and category metadata use the canonical path; preserve `THREE` → AuraFX → AuraView order; verify preload key/size. |
| BlockyCharacter | Move generated output to `assets/js/renderers/blocky-character.js`; update `tools/blocky-character/build.js`, template path note, seven HTML paths, `assets/js/pages/room.js`, CharacterFace prerequisite comment, four tests, and preload key/size. | Medium: generated source truth, lazy script URL, global/API and dependent load order. | Verify template/output parity; all static and dynamic callers resolve to one canonical path; preserve Three.js/catalog/player-data order and CharacterFace order; verify preload key/size. |
| PetViewer | No implementation authorized by this audit. After a separate boundary decision: split shared renderer and seven item builders; then update `pet.html`, model registration/loading, two path/source tests, seven comments, and preload as applicable. | Medium–high: evaluation-time lifecycle, model/source ownership, ItemRegistry SFX path, and source-slicing tests. | Verify one-time initialization, unchanged `PetViewer.select(id)`, all seven IDs/models, manifest-driven SFX and page load order, with no duplicate renderer or model source. |

No candidate path appears in `sw.js` or `CORE`; no implementation should add them to `CORE` or change the fetch/cache strategy. Preserve existing preload and service-worker policy unless a separately approved audit identifies a specific need.

## 8. Intentionally unchanged

- All four runtime candidate files, their generators/templates, HTML, tests, manifests, preload manifest, and service worker.
- Public globals and APIs; classic-script evaluation and page script order.
- Aura/Frame/Pet item metadata, BlockyCharacter state/data contracts, Pet SFX paths, and root-relative page URLs.
- Historical references in `audit/5` and the separate `referensi/newgui` application.
- Service-worker `CORE`, cache-first/network-first behavior, and offline handling.

No test suite, browser test, benchmark, or runtime test was run.

## 9. Git checkpoint and final status

- Audit report path: `audit/40/global-extraction-phase-40-root-renderer-candidates-preflight-audit.md`.
- Audit commit: pending report creation.
- Final `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur`: to be recorded by the permitted report-only follow-up after the audit commit is pushed.
- Final worktree status and `main`/`origin/main` verification: to be recorded by that follow-up.

**Status: AUDIT COMPLETE — NO RUNTIME CHANGES.**
