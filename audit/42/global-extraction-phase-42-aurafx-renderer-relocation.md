# Global Extraction Phase 42 — AuraFX Renderer Relocation

## 1. Baseline Git

- Branch: `restruktur`.
- Phase 42 baseline: `6ffeae16271193319c21d97397b022ff52861a8a`.
- At baseline, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched; the worktree was clean.
- Baseline `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- No changes were made to `main`.

## 2. Relocation and changed files

The generated runtime was moved with `git mv`:

| Old path | Canonical path |
|---|---|
| `assets/js/aura-fx.js` | `assets/js/renderers/aura-fx.js` |

Implementation changes cover:

- Generator and runtime: `tools/aura-fx/build.js`; `assets/js/aura-fx.js` → `assets/js/renderers/aura-fx.js`.
- HTML: `gameplay.html`, `lobby.html`, `karakter.html`, `profile.html`, and `efek.html`.
- Aura data: all 15 `data/inventory/aura/<key>/manifest.js` files and `data/inventory/aura/index.js`.
- ItemCatalog comments: `assets/js/item-catalog.js`.
- Requested path/order tests: `tests/aura-catalog.test.js`, `tests/aura-fx.test.js`, `tests/aura-registry-parity.test.js`, and `tests/aura-view.test.js`.
- Cache-version assertions: `tests/character-registry-parity.test.js`, `tests/dice-registry-parity.test.js`, and `tests/power-registry-parity.test.js`.
- Preload and cache token: `assets/preload-manifest.json` and `sw.js`.

No AuraView implementation, Aura source ESM, Three.js vendor, aura configuration, or item metadata was changed.

## 3. Generator and runtime contract

`tools/aura-fx/build.js` now names `assets/js/renderers/aura-fx.js` in its output documentation, generated-file header, write target, and log. The five source modules remain in their original dependency/bundling order.

The first build attempt exposed a Windows CRLF issue: the existing import-rewrite expressions expected LF input and left an import in `AuraParticles`. The generator now normalizes CRLF in its in-memory source text before applying the existing transformations. No source ESM files were changed. This preserves generated logic and allows the official generator to run from this Windows checkout.

The official generator ran successfully twice and produced deterministic output. The generated runtime matches the baseline bundle after substituting only the canonical path in its header. The generated output remains a classic script with no `import`/`export`, and preserves global `UT.AuraFX` and its API:

- `AuraSystem`
- `AURAS`
- `getAura`
- `RARITY`
- `TIER`
- `QUALITY`
- `detectQuality`

Three.js r128 remains a page-provided global dependency. The runtime SHA-256 is `a9db53d19a75195c1aba593ef60bace97fdc6bb25bbe15453d2825d36b08034f`.

## 4. Consumers, manifests, and tests

- All five pages contain exactly one canonical AuraFX script.
- Three.js precedes AuraFX on all five pages.
- AuraFX remains before `assets/js/renderers/aura-view.js` on Gameplay, Lobby, Character, and Profile.
- All 15 Aura manifests and the category index point to the canonical renderer. Their content is otherwise unchanged.
- Both ItemCatalog comments that named the old renderer path now name the canonical path.
- The four requested test sources use the canonical path, including the short-name runtime load arrays and the page order assertions.
- The four registry-parity tests that assert the service-worker version now expect `ut-pwa-v192`; no other assertions were weakened.
- The old path has no active runtime, test, build, manifest, or preload reference. Remaining literal references occur only in historical audit documents, which were left unchanged.

## 5. Preload manifest

The official `tools/gen-preload-manifest.py` generator was run after the move.

- Entries: **830 before and after**.
- Removed key: `assets/js/aura-fx.js`.
- Added key: `assets/js/renderers/aura-fx.js`.
- No other key changed.
- Every one of the 830 paths exists and every recorded byte count matches the current file.
- The old preload value was **59,215** bytes; the new canonical output is **58,352** bytes. The generated source is normalized to LF and matches the baseline Git content apart from the output-path header; the size difference is line-ending normalization, not a logic change.
- All other byte-count changes are limited to the JavaScript files whose path comments/manifest locator strings changed:

| File | Before | After |
|---|---:|---:|
| `assets/js/item-catalog.js` | 42,717 | 42,737 |
| `data/inventory/aura/index.js` | 2,164 | 2,174 |
| `data/inventory/aura/amethyst/manifest.js` | 637 | 647 |
| `data/inventory/aura/celestial/manifest.js` | 644 | 654 |
| `data/inventory/aura/dragon/manifest.js` | 626 | 636 |
| `data/inventory/aura/electric/manifest.js` | 626 | 636 |
| `data/inventory/aura/emerald/manifest.js` | 618 | 628 |
| `data/inventory/aura/ender/manifest.js` | 645 | 655 |
| `data/inventory/aura/flame/manifest.js` | 608 | 618 |
| `data/inventory/aura/frost/manifest.js` | 606 | 616 |
| `data/inventory/aura/nature/manifest.js` | 631 | 641 |
| `data/inventory/aura/nether/manifest.js` | 613 | 623 |
| `data/inventory/aura/ocean/manifest.js` | 633 | 643 |
| `data/inventory/aura/sculk/manifest.js` | 634 | 644 |
| `data/inventory/aura/shadow/manifest.js` | 632 | 642 |
| `data/inventory/aura/solar/manifest.js` | 636 | 646 |
| `data/inventory/aura/stone/manifest.js` | 629 | 639 |

No unrelated preload keys or sizes changed.

## 6. Service worker

The repository policy comment requires a cache-version increase when assets change. `sw.js` changed from `ut-pwa-v191` to `ut-pwa-v192`; this is its only change. `CORE`, cache strategies, fetch handling, and offline/media behavior remain unchanged. AuraFX was not added to `CORE`.

## 7. Static verification

- Generator target/log path and deterministic output verified.
- Generated runtime parity, classic-script shape, global/API, and Three.js dependency verified.
- All 15 manifests, category index, five HTML script counts, and required script ordering verified.
- The four requested test sources were checked for canonical paths, including short-name load arrays and order checks.
- Preload JSON, 830-entry count, exact key delta, all files, and all byte counts verified.
- Service-worker diff was verified to contain only the version token change; `CORE` is identical to baseline.
- `node --check` passed for 27 relevant JavaScript files.
- `git diff --check` passed.
- No test suite, browser test, benchmark, or runtime test was run.

## 8. Checkpoint and final verification

- Implementation commit: `3bbea8016e86e7771aac85da9e121339b536fd1a`.
- Audit-report commit and final remote/worktree/main verification are recorded in a separate report-only follow-up after the report is committed.
- Final status is set after the implementation and audit commits are pushed and verified.
