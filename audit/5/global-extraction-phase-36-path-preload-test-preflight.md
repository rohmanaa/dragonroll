# Global Extraction Phase 36 — Path, Preload & Test Preflight Audit

Status: **READ-ONLY PREFLIGHT COMPLETE**

## 1. Baseline Git

| Ref / state | Verified value |
|---|---|
| Branch | `restruktur` |
| `HEAD` | `9559ef446f42757621bec39e0e208ea72534171f` |
| `origin/restruktur` | `9559ef446f42757621bec39e0e208ea72534171f` |
| Remote `refs/heads/restruktur` | `9559ef446f42757621bec39e0e208ea72534171f` |
| Local `main`, `origin/main`, remote `refs/heads/main` | `aeb11acf130df4ade4acc9417f01470e40a33dbb` |
| Initial worktree | Clean |

This audit uses the current Phase 35 report commit as baseline. No runtime, HTML, CSS, data, test, preload, or service-worker file was changed. No test suite, browser test, benchmark, or runtime test was run.

## 2. Ringkasan hasil

- **LiveSync:** `shop.html` and `tambang.html` point to an absent old URL; both page controllers conditionally register wallet-refresh work through `UT.LiveSync`. The canonical classic script is `assets/js/core/live-sync.js`; changing only the two `src` values preserves the current order and public API.
- **Legacy pages:** 27 document-relative script URLs fail under `/old/`. The repository explicitly classifies both pages as archives replaced by `hadiah-misi.html`; recommendation for both is **ARCHIVAL**, with no Phase 37 path repair.
- **Preload manifest:** 830 entries; all referenced files exist; no duplicate serialized keys; 20 byte counts are stale. Three existing category parity tests compare exact byte counts for the affected Aura, Dice, and Power indexes.
- **Additional preload findings:** the generator includes files marked unused in the SFX inventory and a few other files with no current runtime path reference. These are optimization candidates, not required correctness changes. No removal is recommended in Phase 37.
- **Service worker/tests:** current cache version is `ut-pwa-v188`. Four tests still assert v187 and have no corresponding runtime reason to remain there. If Phase 37 changes HTML/manifest assets, the repository’s documented cache policy supports incrementing to v189 and aligning those assertions to v189.
- **Decision:** **READY FOR PHASE 37**, limited to the exact corrections and safeguards in §9–11.

## 3. LiveSync audit

### Canonical module and API

- Canonical file: `assets/js/core/live-sync.js`; the previous `assets/js/live-sync.js` path does not exist.
- The module is a synchronous classic-script IIFE, assigns the one public `window.UT.LiveSync`, and has no import, dynamic import, or script-relative URL dependency.
- Its public methods remain `add`, `start`, `stop`, `now`, and `status`. The implementation uses global window/document events; it does not depend on either page’s path.
- `assets/preload-manifest.json` contains `assets/js/core/live-sync.js` at **4,237 bytes**, matching the current file.
- `sw.js` has no LiveSync-specific path or cache rule. Its generic same-origin GET handler is network-first and caches successful responses.
- `tests/live-sync.test.js` reads the canonical file path and exercises the module API. It does not currently assert the HTML caller paths.
- No active documentation instructs pages to use the old path. Remaining old-path mentions are historical audit records.

### Page callers, order, and behavior

| Page | Current script order around LiveSync | Indirect caller |
|---|---|---|
| `shop.html` | `assets/js/core/app.js` → `hud/ui-core.js` → **stale `assets/js/live-sync.js`** → inline `UT.App.init({page:'shop'})` → `assets/js/pages/shop-page.js` | `shop-page.js` conditionally calls `UT.LiveSync.add('wallet', ...)` and `UT.LiveSync.start(...)`. |
| `tambang.html` | `assets/js/core/app.js` → `hud/ui-core.js` → **stale `assets/js/live-sync.js`** → inline `UT.App.init({page:'tambang'})` → `assets/js/pages/tambang.js` | `tambang.js` conditionally adds the wallet refresh task and starts LiveSync. |

