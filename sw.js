/* Service worker DRAGON ROLL (PWA). Scope: / (root repo).
   Strategi: SEMUA aset (HTML/JS/CSS/JSON + gambar/font/suara + library cdnjs/fonts) = CACHE-FIRST: sekali tersimpan di perangkat tidak diunduh ulang,
   jadi pindah halaman tidak menunggu jaringan. Lewat jaringan hanya bila belum ada di cache (disimpan, dan diambil dengan revalidasi supaya tidak basi).
   PEMBARUAN: ganti/tambah aset => naikkan VERSION. SW baru memasang cache sendiri lalu MENUNGGU; baru aktif (cache lama dibuang) setelah
   semua tab/aplikasi ditutup dan dibuka lagi (tanpa skipWaiting) -> pembaruan berlaku setelah restart aplikasi, tanpa campur versi di tengah sesi.
   UPDATE INKREMENTAL: kode (HTML/JS/CSS/JSON) ada di cache ber-versi (kecil, dibuang tiap versi baru); MEDIA (gambar/suara/font + library luar) ada di
   cache PERMANEN MEDIA_CACHE yang TIDAK dibuang saat VERSION naik. Saat aktivasi, assets/media-hash.json (dibuat tools/gen-preload-manifest.py) dibandingkan
   dengan indeks yang tersimpan: hanya media yang hash-nya berubah/dihapus yang dibuang dari cache dan diunduh ulang. Cache ber-versi lama (sebelum skema ini)
   dimigrasikan: isi media dicocokkan dengan hash, yang cocok dipakai ulang tanpa unduh.
   JALANKAN ulang tools/gen-preload-manifest.py setiap mengganti/menambah media (tes tests/sw-incremental-media.test.js menjaganya).
   Request Range (audio) dilayani dari cache bila file sudah tersimpan penuh; bila belum, lewat jaringan biasa. Non-GET tidak disentuh. */
const VERSION = 'ut-pwa-v284';
const MEDIA_CACHE = 'ut-media'; /* permanen: tidak dibuang saat VERSION naik */
const MEDIA_INDEX = '__media-index__'; /* kunci indeks hash di MEDIA_CACHE */
const MEDIA_HASH_URL = 'assets/media-hash.json';
const CORE = ['index.html', 'play.html', 'splash.html', 'assets/css/pages/play.css', 'assets/js/pages/play.js', 'assets/js/pages/splash.js', 'assets/css/fonts.css', 'manifest.webmanifest', 'assets/images/background/clouds/cloud-1.svg', 'assets/images/background/clouds/cloud-2.svg', 'assets/images/background/clouds/cloud-3.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
const CODE = /\.(html|js|css|json|webmanifest)$/i;
const MEDIA = /\.(png|webp|jpe?g|gif|svg|ico|woff2?|mp3|ogg|wav)$/i;
const EXTRA_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(syncMedia().catch(() => {}).then(() => caches.keys()).then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== MEDIA_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* Sinkronkan MEDIA_CACHE dengan media-hash.json terbaru: buang hanya yang berubah/dihapus; migrasi dari cache ber-versi lama.
   Gagal jaringan => dibiarkan apa adanya (cache lama tetap dipakai, dicek lagi pada aktivasi berikutnya). */
async function syncMedia() {
  let fresh;
  try {
    const res = await fetch(MEDIA_HASH_URL, { cache: 'no-store' });
    if (!res.ok) return;
    fresh = await res.json();
  } catch (err) { return; }
  const mc = await caches.open(MEDIA_CACHE);
  const idxKey = new Request(new URL(MEDIA_INDEX, self.registration.scope).href);
  const idxRes = await mc.match(idxKey);
  let old = null;
  try { old = idxRes ? await idxRes.json() : null; } catch (err) { old = null; }
  const abs = p => new URL(p, self.registration.scope).href;
  if (old) {
    /* update inkremental: buang hanya media yang hash-nya berubah atau sudah tidak ada */
    for (const p of Object.keys(old)) if (fresh[p] !== old[p]) await mc.delete(new Request(abs(p)));
  } else {
    /* migrasi satu kali dari cache ber-versi lama: salin media yang isinya cocok dengan hash terbaru, tanpa unduh */
    for (const name of await caches.keys()) {
      if (!/^ut-pwa-v\d+$/.test(name) || name === VERSION) continue;
      const oc = await caches.open(name);
      for (const req of await oc.keys()) {
        const p = new URL(req.url).pathname.replace(new URL(self.registration.scope).pathname, '');
        if (!fresh[p] || await mc.match(req)) continue;
        const res = await oc.match(req);
        if (!res || res.status !== 200) continue;
        try {
          const copy = res.clone();
          if (await blobHash(await res.arrayBuffer()) === fresh[p]) await mc.put(new Request(abs(p)), copy);
        } catch (err) {}
      }
    }
  }
  await mc.put(idxKey, new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json' } }));
}
/* hash id-blob git (12 hex pertama) = sha1("blob <ukuran>\0" + isi), sama dengan yang ditulis tools/gen-preload-manifest.py */
async function blobHash(buf) {
  const head = new TextEncoder().encode('blob ' + buf.byteLength + '\0');
  const all = new Uint8Array(head.length + buf.byteLength);
  all.set(head, 0); all.set(new Uint8Array(buf), head.length);
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const same = u.origin === self.location.origin;
  if (!same && !EXTRA_HOSTS.includes(u.hostname)) return;
  if (same && MEDIA.test(u.pathname)) {
    const range = r.headers.get('range');
    e.respondWith(caches.open(MEDIA_CACHE).then(async c => {
      const key = new Request(r.url); /* kunci tanpa header Range */
      const hit = await c.match(key);
      if (hit) return range ? sliceRange(hit, range) : hit;
      if (range) return fetch(r); /* belum tersimpan penuh: biarkan jaringan melayani */
      try {
        const res = await fetch(r);
        if (res && res.status === 200) c.put(key, res.clone()).catch(() => {});
        return res;
      } catch (err) { return Response.error(); }
    }));
    return;
  }
  if ((same && (r.mode === 'navigate' || CODE.test(u.pathname))) || !same) {
    e.respondWith(caches.open(same ? VERSION : MEDIA_CACHE).then(async c => { /* library/font luar: URL ber-versi, simpan permanen */
      const key = new Request(same ? u.origin + u.pathname : r.url); /* kunci tanpa query (?v=, ?next=) */
      const hit = await c.match(key, { ignoreSearch: same });
      if (hit) return hit;
      try {
        const res = await fetch(r, same ? { cache: 'no-cache' } : undefined); /* belum ada di perangkat: ambil terbaru (revalidasi) */
        if (res && (res.ok || res.type === 'opaque') && !res.redirected) c.put(key, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        return (r.mode === 'navigate' && await c.match('index.html')) || Response.error();
      }
    }));
    return;
  }
  e.respondWith(
    fetch(r, { cache: 'no-store' }).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(hit => hit || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

/* Layani request Range (audio/video) dari respons penuh di cache */
async function sliceRange(res, range) {
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let start = m[1] === '' ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
    'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
