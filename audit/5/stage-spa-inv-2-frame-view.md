# SPA Inventory tab â†’ view â€” Tahap 2 (Frame)

Branch: `spa-inv-frame` (dari main ae810be). Pola sama dengan Pet (lihat stage-spa-inv-1b di stage-spa-inv-1-pet-sharedgl.md).

## Berubah
- `data/inventory/frame/_shared/js/frame.js` â†’ modul `UT.PageModule` 'frame' (mandiri/embed = auto-mount seperti sebelumnya). Timer, listener `keydown`/`resize`, `UT.Events.on`, `PD.subscribe`, LiveSync semuanya lewat `env` (dilepas saat unmount); `toast/draw/showWallet` dijaga `env.disposed` untuk callback async (refresh dompet).
- `frame.html`: memuat `page-module.js`, `inv-tabs.js`, `inv-tabbar.css`.
- `src/core/inv-tabs.js`: `VIEW_TABS = {frame, pet}`; helper bersama `mountChrome(env, aktif, navigate, snd)` (judul "Inventory", `body.inv-view`, bar `#invtabs`, klik tab lain = `inventory.html?tab=â€¦`). pet-page.js dan frame.js memakainya (duplikasi bar tab dari Pet dihapus).
- `spa-host.js`: `frame.html` = view; `canon()` memetakan SEMUA tab view (`INV_VIEW_TABS`), jadi `inventory.html?tab=frame` (atau tab terakhir = frame, termasuk default) langsung ke view Frame.
- `frame-guard.js`, `play.js` (prefetch): mengenal frame. `sw.js` v317; preload manifest diregenerasi.
- `frame-fx.js` tidak diubah: sudah aman SPA (MutationObserver tingkat dokumen, loop berhenti saat kanvas terlepas).

## Tes
- Baru: `tests/frame-view.test.js` (termasuk uji fungsional `mountChrome` dengan DOM tiruan). Diperbarui: spa-host (canon frame), pet-view, inventory-module.
- Seluruh suite: 6 kegagalan yang sama dengan baseline main (tiga *-registry-parity, gameplay-assets-external, dice-landing-stall, gameplay-dice-throw-race).
- NOT TESTED di browser: tampilan view Frame (bar tab, latar, grid mulai y=250), pindah Frameâ†”Petâ†”tab iframe berulang, kanvas frame-fx setelah mount ulang, Esc/Back.

## Sisa
dadu, efek, powerup masih iframe (+ renderer sendiri: dice-renderer.js, efek.js, power-renderer.js). Setelah ketiganya jadi view: hapus iframe + pemanasan dari inventory.js.