Both stale URLs resolve to 404 from their root documents. Both controllers guard their LiveSync usage, so the page can continue without the global but silently skips the refresh task. The explicit script tags plus those guarded call sites establish that both pages are intended to use LiveSync.

The other active HTML callers load `assets/js/core/live-sync.js` once. The existing IIFE guard (`if (UT.LiveSync) return`) also prevents duplicate API initialization if a page accidentally includes it twice, but no duplicate tag is recommended or needed. The Splash preload manifest already fetches the canonical file; preloading does not execute it. The canonical script tag is executed once by each page.

**Recommendation:** In Phase 37, change only the `src` in `shop.html` and `tambang.html` to `assets/js/core/live-sync.js`. Keep each tag in its existing position. This restores the intended wallet-refresh behavior; it does not change the LiveSync API or initialization contract.

## 4. Legacy page audit

### Reachability and support policy

- `README.md` describes `hadiah-misi.html` as replacing `misi.html` and `dailyreward.html`.
- `old/README.md` explicitly calls the pages archived, says they are not opened from any page, and says they are not preloaded or included in the manifest/service worker. It advises moving them back to the root to reopen them.
- No active HTML/navigation source links to `old/dailyreward.html` or `old/misi.html`. Current navigation points to `hadiah-misi.html`. The old pages themselves link outward to current Shop/Tambang routes.
- Neither page is in the Splash extra URL list, preload manifest, or `sw.js` `CORE`.
- The archived `referensi/newgui/README.md` contains older design notes describing the pages as independently accessible. That document is in the reference archive and does not override the current root and `old/README.md` disposition.
- There is no `<base>` tag. A path such as `assets/js/core/session.js` in `/old/dailyreward.html` resolves under `/old/assets/`, not the repository root.

### All 27 unresolved local script references

The first 11 paths occur in **both pages** (22 references). Their current files exist at the same path under the repository root; the document-relative URL is missing only because the pages live under `/old/`.

| Path as written | Pages / count | Current file under repository root |
|---|---|---|
| `assets/js/frame-guard.js` | Both / 2 | `assets/js/frame-guard.js` |
| `assets/js/core/session.js` | Both / 2 | `assets/js/core/session.js` |
| `assets/js/boot-guard.js` | Both / 2 | `assets/js/boot-guard.js` |
| `assets/js/core/prefs.js` | Both / 2 | `assets/js/core/prefs.js` |
| `assets/js/core/prefs-sync.js` | Both / 2 | `assets/js/core/prefs-sync.js` |
| `assets/js/systems/ambience.js` | Both / 2 | `assets/js/systems/ambience.js` |
| `assets/js/renderers/scene-bg.js` | Both / 2 | `assets/js/renderers/scene-bg.js` |
| `assets/js/landscape.js` | Both / 2 | `assets/js/landscape.js` |
| `assets/js/item-catalog.js` | Both / 2 | `assets/js/item-catalog.js` |
| `assets/js/player-data.js` | Both / 2 | `assets/js/player-data.js` |
| `hud/ui-core.js` | Both / 2 | `hud/ui-core.js` |
| `assets/js/character-data.js` | `old/dailyreward.html` / 1 | `assets/js/character-data.js` |
| `assets/js/mob-view.js` | `old/dailyreward.html` / 1 | `assets/js/mob-view.js` |
| `assets/js/vendor/three.min.js` | `old/dailyreward.html` / 1 | `assets/js/vendor/three.min.js` |
| `assets/js/floating-island.js` | `old/dailyreward.html` / 1 | `assets/js/floating-island.js` |
| `assets/js/quest-data.js` | `old/misi.html` / 1 | Old target is absent; current canonical file is `assets/js/data/quest-data.js`. |

The 27 paths above account for 15 failures in `old/dailyreward.html` and 12 in `old/misi.html`. Other local script references in these pages are not part of the 27: the `../assets/js/services/wallet-service.js` and `../assets/js/core/app.js` paths already resolve to root files, and each page’s own `assets/js/pages/{dailyreward,misi}.js` resolves to its existing controller under `old/assets/`.

