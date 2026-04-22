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
import { requireAdmin } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { executeCrawl } from '@/lib/crawlers/execute'
import { logAdminAudit, adminRateLimit } from '@/lib/admin-audit'

export async function POST(req: NextRequest) {
  // 관리자 세션 인증 (DB 재조회)
  const session = await requireAdmin()
  if (!session) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }
  const rl = adminRateLimit(session.userId, 'run-crawl:post')
  if (!rl.ok) return Response.json({ error: `요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.` }, { status: 429 })

  // sinceDate 파싱 (optional) — YYYY-MM-DD 포맷 엄격 검증
  let sinceOverride: Date | undefined
  let sinceDateStr: string | null = null
  try {
    const body = await req.json()
    if (body?.sinceDate) {
      if (typeof body.sinceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.sinceDate)) {
        return Response.json({ error: 'sinceDate는 YYYY-MM-DD 형식이어야 합니다.' }, { status: 400 })
      }
      const parsed = new Date(`${body.sinceDate}T00:00:00+09:00`)
      if (isNaN(parsed.getTime())) {
        return Response.json({ error: '유효하지 않은 날짜입니다.' }, { status: 400 })
      }
      sinceOverride = parsed
      sinceDateStr = body.sinceDate
    }
  } catch {
    // body 없음 또는 파싱 실패 → 기본값 사용
  }

  const db = createServerClient()
  await logAdminAudit(db, { adminId: session.userId, action: 'crawl.manual', payload: { sinceDate: sinceDateStr } })
  const { httpStatus, result } = await executeCrawl(db, 'manual', sinceOverride)
  return Response.json(result, { status: httpStatus })
}
