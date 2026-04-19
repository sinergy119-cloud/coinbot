// Firebase Cloud Messaging Service Worker
// PWA 백그라운드 메시지 수신 전용 (공개 가능한 설정만 포함)
// design-security.md §5-4

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

// 백그라운드 메시지 처리 (앱이 포그라운드 아닐 때)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const notification = payload.notification || {}
  const type = data.type || 'notification_only'

  // 알림 표시
  const title = notification.title || data.title || 'MyCoinBot'
  const body = notification.body || data.body || ''
  const deepLink = data.deepLink || '/app'

  self.registration.showNotification(title, {
    body,
    icon: '/intro.png',
    badge: '/intro.png',
    tag: type === 'execute_trade' ? `trade-${data.jobId}` : undefined,
    data: { deepLink, type, ...data },
  })

  // TODO: type === 'execute_trade' 케이스
  // 앱 로컬 키 저장(IndexedDB + WebCrypto) 구현 후 백그라운드 거래 실행 로직 추가
  // 현재는 알림만 표시하고 앱이 실행될 때 처리
})

// 알림 클릭 → 딥링크 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.deepLink) || '/app'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // 기존 탭이 있으면 포커스 + 딥링크 이동
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(link)
          return
        }
      }
      // 없으면 새 창
      if (self.clients.openWindow) await self.clients.openWindow(link)
    })(),
  )
})