If the pages are ever returned to supported service, a blanket `../` prefix is insufficient for `assets/js/quest-data.js`; that reference must target `../assets/js/data/quest-data.js`. Their CSS and other asset references also assume a root-level page and would need a separate support audit.

### Decision per page

| Page | Recommendation | Reason |
|---|---|---|
| `old/dailyreward.html` | **ARCHIVAL** | Explicitly retired and replaced by the Hadiah tab in `hadiah-misi.html`; no current inbound link, preload, manifest, or service-worker entry. |
| `old/misi.html` | **ARCHIVAL** | Explicitly retired and replaced by the Misi tab in `hadiah-misi.html`; no current inbound link, preload, manifest, or service-worker entry. |

Do not fix these paths, delete pages, or change navigation in Phase 37. Reconsider only if product requirements explicitly restore standalone support.

## 5. Full preload manifest audit

### Inventory integrity and loader behavior

- Parsed all **830** entries in `assets/preload-manifest.json`.
- **0** referenced files are missing.
- **0** duplicate serialized JSON keys were found.
- All 20 mismatches below are the only byte-count differences; other entries match actual file sizes.
- `tools/gen-preload-manifest.py` walks `assets/`, `data/`, `gameplay/`, `hud/`, and `promosi/`, including files with the configured static extensions, and excludes `old/`, `doc/`, `referensi/`, and `node_modules/`.
- `UT_Preload.runAuto()` loads every manifest key in addition to the Splash page’s extra URLs. `run()` deduplicates identical URLs across those lists, so overlapping extras do not cause duplicate fetches.
- The manifest size is used as the expected progress weight. For streamed same-origin responses with a positive `Content-Length`, the actual header replaces the estimate. A stale size therefore does **not** prevent a file from loading or affect its URL/cache key; it can distort progress when the response has no usable length. The preload still completes from fetch completion/timeout.
- Several registry parity tests compare selected manifest values directly to `fs.statSync(...).size`; the Aura, Dice, and Power index mismatches therefore affect those assertions. There is no single 830-entry size assertion.

### All byte-count mismatches

`Delta = actual − listed`. Every file below is still part of the current application, loaded by an active page, stylesheet, script dependency, or data/runtime reference. The mismatch affects only the size estimate and any exact-size assertion, not the file path or runtime load behavior.

| Path | Listed | Actual | Delta | Active / validation evidence |
|---|---:|---:|---:|---|
| `assets/css/scene-bg.css` | 10,860 | 10,878 | +18 | Active shared stylesheet; `lobby.html` and Splash preload reference it. |
| `assets/js/blocky-character.js` | 64,282 | 64,432 | +150 | Active on Character, Gameplay, Lobby, Tambang, and other pages. |
| `assets/js/character-data.js` | 38,603 | 50,130 | +11,527 | Active model data used by Character, Gameplay, and several root pages. |
| `assets/js/item-catalog.js` | 41,712 | 42,707 | +995 | Active catalog loaded by root pages and category registration. |
| `assets/js/pages/powerup.js` | 9,343 | 9,363 | +20 | Active controller loaded by `powerup.html`. |
| `assets/js/pages/room.js` | 36,987 | 36,997 | +10 | Active controller loaded by `room.html`. |
| `assets/js/pages/splash.js` | 5,917 | 5,970 | +53 | Active Splash controller, also in the service-worker `CORE` list. |
| `assets/js/renderers/room-dice-art.js` | 324 | 322 | −2 | Active Room renderer loaded by `room.html`. |
| `data/inventory/aura/index.js` | 2,154 | 2,164 | +10 | Active category index; exact-size assertion in `tests/aura-registry-parity.test.js`. |
| `data/inventory/dice/index.js` | 3,098 | 3,118 | +20 | Active category index; exact-size assertion in `tests/dice-registry-parity.test.js`. |
| `data/inventory/power/index.js` | 2,879 | 2,969 | +90 | Active category index; exact-size assertion in `tests/power-registry-parity.test.js`. |
| `data/power/power-fx.js` | 14,266 | 14,276 | +10 | Active Power effect definitions used by Power pages and Gameplay. |
| `gameplay/css/hud-mockup.css` | 69,077 | 68,165 | −912 | Active Gameplay stylesheet loaded by `gameplay.html`; multiple tests inspect it. |
| `gameplay/js/audio.js` | 16,786 | 16,806 | +20 | Active Gameplay audio module loaded by `gameplay.html`. |
| `gameplay/js/dice-pad.js` | 2,057 | 2,067 | +10 | Active Gameplay script loaded by `gameplay.html`. |
| `gameplay/js/dice-throw.js` | 27,326 | 27,356 | +30 | Active Gameplay script and race-test source. |
| `gameplay/js/dice-ui.js` | 4,870 | 4,880 | +10 | Active Gameplay script and dice-rendering test source. |
| `gameplay/js/main.js` | 464,493 | 464,455 | −38 | Active Gameplay entry script loaded by `gameplay.html`. |
| `gameplay/js/power3d-loader.js` | 445 | 465 | +20 | Active Gameplay loader; also referenced by Gameplay/Power tests. |
| `gameplay/js/skin-uv.js` | 5,399 | 5,409 | +10 | Active Gameplay skin utility used by `game-integration.js` and Gameplay. |

