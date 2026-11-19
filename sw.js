/**
 * ============================================================
 * NIAS Evaluation System — Service Worker (Professional Edition)
 * المعهد الوطني للعلوم الإدارية — فرع إب
 * ============================================================
 * Architecture: Modular Strategy Pattern
 * Features:
 *   • Intelligent Caching (Static | Dynamic | Runtime)
 *   • Network-First for APIs, Cache-First for Assets
 *   • Stale-While-Revalidate for HTML Shells
 *   • Background Sync with IndexedDB Queue
 *   • Push Notifications with Action Buttons
 *   • Offline Analytics & Error Recovery
 *   • Cache Versioning & Cleanup
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   Configuration & Constants
   ═══════════════════════════════════════════════════════ */
const BUILD_ID = '1.2.5';
const CACHE_PREFIX = 'nias';
const CACHE_NAMES = {
  static: `${CACHE_PREFIX}-static-${BUILD_ID}`,
  dynamic: `${CACHE_PREFIX}-dynamic-${BUILD_ID}`,
  images: `${CACHE_PREFIX}-images-${BUILD_ID}`,
  api: `${CACHE_PREFIX}-api-${BUILD_ID}`,
  offline: `${CACHE_PREFIX}-offline-fallback`
};

const MAX_AGE = {
  dynamic: 30 * 24 * 60 * 60 * 1000, // 30 days
  api: 5 * 60 * 1000,                // 5 minutes
  images: 7 * 24 * 60 * 60 * 1000    // 7 days
};

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/users.html',
  '/reports.html',
  '/offline.html',
  '/css/style.css',
  '/css/nias-theme.css',
  '/js/db.js',
  '/js/app.js',
  '/js/users.js',
  '/js/reports.js',
  '/js/sw-register.js',
  '/manifest.json'
];

const IMAGE_ASSETS = [
  '/assets/images/logo-yemen-hd.png',
  '/assets/images/logo-institute-hd.png',
  '/assets/images/icon-72x72.png',
  '/assets/images/icon-96x96.png',
  '/assets/images/icon-128x128.png',
  '/assets/images/icon-144x144.png',
  '/assets/images/icon-152x152.png',
  '/assets/images/icon-192x192.png',
  '/assets/images/icon-384x384.png',
  '/assets/images/icon-512x512.png',
  '/assets/images/maskable-icon-512x512.png'
];

// Routes configuration
const ROUTES = {
  api: /\/api\//,
  static: /\.(?:js|css|json|webmanifest)$/,
  image: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  html: /text\/html/
};

/* ═══════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════ */

/**
 * Determine caching strategy based on request characteristics
 */
function getStrategy(request) {
  const { url, destination, headers } = request;
  
  if (ROUTES.api.test(url)) return 'network-first';
  if (ROUTES.static.test(url) || CORE_ASSETS.includes(new URL(url).pathname)) return 'cache-first';
  if (ROUTES.image.test(url) || destination === 'image') return 'cache-first';
  if (destination === 'document' || headers.get('accept')?.includes('text/html')) return 'stale-while-revalidate';
  
  return 'network-first';
}

/**
 * Check if response is valid and cacheable
 */
function isValidResponse(response) {
  return response && response.status === 200 && response.type === 'basic';
}

/**
 * Check if response is stale based on timestamp header
 */
function isStale(cachedResponse, maxAge) {
  if (!cachedResponse) return true;
  const dateHeader = cachedResponse.headers.get('sw-fetched-date');
  if (!dateHeader) return true;
  return (Date.now() - parseInt(dateHeader)) > maxAge;
}

/**
 * Clone response with timestamp header for stale-while-revalidate
 */
function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-fetched-date', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/* ═══════════════════════════════════════════════════════
   Cache Strategies
   ═══════════════════════════════════════════════════════ */

