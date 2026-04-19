// POST/DELETE /api/app/push/subscribe — 푸시 토큰 등록/해제
// design-schema.md §4-2
// 현재: DB 저장만 수행. FCM 발송은 Firebase 설정 완료 후 활성화.

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized, fail } from '@/lib/app/response'

const VALID_PLATFORMS = ['web', 'android', 'ios'] as const

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const platform = body.platform
  const endpoint = body.endpoint
  if (typeof platform !== 'string' || !(VALID_PLATFORMS as readonly string[]).includes(platform)) {
    return fail('platform은 web/android/ios 중 하나여야 합니다.')
  }
  if (typeof endpoint !== 'string' || endpoint.length < 10 || endpoint.length > 1000) {
    return fail('유효한 endpoint가 필요합니다.')
  }
  const p256dh = typeof body.p256dh === 'string' ? body.p256dh : null
  const auth = typeof body.auth === 'string' ? body.auth : null
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null

  const db = createServerClient()
  // UPSERT: 동일 (user_id, endpoint) 이미 있으면 last_seen_at 갱신
  const { data: existing } = await db
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', session.userId)
    .eq('endpoint', endpoint)
    .maybeSingle()

  if (existing) {
    await db
      .from('push_subscriptions')
      .update({ last_seen_at: new Date().toISOString(), platform, p256dh, auth, user_agent: userAgent })
      .eq('id', existing.id)
    return ok({ subscriptionId: existing.id })
  }

  const { data: inserted, error } = await db
    .from('push_subscriptions')
    .insert({
      user_id: session.userId,
      platform,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[push/subscribe] insert error:', error)
    return fail('구독 등록에 실패했습니다.', 500)
  }
  return ok({ subscriptionId: inserted.id })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }
  const endpoint = body.endpoint
  if (typeof endpoint !== 'string') return fail('endpoint가 필요합니다.')

  const db = createServerClient()
  await db
    .from('push_subscriptions')
    .delete()
    .eq('user_id', session.userId)
    .eq('endpoint', endpoint)

  return ok({ deleted: true })
}
