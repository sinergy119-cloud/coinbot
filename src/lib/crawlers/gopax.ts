/**
 * 고팍스 공지사항 크롤러 (공식 API)
 * API: https://www.gopax.co.kr/api/notices
 *
 * ⚠️ 엔드포인트가 변경된 경우 NOTICE_API_URL만 수정하세요.
 */

import { matchesKeyword } from './keywords'

const NOTICE_API_URL = 'https://www.gopax.co.kr/api/notices?category=event&page=1&limit=30'
const BASE_URL = 'https://www.gopax.co.kr'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlGopax(): Promise<CrawledItem[]> {
  const res = await fetch(NOTICE_API_URL, {
    headers: {
      'User-Agent': 'MyCoinBot-Crawler/1.0',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`고팍스 공지 API 오류: ${res.status}`)
  }

  const json = await res.json()

  // 응답 구조: { data: [...] } 또는 [...]
  // ⚠️ 실제 응답 구조가 다르면 아래를 수정하세요.
  const list: Array<{ id?: string | number; title?: string; slug?: string }> =
    Array.isArray(json) ? json : (json?.data ?? json?.list ?? json?.notices ?? [])

  if (!Array.isArray(list)) return []

  return list
    .filter((item) => {
      const title = item.title ?? ''
      return matchesKeyword(title)
    })
    .map((item) => {
      const id = String(item.id ?? item.slug ?? '')
      return {
        exchange: 'GOPAX',
        sourceId: id,
        title: String(item.title ?? ''),
        url: id ? `${BASE_URL}/notices/${id}` : null,
      }
    })
}
