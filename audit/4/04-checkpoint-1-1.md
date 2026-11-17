# Checkpoint 1.1 — Dragon Roll FX Core Foundation

## Status

Implemented on branch `restruktur-fx`, based on `origin/main`.

- Baseline commit: `db2de63efa988324b313c4f44b5129a2f5c875d3`
- Baseline tests were run before implementation and passed.

## Files audited

- `gameplay/js/fx.js`
- `gameplay/js/particle-fx.js`
- `gameplay/js/main.js`
- `gameplay/js/dice-throw.js`
- `assets/js/renderers/power-3d/power-config.js`
- `gameplay.html` script order
- `tests/aura-fx.test.js`
- `tests/power3d.test.js`
- `tests/game-core.test.js`

`gameplay.html` loads `fx.js`, then `particle-fx.js`, then the FX callers and finally `main.js`. Thus `FX.init(scene)` can configure the already-loaded `ParticleFX`. The dice renderer and Power-3D configuration were inspected as references and were not modified.

## Files changed

- `gameplay/js/fx.js`
- `gameplay/js/particle-fx.js`
- `gameplay/js/main.js`
- `gameplay/css/gameplay.css`
- `tests/gameplay-fx-core.test.js`

## Implementation

- `UT.GameplayFX.quality()` retains the existing navigator-based device heuristics and reports Low, Medium, High, or Ultra. No additional device sensing system was introduced.
- Device scales and global active 3D particle caps are Low `0.5 / 120`, Medium `1.0 / 220`, High `1.3 / 320`, Ultra `1.6 / 450`.
- `UT.GameplayFX.n(base, tier)` applies `round(base × item multiplier × device multiplier × reduced-motion multiplier)`, defaults missing tier metadata to L2, clamps the result to at least one, and caps it at the device limit. L1-L4 multipliers are `0.4`, `0.8`, `1.3`, and `2.0`.
- Existing FX emitters accept an optional tier. Their base values are adjusted so Medium preserves the existing 110 confetti, 36 fire + 22 smoke explosion, and 14 sparkle counts. Simultaneous 3D emitters share the device's active particle cap.
- `ParticleFX.configure()` is connected to the same quality profile. Medium remains at 60 total / 20 per burst; Low uses 40 / 12, High 100 / 30, and Ultra 150 / 45. The configurator also enforces a global upper ceiling and cannot raise the total above `GameplayFX`'s current device cap. Configuration is applied once per quality during initialization, not per frame.
- `GameplayFX.reduced()` reads the live `matchMedia` value. The relevant hit/boss screen effects use that value; reduced motion avoids shake/flash animation and shows a static `TERKENA` cue for pawn hits. Gameplay state and outcomes are unchanged.
- Existing `GameplayFX` and `ParticleFX` method names and the `window.particleFX` alias remain available.

## Tests and results

All required tests passed after implementation:

| Test | Result |
|---|---|
| `node tests/gameplay-fx-core.test.js` | PASS — 16 tests |
| `node tests/aura-fx.test.js` | PASS — 7 tests |
| `node tests/power3d.test.js` | PASS — 9 tests |
| `node tests/game-core.test.js` | PASS — 16 tests, plus 808 movement-equivalence cases and mob/chest checks |
| `node --check gameplay/js/fx.js` | PASS |
| `node --check gameplay/js/particle-fx.js` | PASS |
| `node --check gameplay/js/main.js` | PASS |

The baseline test suite was also run before changes; all listed baseline tests passed then as well.

## Risks and follow-up

- `main.js` has a legacy reduced-motion snapshot used by other gameplay transitions. This checkpoint intentionally updates only the FX-specific hit and boss screen effects; broader animation behavior is out of scope and should be audited in a later checkpoint.
- `dice-throw.js` retains its existing independent dice-quality heuristic. It was not changed to avoid altering the dice renderer.
- Existing `power-config.js` quality and item-tuning behavior remains unchanged; the FX core reuses the established navigator signals without changing the Power-3D system.

## Gameplay-scope confirmation

No gameplay rules, dice results, pawn movement/tween durations, damage, turn handling, multiplayer cues, or teleport/Ender Swap durations were changed. Changes are limited to visual particle counts/caps and reduced-motion presentation.
