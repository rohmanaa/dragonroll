# Global Restructure — Phase 15: Global Extraction Closure Audit

## Baseline and scope

- Branch: `restruktur`
- Baseline `HEAD` and `origin/restruktur`: `f821a967710a971674f1476bed596071524fa766`
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before this audit.
- This phase is audit and planning only. No runtime source, asset, HTML, CSS, preload, or service-worker file was changed. No test suite or browser test was run.
- Counts and paths below were rebuilt from the current worktree; previous phase reports were used as history, not as the source of current inventory.

## 1. Actual global structure

### `assets/js/`

There are 102 JavaScript files under `assets/js/`: 36 at the directory root and 66 in subdirectories.

| Current directory | Files | Current contents |
|---|---:|---|
| `core/` | 5 | `app.js`, `live-sync.js`, `prefs-sync.js`, `prefs.js`, `session.js` |
| `services/` | 4 | `ads-service.js`, `appearance-service.js`, `mail-service.js`, `wallet-service.js` |
| `renderers/` | 1 | `room-dice-art.js` |
| `data/` | 1 | `achievement-data.js` |
| `pages/` | 18 | `dadu.js`, `efek.js`, `floatingsample.js`, `frame.js`, `hadiah-misi.js`, `inventory.js`, `karakter.js`, `leaderboard.js`, `lobby.js`, `mail.js`, `mode.js`, `play.js`, `powerup.js`, `profile.js`, `room.js`, `settings.js`, `splash.js`, `tambang.js` |
| `dice-kit/` | 11 | `DiceAnimation.js`, `DiceCatalog.js`, `DiceEffects.js`, `DiceEffectsCore.js`, `DiceMaterials.js`, `DicePhysics.js`, `DiceRenderer.js`, `DiceTextures.js`, `RoomEnvironment.js`, `RoundedBoxGeometry.js`, `index.js` |
| `power3d/` | 14 | `PowerAnimation.js`, `PowerAura.js`, `PowerCatalog.js`, `PowerConfig.js`, `PowerEffects.js`, `PowerGeometry.js`, `PowerLighting.js`, `PowerMaterials.js`, `PowerParticles.js`, `PowerRegistry.js`, `PowerRenderer.js`, `PowerSound.js`, `power-overlay.js`, `power-show.js` |
| `multiplayer/` | 7 | `client.js`, `config.example.js`, `event-log.js`, `game-sync.js`, `presence.js`, `progress-service.js`, `room-service.js` |
| `vendor/` | 5 | three add-on utilities, `three.min.js`, and `three.r170.module.min.js` |
| Root | 36 | inventoried individually in §2.2 |

`systems/` and `utils/` do not exist. Do not create empty folders to satisfy a target diagram; introduce them only when a cohesive module group is actually extracted.

### Other current runtime directories

- `assets/css/` has 17 files: 6 at root, 1 in `base/`, 1 in `components/`, 7 in `pages/`, and 2 in `utilities/`.
- `data/inventory/` has 88 JavaScript files and no non-JavaScript files: six category indexes and 82 item manifests.
- `gameplay/` is a separate page/runtime domain with 31 JavaScript and 9 CSS files; it remains outside shared global extraction.
- `hud/` is already a shared UI domain with 7 JavaScript files, 6 component stylesheets, and 1 theme stylesheet.
- `data/power/power-fx.js` is category/game data and effects input, not a second shared registry.

## 2. File classification

Classification describes the current path and future disposition. No file was moved in this phase.

### 2.1 Existing domain folders

