/* Service worker DRAGON ROLL (PWA). Scope: / (root repo).
   Strategi: kode/HTML = network-first (selalu terbaru saat online), cadangan cache saat offline.
   Media (gambar/font/suara, diunduh sekali oleh splash) = CACHE-FIRST: sekali tersimpan di perangkat tidak diunduh ulang sampai VERSION dinaikkan.
   Request Range (audio) dilayani dari cache bila file sudah tersimpan penuh; bila belum, lewat jaringan biasa. Non-GET tidak disentuh.
   Ganti/tambah aset => naikkan VERSION (cache lama otomatis dibuang). */
const VERSION = 'ut-pwa-v159';
const CORE = ['index.html', 'play.html', 'splash.html', 'assets/css/pages/play.css', 'assets/js/pages/play.js', 'assets/js/pages/splash.js', 'assets/css/fonts.css', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
const MEDIA = /\.(png|webp|jpe?g|gif|svg|ico|woff2?|mp3|ogg|wav)$/i;
const EXTRA_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const same = u.origin === self.location.origin;
  if (!same && !EXTRA_HOSTS.includes(u.hostname)) return;
  if (same && MEDIA.test(u.pathname)) {
    const range = r.headers.get('range');
    e.respondWith(caches.open(VERSION).then(async c => {
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
  e.respondWith(
    fetch(r).then(res => {
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
