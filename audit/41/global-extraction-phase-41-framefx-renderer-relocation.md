# Global Extraction Phase 41 — FrameFX Renderer Relocation

## 1. Baseline Git

- Branch: `restruktur`.
- Phase 41 baseline: `18f7aca65102bba2bcac1dd94345054021076365`.
- At baseline, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched; the worktree was clean.
- Baseline `main`, `origin/main`, and remote `refs/heads/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- Before establishing this baseline, the existing one-line Phase 40 report edit was preserved in a separate report-only commit, `18f7aca65102bba2bcac1dd94345054021076365`, and pushed to `origin/restruktur`.
- No changes were made to `main`.

## 2. Relocation and implementation files

FrameFX was moved with `git mv`:

| Old path | Canonical path |
|---|---|
| `assets/js/frame-fx.js` | `assets/js/renderers/frame-fx.js` |

Git identified the move as a 100% rename. The moved source matches the baseline after normalizing checkout line endings. Its working-tree SHA-256 is `29467359d4e1ad7bc63c019a3c7d7cb0644107e603151a999a50a059d2f934df`.

Implementation files:

- Runtime relocation: `assets/js/frame-fx.js` → `assets/js/renderers/frame-fx.js`.
- HTML paths: `friendship.html`, `frame.html`, `room.html`, `lobby.html`, `leaderboard.html`, `karakter.html`, `profile.html`, and `shop.html`.
- Path-sensitive test sources: `tests/frame-registry-parity.test.js`, `tests/frame-catalog-integration.test.js`, `tests/leaderboard-ui.test.js`, and `tests/lobby-appearance.test.js`.
- Comment path: `assets/js/item-catalog.js`.
- Generated preload data: `assets/preload-manifest.json`.
- Cache token: `sw.js`.

The actual `item-catalog.js` contained one FrameFX path comment, not two; that existing path was updated, and no additional FrameFX path comment remained.

## 3. Compatibility and script order

- The classic-script global remains `window.FrameFX`.
- The existing idempotency guard and public API (`keyOf`, `upgrade`, `dataURL`, `frames`, `ready`) are unchanged; the moved source matches baseline.
- Each of the eight pages has exactly one canonical FrameFX script tag and no longer uses the old script path.
- All eight pages keep `ItemCatalog` before FrameFX.
- On Friendship, Room, and Leaderboard, FrameFX remains before `FrameAvatar`. The other five pages do not load FrameAvatar.
- Explicit page-controller calls to `FrameFX.upgrade()` remain unchanged.
- Frame image URLs remain document-relative under `data/frame/`; no frame assets, definitions, animation code, canvas behavior, observers, or `FrameAvatar` source were changed.

## 4. Tests and preload manifest

All four named test sources now reference the canonical FrameFX path. Existing validation and assertion strength were preserved.

The official generator, `tools/gen-preload-manifest.py`, was run after relocation. The generated manifest was checked against the baseline:

- Entry count remains **830**.
- The only key removal is `assets/js/frame-fx.js`; the only key addition is `assets/js/renderers/frame-fx.js`.
- The old and new FrameFX byte counts are both **31,305**, matching the canonical file.
- `assets/js/item-catalog.js` changed from **42,707** to **42,717** bytes because its comment path changed; the generated count matches the file.
- No other manifest values changed.
- All 830 referenced files exist and every recorded byte count matches the actual file.

## 5. Service worker

The repository policy comment in `sw.js` requires a version increase when assets change. The cache token was advanced from `ut-pwa-v190` to `ut-pwa-v191`.

This is the only service-worker change. `CORE`, cache strategies, fetch handling, range handling, and offline behavior are unchanged. FrameFX was not added to `CORE`.

## 6. Static verification

- All eight pages were checked for canonical path cardinality and script order.
- Four path-sensitive test sources and the ItemCatalog comment were checked for the canonical path and absence of the old path.
- FrameFX source, idempotency guard, public API shape, and unchanged `data/frame/` URL contract were checked.
- Preload JSON, 830-entry count, key-set delta, file availability, and all byte counts were verified.
- Service-worker diff was verified to contain only the version token change; `CORE` is identical to baseline.
- `node --check` passed for the moved FrameFX file, `assets/js/item-catalog.js`, and all four updated test source files.
- `git diff --check` passed.
- Historical references in prior audit documents were left unchanged; no active source or preload entry uses the old path.
- No test suite, browser test, benchmark, or runtime test was run.

## 7. Checkpoint and final verification

- Implementation commit: `8c0133433c8d51cab5db447653139dd50766c0c5`.
- Audit-report commit: `f259d0994064e68507873afa8587fbf49be72730`.
- At the audit checkpoint, `HEAD`, `origin/restruktur`, and remote `refs/heads/restruktur` matched at `f259d0994064e68507873afa8587fbf49be72730`; the worktree was clean.
- Local `main`, `origin/main`, and remote `refs/heads/main` remained `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- A report-only follow-up records these final results. Its own commit hash is provided in the completion message because a commit cannot contain its own object hash.

**Status: COMPLETED — FRAMEFX RELOCATED, API AND RUNTIME BEHAVIOR PRESERVED.**