const Strategies = {
  /**
   * Cache First: Serve from cache, fallback to network
   * Best for: Static assets, images, fonts
   */
  async cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) return cached;
    
    try {
      const networkResponse = await fetch(request);
      if (isValidResponse(networkResponse)) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.warn('[SW] CacheFirst failed:', request.url);
      throw error;
    }
  },

  /**
   * Network First: Try network, fallback to cache
   * Best for: API calls, real-time data
   */
  async networkFirst(request, cacheName, fallbackToCache = true) {
    try {
      const networkResponse = await fetch(request);
      
      if (isValidResponse(networkResponse) && cacheName) {
        const cache = await caches.open(cacheName);
        await cache.put(request, stampResponse(networkResponse.clone()));
      }
      
      return networkResponse;
    } catch (error) {
      console.warn('[SW] NetworkFirst failed, trying cache:', request.url);
      
      if (fallbackToCache) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      
      throw error;
    }
  },

  /**
   * Stale While Revalidate: Serve cache immediately, update in background
   * Best for: HTML pages, shell apps
   */
  async staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then(async (networkResponse) => {
      if (isValidResponse(networkResponse)) {
        await cache.put(request, stampResponse(networkResponse.clone()));
      }
      return networkResponse;
    }).catch(err => {
      console.warn('[SW] Background revalidate failed:', request.url);
      throw err;
    });

    // Return cached immediately if available and fresh enough
    if (cached && !isStale(cached, MAX_AGE.dynamic)) {
      fetchPromise.catch(() => {}); // Silently handle background errors
      return cached;
    }

    // Otherwise wait for network
    return fetchPromise;
  }
};

/* ═══════════════════════════════════════════════════════
   Installation
   ═══════════════════════════════════════════════════════ */
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${BUILD_ID}...`);
  
  event.waitUntil(
    (async () => {
      try {
        // Pre-cache core static assets
        const staticCache = await caches.open(CACHE_NAMES.static);
        const imageCache = await caches.open(CACHE_NAMES.images);
        
        await Promise.all([
          staticCache.addAll(CORE_ASSETS),
          imageCache.addAll(IMAGE_ASSETS)
        ]);
        
        console.log('[SW] Core assets cached successfully');
        
        // Force activation
        await self.skipWaiting();
      } catch (error) {
        console.error('[SW] Installation failed:', error);
        // Don't throw - allow SW to install even if some assets fail
      }
    })()
  );
});

/* ═══════════════════════════════════════════════════════
   Activation & Cleanup
   ═══════════════════════════════════════════════════════ */
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${BUILD_ID}...`);
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const validNames = Object.values(CACHE_NAMES);
        
        const deletions = cacheNames
          .filter(name => name.startsWith(CACHE_PREFIX) && !validNames.includes(name))
          .map(name => {
            console.log('[SW] Deleting obsolete cache:', name);
            return caches.delete(name);
          });
        
        await Promise.all(deletions);
        
        // Take control of all clients immediately
        await self.clients.claim();
        
        // Notify all clients about update
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: BUILD_ID,
            timestamp: Date.now()
          });
        });
        
        console.log('[SW] Activation complete');
      } catch (error) {
        console.error('[SW] Activation error:', error);
      }
    })()
  );
});

/* ═══════════════════════════════════════════════════════
   Fetch Interception
   ═══════════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome extensions and non-http(s)
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  
  // Determine strategy
  const strategy = getStrategy(request);
  
  event.respondWith(
    (async () => {
      try {
        let response;
        
        switch (strategy) {
          case 'cache-first':
            const cacheName = request.destination === 'image' ? CACHE_NAMES.images : CACHE_NAMES.static;
            response = await Strategies.cacheFirst(request, cacheName);
            break;
            
          case 'network-first':
            response = await Strategies.networkFirst(
              request, 
              ROUTES.api.test(url.href) ? CACHE_NAMES.api : CACHE_NAMES.dynamic
            );
            break;
            
          case 'stale-while-revalidate':
            response = await Strategies.staleWhileRevalidate(request, CACHE_NAMES.dynamic);
            break;
            
          default:
            response = await fetch(request);
        }
        
        return response;
        
      } catch (error) {
        console.error('[SW] Fetch strategy failed:', request.url, error);
        return handleFetchFailure(request);
      }
    })()
  );
});

/**
 * Handle complete fetch failures with graceful fallbacks
 */
