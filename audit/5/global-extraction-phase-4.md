# Dragon Roll — Global JavaScript Extraction Phase 4

Status: inventory and dependency audit complete. No JavaScript file was moved: the audit found no active, low-risk subsystem that can be relocated without changing a protected preload/cache contract or crossing a page/gameplay boundary. No gameplay, player data, catalog, API, or behavior was changed. Test suites and browser tests were not run.

## 1. Git baseline

| Check | Result |
|---|---|
| Branch | `restruktur` |
| Phase 3 checkpoint | `834cddeb284fe285f1e97629bd8fda75159d2e34` (`refactor(css): split shared base styles`) |
| Phase 3 audit | Present at `audit/5/global-extraction-phase-3.md` |
| Starting `HEAD` | `834cddeb284fe285f1e97629bd8fda75159d2e34` |
| Starting `origin/restruktur` after fetch | `834cddeb284fe285f1e97629bd8fda75159d2e34` |
| `main` and `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Starting worktree | Clean |

`main` was not checked out or modified. The baseline was fetched and verified against `origin/restruktur`; final hashes and worktree state are recorded in the delivery summary.

## 2. Prior audit context

Reviewed the Global Structure, Global Folder Foundation, JavaScript Phases 1–2, CSS Phase 3, and relevant Stage 1–8.4 reports. Current source and references were checked again; historical paths and claims were not treated as authoritative when the repository had since changed.

Constraints carried forward:

- The application is a static multi-page site with classic scripts, ES modules, generated sources, page-local code, and a separate Gameplay runtime.
- Script paths, source order, global APIs, the preload manifest, and service-worker behavior are runtime contracts.
- `PlayerData`, `ItemCatalog`, `ItemRegistry`/item manifests, server ownership/transactions, and Gameplay remain separate sources of truth and were not altered.
- Character Renderer Stage 8.4 integration remains out of scope.
- CSS Phase 3 did not change JavaScript or HTML. Its current checkpoint is the baseline above.

## 3. Repository-wide JavaScript inventory

Inventory includes `.js`, `.mjs`, and `.cjs` files outside `.git` and `node_modules`, including runtime, data manifests, vendor, tests, tools, archived, and reference code. File sizes are bytes as read from the clean Phase 3 baseline.

| Area | Files | Bytes | Ownership / responsibility |
|---|---:|---:|---|
| `assets/js/` | 103 | 2,731,038 | Shared classic-script APIs, services, page modules, renderers, DiceKit, Power3D, Multiplayer, and pinned vendor dependencies |
| `assets/lobby-backdrop/` | 1 | 13,541 | Standalone backdrop document animation |
| `data/inventory/` | 88 | 87,095 | Classic item manifests and category registries; consumed by `ItemRegistry` / `ItemCatalog` |
| `data/power/` | 1 | 14,266 | Power visual-effects definitions |
| `gameplay/js/` | 31 | 647,986 | Gameplay bootstrap, state/runtime, maps, effects, and HUD; protected domain |
| `hud/` | 7 | 32,511 | Shared HUD core and components |
| `sw.js` | 1 | 3,530 | Root service worker; protected |
| `tests/` | 65 | 373,527 | Automated test sources and helpers; not runtime modules |
| `tools/` | 14 | 168,652 | Generators, build inputs, and simulations; not runtime modules |
| `old/` | 2 | 20,291 | Archived JavaScript |
| `referensi/` | 22 | 195,317 | Design/reference JavaScript |
| **Total** | **335** | **4,287,754** | |

There are 53 HTML documents in the repository. A scan found 38 inline `<script>` blocks totaling 484,207 UTF-8 bytes. The table records the source HTML, block order, and script-body byte count; it includes archived, reference, and tooling HTML and does not imply each document is runtime-active.

| HTML source | Inline block | Bytes |
|---|---:|---:|
| `dadu.html` | 1 | 27 |
| `efek.html` | 1 | 27 |
| `frame.html` | 1 | 28 |
| `friendship.html` | 1 | 33 |
| `gameplay.html` | 1 | 118 |
| `hadiah-misi.html` | 1 | 33 |
| `index.html` | 1 | 45 |
| `inventory.html` | 1 | 32 |
| `karakter.html` | 1 | 31 |
| `leaderboard.html` | 1 | 32 |
| `leaderboard.html` | 2 | 34 |
| `lobby.html` | 1 | 28 |
| `mail.html` | 1 | 27 |
| `mode.html` | 1 | 27 |
| `mode.html` | 2 | 215 |
| `old/dailyreward.html` | 1 | 166 |
| `old/dailyreward.html` | 2 | 34 |
| `old/misi.html` | 1 | 166 |
| `old/misi.html` | 2 | 27 |
| `pet.html` | 1 | 26 |
| `powerup.html` | 1 | 118 |
| `powerup.html` | 2 | 30 |
| `profile.html` | 1 | 30 |
| `referensi/newgui/game/index.html` | 1 | 31 |
| `referensi/newgui/game/Mockup_GUI_Ular_Tangga_Blok.html` | 1 | 433,868 |
| `referensi/newgui/layout contoh( bukan UI ref ).html` | 1 | 4,585 |
| `referensi/voxel-fx-lab-refined.html` | 1 | 11,778 |
| `room.html` | 1 | 27 |
| `room.html` | 2 | 158 |
| `settings.html` | 1 | 31 |
| `shop.html` | 1 | 27 |
| `splash.html` | 1 | 32 |
| `splash.html` | 2 | 249 |
| `tambang.html` | 1 | 30 |
| `tools/character-preview.html` | 1 | 614 |
| `tools/frame-design/Character_Frames.html` | 1 | 29,621 |
| `tools/power-icons/bake.html` | 1 | 126 |
| `tools/power-icons/bake.html` | 2 | 1,696 |

### Domain and dependency map

| Domain / paths | Primary responsibility and dependency boundary | Globals / public contract |
|---|---|---|
| `assets/js/session.js`, `boot-guard.js`, `prefs.js`, `prefs-sync.js`, `app.js`, `core/live-sync.js` | Session/bootstrap, device preferences, app initialization, and cross-page state updates. Existing page order and storage dependencies are broad. | `UT.Session`, `UT.Prefs`, `UT.LiveSync`, `UT.App` |
| `assets/js/player-data.js`, `item-catalog.js`, `item-registry.js`, `wallet-service.js`, `appearance-service.js`, `mine-service.js`, `quest-data.js`, `achievement-data.js` | Player state, item identity, server wallet/appearance flows, and display metadata. PlayerData and ItemCatalog remain single sources of truth; service calls include server/RPC dependencies. | `PlayerData`, `ItemCatalog`, `UT.ItemRegistry`, `UT.WalletService`, `UT.AppearanceService`, `UT.Quest`, `UT.Achievement` |
| `assets/js/services/ads-service.js`, `services/mail-service.js`, `multiplayer/*.js` | Isolated UMD services and ES-module multiplayer client/presence/progress/room APIs. Mail retains its dynamic import of `../multiplayer/client.js`. | Existing `UT.Ads`, `UT.MailService`, and `UT.Multiplayer.*` names |
| `assets/js/pages/*.js`, root page controllers such as `shop-page.js`, `pet-page.js`, and `friendship-page.js` | DOM/page lifecycle and UI behavior. Their script tags depend on each page's DOM and shared stack; page filenames are referenced by tests/navigation. | Page-specific globals/hooks plus existing `UT` APIs |
| `assets/js/dice-kit/*.js` | Dice visual ES modules; `index.js`/renderers depend on sibling DiceCatalog, DiceTextures, physics/effects, and local Three vendor modules. | ES-module exports; `RoomDiceArt` is a separate page-facing global adapter |
| `assets/js/power3d/*.js` | Power visual ES modules; renderer composition depends on local module graph and Three import map. Loaded lazily by page/gameplay bridges. | ES-module exports and `UT.PowerOverlay` when lazily attached |
| Character/aura/frame/scene modules under `assets/js/` | Shared visual APIs, generated CharacterData/BlockyCharacter sources, and page/render lifecycle consumers. Character rendering is explicitly deferred from this phase. | Existing `UT.CharacterData`, `UT.BlockyCharacter`, `UT.AuraFX`, `UT.AuraView`, and related APIs |
| `data/inventory/**/manifest.js`, category `index.js`, `data/power/power-fx.js` | Registry metadata and visual effect definitions; manifests are classic scripts and the ItemRegistry/category indexes establish registration order. | `UT.ItemManifests`, `UT.ItemRegistry`, existing catalog interfaces |
| `gameplay/js/**`, `gameplay.html` | Separate gameplay runtime. `main.js` is 464,493 bytes; `dice-throw.js` has dynamic imports for DiceKit. Gameplay also dynamically imports multiplayer services. | Gameplay globals/config and existing bridge contracts; do not move in Phase 4 |
| `hud/**` | Shared HUD UI core and six already-organized components. | Existing HUD globals/components |
| `assets/js/vendor/**` | Pinned Three.js, addons, and Supabase client bundles. | Vendor module exports/globals; do not relocate |
| `tools/**`, `tests/**`, `old/**`, `referensi/**` | Build/test-only or archival/reference sources, not candidates for application-domain relocation. | Tool/test contracts or historical APIs |

### Script loading, modules, and URL-sensitive behavior

- The common root-page pattern remains `session -> boot-guard -> prefs/prefs-sync -> registry manifests -> ItemCatalog -> PlayerData -> required services -> app -> HUD -> optional LiveSync -> page controller`. Not every page loads every entry; no script order was modified.
- `gameplay.html` remains untouched. It starts with its frame/session guards and has a distinct Gameplay script chain; the separately audited runtime in `gameplay/js/` was not changed.
- ES-module boundaries include DiceKit, Power3D, Multiplayer, vendor modules, and build-only Aura modules. Their relative imports and import-map resolution were preserved.
- `document.currentScript` is used by `wallet-service.js`, `appearance-service.js`, `prefs-sync.js`, `services/mail-service.js`, `mine-service.js`, `scene-bg.js`, and `pwa.js`; several derive dynamic import URLs from the current script URL. These are path-sensitive.
- Direct `fetch()` calls occur in the service worker and shared asset/preloader code, with vendor Supabase fetch handling. No `import.meta.url` or Worker construction was found in the runtime source scan.
- `assets/preload-manifest.json` contains 102 entries under `assets/js/`; of 103 files under that directory, only the pinned `assets/js/vendor/supabase-js-2.119.0.mjs` is not listed. Thus moving a first-party `assets/js/` runtime file requires a manifest path/size change or a compatibility shim whose size and loading behavior must also be managed.
- All 102 `assets/js/` manifest paths exist, but three existing byte counts do not match the baseline files: `assets/js/blocky-character.js` lists 64,282 vs. 64,432 bytes; `assets/js/character-data.js` lists 38,603 vs. 50,120; `assets/js/item-catalog.js` lists 41,712 vs. 42,707. These are pre-existing checkpoint discrepancies, not caused by Phase 4. The manifest is explicitly protected, so they are recorded for a separately authorized cache/preload maintenance change and were not altered here.
- `sw.js` has a short explicit CORE list; other same-origin JavaScript uses its network-first fetch path. The service worker was not changed.
- Page-scoped DOM, state, and relative-asset URLs are not inferred safe merely because a file has no static import.

## 4. Extraction decision

No file was moved and no compatibility alias was created. Candidate review:

| Candidate | Findings | Decision |
|---|---|---|
| `assets/js/achievement-data.js` (4,417 bytes) | Standalone UMD calculation/display definitions. Runtime caller is `hadiah-misi.html`; test also reads the path. It is an entry in the protected preload manifest. | Defer until preload-manifest update is authorized and caller/test path updates can be delivered together. |
| `assets/js/room-dice-art.js` (322 bytes) | ES-module bridge imported by `room.html`; imports `./dice-kit/DiceCatalog.js` and `./dice-kit/DiceTextures.js`; `RoomDiceArt.thumb()` and `room-dice-art-ready` are existing contracts. It is a preload entry and a test checks its source path. | Defer; a move would change HTML, test, relative imports, and the protected manifest. Keep DiceKit's current subsystem boundary. |
| `assets/js/landscape.js` (291 bytes) | Current source is an intentional comment-only legacy placeholder. It is still referenced by Gameplay and archived pages. | Do not move an inert compatibility path or disturb the protected Gameplay HTML reference. |
| `assets/lobby-backdrop/backdrop.js` (13,541 bytes) | Its only script tag is in its sibling standalone `backdrop.html`; uses that document's DOM, local-storage controls, `window.lobbyEco`, message events, and document-relative `lobby-images/` assets. No active application page caller was found. | Keep with its standalone document; not a shared renderer candidate. |
| `session.js`, `app.js`, `prefs.js`, `prefs-sync.js`, PlayerData/ItemCatalog, all Gameplay, `sw.js`, preload manifest, and vendor Three.js | Explicitly protected by Phase 4; broad page-order, API, state, cache, or vendor contracts. | Do not move or alter. |
| `assets/js/` remaining first-party runtime modules | Existing page/API or subsystem callers were traced; all remaining paths in this group are listed in the preload manifest. | Defer until a phase authorizes the coupled preload/reference updates and a low-risk candidate is approved. |

Although `assets/js/renderers/` is a valid target, creating it empty or moving a page-bound module only to satisfy the diagram would be cosmetic and would add path/cache risk. Existing DiceKit, Power3D, Gameplay, HUD, and Registry folder boundaries remain in place.

## 5. Changed paths and compatibility

- Old path / new path: none.
- Caller, import, HTML script-order, test, service-worker, and preload references changed: none.
- Compatibility alias added: none.
- No source-of-truth copy or duplicate implementation was created.
- No JavaScript, HTML, Gameplay, data, PlayerData, ItemCatalog, Supabase/RPC, vendor, service-worker, or preload-manifest content changed.

## 6. Static verification and testing boundary

Static checks performed:

- Confirmed `restruktur`, clean baseline, Phase 3 audit/checkpoint, and remote equality after fetching `origin/restruktur`.
- Compared `HEAD` and `origin/main` to record the unchanged `main` baseline.
- Enumerated all 335 `.js` / `.mjs` / `.cjs` files and byte sizes, plus all HTML documents and inline script blocks.
- Searched HTML, tests, tools, service worker, preload manifest, imports, and source references for candidate path usage.
- Checked ES-module imports, dynamic imports, script ordering, global contracts, URL construction, `document.currentScript`, `import.meta.url`, Worker references, and direct `fetch()` references in runtime domains.
- Verified the 102 `assets/js/` preload entries have no missing/stale paths; recorded their three pre-existing byte-size mismatches and the single unlisted vendor module separately.
- Checked diff integrity and ensured protected source paths remain unchanged.

Not performed, as required:

- No test suite, test file execution, browser test, visual comparison, or Gameplay run.
- No runtime behavior claim is made from tests.

## 7. Risks and next work

- The no-move result is intentional, not an incomplete checkpoint: an `assets/js/` move would require protected preload/cache edits, and the unlisted standalone backdrop script is page-coupled rather than a reusable active subsystem.
- To extract a first-party `assets/js/` module in a later phase, authorize the corresponding `assets/preload-manifest.json` path/size change and decide whether the service worker version must change; then update all direct, dynamic, test, tool, and page references atomically.
- `session.js`, `app.js`, `prefs.js`, `prefs-sync.js`, PlayerData, ItemCatalog, multiplayer, Gameplay, vendor, and renderer integration remain deferred by dependency/risk.
- The Stage 8.4 Character Renderer integration remains a separate future scope and was not started.
- Tests and browser validation remain deferred until all global extraction phases are complete.

## 8. Full path and byte inventory

The following inventory is from the Phase 4 baseline; backslashes are used in repository paths. It includes runtime, data, vendor, tools, tests, archived, and reference JavaScript.

```text
assets\js\achievement-data.js|4417
assets\js\ambience.js|3819
assets\js\app.js|13154
assets\js\appearance-service.js|10382
assets\js\aura-fx.js|59215
assets\js\aura-view.js|4365
assets\js\auth.js|4089
assets\js\blocky-character.js|64432
assets\js\boot-guard.js|2138
assets\js\character-data.js|50120
assets\js\character-face.js|4408
assets\js\character-view.js|11810
assets\js\core\live-sync.js|4237
assets\js\dice-kit\DiceAnimation.js|13353
assets\js\dice-kit\DiceCatalog.js|18837
assets\js\dice-kit\DiceEffects.js|452
assets\js\dice-kit\DiceEffectsCore.js|35777
assets\js\dice-kit\DiceMaterials.js|2622
assets\js\dice-kit\DicePhysics.js|11915
assets\js\dice-kit\DiceRenderer.js|17188
assets\js\dice-kit\DiceTextures.js|15617
assets\js\dice-kit\index.js|1522
assets\js\dice-kit\RoomEnvironment.js|3779
assets\js\dice-kit\RoundedBoxGeometry.js|4809
assets\js\floating-island.js|11100
assets\js\frame-avatar.js|1971
assets\js\frame-fx.js|31305
assets\js\frame-guard.js|951
assets\js\friendship-page.js|16909
assets\js\game-integration.js|4792
assets\js\inventory-bridge.js|2181
assets\js\item-art.js|23445
assets\js\item-catalog.js|42707
assets\js\item-registry.js|12309
assets\js\landscape.js|291
assets\js\mine-island.js|23927
assets\js\mine-service.js|4575
assets\js\mob-view.js|13466
assets\js\multiplayer\client.js|2517
assets\js\multiplayer\config.example.js|368
assets\js\multiplayer\event-log.js|8497
assets\js\multiplayer\game-sync.js|5133
assets\js\multiplayer\presence.js|5209
assets\js\multiplayer\progress-service.js|1563
assets\js\multiplayer\room-service.js|6089
assets\js\night-fog.js|1951
assets\js\pages\dadu.js|8792
assets\js\pages\efek.js|11218
assets\js\pages\floatingsample.js|5443
assets\js\pages\frame.js|6902
assets\js\pages\hadiah-misi.js|16666
assets\js\pages\inventory.js|4071
assets\js\pages\karakter.js|92446
assets\js\pages\leaderboard.js|8698
assets\js\pages\lobby.js|13589
assets\js\pages\mail.js|8746
assets\js\pages\mode.js|9349
assets\js\pages\play.js|10506
assets\js\pages\powerup.js|9343
assets\js\pages\profile.js|13288
assets\js\pages\room.js|36987
assets\js\pages\settings.js|5863
assets\js\pages\splash.js|5917
assets\js\pages\tambang.js|15795
assets\js\pet-page.js|15865
assets\js\pet-viewer.js|50774
assets\js\player-data.js|37156
assets\js\podium-fx.js|5524
assets\js\power3d\PowerAnimation.js|6924
assets\js\power3d\PowerAura.js|7840
assets\js\power3d\PowerCatalog.js|11010
assets\js\power3d\PowerConfig.js|2713
assets\js\power3d\PowerEffects.js|25396
assets\js\power3d\PowerGeometry.js|18376
assets\js\power3d\PowerLighting.js|3579
assets\js\power3d\PowerMaterials.js|6086
assets\js\power3d\power-overlay.js|3018
assets\js\power3d\PowerParticles.js|8016
assets\js\power3d\PowerRegistry.js|859
assets\js\power3d\PowerRenderer.js|11730
assets\js\power3d\power-show.js|1350
assets\js\power3d\PowerSound.js|9327
assets\js\prefs.js|4552
assets\js\prefs-sync.js|5709
assets\js\preloader.js|6812
assets\js\pwa.js|663
assets\js\quest-data.js|1764
assets\js\room-dice-art.js|322
assets\js\room-flow.js|5137
assets\js\room-modal-bridge.js|1141
assets\js\scene-bg.js|11634
assets\js\services\ads-service.js|4060
assets\js\services\mail-service.js|5783
assets\js\session.js|1509
assets\js\shop-page.js|12166
assets\js\splash-fx.js|3865
assets\js\vendor\supabase-js-2.119.0.mjs|224351
assets\js\vendor\three.min.js|603451
assets\js\vendor\three.r170.module.min.js|691654
assets\js\vendor\three-addons\environments\RoomEnvironment.js|3750
assets\js\vendor\three-addons\geometries\RoundedBoxGeometry.js|4780
assets\js\vendor\three-addons\utils\BufferGeometryUtils.js|33141
assets\js\wallet-service.js|11919
assets\lobby-backdrop\backdrop.js|13541
data\inventory\aura\amethyst\manifest.js|637
data\inventory\aura\celestial\manifest.js|644
data\inventory\aura\dragon\manifest.js|626
data\inventory\aura\electric\manifest.js|626
data\inventory\aura\emerald\manifest.js|618
data\inventory\aura\ender\manifest.js|645
data\inventory\aura\flame\manifest.js|608
data\inventory\aura\frost\manifest.js|606
data\inventory\aura\index.js|2154
data\inventory\aura\nature\manifest.js|631
data\inventory\aura\nether\manifest.js|613
data\inventory\aura\ocean\manifest.js|633
data\inventory\aura\sculk\manifest.js|634
data\inventory\aura\shadow\manifest.js|632
data\inventory\aura\solar\manifest.js|636
data\inventory\aura\stone\manifest.js|629
data\inventory\character\alex\manifest.js|544
data\inventory\character\creeper\manifest.js|559
data\inventory\character\ender\manifest.js|568
data\inventory\character\index.js|2168
data\inventory\character\skeleton\manifest.js|563
data\inventory\character\steve\manifest.js|549
data\inventory\character\zombie\manifest.js|555
data\inventory\dice\amethyst\manifest.js|1244
data\inventory\dice\copper\manifest.js|1233
data\inventory\dice\diamond\manifest.js|1251
data\inventory\dice\dragon\manifest.js|1264
data\inventory\dice\emas\manifest.js|1269
data\inventory\dice\emerald\manifest.js|1245
data\inventory\dice\ender\manifest.js|1239
data\inventory\dice\frost\manifest.js|1238
data\inventory\dice\index.js|3098
data\inventory\dice\iron\manifest.js|1221
data\inventory\dice\klasik\manifest.js|1168
data\inventory\dice\lapis\manifest.js|1241
data\inventory\dice\magma\manifest.js|1239
data\inventory\dice\netherite\manifest.js|1254
data\inventory\dice\obsidian\manifest.js|1243
data\inventory\dice\prismarine\manifest.js|1254
data\inventory\dice\quartz\manifest.js|1246
data\inventory\dice\redstone\manifest.js|1259
data\inventory\dice\rumput\manifest.js|1121
data\inventory\dice\sculk\manifest.js|1231
data\inventory\dice\stone\manifest.js|1228
data\inventory\dice\tnt\manifest.js|1126
data\inventory\dice\void\manifest.js|1243
data\inventory\dice\wood\manifest.js|1247
data\inventory\frame\amethyst\manifest.js|773
data\inventory\frame\celestial\manifest.js|809
data\inventory\frame\copper\manifest.js|765
data\inventory\frame\cosmic\manifest.js|779
data\inventory\frame\default\manifest.js|776
data\inventory\frame\diamond\manifest.js|773
data\inventory\frame\dragon\manifest.js|761
data\inventory\frame\ender\manifest.js|769
data\inventory\frame\gold\manifest.js|794
data\inventory\frame\index.js|2705
data\inventory\frame\iron\manifest.js|734
data\inventory\frame\nether\manifest.js|754
data\inventory\frame\phoenix\manifest.js|795
data\inventory\frame\stone\manifest.js|748
data\inventory\frame\storm\manifest.js|764
data\inventory\pet\arcane_owl\manifest.js|1275
data\inventory\pet\celestial_kitsune\manifest.js|1366
data\inventory\pet\copper_golem\manifest.js|1286
data\inventory\pet\crystal_axolotl\manifest.js|1327
data\inventory\pet\forest_pup\manifest.js|1283
data\inventory\pet\index.js|2542
data\inventory\pet\inferno_dragon\manifest.js|1315
data\inventory\pet\storm_wolf\manifest.js|1281
data\inventory\power\blaze_core\manifest.js|664
data\inventory\power\diamond_sword\manifest.js|583
data\inventory\power\dragon_crystal\manifest.js|622
data\inventory\power\feather\manifest.js|538
data\inventory\power\fire_charge\manifest.js|643
data\inventory\power\golden_apple\manifest.js|600
data\inventory\power\grass\manifest.js|544
data\inventory\power\ice_crystal\manifest.js|612
data\inventory\power\index.js|2879
data\inventory\power\nether_star\manifest.js|598
data\inventory\power\netherite_sword\manifest.js|829
data\inventory\power\potion_even\manifest.js|575
data\inventory\power\potion_odd\manifest.js|572
data\inventory\power\sword\manifest.js|788
data\inventory\power\tnt\manifest.js|595
data\inventory\power\totem\manifest.js|610
data\inventory\power\trident\manifest.js|564
data\inventory\power\wooden_shield\manifest.js|625
data\power\power-fx.js|14266
gameplay\js\afk.js|6143
gameplay\js\app-init.js|31
gameplay\js\audio.js|16786
gameplay\js\biomes.js|1845
gameplay\js\config.js|10095
gameplay\js\creeper-fx.js|5796
gameplay\js\dice-pad.js|2057
gameplay\js\dice-throw.js|27326
gameplay\js\dice-ui.js|4870
gameplay\js\feedback.js|5060
gameplay\js\firework-fx.js|5647
gameplay\js\fx.js|6551
gameplay\js\game-core.js|9133
gameplay\js\hud.js|16440
gameplay\js\hud-scale.js|2366
gameplay\js\hud-sync.js|1902
gameplay\js\level-up.js|4941
gameplay\js\main.js|464493
gameplay\js\maps\nether.js|9170
gameplay\js\maps\registry.js|1544
gameplay\js\maps\world.js|1334
gameplay\js\module-bridge.js|3744
gameplay\js\multiplayer-init.js|122
gameplay\js\particle-fx.js|6612
gameplay\js\pause.js|3766
gameplay\js\power3d-loader.js|445
gameplay\js\ready.js|16841
gameplay\js\skin-uv.js|5399
gameplay\js\themes.js|1409
gameplay\js\three-fallback.js|885
gameplay\js\voxel-geom.js|5233
hud\components\badge.js|3143
hud\components\button.js|3192
hud\components\card.js|3497
hud\components\currency.js|5454
hud\components\modal.js|8284
hud\components\toast.js|6745
hud\ui-core.js|2196
old\assets\js\pages\dailyreward.js|14516
old\assets\js\pages\misi.js|5775
referensi\newgui\game\js\dadu.js|6686
referensi\newgui\game\js\efek.js|6909
referensi\newgui\game\js\embed.js|855
referensi\newgui\game\js\frame.js|6116
referensi\newgui\game\js\friendship.js|5423
referensi\newgui\game\js\heroes.js|1938
referensi\newgui\game\js\karakter.js|4352
referensi\newgui\game\js\leaderboard.js|3651
referensi\newgui\game\js\lobby.js|10830
referensi\newgui\game\js\mail.js|4530
referensi\newgui\game\js\mission.js|10495
referensi\newgui\game\js\mode.js|7915
referensi\newgui\game\js\pet.js|13527
referensi\newgui\game\js\pet-viewer.js|48250
referensi\newgui\game\js\powerup.js|7788
referensi\newgui\game\js\profile.js|7555
referensi\newgui\game\js\room.js|17397
referensi\newgui\game\js\settings.js|4972
referensi\newgui\game\js\shop.js|12336
referensi\newgui\game\js\splash.js|5436
referensi\newgui\game\js\sub.js|2403
referensi\newgui\game\js\tambang.js|5953
tests\_page.js|1103
tests\achievement-data.test.js|2077
tests\appearance-service.test.js|16221
tests\aura-catalog.test.js|4918
tests\aura-fx.test.js|5375
tests\aura-registry-parity.test.js|7998
tests\aura-view.test.js|7889
tests\blocky-actions.test.js|13631
tests\blocky-character-generator.test.js|1374
tests\buy-set-sql.integration.test.js|8157
tests\character-registry-parity.test.js|10824
tests\character-rig-adapter.test.js|5982
tests\dice-landing-stall.test.mjs|3303
tests\dice-registry-parity.test.js|18279
tests\dice-sound-variation.test.js|1418
tests\frame-catalog-integration.test.js|12811
tests\frame-registry-parity.test.js|10098
tests\game-core.test.js|9123
tests\gameplay-assets-external.test.js|1995
tests\gameplay-boss-hit.test.js|1914
tests\gameplay-crystal-layout.test.js|1277
tests\gameplay-dice-rendering.test.js|2124
tests\gameplay-dice-throw-race.test.mjs|5387
tests\gameplay-emote-layout.test.js|560
tests\gameplay-exit-confirm-layout.test.js|1328
tests\gameplay-mob-hit-panel.test.js|2872
tests\gameplay-mob-landing-resolve.test.js|1323
tests\gameplay-power-landing-resolve.test.js|1945
tests\gameplay-roll-button.test.js|610
tests\gameplay-stage-full-width.test.js|1180
tests\gameplay-turn-hud-layout.test.js|1309
tests\gameplay-win-result.test.js|2016
tests\gear-catalog.test.js|1980
tests\gear-player-data.test.js|5503
tests\item-registry.test.js|8620
tests\karakter-equip.test.js|10305
tests\leaderboard-ui.test.js|1151
tests\legacy-cleanup.test.js|5172
tests\live-sync.test.js|4512
tests\lobby-appearance.test.js|2717
tests\lobby-background.test.js|3076
tests\mail-service.test.js|4841
tests\mine-island.test.js|11335
tests\mine-service.test.js|3816
tests\mission-list.test.js|970
tests\multiplayer\event-log.test.js|7351
tests\no-cdn.test.js|1583
tests\outfits-player-data.test.js|8269
tests\pages-split.test.js|2313
tests\pet-catalog.test.js|8189
tests\pet-registry-parity.test.js|22618
tests\pet-ui.test.js|2730
tests\player-data-server.test.js|28722
tests\power3d.test.js|4303
tests\power-registry-parity.test.js|14550
tests\power-rules.test.js|14526
tests\prefs.test.js|5452
tests\prefs-sync.test.js|5258
tests\room-looks.test.js|1754
tests\room-page-modal.test.js|3922
tests\schema-snapshot.test.js|1198
tests\session.test.js|2044
tests\settings-prefs.test.js|3362
tests\shop-render.test.js|723
tests\store-card-status.test.js|4241
tools\aura-fx\build.js|3085
tools\aura-fx\src\AuraCatalog.js|15277
tools\aura-fx\src\AuraConfig.js|2471
tools\aura-fx\src\AuraDecor.js|21710
tools\aura-fx\src\AuraParticles.js|6647
tools\aura-fx\src\AuraSystem.js|12240
tools\blocky-character\build.js|2984
tools\blocky-character\template.js|64432
tools\character-data\build.js|10348
tools\character-data\extract.js|2562
tools\character-data\template.js|15741
tools\sim\balance.js|4183
tools\sim\boss-balance.js|2030
tools\wallet\gen-item-seed.js|4942
sw.js|3530
```
