import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/announcements ???œì„± ?´ë²¤??ëª©ë¡
// - ê¸°ë³¸: ì§„í–‰ ì¤??´ë²¤?¸ë§Œ (ëª¨ë“  ?¬ìš©??
// - ?all=true: ?„ì²´ ?´ë²¤??(ê´€ë¦¬ìë§?
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'ë¡œê·¸???„ìš”' }, { status: 401 })

  const includeAll = req.nextUrl.searchParams.get('all') === 'true'
  if (includeAll && !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const db = createServerClient()

  if (includeAll) {
    const { data } = await db
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    return Response.json(data ?? [])
  }

  // KST ê¸°ì? ?¤ëŠ˜ ? ì§œ
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const today = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`

  const { data } = await db
    .from('announcements')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

// POST /api/announcements ???´ë²¤???±ë¡ (ê´€ë¦¬ìë§?
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const { exchange, coin, amount, requireApply, apiAllowed, link, notes, startDate, endDate, rewardDate } = await req.json()

  if (!exchange || !coin || !startDate || !endDate) {
    return Response.json({ error: 'ê±°ë˜?? ì½”ì¸, ê¸°ê°„?€ ?„ìˆ˜?…ë‹ˆ??' }, { status: 400 })
  }

  // ë§í¬ URL ê²€ì¦?(http/httpsë§??ˆìš©, javascript: ??ì°¨ë‹¨)
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

  // notes ê¸¸ì´ ?œí•œ (2000??
  const safeNotes = notes && typeof notes === 'string' ? notes.slice(0, 2000) : null

  const db = createServerClient()
  const { data, error } = await db
    .from('announcements')
    .insert({
      exchange,
      coin: coin.toUpperCase(),
      amount: amount || null,
      require_apply: !!requireApply,
      api_allowed: apiAllowed !== false,
      link: safeLink,
      notes: safeNotes,
      start_date: startDate,
      end_date: endDate,
      reward_date: rewardDate || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    console.error('[announcements] insert error:', error)
    return Response.json({ error: '?´ë²¤???±ë¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.' }, { status: 500 })
  }
  return Response.json(data, { status: 201 })
}
