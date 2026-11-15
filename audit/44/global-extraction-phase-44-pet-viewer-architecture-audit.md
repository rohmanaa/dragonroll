# Global Extraction Phase 44 — PetViewer Architecture & Boundary Audit

## 1. Baseline Git

- Branch: `restruktur`.
- Phase 44 baseline: `d22d8250e57fd5cf5d4e1e11cc8300777606e42d`.
- At baseline, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched; the worktree was clean.
- Baseline `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- No runtime, test, configuration, or data file was changed during this audit.

## 2. File inventory and size

### Active root Pet implementation

| File | Bytes | Current responsibility |
|---|---:|---|
| `assets/js/pet-viewer.js` | 50,774 | Classic-script viewer, seven model builders, animation, particles, camera/input, and Pet audio |
| `assets/js/pages/pet-page.js` | 15,895 | Pet catalog UI, account actions, metadata, and calls to `PetViewer.select(gameKey)` |
| `pet.html` | 4,767 | Loads the Pet data chain, Three.js r128, viewer, and page controller |
| `data/inventory/pet/index.js` | 2,556 | Pet category keys and ItemRegistry manifest registration; no model loader |
| `assets/js/core/item-registry.js` | 12,309 | Manifest validation and shared ItemRegistry |
| `assets/js/item-catalog.js` | 42,737 | Public item catalog, including the Pet fallback/Registry integration |
| `assets/js/vendor/three.min.js` | 603,451 | Global Three.js r128 dependency |

### Existing Pet-owned content

There are seven manifest/PNG pairs. There is no separate model-builder file today; each builder is embedded in `assets/js/pet-viewer.js`.

| Tier | `gameKey` | Embedded builder | Manifest bytes | Existing PNG bytes |
|---:|---|---|---:|---:|
| 1 | `forest_pup` | `petPup()` (lines 116–174) | 1,303 | 63,044 |
| 2 | `copper_golem` | `petGolem()` (lines 175–236) | 1,308 | 65,279 |
| 3 | `crystal_axolotl` | `petAxolotl()` (lines 237–299) | 1,352 | 64,581 |
| 4 | `arcane_owl` | `petOwl()` (lines 300–369) | 1,295 | 70,048 |
| 5 | `storm_wolf` | `petWolf()` (lines 370–449) | 1,301 | 64,556 |
| 6 | `inferno_dragon` | `petDragon()` (lines 450–533) | 1,339 | 66,689 |
| 7 | `celestial_kitsune` | `petKitsune()` (lines 534–621) | 1,393 | 67,714 |

Each current manifest owns its catalog fields, `visual` palette, card `assets.image`, and three `assets.sfx` paths. The PNGs are already under their matching Pet folders and must remain there without copies.

### Related tests and runtime infrastructure

| File | Bytes | Relevance |
|---|---:|---|
| `tests/pet-registry-parity.test.js` | 23,029 | Manifest/catalog/SFX/preload parity; includes source slicing into PetViewer |
| `tests/pet-catalog.test.js` | 8,259 | Catalog/server/UI integration; checks the Pet page includes the viewer |
| `tests/pet-ui.test.js` | 2,736 | Pet modal and CSS assertions; no PetViewer/model contract |
| `assets/preload-manifest.json` | 39,597 | 830 entries, including the viewer, seven manifests, seven PNGs, and Pet SFX |
| `assets/js/preloader.js` | 6,812 | `runAuto()` fetches the generated manifest and all its entries |
| `assets/js/pages/splash.js` | 5,970 | Calls `UT_Preload.runAuto()` on the normal Splash path |
| `tools/gen-preload-manifest.py` | 1,286 | Scans `assets/` and `data/`, including `.js` files |
| `sw.js` | 3,530 | Current cache token `ut-pwa-v193`; PetViewer is not in `CORE` |

The 21 current Pet SFX files under `assets/sfx/pet/` total **650,612 bytes**.

`referensi/newgui/game/pet.html` and `referensi/newgui/game/js/pet-viewer.js` (48,250 bytes) are a separate legacy/reference app with its own local viewer and controller. They are not consumers of the root viewer and are outside the proposed migration.

## 3. Shared viewer versus Pet-owned model builders

### Shared responsibilities that belong with PetViewer

The current viewer owns the canvas/WebGL renderer, scene, camera and lighting, resize behavior, pointer controls, requestAnimationFrame loop, shared `Particles` object and `emit()` function, selection state, model replacement, and the public `window.PetViewer.select(id)` API. It also owns shared Pet audio: synthesized fallback sounds, Web Audio context/master gain, manifest SFX resolution through ItemRegistry, fetching/decoding, and playback scheduling. These are shared viewer/controller concerns, not Pet content.

The root viewer is a classic script and expects global Three.js (`THREE` r128), `window.PlayerData`, `UT.Prefs`, `UT.Audio`, and `UT.ItemRegistry`. It reads `#fpv` and `#petGl` from `pet.html`.

