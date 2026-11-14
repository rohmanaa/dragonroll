# Dragon Roll — Global Structure Audit

Status: audit dokumentasi global untuk fase restrukturisasi. Dokumentasi ini menilai struktur kerja saat ini tanpa membatalkan kontrak runtime yang sudah ada.

## 1. Baseline proyek

Repositori ini adalah situs statis multi-halaman dengan arsitektur hybrid: markup masih dipertahankan di root (`*.html`), asset bersama hidup di `assets/`, modul gameplay hidup di `gameplay/`, dan banyak komponen sistem sudah berdiri sendiri. Struktur belum sepenuhnya konsisten secara folder-level, tetapi proyek juga tidak lagi dalam kondisi "kosong"; sebagian besar modul inti dan registry sudah diorganisasi secara bertahap.

Poin utama yang sudah jelas:

- Root masih memegang halaman utama (`index.html`, `play.html`, `lobby.html`, `profile.html`, dll.) dan tidak semua halaman sudah berpindah ke folder `pages/`.
- `assets/js/` sudah memuat core service, katalog item, renderer visual, multiplayer, dan utility, sementara `gameplay/` memegang gameplay engine dan HUD runtime.
- `hud/` sudah terpisah sebagai komponen UI bersama dan memiliki tema yang mandiri.
- `data/inventory/` sudah membentuk idiom item-based manifest untuk katalog (frame, power, pet, dsb.) sesuai target modular.
- `tests/` sudah menjadi pengaman regresi dan validasi struktural.
- `audit/5/` telah berisi seri dokumen tahap-tahap sebelumnya; ini berarti migrasi sudah berjalan bertahap, bukan dari nol.

## 2. Ringkasan inventarisasi

### 2.1 File HTML

Ada 24 file HTML di root utama. Halaman main yang relevan:

- `index.html`, `play.html`, `splash.html`, `lobby.html`, `mode.html`, `room.html`, `gameplay.html`
- `karakter.html`, `dadu.html`, `efek.html`, `frame.html`, `powerup.html`, `pet.html`
- `shop.html`, `inventory.html`, `leaderboard.html`, `profile.html`, `settings.html`, `mail.html`
- `friendship.html`, `tambang.html`, `hadiah-misi.html`

Catatan:

- `gameplay.html` adalah konfirmasi bahwa gameplay runtime dan logika 3D tidak hidup di root page inline; ia hanya menampung shell dan memuat modul di `gameplay/`.
- Beberapa halaman sebelum migrasi sudah dibagi CSS/JS per halaman, tetapi belum semua halaman menjadi `pages/` yang rapi.

### 2.2 File CSS

Kumpulan CSS terpusat di:

- `assets/css/` untuk base/shared UI/tema (mis. `base.css`, `fonts.css`, `shared-ui.css`, `scene-bg.css`, `lobby-theme.css`)
- `assets/css/pages/` untuk halaman spesifik seperti `inventory.css`, `lobby.css`, `play.css`, `profile.css`, `room.css`
- `gameplay/css/` untuk gameplay-specific styling
- `hud/components/` serta `hud/theme/` untuk UI reusable
- `assets/ng/css/` masih ada sebagai legacy/newgui reference dan harus diperlakukan sebagai aset referensi, bukan source of truth aktif

### 2.3 File JavaScript

JavaScript terbagi ke beberapa wilayah yang sudah jelas:

- `assets/js/` : core service, catalog, appearance, wallet, session, multiplayer, item art, renderer visual, preloader, settings, etc.
- `gameplay/js/` : gameplay controller, maps, audio, HUD bridge, FX, scene management
- `hud/ui-core.js` + `hud/components/*.js` : komponen UI shared
- `tools/` : generator, extractor, dan utilitas build

Kandidat file besar dengan tanggung jawab campuran:

| File | Ukuran/karakter | Catatan |
|---|---:|---|
| `assets/js/player-data.js` | besar | single source of truth data pemain, sangat sensitif saat migrasi |
| `assets/js/item-catalog.js` | besar | katalog produk dan harga; harus dipertahankan agar integritas data tidak rusak |
| `assets/js/app.js` | sedang | inisialisasi global dan bootstrap |
| `assets/js/pages/karakter.js` | besar | banyak tanggung jawab UI + renderer + state |
| `assets/js/pages/lobby.js` | sedang | halaman + persist state |
| `assets/js/pages/profile.js` | sedang | tampilan + data |
| `gameplay/js/game-core.js` | besar | gameplay core, state, logika, kemungkinan punya overlap dengan sistem |
| `gameplay/js/hud.js` | sedang | HUD + state render |
| `gameplay/js/main.js` | sedang | bootstrap + wiring runtime |

### 2.4 Folder aset dan resource

Aset sudah beragam dan besar, namun sebagian sudah dibagi sesuai domain:

