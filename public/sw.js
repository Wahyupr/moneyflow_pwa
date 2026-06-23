/**
 * MoneyFlow Service Worker
 *
 * Strategies:
 *  1. App shell + static assets  → Cache-first  (/_next/static/**, /brand-mark.svg, etc.)
 *  2. API read endpoints          → Stale-while-revalidate (serve cache, fetch in background)
 *  3. API write endpoints (POST/PATCH/DELETE) → Network-only (no caching)
 *  4. Everything else             → Network-first, fall back to cache, then offline page
 */

const SHELL_CACHE   = "mf-shell-v3";
const STATIC_CACHE  = "mf-static-v3";
const API_CACHE     = "mf-api-v3";

// App shell files pre-cached on install
const SHELL_FILES = [
  "/",
  "/dashboard",
  "/manifest.webmanifest",
  "/brand-mark.svg"
];

// API paths we cache for offline read access
const CACHE_API_PATHS = [
  "/api/dashboard",
  "/api/wallets",
  "/api/transactions",
  "/api/profile",
  "/api/categories",
  "/api/merchants"
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const current = new Set([SHELL_CACHE, STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !current.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET from same origin (API writes)
  if (request.method !== "GET") return;

  // 1. Next.js static assets → cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 2. API read endpoints → stale-while-revalidate
  if (url.origin === self.location.origin && CACHE_API_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // 3. App shell pages + everything else → network-first, fall back to cache
  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// ── Strategy helpers ──────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fire background update regardless of whether we have a cached copy
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  return cached ?? (await networkPromise) ?? offlineApiResponse();
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? caches.match("/") ?? offlinePage();
  }
}

function offlineApiResponse() {
  return new Response(
    JSON.stringify({ error: "Offline — data belum tersedia.", offline: true }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = { title: "MoneyFlow", body: "Kamu punya pengingat tagihan.", url: "/reminders" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/brand-mark.svg",
      badge: "/brand-mark.svg",
      tag: "reminder",
      renotify: true,
      data: { url: data.url ?? "/reminders" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/reminders";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>MoneyFlow — Offline</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;background:#f8f9ff}
    .card{text-align:center;padding:2rem;border-radius:1rem;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:320px}
    h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#64748b;font-size:.875rem;margin:.5rem 0 1.5rem}
    a{display:inline-flex;align-items:center;background:#1668DC;color:#fff;border:none;border-radius:.75rem;padding:.75rem 1.5rem;font-weight:700;text-decoration:none;font-size:.875rem}</style>
    </head><body><div class="card">
    <div style="font-size:3rem">📡</div>
    <h1>Tidak ada koneksi</h1>
    <p>Koneksi internet kamu terputus. Data yang sudah di-cache tetap bisa dilihat.</p>
    <a href="/dashboard">Kembali ke Dashboard</a>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html;charset=utf-8" } }
  );
}
