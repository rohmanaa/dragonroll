# Global Extraction Phase 31 — Ambience Modules Relocation Preflight Audit

Status: **READY WITH CONDITIONS**
Scope: read-only audit of `ambience.js`, `scene-bg.js`, and `night-fog.js`. No relocation or runtime edit was performed.

## 1. Baseline Git

| Ref / state | Verified value |
|---|---|
| Branch | `restruktur` |
| `HEAD` | `e434a43bc4ad8ccab0666c8bc4806c4556952d81` |
| `origin/restruktur` | `e434a43bc4ad8ccab0666c8bc4806c4556952d81` |
| `main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| `origin/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Worktree before audit | Clean |

Baseline matched the requested commit. The audit did not switch branches or change any runtime file.

## 2. Inventory

| File | Actual bytes | Responsibility |
|---|---:|---|
| `assets/js/ambience.js` | 3,819 | Page-wide day/night/system mode and graphics-quality state; mirrors preferences, synchronizes with PlayerData, sets root attributes, and emits `ut-ambience`. |
| `assets/js/scene-bg.js` | 11,634 | Reusable DOM/CSS background composition, generated 2D canvas cloud/star assets, optional image and lobby lights, and declarative auto-mount. |
| `assets/js/night-fog.js` | 1,951 | Reusable DOM overlay for CSS fog variants (`bottom` and `player`). |

Total: **17,404 bytes**. All three are classic-script IIFEs; they have no ES-module imports or exports.

## 3. Dependency and contract map

### `ambience.js`

- Creates or reuses `window.UT`; exits early if `UT.Ambience` already exists.
- Reads `UT.Prefs.get('ambience')` at evaluation for the initial setting. On `DOMContentLoaded` (or immediately if already parsed), reads `PlayerData.settings()`, mirrors valid settings back through `UT.Prefs.set()`, subscribes to `PlayerData.subscribe()` and `UT.Events.on('settingsChanged', ...)` when available.
- Reads `window.matchMedia('(prefers-color-scheme: dark)')`; listens for its `change` event when system mode is selected, and listens to `storage` and `pageshow`.
- Sets `data-ambience`, `data-ambience-mode`, and `data-graphics` on `<html>`. Emits `window` event `ut-ambience` with `{mode, resolved, graphics}` when the effective signature changes.
- Global API: `UT.Ambience.mode()`, `resolved()`, `graphics()`, `set(patch)`, and `on(fn)`; `on` returns an unsubscribe function.
- It owns no timer, animation loop, renderer, or DOM overlay. Its listeners/subscriptions have no module-level dispose path; the singleton guard prevents a second initialization in one page.

### `scene-bg.js`

- Creates/reuses `window.UT` and assigns `UT.SceneBG = {mount, defaults}`. Its classic-script evaluation can auto-mount and assign `UT.SceneBG.instance`.
- `mount(container, options)` creates DOM nodes and canvas-generated cloud/star imagery; it does not use Three.js/WebGL. It reads the shared root ambience/graphics attributes and CSS classes.
- A `MutationObserver` waits for `document.body` when the script runs in the head and disconnects after mounting succeeds.
- Public API: `UT.SceneBG.mount(...) -> {el, destroy()}` and `UT.SceneBG.defaults`.
- The current `lobby.html` auto-mount uses `data-preset="soft"`, the document-relative `data-image="assets/Images/background/lobby-kastel.webp"`, and `data-lights="lobby"`. Legacy `old/misi.html` and `old/dailyreward.html` also contain direct auto-mount tags.
- Optional `imageNight` adds a `ut-ambience` listener. Optional lights add a window `resize` listener. The returned `destroy()` removes the element and root class, but does not remove either listener. `LIGHTSETS` is module-scoped and stores mutable element references; multiple concurrent mounts using the same light set can overwrite those references. Current inspected usage is one auto-mount per document, and no caller of the stored `instance.destroy()` was found.
- No timer or JavaScript animation loop is used; cloud, light, and star motion is CSS animation.

### `night-fog.js`

