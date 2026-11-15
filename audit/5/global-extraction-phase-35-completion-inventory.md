# Global Extraction Phase 35 — Global Completion Inventory

Status: **INVENTORY COMPLETE — ROADMAP PROPOSED; NO IMPLEMENTATION STARTED**

## 1. Baseline Git and scope

| Ref / state | Verified value |
|---|---|
| Branch | `restruktur` |
| `HEAD` | `1ebd6a701015a8d8a2b89caea3152c76dfd78519` |
| `origin/restruktur` | `1ebd6a701015a8d8a2b89caea3152c76dfd78519` |
| Remote `refs/heads/restruktur` | `1ebd6a701015a8d8a2b89caea3152c76dfd78519` |
| Local `main`, `origin/main`, remote `refs/heads/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Initial worktree | Clean |

This is a repository-wide, read-only inventory against the actual Phase 35 baseline. Phase 15 and the Phase 1–34 reports were used as history; paths, counts, and unresolved findings below were checked against the current tree. No test suite, browser test, benchmark, or runtime test was run.

## 2. Current repository structure

Counts are current worktree file counts. `assets/` has one root file (`preload-manifest.json`) in addition to the files in its subdirectories.

| Domain | Current structure / count | Assessment |
|---|---|---|
| Root HTML | 23 pages | Root remains the runtime entry-point domain; script order is explicit and mostly classic-script based. |
| `assets/` | 656 files; 655 beneath its domain directories | Shared systems and static assets are grouped here. |
| `assets/js/` | 103 files: 22 at root; `core` 6, `data` 2, `multiplayer` 7, `pages` 21, `renderers` 33, `services` 5, `systems` 1, `vendor` 6 | Domain structure is established, but 22 legacy/root modules remain and require individual disposition. There is no `utils/` directory. |
| `assets/css/` | 17 files | Base, component, page, utility, and legacy shared CSS coexist; Gameplay CSS remains separate. |
| `assets/Images/` | 108 files: background 31, clouds 3, fog 2, fx 2, icon 65, logo 1, mode 4 | Static/shared visual assets. |
| `assets/ng/` | 331 files: `komponen` 301, `css` 23, `pet3d` 7 | Mostly shared UI assets; the seven Pet models are content-owned candidates. |
| `assets/sfx/` | 61 files: board 6, dice 1, dragon 8, mob 9, pet 21, powerup 1, reward 3, ui 4, win 3 | Shared audio domain; Pet ownership is clear, while dragon/mob ownership needs a focused audit. |
| `data/` | 121 files: `frame` 15, `inventory` 88, `power` 18 | Dynamic item data and supporting assets are established, but Pet assets remain outside this domain. |
| `gameplay/` | 42 files: 31 JavaScript, 9 CSS, 2 other assets | Separate runtime domain; preserve this boundary unless a focused audit supports a change. |
| `hud/` | 16 files: 7 JavaScript, 7 CSS, 2 other | Shared HUD/component domain. |
| `supabase/` | 57 files | Backend schema, migrations, functions, and configuration; outside global JS extraction. |
| `tests/` | 66 files | Static/unit/browser-related checks; several assertions are stale relative to current service-worker version. |
| `tools/` | 22 files | Build, generation, and asset utilities; some have path-sensitive imports or archived-source inputs. |
| `assets/js/vendor/` | 6 files | Vendor modules and Three.js distribution; no top-level `vendor/` exists. |
| `referensi/` | 1,889 files | Archive/reference material, not runtime source. |
| `old/` | 11 files, including two HTML pages | Legacy pages remain in the repository; their relative script paths require an explicit support/disposition decision. |

`data/inventory/` has six category indexes and 82 item manifests: Aura 15, Character 6, Dice 23, Frame 14, Pet 7, Power 17. `data/frame/` contains 15 files. `data/power/` contains `power-fx.js` plus 17 files under `3d/`, corresponding to the 17 Power manifests.

## 3. Domain and candidate classification

Statuses use the Phase 35 definitions: **ALREADY CANONICAL**, **NEEDS RELOCATION**, **NEEDS EXTRACTION**, **NEEDS CONSOLIDATION**, **NEEDS AUDIT**, and **DEFERRED**. A location can be canonical while a separate integrity finding (such as a stale manifest byte count) remains open.

### 3.1 Established domains

| Candidate group | Current responsibility / principal callers | Recommended target and reason | Risk / status / prior phase |
|---|---|---|---|
| `assets/js/core/` — `app`, `item-registry`, `live-sync`, `prefs`, `prefs-sync`, `session` | Shared bootstrap, registry, session and preference state; loaded by root HTML and item-category pages. | Keep in `core/`; contracts are public globals and classic-script ordering is significant. | Path/load-order sensitivity; **ALREADY CANONICAL**. Phases 2, 7–9, 11–12, 17. |
| `assets/js/services/` — ads, appearance, mail, mine, wallet | Cross-page services; callers include root pages, settings, and Tambang. | Keep in `services/`; use one implementation per service. | Public APIs and lazy imports are contracts; **ALREADY CANONICAL**. Phases 1–2, 13–14, 16, 33–34. |
| `assets/js/pages/` — 21 page controllers | Page entry points loaded by their respective HTML pages. | Keep page-specific controllers in `pages/`. | Classic-script order and page DOM coupling; **ALREADY CANONICAL**. Phases 18–20 and earlier page extractions. |
| `assets/js/renderers/` — 33 files, including `dice-kit/` and `power3d/` | Shared presentation, scene/background and dice/Power engines; used by pages, Gameplay, tools, and data manifests. | Keep shared visual engines here; no reason to put renderer code in dynamic item data. | Imports, import maps, preload, and classic globals require atomic path updates; **ALREADY CANONICAL**. Phases 6, 22–30, 32. |
| `assets/js/systems/ambience.js` | Cross-page ambience behavior, preferences, and root attributes. | Keep in `systems/`. | Existing listener cleanup findings remain separate; **ALREADY CANONICAL**. Phase 32. |
| `assets/js/data/` — `achievement-data.js`, `quest-data.js` | Shared data modules with existing global/evaluation contracts. | Keep in `assets/js/data/`, not item-owned `data/`. | Quest evaluation side effect is a contract; **ALREADY CANONICAL**. Phases 5 and 21. |
| `assets/js/multiplayer/` | Client, configuration, event log, game sync, presence, progress, and room services. | Preserve as the Multiplayer boundary. | Shared by pages, services, and Gameplay; **ALREADY CANONICAL**. |
| `assets/js/vendor/` | Third-party/vendor Three.js and Supabase modules. | Keep in place; do not move vendor files without a technical need. | Import-map and licensing/runtime risk; **DEFERRED by policy**. |
| `assets/css/`, `hud/`, `gameplay/`, `supabase/` | Shared styles, HUD, Gameplay runtime, and backend. | Preserve their current domain boundaries; no broad path-only migrations are indicated. | Cascade, lifecycle, and backend contract risk; **ALREADY CANONICAL / DEFERRED** as applicable. Phases 3 and 10; Gameplay boundary retained throughout. |
| `data/inventory/`, `data/frame/`, `data/power/3d/` | Item definitions and content-owned Frame/Power assets. | Keep content definitions and their existing supporting assets under `data/`; shared engines remain in `assets/`. | Registry and manifest order is significant; **ALREADY CANONICAL**. Phases 5, 21, and registry stages. |
| Root HTML, `sw.js`, `assets/preload-manifest.json` | Runtime entry points, cache strategy, and preload inventory. | Keep at current root/static locations. | Their references and values need integrity repair; **ALREADY CANONICAL path, integrity findings open**. |
| `referensi/`, `old/`, `tests/`, `tools/` | Archive, legacy routes, validation, and development tooling. | Do not treat archive/tests/tools as runtime modules. Audit only their active path contracts and source inputs. | Some tooling/tests intentionally read archive fixtures; **DEFERRED / NEEDS AUDIT** where noted below. |

No duplicate `ItemRegistry`, service implementation, or compatibility copy was found among the completed relocations. No current evidence supports a `NEEDS CONSOLIDATION` classification. Do not create an empty `utils/` folder merely to satisfy a diagram.

### 3.2 Remaining root-level `assets/js/` candidates

The following 22 files remain at the `assets/js/` root. Recommendation is based on current responsibilities and known references, not filename alone. Phase 15 is the earlier inventory baseline; later moves are reflected in the current paths.

| Current file | Responsibility and principal callers/dependencies | Recommended target / reason | Risk and status |
|---|---|---|---|
| `aura-fx.js` | Shared Aura effect engine; page/Gameplay code interprets Aura manifest settings through `UT.AuraFX`; paired with `renderers/aura-view.js`. | `assets/js/renderers/` after a focused engine/boundary review. | Large shared engine and many callers; **NEEDS EXTRACTION**. Phase 15. |
| `auth.js` | Authentication ES module; Splash and settings load/use `UT.Auth`. | Retain at the current path until module/bootstrap ownership and all lazy imports are audited. | Public API and module-vs-classic load contract; **DEFERRED**. Phase 15. |
| `blocky-character.js` | Shared character renderer; Tambang, Character, Gameplay, tools, tests, and preload reference it. | `assets/js/renderers/` only after aligning its generator/template source. | Generated-source and broad caller coupling; **NEEDS EXTRACTION** after refactor. Phase 15. |
| `boot-guard.js` | Early bootstrap guard loaded by many pages. | Retain at root unless its document/load-order contract is redesigned in a separately approved phase. | Runs before page initialization; **DEFERRED**. Phase 15. |
| `character-data.js` | Procedural CharacterData/model source; used by Character, Gameplay, legacy Daily Reward, splash preload, and preview tooling. | No target approved; decide whether this is shared renderer data or another domain only after auditing its generator/source of truth. | Large generated model source and broad consumers; **NEEDS AUDIT**. Phase 15. |
| `floating-island.js` | Scene/presentation code; legacy Daily Reward and Splash preload reference it. | Retain unless a shared scene-renderer API is demonstrated. | Page/scene lifecycle and Three.js ordering; **DEFERRED**. Phase 15. |
| `frame-fx.js` | Shared Frame visual/effect engine; item manifest settings are consumed by inventory/shop/profile pages through this engine; paired with `renderers/frame-avatar.js`. | `assets/js/renderers/` after a focused engine review. | Shared API and caller order; **NEEDS EXTRACTION**. Phase 15. |
| `frame-guard.js` | Early global navigation/lifecycle guard in many HTML pages. | Retain at root. | Earliest script ordering and global behavior; **DEFERRED**. Phase 15. |
| `game-integration.js` | Compatibility bridge between shared application and Gameplay runtime. | Retain at the integration boundary. | Moving it risks blurring the `gameplay/` boundary; **DEFERRED**. Phase 15. |
| `inventory-bridge.js` | Legacy inventory compatibility bridge to catalog/state APIs. | Retain until its replacement contract and source-of-truth ownership are explicitly established. | ItemCatalog/PlayerData integration; **DEFERRED**. Phase 15. |
| `item-catalog.js` | High-contract catalog/source-of-truth consumed by category indexes, manifests, pages, Gameplay, and PlayerData-facing code. | Retain at its current path until a separately approved catalog/data architecture audit. | Explicitly high risk; do not duplicate or move casually; **DEFERRED**. Phase 15. |
| `landscape.js` | Small scene/page helper loaded by Gameplay and legacy pages. | Retain unless a reusable scene-renderer boundary is evidenced. | Scene/load-order coupling; **DEFERRED**. Phase 15. |
| `mine-island.js` | Mining-page island presentation loaded by `tambang.html`. | Retain with the mining page until a broader page/rendering boundary is audited. | Scene lifecycle; **DEFERRED**. Phase 15. |
| `mob-view.js` | Reusable procedural Three.js mob renderer (`UT.MobView`); legacy Daily Reward calls `make()`, Splash preloads it. | Candidate `assets/js/renderers/mob-view.js` if the legacy consumer is still supported. | Actual legacy reachability and path handling need confirmation; **NEEDS AUDIT**. Phase 15 classification is superseded by the current module contract/call-site evidence. |
| `pet-viewer.js` | Shared Pet model/viewer behavior used by the Pet page; model/audio URLs are supplied through category manifests and preload. | `assets/js/renderers/` after the Pet asset move is planned and viewer responsibilities are audited. | Large viewer, manifest URLs, and page lifecycle; **NEEDS EXTRACTION**. Phase 15. |
| `player-data.js` | Player state, persistence, wallet/server synchronization, and public PlayerData source of truth. | Retain at root; explicitly excluded from extraction. | Storage/server/API contract; **DEFERRED**. Phase 15 and earlier exclusion. |
| `podium-fx.js` | Room/Gameplay podium presentation effect. | Retain unless a shared renderer consumer is found. | Page/runtime lifecycle; **DEFERRED**. Phase 15. |
| `preloader.js` | Global manifest loader used by Splash; resolves and loads manifest URLs. | Retain at root unless its document/base URL contract is re-proven before relocation. | Startup ordering and URL resolution; **DEFERRED**. Phase 15. |
| `pwa.js` | Root service-worker registration for `sw.js`. | Retain at root. | Service-worker scope and root URL contract; **DEFERRED**. Phase 15. |
| `room-flow.js` | Cross-page room/navigation flow used by Gameplay and room-related pages. | Retain until its lifecycle owner is clear; do not move solely to fill `core/`. | Navigation and initialization order; **DEFERRED**. Phase 15. |
| `room-modal-bridge.js` | Room/page modal compatibility bridge. | Retain until the room UI boundary is consolidated. | UI lifecycle and bridge contract; **DEFERRED**. Phase 15. |
| `splash-fx.js` | Splash-specific visual effect loaded by `splash.html`. | Retain as a page-specific effect. | Inline mount and page lifecycle; **DEFERRED**. Phase 15. |

### 3.3 Content-owned asset candidates

| Candidate | Current location and evidence | Recommended target / callers | Risk and status |
|---|---|---|---|
| Pet models and sound effects | Seven unique Pet PNGs are in `assets/ng/pet3d/`; 21 Pet SFX are in `assets/sfx/pet/`. The seven `data/inventory/pet/<pet-key>/manifest.js` files reference these assets. `data/inventory/pet/index.js` explicitly documents that they were not moved. `pet-page.js` also has an `IMAGE_ROOT` path. Gameplay reuses four of the Pet SFX. No duplicate copy exists under `data/`. | Content-owned files should follow their Pet manifests under `data/inventory/pet/` (exact subdirectory naming to be confirmed in a preflight). Update all manifest/page/Gameplay/preload references atomically if approved. | Clear ownership but shared SFX consumers and URL/preload/SW implications; **NEEDS RELOCATION**. Phase 15 recorded the deferral; no later phase moved them. |
| `assets/sfx/dragon/` (8) and `assets/sfx/mob/` (9) | Gameplay Audio’s `FILE` table names these sound assets. These are associated with Dragon/Mob gameplay events, but no matching content manifest/domain currently owns them. | Audit whether they are dynamic entity content for `data/` or static Gameplay-owned support assets. Keep `gameplay/js/audio.js` as the system; do not move audio based on folder name alone. | Ownership boundary not yet evidenced; **NEEDS AUDIT**. |
| Remaining shared static assets (`assets/Images`, fonts, music, UI/board/reward SFX, `assets/ng/komponen`) | Used as common presentation assets; no item-manifest ownership was established by this inventory. | Keep in `assets/` unless a specific dynamic content owner is demonstrated. | No concrete relocation candidate found; **ALREADY CANONICAL / NEEDS AUDIT only if a future owner is found**. |

## 4. Verification of Phases 1–34

The earlier reports were reconciled with the current tree; the Phase 15 counts and proposed backlog were not reused as current facts.

| Phase(s) | Recorded result and current-state check |
|---|---|
| 1–14 | Earlier service/core/CSS/data and shared-rendering work is represented in current canonical folders: ads/mail/wallet/appearance services; preference/session/app/LiveSync core modules; shared CSS groups; data modules; room-dice art; session closure; and the 38-file runtime-asset relocation recorded in `global-runtime-assets-phase-10.md`. |
| 15 | Historical completion inventory. Its then-rooted candidates were reconciled against later phases; its asset/manifest counts and older classifications are not treated as current. |
| 16 | Mine Service was moved to `assets/js/services/mine-service.js`; only this canonical implementation exists now. |
| 17 | Item Registry is in `assets/js/core/item-registry.js`; category indexes/manifests register against one `UT.ItemRegistry`. |
| 18–20 | Friendship, Pet, and Shop page controllers are in `assets/js/pages/`. |
| 21 | Quest data is in `assets/js/data/quest-data.js`; its evaluation-time behavior remains a contract. |
| 22–26 | ItemArt, CharacterFace, CharacterView, FrameAvatar, and AuraView are in `assets/js/renderers/`. |
| 27–28 | DiceKit preflight and atomic relocation completed; files are under `assets/js/renderers/dice-kit/`. |
| 29–30 | Power3D preflight and atomic relocation completed; files are under `assets/js/renderers/power3d/`. |
| 31–32 | Ambience, SceneBG, and NightFog preflight/relocation completed; current paths are `systems/ambience.js`, `renderers/scene-bg.js`, and `renderers/night-fog.js`. CSS remains at its original path. |
| 33–34 | Mine Service preflight and current-state closure completed; it was already canonical since Phase 16. No Phase 34 relocation is required. |

No duplicate or compatibility-copy modules were found for the completed moves. The paths in current HTML, source, preload, tests, and tooling must still be considered together; the integrity findings in §7 remain open.

## 5. Global dependency and load-contract audit

### Script order, namespaces, and data registry

- Root pages explicitly sequence classic scripts and inline initialization. Moving files must preserve their order and execution mode; no broad conversion to ES modules is indicated.
- Public globals/namespaces include `PlayerData`, `ItemCatalog`, and `window.UT` APIs such as `App`, `Session`, `ItemRegistry`, `ItemCategories`, service APIs, and renderer/system APIs. These are compatibility contracts, not reasons to create duplicate implementations.
- Item category indexes and manifests feed the central `UT.ItemRegistry`; `ItemCatalog` remains a separate high-risk legacy/source-of-truth boundary. No category-local registry core was found.
- `gameplay/` and `assets/js/multiplayer/` remain distinct integration boundaries. `supabase/` remains backend-owned; `referensi/` remains archive/reference material.
- A static scan found `document.currentScript` in seven application scripts. `import.meta.url` was not found. `new URL`, dynamic `import()`, `fetch()`, and module-relative imports occur across services, pages, loaders, Gameplay, and vendor code. These require effective-URL verification whenever their owning file moves.
- Important path-sensitive examples include Mine Service’s script-relative lazy Multiplayer import; Power3D and DiceKit imports/loaders; ItemArt and Pet page asset paths; Splash preload entries; the global `preloader.js`; and Three.js import maps. The Power3D and DiceKit tool entry points are also path consumers.

### HTML script-path scan

A static scan checked 25 HTML files (23 root pages and two `old/` pages), covering 808 local `<script src>` references. No `<base>` tag was found. **29 local script paths do not resolve from their document URL**:

- Two active root-page references: `shop.html` and `tambang.html` both request the stale `assets/js/live-sync.js`; the current file is `assets/js/core/live-sync.js`.
- 15 references in `old/dailyreward.html` and 12 in `old/misi.html` resolve beneath `/old/` and do not exist there. They include shared `assets/js/...`, `hud/ui-core.js`, and page/data scripts. The old pages may be archival; decide whether they are supported before changing their paths.

This is a path-resolution check, not a browser test. The two active root-page failures are concrete; the two legacy pages require a support/disposition decision.

### Preload manifest and service worker

- `assets/preload-manifest.json`: **830 entries, 0 missing paths, 20 stale byte counts**. The mismatch list below is read-only evidence; no value was corrected in Phase 35.
- `sw.js`: current version is `ut-pwa-v188`; its `CORE` array has 10 entries. Media uses cache-first behavior and other same-origin GET requests use network-first with offline fallback. It does not enumerate every global JS module in `CORE`.
- Four test assertions still expect `ut-pwa-v187`: `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, and `tests/power-registry-parity.test.js`.