### Pet-specific builders

The seven functions create only a Pet-specific `THREE.Group`, model animation state, and its visual effects:

| Pet | Main Pet-specific shape/effect |
|---|---|
| Forest Pup | Wooden tag, leafy head sprig, wagging tail, ears, blink, and leaf particles |
| Copper Golem | Copper plates, chest gauge, rotating back gear, antenna light, and steam |
| Crystal Axolotl | Gills, articulated tail, dorsal crystals, glow, and bubbles |
| Arcane Owl | Amethyst perch, wings, rune rings, orbiting crystals, and arcane particles |
| Storm Wolf | Storm cloud, lightning bolts, electric mane, and storm particles |
| Inferno Dragon | Membrane wings, articulated neck/jaw, fire breath, tail flame, and embers |
| Celestial Kitsune | Nine animated tails, floor magic circle, orbiting stars, and spirit flames |

All builders currently return the same effective handle: `{ root, cam: { y, d }, tick(t, dt), burst() }`. None creates the page canvas, WebGL renderer, audio context, event listeners, observer, or animation loop. They are not independent today: they close over shared `T`, mesh helpers (`bx`, `cone`, `cyl`, `oct`, `torus`, `sph`, `gp`, `eye`, `glow`, `fan`, `makeBolt`, and others), timing/random helpers, and `emit()`, which writes to the viewer-owned particle system. A split must inject these dependencies; copying the helpers into each Pet module would duplicate shared implementation.

The `PETS` array also contains catalog-like fields (`tier`, `name`, `mat`, `ident`, `efek`, `lore`, and `color`). Runtime use is limited to `id`, `build`, `color`, and `name`; the other fields are currently unused in the viewer. `name` and accent color already exist in the manifest/ItemRegistry. The model registry should contain only routing and builder functions, not a second catalog record.

## 4. Dependencies, consumers, and loading

### Active script and call chain

The relevant `pet.html` script-order subsequence (bootstrap/preferences scripts run earlier in `<head>`) is:

1. `assets/js/core/item-registry.js`
2. The seven `data/inventory/pet/<gameKey>/manifest.js` files
3. `data/inventory/pet/index.js`
4. `assets/js/item-catalog.js`, `assets/js/player-data.js`, wallet/appearance services, and app scripts
5. `UT.App.init({page:'pet'})`
6. `assets/js/vendor/three.min.js`
7. `assets/js/pet-viewer.js`
8. `assets/js/pages/pet-page.js`

`pet-page.js` chooses a catalog Pet and calls `window.PetViewer.select(selected.gameKey)` from `draw()`. The argument is a `gameKey` such as `storm_wolf`, not the full ItemCatalog ID `pet.storm_wolf`. `draw()` runs initially and again on metadata/account and inventory/currency events, so the viewer may receive repeated `select()` calls for the same key.

The only active root HTML page that loads `assets/js/pet-viewer.js` is `pet.html`. Other root pages do not load the viewer or Pet manifests. `pet-page.js` has an unrelated dynamic import for `../multiplayer/client.js`; the current viewer has no static/dynamic imports, `document.currentScript`, or `import.meta.url` dependency.

### Catalog and audio ownership

- `data/inventory/pet/index.js` registers category manifests only; it is not a renderer/model loader.
- `petSfxFromManifest(id)` resolves `pet.<gameKey>` through `UT.ItemRegistry.shared().getItem()` and reads `assets.sfx`. All seven manifests contain exactly three paths.
- `pet.html` loads ItemRegistry, manifests, and the category index before the viewer, which is required for the existing resolver.
- The viewer keeps synthesized `SND` functions as fallbacks. `SND` remains positionally aligned with the `PETS` order; manifest sound paths are looked up by Pet ID and then wired to those slots. Preserve that mapping and the existing preference, mute, timing, and fallback behavior.
- `audioInit()` calls `petPreloadFiles()` on first audio activation, which starts loading the manifest SFX paths for all Pet entries. This audio policy is separate from loading/building Pet models and should not be moved into model modules.

