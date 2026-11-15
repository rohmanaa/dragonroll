# Global Extraction Phase 27 — Dice Kit Relocation Preflight

## 1. Scope and Git baseline

- Scope: read-only audit of the complete `assets/js/dice-kit/` directory and all repository references. No runtime relocation or Phase 28 implementation was started.
- Branch: `restruktur`.
- `HEAD` and fetched `origin/restruktur`: `da2fdf7929709315c057b2944da7420f0509b115`.
- Worktree before audit: clean.
- `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `git ls-remote` at baseline confirmed those remote branch hashes.
- Neither local `main` nor `origin/main` was changed.
- Neither candidate target directory (`assets/js/renderers/dice-kit/` and `assets/js/systems/dice-kit/`) existed at audit time.

## 2. Recursive inventory

The directory contains 11 tracked files, all JavaScript ES modules, with no nested directories or hidden files. Combined size: **125,871 bytes**.

| Current path | Type | Bytes | Responsibility |
|---|---:|---:|---|
| `assets/js/dice-kit/DiceAnimation.js` | ES module | 13,353 | Dice animation state machine; coordinates idle, windup, roll, settle, result, physics, and effect callbacks. |
| `assets/js/dice-kit/DiceCatalog.js` | ES module | 18,837 | D6 face orientations, visual rarity/effect/quality presets, 23 die visual records, lookup/validation, and a fair-D6 helper. |
| `assets/js/dice-kit/DiceEffects.js` | ES module | 452 | Binds the reusable effect factory to the local Three r170 module and exports the effect class/recipe names. |
| `assets/js/dice-kit/DiceEffectsCore.js` | ES module | 35,777 | Injectable-Three effect factory: pooled particles, rings/pillars, aura/flash, landing/idle recipes, and procedural WebAudio sound. |
| `assets/js/dice-kit/DiceMaterials.js` | ES module | 2,622 | Builds six procedural face materials and an LRU material/texture cache with disposal. |
| `assets/js/dice-kit/DicePhysics.js` | ES module | 11,915 | Three-independent quaternion and fixed-step D6 rigid-body simulation, collision, settling, and forced-face alignment. |
| `assets/js/dice-kit/DiceRenderer.js` | ES module | 17,188 | WebGL renderer, scene/environment/lighting/arena/pad construction, die API, animation loop, resize/visibility lifecycle, and disposal. |
| `assets/js/dice-kit/DiceTextures.js` | ES module | 15,617 | Canvas-only face/pip/pattern generation, face and isometric thumbnail data URLs, and module-level data-URL caches. |
| `assets/js/dice-kit/index.js` | ES module entry point | 1,522 | Exposes the `window.DiceKit` API and emits `dicekit-ready`. |
| `assets/js/dice-kit/RoomEnvironment.js` | ES module | 3,779 | Procedural Three scene used to bake the renderer's environment map; includes resource disposal. |
| `assets/js/dice-kit/RoundedBoxGeometry.js` | ES module | 4,809 | Rounded box geometry with face UV generation for the shared D6 mesh. |

`DiceCatalog.js` has an existing comment describing 20 dice, while its current data and validator contain/expect 23; this pre-existing wording mismatch is not a relocation change.

## 3. Internal dependency map and module groups

```text
index.js
  ├─ DiceRenderer.js
  │   ├─ RoundedBoxGeometry.js
  │   ├─ RoomEnvironment.js
  │   ├─ DiceCatalog.js
  │   ├─ DiceMaterials.js ── DiceCatalog.js, DiceTextures.js
  │   ├─ DiceEffects.js ──── DiceEffectsCore.js
  │   └─ DiceAnimation.js ── DicePhysics.js, DiceCatalog.js
  ├─ DiceCatalog.js
  └─ DiceTextures.js ─────── DiceCatalog.js