| Manifest path | Listed bytes | Actual bytes |
|---|---:|---:|
| `assets/css/scene-bg.css` | 10,860 | 10,878 |
| `assets/js/blocky-character.js` | 64,282 | 64,432 |
| `assets/js/character-data.js` | 38,603 | 50,130 |
| `assets/js/item-catalog.js` | 41,712 | 42,707 |
| `assets/js/pages/powerup.js` | 9,343 | 9,363 |
| `assets/js/pages/room.js` | 36,987 | 36,997 |
| `assets/js/pages/splash.js` | 5,917 | 5,970 |
| `assets/js/renderers/room-dice-art.js` | 324 | 322 |
| `data/inventory/aura/index.js` | 2,154 | 2,164 |
| `data/inventory/dice/index.js` | 3,098 | 3,118 |
| `data/inventory/power/index.js` | 2,879 | 2,969 |
| `data/power/power-fx.js` | 14,266 | 14,276 |
| `gameplay/css/hud-mockup.css` | 69,077 | 68,165 |
| `gameplay/js/audio.js` | 16,786 | 16,806 |
| `gameplay/js/dice-pad.js` | 2,057 | 2,067 |
| `gameplay/js/dice-throw.js` | 27,326 | 27,356 |
| `gameplay/js/dice-ui.js` | 4,870 | 4,880 |
| `gameplay/js/main.js` | 464,493 | 464,455 |
| `gameplay/js/power3d-loader.js` | 445 | 465 |
| `gameplay/js/skin-uv.js` | 5,399 | 5,409 |