### Other references

- `tests/pet-registry-parity.test.js` reads the root viewer path and verifies manifest/audio behavior and Pet page script order.
- `tests/pet-catalog.test.js` asserts that `pet.html` includes the viewer and controller; its catalog, server, ownership, and image assertions are independent of model implementation.
- `tests/pet-ui.test.js` does not reference PetViewer.
- All seven Pet manifest comments currently name `assets/js/pet-viewer.js`; update those comments if the shared viewer is relocated.
- Prior audit reports contain historical paths and should remain historical. The legacy `referensi/` app must retain its own script paths.

## 5. Public contract and lifecycle findings

`window.PetViewer.select(id)` is the only public PetViewer API. It synchronously resolves a matching entry; unknown IDs are a no-op. If WebGL construction fails, the page displays the existing fallback and `select()` remains inert. On a valid selection, the viewer removes and disposes the previous model’s geometry/materials, clears particles, builds the new model, updates camera/light/ARIA state, and schedules audio only when the Pet changed.

The current lifecycle has no teardown path:

- The animation loop schedules another `requestAnimationFrame()` indefinitely; its ID is not retained or cancelled.
- A `ResizeObserver` is created without keeping a handle to disconnect it.
- Pointer listeners on the canvas and audio-unlock listeners on `window` are not removed.
- The renderer and shared particle geometry/material are not disposed on page teardown; the shared glow texture also has no viewer-level disposal.
- AudioContext and delayed sound timeout have no explicit cleanup.
- `disposeObj()` handles model geometry/material on replacement, but there is no corresponding viewer teardown.

The app currently navigates between full HTML documents, which limits the practical leak window, but the stated lifecycle contract still needs a defined cleanup. A lazy loader also introduces a race absent from the synchronous builder: selection can change while a model script is in flight, and repeated `draw()` calls can request the same key. The loader/viewer must deduplicate in-flight loads and apply only the latest requested selection, without changing the external `select(gameKey)` call site.

## 6. Test contract versus source-shape coupling

- `tests/pet-registry-parity.test.js` has strong contract assertions for the seven manifest entries, 21 SFX paths, image/SFX preload bytes, and the required order of the Pet metadata scripts before the viewer.
- Its `viewerSlice()` is implementation-shape dependent: it finds literal markers `const PET_FILES={}`, `const PETS=[`, and `PETS.forEach((d,i)=>{const f=petSfxFromManifest`, then executes a source substring in a VM. Extracting builders or replacing the `PETS` array will break this slice even if the contract is preserved. Keep its behavior checks, but replace source slicing with direct registry/loader and audio-contract tests.
- `tests/pet-catalog.test.js` primarily protects actual catalog/server and page behavior; the assertion for the viewer’s current file path is path-specific and needs updating. It does not test model construction or lazy loading.
- `tests/pet-ui.test.js` protects UI markup and CSS only and needs no model-related change.
- A focused loader test should verify all seven allowlisted keys, one-time/in-flight load behavior, duplicate/missing registration errors, unknown-key rejection without URL construction, builder-handle shape, and latest-selection behavior. The full suite remains outside this audit.

## 7. Architecture alternatives

| Criterion | Option A — explicit model registry | Option B — convention-based lazy path loader |
|---|---|---|
| Shape | A fixed `gameKey → model.js URL` allowlist; each Pet script registers a builder. Loader injects only the selected script. | Validate `gameKey` against the known Pet key list, then construct `data/inventory/pet/<gameKey>/model.js` and load it. |
| API compatibility | High; asynchronous loading stays behind `PetViewer.select(gameKey)`. | High only with the same internal async/race handling. |
| Adding a Pet | Requires adding its model file and one explicit registry entry. | Simpler path convention, but the Pet must still be added to the authoritative category key list and manifest. |
| Ownership | High; model code stays in the Pet folder; registry stores only routing. | High if the path is built only from an allowlisted key. |
| Testing | High; registry can be tested independently for exact keys, URLs, load deduplication, and errors. | Medium; must test key validation, URL construction/base resolution, and convention consistency. |
| Lazy model initialization | High; only the selected model script is executed and its builder invoked. | High under the same conditions. |
| Path/security risk | Low; no user-controlled path and no inferred folder name. | Medium; unsafe if any arbitrary input is interpolated. An exact `PetCat.keys` allowlist is mandatory. |
| Runtime risk | Medium; async loading and registration need explicit error/race handling. | Medium–high; adds the same async risks plus path-convention and URL-base risks. |
| Manifest consistency | High without adding model paths or renderer metadata to item manifests. | High if it uses the trusted key list and does not add a duplicated `assets.model` field. |

