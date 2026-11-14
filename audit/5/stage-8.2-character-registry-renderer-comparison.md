# Dragon Roll — Stage 8.2: Character Registry & Renderer Comparison

## Status

**IMPLEMENTED + TESTED (Node/VM). Renderer selection is NOT FINAL.** The six existing Character/Skin entries now have Registry manifests, and `ItemCatalog` adopts them without changing its item objects or legacy identifiers. No migration, database/RPC, PlayerData, renderer, animation, asset-model, or pawn implementation was changed. No Character catalog/purchase UI was added.

## Source audits reviewed

[Stage 1](stage-1-core-architecture.md), [Stage 2](stage-2-core-foundation.md), [Stage 3](stage-3-frame-integration.md), [Stage 4](stage-4-pet-registry.md), [Stage 4.1](stage-4.1-pet-audio-manifest.md), [Stage 5](stage-5-dice-registry.md), [Stage 6](stage-6-power-registry.md), [Stage 7](stage-7-aura-registry.md), [Stage 8.0](stage-8.0-terminology-audit.md), and [Stage 8.1](stage-8.1-character-architecture-design.md). Current source and tests were checked independently; older audit notes were treated as context, not as the source of truth.

## 1. Git checkpoint

| Check | Result |
|---|---|
| Branch | `restruktur` |
| Starting HEAD / `origin/restruktur` | `f99b633ff7b9d8012fbb59198360ac45238aee8f` |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Starting worktree | clean |
| Implementation checkpoint | `1b5dccdaec3066c0ff6b22c36e098e7b90dea946` |
| Implementation push | pushed to `origin/restruktur`; remote ref was verified at the same SHA |
| Audit checkpoint | committed and pushed separately; final SHA and `HEAD == origin/restruktur` are recorded in the task completion result |

`main` was not changed. The audit-only commit follows the implementation checkpoint.

## 2. Current system and source audit

### Existing Character catalog data

The source values in [item-catalog.js](../../assets/js/item-catalog.js) and `tests/fixtures/item-catalog-baseline.json` are:

| Existing ID | Planned canonical ID (metadata only) | Name | gameKey / base model | Group | Rarity | Price | Starter / default |
|---|---|---|---|---|---|---:|---|
| `skin.steve` | `character.steve` | Steve | `steve` | Default | common | 0 Koin | starter; default equipped and fallback |
| `skin.alex` | `character.alex` | Alex | `alex` | Default | common | 0 Koin | starter |
| `skin.creeper` | `character.creeper` | Creeper | `creeper` | Adventure | common | 0 Koin | starter |
| `skin.zombie` | `character.zombie` | Zombie | `zombie` | Adventure | common | 0 Koin | starter |
| `skin.skeleton` | `character.skeleton` | Skeleton | `skeleton` | Rare | rare | 300 Koin | not starter |
| `skin.ender` | `character.ender` | Enderman | `ender` | Epic | epic | 700 Koin | not starter; featured |

All six existing entries use `renderer: 'palette'`, `texture: null`, and have no `tier` field. `steve` alone is the default equipped character (`skin.steve`); the other three zero-price entries are also starter items. The Registry's `canonicalId` records the planned namespace only: each manifest's actual `id` and `kind` remain `skin.*` / `skin`.

The model definitions already exist in [character-data.js](../../assets/js/character-data.js), under `CharacterData`'s `player` group. Each manifest's `visual.baseModelKey` points to that existing key; the category references the shared model data file. Individual `assets` are empty because these six models are procedural data, not separate model files.

### State, server, and neighboring domains

- [player-data.js](../../assets/js/player-data.js) remains the client state API. `equipped.skin`, `defaultEquipped.skin`, `owns('skin.*')`, and `look.skin` remain distinct. `look.skin` is the appearance color (`s1`–`s5`), not a Character ID.
- Gear remains `kind: gear` with its existing `g.*` slots. Outfit stores Gear selections, not Character identity. Aura remains its own `kind: aura`, `slot: aura`, `AuraView`, and `AuraFX` domain.
- Supabase still contains the six `skin.*` catalog IDs and `kind: skin`; `_item_equip_slot()` maps them to the existing `skin` slot. Daily rewards and public profile compatibility still use old identifiers/`characterSkinId`. No SQL, RPC, seed, API, or server file changed.
- The server remains the authority for ownership and transactions. The Registry stores definitions only.

## 3. Implementation and data flow

Created six manifests and a category index following the existing classic-script Registry pattern:

```text
data/inventory/character/<gameKey>/manifest.js
  -> data/inventory/character/index.js (category key/kind = skin; UI label = Karakter)
  -> ItemRegistry.shared()
  -> ItemCatalog.skinFromManifest()
  -> existing ItemCatalog item objects (ID, kind, slot, and shape unchanged)
  -> existing PlayerData / page consumers
```

