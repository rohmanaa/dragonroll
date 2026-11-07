> **Update:** struktur `assets/sfx/` sudah dirapikan per kategori (`ui/`, `dice/`, `board/`, `reward/`, `powerup/`, `mob/`, `dragon/`). Daftar terbaru dan path file ada di `assets/sfx/README.md`; nama file di bawah adalah catatan lama.

# README_AUDIO — Referensi Audio Ular Tangga Blok

Tidak ada file audio baru yang ditambahkan di Tahap 3 (tidak ada audio palsu/base64/unduhan).
File ini adalah **daftar referensi** agar kamu bisa mencari/mengganti audio sendiri nanti.

## File yang SUDAH ADA (jangan dihapus / diganti nama)

Semua ada di `assets/sfx/` dan dipetakan lewat `UT.Audio` (`assets/js/app.js`):

| File                          | Nama logis (`UT.Audio`) | Fungsi & kapan dimainkan | Karakter suara yang disarankan |
|-------------------------------|--------------------------|--------------------------|--------------------------------|
| `button.mp3`                  | `button`                 | Klik UI: tombol, tab, toggle, pilih item, buka modal, error (fallback) | Pop/klik lembut ala game kasual mobile, pendek (<0,3 dtk) |
| `game_assets_sfx_chest.mp3`   | `chest`                  | Membuka peti/hadiah (chest) | Sekrak log kayu + kilau koin, sedang |
| `kalah.mp3`                   | `kalah`                  | Kalah di gameplay (WebAudio game tetap terpisah) | Jingle turun/败 minor, 1–2 dtk |
| `power.mp3`                   | `power`                  | Pembelian/claim sukses, power-up | Whoosh naik + sukses ceria, 0,5–1 dtk |

Adapter legacy: halaman UI memanggil `playSound('click'|'select'|'open'|'error'|'coin'|'purchase')`
dan dipetakan ke nama logis di atas (lihat `SFX` map di tiap halaman). Memutar hanya bila
`settings.sound` aktif (dari `PlayerData`).

## Referensi filename untuk audio yang BELUM ada (cari sendiri, ganti kalau suka)

Maksimal 3 kata per nama file. Taruh di `assets/sfx/` (SFX) atau `assets/music/` (musik),
lalu daftarkan di map `UT.Audio.sources`.

| Filename          | Fungsi | Kapan dimainkan | Karakter suara yang disarankan |
|-------------------|--------|-----------------|--------------------------------|
| `menu_music.mp3`  | Musik lobi | Loop halaman lobby/menu | Ukulele/marimba ceria, tempo santai, loop mulus |
| `game_music.mp3`  | Musik gameplay | Loop saat pertandingan | upbeat ringan, tidak mengganggu konsentrasi |
| `win_music.mp3`   | Menang | Layar kemenangan | Fanfare pendek mayor |
| `dice_roll.mp3`  | Lempar dadu | Setiap giliran melempar dadu | Rattle kayu/plastik 0,5 dtk |
| `ladder_up.mp3`  | Naik tangga | Pion naik tangga | Sweep naik haru |
| `snake_hiss.mp3` | Turun ular | Pion kena ular | Hiss + slide turun minor |
| `chest_open.mp3` | Buka peti reward | Klaim hadiah harian besar | Creak + shimmer |
| `coin_pickup.mp3`| Terima koin | Reward coin masuk | Ding koin ganda |
| `gem_pickup.mp3` | Terima gem | Reward gem masuk | Ding kristal tinggi |
| `button_click.mp3`| Klik UI alternatif | Pengganti `button.mp3` kalau mau | Klik lebih tegas |

Catatan:
- Jangan menambahkan base64/dependency eksternal; cukup ganti file mp3 dengan nama yang sama.
- Gameplay WebAudio (synth) tidak diubah di Tahap 3.

## Power-Up SFX (referensi Tahap 3.1 � file BELUM ada, jangan buat audio palsu)

Nama file maksimal 3 kata; taruh di `assets/sfx/` bila nanti file aslinya ditambahkan,
lalu daftarkan di `UT.Audio.sources` (`assets/js/app.js`). Tidak ada base64/unduhan.

| Filename          | Fungsi                          | Kapan dimainkan                     | Karakter suara yang disarankan      |
|-------------------|---------------------------------|-------------------------------------|-------------------------------------|
| `powerup_get.mp3` | Power-Up didapatkan             | Ambil power-up (peti / reward)      | Magical, short, satisfying          |
| `sword_use.mp3`   | Sword digunakan                 | Efek +3 langkah aktif               | Quick sword slash                   |
| `tnt_boom.mp3`    | TNT aktif                       | Pemain terdepan mundur 6            | Cartoon explosion                   |
| `potion_use.mp3`  | Potion digunakan                | Dadu berikutnya 4-6 aktif           | Magical potion effect               |
| `feather_use.mp3` | Feather (giliran tambahan)      | Extra turn aktif                    | Light magical chime                 |
| `grass_swap.mp3`  | Posisi ditukar (Blok Rumput)    | Swap dengan pemain terdepan         | Short teleport/swap effect          |

Catatan Tahap 3.1:
- Empat file existing TIDAK diubah: `button.mp3`, `game_assets_sfx_chest.mp3`, `kalah.mp3`, `power.mp3`.
- Gameplay power-up saat ini masih memakai `sfx.pop()` existing; tabel di atas hanya REFERENSI.
