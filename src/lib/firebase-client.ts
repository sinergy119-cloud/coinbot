// Firebase 클라이언트 초기화 + FCM 토큰 관리
// 브라우저(Next.js 클라이언트 컴포넌트)에서만 사용

'use client'

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let _app: FirebaseApp | null = null
let _messaging: Messaging | null = null

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app
  _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  return _app
}

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null
  if (_messaging) return _messaging
  try {
    _messaging = getMessaging(getFirebaseApp())
    return _messaging
  } catch (err) {
    console.warn('[firebase-client] messaging init failed:', err)
    return null
  }
}

// Service Worker 등록 + 알림 권한 요청 + FCM 토큰 획득 → 서버 구독
export async function registerPushSubscription(platform: 'web' | 'android' | 'ios' = 'web'): Promise<{ ok: boolean; token?: string; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'not_browser' }
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'sw_unsupported' }
  if (!('Notification' in window)) return { ok: false, reason: 'notification_unsupported' }

  // SW 등록
  let registration: ServiceWorkerRegistration
  try {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
  } catch (err) {
    return { ok: false, reason: `sw_register_failed: ${String(err)}` }
  }

  // 권한 요청
  let permission = Notification.permission
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' }

  // FCM 토큰 획득
  const messaging = await getMessagingInstance()
  if (!messaging) return { ok: false, reason: 'messaging_unavailable' }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) return { ok: false, reason: 'vapid_missing' }

  let token: string
  try {
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  } catch (err) {
    return { ok: false, reason: `token_failed: ${String(err)}` }
  }
  if (!token) return { ok: false, reason: 'empty_token' }

  // 서버 구독 등록
  try {
    const res = await fetch('/api/app/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        endpoint: token,
        userAgent: navigator.userAgent,
      }),
    })
    const json = await res.json()
    if (!json.ok) return { ok: false, reason: json.error ?? 'subscribe_failed' }
    return { ok: true, token }
  } catch (err) {
    return { ok: false, reason: `subscribe_error: ${String(err)}` }
  }
}

export async function unregisterPushSubscription(token: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/app/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: token }),
    })
    const json = await res.json()
    return { ok: !!json.ok }
  } catch {
    return { ok: false }
  }
}

// 포그라운드 메시지 리스너
export async function onForegroundMessage(handler: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    handler({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data,
    })
  })
}