| Files | Classification | Reason and risk |
|---|---|---|
| All five files in `assets/js/core/` | **Sudah tepat** | Bootstrap, session, and preference state are already grouped. Their classic-script globals and explicit HTML order are contracts; preserve the order. |
| All four files in `assets/js/services/` | **Sudah tepat** | Ads, appearance, mail, and wallet services are in the service domain. Their global APIs and lazy imports must remain unchanged in later work. |
| `assets/js/renderers/room-dice-art.js` | **Sudah tepat** | Shared room dice artwork is already separated from page code. |
| `assets/js/data/achievement-data.js` | **Sudah tepat** | Data-only module has a clear data owner. |
| All 18 files in `assets/js/pages/` | **Sudah tepat** | Page entry points are grouped by page. They remain classic scripts, so DOM availability and script order remain page-specific. |
| All 7 files in `assets/js/multiplayer/` | **Tetap di lokasi saat ini** | This is an established integration boundary used by core, services, pages, and Gameplay. Moving pieces into generic `services/` would add path churn and blur the multiplayer client/config boundary. |
| All 5 files in `assets/js/vendor/` | **Tetap di lokasi saat ini** | Third-party/vendor runtime is explicitly out of scope. Preserve the module build and existing vendor URLs. |
| All 11 files in `assets/js/dice-kit/` | **Perlu ekstraksi, sebagai satu kelompok** | They form the dice renderer/engine and are not inventory metadata. A future target under `renderers/` is conceptually correct, but `gameplay/js/dice-throw.js`, `index.js`, preload entries, manifests, tests, and tools contain path contracts or imports. Move atomically only after mapping all of them. |
| All 14 files in `assets/js/power3d/` | **Perlu ekstraksi, sebagai satu kelompok** | They form the shared Power 3D renderer/engine. Gameplay dynamically imports the overlay, the icon-bake tool imports renderer modules, category metadata names renderer paths, and preload entries reference current URLs. Keep together and update every URL in one later checkpoint. |

### 2.2 Root-level `assets/js` files

