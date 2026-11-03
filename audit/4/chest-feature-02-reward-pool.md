FEATURE: Chest Feature 2 — Reward Pool

Baseline:
414fed4 (main)

STATUS KESELURUHAN: BELUM SELESAI — menunggu uji manual di game asli (lihat "Gameplay Regression").

Metode verifikasi:
- Harness sementara (Node + vm, TIDAK ikut di-commit) yang mengekstrak kode asli dari game/gameplay.html (CHEST_POOL, resolveChestReward, applyChestReward, giveChest, dan baris dadu asli dari doRoll + ekor playTurn) dan menjalankannya bersama PlayerData asli (assets/js/player-data.js + item-catalog.js, storage di-stub). Hanya render/SFX/gerak pawn yang di-stub.
- 36/36 cek lolos pada run final.
- Game 3D asli TIDAK dijalankan oleh Claude (Three.js CDN diblokir di lingkungannya). Tidak ada hasil uji manual di game asli yang tercatat untuk Feature 2.

Reward Pool:
PASS (bobot per-mil, total 1000 = 100%; sesuai spesifikasi; tidak ada Power; batas bucket diuji)

Weighted Random:
PASS (resolveChestReward memilih berdasarkan bobot kumulatif, bukan random polos)

XP Minimal:
PASS (PlayerData.xp, default 0, ikut grant({xp}), tersimpan di storage; tanpa level, tanpa UI, profil/lobby MOCK tidak diubah)

Coin:
PASS (PlayerData.grant({coins:5}); CPU tidak menerima)

Gems/Emerald:
PASS (PlayerData.grant({gems:1}); memakai gems existing, tanpa field emerald)

Empty:
PASS (tidak ada perubahan state; feedback "Kosong" tetap tampil)

Surprise:
PASS pada level logika (target selalu 1-99, selisih <= 3, maju = walk, mundur = fly, tidak memanggil ular/tangga/Chest/mob/event).
Gerakan pawn visual: BELUM DIUJI di game asli.

Odd Dice:
PASS (3000 roll: hanya 1/3/5; flag reset setelah satu roll; roll berikutnya normal)

Even Dice:
PASS (3000 roll: hanya 2/4/6; flag reset; roll berikutnya normal)

Lucky 6:
PASS (3000 roll: selalu 6; flag reset; roll berikutnya normal)

Add Roll:
PASS pada level logika (p.extra = true; hasil dadu normal tetap berlaku; tepat satu roll tambahan lalu giliran normal).
Alur giliran penuh di game asli: BELUM DIUJI.

Power Excluded:
PASS (tidak ada referensi Power di kode reward Chest; definisi usePU, startPU, PUN identik dengan baseline 414fed4)

Reward Once:
PASS (2000 landing: 1 resolusi + 1 penerapan per lifecycle; PlayerData.grant tepat 1x per reward currency/XP; double trigger ditolak; token sama ditolak; reset game di tengah lifecycle = tanpa reward)

10K Distribution:
PASS (10.000 resolusi, 0 invalid, 0 Power, total 10.000)

Run A — Math.random default (chi2 df=8 = 5.96):
| reward | count | percentage | target |
|---|---:|---:|---:|
| empty | 971 | 9.71% | 10% |
| coin | 2252 | 22.52% | 22% |
| xp | 1280 | 12.80% | 13% |
| surprise | 1022 | 10.22% | 10% |
| odd | 1506 | 15.06% | 15% |
| even | 1442 | 14.42% | 15% |
| lucky | 718 | 7.18% | 7% |
| gem | 47 | 0.47% | 0.5% |
| addroll | 762 | 7.62% | 7.5% |

Run B — seeded mulberry32 20261103 (chi2 df=8 = 4.72):
| reward | count | percentage | target |
|---|---:|---:|---:|
| empty | 1035 | 10.35% | 10% |
| coin | 2167 | 21.67% | 22% |
| xp | 1254 | 12.54% | 13% |
| surprise | 1013 | 10.13% | 10% |
| odd | 1523 | 15.23% | 15% |
| even | 1498 | 14.98% | 15% |
| lucky | 720 | 7.20% | 7% |
| gem | 52 | 0.52% | 0.5% |
| addroll | 738 | 7.38% | 7.5% |

Gameplay Regression:
BELUM DIVERIFIKASI di game asli. Belum diuji: turn/dice/movement normal setelah reward, Snake/Ladder normal, tampilan banner feedback, gerakan Surprise, chip buff (ganjil/genap/dadu 6), Chest guard di game nyata. Sesuai aturan, tidak ditulis PASS.

Keputusan implementasi (untuk review):
- Teks feedback memakai bahasa game: "+5 Coin", "+10 XP", "Lucky 6!", "Dadu Ganjil berikutnya", "Dadu Genap berikutnya", "+1 Emerald", "Roll Tambahan!", "Kosong", "Surprise! Maju/Mundur N langkah".
- Flag dadu Chest = p.cd ('odd' | 'even' | 'lucky'), dipakai di doRoll setelah p.p4. Bila Potion (p.p4) dan flag Chest aktif bersamaan, Potion dipakai di roll pertama, flag Chest di roll berikutnya.
- Reward Coin/XP/Emerald hanya untuk pemain manusia (!p.cpu), sama seperti hadiah Dragon. CPU tetap menerima reward gameplay (dadu, Add Roll, Surprise).
- Surprise tidak memicu ulang event di petak tujuan (sesuai spesifikasi), jadi pemain bisa berdiri di kepala ular/kaki tangga sampai giliran berikutnya.
- Penambahan chip buff (ganjil/genap/dadu 6) hanya menambah teks pada baris buff existing, bukan UI baru.

File yang diubah:
- game/gameplay.html
- game/assets/js/player-data.js (field xp minimal)
- audit/4/chest-feature-02-reward-pool.md

Commit / Push:
Branch kerja stage4-chest-feature-02-reward-pool. main TIDAK diubah (tetap 414fed4). Hasil verifikasi HEAD dilaporkan di chat.

LOCAL HEAD == REMOTE HEAD:
Tidak berlaku untuk main (tidak disentuh); diverifikasi untuk branch kerja di chat.

WORKTREE:
Diverifikasi di chat.
