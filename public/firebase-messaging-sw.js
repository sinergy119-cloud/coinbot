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
})

// ─── FCM 푸시 수신 ───────────────────────────────────────────────
// dataOnly=false: data.notification.title / data.notification.body
// dataOnly=true : data.data.title / data.data.body (SW가 직접 표시)
self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()

    const title = data.notification?.title ?? data.data?.title ?? 'MyCoinBot'
    const body  = data.notification?.body  ?? data.data?.body  ?? ''
    const deepLink = data.data?.deepLink ?? null

    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-badge.png',
      data: { deepLink },
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    // 파싱 실패 시 무시
  }
})

// ─── 알림 클릭 → 딥링크 이동 ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const deepLink = event.notification.data?.deepLink || '/app'
  // 상대 경로이면 origin 붙이기
  const url = deepLink.startsWith('http') ? deepLink : (self.location.origin + deepLink)

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열린 탭이 있으면 해당 탭을 포커스 + 이동
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(url).then(() => client.focus())
        }
      }
      // 없으면 새 탭
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
