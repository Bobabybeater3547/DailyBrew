// Simple cache-first service worker for Brew Journal
const CACHE = "brewjournal-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icons/latteArt.png",
  "./icons/icedLatte.png",
  "./icons/cupcakeHeart.png",
  "./icons/espresso.png",
  "./icons/blackMug.png",
  "./icons/icedCoffee.png",
  "./icons/syrupBottle.png",
  "./icons/strawDrink.png",
  "./icons/cupcakeLeaf.png",
  "./icons/matchaCup.png",
  "./icons/dessertCup.png",
  "./icons/pourOver.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // only handle GET
  if(req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        // cache same-origin files
        const url = new URL(req.url);
        if(url.origin === location.origin){
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
    })
  );
});
