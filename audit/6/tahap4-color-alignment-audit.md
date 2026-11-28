# AUDIT DAN RENCANA PENYELARASAN WARNA HALAMAN — TAHAP 4

**Cabang Kerja:** `feat/design-tokens-stage2`  
**Titik Mulai:** Commit `409186e1` (setelah penggabungan Tahap 3)  
**Tujuan:** Menyelaraskan penggunaan warna sekunder dan aksen per halaman agar konsisten dengan Design Tokens Tahap 2, tanpa mengubah layout, ukuran, posisi, struktur HTML, JS, maupun gameplay.

---

## 1. PEMETAAN FILE & LOKASI STYLESHEET
- `assets/css/mission.css` — Halaman Hadiah & Misi (`hadiah-misi.html`)
- `assets/css/shop.css` — Halaman Toko (`shop.html`)
- `assets/css/leaderboard.css` — Halaman Papan Peringkat (`leaderboard.html`)
- `assets/css/pages/profile.css` — Halaman Profil (`profile.html`)
- `assets/css/account-hub.css` — Hub akun bersama (Profil, Teman, Pesan, Pengaturan)

*Catatan:* File CSS profil yang aktif untuk tampilan profil utama adalah `assets/css/pages/profile.css` (bukan di root `assets/css/`).

---

## 2. KANDIDAT PENYELARASAN WARNA

### A. `mission.css`
- `.foot .note`: `#b9b2d0` -> `var(--dr-text-secondary, #b9b2d0)`
- `.msg`: `#b9b2d0` -> `var(--dr-text-secondary, #b9b2d0)`
- `.msg small`: `#8f88ae` -> `var(--dr-text-muted, #8f88ae)`
- Semantic colors yang **DIPERTAHANKAN**:
  - `.row.ut-sc.hp, .hdr.ut-sc.hp` (kartu hijau bonus misi).
  - Lencana notifikasi merah `.rbadge`.
  - Icon koin emas dan centang selesai.

### B. `shop.css`
- Teks nama kartu paket `.card .nm`: `#d9d3ee` -> `var(--dr-text-secondary, #d9d3ee)`
- Subtitle jumlah koin/gem `.card .amt small`: `#b9b1d3` -> `var(--dr-text-muted, #b9b1d3)`
- Sub-teks dialog pembelian `#dlg-s`, `#ad-s`, `#mb p`: `#ddd7f7` -> `var(--dr-text-secondary, #ddd7f7)`
- Sub-teks riwayat transaksi `.history-head p`, `.hr .hl small`: `#b9b1d3` -> `var(--dr-text-muted, #b9b1d3)`
- Baris rincian `.srow`: `#ddd7f7` -> `var(--dr-text-secondary, #ddd7f7)`
- Semantic colors yang **DIPERTAHANKAN**:
  - Glow radial item langka `var(--g)`.
  - Angka koin emas `#ad-n` dan `#ffd45a`.
  - Tag rarity / item identity.

### C. `leaderboard.css`
- Teks empty state podium `.pd.empty .pn`: `#8f89aa` -> `var(--dr-text-muted, #8f89aa)`
- Header kolom tabel `#th`: `#b9b1d3` -> `var(--dr-text-secondary, #b9b1d3)`
- Sub-teks empty list `#rows .empty small`: `#8f88ae` -> `var(--dr-text-muted, #8f88ae)`
- Semantic colors yang **DIPERTAHANKAN**:
  - Mahkota emas Juara 1, perak Juara 2, perunggu Juara 3.
  - Kartu pemain saya `#mycard` (highlight pemain).

### D. `pages/profile.css`
- Header section `.ph`: `#ffd45a` -> `var(--dr-gold-light, #ffd45a)`
- ID pemain `#hid`: `#cfc8ea` -> `var(--dr-text-secondary, #cfc8ea)`
- Label kecil statistik `.prow small`: `#cfc8ea` -> `var(--dr-text-muted, #cfc8ea)`
- Semantic colors yang **DIPERTAHANKAN**:
  - Angka nilai statistik `#ffd45a` (`.prow .rp b`).
  - Status item terpasang `.fslot.st-used` (`#4f8f2c`).
  - Rig warna armor dan aura 3D.
