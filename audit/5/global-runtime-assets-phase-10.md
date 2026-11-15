# Global Restructure — Phase 10: Gameplay UI Runtime Assets

## Baseline and scope

- Branch: `restruktur`
- Baseline HEAD and `origin/restruktur`: `06d6e0d9db0ff45519d491b44cdb06aa7addc955`
- `main` and `origin/main`: `aeb11acf130df4ade4acc9417f01470e40a33dbb`
- Worktree was clean at preflight.
- Scope was limited to Gameplay component image paths that depended on `referensi/newgui`.
- No test suite or browser test was run, as required.

## Inventory correction

The Phase 10 baseline audit described 50 distinct assets: 15 already identical under `assets/ng/komponen` and 35 missing, totaling 112,476 bytes. Rebuilding that set from the baseline source confirmed those figures.

Reviewing the runtime-generated paths in `gameplay/js/main.js` found three additional assets outside that original count:

- `hud/lencana-hex-merah.webp` and `hud/lencana-hex-hijau.webp`, selected dynamically for each turn badge.
- `glyph-putih/kristal-heksagon.webp`, used for the crystal indicator.

All three were missing from the permanent directory and are resolved through the same `GAME_HUD_ASSETS` base. They add 3,208 bytes. Two other dynamically selected assets (`ikon-item/mahkota.webp` and `glyph-putih/speaker-mati.webp`) already existed in the permanent directory and did not need copies.

Therefore the complete relocation is **38 files totaling 115,684 bytes**: the 35 missing assets in the original 50-asset scope plus the three dynamically used assets discovered during the required path audit. The 15 existing assets were reused, not duplicated.

## Relocated asset inventory

Each source was retained under `referensi/`. The matching relative path was copied to `assets/ng/komponen/` without changing the file bytes.

