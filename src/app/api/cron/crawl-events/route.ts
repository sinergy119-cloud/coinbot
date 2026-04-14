/**
 * POST /api/cron/crawl-events
 *
 * EC2 pm2 cron에서 12시간마다 호출하여 5개 거래소 이벤트를 수집합니다.
 * CRON_SECRET 헤더로 보호됩니다.
 *
 * --- Supabase SQL (최초 1회 실행) ---
 *
 * CREATE TABLE crawled_events (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   exchange TEXT NOT NULL,
 *   source_id TEXT NOT NULL,
 *   title TEXT NOT NULL,
 *   url TEXT,
 *   crawled_at TIMESTAMPTZ DEFAULT now(),
 *   status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
 *   reviewed_by TEXT,
 *   reviewed_at TIMESTAMPTZ,
 *   published_event_id UUID REFERENCES announcements(id) ON DELETE SET NULL,
 *   UNIQUE (exchange, source_id)
 * );
 *
 * CREATE INDEX idx_crawled_events_status ON crawled_events(status);
 * CREATE INDEX idx_crawled_events_crawled_at ON crawled_events(crawled_at DESC);
 *
 * --- EC2 pm2 cron 설정 ---
 * 아래 명령을 EC2에서 실행하세요 (12시간마다 실행):
 *   pm2 start crawl-events-cron.sh --name crawl-events-cron --cron "0 0,12 * * *" --no-autorestart
 *   (crawl-events-cron.sh 내용: curl -s -X POST http://localhost:3002/api/cron/crawl-events -H "Authorization: Bearer $CRON_SECRET")
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { crawlAllExchanges } from '@/lib/crawlers/index'

export async function POST(req: NextRequest) {
  // 보안: CRON_SECRET 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()

  // 크롤링 실행
  const { items, errors } = await crawlAllExchanges()

  if (items.length === 0) {
    return Response.json({
      message: '수집된 이벤트 없음',
      inserted: 0,
      errors,
    })
  }

  // 중복 제거 후 DB upsert (exchange + source_id가 같으면 무시)
  const rows = items.map((item) => ({
    exchange: item.exchange,
    source_id: item.sourceId,
    title: item.title,
    url: item.url,
  }))

  const { data, error } = await db
    .from('crawled_events')
    .upsert(rows, {
      onConflict: 'exchange,source_id',
      ignoreDuplicates: true,
    })
    .select()

  if (error) {
    console.error('[crawl-events] DB upsert 오류:', error)
    return Response.json({ error: 'DB 저장 실패', detail: error.message }, { status: 500 })
  }

  return Response.json({
    message: '크롤링 완료',
    found: items.length,
    inserted: data?.length ?? 0,
    errors,
  })
}
