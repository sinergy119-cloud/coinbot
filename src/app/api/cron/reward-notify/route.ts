/**
 * POST /api/cron/reward-notify
 *
 * 매일 KST 18:00 호출 (EC2 pm2 cron: 0 9 * * * UTC).
 * 오늘이 reward_date인 active 이벤트를 찾아 'event' 알림 카테고리가 활성화된
 * 사용자에게 푸시 + 알림함 기록.
 *
 * 중복 발송 방지: notifications 테이블에 같은 announcement_id로 reward 알림이
 * 이미 1건이라도 존재하면 스킵.
 *
 * CRON_SECRET Bearer 토큰으로 보호.
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendNotification, isNotificationEnabled } from '@/lib/app/notifications'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface RewardAnnouncement {
  id: string
  exchange: string
  coin: string
  amount: string | null
  reward_date: string
  link: string | null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  const today = kstToday()

  // 1) 오늘이 리워드 지급일인 이벤트 조회 (active 필터는 reward_date 자체로 충분)
  const { data: anns, error: annError } = await db
    .from('announcements')
    .select('id, exchange, coin, amount, reward_date, link')
    .eq('reward_date', today)

  if (annError) {
    console.error('[cron/reward-notify] announcements query error:', annError.message)
    return Response.json({ error: '이벤트 조회 실패' }, { status: 500 })
  }

  const announcements = (anns ?? []) as RewardAnnouncement[]
  if (announcements.length === 0) {
    return Response.json({ ok: true, processed: 0, skipped: 0, recipients: 0 })
  }

  // 2) 모든 사용자 + notification_settings 조회 (event 카테고리 활성화 사용자)
  const { data: users } = await db
    .from('users')
    .select('id')
  const userIds = (users ?? []).map((u) => u.id as string)

  const eligible: string[] = []
  for (const uid of userIds) {
    const ok = await isNotificationEnabled(uid, 'event')
    if (ok) eligible.push(uid)
  }

  let processed = 0
  let skipped = 0
  let totalSent = 0

  for (const ann of announcements) {
    // 중복 발송 체크: 이미 같은 이벤트로 reward 알림 발송했는지
    const { data: existing } = await db
      .from('notifications')
      .select('id')
      .eq('category', 'event')
      .filter('metadata->>rewardAnnouncementId', 'eq', ann.id)
      .limit(1)
      .maybeSingle()

    if (existing) {
      skipped += 1
      continue
    }

    const exchangeLabel = EXCHANGE_LABELS[ann.exchange as Exchange] ?? ann.exchange
    const amountText = ann.amount && ann.amount.trim().length > 0 ? `${ann.amount} ` : ''
    const title = `💰 리워드 지급일 안내`
    const body = `${exchangeLabel} ${ann.coin} ${amountText}리워드가 오늘 지급됩니다. 거래소에서 확인해보세요.`

    await Promise.all(
      eligible.map((userId) =>
        sendNotification({
          userId,
          category: 'event',
          title,
          body,
          deepLink: `/app/events/${ann.id}`,
          metadata: {
            rewardAnnouncementId: ann.id,
            exchange: ann.exchange,
            coin: ann.coin,
            rewardDate: ann.reward_date,
          },
        }),
      ),
    )

    processed += 1
    totalSent += eligible.length
  }

  return Response.json({
    ok: true,
    today,
    processed,
    skipped,
    recipients: eligible.length,
    totalSent,
  })
}
