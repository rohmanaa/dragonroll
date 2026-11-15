# Dragon Roll — Global CSS Extraction Phase 3

Status: base reset, shared overlay/toast, and utility rules modularized. The existing typography stylesheet remains intact for a static test contract. No HTML, JavaScript, visual values, or gameplay styles were changed. Tests and browser checks were not run, per phase instructions.

## 1. Baseline

- Branch: `restruktur`
- Phase 2 checkpoint: `7c99f9e8c7990cc12cf2ad960ac3d4a50deb0ed0`
- `HEAD` matched `origin/restruktur`; the worktree was clean before this phase.
- Cross-checked the prior Stage 1-8.4 audit series and the global structure, folder foundation, and JavaScript extraction reports. Relevant constraints retained: static site/no bundler, runtime paths are contracts, gameplay CSS is isolated, page styles are already partly split, and item-level CSS is not required.

## 2. Inventory and ownership

The repository now has **84 CSS files totaling 741,781 bytes**. Inventory below records path and current byte size.

| CSS domain | Files | Bytes | Notes |
|---|---:|---:|---|
| `assets/css/` (including new modules) | 17 | 48,398 | Shared/base/page CSS |
| `assets/ng/css/` | 23 | 160,085 | Active per-page UI styles; paths and cascade retained |
| `assets/lobby-backdrop/` | 1 | 126,052 | Backdrop document stylesheet |
| `gameplay/css/` | 9 | 222,108 | Gameplay-specific; left untouched |
| `hud/` | 7 | 22,535 | Already split into components and theme |
| `old/assets/css/pages/` | 6 | 41,932 | Archived pages |
| `referensi/newgui/game/css/` | 21 | 120,671 | Reference/mockup styles |
| **Total** | **84** | **741,781** | |

### Complete file-size inventory

