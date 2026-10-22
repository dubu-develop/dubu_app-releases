// Dubu service worker (web-pwa P3). tool/web/postbuild.dart fills the two
// placeholders and writes the result as sw.js; this template is removed from
// the build. Rules:
// - Install precaches every listed file of THIS build into its own cache,
//   fetched as `<path>?v=<build>` with no-store and its sha256 integrity.
//   Any failure fails the install and the previous worker stays.
// - No skipWaiting except on the SKIP_WAITING message from the page.
// - Activate deletes the caches of other builds.
// - Fetch: navigations get the cached index.html; precached paths are
//   cache-first matched by pathname (query ignored); everything else,
//   including app-version.json, goes to the network and is never cached.
//   Only GET is handled; user data is never cached.
"use strict";

const BUILD = 1080;
const FILES = [["assets/AssetManifest.bin","sha256-AK9VrT1vIYmP534P8JLRoc2lLJQbaGDpko1FyK+MCV0="],["assets/AssetManifest.bin.json","sha256-hGC19Cmcoe1nfFpUyAOK6c8fJvbpGWaxt2fKbLbS5dI="],["assets/FontManifest.json","sha256-xbyJ//olphBt6AEz216qWgotLsuo12U0m2flZJc2JS8="],["assets/NOTICES","sha256-EKs6fJX0cg3e5L4pgsjVD+vW6/9sVMU1LlOor/9lzvQ="],["assets/fonts/MaterialIcons-Regular.otf","sha256-ODk3+asY+qsYInoXn4mjjKU6yapjBxQzOKEcTuJD3sY="],["assets/fonts/fallback/Roboto-Regular.ttf","sha256-eehRQEZX2sIQaz0irSVtR4JKmldlRY7bcskQKkWBbZU="],["assets/packages/cupertino_icons/assets/CupertinoIcons.ttf","sha256-PZDDcKpM8A3FfuK5AvZlIUfA+B4D5IPfWEqcCLFofJ0="],["assets/shaders/ink_sparkle.frag","sha256-LcpauT1Owp6WP5lvORYyC6YIJelTffsUmmgAjHoWsCY="],["assets/shaders/stretch_effect.frag","sha256-q0EvB6W5tQtnqIWyTb4Wkpc4rihjBAfWSQySTK8KMiA="],["canvaskit-1080/canvaskit.js","sha256-u1WfYIDH0xKsKpErSr7J9o/z0wItSmA8d5a5sxRgZCs="],["canvaskit-1080/canvaskit.wasm","sha256-++1RekPoJFJAREZoPwDy6HbYNa7YRBBpV1nme2uwHNM="],["canvaskit-1080/chromium/canvaskit.js","sha256-YBixK9jtN+aVLu5y1Zwc961wfM23SgpFGQAQ937dkGg="],["canvaskit-1080/chromium/canvaskit.wasm","sha256-ro/x2FgUD3sTAM7T+on7jJ3OCkAKD08eEfbc+zMV/c8="],["drift_worker.js","sha256-MK1X2nzOTgRcWcslmEQmkTyy8IFOvQ2y8sPygEGJdfA="],["evolt_worker.js","sha256-4hNPmk8UTxexg8a0opfsMNGE80lFVnKkeXIAOM86hFA="],["favicon.png","sha256-+ZjoiDiH1TNGWIGA2PNwaQswJrnOsaKxC3278yj1bgM="],["flutter_bootstrap.js","sha256-KoROg+T1iAzgrnKB8sp5i+AII8pFZ4WxFS02JaMmqiU="],["icons/Icon-192.png","sha256-mSgFRUOpm2129zFm8linfXyWIjxvsaMbndtSz7eTczI="],["icons/Icon-512.png","sha256-3iDZt8DpIjXIErqdp/3aGnCQjWjPzTQ0MW9rziYf2v0="],["icons/Icon-maskable-512.png","sha256-TYhGLHC7xq7lmHwjSSq9KjDJe60KVBv+VpgBya/eMvs="],["icons/apple-touch-icon.png","sha256-GU+manNKAfW0KRDuXE3esG1unff85WglVidCMNhUyKo="],["index.html","sha256-Eiy93IdL+Lc0AbfGjopt23AfRmi6oOTmePuThMbcuDU="],["main.dart.js","sha256-zqtjcV68rBDWrbARZA/CqkXFkS13y16R6rhjSCco5TA="],["manifest.json","sha256-RA6Wi3lR8ME7fspdAglS0Y6f/isl4fJO2+npz7aAnxc="],["sqlite3.wasm","sha256-E9PxHQWzm6BhinEV+0FkCl1ItjAPXT8yX1VLQr1miKQ="]];
const PREFIX = "dubu-shell-";
const CACHE = PREFIX + BUILD;
const SCOPE = new URL(self.registration.scope);
const KEYS = new Set(FILES.map((f) => new URL(f[0], SCOPE).pathname));
const INDEX = new URL("index.html", SCOPE).pathname;

function keyOf(pathname) {
  return new URL(pathname, SCOPE.origin).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await Promise.all(
          FILES.map(async ([path, integrity]) => {
            const url = new URL(path, SCOPE);
            url.search = "v=" + BUILD;
            const res = await fetch(url.href, { cache: "no-store", integrity });
            if (!res.ok) throw new Error("precache " + path + ": " + res.status);
            await cache.put(keyOf(new URL(path, SCOPE).pathname), res);
          }),
        );
      } catch (e) {
        await caches.delete(CACHE);
        throw e;
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fromCache(INDEX, req));
    return;
  }
  if (KEYS.has(url.pathname)) event.respondWith(fromCache(url.pathname, req));
});

async function fromCache(pathname, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(keyOf(pathname));
  return hit || fetch(req);
}
