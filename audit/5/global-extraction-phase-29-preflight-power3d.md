# Global Extraction Phase 29 — Power3D Relocation Preflight Audit

Status: **READY WITH CONDITIONS**
Scope: static, read-only audit of `assets/js/power3d/`. Phase 30 was not started.

## 1. Baseline Git

The branch was fetched and verified before the audit. No branch switch, merge, rebase, or `main` operation was performed.

| Ref / state | Baseline |
|---|---|
| Current branch | `restruktur` |
| `HEAD` | `90c7ef0c65f26e8d114faf1e2b7983e3974ce9de` |
| `origin/restruktur` | `90c7ef0c65f26e8d114faf1e2b7983e3974ce9de` |
| `main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Worktree before audit | Clean |

This agrees with the required Phase 28 baseline. The audit has not changed runtime files.

## 2. Recursive inventory

The directory contains 14 files, all JavaScript ES modules, with no nested directories. Total size: **116,224 bytes**.

| Current path | Proposed path | Bytes | Responsibility |
|---|---|---:|---|
| `assets/js/power3d/PowerAnimation.js` | `assets/js/renderers/power3d/PowerAnimation.js` | 6,924 | Animation state, transitions, and easing |
| `assets/js/power3d/PowerAura.js` | `assets/js/renderers/power3d/PowerAura.js` | 7,840 | Aura geometry/materials and generated radial texture |
| `assets/js/power3d/PowerCatalog.js` | `assets/js/renderers/power3d/PowerCatalog.js` | 11,010 | Visual/model definitions for the 17 Power models |
| `assets/js/power3d/PowerConfig.js` | `assets/js/renderers/power3d/PowerConfig.js` | 2,713 | Quality, rarity, tier, aura settings, and small helpers |
| `assets/js/power3d/PowerEffects.js` | `assets/js/renderers/power3d/PowerEffects.js` | 25,396 | Visual spawn, activation, impact, trail, and disappearance effects |
| `assets/js/power3d/PowerGeometry.js` | `assets/js/renderers/power3d/PowerGeometry.js` | 18,376 | Procedural Power model geometry |
| `assets/js/power3d/PowerLighting.js` | `assets/js/renderers/power3d/PowerLighting.js` | 3,579 | Scene lighting, environment, floor, and decal |
| `assets/js/power3d/PowerMaterials.js` | `assets/js/renderers/power3d/PowerMaterials.js` | 6,086 | Model materials and generated canvas textures |
| `assets/js/power3d/PowerParticles.js` | `assets/js/renderers/power3d/PowerParticles.js` | 8,016 | Particle styles and pooled particle rendering |
| `assets/js/power3d/PowerRegistry.js` | `assets/js/renderers/power3d/PowerRegistry.js` | 859 | Game-key/model-key lookup and Registry-backed lookup |
| `assets/js/power3d/PowerRenderer.js` | `assets/js/renderers/power3d/PowerRenderer.js` | 11,730 | Three.js scene, renderer, systems, input, and lifecycle orchestration |
| `assets/js/power3d/PowerSound.js` | `assets/js/renderers/power3d/PowerSound.js` | 9,327 | Synthesized WebAudio sounds for Power phases |
| `assets/js/power3d/power-overlay.js` | `assets/js/renderers/power3d/power-overlay.js` | 3,018 | Gameplay-facing reusable overlay adapter |
| `assets/js/power3d/power-show.js` | `assets/js/renderers/power3d/power-show.js` | 1,350 | Power-up-page preview adapter |

All 14 files should move together with names unchanged. The internal sibling imports remain valid when the directory is moved as one group.

## 3. Internal dependency map

The package is a cohesive renderer/effects engine, not a gameplay-rules subsystem:

- `PowerRenderer` composes `PowerCatalog`, `PowerConfig`, `PowerGeometry`, `PowerMaterials`, `PowerAura`, `PowerAnimation`, `PowerParticles`, `PowerEffects`, `PowerLighting`, and `PowerSound`.
- `PowerGeometry`, `PowerMaterials`, `PowerAura`, `PowerParticles`, `PowerEffects`, `PowerLighting`, and `PowerRenderer` use the bare `three` import specifier. `PowerGeometry`, `PowerAura`, and `PowerLighting` also use `three/addons/` modules.
- `PowerAnimation`, `PowerAura`, `PowerEffects`, `PowerGeometry`, `PowerLighting`, and `PowerMaterials` depend on `PowerConfig`; effects additionally reuse `PowerParticles`, `PowerAura`, and `PowerAnimation`.
- `power-show.js` and `power-overlay.js` both use the same sibling `PowerRenderer`, `PowerSound`, and `PowerRegistry` modules.
- `PowerRegistry` has no imports; it consults `UT.ItemRegistry.shared()` when available and retains a local game-key map as fallback.
- `PowerSound` uses WebAudio and can accept the gameplay audio context; it does not fetch sound files.

Static inspection found no `fetch()`, `new URL()`, `import.meta.url`, `document.currentScript`, worker, WASM, or external model/texture loader inside the directory. Geometry and several textures are generated procedurally/canvas-side.

## 4. External dependency and consumer map

### Active runtime

| Caller / integration | Current reference and behavior | Required update for relocation |
|---|---|---|
| `gameplay/js/power3d-loader.js` | Idle-scheduled dynamic import of `../../assets/js/power3d/power-overlay.js`; publishes the module as `UT.PowerOverlay` and `UT.PowerSound`. Import failure leaves the 2D fallback available. | Change the import target and active path comment to `../../assets/js/renderers/power3d/power-overlay.js`; keep idle scheduling and fallback unchanged. |
| `gameplay.html` | Import map at the top maps `three` and `three/addons/` to the existing r170 vendor modules. The module tag for `gameplay/js/power3d-loader.js` is at line 191, after the DiceKit entry and before `dice-pad.js` and `audio.js`. | No tag path changes; preserve import-map placement and script order. |
| `gameplay/js/main.js` | Consumes `UT.PowerOverlay.supports()` / `playAt()` and falls back to `UT.PowerFX`; gameplay continues to choose the authoritative Power result. | No direct file-path change. Preserve API and fallback. |
| `gameplay/js/audio.js` | Uses `UT.PowerSound` when synthesized sound is appropriate; optional file sounds and legacy `pop()` fallback remain separate. A comment names the old module path. | Update only the active path comment. Do not change audio selection or fallback behavior. |
| `assets/js/pages/powerup.js` | Lazy `import('../../../assets/js/power3d/power-show.js')`; mounts the renderer and falls back to ItemArt on import/WebGL failure. `powerup.html` loads this page script at the end and has an import map before module use. | Change the import to `../../../assets/js/renderers/power3d/power-show.js` and update its active path comment; retain lazy load, promise/state guard, and fallback. |
| `data/inventory/power/index.js` | Nine `CATEGORY.assets` locators point to catalog, registry, geometry, materials, animation, effects, particles, aura, and audio modules. | Update those nine strings to `assets/js/renderers/power3d/...`; preserve Registry metadata and semantics. |
| `data/power/power-fx.js` | The 2D fallback has a comment describing the visual catalog's current path. | Update only the active path comment. The fallback stays outside the group. |

`Power3D` does not expose a readiness event. Gameplay readiness is represented by the idle import promise and the subsequent assignment to `UT`; the Power-up page uses its import promise and local state. No direct `<script src>` points to a file in the directory.

### Tooling, tests, preload, and documentation

| Caller / file | Finding and future action |
|---|---|
| `tools/power-icons/bake.html` | Two static imports (`PowerRenderer.js` and `power-show.js`) use `../../assets/js/power3d/`. Update both. Its import map points at the same Three r170 vendor modules. |
| `tools/power-icons/bake.py` | Active usage documentation names `assets/js/power3d`; update the path comment. The tool writes generated icons under `data/power/3d/`, outside the renderer group. |
| `tests/power3d.test.js` | Reads `PowerCatalog.js`, scans the old directory, resolves sibling imports from the old root, and asserts the Power-up dynamic-import path. Update the root and path assertions; retain the full-module/import checks. |
| `tests/power-rules.test.js` | Reads `PowerSound.js` from the old path and checks the loader's old overlay import. Update those path expectations. |
| `tests/power-registry-parity.test.js` | Uses `pathToFileURL` to import `PowerCatalog.js`, `PowerSound.js`, and `PowerRegistry.js` from the old path. Update all three. |
| `tests/gameplay-assets-external.test.js` | Lists `gameplay/js/power3d-loader.js`, whose own location remains unchanged; no directory-path update is indicated. |
| Service-worker version assertions | `tests/power-registry-parity.test.js`, `tests/aura-registry-parity.test.js`, and `tests/character-registry-parity.test.js` assert v182; `tests/dice-registry-parity.test.js` asserts v186. Actual `sw.js` is v186. The Power assertion is already stale, as are the other v182 assertions. A future v187 change must align the relevant assertions; do not treat these as relocation failures or edit them in this preflight. |
| `assets/preload-manifest.json` | Contains 14 old directory keys. Replace all 14 with the new keys and verify actual byte counts; review any generator diff for unrelated stale entries. |
| `sw.js` | No Power3D-specific path was found. Its documented policy requires a version bump when assets move; current version is `ut-pwa-v186`, so the relocation implementation should set `ut-pwa-v187` without other cache changes. |
| `README.md`, `referensi/newgui/README.md` | Describe the current directory; update these active structure references in the relocation phase. |
| Historical audits | `audit/5/global-folder-foundation.md`, `global-structure-audit.md`, `stage-1-core-architecture.md`, `global-extraction-phase-4.md`, and `global-extraction-phase-15.md` contain historical paths. Leave them unchanged as historical evidence. |

The 17 generated icon files in `data/power/3d/` total 339,894 bytes. They are separate manifest-referenced output assets, not files under `assets/js/power3d/`. The `data/power/power-fx.js`, Gameplay particle engine/CSS, gameplay audio, vendor Three.js, Power manifests, and icon PNGs remain outside the move.

## 5. Runtime contract and lifecycle

- **Loading:** All Power3D implementation files are ES modules. Gameplay and Power-up pages have import maps before use; `tools/power-icons/bake.html` also has an import map. Three.js remains the existing r170 vendor module resolved through those maps. The renderer does not receive or combine the Gameplay global Three namespace.
- **Public renderer surface:** `PowerRenderer` exposes `list`, `collections`, `show`, `next`, `activate`, `disappear`, `respawn`, `setSound`, `setQuality`, `setAuraProps`, `setParticleProps`, `stats`, `start`, `stop`, `resize`, and `dispose`.
- **Adapters:** `power-show.js` exposes `mount`, `supports`, and `KEY_TO_POWER3D`; the mounted object exposes `show`, `activate`, `setSound`, `start`, `stop`, `destroy`, and its renderer. `power-overlay.js` exposes `supports`, `playAt`, and `PowerSound`. The Gameplay loader attaches `UT.PowerOverlay` and `UT.PowerSound`.
- **Results and data ownership:** Power3D only displays the selected model/effect. Gameplay determines and owns the result and effect trigger. `PowerRegistry` reads visual model metadata when available and retains its fallback mapping. Power manifests, ItemCatalog, PlayerData, equip state, and transaction logic are outside this group.
- **Evaluation side effects:** The modules define data, functions, and classes. `power-overlay.js` has module-local singleton/timer state; the gameplay loader schedules an idle import. Renderer construction—not import alone—creates the WebGL renderer and registers input, visibility, and resize handlers. AudioContext creation is lazy through `PowerSound.ensure()`.
- **Caches and lifecycle:** The module loader's URL cache keeps imports shared when every caller uses one canonical URL. `PowerAura` keeps a module-level radial texture; `PowerSound` keeps module-level audio state; the gameplay overlay reuses one renderer. `PowerRenderer` owns its animation loop, `ResizeObserver`, visibility and pointer/wheel listeners, and GPU resources; `dispose()` stops/disposes them. `power-show` provides `destroy()`, while the inspected Power-up page path mounts and starts the renderer but does not call `destroy()` when it hides the preview. This is a pre-existing lifecycle/performance concern; it is not caused by relocation and must not be silently changed during a structural move. The gameplay overlay intentionally stops and hides its renderer for reuse.
- **Events:** No Power3D-specific readiness event was found. Existing gameplay and page import/fallback behavior is the readiness contract.
- **Existing comments:** `PowerRenderer.js` has an older “15 item” description while the current catalog/manifests cover 17 Power entries. This is pre-existing documentation drift, not a relocation dependency.

## 6. Target evaluation and path plan

**Recommended target: `assets/js/renderers/power3d/`.** This matches the responsibility of the cohesive package: procedural model rendering, visual effects, animation, particles, lighting, and preview/gameplay rendering adapters. `assets/js/systems/power3d/` would imply gameplay/system ownership that the modules do not have. This target is also consistent with `audit/5/global-folder-foundation.md`.

Move all 14 files using the one-to-one mapping in the inventory table. Do not split out the adapters, registry bridge, or sound module: the adapters import shared renderer modules, and one canonical directory preserves sibling resolution and ESM module identity.

The directory target did not exist during this audit and was not created. For Phase 30, update the runtime imports, nine Registry locators, the two bake-tool imports, the three path-sensitive tests, the 14 preload keys, and active documentation/comments listed above. Leave the external vendor modules, generated icons, gameplay fallback/audio systems, manifests, and historical audits in place.

## 7. Risk assessment

**READY WITH CONDITIONS** — the full module group and all known references are identified; the move is structurally safe if performed atomically with the path updates below.

1. **ES-module identity / duplicate instances:** ESM caches by resolved URL. An old and new URL could instantiate duplicate renderer/audio state and caches. Update every active caller and preload key in the same implementation checkpoint; do not leave a compatibility copy or alias.
2. **Relative imports and Three.js:** Keep all 14 modules together. Their sibling imports then remain valid; bare `three` and `three/addons/` continue resolving through the existing import maps. Do not replace these with the Gameplay global Three namespace.
3. **Lazy loader and fallback:** Change only the module URL and active path comments; keep idle timing, import promise, `UT` assignment, and 2D fallback.
4. **Preload/cache:** Replace all 14 manifest keys and check exact bytes. Bump `sw.js` from v186 to v187 for the moved asset URLs; do not change cache strategy or unrelated CORE entries.
5. **Existing lifecycle concern:** The Power-up page does not call the adapter's `destroy()` from its inspected hide path, so its started renderer may remain active until page teardown. Record separately; do not fold a lifecycle behavior change into a relocation.
6. **Tooling and docs:** Update active bake-tool and current README references, but retain historical audit paths.

No unresolved import target, dynamic loader, worker/WASM dependency, or external model/texture URL was found. No risk requires a code change during this preflight.

## 8. Static checks and scope confirmation

- Confirmed 14 JavaScript files, no subdirectories, 116,224 bytes total; all listed sizes were read from the current files.
- `node --check` passed for all 14 modules. No module was executed.
- Parsed `assets/preload-manifest.json`; all 14 current Power3D keys were unique and their values matched the actual file byte counts.
- Verified each relative module import resolves from the current directory and each `three/addons/` import resolves to the current vendor addon file.
- Verified the two runtime import maps parse and point to existing vendor targets; statically resolved the current Gameplay/page dynamic imports, two bake-tool imports, and nine Registry locators.
- Confirmed the preload key set exactly matches all 14 current module paths and checked for duplicate textual Power3D preload keys.
- Inspected service-worker-version assertions without running tests; the stale values are recorded in Section 4.
- Confirmed both proposed target directories were absent; neither was created.
- `git diff --check` passed before report creation; it will be repeated for the audit commit.
- No test suite, browser test, benchmark, or runtime validation was run.
- **No runtime, HTML, CSS, data, manifest, preload, service-worker, or test file was changed during this audit.**
- Phase 30 has not been started.

## 9. Audit checkpoint

The audit-only commit is `d13fd18f476c52a71748671ed3fe2f67dc4c7cdb` (`docs(audit): preflight Power3D relocation`). It contains only this report and was pushed to `origin/restruktur`.

Post-push verification at that checkpoint:

- Branch: `restruktur`.
- `HEAD == origin/restruktur == d13fd18f476c52a71748671ed3fe2f67dc4c7cdb`; the remote `refs/heads/restruktur` matched.
- `main == origin/main == aeb11acf130df4ade4acc9417f01470e40a33dbb`; the remote `refs/heads/main` matched.
- Worktree clean.

A separate report-only follow-up records this hash and verification. It changes no runtime or test files. The final post-follow-up verification is reported with task completion; no operation targets `main`.
