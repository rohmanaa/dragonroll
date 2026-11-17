# Checkpoint 3.3 — Damage & Hit Feedback

Repository `rohmanaa/dragonroll` · branch `restruktur-fx` · baseline `48581419051d3f612d8b78cf4d44945ad21e7951`.

## Temuan audit

- Hit pawn yang sudah diputuskan gameplay menggunakan `hitBlastFx`; Dragon memiliki feedback damage dan angka yang sudah ada di `bossHitFx`.
- Tidak ada HP/damage number umum untuk pawn. Tidak ada dasar untuk menampilkan angka damage baru.
- CSS hit flash sebelumnya memakai alpha `0.45`; vignette Dragon juga melebihi batas brief `0.28`.

## Implementasi

- `hitBlastFx` memunculkan impact lokal di posisi pawn aktual, di samping reaksi/knockback gameplay yang sudah ada.
- Cue `hitfx` membawa `fid` dan seed; penerima merender lokal melalui `UT.GameplayFX`, tidak mengirim particle mentah.
- Screen flash dan lapisan full-screen terkait dibatasi maksimal alpha `0.28`. Label lokal tetap bukan angka damage.
- Angka damage Dragon yang sudah ada tetap menampilkan nilai dari gameplay; tidak ada angka palsu atau perubahan formula/damage.
- Hit berat/ground memakai bentuk impact lebih kuat. Critical style tersedia sebagai visual primitive tetapi tidak dipicu tanpa hasil critical gameplay.

## Lifecycle dan pengujian

Hit feedback menggunakan lifecycle, quality scaling, Reduce Motion, dedup/seed cue, Stop/Stop All, visibility cleanup, dan disposal Phase 1. Tidak ada timer atau loop animasi baru.

Lulus: 33 tes Spatial FX; Phase 1 core (16), lifecycle (13), cue (26); boss-hit, mob-hit, mob-landing, power-landing, power-rules, dan game-core (16). Tes CSS memastikan alpha flash `<=0.28`; source regression memastikan angka Dragon tetap berasal dari nilai aktual.

## File dan commit

- `gameplay/css/gameplay.css`
- `gameplay/js/main.js`
- `tests/gameplay-boss-hit.test.js`
- `tests/gameplay-spatial-fx.test.js`

Commit implementasi: `171ab919b372e39c84b19bbb3d77396236f0e8fe`.

## Regression dan risiko tersisa

Regression gameplay terkait lulus; tidak ada stun, skip turn, damage, atau status gameplay baru. Belum ada uji visual browser/WebGL. Sistem tidak menyediakan damage number pawn, critical-hit outcome, atau HP pawn; fitur-fitur itu sengaja tidak direka.
