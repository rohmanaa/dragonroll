# Global Extraction Phase 39 — Pet PNG Ownership Relocation

## 1. Baseline Git

- Branch: `restruktur`
- Baseline `HEAD` and `origin/restruktur`: `62153c462d4c1bc45104bc84d1f1dd83ac8c8559`
- Remote `refs/heads/restruktur`: `62153c462d4c1bc45104bc84d1f1dd83ac8c8559`
- Local `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before implementation.
- Phase 38 ownership decision: `READY WITH CONDITIONS`; Phase 39 scope limited to the seven Pet PNGs.

## 2. Relocations and file integrity

The seven PNGs were moved with `git mv` (no compatibility copies). Every destination hash and size matches the Phase 38 baseline.

| Old path | Canonical path | Bytes | SHA-256 before | SHA-256 after |
|---|---|---:|---|---|
| `assets/ng/pet3d/arcane_owl.png` | `data/inventory/pet/arcane_owl/arcane_owl.png` | 70048 | `4C4E4ABFAF4648E4072D9C27609C7F2DB641D2047FD9EDFB3A6034CF3A8419AE` | `4C4E4ABFAF4648E4072D9C27609C7F2DB641D2047FD9EDFB3A6034CF3A8419AE` |
| `assets/ng/pet3d/celestial_kitsune.png` | `data/inventory/pet/celestial_kitsune/celestial_kitsune.png` | 67714 | `C97E04947C159A667EC5D14D56E3863E325E7810B6FB521979CE543DAFCA2F5F` | `C97E04947C159A667EC5D14D56E3863E325E7810B6FB521979CE543DAFCA2F5F` |
| `assets/ng/pet3d/copper_golem.png` | `data/inventory/pet/copper_golem/copper_golem.png` | 65279 | `85E154A322AA9039EB7D89726517A6282F222D4E15E03AEFA9380BA3381C3DBF` | `85E154A322AA9039EB7D89726517A6282F222D4E15E03AEFA9380BA3381C3DBF` |
| `assets/ng/pet3d/crystal_axolotl.png` | `data/inventory/pet/crystal_axolotl/crystal_axolotl.png` | 64581 | `A26D0676582456F3FB5DE1DAD21A3A1621EDD6BBAA2DA87CCD297EA8A7AAF0AE` | `A26D0676582456F3FB5DE1DAD21A3A1621EDD6BBAA2DA87CCD297EA8A7AAF0AE` |
| `assets/ng/pet3d/forest_pup.png` | `data/inventory/pet/forest_pup/forest_pup.png` | 63044 | `41348916C09DB07A77F3B7AD268BDD830DC552F6C4DBD4BD56A7458F597370C8` | `41348916C09DB07A77F3B7AD268BDD830DC552F6C4DBD4BD56A7458F597370C8` |
| `assets/ng/pet3d/inferno_dragon.png` | `data/inventory/pet/inferno_dragon/inferno_dragon.png` | 66689 | `EBD74541FCF9F0C818BB6E93DFD584EE1DD1AD8298A66E4C05E6F09B3D749008` | `EBD74541FCF9F0C818BB6E93DFD584EE1DD1AD8298A66E4C05E6F09B3D749008` |
| `assets/ng/pet3d/storm_wolf.png` | `data/inventory/pet/storm_wolf/storm_wolf.png` | 64556 | `47F5F0622F360809A79F93BC6FB70C350BB8C7C98D4E58DD033B86B24569A385` | `47F5F0622F360809A79F93BC6FB70C350BB8C7C98D4E58DD033B86B24569A385` |

All seven old source paths are absent; all seven canonical targets exist. The old `assets/ng/pet3d/` directory is no longer present. No duplicate PNGs were found.

## 3. Consumer and manifest changes

- Updated `assets.image` and the directly related path comment in all seven Pet manifests.
- Updated the category comment in `data/inventory/pet/index.js`; it now distinguishes moved Pet images from SFX that remain in `assets/sfx/pet/`.
- Updated `assets/js/pages/pet-page.js` to build the canonical root-relative URL as `data/inventory/pet/<gameKey>/<gameKey>.png`.
- Lazy loading, card rendering, image attributes, script order, Pet metadata, ItemCatalog shape, and Pet Viewer API are unchanged.
- The seven manifests were compared to baseline: only the image path and related image comment changed. All SFX paths/order and all other manifest metadata remain unchanged.

## 4. Test-source updates

Updated only:

- `tests/pet-registry-parity.test.js`: checks the canonical URL builder, each manifest's `gameKey`-derived path, unique image paths, valid paths, file presence, and exact image preload byte counts. Existing SFX path, uniqueness, file, preload, order, and fallback assertions remain.
- `tests/pet-catalog.test.js`: checks each Pet image in its canonical item folder.

No old image path remains in active source or test files. No changes were made to `tests/power-registry-parity.test.js`.

## 5. Preload manifest

Ran the official `tools/gen-preload-manifest.py` generator. The environment had no Python executable, so the generator was run with a temporary Python 3.10.11 embeddable runtime downloaded from python.org and checked against the publisher's listed MD5; the runtime was not added to the repository.

Static comparison against the baseline manifest confirms:

- 830 entries before and after.
- Exactly seven old Pet image keys removed and exactly seven corresponding canonical keys added.
- No other manifest paths added or removed.
- Nine existing byte-count values refreshed for included source files changed by this implementation: `assets/js/pages/pet-page.js`, `data/inventory/pet/index.js`, and the seven Pet manifests.
- Every one of the 830 current manifest paths exists and its recorded byte count matches the actual file size.
- JSON parsing succeeded. The seven new image entries use the actual image byte counts listed above.

The generator and its directory scope were not changed.

## 6. Service worker

- Version: `ut-pwa-v189` → `ut-pwa-v190`.
- Static comparison confirms this is the only service-worker change.
- `CORE`, media cache policy, Range handling, offline fallback, and fetch handler are unchanged.

## 7. Static verification

- Seven before/after SHA-256 values match Phase 38 exactly.
- Seven old source paths are absent; seven unique canonical targets exist.
- All seven manifest image paths match the `gameKey` folder and filename pattern.
- Pet manifest SFX paths, item metadata, and registration contract are unchanged.
- Preload manifest key changes and all 830 byte counts verified against actual files.
- Service worker differs only by its version token.
- Repository search found no old image path in `assets/`, `data/`, `tests/`, or `tools/`.
- `node --check` passed for all 11 changed JavaScript files.
- `git diff --check` passed.
- The complete diff was reviewed; implementation commit contains only the seven file moves and the approved manifest, page, test, preload, service-worker, and directly related comment changes.
- **No test suite, browser test, benchmark, or runtime test was run.**

## 8. Files intentionally unchanged

- `pet.html` and script load order.
- `assets/js/pet-viewer.js` and all renderer logic.
- Pet SFX, Dragon SFX, and Mob SFX.
- `gameplay/js/audio.js` and `tools/normalize-sfx.py`.
- `tests/power-registry-parity.test.js`.
- ItemCatalog, PlayerData, Item Registry APIs, Supabase, RPC, and localStorage.
- CSS, layout, animation, and all other runtime behavior.

## 9. Git checkpoints

### Commit 1 — Implementation

- Commit: `c9bad8d48e4e2e905d64f3582b0d53b934d3c756`
- 20 paths: seven 100%-similarity renames and 13 approved file updates.

### Commit 2 — Audit report

- Audit report commit: `dac0398e83ce9aac065aeada9e844e7ce1826693`
- A report-only follow-up commit records this hash and the final post-push verification.

### Final repository verification

Verified after the report-only follow-up was pushed:

- Branch remains `restruktur`.
- `HEAD` equals `origin/restruktur` and remote `refs/heads/restruktur`.
- Worktree is clean.
- Local `main`, `origin/main`, and remote `refs/heads/main` remain `aeb11acf130df4ade4acc9417f01470e40a33dbb`.

## 10. Final status

**COMPLETED** — The seven Pet PNGs are canonical under their Pet data folders with unchanged bytes and hashes. No SFX or unrelated assets were moved.
