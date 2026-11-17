# Checkpoint 3.2 — Projectile & Impact

Repository `rohmanaa/dragonroll` · branch `restruktur-fx` · baseline `48581419051d3f612d8b78cf4d44945ad21e7951`.

## Temuan audit

- Aksi projectile yang benar-benar ada ialah panah `bowShootDragon` menuju posisi Dragon. Panah visual, tween, dan waktu pelepasannya sudah dimiliki gameplay.
- Creeper memiliki titik ledakan aktual di pawn. FX tidak boleh mengganti tween projectile, collision, atau hasil hit.
- Tidak ada dukungan elemen projectile gameplay untuk ditambahkan sebagai varian.

## Implementasi

- Saat busur ditarik, `weapon-charge` mengikuti anchor busur. Saat dilepas, burst singkat dan `combat-projectile` memvisualisasikan lintasan `s0` ke target.
- Impact muncul setelah tween panah selesai, pada posisi Dragon aktual. Trail berdissipasi dan dibersihkan otomatis.
- Impact menyertakan shockwave/ring voxel, flash lokal ber-alpha maksimal `0.28`, dan debris secukupnya; ledakan Creeper memakai ground-impact.
- Posisi, durasi, dan collision tetap ditentukan kode gameplay yang sudah ada. FX tidak melakukan raycast atau menentukan tabrakan.
- Cue hanya mengirim posisi, durasi, style, `fid`/seed; tidak mengirim partikel. Audio memakai suara existing.

## Lifecycle dan pengujian

Projectile/impact berjalan pada loop `UT.GameplayFX` yang sama, tercatat dalam tracking Phase 1, tunduk pada quality scaling/Reduce Motion, Stop/Stop All, visibility, reset, dan disposal. Uji memverifikasi origin/target, impact setelah tween, cleanup, payload cue ringan, serta tidak ada jalur collision baru.

Lulus pada regression final: 33 tes Spatial FX; Phase 1 core (16), lifecycle (13), cue (26); boss-hit, mob-hit, mob-landing, power-landing, power-rules (17), dan game-core (16). Sintaks JavaScript dan `git diff --check` bersih.

## File dan commit

- `gameplay/js/fx.js`
- `gameplay/js/main.js`
- `tests/gameplay-spatial-fx.test.js`

Commit implementasi: `4f2d60682e5c8c1f38862f3ef5921739cbdcffdc`.

## Regression dan risiko tersisa

Tes terkait lulus; gameplay hit detection, damage, dan turn system tidak disentuh. Belum diverifikasi melalui browser/WebGL atau dua klien live; lintasan lokal diuji melalui harness dan bukan pengukuran FPS/memori di perangkat.