- `assets/Images/`, `assets/icons/`, `assets/fonts/`, `assets/music/`, `assets/sfx/`, `assets/lobby-backdrop/`
- `data/frame/` untuk frame visual, `data/power/` untuk power data/effects
- `referensi/` berisi eksperimen, mockup, dan referensi desain yang tidak dimuat runtime
- `old/` berisi dokumen dan file lama yang mungkin masih berguna saat referensi, tetapi bukan source of truth

## 3. Pengelompokan berdasarkan tanggung jawab

### 3.1 Global core

- `assets/js/session.js`
- `assets/js/app.js`
- `assets/js/auth.js`
- `assets/js/prefs.js`
- `assets/js/prefs-sync.js`
- `assets/js/live-sync.js`
- `assets/js/game-integration.js`
- `assets/js/boot-guard.js`
- `sw.js`
- `manifest.webmanifest`

### 3.2 Service

- `assets/js/player-data.js`
- `assets/js/wallet-service.js`
- `assets/js/appearance-service.js`
- `assets/js/ads-service.js`
- `assets/js/mail-service.js`
- `assets/js/mine-service.js`
- `assets/js/quest-data.js`
- `assets/js/multiplayer/*.js`

### 3.3 Component

- `hud/components/*.js`
- `hud/ui-core.js`
- `assets/js/character-face.js`
- `assets/js/character-view.js`
- `assets/js/frame-avatar.js`

### 3.4 Renderer

- `assets/js/blocky-character.js`
- `assets/js/character-data.js`
- `assets/js/dice-kit/*.js`
- `assets/js/power3d/*.js`
- `assets/js/aura-fx.js`
- `assets/js/frame-fx.js`
- `assets/js/item-art.js`
- `gameplay/js/skin-uv.js`

### 3.5 System

- `gameplay/js/*.js`
- `gameplay/js/maps/*.js`
- `assets/js/multiplayer/*.js`
- `assets/js/ambience.js`, `night-fog.js`, `scene-bg.js`

### 3.6 Page-specific

- `assets/js/pages/*.js`
- `assets/css/pages/*.css`
- halaman HTML root (saat ini) yang masih berisi struktur spesifik dan pemuatan skrip per halaman

### 3.7 Data

- `data/inventory/**/manifest.js`
- `data/power/power-fx.js`
- `data/frame/*`
- `supabase/migrations/` dan snapshot schema
- `tools/` generator manifest/registry

### 3.8 Asset & tooling

- `assets/Images`, `assets/icons`, `assets/fonts`, `assets/music`, `assets/sfx`
- `tools/` dan manifest cache
- `preload-manifest.json`

### 3.9 Legacy / reference

- `old/`
- `referensi/`
- `promosi/`
- `assets/ng/` (legacy UI CSS reference)

### 3.10 Unused candidate

Berkas yang masih belum bisa dipastikan fungsinya secara penuh tanpa pembacaan browser runtime:

- `assets/ng/*` (desain baru, kemungkinan eksperimental; masih dipelihara sebagai referensi)
- beberapa file di `promosi/`, `referensi/`, `old/`
- file helper satelit yang belum terhubung penuh ke page controller aktif

## 4. Dependensi antarsistem

Dependency utama yang perlu dijaga saat ekstraksi:

1. `sw.js` dan `preload-manifest.json` menjaga cache PWA; setiap perubahan runtime perlu update versi.
2. `assets/js/player-data.js` adalah state pemain utama; inventory, wallet, appearance, dan beberapa halaman bergantung padanya.
3. `assets/js/item-catalog.js` adalah katalog produk/kebijakan harga; sinkron dengan registry dan seed server.
4. `assets/js/item-registry.js` berperan sebagai registry terpisah untuk validasi item manifest, tetapi bukan pengganti source of truth harga.
5. `gameplay/` menjadi domain runtime 3D dan logika game yang tidak boleh diubah secara agresif selama fase HTML/CSS/JS extraction.
6. `hud/` dan `assets/js/pages/` saling bergantung pada hook DOM dan event yang disediakan halaman HTML.
7. HTML root masih memuat asset dan referensi dengan path yang sensitif terhadap lokasi file; perubahan path harus hati-hati.

## 5. Kandidat ekstraksi paling aman

Prioritas ekstraksi dari yang paling aman ke yang paling berisiko:

1. CSS shared dan theme (`assets/css/base.*`, `assets/css/shared-ui.css`, `hud/theme/*`)
2. Komponen UI reusable (`hud/components/*`)
3. `assets/js` helper kecil dan utility yang tidak memengaruhi gameplay
4. `data/inventory/*` manifest registri per item, karena ini sudah mengikuti pola item-based directory
5. `assets/js/pages/*.js` yang isinya semata-mata page bootstrap
6. `assets/js/multiplayer/*` dan `assets/js/services-like/*` bila ada yang benar-benar tertata ulang
7. `gameplay/js/*` dan `gameplay/css/*` hanya setelah audit dan lock-in dependency, karena domain paling sensitif

