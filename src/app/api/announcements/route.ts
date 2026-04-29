import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendNotification } from '@/lib/app/notifications'
import { EXCHANGE_LABELS, type Exchange } from '@/types/database'

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

  // 캐시 무효화 — /app 홈 진행 이벤트 목록이 즉시 반영되도록
  revalidateTag('announcements', 'max')

  // 신규 이벤트 푸시 발송 — 모든 일반 사용자에게 fan-out (관리자 자신은 제외)
  // 발송 실패해도 이벤트 등록 자체는 성공으로 간주
  ;(async () => {
    try {
      const { data: targetUsers } = await db
        .from('users')
        .select('id')
        .neq('id', session.userId)
        .neq('status', 'suspended')

      if (!targetUsers || targetUsers.length === 0) return

      const exchangeLabel = EXCHANGE_LABELS[data.exchange as Exchange] ?? data.exchange
      const title = `🎁 ${exchangeLabel} ${data.coin} 신규 이벤트`
      const bodyParts: string[] = []
      if (data.amount) bodyParts.push(`보상 ${data.amount}`)
      if (data.start_date && data.end_date) bodyParts.push(`${data.start_date}~${data.end_date}`)
      if (data.require_apply) bodyParts.push('신청 필요')
      if (data.api_allowed === false) bodyParts.push('거래소 직접 거래')
      const body = bodyParts.join(' · ') || '새로운 에어드랍 이벤트가 등록되었습니다.'

      await Promise.allSettled(
        targetUsers.map((u) =>
          sendNotification({
            userId: u.id,
            category: 'event',
            title,
            body,
            deepLink: `/app/events/${data.id}`,
            metadata: { eventId: data.id, exchange: data.exchange, coin: data.coin },
          }),
        ),
      )
    } catch (err) {
      console.error('[announcements] push fan-out error:', err)
    }
  })()

  return Response.json(data, { status: 201 })
}
