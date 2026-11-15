# Dragon Roll — Global Extraction Phase 7

## Status

`prefs.js` was relocated to `assets/js/core/prefs.js` without changing its source contents. All in-repository page, test, and preload references were updated. The `UT.Prefs` API, storage migration, and script order remain unchanged. No test suite or browser test was run.

## 1. Git baseline

| Check | Result |
|---|---|
| Branch | `restruktur` |
| Phase 6 migration | `fb5e460d5c8b5558651f8b6060a6f61eeaf362c2` |
| Phase 6 audit | `c86f59f0d8d479073232ca615f11a398417d6e41` |
| Starting `HEAD` | `c86f59f0d8d479073232ca615f11a398417d6e41` |
| Starting `origin/restruktur` after fetch | `c86f59f0d8d479073232ca615f11a398417d6e41` |
| Starting worktree | Clean |
| `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |

Both Phase 6 commits were present. The requested branch and remote matched, and `main` was not checked out or modified.

## 2. Dependency and contract audit

### `prefs.js`

`prefs.js` is a classic self-starting IIFE. On load it creates `UT` if needed, returns early if `UT.Prefs` already exists, assigns the `UT.Prefs` API, and immediately runs the legacy-key migration. It has no import, dynamic import, `document.currentScript`, `import.meta.url`, `fetch`, worker, or directory-relative asset dependency.

The public surface remains:

- `get`, `set`, `all`, `on`, and `setBackend`
- `_migrate`, `KEY`, and `LEGACY_KEYS`

The local-storage primary key is `ut:prefs:v1`. The unchanged migration map imports these legacy keys, only fills names missing from the primary object, then removes each present legacy key (including keys with invalid values):

| Preference | Legacy key | Reader |
|---|---|---|
| `musicVol` | `ut-musicvol` | integer |
| `musicOn` | `ut-musicon` | false only for `"0"` |
| `sfxVol` | `ut-sfxvol` | integer |
| `autoDN` | `ut-auto` | true only for `"1"` |
| `night` | `ut-malam` | true only for `"1"` |
| `autoRoll` | `ut-autoroll` | true only for `"1"` |
| `cam` | `ut-cam` | JSON |
| `roomMap` | `ut-room-map` | non-empty string |
| `roomPowers` | `ut-room-powers:v1` | JSON |
| `ambience` | `ut-ambience` | JSON |

Migration remains idempotent and is skipped when a backend is already installed. No key, format, value rule, storage access, or migration order changed.

### Related modules and page loading

- `prefs.js` does not depend on `UT.Session`. All 23 HTML consumers already load `assets/js/session.js` before the preferences script; `prefs-sync.js`, when present, remains immediately after it.
- `prefs-sync.js` remains at its existing path and position. Its `document.currentScript`-based dynamic import resolution is unaffected. Its session-storage throttle key remains `ut:prefs-pulled`.
- `session.js` and `boot-guard.js` are unchanged. Their keys remain `ut-auth` in localStorage and `ut:fadein` / `ut:booted` in sessionStorage.
- The preferences script is self-starting, so retaining each script tag's location and classic-script type preserves the time at which `UT.Prefs` is created and migration runs.

The 23 HTML files with the preferences script reference are:

`dadu.html`, `efek.html`, `frame.html`, `friendship.html`, `gameplay.html`, `hadiah-misi.html`, `inventory.html`, `karakter.html`, `leaderboard.html`, `lobby.html`, `mail.html`, `mode.html`, `old/dailyreward.html`, `old/misi.html`, `pet.html`, `play.html`, `powerup.html`, `profile.html`, `room.html`, `settings.html`, `shop.html`, `splash.html`, and `tambang.html`.

The legacy `old/` archive pages were included in the reference update. Their script positions and existing relative URL form were retained.

### Other references and cache behavior

- Direct source-path consumers were `tests/prefs.test.js`, `tests/prefs-sync.test.js`, `tests/settings-prefs.test.js`, and `tests/legacy-cleanup.test.js`. Each changed only the path used to load the module.
- `assets/preload-manifest.json` contained `assets/js/prefs.js` at 4,552 bytes. The target key was absent.
- `sw.js` remains `ut-pwa-v185`. `prefs.js` is not in `CORE`; same-origin non-media GET requests use network-first handling and successful responses are cached by request URL. The preloader fetches URLs from the manifest, so the new URL is cached under its own key when fetched online. No service-worker strategy or version change was needed.
- Previous audit documents retain historical references to the original path; they were not rewritten.

## 3. Decision and migration

The path migration was safe. The module has no path-sensitive behavior, and all known HTML, test, and preload consumers were updated. Keeping each script tag in place preserves the classic-script global and load-time migration behavior. No compatibility wrapper was added: there are no unmodified in-repository consumers, and a wrapper would add another runtime path without preserving the synchronous load semantics more reliably.

| Old path | New path | Size | Result |
|---|---|---:|---|
| `assets/js/prefs.js` | `assets/js/core/prefs.js` | 4,552 bytes | 100% rename; source contents unchanged |

Changed files:

- `assets/js/prefs.js` → `assets/js/core/prefs.js`
- 23 HTML files listed above: changed only the preferences script `src`.
- Four test files listed above: changed only the module source path.
- `assets/preload-manifest.json`: replaced the old path with the new path at the same 4,552-byte size.
- `audit/5/global-extraction-phase-7.md`: this report.

`prefs-sync.js`, `session.js`, `boot-guard.js`, `sw.js`, and all preference consumers were not modified.

## 4. Static verification

- Confirmed the source at the new location is byte-for-byte equivalent to the original 4,552-byte source; Git reports a 100% rename.
- Confirmed the old source file is absent and the new source exists.
- Compared all 23 HTML files with their baseline versions: the only difference is the preferences script path. Script type, relative order, and all other markup are unchanged.
- Compared all four affected test files with their baselines: only the module path changed; test logic is unchanged.
- Compared parsed preload manifests: only the old key removal and new key addition differ. The new entry is 4,552 bytes, and all preload paths exist.
- Confirmed current HTML, JavaScript, and manifest references use the new path. Historical audit text was intentionally retained.
- Confirmed `prefs.js` source, storage keys, migration code, and public API were not edited.
- Confirmed `prefs-sync.js`, `session.js`, `boot-guard.js`, and `sw.js` are unchanged.
- `git diff --check` passed.

## 5. Tests not run

No test suite, test-file execution, or browser test was performed, as required. Static checks do not constitute a test pass.

## 6. Checkpoint

| Checkpoint | Commit | Push |
|---|---|---|
| Module relocation and direct references | `7f70c1e8344ed21dee945bd33fa97fc0c4c11950` (`refactor(js): relocate preferences module`) | Pushed to `origin/restruktur` |

At the migration checkpoint push, `HEAD` and `origin/restruktur` both resolved to `7f70c1e8344ed21dee945bd33fa97fc0c4c11950`. Final post-push verification also confirms the `restruktur` branch has `HEAD == origin/restruktur` and a clean worktree. `main` and `origin/main` remain unchanged at `aeb11acf130df4ade4acc9417f01470e40a33dbb`.

## 7. Remaining risk and follow-up

- All known in-repository consumers were updated. An external or stale page that still hard-codes the old URL may fail if the old URL is not already cached; no compatibility alias was added.
- No preference behavior or synchronization behavior changed.
- `prefs-sync.js` and `session.js` remain at their existing paths and require separate dependency audits before any future relocation.
