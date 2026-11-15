# Dragon Roll — Global JavaScript Extraction Phase 2

Status: checkpoint 1 complete; Mail service extracted. Core `live-sync.js` remains queued for its own checkpoint. No tests or browser checks have been run, per phase instructions.

## 1. Baseline and audit

- Branch: `restruktur`
- Starting checkpoint: `587987e` (`origin/restruktur`)
- Worktree was clean before this phase.
- Rechecked `global-folder-foundation.md`, Phase 1 report, candidate source files, page script chains, test imports, and dynamic path references.

## 2. Candidate decisions

| Candidate | Decision | Reason |
|---|---|---|
| `mail-service.js` | Extracted to `assets/js/services/` | Isolated UMD service; two runtime page callers and one Node test caller were enumerated. Its one relative dynamic import was adjusted to resolve to the same multiplayer client URL. |
| `live-sync.js` | Queued for a separate core checkpoint | No relative imports; global initializer with direct script callers that can be updated in place without changing order. |
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

## 4. Deferred scope and risks

- No changes to PlayerData, ItemCatalog, Supabase/RPC behavior, localStorage, Gameplay, root page layout, service-worker location, preload-manifest location, or vendor files.
- The candidate core bootstrap files remain at their current paths; moving them requires a separate dependency/order audit and atomic caller update.
- Historical audit reports may still mention original paths as historical evidence; they are not runtime references.

## 5. Validation

- Static checks only: source/path references, dynamic-import resolution, preload path/size, service-worker version, and diff integrity.
- Test suites and browser tests were not run.