## 6. Risiko pemindahan

Risiko terbesar bukan pada kode itu sendiri, melainkan pada kontrak yang sudah terikat ke browser runtime:

- path absolut dan relative di HTML/CSS/JS
- event hooks dan DOM id/class yang dipakai oleh skrip
- localStorage keys dan schema data
- `sw.js` cache version + manifest preloading
- referensi registry dan item IDs antara server, client, dan game logic
- script order in pages and bootstrap sequence

Karena itu, restrukturisasi harus bersifat incremental dan backward-compatible, bukan promosi ganda atau penghapusan modul yang masih dipakai.

## 7. Usulan struktur akhir

Target struktur yang paling realistis untuk repo saat ini:

```text
dragon-roll/
├── index.html
├── gameplay.html
├── pages/                     # opsional, hanya setelah semua kontrak diketahui
├── assets/
│   ├── css/
│   │   ├── base/
│   │   ├── components/
│   │   ├── layout/
│   │   ├── themes/
│   │   └── utilities/
│   ├── js/
│   │   ├── core/
│   │   ├── services/
│   │   ├── components/
│   │   ├── renderers/
│   │   ├── systems/
│   │   └── utils/
│   ├── images/
│   ├── fonts/
│   ├── music/
│   ├── sfx/
│   └── icons/
├── data/
│   ├── inventory/
│   │   ├── character/
│   │   ├── dice/
│   │   ├── power/
│   │   ├── aura/
│   │   ├── pet/
│   │   └── frame/
│   ├── world/
│   ├── biome/
│   └── config/
├── gameplay/
├── hud/
├── supabase/
├── tests/
├── tools/
├── old/
├── referensi/
├── promosi/
├── audit/
└── sw.js
```

Catatan penting: struktur yang paling aman adalah struktur hybrid. Artinya, folder target baru boleh dibuat sambil tetap menjaga lokasi kerja yang sudah dipakai runtime secara valid.

## 8. Urutan ekstraksi yang paling aman

1. Audit statis dan dokumen dependency tanpa perubahan file.
2. Normalisasi registri data item dan katalog manifest (`data/inventory/*`).
3. Pindahkan/alias komponen shared UI dan CSS reusable ke folder domain yang lebih jelas.
4. Keluarkan helper utilitas kecil dari `assets/js/` ke `assets/js/utils/` atau `core/` bila memang reusable.
5. Ekstrak halaman yang benar-benar page-only dan tidak memengaruhi bootstrap global.
6. Setelah semua dependency ter-lock, barulah menyusun `pages/` dengan wrapper atau alias jika diperlukan.
7. Gameplay dan runtime 3D dikerjakan paling akhir karena sensitif terhadap DOM, state, dan pengaturan render.

## 9. File yang sebaiknya tidak disentuh

Dalam kondisi kerja saat ini, file berikut paling aman untuk tetap tidak berubah selama fase ekstraksi awal:

- `gameplay.html`
- `gameplay/`
- `assets/js/player-data.js`
- `assets/js/item-catalog.js`
- `assets/js/game-integration.js`
- `sw.js`
- `preload-manifest.json`
- file migrasi di `supabase/`
- `data/frame/*` dan aset visual lain yang telah terhubung ke runtime
- root HTML halaman kecuali saat pemetaan path dan hook DOM sudah diverifikasi

## 10. File yang belum dapat dipastikan fungsinya sepenuhnya

Daftar ini harus tetap dicatat, bukan dibuang:

- `assets/ng/css/*` dan `assets/ng/*` (legacy/newgui design reference)
- `assets/js/multiplayer/config.example.js` dan konfigurasi multiplayer yang berbasis contoh/opsional
- beberapa file di `referensi/` dan `old/`
- file helper di `tools/` yang baru dibuat namun belum diintegrasikan sepenuhnya ke pipeline runtime
- file CSS/JS yang tidak lagi dipanggil secara langsung namun masih bisa dipakai melalui dynamic import atau runtime bridging

## 11. Kesimpulan

Repo Dragon Roll sudah bergerak menuju arsitektur modular, tetapi belum sepenuhnya mencapai target folder "ideal". Kondisi saat ini paling tepat dianalisis sebagai hybrid modular: beberapa bagian sudah di-structurize dan dibatasi domainnya, sementara halaman dan runtime masih memiliki banyak kontrak browser yang membatasi migrasi agresif.

Oleh karena itu, prioritas aman adalah:

- melindungi source of truth data dan runtime,
- memetakan dependency dan path,
- mengekstrak komponen dan data registri yang sudah mempunyai pola jelas,
- menunda migrasi DOM-heavy pages dan gameplay hingga semuanya benar-benar di-lock.

Ini membatasi risiko regresi sambil tetap memajukan struktur proyek ke arah target arsitektur yang disebut dalam master prompt.