**Recommendation:** Regenerate the manifest in Phase 37 using the existing generator and verify the diff changes only these 20 values. Do not remove or add paths as part of this correction.

### Duplicate, unused, and missing preload entries

- There are no duplicate manifest keys. The Splash extras overlap some manifest paths, but the loader’s `seen` set deduplicates them.
- No manifest entry points to a missing file. A literal-path scan has limits for relative CSS URLs, module-relative imports, and dynamically assembled assets; lack of a full path literal alone is not proof of disuse.
- Focused review did find current candidates that are included and fetched by the broad generator but have no active runtime reference:
  - Explicitly marked “belum dipakai” in `assets/sfx/README.md`: `assets/sfx/board/move-back.mp3`, `assets/sfx/board/snake-bite-alt.mp3`, `assets/sfx/mob/creeper-hiss.mp3`, `assets/sfx/mob/enderman-alt.mp3`, and `assets/sfx/mob/mob-hit-alt.mp3`.
  - No current runtime reference found for `assets/sfx/dragon-studio.mp3`, `assets/sfx/win/Firework_large_blast_far.ogg`, `assets/sfx/win/Firework_twinkle.ogg`, and `assets/music/gameplay.mp3`. The active Gameplay playlist references other music files.
- These nine entries are **preload optimization candidates**, not confirmed deletion candidates. The SFX README’s “belum dipakai” note for `assets/sfx/powerup/sword-use.mp3` is stale: `gameplay/js/audio.js` currently references it as the sword sound, so it must not be excluded as unused.
- The only active local URL found outside the generated manifest’s extension set is `assets/icons/favicon.ico`. The generator does not include `.ico`; the browser requests it as a favicon and `sw.js` already recognizes `.ico` as media. It does not need to be added to the Splash progress preload. Root `manifest.webmanifest` is also outside the generated roots and is already in `sw.js` `CORE`.

Do not change generator scope, delete files, or prune these candidates in Phase 37. Any selective-preload optimization needs a separate owner/reachability review because `runAuto()` currently preloads every generated entry.

## 6. Service worker and version assertions

- Current `sw.js` version: **`ut-pwa-v188`**.
- `CORE` contains 10 paths; all 10 currently exist. Keep the list unchanged.
- Cache policy remains media cache-first and other same-origin GET network-first with offline fallback. There is no LiveSync-specific cache policy.
- A repository-wide current-source search found exactly four v187 assertions and no other stale numeric `ut-pwa-vNNN` assertion outside historical audit records:
  - `tests/aura-registry-parity.test.js`
  - `tests/character-registry-parity.test.js`
  - `tests/dice-registry-parity.test.js`
  - `tests/power-registry-parity.test.js`
