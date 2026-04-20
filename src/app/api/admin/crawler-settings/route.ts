/**
 * GET  /api/admin/crawler-settings  ???„ì¬ ?ë™ ?˜ì§‘ ?¤ì • ì¡°íšŒ
 * POST /api/admin/crawler-settings  ???ë™ ?˜ì§‘ ?¤ì • ë³€ê²?
 *
 * Body (POST): { crawl_interval_hours: 2~23, crawl_period_days: 1~7 }
 *   ??ê°??¤ì • ?€??
 *   ??next_crawl_at = ì§€ê¸?+ interval (ì¦‰ì‹œ ?¬ê³„??
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { getNextScheduledTime } from '@/lib/crawlers/execute'

const VALID_INTERVALS = [6, 12, 24]

export async function GET() {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
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
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const body = await req.json()
  const intervalHours = parseInt(body?.crawl_interval_hours)

  if (!VALID_INTERVALS.includes(intervalHours)) {
    return Response.json(
      { error: `?˜ì§‘ ì£¼ê¸°??${VALID_INTERVALS.join('Â·')}?œê°„ ì¤??˜ë‚˜?¬ì•¼ ?©ë‹ˆ??` },
      { status: 400 },
    )
  }

  const db = createServerClient()

  // ?¤ì • ?€??+ next_crawl_at = ?¤ìŒ ê³ ì • ?¤ì?ì¤??œê° (KST 0/6/12/18??
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
