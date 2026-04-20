/**
 * GET  /api/admin/crawler-settings  — 현재 자동 수집 설정 조회
 * POST /api/admin/crawler-settings  — 자동 수집 설정 변경
 *
 * Body (POST): { crawl_interval_hours: 2~23, crawl_period_days: 1~7 }
 *   → 각 설정 저장
 *   → next_crawl_at = 지금 + interval (즉시 재계산)
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { getNextScheduledTime } from '@/lib/crawlers/execute'

const VALID_INTERVALS = [6, 12, 24]

export async function GET() {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()
  const { data } = await db
    .from('crawler_settings')
    .select('key, value')
    .in('key', ['crawl_interval_hours', 'next_crawl_at'])

  const map: Record<string, string> = Object.fromEntries(
    (data ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  )

  const intervalHours = parseInt(map.crawl_interval_hours ?? '12')
  return Response.json({
    crawl_interval_hours: VALID_INTERVALS.includes(intervalHours) ? intervalHours : 12,
    next_crawl_at: map.next_crawl_at ?? null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const body = await req.json()
  const intervalHours = parseInt(body?.crawl_interval_hours)

  if (!VALID_INTERVALS.includes(intervalHours)) {
    return Response.json(
      { error: `수집 주기는 ${VALID_INTERVALS.join('·')}시간 중 하나여야 합니다.` },
      { status: 400 },
    )
  }

  const db = createServerClient()

  // 설정 저장 + next_crawl_at = 다음 고정 스케줄 시각 (KST 0/6/12/18시)
  const nextCrawlAt = getNextScheduledTime(intervalHours).toISOString()

  await db.from('crawler_settings').upsert([
    { key: 'crawl_interval_hours', value: String(intervalHours) },
    { key: 'next_crawl_at', value: nextCrawlAt },
  ])

  return Response.json({
    crawl_interval_hours: intervalHours,
    next_crawl_at: nextCrawlAt,
  })
}
