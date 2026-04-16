/**
 * 거래소 이벤트 크롤러 — 공통 실행 로직
 *
 * cron 라우트와 관리자 수동 수집 라우트 양쪽에서 공유합니다.
 *
 * 포함된 기능:
 *  - R-2: 텔레그램 발송 성공/실패 로그 기록
 *  - 로드맵 3: crawl_logs 테이블에 실행 이력 저장
 *  - cron: crawler_settings.crawl_interval_hours 기준 interval 체크
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { crawlAllExchanges } from './index'
import { DEFAULT_INCLUDE_KEYWORDS, DEFAULT_EXCLUDE_KEYWORDS, Keywords } from './keywords'
import { sendTelegramMessage } from '@/lib/telegram'

const EXCHANGE_LABELS: Record<string, string> = {
  BITHUMB: '빗썸',
  UPBIT: '업비트',
  COINONE: '코인원',
  KORBIT: '코빗',
  GOPAX: '고팍스',
}

export interface ExecuteResult {
  message: string
  found: number
  inserted: number
  errors: Array<{ exchange: string; message: string }>
  skipped?: boolean
}

// ─────────────────────────────────────────────
export async function executeCrawl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  triggeredBy: 'cron' | 'manual',
  sinceOverride?: Date,
): Promise<{ httpStatus: number; result: ExecuteResult }> {

  // ── Cron: interval 체크 ──
  if (triggeredBy === 'cron') {
    const { data: settings } = await db
      .from('crawler_settings')
      .select('key, value')
      .eq('key', 'next_crawl_at')
      .maybeSingle()

    const nextCrawlAt = settings?.value ? new Date(settings.value) : null

    if (nextCrawlAt && new Date() < nextCrawlAt) {
      return {
        httpStatus: 200,
        result: {
          message: `스킵 — 다음 수집 예정: ${nextCrawlAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
          found: 0,
          inserted: 0,
          errors: [],
          skipped: true,
        },
      }
    }
  }

  // ── since / until 결정 ──
  // sinceOverride 있으면: 해당 날 하루치 (00:00 KST ~ 다음날 00:00 KST)
  // sinceOverride 없으면: crawler_settings.crawl_interval_hours + 1시간 여유
  //   (interval이 2시간이면 since는 3시간 전 — 누락 방지 1시간 오버랩)
  let lookbackHours = 13
  if (!sinceOverride) {
    const { data: intervalSetting } = await db
      .from('crawler_settings')
      .select('value')
      .eq('key', 'crawl_interval_hours')
      .maybeSingle()
    const intervalHours = parseInt(intervalSetting?.value ?? '12')
    if (!isNaN(intervalHours) && intervalHours > 0) {
      lookbackHours = intervalHours + 1
    }
  }
  const since = sinceOverride ?? new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
  const until = sinceOverride
    ? new Date(sinceOverride.getTime() + 24 * 60 * 60 * 1000)
    : undefined

  // ── 1) 키워드 로드 ──
  const { data: kwData } = await db.from('crawler_keywords').select('keyword, type')
  const keywords: Keywords =
    kwData && kwData.length > 0
      ? {
          include: kwData.filter((k: { type: string }) => k.type === 'include').map((k: { keyword: string }) => k.keyword),
          exclude: kwData.filter((k: { type: string }) => k.type === 'exclude').map((k: { keyword: string }) => k.keyword),
        }
      : {
          include: DEFAULT_INCLUDE_KEYWORDS,
          exclude: DEFAULT_EXCLUDE_KEYWORDS,
        }

  // ── 2) 크롤링 실행 ──
  const { items, errors } = await crawlAllExchanges(keywords, since, until)

  // ── 3) crawl_logs 초기 삽입 ──
  const { data: logRow } = await db
    .from('crawl_logs')
    .insert({
      triggered_by: triggeredBy,
      found_count: items.length,
      inserted_count: 0,
      errors,
    })
    .select('id')
    .single()
  const logId: string | undefined = logRow?.id

  // ── Cron: next_crawl_at 업데이트 (이벤트 유무와 무관) ──
  if (triggeredBy === 'cron') {
    await updateNextCrawlAt(db)
  }

  // 이벤트 없으면 조기 반환
  if (items.length === 0) {
    return {
      httpStatus: 200,
      result: { message: '수집된 이벤트 없음', found: 0, inserted: 0, errors },
    }
  }

  // ── 4) DB upsert ──
  const rows = items.map((item) => ({
    exchange: item.exchange,
    source_id: item.sourceId,
    title: item.title,
    url: item.url,
  }))

  const { data: upserted, error: upsertError } = await db
    .from('crawled_events')
    .upsert(rows, { onConflict: 'exchange,source_id', ignoreDuplicates: true })
    .select()

  if (upsertError) {
    console.error('[executeCrawl] DB upsert 오류:', upsertError)
    return {
      httpStatus: 500,
      result: { message: 'DB 저장 실패', found: items.length, inserted: 0, errors },
    }
  }

  const inserted = upserted?.length ?? 0

  // ── 5) 텔레그램 알림 (R-2: 성공/실패 모두 기록) ──
  let telegramSent = false
  let telegramError: string | null = null

  if (inserted > 0) {
    try {
      const adminId = process.env.ADMIN_USER_ID
      if (!adminId) throw new Error('ADMIN_USER_ID 환경변수 미설정')

      const { data: admin } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', adminId)
        .single()

      if (!admin?.telegram_chat_id) throw new Error('관리자 telegram_chat_id 없음')

      const countByExchange: Record<string, number> = {}
      for (const item of upserted ?? []) {
        const ex = item.exchange as string
        countByExchange[ex] = (countByExchange[ex] ?? 0) + 1
      }
      const exchangeLines = Object.entries(countByExchange)
        .map(([ex, cnt]) => `  • ${EXCHANGE_LABELS[ex] ?? ex}: ${cnt}건`)
        .join('\n')
      const previews = (upserted ?? [])
        .slice(0, 5)
        .map((item) => `  📌 [${EXCHANGE_LABELS[item.exchange as string] ?? item.exchange}] ${item.title}`)
        .join('\n')
      const more = inserted > 5 ? `\n  ...외 ${inserted - 5}건` : ''
      const tag = triggeredBy === 'manual' ? ' (수동)' : ''

      const msg = [
        `🔔 <b>코인봇 이벤트 신규 수집${tag}</b>`,
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
      telegramSent = true
    } catch (err) {
      // R-2: 발송 실패 로그 (운영 추적용)
      telegramError = err instanceof Error ? err.message : String(err)
      console.error('[executeCrawl] 텔레그램 발송 실패:', telegramError)
    }
  }

  // ── 6) crawl_logs 최종 업데이트 ──
  if (logId) {
    await db
      .from('crawl_logs')
      .update({
        inserted_count: inserted,
        telegram_sent: telegramSent,
        telegram_error: telegramError,
      })
      .eq('id', logId)
  }

  return {
    httpStatus: 200,
    result: {
      message: '크롤링 완료',
      found: items.length,
      inserted,
      errors,
    },
  }
}

// ── next_crawl_at 업데이트 헬퍼 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateNextCrawlAt(db: SupabaseClient<any, any, any>) {
  const { data: intervalSetting } = await db
    .from('crawler_settings')
    .select('value')
    .eq('key', 'crawl_interval_hours')
    .maybeSingle()

  const intervalHours = parseInt(intervalSetting?.value ?? '12')
  const nextCrawlAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()

  await db
    .from('crawler_settings')
    .upsert({ key: 'next_crawl_at', value: nextCrawlAt })
}
