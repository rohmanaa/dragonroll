# Dragon Roll — Global JavaScript Extraction Phase 2

Status: complete. Mail service and LiveSync were extracted in separate pushed checkpoints. No tests or browser checks have been run, per phase instructions.

## 1. Baseline and audit

- Branch: `restruktur`
- Starting checkpoint: `587987e` (`origin/restruktur`)
- Worktree was clean before this phase.
- Rechecked `global-folder-foundation.md`, Phase 1 report, candidate source files, page script chains, test imports, and dynamic path references.

## 2. Candidate decisions

| Candidate | Decision | Reason |
|---|---|---|
| `mail-service.js` | Extracted to `assets/js/services/` | Isolated UMD service; two runtime page callers and one Node test caller were enumerated. Its one relative dynamic import was adjusted to resolve to the same multiplayer client URL. |
| `live-sync.js` | Extracted to `assets/js/core/` | No relative imports; direct script callers and its source-reading test were updated in place without changing script order. |
| `prefs.js` | Deferred | Owns legacy preference-key migration, localStorage behavior, and the shared `UT.Prefs` API. |
| `prefs-sync.js` | Deferred | Self-starts based on `UT.Prefs` and `UT.Session`, uses sessionStorage and dynamic import, and is loaded across many pages. |
| `session.js` | Deferred | Must load before `boot-guard.js`, `auth.js`, and account-scoped data; also directly read by several tests and services. |
| `app.js` | Deferred | Broad shared public API and page bootstrap; contains a relative dynamic import and is loaded by most pages. |

## 3. Completed extraction — Mail service

| Old path | New path | Consumers updated |
|---|---|---|
| `assets/js/mail-service.js` | `assets/js/services/mail-service.js` | `mail.html`, `lobby.html`, `tests/mail-service.test.js`, and the Mail reference in `README.md` |

Dependency/path updates:

- The dynamic import specifier now resolves from `services/` to `../multiplayer/client.js`, preserving the same effective URL (`assets/js/multiplayer/client.js`).
- Script tag positions and dependency order on both pages are unchanged.
- Updated `assets/preload-manifest.json` to remove the old path and register the new file size.
- Incremented the service-worker cache version from `ut-pwa-v183` to `ut-pwa-v184`.
- No compatibility alias was added because all known active callers were migrated; the classic-script UMD format and `UT.MailService` API remain unchanged.

## 4. Completed extraction — LiveSync core

| Old path | New path | Consumers updated |
|---|---|---|
| `assets/js/live-sync.js` | `assets/js/core/live-sync.js` | `dadu.html`, `efek.html`, `friendship.html`, `frame.html`, `hadiah-misi.html`, `leaderboard.html`, `lobby.html`, `mode.html`, `pet.html`, `room.html`, and `tests/live-sync.test.js` |

Dependency/path updates:

- The script has no relative imports; `UT.LiveSync` and its initialization behavior are unchanged.
- Updated each script URL at its original position, preserving page initialization order.
- Updated the source-path comment and test file read path.
- Updated `assets/preload-manifest.json` for the moved file and incremented the cache version from `ut-pwa-v184` to `ut-pwa-v185`.
- No old-path alias was added because all known callers were updated.

## 5. Deferred scope and risks

- No changes to PlayerData, ItemCatalog, Supabase/RPC behavior, localStorage, Gameplay, root page layout, service-worker location, preload-manifest location, or vendor files.
- `prefs.js`, `prefs-sync.js`, `session.js`, and `app.js` remain at their current paths; moving them requires a separate dependency/order audit and atomic caller update.
- Historical audit reports may still mention original paths as historical evidence; they are not runtime references.

## 6. Validation

- Static checks only: source/path references, dynamic-import resolution, preload paths/sizes, service-worker versions, script-order preservation, and diff integrity.
- Test suites and browser tests were not run.
