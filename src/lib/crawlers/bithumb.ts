/**
 * 빗썸 공지사항 크롤러 (공식 API)
 * API 문서: https://api.bithumb.com/v1/notices
 *
 * ⚠️ 엔드포인트가 변경된 경우 NOTICE_API_URL만 수정하세요.
 */

import { matchesKeyword } from './keywords'

const NOTICE_API_URL = 'https://api.bithumb.com/v1/notices?noticeType=EVENT&pageSize=30&pageNo=1'
const BASE_URL = 'https://www.bithumb.com'

export interface CrawledItem {
  exchange: string
  sourceId: string
  title: string
  url: string | null
}

export async function crawlBithumb(): Promise<CrawledItem[]> {
  const res = await fetch(NOTICE_API_URL, {
    headers: { 'User-Agent': 'MyCoinBot-Crawler/1.0' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`빗썸 공지 API 오류: ${res.status}`)
  }

  const json = await res.json()

  // 응답 구조: { data: { list: [{ id, title, ... }] } }
  // ⚠️ 실제 응답 구조가 다르면 아래 경로를 수정하세요.
  const list: Array<{ id?: string | number; title?: string; noticeId?: string | number }> =
    json?.data?.list ?? json?.list ?? json?.data ?? []

  if (!Array.isArray(list)) return []

  return list
    .filter((item) => {
      const title = item.title ?? ''
      return matchesKeyword(title)
    })
    .map((item) => {
      const id = String(item.noticeId ?? item.id ?? '')
      return {
        exchange: 'BITHUMB',
        sourceId: id,
        title: String(item.title ?? ''),
        url: id ? `${BASE_URL}/customer_support/notice/detail/${id}` : null,
      }
    })
}
