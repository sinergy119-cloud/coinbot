// Firebase Admin SDK 초기화 + FCM 발송 유틸
// design-security.md §5-3

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import admin from 'firebase-admin'

let _initialized = false

function initAdmin() {
  if (_initialized || admin.apps.length > 0) {
    _initialized = true
    return
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다.')
  }

  const absPath = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath)
  if (!existsSync(absPath)) {
    throw new Error(`Firebase 서비스 계정 파일을 찾을 수 없습니다: ${absPath}`)
  }

  const serviceAccount = JSON.parse(readFileSync(absPath, 'utf-8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
  _initialized = true
}

export interface FCMPayload {
  title: string
  body: string
  deepLink?: string
  category?: string
  data?: Record<string, string>
}

// 단일 토큰 발송
export async function sendFCMToToken(token: string, payload: FCMPayload): Promise<{ ok: boolean; messageId?: string; error?: string; errorCode?: string }> {
  try {
    initAdmin()
    const dataPayload: Record<string, string> = {
      ...(payload.data ?? {}),
      ...(payload.deepLink ? { deepLink: payload.deepLink } : {}),
      ...(payload.category ? { category: payload.category } : {}),
    }
    const messageId = await admin.messaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: dataPayload,
      android: { priority: 'high' },
      webpush: { headers: { Urgency: 'high' } },
    })
    return { ok: true, messageId }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const errorCode = (err as { code?: string }).code ?? ''
    return { ok: false, error: msg.slice(0, 200), errorCode }
  }
}

// 여러 토큰 동시 발송 (다기기 수신)
export async function sendFCMToTokens(tokens: string[], payload: FCMPayload) {
  if (tokens.length === 0) return { sent: 0, failed: 0, invalidTokens: [] as string[], errors: [] as string[] }
  const results = await Promise.allSettled(tokens.map((t) => sendFCMToToken(t, payload)))
  const invalidTokens: string[] = []
  const errors: string[] = []
  let sent = 0
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.ok) sent++
    else {
      failed++
      // 등록 무효/만료 토큰 수거 (정리용)
      // Firebase 에러: code = "messaging/registration-token-not-registered", message = "NotRegistered"
      const errMsg = r.status === 'fulfilled' ? (r.value.error ?? '') : String(r.reason)
      const errCode = r.status === 'fulfilled' ? (r.value.errorCode ?? '') : ''
      errors.push(`[${i}] ${errCode || errMsg}`.slice(0, 100))
      if (
        /registration-token-not-registered|invalid-argument/i.test(errCode) ||
        /NotRegistered|InvalidRegistration/i.test(errMsg)
      ) {
        invalidTokens.push(tokens[i])
      }
    }
  })
  return { sent, failed, invalidTokens, errors }
}
