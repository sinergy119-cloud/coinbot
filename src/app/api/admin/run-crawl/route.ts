/**
 * POST /api/admin/run-crawl
 *
 * 관리자 세션 인증으로 즉시 크롤링을 실행합니다.
 * "지금 수집" 버튼에서 호출 — CRON_SECRET 불필요.
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'
import { crawlAllExchanges } from '@/lib/crawlers/index'
import { DEFAULT_INCLUDE_KEYWORDS, DEFAULT_EXCLUDE_KEYWORDS, Keywords } from '@/lib/crawlers/keywords'
import { sendTelegramMessage } from '@/lib/telegram'

const EXCHANGE_LABELS: Record<string, string> = {
  BITHUMB: '빗썸',
  UPBIT: '업비트',
  COINONE: '코인원',
  KORBIT: '코빗',
  GOPAX: '고팍스',
}

export async function POST(_req: NextRequest) {
  // 관리자 세션 인증
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()

  // 1) DB에서 키워드 로드
  const { data: kwData } = await db.from('crawler_keywords').select('keyword, type')

  const keywords: Keywords =
    kwData && kwData.length > 0
      ? {
          include: kwData.filter((k) => k.type === 'include').map((k) => k.keyword),
          exclude: kwData.filter((k) => k.type === 'exclude').map((k) => k.keyword),
        }
      : {
          include: DEFAULT_INCLUDE_KEYWORDS,
          exclude: DEFAULT_EXCLUDE_KEYWORDS,
        }

  // 2) 크롤링 실행 (최근 13시간 이내)
  const since = new Date(Date.now() - 13 * 60 * 60 * 1000)
  const { items, errors } = await crawlAllExchanges(keywords, since)

  if (items.length === 0) {
    return Response.json({ message: '수집된 이벤트 없음', found: 0, inserted: 0, errors })
  }

  // 3) DB upsert (중복 자동 무시)
  const rows = items.map((item) => ({
    exchange: item.exchange,
    source_id: item.sourceId,
    title: item.title,
    url: item.url,
  }))

  const { data, error } = await db
    .from('crawled_events')
    .upsert(rows, { onConflict: 'exchange,source_id', ignoreDuplicates: true })
    .select()

  if (error) {
    console.error('[run-crawl] DB upsert 오류:', error)
    return Response.json({ error: 'DB 저장 실패', detail: error.message }, { status: 500 })
  }

  const inserted = data?.length ?? 0

  // 4) 신규 수집 건수 > 0 이면 텔레그램 알림
  if (inserted > 0) {
    try {
      const adminId = process.env.ADMIN_USER_ID
      if (adminId) {
        const { data: admin } = await db
          .from('users')
          .select('telegram_chat_id')
          .eq('user_id', adminId)
          .single()

        if (admin?.telegram_chat_id) {
          const countByExchange: Record<string, number> = {}
          for (const item of data ?? []) {
            const ex = item.exchange as string
            countByExchange[ex] = (countByExchange[ex] ?? 0) + 1
          }
          const exchangeLines = Object.entries(countByExchange)
            .map(([ex, cnt]) => `  • ${EXCHANGE_LABELS[ex] ?? ex}: ${cnt}건`)
            .join('\n')

          const previews = (data ?? [])
            .slice(0, 5)
            .map((item) => `  📌 [${EXCHANGE_LABELS[item.exchange as string] ?? item.exchange}] ${item.title}`)
            .join('\n')
          const more = inserted > 5 ? `\n  ...외 ${inserted - 5}건` : ''

          const msg = [
            `🔔 <b>코인봇 이벤트 신규 수집 (수동)</b>`,
            ``,
            `총 <b>${inserted}건</b> 새로 수집되었습니다.`,
            ``,
            `<b>거래소별 수집 현황</b>`,
            exchangeLines,
            ``,
            `<b>수집 목록 (최대 5건)</b>`,
            previews + more,
            ``,
            `👉 관리자 페이지 → 수집 이벤트 탭에서 검토하세요.`,
          ].join('\n')

          await sendTelegramMessage(admin.telegram_chat_id, msg)
        }
      }
    } catch {
      // 텔레그램 발송 실패는 무시
    }
  }

  return Response.json({
    message: '크롤링 완료',
    found: items.length,
    inserted,
    errors,
  })
}
