# Global Extraction Phase 9 — Session Module Path Assessment

## Git preflight

- Branch: `restruktur`
- Baseline HEAD and `origin/restruktur`: `507fef8a619d208037e5bc3d4f2fc5f38d4d2bdf`
- `main` and `origin/main`: both `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before this phase.
- Phase 8 migration verified: `3637a78dd1fb6054fd82df945685aac11bd75b29`
- Phase 8 final HEAD verified: `507fef8a619d208037e5bc3d4f2fc5f38d4d2bdf`

## Dependency and runtime audit

`assets/js/session.js` is a 1,509-byte classic-script IIFE. It has no imports,
dynamic imports, `fetch`, `document.currentScript`, relative URLs, or other
path-sensitive behavior. It installs `window.UT.Session` when evaluated and
does not read storage or dispatch lifecycle events during initialization.

The public API remains `KEY`, `read`, `id`, `username`, `loggedIn`, `write`, and
`clear`. Its only storage key is localStorage `ut-auth`; it does not use
sessionStorage. The module is a local identity cache, not the authentication
authority. Supabase Auth remains responsible for session validation through
`auth.js`.

Runtime consumers found:

- `auth.js`: reads/writes/clears the cache as Supabase authentication resolves.
- `boot-guard.js`: checks the cached login state before guarded pages continue.
- `player-data.js`: derives the account-specific storage identity.
- `assets/js/core/prefs-sync.js`: uses Session as part of its existing startup
  and synchronization flow.
- `assets/js/pages/profile.js` and `assets/js/pages/settings.js`: use the
  existing Session API.

The audit found 23 HTML pages loading Session and 16 tests referencing its
source path. Session was loaded before dependent boot/auth/player-data scripts;
the HTML comparison confirmed that every script tag and its position remain
unchanged apart from the Session `src`. The session module itself has no
self-starting network or storage behavior. The actual app bootstrap remains
`assets/js/app.js`; `assets/js/core/app.js` does not exist.

Authentication, guest/local data behavior, account scoping, session recovery,
storage keys, events, and the `UT.Session` API were not changed. The ordering
and path contracts needed by those flows are preserved by updating references
in place.

## Decision

**Move the module.** The source is independent of its directory, and all
in-repository runtime and test references can be updated without changing
initialization order or runtime semantics. No compatibility wrapper is
necessary: no active in-repository consumer remains on the old path, and a
wrapper would introduce an unnecessary second loading path.

## Files and dependency updates

- Move `assets/js/session.js` to `assets/js/core/session.js`; file contents are
  byte-for-byte unchanged.
- Update the Session script path in:
  `dadu.html`, `efek.html`, `frame.html`, `friendship.html`, `gameplay.html`,
  `hadiah-misi.html`, `inventory.html`, `karakter.html`, `leaderboard.html`,
  `lobby.html`, `mail.html`, `mode.html`, `old/dailyreward.html`,
  `old/misi.html`, `pet.html`, `play.html`, `powerup.html`, `profile.html`,
  `room.html`, `settings.html`, `shop.html`, `splash.html`, and `tambang.html`.
- Update source-path references only in:
  `tests/appearance-service.test.js`, `tests/aura-catalog.test.js`,
  `tests/aura-registry-parity.test.js`,
  `tests/buy-set-sql.integration.test.js`,
  `tests/character-registry-parity.test.js`,
  `tests/dice-registry-parity.test.js`,
  `tests/frame-catalog-integration.test.js`,
  `tests/gear-player-data.test.js`, `tests/legacy-cleanup.test.js`,
  `tests/outfits-player-data.test.js`, `tests/pet-catalog.test.js`,
  `tests/pet-registry-parity.test.js`, `tests/player-data-server.test.js`,
  `tests/power-registry-parity.test.js`, `tests/session.test.js`, and
  `tests/settings-prefs.test.js`. Test logic was not changed.
- Change the preload key from `assets/js/session.js` to
  `assets/js/core/session.js`; the entry remains 1,509 bytes.
- No `sw.js` change: Session is not in the service worker's core precache list,
  and the existing network-first code caching behavior does not require a
  cache-version change for this relocation.

## Static verification

- All 23 HTML consumers point to the new file.
- Each affected HTML file is identical to its baseline except for the Session
  script path. Script order is unchanged.
- All 16 test path references were updated; each test file is otherwise
  identical to baseline.
- The moved source is byte-for-byte identical to the baseline source.
- The preload manifest has exactly two changed entries: removal of the old
  path and addition of the new path at 1,509 bytes. No preload path is missing.
- No active HTML, JavaScript, or JSON reference to the old path remains.
- `sw.js` is unchanged.
- `git diff --check` passes.
- Test suites and browser tests were intentionally not run.

## Risks and follow-up

An external integration not represented in this repository could still have
hard-coded the old static URL. No in-repository consumer remains on that path;
no compatibility alias was added to avoid maintaining a second load route.
Authentication and session recovery should be included in the eventual
post-extraction test run.

## Checkpoint

- Migration commit: `4a2f4352c9afd6f5105943e679c9672695d4cc70`
- Migration commit pushed to `origin/restruktur`; after that push,
  `HEAD == origin/restruktur == 4a2f4352c9afd6f5105943e679c9672695d4cc70`.
- `main` was not changed.
- The final check found an unrelated, untracked `audit/5/global.md` containing
  a conflicting request to prioritize a reference-assets audit before Session
  extraction. It was not created, modified, staged, or committed in this
  phase. The audit-only checkpoint is therefore pending clarification.
