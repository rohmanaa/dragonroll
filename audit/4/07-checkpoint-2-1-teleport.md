# Checkpoint 2.1 — Teleport FX

Branch `restruktur-fx` · baseline `cef4413` (akhir Phase 1) · kode `7883f2d`.

## Temuan audit (baseline)
- `teleport()` hanya memanggil `spawnExplosion`/`spawnConfetti` di kedua ujung dan men-tween skala pion 0,3 dtk kecil + 0,3 dtk besar. Tidak ada antisipasi, energi berkumpul, jejak, arrival, recovery, atau energi sisa.
- `teleport(p,to,true)` dipakai TNT (dorongan ledakan). Itu identitas api, bukan efek spasial.
- Posisi tujuan = `slotPos(p.idx,to)`; `p.pos` diisi pemanggil. Dua hal ini tidak disentuh.

## Implementasi
Semua visual di `UT.GameplayFX.spatial(kind, opts)` (`gameplay/js/fx.js`), bukan engine baru: partikel memakai `CONF_GEO` + materi bersama, dihitung ke batas kualitas yang sama.

| Fase | kind | Karakter visual |
|---|---|---|
| Antisipasi + energi berkumpul | `tp-gather` | cincin tanah menyempit + serpihan voxel mengalir ke pion (mengikuti pion) selama pion mengecil |
| Departure burst | `tp-depart` | pilar percik **naik**, cincin kolom naik, fragmen energi besar |
| Disappearance | (tween lama 0,3 dtk) | tidak diubah |
| Teleport trail | `tp-trail` | serpihan mengalir dari titik asal ke tujuan, busur ringan |
| Arrival burst | `tp-arrive` | cincin lebar **melebar**, serpihan **turun** lalu menyembur ke samping |
| Recovery | `tp-recover` | percik spiral naik di sekitar pion (mengikuti pion) |
| Residual | `tp-residual` | glow tanah redup + percik berkedip, di titik asal dan tujuan |

Departure (vertikal, naik, menyempit) dan Arrival (horizontal, turun, melebar) sengaja berbeda bentuk dan warna (magenta vs pucat).

Penyambungan di `main.js` (`teleport`): efek dipasang di sekitar tween yang ada; durasi, posisi, dan `p.pos` tidak berubah. `fire===true` (TNT) tidak memakai Spatial FX. Suara: `sfx.enderman()` saat departure, `sfx.pop()` 140 ms setelah arrival (timer terlacak), maksimal satu suara spasial per 250 ms. Aset audio yang sudah ada; tidak ada engine/aset baru.

## Integrasi lifecycle
Tiap efek = satu entri `track()` (`category:'spatial'`, `scope:'visual'`, `fid/seed/source` bila ada). `stop`, `stopAll` (scope `visual` atau `spatial`), visibility-hidden, dan `dispose()` membersihkan mesh, materi milik efek, dan grup partikel. Selesai alami → `untrack` dengan alasan `completed`. Tidak ada timer atau listener baru di modul. Seed: partikel ke-i memakai `rng(seed, ns*1000+i)`.

## Pengujian
`tests/gameplay-spatial-fx.test.js` (25 tes, stub THREE): semua kind terlacak dan bersih; stop/stopAll/dispose/visibility; seed sama → identik, seed beda → beda, `Math.random` tidak dipakai saat berseed; partikel ke-i sama lintas kualitas; batas Low 120/Medium 220/High 320/Ultra 450 (puncak diukur); tier L1<L2<L3<L4; Reduce Motion; opacity ≤ 0,9; follow pion; follow yang melempar error; durasi `teleport` 0,3+0,3 dan TNT tanpa Spatial FX (uji sumber).
Tambahan: dijalankan terhadap THREE r128 asli milik repo secara headless (tanpa renderer): tidak ada NaN/error, bersih setelah selesai, stopAll, dan dispose.

## Risiko tersisa
- Belum diuji di browser/WebGL, belum diukur FPS/memori di HP. "Mobile" hanya disimulasikan lewat tingkat kualitas Low/Medium.
- Jumlah partikel dan ukuran voxel adalah titik awal; perlu penyetelan visual oleh manusia.
- Teleport tile biasa (`teleport(p,to)`) sekarang bersuara `enderman`; bila terasa terlalu ramai, ubah di `teleport()`.

## Commit
Implementasi gabungan 2.1–2.3: `7883f2dcbcb8edfeded7c8e9caa67b847d15e584` (lihat `PHASE-2-SPATIAL-FX.md` untuk alasan satu commit).
