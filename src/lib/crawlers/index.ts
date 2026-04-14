/**
 * 거래소 이벤트 크롤러 — 통합 실행
 *
 * 5개 거래소를 동시에 크롤링하고 결과를 합쳐 반환합니다.
 * 개별 거래소 오류는 해당 거래소만 건너뜁니다.
 */

import { crawlBithumb } from './bithumb'
import { crawlUpbit } from './upbit'
import { crawlCoinone } from './coinone'
import { crawlKorbit } from './korbit'
import { crawlGopax } from './gopax'

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

export async function crawlAllExchanges(): Promise<CrawlResult> {
  const crawlers: Array<{ exchange: string; fn: () => Promise<CrawledItem[]> }> = [
    { exchange: 'BITHUMB', fn: crawlBithumb },
    { exchange: 'UPBIT', fn: crawlUpbit },
    { exchange: 'COINONE', fn: crawlCoinone },
    { exchange: 'KORBIT', fn: crawlKorbit },
    { exchange: 'GOPAX', fn: crawlGopax },
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
