import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/announcements → 활성 이벤트 목록
// - 기본: 진행 중 이벤트만 (모든 사용자)
// - ?all=true: 전체 이벤트 (관리자만)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const includeAll = req.nextUrl.searchParams.get('all') === 'true'
  if (includeAll && !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()

  if (includeAll) {
    const { data } = await db
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    return Response.json(data ?? [])
  }

  // KST 기준 오늘 날짜
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

// POST /api/announcements → 이벤트 등록 (관리자만)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { exchange, coin, amount, requireApply, apiAllowed, link, notes, startDate, endDate, rewardDate } = await req.json()

  if (!exchange || !coin || !startDate || !endDate) {
    return Response.json({ error: '거래소, 코인, 기간은 필수입니다.' }, { status: 400 })
  }

  // 링크 URL 검증 (http/https만 허용, javascript: 등 차단)
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

  // notes 길이 제한 (2000자)
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
    return Response.json({ error: '이벤트 등록에 실패했습니다.' }, { status: 500 })
  }
  return Response.json(data, { status: 201 })
}
