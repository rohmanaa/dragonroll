# World redesign notes (Dragon Roll x playful diorama look)

Scope: **colour, lighting and baked shading only.** No gameplay logic, coordinates, tile numbering,
collision, camera, snakes/ladders, pawns or asset lists were touched. The seeded `rnd()` call order is unchanged,
so world/decor placement is identical to before.

## Files changed (small, targeted)
| File | Change |
|---|---|
| `src/gameplay/js/maps/world.js` | Sky `#4A8FC9/#AFCFE2` -> `#3DA5E8/#BDEBF0` (sky blue to turquoise haze, also tints fog); warmer/lighter tile-column wood+earth; fresher ground; warm grass bounce light (`hemi`); white clouds |
| `src/gameplay/js/main.js` | Island palette (fresh grass, warm earth, natural stone, livelier flowers); `WORLD_GRADE` tile-top colour grade; warm sunlight + sky-tinted fill in `applyLook` (World only); cooler/lighter background mountains for aerial depth |
| `src/gameplay/js/voxel-geom.js` | Baked ambient occlusion: foot of every box side darkened, underside darker. Colour only, no geometry change. Tunable: `UT.GameplayVoxelGeom.AO.foot` / `.under` (set `foot=0` to disable; per box: `{ao:false}`) |
| `src/gameplay/js/biomes.js` | River water turquoise `#35B9DC`; golden start-area sand |
| `sw.js` | `VERSION` ut-pwa-v280 -> v281 so players pick up the new JS |

## Design decisions
- `mcBlock()` colour keys (e.g. `0x5A9E3C`, `0x3F76E4`) are used for decor/water/stone logic, so they are **not** changed.
  Instead `tileShade()` repaints them through `WORLD_GRADE`. Ladder gold, snake pink and goal colours are deliberately kept
  unchanged so special tiles stay instantly readable.
- Lighting stays soft: no bloom, tone-mapping or colour-space switch. Day sun is warm `#FFF1D0` (0.58), fill is sky-tinted (0.74).
  Night values are untouched.
- No new assets were added: existing environment was improved first, as requested.

## Verification
- Rendered in headless Chromium (WebGL): no new console/page errors vs the original.
- Test suite: identical to baseline (20 pass; the 24 failing tests already fail on the unmodified package because this zip is partial, e.g. missing files).
- Before/after: see `before_after.png`.

## Known limits
- Reference site is WebGL; I could not inspect its scene visually, so the look follows the brief's description (palette, soft light, polish), not a pixel match.
- AO is baked/fake (cheap, mobile-safe), not screen-space AO.
- Nether map unchanged (it shares some code paths but its theme data and lighting branches were not touched).

## Texture pack pixel-art (World, Nether, map berikutnya)
- Sumber: `referensi/gameplay/*.jpg` (lembar 3x2 tile). `python3 tools/build-texpack.py` -> `gameplay/assets/maps/world/texpack.webp` (63 tile grayscale 64px) + `texpack.json` (nama -> layer). Urutan nama = id layer: **tambah di akhir, jangan ubah urutan**.
- Hanya DETAIL (terang/gelap). Warna tetap dari palet/vertex/CSS yang sudah ada (`--world-*-tint`). Dimuat sebagai satu texture-array WebGL2 (1 sampler); tanpa WebGL2 otomatis kembali ke tekstur painterly lama.
- Pemetaan: kategori material `MT` (id per vertex via `addBox(..,{tex:MT.X})`) -> tile, per tema di `TEX_PACK_MAP` (main.js). **Map baru = tambah 1 entri tema + tandai bagian dengan MT.** Kategori tanpa entri tetap polos/painterly.
- CSS: `--world-pack` (1/0 saklar), `--world-pack-tex` (kekuatan), `--world-pack-size` (unit dunia per tile). `body.th-world` dan `body.th-nether`.
- Nether baru ditandai: tanah/kolom (netherrack), nylium crimson/warped, soul sand, basalt, magma, batu hangus (blackstone), tiang (nether bricks), bingkai portal. Belum: pulau Nether, jamur, ghast, dll.

