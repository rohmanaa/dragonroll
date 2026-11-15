# Global Restructure — Reference Assets Audit & Relocation

## 1. Scope and baseline

- Branch: `restruktur`
- HEAD: `4a2f4352c9afd6f5105943e679c9672695d4cc70`
- `origin/restruktur`: same hash at time of audit
- `main` and `origin/main`: unchanged at `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Objective: audit archived/reference asset folders and distinguish true runtime assets from design-only or prototype references before any move.

## 2. Inventory findings

Repository scan result for the reference and archive families:

- `referensi/`: 1,889 files, 88,458,942 bytes
- `referensi/newgui`: 1,782 files, 69,332,745 bytes
- `referensi/aset-tidak-dipakai`: 4 files, 4,671,794 bytes
- `referensi/sfx-asli`: 96 files, 9,350,108 bytes
- `referensi/newgui/game`: 1,017 files, ~34.7 MB of prototype assets and mock pages
- `referensi/newgui/assets`: 810 files, ~12.4 MB of extracted UI kit components and sample screens

Breakdown by major subtree:

- `referensi/newgui/assets/komponen`: 810 files, 12,469,157 bytes
- `referensi/newgui/game/assets/komponen`: 809 files, 11,216,376 bytes
- `referensi/newgui/assets/penerapan`: 43 files, 21,341,108 bytes
- `referensi/newgui/game/assets/penerapan`: 43 files, 21,341,108 bytes
- `referensi/newgui/game/css`: 21 files, 120,671 bytes
- `referensi/newgui/game/js`: 22 files, 195,317 bytes
- `referensi/newgui/game/*.html`: 20 prototype pages, 512,514 bytes
- root `referensi/*.html` and `*.png`: 7 files, 5,104,295 bytes

## 3. Classification

### A. Production runtime assets in active app

These are the only assets that are clearly safe to move into a permanent runtime root, and only as a focused relocation pass:

- `gameplay.html`
- `gameplay/js/main.js`
- `gameplay/css/hud-mockup.css`
- `assets/ng/komponen/*` (existing permanent UI assets)
- direct image paths referenced by gameplay HUD and menu UI

Static scan found 50 gameplay path references to `referensi/newgui/.../komponen/...` assets, but only 15 of them are already mirrored in `assets/ng/komponen` with identical hashes. The remaining 35 production-referenced assets are still missing in the permanent UI root.

These missing items are mostly HUD/menu/glyph files such as:

- `glyph-putih/apple.webp`
- `glyph-putih/kamera.webp`
- `glyph-putih/petir.webp`
- `glyph-putih/tengkorak.webp`
- `hud/bar-hp-boss.webp`
- `hud/tombol-bulat-kosong-ungu.webp`
- `ikon-item/bom.webp`
- `ikon-item/pedang.webp`
- `menu-pause/ikon-lanjut.webp`
- `menu-pause/tombol-bulat-kosong.webp`

These are the real candidates for a disciplined relocation pass.

### B. Raw UI kit and design archives

These remain archive/design material and are not runtime sources of truth:

- `referensi/newgui/assets/komponen/*`
- `referensi/newgui/game/assets/komponen/*`
- `referensi/newgui/assets/penerapan/*`
- `referensi/newgui/game/assets/penerapan/*`
- `referensi/newgui/game/*.html`
- `referensi/newgui/README.md`
- `referensi/newgui/layout contoh( bukan UI ref ).html`
- `referensi/voxel-fx-lab-refined.html`
- `referensi/fog.html`

These files were authored as mockup/reference assets and are still referenced in docs and prototype code, not by the active app runtime path.

### C. Unused or duplicate assets

Observed duplicate/legacy copies:

- `referensi/newgui/assets/komponen` and `referensi/newgui/game/assets/komponen` are largely identical duplicates, with 807 identical file hashes and zero direct content diffs for the matched components.
- `referensi/aset-tidak-dipakai/*` stores duplicate sheet images already copied into the extracted component sets, especially `CUkbIG.png`, `MrHvLu.png`, and HUD duplicates keyed by `D5j9sH.png` / `X5pZMc.png`.
- `referensi/sfx-asli/*` is a source set for normalization and should not be treated as a runtime asset root; the active runtime is `assets/sfx/` and `assets/new sound/`.

These should be retained as archive material until an explicit consolidation plan is approved.

### D. Design references not suitable for runtime

Examples include:

- `referensi/newgui/assets/penerapan/*` (screenshots/mockup frames)
- `referensi/newgui/game/Mockup_GUI_Ular_Tangga_Blok.html`
- `referensi/fog.html`
- `referensi/voxel-fx-lab-refined.html`
- `referensi/newgui/Audit_Game_Dragon_Roll.pdf`

These are reference or design material and should remain out of runtime asset roots.

## 4. Runtime risk assessment

This was not a safe bulk relocation.

Main reasons:

1. `gameplay.html` and `gameplay/js/main.js` still rely on a reference path pattern: `referensi/newgui/game/assets/komponen/...` for several HUD and menu assets. That is a prototype path, not yet fully canonicalized.
2. `assets/ng/komponen` is already a permanent UI asset root, but it is not a complete 1:1 copy of the reference kit. A bulk move would produce missing references and break the current gameplay UI contract unless every asset is intentionally mapped and validated.
3. The app cache contract is controlled by `assets/preload-manifest.json` and `sw.js`. The manifest matches the current repository tree exactly except for 3 known pre-existing byte mismatches in JS files (`blocky-character.js`, `character-data.js`, `item-catalog.js`). Those were not caused by reference-asset cleanup and should remain out of scope.
4. The reference tree contains a large amount of duplicate inventory, mock assets, source material, and raw design sheets. Moving all of it would create a second source of truth and would fight the project’s original extraction rule of handling only verified runtime assets.

## 5. Safe recommendation

Do not perform a wholesale move of `referensi/` into runtime directories. Instead, keep the archive untouched and do a narrow, explicit move only for the 35 production-referenced UI assets that are missing from `assets/ng/komponen` and are still consumed by `gameplay.html`/`gameplay/js/main.js`.

Recommended staged approach:

1. Freeze the archive directory as the reference source of truth.
2. Create a dedicated runtime copy list for actual gameplay/UI references only.
3. Copy those files to `assets/ng/komponen/...` without deleting the source archive.
4. Update the URL sources in gameplay-only references once the full asset list is validated.
5. Regenerate `assets/preload-manifest.json` and review `sw.js` only after the runtime-only set is migrated.

## 6. Files changed in this audit

Only documentation was changed for the audit, to avoid moving design/reference material without a verified runtime dependency map.

- Added: `audit/5/global-reference-assets-cleanup.md`

## 7. Static validation performed

Static checks completed without running the browser or test suite:

- Inventory scan across all reference/archival folders
- Duplicate and hash comparison across `referensi/newgui` and `assets/ng/komponen`
- Dependency scan for `gameplay.html`, `gameplay/js/main.js`, and `gameplay/css/hud-mockup.css`
- Service-worker and preload-manifest contract review
- Worktree and branch sanity review

Observed results:

- 50 active gameplay/production asset references found in the reference UI kit
- 35 missing from the permanent runtime folder
- 15 already present and identical in `assets/ng/komponen`
- 0 runtime references were found in `assets/preload-manifest.json` pointing into `referensi/`
- `sw.js` was not altered, and the current `VERSION` remains `ut-pwa-v185`

## 8. Conclusion

This phase should remain an audit-only checkpoint rather than a bulk move.

The archive is a large, valid design/reference set, but it is not a safe candidate for mass relocation under the project’s extraction rules. The only safe continuation is a targeted, runtime-only reproduction of the real gameplay/UI asset subset into `assets/ng/komponen`, with the reference archive preserved intact and the cache manifest reviewed only after the replacement set is confirmed.

This preserves the current source of truth, avoids duplicate runtime data, and avoids breaking gameplay before a verified reference map is in place.
