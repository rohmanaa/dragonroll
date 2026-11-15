# Global Extraction Phase 32 — Ambience Modules Relocation

Status: **COMPLETE — static checks passed**

## 1. Baseline and scope

| Ref / state | Verified value |
|---|---|
| Branch | `restruktur` |
| Baseline `HEAD` | `15b23fe1994db64b22e8cde7866c54c09f9608dc` |
| Baseline `origin/restruktur` | `15b23fe1994db64b22e8cde7866c54c09f9608dc` |
| Baseline `main` / `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Baseline worktree | Clean |
| Audit used | `audit/5/global-extraction-phase-31-preflight-ambience.md` |

All three modules were moved together in one implementation commit. The CSS files, lifecycle behavior, and runtime logic were not refactored.

## 2. Relocated modules and byte counts

| Previous path | New path | Actual bytes | Manifest bytes |
|---|---|---:|---:|
| `assets/js/ambience.js` | `assets/js/systems/ambience.js` | 3,819 | 3,819 |
| `assets/js/scene-bg.js` | `assets/js/renderers/scene-bg.js` | 11,652 | 11,652 |
| `assets/js/night-fog.js` | `assets/js/renderers/night-fog.js` | 1,951 | 1,951 |

Total: **17,422 bytes**. `scene-bg.js` increased from 11,634 to 11,652 bytes solely because its two active path comments now name the relocated files. Its implementation is otherwise unchanged.

No file remains at the old JavaScript paths and no compatibility copies were created.

## 3. References updated

- **Ambience classic-script callers:** `dadu.html`, `efek.html`, `frame.html`, `karakter.html`, `lobby.html`, `pet.html`, `profile.html`, `settings.html`, `splash.html`, `old/misi.html`, and `old/dailyreward.html` now load `assets/js/systems/ambience.js`.
- **SceneBG auto-mount callers:** `lobby.html`, `old/misi.html`, and `old/dailyreward.html` now load `assets/js/renderers/scene-bg.js`.
- **NightFog caller:** `splash.html` now loads `assets/js/renderers/night-fog.js`; its position before the inline mount remains unchanged.
- **Preload list:** `assets/js/pages/splash.js` uses the three new paths.
- **Preload manifest:** `assets/preload-manifest.json` uses the new keys and the verified byte counts above. No unrelated manifest entry changed.
- **Assertion:** `tests/lobby-background.test.js` now checks the new SceneBG script path and retains its prior expected data attributes.
- **Active comments:** Updated the script path comments in `assets/js/renderers/scene-bg.js` and `assets/css/scene-bg.css`. CSS files remain at their original paths.
- **Service worker:** `sw.js` version changed from `ut-pwa-v187` to `ut-pwa-v188`; cache strategy and CORE entries were not changed.
- No active README or `referensi/` path references required changes. Historical audits retain their original paths.

## 4. Runtime contracts preserved

- All three files remain classic-script IIFEs with no module imports or exports.
- `UT.Ambience`, its public methods, preference synchronization, PlayerData integration, events, and root attributes are unchanged.
- Ambience scripts remain after preference scripts and before page controllers; only their `src` values changed.
- `UT.SceneBG`, `mount()`, `defaults`, `instance`, its synchronous classic-script loading, and each auto-mount `data-*` attribute are unchanged.
- `scene-bg.js` still uses `document.currentScript` for the auto-mount attributes. It does not derive asset URLs from the script's location; document-relative image URLs therefore remain unchanged.
- `UT.NightFog`, `mount()`/`destroy()`, the splash inline mount order, CSS, and fog texture URLs are unchanged.
- The prior lifecycle concerns (SceneBG listener cleanup and mutable `LIGHTSETS` references; Ambience global listeners/subscriptions without a dispose API) were intentionally not modified.

## 5. Static verification

- Confirmed all three files exist only at their target locations.
- Repository search found no active reference to the old `assets/js/{ambience,scene-bg,night-fog}.js` paths. Historical audit references are intentionally retained.
- `node --check` passed for all three relocated scripts, `assets/js/pages/splash.js`, `tests/lobby-background.test.js`, and `sw.js`.
- Verified the manifest parses, all three new entries match actual file sizes, all old keys are absent, and no unrelated entry changed.
- Compared the changed files with the baseline: HTML and preload references changed only as specified; Ambience and NightFog contents are byte-identical; SceneBG differs only in the two path comments; test assertion and SW version are the only changes in their respective files.
- Confirmed SceneBG remains a synchronous classic script with the same attributes and script order; the splash NightFog script remains before its inline mount.
- `git diff --check` passed.
- No test suite, browser test, benchmark, or runtime test was run.
- No PlayerData, ItemCatalog, CSS rules, data, or gameplay behavior was changed.

## 6. Git checkpoints

Implementation commit: `008d8997452c35741ef09fa954732a14e53bc8a3`.

The audit report is committed separately. Its commit hash and final push verification are recorded in the report-only follow-up checkpoint.
