/**
 * POST /api/cron/crawl-events
 *
 * EC2 pm2 cron에서 12시간마다 호출 (0 0,12 * * *)
 * CRON_SECRET Bearer 토큰으로 보호됩니다.
 *
 * 핵심 로직은 src/lib/crawlers/execute.ts 참조.
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { executeCrawl } from '@/lib/crawlers/execute'

export async function POST(req: NextRequest) {
  // 보안: CRON_SECRET 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  const { httpStatus, result } = await executeCrawl(db, 'cron')
  return Response.json(result, { status: httpStatus })
}
