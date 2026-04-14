/**
 * /api/admin/crawled-events — 수집 이벤트 관리 (관리자 전용)
 *
 * GET  ?status=pending|approved|rejected  목록 조회
 * POST { action: 'approve'|'reject', id, eventData? }  승인/거절 처리
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/crawled-events
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const db = createServerClient()

  const { data, error } = await db
    .from('crawled_events')
    .select('*')
    .eq('status', status)
    .order('crawled_at', { ascending: false })
    .limit(100)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data ?? [])
}

// POST /api/admin/crawled-events
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const body = await req.json()
  const { action, id, eventData } = body

  if (!id || !action) {
    return Response.json({ error: 'id와 action은 필수입니다.' }, { status: 400 })
  }

  const db = createServerClient()
  const now = new Date().toISOString()

  // 거절
  if (action === 'reject') {
    const { error } = await db
      .from('crawled_events')
      .update({ status: 'rejected', reviewed_by: session.loginId, reviewed_at: now })
      .eq('id', id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // 승인 → announcements 테이블에 등록
  if (action === 'approve') {
    if (!eventData) {
      return Response.json({ error: '승인 시 eventData가 필요합니다.' }, { status: 400 })
    }

    const { exchange, coin, amount, requireApply, apiAllowed, link, notes, startDate, endDate } =
      eventData

    if (!exchange || !coin || !startDate || !endDate) {
      return Response.json({ error: '거래소, 코인, 기간은 필수입니다.' }, { status: 400 })
    }

    // 링크 URL 검증
    let safeLink: string | null = null
    if (link && typeof link === 'string') {
      try {
        const u = new URL(link.trim())
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return Response.json({ error: '링크는 http 또는 https만 허용됩니다.' }, { status: 400 })
        }
        safeLink = u.toString().slice(0, 500)
      } catch {
        return Response.json({ error: '유효하지 않은 링크 형식입니다.' }, { status: 400 })
      }
    }

    const { data: announcement, error: insertError } = await db
      .from('announcements')
      .insert({
        exchange,
        coin: String(coin).toUpperCase(),
        amount: amount || null,
        require_apply: !!requireApply,
        api_allowed: apiAllowed !== false,
        link: safeLink,
        notes: notes ? String(notes).slice(0, 2000) : null,
        start_date: startDate,
        end_date: endDate,
        created_by: session.userId,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    // crawled_events 상태 업데이트
    await db
      .from('crawled_events')
      .update({
        status: 'approved',
        reviewed_by: session.loginId,
        reviewed_at: now,
        published_event_id: announcement.id,
      })
      .eq('id', id)

    return Response.json({ ok: true, announcementId: announcement.id })
  }

  return Response.json({ error: '알 수 없는 action입니다.' }, { status: 400 })
}
