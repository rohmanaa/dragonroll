# AUDIT & REFECTORING CSS BERSAMA (SHARED CSS) â€” TAHAP 3

**Tanggal:** 2026-11-28  
**Branch:** `feat/shared-css-cleanup-stage3` (bercabang dari `feat/design-tokens-stage2` @ `ebfc3411`)  
**Tujuan:** Refactoring, deduping, dan perapian CSS bersama tanpa mengubah hasil visual, layout, posisi, ukuran, maupun fungsi gameplay.

---

## 1. INVENTARIS CSS BERSAMA (SHARED STYLESHEETS)

Berdasarkan penelusuran terhadap seluruh file HTML, JavaScript (`page-shell.js`, `spa-host.js`), dan `@import`:

| File CSS Bersama | Lingkup Penggunaan | Mekanisme Pemuatan |
|---|---|---|
| `assets/css/tokens.css` | Fondasi variabel warna global `:root` | Di-import di baris pertama `common.css` |
| `assets/css/common.css` | Frame kanvas 1920x1080 (`#wrap`, `#stage`), `#fade`, modal overlay, `.gbtn`, font dasar | `UT.PageShell.renderBase()` & `UT.Spa` `BASE_CSS` |
| `assets/css/bg.css` | Background radial gelap full-bleed untuk halaman non-lobby | `<link>` di head halaman non-lobby |
| `assets/css/page.css` | Utility lama: bar mata uang, tombol `#back`, `.btn.gold`, `.panel`, range slider | `<link>` di head berbagai halaman lama |
| `assets/css/sub.css` | Layout sub-halaman (Leaderboard, Friendship, Tambang): `#back`, `#title`, `.tabs`, `.row`, `#md` | `<link>` di head sub-halaman |
| `assets/css/base.css` | File kompatibilitas wrapper (`reset.css`, `utilities/common.css`, `components/overlay.css`) | Hanya dimuat oleh `gameplay.html` |
| `src/components/button/button.css` | Komponen tombol modular global (`.ut-btn`, `.ut-gl`) | `<link>` di hampir semua halaman |
| `src/components/modal/modal-kit.css` | Komponen popup modal modular global (`.ut-mk`, `.ut-mk-t`, `.ut-mk-x`) | `<link>` di halaman bermodal |

---

## 2. TEMUAN AUDIT: DUPLIKASI, KONFLIK & KANDIDAT TOKEN

### A. `assets/css/common.css`
1. **Duplikasi `#fade`:**
   - Didefinisikan dua kali di file yang sama.
   - Definisi pertama (baris 16): `position:absolute; inset:0; z-index:99; transition:opacity .3s;`
   - Definisi kedua (baris 23): `position:fixed!important; inset:0; z-index:9999!important; transition:opacity .35s;`
   - *Analisis:* Definisi kedua menimpa definisi pertama secara menyeluruh dengan `!important` untuk memastikan fade menutupi layar di luar kontainer stage. Definisi pertama redundan.
2. **Duplikasi deklarasi `#wrap` & `#stage`:**
   - `#wrap` dideklarasikan tiga kali: baris 5 (`display:grid; place-items:center`), baris 19 (`display:block!important`), baris 28 (`z-index:1`).
   - `#stage` dideklarasikan dua kali: baris 6 (`position:relative; width:1920px; height:1080px; flex:none; overflow:hidden`) dan baris 20 (`position:absolute!important; left:50%!important; top:50%!important; margin:-540px 0 0 -960px!important`).
3. **Kandidat Mapping Token:**
   - Variabel warisan `--ink: #1b1430` dapat dipetakan ke `var(--dr-void, #1b1430)`.
   - Variabel warisan `--gold: #ffd45a` dapat dipetakan ke `var(--dr-gold-light, #ffd45a)`.

### B. `assets/css/page.css`
1. **Redundansi Variabel `:root`:**
   - Mendefinisikan ulang `:root{--line:#6d6590; --gold:#ffd45a}` yang sudah ada di `common.css` dan `tokens.css`.
2. **Duplikasi `#cur-em` & `#cur-co`:**
   - Ditulis 4 kali berturut-turut karena tambal-sulam penyesuaian posisi di masa lalu.
   - **PERINGATAN PENTING DARI AUDIT PENGUJIAN:**
     Unit test statis `tests/room-page-modal.test.js` dan `tests/store-card-status.test.js` memeriksa string exact berikut:
     - `assert.ok(pageCss.includes('body.ef #cur-em{left:auto!important;right:340px!important}'));`
     - `assert.ok(pageCss.includes('body.ef #cur-co{left:auto!important;right:26px!important}'));`
     - `assert.ok(/#cur-em\{left:auto!important;right:340px\}/.test(pageCss));`
     - `assert.ok(/#cur-co\{left:auto!important;right:26px\}/.test(pageCss));`
     *Tindakan:* Baris-baris ini **WAJIB DIPERTAHANKAN** persis seperti aslinya agar unit test tidak rusak.
3. **Latar Belakang Biru Cerah (`body.sub #stage`):**
   - Baris 3: `body.sub #stage{background:linear-gradient(180deg,#53b8f2 0%,#8bd5fa 46%,#d6f1ff 100%)}`
   - Baris 6-7: `#sun` dan `#vig`
   - *Analisis:* `bg.css` menetapkan `#stage{background:none!important}` dan `#sun,#vig,.cloud,.spark{display:none!important}`. Namun jika ada halaman sub yang tidak memuat `bg.css`, latar biru ini menjadi fallback.

### C. `assets/css/sub.css`
1. **Struktur Bersama:**
   - Menyediakan tata letak `#back`, `#title`, `.tabs`, `.tabb`, `.row`, dan modal `#md`.
   - Selector sudah stabil dan digunakan oleh Leaderboard, Friendship, dan Tambang.
2. **Kandidat Mapping Token:**
   - `.tabb.on`: `color: #ffe8a3` (aksen emas muda tab aktif).
   - `.tabb i` (badge notifikasi): `background: #e0364b` (aksen merah crimson notifikasi).

---

## 3. RENCANA PERAPIAN (REFACTORING PLAN)

1. **`assets/css/common.css`:**
   - Gabungkan deklarasi `#wrap` dan `#stage` menjadi satu blok terpadu yang mempertahankan seluruh computed rules (`position:absolute!important; margin:-540px 0 0 -960px!important; transform-origin:center center!important; z-index:1`).
   - Hapus blok redundan `#fade` pertama yang telah ditimpa oleh `#fade` full-viewport.
   - Hubungkan variabel `--gold` dan `--ink` ke token `tokens.css` dengan fallback yang presisi.

2. **`assets/css/page.css`:**
   - Hubungkan `:root { --gold: var(--dr-gold-light, #ffd45a); --line: var(--dr-border-soft, #6d6590); }`.
   - Pertahankan seluruh baris assertion test (`#cur-em`, `#cur-co`, `body.ef`).
   - Bersihkan deklarasi selector `.btn.gold span` agar menggunakan token fallback `var(--dr-gold-deep, #4d2300)` dan `var(--dr-gold-light, #ffe8a3)`.

3. **Verifikasi:**
   - Jalankan seluruh unit test (`node tests/*.test.js`).
   - Pastikan tidak ada kegagalan test baru (hanya baseline).
   - Perbarui versi cache di `sw.js` (ke `ut-pwa-v601`).

