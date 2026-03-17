/* sw.js — ensaYOnesa PWA offline
 * Estrategia (mejorada):
 * - Precache (app shell) para arranque offline inmediato
 * - Navegación (HTML) => cache-first (stale-while-revalidate) con fallback a index.html
 * - Same-origin (css/js/img) => cache-first (busca en runtime + appshell)
 * - Cross-origin (CDNs) => stale-while-revalidate (busca en runtime + appshell)
 * - Timeout de red para evitar “pantalla en blanco” por fetch colgado en móviles
 */

const CACHE_VERSION = 'v.1.0'; // ⬅️ cambia para forzar update
const APP_SHELL_CACHE = `ensayonesa-appshell-${CACHE_VERSION}`;
const RUNTIME_CACHE   = `ensayonesa-runtime-${CACHE_VERSION}`;

// Helper: resuelve rutas relativas al scope real del SW (soporta subcarpetas)
const SCOPE = self.registration.scope;
const toURL = (path) => new URL(path, SCOPE).toString();

const OFFLINE_FALLBACK_HTML = toURL('./index.html');

const APP_SHELL = [
  // HTML principal
  toURL('./index.html'),
  toURL('./'),

  // CSS/JS
  toURL('./styles.css'),
  toURL('./app.js'),
  toURL('./export.js'),
  toURL('./preview.js'),
  toURL('./dictado.js'),
  toURL('./i18n.js'),

  // i18n (mínimo: español)
  toURL('./es.json'),

  // manifest + icon básico
  toURL('./manifest.webmanifest'),
  toURL('./icons/icon.svg'),

  // Imágenes usadas por tu HTML
  toURL('./assets/img/logo.png'),
  toURL('./assets/img/ensayonesa512.png'),

  // Icons del manifest (para que NO fallen en offline)
  toURL('./assets/img/ensayonesa192.png'),
  toURL('./assets/img/ensayonesa-maskable-192.png'),
  toURL('./assets/img/ensayonesa-maskable-512.png'),
  toURL('./assets/img/ensayonesa180.png')
];

// Externos (CDN)
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
];

async function safeAdd(cache, requestOrUrl) {
  try {
    await cache.add(requestOrUrl);
    return true;
  } catch (err) {
    console.warn('[SW] Precache FAILED:', requestOrUrl, err);
    return false;
  }
}

function shouldCacheResponse(resp){
  return !!resp && (resp.status === 200 || resp.type === 'opaque');
}

function fetchWithTimeout(request, ms){
  // Si el navegador no soporta AbortController en SW, caemos al fetch normal
  if (typeof AbortController === 'undefined') return fetch(request);

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function matchFromCaches(request, options){
  const runtime = await caches.open(RUNTIME_CACHE);
  const hitRuntime = await runtime.match(request, options);
  if (hitRuntime) return hitRuntime;

  const shell = await caches.open(APP_SHELL_CACHE);
  return shell.match(request, options);
}

async function putInRuntime(request, response){
  if(!shouldCacheResponse(response)) return;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
}

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return request.method === 'GET' && accept.includes('text/html');
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);

    // 1) App shell (uno a uno para que no falle toda la instalación)
    for (const url of APP_SHELL) {
      await safeAdd(cache, url);
    }

    // 2) Externos (CDN) (no-cors => opaque cache)
    for (const url of EXTERNAL_ASSETS) {
      try {
        await safeAdd(cache, new Request(url, { mode: 'no-cors' }));
      } catch (_) {}
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Navigation preload (si existe) ayuda a que el HTML llegue rápido
    try{
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    }catch(_){}

    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE) {
          return caches.delete(k);
        }
        return Promise.resolve(false);
      })
    );

    await self.clients.claim();
  })());
});

async function handleNavigation(event){
  const request = event.request;

  // 1) Si hay preloadResponse, úsalo (cuando navigationPreload está activo)
  try{
    const preload = await event.preloadResponse;
    if(preload){
      // Guarda en runtime y devuelve
      event.waitUntil(putInRuntime(request, preload.clone()));
      return preload;
    }
  }catch(_){}

  // 2) Respuesta inmediata desde caché (ignorando query)
  const cached = await matchFromCaches(request, { ignoreSearch: true });
  const shellIndex = await matchFromCaches(OFFLINE_FALLBACK_HTML);

  // 3) Revalidación en background (con timeout)
  const updatePromise = (async () => {
    try{
      const fresh = await fetchWithTimeout(request, 6500);
      if(shouldCacheResponse(fresh)){
        await putInRuntime(request, fresh.clone());
      }
      return fresh;
    }catch(_){
      return null;
    }
  })();

  // Si hay caché, devolvemos caché ya y actualizamos en background
  if(cached){
    event.waitUntil(updatePromise);
    return cached;
  }

  // Si no había caché, intentamos red (timeout) y si falla devolvemos index.html
  const fresh = await updatePromise;
  if(fresh) return fresh;

  if(shellIndex) return shellIndex;

  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function handleSameOriginAsset(event){
  const request = event.request;

  // 1) cache-first (runtime + appshell)
  const cached = await matchFromCaches(request);
  if(cached) return cached;

  // 2) red con timeout
  try{
    const fresh = await fetchWithTimeout(request, 8000);
    if(shouldCacheResponse(fresh)){
      event.waitUntil(putInRuntime(request, fresh.clone()));
    }
    return fresh;
  }catch(_){
    // 3) último intento: appshell
    const fallback = await matchFromCaches(request);
    return fallback || new Response('', { status: 504 });
  }
}

async function handleCrossOrigin(event){
  const request = event.request;

  // 1) cache (runtime + appshell) primero
  const cached = await matchFromCaches(request);

  // 2) revalidar con timeout
  const fetchPromise = (async () => {
    try{
      const fresh = await fetchWithTimeout(request, 8000);
      if(shouldCacheResponse(fresh)){
        await putInRuntime(request, fresh.clone());
      }
      return fresh;
    }catch(_){
      return null;
    }
  })();

  if(cached){
    event.waitUntil(fetchPromise);
    return cached;
  }

  const fresh = await fetchPromise;
  return fresh || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // ✅ Fix clásico: evita error con only-if-cached en requests no-same-origin
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  // 1) Navegación HTML
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(event));
    return;
  }

  const url = new URL(request.url);

  // 2) Same-origin => cache-first mejorado
  if (url.origin === self.location.origin) {
    event.respondWith(handleSameOriginAsset(event));
    return;
  }

  // 3) Cross-origin => stale-while-revalidate (runtime + appshell)
  event.respondWith(handleCrossOrigin(event));
});
