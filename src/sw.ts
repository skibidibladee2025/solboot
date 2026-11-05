// Service Worker for PWA/offline support
// This is registered by the main module

/// <reference lib="webworker" />

const CACHE_NAME = 'solboot-v1';
const ASSET_CACHE = 'v86-assets-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/style.css',
  '/src/main.ts',
  '/src/logo.jpg',
  '/src/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== ASSET_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except for v86 assets)
  if (url.origin !== location.origin && !url.href.includes('github.com/copy/v86')) {
    return;
  }

  // Handle v86 BIOS/WASM assets with Cache API (separate cache)
  if (url.href.includes('github.com/copy/v86') || url.href.endsWith('v86.wasm')) {
    event.respondWith(handleAssetRequest(request));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(handleStaticRequest(request));
});

async function handleStaticRequest(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached response and update in background
    const swEvent = self.addEventListener as unknown as ((type: string, listener: (e: ExtendableEvent) => void) => void);
    // We can't directly call waitUntil here without the event, so we skip background update
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/index.html') || new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

async function handleAssetRequest(request: Request): Promise<Response> {
  const cache = await caches.open(ASSET_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

// Update cache in background - called from fetch handler with event
async function updateCacheWithEvent(event: ExtendableEvent, request: Request, cache: Cache): Promise<void> {
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
        }
      } catch {
        // Ignore network errors for background updates
      }
    })()
  );
}