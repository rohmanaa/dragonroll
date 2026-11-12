/* Service worker DRAGON ROLL (PWA). Scope: / (root repo).
   Strategi: kode/HTML = network-first (selalu terbaru saat online), cadangan cache saat offline.
   Media (gambar/font/suara, sudah diunduh splash) = cache dulu lalu diperbarui diam-diam di belakang (pindah halaman tidak menunggu jaringan).
   Request Range (audio streaming) dan non-GET tidak disentuh. Naikkan VERSION untuk membersihkan cache lama. */
const VERSION = 'ut-pwa-v84';
const CORE = ['index.html', 'play.html', 'splash.html', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
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
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const same = u.origin === self.location.origin;
  if (!same && !EXTRA_HOSTS.includes(u.hostname)) return;
  if (same && MEDIA.test(u.pathname)) { /* stale-while-revalidate: tampil dari cache seketika, perbarui di belakang */
    e.respondWith(caches.open(VERSION).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()).catch(() => {}); return res; }).catch(() => hit || Response.error());
      return hit || net;
    })));
    return;
  }
  e.respondWith(
    fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(hit => hit || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
