// POST /api/app/notify/key-event — 거래소 API Key 등록/삭제 보안 알림
//
// 클라이언트(앱)가 IndexedDB에 키를 추가하거나 삭제한 직후 호출.
// 서버는 본인의 모든 push_subscriptions에 'system' 카테고리 푸시를 발송하여
// 다른 기기 또는 같은 기기에서 일어난 키 변경 사실을 사용자가 인지하게 함.
// (의도하지 않은 키 추가·삭제 시 알아차릴 수 있는 보안 채널)

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { sendNotification } from '@/lib/app/notifications'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'
import { ok, unauthorized, fail } from '@/lib/app/response'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: { action?: string; exchange?: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청', 400)
  }

  const action = body.action
  const exchange = body.exchange
  const label = (body.label ?? '').slice(0, 80)

  if (action !== 'add' && action !== 'delete') {
    return fail('action은 add 또는 delete', 400)
  }
  if (!exchange) return fail('exchange 누락', 400)

  const exchangeLabel = EXCHANGE_LABELS[exchange as Exchange] ?? exchange

  // KST 기준 날짜·시각 (M/D HH:mm)
  const kstNow = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const title =
    action === 'add'
      ? `🔑 ${exchangeLabel} API Key 등록 완료`
      : `🗑 ${exchangeLabel} API Key 삭제 완료`
  const bodyText =
    action === 'add'
      ? `'${label || '새 키'}' 키 등록 (${kstNow})`
      : `'${label || '키'}' 키 삭제 (${kstNow})`

  await sendNotification({
    userId: session.userId,
    category: 'system',
    title,
    body: bodyText,
    deepLink: '/app/profile/api-keys',
    metadata: { action, exchange, label },
  })

  return ok({ sent: true })
}
