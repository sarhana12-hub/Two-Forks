const CACHE = 'two-forks-v3';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

// Only the app shell, the web fonts and the pinned Firebase scripts belong in
// the cache. Firestore's live traffic, favicons and anything else is data:
// caching every one of those responses grew the cache without bound and
// could hand the Firestore SDK a stale, unrelated response when offline.
const CACHE_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
function shouldHandle(request) {
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  if (!CACHE_HOSTS.includes(url.hostname)) return false;
  return url.hostname !== 'www.gstatic.com' || url.pathname.startsWith('/firebasejs/');
}

// GitHub Pages serves everything with Cache-Control: max-age=600, which we
// can't override (static host, no server config). `cache: 'no-store'` makes
// every fetch here bypass that entirely, so installs and revalidation never
// silently reuse a browser-cached response that's up to 10 minutes stale.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((url) =>
        fetch(url, { cache: 'no-store' }).then((res) => c.put(url, res))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: always prefer the live version (this app changes often);
// fall back to the last cached copy only when the network fails.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !shouldHandle(e.request)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
