// /public/serviceWorker.js
const VERSION       = 'v1.0.5';                 
const CACHE_PREFIX  = 'dev-suntec';             
const APP_SHELL_CACHE = `${CACHE_PREFIX}:app-shell:${VERSION}`;
const RUNTIME_CACHE   = `${CACHE_PREFIX}:runtime:${VERSION}`;

// Rutas precachear (App Shell)
const appShell = [
  // base
  '/public/',
  '/public/index.html',

  // manifest + iconos PWA
  '/public/manifest.json',
  '/public/assets/icons/icon-192.png',
  '/public/assets/icons/icon-192-maskable.png',
  '/public/assets/icons/icon-512.png',
  '/public/assets/icons/icon-512-maskable.png',

  // favicon / logos en pestaña/splash/login
  '/public/assets/logo3.png',
  '/public/assets/logo.png',

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

  // imágenes locales HOME 
  '/public/assets/hero.png',
  '/public/assets/panelCasa.jpg',
  '/public/assets/casaPanel.png',
  '/public/assets/parqueSolar.jpg',
  '/public/assets/monProd.png',

  // fallback offline
  '/public/offline.html',
];

// Helpers
const isStaticExt = (url) =>
  /\.(?:js|css|json|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|map|mp4|webm)$/i
    .test(url.pathname);

// ----- INSTALL: precache del App Shell -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting())
  );
});

// ----- ACTIVATE: limpia caches viejos (otros VERSION o sin prefijo) -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const allowed = new Set([APP_SHELL_CACHE, RUNTIME_CACHE]);
      return Promise.all(
        keys.map((k) => {
          // Borra todo lo que no sea el runtime/app-shell actual
          // y también cualquier caché que no empiece con el prefijo
          if (!allowed.has(k) || !k.startsWith(`${CACHE_PREFIX}:`)) {
            return caches.delete(k);
          }
          return Promise.resolve(false);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ----- FETCH -----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Navegaciones (HTML) -> Network-first, luego cache, luego offline.html
  const isNavigation = req.mode === 'navigate' && !isStaticExt(url);
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

  // 2) Estáticos (incluye .js, .css, imágenes, etc.) -> Cache-first con revalidación
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const resp = await fetch(req);
      const runtime = await caches.open(RUNTIME_CACHE);
      // Evitar cachear opacas si no quieres (CORS)
      if (resp.type === 'basic' || resp.type === 'default') {
        runtime.put(req, resp.clone());
      }
      return resp;
    } catch (err) {
      // Si falla la red, da lo que haya en cache (si hay)
      if (cached) return cached;
      throw err;
    }
  })());
});