- Phase 30 set those test literals to v187; Phase 32 subsequently changed `sw.js` to v188, but did not update these four tests. No independent reason to keep v187 was found.
- At the Phase 36 baseline, these assertions are stale and should track v188. However, the repository README and service-worker comment say to increment the cache version after asset changes. Since the recommended Phase 37 path and manifest corrections change served HTML/asset metadata, the consistent Phase 37 end state is **v189** and these four assertions should be updated directly to v189 in the same checkpoint.
- Incrementing the version changes cache identity only. It must not alter cache-first/network-first behavior or the `CORE` entries. No test suite was run; the stale values are established by static source comparison.

## 7. Cache/preload safety requirements

Phase 37 should:

1. Preserve the existing `assets/js/core/live-sync.js` URL and script position relative to `UT.App.init()` and each page controller.
2. Leave `assets/js/preloader.js` and `tools/gen-preload-manifest.py` logic unchanged; use the existing generator only to refresh the 20 stored byte counts.
3. Keep all 830 manifest paths, ordering policy, and deduplication behavior. Do not add all JavaScript to `sw.js` `CORE`.
4. Bump only the SW version value to v189 if the two HTML path corrections and manifest refresh are applied; keep the `CORE` array and cache algorithms byte-for-byte unchanged.
5. Leave archival HTML and the nine possible unused preload entries untouched.
6. Avoid duplicate script tags: each active page needs exactly one canonical LiveSync tag. Splash prefetch is a fetch only; it does not execute the script.

## 8. Risiko dan dependensi

- Correcting the LiveSync path will activate the existing guarded wallet refresh on Shop and Tambang. This is the intended behavior indicated by each controller and script tag; LiveSync logic itself does not change.
- A path-only update is low risk if script position is preserved. Moving the tag before wallet/app initialization or after the page controller could change initialization behavior and is not recommended.
- Regenerating the manifest should update only listed byte counts. If the generated diff adds/removes keys or changes unrelated values, stop and investigate rather than accepting broad output.
- Raising v188 to v189 invalidates the old cache namespace per existing policy. Keep `CORE` unchanged so offline precache scope does not broaden.
- Fixing the 27 legacy paths would require treating both pages as supported and addressing the stale Quest Data path plus other root-relative CSS/assets; current repository documentation says they are archives.
- Pruning preload-only files would reduce downloads but is optional optimization and out of Phase 37’s correctness scope.

## 9. Rekomendasi perubahan Phase 37

Implement in this order:

1. Change the two active HTML script URLs to the canonical LiveSync path, without moving the tags.
2. Run the existing preload-manifest generator and confirm only the 20 byte values in §5 change.
3. Increment `sw.js` from v188 to v189 under the documented asset-cache policy; preserve `CORE` and all fetch/cache logic.
4. Change the four test version assertions directly from v187 to v189. Do not first commit an intermediate v188 expectation.
5. Add a focused static assertion to the existing LiveSync test for one canonical script tag per page and ordering before `UT.App.init()`/page controller, if accepted as regression coverage.
6. Verify current manifest keys/files/byte counts, no stale LiveSync paths, version assertions, unchanged `CORE` and cache strategies, `git diff --check`, and report-only/implementation scope. Do not run a test suite in this preflight; final suites remain for the approved final validation phase.

### Phase 37 expected file-change table