| File | Classification | Reason / migration risk |
|---|---|---|
| `assets/js/ambience.js` | **Perlu ekstraksi** → `systems/` candidate | Cross-page ambience behavior is system-like. First map its page lifecycle and settings dependencies; do not treat it as a renderer. |
| `assets/js/aura-fx.js` | **Perlu refactor terpisah** | 59 KB shared effect engine with many page and manifest references; separate internal responsibilities before relocating. |
| `assets/js/aura-view.js` | **Perlu ekstraksi** → `renderers/` candidate | Shared Aura presentation, but it depends on AuraFX and classic globals loaded in a specific order. |
| `assets/js/auth.js` | **Tetap di lokasi saat ini** | Authentication/Supabase-facing public contract; settings uses a dynamic import. A path-only move is not worth the contract risk in this closure phase. |
| `assets/js/blocky-character.js` | **Perlu refactor terpisah** | 64 KB character renderer, generated from tool templates and referenced by pages, Gameplay, preload, and tests. Do not move until template/source generation is handled together. |
| `assets/js/boot-guard.js` | **Tetap di lokasi saat ini** | Bootstrap guard whose effect depends on page script order. |
| `assets/js/character-data.js` | **Perlu refactor terpisah** | 50 KB procedural character data/model source referenced across many pages and generated by tools. Keep its one source of truth and generator aligned. |
| `assets/js/character-face.js` | **Perlu ekstraksi** → `renderers/` candidate | Visual helper; confirm its `BlockyCharacter`/DOM dependencies and all script order before moving. |
| `assets/js/character-view.js` | **Perlu ekstraksi** → `renderers/` candidate | Shared view/controller used by multiple pages; classic global and `CharacterData` ordering must be preserved. |
| `assets/js/floating-island.js` | **Tetap di lokasi saat ini** | Page/scene lifecycle-specific visual, with no demonstrated benefit from a path-only move. |
| `assets/js/frame-avatar.js` | **Perlu ekstraksi** → `renderers/` candidate | Shared frame presentation helper; it consumes the frame effect/catalog APIs and is widely loaded with inventory pages. |
| `assets/js/frame-fx.js` | **Perlu refactor terpisah** | 31 KB frame visual engine used by manifests and multiple pages; keep the engine shared, not inside the frame item-data folder. |
| `assets/js/frame-guard.js` | **Tetap di lokasi saat ini** | Global lifecycle guard with ordering constraints. |
| `assets/js/friendship-page.js` | **Perlu ekstraksi** → `pages/` candidate | Page-specific entry point loaded by `friendship.html`; it dynamically imports `./multiplayer/presence.js`, so that URL must be adjusted without changing its effective target. |
| `assets/js/game-integration.js` | **Tetap di lokasi saat ini** | Compatibility boundary between root app and Gameplay runtime; do not duplicate or relocate the game controller. |
| `assets/js/inventory-bridge.js` | **Tetap di lokasi saat ini** | Legacy inventory compatibility bridge; keep until Inventory Category Architecture defines its replacement contract. |
| `assets/js/item-art.js` | **Perlu ekstraksi** → `renderers/` candidate | Shared item artwork renderer used by many pages, HUD, and Gameplay. It fetches assets and depends on `ItemCatalog`; check URL resolution and load order before relocation. |
| `assets/js/item-catalog.js` | **Tetap di lokasi saat ini** | High-risk item metadata/source-of-truth and legacy fallback consumed by many pages. No second catalog or category copy should be created. |
| `assets/js/item-registry.js` | **Perlu ekstraksi** → `core/` candidate | It is a single, DOM-independent ES5 registry, but 15 HTML pages, category indexes/manifests, tests, and preload reference it. Preserve `UT.ItemRegistry` and ensure it loads once before registration. |
| `assets/js/landscape.js` | **Tetap di lokasi saat ini** | Scene/page lifecycle visual; no independent shared renderer boundary established by current call sites. |
| `assets/js/mine-island.js` | **Tetap di lokasi saat ini** | Mining-page visual tied to the mining scene lifecycle. |
| `assets/js/mine-service.js` | **Perlu ekstraksi** → `services/` candidate | Clear service boundary loaded by `tambang.html`; however, its lazy import uses `document.currentScript` plus `new URL('multiplayer/client.js', SELF)`. Preserve the exact effective client URL and update preload, tests, and caller path. |
| `assets/js/mob-view.js` | **Tetap di lokasi saat ini** | Gameplay/scene-oriented visual; extracting it alone would not create a stable shared renderer boundary. |
| `assets/js/night-fog.js` | **Tetap di lokasi saat ini** | Page ambience behavior is paired with `assets/css/night-fog.css`; moving either separately risks load and style behavior. |
| `assets/js/pet-page.js` | **Perlu ekstraksi** → `pages/` candidate | Page entry point loaded by `pet.html`; depends on `pet-viewer.js`, manifest globals, and page-relative asset behavior. |
| `assets/js/pet-viewer.js` | **Perlu refactor terpisah** | 51 KB visual/runtime module with pet image and SFX references; keep its shared viewer behavior outside category data. |
| `assets/js/player-data.js` | **Tetap di lokasi saat ini** | High-risk player state, storage, and server-mirror source of truth. Explicitly excluded from this extraction. |
| `assets/js/podium-fx.js` | **Tetap di lokasi saat ini** | Gameplay/room-specific effect lifecycle; no demonstrated generic renderer boundary. |
| `assets/js/preloader.js` | **Tetap di lokasi saat ini** | Global manifest loader uses `fetch` and URL/base resolution; changing its location could change preload resolution and startup behavior. |
| `assets/js/pwa.js` | **Tetap di lokasi saat ini** | Service-worker registration/bootstrap path is coupled to root `sw.js`; keep the service worker and cache strategy unchanged. |
| `assets/js/quest-data.js` | **Perlu ekstraksi** → `data/` candidate | Mostly quest definitions but also publishes `UT.Quest` and removes a legacy localStorage key at evaluation. Treat as a behavior-bearing data module, not a blind move. |
| `assets/js/room-flow.js` | **Tetap di lokasi saat ini** | Navigation/room lifecycle flow used across pages; not a pure core utility and order-sensitive. |
| `assets/js/room-modal-bridge.js` | **Tetap di lokasi saat ini** | UI compatibility bridge tied to room/page lifecycle. |
| `assets/js/scene-bg.js` | **Tetap di lokasi saat ini** | Scene behavior paired with `assets/css/scene-bg.css`; keep script/style and their established load order together. |
| `assets/js/shop-page.js` | **Perlu ekstraksi** → `pages/` candidate | Page entry point loaded by `shop.html`; tests and preload also contain its current path. |
| `assets/js/splash-fx.js` | **Tetap di lokasi saat ini** | Splash lifecycle effect; the splash entry point and preload path are page-specific. |