Both options defer model construction until selection. Option A is recommended because fixed URLs make the accepted module set explicit and directly testable; its routing map is not a duplicate catalog, provided it contains only keys and module locations.

## 8. Recommended structure and loader contract

```text
assets/js/renderers/
  pet-model-registry.js       # internal explicit allowlist, script loader, registration
  pet-viewer.js               # shared viewer/controller; preserves window.PetViewer.select
data/inventory/pet/
  forest_pup/model.js
  copper_golem/model.js
  crystal_axolotl/model.js
  arcane_owl/model.js
  storm_wolf/model.js
  inferno_dragon/model.js
  celestial_kitsune/model.js
  # existing index.js, manifests, and PNGs stay in place
```

Recommended contract:

1. Each classic `model.js` registers exactly one `gameKey` and a builder function with the internal `UT.PetModelRegistry`; defining/registering the builder must not create Three.js objects or touch the DOM.
2. The registry owns a literal allowlist of the seven model URLs. It loads a script only on the first request for that key, de-duplicates simultaneous requests, verifies that the expected key registered, and reports load/registration failures explicitly.
3. `buildModel(context)` returns `{ root, cam: { y, d }, tick(t, dt), burst() }`. The viewer supplies Three.js and shared mesh/effect helpers, including the particle emitter. Models own only their root and model-specific animation state.
4. Do not put the executable model URL into Pet manifest metadata. ItemRegistry remains the source for name, tier, visual accent, image, and SFX. The registry map stores only routing; no price, lore, palette, sound, or duplicate Pet record.
5. Keep `window.PetViewer.select(gameKey)` and its page-controller call unchanged. Internally, guard async completion with a selection generation/token so a slower prior request cannot replace a newer choice. Invalid keys must not construct paths or load scripts.
6. Keep Three.js → model registry → PetViewer → Pet page controller ordering on `pet.html`; ItemRegistry/manifests/ItemCatalog remain earlier in the chain.
7. Provide internal teardown on page lifecycle (`pagehide` or equivalent): cancel RAF, disconnect ResizeObserver, remove registered listeners, clear pending sound timeout, dispose active model and shared particles/renderer resources, and clean up shared texture/audio resources. Do not require page controllers to adopt a different public API.

### Preload and offline behavior

`tools/gen-preload-manifest.py` scans both `assets/` and `data/` and includes `.js`. `UT_Preload.runAuto()` on Splash fetches every generated manifest entry; fetching does not execute scripts. Therefore:

- The recommended seven model scripts and the new registry script will be included in the global preload automatically.
- With the current manifest at 830 entries, a viewer key move is count-neutral and eight new `.js` files imply **838 entries**, assuming no extra runtime files are introduced.
- Model execution/build remains selection-lazy and no Pet model runs on unrelated pages, but network transfer is **not** lazy under the current global preload policy. Keeping all modules in preload preserves current offline-first-use coverage. Excluding them to make transfer lazy would require a separate preload-policy decision and would reduce first-use offline availability.
- The Service Worker does not list PetViewer in `CORE`; same-origin scripts use the existing network-first/cache-on-success handler. The repository policy requires a version bump for changed assets: implementation should change only `ut-pwa-v193` → `ut-pwa-v194` and update the four current parity assertions that pin the token. Do not change fetch/cache strategy.

## 9. Files expected to change in implementation

1. Move/refactor `assets/js/pet-viewer.js` to `assets/js/renderers/pet-viewer.js`, preserving its classic global API and shared audio/lifecycle responsibilities.
2. Add `assets/js/renderers/pet-model-registry.js`.
3. Add exactly one builder module per existing Pet:
   - `data/inventory/pet/forest_pup/model.js`
   - `data/inventory/pet/copper_golem/model.js`
   - `data/inventory/pet/crystal_axolotl/model.js`
   - `data/inventory/pet/arcane_owl/model.js`
   - `data/inventory/pet/storm_wolf/model.js`
   - `data/inventory/pet/inferno_dragon/model.js`
   - `data/inventory/pet/celestial_kitsune/model.js`