### Tests, tooling, and archive references

- `tests/` contains 66 files. The four service-worker assertions above are statically stale. Phase-specific path assertions for relocated modules remain part of the test inventory; no suite was run.
- Tooling includes `tools/power-icons/bake.html` and related Power3D imports plus `tools/normalize-sfx.py`, which deliberately reads source audio from `referensi/` and writes normalized assets to `assets/`.
- No active runtime URL or configuration source into `referensi/` was found. Remaining matches are README rules, historical comments, test fixtures/negative assertions, or development-tool inputs; these do not make the archive a runtime dependency.

## 6. Findings carried forward

### Path and dependency

1. `shop.html` and `tambang.html` still use stale `assets/js/live-sync.js` script paths; current module is `assets/js/core/live-sync.js`.
2. The two `old/` HTML pages have 27 unresolved document-relative local script paths in total. First decide whether those routes must remain usable.
3. Mine Service’s `document.currentScript`-empty fallback can resolve `/multiplayer/client.js` instead of `/assets/js/multiplayer/client.js`. This was recorded in Phases 33–34 and remains unchanged.
4. The 20 manifest byte-count mismatches and four v187 test assertions are open integrity work, not runtime relocations performed in this phase.

### Architecture and extraction

1. Pet’s seven models and 21 sounds are manifest-owned content under `assets/`, not `data/`; four sounds are also consumed by Gameplay.
2. Root-level `aura-fx.js`, `frame-fx.js`, `pet-viewer.js`, and `blocky-character.js` remain shared renderer candidates requiring focused boundary/refactor work. `character-data.js` needs an ownership/source-generation audit first.
3. `mob-view.js` documents a standalone reusable renderer and has a legacy caller plus Splash preload entry; establish whether that legacy caller remains supported before deciding its move.
4. Dragon/Mob SFX ownership is unresolved. Keep Gameplay Audio as the system; audit whether the sounds are dynamic content or Gameplay-owned static support.
5. No broad consolidation/duplicate-source finding was evidenced. PlayerData, ItemCatalog, auth, guards, PWA/bootstrap, bridges, and page/scene-specific modules remain intentionally deferred.

