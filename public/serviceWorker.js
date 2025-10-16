// /public/serviceWorker.js
const VERSION = 'v1.0.1'; // <-- subir cuando se cambie la version
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE   = `runtime-${VERSION}`;

// Rutas
const appShell = [
  // base
  '/public/',
  '/public/index.html',

  // estilos
  '/public/styles/base.css',
  '/public/styles/theme.css',

  // core
  '/public/core/router.js',
  '/public/core/guards.js',
  '/public/core/auth.js',
  '/public/core/layout.js',

  // utils
  '/public/utils/dom.js',

  // componentes usados por layout
  '/public/components/topbar/topbar.html',
  '/public/components/sidebar/sidebar.html',
  '/public/components/footer/footer.html',

  // pantallas mínimas
  '/public/screens/splash/splash.html',
  '/public/screens/splash/splash.js',
  '/public/screens/home/home.html',
  '/public/screens/home/home.js',
  '/public/screens/login/login.html',
  '/public/screens/login/login.js',

  // fallback offline
  '/public/offline.html',
];

// Helpers
const isStaticExt = (url) => {
  // Si termina en estas extensiones, NO es navegación
  return /\.(?:js|css|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|map|mp4|webm)$/i.test(url.pathname);
};

// Instalación: precache del App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(appShell))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Solo tratamos como navegación si el modo es 'navigate'
  //    (y además nos aseguramos de que no lleva extensión de archivo)
  const isNavigation = req.mode === 'navigate' && !isStaticExt(url);

  // 2) Navegaciones -> Network-first (si falla: cache -> offline.html)
  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const runtime = await caches.open(RUNTIME_CACHE);
        runtime.put(req, resp.clone());
        return resp;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || caches.match('/public/offline.html');
      }
    })());
    return;
  }

  // 3) Peticiones estáticas (incluye módulos .js) -> Cache-first con revalidación
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      const runtime = await caches.open(RUNTIME_CACHE);
      // Evita cachear respuestas opacas de otros orígenes si no quieres
      if (resp.type === 'basic' || resp.type === 'default') {
        runtime.put(req, resp.clone());
      }
      return resp;
    } catch (err) {
      // Si falla red… devuelve lo que hubiese en cache (si hay)
      if (cached) return cached;
      throw err;
    }
  })());
});