| File | Perubahan yang direkomendasikan | Alasan | Risiko | Cara verifikasi |
|---|---|---|---|---|
| `shop.html` | Change `assets/js/live-sync.js` to `assets/js/core/live-sync.js`; preserve tag position. | Page controller registers wallet refresh through `UT.LiveSync`. | Restores intended refresh behavior; ordering must stay unchanged. | Static parse: exactly one canonical tag, before inline init and `shop-page.js`; no stale path. |
| `tambang.html` | Same path-only update; preserve tag position. | Tambang controller registers wallet refresh through `UT.LiveSync`. | Same guarded behavior restoration; do not affect Mine Service order. | Static parse: exactly one canonical tag, before inline init and `tambang.js`; no stale path. |
| `assets/preload-manifest.json` | Regenerate byte values for the 20 listed files; keep all keys. | Corrects progress estimates and exact-size assertions. | Generator may expose unrelated drift; accept only the verified 20-value diff. | Parse JSON; 830 keys, all paths exist, all sizes match; compare key set before/after. |
| `sw.js` | Change only `VERSION` from `ut-pwa-v188` to `ut-pwa-v189`. | Required by repository cache-version policy after served asset changes. | Cache namespace is invalidated; preserve offline scope and fetch behavior. | Diff confirms `CORE` and handlers unchanged; static check version is v189. |
| `tests/aura-registry-parity.test.js` | Update expected service-worker version to v189. | v187 is stale; aligns with Phase 37 SW version. | Test source only. | Search all current-source `ut-pwa-vNNN` assertions; no stale value. |
| `tests/character-registry-parity.test.js` | Update expected service-worker version to v189. | Same. | Test source only. | Same version scan; verify its existing preload assertions remain unchanged. |
| `tests/dice-registry-parity.test.js` | Update expected service-worker version to v189. | Same; also contains exact-size checks for Dice index. | Test source only; manifest refresh must fix the index value. | Same version scan and confirm Dice index size matches file. |
| `tests/power-registry-parity.test.js` | Update expected service-worker version to v189. | Same; also contains exact-size checks for Power index. | Test source only; manifest refresh must fix the index value. | Same version scan and confirm Power index size matches file. |
| `tests/live-sync.test.js` | **Recommended focused addition:** assert the two pages use the canonical script exactly once and keep it before initialization/controller scripts. | Existing test covers API behavior but did not catch the stale HTML paths. | Static test coverage only; avoid changing runtime semantics. | Review assertion against both HTML orders; execution is deferred until the permitted test phase. |

No `old/*.html`, `assets/js/core/live-sync.js`, `assets/js/preloader.js`, generator logic, `CORE` entries, or cache handlers are expected to change.

## 10. Hal yang harus tetap dipertahankan

- Keep `window.UT.LiveSync` and its `add/start/stop/now/status` contract.
- Keep each corrected script synchronous/classic, loaded once, and in its existing position.
- Keep the preload manifest’s 830-path set; only the 20 byte counts are in scope.
- Keep service-worker cache algorithms and all 10 `CORE` entries; only the version token may change to v189 for the approved asset edits.
- Keep both old pages and navigation untouched; their Phase 36 disposition is archival.
- Do not delete, relocate, or exclude the nine preload optimization candidates in this phase.
- Do not change PlayerData, wallet behavior, RPCs, storage, Supabase, public APIs, or business logic.
- Do not claim test-suite success; none was run.

## 11. Verifikasi statis Phase 36

- Verified current branch, `HEAD`, tracking/remote branch refs, initial clean worktree, and unchanged local/origin/remote `main`.
- Confirmed both stale LiveSync paths, canonical file/API, page-controller calls, manifest entry/size, test source path, and unchanged service-worker policy.
- Parsed all 830 preload entries; checked target existence, serialized duplicate keys, byte-count deltas, preload generator rules, and loader deduplication.
- Enumerated all 27 failing legacy script URLs and checked their document-relative paths and current canonical targets.
- Searched current-source SW version assertions; found only the four v187 tests and current v188 worker.
- Inspected preload candidates and documented optimization-only unused audio entries.
- No test suite, browser test, benchmark, or runtime test was run.
- **No runtime file or other repository file was changed; only this audit report is intended to change.**

## 12. Keputusan akhir

**READY FOR PHASE 37**

Readiness is limited to the changes in §9. Treat legacy-page repairs and unused-entry pruning as out of scope unless separately approved. Keep Phase 37 atomic, preserve cache behavior, and stop after its approved checkpoint; do not infer authorization for later phases from this audit.