- Creates/reuses `window.UT`; exits early if `UT.NightFog` exists.
- Global API: `UT.NightFog.mount(host, options) -> {el, destroy()}`.
- Creates three DOM fog layers and relies on `assets/css/night-fog.css` plus the root `data-ambience` / `data-graphics` attributes. The only active call found is the `bottom` variant in `splash.html`; the `player` variant is available but has no active caller in the repository search.
- The `player` variant adds a `resize` listener and its `destroy()` removes it. The active `bottom` variant adds no listener. No timer, RAF, observer, or renderer is used.

The three modules have no import or direct initialization dependency on one another. Their cross-module coupling is through global `UT`, root attributes, the `ut-ambience` event, and CSS. `ambience.js` is the state/system owner; `scene-bg.js` and `night-fog.js` are visual DOM/CSS components.

## 4. Callers, load order, and assets

### Direct runtime script callers

- `ambience.js` is included by `frame.html`, `efek.html`, `dadu.html`, `lobby.html`, `karakter.html`, `profile.html`, `pet.html`, `settings.html`, `splash.html`, `old/misi.html`, and `old/dailyreward.html`.
- In the inspected current pages, it follows `prefs.js` / `prefs-sync.js` and loads in the head before page controllers. In `lobby.html`, it precedes the `scene-bg.js` auto-mount tag.
- `scene-bg.js` is loaded by a synchronous classic `<script data-auto ...>` tag in `lobby.html`, `old/misi.html`, and `old/dailyreward.html`. The legacy pages are retained HTML files, so do not assume their references are dead without a separate deployment decision.
- `night-fog.js` is loaded synchronously by `splash.html`; its inline `UT.NightFog.mount(..., {variant:"bottom", ...})` immediately follows the script tag. `assets/css/night-fog.css` is linked before this use.

### Other callers and styling

- `assets/js/pages/lobby.js` reads `UT.Ambience.resolved()`, subscribes with `UT.Ambience.on()`, and listens to `ut-ambience` to update scene lighting.
- `assets/js/pages/settings.js` reads `UT.Ambience`, calls `set()` for ambience/graphics choices, and subscribes to update the page.
- `assets/css/scene-bg.css` consumes `data-ambience` and `data-graphics`; `assets/css/night-fog.css` consumes the same attributes. `assets/css/pages/lobby.css` and `assets/ng/css/lobby.css` also respond to those root attributes.
- `assets/js/pages/splash.js` includes all three JavaScript files, both CSS files, and the fog textures in its `ASSETS` array, then passes that list to `UT_Preload.runAuto()`. This is a preload list, not a second script initialization.
- `tests/lobby-background.test.js` asserts the `scene-bg.css` link, the current `lobby.html` auto-mount tag and its data attributes, and related lobby styling. No dedicated `ambience.js` or `night-fog.js` test reference was found.
- `assets/preload-manifest.json` has entries for all three JavaScript files. Current manifest byte counts match the files: 3,819, 11,634, and 1,951 respectively.
- `sw.js` has no path-specific entry for these files; its current version is `ut-pwa-v187`. Its policy requires a version bump to `ut-pwa-v188` if files are moved or added.

### URL resolution and `document.currentScript`

`scene-bg.js` has exactly one `document.currentScript` use. It reads the active classic script element's `data-auto`, `data-preset`, `data-lights`, `data-clouds-set`, `data-cloud-slow`, `data-image`, `data-image-day`, and `data-image-night` attributes. It does **not** read `currentScript.src` or derive any URL from the script's directory.

Image strings from those attributes are assigned to `img.src`; relative values therefore resolve against the document base URL, not the JavaScript file's location. The current lobby value is `assets/Images/background/lobby-kastel.webp`. Moving the script alone would not change that image resolution if the document-root-relative values are preserved.

Keep the script a synchronous classic script and preserve its attributes and order: `document.currentScript` is meaningful during classic-script evaluation, but would not provide the same contract if changed to a module or moved to an unrelated asynchronous loader. `assets/css/night-fog.css` uses `../Images/fx/fog1.webp` and `fog2.webp` relative to the CSS file; those URLs are unaffected by moving JavaScript while leaving CSS in place.