4. Update `pet.html` to the canonical viewer path and add the registry script without reordering the existing dependency chain.
5. Update only the old viewer-path comments in the seven Pet manifests; do not change metadata, `assets.image`, or `assets.sfx`.
6. Update `tests/pet-registry-parity.test.js` to remove fragile source slicing while retaining SFX/manifest/load-order contract assertions; update the path assertion in `tests/pet-catalog.test.js`; add a focused `tests/pet-model-registry.test.js`. `tests/pet-ui.test.js` should remain unchanged absent a concrete viewer-path assertion.
7. Regenerate `assets/preload-manifest.json` with the official generator and verify key count, exact path delta, and every byte count.
8. Bump only the `VERSION` token in `sw.js` to `ut-pwa-v194` and update the four version assertions in `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, and `tests/power-registry-parity.test.js`.

Do not change the seven PNGs, manifest data, `data/inventory/pet/index.js`, ItemCatalog/ItemRegistry APIs, PlayerData, SFX files or resolver, Supabase/RPC, legacy `referensi/` Pet app, or global preload/SW policies as part of this split.

## 10. Staged migration, risks, and acceptance

### Suggested migration sequence

1. Define and statically test the builder/registry contract and lifecycle teardown, with no duplicate model source.
2. Extract Forest Pup as the low-complexity pilot; remove its inline builder in the same commit that adds its Pet-owned module.
3. Extract Copper Golem, Crystal Axolotl, and Arcane Owl, each as an atomic move of the builder body into its own folder.
4. Extract Storm Wolf, Inferno Dragon, and Celestial Kitsune individually; these have the highest coupling to custom lightning geometry, wing membranes, multi-part animation, and particle effects.
5. Relocate the shared viewer, update `pet.html` and manifest comments, regenerate preload, then apply the SW token/assertion update. Do not leave a second active definition of any builder.
6. Replace source-slicing tests and run static checks during extraction; defer the full suite/browser/runtime tests until the extraction sequence is complete.

### Principal risks and mitigations

- **Lexical helper coupling:** inject a documented model context; do not duplicate `THREE` helpers or particle state.
- **Async selection races/repeated page draws:** de-duplicate pending loads and commit only the latest requested selection; cache the loaded builder, not a second model instance.
- **Lifecycle/resource leaks:** add explicit teardown for RAF, listeners, observer, renderer, particles, model geometry/material, shared texture, audio context, and timers.
- **Audio mapping regressions:** keep audio in the shared viewer, continue resolving each Pet’s three paths from ItemRegistry manifests, and assert the unchanged SND slot/fallback/timing mapping.
- **Catalog duplication:** use ItemRegistry for catalog and visual metadata; keep the model registry limited to `gameKey → module URL`.
- **Preload interpretation:** document that current global preloading fetches all module bytes even though only selected modules execute; do not claim network-lazy loading without a separate preloader decision.
- **Legacy duplicate:** leave the separate `referensi/newgui` Pet app untouched and do not use it as the root model source.
- **Source-slicing tests:** replace implementation-marker slicing with direct registry/model and manifest/audio contract tests; preserve assertion strength.
- **Cache churn:** the required SW token bump clears the previous cache; verify the token-only diff and 830→838 expected preload inventory.

### Acceptance criteria for implementation

- Each of seven keys maps to exactly one Pet-owned builder module, with no duplicate inline builder or copied PNG.
- `window.PetViewer.select(gameKey)` and `pet-page.js` call order remain unchanged; invalid keys never create arbitrary URLs.
- Model modules do not instantiate geometry at registration or execute on non-Pet pages; only the selected builder is invoked.
- The builder handle/context contract is consistent across all seven models and all shared resources remain viewer-owned.
- Renderer, listeners, observer, RAF, audio, and model resources have a verified cleanup path.
- ItemRegistry remains the sole source of Pet metadata and SFX paths; image and SFX paths are unchanged.
- Tests cover module mapping, lazy execution, race/error behavior, all seven builder contracts, manifest-backed audio, and Pet page order without source slicing.
- Preload count/keys/bytes and the SW token-only change match the documented delta; no legacy/reference files change.

## 11. Conclusion

**READY WITH CONDITIONS** — the ownership boundary and a safe explicit lazy-loader design are established. Implementation is ready only when it preserves the injected builder contract, `PetViewer.select(gameKey)`, manifest-backed audio, cleanup, and the current preload/offline policy, and replaces the source-slicing assertions without reducing contract coverage.

**Target status: COMPLETED — PETVIEWER ARCHITECTURE AUDITED, IMPLEMENTATION PLAN READY.**
