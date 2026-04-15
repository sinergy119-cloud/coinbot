/**
 * 거래소 이벤트 크롤러 — 통합 실행
 *
 * 5개 거래소를 동시에 크롤링하고 결과를 합쳐 반환합니다.
 * 개별 거래소 오류는 해당 거래소만 건너뜁니다.
 *
 * @param keywords include/exclude 키워드 목록
 * @param since    이 시각 이후 게시된 공지만 수집 (기본: 13시간 전)
 */

import { crawlBithumb } from './bithumb'
import { crawlUpbit } from './upbit'
import { crawlCoinone } from './coinone'
import { crawlKorbit } from './korbit'
import { crawlGopax } from './gopax'
import { Keywords, DEFAULT_INCLUDE_KEYWORDS, DEFAULT_EXCLUDE_KEYWORDS } from './keywords'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export interface CrawlResult {
  items: CrawledItem[]
  errors: Array<{ exchange: string; message: string }>
}

export async function crawlAllExchanges(
  keywords?: Keywords,
  since?: Date,
  until?: Date,
): Promise<CrawlResult> {
  const kw: Keywords = keywords ?? {
    include: DEFAULT_INCLUDE_KEYWORDS,
    exclude: DEFAULT_EXCLUDE_KEYWORDS,
  }
  // 13시간 전 이후 게시된 것만 (12시간 cron + 1시간 버퍼)
  const sinceDate = since ?? new Date(Date.now() - 13 * 60 * 60 * 1000)

  const crawlers: Array<{ exchange: string; fn: () => Promise<CrawledItem[]> }> = [
    { exchange: 'BITHUMB', fn: () => crawlBithumb(kw, sinceDate, until) },
    { exchange: 'UPBIT',   fn: () => crawlUpbit(kw, sinceDate, until) },
    { exchange: 'COINONE', fn: () => crawlCoinone(kw, sinceDate, until) },
    { exchange: 'KORBIT',  fn: () => crawlKorbit(kw, sinceDate, until) },
    { exchange: 'GOPAX',   fn: () => crawlGopax(kw, sinceDate, until) },
  ]

  const settled = await Promise.allSettled(crawlers.map((c) => c.fn()))

  const items: CrawledItem[] = []
  const errors: Array<{ exchange: string; message: string }> = []

  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    } else {
      errors.push({
        exchange: crawlers[idx].exchange,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
    }
  })

  return { items, errors }
}