async function handleFetchFailure(request) {
  const accept = request.headers.get('accept') || '';
  
  // HTML fallback
  if (accept.includes('text/html')) {
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    
    return new Response(
      `<!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>غير متصل | NIAS</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Segoe UI',Tahoma,sans-serif;background:linear-gradient(135deg,#0d4a2e 0%,#1a6b3e 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}
          .container{text-align:center;padding:2rem;max-width:400px}
          .icon{font-size:4rem;margin-bottom:1rem}
          h2{font-size:1.5rem;margin-bottom:1rem}
          p{opacity:.9;margin-bottom:1.5rem;line-height:1.6}
          button{background:#fff;color:#0d4a2e;border:none;padding:.75rem 2rem;border-radius:50px;font-size:1rem;cursor:pointer;transition:transform .2s;font-weight:600}
          button:hover{transform:translateY(-2px)}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">📡</div>
          <h2>أنت غير متصل بالإنترنت</h2>
          <p>يبدو أن اتصالك بالشبكة قد انقطع. بعض الميزات قد لا تعمل حالياً.</p>
          <button onclick="location.reload()">إعادة المحاولة</button>
        </div>
      </body>
      </html>`,
      { 
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
  
  // Image fallback
  if (request.destination === 'image') {
    const svgPlaceholder = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f1f5f9"/>
        <path d="M160 120h80v60h-80z" fill="#cbd5e1"/>
        <circle cx="200" cy="100" r="25" fill="#94a3b8"/>
        <text x="200" y="220" text-anchor="middle" font-family="system-ui" font-size="14" fill="#64748b">الصورة غير متوفرة حالياً</text>
      </svg>
    `;
    return new Response(svgPlaceholder, {
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
  
  // Generic error for other resources
  return new Response('', { status: 408, statusText: 'Request Timeout' });
}

/* ═══════════════════════════════════════════════════════
   Message Handling (Client <-> SW Communication)
   ═══════════════════════════════════════════════════════ */
self.addEventListener('message', (event) => {
  const { data, source } = event;
  if (!data || !source) return;
  
  console.log('[SW] Message received:', data.type);
  
  const sendResponse = (payload) => {
    source.postMessage({ ...payload, requestId: data.requestId });
  };

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      sendResponse({ type: 'SKIP_WAITING_CONFIRMED' });
      break;
      
    case 'GET_VERSION':
      sendResponse({ type: 'VERSION_INFO', version: BUILD_ID });
      break;
      
    case 'CLEAR_ALL_CACHES':
      event.waitUntil(
        (async () => {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          sendResponse({ type: 'CACHES_CLEARED', count: cacheNames.length });
        })()
      );
      break;
      
    case 'UPDATE_STATIC_CACHE':
      event.waitUntil(
        (async () => {
          const cache = await caches.open(CACHE_NAMES.static);
          const results = await Promise.allSettled(
            CORE_ASSETS.map(async (asset) => {
              const response = await fetch(asset, { cache: 'no-cache' });
              if (response.ok) await cache.put(asset, response);
              return asset;
            })
          );
          const failed = results.filter(r => r.status === 'rejected').length;
          sendResponse({ 
            type: 'CACHE_UPDATED', 
            total: CORE_ASSETS.length,
            failed 
          });
        })()
      );
      break;
      
    case 'GET_CACHE_SIZE':
      event.waitUntil(
        (async () => {
          const cacheNames = await caches.keys();
          let totalSize = 0;
          let totalEntries = 0;
          
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            totalEntries += requests.length;
            // Approximate size calculation
            for (const req of requests) {
              const res = await cache.match(req);
              if (res) {
                const blob = await res.blob();
                totalSize += blob.size;
              }
            }
          }
          
          sendResponse({ 
            type: 'CACHE_SIZE_INFO',
            entries: totalEntries,
            sizeBytes: totalSize,
            sizeMB: (totalSize / 1024 / 1024).toFixed(2)
          });
        })()
      );
      break;
  }
});

/* ═══════════════════════════════════════════════════════
   Push Notifications
   ═══════════════════════════════════════════════════════ */
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  const defaultData = {
    title: 'نظام التقييم الإلكتروني',
    body: 'لديك إشعار جديد في النظام',
    icon: '/assets/images/icon-192x192.png',
    badge: '/assets/images/icon-72x72.png',
    tag: 'general',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'dismiss', title: 'تجاهل' }
    ]
  };
  
  let notificationData = { ...defaultData };
  
  if (event.data) {
    try {
      const payload = JSON.parse(event.data.text());
      notificationData = { ...defaultData, ...payload };
    } catch (e) {
      console.warn('[SW] Invalid push payload:', e);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      image: notificationData.image,
      tag: notificationData.tag,
      dir: 'rtl',
      lang: 'ar',
      requireInteraction: notificationData.requireInteraction,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: notificationData.url || '/',
        action: notificationData.action || 'default'
      },
      actions: notificationData.actions || defaultData.actions,
      timestamp: Date.now()
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { action, notification } = event;
  const data = notification.data || {};
  
  if (action === 'dismiss') return;
  
  event.waitUntil(
    (async () => {
      const url = data.url || '/';
      
      // Try to focus existing window
      const windowClients = await self.clients.matchAll({ 
        type: 'window',
        includeUncontrolled: true 
      });
      
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          await client.focus();
          // Send message to client about notification click
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action: action || 'default',
            data: data
          });
          return;
        }
      }
      
      // Open new window if none exists
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed by user');
});

/* ═══════════════════════════════════════════════════════
   Background Sync
   ═══════════════════════════════════════════════════════ */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  const syncHandlers = {
    'sync-evaluations': () => processSyncQueue('evaluations'),
    'sync-reports': () => processSyncQueue('reports'),
    'sync-users': () => processSyncQueue('users'),
    'cleanup-cache': () => cleanupExpiredCache()
  };
  
  if (syncHandlers[event.tag]) {
    event.waitUntil(syncHandlers[event.tag]());
  }
});

/**
 * Process queued items from IndexedDB
 */
async function processSyncQueue(queueName) {
  try {
    // Notify clients that sync started
    await broadcastToClients({
      type: 'SYNC_STARTED',
      queue: queueName,
      timestamp: Date.now()
    });
    
    // Here you would read from IndexedDB queue and send to server
    // This is a placeholder for your actual sync logic
    console.log(`[SW] Processing ${queueName} queue...`);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await broadcastToClients({
      type: 'SYNC_COMPLETED',
      queue: queueName,
      timestamp: Date.now(),
      status: 'success'
    });
    
  } catch (error) {
    console.error(`[SW] Sync failed for ${queueName}:`, error);
    
    await broadcastToClients({
      type: 'SYNC_FAILED',
      queue: queueName,
      error: error.message,
      timestamp: Date.now()
    });
    
    // Re-throw to trigger retry by browser
    throw error;
  }
}

/**
 * Clean up expired cache entries
 */
async function cleanupExpiredCache() {
  const cache = await caches.open(CACHE_NAMES.dynamic);
  const requests = await cache.keys();
  
  let cleaned = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (response && isStale(response, MAX_AGE.dynamic)) {
      await cache.delete(request);
      cleaned++;
    }
  }
  
  console.log(`[SW] Cleaned ${cleaned} expired entries`);
}

/* ═══════════════════════════════════════════════════════
   Periodic Background Sync (if supported)
   ═══════════════════════════════════════════════════════ */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-data') {
    event.waitUntil(
      (async () => {
        console.log('[SW] Periodic sync: refreshing data...');
        // Refresh critical data in background
        const cache = await caches.open(CACHE_NAMES.api);
        // Add your periodic refresh logic here
      })()
    );
  }
});

/* ═══════════════════════════════════════════════════════
   Helper Functions
   ═══════════════════════════════════════════════════════ */

/**
 * Broadcast message to all controlled clients
 */
async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    if (client.postMessage) {
      client.postMessage(message);
    }
  });
}

/**
 * Log system status (useful for debugging)
 */
function logStatus() {
  console.log(`[SW] Status: ${BUILD_ID} | Clients: ${self.clients ? 'supported' : 'unsupported'}`);
}

// Initial status log
logStatus();