| Source path | Permanent target | Bytes | SHA-256 | Active Gameplay reference |
|---|---|---:|---|---|
| `referensi/newgui/game/assets/komponen/glyph-putih/apple.webp` | `assets/ng/komponen/glyph-putih/apple.webp` | 460 | `468457d80989cffca18cf682a65cf84a2209165ee9ba1a2bf5efd69953b4fbb7` | `gameplay/js/main.js:4986` (`golden_apple`) |
| `referensi/newgui/game/assets/komponen/glyph-putih/bulu.webp` | `assets/ng/komponen/glyph-putih/bulu.webp` | 444 | `5d43225f1c5456668c6e17e9a31bcf5615a2d4a24589227914c8cb07a28ae236` | `gameplay/js/main.js:4983` (`feather`) |
| `referensi/newgui/game/assets/komponen/glyph-putih/info-bulat.webp` | `assets/ng/komponen/glyph-putih/info-bulat.webp` | 356 | `c1e7d2691546583630bd59996c340a2a1e52b2479abd2865e6795dd5dc193a0b` | `gameplay/css/hud-mockup.css:1014` |
| `referensi/newgui/game/assets/komponen/glyph-putih/kamera.webp` | `assets/ng/komponen/glyph-putih/kamera.webp` | 310 | `7b611592991e38da71d11f0197599220b47a0a647f60eb6f80a267e035b5cb70` | `gameplay.html:10` |
| `referensi/newgui/game/assets/komponen/glyph-putih/kepingan-salju.webp` | `assets/ng/komponen/glyph-putih/kepingan-salju.webp` | 550 | `7718a726410ec14360c24df7ab553ef200b5ebcde09af0a46b2f53d95032c304` | `gameplay/js/main.js:4987` (`ice_crystal`) |
| `referensi/newgui/game/assets/komponen/glyph-putih/kotak-chat.webp` | `assets/ng/komponen/glyph-putih/kotak-chat.webp` | 316 | `988a5890a0c5ef6957214a5aea2df1e7b30f4c1703d6758ce994d37254f48b07` | `gameplay.html:26` |
| `referensi/newgui/game/assets/komponen/glyph-putih/kristal-heksagon.webp` | `assets/ng/komponen/glyph-putih/kristal-heksagon.webp` | 748 | `c0511c2d17327cc5c8824777e00a29371a9552acaff302be0b88e85a3c6b0154` | `gameplay/js/main.js:5088` (dynamic crystal icon; audit correction) |
| `referensi/newgui/game/assets/komponen/glyph-putih/lokasi-pin.webp` | `assets/ng/komponen/glyph-putih/lokasi-pin.webp` | 616 | `4f83f15b1fda362683cfb33b56231ff7d700598d404a493cef8c183ce0ba89a1` | `gameplay.html:12` |
| `referensi/newgui/game/assets/komponen/glyph-putih/panah-atas.webp` | `assets/ng/komponen/glyph-putih/panah-atas.webp` | 348 | `b46d9f7bd1d5fa1ab6879683108caa745894285b84645ea1eff325f77f1604dd` | `gameplay/css/hud-mockup.css:1006` |
| `referensi/newgui/game/assets/komponen/glyph-putih/perisai-lambang.webp` | `assets/ng/komponen/glyph-putih/perisai-lambang.webp` | 784 | `4552471c33523637409d75742f783fc9ef84c9eeaadb6bf4ac9ee8da390636d2` | `gameplay/css/hud-mockup.css:1013` |
| `referensi/newgui/game/assets/komponen/glyph-putih/peti-harta.webp` | `assets/ng/komponen/glyph-putih/peti-harta.webp` | 330 | `2043fd7397d715af7273fbe71699a0c190dc987de2d167aa3d6f5af8c6d19d88` | `gameplay/css/hud-mockup.css:1010` |
| `referensi/newgui/game/assets/komponen/glyph-putih/petir.webp` | `assets/ng/komponen/glyph-putih/petir.webp` | 354 | `61de262b49dbacb2b35727f9ba5971651ed6fb8e7e458359c1a9362906b18c9f` | `gameplay/css/hud-mockup.css:1005` |
| `referensi/newgui/game/assets/komponen/glyph-putih/speaker-suara.webp` | `assets/ng/komponen/glyph-putih/speaker-suara.webp` | 686 | `d479ebc77988553c2c7969d193f9bc20d2f7d4751e3565e11e68384a93cb2eb0` | `gameplay.html:17`; `gameplay/js/main.js:5961` |
| `referensi/newgui/game/assets/komponen/glyph-putih/tengkorak.webp` | `assets/ng/komponen/glyph-putih/tengkorak.webp` | 720 | `fee5becd04cfb5a5a840b297d939d0decc92ba6cb31769909f6d100c24d814e6` | `gameplay/css/hud-mockup.css:178, 1009, 1628` |
| `referensi/newgui/game/assets/komponen/glyph-putih/tongkat-ular.webp` | `assets/ng/komponen/glyph-putih/tongkat-ular.webp` | 670 | `6ffaf40f06bbcd9c5c3f940b81ab2e05bb6b059e93e3f77891325f7cff0894fb` | `gameplay/css/hud-mockup.css:1007` |
| `referensi/newgui/game/assets/komponen/glyph-putih/ulang-maju.webp` | `assets/ng/komponen/glyph-putih/ulang-maju.webp` | 524 | `171bd0dd3deac15db92cadee029c96cb641de60e00aac1c5855450d31593f224` | `gameplay/css/hud-mockup.css:1012` |
| `referensi/newgui/game/assets/komponen/glyph-putih/ulang.webp` | `assets/ng/komponen/glyph-putih/ulang.webp` | 540 | `9918962d6384a38618a9e0516245dc561578c39aa5ed9d4aaaec80bfb185b9fc` | `gameplay.html:13` |
| `referensi/newgui/game/assets/komponen/hud/bar-hp-boss.webp` | `assets/ng/komponen/hud/bar-hp-boss.webp` | 11,126 | `b0fe16ee8f53663a482599135727d1dec9408fef1c36be4b4dc2b9b11caed571` | `gameplay/css/hud-mockup.css:1083`; `gameplay/js/main.js:5097` |
| `referensi/newgui/game/assets/komponen/hud/ikon-kado-merah.webp` | `assets/ng/komponen/hud/ikon-kado-merah.webp` | 5,190 | `f0c5ab6f15dd394fe814a0d0ecbfde1e990523ebf54b71319a62899c970eca94` | `gameplay/css/hud-mockup.css:1147` |
| `referensi/newgui/game/assets/komponen/hud/lencana-hex-hijau.webp` | `assets/ng/komponen/hud/lencana-hex-hijau.webp` | 1,188 | `86e3ed281a7de66c4758834469a91fc6194dcae0c9f708a542c990c591fbce07` | `gameplay/js/main.js:5027` (dynamic turn badge; audit correction) |
| `referensi/newgui/game/assets/komponen/hud/lencana-hex-merah.webp` | `assets/ng/komponen/hud/lencana-hex-merah.webp` | 1,272 | `c729fb61148dcdadd30830595ac0a9966496eda757aa5eed8fcf43f4583d9157` | `gameplay/js/main.js:5027` (dynamic turn badge; audit correction) |
| `referensi/newgui/game/assets/komponen/hud/ornamen-sirip-kanan.webp` | `assets/ng/komponen/hud/ornamen-sirip-kanan.webp` | 4,164 | `fd154d93fbc127676372d743320b767e2be22c10754768f0157fbeb475917c53` | `gameplay/css/hud-mockup.css:1423` |
| `referensi/newgui/game/assets/komponen/hud/ornamen-sirip-kiri.webp` | `assets/ng/komponen/hud/ornamen-sirip-kiri.webp` | 4,310 | `82b7e952d01daaf82b974a95eb424975c06e305565b032f53047a506f491042a` | `gameplay/css/hud-mockup.css:1422` |
| `referensi/newgui/game/assets/komponen/hud/tombol-bulat-kosong-ungu.webp` | `assets/ng/komponen/hud/tombol-bulat-kosong-ungu.webp` | 1,636 | `a102158e5b3a702a271d8e5cf02f053366e9240011f560b25453073ec518ccd4` | `gameplay/css/hud-mockup.css:703, 753, 1529` |
| `referensi/newgui/game/assets/komponen/ikon-gem-medali/berlian-ungu.webp` | `assets/ng/komponen/ikon-gem-medali/berlian-ungu.webp` | 9,258 | `153900bd1efd80646ef95e421a921a568d982bc34aaf86a7651f93b2057478ac` | `gameplay/js/main.js:4985` (`ender_pearl`) |
| `referensi/newgui/game/assets/komponen/ikon-gem-medali/gem-heksagon-ungu.webp` | `assets/ng/komponen/ikon-gem-medali/gem-heksagon-ungu.webp` | 7,052 | `89c0f0c25203a3b962b564355ed420db361fc44c623324ee304048caa218c259` | `gameplay/js/main.js:4988` (`dragon_crystal`) |
| `referensi/newgui/game/assets/komponen/ikon-gem-medali/panah-tombak.webp` | `assets/ng/komponen/ikon-gem-medali/panah-tombak.webp` | 16,086 | `2a2bac524c546edb5da18b29b1ca24b6fc2d3c99a05401375a282a0bdd76710d` | `gameplay/js/main.js:4987` (`trident`) |
| `referensi/newgui/game/assets/komponen/ikon-item/bom.webp` | `assets/ng/komponen/ikon-item/bom.webp` | 7,800 | `9b219a355ca7b46c0ae66d0f11f61c93df41d5afff1aaddacc585cf185d41ec8` | `gameplay/js/main.js:4983` (`tnt`) |
| `referensi/newgui/game/assets/komponen/ikon-item/pedang.webp` | `assets/ng/komponen/ikon-item/pedang.webp` | 8,962 | `e1a9965227af92377db7b6f7639748d35cdde8adf422ab78866c0ede690cadb7` | `gameplay/js/main.js:4985` (`diamond_sword`) |
| `referensi/newgui/game/assets/komponen/ikon-item/perisai-kayu.webp` | `assets/ng/komponen/ikon-item/perisai-kayu.webp` | 6,840 | `2f455840f1f099ba573b5f082690bf6d4134b1b11b0a1affe80990b7ff429af2` | `gameplay/js/main.js:4986` (`wooden_shield`) |
| `referensi/newgui/game/assets/komponen/ikon-item/ramuan-hijau.webp` | `assets/ng/komponen/ikon-item/ramuan-hijau.webp` | 7,020 | `6b4fcb1f58e7f117a19fae5d81fa36ba120617b96ac93b29a57e179e516f3dce` | `gameplay/js/main.js:4984` (`potion_odd`) |
| `referensi/newgui/game/assets/komponen/ikon-item/ramuan-ungu.webp` | `assets/ng/komponen/ikon-item/ramuan-ungu.webp` | 8,574 | `0865a8f118de4a58fec99e4b8e48d4b110641691bc578559a16dc55fd301070f` | `gameplay/js/main.js:4984` (`potion_even`) |
| `referensi/newgui/game/assets/komponen/menu-pause/ikon-lanjut.webp` | `assets/ng/komponen/menu-pause/ikon-lanjut.webp` | 254 | `25b8e26cd4fd47a414700c5e6781a4cc24dc8c4bf8b91bad829866915ef3fae2` | `gameplay.html:136`; `gameplay/css/hud-mockup.css:849` |
| `referensi/newgui/game/assets/komponen/menu-pause/ikon-menyerah.webp` | `assets/ng/komponen/menu-pause/ikon-menyerah.webp` | 294 | `a85a1e3a3840e0c9a76317768a30f19c505da13c25d8e370e1e745af06200e27` | `gameplay.html:144`; `gameplay/css/hud-mockup.css:850` |
| `referensi/newgui/game/assets/komponen/menu-pause/ikon-pengaturan.webp` | `assets/ng/komponen/menu-pause/ikon-pengaturan.webp` | 388 | `7420172b0d6fa84e660df82959006999f433ba9301c9056c10afefcee68bfab3` | `gameplay.html:18`; `gameplay/css/hud-mockup.css:851` |
| `referensi/newgui/game/assets/komponen/menu-pause/ikon-ulang.webp` | `assets/ng/komponen/menu-pause/ikon-ulang.webp` | 314 | `e60921efeb6cb14163db5b9a25531eb5a344dede91eb2903bc22e8c8f573a3e8` | `gameplay.html:140` |
| `referensi/newgui/game/assets/komponen/menu-pause/teks-pause-krem.webp` | `assets/ng/komponen/menu-pause/teks-pause-krem.webp` | 1,060 | `be33310391c62a18b6e4c95e0ff99a976422cb95166d382a3ed7332c0bdda10c` | `gameplay/css/hud-mockup.css:813` |
| `referensi/newgui/game/assets/komponen/menu-pause/tombol-bulat-kosong.webp` | `assets/ng/komponen/menu-pause/tombol-bulat-kosong.webp` | 4,140 | `a6d22d4b4db4ccd8c3e59c8cb739fdfb71d9b6a5fba88e481c57cef19755f2ab` | `gameplay/css/hud-mockup.css:831` |

