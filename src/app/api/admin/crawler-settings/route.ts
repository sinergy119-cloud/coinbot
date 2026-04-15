/**
 * GET  /api/admin/crawler-settings  — 현재 수집 주기 설정 조회
 * POST /api/admin/crawler-settings  — 수집 주기 변경
 *
 * Body (POST): { crawl_interval_hours: 4 | 6 | 12 | 24 }
 *   → crawl_interval_hours 저장
 *   → next_crawl_at = 지금 + interval (즉시 재계산)
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

const VALID_INTERVALS = [4, 6, 12, 24]

export async function GET() {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
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

  return Response.json({
    crawl_interval_hours: parseInt(map.crawl_interval_hours ?? '12'),
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

  if (!VALID_INTERVALS.includes(intervalHours)) {
    return Response.json({ error: '유효하지 않은 수집 주기입니다. (4/6/12/24 중 선택)' }, { status: 400 })
  }

  const db = createServerClient()

  // interval 저장 + next_crawl_at = 지금부터 N시간 후
  const nextCrawlAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()

  await db.from('crawler_settings').upsert([
    { key: 'crawl_interval_hours', value: String(intervalHours) },
    { key: 'next_crawl_at', value: nextCrawlAt },
  ])

  return Response.json({
    crawl_interval_hours: intervalHours,
    next_crawl_at: nextCrawlAt,
  })
}