```

Six modules import `assets/js/vendor/three.r170.module.min.js`: `DiceAnimation.js`, `DiceEffects.js`, `DiceMaterials.js`, `DiceRenderer.js`, `RoomEnvironment.js`, and `RoundedBoxGeometry.js`. The remaining internal dependencies are sibling-relative imports. `DicePhysics.js` is pure simulation/math apart from its D6 face-table import. `DiceEffectsCore.js` has no imports and accepts a Three namespace as an argument.

The cohesive groups are:

- Public module entry and renderer: `index.js`, `DiceRenderer.js`.
- Scene geometry/environment: `RoundedBoxGeometry.js`, `RoomEnvironment.js`.
- Simulation and animation: `DicePhysics.js`, `DiceAnimation.js`.
- Visual catalog/material/texture: `DiceCatalog.js`, `DiceMaterials.js`, `DiceTextures.js`.
- Effects: `DiceEffectsCore.js` and the r170 adapter `DiceEffects.js`.

All 11 files belong in one relocation group; none is a separate data manifest or standalone page script.

## 4. External dependencies and asset resolution

- The six Three r170 imports resolve from the current directory to `assets/js/vendor/three.r170.module.min.js`. At `assets/js/renderers/dice-kit/`, each `../vendor/three.r170.module.min.js` must become `../../vendor/three.r170.module.min.js`. Sibling imports remain sibling-relative.
- Gameplay separately supplies its global `THREE` (the classic `assets/js/vendor/three.min.js`) to `DiceEffectsCore.createDiceEffects(THREE)`. This is intentionally separate from DiceKit's r170 module graph; two Three versions must not be conflated.
- No file in the directory uses `fetch()`, `new URL()`, `import.meta.url`, `document.currentScript`, a worker, WASM, or a runtime external URL. The only external URL found inside the directory is the source-attribution comment in `RoomEnvironment.js`.
- Dice faces, patterns, thumbnails, geometry, environment, and DiceKit sound are generated in code/canvas/WebAudio. There are no image, font, model, or audio files owned by this directory. `assets/sfx/dice/dice-roll.mp3` is separately owned by Gameplay's audio map and is not a DiceKit dependency.

## 5. Runtime consumers and contracts

### Entry module and global API

All files are ES modules; `index.js` is loaded with `type="module"`, not as a classic script. It installs `window.DiceKit` with:

- `has(key)`, `keys()`, and `thumb(key, px)`.
- `create(container, opts)` and `mount(container, opts)`.
- `STAGE`, the shared transparent-stage preset.

`create()`/`mount()` return a `DiceRenderer` instance. Its existing consumer contract includes `equip`, `roll`, `rollWhenReady`, `toIdle`, `showFace`, `finish`, `busy`, `setQuality`, `setSound`, `setVolume`, `setPixelScale`, `start`, `stop`, and `dispose`.

At entry-module evaluation, `window.DiceKit` is assigned and `dicekit-ready` is dispatched. There is no duplicate-load guard. Loading both old and new module URLs would create distinct ES-module identities/caches, replace the global API, and dispatch the event again; do not retain or load a compatibility alias.

### Page loaders and direct consumers

| Loader / consumer | Current relationship |
|---|---|
| `dadu.html` | Loads `assets/js/dice-kit/index.js` as a module after classic Three and before `assets/js/pages/dadu.js`. The page script reads catalog/equip state from `ItemCatalog`/`PlayerData`, uses `DiceKit.has/thumb/mount`, and waits for `dicekit-ready` when necessary. |
| `gameplay.html` | Loads the same entry module after `gameplay/js/dice-ui.js` and `gameplay/js/dice-throw.js`; the entry's module position and type are part of the loading contract. |
| `gameplay/js/dice-ui.js` | Classic-script adapter; mounts DiceKit when available or listens once for `dicekit-ready`. Gameplay supplies the outcome; DiceKit only displays the requested face. |
| `gameplay/js/dice-throw.js` | Classic-script gameplay adapter; directly imports `DiceTextures.js`, `DiceCatalog.js`, and `DiceEffectsCore.js` with `import(new URL(path, document.baseURI))`. It passes Gameplay's Three namespace to the effects factory and preserves the game-selected result. These are document-base-relative URLs, not paths relative to `dice-throw.js`. |
| `assets/js/pages/dadu.js` | Dedicated dice shop/preview page; uses the global renderer for preview and visual thumbnails while `ItemCatalog` and `PlayerData` remain responsible for item metadata, price, ownership, and equip state. |
| `room.html` → `assets/js/renderers/room-dice-art.js` → `assets/js/pages/room.js` | Room loads the separate ES-module art adapter. It imports `DiceCatalog.js` and `DiceTextures.js`, exposes `window.RoomDiceArt.thumb()`, emits `room-dice-art-ready`, and Room uses it for equipped-dice thumbnails. Room does not load DiceKit's `index.js`. |

There are **three direct global DiceKit consumer scripts** (`dadu.js`, `dice-ui.js`, `dice-throw.js`), plus the Room art adapter/page pair. Two HTML pages load the DiceKit entry module; Gameplay also has three direct dynamic imports from the directory.

The generic `shop.html` and `inventory.html` code do not directly load or call DiceKit. The dice purchase/equip UI is the dedicated `dadu.html` page. `ItemCatalog`/the Dice Registry and `PlayerData` retain the item/equip source of truth; the DiceKit catalog is visual data keyed by `gameKey`. The gameplay result remains owned by Gameplay, with the renderer receiving the forced face.

### Side effects, caches, and lifecycle

- Module evaluation builds the catalog lookup map and texture caches; `DiceEffects.js` creates its class adapter. The entry module alone assigns the public global and emits its ready event.
- `DiceTextures.js` has module-level `FACE_CACHE` and `THUMB_CACHE`. `DiceMaterials.js` maintains an instance-level LRU cache (default maximum three die variants). These depend on loading a single canonical module URL.
- `DiceRenderer` constructor creates the WebGL renderer and registers `resize`, `visibilitychange`, and optional `ResizeObserver` handlers, then starts its Three animation loop. `dispose()` stops it, removes listeners, disconnects the observer, disposes GPU/audio resources, and removes the canvas.
- `DiceEffectsCore` uses per-instance particle/ring/pillar/timer state and lazily creates `AudioContext` on sound use; disposal closes it. No directory module registers a global event listener during module evaluation.
- Preserve `dicekit-ready`, existing HTML script positions/types, the lazy mount flow, the separate Room art ready event, and all disposal behavior.

## 6. Repository references and proposed path changes

Recommended target: **`assets/js/renderers/dice-kit/`**, retaining all 11 filenames. The code renders dice and supplies visual material/effect/animation; its physics only presents a game-selected result. This matches the existing Global Folder Foundation mapping. `systems/` would misclassify the user-facing rendering group.

| Current reference | Required target/reference for the recommended destination | Classification |
|---|---|---|
| `assets/js/dice-kit/<11 files>` | `assets/js/renderers/dice-kit/<same filenames>` | Move the complete group; rebase the six vendor imports noted above. |
| `dadu.html`, `gameplay.html` entry `src` | `assets/js/renderers/dice-kit/index.js` | Active static module loaders; preserve `type="module"` and exact tag order. |
| `gameplay/js/dice-throw.js` three `new URL(..., document.baseURI)` imports | `assets/js/renderers/dice-kit/{DiceTextures,DiceCatalog,DiceEffectsCore}.js` | Active dynamic imports; keep the same document-base resolution and fallback behavior. |
| `assets/js/renderers/room-dice-art.js` imports `../dice-kit/{DiceCatalog,DiceTextures}.js` | `./dice-kit/{DiceCatalog,DiceTextures}.js` | Active sibling-relative module imports; Room adapter itself stays in `renderers/`. |
| `data/inventory/dice/index.js` `CATEGORY.assets.renderKit` | `assets/js/renderers/dice-kit/DiceCatalog.js` | Active category locator; do not change registry or item data semantics. |
| `assets/preload-manifest.json` | Replace all 11 old keys with new paths and actual sizes | Active preload list; current entries match current file sizes. |
| `tests/dice-landing-stall.test.mjs` | Update direct `DiceAnimation.js` and `DiceCatalog.js` imports | Test module imports. |
| `tests/dice-registry-parity.test.js` | Update source reads, dynamic `pathToFileURL` import, module-existence paths, and its protected-directory scope | Test path assertions and source inspection. Its existence list currently omits `RoomEnvironment.js` and `RoundedBoxGeometry.js`. |
| `tests/dice-sound-variation.test.js` | Update `DiceEffectsCore.js` source path | Test source read. |
| `tests/room-page-modal.test.js` | Change the two asserted Room adapter imports from `../dice-kit/` to `./dice-kit/` | Test import assertions. |

Additional non-runtime path mentions found and classified:

- `gameplay/js/dice-ui.js` and `gameplay/js/dice-pad.js`: comments only; update if keeping source comments aligned with the new location.
- All 23 `data/inventory/dice/<key>/manifest.js` files (keys: `amethyst`, `copper`, `diamond`, `dragon`, `emas`, `emerald`, `ender`, `frost`, `iron`, `klasik`, `lapis`, `magma`, `netherite`, `obsidian`, `prismarine`, `quartz`, `redstone`, `rumput`, `sculk`, `stone`, `tnt`, `void`, `wood`): comments only; no per-item `assets` path is registered. Update comments only if desired; changing them also changes their generated preload byte counts.
- `referensi/newgui/README.md`: project reference documentation; refresh its current-path references if it is intended to describe the live tree.
- Historical audit documents with old paths, left unchanged: `audit/5/global-extraction-phase-4.md`, `global-extraction-phase-6.md`, `global-extraction-phase-15.md`, `global-folder-foundation.md`, `global-structure-audit.md`, `stage-1-core-architecture.md`, `stage-4-pet-registry.md`, and `stage-5-dice-registry.md`.

No DiceKit path was found in CSS, worker/WASM code, service-worker static lists, or other configuration. `tools/gen-preload-manifest.py` has no hard-coded DiceKit path; it recursively includes JavaScript under `assets`, `data`, `gameplay`, `hud`, and `promosi`, so it will pick up the new path and recompute sizes. Its full generated diff must be reviewed because regeneration can also refresh unrelated stale sizes.

## 7. Preload, service worker, and test findings

- `assets/preload-manifest.json` contains **11** DiceKit entries. Each currently matches the corresponding file size; combined bytes are 125,871.
- `assets/js/preloader.js` fetches the manifest and preloads its listed URLs. `sw.js` has no DiceKit path in `CORE`; same-origin code requests use its generic network-first/cache-fallback handling, so no direct service-worker path edit is indicated.
- The service-worker header policy says to increment `VERSION` when an asset is changed or added. The current version is `ut-pwa-v185`; Phase 28 should apply that policy if the relocation is implemented and refresh any version-specific test expectation.
- Static inspection found a pre-existing assertion mismatch: `tests/dice-registry-parity.test.js` expects `ut-pwa-v182`, while current `sw.js` declares `ut-pwa-v185`. This audit did not execute the test or alter either file.
- Tests and browser tests were not run. The path references above are the complete direct test references found; `tests/gameplay-dice-throw-race.test.mjs` uses a `DiceKit` stub but contains no directory URL.

## 8. Evaluation, risks, and mitigation

### **READY WITH CONDITIONS**

No unresolved external dependency prevents moving all 11 files together. The move is safe once Phase 28:

1. Uses `assets/js/renderers/dice-kit/`, not `systems/`, and moves all 11 files atomically.
2. Rebases the six relative Three imports and updates every active loader, dynamic import, Room adapter import, and category locator listed above.
3. Preserves the module script tags' type/order, `window.DiceKit` API, `dicekit-ready` dispatch, the separate Room adapter contract, Gameplay-authoritative outcomes, and renderer disposal/lifecycle.
4. Does not leave an old-path alias or mixed old/new imports; the global entry has no duplicate-load guard and ES-module URL identity affects caches and module singletons.
5. Regenerates/reviews preload paths and byte counts, follows the SW version policy, and reconciles the already-stale version assertion when updating relevant tests.
6. Keeps vendor modules, Room adapter, Gameplay adapters, registry/manifests, and the Gameplay audio asset outside the moved directory; update only their path references/comments as appropriate.

No code, HTML, CSS, data, manifest, preload, service-worker, configuration, or test file was changed during this read-only audit.

## 9. Static audit checks

- Recursive filesystem and tracked-file inventory agree: exactly 11 files, all `.js`, no nested/hidden files; 125,871 bytes total.
- Repository-wide tracked and source searches covered static/dynamic imports, relative imports, metadata, tests, tooling, preload, service worker, CSS, and historical documentation.
- All 11 DiceKit files passed `node --check` (static parse only).
- All 11 current preload entries were parsed and size-checked against the files.
- Baseline worktree was clean. Test suites and browser tests were not run.

## 10. Audit checkpoint and final Git verification

- Audit-only commit containing this report: `acf29d1fbcd7962b1bff35a23d1e4c7867e02096`.
- The audit commit was pushed to `origin/restruktur`; `git ls-remote` confirmed the remote branch at that hash.
- At that checkpoint, `HEAD == origin/restruktur == acf29d1fbcd7962b1bff35a23d1e4c7867e02096` and the worktree was clean.
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- A report-only follow-up records this audit hash and the checkpoint verification. Its hash and the final post-push branch/worktree verification are included in the completion report.
- No implementation commit is expected; no runtime files were changed.
