# Global Extraction Phase 13 — Wallet Service Assessment & Extraction

## Git baseline

- Branch: `restruktur`
- Starting `HEAD` and `origin/restruktur`: `ae0a0adbeff71baa6edc293b689fd1fffb9d09e6`
- `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean before this phase.
- Source: `assets/js/wallet-service.js`; target did not exist before extraction.

## Dependency and API audit

The classic-script UMD module publishes `UT.WalletService` in the browser and `module.exports` for Node. Its public factory API remains `{ create, get }`. The lazy browser instance exposes `enabled`, `refresh`, `buy`, `buySet`, `buyPowerup`, `usePower`, `history`, `exchange`, `dailyGet`, `claimDaily`, `openBox`, `questGet`, `questTrack`, `questClaim`, `questClaimAll`, `questClaimBonus`, `claimBossOnline`, `claimBossCpu`, `capsGet`, `claimAd`, `adGet`, and `claimAchievement`.

The module receives `PlayerData` and `getClient` through its existing dependency object. It reads `PlayerData.serverMode()` and mirrors successful server responses only through `applyServerWallet`, `applyServerItem`, and `owns`. It has no direct `ItemCatalog` dependency. The Supabase client is obtained lazily from `UT.Multiplayer.getClient()`; RPC names and arguments remain unchanged, including wallet/inventory reads, item and set purchases, Power-up purchase/use, exchange, daily reward, quest, boss, ad, achievement, and history/cap queries. No transaction, balance calculation, ownership validation, endpoint, or server-authority logic was changed.

The module captures `document.currentScript.src` and builds the lazy import URL with `new URL(...)`. It does not use `import.meta.url` or call `fetch` directly. The original source-relative client URL resolved to `assets/js/multiplayer/client.js`; after moving under `services/`, the script-relative branch now uses `../multiplayer/client.js` to preserve that exact URL. The no-`currentScript` fallback retains its previous `multiplayer/client.js` path and location base. Preserving the client URL also preserves its relative vendor and configuration imports.

## HTML and runtime callers

Twenty HTML pages load the service: 18 root pages (`dadu.html`, `efek.html`, `frame.html`, `friendship.html`, `gameplay.html`, `hadiah-misi.html`, `karakter.html`, `leaderboard.html`, `lobby.html`, `mail.html`, `mode.html`, `pet.html`, `powerup.html`, `profile.html`, `room.html`, `settings.html`, `shop.html`, and `tambang.html`) and archived `old/dailyreward.html` and `old/misi.html`.

All 18 root pages load `PlayerData` and `ItemCatalog` before the Wallet Service script. The page script positions are unchanged. The two nested archived HTML pages now use `../assets/js/services/wallet-service.js` so their service URL resolves to the root asset; their other pre-existing nested asset paths, including their `PlayerData` paths, were not changed and may remain unresolved when opened directly.

Runtime API consumers found include `assets/js/friendship-page.js`, `assets/js/pet-page.js`, `assets/js/shop-page.js`, `assets/js/pages/{dadu,efek,frame,hadiah-misi,karakter,leaderboard,lobby,mail,mode,powerup,profile,room,tambang}.js`, `gameplay/js/main.js`, and `old/assets/js/pages/{dailyreward,misi}.js`. Calls continue to use the same `UT.WalletService.get()` and instance methods.

## Other references and cache behavior

- Updated source-path references in `tests/buy-set-sql.integration.test.js`, `tests/player-data-server.test.js`, and `tests/power-registry-parity.test.js`.
- Updated the script-order assertion in `tests/lobby-appearance.test.js`.
- Updated `assets/preload-manifest.json` from the old key (11,919 bytes) to `assets/js/services/wallet-service.js` at 11,955 bytes.
- No matching wallet source-path references were found in tools. Documentation/audit and `referensi/` mentions are historical/reference material and were left unchanged.
- `sw.js` has no Wallet Service core-precache entry and uses network-first for code, caching responses by request URL. No service-worker or cache-version change was necessary.

## Decision and changes

**The extraction was safe and completed.** The source moved to `assets/js/services/wallet-service.js`. The only source change adjusts the script-relative client import while preserving both its effective browser URL and the existing fallback. All known HTML, test, and preload callers were updated; no compatibility wrapper or duplicate source was added.

Implementation files changed:

- Moved `assets/js/wallet-service.js` to `assets/js/services/wallet-service.js`.
- Updated 20 HTML script references, four test path references/assertions, and the preload key/size.
- `sw.js`, PlayerData, ItemCatalog, database/RPC definitions, and transaction logic were not changed.

## Static verification

- Verified all 20 HTML service URLs resolve to the new source.
- Verified the source differs from its original only in the relative client import path.
- Verified the old and new browser import URLs match, and the fallback URL is unchanged.
- Verified the preload key and size match the moved file; all callers and tests reference the new path.
- Verified service-worker, tool, and documentation references; historical references were left intact.
- `git diff --cached --check` and `node --check` for the moved source and four changed test files passed.
- No test suite or browser test was run.

## Checkpoint and remaining risks

- Implementation commit: `f573af0e17ebb796b9c9d5c4a84f566c510f97fc` (`refactor(js): relocate wallet service`), pushed separately before this audit commit.
- The audit is committed separately and pushed after this report is added.
- External integrations could still have hard-coded the former URL.
- The archived pages' other nested asset paths remain outside this extraction's scope.
- Final `HEAD == origin/restruktur`, clean worktree, and unchanged `main` are verified after the audit push.