## Existing identical assets reused

The 15 permanent assets from the original 50-asset set were byte-identical to their archived counterparts and were not copied:

- `banner-label/banner-judul-biru-polos.webp`
- `banner-label/banner-judul-ungu-polos.webp`
- `glyph-putih/dadu.webp`
- `glyph-putih/segitiga-kanan.webp`
- `hud/kartu-kosong-ungu.webp`
- `ikon-gem-medali/petir-emas.webp`
- `ikon-item/helm-sayap.webp`
- `ikon-pengaturan/knob-slider.webp`
- `misi/lencana-notifikasi-merah-segi-delapan.webp`
- `panel-dialog/bingkai-dialog.webp`
- `tombol-dan-kontrol/tombol-biru-polos.webp`
- `tombol-dan-kontrol/tombol-hijau-polos.webp`
- `tombol-dan-kontrol/tombol-kuning-polos.webp`
- `tombol-dan-kontrol/tombol-merah-polos.webp`
- `tombol-dan-kontrol/tombol-tutup-bulat.webp`

The 50-asset path mapping preserved each component's relative suffix: `referensi/newgui/game/assets/komponen/<path>` now resolves to `assets/ng/komponen/<path>`. Repeated URL occurrences were updated in place; no visual properties or gameplay logic changed.

