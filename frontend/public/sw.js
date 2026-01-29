/// <reference lib="webworker" />

const CACHE_NAME = 'presentation-designer-v1';
const OFFLINE_URL = '/offline';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes that should use network-first strategy
const API_ROUTES = ['/api/'];

// Assets that should use cache-first strategy
const STATIC_ASSETS = [
  /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/,
];

// Install event - precache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      // Force the waiting service worker to become active
      await self.skipWaiting();
    })()
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      // Take control of all pages immediately
      await self.clients.claim();
    })()
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API routes - network first, then cache
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first, then network
  if (STATIC_ASSETS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Default - stale while revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return cached response if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response);
        });
      }
    });
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  return cachedResponse || networkPromise;
}

// Navigation handler with offline fallback
async function navigationHandler(request) {
  try {
    // Try to preload the page
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }
    
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Return offline page
    const cachedResponse = await caches.match(OFFLINE_URL);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Presentation Designer</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            h1 { color: #333; }
            p { color: #666; }
            button {
              background: #3B82F6;
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              cursor: pointer;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
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

// Handle background sync for offline changes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-presentations') {
    event.waitUntil(syncPresentations());
  }
});

async function syncPresentations() {
  // Get pending changes from IndexedDB and sync
  const clients = await self.clients.matchAll();
  
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_STARTED',
    });
  });
  
  // Actual sync logic would be handled by the main app
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const url = event.notification.data.url;
  
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      
      // Check if there's already a window open
      for (const client of allClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_PROJECT') {
    cacheProject(event.data.projectId, event.data.data);
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

// Cache a specific project for offline use
async function cacheProject(projectId, data) {
  const cache = await caches.open(`project-${projectId}`);
  
  // Cache project data
  await cache.put(
    `/api/projects/${projectId}`,
    new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  
  // Cache project assets (images, etc.)
  if (data.slides) {
    for (const slide of data.slides) {
      if (slide.blocks) {
        for (const block of slide.blocks) {
          if (block.type === 'IMAGE' && block.content?.url) {
            try {
              const response = await fetch(block.content.url);
              await cache.put(block.content.url, response);
            } catch (error) {
              console.log('Failed to cache image:', block.content.url);
            }
          }
        }
      }
    }
  }
}
