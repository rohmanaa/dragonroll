# Global Extraction Phase 21 — Quest Data

## Scope and baseline

- Scope: relocate only the Quest data classic script and update its active runtime and preload paths.
- Branch: `restruktur`.
- Preflight `HEAD` and `origin/restruktur`: `886bbd1d8390e33d5ff33803489c12fc25275fa5`.
- Preflight worktree: clean.
- Preflight `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
- `main` was not changed.

## Consumer and dependency audit

### Consumers and paths

| Consumer | Finding |
| --- | --- |
| `hadiah-misi.html` | Active root page; loads Quest data exactly once as a classic script. Updated to the new path without moving the script tag. |
| `assets/js/pages/hadiah-misi.js` | Reads the existing `UT.Quest` global (`DEFS` and `BONUS`). Quest state and claims use `UT.WalletService`. |
| `assets/preload-manifest.json` | Contains the module path and byte count; path updated. |
| `tests/` | No test, fixture, or helper refers directly to `quest-data.js`. `tests/legacy-cleanup.test.js` separately checks PlayerData's cleanup of the same legacy key and was not changed. |
| `old/misi.html` | Archived page, as documented in `README.md` and `old/README.md`. Its old `assets/js/quest-data.js` URL resolves from `/old/misi.html` to `/old/assets/js/quest-data.js`; that file does not exist. It is not a consumer of the root module and was left unchanged to avoid making the archived page newly evaluate Quest data. |
| `referensi/newgui/README.md` and prior audits | Historical/reference text mentions the former path; these records were left unchanged. |

Repository search found no static or dynamic import, loader, test configuration, or service-worker reference to the active module path. `sw.js` was not changed.

### API and data relationships

`assets/js/quest-data.js` only creates/extends `window.UT`, defines the eight static quest display definitions and `BONUS`, and assigns `UT.Quest` with the existing `DEFS`, `BONUS`, and `total()` API. It does not read `PlayerData`, ItemCatalog, Item Registry, Inventory, account services, or reward state.

The active Quest page uses `UT.Quest.DEFS` for display metadata and `UT.Quest.BONUS` as a fallback display value. Account state and currency UI are read through `PlayerData`; Quest progress and claims use `UT.WalletService` methods (`questGet`, `questTrack`, `questClaim`, `questClaimAll`, `questClaimBonus`) backed by server RPCs. The page's existing Item Registry, manifests, ItemCatalog, PlayerData, WalletService, AchievementData, and shared-script order remain unchanged. Quest reward authority and persistence were not moved or modified.

## Evaluation-time `localStorage` side effect

The module contains this single cleanup operation, unchanged:

```js
try { win.localStorage.removeItem('ut:quest'); } catch (e) {}
```

- It runs synchronously during evaluation of the classic script, after `DEFS` and `BONUS` are initialized and before `UT.Quest` is assigned.
- It unconditionally attempts to remove exactly `ut:quest`; it does not inspect the stored value or enumerate keys. Storage errors remain swallowed by the original `try/catch`.
- `hadiah-misi.html` has exactly one parser-blocking script tag for the module. Each page load evaluates it once, between `wallet-service.js` and `achievement-data.js`; `UT.App.init` and the page controller follow later in the same order.
- No module import or second active HTML path evaluates this root module. The archived `old/misi.html` path resolves to a missing file under `old/assets/`, so it does not execute this module.
- `PlayerData` independently lists `ut:quest` among its legacy keys for its own cleanup. That separate cleanup path was not changed; Quest data retains its own evaluation-time removal regardless of whether the key has already been removed.
- The preloader fetches URLs listed in the manifest as response bytes; it does not evaluate JavaScript. Updating the manifest does not trigger this side effect.
- Moving the script while retaining the same tag position and classic-script type preserves the cleanup's evaluation point, order, and once-per-page-load frequency.

## Relocation and compatibility

- Moved `assets/js/quest-data.js` to `assets/js/data/quest-data.js`.
- Updated the sole active root HTML script path in `hadiah-misi.html`.
- Updated the preload key to `assets/js/data/quest-data.js`.
- No test path required updating.
- The moved file is unchanged: `1,764` bytes and SHA-256 `88CFEF052F39462F1E73975E89C65C12EA0657FF82AC0F477CEF771612C1C858`.
- The preload JSON remains valid; the new entry is `assets/js/data/quest-data.js: 1764`, and every other key/value is unchanged.
- The module has no imports, `fetch()`, `document.currentScript`, `import.meta.url`, `new URL()`, or relative asset paths.

## Files changed

Implementation checkpoint:

- `assets/js/quest-data.js` → `assets/js/data/quest-data.js` (100% rename; no content change).
- `hadiah-misi.html` (active script path only).
- `assets/preload-manifest.json` (path only; exact byte size retained).

Audit checkpoint:

- `audit/5/global-extraction-phase-21.md`.

Intentionally unchanged: `assets/js/pages/hadiah-misi.js`, `PlayerData`, ItemCatalog, Item Registry, WalletService, AchievementData, inventory manifests/indexes, reward RPCs and server logic, `sw.js`, UI/CSS, tests, archived `old/misi.html`, and historical/reference documentation.

Known out-of-scope finding: `old/misi.html` retains its pre-existing stale relative script URL. The archive is not redirected to the canonical module in this phase because doing so would make it newly evaluate the Quest data module and its storage cleanup.

## Static verification

- Active root page: exactly one new module path; script sequence is identical to baseline except for the path string.
- Full module source comparison and SHA-256: unchanged.
- Cleanup call: unchanged, exactly one `removeItem('ut:quest')` within the original `try/catch`.
- Relative loading and asset resolution: no script-relative path mechanism exists in the module; archived URL resolution was checked and remains out of the active module path.
- Preload JSON parses; only the Quest key changed; `1764` matches the moved file.
- No direct path reference exists in tests.
- `node --check assets/js/data/quest-data.js`: passed.
- `git diff --check` and staged `git diff --cached --check`: passed.
- Test suite and browser tests were not run, as required for the extraction phase.

No unresolved relocation risk was found. The archived page's stale URL is a pre-existing, documented out-of-scope condition. Full behavioral tests remain deferred until all global extraction phases are complete.

## Git checkpoints and verification

- Implementation commit: `6c4f492338084d7ab9c37cca6b546ef7609485b4`; pushed to `origin/restruktur`.
- Audit report creation commit: its full hash and verification snapshot will be recorded by the required report-only follow-up commit.
- Preflight baseline `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`; neither was changed.
- Final `HEAD`, `origin/restruktur`, clean worktree, remote tips, and implementation/audit remote availability will be recorded in the follow-up verification snapshot. The final report-only follow-up's own hash is reported separately because it cannot be embedded in the commit that creates it.
