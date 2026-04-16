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
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

const INTERVAL_MIN = 2
const INTERVAL_MAX = 23
const PERIOD_MIN = 1
const PERIOD_MAX = 7

export async function GET() {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()
  const { data } = await db
    .from('crawler_settings')
    .select('key, value')
    .in('key', ['crawl_interval_hours', 'crawl_period_days', 'next_crawl_at'])

  const map: Record<string, string> = Object.fromEntries(
    (data ?? []).map((s: { key: string; value: string }) => [s.key, s.value])
  )

  return Response.json({
    crawl_interval_hours: parseInt(map.crawl_interval_hours ?? '2'),
    crawl_period_days: parseInt(map.crawl_period_days ?? '2'),
    next_crawl_at: map.next_crawl_at ?? null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const body = await req.json()
  const intervalHours = parseInt(body?.crawl_interval_hours)
  const periodDays = parseInt(body?.crawl_period_days)

  if (isNaN(intervalHours) || intervalHours < INTERVAL_MIN || intervalHours > INTERVAL_MAX) {
    return Response.json(
      { error: `수집 주기는 ${INTERVAL_MIN}~${INTERVAL_MAX}시간 정수여야 합니다.` },
      { status: 400 },
    )
  }
  if (isNaN(periodDays) || periodDays < PERIOD_MIN || periodDays > PERIOD_MAX) {
    return Response.json(
      { error: `수집 기간은 ${PERIOD_MIN}~${PERIOD_MAX}일 정수여야 합니다.` },
      { status: 400 },
    )
  }

  const db = createServerClient()

  // 설정 저장 + next_crawl_at = 지금부터 interval 시간 후
  const nextCrawlAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()

  await db.from('crawler_settings').upsert([
    { key: 'crawl_interval_hours', value: String(intervalHours) },
    { key: 'crawl_period_days', value: String(periodDays) },
    { key: 'next_crawl_at', value: nextCrawlAt },
  ])

  return Response.json({
    crawl_interval_hours: intervalHours,
    crawl_period_days: periodDays,
    next_crawl_at: nextCrawlAt,
  })
}
