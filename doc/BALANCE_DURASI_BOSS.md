# Balance: durasi match & aturan menang (DITUNDA)

Status: **ditunda** (keputusan desain belum diambil). Catatan ini merangkum temuan simulasi supaya bisa dilanjutkan nanti.

## Cara menjalankan
- `node game/tools/sim/balance.js` : sampai petak akhir saja (aturan inti, `game-core.js`). Tambah `--check` untuk guard CI.
- `node game/tools/sim/boss-balance.js` : match penuh (papan -> 6 Crystal -> HP boss).

## Temuan 1: papan saja (sampai petak 100/120)
| Papan | Pemain | Median lemparan | p10-p90 | Keunggulan kursi 1 |
|---|---|---|---|---|
| World | 2 | 70 | 41-128 | +1,2 pp |
| World | 3 | 90 | 55-151 | +0,9 pp |
| World | 4 | 109 | 69-173 | +0,2 pp |
| Nether | 2 | 66 | 41-107 | +1,1 pp |
| Nether | 4 | 107 | 71-157 | +1,4 pp |

- Adil antar kursi. Ekor panjang (p90 hampir 2x median) karena pantul di petak akhir dan 3x angka 6 hangus.
- World agak menghukum: ular rata-rata 7,9 per match vs tangga 3,5 (2 pemain); total turunan ular 135 petak vs naikan tangga 118.

## Temuan 2: match penuh dengan fase boss
Aturan di `gameplay.html`: sampai GOAL -> Awakening -> hancurkan 6 Crystal (Crystal n hanya hancur bila melempar n) -> serang boss, damage = dadu x 5 (`DMG`), HP 100 (Dragon) / 120 (Wither) per pemain.

| Papan, pemain | Acak (median total lemparan) | Special Dice diarahkan |
|---|---|---|
| World, 2 pemain | 114 (p90 174) | 92 (p90 149) |
| World, 4 pemain | 198 (p90 268) | 154 (p90 218) |
| Nether, 2 pemain | 112 | 87 |
| Nether, 4 pemain | 197 | 152 |

- Fase boss = 22-44% dari seluruh match.
- Perkiraan waktu (5-8 dtk/giliran, belum diukur): 2 pemain ~8-15 menit, 4 pemain ~13-26 menit. Target umum game sejenis: 5-10 menit.
- Penyebab utama: Crystal butuh angka tepat (acak ~15 lemparan untuk 6 Crystal; diarahkan 6) dan HP boss per pemain (jumlah dadu >= 20: ~6 serangan acak, 4 diarahkan).

## Opsi memendekkan (belum dipilih)
1. Crystal hancur oleh angka berapa pun, atau jumlahnya 3-4 (dampak terbesar).
2. HP boss diturunkan (mis. 100 -> 60-70).
3. Papan diperpendek: tambah tangga / kurangi ular di World.

## Opsi aturan menang (belum dipilih)
- **A. Balapan per pemain (sekarang):** sederhana tapi paling panjang dan yang unggul duluan cenderung terus unggul.
- **B. HP boss bersama:** semua menyerang boss yang sama; menang = damage terbanyak (atau pukulan terakhir). Lebih pendek, peluang menyalip lebih besar.
- **C. Skor ala GetRich:** poin dari tangga, Crystal, damage, peti, mob; match berakhir saat boss mati atau putaran habis. Durasi pasti, butuh sistem skor baru.
- Saran awal: gabungan B + C ringan (boss bersama, menang dari damage terbanyak, batas putaran sebagai cadangan).

## Batasan simulasi
Mob, peti, power, totem belum dimodelkan. Asumsi di `boss-balance.js`: balapan HP per pemain, angka 6 tanpa giliran tambahan di fase boss, bidikan sempurna untuk mode "diarahkan". Waktu per giliran perlu diukur di perangkat nyata.

## Langkah lanjutan saat dilanjutkan
Tentukan target durasi (menit untuk 2 dan 4 pemain) dan pilih aturan menang, lalu uji kombinasinya di simulasi sebelum mengubah `gameplay.html`.
