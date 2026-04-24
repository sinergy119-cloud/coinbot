// POST /api/app/push/test
// PUSH 알림 설정 확인 화면에서 테스트 알림 발송
// 알림 설정 ON/OFF 무관하게 항상 발송 (진단 목적)

import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendFCMToTokens } from '@/lib/push'
import { ok, unauthorized, fail } from '@/lib/app/response'

const TEST_TITLE = 'MyCoinBot 알림 확인'
const TEST_BODY  =
  '알림 확인을 위해 전송되는 메시지입니다. 이 메시지가 표시되면 PUSH알림 수신에 문제가 없습니다. 문의사항이 있을 경우 고객센터로 연락주세요'

export async function POST() {
  const session = await getSession()
  if (!session) return unauthorized()

  const db = createServerClient()

  // 등록된 푸시 토큰 조회
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint')
    .eq('user_id', session.userId)

  const tokens = (subs ?? []).map((s) => s.endpoint as string)
  if (tokens.length === 0) {
    return fail('등록된 푸시 토큰이 없습니다. 먼저 토큰을 등록해주세요.', 400)
  }

  // dataOnly=true: SW가 직접 알림 표시 (포그라운드/백그라운드 모두 작동)
  const result = await sendFCMToTokens(
    tokens,
    {
      title: TEST_TITLE,
      body: TEST_BODY,
      deepLink: '/app',
      category: 'system',
    },
    true, // dataOnly
  )

  // 만료 토큰 정리
  if (result.invalidTokens.length > 0) {
    await db
      .from('push_subscriptions')
      .delete()
      .eq('user_id', session.userId)
      .in('endpoint', result.invalidTokens)
  }

  if (result.sent === 0) {
    return fail(`발송 실패: ${result.errors.join(', ')}`, 500)
  }

  return ok({ sent: result.sent, failed: result.failed })
}
