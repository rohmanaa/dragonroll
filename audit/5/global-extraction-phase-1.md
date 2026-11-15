# Dragon Roll — Global JavaScript Extraction Phase 1

Status: one isolated service extracted; no gameplay, data model, UI, or HTML changes. Work was performed on `restruktur`, based on `origin/restruktur` at `2c5d98a`.

## 1. Audit implementation

Rechecked the folder-foundation mapping against tracked callers and the current source:

- The ad service is a standalone classic-script UMD module with no relative imports.
- No active HTML page or other runtime module references its former path.
- `tests/player-data-server.test.js` was its only direct code consumer.
- The service continues to expose `UT.Ads`, `UT.AdsFactory`, and CommonJS `module.exports`.
- The preload manifest included JavaScript paths and therefore needed the moved path and current byte size.
- `sw.js` uses network-first behavior for JavaScript; its cache version was incremented for the updated deployment.

## 2. Completed extraction

| Old path | New path | Domain | Reason |
|---|---|---|---|
| `assets/js/ads-service.js` | `assets/js/services/ads-service.js` | Service | Isolated rewarded-ad provider service; no page lifecycle or relative-path dependencies |

The service implementation was moved without intentional logic or API changes. Its test consumer now requires the new location.

## 3. Compatibility and dependency changes

- Updated `tests/player-data-server.test.js` to require `assets/js/services/ads-service.js`.
- No legacy-path alias was added: repository search found no runtime callers of the old path, and an alias would create an unnecessary compatibility surface.
- The classic-script IIFE/UMD format and public globals remain unchanged.
- Updated `assets/preload-manifest.json`: removed the old path and registered the new path at 4060 bytes.
- Incremented the service-worker cache version from `ut-pwa-v182` to `ut-pwa-v183`.
- No module initialization or dependency order changed.

## 4. Deferred modules

No other modules were moved in this phase. These remain deferred because their broader consumer and initialization contracts need a dedicated migration:

- `player-data.js` and `item-catalog.js`: sensitive state/catalog sources of truth.
- `wallet-service.js`, `appearance-service.js`, `mail-service.js`, and `mine-service.js`: shared APIs with multiple page/server dependencies.
- `session.js`, `app.js`, `prefs.js`, `prefs-sync.js`, and `live-sync.js`: global bootstrap and initialization order.
- Character, dice, aura, frame, and power renderers: multiple page/gameplay consumers and asset path contracts.
- `gameplay/`, `sw.js`, `preload-manifest.json`, vendor Three.js, and all root HTML: no relocation in this phase.

## 5. Risk and follow-up

- The moved service is not currently loaded by a runtime HTML page, but its test import and preload registration are updated for consistency.
- Future runtime use must load the new service path. If an external consumer of the former path is discovered, add a deliberately designed compatibility adapter rather than duplicating the implementation.
- Continue with another small, audited group only after enumerating its HTML, dynamic-import, service-worker, preload, and test references.
- Do not begin CSS or HTML extraction until the overall JavaScript extraction phase is complete.

## 6. Validation scope

Per phase instructions, no test suite or browser tests were run. Static path/reference, cache-version, preload-entry, and diff-integrity checks are required before checkpointing.