### Lifecycle and cleanup (not fixed here)

- SceneBG resize and Ambience listeners are not fully removed by `destroy()`; `LIGHTSETS` holds mutable element references that can be overwritten by multiple mounts.
- Ambience listeners/subscriptions have no dispose API.
- Power-up preview teardown does not call the Power3D adapter’s `destroy()` (Phase 29/30 finding).

### Test and regression

- Extraction phases intentionally deferred test suites. Phase 35 ran static checks only.
- The stale service-worker assertions and manifest bytes must be reconciled before the final test pass.
- The static HTML result is not a browser/runtime result; old routes need a policy decision before classifying their failures as required fixes.

## 7. Remaining work and proposed roadmap

This roadmap is a proposal only. **Do not begin Phase 36 or any implementation until this inventory is reviewed and approved.** Audits must precede implementation; each actual move must remain atomic with its callers, preload, manifest, tests, tools, and cache/version references.

| Proposed phase | Scope and exit criteria |
|---|---|
| 36 — Path/preload/test preflight | Report-only audit of active LiveSync paths, legacy-page support, all 20 manifest byte deltas, stale v187 assertions, and any associated preload/SW policy. Decide which `old/` routes are supported. |
| 37 — Approved integrity corrections | If approved by that audit, update only confirmed active paths, supported legacy references, manifest byte counts, and matching test expectations. Verify no unrelated runtime logic changed; preserve service-worker cache policy. |
| 38 — Dynamic asset ownership preflight | Trace all callers and preload entries for Pet assets and Dragon/Mob SFX; determine exact `data/` layout and whether any other content-owned files are outside `data/`. Record explicit no-move decisions as well. |
| 39 — Pet asset relocation (conditional) | If the preflight confirms the Phase 35 architecture rule, move the seven models and 21 sounds once, update manifests, Pet page, Gameplay’s four reused sounds, preload, tests/tools, byte counts, and cache-version references atomically. No duplicate copies. |
| 40 — Shared renderer preflight | Map lifecycle, APIs, callers, generators, and global order for MobView and the remaining root renderer engines. Separate independent groups if their dependencies do not justify one atomic move. |
| 41 onward — Renderer refactor/extraction groups (conditional) | Handle the approved AuraFX/FrameFX/PetViewer/MobView groups as separate atomic implementation checkpoints where their contracts differ. Refactor before relocation when the audit identifies mixed responsibilities. Each group gets its own preflight and acceptance checks. |
| Subsequent — Character source/generator preflight and implementation (conditional) | Reconcile `blocky-character.js`, `character-data.js`, existing Character renderers, tooling, preload, and Gameplay. Decide one canonical generated/runtime source before any move; then implement only an approved coherent group. |
| Subsequent — Root module disposition audit | Classify remaining auth, guards, bridges, catalog/state, preload/PWA, room-flow, and scene/page modules as canonical-by-contract or needing specific work. Close candidates that require no path move with evidence; do not relocate for folder symmetry. |
| Final — Global verification and closure | After approved work, rerun full static reference/preload/path checks and the project’s final test/browser validation, then publish the closure report. Confirm no duplicate source of truth, all active paths resolve, and all intentionally deferred modules are explicitly accepted. |

