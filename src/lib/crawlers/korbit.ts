/**
 * 코빗 공지사항 크롤러 (Contentful CMS API)
 * 대상 URL: https://portal-prod.korbit.co.kr/api/korbit/v2/contentful
 *
 * 코빗은 Contentful CMS를 사용하며, 내부 프록시 API를 통해 공지를 제공합니다.
 * 요청 시 platform-identifier / korbit_platform_id 헤더가 필요합니다.
 */

import { matchesKeyword, Keywords } from './keywords'
import { withRetry } from './retry'

const PORTAL_API = 'https://portal-prod.korbit.co.kr'
const NOTICE_API = `${PORTAL_API}/api/korbit/v2/contentful`
const BASE_URL = 'https://www.korbit.co.kr'

/** Contentful API 요청에 필요한 헤더 */
const KORBIT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; MyCoinBot-Crawler/1.0)',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'platform-identifier': 'witcher_ios',
  'korbit_platform_id': '21',
}

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

interface ContentfulItem {
  sys: {
    id: string
    createdAt: string
    updatedAt: string
    contentType?: { sys: { id: string } }
  }
  fields: {
    title?: string
    category?: string
    isPinned?: boolean
    isServed?: string
  }
}

interface ContentfulResponse {
  sys?: { type: string }
  total?: number
  skip?: number
  limit?: number
  items?: ContentfulItem[]
}

export async function crawlKorbit(keywords: Keywords, since: Date, until?: Date): Promise<CrawledItem[]> {
  // 서버사이드 날짜 필터 적용 (since - 1시간 여유)
  const sinceWithBuffer = new Date(since.getTime() - 60 * 60 * 1000)
  const params = new URLSearchParams({
    content_type: 'notice',
    limit: '100',
    order: '-sys.createdAt',
    'sys.createdAt[gte]': sinceWithBuffer.toISOString(),
  })

  const res = await withRetry(
    () =>
      fetch(`${NOTICE_API}?${params}`, {
        headers: KORBIT_HEADERS,
        signal: AbortSignal.timeout(15_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`코빗 공지 API 오류: ${r.status}`)
        return r
      }),
    { label: 'KORBIT' },
  )

  const data: ContentfulResponse = await res.json()

  if (!data?.items || !Array.isArray(data.items)) {
    return []
  }

  return data.items
    .filter((item) => {
      const createdAt = item?.sys?.createdAt
      if (createdAt) {
        const posted = new Date(createdAt)
        if (!isNaN(posted.getTime())) {
          if (posted < since) return false
          if (until && posted >= until) return false
        }
      }
      const title = item?.fields?.title ?? ''
      return matchesKeyword(title, keywords)
    })
    .map((item) => {
      const id = item?.sys?.id ?? ''
      const title = String(item?.fields?.title ?? '')
      return {
        exchange: 'KORBIT',
        sourceId: id,
        title,
        url: id ? `${BASE_URL}/notice/detail/?noticeId=${id}` : null,
      }
    })
}
