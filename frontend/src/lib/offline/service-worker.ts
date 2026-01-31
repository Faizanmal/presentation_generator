/// <reference lib="webworker" />

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;

// Files to cache on install
const STATIC_FILES = [
  '/',
  '/offline',
  '/manifest.json',
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  '/api/themes',
  '/api/templates',
  '/api/fonts',
];

// Asset patterns to cache
const CACHEABLE_ASSET_PATTERNS = [
  /\.(jpg|jpeg|png|gif|webp|svg)$/i,
  /\.(woff|woff2|ttf|eot)$/i,
  /\.(css|js)$/i,
];

// TypeScript types for service worker events
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

// Cast self to avoid type conflicts
const sw = self as any;

// Install event - cache static files
sw.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES);
    }).then(() => {
      return sw.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== DYNAMIC_CACHE &&
            cacheName !== API_CACHE &&
            cacheName !== ASSET_CACHE
          ) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return sw.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
sw.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Asset requests
  if (isAssetRequest(url.pathname)) {
    event.respondWith(handleAssetRequest(request));
    return;
  }

  // Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Other static files
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests - Network first, then cache
async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isCacheable = CACHEABLE_API_PATTERNS.some((pattern) => url.pathname.includes(pattern));

  try {
    const response = await fetch(request);

    if (response.ok && isCacheable) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline response for API
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'You are currently offline' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Handle asset requests - Cache first, then network
async function handleAssetRequest(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    // Return placeholder for images
    if (request.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return createPlaceholderImage();
    }

    return new Response('Asset not available offline', { status: 503 });
  }
}

// Handle navigation requests - Network first, then cache, then offline page
async function handleNavigationRequest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    // Try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }

    // Fallback offline response
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline - Presentation Generator</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #333;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
          p { color: #666; margin-bottom: 2rem; }
          button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            border-radius: 0.5rem;
            cursor: pointer;
          }
          button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📡 You're Offline</h1>
          <p>Don't worry - your work is saved locally and will sync when you're back online.</p>
          <button onclick="window.location.reload()">Try Again</button>
        </div>
      </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

// Handle static requests - Stale while revalidate
async function handleStaticRequest(request: Request): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(STATIC_CACHE);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached || new Response('Not available', { status: 503 }));

  return cached || fetchPromise;
}

// Helper to check if request is for an asset
function isAssetRequest(pathname: string): boolean {
  return CACHEABLE_ASSET_PATTERNS.some((pattern) => pattern.test(pathname));
}

// Create a placeholder image for offline
function createPlaceholderImage(): Response {
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e5e7eb"/>
      <text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="16">
        Image unavailable offline
      </text>
    </svg>
  `;

  return new Response(svg, {
    status: 200,
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}

// Background sync
sw.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-presentations') {
    event.waitUntil(syncPresentations());
  }
});

async function syncPresentations(): Promise<void> {
  // Notify the app to run sync
  const clients = await sw.clients.matchAll();
  clients.forEach((client: any) => {
    client.postMessage({
      type: 'SYNC_REQUIRED',
    });
  });
}

// Push notifications
sw.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() || {};

  const options: any = {
    body: data.body || 'You have a notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: data.data,
    actions: data.actions || [],
  };

  event.waitUntil(
    sw.registration.showNotification(data.title || 'Presentation Generator', options)
  );
});

// Notification click handler
sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    sw.clients.matchAll({ type: 'window' }).then((clients: any) => {
      // Check if there's already a window open
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window
      return sw.clients.openWindow(urlToOpen);
    })
  );
});

// Message handler for communication with the app
sw.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      sw.skipWaiting();
      break;

    case 'CACHE_URLS':
      caches.open(DYNAMIC_CACHE).then((cache) => {
        cache.addAll(payload.urls);
      });
      break;

    case 'CLEAR_CACHE':
      caches.keys().then((cacheNames) => {
        Promise.all(cacheNames.map((name) => caches.delete(name)));
      });
      break;
  }
});
