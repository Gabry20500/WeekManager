/*
 * Service worker: keeps the whole app available offline.
 *
 * This file is a template. The build (see vite.config.ts) replaces the two
 * placeholders below and writes the result as `sw.js` next to index.html.
 * The app's data lives in localStorage and is never touched here.
 */

const CACHE = "diario-__VERSION__";
const FILES = "__FILES__";

/** Path of a URL relative to the folder the app is served from, as listed in FILES. */
function relativePath(url) {
  const base = new URL("./", self.location.href).pathname;
  return new URL(url).pathname.slice(base.length);
}

self.addEventListener("install", (event) => {
  // Download every file of this version before it can take over.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop the files of previous versions.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// The page asks for this when the user accepts an update.
self.addEventListener("message", (event) => {
  if (event.data === "activate-update") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Any navigation opens the single page of the app. Files are matched by
      // address only: servers add `Vary` headers that would otherwise make a
      // cached script or stylesheet miss.
      const cached = await cache.match(request.mode === "navigate" ? "./" : request.url, {
        ignoreSearch: true,
        ignoreVary: true,
      });
      if (cached) return cached;

      // Not in the cache (e.g. the browser evicted it): fetch it and keep a
      // copy, so the app repairs itself the next time it is online.
      const response = await fetch(request);
      if (response.ok && FILES.includes(request.mode === "navigate" ? "./" : relativePath(request.url))) {
        await cache.put(request.mode === "navigate" ? "./" : request.url, response.clone());
      }
      return response;
    })(),
  );
});
