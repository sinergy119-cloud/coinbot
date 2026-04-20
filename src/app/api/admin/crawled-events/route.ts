/**
 * /api/admin/crawled-events ???˜ì§‘ ?´ë²¤??ê´€ë¦?(ê´€ë¦¬ì ?„ìš©)
 *
 * GET  ?status=pending|approved|rejected  ëª©ë¡ ì¡°íšŒ
 * POST { action: 'approve'|'reject', id, eventData? }  ?¹ì¸/ê±°ì ˆ ì²˜ë¦¬
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/crawled-events
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
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
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const body = await req.json()
  const { action, id, eventData } = body

  if (!id || !action) {
    return Response.json({ error: 'id?€ action?€ ?„ìˆ˜?…ë‹ˆ??' }, { status: 400 })
  }

  const db = createServerClient()
  const now = new Date().toISOString()

  // ê±°ì ˆ
  if (action === 'reject') {
    const { error } = await db
      .from('crawled_events')
      .update({ status: 'rejected', reviewed_by: session.loginId, reviewed_at: now })
      .eq('id', id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // ?¹ì¸ ??announcements ?Œì´ë¸”ì— ?±ë¡
  if (action === 'approve') {
    if (!eventData) {
      return Response.json({ error: '?¹ì¸ ??eventDataê°€ ?„ìš”?©ë‹ˆ??' }, { status: 400 })
    }

    const { exchange, coin, amount, requireApply, apiAllowed, link, notes, startDate, endDate } =
      eventData

    if (!exchange || !coin || !startDate || !endDate) {
      return Response.json({ error: 'ê±°ë˜?? ì½”ì¸, ê¸°ê°„?€ ?„ìˆ˜?…ë‹ˆ??' }, { status: 400 })
    }

    // ë§í¬ URL ê²€ì¦?
    let safeLink: string | null = null
    if (link && typeof link === 'string') {
      try {
        const u = new URL(link.trim())
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return Response.json({ error: 'ë§í¬??http ?ëŠ” httpsë§??ˆìš©?©ë‹ˆ??' }, { status: 400 })
        }
        safeLink = u.toString().slice(0, 500)
      } catch {
        return Response.json({ error: '? íš¨?˜ì? ?Šì? ë§í¬ ?•ì‹?…ë‹ˆ??' }, { status: 400 })
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

    // crawled_events ?íƒœ ?…ë°?´íŠ¸
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

  // ?´ë²¤??ê´€ë¦???—??ì§ì ‘ ?±ë¡ ???˜ì§‘ ?´ë²¤?¸ë? approvedë¡??°ê²°
  if (action === 'mark-approved') {
    const { announcementId } = body
    const { error } = await db
      .from('crawled_events')
      .update({
        status: 'approved',
        reviewed_by: session.loginId,
        reviewed_at: now,
        published_event_id: announcementId ?? null,
      })
      .eq('id', id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: '?????†ëŠ” action?…ë‹ˆ??' }, { status: 400 })
}