### 2.3 CSS inventory

| Files | Classification | Reason |
|---|---|---|
| `assets/css/base/reset.css`, `assets/css/components/overlay.css`, `assets/css/pages/floatingsample.css`, `assets/css/pages/inventory.css`, `assets/css/pages/lobby-2.css`, `assets/css/pages/lobby.css`, `assets/css/pages/play.css`, `assets/css/pages/profile.css`, `assets/css/pages/room.css`, `assets/css/utilities/common.css`, `assets/css/utilities/loading.css` | **Sudah tepat** | Their current folders reflect base, component, page, or utility responsibilities. |
| `assets/css/base.css`, `assets/css/fonts.css`, `assets/css/shared-ui.css` | **Tetap di lokasi saat ini** | Broadly shared legacy styles loaded by root HTML; preserve cascade and order until page-wide references are mapped. |
| `assets/css/lobby-theme.css` | **Tetap di lokasi saat ini** | Theme/cascade is tied to lobby HTML; no theme folder or safe path migration is established. |
| `assets/css/night-fog.css`, `assets/css/scene-bg.css` | **Tetap di lokasi saat ini** | Paired with root JavaScript modules; move each pair only with the same static-reference audit. |
| `gameplay/` stylesheets (9) | **Tetap di `gameplay/`** | Gameplay page styles are coupled to its runtime shell and should not be folded into global CSS extraction. |
| `hud/components/badge.css`, `hud/components/button.css`, `hud/components/card.css`, `hud/components/currency.css`, `hud/components/modal.css`, `hud/components/toast.css`, and `hud/theme/fantasy.css` | **Sudah tepat** | Shared HUD UI already has a separate component/theme ownership boundary. |

## 3. Shared dependency, loading, and cache audit

- Runtime HTML remains at the repository root. Shared scripts are classic scripts publishing globals such as `UT.Session`, `UT.App`, `UT.ItemRegistry`, `UT.ItemCategories`, `PlayerData`, and service APIs. Their script tags are explicit and order-sensitive; no module-loader conversion is recommended in this phase.
- The five `core/` scripts are already referenced from root HTML at their new locations. Appearance, wallet, and mail services are already in `services/`; their current URLs are used by pages and by preload.
- `session.js` is loaded on 23 root/legacy HTML pages. The common ordering puts session and preferences before page bootstrap; per-page order varies and must not be normalized as part of file moves.
- `ItemRegistry` is loaded before the item manifests and category index on the inventory/catalog pages; `ItemCatalog` follows registration. This order is part of the current data handoff. Category index modules call the one `UT.ItemRegistry`; they do not create category-local registry cores.
- `mine-service.js` is only loaded by `tambang.html`; `ItemRegistry` is loaded by 15 HTML pages. `friendship-page.js`, `pet-page.js`, and `shop-page.js` are page entry points outside `pages/`; they also have HTML, test, or preload references that need updating if moved.
- Static path-sensitive scan found 46 JavaScript files across `assets/js/`, `data/inventory/`, and `gameplay/` using at least one of `document.currentScript`, `new URL`, dynamic/static `import`, or `fetch`. Seven files use `document.currentScript`; no `import.meta.url` usage was found. Relevant examples include `mine-service.js`, service lazy imports, dice and Power 3D loaders, `preloader.js`, `pwa.js`, `item-art.js`, `pet-page.js`, and page modules. `tools/power-icons/bake.html` also imports Power 3D modules by path. Every move of these modules requires preserving effective URLs, not merely changing the script tag.
- `assets/preload-manifest.json` currently has 844 entries. Six size values do not match the current files: `assets/js/blocky-character.js`, `assets/js/character-data.js`, `assets/js/item-catalog.js`, `assets/js/pages/splash.js`, `gameplay/css/hud-mockup.css`, and `gameplay/js/main.js`. The first three are the known older mismatches; the other three are also stale in the current baseline. This audit does not edit the manifest.
- `sw.js` remains `ut-pwa-v185`: only its small `CORE` list is precached; same-origin media uses cache-first and other GET requests use network-first with offline fallback. It does not enumerate the global JS modules in `CORE`. No cache strategy or version change is justified by this audit.

