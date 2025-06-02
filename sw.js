self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('v1').then(function(cache) {
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './main brain.js',
        './assets/BtnPause.png',
        './assets/RemoveFruitBtn.png',
        './assets/UpgradeBtn.png',
        './assets/CloseBtn.png',
        './assets/WatchAdBtn.png',
        './assets/MusicOnBtn.png',
        './assets/RetryBtn.png',
        './assets/MergeCycle1.png'
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
