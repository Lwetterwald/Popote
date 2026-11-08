/* Popote – fonctionnement hors connexion (écran d'accueil de l'iPad et de l'iPhone) */
const CACHE_NAME = 'popote-cache-v2';
const ASSETS = ['./', './index.html', './icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // un fichier absent ne doit pas empêcher l'installation
      Promise.all(ASSETS.map((u) =>
        fetch(new Request(u, { cache: 'reload' })).then((r) => { if (r.ok) return cache.put(u, r); }).catch(() => {})
      ))
    )
  );
  // Pas de skipWaiting : la nouvelle version prend le relais au prochain lancement.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Autres sites (recherche des produits sur Open Food Facts) : toujours en direct, jamais mis en cache
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isPage) {
    // Page : le réseau d'abord (pour recevoir les mises à jour), la copie hors connexion sinon
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.ok) {
            const c1 = response.clone(), c2 = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all([
              cache.put('./index.html', c1), cache.put('./', c2)
            ])).catch(() => {}));
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html', { ignoreSearch: true })
            .then((c) => c || caches.match('./', { ignoreSearch: true }))
        )
    );
    return;
  }
  // Autres fichiers (icône) : la copie d'abord, le réseau sinon
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {}));
      }
      return response;
    }))
  );
});