| File | Bytes |
|---|---:|
| `assets/css/base.css` | 237 |
| `assets/css/base/reset.css` | 219 |
| `assets/css/components/overlay.css` | 1,158 |
| `assets/css/fonts.css` | 1,383 |
| `assets/css/lobby-theme.css` | 474 |
| `assets/css/night-fog.css` | 2,876 |
| `assets/css/pages/floatingsample.css` | 2,267 |
| `assets/css/pages/inventory.css` | 2,201 |
| `assets/css/pages/lobby.css` | 3,098 |
| `assets/css/pages/lobby-2.css` | 512 |
| `assets/css/pages/play.css` | 5,345 |
| `assets/css/pages/profile.css` | 2,102 |
| `assets/css/pages/room.css` | 6,395 |
| `assets/css/scene-bg.css` | 10,860 |
| `assets/css/shared-ui.css` | 8,963 |
| `assets/css/utilities/common.css` | 193 |
| `assets/css/utilities/loading.css` | 115 |
| `assets/lobby-backdrop/backdrop.css` | 126,052 |
| `assets/ng/css/bg.css` | 454 |
| `assets/ng/css/common.css` | 3,071 |
| `assets/ng/css/dadu.css` | 1,147 |
| `assets/ng/css/efek.css` | 904 |
| `assets/ng/css/frame.css` | 3,913 |
| `assets/ng/css/friendship.css` | 2,939 |
| `assets/ng/css/karakter.css` | 6,739 |
| `assets/ng/css/kredit.css` | 10,394 |
| `assets/ng/css/leaderboard.css` | 6,214 |
| `assets/ng/css/lobby.css` | 18,771 |
| `assets/ng/css/mail.css` | 3,060 |
| `assets/ng/css/mission.css` | 10,662 |
| `assets/ng/css/mode.css` | 14,039 |
| `assets/ng/css/page.css` | 5,670 |
| `assets/ng/css/pet.css` | 3,726 |
| `assets/ng/css/powerup.css` | 13,034 |
| `assets/ng/css/profile.css` | 7,952 |
| `assets/ng/css/room.css` | 14,869 |
| `assets/ng/css/settings.css` | 3,962 |
| `assets/ng/css/shop.css` | 13,496 |
| `assets/ng/css/splash.css` | 6,954 |
| `assets/ng/css/sub.css` | 2,637 |
| `assets/ng/css/tambang.css` | 5,478 |
| `gameplay/css/dice-pad.css` | 6,233 |
| `gameplay/css/gameplay.css` | 101,379 |
| `gameplay/css/gameplay-base.css` | 1,014 |
| `gameplay/css/gameplay-overrides.css` | 14,448 |
| `gameplay/css/hud-mockup.css` | 69,077 |
| `gameplay/css/level-up.css` | 6,760 |
| `gameplay/css/particle-fx.css` | 1,290 |
| `gameplay/css/pause.css` | 8,926 |
| `gameplay/css/win-screen.css` | 12,981 |
| `hud/components/badge.css` | 1,841 |
| `hud/components/button.css` | 2,704 |
| `hud/components/card.css` | 1,757 |
| `hud/components/currency.css` | 1,718 |
| `hud/components/modal.css` | 2,736 |
| `hud/components/toast.css` | 2,456 |
| `hud/theme/fantasy.css` | 9,323 |
| `old/assets/css/pages/dailyreward.css` | 12,493 |
| `old/assets/css/pages/dailyreward-2.css` | 1,199 |
| `old/assets/css/pages/dailyreward-3.css` | 11,230 |
| `old/assets/css/pages/dailyreward-4.css` | 5,783 |
| `old/assets/css/pages/misi.css` | 10,387 |
| `old/assets/css/pages/misi-2.css` | 840 |
| `referensi/newgui/game/css/bg.css` | 454 |
| `referensi/newgui/game/css/common.css` | 3,071 |
| `referensi/newgui/game/css/dadu.css` | 1,386 |
| `referensi/newgui/game/css/efek.css` | 2,172 |
| `referensi/newgui/game/css/frame.css` | 3,180 |
| `referensi/newgui/game/css/friendship.css` | 1,970 |
| `referensi/newgui/game/css/karakter.css` | 5,679 |
| `referensi/newgui/game/css/leaderboard.css` | 3,348 |
| `referensi/newgui/game/css/lobby.css` | 17,851 |
| `referensi/newgui/game/css/mail.css` | 2,115 |
| `referensi/newgui/game/css/mission.css` | 8,135 |
| `referensi/newgui/game/css/mode.css` | 13,648 |
| `referensi/newgui/game/css/page.css` | 5,545 |
| `referensi/newgui/game/css/pet.css` | 1,861 |
| `referensi/newgui/game/css/profile.css` | 7,838 |
| `referensi/newgui/game/css/room.css` | 15,688 |
| `referensi/newgui/game/css/settings.css` | 3,673 |
| `referensi/newgui/game/css/shop.css` | 9,187 |
| `referensi/newgui/game/css/splash.css` | 7,891 |
| `referensi/newgui/game/css/sub.css` | 2,658 |
| `referensi/newgui/game/css/tambang.css` | 3,321 |

## 3. HTML loading, inline styles, and cascade

Audited stylesheet references across application pages, gameplay, legacy pages, tools, and references. No HTML was edited. Important existing load sequences:

- Most new-GUI pages load `assets/css/fonts.css`, then `assets/ng/css/common.css`, then shared/page/domain sheets, with `assets/ng/css/bg.css` near the end.
- Lobby loads `assets/css/pages/lobby-2.css`, fonts, new-GUI common/lobby, `assets/css/scene-bg.css`, then `assets/css/pages/lobby.css`.
- Gameplay loads `assets/css/base.css`, particle FX, gameplay base, fonts, gameplay main, dice pad, overrides, HUD mockup, pause, win screen, and level-up in that order.
- Profile and Room append their `assets/css/pages/` sheets after the new-GUI page styles. Room also loads particle FX after its page stylesheet.
- Existing duplicate references were observed (for example particle FX on `powerup.html`, and shared-ui on archived daily reward). They were not changed.

