"use strict";

const CACHE_NAME = "broken-path-v25";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=1.6.2",
  "./game.js?v=1.6.2",
  "./maze-levels.js?v=1.6.2",
  "./seeded-levels.js?v=1.6.2",
  "./daily-levels.js?v=1.6.2",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable.svg",
  "./assets/icon-maskable-192.png",
  "./assets/icon-maskable-512.png",
  "./assets/share-card-v2.jpg"
];
const APP_ROOT_URL = new URL("./", self.location.href);
const APP_INDEX_URL = new URL("./index.html", self.location.href);
const CORE_ASSET_URLS = new Set(CORE_ASSETS.map((asset) => new URL(asset, self.location.href).href));

function isAppNavigation(url) {
  return url.origin === APP_ROOT_URL.origin
    && (url.pathname === APP_ROOT_URL.pathname || url.pathname === APP_INDEX_URL.pathname);
}

function isCacheableResponse(response) {
  return Boolean(response?.ok && response.type === "basic");
}

function refreshCoreAssetCache(event, request, response) {
  try {
    const copy = response.clone();
    const update = caches.open(CACHE_NAME)
      .then((cache) => cache.put(request, copy))
      .catch(() => {});
    event.waitUntil(update);
  } catch (_) {}
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("broken-path-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try { url = new URL(request.url); }
  catch (_) { return; }
  if (url.origin !== APP_ROOT_URL.origin) return;
  if (request.mode === "navigate") {
    if (!isAppNavigation(url)) return;
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) return response;
      return (await caches.match(APP_INDEX_URL.href)) || response;
    }).catch(() => caches.match(APP_INDEX_URL.href)));
    return;
  }
  if (!CORE_ASSET_URLS.has(url.href)) return;
  event.respondWith(fetch(request).then(async (response) => {
    if (response.ok) {
      if (isCacheableResponse(response)) refreshCoreAssetCache(event, request, response);
      return response;
    }
    return (await caches.match(request)) || response;
  }).catch(() => caches.match(request)));
});
