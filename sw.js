/* ======================================================
   Consulting Guide PWA Service Worker
   ✅ 최초 접속 2번 로딩 방지 안정화 버전
====================================================== */

const CACHE_NAME = "consulting-guide-v1"; // 🔥 배포할 때마다 번전 올리기 (consulting-guide-v1 → v2 → v3)

/* ===============================
   INSTALL
   =============================== */
self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        "/",
        "/index.html",
        "/manifest.json",
        "/assets/css/in5.slider.css",
        "/assets/js/in5.config.js"
      ]);
    })
  );

  // ❌ 제거: self.skipWaiting();
  // 최초 접속 reload 원인
});


/* ===============================
   ACTIVATE
   =============================== */
self.addEventListener("activate", event => {

  event.waitUntil(
    (async () => {

      // 🔥 구버전 캐시 삭제
      const keys = await caches.keys();

      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );

      // ✅ 최초 로드 reload 방지
      // 기존 페이지가 있을 때만 claim
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: false
      });

      if (clients.length > 0) {
        await self.clients.claim();
      }

    })()
  );
});


/* ===============================
   FETCH (Network → Cache fallback)
   =============================== */
self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  event.respondWith(

    fetch(event.request)
      .then(response => {

        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const copy = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })

  );

});