The manifest records `id`, `canonicalId`, `kind`, `gameKey`, name/group, rarity, price, `gems`, starter/featured status, `visual.renderer`, and `visual.baseModelKey`. It contains no ownership, equip, inventory, wallet, transaction, Look, Gear, Outfit, or Aura state.

`ItemCatalog` exposes the additive diagnostic `skinSource()` (`'registry' | 'legacy'`). It adopts the Registry only when the category is complete and matches the existing catalog. If the Registry or a manifest is absent/incomplete, the old builder remains the fallback. The adapter deliberately does not expose `canonicalId` or the new base-model reference in public item objects, so the legacy public item shape remains unchanged.

The approved UI category label is now **Karakter** (`CATEGORIES`/`categoryLabel`); the technical key, kind, noun slot identifier, and equip slot remain `skin`. No separate Character ownership source or equipment slot was introduced.

## 4. Page and catalog integration

The static script chain is `item-registry.js` → six Character manifests → Character `index.js` → `item-catalog.js`. It is present and ordered on:

- [karakter.html](../../karakter.html)
- [lobby.html](../../lobby.html)
- [profile.html](../../profile.html)
- [room.html](../../room.html)
- [gameplay.html](../../gameplay.html)
- [mode.html](../../mode.html)
- [leaderboard.html](../../leaderboard.html)
- [hadiah-misi.html](../../hadiah-misi.html)

The first five already loaded other Registry categories; Character manifests were added before `ItemCatalog`. `mode.html`, `leaderboard.html`, and `hadiah-misi.html` now load the Registry chain as well because their existing flow reads Character entries or counts owned `kind: skin` items. Tests verify ordering, unique script tags, and file existence.

No new Character tab or purchase UI was created in Shop/Inventory: the current Inventory tabs are Frame, Dice, Aura/Effect, Power-up, and Pet, while the Karakter page is currently an appearance/Gear builder. Those pages keep working through the legacy fallback where no Character chain is loaded. A purchasable Character catalog and preview flow remain planned work, not a Stage 8.2 implementation.

The Service Worker cache version was increased from `ut-pwa-v180` to `ut-pwa-v181`. The seven new JS files (six manifests plus index) were added to `assets/preload-manifest.json`; Python was unavailable, so the entries were updated with Node using actual filesystem byte sizes and are checked by the new test.

## 5. Legacy compatibility and registry parity

Verified by `tests/character-registry-parity.test.js`:

- Exactly six Registry items; same order, IDs, `kind`, `gameKey`, names, groups, rarity, prices, descriptions, starter status, and featured state as the baseline.
- Every base-model key resolves in `CharacterData`; manifest and category asset-path validation pass.
- `ItemCatalog.items` is deep-equal to the entire 147-item baseline through both the Registry and fallback paths.
- `byId('skin.*')`, `byGameKey('skin', key)`, `defaultEquipped.skin`, `fallbackSkinId()`, and the `skin` slot remain unchanged. `character.*` is not accepted as a live item ID.
- Mutating Enderman's manifest in an isolated VM changes the Registry-backed catalog, confirming the manifest is the active source when complete.
- Removing a manifest activates the unchanged legacy catalog.
- Existing ItemCatalog APIs retain their names/types. `skinSource()` is an additive diagnostic, like other category source getters.
- PlayerData snapshots are unchanged by category registration: the default remains `skin.steve`, only `skin.*` is owned/equipped, and `look.skin: 's3'` remains a color.
- Existing Gear/Aura metadata and Outfit state are not redefined; the complete catalog remains baseline-identical.

## 6. Renderer comparison

### Implementations

- [CharacterView](../../assets/js/character-view.js) uses [CharacterData](../../assets/js/character-data.js) and accepts either an old `skin.*` ID or a raw gameKey. It selects a base model, constructs articulated parts from procedural voxel boxes, and exposes `userData.anim(t)` / `setEmote()`. It has custom rig layouts for Creeper and Ender; Steve, Alex, Zombie, Skeleton, and Villager use the humanoid rig. Unknown keys fall back to Steve.
- [BlockyCharacter](../../assets/js/blocky-character.js) is generated from [karakter.html](../../karakter.html) and is the shared customizable appearance rig. `loadFromPlayer()` reads `PlayerData.look()` and `gearLook()`; `loadFromData()` consumes Look and Gear from server appearance; `loadPreset()` supplies deterministic generic appearances. It does **not** read `equipped.skin` or select one of the six base models.
- `CharacterView.make()` has one current production call site: [tambang.js](../../assets/js/pages/tambang.js), as a fallback miner renderer when `UT.BlockyCharacter` is unavailable. It is not the current Player renderer in Lobby, Profile, Room, or Gameplay.
- `BlockyCharacter` uses multiple box meshes, generated CanvasTexture/materials, and optional Gear. `CharacterData.mesh()` builds vertex-colored buffer geometry per articulated body part. These are source-level implementation observations only; no FPS, memory, or draw-call benchmark was run. Neither exposed character API provides a character-level dispose method in its returned interface.