Inline `<style>` blocks remain in place because HTML changes are prohibited. Root examples include `index.html`, `mode.html`, and `splash.html`; archived/reference documents contain additional inline styles. Their selectors, keyframes, and page-specific state were not moved.

Selector/cascade findings:

- Base uses low-specificity `:where()` defaults; keep that specificity.
- Shared UI has intentionally high-specificity selectors such as `html body .ut-curbar`, `html body #back`, and `html body #title`.
- Global `html`, `body`, `:root`, and element selectors recur across page and theme sheets. Similar-looking rules are not assumed redundant.
- Theme variables remain scoped in their existing theme/background files (`assets/css/lobby-theme.css`, `hud/theme/fantasy.css`, and `assets/css/scene-bg.css`); no global token block was found in the base entrypoint.
- The scan found 90 `@media` occurrences and 304 `url()` references. No `@import` existed before this change; the `base.css` compatibility entrypoint now uses ordered imports.
- Breakpoints, reduced-motion rules, animations, theme variables, state classes, and z-index declarations outside the extracted base rules remain untouched.

## 4. Completed extraction

| Existing entrypoint | Modular source | Responsibility |
|---|---|---|
| `assets/css/base.css` | `assets/css/base/reset.css` | Low-specificity element defaults |
| `assets/css/base.css` | `assets/css/utilities/common.css` | `.hidden` and `.disabled` helpers |
| `assets/css/base.css` | `assets/css/components/overlay.css` | Shared UT overlay, modal, and toast |
| `assets/css/base.css` | `assets/css/utilities/loading.css` | `html.ut-loading` state |

Compatibility and ordering:

- Existing `base.css` remains a compatibility entrypoint; no HTML stylesheet links changed. `fonts.css` stays unchanged at its existing path.
- The four imports in `base.css` follow the exact original rule-group order.
- No selectors, declarations, dimensions, colors, breakpoints, animations, or variables were intentionally changed.
- `assets/preload-manifest.json` was updated for the changed base entrypoint and all four new CSS modules.
- `sw.js` was not changed because application JavaScript changes are prohibited. CSS requests use the existing network-first worker path; preload paths/sizes are current.

## 5. CSS deferred and rationale

- `assets/css/shared-ui.css`: contains coupled currency, modal, reveal, stage layout, `#back`, and `#title` rules; some pages load it last and archived markup loads it more than once. Keep its file and cascade boundary until consumers can be migrated together.
- `assets/css/scene-bg.css` and `assets/css/night-fog.css`: preserve existing page links, dynamic state selectors, and relative texture URLs.
- `assets/css/fonts.css`: remains an isolated typography stylesheet. `tests/no-cdn.test.js` reads this exact file and expects its eight local font URLs; changing its source contract would require a prohibited JavaScript/test change.
- `assets/ng/css/*.css`: actively referenced across root pages; keep each page's existing order and avoid changing common/page selectors.
- `assets/css/pages/*.css`: already page-specific and has relative asset paths; retain current ownership.
- `gameplay/css/*.css`: gameplay-specific responsive/state logic and a large override chain; untouched.
- `hud/components/*.css` and `hud/theme/fantasy.css`: already organized by component/theme, with loading contracts in HUD JavaScript; untouched.
- `assets/lobby-backdrop/backdrop.css`, `old/`, and `referensi/`: separate backdrop, archived, or design-reference contracts; no consolidation/removal.
- No `layout/` or `themes/` folder was created because no candidate there could be moved under the no-HTML/no-JavaScript constraint without risking a path or cascade change. Existing `pages/` remains in use.

## 6. Static verification and deferred testing

- Compared the concatenated extracted base modules against the prior `base.css` after removing comments/whitespace: rule content and order match.
- Confirmed all imports resolve, the existing eight font URLs resolve, and preload byte sizes match the filesystem.
- Confirmed no HTML or JavaScript files were changed.
- Test suites and browser testing were not run, as instructed.
