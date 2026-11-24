# Tambang — dunia 3D (Three.js r128)
Buka `tambang-world.html` (butuh server statis atau file:// biasa; tanpa build).
Semua berkas berawalan `tambang-`; namespace global `TambangMW` dan `TambangRig`; id/kelas DOM berawalan `tambang-`.
- `css/tambang-hud.css`: HUD 1920x1080 (nilai dari referensi/newgui/game: common/page/sub/tambang/bg.css)
- `css/tambang-world.css`: keadaan interaksi drag
- `js/tambang-rig.js`: rig blocky (acuan assets/js/renderers/blocky-character.js), `js/tambang-workers.js`: perilaku pekerja
- `js/tambang-ui.js`: skala/rotasi stage, scroll layer, drag & snap, HUD. Hook: `TambangMW.ui.setCurrency({coin,gem})`, event `tambang:back`, `tambang:home`
- `images/`, `fonts/`: ikon HUD dan font disalin dari repo

## Produksi pasif (dari halaman Tambang repo)
- `js/tambang-data.js`: slot 1..3 = layer 1..3, bentuk data = `mine_get()`. Memakai `UT.MineService` + `PlayerData` bila ada (server = sumber kebenaran); jika tidak, tiruan lokal dengan angka SQL `202611180001_tambang.sql`.
- Panel PRODUKSI (Ambil, Percepat, upgrade Kecepatan/Peti, Buka), saldo asli, `?from=` untuk tombol kembali, `UT.Audio`/getar sesuai settings.
- Pekerja slot produksi: terkunci = diam, bekerja = mengayun beliung (x1,7 saat Percepat), peti penuh = melambai, ambil/buka = melompat + serpihan emerald.

## Tahap 1 (6 tambang, lift, gudang) — semua LOKAL (localStorage `tambang:local`)
- 5 tambang (Mine 1–5) bisa dibuka. Tiap tambang punya campuran ore (Emerald, Emas, Batu Bara, Amethyst, Diamond, Lava); semuanya ORE MENTAH masuk Gudang.
- Bubble di atas pekerja: ⚡ boost tambang itu, panah = buka panel upgrade; tambang terkunci menampilkan gembok. Tombol BOOST SEMUA di bar atas.
- LIFT: terkunci sampai dibuka (koin); upgrade Muatan (ore per angkut) dan Kecepatan. Tambang 2–6 butuh lift untuk Ambil; Tambang 1 tidak.
- Server mine_* (3 slot) tidak dipakai di versi ini; adapter server menunggu RPC 6 slot.

## Tahap 2 (Base Camp, peleburan) — LOKAL
- 6 layer: **Base Camp (layer 0: Gudang (bangunan) + Furnace ×1–3 + area Hutan dalam SATU layer, tanpa tambang) › Mine 1–5**. Lift/pulley di Base Camp.
- `js/tambang-top-layer.js`: builder Base Camp + AI penebang. Bangunan (`userData.bid`) bisa diklik → modal.
- Hutan: 6 pohon, tumbuh lagi ±5 mnt (`D.FOREST.regrowMs`), penebang 1–3 (maks 3), tiap pohon +4 kayu.
- Tungku: ore mentah + bahan bakar (kayu ×2, batu bara ×4) → Emerald / Koin (+25) / Amethyst / Diamond / Inti Lava.
- Gudang: mata uang, ore mentah, pelengkap, bahan bakar. Lift mengangkut hasil Ambil dari Mine 1–5 naik ke Base Camp.

- Perbaikan: modal/dock/toast kini ikut rotasi stage di ponsel potret (sisa `</div>` yang menutup stage lebih awal sudah dihapus).
- Stage 3: Hutan tanpa bangunan — dibuka (penebang pertama 600 Koin) dan dikelola dari modal Gudang. Furnace (ex-Tungku) bisa di-upgrade s.d. 3 unit (3.000 / 9.000 Koin), tiap unit menambah kapasitas lebur 10 ore per aksi. Tambang yang belum dibuka tidak ada pekerjanya.
- Stage 4: dock taruh-objek (peti/pekerja/...), Slot, dan Reset dihapus dari tampilan. Ore Minecraft: Copper, Iron, Coal, Lapis, Gold, Amethyst, Diamond. Emerald & Koin BUKAN ore (hanya mata uang pembelian). Hasil lebur = batangan/permata (belum ada penjualan).
- Stage 5: kereta (cart) & pekerja/penebang/manager hanya muncul setelah tambang/hutan dibuka; tiap kereta didorong pekerja (animasi push), bukan jalan sendiri. Manager per tambang dibeli dengan Emerald (3/5/8/12/20); tanpa manager produksi x0,5. Furnace pertama GRATIS (awalnya belum dibangun).

## Stage 6 — Semua otomatis (lift → Gudang, hutan → Gudang, tukang bakar), Klaim, offline, istirahat

- **Otomatis oleh NPC**: lift mengangkut ore dari tambang ke Gudang tiap ±15 dtk (2 fase: turun ke tambang, naik bawa muatan); penebang mengirim kayu ke Gudang; **tukang bakar** (1 per Furnace) melebur ore memakai kayu/batu bara dari Gudang, hasilnya (batangan/permata) masuk peti Gudang. Tidak ada tombol "Ambil" / "Lebur" manual lagi.
- **Gudang**: kapasitas peti terbatas (Lv1–5: 60→1000). Satu tombol **KLAIM KE INVENTORI** memindahkan isi Gudang ke inventori TANPA batas harian (dihapus atas permintaan). Cadangan bakar 10 kayu + 5 batu bara tidak ikut diklaim. Peti penuh = pengangkutan & penebangan berhenti.
- **Offline**: Gudang tetap bekerja saat halaman ditutup, maks 1 jam (upgrade 2 jam, 3 jam). Saat dibuka lagi muncul toast ringkasan.
- **Istirahat**: semua pekerja kerja 30 mnt lalu istirahat 10 mnt (makan 🍖 lalu tidur 😴, berbaring); jika tambang punya Manager istirahat hanya 5 mnt. Produksi 0 saat istirahat.
- **Manager**: hanya untuk Boost (Percepat & Boost Semua butuh manager di tambang itu) + istirahat lebih singkat. Penalti produksi ×0,5 dihapus.
- Penjualan barang → Koin/Emerald belum ada (ditunda ke fitur inventori). Data masih lokal (`tambang:local`); angka belum diseimbangkan.

## Stage 6b — Hadiah langka (gacha)
Tiap ore yang diangkut lift ke Gudang punya peluang kecil memberi bonus: Koin 6% (maks 5×/hari, 40–100 × (1+0,6×tambang)), Emerald 1,5% (maks 2×/hari, 1–2), Power-up acak dari 17 jenis repo 0,8% (maks 1×/hari). Koin/Emerald langsung ke saldo, power-up disimpan di `L.powers` (`D.powers()`), ikut dihitung saat offline. Konstanta: `D.DROP` di tambang-data.js. Reset harian jam 00.00 WIB.

## Stage 6c — Penyeimbangan (kurang kapitalis)
Produksi ×4 (0,8–7,2 ore/jam), buka tambang 500/2.000/6.000/15.000/40.000 Koin, Manager 1/2/3/5/8 Emerald, Boost maks 4×/hari, offline dasar 2 jam (upgrade 3 jam, 3.000 Koin), klaim Gudang tanpa batas harian. `D.sellBag()` + `D.PRICE` disiapkan untuk fitur inventori (jual hasil lebur → Koin); belum ada tombolnya di UI tambang.

## Stage 7 — Inventori & jual
Tombol 🎒 INVENTORI (Base Camp) membuka daftar isi inventori hasil klaim. Jual per barang atau JUAL SEMUA. Harga: Batang Copper 20, Iron 30, Lapis 80, Emas 120 Koin; Amethyst 150, Diamond 400 Koin (sementara semua dibayar Koin); ore mentah 5–60 Koin, batu bara 3, kayu 1. Power-up hanya ditampilkan (belum bisa dijual). Tabel harga: `D.SELL`. Tambang dibuka berurutan (Tambang N butuh N-1 terbuka).

## Stage 7b — Lift terbuka
Lift terbuka sejak awal (tanpa biaya buka); yang di-upgrade hanya Muatan dan Kecepatan. Ikon jumlah ore di kartu tambang/lift memakai kristal, bukan Emerald.

## Stage 7c — Permata & lift mandiri
Lapis, Amethyst, Diamond TIDAK dilebur: langsung masuk Gudang sebagai barang (kolom "Permata"); resep furnace hanya Copper, Iron, Emas. Lift tidak lagi mengikuti layer yang dilihat: hanya bergerak saat tugas angkut otomatis, lalu parkir di permukaan. Modal Lift bisa dibuka dari Base Camp.

## Stage 7d — Navigasi berurutan
Layer hanya bisa dicapai sampai tambang terkunci pertama (tile/tombol turun/scroll/geser/keyboard). Tile yang belum bisa dicapai diredupkan.

### Stage 7e — Tombol FURNACE & urutan baris bawah
- Tombol baru 🔥 FURNACE (membuka modal Furnace). Urutan di Base Camp: LIFT · FURNACE · HUTAN · BOOST SEMUA (tengah) · GUDANG · INVENTORI · UPGRADE. Di tambang: LIFT · PRODUKSI · BOOST · GUDANG.

### Stage 8 — SQL Supabase
- `supabase/migrations/202611490001_tambang_world.sql`: tabel `tambang_player`, `tambang_mine`, `tambang_event` (RLS + revoke), konfigurasi ekonomi `_tb_cfg()`, dan RPC: `tambang_get/unlock/upgrade/manager/boost/lift_upgrade/gudang_upgrade/hire/sweep/work/claim/sell/sell_all`.
- Terapkan SETELAH `202611110001_wallet_b1.sql`. Koin/Emerald lewat `_wallet_apply` (ledger anti-dobel). Klien tidak pernah mengirim nominal.
- Sudah diuji di Postgres 16 lokal (stub auth). Klien (`tambang-data.js`) BELUM disambung ke RPC ini; masih mode lokal.
