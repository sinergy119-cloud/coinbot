/**
 * POST /api/admin/run-crawl
 *
 * 관리자 세션 인증으로 즉시 크롤링을 실행합니다.
 * "지금 수집" 버튼에서 호출 — CRON_SECRET 불필요.
 *
 * Body (optional): { sinceDate: string }
 *   - sinceDate 있으면: 해당 날짜 00:00 KST부터 수집, 5분 쿨다운 면제
 *   - sinceDate 없으면: 기존대로 최근 13시간 + 5분 쿨다운 적용
 *
 * 핵심 로직은 src/lib/crawlers/execute.ts 참조.
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'
import { executeCrawl } from '@/lib/crawlers/execute'

export async function POST(req: NextRequest) {
  // 관리자 세션 인증
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  // sinceDate 파싱 (optional)
  let sinceOverride: Date | undefined
  try {
    const body = await req.json()
    if (body?.sinceDate) {
      // sinceDate는 'YYYY-MM-DD' 형식 — KST 00:00으로 해석
      const parsed = new Date(`${body.sinceDate}T00:00:00+09:00`)
      if (!isNaN(parsed.getTime())) {
        sinceOverride = parsed
      }
    }
  } catch {
    // body 없음 또는 파싱 실패 → 기본값 사용
  }

  const db = createServerClient()
  const { httpStatus, result } = await executeCrawl(db, 'manual', sinceOverride)
  return Response.json(result, { status: httpStatus })
}