### Consumer matrix

| Consumer | Current behavior | Identity/model gap |
|---|---|---|
| Character Builder | The page's `BlockyCharacter` builder edits Look and Gear and stores them through PlayerData. | It does not select or render a `skin.*` base model. The “skin” Look field remains color. |
| Lobby | `BlockyCharacter.loadFromPlayer()` renders the hero; `CharacterFace` supplies the avatar image. Aura is applied separately. | Both use the player's appearance, not `equipped.skin` to select a base model. |
| Profile | `BlockyCharacter.loadFromPlayer()` renders the podium character; `CharacterFace` supplies the face. | Same missing base-model selection; Aura stays a separate effect. |
| Room | The local avatar and remote online avatars use `CharacterFace`; remote data comes from room appearance (`look`, Gear, dye). `characterSkinId` is published as the legacy public-profile alias, but the current avatar path does not use it to pick a model. | Room visuals preserve appearance but do not render the selected Character identity. |
| Gameplay | `makePawn()` first builds its legacy palette pawn using the game skin key. The modern pawn path upgrades local/remote players to `BlockyCharacter` using PlayerData/server appearance; CPU uses a preset. The legacy branch still has its own Creeper/Ender/Skeleton/Steve/Alex/Zombie visual cases. | The modern customizable renderer does not choose the equipped base model; the legacy and modern paths can therefore display different identity/appearance combinations. `makePawn()` was not changed. |
| Character/catalog preview | `ItemArt`/`CharacterData` can render palette previews; no new Character catalog UI was added. | There is no single current preview path combining Registry identity with Look/Gear. |
| CharacterView caller | `tambang.js` uses it only for fallback NPC miners (Alex/Zombie/Skeleton) if BlockyCharacter is missing. | It is not integrated into PlayerData or normal player rendering. |

### Capability matrix

| Aspect | BlockyCharacter | CharacterView |
|---|---|---|
| Base identity choice | Not from `equipped.skin`; generic builder/presets. | Yes, from `skin.*`/gameKey via CharacterData. |
| Six model shapes | No model selection for the six IDs. | CharacterData has all six; Creeper and Ender have dedicated rig layouts. |
| Look / color / hair / body | Yes, through the builder's Look configuration. | No PlayerData Look application. |
| Gear and dye | Yes, through PlayerData/server appearance. | No Gear or Gear-dye support. |
| Animation | `idle`, `walk`, `run`, jump, tick, and gameplay actions (attack, bow, block, cheer, wave, flips, roll, mine, etc.). | Idle and named emotes (wave, dance, victory, cheer, laugh, celebrate, mine, sit); no walk/run locomotion API. |
| Gameplay pawn | Integrated into the modern pawn upgrade path; retains pawn actions and tools. | Not used by `makePawn()` or normal Gameplay pawns. |
| Lobby/Profile/Room | Shared current player appearance renderer/face path. | Not the active renderer for those pages. |
| Model source / load | Procedural Three.js rig; no per-Character model download. | Procedural CharacterData boxes/meshes; no per-Character model download. |
| Compatibility | Broad existing caller set; currently appearance-first. | Narrow current caller set; accepts legacy Skin IDs but not canonical `character.*` IDs. |
| Performance/lifecycle | More customizable geometry/materials and CanvasTexture; no benchmark performed. | Meshes are combined per body part; no benchmark performed. |

### Recommendation (not a renderer decision)

Keep the Character Registry as the identity/metadata source and keep Look, Gear, Outfit, Aura, and rendering as separate responsibilities. Neither existing renderer alone currently provides both selected base identity and the player's full Look/Gear: BlockyCharacter is the established player-appearance/gameplay rig but lacks model selection; CharacterView supports model identity but lacks player appearance, Gear, and gameplay locomotion/actions. The next design should decide how a chosen `baseModelKey` composes with Look/Gear and animation before creating any renderer adapter. This report does not select a primary renderer.

## 7. Catalog integration plan (UI deferred)

