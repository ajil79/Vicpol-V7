/* VicPol Tool v7 — offline service worker.
   Cache-first for the app shell so a repeat visit (and a later offline open)
   works without the network. The cache name is versioned by the same date
   string as the ?v= cache-bust query in index.html — bump both together when
   any precached asset changes (see CLAUDE.md "Editing tips").

   Heavy OCR-only assets (Tesseract engine + language data, ~6.6 MB) are
   intentionally NOT precached — they're fetched normally the first time OCR
   is used, but ARE cached at that point via the runtime fallback below, so
   OCR keeps working offline on every visit after the first.
*/
const CACHE_VERSION = "20260924";
const CACHE_NAME = "vicpol-v7-" + CACHE_VERSION;

const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/icon.svg",
  "assets/css/app.css",
  "assets/js/core.js",
  "assets/js/reports.js",
  "assets/js/ocr.js",
  "assets/js/ui-data.js",
  "assets/js/recruit-helper.js",
  "assets/js/guide.js",
  "assets/js/interactions.js",
  "assets/data/charges.js",
  "assets/data/pins.js",
  "assets/data/items.js",
  "assets/data/recruit.js",
  "assets/data/guide.js",
  "assets/vendor/fonts/sans400.woff2",
  "assets/vendor/fonts/sans500.woff2",
  "assets/vendor/fonts/sans600.woff2",
  "assets/vendor/fonts/sans700.woff2",
  "assets/vendor/fonts/mono400.woff2",
  "assets/vendor/fonts/mono500.woff2",
  "assets/vendor/fonts/mono600.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      // A single missing/renamed file must not abort the whole install —
      // degrade to "no offline yet" rather than leaving no SW active at all.
      .catch((err) => console.warn("[sw] precache failed:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith("vicpol-v7-") && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle same-origin GET requests; let everything else (there
  // shouldn't be any cross-origin requests left — fonts are self-hosted)
  // pass straight through to the network.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache a copy of anything successfully fetched (this is how the
        // Tesseract OCR assets get cached on first use — see file header).
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Offline and not cached: for a navigation, fall back to the
        // shell page rather than a raw network-error screen.
        if (req.mode === "navigate") return caches.match("index.html");
        return Response.error();
      });
    })
  );
});
