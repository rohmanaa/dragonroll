# Dragon Roll — Referensi Visual ↔ Audit Teknis

Simpan sebagai: `audit/4/02-referensi-visual-vs-teknis.md`
Melengkapi: `01-audit-fx-core-standard.md`

**Aturan pemakaian bersama**
- **Visual** (apa yang terlihat, warna, urutan, angka) → dua file mockup.
- **Teknis** (bagaimana dibangun di game tanpa merusak arsitektur) → audit 01 + kode repo.
- Jika bertentangan: gameplay & arsitektur repo menang; mockup menang untuk tampilan.

**Batas verifikasi:** kedua mockup dibaca dari kode. Belum dibuka di browser, jadi kesan gerak/FPS belum dinilai.

## 1. Peran tiap referensi

| File | Isi | Peran |
|---|---|---|
| `dragon_roll_rpg_fx_mockup.html` | Galeri statis CSS, 12 kartu kategori, palet aksen per kategori | **Arah visual & palet** |
| `dragon-roll-fx.html` (FX Lab) | Prototipe Canvas 2D, 29 efek, 7 fase animasi, L1–L4, reduce-motion, stop/cleanup | **Prototipe perilaku & angka** |

Keduanya bukan kode produksi: game memakai Three.js (3D) + DOM `ParticleFX`. Yang dipindahkan adalah **konsep, timeline, jumlah, dan warna**, bukan kodenya.

## 2. FX Lab sudah memuat sebagian besar Core FX Standard

| Usulan audit 01 | Sudah ada di FX Lab | Cara dipetakan ke game |
|---|---|---|
| Lifecycle `play/update/stop/dispose` + `stopAll` | `play(id)` → `stopAll()`; token `gen` membatalkan semua timer lama | `FX.track()` + `FX.stopAll()` di `UT.GameplayFX`; menyelesaikan F1/F2 |
| Quality global | `QM=[.4,.8,1.3,2]`, batas partikel `QMAX=[260,520,900,1500]`, fungsi `N(n)` | `FX.n(base)` + batas aktif; menyelesaikan F4 |
| Reduce-motion | `S.reduce` → partikel ×0,4, shake dimatikan, flash jadi border statis | `FX.reduced()` live (F7) |
| Aman-gagal | `safe()` membungkus semua efek | pola `try/catch` yang sudah dipakai `ParticleFX` |
| Hentikan saat tab tersembunyi | `visibilitychange → stopAll()` | tambahkan ke lifecycle |
| 7 fase | `PH` + chip fase | konstanta fase untuk log/debug, bukan wajib per efek |
| Flash aman | satu flash lembut, alfa maks 0,28 | cocok dengan §9 aksesibilitas |
| Penghitung debug | `partikel · layer · timer` | berguna untuk audit memori (Tahap 5) |

## 3. Hal yang perlu diputuskan (konflik antar dokumen)

**K1 — Dua sumbu kualitas tercampur.** Standar membedakan *level item* L1–L4 (kompleksitas visual item, §4) dari *kualitas perangkat* Low–Ultra (§8). FX Lab memakai satu `S.q` untuk keduanya. Usulan: dua sumbu terpisah, jumlah partikel = `dasar × tier item × skala perangkat`, lalu dibatasi `QMAX`. Tier item dibaca dari `data/` (katalog), skala perangkat dari heuristik `dice-throw.js`.

**K2 — Durasi teleport swap.** Tiga angka berbeda:

| Sumber | Durasi |
|---|---|
| Target standar (§2) | 0,9–1,6 dtk |
| FX Lab `swap` | ±1,85 dtk (Dissolve di 1850 ms) |
| Game sekarang (`enderSwapAnim`) | 2,3 dtk, ditulis "TETAP" di kode |

Perlu satu keputusan sebelum Tahap 2. Catatan: durasi game menentukan jeda giliran, jadi memendekkannya mengubah ritme permainan (bukan aturan).

**K3 — Audio.** FX Lab memakai audio sintetis; standar mengutamakan audio asli. Di game tetap pakai `UT.GameplayAudio` (file dulu, beep sebagai cadangan).

**K4 — Intensitas glow.** Mockup CSS cukup banyak glow/emoji; standar §1 meminta tidak berlebihan dan tidak menutupi pion/papan. Gunakan mockup untuk **warna & komposisi**, kurangi bloom di game.

## 4. Palet aksen dari mockup (per kategori)

Teleport/Ender `#b56aff` · Combat `#ff5148` · Hit `#ff665b` · Buff/Aura `#ffc95b` · Elemental `#54c9ff` · Summon `#b56aff` · Reward `#ffc85a` · Biome `#ff8a3d` · Dice `#55bdff` · Pet `#ff70d4` · Victory `#ffc85a` · Defeat `#9b5bff`
Elemen (FX Lab): fire `#f97316` · ice `#67e8f9` · lightning `#facc15` · poison `#4ade80` · wind `#6ee7b7` · earth `#a16207` · dark `#7c3aed` · light `#fde68a` · ender `#a855f7`

Palet Ender di game (`fx.js`): ungu `#DD66FF/#B84DFF`, hitam `#241C30/#15121C` — sudah selaras dengan keluarga ungu mockup.

## 5. Cakupan efek: Lab vs game sekarang

| Kategori | FX Lab (29 efek) | Di game sekarang | Tahap |
|---|---|---|---|
| A Teleport | swap, pearl | lubang hitam + swap (sudah); **lemparan pearl (proyektil/arc) tidak ada** di `enderSwapAnim` | 2 |
| B Combat | slash, crit | panah/serangan mob ada; trail/crit khusus belum | 3 |
| C Hit | ringan/sedang/berat + stun | satu `hf-shake` tetap (F8) | 3 |
| D Aura/Buff | aura, shield, buff | `aura-fx.js` (sudah pooling), shield belum diverifikasi | 3 |
| E Elemental | 9 elemen | ledakan api & ender saja | 3 |
| F Summon/Pet | mob, pet, despawn | pet viewer ada; efek spawn belum | 4 |
| G Reward | coins, emerald | confetti + sparkle peti | 4 |
| H World | lava, hujan, salju, ambient, boss | salju/ember tema, boss entrance ada sebagian | 4 |
| I UI | dice, tile, turn, level up, victory, defeat, quest | dice-kit, level-up, firework sudah ada | 4 |

(Kolom "di game" berdasar audit 01; tidak semua modul dibaca baris per baris.)

## 6. Dampak pada rencana checkpoint

- **1.1** gunakan `QM/QMAX/N()` dan `safe()` dari FX Lab sebagai spesifikasi angka awal (diuji di game, bukan disalin).
- **1.2** adopsi pola `gen` (token pembatalan) untuk lifecycle Three.js, termasuk `enderHole` dan `sparkle`.
- **2.x** Ender Pearl: tambahkan fase proyektil hanya jika K2 sudah diputuskan; posisi swap tetap lewat `slotPos` dan callback `await` yang ada.
- Setiap efek baru dibandingkan dengan padanannya di FX Lab (fase, warna, jumlah) lalu diuji di game.
