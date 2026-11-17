# Final RPG FX Regression Audit

Audit date: 2026-11-17  
Repository: `rohmanaa/dragonroll`  
Branch: `restruktur-fx`  
Baseline before Phase 6 changes: `ae1f824c2c817b74040a5d27b00c944c4e05f59c`

## Phase 1-5 coverage audit

Existing reports and commit history were reviewed before changes:

| Phase | Audit/history status |
|---|---|
| Phase 1 | Core, lifecycle, cue identity/seed reports exist; commits include `3ef0d08`, `257685b`, `4e12ece`, and documentation commits through `cef4413`. |
| Phase 2 | Spatial/teleport reports exist; implementation `7883f2d`, audit summary `4858141`. |
| Phase 3 | Sword, projectile/impact, damage, and defense reports exist; commits `5bd686b`, `4f2d606`, `171ab91`, `f0fe71a`, visual follow-up `80b050a`, and summary `e5bb4ed`. |
| Phase 4 | Only 4.1 Aura/Buff is present (`baac617`). The planned 4.2 Elemental and 4.3 Summon/Mob/Boss reports/commits are absent. These categories are incomplete, not regression-certified. |
| Phase 5 | Reward, environment, and UI reports exist; implementation and audit commits through `ae1f824`. |

## Phase 6 changes under test

- Live Reduce Motion propagation for gameplay's legacy boolean consumers, with listener cleanup on ordinary page exit and retention during BFCache. Commit `9887758`.
- Power-3D Ultra profile and Low-to-Ultra device detection using its existing quality configuration. Commit `5cedb95`.
- Bounded multiplayer sender-session epoch cache (256 entries) to prevent unbounded growth. Commit `6d877b4`.
- No rules, statistics, dice outcomes, movement, damage, turn handling, item ownership, or multiplayer gameplay changes.

## Automated results

All 76 standalone `tests/*.test.js` and `tests/*.test.mjs` files were invoked after the code changes, with Git's POSIX shell available on `PATH` for the schema snapshot test:

- **71 passed**
- **5 failed**, matching the unrelated failures already recorded in the Phase 1 baseline audit:
  - `gameplay-dice-throw-race.test.mjs` — test stub lacks `THREE.MeshStandardMaterial`.
  - `lobby-appearance.test.js` — existing stylesheet load-order assertion.
  - `lobby-background.test.js` — existing lobby stylesheet assertion.
  - `pet-registry-parity.test.js` — existing asset-count mismatch (`847` vs expected `842`).
  - `profile-layout-css.test.js` — existing CSS link assertion.
- `schema-snapshot.test.js` passes when Git for Windows' shell directory is added to `PATH`; without it, Node cannot spawn `sh` on this Windows environment.
- No FX-specific test failed.

Focused passes on the final code:

- `gameplay-fx-core.test.js`: 17
- `gameplay-fx-lifecycle.test.js`: 13
- `gameplay-fx-cue.test.js`: 27, including the bounded epoch-cache boundary
- `gameplay-spatial-fx.test.js`: 40
- `power3d.test.js`: 10, including four-level Power-3D profile detection/caps
- Aura: `aura-fx` 8, `aura-view` 6, `aura-catalog` 6, `aura-registry-parity` 7
- Gameplay: `game-core` 16, `power-rules` 17, boss-hit, win-result, mob-hit-panel, mob-landing, and power-landing tests pass
- Audio/assets: `gameplay-assets-external` and `dice-sound-variation` pass
- Syntax checks pass for changed classic scripts/tests and ES modules; `git diff --check` passes.

## Compatibility matrix and unavailable runtime checks

| Scenario | Evidence / status |
|---|---|
| Low/Medium/High/Ultra | Automated device/profile simulation passes for GameplayFX, AuraFX, and Power-3D. No physical device benchmark. |
| Item tier | Core L1-L4 multipliers and spatial tier caps pass. Power-3D retains its existing rarity tier 1-6; Aura retains catalog rarity. |
| Reduce Motion on/off | Core/Aura behavior tests pass; live gameplay media-query update and BFCache listener cleanup are tested. |
| Solo/gameplay rules | Node gameplay-core and Power rules regressions pass; no rules code changed. |
| Multiplayer | Cue format, fid/seed, dedup, stale epochs, and local rendering are exercised by harnesses. No two-client live session. |
| Reset/game over/visibility/scene | Lifecycle/spatial harnesses verify tracked resources and nodes are removed. No live browser teardown test. |
| Desktop/mobile Android | Not run on physical devices. |
| Browser console/WebGL/heap/FPS | Not verified: previous local browser attempt remained at splash loading 0%; no runtime heap/FPS instrumentation was available. |
| Elemental and full summon/mob/boss categories | Not fully implemented/audited at baseline (Phase 4.2/4.3 missing); no test coverage is claimed. |

## Remaining risks

- The five full-suite failures above remain unrelated and pre-existing according to the Phase 1 baseline audit.
- No visual runtime, memory heap, FPS, physical Android/desktop, or live multiplayer claim is made.
- Phase 4.2/4.3 and cross-renderer tier-label normalization remain follow-up work.
- Five optional Power SFX files are absent; existing fallback paths remain in place (see architecture report).
