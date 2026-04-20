// Firebase Cloud Messaging Service Worker (Route Handler 서빙)
// Next.js 16에서 public/ 서빙이 세션 redirect와 충돌하므로 route handler로 우회
// /firebase-messaging-sw.js 경로로 서빙됨

const SW_CODE = `// Firebase Cloud Messaging Service Worker
// design-security.md §5-4

// PWA 독립 앱 설치를 위한 fetch 핸들러 (Chrome installability 기준 충족)
self.addEventListener('fetch', (event) => {
  // 네트워크 우선 전략 — 오프라인 캐싱 없이 그냥 통과
  event.respondWith(fetch(event.request))
})

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBzCtczwiDJwzGTw8v0lRRuoxI5Enlp7Zg',
  authDomain: 'mycoinbot-app.firebaseapp.com',
  projectId: 'mycoinbot-app',
  storageBucket: 'mycoinbot-app.firebasestorage.app',
  messagingSenderId: '201995976563',
  appId: '1:201995976563:web:2af1925a084325bb5d4f06',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const notification = payload.notification || {}
  const type = data.type || 'notification_only'

  const title = notification.title || data.title || 'MyCoinBot'
  const body = notification.body || data.body || ''
  const deepLink = data.deepLink || '/app'

  self.registration.showNotification(title, {
    body,
    icon: '/intro.png',
    badge: '/intro.png',
    tag: type === 'execute_trade' ? \`trade-\${data.jobId}\` : undefined,
    data: { deepLink, type, ...data },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.deepLink) || '/app'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(link)
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(link)
    })(),
  )
})
`

export async function GET() {
  return new Response(SW_CODE, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
