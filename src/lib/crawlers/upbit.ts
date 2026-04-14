/**
 * 업비트 공지사항 크롤러
 *
 * ⚠️ EC2 IP 차단 이슈 (2026-04-14 확인)
 * ─────────────────────────────────────────────────────────────
 * 업비트는 Cloudflare WAF를 사용합니다.
 * AWS EC2 IP 대역(43.x.x.x 등)에서 호출 시 HTTP 403을 반환합니다.
 * - api-manager.upbit.com/api/v1/announcements → 403
 * - upbit.com/service_center/notice (HTML) → 403
 *
 * 이 크롤러는 에러를 throw하여 crawlAllExchanges의 Promise.allSettled가
 * 업비트만 건너뛰고 나머지 4개 거래소 수집을 계속하도록 합니다.
 *
 * 근본 해결 방안:
 *  A) 국내 ISP IP 경유 프록시 서버 사용
 *  B) 업비트 공식 텔레그램 채널 모니터링으로 대체
 * ─────────────────────────────────────────────────────────────
 *
 * API: https://api-manager.upbit.com/api/v1/announcements
 * - os=web, page, per_page, category 파라미터 사용
 * - 인증 불필요 (공개 엔드포인트) — 단, EC2 IP 차단됨
 *
 * 발견 경위: 업비트 웹 소스 번들(sri-v2-client-redux-state-bundle) 역분석
 */

import { CrawledItem } from './bithumb'
import { Keywords } from './keywords'

const BASE_URL = 'https://api-manager.upbit.com/api/v1/announcements'

interface UpbitNotice {
  id: number
  title: string
  category: string
  listed_at: string
  first_listed_at: string
  need_new_badge: boolean
  need_update_badge: boolean
}

interface UpbitResponse {
  success: boolean
  data: {
    total_pages: number
    total_count: number
    notices: UpbitNotice[]
    fixed_notices: UpbitNotice[]
  }
}

export async function crawlUpbit(keywords: Keywords, since: Date): Promise<CrawledItem[]> {
  const results: CrawledItem[] = []
  const seen = new Set<number>()

  const url = new URL(BASE_URL)
  url.searchParams.set('os', 'web')
  url.searchParams.set('page', '1')
  url.searchParams.set('per_page', '50')
  url.searchParams.set('category', 'all')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Referer: 'https://upbit.com/service_center/notice',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    // 403: EC2 IP가 Cloudflare WAF에 차단됨 (알려진 이슈)
    if (res.status === 403) {
      throw new Error('업비트 API 접근 차단 (EC2 IP → Cloudflare WAF 403). 국내 IP 프록시 필요.')
    }
    throw new Error(`업비트 API 응답 오류: ${res.status}`)
  }

  const json: UpbitResponse = await res.json()

  if (!json.success || !json.data) {
    throw new Error('업비트 API 응답 형식 오류')
  }

  const allNotices = [...json.data.notices, ...json.data.fixed_notices]

  for (const notice of allNotices) {
    if (seen.has(notice.id)) continue
    seen.add(notice.id)

    const listedAt = new Date(notice.listed_at)
    if (listedAt < since) continue

    const title = notice.title
    const titleLower = title.toLowerCase()

    const hasInclude = keywords.include.some((kw) => titleLower.includes(kw.toLowerCase()))
    const hasExclude = keywords.exclude.some((kw) => titleLower.includes(kw.toLowerCase()))

    if (!hasInclude || hasExclude) continue

    results.push({
      exchange: 'UPBIT',
      sourceId: String(notice.id),
      title,
      url: `https://upbit.com/service_center/notice?id=${notice.id}`,
    })
  }

  return results
}
