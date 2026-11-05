// SolarCharge service worker — ścieżki liczone względem zakresu (scope),
// więc działa zarówno pod /solarcharge/ na GitHub Pages, jak i lokalnie.
const CACHE = 'solarcharge-v3';
const SCOPE = self.registration.scope;
const url = p => new URL(p, SCOPE).href;
const ASSETS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'].map(url);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // usuwamy tylko stare wersje własnego cache — nie ruszamy innych stron z kubaosmola-dev.github.io
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('solarcharge-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // zapytania API (POST) idą prosto do sieci
  if (new URL(req.url).origin !== self.location.origin) return; // Solarman, Tesla, prognoza, fonty — bez cache

  if (req.mode === 'navigate') {
    // strona: najpierw sieć (żeby łapać aktualizacje), offline z cache
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url('./index.html'), copy)); }
          return res;
        })
        .catch(() => caches.match(url('./index.html')).then(r => r || caches.match(url('./'))))
    );
    return;
  }

  // pozostałe pliki: cache, a w tle odświeżenie
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});

self.addEventListener('push', e => {
  let data = { title: 'SolarCharge', body: 'Status ładowania' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: url('icons/icon-192.png'),
      badge: url('icons/icon-192.png'),
      tag: 'solar-alert',
      renotify: true,
      data: { url: url('./?action=charge') }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || SCOPE;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(SCOPE) && 'focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