## Files changed

- Added 38 image files listed above under `assets/ng/komponen/`.
- Updated 9 path prefixes in `gameplay.html`.
- Updated 48 path prefixes in `gameplay/css/hud-mockup.css`.
- Updated 2 path prefixes in `gameplay/js/main.js`, including the shared runtime asset base used for dynamically generated image URLs.
- Added exactly 38 byte-size entries to `assets/preload-manifest.json`.
- Added this audit report.

No test source was changed. `tests/pet-ui.test.js` still reads a reference-folder image as a test fixture; it is not an active Gameplay URL and was intentionally left unchanged.

## Preload and cache review

- `assets/preload-manifest.json` gained only the 38 new target paths and their exact byte sizes. No existing key was removed or changed.
- The three pre-existing JavaScript size mismatches (`blocky-character.js`, `character-data.js`, and `item-catalog.js`) retain their original manifest values.
- `sw.js` and its `ut-pwa-v185` cache version were not changed. Its media caching behavior is path-agnostic; the new URLs will populate the existing cache on their first request.

## Static verification

- Exactly 38 new files are present; their combined size is 115,684 bytes.
- SHA-256 and byte-for-byte comparisons passed for all 38 source/destination pairs.
- The original 15 permanent assets listed above remain identical to their archived copies.
- All 38 new manifest sizes match the copied files; the manifest diff contains exactly 38 additions and no changes to existing values.
- A static scan of Gameplay HTML, CSS, JS, and runtime-generated HUD paths resolved all 71 distinct `assets/ng/komponen/` asset paths.
- No active source under `gameplay/` retains `referensi/newgui/game/assets/komponen/`.
- The only remaining non-archive source match is the intentional archive fixture in `tests/pet-ui.test.js`.
- The `referensi/` archive has no diff and no source file was deleted.
- `git diff --check` passed. No test suite or browser test was run.

## Git checkpoint

- Required implementation commit: `refactor(assets): relocate active gameplay UI assets`
- Commit hash: recorded after the atomic checkpoint commit.
- Final `HEAD == origin/restruktur`: verified after push.
- Worktree clean after push.
- `main` and `origin/main` remain at `aeb11acf130df4ade4acc9417f01470e40a33dbb`.
