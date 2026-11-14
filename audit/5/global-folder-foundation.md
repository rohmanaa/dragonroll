# Dragon Roll — Global Folder Foundation

Status: foundation dokumentasi untuk migrasi folder global. Dokumen ini memetakan lokasi lama, lokasi target, alasan, dependensi, dan risiko tanpa melakukan perubahan kode yang tidak aman.

## 1. Prinsip fondasi

Prinsip yang dipakai:

- Jangan menyalin source of truth ke dua lokasi sekaligus.
- Jangan memindahkan file yang kontraknya sudah dijamin oleh runtime browser.
- Pastikan setiap file memiliki satu pemilik domain utama.
- Saat folder target sudah ada dan valid, gunakan alias/wrapper yang aman, bukan kopian penuh.

## 2. Target folder yang dipertahankan

### 2.1 Global core

| Old path | New path | Alasan | Dependensi | Risiko |
|---|---|---|---|---|
| `assets/js/session.js` | `assets/js/core/session.js` (atau alias) | state sesi global | `prefs`, `boot-guard` | sedang |
| `assets/js/app.js` | `assets/js/core/app.js` | bootstrap aplikasi | `PlayerData`, `WalletService` | sedang |
| `assets/js/prefs.js` | `assets/js/core/prefs.js` | preference umum | UI + settings | sedang |
| `assets/js/prefs-sync.js` | `assets/js/core/prefs-sync.js` | sinkron preferensi | `localStorage` | sedang |
| `assets/js/live-sync.js` | `assets/js/core/live-sync.js` | sinkron state lintas page | `storage` event | sedang |
| `sw.js` | `sw.js` (tetap di root) | cache PWA dan service worker | `preload-manifest.json` | tinggi |

### 2.2 Service and state

| Old path | New path | Alasan | Dependensi | Risiko |
|---|---|---|---|---|
| `assets/js/player-data.js` | `assets/js/services/player-data.js` | single source of truth pemain | inventory, wallet, appearance | tinggi |
| `assets/js/wallet-service.js` | `assets/js/services/wallet-service.js` | operasi saldo / server | `PlayerData`, RPC server | tinggi |
| `assets/js/appearance-service.js` | `assets/js/services/appearance-service.js` | data look / outfit | `PlayerData` | sedang |
| `assets/js/mail-service.js` | `assets/js/services/mail-service.js` | mail & reward flow | wallet + server | sedang |
| `assets/js/mine-service.js` | `assets/js/services/mine-service.js` | mining gameplay | state + UI | sedang |
| `assets/js/ads-service.js` | `assets/js/services/ads-service.js` | ad / reward flow | UI | rendah |

### 2.3 Shared components and renderers

| Old path | New path | Alasan | Dependensi | Risiko |
|---|---|---|---|---|
| `assets/js/blocky-character.js` | `assets/js/renderers/blocky-character.js` | visual karakter voxel | `character-data` | sedang |
| `assets/js/character-view.js` | `assets/js/renderers/character-view.js` | view character | `blocky-character` | sedang |
| `assets/js/dice-kit/*` | `assets/js/renderers/dice-kit/*` | visual dadu | `DiceCatalog`, `three` | sedang |
| `assets/js/power3d/*` | `assets/js/renderers/power3d/*` | visual power-up 3D | `PowerCatalog` | sedang |
| `assets/js/aura-fx.js` | `assets/js/renderers/aura-fx.js` | efek aura | visual game | sedang |
| `assets/js/frame-fx.js` | `assets/js/renderers/frame-fx.js` | efek frame | UI / data frame | sedang |

### 2.4 UI shared

| Old path | New path | Alasan | Dependensi | Risiko |
|---|---|---|---|---|
| `hud/ui-core.js` | `hud/ui-core.js` (dipertahankan) | kerangka UI global | widget components | rendah |
| `hud/components/*` | `hud/components/*` | reusable widget | theme + DOM | rendah |
| `hud/theme/*` | `hud/theme/*` | tema shared | CSS + components | rendah |

### 2.5 Data registries and manifests