No `new URL()`, `import.meta.url`, `fetch()`, or module import/export was found in the three modules. `ambience.js` and `night-fog.js` do not derive resource paths.

## 5. Target evaluation and recommendation

Do **not** move these as one three-file group: there are no internal imports or shared renderer/timer state that require co-location. Split by responsibility:

| Module | Recommended target | Reason |
|---|---|---|
| `ambience.js` | `assets/js/systems/ambience.js` | Owns cross-page ambience/graphics settings, global state attributes, subscriptions, and the settings event contract; it is a system, not a renderer. |
| `scene-bg.js` | `assets/js/renderers/scene-bg.js` | Owns the reusable visual background composition and its mount API. Keep `assets/css/scene-bg.css` at its current path. |
| `night-fog.js` | `assets/js/renderers/night-fog.js` | Owns a reusable visual fog overlay. Keep `assets/css/night-fog.css` at its current path. |

`assets/js/renderers/` exists; `assets/js/systems/` does not currently exist. Neither proposed target file nor folder was created during this read-only audit. The recommendation is to move by responsibility, potentially in one atomic implementation checkpoint, not to make all three share one folder.

If later relocated, update every direct script tag, the three relevant `assets/js/pages/splash.js` preload strings, the manifest keys and byte counts, the lobby-background path assertion, active CSS/source comments, and the version to v188. Preserve script type/order, `data-*` attributes, and CSS locations. Do not retain duplicate old/new scripts: `ambience.js` and `night-fog.js` have singleton guards, but `scene-bg.js` does not and can auto-mount twice if both paths are included.

## 6. Risk assessment

**READY WITH CONDITIONS** — dependencies and path behavior are understood; relocation is mechanically feasible if all identified references are updated and existing lifecycle behavior is preserved.

1. **`document.currentScript`:** Not a script-relative URL dependency. It is an execution-mode/order contract; keep `scene-bg.js` a synchronous classic script and preserve the `data-*` attributes.
2. **URL resolution:** The image URLs are document-relative, and fog texture URLs are CSS-relative. Do not rebase them to the new JS directory.
3. **Ordering:** Keep `ambience.js` after preference scripts and before the scene background/page code; keep the splash fog script before its inline mount call.
4. **Duplicate auto-mount:** Do not create a compatibility copy or leave both `scene-bg.js` paths loaded. Unlike the other two modules, SceneBG has no singleton guard.
5. **Existing lifecycle risk:** `SceneBG.destroy()` does not remove the optional resize or ambience listeners; multiple light-set mounts share mutable module-level element references. `Ambience` has page-global listeners/subscriptions without a dispose API. These are pre-existing lifecycle concerns; record for a separate remediation phase and do not change them as part of relocation.
6. **Preload/cache:** Update the splash preload array and manifest. `sw.js` has no explicit asset URL, but the cache-version policy requires v188 for a future move.
7. **Legacy pages:** `old/misi.html` and `old/dailyreward.html` still contain direct references and should be included unless explicitly removed from supported delivery in a separate decision.

No unresolved caller, indirect initialization, worker/WASM dependency, or module import was found.

## 7. Static verification and scope

- Verified the three actual files exist and measure 3,819, 11,634, and 1,951 bytes (17,404 bytes total).
- `node --check` passed for all three modules; no module was executed.
- Searched the repository for direct file paths, global APIs, data attributes, and event names. Classified runtime, legacy page, CSS, preload, test, and historical-audit references above.
- Verified all three preload byte counts against the current files.
- Verified `sw.js` has no direct path entries for these modules and confirmed the current v187 version.
- Inspected script order, inline initialization, CSS dependencies, and asset URL forms. No target folder was created.
- `git diff --check` passed; the worktree remains unchanged by the audit.
- No test suite, browser test, benchmark, or runtime test was run.
- **No runtime, HTML, CSS, preload, service-worker, or test file was modified.**

## 8. Audit checkpoint

The report-only audit commit and final remote/worktree verification are recorded after checkpointing. `main` and `origin/main` must remain at the hashes in Section 1.
