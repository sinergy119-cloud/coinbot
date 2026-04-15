/**
 * 고팍스 공지사항 크롤러 (공식 REST API)
 * API: https://api.gopax.co.kr/notices
 * 문서: https://gopax.github.io/API/index.en.html
 *
 * 쿼리 파라미터:
 *   type  : 0=전체, 1=일반, 2=신규상장, 3=이벤트
 *   limit : 페이지당 항목 수
 *   page  : 0부터 시작
 *
 * 응답: [ { id, type, title, content, createdAt, updatedAt }, ... ]
 */

import { matchesKeyword, Keywords } from './keywords'
import { withRetry } from './retry'

const NOTICE_API_URL = 'https://api.gopax.co.kr/notices?type=3&limit=30&page=0'
const BASE_URL = 'https://www.gopax.co.kr'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlGopax(keywords: Keywords, since: Date, until?: Date): Promise<CrawledItem[]> {
  const res = await withRetry(
    () =>
      fetch(NOTICE_API_URL, {
        headers: {
          'User-Agent': 'MyCoinBot-Crawler/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`고팍스 공지 API 오류: ${r.status}`)
        return r
      }),
    { label: 'GOPAX' },
  )

  const json = await res.json()
  const list: Array<{ id?: string | number; title?: string; createdAt?: string }> =
    Array.isArray(json) ? json : []

  return list
    .filter((item) => {
      // 최근 12시간 이내 게시글만 수집
      if (item.createdAt) {
        const posted = new Date(item.createdAt)
        if (!isNaN(posted.getTime())) {
          if (posted < since) return false
          if (until && posted >= until) return false
        }
      }
      return matchesKeyword(item.title ?? '', keywords)
    })
    .map((item) => {
      const id = String(item.id ?? '')
      return {
        exchange: 'GOPAX',
        sourceId: id,
        title: String(item.title ?? ''),
        url: id ? `${BASE_URL}/notice/${id}` : null,
      }
    })
}
