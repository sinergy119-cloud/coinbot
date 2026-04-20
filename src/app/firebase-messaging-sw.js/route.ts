// Firebase Cloud Messaging Service Worker (Route Handler 서빙)
// Next.js 16에서 public/ 서빙이 세션 redirect와 충돌하므로 route handler로 우회
// /firebase-messaging-sw.js 경로로 서빙됨
//
// 주의: Firebase SDK의 onBackgroundMessage는 특정 환경에서 발화하지 않는 이슈 확인됨
// → 네이티브 push 이벤트에서 직접 처리하는 방식으로 전환 (Firebase SDK 미사용)

const SW_CODE = `// Firebase Cloud Messaging Service Worker (native push handler)
// design-security.md §5-4
// - Firebase SDK는 client getToken 호환성을 위해 로드만 하고 onBackgroundMessage 미사용
// - push 이벤트는 네이티브 핸들러에서 직접 처리

// PWA 독립 앱 설치를 위한 fetch 핸들러 (Chrome installability 기준 충족)
self.addEventListener('fetch', () => {})

// 새 SW 즉시 활성화 (대기 없이 교체)
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })

// Firebase SDK 로드 (client getToken 호환성용; onBackgroundMessage 미등록)
try {
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
  firebase.messaging()
} catch (e) {
  // Firebase 초기화 실패해도 push 이벤트는 네이티브로 처리 가능
}

// ─── 디버그 로그 (서버로 전송) ───
function debugLog(event, payload) {
  try {
    fetch('/api/debug/sw-log?event=' + encodeURIComponent(event), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// SW 자동 실행 헬퍼 (PIN 없이 device key로 복호화)
// ─────────────────────────────────────────────────────────────

function b64ToU8(b64) {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

function openSecureDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('coinbot_secure_store')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => { req.transaction && req.transaction.abort(); reject(new Error('db_not_initialized')) }
  })
}

function idbGet(db, storeName, key) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) { resolve(null); return }
    try {
      const t = db.transaction(storeName, 'readonly')
      const req = t.objectStore(storeName).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

function idbGetAll(db, storeName) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) { resolve([]); return }
    try {
      const t = db.transaction(storeName, 'readonly')
      const req = t.objectStore(storeName).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    } catch { resolve([]) }
  })
}

async function autoExecuteSchedule(data) {
  const { jobId, exchange, coin, tradeType, amountKrw, executionDate } = data

  let db
  try { db = await openSecureDB() } catch { return { ok: false, reason: 'db_not_ready' } }

  const meta = await idbGet(db, 'meta', 'meta')
  if (!meta || !meta.deviceKey) return { ok: false, reason: 'no_device_key' }

  const allAutoKeys = await idbGetAll(db, 'auto_keys')
  const matchingKeys = allAutoKeys.filter(k => k.exchange === exchange)
  if (matchingKeys.length === 0) return { ok: false, reason: 'no_auto_keys' }

  let deviceKey
  try {
    deviceKey = await crypto.subtle.importKey('jwk', meta.deviceKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  } catch { return { ok: false, reason: 'key_import_failed' } }

  const decrypted = await Promise.all(matchingKeys.map(async (row) => {
    try {
      const iv = b64ToU8(row.iv)
      const ciphertext = b64ToU8(row.ciphertext)
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, deviceKey, ciphertext)
      const { accessKey, secretKey } = JSON.parse(new TextDecoder().decode(plainBuf))
      return { exchange: row.exchange, label: row.label, accessKey, secretKey }
    } catch { return null }
  }))
  const validKeys = decrypted.filter(Boolean)
  if (validKeys.length === 0) return { ok: false, reason: 'decrypt_failed' }

  let anyOk = false
  let lastError = null
  for (const key of validKeys) {
    try {
      const res = await fetch('/api/app/proxy/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: key.exchange,
          coin,
          tradeType,
          amountKrw: Number(amountKrw) || 0,
          accessKey: key.accessKey,
          secretKey: key.secretKey,
        }),
      })
      const json = await res.json()
      if (json.ok) anyOk = true
      else lastError = json.error || '실행 실패'
    } catch (e) { lastError = String(e) }
  }

  try {
    await fetch('/api/app/trade-jobs/' + jobId + '/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionDate: executionDate || new Date().toISOString().slice(0, 10),
        result: anyOk ? 'success' : 'fail',
        deviceEndpoint: null,
        errorMessage: anyOk ? null : lastError,
      }),
    })
  } catch {}

  return { ok: anyOk, error: lastError }
}

// ─────────────────────────────────────────────────────────────
// 네이티브 push 이벤트 핸들러 (Firebase SDK 미사용)
// ─────────────────────────────────────────────────────────────

async function handlePush(event) {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch {}

  debugLog('push', { hasData: !!payload.data, hasNotif: !!payload.notification })

  const data = payload.data || {}
  const notification = payload.notification || {}
  const type = data.type || 'notification_only'

  // 스케줄 자동 실행 처리
  // 성공/실패 최종 알림은 서버 /api/app/trade-jobs/[id]/report 가 담당 (중복 방지)
  // SW는 키 미비 등 실행 불가 상황에서만 사용자 유도 알림 표시 (아래 fall-through)
  if (type === 'execute_trade' && data.jobId) {
    try {
      const result = await autoExecuteSchedule(data)
      debugLog('auto-exec-result', { ok: result.ok, reason: result.reason, error: result.error })

      // 성공 또는 실제 실행 후 실패 → 서버가 /report 수신 시 알림 발송 → SW 종료
      if (result.ok) return
      if (result.reason !== 'no_device_key' && result.reason !== 'no_auto_keys' && result.reason !== 'db_not_ready') return

      // no_device_key / no_auto_keys / db_not_ready → 아래 fall-through (앱 진입 유도 알림)
    } catch (e) {
      debugLog('auto-exec-error', { err: String(e) })
    }
  }

  // 기본: 알림 표시 (탭 → PIN 입력 → 실행)
  const title = notification.title || data.title || 'MyCoinBot'
  const body = notification.body || data.body || ''
  const deepLink = data.deepLink || '/app'

  await self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: type === 'execute_trade' ? 'trade-' + data.jobId : undefined,
    data: { deepLink, type, ...data },
  })
}

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event))
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