| Old path | New path | Alasan | Dependensi | Risiko |
|---|---|---|---|---|
| `assets/js/item-catalog.js` | `assets/js/services/item-catalog.js` atau alias | catalog utama data item | `data/inventory/*` | tinggi |
| `assets/js/item-registry.js` | `assets/js/core/item-registry.js` | validasi manifest item | `data/inventory/*` | sedang |
| `data/inventory/*/manifest.js` | `data/inventory/*/manifest.js` | source data item per item | `ItemCatalog` | sedang |
| `data/power/power-fx.js` | `data/power/power-fx.js` | efek power visual | `PowerCatalog` | sedang |

### 2.6 Page-specific and HTML wrappers

| Old path | New path | Alasan | Dependensi | Risiko |
|---|---|---|---|---|
| `assets/js/pages/*.js` | `pages/<page>/index.js` atau alias | page bootstrap | DOM root | tinggi |
| `assets/css/pages/*.css` | `pages/<page>/styles.css` atau alias | style spesifik halaman | HTML page | tinggi |
| root `*.html` | `pages/<page>/index.html` | target ideal struktur | nav, cache, seeding | tinggi |

## 3. Mapping yang paling aman

### 3.1 Tidak dipindahkan dulu

Item berikut sudah punya kontrak runtime yang terlalu sensitif untuk dipindahkan dulu:

- halaman root HTML
- `gameplay/` dan `gameplay.html`
- `sw.js` + `preload-manifest.json`
- `assets/js/player-data.js`
- `assets/js/item-catalog.js`
- file vendor `three` dan module visual di `assets/js/vendor/`

### 3.2 Dapat dipindah bertahap

| Kategori | Lokasi target yang aman |
|---|---|
| CSS shared | `assets/css/base`, `assets/css/components`, `assets/css/layout`, `assets/css/themes`, `assets/css/utilities` |
| UI components | `hud/components` |
| Data registry | `data/inventory/.../manifest.js` |
| Renderer | `assets/js/renderers` |
| Runtime service | `assets/js/services` |
| Global bootstrap | `assets/js/core` |

## 4. Source of truth yang harus dibatasi

Berikut tabel single source of truth yang tidak boleh digandakan:

| Domain | Single source of truth | Tidak boleh dibuat duplikat |
|---|---|---|
| Data pemain | `assets/js/player-data.js` | data pemain dalam file lain |
| Item metadata/harga | `assets/js/item-catalog.js` | katalog harga yang terpisah tanpa validasi |
| Registri manifest | `data/inventory/**/manifest.js` + `assets/js/item-registry.js` | katalog item yang berbeda ID yang tidak sinkron |
| Gameplay runtime | `gameplay/` | controller game penuh di root atau folder baru tanpa adapter |
| Cache & PWA | `sw.js` | salinan cache di script lain |

## 5. Risiko utama migrasi folder

- path relative/absolute yang berubah saat HTML dipindah
- `localStorage` keys, `sessionStorage`, dan `ut-config` state UI
- order bootstrap pada `*.html` / script tag
- cache service worker + preload manifest
- referensi file antara `assets/js/pages`, `assets/css/pages`, dan halaman
- registri data item yang bisa drift dari server seed jika tidak tervalidasi

## 6. Rekomendasi implementasi yang aman

1. Pertahankan root HTML dan gameplay shell selama validasi dependency belum selesai.
2. Gunakan folder target sebagai penataan logis, namun tidak memindahkan file yang masih terikat ke runtime.
3. Bila perlu pindah, gunakan alias/wrapper, bukan duplikasi sumber.
4. Semua manifest dan registry harus tetap mematuhi ID yang sama dengan `ItemCatalog` agar kompatibel dengan save data serta server.
5. Pindahkan CSS and JavaScript yang benar-benar berdiri sendiri dan tidak memengaruhi DOM global, bukan file yang mengikat page lifecycle.

## 7. Kesimpulan

Fondasi folder yang aman bukan sekadar tampilan struktur folder, tetapi kemampuan menjaga kontrak runtime dan source of truth. Pada repo ini, target utama yang paling valid untuk fase awal adalah:

- mengkonsolidasikan `assets/js` ke domain `core`, `services`, `renderers`, dan `systems`,
- menjaga `gameplay/` dan `sw.js` sebagai domain runtime yang terikat kuat,
- memperlakukan `data/inventory/*` sebagai domain registri data,
- menunda `pages/` sampai semua referensi path dan DOM hook telah diverifikasi.

Dengan demikian struktur folder menjadi lebih rapi tanpa membahayakan status game dan integrasi yang sudah berjalan.