## 4. Runtime references to `referensi/`

The static scan found no active runtime URL or configuration sourcing an asset from `referensi/`. The source matches are comments only:

- `gameplay/js/level-up.js` and `gameplay/css/level-up.css` cite an archived visual reference.
- `gameplay/js/audio.js` documents the original SFX source location; runtime audio assets are elsewhere.
- `assets/css/night-fog.css` cites an archived prototype for design history.

Test-only references remain in `tests/pet-ui.test.js` (archive image fixtures) and `tests/pet-catalog.test.js` (a negative assertion that an obsolete prototype path is absent). They are not runtime dependencies. No active HTML or JSON manifest path points into `referensi/`. The archive was not modified.

## 5. Inventory Category Architecture

### Existing category ownership

Each `data/inventory/<category>/` currently contains only an `index.js` plus per-item `manifest.js` files. Counts are: frame 14, dice 23, character 6, pet 7, aura 15, and power 17 manifests (82 total). The categories have one index each; those indexes register metadata with the existing central `ItemRegistry`.

| Category | Current source and asset ownership | Recommended boundary |
|---|---|---|
| `frame/` | 14 manifests refer to 14 existing files under `data/frame/`; frame behavior is rendered by shared `assets/js/frame-fx.js`. | Keep index/manifests in category data. Keep frame image URLs and shared FX engine at current canonical locations until a separate URL/hash migration is approved. |
| `dice/` | 23 manifests have no per-item image assets; materials, textures, animation, and effects are procedural/shared in `assets/js/dice-kit/`. | Keep item definitions in category data; keep dice engine/material/renderer code in shared renderer domain, not in each item folder. |
| `character/` | 6 manifests have no item image assets; procedural model data is shared in `assets/js/character-data.js` and shared character renderers. The legacy `skin.*` IDs remain part of the contract. | Keep identity/metadata in this category; keep model data and renderer shared. Do not duplicate model/registry data or rename IDs. |
| `pet/` | 7 manifests refer to existing PNGs under `assets/ng/pet3d/` and 21 existing SFX files under `assets/sfx/pet/`; viewer behavior is shared in `assets/js/pet-viewer.js`. | Keep manifests category-owned; preserve the existing permanent image/audio directories and one shared viewer. Do not copy the same viewer or audio into every item folder. |
| `aura/` | 15 manifests refer to the shared `assets/js/aura-fx.js`; visual settings are manifest metadata. | Keep per-item effect parameters in manifests and the common Aura engine outside category data. Do not create an Aura Registry Core. |
| `power/` | 17 manifests refer to existing images under `data/power/3d/`; shared 3D engine is under `assets/js/power3d/`, with shared 2D effects in `data/power/power-fx.js`. | Keep item metadata in category data; retain the shared renderer/engine and existing asset locations. Do not move gameplay particle/audio systems into individual item folders. |

All asset paths discovered in these manifests currently resolve to files. Existing image/audio locations are the source of truth for runtime URLs; this phase does not move them merely to mirror a proposed folder layout.

### Recommended future layout

```text
data/inventory/
  frame|dice|character|pet|aura|power/
    index.js
    <item-key>/manifest.js

assets/js/
  core/item-registry.js             # one shared registry only, if extracted later
  renderers/
    inventory/                      # only genuinely category-specific presentation
      frame|dice|character|pet|aura|power/
    dice-kit/                        # shared dice renderer/engine group
    power3d/                         # shared Power renderer/engine group

assets/css/components/inventory/    # only category-specific UI styles, if any
  <category>/
```

