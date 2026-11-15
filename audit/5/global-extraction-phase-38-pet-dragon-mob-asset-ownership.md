# Global Extraction Phase 38 — Pet, Dragon, and Mob Asset Ownership Audit

## 1. Baseline Git

- Branch: `restruktur`
- `HEAD`: `e34291e2098921296bcf11907373429aa43a12e1`
- `origin/restruktur`: `e34291e2098921296bcf11907373429aa43a12e1`
- Remote `refs/heads/restruktur`: `e34291e2098921296bcf11907373429aa43a12e1`
- Local `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before this report was created.

No branch, runtime, content, test, preload, or service-worker changes were made for this audit.

## 2. Scope and method

This is a static ownership and dependency audit of:

- Seven Pet PNG files in `assets/ng/pet3d/`.
- Twenty-one Pet MP3 files in `assets/sfx/pet/`.
- Eight Dragon MP3 files in `assets/sfx/dragon/`.
- Nine Mob MP3 files in `assets/sfx/mob/`.

The audit compared actual files, SHA-256 hashes, Pet manifests, registry/page consumers, Gameplay audio mappings and calls, preload entries, cache handling, tests, documentation, and asset-generation tools. No test suite, browser test, benchmark, or runtime test was run.

### Summary decision

- **Seven Pet PNGs:** `CONTENT_OWNED`, high confidence. Recommend moving these alone in Phase 39 to each existing Pet item folder under `data/inventory/pet/`.
- **Twenty-one Pet SFX:** `CONTENT_OWNED`, high confidence. Each file belongs to one Pet manifest and no Pet SFX is shared between different Pets. Four are additionally reused by Gameplay Power sounds. Defer the whole SFX group to a separate phase because the normalizer, Gameplay path resolution, tests, documentation, preload, and cache version must be handled together.
- **Dragon/Mob SFX:** not dynamic-content assets. Their consumers are the Gameplay audio system and Power effects. Keep shared sounds in `assets/sfx/`; only three active, Gameplay-specific candidates have a possible future target under `gameplay/assets/sfx/`. Three Mob files have no current consumer and remain `UNRESOLVED`; do not move or delete them based on filename alone.
- Recommended next implementation scope: **Pet PNGs only**. This is `READY WITH CONDITIONS`, because the seven manifests, page path builder, static path assertions, preload manifest, and cache version must move together.

## 3. Pet PNG inventory

The PNGs are Pet card/grid artwork, not external 3D meshes. `assets/js/pet-viewer.js` builds the animated Pet visuals procedurally. The active page builds each image URL from `IMAGE_ROOT + item.gameKey + '.png'`; the matching Pet manifest independently records the same path in `assets.image`.

| Asset | Current path | Bytes | SHA-256 | Owner / classification | Active consumer | Proposed target | Confidence |
|---|---|---:|---|---|---|---|---|
| Arcane Owl | `assets/ng/pet3d/arcane_owl.png` | 70048 | `4C4E4ABFAF4648E4072D9C27609C7F2DB641D2047FD9EDFB3A6034CF3A8419AE` | Pet Arcane Owl / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `arcane_owl/manifest.js` | `data/inventory/pet/arcane_owl/arcane_owl.png` | HIGH |
| Celestial Kitsune | `assets/ng/pet3d/celestial_kitsune.png` | 67714 | `C97E04947C159A667EC5D14D56E3863E325E7810B6FB521979CE543DAFCA2F5F` | Pet Celestial Kitsune / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `celestial_kitsune/manifest.js` | `data/inventory/pet/celestial_kitsune/celestial_kitsune.png` | HIGH |
| Copper Golem | `assets/ng/pet3d/copper_golem.png` | 65279 | `85E154A322AA9039EB7D89726517A6282F222D4E15E03AEFA9380BA3381C3DBF` | Pet Copper Golem / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `copper_golem/manifest.js` | `data/inventory/pet/copper_golem/copper_golem.png` | HIGH |
| Crystal Axolotl | `assets/ng/pet3d/crystal_axolotl.png` | 64581 | `A26D0676582456F3FB5DE1DAD21A3A1621EDD6BBAA2DA87CCD297EA8A7AAF0AE` | Pet Crystal Axolotl / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `crystal_axolotl/manifest.js` | `data/inventory/pet/crystal_axolotl/crystal_axolotl.png` | HIGH |
| Forest Pup | `assets/ng/pet3d/forest_pup.png` | 63044 | `41348916C09DB07A77F3B7AD268BDD830DC552F6C4DBD4BD56A7458F597370C8` | Pet Forest Pup / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `forest_pup/manifest.js` | `data/inventory/pet/forest_pup/forest_pup.png` | HIGH |
| Inferno Dragon | `assets/ng/pet3d/inferno_dragon.png` | 66689 | `EBD74541FCF9F0C818BB6E93DFD584EE1DD1AD8298A66E4C05E6F09B3D749008` | Pet Inferno Dragon / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `inferno_dragon/manifest.js` | `data/inventory/pet/inferno_dragon/inferno_dragon.png` | HIGH |
| Storm Wolf | `assets/ng/pet3d/storm_wolf.png` | 64556 | `47F5F0622F360809A79F93BC6FB70C350BB8C7C98D4E58DD033B86B24569A385` | Pet Storm Wolf / `CONTENT_OWNED` | `pet.html` → `pet-page.js`; `storm_wolf/manifest.js` | `data/inventory/pet/storm_wolf/storm_wolf.png` | HIGH |

### Pet image findings

- All seven image files have one matching Pet manifest and one active image-path builder.
- `tests/pet-registry-parity.test.js` asserts that `IMAGE_ROOT + gameKey + '.png'` matches `assets.image`; `tests/pet-catalog.test.js` checks each file in the old directory.
- The Pet manifests and root page use document-relative paths. `pet-page.js` does not resolve these paths relative to its own script URL.
- No PlayerData, ItemCatalog public shape, Supabase, RPC, localStorage, or Pet API change is needed for a path-only move.

## 4. Pet SFX inventory

Each of the 21 MP3 files is named for, recorded in, and loaded from the manifest of exactly one Pet. `pet-viewer.js` reads each Pet's `assets.sfx` array from `UT.ItemRegistry`; it does not maintain a second path table. The parity test asserts distinct per-Pet sound paths and checks that all 21 manifest paths exist.

Four Pet-authored sounds are also deliberately reused by Gameplay Power effects. The Gameplay audio table and its comments identify these as reuse of existing Pet sounds; this does not create another file or another Pet owner. They remain `CONTENT_OWNED` by their Pet, with the additional consumer recorded below.

| Asset | Current path | Bytes | SHA-256 | Owner / classification | Consumer(s) | Proposed target | Confidence |
|---|---|---:|---|---|---|---|---|
| Arcane Owl flap | `assets/sfx/pet/arcane-owl-flap.mp3` | 28465 | `7BE8A6F328AD08138180AF3B0BFFF695F0D40E66B165B02B660FE7B5AD845712` | Arcane Owl / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/arcane_owl/sfx/arcane-owl-flap.mp3` | HIGH |
| Arcane Owl hoot | `assets/sfx/pet/arcane-owl-hoot.mp3` | 30555 | `14C8C63971C72D5B4A38B5057047F4A0818BB2685B7722DAF48207A4DDF6D5C6` | Arcane Owl / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/arcane_owl/sfx/arcane-owl-hoot.mp3` | HIGH |
| Arcane Owl sparkle | `assets/sfx/pet/arcane-owl-sparkle.mp3` | 25121 | `F9E824BFF282F523610A713A95881FC385DCD8E8ECFF471E480CCA11FFB16D8C` | Arcane Owl / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/arcane_owl/sfx/arcane-owl-sparkle.mp3` | HIGH |
| Celestial Kitsune bell | `assets/sfx/pet/celestial-kitsune-bell.mp3` | 59394 | `83DA6A864AACCCD35B2874B4BDECF2033F52F507C1A18195E5F6D89DBCC9108B` | Celestial Kitsune / `CONTENT_OWNED` | Pet Viewer; Gameplay Power `nether_star` (`kitsuneBell`) | `data/inventory/pet/celestial_kitsune/sfx/celestial-kitsune-bell.mp3` | HIGH |
| Celestial Kitsune cry | `assets/sfx/pet/celestial-kitsune-cry.mp3` | 33062 | `D1CD1101E7286D41D3BBFBCF0DDC1B70E10709B5D41D0848DADC9EDA645EEB74` | Celestial Kitsune / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/celestial_kitsune/sfx/celestial-kitsune-cry.mp3` | HIGH |
| Celestial Kitsune shine | `assets/sfx/pet/celestial-kitsune-shine.mp3` | 48945 | `CAC718AEB50B9B042DFF4DB010A4D7AF67D33DA64D5C14BF992E60216F1269DC` | Celestial Kitsune / `CONTENT_OWNED` | Pet Viewer; Gameplay Power `totem` (`kitsuneShine`) | `data/inventory/pet/celestial_kitsune/sfx/celestial-kitsune-shine.mp3` | HIGH |
| Copper Golem clang | `assets/sfx/pet/copper-golem-clang.mp3` | 26793 | `496363CEC3BA9C30C6864B00B6D8706E2344B786A5A159F63591A03E5EA25033` | Copper Golem / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/copper_golem/sfx/copper-golem-clang.mp3` | HIGH |
| Copper Golem servo | `assets/sfx/pet/copper-golem-servo.mp3` | 16461 | `4F37336551CCF91256A7A04BE1875C036A006678385A1B91FD9AFD9BEE7AFE9B` | Copper Golem / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/copper_golem/sfx/copper-golem-servo.mp3` | HIGH |
| Copper Golem steam | `assets/sfx/pet/copper-golem-steam.mp3` | 18434 | `979D4F2D27720BCACF117E449B76B71FD08816AB22FACD0374CB9CDBFDA4256D` | Copper Golem / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/copper_golem/sfx/copper-golem-steam.mp3` | HIGH |
| Crystal Axolotl bubble | `assets/sfx/pet/crystal-axolotl-bubble.mp3` | 23449 | `6CF643E8ACDE34EE6EEDE21C645A48627A05873A60E7584170C0566FE45A3734` | Crystal Axolotl / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/crystal_axolotl/sfx/crystal-axolotl-bubble.mp3` | HIGH |
| Crystal Axolotl chime | `assets/sfx/pet/crystal-axolotl-chime.mp3` | 33062 | `197D239AD143C60DC0806F469B8BEFA89C860D5B1354A3F6E111D2ED4C539A46` | Crystal Axolotl / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/crystal_axolotl/sfx/crystal-axolotl-chime.mp3` | HIGH |
| Crystal Axolotl squeak | `assets/sfx/pet/crystal-axolotl-squeak.mp3` | 23449 | `A06BBC37E7A34588FE6778CEBCE021ABA97B7D6BCD913A72AB0578758C271376` | Crystal Axolotl / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/crystal_axolotl/sfx/crystal-axolotl-squeak.mp3` | HIGH |
| Forest Pup bark | `assets/sfx/pet/forest-pup-bark.mp3` | 10075 | `F9D0BECAC5AACEBE3BD31025DD6203D17BCE1E32E848DEFF527D481D7A456995` | Forest Pup / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/forest_pup/sfx/forest-pup-bark.mp3` | HIGH |
| Forest Pup bark burst | `assets/sfx/pet/forest-pup-bark-burst.mp3` | 14253 | `BFA187417FF0D565BF7A957799F816DB7E50081F9E3C0ECFD59867AE79F60ED9` | Forest Pup / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/forest_pup/sfx/forest-pup-bark-burst.mp3` | HIGH |
| Forest Pup whimper | `assets/sfx/pet/forest-pup-whimper.mp3` | 46509 | `19FD44132A51327B4F90BFBDC66042E29849F74178F4115A2F82E6788ED006FC` | Forest Pup / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/forest_pup/sfx/forest-pup-whimper.mp3` | HIGH |
| Inferno Dragon fire | `assets/sfx/pet/inferno-dragon-fire.mp3` | 52288 | `88B9A14304B7176460393CAB3B2716D4C350886FA9CEF242ACDF79C3010D249D` | Inferno Dragon / `CONTENT_OWNED` | Pet Viewer; Gameplay Power `fire_charge` (`infernoFire`) | `data/inventory/pet/inferno_dragon/sfx/inferno-dragon-fire.mp3` | HIGH |
| Inferno Dragon roar | `assets/sfx/pet/inferno-dragon-roar.mp3` | 30555 | `B764D184DE903F608A8610572DED12D2B60719E1FF28509288952F184A50BCAC` | Inferno Dragon / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/inferno_dragon/sfx/inferno-dragon-roar.mp3` | HIGH |
| Inferno Dragon wings | `assets/sfx/pet/inferno-dragon-wings.mp3` | 39332 | `34A7989B829A08D18A7EB98399BD448CDC68762E42CB6ECD4907015AB02EFB39` | Inferno Dragon / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/inferno_dragon/sfx/inferno-dragon-wings.mp3` | HIGH |
| Storm Wolf howl | `assets/sfx/pet/storm-wolf-howl.mp3` | 19688 | `8774B19509F35DD7E59E7ADC1562EB33A32E8F5CBEF2B3E042AA501F7DAD456E` | Storm Wolf / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/storm_wolf/sfx/storm-wolf-howl.mp3` | HIGH |
| Storm Wolf thunder | `assets/sfx/pet/storm-wolf-thunder.mp3` | 52288 | `E797645BE94D07C5E6F5BA45C77B8EC83A8D651DBA87FEF4E8116E17E0B2DCC4` | Storm Wolf / `CONTENT_OWNED` | Pet Viewer via manifest | `data/inventory/pet/storm_wolf/sfx/storm-wolf-thunder.mp3` | HIGH |
| Storm Wolf zap | `assets/sfx/pet/storm-wolf-zap.mp3` | 18434 | `C1EAF8C68C1A48F775276E820FFA5E850F6B5D7F1F60922B84BC4E12CB9B2AE6` | Storm Wolf / `CONTENT_OWNED` | Pet Viewer; Gameplay Power `trident` (`stormZap`) | `data/inventory/pet/storm_wolf/sfx/storm-wolf-zap.mp3` | HIGH |

### Pet SFX dependencies and risks

- There is no Pet-to-Pet audio reuse. The four Power consumers are `storm-wolf-zap` → Trident, `inferno-dragon-fire` → Fire Charge, `celestial-kitsune-bell` → Nether Star, and `celestial-kitsune-shine` → Totem.
- Pet playback fetches root-relative URLs from manifests, caches decoded audio by URL, and uses the existing synthesized fallback if loading fails. A bad moved path could therefore be masked by fallback audio.
- `gameplay/js/audio.js` has `SFX_DIR = 'assets/sfx/'`; it warms its file table at script load and resolves the four reused Pet paths through that prefix. A future sound move must update those entries/resolution without changing the `UT.GameplayAudio` API or playback behavior.
- `tests/pet-registry-parity.test.js` hardcodes the old image and SFX path baselines and checks files in the old SFX directory. `tests/power-registry-parity.test.js` resolves the Gameplay file table under `assets/sfx/`.
- `tools/normalize-sfx.py` currently discovers and writes audio only under `assets/sfx/` and `assets/new sound/`, using originals under `referensi/sfx-asli/`. It will not maintain normalized Pet output at a `data/inventory/pet/` destination without a deliberate source-to-output mapping change.
- The current source archive is not a runtime dependency and is excluded by the preload generator. Preserve its originals and do not treat it as a second runtime source of truth.

## 5. Dragon SFX inventory

Dragon sounds are selected and played by `UT.GameplayAudio` in `gameplay/js/audio.js`; there are no Dragon content manifests under `data/`. The cases below that are shared between boss types, arena events, or Power effects should remain common SFX assets. `dragon-idle` and `tower-rise` are specific to Gameplay sequences and are the only Dragon candidates with a clear possible `gameplay/assets/sfx/` target.

| Asset | Current path | Bytes | SHA-256 | Owner / classification | Active consumer(s) | Proposed target | Confidence |
|---|---|---:|---|---|---|---|---|
| Crystal appear | `assets/sfx/dragon/crystal-appear.mp3` | 49781 | `E05A7EDE4049E5252E386F1B3CF758B181761EA80F343CF03FB8F427B96A5F3B` | Gameplay + Power / `SHARED_ASSET` | Dragon arena crystal events; Power `dragon_crystal` | Keep `assets/sfx/dragon/crystal-appear.mp3` | HIGH |
| Crystal break | `assets/sfx/dragon/crystal-break.mp3` | 34734 | `46509CD71AD23076F0A6B011ABF22A1D9A4D85491C8D68E9775035E1D6E86FB6` | Gameplay + Power / `SHARED_ASSET` | Dragon arena crystal events; Power `ice_crystal` | Keep `assets/sfx/dragon/crystal-break.mp3` | HIGH |
| Dragon death | `assets/sfx/dragon/dragon-death.mp3` | 224906 | `14D9EC3D316E8CE768F8AD9DE8527DB11D10964CBEEC089369CB1C3688C8B724` | Gameplay shared boss cue / `SHARED_ASSET` | Ender Dragon and Wither defeat | Keep `assets/sfx/dragon/dragon-death.mp3` | HIGH |
| Dragon hurt | `assets/sfx/dragon/dragon-hurt.mp3` | 22195 | `F5630F281EBDA9C6355A77371781D9E87326245D084ACF55ADA7088DB03C83EF` | Gameplay shared boss cue / `SHARED_ASSET` | Ender Dragon and Wither hit events | Keep `assets/sfx/dragon/dragon-hurt.mp3` | HIGH |
| Dragon idle | `assets/sfx/dragon/dragon-idle.mp3` | 37034 | `F860D79B381045C47A4A27E16757CD734694E5EB10E93D8B4F4D771D96F9CD8C` | Gameplay Dragon sequence / `GAMEPLAY_OWNED` | Ender Dragon idle; fallback from Dragon spawn | `gameplay/assets/sfx/dragon/dragon-idle.mp3` (future candidate) | HIGH |
| Dragon spawn | `assets/sfx/dragon/dragon-spawn.mp3` | 111639 | `DB29A94A7884772E9C07ACED426C01221438566A62858F0FE5FBF3703AA0D587` | Gameplay shared boss cue / `SHARED_ASSET` | Ender Dragon and Wither spawn | Keep `assets/sfx/dragon/dragon-spawn.mp3` | HIGH |
| Earthquake | `assets/sfx/dragon/earthquake.mp3` | 115400 | `BD109ED8A413F06F4EB84163807F3063E7F35797687E72E59F276F16976C30E5` | Gameplay shared event / `SHARED_ASSET` | Dragon awakening, wall collapse, and Wither sequence | Keep `assets/sfx/dragon/earthquake.mp3` | HIGH |
| Tower rise | `assets/sfx/dragon/tower-rise.mp3` | 195231 | `624C9EB63B53D8106A254C85E59F07E8F6D7D6D39AAD4FC2E8F11AD5135F0D50` | Gameplay Dragon sequence / `GAMEPLAY_OWNED` | Dragon awakening tower sequence | `gameplay/assets/sfx/dragon/tower-rise.mp3` (future candidate) | HIGH |

`gameplay/assets/` currently contains map banner assets but no SFX tree. Creating `gameplay/assets/sfx/dragon/` would therefore be a real domain relocation, not a path already established by convention. No such directory or move is recommended in Phase 39.

## 6. Mob SFX inventory

Mob playback is also routed through `UT.GameplayAudio`. Active cues are Gameplay effects or are deliberately reused by Power effects; none are defined by a dynamic Mob manifest. The README's “unused” label for `creeper-explosion.mp3` is stale: the current Gameplay audio table maps it to TNT and Blaze Core Power triggers.

| Asset | Current path | Bytes | SHA-256 | Owner / classification | Active consumer(s) | Proposed target | Confidence |
|---|---|---:|---|---|---|---|---|
| Creeper explosion | `assets/sfx/mob/creeper-explosion.mp3` | 63573 | `83D169185B91FAF59B6F42DCAA254872CA919D60A32BA9B7CE026C2A9A2B422E` | Gameplay + Power / `SHARED_ASSET` | Power `tnt` and `blaze_core` triggers (`tntExplosion`) | Keep `assets/sfx/mob/creeper-explosion.mp3` | HIGH |
| Creeper fuse | `assets/sfx/mob/creeper-fuse.mp3` | 69008 | `3CCA6163E8E993AA2EA9558C22AADDD19257DE844ABB8E87CD13F72B52976CB5` | Gameplay + Power / `SHARED_ASSET` | Creeper event; Power `tnt` activation | Keep `assets/sfx/mob/creeper-fuse.mp3` | HIGH |
| Creeper hiss | `assets/sfx/mob/creeper-hiss.mp3` | 36094 | `1151A3971BD3598098BC0317A2D54CEA5A22D1FFCE589B623985B60FAF9AC4C3` | Unresolved / `UNRESOLVED` | No current file-table or call-site consumer found | None; do not move or delete | LOW |
| Enderman alt | `assets/sfx/mob/enderman-alt.mp3` | 12897 | `294BAA6B83F8D62C93AA33D1AA6F42587D027A789D6CDE38BDC5E0B3EA7E0431` | Unresolved / `UNRESOLVED` | No current file-table or call-site consumer found | None; do not move or delete | LOW |
| Enderman teleport | `assets/sfx/mob/enderman-teleport.mp3` | 7568 | `BBC05A240EC1CED8C93B459201EBF2A69C1C4F206F064322A9A6FC58302D5B6C` | Gameplay + Power / `SHARED_ASSET` | Enderman event; Power `grass` | Keep `assets/sfx/mob/enderman-teleport.mp3` | HIGH |
| Mob hit alt | `assets/sfx/mob/mob-hit-alt.mp3` | 22613 | `AC4FE7ED76B8C319D007E9532960629209259676381F772251C65167C003F527` | Unresolved / `UNRESOLVED` | No current file-table or call-site consumer found | None; do not move or delete | LOW |
| Mob punch | `assets/sfx/mob/mob-punch.mp3` | 5059 | `373F2FEF6F3AD660372E18A188AD781AE035AB4498529D9797BB95C7E44D27AF` | Generic Gameplay hit cue / `SHARED_ASSET` | Generic Mob hit (`sfx.hit`) | Keep `assets/sfx/mob/mob-punch.mp3` | HIGH |
| Player hurt | `assets/sfx/mob/player-hurt.mp3` | 18434 | `ADD97AB13E869D4FC630A26B6986147BF56771B80DE2A36560B0F0741B769A14` | Generic Gameplay hit cue / `SHARED_ASSET` | Creeper, Skeleton, melee, and Power hit events | Keep `assets/sfx/mob/player-hurt.mp3` | HIGH |
| Skeleton shoot | `assets/sfx/mob/skeleton-shoot.mp3` | 6627 | `42172228ACFB29C1FE4953D7B8B508024DF3FA8C246A3A5702D4FEC949EE5021` | Gameplay Mob event / `GAMEPLAY_OWNED` | Skeleton attack (`sfx.skeltonSh`) | `gameplay/assets/sfx/mob/skeleton-shoot.mp3` (future candidate) | HIGH |

The three unresolved Mob files are nevertheless included in the global preload manifest. Their presence in preload is not evidence that they have a runtime caller or that they should be deleted.

## 7. Dependency and path audit

### Pet page and manifests

- `pet.html` is at the repository root and loads the Item Registry, seven Pet manifests, Pet category index, ItemCatalog, and Pet page/viewer scripts in the existing order.
- `assets/js/pages/pet-page.js` uses `IMAGE_ROOT = 'assets/ng/pet3d/'` and constructs a lazy-loaded card image with `item.gameKey`.
- Each manifest records `assets.image` and three `assets.sfx` paths. The Pet Viewer uses the manifest as its SFX source of truth; `ItemCatalog` does not add an image field or expose an asset API.
- The `ItemRegistry` path validator accepts safe root-relative `data/...` paths; it rejects absolute paths, `..`, backslashes, whitespace, and invalid extensions. Proposed Pet targets fit the permitted format.
- The dynamic import in `pet-page.js` loads the multiplayer client for metadata; it is unrelated to these assets. Asset URLs are not resolved against the script module URL.
- `referensi/newgui/game/js/pet.js` has an old Pet image path, but `referensi/` is an archive excluded by the runtime preload generator, not an active caller.

### Gameplay audio and URL resolution

- Gameplay sound paths are held in `gameplay/js/audio.js` `FILE` and prefixed by `SFX_DIR = 'assets/sfx/'`. `GameplayAudio.preload()` creates warm-up Audio objects; playback methods and `gameplay/js/main.js` call named SFX functions rather than file paths.
- Pet Viewer fetches SFX URLs supplied by manifests. All current URLs are document-root-relative from the root `pet.html`; Gameplay URLs are likewise document-relative from root `gameplay.html`.
- No duplicate copies or compatibility aliases were found. Four Power effects point to the same Pet-authored file paths; they do not contain copied MP3s.
- Keep `UT.GameplayAudio`, `PetViewer`, Pet manifest shape, and all event timing/volume/fallback behavior unchanged in any later path-only migration.

### Preload and service worker

- Static validation found 830 current preload-manifest keys. All 45 audited files are present once at their current paths with byte counts matching their actual file sizes.
- `tools/gen-preload-manifest.py` scans `assets`, `data`, and `gameplay` and skips `referensi`. Moving a file between scanned runtime folders preserves its preload eligibility; the generated path key must still change.
- The loader calls `UT_Preload.runAuto()`, which loads the manifest. Pet candidates are not a separate path list that needs to be duplicated in the splash page.
- `sw.js` is at `ut-pwa-v189`. Its generic `MEDIA` expression covers PNG and MP3, and its media handling is cache-first. The `CORE` list does not contain these candidates.
- A future move requires regenerating the manifest and incrementing the cache version according to repository policy. Preserve the existing `CORE`, media cache strategy, Range handling, and offline behavior.

## 8. Documentation, tests, and tools to coordinate

| Current reference | Finding | Required if relocated |
|---|---|---|
| `data/inventory/pet/*/manifest.js` | Canonical records of image and Pet SFX paths; image comments describe the old `IMAGE_ROOT`. | Update only the moved path fields and directly related comments. |
| `data/inventory/pet/index.js` | Comment explicitly says assets/audio have not moved. | Update that comment when a move is actually made. |
| `assets/js/pages/pet-page.js` | Image path is built from `IMAGE_ROOT + gameKey`. | Update the image path builder for Pet PNG relocation. |
| `assets/js/pet-viewer.js` | SFX path is manifest-driven; comments still describe `assets/sfx/pet/`. | Runtime logic need not change for new manifest paths; update stale path comments. |
| `gameplay/js/audio.js` | Four Power file keys use Pet-authored SFX through `SFX_DIR`; all Gameplay audio file paths share the current prefix. | Update resolution for the four Power consumers if Pet SFX move; preserve the public API and behavior. |
| `tests/pet-registry-parity.test.js` | Hardcodes image path, all Pet SFX paths, old directory checks, preload presence, and manifest-to-viewer parity. | Update path expectations and keep checks for uniqueness, existence, slot order, and preload. |
| `tests/pet-catalog.test.js` | Checks each Pet PNG in `assets/ng/pet3d/`. | Update image location assertion if PNGs move. |
| `tests/power-registry-parity.test.js` | Resolves Gameplay `FILE` entries beneath `assets/sfx/` and checks files used by Power. | Update path resolution if any mapped sound moves to `data/`. |
| `tools/normalize-sfx.py` | Enumerates and writes `assets/sfx/**` and `assets/new sound/**`; source originals are under `referensi/sfx-asli/`. | Add an explicit source-to-output mapping before relocating normalized Pet SFX. Do not change audio processing or bytes as part of a path migration. |
| `assets/sfx/README.md` | Documents old directory layout; says `creeper-explosion.mp3` is unused, though Gameplay maps it to Power triggers; references `gameplay/audio.js` rather than current `gameplay/js/audio.js`. | Correct directly related documentation in the relevant implementation phase; do not mix unrelated cleanup into Phase 39. |
| `assets/preload-manifest.json` | Contains all current candidates and exact byte counts. | Regenerate after moves; compare key changes and preserve all unrelated entries. |
| `sw.js` | Current cache token is `ut-pwa-v189`; generic handling covers these media formats. | Increment version only as required by the approved move; do not alter CORE or strategy. |

Additional out-of-scope documentation discrepancies:

- `assets/sfx/README.md` lists `naga-bumper.mp3` as a file to add, but no such file exists in the audited Dragon folder.
- The README says `creeper-explosion.mp3` is unused; the current `POWER_TRIG` table uses it for TNT and Blaze Core.
- Dragon Awakening comments mention an old sound path; the current Gameplay audio source marks `dragonAwakening()` as unused. This is separate from the eight Dragon-folder files and should not be changed during the Pet relocation.

## 9. Relocation recommendation and sequence

### Phase 39 — Pet PNGs only

Move the seven PNGs from `assets/ng/pet3d/` to `data/inventory/pet/<gameKey>/<gameKey>.png`. Do not move Pet SFX, Dragon SFX, or Mob SFX in this phase.

Expected dependent changes:

1. Move the seven PNG files; do not copy them.
2. Update `assets.image` in the seven Pet manifests.
3. Update the image URL builder in `assets/js/pages/pet-page.js`.
4. Update the direct path assertions in `tests/pet-registry-parity.test.js` and `tests/pet-catalog.test.js`.
5. Update the directly related comments in Pet manifests and `data/inventory/pet/index.js`.
6. Regenerate `assets/preload-manifest.json`; confirm only the seven old image keys are replaced with seven new keys and the total remains 830.
7. Increment the SW cache version if no intervening cache-token change has occurred. From this baseline, the next token would normally be `ut-pwa-v190`; confirm the Phase 39 baseline before applying it.

No change should be needed to `pet.html`, `PetViewer` runtime logic, ItemCatalog's public shape, PlayerData, server APIs, or Gameplay behavior.

### Later Pet SFX phase

Handle all 21 Pet SFX as one cohesive relocation group rather than splitting the three-file Pet sets. Before implementation, preflight the normalizer's explicit source/output mapping and the four Power consumers. If approved, update manifest paths, Gameplay audio path resolution, Pet/Power path assertions, comments/documentation, preload entries, and service-worker version in the same phase. Preserve each MP3 byte-for-byte; normalization is not part of relocation.

### Later Dragon/Mob decision

- Keep all `SHARED_ASSET` files in `assets/sfx/`.
- Consider the two `GAMEPLAY_OWNED` Dragon cues and one `GAMEPLAY_OWNED` Skeleton cue for `gameplay/assets/sfx/` only in a dedicated Gameplay asset phase. The Gameplay SFX normalizer and all file-path checks must be included.
- Leave the three `UNRESOLVED` Mob files untouched until a separate audit establishes whether they have a planned use, are archive candidates, or should be removed. Preload membership alone is not sufficient evidence for deletion.
- Reconcile the stale README facts as part of the relevant SFX phase, not by broad cleanup here.

## 10. Risk and verification criteria for future phases

### Principal risks

- A manifest-only path change can pass registry format validation while still pointing to a missing file; tests and preload checks must validate actual existence.
- Pet Viewer has synthesized fallback audio, so a failed sound URL may not be obvious during casual use.
- Gameplay's audio prefix and Power parity test assume `assets/sfx/` paths.
- The normalizer currently writes to `assets/`; a moved file could later be regenerated to the old location or omitted from normalization unless the tool is deliberately updated.
- Preload keys are URL paths. A move without manifest regeneration/cache-version update can leave stale cache entries and make offline behavior inconsistent.
- Do not alter audio bytes, timing, volume, fallback sounds, warm-up order, gameplay event calls, Pet selection order, or item metadata.

### Required static checks after a future relocation

- Exactly one physical copy of every moved asset; no compatibility copy.
- Every manifest path resolves to an existing file and passes ItemRegistry format validation.
- All callers, tests, docs, and tool source/output mappings use the intended canonical path.
- Preload key set changes only for the moved files; all byte counts match actual files.
- Service worker version follows policy; `CORE`, cache strategies, Range handling, and fallback remain unchanged.
- `git diff --check`; review all path changes and preserve script/load order.
- Run no test suite during this audit. Test execution belongs to the later phase's explicit rules.

## 11. Final status

**READY WITH CONDITIONS** — Phase 39 is ready to implement the seven Pet PNG relocations only. Pet SFX are proven Pet-owned but require a separate, coordinated tool and consumer phase. Shared Gameplay effects and unresolved Mob files are not Phase 39 relocation candidates.

**No runtime files were changed. No test suite, browser test, benchmark, or runtime test was run.**
