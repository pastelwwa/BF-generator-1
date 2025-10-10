const CACHE = "bfgen-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./generator.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  // obrazy i warstwy
  "./pliki/appicon.png",
  "./pliki/D_okno.png",
  "./pliki/M_okno.png",
  "./pliki/D_ramka.png",
  "./pliki/D_nakladka.png",
  "./pliki/D_napis.png",
  "./pliki/M_ramka.png",
  "./pliki/M_nakladka.png",
  "./pliki/M_napis.png",
  // fonty
  "./pliki/fonts/TT-Travels-Next-DemiBold.woff2",
  "./pliki/fonts/TT-Commons-Medium.woff2"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});

self.addEventListener("fetch", e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