This is a destination model, not an instruction to create empty folders or relocate current assets. `data/inventory/` should remain data-only. Shared renderer, service, and engine logic belongs outside it. Category-specific JS/CSS should be added only where a real category-only behavior/style exists; generic visual behavior stays in shared renderers. For any future asset additions, prefer the existing permanent locations above; only introduce a new category asset subdirectory when no established owner exists. Never use `referensi/` at runtime.

## 6. Remaining extraction and refactor plan

### Candidates for focused later extraction

1. `mine-service.js` → `services/`: small, clear service responsibility, but preserve its lazy client URL and update `tambang.html`, preload, tests, and any source-path references.
2. `item-registry.js` → `core/`: behavior is DOM-independent, but it is a broad classic-script API loaded before manifests on 15 pages. Preserve one instance and registration order.
3. `friendship-page.js`, `pet-page.js`, `shop-page.js` → `pages/`: page entry points currently outside the page folder. Resolve their dynamic/asset paths and update HTML, tests, and preload references.
4. `quest-data.js` → `data/`: only after explicitly preserving its global API and evaluation-time storage cleanup.
5. Shared presentation helpers (`item-art.js`, `character-face.js`, `character-view.js`, `frame-avatar.js`, `aura-view.js`) → `renderers/`: perform per-file caller and script-order audits before moving.
6. Move `dice-kit/` and `power3d/` as complete renderer groups only after updating dynamic imports, tool imports, category metadata references, HTML/loaders, tests, and preload together.
7. Consider `ambience.js` for `systems/` only after defining the systems boundary and verifying its page lifecycle.

### Files to keep or refactor separately

- Keep `player-data.js`, `item-catalog.js`, `auth.js`, `game-integration.js`, `inventory-bridge.js`, `room-flow.js`, `room-modal-bridge.js`, guards, preloader, PWA registration, and page/scene-specific scripts in place until their contracts and lifecycle owners are explicitly addressed.
- Refactor before any relocation: `blocky-character.js`, `character-data.js`, `frame-fx.js`, `aura-fx.js`, and `pet-viewer.js`. Their size, generated source/template relationships, or shared renderer responsibilities make a path-only move a poor first step.
- Keep `sw.js`, `preload-manifest.json`, vendor Three.js, root HTML, Gameplay runtime, and existing category asset directories outside this closure audit's implementation scope.

## 7. Recommended implementation order

1. Keep this inventory as the reviewed baseline; preserve all public globals, item IDs, storage, and root HTML.
2. Extract one small service group (`mine-service.js`) with a static URL and preload/reference audit; do not alter service logic.
3. Extract the single shared registry and the three page entry points in separate, auditable groups; preserve classic script order and registry-before-manifest loading.
4. Handle `quest-data.js` only with a focused check of the legacy localStorage side effect.
5. Create or extend `renderers/` for the focused shared helpers, then relocate `dice-kit/` and `power3d/` as atomic groups.
6. Refactor large generated/engine modules in separate phases before deciding whether their final paths should change.
7. Run the final test/browser validation only after all extraction phases are approved and complete; it was intentionally not run here.

## 8. Static audit result

- Rebuilt the current JS/CSS/category inventory and verified all listed category-manifest asset URLs exist.
- Checked script references in HTML, candidate path references in source/tests/tools, preload entries, and service-worker strategy.
- Checked active source for `referensi/` paths; remaining source occurrences are comments, and test occurrences are fixtures/negative assertions.
- No runtime code, item data, archive, preload manifest, or service worker was changed.
- No test suite, syntax test, or browser test was run.

## 9. Git checkpoint

This report is the only intended change for Phase 15. It must be committed separately and pushed to `origin/restruktur`; final commit and synchronization evidence are recorded in the completion report.
