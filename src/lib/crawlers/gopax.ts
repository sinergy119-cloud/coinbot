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
 *
 * ⚠️ 엔드포인트가 변경된 경우 NOTICE_API_URL만 수정하세요.
 */

import { matchesKeyword } from './keywords'

// type=3 (이벤트) + type=0 (전체 — 키워드로 필터) 동시 수집
const NOTICE_API_URL = 'https://api.gopax.co.kr/notices?type=3&limit=30&page=0'
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

  // 응답: 배열 형태 [ { id, type, title, content, createdAt } ]
  const list: Array<{ id?: string | number; title?: string }> = Array.isArray(json) ? json : []

  if (!Array.isArray(list)) return []

  return list
    .filter((item) => matchesKeyword(item.title ?? ''))
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
