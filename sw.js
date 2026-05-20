const CACHE = 'solarcharge-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];
sw.jsself.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'SolarCharge', body: 'Status ladowania' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      tag: 'solar-alert',
      renotify: true,
      data: { url: '/?action=charge' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'charge') e.waitUntil(clients.openWindow('/?action=charge'));
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'solar-check') e.waitUntil(checkSolarSurplus());
});

async function checkSolarSurplus() {
  const surplus = Math.random() * 5;
  if (surplus > 1.5) {
    self.registration.showNotification('SolarCharge - laduj teraz!', {
      body: 'Nadwyzka ' + surplus.toFixed(1) + ' kW!',
      icon: '/icons/icon-192.png',
      tag: 'solar-alert'
    });
  }
}
