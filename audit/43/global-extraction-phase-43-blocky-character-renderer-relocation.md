# Global Extraction Phase 43 — BlockyCharacter Renderer Relocation

## 1. Baseline Git

- Branch: `restruktur`.
- Phase 43 baseline: `e0ba25980690c08c56a810125a5de066c79d0d5e`.
- At baseline, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched; the worktree was clean.
- Baseline `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- No changes were made to `main`.

## 2. Relocation and changed files

The generated runtime was moved with `git mv`:

| Old path | Canonical path |
|---|---|
| `assets/js/blocky-character.js` | `assets/js/renderers/blocky-character.js` |

Implementation changes cover:

- Generator and generated runtime: `tools/blocky-character/build.js`; `assets/js/blocky-character.js` → `assets/js/renderers/blocky-character.js`.
- Canonical template output-path note: `tools/blocky-character/template.js`.
- HTML consumers: `gameplay.html`, `lobby.html`, `profile.html`, `friendship.html`, `leaderboard.html`, `tambang.html`, and `efek.html`.
- Room lazy loader and CharacterFace prerequisite note: `assets/js/pages/room.js` and `assets/js/renderers/character-face.js`.
- Requested path/order test sources: `tests/blocky-actions.test.js`, `tests/aura-fx.test.js`, `tests/aura-view.test.js`, and `tests/blocky-character-generator.test.js`.
- Service-worker version assertions: `tests/aura-registry-parity.test.js`, `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, and `tests/power-registry-parity.test.js`.
- Preload manifest and service-worker version token: `assets/preload-manifest.json` and `sw.js`.

No character implementation, rig, animation, preset, CharacterFace behavior, editor page, data, or vendor file was changed. `tests/character-rig-adapter.test.js` was left unchanged because it had no reference to the old runtime path.

## 3. Generator and runtime contract

`tools/blocky-character/build.js` now generates and validates `assets/js/renderers/blocky-character.js`; its parity error and output log name the canonical path. The source of truth remains `tools/blocky-character/template.js`, whose output-path note now names the canonical runtime.

The official generator completed successfully and reported **64,442 bytes**. Its `--check` mode passed, confirming the generated runtime matches the template. The runtime matches the baseline runtime after changing only the generated output-path note. Its SHA-256 is `a23331ffda067df9671b3a69367b18ff8f9c05d5894c3077498e38fb843e698d`.

The classic-script contract and runtime implementation are unchanged: `UT.BlockyCharacter`, `UT.BlockyCharacter.create(THREE, opts)`, `createBaseRig(THREE, key, opts)`, the instance API, the global Three.js dependency, and optional `UT.CharacterRigAdapter` integration remain intact. The separate editor global `window.BlockyCharacter` in `assets/js/pages/karakter.js` was not changed and was not aliased to the renderer global.

## 4. Consumers, ordering, and tests

- Each of the seven requested HTML pages has exactly one `assets/js/renderers/blocky-character.js` script and no old runtime path.
- For each page, the complete script list and order match baseline after substituting only the canonical path. Three.js remains before BlockyCharacter, and CharacterFace remains after it on pages loading both.
- Room still lazy-loads in the order Three.js → BlockyCharacter → CharacterFace; only the BlockyCharacter URL changed.
- CharacterFace's prerequisite note now names the canonical runtime; its implementation is unchanged.
- The four requested test sources point to the canonical runtime, including short-name load arrays and script-order assertions. Assertions were retained; only paths were updated.
- The four registry-parity service-worker version assertions now expect `ut-pwa-v193`.
- The old runtime file is absent. Remaining references to its old path are historical audit documentation only; active HTML, runtime, generator, test, and preload references use the canonical path.

## 5. Preload manifest

The official `tools/gen-preload-manifest.py` generator was run after the move.

- Entries: **830 before and after**.
- Removed key: `assets/js/blocky-character.js`.
- Added key: `assets/js/renderers/blocky-character.js`.
- No other key changed.
- All 830 files exist and every recorded byte count matches the current file.
- Old runtime size: **64,432** bytes; generated canonical runtime: **64,442** bytes.
- The only other size changes are the two updated path strings:

| File | Before | After |
|---|---:|---:|
| `assets/js/pages/room.js` | 36,997 | 37,007 |
| `assets/js/renderers/character-face.js` | 4,418 | 4,438 |

No unrelated preload keys or sizes changed.

## 6. Service worker

The service-worker policy comment requires a cache-version increase when assets change. `sw.js` changed from `ut-pwa-v192` to `ut-pwa-v193`; this is its only change. BlockyCharacter was not added to `CORE`, and cache strategy, fetch handling, and offline behavior remain unchanged.

## 7. Static verification

- Generator target, output log, and parity check use the canonical path.
- Runtime/template parity and baseline runtime comparison passed; implementation changes are limited to the generated path note.
- All seven HTML script counts and complete script ordering were verified.
- Room lazy-load order and the CharacterFace prerequisite path were verified.
- API/global separation and absence of the old runtime were verified.
- Requested test sources use the canonical path; cache-version assertions match the new token.
- Preload key delta, 830-entry count, and every byte count were verified.
- `sw.js` diff contains only the version token change.
- `node --check` passed for all 14 relevant JavaScript files.
- `git diff --check` passed.
- No test suite, browser test, benchmark, or runtime test was run.

## 8. Checkpoint and final verification

- Implementation commit: `13a9b88d147aa90b94be04e62cce5233d169565a`.
- The audit-report commit and post-push remote verification will be recorded in a report-only follow-up.
- Baseline `main`, `origin/main`, and remote `refs/heads/main` remained `aeb11acf130df4ade4acc9417f01470e40a33dbb`.

**Status: IMPLEMENTATION COMPLETE — BLOCKYCHARACTER RELOCATED, GENERATOR AND RUNTIME CONTRACT PRESERVED.**
