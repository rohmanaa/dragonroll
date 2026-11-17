# Checkpoint 2.2 — Ender Hole & Ender Swap

Branch `restruktur-fx` · baseline `cef4413` · kode `7883f2d`.

## Temuan audit (baseline)
- `enderHole()` (main.js) sudah punya inti hitam, dua cincin, dan titik terhisap, timeline tetap 2,3 dtk (buka 0,7 · tahan · tutup 0,4), tracking Phase 1 (`type:'ender-hole'`, `category:'transition'`), dan cue `eport`. Dua tes Phase 1 mengunci teks kodenya.
- Saat `reduce` aktif, `enderHole` tidak menampilkan apa pun.
- `enderSwapAnim` = hole di kedua pion → hisap 0,7 → tukar → muncul 0,5 → tutup 0,4. Hanya ledakan ender di akhir; tanpa antisipasi, jejak, arrival/recovery.

## Keputusan
`enderHole()` lama **tidak ditulis ulang**. Lapisan `hole-fx` ditumpuk di atasnya, sehingga tes dan perilaku Phase 1 tetap utuh.

## Implementasi
`hole-fx` (fx.js): gelombang kejut saat membuka, glow energi lubang (berdenyut), pusaran voxel terhisap (bidang miring sama dengan cincin lama), cincin kolaps saat menutup, partikel sisa setelah tertutup. Hole opening/energy/vortex/closing/residual semuanya dari satu efek terlacak yang durasinya 2,3 dtk. Dipasang lokal di tiap klien dari cue `eport` yang sama, jadi tidak ada cue tambahan. Saat Reduce Motion, lapisan ini tetap tampil minimal (tanpa rotasi, partikel ~0,4×).

`enderSwapAnim` (hanya penambahan panggilan, tween tidak diubah):
1. Anticipation + energi berkumpul di kedua pion (`tp-gather`, 0,7 dtk, `tint` 0 dan 1).
2. Penyerapan: jejak pion → pusat lubang masing-masing (sisi berlawanan).
3. Pertukaran: jejak silang cL→tujuan P dan cP→tujuan L, ditambah satu `distort` di titik tengah (arah P→L) sebagai transisi spasial.
4. Muncul kembali: `tp-arrive`, `tp-recover` (mengikuti pion), `tp-residual`, satu `sfx.pop()`.

Dua karakter dibedakan dengan palet (violet vs teal), sisi jejak berlawanan, dan skala cincin berbeda, supaya tidak saling menimpa.

## Yang tidak berubah (diuji)
Urutan tween `0,7 / 0,7 / 0,5 / 0,4`; `EH_LIFE=2.3`; `p.pos=b; L.pos=a`; `slotPos` tujuan; jalur `reduce` (dua `teleport`); tidak ada `tweenVisual`/`cancel` di swap; urutan giliran tidak disentuh.

## Pengujian
Tes sumber untuk durasi/mekanisme di atas; `hole-fx` lulus tes lifecycle, seed, kualitas, Reduce Motion; satu cue (`eport`) pada `enderHole`; tes Phase 1 (`gameplay-fx-lifecycle` 13, `gameplay-fx-cue` 26) tetap lulus tanpa diubah.

## Risiko tersisa
- Swap belum dijalankan di browser: bentrokan visual dua karakter hanya dijamin secara konstruksi (palet/sisi/skala), belum dilihat mata.
- `enderSwapAnim` memakai konstanta `reduce` (dibaca saat load, perilaku lama), sedangkan lapisan baru memakai `FX.reduced()` live. Perbedaan ini sudah ada sebelumnya; dicatat, tidak diubah.
- Efek spasial tidak dihentikan paksa saat game over (umurnya ≤ 2,3 dtk dan membersihkan dirinya); reset (`startGame`) dan tab tersembunyi menghentikannya.

## Commit
`7883f2dcbcb8edfeded7c8e9caa67b847d15e584`.
