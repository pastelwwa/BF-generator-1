const CACHE = 'bfgen-v4';  // podbij wersję przy każdej zmianie assets

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './pliki/tlo.png',
  './pliki/fotoramka.png',
  './pliki/nakladka.png',
  './pliki/logo.png',
  // fonty (ważne dla offline)
  './pliki/fonts/TT-Travels-Next-DemiBold.woff2',
  './pliki/fonts/TT-Commons-Medium.woff2'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (e)=>{
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});