1. **List source:** the six Character manifests, adopted by ItemCatalog while preserving its old item view.
2. **Starter/ownership:** `starter` is metadata; PlayerData/server remains the only ownership state. Steve is the default equipped fallback. The other three free characters are starter entries in existing data. The two paid entries use the existing prices.
3. **Selection:** continue through `PlayerData.equip('skin.<gameKey>')` until an approved migration; do not create a second selection slot.
4. **Purchase:** display current price as Koin and use the existing server-validated item purchasing path in a future UI. No new buy API or client-owned balance was added.
5. **Appearance:** selecting a Character must eventually affect Lobby, Profile, Room/public profile, and Gameplay consistently while preserving or explicitly defining Look/Gear behavior.
6. **Preview:** use Registry identity to resolve an existing base model. Whether previews use CharacterView, BlockyCharacter, or a later composed renderer remains open.
7. **Inventory/Shop:** add a Character catalog/tab only in the planned UI stage; do not duplicate ownership or transactions.

## 8. Risks and dependencies for later stages

- **Renderer mismatch:** current production players are appearance-first; a base-model choice is not yet reflected in Lobby/Profile/Room or the modern Gameplay renderer.
- **Non-humanoid compatibility:** Creeper, Ender, and Skeleton proportions may not sensibly accept every current Gear/Look feature. Product behavior must be decided before applying Gear to these models.
- **Identifier migration:** server catalog, `equipped.skin`, local saves, appearance payloads, `characterSkinId`, daily rewards, and game config still speak the old IDs/slot. `canonicalId` is inert metadata and no dual-read/write or migration was introduced.
- **Compatibility fallback:** metadata remains duplicated in the old ItemCatalog builder for consumers that do not load this Registry chain. Parity tests protect that fallback until it can be deliberately retired.
- **Existing server semantics:** server rows, equip validation, public-profile sanitization, and daily rewards must remain compatible until a later migration is designed and approved.
- **Open decisions before Stage 8.3:** primary renderer/composition approach; Look/Gear compatibility for each base model; whether changing Character identity should affect other players' public appearance immediately; migration/alias strategy and rollout/rollback; catalog preview behavior and purchase UX.

## 9. Test and verification results

### Stage 8.2 and related tests

| Check | Result |
|---|---|
| `node tests/character-registry-parity.test.js` | **9/9 passed** |
| `node tests/frame-catalog-integration.test.js` | **21 passed** |
| `node tests/aura-registry-parity.test.js` | **7/7 passed** |
| `node tests/dice-registry-parity.test.js` | **27/27 passed** |
| `node tests/power-registry-parity.test.js` | **11/11 passed** |
| `git diff --check` | passed |
| Protected source diff (`gameplay/js/main.js`, `assets/js/player-data.js`, `supabase/`) | none |

### Full Node suite

All **59** `tests/*.test.js` suites were run after implementation:

- **53 passed**
- **1 skipped:** `buy-set-sql.integration.test.js` requires `PSQL_CMD`; it reported skipped.
- **5 failed:** `blocky-actions.test.js`, `gameplay-win-result.test.js`, `pet-catalog.test.js`, `power-rules.test.js`, and `schema-snapshot.test.js`.

These same five are documented as baseline failures in the prior Stage 7 audit. The `pet-catalog` assertion (`pet:'pet.html'` in `lobby.html`) is absent in both the starting `HEAD` version and the current file. The `schema-snapshot` failure is environmental (`spawnSync sh ENOENT` on Windows). The other failures are in existing Gameplay, Pet UI, and Power assertions; their implementation files/logic were not changed in Stage 8.2. The previously documented Stage 7 `aura-view` failure now passes.

The focused Registry test uses Node VM execution and static HTML script-order checks. `jsdom` is unavailable in this environment. No real-browser, visual, audio, or live Gameplay verification was performed.

## 10. Files changed

**Created:** six manifests and `data/inventory/character/index.js`; `tests/character-registry-parity.test.js`; this audit report.

**Changed:** `assets/js/item-catalog.js`; eight consumer HTML script chains; `assets/preload-manifest.json`; `sw.js`; existing Registry tests updated for the additive `skinSource()` API and cache-version increment.

**Not changed:** PlayerData, Look data format, Outfit/Gear/Aura implementation, `BlockyCharacter`, `CharacterView`, CharacterData model data, `makePawn()`, Gameplay implementation, Supabase schema/seed/RPC, or server contracts.

## 11. Git delivery

The implementation checkpoint `1b5dccdaec3066c0ff6b22c36e098e7b90dea946` was pushed to `origin/restruktur` and verified against the remote ref before the separate audit-only checkpoint. Final branch, clean worktree, remote equality, and unchanged `main` were checked after the audit commit; the final hashes and push status are included in the completion response.