### Estimate

The confirmed backlog requires at least:

- one report-only path/preload/test preflight and one conditional correction checkpoint;
- one content-ownership preflight and one conditional Pet relocation checkpoint;
- separate renderer and character preflights plus one or more implementation checkpoints; and
- one disposition review and one final verification/closure checkpoint.

**Estimate: approximately 9–12 additional phases after Phase 35**, with a provisional range around Phases 44–47 if the work remains bounded. This is not a fixed final phase number: the preflight audits may close candidates without moving them or may expose separate dependency groups that need their own checkpoints.

## 8. Global Extraction Closure criteria

Declare closure only after all of the following are true:

1. Every candidate has an evidence-based status; unresolved `NEEDS AUDIT` items have a decision, not an assumed move.
2. Every approved relocation has one canonical source, complete caller/preload/test/tool path updates, and no compatibility copy unless explicitly required and proven not to initialize twice.
3. Dynamic content and supporting assets follow the approved `data/` ownership rule; shared systems/renderers remain in `assets/`, with Gameplay/Multiplayer/vendor boundaries preserved or explicitly reviewed.
4. Active HTML and dynamic paths resolve; supported legacy pages have a deliberate compatibility decision.
5. Preload paths and byte counts match actual files; service-worker version and test assertions agree.
6. Public globals, classic-script order, module imports, URL resolution, storage/data/API contracts, and behavior are preserved.
7. All accepted deferrals and lifecycle findings are documented with owners/next actions; no unrelated redesign is included.
8. The final approved test/browser validation passes after extraction work is complete; test suites remain intentionally unrun in Phase 35.
9. Final audit confirms no duplicate source of truth, clean/synchronized `restruktur`, and unchanged `main`.

## 9. Phase 35 static verification and change boundary

- Verified branch, `HEAD`, `origin/restruktur`, remote `refs/heads/restruktur`, local/origin/remote `main`, and initial clean worktree.
- Rebuilt domain and file counts from the current tree.
- Recalculated preload integrity: 830 entries, zero missing paths, 20 byte-count mismatches listed above.
- Scanned local script references in 25 HTML files: 808 references, 29 unresolved paths; distinguished two active root pages from 27 legacy-page references.
- Checked current service-worker version and test assertions, category counts, Pet asset/manifests, current root JS candidates, path-sensitive source constructs, archive references, and Phase 1–34 relocation results.
- `git diff --check` is required after creating this report and before its report-only commit.
- No test suite, browser test, benchmark, or runtime test was run.
- **No runtime, HTML, CSS, data, test, tooling, preload, service-worker, or other non-report file was changed.**

## 10. Stop condition

Phase 35 ends with this inventory and proposed roadmap. No Phase 36 work, runtime change, or extraction was started. Wait for review and approval before proceeding.
