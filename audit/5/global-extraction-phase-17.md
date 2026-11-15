# Global Restructure — Phase 17: Item Registry Extraction

## Baseline and decision

- Branch: `restruktur`
- Baseline `HEAD` and `origin/restruktur`: `6a421e62c5c085beac05dfa2b01242b127dbc6f9`
- Baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before implementation.
- Phase 16 checkpoint was present: Mine Service implementation `d6e8818aa9a0eebf167871ce97b45997635f16bd`; its audit commit is the Phase 17 baseline.
- Final Phase 17 decision: preserve the repository's existing load order exactly: Item Registry → category/item manifests → category index → ItemCatalog.
- The source was moved from `assets/js/item-registry.js` to `assets/js/core/item-registry.js`. No alternative Registry or compatibility copy was added.

## Dependency and API audit

The Registry is a path-independent classic script. It does not use `document.currentScript`, `import.meta.url`, `new URL`, dynamic import, or `fetch`. Its UMD-style wrapper continues to expose the same `window.UT.ItemRegistry` global and `module.exports` API.

The public factory API remains `create`, `shared`, `validateManifest`, `validateAssetPaths`, and `RARITIES`. Instance methods remain `registerCategory`, `registerItem`, `getItem`, `getItemOrFallback`, `getCategory`, `getAll`, `has`, `categories`, `rejected`, and `checkCompleteness`. The moved file's contents are text-identical to the baseline.

## HTML consumers and load order

All 15 HTML consumers were checked. Each loads the Registry exactly once, before its manifests, category indexes, and ItemCatalog:

- `dadu.html`
- `efek.html`
- `frame.html`
- `gameplay.html`
- `hadiah-misi.html`
- `inventory.html`
- `karakter.html`
- `leaderboard.html`
- `lobby.html`
- `mode.html`
- `pet.html`
- `powerup.html`
- `profile.html`
- `room.html`
- `shop.html`

For each page, the ordered `script src` sequence was compared with the baseline after normalizing only the Registry path. No script was reordered, added, or removed.

The six category indexes and all 82 item manifests remain unchanged. Registration order and their comments were not modified.

## References updated

- Moved the sole Registry implementation to `assets/js/core/item-registry.js`.
- Updated the Registry `src` in all 15 HTML consumers listed above.
- Updated path references only in these eight tests; test logic and load-order expectations were preserved:
  - `tests/aura-registry-parity.test.js`
  - `tests/character-registry-parity.test.js`
  - `tests/dice-registry-parity.test.js`
  - `tests/frame-catalog-integration.test.js`
  - `tests/frame-registry-parity.test.js`
  - `tests/item-registry.test.js`
  - `tests/pet-registry-parity.test.js`
  - `tests/power-registry-parity.test.js`
- Historical audit documents were left unchanged. No current HTML, test, or other non-audit runtime reference remains at the old path.

## Preload and cache review

`assets/preload-manifest.json` now maps `assets/js/core/item-registry.js` to its exact size, 12,309 bytes. The old key is absent; the manifest remains valid JSON with 844 entries, and all other entries are unchanged.

`sw.js` was not changed. The Registry is not in the service worker's `CORE` list; non-media code uses the existing network-first strategy. The preload manifest is fetched by the existing preloader, so updating its path and size is sufficient. No cache-version change is needed.

## Static verification

- Confirmed all 15 HTML pages have exactly one Registry script and preserve their complete script order.
- Confirmed the relocated file is text-identical and still assigns `root.UT.ItemRegistry`.
- Confirmed all eight affected test files differ only by the path replacement.
- Confirmed the six category indexes and 82 manifests are unchanged.
- Parsed the preload JSON and verified its entry count, new path, exact size, and unchanged other entries.
- `node --check` passed for the moved Registry and all eight affected test files.
- `git diff --check` passed.
- No test suite or browser test was run.

## Files changed and intentionally untouched

The implementation checkpoint changes 25 files: one 100%-similar file rename, 15 HTML path references, eight test path references, and the preload manifest. No Registry logic, API, ItemCatalog, PlayerData, transaction, ownership, persistence, category index, manifest, or service-worker behavior was changed.

## Remaining risks

No in-repository runtime caller uses the old path. An out-of-repository integration with a hard-coded old URL is not discoverable from this audit; no old-path compatibility alias was added because all known callers are updated and a duplicate script source would risk a second Registry instance.

## Git checkpoints

- Implementation commit: `2144783` (`refactor(core): extract item registry`), pushed to `origin/restruktur` before the audit commit.
- The audit is committed separately. Final commit hashes and synchronization checks are reported with the Phase 17 completion result.
