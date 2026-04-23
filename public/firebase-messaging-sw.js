// MyCoinBot Service Worker
// Chrome PWA standalone 설치 조건: 등록된 SW + fetch 핸들러 필수

const CACHE_NAME = 'mycoinbot-v1'
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// fetch 핸들러 — Chrome이 PWA 설치 조건으로 요구
self.addEventListener('fetch', (event) => {
  // 네트워크 우선, 실패 시 캐시 폴백 (정적 자산만)
  const url = new URL(event.request.url)
  const isStatic = STATIC_ASSETS.includes(url.pathname)

  if (isStatic) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
  }
  // 그 외 요청은 네트워크 그대로 통과 (API, 페이지 등)
})

// Firebase Cloud Messaging 수신 처리 (추후 확장용)
self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const title = data.notification?.title ?? 'MyCoinBot'
    const options = {
      body: data.notification?.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-badge.png',
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {}
})
