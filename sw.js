// Service worker : l'application fonctionne hors connexion.
// Changer VERSION à chaque mise en ligne pour forcer la mise à jour.
const VERSION = "mes-jeux-v37";
const FICHIERS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/chasse-croise.js",
  "js/puzzle.js",
  "js/data-puzzle.js",
  "js/bibliotheque.js",
  "js/mots-codes.js",
  "js/mot-mysterieux.js",
  "js/alphamot.js",
  "js/mots-cases.js",
  "js/recadrage.js",
  "js/couverture.js",
  "fonts/DejaVuSerif-Bold-latin.woff2",
  "js/google-photos.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (pour recevoir les nouvelles versions), cache si hors ligne.
// cache: "no-cache" oblige à revalider auprès du site, sans passer par le cache HTTP
// du navigateur (GitHub Pages le garde 10 minutes).
self.addEventListener("fetch", (e) => {
  // Seuls les fichiers de l'appli passent par ici ; les contenus de la Bibliothèque
  // (autre site) sont conservés par l'appli elle-même dans IndexedDB.
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(new Request(e.request, { cache: "no-cache" }))
      .then((rep) => {
        const copie = rep.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
